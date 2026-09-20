import { useEffect, useState } from 'react';
import type { ReminderCardContent } from './shared/types';
import { BrandMark, Icon } from './components/Icon';
import chime from '../assets/reminder.wav?url';

export function ReminderCard() {
  const [content, setContent] = useState<ReminderCardContent>();
  const bridge = window.reminderCard!;
  useEffect(() => { void bridge.content().then(setContent); }, [bridge]);
  useEffect(() => {
    if (!content) return;
    let disposed = false, reported = false;
    const audio = new Audio(chime);
    audio.volume = 0.8;
    const report = (result: 'played' | 'failed', error?: string) => {
      if (!disposed && !reported) { reported = true; void bridge.audioResult(result, error).catch(() => {}); }
    };
    audio.onended = () => report('played');
    audio.onerror = () => report('failed', audio.error?.message || '無法讀取提示音。');
    void (async () => {
      await document.fonts.ready;
      if (disposed || !await bridge.ready()) return;
      try { await audio.play(); } catch (error) { report('failed', String(error)); }
    })().catch(() => {});
    return () => { disposed = true; audio.pause(); audio.onended = null; audio.onerror = null; };
  }, [content, bridge]);
  if (!content) return null;
  return <main className="reminder-card" aria-label="日序提醒">
    <header className="reminder-card-header"><BrandMark/><div><strong>日序提醒</strong><span>{content.test ? '提醒測試 · 請確認小卡與提示音' : content.missed ? '今天錯過的提醒' : '把時間，留給眼前這一件'}</span></div><button className="icon-button" aria-label="關閉提醒" onClick={() => void bridge.dismiss()}><Icon name="close" size={17}/></button></header>
    <div className="reminder-card-items">{content.items.slice(0, 3).map(item => <button className="reminder-card-item" key={item.key} title={item.title} onClick={() => void bridge.open(item.key)}><strong>{item.title}</strong><span className="reminder-card-time">{item.time}{item.endDate && <small>結束於 {item.endDate}</small>}</span><span className="reminder-card-reason"><Icon name="bell" size={12}/>{item.reason}</span></button>)}</div>
    <footer><span>{content.items.length > 3 ? `另有 ${content.items.length - 3} 件提醒` : '10 秒後自動關閉'}</span><button className="text-button" onClick={() => void bridge.open()}>查看行程<Icon name="right" size={14}/></button></footer>
  </main>;
}
