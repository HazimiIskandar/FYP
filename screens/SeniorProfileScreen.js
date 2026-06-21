import React, { useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import SeniorBottomNav from '../components/SeniorBottomNav';

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

export default function SeniorProfileScreen({
  senior = {},
  onHome,
  onCommunity,
  onSettings,
}) {
  const initialDetails = useMemo(() => ({
    fullName: getSeniorName(senior),
    dob: formatDate(senior?.dob),
    gender: senior?.gender || '',
    address: senior?.address || '',
    postalCode: senior?.postal_code || '',
    unitNumber: senior?.unit_number || senior?.unit_no || '',
    phone: senior?.phone_number || senior?.contact || '',
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
  const [confirmVisible, setConfirmVisible] = useState(false);

  const updateDetail = (key, value) => {
    setDetails((current) => ({ ...current, [key]: value }));
    setSavedMessage('');
  };

  const handleSave = () => {
    setConfirmVisible(true);
  };

  const confirmSave = () => {
    setConfirmVisible(false);
    setSavedMessage('Profile details saved on this device.');
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
        onSettings={onSettings}
      />

      {confirmVisible ? (
        <View style={styles.modalOverlay}>
          <View style={styles.confirmCard}>
            <View style={styles.confirmIcon}>
              <Ionicons name="help-circle" size={34} color="#2563EB" />
            </View>
            <Text style={styles.confirmTitle}>Save profile?</Text>
            <Text style={styles.confirmMessage}>
              Do you want to save these profile changes?
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
  savedText: {
    color: '#15803D',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 10,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 20,
  },
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
