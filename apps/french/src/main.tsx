import { render } from 'preact';
import { registerSW } from 'virtual:pwa-register';
import './ui/styles.css';
import { App } from './app';

const root = document.getElementById('app');
if (root) render(<App />, root);
registerSW({ immediate: true });
