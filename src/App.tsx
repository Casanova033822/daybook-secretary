import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import zhTwLocale from '@fullcalendar/core/locales/zh-tw';
import type { AppEvent, Occurrence, Snapshot, WindowMode } from './shared/types';
import { conflictingKeys, expand, isActive } from './shared/domain';
import { addDays, clock, dateKey } from './shared/time';
import { BrandMark, Icon } from './components/Icon';
import { EventEditor } from './components/EventEditor';
import { SettingsModal } from './components/SettingsModal';

const formatDate = (date: string, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('zh-TW', options).format(new Date(`${date}T12:00`));
function MiniCalendar({ selected, onSelect, snapshot }: { selected: string; onSelect: (date: string) => void; snapshot: Snapshot }) {
  const [month, setMonth] = useState(selected.slice(0, 7));
  useEffect(() => setMonth(selected.slice(0, 7)), [selected]);
  const first = `${month}-01`, start = addDays(first, -new Date(`${first}T12:00`).getDay());
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const scheduled = new Set(expand(snapshot, start, addDays(start, 42)).map(o => o.date));
  const move = (n: number) => { const date = new Date(`${first}T12:00`); date.setMonth(date.getMonth() + n); setMonth(dateKey(date).slice(0, 7)); };
  return <div className="mini-calendar"><div className="mini-calendar-title"><strong>{formatDate(first, { year: 'numeric', month: 'long' })}</strong><div><button className="icon-button" aria-label="小月曆上個月" onClick={() => move(-1)}><Icon name="left" size={14}/></button><button className="icon-button" aria-label="小月曆下個月" onClick={() => move(1)}><Icon name="right" size={14}/></button></div></div><div className="mini-calendar-grid">{['日', '一', '二', '三', '四', '五', '六'].map(d => <span className="weekday" key={d}>{d}</span>)}{days.map(d => <button key={d} aria-label={`選擇 ${d}`} aria-pressed={d === selected} className={`${d.slice(0, 7) !== month ? 'outside' : ''} ${d === dateKey() ? 'today' : ''} ${d === selected ? 'selected' : ''}`} onClick={() => onSelect(d)}>{Number(d.slice(8))}{scheduled.has(d) && <i/>}</button>)}</div></div>;
}
function timeRange(o: Occurrence): string {
  if (!o.startAt || !o.endAt) return '尚未排時間';
  const different = o.startAt.slice(0, 10) !== o.endAt.slice(0, 10);
  return `${clock(o.startAt)} - ${clock(o.endAt)}${different ? `（結束於 ${o.endAt.slice(5, 10).replace('-', '/')}）` : ''}`;
}
function reminderLabel(o: Occurrence): string {
  if (!o.startAt || !o.reminders.length) return '不提醒';
  const first = o.reminders[0];
  return `${first.anchor === 'start' ? '開始' : '結束'}${first.minutes ? `前 ${first.minutes} 分鐘` : '當下'}${o.reminders.length > 1 ? ` +${o.reminders.length - 1}` : ''}`;
}
function AgendaRow({ occurrence: o, now, conflict, busy, onComplete, onEdit, onDelete, mini = false }: { occurrence: Occurrence; now: number; conflict: boolean; busy: boolean; onComplete: () => void; onEdit: () => void; onDelete: () => void; mini?: boolean }) {
  const active = isActive(o, now), completed = !!o.completedAt;
  return <article className={`agenda-row ${o.startAt ? 'timed' : 'untimed'} ${active ? 'in-progress' : ''} ${completed ? 'completed' : ''} ${mini ? 'compact' : ''}`} data-testid="agenda-row" data-occurrence={o.key}>
    <button className={`completion-box ${completed ? 'checked' : ''}`} role="checkbox" aria-checked={completed} aria-label={`${completed ? '取消完成' : '完成'} ${o.title}`} disabled={busy} onClick={onComplete}>{completed && <Icon name="check" size={15}/>}</button>
    {!mini && o.startAt && <div className="row-time"><strong>{clock(o.startAt)} - {clock(o.endAt!)}</strong>{o.endAt!.slice(0, 10) !== o.startAt.slice(0, 10) && <span>結束於 {o.endAt!.slice(0, 10)}</span>}</div>}
    <button className="row-main" onClick={onEdit} title={o.title} disabled={busy}><div className="row-title"><strong>{o.title}</strong>{o.recurring && <Icon name="repeat" size={14}/>}</div>{mini && o.startAt ? <span className="row-note">{timeRange(o)}</span> : o.notes ? <span className="row-note" title={o.notes}>{o.notes}</span> : null}</button>
    <div className="row-status">{completed ? <span className="badge done">已完成</span> : active ? <span className="badge live"><i/>進行中</span> : conflict ? <span className="badge overlap">時段重疊</span> : <span className="status-pending">待進行</span>}</div>
    {!mini && o.startAt && <div className="row-reminder"><span className="reminder-tag"><Icon name="bell" size={13}/>{completed ? '已停止' : reminderLabel(o)}</span></div>}
    {!mini && <div className="row-actions"><button className="icon-button row-edit" title="編輯" aria-label={`編輯 ${o.title}`} disabled={busy} onClick={onEdit}><Icon name="edit" size={17}/></button><button className="icon-button row-delete danger" title="刪除" aria-label={`刪除 ${o.title}`} disabled={busy} onClick={onDelete}><Icon name="trash" size={17}/></button></div>}
  </article>;
}
export default function App() {
  const bridge = window.daybook;
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null), [error, setError] = useState('');
  const [selectedDate, setSelectedDate] = useState(dateKey()), [view, setView] = useState<'day' | 'week' | 'month'>('day');
  const [mode, setMode] = useState<WindowMode>('full'), [now, setNow] = useState(Date.now());
  const [editor, setEditor] = useState<{ occurrence?: Occurrence; date: string } | null>(null), [settingsOpen, setSettingsOpen] = useState(false);
  const [busyKeys, setBusyKeys] = useState<Set<string>>(new Set()), [calendarRange, setCalendarRange] = useState({ from: selectedDate, to: addDays(selectedDate, 1) });
  const calendar = useRef<FullCalendar>(null), snapshotRef = useRef(snapshot), selectedRef = useRef(selectedDate), lastDay = useRef(dateKey());
  snapshotRef.current = snapshot; selectedRef.current = selectedDate;
  const reload = useCallback(async () => { if (bridge) setSnapshot(await bridge.snapshot()); }, [bridge]);
  useEffect(() => {
    if (!bridge) return;
    void reload().catch(e => setError(e.message));
    void bridge.windowState().then(s => setMode(s.mode)).catch(e => setError(e.message));
    const unsubscribe = bridge.subscribe((event: AppEvent) => {
      if (event.type === 'changed') void reload().catch(e => setError(e.message));
      if (event.type === 'window') setMode(event.value.mode);
      if (event.type === 'error') setError(event.message);
      if (event.type === 'open') {
        setView('day'); setSelectedDate(event.date ?? dateKey());
        if (event.target && snapshotRef.current) {
          const target = event.target;
          const ex = snapshotRef.current.exceptions.find(e => e.itemId === target.itemId && e.occurrenceDate === target.occurrenceDate);
          const date = ex?.value?.date ?? target.occurrenceDate;
          const o = expand(snapshotRef.current, date, addDays(date, 1)).find(o => o.itemId === target.itemId && o.occurrenceDate === target.occurrenceDate);
          if (o) { setSelectedDate(o.date); setEditor({ occurrence: o, date: o.date }); }
        }
      }
    });
    const timer = setInterval(() => { setNow(Date.now()); const today = dateKey(); if (today !== lastDay.current) { if (selectedRef.current === lastDay.current) setSelectedDate(today); lastDay.current = today; } }, 1000);
    return () => { unsubscribe(); clearInterval(timer); };
  }, [bridge, reload]);
  useEffect(() => { if (view !== 'day' && mode === 'full') { const api = calendar.current?.getApi(); api?.changeView(view === 'week' ? 'timeGridWeek' : 'dayGridMonth'); api?.gotoDate(selectedDate); } }, [view, selectedDate, mode]);
  const day = mode === 'mini' ? dateKey(new Date(now)) : selectedDate;
  const dayOccurrences = useMemo(() => snapshot ? expand(snapshot, day, addDays(day, 1)) : [], [snapshot, day]);
  const conflicts = useMemo(() => conflictingKeys(dayOccurrences), [dayOccurrences]);
  const calendarOccurrences = useMemo(() => snapshot ? expand(snapshot, calendarRange.from, calendarRange.to) : [], [snapshot, calendarRange]);
  const calendarConflicts = useMemo(() => conflictingKeys(calendarOccurrences), [calendarOccurrences]);
  const timed = dayOccurrences.filter(o => o.startAt), untimed = dayOccurrences.filter(o => !o.startAt), completedCount = dayOccurrences.filter(o => o.completedAt).length;
  const closeEditor = useCallback(() => setEditor(current => current === editor ? null : current), [editor]);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);
  const windowAction = (action: Parameters<NonNullable<typeof bridge>['windowAction']>[0]) => { void bridge?.windowAction(action).catch(e => setError(e.message)); };
  const edit = (o: Occurrence) => { if (mode === 'mini') windowAction('full'); setSelectedDate(o.date); setEditor({ occurrence: o, date: o.date }); };
  const complete = async (o: Occurrence) => {
    if (!bridge || busyKeys.has(o.key)) return;
    setBusyKeys(keys => new Set(keys).add(o.key));
    try { await bridge.complete({ itemId: o.itemId, occurrenceDate: o.occurrenceDate, completed: !o.completedAt }); await reload(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusyKeys(keys => { const next = new Set(keys); next.delete(o.key); return next; }); }
  };
  const remove = async (o: Occurrence) => {
    if (!bridge || busyKeys.has(o.key)) return;
    setBusyKeys(keys => new Set(keys).add(o.key));
    try { await bridge.remove({ itemId: o.itemId, occurrenceDate: o.occurrenceDate, scope: 'single' }); await reload(); }
    finally { setBusyKeys(keys => { const next = new Set(keys); next.delete(o.key); return next; }); }
  };
  const deleteRow = (o: Occurrence) => {
    if (busyKeys.has(o.key)) return;
    void remove(o).catch(e => setError((e as Error).message));
  };
  const add = (date = day) => { if (mode === 'mini') windowAction('full'); setEditor({ date }); };
  const moveDate = (direction: number) => {
    if (view === 'day') setSelectedDate(addDays(selectedDate, direction));
    else if (view === 'week') setSelectedDate(addDays(selectedDate, direction * 7));
    else { const date = new Date(`${selectedDate.slice(0, 7)}-01T12:00`); date.setMonth(date.getMonth() + direction); setSelectedDate(dateKey(date)); }
  };
  if (!bridge) return <div className="launch-message"><BrandMark/><h1>日序 · 私人秘書</h1><p>請從 Windows 的「日序」桌面程式開啟。</p><p>開發時請執行 npm run dev。</p></div>;
  return <div className={`app ${mode === 'mini' ? 'mini-mode' : ''}`}>
    <div className="titlebar"><div className="titlebar-name"><span className="tiny-sun">✳</span> 日序 <span>／ 私人秘書</span></div><div className="window-buttons"><button aria-label={mode === 'mini' ? '完整視窗' : '迷你視窗'} title={mode === 'mini' ? '完整視窗' : '迷你視窗'} onClick={() => windowAction(mode === 'mini' ? 'full' : 'mini')}><Icon name={mode === 'mini' ? 'expand' : 'mini'} size={15}/></button><button aria-label="最小化" onClick={() => windowAction('minimize')}><Icon name="minus" size={15}/></button>{mode === 'full' && <button aria-label="最大化或還原" onClick={() => windowAction('maximize')}><Icon name="expand" size={13}/></button>}<button className="window-close" aria-label="關閉視窗並在背景執行" onClick={() => windowAction('close')}><Icon name="close" size={17}/></button></div></div>
    {!snapshot ? <div className="loading"><BrandMark/><p>{error || '正在打開今天…'}</p></div> : <>
      {mode === 'full' && <aside className="sidebar"><div className="brand"><BrandMark/><div><strong>日序</strong><span>每件小事，都有時間。</span></div></div><div className="nav-label">MY SPACE</div><nav><button className="nav-item active" onClick={() => { setView('day'); setSelectedDate(dateKey()); }}><Icon name="calendar"/>我的日程<span>{expand(snapshot, dateKey(), addDays(dateKey(), 1)).length}</span></button><button className="nav-item" onClick={() => setSettingsOpen(true)}><Icon name="settings"/>偏好設定</button></nav><MiniCalendar selected={selectedDate} onSelect={date => { setSelectedDate(date); setView('day'); }} snapshot={snapshot}/><div className="sidebar-note"><Icon name="sun" size={25}/><p>不用一次完成所有事情。<br/>把時間，留給眼前這一件。</p><span>ONE THING AT A TIME</span></div><div className="sidebar-bottom"><span className="status-dot"/><span>本機儲存 · 離線可用</span></div></aside>}
      <main className="workspace">
        {mode === 'full' ? <><header className="page-header"><div><div className="eyebrow">A LITTLE ORDER, A LITTLE CALM</div><h1>{view === 'day' ? (selectedDate === dateKey() ? '今天，照自己的步調。' : '讓每一天，都有自己的步調。') : view === 'week' ? '留一點空間，給這一週。' : '慢慢安排，這個月的日常。'}</h1><p>{formatDate(selectedDate, { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}<span className="header-dot">·</span>{dayOccurrences.length ? `已完成 ${completedCount} / ${dayOccurrences.length} 件事項` : '新的一頁，從一件小事開始'}</p></div><button className="button primary add-button" onClick={() => add()}><Icon name="plus" size={18}/>新增事項</button></header>
        <div className="summary-grid"><div className="summary-card"><span className="summary-icon peach"><Icon name="calendar"/></span><div><span>當日行程</span><strong>{timed.length}<small>件</small></strong></div></div><div className="summary-card"><span className="summary-icon green"><Icon name="checkCircle"/></span><div><span>已經完成</span><strong>{completedCount}<small>件</small></strong></div></div><div className="summary-card"><span className="summary-icon lavender"><Icon name="list"/></span><div><span>待安排時間</span><strong>{untimed.filter(o => !o.completedAt).length}<small>件</small></strong></div></div></div>
        <div className="agenda-toolbar"><div className="agenda-heading"><h2>{view === 'day' ? '時間表' : view === 'week' ? '一週安排' : '月曆'}</h2><button className="today-button" onClick={() => setSelectedDate(dateKey())}>今天</button><div className="date-navigation"><button className="icon-button" aria-label="上一頁日期" onClick={() => moveDate(-1)}><Icon name="left" size={16}/></button><button className="icon-button" aria-label="下一頁日期" onClick={() => moveDate(1)}><Icon name="right" size={16}/></button></div></div><div className="segmented view-switch" aria-label="日曆檢視">{(['day', 'week', 'month'] as const).map((v, i) => <button key={v} className={view === v ? 'selected' : ''} aria-pressed={view === v} onClick={() => setView(v)}>{['日', '週', '月'][i]}</button>)}</div></div></>
        : <header className="mini-header"><div><span className="eyebrow">TODAY, AT YOUR PACE</span><h1>{formatDate(day, { month: 'long', day: 'numeric' })}<small>{formatDate(day, { weekday: 'short' })}</small></h1></div><button className={`icon-button ${snapshot.settings.alwaysOnTop ? 'pinned' : ''}`} aria-label="切換保持最上層" title="保持最上層" onClick={() => { void bridge.saveSettings({ ...snapshot.settings, alwaysOnTop: !snapshot.settings.alwaysOnTop }).catch(e => setError(e.message)); }}><Icon name="pin" size={18}/></button></header>}
        {error && <div className="notice error app-error" role="alert"><span>{error}</span><button className="icon-button" aria-label="關閉錯誤訊息" onClick={() => setError('')}><Icon name="close" size={16}/></button></div>}
        {view === 'day' || mode === 'mini' ? <div className="agenda-content"><section className="agenda-list" aria-label="當日時間表">
          {mode === 'full' && timed.length > 0 && <div className="list-column-labels"><span/><span>時間</span><span>事項</span><span>狀態</span><span>提醒</span><span/></div>}
          {timed.length ? timed.map(o => <AgendaRow key={o.key} occurrence={o} now={now} conflict={conflicts.has(o.key)} busy={busyKeys.has(o.key)} onComplete={() => void complete(o)} onEdit={() => edit(o)} onDelete={() => deleteRow(o)} mini={mode === 'mini'}/>) : <div className="empty-state"><div className="empty-orbit"><Icon name="sun" size={38}/><i/><b/></div><h3>今天，還有很多可能。</h3><p>加入一件想做的事，<br/>剩下的，交給日序提醒你。</p><button className="button secondary" onClick={() => add()}><Icon name="plus" size={16}/>安排第一件事</button></div>}
        </section><section className="tasks-section"><div className="section-heading"><h2>尚未安排時間 <span>{untimed.length}</span></h2><span className="field-hint">先記下，再慢慢安排</span></div>{untimed.length ? <div className="agenda-list task-list">{untimed.map(o => <AgendaRow key={o.key} occurrence={o} now={now} conflict={false} busy={busyKeys.has(o.key)} onComplete={() => void complete(o)} onEdit={() => edit(o)} onDelete={() => deleteRow(o)} mini={mode === 'mini'}/>)}</div> : <div className="empty-tasks"><Icon name="list" size={18}/><span>想到的事情，可以先收在這裡。</span></div>}</section></div>
          : <div className="calendar-container"><FullCalendar ref={calendar} plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]} initialView={view === 'week' ? 'timeGridWeek' : 'dayGridMonth'} initialDate={selectedDate} locale={zhTwLocale} headerToolbar={false} height="auto" firstDay={1} allDayText="待辦" nowIndicator slotDuration="00:30:00" slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }} eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }} dayMaxEvents={3} scrollTime="08:00:00" displayEventEnd={view === 'week'}
            datesSet={info => setCalendarRange(previous => previous.from === dateKey(info.start) && previous.to === dateKey(info.end) ? previous : { from: dateKey(info.start), to: dateKey(info.end) })}
            dateClick={info => { setSelectedDate(info.dateStr.slice(0, 10)); setEditor({ date: info.dateStr.slice(0, 10) }); }}
            events={calendarOccurrences.map(o => ({ id: o.key, title: o.title, start: o.startAt ?? o.date, end: o.endAt ?? addDays(o.date, 1), allDay: !o.startAt, classNames: [o.completedAt ? 'event-completed' : isActive(o, now) ? 'event-active' : 'event-pending', calendarConflicts.has(o.key) ? 'event-conflict' : ''] }))}
            eventClick={info => { const o = calendarOccurrences.find(o => o.key === info.event.id); if (o) edit(o); }}
            eventContent={info => { const o = calendarOccurrences.find(o => o.key === info.event.id)!; return <div className="calendar-event-inner"><button className={`calendar-check ${o.completedAt ? 'checked' : ''}`} role="checkbox" aria-checked={!!o.completedAt} aria-label={`${o.completedAt ? '取消完成' : '完成'} ${o.title}`} disabled={busyKeys.has(o.key)} onClick={e => { e.stopPropagation(); void complete(o); }}>{o.completedAt && <Icon name="check" size={11}/>}</button><span>{info.timeText && <small>{info.timeText} </small>}{o.title}{calendarConflicts.has(o.key) && ' · 重疊'}</span></div>; }}/></div>}
        {mode === 'mini' ? <footer className="mini-footer"><span>{completedCount} / {dayOccurrences.length} 已完成</span><button className="text-button" onClick={() => add()}><Icon name="plus" size={16}/>新增事項</button></footer> : <footer className="page-footer"><span><span className="status-dot"/>變更自動儲存在本機</span><span>把日子，過成自己的樣子。</span></footer>}
      </main>
      {editor && <EventEditor key={editor.occurrence?.key ?? `new@${editor.date}`} occurrence={editor.occurrence} selectedDate={editor.date} snapshot={snapshot} onClose={closeEditor} onSave={async request => { await bridge.save(request); await reload(); }} onDelete={async () => { if (editor.occurrence) await remove(editor.occurrence); }}/>} 
      {settingsOpen && <SettingsModal snapshot={snapshot} bridge={bridge} onClose={closeSettings}/>}
    </>}
  </div>;
}
