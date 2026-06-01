import React, { useState } from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function CaregiverLoginScreen({ onBack, onFaceId }) {
  const [mode, setMode] = useState('login');
  const isRegistering = mode === 'register';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.86}>
          <Ionicons name="chevron-back" size={24} color="#2563EB" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.portalIcon}>
          <Ionicons name="people" size={46} color="#2563EB" />
        </View>

        <Text style={styles.portalTitle}>Caregiver Portal</Text>
        <Text style={styles.portalSubtitle}>
          {isRegistering ? 'Register securely with Face ID.' : 'Login securely with Face ID.'}
        </Text>

        <View style={styles.modeSwitch}>
          <TouchableOpacity
            style={[styles.modeButton, !isRegistering ? styles.modeButtonActive : null]}
            onPress={() => setMode('login')}
            activeOpacity={0.86}
          >
            <Text style={[styles.modeText, !isRegistering ? styles.modeTextActive : null]}>Login</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeButton, isRegistering ? styles.modeButtonActive : null]}
            onPress={() => setMode('register')}
            activeOpacity={0.86}
          >
            <Text style={[styles.modeText, isRegistering ? styles.modeTextActive : null]}>Register</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.faceIdCard}>
          <View style={styles.faceIdIcon}>
            <Ionicons name="scan-circle" size={82} color="#2563EB" />
          </View>
          <Text style={styles.faceIdTitle}>Face ID only</Text>
          <Text style={styles.faceIdText}>
            {isRegistering
              ? 'Create your caregiver access using biometric verification.'
              : 'Verify your identity to access assigned seniors.'}
          </Text>
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={onFaceId} activeOpacity={0.86}>
          <Ionicons name="scan" size={28} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>
            {isRegistering ? 'Register with Face ID' : 'Login with Face ID'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  topBar: { paddingHorizontal: 18, paddingTop: 14 },
  backButton: {
    alignSelf: 'flex-start',
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backText: { color: '#2563EB', fontSize: 17, fontWeight: '900' },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 18 },
  portalIcon: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  portalTitle: { color: '#111827', fontSize: 38, fontWeight: '900' },
  portalSubtitle: { color: '#4B5563', fontSize: 17, lineHeight: 24, marginTop: 8, marginBottom: 22 },
  modeSwitch: {
    backgroundColor: '#E5E7EB',
    borderRadius: 16,
    padding: 4,
    flexDirection: 'row',
    marginBottom: 18,
  },
  modeButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeButtonActive: { backgroundColor: '#FFFFFF' },
  modeText: { color: '#6B7280', fontSize: 17, fontWeight: '900' },
  modeTextActive: { color: '#2563EB' },
  faceIdCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 22,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 18,
  },
  faceIdIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  faceIdTitle: { color: '#111827', fontSize: 26, fontWeight: '900' },
  faceIdText: { color: '#4B5563', fontSize: 16, lineHeight: 23, textAlign: 'center', marginTop: 8 },
  primaryButton: {
    minHeight: 68,
    backgroundColor: '#2563EB',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 20, fontWeight: '900' },
});
