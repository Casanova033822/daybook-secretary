import { join } from 'node:path';

const DEV_ORIGIN = 'http://127.0.0.1:5173';
export function developmentUrl(packaged: boolean, value?: string): string | undefined {
  if (packaged || !value) return undefined;
  try {
    const url = new URL(value);
    return url.origin === DEV_ORIGIN && url.pathname === '/' && !url.search && !url.hash && !url.username && !url.password ? `${DEV_ORIGIN}/` : undefined;
  } catch { return undefined; }
}
export function rendererUrl(_dist: string, devUrl?: string, reminder = false): string {
  return `${devUrl ?? 'daybook://app/index.html'}${reminder ? '#reminder' : ''}`;
}
export function trustedRenderer(url: string | undefined, dist: string, devUrl?: string, reminder = false): boolean {
  return !!url && url === rendererUrl(dist, devUrl, reminder);
}
/** Only generated renderer resources are served, never arbitrary filesystem paths. */
export function bundledPath(value: string, dist: string): string | undefined {
  try {
    const url = new URL(value);
    if (url.protocol !== 'daybook:' || url.hostname !== 'app' || url.port || url.username || url.password || url.search) return undefined;
    const path = decodeURIComponent(url.pathname);
    if (!/^\/(?:index\.html|assets\/[A-Za-z0-9_-]+\.(?:js|css|wav))$/.test(path)) return undefined;
    return join(dist, path.slice(1));
  } catch { return undefined; }
}
/** Deny network access and all renderer file:// access. */
export function allowedRequest(value: string, dist: string, devUrl?: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol === 'data:' || url.protocol === 'blob:') return true;
    if (devUrl && (url.origin === new URL(devUrl).origin || url.origin === 'ws://127.0.0.1:5173')) return true;
    return !!bundledPath(value, dist);
  } catch { return false; }
}
