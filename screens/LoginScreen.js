import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';

export default function LoginScreen({ onLogin, onCaregiverLogin }) {
  return (
    <SafeAreaView style={styles.container}>
      <Header title="Halo" subtitle="Safe check-ins for seniors" />
      <View style={styles.centerContent}>
        <View style={styles.heroIcon}>
          <Ionicons name="shield-checkmark" size={58} color="#2563EB" />
        </View>

        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Use a simple sign-in method to continue.</Text>

        <TouchableOpacity style={styles.primaryButton} onPress={onLogin}>
          <Ionicons name="scan" size={30} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>Use Face ID</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={onLogin}>
          <Ionicons name="finger-print" size={30} color="#14532D" />
          <Text style={styles.secondaryButtonText}>Use Touch ID</Text>
        </TouchableOpacity>

        <View style={styles.caregiverArea}>
          <Text style={styles.caregiverLabel}>Family member or next-of-kin?</Text>
          <TouchableOpacity style={styles.caregiverButton} onPress={onCaregiverLogin}>
            <Ionicons name="people" size={22} color="#2563EB" />
            <Text style={styles.caregiverText}>Caregiver Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  centerContent: { flex: 1, justifyContent: 'center', paddingHorizontal: 20 },
  heroIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  title: { color: '#111827', fontSize: 32, fontWeight: '900' },
  subtitle: { color: '#4B5563', fontSize: 18, lineHeight: 25, marginTop: 8, marginBottom: 28 },
  primaryButton: {
    minHeight: 76,
    backgroundColor: '#2563EB',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 24, fontWeight: '900' },
  secondaryButton: {
    minHeight: 76,
    backgroundColor: '#DCFCE7',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 12,
    borderWidth: 2,
    borderColor: '#86EFAC',
  },
  secondaryButtonText: { color: '#14532D', fontSize: 24, fontWeight: '900' },
  caregiverArea: { marginTop: 42, alignItems: 'center' },
  caregiverLabel: { color: '#6B7280', fontSize: 16, marginBottom: 12 },
  caregiverButton: {
    minHeight: 56,
    paddingHorizontal: 22,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#BFDBFE',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  caregiverText: { color: '#2563EB', fontSize: 17, fontWeight: '800' },
});
