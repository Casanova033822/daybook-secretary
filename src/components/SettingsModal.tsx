import { t, translateError, localizedError } from '../shared/i18n';
import { useState } from 'react';
import type { Bridge, Snapshot } from '../shared/types';
import { Icon } from './Icon';
import { Modal } from './Modal';
import { Reminders } from './Reminders';
import { LanguagePicker } from './LanguagePicker';
export function SettingsModal({ snapshot, bridge, onClose }: { snapshot: Snapshot; bridge: Bridge; onClose: () => void }) {
  const [tab, setTab] = useState<'general' | 'presets'>('general');
  const [settings, setSettings] = useState(snapshot.settings), [presets, setPresets] = useState(snapshot.presets.map(p => ({ ...p })));
  const [error, setError] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false), [newTitle, setNewTitle] = useState('');
  const run = async (action: () => Promise<void>, message: string) => { setBusy(true); setError(''); setMessage(''); try { await action(); setMessage(message); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } };
  const reorder = (index: number, direction: number) => { const next = [...presets]; [next[index], next[index + direction]] = [next[index + direction], next[index]]; setPresets(next); };
  return <Modal title={t("讓日序更適合你")} subtitle={t("小小的設定，照顧每天的習慣。")} onClose={onClose}>
    <div className="settings-tabs"><button className={tab === 'general' ? 'active' : ''} onClick={() => { setTab('general'); setMessage(''); }}><Icon name="settings" size={17}/>{t("一般設定")}</button><button className={tab === 'presets' ? 'active' : ''} onClick={() => { setTab('presets'); setMessage(''); }}><Icon name="list" size={17}/>{t("常用事項")}</button></div>
    <div className="modal-body settings-body">{tab === 'general' ? <>
      <LanguagePicker/>
      <label className="setting-row"><span><strong>{t("登入 Windows 後自動執行")}</strong><small>{t("安靜地在系統匣等待，不打開主視窗。")}</small></span><input type="checkbox" role="switch" checked={settings.launchOnLogin} onChange={e => setSettings({ ...settings, launchOnLogin: e.target.checked })}/></label>
      <label className="setting-row"><span><strong>{t("保持最上層")}</strong><small>{t("讓日序視窗顯示在其他視窗上方。")}</small></span><input type="checkbox" role="switch" checked={settings.alwaysOnTop} onChange={e => setSettings({ ...settings, alwaysOnTop: e.target.checked })}/></label>
      <section className="settings-section"><h3>{t("新行程的預設提醒")}</h3><p className="field-hint">{t("只套用在之後新增的行程，每筆仍可獨立調整。")}</p><Reminders value={settings.defaultReminders} onChange={defaultReminders => setSettings({ ...settings, defaultReminders })}/></section>
      <section className="notification-test"><Icon name="bell"/><div><strong>{t("確認提醒準備好了")}</strong><p>{t("日序小卡＋提示音；聲音依電腦音量與靜音設定。")}</p></div><button className="button secondary" disabled={busy} onClick={() => run(async () => { const result = await bridge.testNotification(); if (result.display !== 'shown') throw new Error('提醒小卡未能顯示，請再試一次。'); if (result.audio === 'failed') throw localizedError('小卡已顯示，但提示音播放失敗：{detail}', { detail: result.error ?? '請檢查音效裝置。' }); }, "提醒小卡已顯示；請確認是否看見小卡並聽到提示音。")}>{t("測試提醒")}</button></section>
      <p className="privacy-note"><span className="status-dot"/>{t("資料只存放在這台電腦，自動儲存，不需登入。")}</p>
    </> : <>
      <p className="field-hint">{t("常常做的事情，先在這裡準備好。新增行程時就能從箭頭選單直接選取。")}</p>
      <div className="preset-list">{presets.map((preset, index) => <div className="preset-row" key={preset.id}><span className="preset-number">{String(index + 1).padStart(2, '0')}</span><input aria-label={t('常用事項 {n}', { n: index + 1 })} value={preset.title} onChange={e => setPresets(presets.map(p => p.id === preset.id ? { ...p, title: e.target.value } : p))}/><button className="icon-button" aria-label={t('上移 {title}', { title: preset.title })} disabled={index === 0} onClick={() => reorder(index, -1)}><Icon name="arrowUp" size={16}/></button><button className="icon-button" aria-label={t('下移 {title}', { title: preset.title })} disabled={index === presets.length - 1} onClick={() => reorder(index, 1)}><Icon name="arrowDown" size={16}/></button><button className="icon-button danger" aria-label={t('刪除常用事項 {title}', { title: preset.title })} onClick={() => setPresets(presets.filter(p => p.id !== preset.id))}><Icon name="trash" size={17}/></button></div>)}</div>
      <form className="add-preset" onSubmit={e => { e.preventDefault(); if (newTitle.trim()) { setPresets([...presets, { id: crypto.randomUUID(), title: newTitle.trim() }]); setNewTitle(''); } }}><input aria-label={t("新的常用事項")} placeholder={t("加入一個常用事項…")} value={newTitle} onChange={e => setNewTitle(e.target.value)}/><button className="button secondary" disabled={!newTitle.trim()}><Icon name="plus" size={16}/>{t("加入")}</button></form>
      <p className="field-hint">{t("清單的修改不會改動已建立的行程。")}</p>
    </>}{error && <div className="notice error" role="alert">{translateError(error)}</div>}{message && <div className="notice success" role="status"><Icon name="check" size={16}/>{translateError(message)}</div>}</div>
    <footer className="modal-footer"><button className="button secondary" onClick={onClose}>{t("關閉")}</button><span className="footer-spacer"/><button className="button primary" disabled={busy} onClick={() => run(() => tab === 'presets' ? bridge.savePresets(presets) : bridge.saveSettings(settings), tab === 'presets' ? "常用事項已儲存。" : "設定已儲存。")}>{busy ? t("儲存中…") : tab === 'presets' ? t("儲存常用事項") : t("儲存設定")}</button></footer>
  </Modal>;
}
