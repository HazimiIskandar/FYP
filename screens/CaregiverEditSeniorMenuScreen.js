import React, { useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import CaregiverBottomNav from '../components/CaregiverBottomNav';
// import { scheduleCheckInReminders } from '../services/checkInNotifications'; // caregivers might not schedule local notifications on their own device for the senior, but we'll leave the API call.

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
  '12:00 PM', '12:30 PM',
  '1:00 PM', '1:30 PM',
  '2:00 PM', '2:30 PM',
  '3:00 PM', '3:30 PM',
  '4:00 PM', '4:30 PM',
  '5:00 PM', '5:30 PM',
  '6:00 PM', '6:30 PM',
  '7:00 PM', '7:30 PM',
  '8:00 PM', '8:30 PM',
  '9:00 PM', '9:30 PM',
  '10:00 PM', '10:30 PM',
  '11:00 PM', '11:30 PM',
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
  onLogout,
  onRefresh,
}) {
  const seniorName = getSeniorName(senior);
  const getInitialTimes = (seniorData) => {
    const raw = seniorData?.preferred_checkin_time || seniorData?.check_in_time || '9:00 AM, 7:00 PM';
    const parts = String(raw).split(',').map(s => s.trim());
    return {
      t1: formatCheckInTime(parts[0] || '9:00 AM'),
      t2: formatCheckInTime(parts[1] || '7:00 PM'),
    };
  };

  const initialTimes = useMemo(() => getInitialTimes(senior), [senior]);
  const [activeModal, setActiveModal] = useState(null);
  const [checkInTime, setCheckInTime] = useState(initialTimes.t1);
  const [checkInTime2, setCheckInTime2] = useState(initialTimes.t2);
  const [timeDropdownVisible, setTimeDropdownVisible] = useState(false);
  const [editingTimeIndex, setEditingTimeIndex] = useState(1);
  const [settingsMessage, setSettingsMessage] = useState('');
  const [settingsError, setSettingsError] = useState('');
  const [timeSaving, setTimeSaving] = useState(false);

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

  const checkTimeGap = (t1, t2) => {
    const v1 = getTimeValue(t1);
    const v2 = getTimeValue(t2);
    const gap = Math.abs(v1 - v2);
    
    if (gap >= 10 && gap <= 14) return true;
    if (gap > 14) return true; 
    
    return false;
  };

  const saveCheckInTime = async () => {
    if (!checkInTime || !checkInTime2) {
      setSettingsError('Please select both check-in times.');
      setSettingsMessage('');
      return;
    }

    if (!checkTimeGap(checkInTime, checkInTime2)) {
      setSettingsError('Please ensure there is a minimum 10-hour gap between check-ins.');
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
      const combinedTimes = `${checkInTime}, ${checkInTime2}`;
      const response = await fetch(`${apiBase}/seniors/${senior.senior_id}/checkin-time`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferred_checkin_time: combinedTimes }),
      });

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error || 'Failed to save check-in times.');
      }
      
      setSettingsMessage(`Check-in times saved: ${checkInTime} & ${checkInTime2}`);
      if (onRefresh) onRefresh();
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

      </ScrollView>

      <CaregiverBottomNav
        activeTab="Seniors"
        onHome={onGoToHome}
        onSeniors={onGoToSeniorsList}
        onStatus={onGoToStatus}
        onLogout={onLogout}
      />

      {timeDropdownVisible ? (
        <View style={[styles.modalOverlay, { zIndex: 30 }]}>
          <Pressable
            style={styles.dropdownBackdrop}
            onPress={() => setTimeDropdownVisible(false)}
          />
          <View style={styles.dropdownModal}>
            <Text style={styles.dropdownTitle}>Select Check-In Time</Text>
            <ScrollView style={styles.dropdownList}>
              {CHECKIN_TIMES.map((time) => {
                const isSelected = editingTimeIndex === 1 ? time === checkInTime : time === checkInTime2;
                return (
                  <TouchableOpacity
                    key={time}
                    style={styles.dropdownItem}
                    onPress={() => {
                      if (editingTimeIndex === 1) {
                        setCheckInTime(time);
                      } else {
                        setCheckInTime2(time);
                      }
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
                The system expects {seniorName} to check in at these two times.
              </Text>
            </View>

            <Text style={styles.inputLabel}>Morning Check-In Time</Text>
            <TouchableOpacity
              style={styles.selectBox}
              onPress={() => { setEditingTimeIndex(1); setTimeDropdownVisible(true); }}
              activeOpacity={0.8}
            >
              <Text style={styles.selectBoxText}>{checkInTime}</Text>
              <Ionicons name="chevron-down-outline" size={18} color="#6B7280" />
            </TouchableOpacity>

            <Text style={[styles.inputLabel, { marginTop: 16 }]}>Evening Check-In Time</Text>
            <TouchableOpacity
              style={styles.selectBox}
              onPress={() => { setEditingTimeIndex(2); setTimeDropdownVisible(true); }}
              activeOpacity={0.8}
            >
              <Text style={styles.selectBoxText}>{checkInTime2}</Text>
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
  selectBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 14,
  },
  selectBoxText: {
    color: '#111827',
    fontSize: 17,
    fontWeight: '800',
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
