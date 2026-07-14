import React, { useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import CaregiverBottomNav from '../components/CaregiverBottomNav';

const getSeniorName = (senior) =>
  senior?.full_name ||
  senior?.name ||
  [senior?.first_name, senior?.last_name].filter(Boolean).join(' ') ||
  'Senior';

const formatCheckInTime = (value) => {
  const raw = String(value || '').trim();

  // If it's already a range (e.g. '9:00 AM - 10:00 AM'), return it directly
  if (raw.includes('-')) {
    return raw;
  }

  // Fallback if somehow it's a single time (from older data)
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

const MORNING_TIMES = [
  '4:00 AM', '5:00 AM', '6:00 AM', '7:00 AM', '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM'
];

const EVENING_TIMES = [
  '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM', '6:00 PM', '7:00 PM', '8:00 PM', '9:00 PM', '10:00 PM', '11:00 PM'
];

export default function CaregiverEditSeniorMenuScreen({
  senior = {},
  apiBase,
  authenticatedUser,
  onEditProfile,
  onGoBack,
  onGoToHome,
  onGoToSeniorsList,
  onGoToStatus,
  onSettings,
  onRefresh,
}) {
  const seniorName = getSeniorName(senior);
  const getInitialTimes = (seniorData) => {
    const raw = seniorData?.preferred_checkin_time || seniorData?.check_in_time || '5:00 AM - 10:00 AM, 6:00 PM - 10:00 PM';
    const parts = String(raw).split(',').map(s => s.trim());
    const isOldFormat = parts.length > 2;
    const morningPart = parts[0] || '5:00 AM - 10:00 AM';
    const eveningPart = isOldFormat ? (parts[2] || '6:00 PM - 10:00 PM') : (parts[1] || '6:00 PM - 10:00 PM');

    const mSplit = morningPart.split('-').map(s => s.trim());
    const eSplit = eveningPart.split('-').map(s => s.trim());
    return {
      morningStart: mSplit[0] || '5:00 AM',
      morningEnd: mSplit[1] || '10:00 AM',
      eveningStart: eSplit[0] || '6:00 PM',
      eveningEnd: eSplit[1] || '10:00 PM',
    };
  };

  const initialTimes = useMemo(() => getInitialTimes(senior), [senior]);
  const [activeModal, setActiveModal] = useState(null);
  const [morningStart, setMorningStart] = useState(initialTimes.morningStart);
  const [morningEnd, setMorningEnd] = useState(initialTimes.morningEnd);
  const [eveningStart, setEveningStart] = useState(initialTimes.eveningStart);
  const [eveningEnd, setEveningEnd] = useState(initialTimes.eveningEnd);
  const [timeDropdownVisible, setTimeDropdownVisible] = useState(false);
  const [editingTimeIndex, setEditingTimeIndex] = useState(1); // 1=mStart, 2=mEnd, 3=eStart, 4=eEnd
  const [settingsMessage, setSettingsMessage] = useState('');
  const [settingsError, setSettingsError] = useState('');
  const [timeSaving, setTimeSaving] = useState(false);
  // Rule 3 front-end: caregiver-side "Remove Senior from My
  // Caregiver Account" affordance. Two states drive the UX — the
  // inline-row confirm modal is open while the caregiver is
  // reviewing the destructive action; `removingSenior` flips true
  // during the DELETE network round-trip so the button disables
  // and avoids double-submits.
  const [removingSenior, setRemovingSenior] = useState(false);
  const [unlinkConfirmVisible, setUnlinkConfirmVisible] = useState(false);

  // Rule 3 — caregiver removes senior from their caregiver account.
  // Invokes the backend's DELETE /seniors/:senior_id/caregivers/:caregiver_id
  // endpoint, which removes the Senior_has_Caregiver junction row
  // only — the senior's other data (points, streaks, check-in
  // history, memory progress, emergency history) remains fully
  // intact per Rule 5. Then re-runs onRefresh so the caregiver's
  // roster reflects the removal immediately. The senior's own app
  // picks up the same change within its 10s link-polling tick via
  // App.js, which flips the senior to restricted Home.
  const removeSeniorFromCaregiver = async () => {
    if (!apiBase || !senior?.senior_id || !authenticatedUser?.user_id) {
      setSettingsError('Unable to remove — no connection to server.');
      setSettingsMessage('');
      return;
    }
    setRemovingSenior(true);
    setSettingsError('');
    setSettingsMessage('');
    setUnlinkConfirmVisible(false);
    try {
      const response = await fetch(
        `${apiBase}/seniors/${senior.senior_id}/caregivers/${authenticatedUser.user_id}`,
        { method: 'DELETE' }
      );
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error || body?.message || 'Failed to remove senior.');
      }
      setSettingsMessage('Senior removed from your caregiver account.');
      if (onRefresh) await onRefresh(authenticatedUser);
      if (onGoBack) onGoBack();
    } catch (err) {
      setSettingsError(err?.message || 'Failed to remove senior.');
    } finally {
      setRemovingSenior(false);
    }
  };

  const getTimeValue = (timeStr) => {
    const match = String(timeStr || '').trim().match(/^(1[0-2]|[1-9]):([0-5]\d)\s?(AM|PM)$/i);
    if (!match) return 0;
    let hour = Number(match[1]);
    const minute = Number(match[2]);
    const period = match[3].toUpperCase();
    if (period === 'AM' && hour === 12) hour = 0;
    if (period === 'PM' && hour !== 12) hour += 12;
    return hour + minute / 60;
  };

  const saveCheckInTime = async () => {
    if (!morningStart || !morningEnd || !eveningStart || !eveningEnd) {
      setSettingsError('Please select all start and end times.');
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
      const combinedTimes = `${morningStart} - ${morningEnd}, ${eveningStart} - ${eveningEnd}`;
      const response = await fetch(`${apiBase}/seniors/${senior.senior_id}/checkin-time`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferred_checkin_time: combinedTimes }),
      });

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error || 'Failed to save check-in times.');
      }

      setSettingsMessage('Check-in times saved successfully.');
      if (onRefresh) await onRefresh(authenticatedUser);
    } catch (err) {
      setSettingsError(err?.message || 'Failed to save. Please try again.');
    } finally {
      setTimeSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title={`Update ${seniorName}`}
        subtitle="Manage senior profile and reminders"
        rightContent={(
          <TouchableOpacity onPress={onGoBack} style={{ padding: 8 }}>
            <Text style={{ color: '#2563EB', fontSize: 16, fontWeight: 'bold' }}>Done</Text>
          </TouchableOpacity>
        )}
      />

      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity
          style={styles.settingRow}
          onPress={onEditProfile}
          activeOpacity={0.86}
        >
          <View style={styles.settingIcon}>
            <Ionicons name="person-outline" size={23} color="#2563EB" />
          </View>
          <Text style={styles.settingText}>Update Profile Details</Text>
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
          <Text style={styles.settingText}>Check-In Times</Text>
          <Ionicons name="chevron-forward" size={23} color="#6B7280" />
        </TouchableOpacity>

        {/* Rule 3 — caregiver removes senior from their caregiver
            account. Confirms via a danger-styled modal so a stray tap
            doesn't lose the linkage for an active senior. Only the
            Senior_has_Caregiver junction row is removed (Rule 5). */}
        <TouchableOpacity
          style={styles.unlinkRow}
          onPress={() => setUnlinkConfirmVisible(true)}
          activeOpacity={0.86}
        >
          <View style={styles.unlinkIcon}>
            <Ionicons name="person-remove-outline" size={23} color="#DC2626" />
          </View>
          <Text style={styles.unlinkText}>Remove Senior from My Caregiver Account</Text>
          <Ionicons name="chevron-forward" size={23} color="#DC2626" />
        </TouchableOpacity>

      </ScrollView>

      <CaregiverBottomNav
        activeTab="Seniors"
        onHome={onGoToHome}
        onSeniors={onGoToSeniorsList}
        onStatus={onGoToStatus}
        onSettings={onSettings}
      />

      {unlinkConfirmVisible ? (
        <View style={styles.modalOverlay}>
          <View style={styles.confirmCard}>
            <View style={styles.unlinkConfirmIcon}>
              <Ionicons name="person-remove-outline" size={32} color="#DC2626" />
            </View>
            <Text style={styles.confirmTitle}>Remove {seniorName}?</Text>
            <Text style={styles.confirmMessage}>
              {seniorName} will no longer appear in your Senior list and will lose access to app features until another caregiver links their account using a fresh link code. The senior's own data (check-in history, points, streaks) will remain intact.
            </Text>
            {settingsError ? <Text style={styles.errorText}>{settingsError}</Text> : null}
            {settingsMessage ? <Text style={styles.savedText}>{settingsMessage}</Text> : null}
            <TouchableOpacity
              style={[styles.dangerButton, removingSenior && { opacity: 0.6 }]}
              onPress={removeSeniorFromCaregiver}
              activeOpacity={0.86}
              disabled={removingSenior}
            >
              <Text style={styles.dangerButtonText}>
                {removingSenior ? 'Removing…' : 'Yes, Remove Senior'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setUnlinkConfirmVisible(false)}
              activeOpacity={0.86}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {timeDropdownVisible ? (
        <View style={[styles.modalOverlay, { zIndex: 30 }]}>
          <Pressable
            style={styles.dropdownBackdrop}
            onPress={() => setTimeDropdownVisible(false)}
          />
          <View style={styles.dropdownModal}>
            <Text style={styles.dropdownTitle}>Select Time</Text>
            <ScrollView style={styles.dropdownList}>
              {((editingTimeIndex === 1 || editingTimeIndex === 2) ? MORNING_TIMES : EVENING_TIMES).map((time) => {
                const isSelected =
                  (editingTimeIndex === 1 && time === morningStart) ||
                  (editingTimeIndex === 2 && time === morningEnd) ||
                  (editingTimeIndex === 3 && time === eveningStart) ||
                  (editingTimeIndex === 4 && time === eveningEnd);

                return (
                  <TouchableOpacity
                    key={time}
                    style={styles.dropdownItem}
                    onPress={() => {
                      if (editingTimeIndex === 1) setMorningStart(time);
                      else if (editingTimeIndex === 2) setMorningEnd(time);
                      else if (editingTimeIndex === 3) setEveningStart(time);
                      else if (editingTimeIndex === 4) setEveningEnd(time);

                      setTimeDropdownVisible(false);
                      setSettingsMessage('');
                      setSettingsError('');
                    }}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.dropdownItemText,
                        isSelected && styles.dropdownItemTextSelected,
                      ]}
                    >
                      {time}
                    </Text>
                    {isSelected && (
                      <Ionicons name="checkmark" size={20} color="#2563EB" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      ) : null}

      {activeModal === 'Notification' ? (
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Check-In Times</Text>
                <Text style={styles.modalSubtitle}>Manage {seniorName}'s daily reminders</Text>
              </View>
              <TouchableOpacity style={styles.closeButton} onPress={() => setActiveModal(null)}>
                <Ionicons name="close" size={24} color="#111827" />
              </TouchableOpacity>
            </View>

            <View style={styles.noticeBox}>
              <Ionicons name="notifications-outline" size={22} color="#2563EB" />
              <Text style={styles.noticeText}>
                {seniorName} checks in twice a day. Set a large window for each check-in to give them plenty of flexibility.
              </Text>
            </View>

            <Text style={styles.inputLabel}>Morning Check-In Window</Text>
            <View style={styles.rangeContainer}>
              <Text style={styles.rangeText}>from</Text>
              <TouchableOpacity
                style={styles.rangeSelectBox}
                onPress={() => { setEditingTimeIndex(1); setTimeDropdownVisible(true); }}
                activeOpacity={0.8}
              >
                <Text style={styles.selectBoxText}>{morningStart}</Text>
              </TouchableOpacity>
              <Text style={styles.rangeText}>to</Text>
              <TouchableOpacity
                style={styles.rangeSelectBox}
                onPress={() => { setEditingTimeIndex(2); setTimeDropdownVisible(true); }}
                activeOpacity={0.8}
              >
                <Text style={styles.selectBoxText}>{morningEnd}</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.inputLabel, { marginTop: 12 }]}>Evening Check-In Window</Text>
            <View style={styles.rangeContainer}>
              <Text style={styles.rangeText}>from</Text>
              <TouchableOpacity
                style={styles.rangeSelectBox}
                onPress={() => { setEditingTimeIndex(3); setTimeDropdownVisible(true); }}
                activeOpacity={0.8}
              >
                <Text style={styles.selectBoxText}>{eveningStart}</Text>
              </TouchableOpacity>
              <Text style={styles.rangeText}>to</Text>
              <TouchableOpacity
                style={styles.rangeSelectBox}
                onPress={() => { setEditingTimeIndex(4); setTimeDropdownVisible(true); }}
                activeOpacity={0.8}
              >
                <Text style={styles.selectBoxText}>{eveningEnd}</Text>
              </TouchableOpacity>
            </View>

            {settingsError ? <Text style={styles.errorText}>{settingsError}</Text> : null}
            {settingsMessage ? <Text style={styles.savedText}>{settingsMessage}</Text> : null}

            <TouchableOpacity
              style={[styles.primaryButton, timeSaving && { opacity: 0.6 }]}
              onPress={saveCheckInTime}
              activeOpacity={0.86}
              disabled={timeSaving}
            >
              <Text style={styles.primaryButtonText}>{timeSaving ? 'Saving…' : 'Save Check-In Times'}</Text>
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
  // Rule 3 — caregiver "Remove Senior" row inside the edit menu.
  // Mirrors the red logout-row styling so caregivers immediately
  // recognise these destructive actions are different from the
  // benign Settings rows above.
  unlinkRow: {
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
  unlinkIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  unlinkText: { flex: 1, color: '#B91C1C', fontSize: 16, fontWeight: '900' },
  unlinkConfirmIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 20,
    backgroundColor: 'rgba(17, 24, 39, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 22,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
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
  rangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  rangeText: { color: '#6B7280', fontSize: 14, fontWeight: '600', marginHorizontal: 4 },
  rangeSelectBox: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
  },
  selectBoxText: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '700',
  },
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
  confirmCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 22,
    alignItems: 'center',
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
  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.55)',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  dropdownBackdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  dropdownModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    maxHeight: '80%',
  },
  dropdownTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 12,
  },
  dropdownList: {
    // optional list styles
  },
  dropdownItem: {
    paddingVertical: 14,
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
});
