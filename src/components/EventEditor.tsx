import { t, translateError, weekdayNames } from '../shared/i18n';
import { useMemo, useState } from 'react';
import type { ItemInput, Occurrence, SaveRequest, Scope, Snapshot } from '../shared/types';
import { expand, validateInput } from '../shared/domain';
import { addDays, clock, dateKey, localStamp, pad, parseClock } from '../shared/time';
import { ComboBox } from './ComboBox';
import { Icon } from './Icon';
import { Modal } from './Modal';
import { Reminders } from './Reminders';

const hours = Array.from({ length: 25 }, (_, i) => pad(i));
const minutes = Array.from({ length: 12 }, (_, i) => pad(i * 5));
type ClockFields = { date: string; hour: string; minute: string };
function fields(stamp: string): ClockFields { return { date: stamp.slice(0, 10), hour: stamp.slice(11, 13), minute: stamp.slice(14, 16) }; }
function stamp(value: ClockFields): string { return parseClock(value.date, value.hour, value.minute); }
function initialStart(date: string): string {
  if (date !== dateKey()) return `${date}T09:00`;
  const now = new Date(); now.setSeconds(0, 0); now.setMinutes(Math.ceil(now.getMinutes() / 5) * 5); return localStamp(now);
}
function TimeFields({ label, value, onChange }: { label: string; value: ClockFields; onChange: (patch: Partial<ClockFields>) => void }) {
  return <div className="time-field-group"><label className="field-label">{label}</label><div className="time-input-row">
    <input className="date-input" aria-label={t('{label}日期', { label })} type="date" min="1900-01-01" max="9998-12-31" value={value.date} onChange={e => onChange({ date: e.target.value })}/>
    <ComboBox label={t('{label}小時', { label })} value={value.hour} options={hours} numeric onChange={hour => onChange({ hour, ...(Number(hour) === 24 ? { minute: '00' } : {}) })}/><span className="time-colon">:</span>
    <ComboBox label={t('{label}分鐘', { label })} value={value.minute} options={Number(value.hour) === 24 ? ['00'] : minutes} numeric onChange={minute => onChange({ minute })}/>
  </div>{Number(value.hour) === 24 && <p className="field-hint accent">{t("24:00 代表隔天 00:00，分鐘僅接受 00。")}</p>}</div>;
}
export function EventEditor({ occurrence, selectedDate, snapshot, onSave, onDelete, onClose }: {
  occurrence?: Occurrence; selectedDate: string; snapshot: Snapshot;
  onSave: (request: SaveRequest) => Promise<void>; onDelete: () => Promise<void>; onClose: () => void;
}) {
  const startInitial = occurrence?.startAt ?? initialStart(occurrence?.date ?? selectedDate);
  const endInitial = occurrence?.endAt ?? localStamp(new Date(+new Date(startInitial) + 3600000));
  const [title, setTitle] = useState(occurrence?.title ?? ''), [notes, setNotes] = useState(occurrence?.notes ?? '');
  const [timed, setTimed] = useState(!occurrence || !!occurrence.startAt);
  const [taskDate, setTaskDate] = useState(occurrence?.date ?? selectedDate);
  const [start, setStart] = useState(fields(startInitial)), [end, setEnd] = useState(fields(endInitial));
  const [duration, setDuration] = useState(String((+new Date(endInitial) - +new Date(startInitial)) / 60000));
  const [repeat, setRepeat] = useState(occurrence?.repeat ?? { kind: 'none' as const, weekdays: [new Date(`${selectedDate}T12:00`).getDay()], until: null });
  const [reminders, setReminders] = useState(occurrence?.reminders ?? snapshot.settings.defaultReminders.map(r => ({ ...r })));
  const [scope, setScope] = useState<Scope>('single');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const changeStart = (patch: Partial<ClockFields>) => {
    const next = { ...start, ...patch }; setStart(next);
    try { setDuration(String((+new Date(stamp(end)) - +new Date(stamp(next))) / 60000)); } catch { /* preserve draft */ }
  };
  const changeEnd = (patch: Partial<ClockFields>) => {
    const next = { ...end, ...patch }; setEnd(next);
    try { setDuration(String((+new Date(stamp(next)) - +new Date(stamp(start))) / 60000)); } catch { /* preserve draft */ }
  };
  const changeDuration = (text: string) => {
    setDuration(text);
    try { if (/^\d+$/.test(text) && Number(text) > 0) setEnd(fields(localStamp(new Date(+new Date(stamp(start)) + Number(text) * 60000)))); } catch { /* preserve draft */ }
  };
  const input = (): ItemInput => {
    const startAt = timed ? stamp(start) : null, endAt = timed ? stamp(end) : null;
    if (timed && (!/^\d+$/.test(duration) || Number(duration) <= 0)) throw new Error('持續時間須為大於 0 的整數分鐘。');
    return validateInput({ title, notes, date: startAt?.slice(0, 10) ?? taskDate, startAt, endAt,
      repeat: occurrence?.recurring && scope === 'single' ? { kind: 'none', weekdays: [], until: null } : repeat, reminders: timed ? reminders : [] });
  };
  const conflicts = useMemo(() => {
    if (!timed) return [];
    try {
      const a = stamp(start), b = stamp(end);
      return expand(snapshot, a.slice(0, 10), addDays(b.slice(0, 10), 1)).filter(o => o.key !== occurrence?.key && !o.completedAt && o.startAt && o.endAt && a < o.endAt && o.startAt < b);
    } catch { return []; }
  }, [snapshot, start, end, timed, occurrence]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError('');
    try { const value = input(); setBusy(true); await onSave({ value, target: occurrence ? { itemId: occurrence.itemId, occurrenceDate: occurrence.occurrenceDate, scope } : undefined }); onClose(); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const remove = async () => { setBusy(true); try { await onDelete(); onClose(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } };
  return <Modal title={occurrence ? t("編輯事項") : t("為今天留一段時間")} subtitle={occurrence ? t("按照自己的步調，調整這件事。") : t("排好一件事，讓心裡多一點空間。")} onClose={onClose}>
    <form onSubmit={submit} className="event-form"><div className="modal-body">
      {occurrence?.recurring && <div className="scope-box"><Icon name="repeat" size={18}/><span>{t("修改範圍")}</span><select aria-label={t("修改範圍")} value={scope} onChange={e => setScope(e.target.value as Scope)}><option value="single">{t("僅本次")}</option><option value="future">{t("本次及未來")}</option></select></div>}
      <div className="form-field"><label className="field-label">{t("要做什麼事情？")}</label><ComboBox label={t("事項名稱")} value={title} options={snapshot.presets.map(p => p.title)} onChange={setTitle} filter placeholder={t("輸入事項，或從常用事項選擇")}/></div>
      <div className="segmented form-segment"><button type="button" className={timed ? 'selected' : ''} onClick={() => setTimed(true)}><Icon name="clock" size={16}/>{t("安排時段")}</button><button type="button" className={!timed ? 'selected' : ''} onClick={() => { setTaskDate(start.date); setTimed(false); }}><Icon name="list" size={16}/>{t("先記成待辦")}</button></div>
      {timed ? <div className="time-section"><TimeFields label={t("開始")} value={start} onChange={changeStart}/><TimeFields label={t("結束")} value={end} onChange={changeEnd}/><div className="duration-row"><Icon name="clock" size={16}/><span>{t("持續")}</span><ComboBox label={t("持續分鐘")} value={duration} options={['5', '10', '15', '30', '45', '60', '90', '120']} onChange={changeDuration} numeric/><span>{t("分鐘")}</span></div></div>
        : <div className="form-field"><label className="field-label" htmlFor="task-date">{t("待辦日期")}</label><input id="task-date" type="date" min="1900-01-01" max="9998-12-31" value={taskDate} onChange={e => setTaskDate(e.target.value)}/><p className="field-hint">{t("先記下來，之後再安排時間。未排時段的待辦不會提醒。")}</p></div>}
      {conflicts.length > 0 && <div className="notice warning"><Icon name="calendar" size={17}/><span>{t('與「{titles}」時段重疊，仍可儲存。', { titles: conflicts.map(o => o.title).join(' / ') })}</span></div>}
      {(!occurrence?.recurring || scope === 'future') && <div className="repeat-section"><div className="field-heading"><label className="field-label" htmlFor="repeat-kind">{t("重複")}</label><select id="repeat-kind" value={repeat.kind} onChange={e => setRepeat({ ...repeat, kind: e.target.value as typeof repeat.kind })}><option value="none">{t("不重複")}</option><option value="daily">{t("每天")}</option><option value="weekly">{t("每週／指定星期")}</option></select></div>
        {repeat.kind === 'weekly' && <div className="weekday-picker">{weekdayNames('narrow').map((day, i) => <button type="button" key={i} aria-label={weekdayNames('long')[i]} aria-pressed={repeat.weekdays.includes(i)} className={repeat.weekdays.includes(i) ? 'selected' : ''} onClick={() => setRepeat({ ...repeat, weekdays: repeat.weekdays.includes(i) ? repeat.weekdays.filter(d => d !== i) : [...repeat.weekdays, i] })}>{day}</button>)}</div>}
        {repeat.kind !== 'none' && <div className="until-row"><label htmlFor="until-date">{t("截止日期")}<span className="muted">{t("（選填）")}</span></label><input id="until-date" type="date" value={repeat.until ?? ''} onChange={e => setRepeat({ ...repeat, until: e.target.value || null })}/>{repeat.until && <button type="button" className="text-button" onClick={() => setRepeat({ ...repeat, until: null })}>{t("清除")}</button>}</div>}
      </div>}
      {timed && <section className="form-field"><div className="field-heading"><span className="field-label">{t("提醒設定")}</span><span className="field-hint">{t("日序小卡＋提示音")}</span></div><Reminders value={reminders} onChange={setReminders}/></section>}
      <div className="form-field"><label className="field-label" htmlFor="notes">{t("備註")}<span className="muted">{t("（選填）")}</span></label><textarea id="notes" rows={2} placeholder={t("有什麼想提醒自己的？")} value={notes} onChange={e => setNotes(e.target.value)}/></div>
      {error && <div className="notice error" role="alert">{translateError(error)}</div>}
    </div><footer className="modal-footer">{occurrence && <button type="button" className="icon-button danger" title={t("刪除本次事項")} aria-label={t("刪除事項")} onClick={remove} disabled={busy}><Icon name="trash"/></button>}<span className="footer-spacer"/><button type="button" className="button secondary" onClick={onClose} disabled={busy}>{t("取消")}</button><button type="submit" className="button primary" disabled={busy}>{busy ? t("儲存中…") : occurrence ? t("儲存變更") : t("新增事項")}</button></footer></form>
  </Modal>;
}
