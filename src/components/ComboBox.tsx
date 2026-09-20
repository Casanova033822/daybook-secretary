import { useEffect, useId, useRef, useState } from 'react';
import { Icon } from './Icon';
export function ComboBox({ label, value, options, onChange, numeric = false, placeholder = '', filter = false, disabled = false }: {
  label: string; value: string; options: string[]; onChange: (value: string) => void; numeric?: boolean; placeholder?: string; filter?: boolean; disabled?: boolean;
}) {
  const id = useId(), ref = useRef<HTMLDivElement>(null), input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false), [searching, setSearching] = useState(false), [highlight, setHighlight] = useState(0);
  const visible = filter && searching ? options.filter(o => o.toLowerCase().includes(value.toLowerCase())) : options;
  const expanded = open && !disabled && (!filter || !searching || visible.length > 0);
  useEffect(() => { const close = (event: PointerEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false); }; document.addEventListener('pointerdown', close); return () => document.removeEventListener('pointerdown', close); }, []);
  useEffect(() => { if (open) ref.current?.querySelector(`[data-index="${highlight}"]`)?.scrollIntoView({ block: 'nearest' }); }, [highlight, open]);
  const choose = (v: string) => { onChange(v); setOpen(false); input.current?.focus(); };
  return <div className={`combo ${disabled ? 'disabled' : ''}`} ref={ref}>
    <input ref={input} aria-label={label} role="combobox" aria-expanded={expanded} aria-controls={`${id}-options`} aria-autocomplete={filter ? 'list' : 'none'} aria-activedescendant={expanded && visible.length ? `${id}-${highlight}` : undefined}
      value={value} disabled={disabled} inputMode={numeric ? 'numeric' : 'text'} placeholder={placeholder} autoComplete="off"
      onChange={e => { onChange(e.target.value); setSearching(true); setHighlight(0); if (filter) setOpen(true); }}
      onBlur={() => { if (numeric && /^\d{1,2}$/.test(value)) onChange(value.padStart(2, '0')); }}
      onKeyDown={e => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); setSearching(false); setOpen(true); setHighlight(h => Math.max(0, Math.min(visible.length - 1, h + (e.key === 'ArrowDown' ? 1 : -1)))); }
        if (e.key === 'Escape' && open) { e.stopPropagation(); setOpen(false); }
        if (e.key === 'Enter' && open) { e.preventDefault(); if (visible[highlight]) choose(visible[highlight]); else setOpen(false); }
        if (e.key === 'Tab') setOpen(false);
      }}/>
    <button type="button" className="combo-arrow" aria-label={`展開${label}`} disabled={disabled} onClick={() => { setSearching(false); setOpen(!open); setHighlight(Math.max(0, options.indexOf(value))); input.current?.focus(); }}><Icon name="chevron" size={16}/></button>
    {expanded && <div id={`${id}-options`} className="combo-options" role="listbox" aria-label={`${label}選項`}>
      {visible.length ? visible.map((option, index) => <button type="button" key={`${option}-${index}`} id={`${id}-${index}`} data-index={index} role="option" aria-selected={option === value} className={highlight === index ? 'highlight' : ''} onMouseDown={e => e.preventDefault()} onClick={() => choose(option)}>{option}{option === value && <Icon name="check" size={15}/>}</button>) : <div className="combo-empty">沒有符合的項目，可直接使用輸入文字</div>}
    </div>}
  </div>;
}
