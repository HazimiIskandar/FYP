import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView } from 'react-native';
import { useTranslation } from 'react-i18next';

export default function LanguageScreen({ onSelectLanguage }) {
  const { t } = useTranslation();
  const languages = [
    { code: 'en', label: t('language.english') },
    { code: 'zh', label: t('language.chinese') },
    { code: 'ms', label: t('language.malay') },
    { code: 'ta', label: t('language.tamil') },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.centerContent}>
        <Text style={styles.appName}>{t('app.name')}</Text>
        <Text style={styles.title}>{t('language.title')}</Text>
        <Text style={styles.subtitle}>{t('language.subtitle')}</Text>

        {languages.map((lang) => (
          <TouchableOpacity
            key={lang.code}
            style={styles.languageButton}
            onPress={() => onSelectLanguage(lang.code)}
          >
            <Text style={styles.languageButtonText}>{lang.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EEF6FF',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  appName: {
    color: '#2563EB',
    fontSize: 44,
    fontWeight: '900',
    marginBottom: 8,
  },
  title: {
    color: '#111827',
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    color: '#4B5563',
    fontSize: 17,
    marginTop: 8,
    marginBottom: 28,
  },
  languageButton: {
    backgroundColor: '#FFFFFF',
    width: '100%',
    paddingVertical: 22,
    paddingHorizontal: 20,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 2,
    borderColor: '#D8E7FF',
  },
  languageButtonText: {
    color: '#111827',
    fontSize: 23,
    fontWeight: '800',
  },
});
