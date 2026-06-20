import React, { useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import SeniorBottomNav from '../components/SeniorBottomNav';
<<<<<<< HEAD
import {
  isValidCheckInTime,
  scheduleCheckInReminders,
} from '../services/checkInNotifications';
=======
>>>>>>> b87e0623916809f1b1f00eea660c852baf58c56e

const getSeniorName = (senior) =>
  senior?.full_name ||
  senior?.name ||
  [senior?.first_name, senior?.last_name].filter(Boolean).join(' ') ||
  'Senior';

const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

<<<<<<< HEAD
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

=======
>>>>>>> b87e0623916809f1b1f00eea660c852baf58c56e
export default function SeniorProfileScreen({
  senior = {},
  onHome,
  onCommunity,
  onLogout,
}) {
  const initialDetails = useMemo(() => ({
    fullName: getSeniorName(senior),
    dob: formatDate(senior?.dob),
    gender: senior?.gender || '',
    address: senior?.address || '',
    postalCode: senior?.postal_code || '',
    unitNumber: senior?.unit_number || senior?.unit_no || '',
    phone: senior?.phone_number || senior?.contact || '',
<<<<<<< HEAD
    checkInTime: formatCheckInTime(senior?.preferred_checkin_time || senior?.check_in_time),
=======
>>>>>>> b87e0623916809f1b1f00eea660c852baf58c56e
    condition: senior?.medicalConditions?.[0]?.condition_name || '',
    severity: senior?.medicalConditions?.[0]?.severity_level || '',
    medicationRequired: senior?.medicalConditions?.[0]?.medication_required || '',
    diagnosedDate: formatDate(senior?.medicalConditions?.[0]?.diagnosed_date),
    emergencyName: senior?.nokContacts?.[0]?.full_name || '',
    emergencyRelationship: senior?.nokContacts?.[0]?.relationship_to_senior || '',
    emergencyPhone: senior?.nokContacts?.[0]?.phone_number || '',
    emergencyEmail: senior?.nokContacts?.[0]?.email || '',
  }), [senior]);

  const [details, setDetails] = useState(initialDetails);
  const [savedMessage, setSavedMessage] = useState('');
<<<<<<< HEAD
  const [errorMessage, setErrorMessage] = useState('');
=======
>>>>>>> b87e0623916809f1b1f00eea660c852baf58c56e
  const [confirmVisible, setConfirmVisible] = useState(false);

  const updateDetail = (key, value) => {
    setDetails((current) => ({ ...current, [key]: value }));
    setSavedMessage('');
<<<<<<< HEAD
    setErrorMessage('');
  };

  const handleSave = () => {
    if (!isValidCheckInTime(details.checkInTime)) {
      setErrorMessage('Please enter check-in time with AM or PM, for example 9:00 AM or 8:30 PM.');
      return;
    }

    setConfirmVisible(true);
  };

  const confirmSave = async () => {
    let notificationsScheduled = false;

    try {
      notificationsScheduled = await scheduleCheckInReminders(
        details.fullName || 'Senior',
        details.checkInTime
      );
    } catch (error) {
      console.log('Failed to schedule check-in reminders:', error);
    }

    setConfirmVisible(false);
    setSavedMessage(
      notificationsScheduled
        ? `Profile saved. Check-in reminders set for ${details.checkInTime}.`
        : 'Profile saved, but notification permission was not granted.'
    );
=======
  };

  const handleSave = () => {
    setConfirmVisible(true);
  };

  const confirmSave = () => {
    setConfirmVisible(false);
    setSavedMessage('Profile details saved on this device.');
>>>>>>> b87e0623916809f1b1f00eea660c852baf58c56e
  };

  const renderInput = (icon, label, key, placeholder, keyboardType = 'default') => (
    <View style={styles.inputRow}>
      <Ionicons name={icon} size={19} color="#6B7280" />
      <View style={styles.inputCopy}>
        <Text style={styles.inputLabel}>{label}</Text>
        <TextInput
          style={styles.input}
          value={details[key]}
          onChangeText={(value) => updateDetail(key, value)}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          keyboardType={keyboardType}
        />
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Senior Profile" subtitle="Care details & status overview" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{details.fullName.charAt(0).toUpperCase() || 'S'}</Text>
          </View>
          <View style={styles.profileCopy}>
            <Text style={styles.profileName}>{details.fullName || 'Senior'}</Text>
            <Text style={styles.profileMeta}>Update details for caregivers and AIC staff</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Personal Details</Text>
          {renderInput('person-outline', 'Full Name', 'fullName', 'Enter full name')}
          {renderInput('calendar-outline', 'Date-of-Birth', 'dob', 'DD/MM/YYYY')}
          {renderInput('male-female-outline', 'Gender', 'gender', 'Enter gender')}
          {renderInput('home-outline', 'Address', 'address', 'Enter address')}
          {renderInput('mail-outline', 'Postal Code', 'postalCode', 'Enter postal code', 'number-pad')}
          {renderInput('business-outline', 'Unit Number', 'unitNumber', 'Enter unit number')}
          {renderInput('call-outline', 'Phone', 'phone', 'Enter phone number', 'phone-pad')}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Medical Conditions</Text>
          {renderInput('fitness-outline', 'Condition', 'condition', 'Example: Dementia')}
          {renderInput('warning-outline', 'Severity', 'severity', 'Low / Medium / High')}
          {renderInput('medical-outline', 'Medication Required', 'medicationRequired', 'Yes / No')}
          {renderInput('calendar-outline', 'Diagnosed', 'diagnosedDate', 'DD/MM/YYYY')}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Emergency Contact</Text>
          {renderInput('person-outline', 'Name', 'emergencyName', 'Enter contact name')}
          {renderInput('people-outline', 'Relationship', 'emergencyRelationship', 'Example: Son')}
          {renderInput('call-outline', 'Phone', 'emergencyPhone', 'Enter phone number', 'phone-pad')}
          {renderInput('mail-outline', 'Email', 'emergencyEmail', 'Enter email address', 'email-address')}
        </View>

<<<<<<< HEAD
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Daily Check-In Time</Text>
          <View style={styles.noticeBox}>
            <Ionicons name="notifications-outline" size={22} color="#2563EB" />
            <Text style={styles.noticeText}>
              Choose the time you want to check in each day. The app will remind you 30 minutes and 15 minutes before.
            </Text>
          </View>
          {renderInput('time-outline', 'Preferred Check-In Time', 'checkInTime', 'Example: 9:00 AM')}
          <Text style={styles.helperText}>Use 12-hour format with AM or PM.</Text>
        </View>

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
=======
>>>>>>> b87e0623916809f1b1f00eea660c852baf58c56e
        {savedMessage ? <Text style={styles.savedText}>{savedMessage}</Text> : null}

        <TouchableOpacity style={styles.saveButton} onPress={handleSave} activeOpacity={0.86}>
          <Ionicons name="save-outline" size={22} color="#FFFFFF" />
          <Text style={styles.saveButtonText}>Save Profile</Text>
        </TouchableOpacity>
      </ScrollView>

      <SeniorBottomNav
        activeTab="Profile"
        onHome={onHome}
        onCommunity={onCommunity}
        onProfile={() => {}}
        onLogout={onLogout}
      />

      {confirmVisible ? (
        <View style={styles.modalOverlay}>
          <View style={styles.confirmCard}>
            <View style={styles.confirmIcon}>
              <Ionicons name="help-circle" size={34} color="#2563EB" />
            </View>
            <Text style={styles.confirmTitle}>Save profile?</Text>
            <Text style={styles.confirmMessage}>
<<<<<<< HEAD
              Save these changes and schedule reminders before your {details.checkInTime} check-in?
=======
              Do you want to save these profile changes?
>>>>>>> b87e0623916809f1b1f00eea660c852baf58c56e
            </Text>
            <TouchableOpacity style={styles.yesButton} onPress={confirmSave} activeOpacity={0.86}>
              <Text style={styles.yesButtonText}>Yes</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.noButton} onPress={() => setConfirmVisible(false)} activeOpacity={0.86}>
              <Text style={styles.noButtonText}>No</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scrollContent: { padding: 20, paddingBottom: 28 },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: { color: '#1D4ED8', fontSize: 22, fontWeight: '900' },
  profileCopy: { flex: 1 },
  profileName: { color: '#111827', fontSize: 22, fontWeight: '900' },
  profileMeta: { color: '#6B7280', fontSize: 13, fontWeight: '700', marginTop: 4 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#696969',
    padding: 16,
    marginBottom: 14,
  },
  cardTitle: { color: '#111827', fontSize: 19, fontWeight: '900', marginBottom: 12 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 13,
  },
  inputCopy: { flex: 1, marginLeft: 10 },
  inputLabel: { color: '#374151', fontSize: 13, fontWeight: '900', marginBottom: 5 },
  input: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    color: '#111827',
    fontSize: 15,
    fontWeight: '700',
  },
<<<<<<< HEAD
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
  helperText: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '700',
    marginTop: -4,
    lineHeight: 18,
  },
=======
>>>>>>> b87e0623916809f1b1f00eea660c852baf58c56e
  savedText: {
    color: '#15803D',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 10,
  },
<<<<<<< HEAD
  errorText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 20,
  },
=======
>>>>>>> b87e0623916809f1b1f00eea660c852baf58c56e
  saveButton: {
    minHeight: 62,
    borderRadius: 18,
    backgroundColor: '#2563EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveButtonText: { color: '#FFFFFF', fontSize: 19, fontWeight: '900' },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 20,
    backgroundColor: 'rgba(17, 24, 39, 0.55)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
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
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  confirmTitle: { color: '#111827', fontSize: 26, fontWeight: '900', textAlign: 'center' },
  confirmMessage: {
    color: '#4B5563',
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  yesButton: {
    backgroundColor: '#2563EB',
    width: '100%',
    minHeight: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  yesButtonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
  noButton: {
    backgroundColor: '#EFF6FF',
    width: '100%',
    minHeight: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noButtonText: { color: '#2563EB', fontSize: 17, fontWeight: '900' },
});
