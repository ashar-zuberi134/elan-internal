const SUPABASE_URL = 'https://sofzlqjszuskvwlkxvhr.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvZnpscWpzenVza3Z3bGt4dmhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4OTcyMjYsImV4cCI6MjA5NjQ3MzIyNn0.SGkwZg1k89w5qxixLqfckCuVoPY5UPX4Af7QIc8bVFQ';
const TASKS_TABLE  = 'tasks';
const TASKS_ROW_ID = 1;

const SB_HEADERS = {
  apikey:         SUPABASE_KEY,
  Authorization:  `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  Prefer:         'resolution=merge-duplicates',
};

const DONE_SHOW_LIMIT = 3;
const PEOPLE = [
  { id: 'ashar', label: 'Ashar', role: 'CTO' },
  { id: 'rohit', label: 'Rohit', role: 'President' },
  { id: 'yash',  label: 'Yash',  role: 'CEO' },
];

let tasks = [];
const doneExpanded = { ashar: false, rohit: false, yash: false };

// ── Supabase persistence ──────────────────────────────────────────────────────

async function loadFromSupabase() {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${TASKS_TABLE}?id=eq.${TASKS_ROW_ID}&select=data`,
      { headers: SB_HEADERS }
    );
    const rows = await res.json();
    tasks = rows[0]?.data?.tasks ?? [];
  } catch {
    tasks = [];
  }
}

async function saveToSupabase() {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/${TASKS_TABLE}`, {
      method: 'POST',
      headers: SB_HEADERS,
      body: JSON.stringify({ id: TASKS_ROW_ID, data: { tasks } }),
    });
  } catch (err) {
    console.error('Tasks save failed:', err);
  }
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ── Rendering ─────────────────────────────────────────────────────────────────

function dueBadge(dueDate) {
  if (!dueDate) return '';
  const due  = new Date(dueDate + 'T00:00:00');
  const now  = new Date(); now.setHours(0,0,0,0);
  const diff = Math.round((due - now) / 86400000);
  let cls = 'task-due';
  if (diff < 0)       cls += ' task-due--overdue';
  else if (diff <= 3) cls += ' task-due--soon';
  const label = diff < 0  ? `${Math.abs(diff)}d overdue`
              : diff === 0 ? 'Due today'
              : `Due ${due.toLocaleDateString('en-GB', { day:'numeric', month:'short' })}`;
  return `<span class="${cls}">${label}</span>`;
}

function taskCard(t) {
  const isDone = t.status === 'done';
  return `
    <div class="task-card ${isDone ? 'task-card--done' : ''}" data-id="${t.id}">
      <div class="task-card-title">${t.title}</div>
      ${t.description ? `<div class="task-card-desc">${t.description}</div>` : ''}
      ${dueBadge(t.dueDate)}
      <div class="task-card-actions">
        ${isDone
          ? `<button class="task-btn task-btn--reopen" data-action="reopen" data-id="${t.id}">↩ Reopen</button>`
          : `<button class="task-btn task-btn--done" data-action="complete" data-id="${t.id}">✓ Complete</button>`}
        <button class="task-btn task-btn--edit" data-action="edit" data-id="${t.id}">✎ Edit</button>
        <button class="task-btn task-btn--delete" data-action="delete" data-id="${t.id}">✕</button>
      </div>
    </div>`;
}

function renderBoard() {
  const board = document.getElementById('tasks-board');
  if (!board) return;

  board.innerHTML = PEOPLE.map(person => {
    const mine    = tasks.filter(t => t.person === person.id);
    const active  = mine.filter(t => t.status === 'active');
    const done    = mine.filter(t => t.status === 'done');
    const expanded = doneExpanded[person.id];
    const visible  = expanded ? done : done.slice(0, DONE_SHOW_LIMIT);
    const hidden   = done.length - DONE_SHOW_LIMIT;

    const doneFooter = done.length > DONE_SHOW_LIMIT
      ? `<button class="tasks-show-more" data-toggle-done="${person.id}">
           ${expanded ? '▲ Show less' : `▼ Show ${hidden} more`}
         </button>`
      : '';

    return `
      <div class="tasks-col">
        <div class="tasks-col-header">
          <div class="tasks-col-name">${person.label}</div>
          <div class="tasks-col-role">${person.role}</div>
        </div>

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
      </div>`;
  }).join('');
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function openModal(existing = null) {
  const isEdit = !!existing;
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal modal--wide">
      <div class="modal-header">
        <div class="modal-title">${isEdit ? 'Edit Task' : 'Add Task'}</div>
        <button class="modal-close" id="task-modal-close">✕</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:14px;margin-top:4px;">
        ${!isEdit ? `
        <div>
          <label class="modal-label">Assigned to</label>
          <div class="tasks-person-pick" id="task-person-pick">
            ${PEOPLE.map(p => `<button class="task-person-btn" data-person="${p.id}">${p.label}</button>`).join('')}
          </div>
        </div>` : ''}
        <div>
          <label class="modal-label">Title</label>
          <input class="modal-input" id="task-title-input" type="text" placeholder="What needs to be done?" value="${existing?.title ?? ''}" />
        </div>
        <div>
          <label class="modal-label">Description <span style="font-weight:400;color:#9bbfba;">(optional)</span></label>
          <textarea class="modal-input" id="task-desc-input" rows="3" placeholder="Any extra context or notes…">${existing?.description ?? ''}</textarea>
        </div>
        <div>
          <label class="modal-label">Due date <span style="font-weight:400;color:#9bbfba;">(optional)</span></label>
          <input class="modal-input" id="task-due-input" type="date" value="${existing?.dueDate ?? ''}" />
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:4px;">
          <button class="btn" id="task-modal-cancel">Cancel</button>
          <button class="btn btn--primary" id="task-modal-save">${isEdit ? 'Save Changes' : 'Add Task'}</button>
        </div>
      </div>
    </div>`;

  document.body.appendChild(backdrop);

  let selectedPerson = existing?.person ?? null;

  if (!isEdit) {
    backdrop.querySelectorAll('.task-person-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        backdrop.querySelectorAll('.task-person-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedPerson = btn.dataset.person;
      });
    });
  }

  const close = () => backdrop.remove();
  backdrop.querySelector('#task-modal-close').addEventListener('click', close);
  backdrop.querySelector('#task-modal-cancel').addEventListener('click', close);
  backdrop.addEventListener('click', e => { if (e.target === backdrop) close(); });

  backdrop.querySelector('#task-modal-save').addEventListener('click', async () => {
    const title = backdrop.querySelector('#task-title-input').value.trim();
    if (!title) { backdrop.querySelector('#task-title-input').focus(); return; }
    if (!isEdit && !selectedPerson) {
      backdrop.querySelector('#task-person-pick').style.outline = '2px solid #e9a23b';
      return;
    }

    const description = backdrop.querySelector('#task-desc-input').value.trim();
    const dueDate     = backdrop.querySelector('#task-due-input').value || null;

    if (isEdit) {
      const t = tasks.find(t => t.id === existing.id);
      if (t) { t.title = title; t.description = description; t.dueDate = dueDate; }
    } else {
      tasks.push({ id: uid(), person: selectedPerson, title, description, dueDate, status: 'active', createdAt: new Date().toISOString() });
    }

    await saveToSupabase();
    renderBoard();
    close();
  });
}

