import React, { useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, Modal, Pressable } from 'react-native';
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

const CONDITIONS = [
  { id: 1, name: 'Arthritis', severity: 'Moderate' },
  { id: 2, name: 'Heart Disease', severity: 'High' },
  { id: 3, name: 'Cancer', severity: 'High' },
  { id: 4, name: 'Respiratory Diseases', severity: 'Moderate' },
  { id: 5, name: 'Alzheimer’s Disease', severity: 'High' },
  { id: 6, name: 'Osteoporosis', severity: 'Moderate' },
  { id: 7, name: 'Diabetes', severity: 'Moderate' },
  { id: 8, name: 'Dementia', severity: 'High' },
  { id: 9, name: 'Obesity', severity: 'Moderate' },
  { id: 10, name: 'Depression', severity: 'Moderate' },
];

const GENDERS = ['Male', 'Female'];
const RELATIONSHIPS = ['Son', 'Daughter', 'Spouse', 'Sibling', 'Friend', 'Neighbor', 'Other'];
const SEVERITY_OPTIONS = ['Low', 'Moderate', 'High'];
const MEDICATION_OPTIONS = ['Yes', 'No'];
const MONTHS = [
  { label: '01', value: '01' },
  { label: '02', value: '02' },
  { label: '03', value: '03' },
  { label: '04', value: '04' },
  { label: '05', value: '05' },
  { label: '06', value: '06' },
  { label: '07', value: '07' },
  { label: '08', value: '08' },
  { label: '09', value: '09' },
  { label: '10', value: '10' },
  { label: '11', value: '11' },
  { label: '12', value: '12' },
];
const DAYS = Array.from({ length: 31 }, (_, i) => ({ label: String(i + 1).padStart(2, '0'), value: String(i + 1).padStart(2, '0') }));
const YEARS = Array.from({ length: 70 }, (_, i) => String(new Date().getFullYear() - i));

const parseDateParts = (value) => {
  if (!value) return { day: '', month: '', year: '' };
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return { day: '', month: '', year: '' };
  return { day: match[1], month: match[2], year: match[3] };
};

const buildDateValue = (day, month, year) => {
  if (!day || !month || !year) return '';
  return `${day}/${month}/${year}`;
};

