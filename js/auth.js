import { sb } from './supabase.js';
import { esc, toast } from './ui.js';

let currentUser = null;

export const user   = () => currentUser;
export const userId = () => currentUser?.id ?? null;

function displayName(u) {
  return u?.user_metadata?.name || u?.email?.split('@')[0] || 'Signed in';
}

function renderGate() {
  const gate = document.getElementById('auth-gate');
  gate.innerHTML = `
    <form class="auth-card" id="auth-form" autocomplete="on">
      <div class="elan-logo elan-logo--auth">
        <div class="elan-e"><span></span><span></span><span></span></div>
        <div class="elan-wordmark">ELAN</div>
      </div>
      <div class="auth-title">Internal</div>
      <p class="auth-sub">Sign in to continue.</p>

      <label class="auth-label" for="auth-email">Email</label>
      <input class="auth-input" id="auth-email" type="email" name="email"
             autocomplete="username" required />

      <label class="auth-label" for="auth-password">Password</label>
      <input class="auth-input" id="auth-password" type="password" name="password"
             autocomplete="current-password" required />

      <button class="btn btn--primary auth-submit" type="submit" id="auth-submit">Sign in</button>
      <div class="auth-error" id="auth-error" role="alert"></div>
    </form>`;

  const form   = document.getElementById('auth-form');
  const errEl  = document.getElementById('auth-error');
  const submit = document.getElementById('auth-submit');

  form.addEventListener('submit', async e => {
    e.preventDefault();
    errEl.textContent = '';
    submit.disabled = true;
    submit.textContent = 'Signing in…';

    const { error } = await sb.auth.signInWithPassword({
      email:    document.getElementById('auth-email').value.trim(),
      password: document.getElementById('auth-password').value,
    });

    if (error) {
      // Don't leak whether the address exists.
      errEl.textContent = error.message === 'Invalid login credentials'
        ? 'That email and password combination was not recognised.'
        : error.message;
      submit.disabled = false;
      submit.textContent = 'Sign in';
    }
    // On success the onAuthStateChange handler in app.js takes over.
  });

  document.getElementById('auth-email').focus();
}

export function showGate() {
  document.body.classList.add('is-signed-out');
  document.getElementById('auth-gate').hidden = false;
  renderGate();
}

export function hideGate() {
  document.body.classList.remove('is-signed-out');
  const gate = document.getElementById('auth-gate');
  gate.hidden = true;
  gate.innerHTML = '';
}

export function renderUserChip(u) {
  currentUser = u;
  const chip = document.getElementById('user-chip');
  if (!chip) return;
  chip.innerHTML = `
    <span class="user-chip-name">${esc(displayName(u))}</span>
    <button class="user-chip-signout" id="signout-btn" title="Sign out">Sign out</button>`;
  document.getElementById('signout-btn').addEventListener('click', async () => {
    const { error } = await sb.auth.signOut();
    if (error) toast(`Sign out failed — ${error.message}`, 'error');
  });
}

export function setCurrentUser(u) {
  currentUser = u;
}
