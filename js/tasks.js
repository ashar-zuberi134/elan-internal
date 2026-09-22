// Live Tasks — one row per task.
//
// The previous implementation kept all tasks in a single JSONB blob and
// rewrote the whole blob on every change, merging local over remote. That
// merge re-added anything missing from the local list, which meant a deleted
// task was always resurrected by the very save that was meant to remove it.
// Here each mutation touches exactly one row, so a delete is a delete.

import { sb } from './supabase.js';
import { userId } from './auth.js';
import { esc, escMultiline, toast, confirmDialog, relativeDay } from './ui.js';

const DONE_SHOW_LIMIT = 3;

let people       = [];
let tasks        = [];
let channel      = null;
const doneExpanded = new Map();

const byPerson = id => tasks.filter(t => t.person_id === id);

// ── Data ────────────────────────────────────────────────────────────────────

async function fetchAll() {
  const [peopleRes, tasksRes] = await Promise.all([
    sb.from('people').select('*').order('sort_order'),
    sb.from('tasks').select('*'),
  ]);
  if (peopleRes.error) throw peopleRes.error;
  if (tasksRes.error)  throw tasksRes.error;

  people = peopleRes.data;
  tasks  = tasksRes.data;
  people.forEach(p => { if (!doneExpanded.has(p.id)) doneExpanded.set(p.id, false); });
}

// Active tasks: soonest due date first, undated last, then newest.
// Completed: most recently finished first.
function sortForColumn(list, status) {
  return list.sort((a, b) => {
    if (status === 'done') return new Date(b.completed_at) - new Date(a.completed_at);
    if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
    if (a.due_date) return -1;
    if (b.due_date) return 1;
    return new Date(b.created_at) - new Date(a.created_at);
  });
}

// ── Rendering ───────────────────────────────────────────────────────────────

