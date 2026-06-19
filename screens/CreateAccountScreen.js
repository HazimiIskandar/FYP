import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  SafeAreaView,
} from 'react-native';

import Header from '../components/Header';

export default function CreateAccountScreen({ onCreate, onSignIn, error }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Haloapp"
        subtitle="Safe check-ins for seniors"
      />

      <View style={styles.content}>
        <Text style={styles.title}>Create Account</Text>

        <Text style={styles.subtitle}>
          Enter your Full Name and Email to set up your account.
        </Text>

        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Full Name"
          placeholderTextColor="#000000"
          autoCapitalize="words"
        />

        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="Email Address"
          placeholderTextColor="#000000"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          placeholderTextColor="#000000"
          secureTextEntry
        />

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
            })
          }
          disabled={!name.trim() || !email.trim()}
          activeOpacity={0.86}
        >
          <Text style={styles.primaryButtonText}>
            Create Account
          </Text>
        </TouchableOpacity>

        <View style={styles.signInContainer}>
          <Text style={styles.signInLabel}>
            Already have an account?{' '}
          </Text>

          <TouchableOpacity onPress={onSignIn} activeOpacity={0.7}>
            <Text style={styles.signInLinkText}>
              Sign In
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
});