export default function SeniorProfileScreen({
  senior = {},
  onHome,
  onCommunity,
  onSettings,
}) {
  const initialDetails = useMemo(() => {
    const existingCondition = CONDITIONS.find(
      (item) => item.name === senior?.medicalConditions?.[0]?.condition_name
    );
    const dobParts = parseDateParts(formatDate(senior?.dob));
    const diagnosedParts = parseDateParts(
      formatDate(senior?.medicalConditions?.[0]?.diagnosed_date)
    );

    return {
      fullName: getSeniorName(senior),
      dob: buildDateValue(dobParts.day, dobParts.month, dobParts.year),
      dobDay: dobParts.day,
      dobMonth: dobParts.month,
      dobYear: dobParts.year,
      gender: senior?.gender || '',
      address: senior?.address || '',
      postalCode: senior?.postal_code || '',
      unitNumber: senior?.unit_number || senior?.unit_no || '',
      phone: senior?.phone_number || senior?.contact || '',
      condition: existingCondition?.name || senior?.medicalConditions?.[0]?.condition_name || '',
      severity: existingCondition?.severity || senior?.medicalConditions?.[0]?.severity_level || '',
      medicationRequired: senior?.medicalConditions?.[0]?.medication_required || '',
      diagnosedDate: buildDateValue(diagnosedParts.day, diagnosedParts.month, diagnosedParts.year),
      diagnosedDay: diagnosedParts.day,
      diagnosedMonth: diagnosedParts.month,
      diagnosedYear: diagnosedParts.year,
      emergencyName: senior?.nokContacts?.[0]?.full_name || '',
      emergencyRelationship: senior?.nokContacts?.[0]?.relationship_to_senior || '',
      emergencyPhone: senior?.nokContacts?.[0]?.phone_number || '',
      emergencyEmail: senior?.nokContacts?.[0]?.email || '',
    };
  }, [senior]);

  const [details, setDetails] = useState(initialDetails);
  const [savedMessage, setSavedMessage] = useState('');
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [dropdownState, setDropdownState] = useState({ visible: false, title: '', key: '', options: [] });
  const [datePicker, setDatePicker] = useState({ visible: false, type: '', day: '', month: '', year: '' });

  const openDropdown = (key, title, options) => {
    setDropdownState({ visible: true, title, key, options });
  };

  const closeDropdown = () => {
    setDropdownState({ visible: false, title: '', key: '', options: [] });
  };

  const updateDetail = (key, value) => {
    setDetails((current) => ({ ...current, [key]: value }));
    setSavedMessage('');
  };

  const selectDropdownValue = (value) => {
    if (dropdownState.key === 'condition') {
      const item = CONDITIONS.find((option) => option.name === value);
      updateDetail('condition', value);
      if (item) {
        updateDetail('severity', item.severity);
      }
    } else {
      updateDetail(dropdownState.key, value);
    }
    closeDropdown();
  };

  const openDatePicker = (type) => {
    setDatePicker({
      visible: true,
      type,
      day: details[`${type}Day`] || '',
      month: details[`${type}Month`] || '',
      year: details[`${type}Year`] || '',
    });
  };

  const updateDatePickerValue = (key, value) => {
    setDatePicker((current) => ({ ...current, [key]: value }));
  };

  const confirmDateSelection = () => {
    const { type, day, month, year } = datePicker;
    const formatted = buildDateValue(day, month, year);
    updateDetail(`${type}Date`, formatted);
    updateDetail(`${type}Day`, day);
    updateDetail(`${type}Month`, month);
    updateDetail(`${type}Year`, year);
    setDatePicker((current) => ({ ...current, visible: false }));
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

  const renderSelect = (icon, label, key, placeholder, options) => (
    <TouchableOpacity
      style={styles.inputRow}
      onPress={() => openDropdown(key, label, options)}
      activeOpacity={0.86}
    >
      <Ionicons name={icon} size={19} color="#6B7280" />
      <View style={styles.inputCopy}>
        <Text style={styles.inputLabel}>{label}</Text>
        <View style={styles.selectInput}>
          <Text style={styles.selectValue}>
            {details[key] || placeholder}
          </Text>
          <Ionicons name="chevron-down-outline" size={18} color="#6B7280" />
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderDateField = (icon, label, type, placeholder) => (
    <TouchableOpacity
      style={styles.inputRow}
      onPress={() => openDatePicker(type)}
      activeOpacity={0.86}
    >
      <Ionicons name={icon} size={19} color="#6B7280" />
      <View style={styles.inputCopy}>
        <Text style={styles.inputLabel}>{label}</Text>
        <View style={styles.selectInput}>
          <Text style={styles.selectValue}>
            {details[`${type}Date`] || placeholder}
          </Text>
          <Ionicons name="chevron-down-outline" size={18} color="#6B7280" />
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Senior Profile" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Personal Details</Text>
          {renderInput('person-outline', 'Full Name', 'fullName', 'Enter full name')}
          {renderDateField('calendar-outline', 'Date of Birth', 'dob', 'DD/MM/YYYY')}
          {renderSelect('male-female-outline', 'Gender', 'gender', 'Select gender', GENDERS)}
          {renderInput('home-outline', 'Address', 'address', 'Enter address')}
          {renderInput('mail-outline', 'Postal Code', 'postalCode', 'Enter postal code', 'number-pad')}
          {renderInput('business-outline', 'Unit Number', 'unitNumber', 'Enter unit number')}
          {renderInput('call-outline', 'Phone', 'phone', 'Enter phone number', 'phone-pad')}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Medical Conditions</Text>
          {renderSelect('fitness-outline', 'Condition', 'condition', 'Select condition', CONDITIONS.map((condition) => condition.name))}
          {renderSelect('warning-outline', 'Severity', 'severity', 'Select severity', SEVERITY_OPTIONS)}
          {renderSelect('medical-outline', 'Medication Required', 'medicationRequired', 'Select option', MEDICATION_OPTIONS)}
          {renderDateField('calendar-outline', 'Diagnosed', 'diagnosed', 'DD/MM/YYYY')}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Emergency Contact</Text>
          {renderInput('person-outline', 'Name', 'emergencyName', 'Enter contact name')}
          {renderSelect('people-outline', 'Relationship', 'emergencyRelationship', 'Select relationship', RELATIONSHIPS)}
          {renderInput('call-outline', 'Phone', 'emergencyPhone', 'Enter phone number', 'phone-pad')}
          {renderInput('mail-outline', 'Email', 'emergencyEmail', 'Enter email address', 'email-address')}
        </View>

        {savedMessage ? <Text style={styles.savedText}>{savedMessage}</Text> : null}

        <TouchableOpacity style={styles.saveButton} onPress={handleSave} activeOpacity={0.86}>
          <Ionicons name="save-outline" size={22} color="#FFFFFF" />
          <Text style={styles.saveButtonText}>Save Profile</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={dropdownState.visible} transparent animationType="fade">
        <View style={styles.modalContainer}>
          <Pressable style={styles.modalBackdrop} onPress={closeDropdown} />
          <View style={styles.dropdownModal}>
            <Text style={styles.modalTitle}>{dropdownState.title}</Text>
            <ScrollView style={styles.dropdownList}>
              {dropdownState.options.map((option) => (
                <TouchableOpacity
                  key={option}
                  style={styles.dropdownItem}
                  onPress={() => selectDropdownValue(option)}
                  activeOpacity={0.86}
                >
                  <Text style={styles.dropdownLabel}>{option}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={datePicker.visible} transparent animationType="fade">
        <View style={styles.modalContainer}>
          <Pressable style={styles.modalBackdrop} onPress={() => setDatePicker((current) => ({ ...current, visible: false }))} />
          <View style={styles.dropdownModal}>
            <Text style={styles.modalTitle}>Select {datePicker.type === 'dob' ? 'Date of Birth' : 'Diagnosed Date'}</Text>
            <View style={styles.datePickerRow}>
              <View style={styles.datePickerColumn}>
                <Text style={styles.datePickerLabel}>Day</Text>
                <ScrollView style={styles.datePickerList}>
                  {DAYS.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[styles.datePickerItem, datePicker.day === option.value && styles.datePickerItemActive]}
                      onPress={() => updateDatePickerValue('day', option.value)}
                      activeOpacity={0.86}
                    >
                      <Text style={styles.datePickerText}>{option.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              <View style={styles.datePickerColumn}>
                <Text style={styles.datePickerLabel}>Month</Text>
                <ScrollView style={styles.datePickerList}>
                  {MONTHS.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[styles.datePickerItem, datePicker.month === option.value && styles.datePickerItemActive]}
                      onPress={() => updateDatePickerValue('month', option.value)}
                      activeOpacity={0.86}
                    >
                      <Text style={styles.datePickerText}>{option.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              <View style={styles.datePickerColumn}>
                <Text style={styles.datePickerLabel}>Year</Text>
                <ScrollView style={styles.datePickerList}>
                  {YEARS.map((value) => (
                    <TouchableOpacity
                      key={value}
                      style={[styles.datePickerItem, datePicker.year === value && styles.datePickerItemActive]}
                      onPress={() => updateDatePickerValue('year', value)}
                      activeOpacity={0.86}
                    >
                      <Text style={styles.datePickerText}>{value}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
            <TouchableOpacity style={styles.dropdownActionButton} onPress={confirmDateSelection} activeOpacity={0.86}>
              <Text style={styles.dropdownActionText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(17, 24, 39, 0.55)',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownModal: {
    width: '85%', //
    maxWidth: 320, //
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 14, //
    maxHeight: '50%', //
    elevation: 6,
  },
  modalTitle: {
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
  },
  dropdownLabel: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '700',
  },
  datePickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  datePickerColumn: {
    flex: 1,
    marginRight: 8,
  },
  datePickerLabel: {
    color: '#374151',
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 8,
  },
  datePickerList: {
    maxHeight: 200,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
  },
  datePickerItem: {
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  datePickerItemActive: {
    backgroundColor: '#DBEAFE',
  },
  datePickerText: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '700',
  },
  dropdownActionButton: {
    backgroundColor: '#2563EB',
    borderRadius: 16,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownActionText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  selectInput: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectValue: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '700',
  },
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