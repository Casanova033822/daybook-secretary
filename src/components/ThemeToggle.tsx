import { useState } from 'react';
import { useAppearance } from '../AppearanceProvider';
import type { Appearance } from '../shared/appearance';
import { t, translateError } from '../shared/i18n';
import { Icon } from './Icon';

export function ThemeToggle() {
  const { theme } = useAppearance();
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const save = async (next: Appearance['theme']) => {
    if (busy || next === theme) return;
    setBusy(true); setError('');
    try { await window.daybook!.saveAppearance({ theme: next }); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  return <div className="theme-control">
    <button className="theme-toggle" data-testid="theme-toggle" data-theme={theme}
      role="switch" aria-checked={theme === 'dark'} aria-label={t('深色模式')} disabled={busy}
      title={t(theme === 'light' ? '切換為深色模式' : '切換為淺色模式')}
      onClick={() => void save(theme === 'light' ? 'dark' : 'light')}
      onKeyDown={event => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault(); void save(event.key === 'ArrowLeft' ? 'light' : 'dark');
        }
      }}>
      <span className="theme-toggle-thumb" aria-hidden="true"/>
      <span className="theme-option" data-active={theme === 'light'} aria-hidden="true"><Icon name="sun" size={18}/>{t('淺色')}</span>
      <span className="theme-option" data-active={theme === 'dark'} aria-hidden="true"><Icon name="moon" size={18}/>{t('深色')}</span>
    </button>
    {error && <div className="appearance-error notice error" role="alert"><span>{translateError(error)}</span><button aria-label={t('關閉錯誤訊息')} onClick={() => setError('')}><Icon name="close" size={16}/></button></div>}
  </div>;
}
