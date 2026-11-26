import { render } from 'preact';
import { registerSW } from 'virtual:pwa-register';
import './ui/styles.css';
import { App } from './app';

import { isHubSyncRun, runForHub } from './hubSyncRun';

if (isHubSyncRun()) {
  void runForHub();
} else {
  const root = document.getElementById('app');
  if (root) render(<App />, root);
  registerSW({ immediate: true });
}
