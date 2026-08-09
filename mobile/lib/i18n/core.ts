import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  EN_CA_MESSAGES,
  type MobileMessageKey,
} from './catalogs/en-CA';

export const MOBILE_LOCALE_STORAGE_KEY = 'mhtoolkit_locale_v1';
export type MobilePublicLocale = 'en-CA';
export type MobileInternalLocale = MobilePublicLocale | 'en-XA';

export function normalizeMobileLocale(
  value: string | null | undefined,
  allowPseudo = false
): MobileInternalLocale {
  if (allowPseudo && value === 'en-XA') return value;
  return 'en-CA';
}

export async function loadMobileLocale(
  allowPseudo = false
): Promise<MobileInternalLocale> {
  const stored = await AsyncStorage.getItem(MOBILE_LOCALE_STORAGE_KEY);
  if (stored) return normalizeMobileLocale(stored, allowPseudo);
  return normalizeMobileLocale(
    Intl.DateTimeFormat().resolvedOptions().locale,
    allowPseudo
  );
}

export async function saveMobileLocale(
  locale: MobileInternalLocale,
  allowPseudo = false
): Promise<MobileInternalLocale> {
  const normalized = normalizeMobileLocale(locale, allowPseudo);
  await AsyncStorage.setItem(MOBILE_LOCALE_STORAGE_KEY, normalized);
  return normalized;
}

function pseudoExpand(value: string): string {
  return `[!! ${value.replace(/[A-Za-z]+/g, (word) => `${word}~`)} !!]`;
}

export function mobileMessage(
  locale: MobileInternalLocale,
  key: MobileMessageKey
): string {
  const value = EN_CA_MESSAGES[key];
  return locale === 'en-XA' ? pseudoExpand(value) : value;
}

export function formatMobileDate(
  value: Date | number | string,
  locale: MobilePublicLocale,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(locale, options).format(date);
}
