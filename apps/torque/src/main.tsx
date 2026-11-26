import { render } from 'preact';
import './core/styles/fonts.css';
import './core/styles/tokens.css';
import './core/styles/base.css';
import './core/styles/components.css';
import { App } from './app';
import { UpdateToast } from './core/components/UpdateToast';

import { isHubSyncRun, runForHub } from './hubSyncRun';

const hubSync = isHubSyncRun();
if (hubSync) void runForHub();
const root = hubSync ? null : document.getElementById('app');
// UpdateToast registers the service worker, so it must render on every screen (including first-run
// onboarding), not only inside the main app shell.
if (root) {
  render(
    <>
      <App />
      <UpdateToast />
    </>,
    root,
  );
}
