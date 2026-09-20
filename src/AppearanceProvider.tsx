import { createContext, useContext, useEffect, useState } from 'react';
import type { Appearance } from './shared/appearance';
import { appTitle, setLocale } from './shared/i18n';

const Context = createContext<Appearance>({ theme: 'light', locale: 'zh-TW' });
export const useAppearance = () => useContext(Context);
export function applyAppearance(value: Appearance) {
  setLocale(value.locale);
  const root = document.documentElement;
  root.dataset.theme = value.theme;
  root.lang = value.locale;
  root.dir = value.locale === 'ar' ? 'rtl' : 'ltr';
  document.title = appTitle(value.locale);
}
export function AppearanceProvider({ initial, children }: { initial: Appearance; children: React.ReactNode }) {
  const [value, setValue] = useState(initial);
  applyAppearance(value);
  useEffect(() => {
    let disposed = false, generation = 0;
    const update = (next: Appearance) => { if (!disposed) setValue(old => old.locale === next.locale && old.theme === next.theme ? old : next); };
    const refresh = async () => {
      const current = ++generation;
      try { const next = await window.daybook!.appearance(); if (current === generation) update(next); } catch { /* keep the last committed appearance */ }
    };
    const unsubscribe = window.daybook
      ? window.daybook.subscribe(event => { if (event.type === 'changed') void refresh(); })
      : window.reminderCard?.subscribeAppearance(update);
    // Read after subscribing to close the bootstrap/read-to-subscription race.
    if (window.daybook) void refresh();
    else void window.reminderCard?.appearance().then(update);
    return () => { disposed = true; unsubscribe?.(); };
  }, []);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