// ── Init ──────────────────────────────────────────────────────────────────────

export async function initTasks() {
  const board = document.getElementById('tasks-board');
  if (board) board.innerHTML = '<div class="tasks-empty" style="padding:32px;text-align:center;">Loading…</div>';

  await loadFromSupabase();

  // One-time migration: if Supabase is empty but localStorage has tasks, push them up
  if (tasks.length === 0) {
    try {
      const local = JSON.parse(localStorage.getItem('elan_tasks') || '[]');
      if (local.length > 0) {
        tasks = local;
        await saveToSupabase();
        localStorage.removeItem('elan_tasks');
        console.log(`Migrated ${local.length} tasks from localStorage to Supabase.`);
      }
    } catch {}
  } else {
    // Supabase already has data — clear any stale local copy
    localStorage.removeItem('elan_tasks');
  }

  renderBoard();

  document.addEventListener('click', async e => {
    if (e.target.id === 'tasks-add-btn') { openModal(); return; }

    const action = e.target.dataset.action;
    const id     = e.target.dataset.id;
    const toggle = e.target.dataset.toggleDone;

    if (toggle) {
      doneExpanded[toggle] = !doneExpanded[toggle];
      renderBoard();
      return;
    }

    if (!action || !id) return;
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    if (action === 'edit')     { openModal(task); return; }
    if (action === 'complete') { task.status = 'done'; task.completedAt = new Date().toISOString(); }
    if (action === 'reopen')   { task.status = 'active'; delete task.completedAt; }
    if (action === 'delete')   { tasks = tasks.filter(t => t.id !== id); }

    await saveToSupabase();
    renderBoard();
  });
}
