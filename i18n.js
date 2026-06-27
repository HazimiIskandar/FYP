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

i18n.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;