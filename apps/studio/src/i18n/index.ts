import { createI18n } from 'vue-i18n';
import elementEn from 'element-plus/es/locale/lang/en';
import elementZhCn from 'element-plus/es/locale/lang/zh-cn';
import enUS from './locales/en-US';
import zhCN from './locales/zh-CN';

/** Languages the Studio ships. Chinese is the default. */
export const SUPPORTED_LOCALES = ['zh-CN', 'en-US'] as const;
export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = 'zh-CN';

/** Compact labels for the header switcher — each language in its own script. */
export const LOCALE_LABELS: Record<AppLocale, string> = {
  'zh-CN': '中文',
  'en-US': 'English',
};

export const LOCALE_STORAGE_KEY = 'jevflow.locale';
export const THEME_STORAGE_KEY = 'jevflow.theme';

export function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: DEFAULT_LOCALE,
  fallbackLocale: DEFAULT_LOCALE,
  messages: {
    'zh-CN': zhCN,
    'en-US': enUS,
  },
});

/**
 * Stores live outside component setup, so they go through the global composer.
 * Everything reactive goes through `useI18n()` inside a component instead.
 */
export function translate(key: string, named?: Record<string, unknown>): string {
  return named ? i18n.global.t(key, named) : i18n.global.t(key);
}

export function setI18nLocale(locale: AppLocale): void {
  i18n.global.locale.value = locale;
}

const ELEMENT_LOCALES = {
  'zh-CN': elementZhCn,
  'en-US': elementEn,
} as const;

/** Element Plus keeps its own message table; feed it the matching one. */
export function elementLocaleFor(locale: AppLocale) {
  return ELEMENT_LOCALES[locale];
}