function dueBadge(dueDate) {
  const diff = relativeDay(dueDate);
  if (diff === null) return '';
  let cls = 'task-due';
  if (diff < 0)       cls += ' task-due--overdue';
  else if (diff <= 3) cls += ' task-due--soon';
  const due   = new Date(`${dueDate}T00:00:00`);
  const label = diff < 0   ? `${Math.abs(diff)}d overdue`
              : diff === 0 ? 'Due today'
              : diff === 1 ? 'Due tomorrow'
              : `Due ${due.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
  return `<span class="${cls}">${label}</span>`;
}

function taskCard(t) {
  const isDone = t.status === 'done';
  return `
    <article class="task-card ${isDone ? 'task-card--done' : ''} ${t._pending ? 'task-card--pending' : ''}"
             data-id="${esc(t.id)}">
      <div class="task-card-title">${esc(t.title)}</div>
      ${t.description ? `<div class="task-card-desc">${escMultiline(t.description)}</div>` : ''}
      ${dueBadge(t.due_date)}
      <div class="task-card-actions">
        ${isDone
          ? `<button class="task-btn task-btn--reopen" data-action="reopen" data-id="${esc(t.id)}">↩ Reopen</button>`
          : `<button class="task-btn task-btn--done"   data-action="complete" data-id="${esc(t.id)}">✓ Complete</button>`}
        <button class="task-btn task-btn--edit"   data-action="edit"   data-id="${esc(t.id)}">✎ Edit</button>
        <button class="task-btn task-btn--delete" data-action="delete" data-id="${esc(t.id)}"
                title="Delete task" aria-label="Delete task">✕</button>
      </div>
    </article>`;
}

export function renderBoard() {
  const board = document.getElementById('tasks-board');
  if (!board) return;

  board.innerHTML = people.map(person => {
    const mine     = byPerson(person.id);
    const active   = sortForColumn(mine.filter(t => t.status === 'active'), 'active');
    const done     = sortForColumn(mine.filter(t => t.status === 'done'), 'done');
    const expanded = doneExpanded.get(person.id);
    const visible  = expanded ? done : done.slice(0, DONE_SHOW_LIMIT);
    const overdue  = active.filter(t => relativeDay(t.due_date) < 0).length;

    const doneFooter = done.length > DONE_SHOW_LIMIT
      ? `<button class="tasks-show-more" data-toggle-done="${esc(person.id)}">
           ${expanded ? '▲ Show less' : `▼ Show ${done.length - DONE_SHOW_LIMIT} more`}
         </button>`
      : '';

    return `
      <section class="tasks-col">
        <header class="tasks-col-header" style="--accent:${esc(person.accent)}">
          <div class="tasks-col-name">${esc(person.label)}</div>
          <div class="tasks-col-role">${esc(person.role)}</div>
          ${overdue ? `<div class="tasks-col-overdue">${overdue} overdue</div>` : ''}
        </header>

        <div class="tasks-section-label">In Progress <span class="tasks-count">${active.length}</span></div>
        <div class="tasks-section">
          ${active.length ? active.map(taskCard).join('') : '<div class="tasks-empty">No active tasks</div>'}
        </div>

        <div class="tasks-section-label tasks-section-label--done">
          Completed <span class="tasks-count">${done.length}</span>
        </div>
        <div class="tasks-section">
          ${visible.length ? visible.map(taskCard).join('') : '<div class="tasks-empty">Nothing yet</div>'}
          ${doneFooter}
        </div>
      </section>`;
  }).join('');
}

// ── Mutations ───────────────────────────────────────────────────────────────
// Each one applies locally first so the board responds instantly, then
// persists. If the write fails the local change is rolled back and the user
// is told — the old build logged failures to the console and looked fine.

async function withRollback(mutate, persist, failureMessage) {
  const snapshot = tasks.map(t => ({ ...t }));
  mutate();
  renderBoard();

  const { error } = await persist();
  if (error) {
    tasks = snapshot;
    renderBoard();
    toast(`${failureMessage} — ${error.message}`, 'error');
    return false;
  }
  return true;
}

async function createTask({ person_id, title, description, due_date }) {
  const uid = userId();
  const { data, error } = await sb.from('tasks')
    .insert({ person_id, title, description, due_date, status: 'active',
              created_by: uid, updated_by: uid })
    .select()
    .single();

  if (error) { toast(`Could not add task — ${error.message}`, 'error'); return false; }
  tasks.push(data);
  renderBoard();
  toast('Task added');
  return true;
}

async function updateTask(id, patch, failureMessage) {
  const idx = tasks.findIndex(t => t.id === id);
  if (idx === -1) return false;

  return withRollback(
    () => { tasks[idx] = { ...tasks[idx], ...patch, _pending: true }; },
    async () => {
      const { data, error } = await sb.from('tasks')
        .update({ ...patch, updated_by: userId() })
        .eq('id', id)
        .select()
        .single();
      if (!error && data) {
        const i = tasks.findIndex(t => t.id === id);
        if (i !== -1) tasks[i] = data;
        renderBoard();
      }
      return { error };
    },
    failureMessage,
  );
}

async function deleteTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  const ok = await confirmDialog({
    title: 'Delete task',
    body: `"${task.title}" will be permanently deleted. This cannot be undone.`,
    confirmLabel: 'Delete',
    danger: true,
  });
  if (!ok) return;

  const done = await withRollback(
    () => { tasks = tasks.filter(t => t.id !== id); },
    async () => {
      const { error } = await sb.from('tasks').delete().eq('id', id);
      return { error };
    },
    'Could not delete task',
  );
  if (done) toast('Task deleted');
}

// ── Modal ───────────────────────────────────────────────────────────────────

function openModal(existing = null) {
  const isEdit = !!existing;
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal modal--wide" role="dialog" aria-modal="true">
      <div class="modal-header">
        <div class="modal-title">${isEdit ? 'Edit task' : 'Add task'}</div>
        <button class="modal-close" data-close aria-label="Close">✕</button>
      </div>
      <div class="modal-fields">
        ${!isEdit ? `
        <div>
          <label class="modal-label">Assigned to</label>
          <div class="tasks-person-pick" id="task-person-pick">
            ${people.map(p => `<button type="button" class="task-person-btn" data-person="${esc(p.id)}"
                                       style="--accent:${esc(p.accent)}">${esc(p.label)}</button>`).join('')}
          </div>
        </div>` : ''}
        <div>
          <label class="modal-label" for="task-title-input">Title</label>
          <input class="modal-input" id="task-title-input" type="text"
                 placeholder="What needs to be done?" value="${esc(existing?.title ?? '')}" />
        </div>
        <div>
          <label class="modal-label" for="task-desc-input">Description <span class="modal-optional">(optional)</span></label>
          <textarea class="modal-input" id="task-desc-input" rows="3"
                    placeholder="Any extra context or notes…">${esc(existing?.description ?? '')}</textarea>
        </div>
        <div>
          <label class="modal-label" for="task-due-input">Due date <span class="modal-optional">(optional)</span></label>
          <input class="modal-input" id="task-due-input" type="date" value="${esc(existing?.due_date ?? '')}" />
        </div>
        <div class="modal-actions">
          <button class="btn" data-close>Cancel</button>
          <button class="btn btn--primary" id="task-modal-save">${isEdit ? 'Save changes' : 'Add task'}</button>
        </div>
      </div>
    </div>`;

  document.body.appendChild(backdrop);

  let selectedPerson = existing?.person_id ?? null;
  const titleInput = backdrop.querySelector('#task-title-input');

  backdrop.querySelectorAll('.task-person-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      backdrop.querySelectorAll('.task-person-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedPerson = btn.dataset.person;
      backdrop.querySelector('#task-person-pick').classList.remove('field-error');
    });
  });

  const close = () => { backdrop.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);

  backdrop.addEventListener('click', e => {
    if (e.target === backdrop || e.target.hasAttribute('data-close')) close();
  });

  const save = async () => {
    const title = titleInput.value.trim();
    if (!title) { titleInput.classList.add('field-error'); titleInput.focus(); return; }
    if (!isEdit && !selectedPerson) {
      backdrop.querySelector('#task-person-pick').classList.add('field-error');
      return;
    }

    const payload = {
      title,
      description: backdrop.querySelector('#task-desc-input').value.trim(),
      due_date:    backdrop.querySelector('#task-due-input').value || null,
    };

    const btn = backdrop.querySelector('#task-modal-save');
    btn.disabled = true;
    btn.textContent = 'Saving…';

    const ok = isEdit
      ? await updateTask(existing.id, payload, 'Could not save changes')
      : await createTask({ person_id: selectedPerson, ...payload });

    if (ok) close();
    else { btn.disabled = false; btn.textContent = isEdit ? 'Save changes' : 'Add task'; }
  };

  backdrop.querySelector('#task-modal-save').addEventListener('click', save);
  titleInput.addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
  titleInput.focus();
}

