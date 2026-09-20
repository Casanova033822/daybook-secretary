export const locales = ['zh-TW', 'zh-CN', 'en-US', 'ja', 'ko', 'es', 'fr', 'de', 'pt-BR', 'it', 'ru', 'ar', 'hi', 'id'] as const;
export type Locale = typeof locales[number];
export type Theme = 'light' | 'dark';
export type Appearance = { theme: Theme; locale: Locale };
export const languages: readonly { locale: Locale; name: string; flag: string }[] = [
  { locale: 'zh-TW', name: '繁體中文', flag: 'hk' }, { locale: 'zh-CN', name: '简体中文', flag: 'cn' },
  { locale: 'en-US', name: 'English', flag: 'us' }, { locale: 'ja', name: '日本語', flag: 'jp' },
  { locale: 'ko', name: '한국어', flag: 'kr' }, { locale: 'es', name: 'Español', flag: 'es' },
  { locale: 'fr', name: 'Français', flag: 'fr' }, { locale: 'de', name: 'Deutsch', flag: 'de' },
  { locale: 'pt-BR', name: 'Português', flag: 'br' }, { locale: 'it', name: 'Italiano', flag: 'it' },
  { locale: 'ru', name: 'Русский', flag: 'ru' }, { locale: 'ar', name: 'العربية', flag: 'sa' },
  { locale: 'hi', name: 'हिन्दी', flag: 'in' }, { locale: 'id', name: 'Bahasa Indonesia', flag: 'id' },
];
export function isLocale(value: unknown): value is Locale { return locales.includes(value as Locale); }
export function isTheme(value: unknown): value is Theme { return value === 'light' || value === 'dark'; }
export function systemLocale(preferred: readonly string[]): Locale {
  for (const raw of preferred) {
    const tag = raw.replaceAll('_', '-').toLowerCase();
    const base = tag.split('-')[0];
    if (base === 'zh') return /(?:^|-)(hant|tw|hk|mo)(?:-|$)/.test(tag) ? 'zh-TW' : 'zh-CN';
    if (base === 'en') return 'en-US';
    if (base === 'pt') return 'pt-BR';
    if (isLocale(base)) return base;
  }
  return 'en-US';
}
export const backgroundFor = (theme: Theme) => theme === 'dark' ? '#181c24' : '#f6f7fb';
