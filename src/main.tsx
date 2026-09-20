import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ReminderCard } from './ReminderCard';
import './styles.css';
import './refinements.css';
import './appearance.css';
import './readability.css';
import { AppearanceProvider, applyAppearance } from './AppearanceProvider';
import { systemLocale, type Appearance } from './shared/appearance';

async function start() {
  const bridge = window.daybook ?? window.reminderCard;
  const initial: Appearance = bridge ? await bridge.appearance() : {
    locale: systemLocale(navigator.languages), theme: matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  };
  applyAppearance(initial);
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode><AppearanceProvider initial={initial}>{window.location.hash === '#reminder' ? <ReminderCard/> : <App/>}</AppearanceProvider></React.StrictMode>,
  );
}
void start().catch(error => { document.getElementById('root')!.textContent = String(error); void window.daybook?.rendererReady(); });
