import type { CSSProperties } from 'react';
export type IconName = 'sun' | 'calendar' | 'grid' | 'settings' | 'plus' | 'chevron' | 'left' | 'right' | 'check' | 'close' | 'mini' | 'expand' | 'minus' | 'bell' | 'clock' | 'repeat' | 'edit' | 'trash' | 'pin' | 'arrowUp' | 'arrowDown' | 'list' | 'checkCircle';
const paths: Record<IconName, React.ReactNode> = {
  sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-14 4h2m4 0h2m-8 3h2"/></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,
  settings: <><path d="m10 3-.6 2.2-2 .9-2-.7L3 9l1.6 1.5v3L3 15l2.4 3.6 2-.7 2 .9L10 21h4l.6-2.2 2-.9 2 .7L21 15l-1.6-1.5v-3L21 9l-2.4-3.6-2 .7-2-.9L14 3Z"/><circle cx="12" cy="12" r="3"/></>,
  plus: <path d="M12 5v14M5 12h14"/>, chevron: <path d="m6 9 6 6 6-6"/>, left: <path d="m15 5-7 7 7 7"/>, right: <path d="m9 5 7 7-7 7"/>,
  check: <path d="m5 12 4 4L19 6"/>, close: <path d="m6 6 12 12M6 18 18 6"/>, mini: <><rect x="3" y="4" width="18" height="16" rx="2"/><rect x="12" y="12" width="7" height="6" rx="1"/></>,
  expand: <><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/></>, minus: <path d="M5 12h14"/>,
  bell: <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9m6 13a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>, repeat: <><path d="M4 8h15l-4-4m4 12H4l4 4M4 8v5m15 3v-5"/></>,
  edit: <><path d="m14 4 6 6M4 20l5-1L21 7a2 2 0 0 0-4-4L5 15Z"/></>, trash: <><path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/></>,
  pin: <><path d="m8 3 8 0-1 7 4 4H5l4-4-1-7m4 11v7"/></>, arrowUp: <path d="m6 11 6-6 6 6m-6-6v14"/>, arrowDown: <path d="m6 13 6 6 6-6m-6 6V5"/>,
  list: <><path d="M9 6h12M9 12h12M9 18h12M3 6h1M3 12h1M3 18h1"/></>,
  checkCircle: <><circle cx="12" cy="12" r="9"/><path d="m7 12 3 3 7-7"/></>,
};
export function Icon({ name, size = 20, style }: { name: IconName; size?: number; style?: CSSProperties }) {
  return <svg width={size} height={size} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
export function BrandMark() { return <span className="brand-mark"><Icon name="sun" size={25}/></span>; }
