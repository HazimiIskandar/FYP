import React, { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
// import * as Notifications from 'expo-notifications'; // kept for future use
import Header from '../components/Header';
import SeniorBottomNav from '../components/SeniorBottomNav';
import { useFontScale } from '../context/FontSizeContext';
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

  // Pass through ranges like '9:00 AM - 10:00 AM' as-is, mirroring the
  // CaregiverEditSeniorMenuScreen behavior so the senior side stays
  // consistent with the DB default.
  if (raw.includes('-')) {
    return raw;
  }

  if (/^(1[0-2]|[1-9]):[0-5]\d\s?(AM|PM)$/i.test(raw)) {
    return raw.replace(/\s?(AM|PM)$/i, (match) => ` ${match.trim().toUpperCase()}`);
  }

  const match = raw.match(/^([01]\d|2[0-3]):([0-5]\d)$/);

  if (!match) {
    return '9:00 AM - 10:00 AM';
  }

  const hour24 = Number(match[1]);
  const minute = match[2];
  const period = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 || 12;

  return `${hour12}:${minute} ${period}`;
};

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
  initialModal,
  onInitialModalConsumed,
  // Forwarded to SeniorBottomNav so the bottom nav also hides the
  // Community tab from this Settings screen. Settings contains the
  // Generate Link Code entry point the senior arrives through in the
  // linkage-incomplete flow, so passing the same flag as Home / Profile
  // keeps the visual restriction consistent across every reachable tab.
  restrictedMode = false,
}) {
  const { t } = useTranslation();
  const { fontScale, setFontScale } = useFontScale();
  const seniorName = getSeniorName(senior);
  const [activeModal, setActiveModal] = useState(null);
  const [settingsMessage, setSettingsMessage] = useState('');
  const [settingsError, setSettingsError] = useState('');
  const [linkCode, setLinkCode] = useState('');
  const [linkStatusMessage, setLinkStatusMessage] = useState('');
  const [linkStatusError, setLinkStatusError] = useState('');
  const [linkSaving, setLinkSaving] = useState(false);
  const [logoutConfirmVisible, setLogoutConfirmVisible] = useState(false);

  useEffect(() => {
    if (!initialModal) return;

    setActiveModal(initialModal);
    if (onInitialModalConsumed) onInitialModalConsumed();
  }, [initialModal, onInitialModalConsumed]);

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
      setLinkStatusMessage(t('settings.shareCode'));
    } catch (err) {
      setLinkStatusError(err?.message || 'Unable to generate link code.');
    } finally {
      setLinkSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header title={t('settings.title')} subtitle={t('settings.subtitle')} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          style={styles.settingRow}
          onPress={() => setActiveModal('Caregiver')}
          activeOpacity={0.86}
        >
          <View style={styles.settingIcon}>
            <Ionicons name="heart-outline" size={24} color="#2563EB" />
          </View>
          <Text style={[styles.settingText, { fontSize: 19 * fontScale }]}>{t('settings.caregiver')}</Text>
          <Ionicons name="chevron-forward" size={22} color="#9CA3AF" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.settingRow}
          onPress={() => setActiveModal('FontSize')}
          activeOpacity={0.86}
        >
          <View style={styles.settingIcon}>
            <Ionicons name="text-outline" size={24} color="#2563EB" />
          </View>
          <Text style={[styles.settingText, { fontSize: 19 * fontScale }]}>{t('settings.changeFontSize')}</Text>
          <Ionicons name="chevron-forward" size={22} color="#9CA3AF" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.logoutCard}
          onPress={() => setLogoutConfirmVisible(true)}
          activeOpacity={0.86}
        >
          <View style={styles.logoutIcon}>
            <Ionicons name="log-out-outline" size={24} color="#DC2626" />
          </View>
          <Text style={[styles.logoutText, { fontSize: 19 * fontScale }]}>{t('settings.logOut')}</Text>
          <Ionicons name="chevron-forward" size={22} color="#DC2626" />
        </TouchableOpacity>
      </ScrollView>

      <SeniorBottomNav
        activeTab="Settings"
        onHome={onHome}
        onCommunity={onCommunity}
        onProfile={onProfile}
        onSettings={() => {}}
        restrictedMode={restrictedMode}
      />



      {activeModal === 'Caregiver' ? (
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{t('settings.caregiverTitle')}</Text>
                <Text style={styles.modalSubtitle}>{t('settings.caregiverSubtitle')}</Text>
              </View>
              <TouchableOpacity style={styles.closeButton} onPress={() => setActiveModal(null)}>
                <Ionicons name="close" size={24} color="#111827" />
              </TouchableOpacity>
            </View>

            {linkCode ? (
              <View style={styles.codeCard}>
                <Text style={styles.codeLabel}>{t('settings.yourLinkCode')}</Text>
                <Text style={styles.linkCode}>{linkCode}</Text>
                {linkStatusError ? <Text style={styles.errorText}>{linkStatusError}</Text> : null}
                {linkStatusMessage ? <Text style={styles.savedText}>{linkStatusMessage}</Text> : null}
                <TouchableOpacity
                  style={[styles.primaryButton, linkSaving && styles.disabledButton]}
                  onPress={generateSeniorLinkCode}
                  activeOpacity={0.86}
                  disabled={linkSaving}
                >
                  <Text style={[styles.primaryButtonText, { fontSize: 18 * fontScale }]} adjustsFontSizeToFit numberOfLines={1}>{linkSaving ? t('settings.generating') : t('settings.generateNewCode')}</Text>
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
                  <Text style={[styles.generateButtonText, { fontSize: 22 * fontScale }]} adjustsFontSizeToFit numberOfLines={2}>{linkSaving ? t('settings.generating') : t('settings.generateLinkCode')}</Text>
                </TouchableOpacity>
                {linkStatusError ? <Text style={styles.errorText}>{linkStatusError}</Text> : null}
                {linkStatusMessage ? <Text style={styles.savedText}>{linkStatusMessage}</Text> : null}
              </View>
            )}
          </View>
        </View>
      ) : null}

      {activeModal === 'FontSize' ? (
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setActiveModal(null)} />
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, { fontSize: 25 * fontScale }]}>{t('settings.changeFontSize')}</Text>
                <Text style={[styles.modalSubtitle, { fontSize: 14 * fontScale }]}>{t('settings.adjustTextSize')}</Text>
              </View>
              <TouchableOpacity style={styles.closeButton} onPress={() => setActiveModal(null)}>
                <Ionicons name="close" size={24} color="#4B5563" />
              </TouchableOpacity>
            </View>

            <View style={{ marginTop: 20 }}>
              {[
                { label: t('settings.standard'), value: 1 },
                { label: t('settings.large'), value: 1.2 },
                { label: t('settings.extraLarge'), value: 1.4 },
              ].map((opt) => (
                <TouchableOpacity
                  key={opt.label}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingVertical: 18,
                    borderBottomWidth: 1,
                    borderBottomColor: '#F3F4F6',
                  }}
                  onPress={() => setFontScale(opt.value)}
                >
                  <Text style={{ fontSize: 18 * opt.value, color: fontScale === opt.value ? '#2563EB' : '#374151', fontWeight: fontScale === opt.value ? '900' : '600' }}>
                    {opt.label}
                  </Text>
                  {fontScale === opt.value && <Ionicons name="checkmark-circle" size={24} color="#2563EB" />}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      ) : null}

      {logoutConfirmVisible ? (
        <View style={styles.modalOverlay}>
          <View style={styles.confirmCard}>
            <View style={styles.confirmIcon}>
              <Ionicons name="log-out-outline" size={34} color="#DC2626" />
            </View>
            <Text style={styles.confirmTitle}>{t('settings.logOutTitle')}</Text>
            <Text style={styles.confirmMessage}>{t('settings.logOutMessage')}</Text>
            <TouchableOpacity style={styles.dangerButton} onPress={onLogout} activeOpacity={0.86}>
              <Text style={styles.dangerButtonText}>{t('settings.yesLogOut')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={() => setLogoutConfirmVisible(false)} activeOpacity={0.86}>
              <Text style={styles.cancelButtonText}>{t('settings.no')}</Text>
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
