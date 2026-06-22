import React, { useEffect, useMemo, useState } from 'react';
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

const CONDITION_OTHER = 'Others';

const GENDERS = ['Male', 'Female'];
const RELATIONSHIPS = ['Son', 'Daughter', 'Spouse', 'Sibling', 'Friend', 'Neighbor', CONDITION_OTHER];
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
const YEARS = Array.from({ length: new Date().getFullYear() - 1900 + 1 }, (_, i) => String(new Date().getFullYear() - i));

const parseDateParts = (value) => {
  if (!value) return { day: '', month: '', year: '' };

  const dbMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dbMatch) {
    return { day: dbMatch[3], month: dbMatch[2], year: dbMatch[1] };
  }

  const dbSlashMatch = value.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
  if (dbSlashMatch) {
    return { day: dbSlashMatch[3], month: dbSlashMatch[2], year: dbSlashMatch[1] };
  }

  const displayMatch = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (displayMatch) {
    return { day: displayMatch[1], month: displayMatch[2], year: displayMatch[3] };
  }

  return { day: '', month: '', year: '' };
};

const buildDateValue = (day, month, year) => {
  if (!day || !month || !year) return '';
  return `${day}/${month.padStart(2, '0')}/${year}`;
};

const formatDateForDB = (value) => {
  if (!value) return null;
  const dbMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dbMatch) return value;

  const parts = value.split('/');
  if (parts.length !== 3) return null;
  const [day, month, year] = parts;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
};

