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
  const [medicalDatePicker, setMedicalDatePicker] = useState({ visible: false, index: null, day: '', month: '', year: ''});
  const [loadingConditions, setLoadingConditions] = useState(false);
  const [conditionLoadError, setConditionLoadError] = useState('');

  useEffect(() => {
    setDetails(initialDetails);
  }, [initialDetails]);

  // Lists to support multiple entries
  const [emergencyList, setEmergencyList] = useState([]);
  const [medicalList, setMedicalList] = useState([]);

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

  // initialize lists from senior prop
  useEffect(() => {
    const initialNoks = Array.isArray(senior?.nokContacts) && senior.nokContacts.length
      ? senior.nokContacts.map((n) => ({
          nok_id: n.nok_id,
          full_name: n.full_name || '',
          relationship_to_senior: n.relationship_to_senior || '',
          phone_number: n.phone_number || '',
          email: n.email || '',
        }))
      : [{ full_name: '', relationship_to_senior: '', phone_number: '', email: '' }];

    const initialConditions = Array.isArray(senior?.medicalConditions) && senior.medicalConditions.length
      ? senior.medicalConditions.map((c) => ({
          condition_id: c.condition_id || null,
          condition_name: c.condition_name || '',
          customCondition: c.condition_name || '',
          severity_level: c.severity_level || '',
          medication_required: c.medication_required || '',
          diagnosed_date: c.diagnosed_date || '',
        }))
      : [];

    setEmergencyList(initialNoks);
    setMedicalList(initialConditions.length ? initialConditions : []);
  }, [senior]);

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
    // support keys targeting list items: e.g. medical:0:condition or emergency:1:relationship
    if (dropdownState.key && dropdownState.key.startsWith('medical:')) {
      const parts = dropdownState.key.split(':');
      const index = Number(parts[1]);
      const field = parts[2];

      setMedicalList((current) => {
        const next = [...current];
        if (!next[index]) next[index] = {};
        if (field === 'condition') {
          next[index].condition_name = value;
          // resolve condition id if available
          const item = medicalConditionsList.find((m) => m.condition_name === value);
          next[index].condition_id = item?.condition_id || null;
          if (item) {
            next[index].severity_level = next[index].severity_level || item.severity_level || '';
            next[index].medication_required = next[index].medication_required || item.medication_required || '';
          }
        } else if (field === 'severity') {
          next[index].severity_level = value;
        } else if (field === 'medication') {
          next[index].medication_required = value;
        }
        return next;
      });
      closeDropdown();
      return;
    }

    if (dropdownState.key && dropdownState.key.startsWith('emergency:')) {
      const parts = dropdownState.key.split(':');
      const index = Number(parts[1]);
      const field = parts[2];

      setEmergencyList((current) => {
        const next = [...current];
        if (!next[index]) next[index] = {};
        if (field === 'relationship') {
          next[index].relationship_to_senior = value;
        }
        return next;
      });
      closeDropdown();
      return;
    }

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

  // Helpers for lists
  const openMedicalDatePicker = (index, currentDate = '') => {
  const parts = parseDateParts(currentDate);

    setMedicalDatePicker({
      visible: true,
      index,
      day: parts.day,
      month: parts.month,
      year: parts.year,
    });
  };

  const confirmMedicalDateSelection = () => {
    const { index, day, month, year } = medicalDatePicker;

    const formatted = buildDateValue(day, month, year);

    updateMedicalItem(index, 'diagnosed_date', formatted);

    setMedicalDatePicker({
      visible: false,
      index: null,
      day: '',
      month: '',
      year: '',
    });
  };

  const addMedicalItem = () => {
    setMedicalList((current) => ([...current, { condition_id: null, condition_name: '', customCondition: '', severity_level: '', medication_required: '', diagnosed_date: '' }]));
  };
  const updateMedicalItem = (index, key, value) => {
    setMedicalList((current) => {
      const next = [...current];
      next[index] = { ...(next[index] || {}), [key]: value };
      return next;
    });
  };

  const addEmergencyItem = () => {
    setEmergencyList((current) => ([...current, { full_name: '', relationship_to_senior: '', phone_number: '', email: '' }]));
  };
  const updateEmergencyItem = (index, key, value) => {
    setEmergencyList((current) => {
      const next = [...current];
      next[index] = { ...(next[index] || {}), [key]: value };
      return next;
    });
  };

  const refreshSavedProfile = async () => {
    if (!apiBase || !details.seniorId) return;

    try {
      const [profileResponse, conditionsResponse, nokResponse] = await Promise.all([
        fetch(`${apiBase}/seniors/${details.seniorId}`),
        fetch(`${apiBase}/seniors/${details.seniorId}/medical-conditions`),
        fetch(`${apiBase}/seniors/${details.seniorId}/nok`),
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

  const getMissingRequiredFields = () => {
    const requiredFields = [
      ['Full Name', details.fullName],
      ['Date of Birth', formatDateForDB(details.dob || details.dobDate)],
      ['Gender', details.gender],
      ['Address', details.address],
      ['Postal Code', details.postalCode],
      ['Unit Number', details.unitNumber],
      ['Phone', details.phone],
    ];

    return requiredFields
      .filter(([, value]) => !`${value ?? ''}`.trim())
      .map(([label]) => label);
  };

  const handleSave = () => {
    const missingFields = getMissingRequiredFields();
    if (missingFields.length) {
      setSavedMessage('');
      setSaveError(`Please fill in required fields: ${missingFields.join(', ')}.`);
      return;
    }

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

    const missingFields = getMissingRequiredFields();
    if (missingFields.length) {
      setSaveError(`Please fill in required fields: ${missingFields.join(', ')}.`);
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

      // Sync medical conditions (multiple)
      if (seniorId) {
        const toSync = medicalList.map((c) => ({
          condition_id: c.condition_id || undefined,
          customCondition: (!c.condition_id && c.customCondition) ? c.customCondition : undefined,
          diagnosed_date: formatDateForDB(c.diagnosed_date) || undefined,
          severity_level: c.severity_level || undefined,
          medication_required: c.medication_required || undefined,
        })).filter((item) => item.condition_id || item.customCondition);

        if (toSync.length) {
          const syncResp = await fetch(`${apiBase}/seniors/${seniorId}/medical-conditions/sync`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ conditions: toSync }),
          });

          if (!syncResp.ok) {
            const txt = await syncResp.text().catch(() => null);
            let errObj;
            try { errObj = JSON.parse(txt); } catch (e) { errObj = { error: txt }; }
            throw new Error(errObj?.error || 'Failed to sync medical conditions');
          }
        }
      }

      // Save emergency contacts (multiple)
      if (seniorId) {
        for (const contact of emergencyList) {
          const relationship = contact.relationship_to_senior === CONDITION_OTHER
            ? (contact.relationship_to_senior_custom || CONDITION_OTHER)
            : contact.relationship_to_senior;

          const payload = {
            full_name: contact.full_name,
            relationship_to_senior: relationship,
            phone_number: contact.phone_number,
            email: contact.email,
          };

          const hasDetails = Object.values(payload).some((v) => `${v ?? ''}`.trim().length > 0);
          if (!hasDetails) continue;

          if (contact.nok_id) {
            const resp = await fetch(`${apiBase}/nok/${contact.nok_id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });

            if (!resp.ok) {
              const txt = await resp.text().catch(() => null);
              let errObj;
              try { errObj = JSON.parse(txt); } catch (e) { errObj = { error: txt }; }
              throw new Error(errObj?.error || 'Failed to update emergency contact');
            }
          } else {
            const resp = await fetch(`${apiBase}/seniors/${seniorId}/nok`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });

            const txt = await resp.text().catch(() => null);
            let result;
            try { result = JSON.parse(txt); } catch (e) { result = { nok_id: null, error: txt }; }
            if (!resp.ok) {
              throw new Error(result?.error || 'Failed to create emergency contact');
            }
          }
        }
      }

      if (seniorId) {
        await refreshSavedProfile();
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
          {renderInput('person-outline', 'Full Name *', 'fullName', 'Enter full name')}
          {renderDateField('calendar-outline', 'Date of Birth *', 'dob', 'DD/MM/YYYY')}
          {renderSelect('male-female-outline', 'Gender *', 'gender', 'Select gender', GENDERS)}
          {renderInput('home-outline', 'Address *', 'address', 'Enter address')}
          {renderInput('mail-outline', 'Postal Code *', 'postalCode', 'Enter postal code', 'number-pad')}
          {renderInput('business-outline', 'Unit Number *', 'unitNumber', 'Enter unit number')}
          {renderInput('call-outline', 'Phone *', 'phone', 'Enter phone number', 'phone-pad')}
        </View>

        <View style={styles.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.cardTitle}>Medical Conditions</Text>
            <TouchableOpacity onPress={addMedicalItem} style={{ padding: 6 }}>
              <Ionicons name="add-circle-outline" size={28} color="#2563EB" />
            </TouchableOpacity>
          </View>

          {medicalList.length === 0 ? (
            <Text style={styles.helperText}>No medical conditions added.</Text>
          ) : null}

          {medicalList.map((cond, idx) => (
            <View key={`med-${idx}`} style={styles.groupBlock}>
  
              <TouchableOpacity
                style={styles.inputRow}
                onPress={() => openDropdown(`medical:${idx}:condition`, 'Condition', [...medicalConditionsList.map((c) => c.condition_name), CONDITION_OTHER])}
                activeOpacity={0.86}
              >
                <Ionicons name="fitness-outline" size={19} color="#6B7280" />
                <View style={styles.inputCopy}>
                  <Text style={styles.inputLabel}>Condition</Text>
                  <View style={styles.selectInput}>
                    <Text style={styles.selectValue}>{cond.condition_name || 'Select condition'}</Text>
                    <Ionicons name="chevron-down-outline" size={18} color="#6B7280" />
                  </View>
                </View>
              </TouchableOpacity>

              {(!cond.condition_id && cond.condition_name === CONDITION_OTHER) || cond.customCondition ? (
                <View style={styles.inputRow}>
                  <Ionicons name="warning-outline" size={19} color="#6B7280" />
                  <View style={styles.inputCopy}>
                    <Text style={styles.inputLabel}>Condition (Others)</Text>
                    <TextInput
                      style={styles.input}
                      value={cond.customCondition}
                      onChangeText={(v) => updateMedicalItem(idx, 'customCondition', v)}
                      placeholder="Enter condition name"
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>
                </View>
              ) : null}

              <TouchableOpacity
                style={styles.inputRow}
                onPress={() => openDropdown(`medical:${idx}:severity`, 'Severity', SEVERITY_OPTIONS)}
                activeOpacity={0.86}
              >
                <Ionicons name="warning-outline" size={19} color="#6B7280" />
                <View style={styles.inputCopy}>
                  <Text style={styles.inputLabel}>Severity</Text>
                  <View style={styles.selectInput}>
                    <Text style={styles.selectValue}>{cond.severity_level || 'Select severity'}</Text>
                    <Ionicons name="chevron-down-outline" size={18} color="#6B7280" />
                  </View>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.inputRow}
                onPress={() => openDropdown(`medical:${idx}:medication`, 'Medication Required', MEDICATION_OPTIONS)}
                activeOpacity={0.86}
              >
                <Ionicons name="medical-outline" size={19} color="#6B7280" />
                <View style={styles.inputCopy}>
                  <Text style={styles.inputLabel}>Medication Required</Text>
                  <View style={styles.selectInput}>
                    <Text style={styles.selectValue}>{cond.medication_required || 'Select option'}</Text>
                    <Ionicons name="chevron-down-outline" size={18} color="#6B7280" />
                  </View>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.inputRow}
                onPress={() => openMedicalDatePicker(idx, cond.diagnosed_date)}
                activeOpacity={0.86}
              >
                <Ionicons name="calendar-outline" size={19} color="#6B7280" />
                <View style={styles.inputCopy}>
                  <Text style={styles.inputLabel}>Diagnosed</Text>
                  <View style={styles.selectInput}>
                    <Text style={styles.selectValue}>
                      {cond.diagnosed_date || 'DD/MM/YYYY'}
                    </Text>
                    <Ionicons
                      name="chevron-down-outline"
                      size={18}
                      color="#6B7280"
                    />
                  </View>
                </View>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.cardTitle}>Emergency Contact</Text>
            <TouchableOpacity onPress={addEmergencyItem} style={{ padding: 6 }}>
              <Ionicons name="add-circle-outline" size={28} color="#2563EB" />
            </TouchableOpacity>
          </View>

          {emergencyList.length === 0 ? (
            <Text style={styles.helperText}>No emergency contacts added.</Text>
          ) : null}

          {emergencyList.map((c, idx) => (
            <View key={`nok-${idx}`} style={styles.groupBlock}>
              <View style={styles.inputRow}>
                <Ionicons name="person-outline" size={19} color="#6B7280" />
                <View style={styles.inputCopy}>
                  <Text style={styles.inputLabel}>Name</Text>
                  <TextInput
                    style={styles.input}
                    value={c.full_name}
                    onChangeText={(v) => updateEmergencyItem(idx, 'full_name', v)}
                    placeholder="Enter contact name"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>
              </View>

              <TouchableOpacity
                style={styles.inputRow}
                onPress={() => openDropdown(`emergency:${idx}:relationship`, 'Relationship', RELATIONSHIPS)}
                activeOpacity={0.86}
              >
                <Ionicons name="people-outline" size={19} color="#6B7280" />
                <View style={styles.inputCopy}>
                  <Text style={styles.inputLabel}>Relationship</Text>
                  <View style={styles.selectInput}>
                    <Text style={styles.selectValue}>{c.relationship_to_senior || 'Select relationship'}</Text>
                    <Ionicons name="chevron-down-outline" size={18} color="#6B7280" />
                  </View>
                </View>
              </TouchableOpacity>

              {(c.relationship_to_senior === CONDITION_OTHER) ? (
                <View style={styles.inputRow}>
                  <Ionicons name="person-outline" size={19} color="#6B7280" />
                  <View style={styles.inputCopy}>
                    <Text style={styles.inputLabel}>Relationship (Others)</Text>
                    <TextInput
                      style={styles.input}
                      value={c.relationship_to_senior === CONDITION_OTHER ? c.relationship_to_senior_custom || '' : ''}
                      onChangeText={(v) => updateEmergencyItem(idx, 'relationship_to_senior_custom', v)}
                      placeholder="Enter relationship"
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>
                </View>
              ) : null}

              <View style={styles.inputRow}>
                <Ionicons name="call-outline" size={19} color="#6B7280" />
                <View style={styles.inputCopy}>
                  <Text style={styles.inputLabel}>Phone</Text>
                  <TextInput
                    style={styles.input}
                    value={c.phone_number}
                    onChangeText={(v) => updateEmergencyItem(idx, 'phone_number', v)}
                    placeholder="Enter phone number"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="phone-pad"
                  />
                </View>
              </View>

              <View style={styles.inputRow}>
                <Ionicons name="mail-outline" size={19} color="#6B7280" />
                <View style={styles.inputCopy}>
                  <Text style={styles.inputLabel}>Email</Text>
                  <TextInput
                    style={styles.input}
                    value={c.email}
                    onChangeText={(v) => updateEmergencyItem(idx, 'email', v)}
                    placeholder="Enter email address"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="email-address"
                  />
                </View>
              </View>
            </View>
          ))}
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

      <Modal visible={medicalDatePicker.visible} transparent animationType="fade">
        <View style={styles.modalContainer}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() =>
              setMedicalDatePicker({
                visible: false,
                index: null,
                day: '',
                month: '',
                year: '',
              })
            }
          />

          <View style={styles.dropdownModal}>
            <Text style={styles.modalTitle}>
              Select Diagnosed Date
            </Text>

            <View style={styles.datePickerRow}>
              <View style={styles.datePickerColumn}>
                <Text style={styles.datePickerLabel}>Day</Text>

                <ScrollView style={styles.datePickerList}>
                  {DAYS.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.datePickerItem,
                        medicalDatePicker.day === option.value &&
                        styles.datePickerItemActive,
                      ]}
                      onPress={() =>
                        setMedicalDatePicker((current) => ({
                          ...current,
                          day: option.value,
                        }))
                      }
                    >
                      <Text style={styles.datePickerText}>
                        {option.label}
                      </Text>
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
                      style={[
                        styles.datePickerItem,
                        medicalDatePicker.month === option.value &&
                        styles.datePickerItemActive,
                      ]}
                      onPress={() =>
                        setMedicalDatePicker((current) => ({
                          ...current,
                          month: option.value,
                        }))
                      }
                    >
                      <Text style={styles.datePickerText}>
                        {option.label}
                      </Text>
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
                      style={[
                        styles.datePickerItem,
                        medicalDatePicker.year === value &&
                        styles.datePickerItemActive,
                      ]}
                      onPress={() =>
                        setMedicalDatePicker((current) => ({
                          ...current,
                          year: value,
                        }))
                      }
                    >
                      <Text style={styles.datePickerText}>
                        {value}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>

            <TouchableOpacity
              style={styles.dropdownActionButton}
              onPress={confirmMedicalDateSelection}
            >
              <Text style={styles.dropdownActionText}>
                Confirm
              </Text>
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
  groupBlock: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 12,
    marginTop: 12,
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
