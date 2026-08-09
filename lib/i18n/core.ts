import { EN_CA_MESSAGES, type MessageKey } from './catalogs/en-CA';

export const PUBLIC_LOCALES = ['en-CA'] as const;
export const INTERNAL_LOCALES = [...PUBLIC_LOCALES, 'en-XA'] as const;
export const LOCALE_COOKIE = 'mhtoolkit_locale';

export type PublicLocale = (typeof PUBLIC_LOCALES)[number];
export type InternalLocale = (typeof INTERNAL_LOCALES)[number];

const publicLocaleSet = new Set<string>(PUBLIC_LOCALES);

export function normalizePublicLocale(value: string | null | undefined): PublicLocale {
  if (!value) return 'en-CA';
  const normalized = value.replace('_', '-');
  if (publicLocaleSet.has(normalized)) return normalized as PublicLocale;
  return 'en-CA';
}

export function normalizeInternalLocale(
  value: string | null | undefined
): InternalLocale {
  return value === 'en-XA' ? value : normalizePublicLocale(value);
}

function pseudoExpand(value: string): string {
  const expanded = value.replace(/[A-Za-z]+/g, (word) => `${word}~`);
  return `[!! ${expanded} !!]`;
}

export function message(locale: InternalLocale, key: MessageKey): string {
  const value = EN_CA_MESSAGES[key];
  return locale === 'en-XA' ? pseudoExpand(value) : value;
}

export function formatLocalDate(
  value: Date | number | string,
  locale: PublicLocale,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(locale, options).format(date);
}

export function formatLocalNumber(
  value: number,
  locale: PublicLocale,
  options?: Intl.NumberFormatOptions
): string {
  return new Intl.NumberFormat(locale, options).format(value);
}
