'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  LOCALE_COOKIE,
  message,
  normalizeInternalLocale,
  type InternalLocale,
} from '@/lib/i18n/core';
import type { MessageKey } from '@/lib/i18n/catalogs/en-CA';

type I18nContextValue = {
  locale: InternalLocale;
  setLocale: (locale: InternalLocale) => void;
  t: (key: MessageKey) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function localeFromCookie(): InternalLocale {
  if (typeof document === 'undefined') return 'en-CA';
  const raw = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(`${LOCALE_COOKIE}=`))
    ?.slice(LOCALE_COOKIE.length + 1);
  return normalizeInternalLocale(raw ? decodeURIComponent(raw) : null);
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<InternalLocale>('en-CA');

  useEffect(() => {
    setLocaleState(localeFromCookie());
  }, []);

  const setLocale = (nextLocale: InternalLocale) => {
    const normalized = normalizeInternalLocale(nextLocale);
    document.cookie = `${LOCALE_COOKIE}=${encodeURIComponent(normalized)}; Path=/; Max-Age=31536000; SameSite=Lax`;
    setLocaleState(normalized);
  };

  return (
    <I18nContext.Provider
      value={{ locale, setLocale, t: (key) => message(locale, key) }}
    >
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used within I18nProvider.');
  return value;
}
