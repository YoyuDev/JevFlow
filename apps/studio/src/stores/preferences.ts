import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  THEME_STORAGE_KEY,
  elementLocaleFor,
  isAppLocale,
  setI18nLocale,
  type AppLocale,
} from '@/i18n';

export type ThemeMode = 'light' | 'dark';
export const THEME_MODES: readonly ThemeMode[] = ['light', 'dark'];

function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark';
}

/** localStorage can throw in private mode or when cookies are blocked. */
function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* preference simply will not survive the reload */
  }
}

/**
 * Language defaults to Chinese and only changes when the user picks one.
 * Theme follows the OS on a first visit, then remembers the explicit choice.
 */
function initialTheme(): ThemeMode {
  const stored = readStored(THEME_STORAGE_KEY);
  if (isThemeMode(stored)) return stored;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export const usePreferencesStore = defineStore('preferences', () => {
  const storedLocale = readStored(LOCALE_STORAGE_KEY);
  const locale = ref<AppLocale>(isAppLocale(storedLocale) ? storedLocale : DEFAULT_LOCALE);
  const theme = ref<ThemeMode>(initialTheme());

  const isDark = computed(() => theme.value === 'dark');
  /** Handed to `el-config-provider` so Element Plus text follows the language. */
  const elementLocale = computed(() => elementLocaleFor(locale.value));

  function applyTheme(value: ThemeMode): void {
    const root = document.documentElement;
    root.classList.toggle('dark', value === 'dark');
    // Tells the browser to paint native scrollbars and form controls to match.
    root.style.colorScheme = value;
  }

  function applyLocale(value: AppLocale): void {
    setI18nLocale(value);
    document.documentElement.lang = value;
  }

  // `index.html` already applied both before first paint to avoid a flash; this
  // re-asserts them so the store is the single source of truth afterwards.
  applyTheme(theme.value);
  applyLocale(locale.value);

  function setLocale(value: AppLocale): void {
    if (locale.value === value) return;
    locale.value = value;
    applyLocale(value);
    writeStored(LOCALE_STORAGE_KEY, value);
  }

  function setTheme(value: ThemeMode): void {
    if (theme.value === value) return;
    theme.value = value;
    applyTheme(value);
    writeStored(THEME_STORAGE_KEY, value);
  }

  function toggleTheme(): void {
    setTheme(isDark.value ? 'light' : 'dark');
  }

  return {
    locale,
    theme,
    isDark,
    elementLocale,
    setLocale,
    setTheme,
    toggleTheme,
  };
});
