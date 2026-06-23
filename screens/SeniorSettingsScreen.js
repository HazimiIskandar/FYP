import React, { useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
// import * as Notifications from 'expo-notifications'; // kept for future use
import Header from '../components/Header';
import SeniorBottomNav from '../components/SeniorBottomNav';
// import {
//   isValidCheckInTime,
//   scheduleCheckInReminders,
// } from '../services/checkInNotifications'; // kept for future use

const getSeniorName = (senior) =>
  senior?.full_name ||
  senior?.name ||
  [senior?.first_name, senior?.last_name].filter(Boolean).join(' ') ||
  'Senior';

const formatCheckInTime = (value) => {
  const raw = String(value || '').trim();

  if (/^(1[0-2]|[1-9]):[0-5]\d\s?(AM|PM)$/i.test(raw)) {
    return raw.replace(/\s?(AM|PM)$/i, (match) => ` ${match.trim().toUpperCase()}`);
  }

  const match = raw.match(/^([01]\d|2[0-3]):([0-5]\d)$/);

  if (!match) {
    return '9:00 AM';
  }

  const hour24 = Number(match[1]);
  const minute = match[2];
  const period = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 || 12;

  return `${hour12}:${minute} ${period}`;
};

const CHECKIN_TIMES = [
  '5:00 AM', '5:30 AM',
  '6:00 AM', '6:30 AM',
  '7:00 AM', '7:30 AM',
  '8:00 AM', '8:30 AM',
  '9:00 AM', '9:30 AM',
  '10:00 AM', '10:30 AM',
  '11:00 AM', '11:30 AM',
  '12:00 PM',
];

const generateLinkCode = () => String(Math.floor(100000 + Math.random() * 900000));

export default function SeniorSettingsScreen({
  senior = {},
  apiBase,
  onHome,
  onCommunity,
  onProfile,
  onEditProfile,
  onLogout,
  onRefresh,
}) {
  const seniorName = getSeniorName(senior);
  const initialCheckInTime = useMemo(
    () => formatCheckInTime(senior?.preferred_checkin_time || senior?.check_in_time),
    [senior]
  );
  const [activeModal, setActiveModal] = useState(null);
  const [checkInTime, setCheckInTime] = useState(initialCheckInTime);
  const [timeDropdownVisible, setTimeDropdownVisible] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState('');
  const [settingsError, setSettingsError] = useState('');
  const [linkCode, setLinkCode] = useState('');
  const [linkStatusMessage, setLinkStatusMessage] = useState('');
  const [linkStatusError, setLinkStatusError] = useState('');
  const [linkSaving, setLinkSaving] = useState(false);
  const [logoutConfirmVisible, setLogoutConfirmVisible] = useState(false);
  const [timeSaving, setTimeSaving] = useState(false);

  // --- Notification permission helpers (kept for future use) ---
  // const requestNotificationPermission = async () => {
  //   try {
  //     const { status: existingStatus } = await Notifications.getPermissionsAsync();
  //     let finalStatus = existingStatus;
  //     if (existingStatus !== 'granted') {
  //       const { status } = await Notifications.requestPermissionsAsync();
  //       finalStatus = status;
  //     }
  //     return finalStatus === 'granted';
  //   } catch (error) {
  //     console.log('Error requesting notification permission:', error);
  //     return false;
  //   }
  // };

  // --- Schedule local notifications (kept for future use) ---
  // const scheduleLocalReminders = async () => {
  //   if (!isValidCheckInTime(checkInTime)) return;
  //   const hasPermission = await requestNotificationPermission();
  //   if (!hasPermission) return;
  //   await scheduleCheckInReminders(seniorName, checkInTime);
  // };

  const saveCheckInTime = async () => {
    if (!checkInTime) {
      setSettingsError('Please select a check-in time.');
      setSettingsMessage('');
      return;
    }

    if (!apiBase || !senior?.senior_id) {
      setSettingsError('Unable to save — no connection to server.');
      setSettingsMessage('');
      return;
    }

    setTimeSaving(true);
    setSettingsError('');
    setSettingsMessage('');

    try {
      const response = await fetch(`${apiBase}/seniors/${senior.senior_id}/checkin-time`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferred_checkin_time: checkInTime }),
      });

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error || 'Failed to save check-in time.');
      }

      setSettingsMessage(`Check-in time saved: ${checkInTime}`);
      if (onRefresh) onRefresh();
    } catch (err) {
      setSettingsError(err?.message || 'Failed to save. Please try again.');
    } finally {
      setTimeSaving(false);
    }
  };

  const openCaregiverModal = () => {
    setLinkCode('');
    setLinkStatusMessage('');
    setLinkStatusError('');
    setActiveModal('Caregiver');
  };

  const generateSeniorLinkCode = async () => {
    if (!apiBase) {
      setLinkStatusError('Backend server is not available yet.');
      setLinkStatusMessage('');
      return;
    }

    if (!senior?.senior_id) {
      setLinkStatusError('Senior profile is not ready yet.');
      setLinkStatusMessage('');
      return;
    }

    setLinkSaving(true);
    setLinkStatusError('');
    setLinkStatusMessage('');

    try {
      const generatedCode = generateLinkCode();
      const response = await fetch(`${apiBase}/seniors/${senior?.senior_id}/link-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ link_code: generatedCode }),
      });

      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error || body?.message || 'Unable to generate link code.');
      }

      setLinkCode(body?.link_code || generatedCode);
      setLinkStatusMessage('Share this code with your caregiver.');
    } catch (err) {
      setLinkStatusError(err?.message || 'Unable to generate link code.');
    } finally {
      setLinkSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Settings" subtitle="Manage account and reminders" />

      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity
          style={styles.settingRow}
          onPress={onEditProfile}
          activeOpacity={0.86}
        >
          <View style={styles.settingIcon}>
            <Ionicons name="person-outline" size={23} color="#2563EB" />
          </View>
          <Text style={styles.settingText}>Update Profile</Text>
          <Ionicons name="chevron-forward" size={23} color="#6B7280" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.settingRow}
          onPress={() => setActiveModal('Notification')}
          activeOpacity={0.86}
        >
          <View style={styles.settingIcon}>
            <Ionicons name="notifications-outline" size={23} color="#2563EB" />
          </View>
          <Text style={styles.settingText}>Notification</Text>
          <Ionicons name="chevron-forward" size={23} color="#6B7280" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.settingRow}
          onPress={openCaregiverModal}
          activeOpacity={0.86}
        >
          <View style={styles.settingIcon}>
            <Ionicons name="people-outline" size={23} color="#2563EB" />
          </View>
          <Text style={styles.settingText}>Caregiver</Text>
          <Ionicons name="chevron-forward" size={23} color="#6B7280" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={() => setLogoutConfirmVisible(true)}
          activeOpacity={0.86}
        >
          <Ionicons name="log-out-outline" size={24} color="#FFFFFF" />
          <Text style={styles.logoutButtonText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>

      <SeniorBottomNav
        activeTab="Settings"
        onHome={onHome}
        onCommunity={onCommunity}
        onProfile={onProfile}
        onSettings={() => {}}
      />

      {timeDropdownVisible ? (
        <Modal visible={timeDropdownVisible} transparent animationType="fade">
          <View style={styles.dropdownOverlay}>
            <Pressable
              style={styles.dropdownBackdrop}
              onPress={() => setTimeDropdownVisible(false)}
            />
            <View style={styles.dropdownModal}>
              <Text style={styles.dropdownTitle}>Select Check-In Time</Text>
              <ScrollView style={styles.dropdownList}>
                {CHECKIN_TIMES.map((time) => (
                  <TouchableOpacity
                    key={time}
                    style={styles.dropdownItem}
                    onPress={() => {
                      setCheckInTime(time);
                      setTimeDropdownVisible(false);
                      setSettingsMessage('');
                      setSettingsError('');
                    }}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.dropdownItemText,
                        checkInTime === time && styles.dropdownItemTextSelected,
                      ]}
                    >
                      {time}
                    </Text>
                    {checkInTime === time && (
                      <Ionicons name="checkmark" size={20} color="#2563EB" />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      ) : null}

      {activeModal === 'Notification' ? (
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Notification</Text>
                <Text style={styles.modalSubtitle}>Daily check-in reminders</Text>
              </View>
              <TouchableOpacity style={styles.closeButton} onPress={() => setActiveModal(null)}>
                <Ionicons name="close" size={24} color="#111827" />
              </TouchableOpacity>
            </View>

            <View style={styles.noticeBox}>
              <Ionicons name="notifications-outline" size={22} color="#2563EB" />
              <Text style={styles.noticeText}>
                The app will remind you 30 minutes and 15 minutes before your chosen check-in time.
              </Text>
            </View>

            <Text style={styles.inputLabel}>Preferred Check-In Time</Text>
            <TouchableOpacity
              style={styles.selectBox}
              onPress={() => setTimeDropdownVisible(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.selectBoxText}>{checkInTime}</Text>
              <Ionicons name="chevron-down-outline" size={18} color="#6B7280" />
            </TouchableOpacity>

            {settingsError ? <Text style={styles.errorText}>{settingsError}</Text> : null}
            {settingsMessage ? <Text style={styles.savedText}>{settingsMessage}</Text> : null}

            <TouchableOpacity
              style={[styles.primaryButton, timeSaving && { opacity: 0.6 }]}
              onPress={saveCheckInTime}
              activeOpacity={0.86}
              disabled={timeSaving}
            >
              <Text style={styles.primaryButtonText}>{timeSaving ? 'Saving…' : 'Save Check-In Time'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {activeModal === 'Caregiver' ? (
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Caregiver</Text>
                <Text style={styles.modalSubtitle}>Share link code</Text>
              </View>
              <TouchableOpacity style={styles.closeButton} onPress={() => setActiveModal(null)}>
                <Ionicons name="close" size={24} color="#111827" />
              </TouchableOpacity>
            </View>

            {linkCode ? (
              <View style={styles.codeCard}>
                <Text style={styles.codeLabel}>Your unique link code</Text>
                <Text style={styles.linkCode}>{linkCode}</Text>
                <Text style={styles.codeHelp}>Share this code with your caregiver.</Text>
                {linkStatusError ? <Text style={styles.errorText}>{linkStatusError}</Text> : null}
                {linkStatusMessage ? <Text style={styles.savedText}>{linkStatusMessage}</Text> : null}
                <TouchableOpacity
                  style={[styles.primaryButton, linkSaving && styles.disabledButton]}
                  onPress={generateSeniorLinkCode}
                  activeOpacity={0.86}
                  disabled={linkSaving}
                >
                  <Text style={styles.primaryButtonText}>{linkSaving ? 'Generating...' : 'Generate New Code'}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                <TouchableOpacity
                  style={[styles.generateButton, linkSaving && styles.disabledButton]}
                  onPress={generateSeniorLinkCode}
                  activeOpacity={0.86}
                  disabled={linkSaving}
                >
                  <Text style={styles.generateButtonText}>{linkSaving ? 'Generating...' : 'Generate Link Code'}</Text>
                </TouchableOpacity>
                {linkStatusError ? <Text style={styles.errorText}>{linkStatusError}</Text> : null}
                {linkStatusMessage ? <Text style={styles.savedText}>{linkStatusMessage}</Text> : null}
              </View>
            )}
          </View>
        </View>
      ) : null}

      {logoutConfirmVisible ? (
        <View style={styles.modalOverlay}>
          <View style={styles.confirmCard}>
            <View style={styles.confirmIcon}>
              <Ionicons name="log-out-outline" size={34} color="#DC2626" />
            </View>
            <Text style={styles.confirmTitle}>Log out?</Text>
            <Text style={styles.confirmMessage}>Please confirm before leaving your senior account.</Text>
            <TouchableOpacity style={styles.dangerButton} onPress={onLogout} activeOpacity={0.86}>
              <Text style={styles.dangerButtonText}>Yes, Log Out</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={() => setLogoutConfirmVisible(false)} activeOpacity={0.86}>
              <Text style={styles.cancelButtonText}>No</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 20, paddingBottom: 28 },
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
  logoutButton: {
    backgroundColor: '#DC2626',
    minHeight: 64,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  logoutButtonText: { color: '#FFFFFF', fontSize: 20, fontWeight: '900' },
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
  noticeBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  noticeText: {
    color: '#374151',
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    marginLeft: 10,
  },
  inputLabel: { color: '#374151', fontSize: 14, fontWeight: '900', marginBottom: 8 },
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
  selectBox: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  selectBoxText: {
    color: '#111827',
    fontSize: 17,
    fontWeight: '800',
  },
  dropdownOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownBackdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(17, 24, 39, 0.55)',
  },
  dropdownModal: {
    width: '85%',
    maxWidth: 320,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 14,
    maxHeight: '50%',
    elevation: 6,
  },
  dropdownTitle: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 12,
  },
  dropdownList: {
    maxHeight: 240,
  },
  dropdownItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownItemText: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '700',
  },
  dropdownItemTextSelected: {
    color: '#2563EB',
    fontWeight: '900',
  },
  timeList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  timeOption: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#F8FAFC',
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginRight: 10,
    marginBottom: 10,
  },
  timeOptionSelected: {
    borderColor: '#2563EB',
    backgroundColor: '#DBEAFE',
  },
  timeOptionText: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '800',
  },
  timeOptionTextSelected: {
    color: '#1D4ED8',
  },
  helperText: { color: '#6B7280', fontSize: 13, fontWeight: '700', marginTop: 8, lineHeight: 18 },
  savedText: { color: '#15803D', fontSize: 14, fontWeight: '800', textAlign: 'center', marginTop: 12 },
  errorText: { color: '#DC2626', fontSize: 14, fontWeight: '800', textAlign: 'center', marginTop: 12 },
  primaryButton: {
    backgroundColor: '#2563EB',
    minHeight: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
  generateButton: {
    backgroundColor: '#2563EB',
    minHeight: 72,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  generateButtonText: { color: '#FFFFFF', fontSize: 22, fontWeight: '900' },
  codeCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 18,
    padding: 20,
    alignItems: 'center',
  },
  codeLabel: { color: '#2563EB', fontSize: 15, fontWeight: '900', marginBottom: 8 },
  linkCode: { color: '#111827', fontSize: 44, fontWeight: '900', letterSpacing: 4 },
  codeHelp: { color: '#4B5563', fontSize: 14, fontWeight: '700', marginTop: 8, textAlign: 'center' },
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
