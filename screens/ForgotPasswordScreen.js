import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function ForgotPasswordScreen({ onBack }) {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState(null);

  const handleSend = async () => {
    if (!email.trim()) {
      setMessage('Please enter your email address.');
      return;
    }

    // For now show success message — backend endpoint not implemented
    setMessage('If an account exists for that email, instructions have been sent.');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.86}>
          <Ionicons name="chevron-back" size={24} color="#2563EB" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>Forget Password</Text>
        <Text style={styles.subtitle}>Don't worry it happens. Please enter the address associate with your account</Text>

        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="Email address"
          placeholderTextColor="#9CA3AF"
          keyboardType="email-address"
          autoCapitalize="none"
        />

        {message ? <Text style={styles.messageText}>{message}</Text> : null}

        <TouchableOpacity style={styles.primaryButton} onPress={handleSend} activeOpacity={0.86}>
          <Text style={styles.primaryButtonText}>Send OTP</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  topBar: { paddingHorizontal: 18, paddingTop: 14 },
  backButton: { flexDirection: 'row', alignItems: 'center', minHeight: 42 },
  backText: { color: '#2563EB', fontSize: 17, fontWeight: '900' },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 22 },
  title: { fontSize: 34, fontWeight: '900', color: '#111827', marginBottom: 10 },
  subtitle: { fontSize: 16, color: '#4B5563', marginBottom: 22, lineHeight: 22 },
  input: {
    width: '100%',
    minHeight: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#111827',
    marginBottom: 14,
  },
  messageText: { color: '#2563EB', marginBottom: 12, textAlign: 'center' },
  primaryButton: {
    minHeight: 64,
    borderRadius: 18,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
});
