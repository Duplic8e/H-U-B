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

const ICON_CHEVRON = '<path d="m9 18 6-6-6-6"/>';
const ICON_CHECK = '<path d="M20 6 9 17l-5-5"/>';
const ICON_ALERT = '<path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>';

function greeting(now: Date): string {
  const h = now.getHours();
  if (h < 5) return 'Good evening';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

type Tone = 'ok' | 'pending' | 'error' | 'busy';

function statusCard(tone: Tone, title: string, detail: string): string {
  const icon = tone === 'ok' ? ICON_CHECK : tone === 'busy' ? ICON_CLOUD : ICON_ALERT;
  return `
    <a class="status-card" data-tone="${tone}" href="#settings" id="backup-status">
      <span class="status-icon">${svg(icon, 18)}</span>
      <span class="status-text">
        <span class="status-title">${esc(title)}</span>
        <span class="status-detail">${esc(detail)}</span>
      </span>
      <span class="chevron">${svg(ICON_CHEVRON, 18)}</span>
    </a>`;
}

function renderHome(): void {
  const cloud = readCloud();
  const now = new Date();
  document.title = 'Hub';
  const date = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  root.innerHTML = `
    <header class="hero">
      <div class="hero-text">
        <p class="eyebrow">${esc(date)}</p>
        <h1>${greeting(now)}</h1>
      </div>
      <a class="round-btn" href="#settings" aria-label="Settings">${svg(ICON_GEAR, 22)}</a>
    </header>
    <main class="page">
      ${
        cloud
          ? statusCard('busy', 'Checking your backups…', `${cloud.owner}/${cloud.repo}`)
          : statusCard('pending', 'Cloud backup is off', 'Your data only lives on this phone. Tap to connect.')
      }
      <h2 class="section-label">Helpers</h2>
      <ul class="apps" role="list">
        ${APPS.map(
          (app) => `
          <li>
            <a class="app-card" href="${base}${app.id}/">
              <span class="app-icon" style="background:linear-gradient(180deg, ${app.gradient[0]}, ${app.gradient[1]})">${svg(app.icon, 30)}</span>
              <span class="app-name">${esc(app.name)}</span>
              <span class="app-tagline">${esc(app.tagline)}</span>
              <span class="app-status" data-status="${app.id}" data-tone="${cloud ? 'busy' : 'pending'}">${cloud ? 'Checking…' : 'Not backed up'}</span>
            </a>
          </li>`,
        ).join('')}
      </ul>
      <p class="footnote">${
        cloud
          ? `Backed up to the private repo <strong>${esc(cloud.owner)}/${esc(cloud.repo)}</strong>. Every sync is a commit, so nothing is ever lost.`
          : 'Connect a private GitHub repo in Settings so deleting the app never deletes your data.'
      }</p>
    </main>`;
  if (cloud) void fillStatuses(cloud);
}

async function fillStatuses(cloud: CloudConfig): Promise<void> {
  const results = await Promise.all(
    APPS.map(async (app) => {
      const el = root.querySelector<HTMLElement>(`[data-status="${app.id}"]`);
      try {
        const when = await lastBackup(cloud, app.dataFile);
        if (el) {
          el.textContent = when ? `Backed up ${timeAgo(when)}` : 'Open once to back up';
          el.dataset.tone = when ? 'ok' : 'pending';
        }
        return { app, when, error: null as string | null };
      } catch (e) {
        const error = e instanceof Error ? e.message : 'Could not check backup';
        if (el) {
          el.textContent = 'Could not check';
          el.dataset.tone = 'error';
        }
        return { app, when: null, error };
      }
    }),
  );

  const card = root.querySelector('#backup-status');
  if (!card) return;
  const failed = results.find((r) => r.error);
  const missing = results.filter((r) => !r.error && !r.when).map((r) => r.app.name);
  const latest = results.map((r) => r.when).filter((d): d is Date => d !== null).sort((a, b) => b.getTime() - a.getTime())[0];
  let html: string;
  if (failed) html = statusCard('error', 'Backup needs attention', failed.error!);
  else if (missing.length) html = statusCard('pending', `Open ${missing.join(' and ')} once`, 'So it can make its first backup.');
  else html = statusCard('ok', 'Everything is backed up', latest ? `Latest backup ${timeAgo(latest)}` : '');
  card.outerHTML = html;
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
