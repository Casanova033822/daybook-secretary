import { useState } from 'react';
import type { Reminder } from '../shared/types';
import { Icon } from './Icon';
export function Reminders({ value, onChange }: { value: Reminder[]; onChange: (value: Reminder[]) => void }) {
  const [customRows, setCustomRows] = useState<Set<number>>(new Set());
  const custom = (i: number, enabled: boolean) => setCustomRows(rows => { const next = new Set(rows); if (enabled) next.add(i); else next.delete(i); return next; });
  const isCustom = (i: number) => customRows.has(i) || ![0, 5, 10].includes(value[i].minutes);
  const change = (i: number, patch: Partial<Reminder>) => onChange(value.map((r, index) => index === i ? { ...r, ...patch } : r));
  const remove = (i: number) => {
    setCustomRows(rows => new Set([...rows].filter(index => index !== i).map(index => index > i ? index - 1 : index)));
    onChange(value.filter((_, index) => index !== i));
  };
  return <div className="reminder-editor">
    {value.length === 0 && <p className="field-hint">不發送提醒。可以依需要加入開始或結束提醒。</p>}
    {value.map((r, i) => <div className="reminder-line" key={i}>
      <Icon name="bell" size={17}/><select aria-label={`提醒 ${i + 1} 基準`} value={r.anchor} onChange={e => change(i, { anchor: e.target.value as 'start' | 'end' })}><option value="start">開始</option><option value="end">結束</option></select>
      <select aria-label={`提醒 ${i + 1} 時機`} value={isCustom(i) ? 'custom' : String(r.minutes)} onChange={e => { custom(i, e.target.value === 'custom'); change(i, { minutes: e.target.value === 'custom' ? 15 : Number(e.target.value) }); }}><option value="0">當下</option><option value="5">前 5 分鐘</option><option value="10">前 10 分鐘</option><option value="custom">自訂分鐘</option></select>
      {isCustom(i) && <label className="custom-offset"><input aria-label={`提醒 ${i + 1} 提前分鐘`} type="number" min="0" max="525600" value={Number.isNaN(r.minutes) ? '' : r.minutes} onChange={e => { custom(i, true); change(i, { minutes: e.target.value === '' ? NaN : Number(e.target.value) }); }}/><span>分鐘前</span></label>}
      <button type="button" className="icon-button" aria-label={`移除提醒 ${i + 1}`} onClick={() => remove(i)}><Icon name="close" size={16}/></button>
    </div>)}
    <button type="button" className="text-button" onClick={() => { const exists = (a: string, m: number) => value.some(r => r.anchor === a && r.minutes === m); let rule: Reminder = { anchor: 'start', minutes: 10 }; if (exists('start', 10)) rule = { anchor: 'start', minutes: 0 }; if (exists(rule.anchor, rule.minutes)) rule = { anchor: 'end', minutes: 0 }; if (exists(rule.anchor, rule.minutes)) rule = { anchor: 'start', minutes: Math.max(15, ...value.map(r => r.minutes + 5)) }; onChange([...value, rule]); }} disabled={value.length >= 20}><Icon name="plus" size={15}/>加入提醒</button>
  </div>;
}