export default function SeniorEditProfileScreen({
  senior = {},
  apiBase,
  onHome,
  onCommunity,
  onSettings,
  onBack,
  onRefresh,
  onProfile,
}) {
  const seniorCondition = senior?.medicalConditions?.[0] || {};
  const initialRelationship = senior?.nokContacts?.[0]?.relationship_to_senior || '';
  const isRelationshipStandard = RELATIONSHIPS.includes(initialRelationship);
  const initialDetails = useMemo(() => {
    const dobParts = parseDateParts(formatDate(senior?.dob));
    const diagnosedParts = parseDateParts(formatDate(seniorCondition?.diagnosed_date));

    return {
      fullName: getSeniorName(senior),
      dob: buildDateValue(dobParts.day, dobParts.month, dobParts.year),
      dobDate: buildDateValue(dobParts.day, dobParts.month, dobParts.year),
      dobDay: dobParts.day,
      dobMonth: dobParts.month,
      dobYear: dobParts.year,
      gender: senior?.gender || '',
      address: senior?.address || '',
      postalCode: senior?.postal_code || '',
      unitNumber: senior?.unit_number || senior?.unit_no || '',
      phone: senior?.phone_number || senior?.contact || '',
      condition: seniorCondition?.condition_name || '',
      conditionId: seniorCondition?.condition_id || null,
      customCondition: '',
      severity: seniorCondition?.severity_level || '',
      medicationRequired: seniorCondition?.medication_required || '',
      diagnosedDate: buildDateValue(diagnosedParts.day, diagnosedParts.month, diagnosedParts.year),
      diagnosedDay: diagnosedParts.day,
      diagnosedMonth: diagnosedParts.month,
      diagnosedYear: diagnosedParts.year,
      emergencyName: senior?.nokContacts?.[0]?.full_name || '',
      emergencyRelationship: isRelationshipStandard ? initialRelationship : (initialRelationship ? CONDITION_OTHER : ''),
      emergencyRelationshipCustom: isRelationshipStandard ? '' : initialRelationship || '',
      emergencyPhone: senior?.nokContacts?.[0]?.phone_number || '',
      emergencyEmail: senior?.nokContacts?.[0]?.email || '',
      nokId: senior?.nokContacts?.[0]?.nok_id || null,
      userId: senior?.user_id || null,
      seniorId: senior?.senior_id || null,
    };
  }, [senior]);

  const [details, setDetails] = useState(initialDetails);
  const [savedMessage, setSavedMessage] = useState('');
  const [saveError, setSaveError] = useState('');
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [dropdownState, setDropdownState] = useState({ visible: false, title: '', key: '', options: [] });
  const [datePicker, setDatePicker] = useState({ visible: false, type: '', day: '', month: '', year: '' });
  const [medicalConditionsList, setMedicalConditionsList] = useState([]);
  const [loadingConditions, setLoadingConditions] = useState(false);
  const [conditionLoadError, setConditionLoadError] = useState('');

  useEffect(() => {
    setDetails(initialDetails);
  }, [initialDetails]);

  useEffect(() => {
    if (!apiBase) return;
    setLoadingConditions(true);
    setConditionLoadError('');

    fetch(`${apiBase}/medical`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load medical conditions (${response.status})`);
        }
        return response.json();
      })
      .then((data) => {
        const conditions = Array.isArray(data) ? data : [];
        setMedicalConditionsList(conditions);
      })
      .catch((err) => {
        console.log('Failed to load medical conditions:', err);
        setConditionLoadError(err.message);
      })
      .finally(() => setLoadingConditions(false));
  }, [apiBase]);

  useEffect(() => {
    if (!medicalConditionsList.length || !details.condition) return;

    const selectedCondition = medicalConditionsList.find(
      (item) => item.condition_name === details.condition
    );

    if (selectedCondition && !details.conditionId) {
      setDetails((current) => ({
        ...current,
        conditionId: selectedCondition.condition_id,
        severity: current.severity || selectedCondition.severity_level || '',
        medicationRequired: current.medicationRequired || selectedCondition.medication_required || '',
      }));
      return;
    }

    if (
      details.condition &&
      details.condition !== CONDITION_OTHER &&
      !selectedCondition &&
      !details.customCondition
    ) {
      setDetails((current) => ({
        ...current,
        condition: CONDITION_OTHER,
        customCondition: current.condition,
      }));
    }
  }, [medicalConditionsList, details.condition, details.conditionId, details.customCondition]);

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
      const nextDetails = { condition: value };

      if (value === CONDITION_OTHER) {
        nextDetails.conditionId = null;
        nextDetails.customCondition = '';
        nextDetails.severity = '';
        nextDetails.medicationRequired = '';
      } else {
        const item = medicalConditionsList.find(
          (option) => option.condition_name === value
        );
        nextDetails.conditionId = item?.condition_id || null;
        if (item) {
          nextDetails.severity = item.severity_level || '';
          nextDetails.medicationRequired = item.medication_required || '';
        }
      }

      setDetails((current) => ({ ...current, ...nextDetails }));
    } else if (dropdownState.key === 'emergencyRelationship') {
      const nextDetails = { emergencyRelationship: value };
      if (value === CONDITION_OTHER) {
        nextDetails.emergencyRelationshipCustom = '';
      }
      setDetails((current) => ({ ...current, ...nextDetails }));
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

  const refreshSavedProfile = async (overrideSeniorId = null) => {
    const seniorId = overrideSeniorId || details.seniorId;
    if (!apiBase || !seniorId) return;

    try {
      const [profileResponse, conditionsResponse, nokResponse] = await Promise.all([
        fetch(`${apiBase}/seniors/${seniorId}`),
        fetch(`${apiBase}/seniors/${seniorId}/medical-conditions`),
        fetch(`${apiBase}/seniors/${seniorId}/nok`),
      ]);

      if (!profileResponse.ok) {
        throw new Error(`Failed to refresh profile (${profileResponse.status})`);
      }
      if (!conditionsResponse.ok) {
        throw new Error(`Failed to refresh medical conditions (${conditionsResponse.status})`);
      }
      if (!nokResponse.ok) {
        throw new Error(`Failed to refresh emergency contact (${nokResponse.status})`);
      }

      const profileData = await profileResponse.json();
      const conditionsData = await conditionsResponse.json();
      const nokData = await nokResponse.json();
      const savedCondition = Array.isArray(conditionsData) ? conditionsData[0] : conditionsData;
      const diagnosedParts = parseDateParts(formatDate(savedCondition?.diagnosed_date));
      const relationship = nokData?.[0]?.relationship_to_senior || '';
      const isRelationshipStandard = RELATIONSHIPS.includes(relationship);
      const conditionMatchesList = medicalConditionsList.some(
        (item) => item.condition_id === savedCondition?.condition_id
      );

      setDetails((current) => ({
        ...current,
        fullName: getSeniorName(profileData),
        dob: buildDateValue(
          parseDateParts(formatDate(profileData?.dob)).day,
          parseDateParts(formatDate(profileData?.dob)).month,
          parseDateParts(formatDate(profileData?.dob)).year,
        ),
        dobDate: buildDateValue(
          parseDateParts(formatDate(profileData?.dob)).day,
          parseDateParts(formatDate(profileData?.dob)).month,
          parseDateParts(formatDate(profileData?.dob)).year,
        ),
        dobDay: parseDateParts(formatDate(profileData?.dob)).day,
        dobMonth: parseDateParts(formatDate(profileData?.dob)).month,
        dobYear: parseDateParts(formatDate(profileData?.dob)).year,
        gender: profileData?.gender || '',
        address: profileData?.address || '',
        postalCode: profileData?.postal_code || '',
        unitNumber: profileData?.unit_number || profileData?.unit_no || '',
        phone: profileData?.phone_number || profileData?.contact || '',
        condition: savedCondition
          ? conditionMatchesList
            ? savedCondition.condition_name
            : CONDITION_OTHER
          : current.condition,
        conditionId: savedCondition?.condition_id || current.conditionId,
        customCondition:
          savedCondition && !conditionMatchesList
            ? savedCondition.condition_name || current.customCondition
            : current.customCondition,
        severity: savedCondition?.severity_level || current.severity,
        medicationRequired: savedCondition?.medication_required || current.medicationRequired,
        diagnosedDate: buildDateValue(diagnosedParts.day, diagnosedParts.month, diagnosedParts.year),
        diagnosedDay: diagnosedParts.day,
        diagnosedMonth: diagnosedParts.month,
        diagnosedYear: diagnosedParts.year,
        emergencyName: nokData?.[0]?.full_name || current.emergencyName,
        emergencyRelationship: isRelationshipStandard
          ? relationship
          : relationship
          ? CONDITION_OTHER
          : current.emergencyRelationship,
        emergencyRelationshipCustom: isRelationshipStandard
          ? ''
          : relationship || current.emergencyRelationshipCustom,
        emergencyPhone: nokData?.[0]?.phone_number || current.emergencyPhone,
        emergencyEmail: nokData?.[0]?.email || current.emergencyEmail,
        nokId: nokData?.[0]?.nok_id || current.nokId,
      }));
    } catch (err) {
      console.log('Failed to refresh profile:', err);
    }
  };

  const confirmDateSelection = () => {
    const { type, day, month, year } = datePicker;
    const formatted = buildDateValue(day, month, year);
    updateDetail(`${type}Date`, formatted);
    if (type === 'dob') {
      updateDetail('dob', formatted);
    }
    updateDetail(`${type}Day`, day);
    updateDetail(`${type}Month`, month);
    updateDetail(`${type}Year`, year);
    setDatePicker((current) => ({ ...current, visible: false }));
  };

  const handleSave = () => {
    setConfirmVisible(true);
  };

  const confirmSave = async () => {
    setConfirmVisible(false);
    setSavedMessage('');
    setSaveError('');

    if (!apiBase) {
      setSaveError('Backend not configured.');
      return;
    }

    try {
      const userPayload = {
        full_name: details.fullName,
        phone_number: details.phone,
        gender: details.gender,
        address: details.address,
        postal_code: details.postalCode,
        unit_number: details.unitNumber,
      };

      const dob = formatDateForDB(details.dob || details.dobDate);
      if (dob) {
        userPayload.dob = dob;
      }

      const filteredUserPayload = Object.fromEntries(
        Object.entries(userPayload).filter(
          ([, value]) => value !== undefined && value !== null && value !== ''
        )
      );

      if (details.userId) {
        const response = await fetch(`${apiBase}/users/${details.userId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(filteredUserPayload),
        });

        const result = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(result?.error || result?.message || 'Failed to update user profile');
        }
      }

      const emergencyRelationship =
        details.emergencyRelationship === CONDITION_OTHER
          ? details.emergencyRelationshipCustom
          : details.emergencyRelationship;

      const nokPayload = {
        full_name: details.emergencyName,
        relationship_to_senior: emergencyRelationship,
        phone_number: details.emergencyPhone,
        email: details.emergencyEmail,
      };

      let seniorId = details.seniorId;
      if (!seniorId && details.userId) {
        const createSeniorResponse = await fetch(`${apiBase}/seniors`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: details.userId }),
        });

        const createSeniorResult = await createSeniorResponse.json().catch(() => null);
        if (!createSeniorResponse.ok) {
          throw new Error(createSeniorResult?.error || createSeniorResult?.message || 'Failed to create senior record');
        }

        seniorId = createSeniorResult?.senior_id;
        if (!seniorId) {
          throw new Error('Senior record was not created successfully.');
        }

        updateDetail('seniorId', seniorId);
      }

      if (details.nokId) {
        const response = await fetch(
          `${apiBase}/nok/${details.nokId}`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(nokPayload),
          }
        );

        const text = await response.text();
        let result;
        try {
          result = JSON.parse(text);
        } catch (parseErr) {
          result = { error: text };
        }

        if (!response.ok) {
          throw new Error(
            result?.error ||
            'Failed to update emergency contact'
          );
        }
      }
      else if (seniorId) {
        const response = await fetch(
          `${apiBase}/seniors/${seniorId}/nok`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(nokPayload),
          }
        );

        const text = await response.text();
        let result;
        try {
          result = JSON.parse(text);
        } catch (parseErr) {
          result = { error: text };
        }

        if (!response.ok) {
          throw new Error(
            result?.error ||
            'Failed to create emergency contact'
          );
        }

        updateDetail('nokId', result.nok_id);
      }

      if (seniorId) {
        const conditionPayload = {
          condition_id: details.conditionId,
          customCondition: details.condition === CONDITION_OTHER ? details.customCondition : undefined,
          diagnosed_date: formatDateForDB(details.diagnosedDate),
          severity_level: details.severity,
          medication_required: details.medicationRequired,
        };

        const filteredConditionPayload = Object.fromEntries(
          Object.entries(conditionPayload).filter(
            ([, value]) => value !== undefined && value !== null && value !== ''
          )
        );

        if (filteredConditionPayload.condition_id || filteredConditionPayload.customCondition) {
          const conditionResponse = await fetch(`${apiBase}/seniors/${seniorId}/medical-condition`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(filteredConditionPayload),
          });

          const conditionResult = await conditionResponse.json().catch(() => null);
          if (!conditionResponse.ok) {
            throw new Error(conditionResult?.error || conditionResult?.message || 'Failed to save medical condition');
          }
        }
      }

      if (seniorId) {
        await refreshSavedProfile(seniorId);
      }

      // let parent refresh global data (users/seniors) so other screens see updates
      if (typeof onRefresh === 'function') {
        try {
          await onRefresh();
        } catch (err) {
          console.log('onRefresh error:', err);
        }
      }

      setSavedMessage('Profile details saved.');
      if (typeof onProfile === 'function') {
        onProfile();
      } else if (typeof onBack === 'function') {
        onBack();
      }
    } catch (err) {
      console.log('Save profile error:', err);
      setSaveError(err?.message || 'Save failed.');
    }
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
      <Header 
        title="Edit Profile" 
        rightContent={(
          <TouchableOpacity onPress={onBack} style={{ padding: 8 }}>
            <Text style={{ color: '#2563EB', fontSize: 16, fontWeight: 'bold' }}>Back</Text>
          </TouchableOpacity>
        )}
      />

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
          {renderSelect(
            'fitness-outline',
            'Condition',
            'condition',
            loadingConditions ? 'Loading conditions...' : 'Select condition',
            [...medicalConditionsList.map((condition) => condition.condition_name), CONDITION_OTHER]
          )}
          {(details.condition === CONDITION_OTHER || details.customCondition) ? (
            renderInput('warning-outline', 'Condition (Others)', 'customCondition', 'Enter condition name')
          ) : null}
          {renderSelect('warning-outline', 'Severity', 'severity', 'Select severity', SEVERITY_OPTIONS)}
          {renderSelect('medical-outline', 'Medication Required', 'medicationRequired', 'Select option', MEDICATION_OPTIONS)}
          {renderDateField('calendar-outline', 'Diagnosed', 'diagnosed', 'DD/MM/YYYY')}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Emergency Contact</Text>
          {renderInput('person-outline', 'Name', 'emergencyName', 'Enter contact name')}
          {renderSelect('people-outline', 'Relationship', 'emergencyRelationship', 'Select relationship', RELATIONSHIPS)}
          {(details.emergencyRelationship === CONDITION_OTHER || details.emergencyRelationshipCustom) ? (
            renderInput('person-outline', 'Relationship (Others)', 'emergencyRelationshipCustom', 'Enter relationship')
          ) : null}
          {renderInput('call-outline', 'Phone', 'emergencyPhone', 'Enter phone number', 'phone-pad')}
          {renderInput('mail-outline', 'Email', 'emergencyEmail', 'Enter email address', 'email-address')}
        </View>

        {savedMessage ? <Text style={styles.savedText}>{savedMessage}</Text> : null}
        {saveError ? <Text style={styles.errorText}>{saveError}</Text> : null}
        {conditionLoadError ? <Text style={styles.errorText}>{conditionLoadError}</Text> : null}

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
        activeTab="Settings"
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