import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import zh from './locales/zh.json';
import ms from './locales/ms.json';
import ta from './locales/ta.json';

const resources = {
  en: { translation: en },
  zh: { translation: zh },
  ms: { translation: ms },
  ta: { translation: ta },
};

// Persistence layer — mirrors the globalThis.localStorage pattern used in
// context/FontSizeContext.js so the language selection survives app restarts
// the same way font-scale does. Expo's web build exposes window.localStorage
// natively; on native platforms globalThis.localStorage is undefined and the
// try/catch silently no-ops, so persistence falls back to the backend's
// User_Account.preferred_language (written on login + on language change via
// App.js#saveLanguagePreference) which is the authoritative source anyway.

/*
const APP_LANGUAGE_STORAGE_KEY = 'appLanguage';
const SUPPORTED_LANGUAGES = ['en', 'zh', 'ms', 'ta'];

function readSavedLanguage() {
  try {
    const stored = globalThis.localStorage?.getItem(APP_LANGUAGE_STORAGE_KEY);
    return SUPPORTED_LANGUAGES.includes(stored) ? stored : null;
  } catch (e) {
    // localStorage may be disabled in some sandboxed webviews — ignore.
    return null;
  }
}
*/

// Exposed so App.js (and any other routing layer) can decide whether to
// skip the LanguageScreen on initial mount. The user-facing semantic is
// "has the user already picked a language at least once on this device?"
// — independent of which language they picked. Returns false on every
// native platform where globalThis.localStorage is undefined, which is
// correct (no persistence available, so the onboarding screen MUST show).

/*
function hasPersistedLanguageChoice() {
  return readSavedLanguage() !== null;
}

function writeSavedLanguage(lang) {
  try {
    globalThis.localStorage?.setItem(APP_LANGUAGE_STORAGE_KEY, lang);
  } catch (e) {
    // Ignore — see readSavedLanguage note above.
  }
}
*/

// Pick the initial language synchronously so the first render already
// localises the language-selection screen instead of flashing English
// for one frame before the React tree settles.

/*
const initialLanguage = readSavedLanguage() || 'en';
*/

i18n.use(initReactI18next).init({
  resources,
  lng: 'en', // initial language, read from localStorage or default to 'en'
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

// Wrap changeLanguage so any caller (LanguageScreen onSelectLanguage,
// SeniorHomeScreen language modal, login handler applying a server
// preferred_language, etc.) automatically writes through to localStorage.
// We rebind rather than subscribe to i18n's `languageChanged` event so the
// write happens even when changeLanguage is called synchronously at app
// boot — event subscribers would miss those because the i18next instance
// has not yet wired up listeners at script-eval time.
//
// Caveats (intentional):
//   • This rebind captures the externally-routed path only. If a future
//     i18next version caches an internal `this.changeLanguage` reference
//     after init, internal calls would bypass the wrapper. Today that
//     path is not exercised, but a future maintainer should re-test if
//     i18next internals change.
//   • `i18n` is a module-level singleton, so `originalChangeLanguage` is
//     captured once at module load. Re-assigning `i18n.changeLanguage`
//     after this line shadows the wrapper itself and must be avoided.

/*
const originalChangeLanguage = i18n.changeLanguage.bind(i18n);
i18n.changeLanguage = (lang, ...rest) => {
  if (typeof lang === 'string' && SUPPORTED_LANGUAGES.includes(lang)) {
    writeSavedLanguage(lang);
  }
  return originalChangeLanguage(lang, ...rest);
};
*/

export default i18n;
/*
export { hasPersistedLanguageChoice };
*/