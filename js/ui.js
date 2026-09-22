// Small shared UI primitives.

// Every value that reaches innerHTML goes through this. The old build
// interpolated task titles and descriptions raw, so a pasted apostrophe or
// angle bracket could break the card — or worse.
export function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// Preserve author-entered line breaks after escaping.
export function escMultiline(value) {
  return esc(value).replaceAll('\n', '<br>');
}

let toastTimer = null;

export function toast(message, kind = 'info') {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    document.body.appendChild(el);
  }
  el.className = `toast toast--${kind} toast--visible`;
  el.textContent = message;

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('toast--visible'),
    kind === 'error' ? 6000 : 2600);
}

// Promise-based confirm, so destructive actions get a real dialog instead of
// firing on a stray click.
export function confirmDialog({ title, body, confirmLabel = 'Confirm', danger = false }) {
  return new Promise(resolve => {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <div class="modal-header">
          <div class="modal-title">${esc(title)}</div>
        </div>
        <p class="modal-body">${esc(body)}</p>
        <div class="modal-actions">
          <button class="btn" data-choice="cancel">Cancel</button>
          <button class="btn ${danger ? 'btn--danger' : 'btn--primary'}" data-choice="ok">${esc(confirmLabel)}</button>
        </div>
      </div>`;

    const done = value => { backdrop.remove(); document.removeEventListener('keydown', onKey); resolve(value); };
    const onKey = e => { if (e.key === 'Escape') done(false); };

    backdrop.addEventListener('click', e => {
      if (e.target === backdrop) return done(false);
      const choice = e.target.dataset.choice;
      if (choice) done(choice === 'ok');
    });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(backdrop);
    backdrop.querySelector('[data-choice="ok"]').focus();
  });
}

export function relativeDay(dateStr) {
  if (!dateStr) return null;
  const due = new Date(`${dateStr}T00:00:00`);
  const now = new Date(); now.setHours(0, 0, 0, 0);
  return Math.round((due - now) / 86_400_000);
}
