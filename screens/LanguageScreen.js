import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView } from 'react-native';

export default function LanguageScreen({ onSelectLanguage }) {
  const languages = ['English', '中文', 'Bahasa Melayu', 'தமிழ்'];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.centerContent}>
        <Text style={styles.appName}>Haloapp</Text>
        <Text style={styles.title}>Choose your language</Text>
        <Text style={styles.subtitle}>You can change this later in settings.</Text>

        {languages.map((lang) => (
          <TouchableOpacity key={lang} style={styles.languageButton} onPress={onSelectLanguage}>
            <Text style={styles.languageButtonText}>{lang}</Text>
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