// ── Realtime ────────────────────────────────────────────────────────────────
// Keeps a second open tab (or a teammate's screen) current without a refresh.

function subscribe() {
  channel = sb.channel('tasks-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, payload => {
      const { eventType, new: row, old } = payload;
      if (eventType === 'INSERT') {
        if (!tasks.some(t => t.id === row.id)) tasks.push(row);
      } else if (eventType === 'UPDATE') {
        const i = tasks.findIndex(t => t.id === row.id);
        if (i !== -1) tasks[i] = row; else tasks.push(row);
      } else if (eventType === 'DELETE') {
        tasks = tasks.filter(t => t.id !== old.id);
      }
      renderBoard();
    })
    .subscribe();
}

// ── Init ────────────────────────────────────────────────────────────────────

export async function initTasks() {
  const board = document.getElementById('tasks-board');
  if (board) board.innerHTML = '<div class="tasks-loading">Loading…</div>';

  try {
    await fetchAll();
  } catch (err) {
    if (board) board.innerHTML =
      `<div class="tasks-error">Could not load tasks — ${esc(err.message)}</div>`;
    return;
  }

  renderBoard();
  subscribe();

  document.getElementById('tasks-add-btn')?.addEventListener('click', () => openModal());

  document.getElementById('tasks-board').addEventListener('click', async e => {
    const btn = e.target.closest('[data-action], [data-toggle-done]');
    if (!btn) return;

    const toggle = btn.dataset.toggleDone;
    if (toggle) {
      doneExpanded.set(toggle, !doneExpanded.get(toggle));
      renderBoard();
      return;
    }

    const { action, id } = btn.dataset;
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    if (action === 'edit')     return openModal(task);
    if (action === 'delete')   return deleteTask(id);
    if (action === 'complete') return updateTask(id, { status: 'done' },   'Could not complete task');
    if (action === 'reopen')   return updateTask(id, { status: 'active' }, 'Could not reopen task');
  });
}

export function teardownTasks() {
  if (channel) { sb.removeChannel(channel); channel = null; }
}
