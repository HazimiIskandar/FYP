import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  SafeAreaView,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import Header from '../components/Header';

const roles = [
  { key: 'Senior', translationKey: 'createAccount.senior' },
  { key: 'Caregiver', translationKey: 'createAccount.caregiver' },
  { key: 'AIC Staff', translationKey: 'createAccount.aicStaff' },
];

export default function CreateAccountScreen({ onCreate, onSignIn, onLanguage, error }) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Senior');

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title={t('app.name')}
        subtitle={t('app.tagline')}
        rightContent={
          <TouchableOpacity
            style={styles.languageButton}
            onPress={onLanguage}
            activeOpacity={0.86}
          >
            <Text style={styles.languageButtonText}>{t('home.language')}</Text>
          </TouchableOpacity>
        }
      />

      <View style={styles.content}>
        <Text style={styles.title}>{t('createAccount.title')}</Text>

        <Text style={styles.subtitle}>
          {t('createAccount.subtitle')}
        </Text>

        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder={t('createAccount.fullName')}
          placeholderTextColor="#000000"
          autoCapitalize="words"
        />

        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder={t('createAccount.emailAddress')}
          placeholderTextColor="#000000"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder={t('createAccount.password')}
          placeholderTextColor="#000000"
          secureTextEntry
        />

        <Text style={styles.roleLabel}>{t('createAccount.selectRole')}</Text>
        <View style={styles.roleRow}>
          {roles.map((r) => (
            <TouchableOpacity
              key={r.key}
              style={[styles.roleButton, role === r.key ? styles.roleButtonActive : null]}
              onPress={() => setRole(r.key)}
              activeOpacity={0.86}
            >
              <Text style={[styles.roleText, role === r.key ? styles.roleTextActive : null]}>{t(r.translationKey)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : null}

        <TouchableOpacity
          style={[
            styles.primaryButton,
            (!name.trim() || !email.trim()) && styles.disabledButton,
          ]}
          onPress={() =>
            onCreate({
              name: name.trim(),
              email: email.trim(),
              password,
              role,
            })
          }
          disabled={!name.trim() || !email.trim()}
          activeOpacity={0.86}
        >
          <Text style={styles.primaryButtonText}>
            {t('createAccount.createAccount')}
          </Text>
        </TouchableOpacity>

        <View style={styles.signInContainer}>
          <Text style={styles.signInLabel}>
            {t('createAccount.alreadyHaveAccount')}
          </Text>

          <TouchableOpacity onPress={onSignIn} activeOpacity={0.7}>
            <Text style={styles.signInLinkText}>
              {t('createAccount.signIn')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },

  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
  },

  title: {
    fontSize: 40,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 12,
  },

  subtitle: {
    fontSize: 22,
    color: '#4B5563',
    marginBottom: 32,
    lineHeight: 28,
  },

  input: {
    width: '100%',
    minHeight: 62,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    fontSize: 18,
    color: '#111827',
    marginBottom: 16,
  },

  errorText: {
    color: '#DC2626',
    marginBottom: 14,
    textAlign: 'center',
    fontSize: 16,
  },

  primaryButton: {
    minHeight: 68,
    borderRadius: 18,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    marginTop: 8,
  },

  disabledButton: {
    opacity: 0.5,
  },

  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
  },

  signInContainer: {
    marginTop: 24,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
  },

  signInLabel: {
    fontSize: 22,
    color: '#4B5563',
    fontWeight: '400',
  },

  signInLinkText: {
    fontSize: 22,
    color: '#2563EB',
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  roleLabel: {
    fontSize: 18,
    color: '#374151',
    marginBottom: 8,
    marginTop: 6,
    fontWeight: '700',
  },
  languageButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  languageButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  roleRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  roleButton: {
    flex: 1,
    marginHorizontal: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  roleButtonActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  roleText: { color: '#374151', fontSize: 16, fontWeight: '700' },
  roleTextActive: { color: '#FFFFFF' },
});