import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import AICBottomNav from '../components/AICBottomNav';
import CaregiverBottomNav from '../components/CaregiverBottomNav';

const isValidName = (value) => {
  const text = String(value || '').trim();
  return Boolean(text) && !/\d/.test(text);
};

const isEightDigitPhone = (value) => /^\d{8}$/.test(String(value || '').trim());

const getRoleName = (user) =>
  `${user?.role || user?.role_name || user?.roleName || ''}`.toLowerCase();

const capitalizeWords = (value) =>
  String(value || '')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

const isAicStaff = (user) => {
  const roleId = Number(user?.role_id);
  return roleId === 3 || getRoleName(user).includes('aic');
};

export default function StaffSettingsScreen({
  authenticatedUser = {},
  apiBase,
  onLogout,
  onRefresh,
  onCases,
  onHome,
  onSeniors,
  onStatus,
}) {
  const staffIsAic = isAicStaff(authenticatedUser);

  const [fullName, setFullName] = useState(authenticatedUser?.full_name || '');
  const [phone, setPhone] = useState(authenticatedUser?.phone_number || '');
  const [telegramChatId, setTelegramChatId] = useState(authenticatedUser?.telegram_chat_id || '');
  
  const [particularsModalVisible, setParticularsModalVisible] = useState(false);
  const [particularsSaving, setParticularsSaving] = useState(false);
  const [particularsMessage, setParticularsMessage] = useState('');
  const [particularsError, setParticularsError] = useState('');
  const [logoutConfirmVisible, setLogoutConfirmVisible] = useState(false);

  useEffect(() => {
    setFullName(authenticatedUser?.full_name || '');
    setPhone(authenticatedUser?.phone_number || '');
    setTelegramChatId(authenticatedUser?.telegram_chat_id || '');
  }, [authenticatedUser?.user_id]);

  const openParticularsModal = () => {
    setFullName(authenticatedUser?.full_name || '');
    setPhone(authenticatedUser?.phone_number || '');
    setTelegramChatId(authenticatedUser?.telegram_chat_id || '');
    setParticularsMessage('');
    setParticularsError('');
    setParticularsModalVisible(true);
  };

  const saveParticulars = async () => {
    if (!isValidName(fullName)) {
      setParticularsError('Name cannot be empty or contain numbers.');
      setParticularsMessage('');
      return;
    }
    if (!isEightDigitPhone(phone)) {
      setParticularsError('Phone number must be exactly 8 digits.');
      setParticularsMessage('');
      return;
    }
    if (!apiBase || !authenticatedUser?.user_id) {
      setParticularsError('Unable to save — no connection to server.');
      setParticularsMessage('');
      return;
    }

    setParticularsSaving(true);
    setParticularsError('');
    setParticularsMessage('');

    try {
      const response = await fetch(`${apiBase}/users/${authenticatedUser.user_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: fullName, phone_number: phone }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error || 'Failed to save particulars.');
      }
      
      if (telegramChatId) {
        const tgResponse = await fetch(`${apiBase}/users/${authenticatedUser.user_id}/telegram-link`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ telegram_chat_id: telegramChatId }),
        });
        if (!tgResponse.ok) {
          console.warn("Failed to save telegram chat ID");
        }
      }

      setParticularsMessage('Particulars saved successfully.');
      if (onRefresh) onRefresh();
    } catch (err) {
      setParticularsError(err?.message || 'Failed to save. Please try again.');
    } finally {
      setParticularsSaving(false);
    }
  };

  const renderBottomNav = () => {
    if (staffIsAic) {
      return <AICBottomNav activeTab="Settings" onCases={onCases} onSettings={() => {}} />;
    }
    return (
      <CaregiverBottomNav
        activeTab="Settings"
        onHome={onHome}
        onSeniors={onSeniors}
        onStatus={onStatus}
        onSettings={() => {}}
      />
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Settings" subtitle="Manage your account and session" />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.profileCard}>
          <View style={styles.avatarCircle}>
            <Ionicons name="person" size={40} color="#0056A0" />
          </View>
          <Text style={styles.profileName}>
            {authenticatedUser?.full_name || 'Staff User'}
          </Text>
          <Text style={styles.profileRole}>
            {capitalizeWords(getRoleName(authenticatedUser)) || 'Staff Member'}
          </Text>
        </View>

        <View style={styles.optionsContainer}>
          <Text style={styles.sectionTitle}>Account</Text>

          <TouchableOpacity style={styles.optionRow} onPress={openParticularsModal}>
            <View style={styles.optionIconContainer}>
              <Ionicons name="person-circle-outline" size={24} color="#333" />
            </View>
            <View style={styles.optionTextContainer}>
              <Text style={styles.optionTitle}>My Particulars</Text>
              <Text style={styles.optionSubtitle}>Update name, phone, and Telegram</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.logoutCard}
          onPress={() => setLogoutConfirmVisible(true)}
          activeOpacity={0.86}
        >
          <View style={styles.logoutIcon}>
            <Ionicons name="log-out-outline" size={24} color="#DC2626" />
          </View>
          <Text style={styles.logoutText}>Log Out</Text>
          <Ionicons name="chevron-forward" size={22} color="#DC2626" />
        </TouchableOpacity>
      </ScrollView>

      {renderBottomNav()}

      {particularsModalVisible ? (
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Update Particulars</Text>
                <Text style={styles.modalSubtitle}>Keep your contact details up to date</Text>
              </View>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setParticularsModalVisible(false)}
              >
                <Ionicons name="close" size={24} color="#111827" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Full Name</Text>
            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder="e.g. John Tan"
              autoCapitalize="words"
              placeholderTextColor="#9CA3AF"
            />

            <Text style={[styles.inputLabel, styles.inputLabelSpaced]}>Phone Number</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={(text) => setPhone(String(text || '').replace(/\D/g, ''))}
              placeholder="8-digit phone"
              keyboardType="number-pad"
              maxLength={8}
              placeholderTextColor="#9CA3AF"
            />

            <Text style={[styles.inputLabel, styles.inputLabelSpaced]}>Telegram Chat ID</Text>
            <TextInput
              style={styles.input}
              value={telegramChatId}
              onChangeText={(text) => setTelegramChatId(String(text || '').replace(/\D/g, ''))}
              placeholder="e.g. 1708283023"
              keyboardType="number-pad"
              placeholderTextColor="#9CA3AF"
            />

            {particularsError ? <Text style={styles.errorText}>{particularsError}</Text> : null}
            {particularsMessage ? <Text style={styles.savedText}>{particularsMessage}</Text> : null}

            <TouchableOpacity
              style={[styles.primaryButton, particularsSaving && styles.disabledButton]}
              onPress={saveParticulars}
              activeOpacity={0.86}
              disabled={particularsSaving}
            >
              <Text style={styles.primaryButtonText}>
                {particularsSaving ? 'Saving...' : 'Save Particulars'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {logoutConfirmVisible ? (
        <View style={styles.modalOverlay}>
          <View style={styles.confirmCard}>
            <View style={styles.confirmIcon}>
              <Ionicons name="log-out-outline" size={34} color="#DC2626" />
            </View>
            <Text style={styles.confirmTitle}>Log Out</Text>
            <Text style={styles.confirmMessage}>Are you sure you want to end your session?</Text>
            <TouchableOpacity style={styles.dangerButton} onPress={onLogout} activeOpacity={0.86}>
              <Text style={styles.dangerButtonText}>Yes, Log Out</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setLogoutConfirmVisible(false)}
              activeOpacity={0.86}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 100 },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  profileName: {
    fontSize: 22,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 4,
  },
  profileRole: {
    fontSize: 15,
    fontWeight: '700',
    color: '#6B7280',
  },
  optionsContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#4B5563',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  optionRow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minHeight: 76,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  optionIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 2,
  },
  optionSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  settingRow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minHeight: 72,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  settingIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  settingText: { flex: 1, color: '#111827', fontSize: 19, fontWeight: '900' },
  logoutCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
    minHeight: 72,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  logoutIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  logoutText: { flex: 1, color: '#B91C1C', fontSize: 19, fontWeight: '900' },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 20,
    backgroundColor: 'rgba(17, 24, 39, 0.55)',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: { color: '#111827', fontSize: 25, fontWeight: '900' },
  modalSubtitle: { color: '#6B7280', fontSize: 14, fontWeight: '700', marginTop: 2 },
  closeButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputLabel: { color: '#374151', fontSize: 14, fontWeight: '900', marginBottom: 8 },
  inputLabelSpaced: { marginTop: 16 },
  input: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 14,
    color: '#111827',
    fontSize: 17,
    fontWeight: '800',
  },
  savedText: {
    color: '#15803D',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 12,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 12,
  },
  primaryButton: {
    backgroundColor: '#2563EB',
    minHeight: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  disabledButton: { opacity: 0.6 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
  confirmCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 22,
    alignItems: 'center',
  },
  confirmIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  confirmTitle: { color: '#111827', fontSize: 27, fontWeight: '900', textAlign: 'center' },
  confirmMessage: {
    color: '#4B5563',
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  dangerButton: {
    backgroundColor: '#DC2626',
    width: '100%',
    minHeight: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  dangerButtonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
  cancelButton: {
    backgroundColor: '#EFF6FF',
    width: '100%',
    minHeight: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: { color: '#2563EB', fontSize: 17, fontWeight: '900' },
});
