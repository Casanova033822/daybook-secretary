import { useEffect, useId, useRef, useState } from 'react';
import { useAppearance } from '../AppearanceProvider';
import { languages, type Locale } from '../shared/appearance';
import { t, translateError } from '../shared/i18n';
import { Icon } from './Icon';

const assets = import.meta.glob('../../assets/flags/*.svg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
function Flag({ flag }: { flag: string }) { return <img className="language-flag" src={assets[`../../assets/flags/${flag}.svg`]} alt="" aria-hidden="true"/>; }
export function LanguagePicker() {
  const { locale } = useAppearance();
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [index, setIndex] = useState(languages.findIndex(l => l.locale === locale));
  const ref = useRef<HTMLDivElement>(null), button = useRef<HTMLButtonElement>(null), id = useId();
  const selected = languages.find(l => l.locale === locale)!;
  useEffect(() => {
    const outside = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, []);
  useEffect(() => { if (open) ref.current?.querySelector(`[data-language-index="${index}"]`)?.scrollIntoView({ block: 'nearest' }); }, [open, index]);
  const choose = async (next: Locale) => {
    setOpen(false); setBusy(true); setError(''); button.current?.focus();
    try { await window.daybook!.saveAppearance({ locale: next }); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); requestAnimationFrame(() => button.current?.focus()); }
  };
  return <div className="language-setting"><div className="setting-row"><span><strong id={`${id}-label`}>{t('顯示語言')}</strong><small>{t('立即套用，自動儲存。')}</small></span>
    <div className="language-picker" ref={ref} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false); }}>
      <button ref={button} type="button" role="combobox" aria-labelledby={`${id}-label`} aria-expanded={open} aria-controls={`${id}-options`} aria-activedescendant={open ? `${id}-${index}` : undefined} disabled={busy}
        onClick={() => { setIndex(languages.findIndex(l => l.locale === locale)); setOpen(!open); }}
        onKeyDown={e => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); setOpen(true); setIndex(i => Math.max(0, Math.min(languages.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))); }
          if (e.key === 'Home' && open) { e.preventDefault(); setIndex(0); }
          if (e.key === 'End' && open) { e.preventDefault(); setIndex(languages.length - 1); }
          if (e.key === 'Escape' && open) { e.preventDefault(); e.stopPropagation(); setOpen(false); }
          if ((e.key === 'Enter' || e.key === ' ') && open) { e.preventDefault(); void choose(languages[index].locale); }
          if (e.key === 'Tab') setOpen(false);
        }}><Flag flag={selected.flag}/><span lang={selected.locale} dir="auto">{selected.name}</span><Icon name="chevron" size={16}/></button>
      {open && <div className="language-options" id={`${id}-options`} role="listbox" aria-labelledby={`${id}-label`}>{languages.map((language, i) =>
        <button key={language.locale} id={`${id}-${i}`} data-language-index={i} data-locale={language.locale} type="button" role="option" tabIndex={-1} aria-selected={locale === language.locale} className={index === i ? 'highlight' : ''}
          onMouseDown={e => e.preventDefault()} onClick={() => void choose(language.locale)}><Flag flag={language.flag}/><span lang={language.locale} dir="auto">{language.name}</span>{locale === language.locale && <Icon name="check" size={15}/>}</button>,
      )}</div>}
    </div></div>{error && <div role="alert" className="notice error">{translateError(error)}</div>}</div>;
}
