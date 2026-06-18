const STORAGE_KEY = 'elan_tasks';
const PEOPLE = [
  { id: 'ashar', label: 'Ashar', role: 'CTO' },
  { id: 'rohit', label: 'Rohit', role: 'President' },
  { id: 'yash',  label: 'Yash',  role: 'CEO' },
];

let tasks = [];

function load() {
  try { tasks = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { tasks = []; }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function dueBadge(dueDate) {
  if (!dueDate) return '';
  const due = new Date(dueDate);
  const now = new Date();
  const diff = Math.ceil((due - now) / 86400000);
  let cls = 'task-due';
  if (diff < 0)      cls += ' task-due--overdue';
  else if (diff <= 3) cls += ' task-due--soon';
  const label = diff < 0
    ? `${Math.abs(diff)}d overdue`
    : diff === 0 ? 'Due today'
    : `Due in ${diff}d`;
  return `<span class="${cls}">${label}</span>`;
}

function renderBoard() {
  const board = document.getElementById('tasks-board');
  if (!board) return;

  board.innerHTML = PEOPLE.map(person => {
    const mine = tasks.filter(t => t.person === person.id);
    const active = mine.filter(t => t.status === 'active');
    const done   = mine.filter(t => t.status === 'done');

    const taskCard = (t) => `
      <div class="task-card ${t.status === 'done' ? 'task-card--done' : ''}" data-id="${t.id}">
        <div class="task-card-title">${t.title}</div>
        ${dueBadge(t.dueDate)}
        <div class="task-card-actions">
          ${t.status === 'active'
            ? `<button class="task-btn task-btn--done" data-action="complete" data-id="${t.id}">✓ Complete</button>`
            : `<button class="task-btn task-btn--reopen" data-action="reopen" data-id="${t.id}">↩ Reopen</button>`}
          <button class="task-btn task-btn--delete" data-action="delete" data-id="${t.id}">✕</button>
        </div>
      </div>`;

    return `
      <div class="tasks-col">
        <div class="tasks-col-header">
          <div class="tasks-col-name">${person.label}</div>
          <div class="tasks-col-role">${person.role}</div>
        </div>
        <div class="tasks-section-label">In Progress <span class="tasks-count">${active.length}</span></div>
        <div class="tasks-section tasks-section--active">
          ${active.length ? active.map(taskCard).join('') : '<div class="tasks-empty">No active tasks</div>'}
        </div>
        <div class="tasks-section-label tasks-section-label--done">Completed <span class="tasks-count">${done.length}</span></div>
        <div class="tasks-section tasks-section--done">
          ${done.length ? done.map(taskCard).join('') : '<div class="tasks-empty">Nothing yet</div>'}
        </div>
      </div>`;
  }).join('');
}

function openAddModal() {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal modal--wide">
      <div class="modal-header">
        <div class="modal-title">Add Task</div>
        <button class="modal-close" id="task-modal-close">✕</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:14px;margin-top:4px;">
        <div>
          <label class="modal-label">Assigned to</label>
          <div class="tasks-person-pick">
            ${PEOPLE.map(p => `<button class="task-person-btn" data-person="${p.id}">${p.label}</button>`).join('')}
          </div>
        </div>
        <div>
          <label class="modal-label">Task title</label>
          <input class="modal-input" id="task-title-input" type="text" placeholder="What needs to be done?" />
        </div>
        <div>
          <label class="modal-label">Due date (optional)</label>
          <input class="modal-input" id="task-due-input" type="date" />
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:4px;">
          <button class="btn" id="task-modal-cancel">Cancel</button>
          <button class="btn btn--primary" id="task-modal-save">Add Task</button>
        </div>
      </div>
    </div>`;

  document.body.appendChild(backdrop);

  let selectedPerson = null;

  backdrop.querySelectorAll('.task-person-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      backdrop.querySelectorAll('.task-person-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedPerson = btn.dataset.person;
    });
  });

  const close = () => backdrop.remove();
  backdrop.querySelector('#task-modal-close').addEventListener('click', close);
  backdrop.querySelector('#task-modal-cancel').addEventListener('click', close);
  backdrop.addEventListener('click', e => { if (e.target === backdrop) close(); });

  backdrop.querySelector('#task-modal-save').addEventListener('click', () => {
    const title = backdrop.querySelector('#task-title-input').value.trim();
    if (!title) { backdrop.querySelector('#task-title-input').focus(); return; }
    if (!selectedPerson) { backdrop.querySelector('.tasks-person-pick').style.outline = '2px solid #e9a23b'; return; }
    tasks.push({
      id: uid(),
      person: selectedPerson,
      title,
      dueDate: backdrop.querySelector('#task-due-input').value || null,
      status: 'active',
      createdAt: new Date().toISOString(),
    });
    save();
    renderBoard();
    close();
  });
}

export function initTasks() {
  load();
  renderBoard();

  document.addEventListener('click', e => {
    if (e.target.id === 'tasks-add-btn') { openAddModal(); return; }

    const action = e.target.dataset.action;
    const id = e.target.dataset.id;
    if (!action || !id) return;

    const task = tasks.find(t => t.id === id);
    if (!task) return;

    if (action === 'complete') task.status = 'done';
    if (action === 'reopen')   task.status = 'active';
    if (action === 'delete') { tasks = tasks.filter(t => t.id !== id); }

    save();
    renderBoard();
  });
}
