import { registerSW } from 'virtual:pwa-register';
import { APPS } from './apps';
import { DEFAULT_OWNER, DEFAULT_REPO, clearCloud, lastBackup, readCloud, saveCloud, testCloud, timeAgo, type CloudConfig } from './cloud';
import './style.css';

const root = document.getElementById('app')!;
const base = import.meta.env.BASE_URL;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const svg = (inner: string, size = 24) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

const ICON_GEAR = '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>';
const ICON_BACK = '<path d="m15 18-6-6 6-6"/>';
const ICON_CLOUD = '<path d="M17.5 19a4.5 4.5 0 1 0-1.4-8.8A6 6 0 0 0 4.5 12 3.5 3.5 0 0 0 6 19z"/>';

// ---- home ----

function renderHome(): void {
  const cloud = readCloud();
  document.title = 'Hub';
  root.innerHTML = `
    <header class="bar">
      <h1>Hub</h1>
      <a class="icon-btn" href="#settings" aria-label="Settings">${svg(ICON_GEAR)}</a>
    </header>
    <main class="page">
      ${
        cloud
          ? ''
          : `<a class="notice" href="#settings">
              ${svg(ICON_CLOUD, 20)}
              <span><strong>Cloud backup is off.</strong> Your data only lives on this device. Tap to connect your private data repo.</span>
            </a>`
      }
      <ul class="tiles" role="list">
        ${APPS.map(
          (app) => `
          <li>
            <a class="tile" href="${base}${app.id}/" style="--accent:${app.color}">
              <span class="tile-icon">${svg(app.icon, 28)}</span>
              <span class="tile-text">
                <span class="tile-name">${esc(app.name)}</span>
                <span class="tile-tagline">${esc(app.tagline)}</span>
                <span class="tile-status" data-status="${app.id}">${cloud ? 'Checking backup…' : 'Not backed up'}</span>
              </span>
            </a>
          </li>`,
        ).join('')}
      </ul>
    </main>`;
  if (cloud) void fillStatuses(cloud);
}

async function fillStatuses(cloud: CloudConfig): Promise<void> {
  await Promise.all(
    APPS.map(async (app) => {
      const el = root.querySelector<HTMLElement>(`[data-status="${app.id}"]`);
      if (!el) return;
      try {
        const when = await lastBackup(cloud, app.dataFile);
        el.textContent = when ? `Backed up ${timeAgo(when)}` : 'Open once to back up';
        el.dataset.tone = when ? 'ok' : 'pending';
      } catch (e) {
        el.textContent = e instanceof Error ? e.message : 'Could not check backup';
        el.dataset.tone = 'error';
      }
    }),
  );
}

// ---- settings ----

function renderSettings(): void {
  const cloud = readCloud();
  document.title = 'Hub settings';
  root.innerHTML = `
    <header class="bar">
      <a class="icon-btn back" href="#" aria-label="Back to Hub">${svg(ICON_BACK)}</a>
      <h1>Settings</h1>
    </header>
    <main class="page">
      <section class="card">
        <h2>Cloud backup</h2>
        <p class="muted">
          Every helper saves its data to one <strong>private</strong> GitHub repository you own, so deleting the app
          from your home screen, or losing the phone, loses nothing. Each app syncs on its own when you open it.
        </p>
        <form id="cloud-form" novalidate>
          <label>GitHub username
            <input name="owner" autocomplete="username" autocapitalize="off" spellcheck="false" required value="${esc(cloud?.owner ?? DEFAULT_OWNER)}">
          </label>
          <label>Private data repository
            <input name="repo" autocapitalize="off" spellcheck="false" required value="${esc(cloud?.repo ?? DEFAULT_REPO)}">
          </label>
          <label>Access token
            <input name="token" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" required
              placeholder="${cloud ? 'Saved. Paste a new one to replace it.' : 'github_pat_…'}">
          </label>
          <p class="status" id="cloud-status" role="status" aria-live="polite">${cloud ? `Connected to ${esc(cloud.owner)}/${esc(cloud.repo)}.` : ''}</p>
          <div class="row">
            <button class="btn primary" type="submit">${cloud ? 'Test and save' : 'Connect'}</button>
            ${cloud ? '<button class="btn danger" type="button" id="disconnect">Disconnect</button>' : ''}
          </div>
        </form>
      </section>

      <section class="card">
        <h2>Making the token</h2>
        <ol class="steps">
          <li>Open <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">GitHub → Fine-grained tokens → Generate new token</a>.</li>
          <li>Repository access: <strong>Only select repositories</strong> → your data repo.</li>
          <li>Permissions → Repository → <strong>Contents: Read and write</strong>. Nothing else.</li>
          <li>Set an expiry, generate, and keep a copy in your password manager. You need it again after reinstalling.</li>
        </ol>
        <p class="muted">The token is stored only on this device. It is never written to any repository and never sent anywhere but GitHub.</p>
      </section>

      <section class="card">
        <h2>After reinstalling</h2>
        <p class="muted">Add the Hub to your home screen again, connect here with the same token, then open each app once. Each one restores its own data from the cloud.</p>
      </section>
    </main>`;

  const form = root.querySelector<HTMLFormElement>('#cloud-form')!;
  const status = root.querySelector<HTMLElement>('#cloud-status')!;
  const say = (text: string, tone: 'ok' | 'error' | 'busy') => {
    status.textContent = text;
    status.dataset.tone = tone;
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const next: CloudConfig = {
      owner: String(data.get('owner') ?? '').trim(),
      repo: String(data.get('repo') ?? '').trim(),
      // An empty token field keeps the saved token.
      token: String(data.get('token') ?? '').trim() || cloud?.token || '',
    };
    const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    button.disabled = true;
    say('Checking with GitHub…', 'busy');
    try {
      await testCloud(next);
      saveCloud(next);
      renderSettings(); // shows the saved state: Test and save, Disconnect
      const fresh = root.querySelector<HTMLElement>('#cloud-status')!;
      fresh.textContent = `Connected to ${next.owner}/${next.repo}. Open each app once to back it up.`;
      fresh.dataset.tone = 'ok';
      return;
    } catch (err) {
      say(err instanceof Error ? err.message : 'Something went wrong.', 'error');
    } finally {
      button.disabled = false;
    }
  });

  root.querySelector('#disconnect')?.addEventListener('click', () => {
    if (!window.confirm('Disconnect cloud backup on this device? Your data stays in the apps and in the repository.')) return;
    clearCloud();
    renderSettings();
  });
}

// ---- routing ----

function route(): void {
  if (location.hash === '#settings') renderSettings();
  else renderHome();
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', route);
// Coming back from an app: refresh the "backed up" times.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && location.hash !== '#settings') route();
});
route();

registerSW({ immediate: true });
