import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  const stringValue = `${value}`.trim();

  const isoMatch = stringValue.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
  if (isoMatch) {
    return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
  }

  const slashYmdMatch = stringValue.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
  if (slashYmdMatch) {
    return `${slashYmdMatch[3]}/${slashYmdMatch[2]}/${slashYmdMatch[1]}`;
  }

  const displayMatch = stringValue.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (displayMatch) {
    return stringValue;
  }

  const date = new Date(stringValue);
  if (Number.isNaN(date.getTime())) return value;
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
};

const CONDITION_OTHER = 'Others';

const GENDERS = ['Male', 'Female'];
const RELATIONSHIPS = ['Son', 'Daughter', 'Spouse', 'Sibling', 'Friend', 'Neighbor', CONDITION_OTHER];
const SEVERITY_OPTIONS = ['Mild', 'Moderate', 'High'];
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

  const normalized = `${value}`.trim();

  const isoMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
  if (isoMatch) {
    return { day: isoMatch[3], month: isoMatch[2], year: isoMatch[1] };
  }

  const dbMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dbMatch) {
    return { day: dbMatch[3], month: dbMatch[2], year: dbMatch[1] };
  }

  const dbSlashMatch = normalized.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
  if (dbSlashMatch) {
    return { day: dbSlashMatch[3], month: dbSlashMatch[2], year: dbSlashMatch[1] };
  }

  const displayMatch = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (displayMatch) {
    return { day: displayMatch[1], month: displayMatch[2], year: displayMatch[3] };
  }

  const dashDisplayMatch = normalized.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dashDisplayMatch) {
    return { day: dashDisplayMatch[1], month: dashDisplayMatch[2], year: dashDisplayMatch[3] };
  }

  return { day: '', month: '', year: '' };
};

const buildDateValue = (day, month, year) => {
  if (!day || !month || !year) return '';
  return `${day}/${month.padStart(2, '0')}/${year}`;
};

const formatDateForDB = (value) => {
  if (!value) return null;
  const normalized = `${value}`.trim();

  const isoMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  const dbMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dbMatch) return value;

  const dashDisplayMatch = normalized.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dashDisplayMatch) {
    return `${dashDisplayMatch[3]}-${dashDisplayMatch[2]}-${dashDisplayMatch[1]}`;
  }

  const parts = normalized.split('/');
  if (parts.length !== 3) return null;
  const [day, month, year] = parts;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
};

const capitalizeWords = (str) => {
  return str
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

const buildMedicalEntry = (condition = {}) => {
  const conditionName = condition?.condition_name || '';
  const hasKnownConditionId = Number.isInteger(Number(condition?.condition_id));
  const isCustomCondition = Boolean(conditionName) && !hasKnownConditionId;
  const diagnosedParts = parseDateParts(formatDate(condition?.diagnosed_date));

  return {
    condition: isCustomCondition ? CONDITION_OTHER : conditionName,
    conditionId: condition?.condition_id || null,
    customCondition: isCustomCondition ? conditionName : '',
    severity: condition?.severity_level || '',
    medicationRequired: condition?.medication_required || '',
    diagnosedDate: buildDateValue(diagnosedParts.day, diagnosedParts.month, diagnosedParts.year),
  };
};

const buildEmergencyEntry = (contact = {}) => {
  const relationship = contact?.relationship_to_senior || '';
  const isStandardRelationship = RELATIONSHIPS.includes(relationship);

  return {
    nokId: contact?.nok_id || null,
    name: contact?.full_name || '',
    relationship: isStandardRelationship ? relationship : (relationship ? CONDITION_OTHER : ''),
    relationshipCustom: isStandardRelationship ? '' : relationship,
    phone: contact?.phone_number || '',
    email: contact?.email || '',
  };
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
  const seniorMedicalConditions = Array.isArray(senior?.medicalConditions) ? senior.medicalConditions : [];
  const seniorNokContacts = Array.isArray(senior?.nokContacts) ? senior.nokContacts : [];
  const initialRelationship = senior?.nokContacts?.[0]?.relationship_to_senior || '';
  const initialRelationship2 = senior?.nokContacts?.[1]?.relationship_to_senior || '';
  const isRelationshipStandard = RELATIONSHIPS.includes(initialRelationship);
  const isRelationship2Standard = RELATIONSHIPS.includes(initialRelationship2);
  const seniorFormSourceKey = JSON.stringify({
    seniorId: senior?.senior_id || null,
    userId: senior?.user_id || null,
    fullName: getSeniorName(senior),
    dob: senior?.dob || '',
    gender: senior?.gender || '',
    address: senior?.address || '',
    postalCode: senior?.postal_code || '',
    unitNumber: senior?.unit_number || senior?.unit_no || '',
    phone: senior?.phone_number || senior?.contact || '',
    medicalConditions: seniorMedicalConditions,
    nokContacts: seniorNokContacts,
  });
  const initialDetails = useMemo(() => {
    const dobParts = parseDateParts(formatDate(senior?.dob));

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
      emergencyName: senior?.nokContacts?.[0]?.full_name || '',
      emergencyRelationship: isRelationshipStandard ? initialRelationship : (initialRelationship ? CONDITION_OTHER : ''),
      emergencyRelationshipCustom: isRelationshipStandard ? '' : initialRelationship || '',
      emergencyPhone: senior?.nokContacts?.[0]?.phone_number || '',
      emergencyEmail: senior?.nokContacts?.[0]?.email || '',
      nokId: senior?.nokContacts?.[0]?.nok_id || null,
      emergencyName2: senior?.nokContacts?.[1]?.full_name || '',
      emergencyRelationship2: isRelationship2Standard ? initialRelationship2 : (initialRelationship2 ? CONDITION_OTHER : ''),
      emergencyRelationshipCustom2: isRelationship2Standard ? '' : initialRelationship2 || '',
      emergencyPhone2: senior?.nokContacts?.[1]?.phone_number || '',
      emergencyEmail2: senior?.nokContacts?.[1]?.email || '',
      nokId2: senior?.nokContacts?.[1]?.nok_id || null,
      hasSecondEmergency:
        Boolean(senior?.nokContacts?.[1]?.full_name) ||
        Boolean(senior?.nokContacts?.[1]?.phone_number) ||
        Boolean(senior?.nokContacts?.[1]?.email),
      userId: senior?.user_id || null,
      seniorId: senior?.senior_id || null,
    };
  }, [seniorFormSourceKey]);

  const [details, setDetails] = useState(initialDetails);
  const lastFormSourceKeyRef = useRef(seniorFormSourceKey);
  const [savedMessage, setSavedMessage] = useState('');
  const [saveError, setSaveError] = useState('');
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [dropdownState, setDropdownState] = useState({ visible: false, title: '', key: '', options: [] });
  const [datePicker, setDatePicker] = useState({ visible: false, type: '', day: '', month: '', year: '', medicalIndex: null });
  const [medicalConditionsList, setMedicalConditionsList] = useState([]);
  const [loadingConditions, setLoadingConditions] = useState(false);
  const [conditionLoadError, setConditionLoadError] = useState('');
  const [medicalEntries, setMedicalEntries] = useState(() => {
    const source = Array.isArray(senior?.medicalConditions) ? senior.medicalConditions : [];
    return source.length ? source.map((item) => buildMedicalEntry(item)) : [buildMedicalEntry({})];
  });
  const [emergencyEntries, setEmergencyEntries] = useState(() => {
    const source = Array.isArray(senior?.nokContacts) ? senior.nokContacts : [];
    return source.length ? source.map((item) => buildEmergencyEntry(item)) : [buildEmergencyEntry({})];
  });

  useEffect(() => {
    if (lastFormSourceKeyRef.current === seniorFormSourceKey) {
      return;
    }

    lastFormSourceKeyRef.current = seniorFormSourceKey;
    setDetails(initialDetails);
  }, [initialDetails, seniorFormSourceKey]);

  useEffect(() => {
    if (lastFormSourceKeyRef.current !== seniorFormSourceKey) {
      return;
    }

    const medicalSource = seniorMedicalConditions;
    const emergencySource = seniorNokContacts;

    setMedicalEntries(
      medicalSource.length ? medicalSource.map((item) => buildMedicalEntry(item)) : [buildMedicalEntry({})]
    );
    setEmergencyEntries(
      emergencySource.length ? emergencySource.map((item) => buildEmergencyEntry(item)) : [buildEmergencyEntry({})]
    );
  }, [seniorFormSourceKey]);

  const updateMedicalEntry = (index, key, value) => {
    setMedicalEntries((current) =>
      current.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, [key]: value } : entry
      )
    );
    setSavedMessage('');
  };

  const addMedicalEntry = () => {
    setMedicalEntries((current) => [...current, buildMedicalEntry({})]);
    setSavedMessage('');
  };

  const removeMedicalEntry = (index) => {
    setMedicalEntries((current) => {
      const next = current.filter((_, entryIndex) => entryIndex !== index);
      return next.length ? next : [buildMedicalEntry({})];
    });
    setSavedMessage('');
  };

  const updateEmergencyEntry = (index, key, value) => {
    setEmergencyEntries((current) =>
      current.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, [key]: value } : entry
      )
    );
    setSavedMessage('');
  };

  const addEmergencyEntry = () => {
    setEmergencyEntries((current) => [...current, buildEmergencyEntry({})]);
    setSavedMessage('');
  };

  const removeEmergencyEntry = (index) => {
    setEmergencyEntries((current) => {
      const next = current.filter((_, entryIndex) => entryIndex !== index);
      return next.length ? next : [buildEmergencyEntry({})];
    });
    setSavedMessage('');
  };

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
    if (dropdownState.key.startsWith('medical:')) {
      const [, indexPart, field] = dropdownState.key.split(':');
      const index = Number(indexPart);
      if (Number.isNaN(index)) {
        closeDropdown();
        return;
      }

      if (field === 'condition') {
        if (value === CONDITION_OTHER) {
          updateMedicalEntry(index, 'condition', CONDITION_OTHER);
          updateMedicalEntry(index, 'conditionId', null);
          updateMedicalEntry(index, 'customCondition', '');
          updateMedicalEntry(index, 'severity', '');
          updateMedicalEntry(index, 'medicationRequired', '');
        } else {
          const item = medicalConditionsList.find((option) => option.condition_name === value);
          updateMedicalEntry(index, 'condition', value);
          updateMedicalEntry(index, 'conditionId', item?.condition_id || null);
          updateMedicalEntry(index, 'customCondition', '');
          // Do NOT auto-populate severity or medicationRequired from Medical_Condition
        }
      } else {
        updateMedicalEntry(index, field, value);
      }

      closeDropdown();
      return;
    }

    if (dropdownState.key.startsWith('emergency:')) {
      const [, indexPart, field] = dropdownState.key.split(':');
      const index = Number(indexPart);
      if (Number.isNaN(index)) {
        closeDropdown();
        return;
      }

      if (field === 'relationship') {
        updateEmergencyEntry(index, 'relationship', value);
        if (value === CONDITION_OTHER) {
          updateEmergencyEntry(index, 'relationshipCustom', '');
        }
      } else {
        updateEmergencyEntry(index, field, value);
      }

      closeDropdown();
      return;
    }

    if (dropdownState.key === 'emergencyRelationship') {
      const nextDetails = { emergencyRelationship: value };
      if (value === CONDITION_OTHER) {
        nextDetails.emergencyRelationshipCustom = '';
      }
      setDetails((current) => ({ ...current, ...nextDetails }));
    } else if (dropdownState.key === 'emergencyRelationship2') {
      const nextDetails = { emergencyRelationship2: value };
      if (value === CONDITION_OTHER) {
        nextDetails.emergencyRelationshipCustom2 = '';
      }
      setDetails((current) => ({ ...current, ...nextDetails }));
    } else {
      updateDetail(dropdownState.key, value);
    }

    closeDropdown();
  };

  const openDatePicker = (type, medicalIndex = null) => {
    const sourceDate =
      type === 'dob'
        ? details[`${type}Date`] || details.dob || ''
        : medicalIndex !== null
        ? medicalEntries[medicalIndex]?.diagnosedDate || ''
        : '';
    const dateParts = parseDateParts(sourceDate);

    setDatePicker({
      visible: true,
      type,
      day: dateParts.day,
      month: dateParts.month,
      year: dateParts.year,
      medicalIndex,
    });
  };

  const updateDatePickerValue = (key, value) => {
    setDatePicker((current) => ({ ...current, [key]: value }));
  };

  const refreshSavedProfile = async (overrideSeniorId = null) => {
    const targetSeniorId = overrideSeniorId || details.seniorId;
    if (!apiBase || !targetSeniorId) return;

    try {
      const [profileResponse, conditionsResponse, nokResponse] = await Promise.all([
        fetch(`${apiBase}/seniors/${targetSeniorId}`),
        fetch(`${apiBase}/seniors/${targetSeniorId}/medical-conditions`),
        fetch(`${apiBase}/seniors/${targetSeniorId}/nok`),
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
      const conditionArray = Array.isArray(conditionsData)
        ? conditionsData
        : conditionsData
        ? [conditionsData]
        : [];
      const nokArray = Array.isArray(nokData)
        ? nokData
        : nokData
        ? [nokData]
        : [];
      const relationship = nokData?.[0]?.relationship_to_senior || '';
      const relationship2 = nokData?.[1]?.relationship_to_senior || '';
      const isRelationshipStandard = RELATIONSHIPS.includes(relationship);
      const isRelationship2Standard = RELATIONSHIPS.includes(relationship2);

      setMedicalEntries(
        conditionArray.length
          ? conditionArray.map((item) => buildMedicalEntry(item))
          : [buildMedicalEntry({})]
      );
      setEmergencyEntries(
        nokArray.length
          ? nokArray.map((item) => buildEmergencyEntry(item))
          : [buildEmergencyEntry({})]
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
        emergencyName2: nokData?.[1]?.full_name || '',
        emergencyRelationship2: isRelationship2Standard
          ? relationship2
          : relationship2
          ? CONDITION_OTHER
          : '',
        emergencyRelationshipCustom2: isRelationship2Standard
          ? ''
          : relationship2 || '',
        emergencyPhone2: nokData?.[1]?.phone_number || '',
        emergencyEmail2: nokData?.[1]?.email || '',
        nokId2: nokData?.[1]?.nok_id || null,
        hasSecondEmergency:
          Boolean(nokData?.[1]?.full_name) ||
          Boolean(nokData?.[1]?.phone_number) ||
          Boolean(nokData?.[1]?.email),
      }));
    } catch (err) {
      console.log('Failed to refresh profile:', err);
    }
  };

  const confirmDateSelection = () => {
    const { type, day, month, year, medicalIndex } = datePicker;
    const formatted = buildDateValue(day, month, year);

    if (type === 'dob') {
      updateDetail(`${type}Date`, formatted);
      updateDetail('dob', formatted);
      updateDetail(`${type}Day`, day);
      updateDetail(`${type}Month`, month);
      updateDetail(`${type}Year`, year);
    } else if (type === 'medicalDiagnosed' && medicalIndex !== null) {
      updateMedicalEntry(medicalIndex, 'diagnosedDate', formatted);
    }

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

      if (seniorId) {
        // Sync all emergency contacts (create/update/delete) based on current form rows.
        const nextEmergencyEntries = [];
        for (const entry of emergencyEntries) {
          const relationship =
            entry.relationship === CONDITION_OTHER ? entry.relationshipCustom : entry.relationship;

          const payload = {
            full_name: entry.name,
            relationship_to_senior: relationship,
            phone_number: entry.phone,
            email: entry.email,
          };

          const hasDetails = Object.values(payload).some((value) => `${value ?? ''}`.trim().length > 0);

          if (entry.nokId && hasDetails) {
            const response = await fetch(`${apiBase}/nok/${entry.nokId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });

            const result = await response.json().catch(() => null);
            if (!response.ok) {
              throw new Error(result?.error || 'Failed to update emergency contact');
            }

            nextEmergencyEntries.push(entry);
            continue;
          }

          if (entry.nokId && !hasDetails) {
            const response = await fetch(`${apiBase}/nok/${entry.nokId}`, {
              method: 'DELETE',
            });

            const result = await response.json().catch(() => null);
            if (!response.ok) {
              throw new Error(result?.error || 'Failed to remove emergency contact');
            }

            continue;
          }

          if (!entry.nokId && hasDetails) {
            const response = await fetch(`${apiBase}/seniors/${seniorId}/nok`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });

            const result = await response.json().catch(() => null);
            if (!response.ok) {
              throw new Error(result?.error || 'Failed to create emergency contact');
            }

            nextEmergencyEntries.push({ ...entry, nokId: result?.nok_id || null });
            continue;
          }
        }

        setEmergencyEntries(nextEmergencyEntries.length ? nextEmergencyEntries : [buildEmergencyEntry({})]);

        // Sync all medical conditions in one request.
        const conditionsToSync = medicalEntries
          .map((entry) => {
            let customCondition = undefined;
            if (entry.condition === CONDITION_OTHER && entry.customCondition) {
              customCondition = capitalizeWords(entry.customCondition);
            }

            const payload = {
              condition_id: entry.conditionId,
              customCondition,
              diagnosed_date: formatDateForDB(entry.diagnosedDate),
              severity_level: entry.severity,
              medication_required: entry.medicationRequired,
            };

            return Object.fromEntries(
              Object.entries(payload).filter(
                ([, value]) => value !== undefined && value !== null && value !== ''
              )
            );
          })
          .filter((item) => item.condition_id || item.customCondition);

        const conditionResponse = await fetch(`${apiBase}/seniors/${seniorId}/medical-conditions/sync`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conditions: conditionsToSync }),
        });

        const conditionResult = await conditionResponse.json().catch(() => null);
        if (!conditionResponse.ok) {
          throw new Error(conditionResult?.error || conditionResult?.message || 'Failed to save medical conditions');
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
          {renderInput('person-outline', 'Full Name *', 'fullName', 'Enter full name')}
          {renderDateField('calendar-outline', 'Date of Birth *', 'dob', 'DD/MM/YYYY')}
          {renderSelect('male-female-outline', 'Gender *', 'gender', 'Select gender', GENDERS)}
          {renderInput('home-outline', 'Address *', 'address', 'Enter address')}
          {renderInput('mail-outline', 'Postal Code *', 'postalCode', 'Enter postal code', 'number-pad')}
          {renderInput('business-outline', 'Unit Number *', 'unitNumber', 'Enter unit number')}
          {renderInput('call-outline', 'Phone *', 'phone', 'Enter phone number', 'phone-pad')}
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.cardTitle}>Medical Conditions</Text>
            <TouchableOpacity
              style={styles.plusIconButton}
              activeOpacity={0.86}
              onPress={addMedicalEntry}
            >
              <Ionicons name="add" size={24} color="#2563EB" />
            </TouchableOpacity>
          </View>
          {medicalEntries.map((entry, index) => (
            <View key={`medical-${index}`} style={styles.dynamicItemBlock}>
              <View style={styles.inlineTitleRow}>
                <Text style={styles.contactSubTitle}>Medical Condition {index + 1}</Text>
                {medicalEntries.length > 1 ? (
                  <TouchableOpacity
                    style={styles.removeLinkButton}
                    onPress={() => removeMedicalEntry(index)}
                    activeOpacity={0.86}
                  >
                    <Text style={styles.removeLinkText}>Remove</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              <TouchableOpacity
                style={styles.inputRow}
                onPress={() =>
                  openDropdown(
                    `medical:${index}:condition`,
                    'Condition',
                    [...medicalConditionsList.map((condition) => condition.condition_name), CONDITION_OTHER]
                  )
                }
                activeOpacity={0.86}
              >
                <Ionicons name="fitness-outline" size={19} color="#6B7280" />
                <View style={styles.inputCopy}>
                  <Text style={styles.inputLabel}>Condition</Text>
                  <View style={styles.selectInput}>
                    <Text style={styles.selectValue}>
                      {entry.condition || (loadingConditions ? 'Loading conditions...' : 'Select condition')}
                    </Text>
                    <Ionicons name="chevron-down-outline" size={18} color="#6B7280" />
                  </View>
                </View>
              </TouchableOpacity>

              {(entry.condition === CONDITION_OTHER || entry.customCondition) ? (
                <View style={styles.inputRow}>
                  <Ionicons name="warning-outline" size={19} color="#6B7280" />
                  <View style={styles.inputCopy}>
                    <Text style={styles.inputLabel}>Condition (Others)</Text>
                    <TextInput
                      style={styles.input}
                      value={entry.customCondition}
                      onChangeText={(value) => updateMedicalEntry(index, 'customCondition', value)}
                      placeholder="Enter condition name"
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>
                </View>
              ) : null}

              <TouchableOpacity
                style={styles.inputRow}
                onPress={() => openDropdown(`medical:${index}:severity`, 'Severity', SEVERITY_OPTIONS)}
                activeOpacity={0.86}
              >
                <Ionicons name="warning-outline" size={19} color="#6B7280" />
                <View style={styles.inputCopy}>
                  <Text style={styles.inputLabel}>Severity</Text>
                  <View style={styles.selectInput}>
                    <Text style={styles.selectValue}>{entry.severity || 'Select severity'}</Text>
                    <Ionicons name="chevron-down-outline" size={18} color="#6B7280" />
                  </View>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.inputRow}
                onPress={() => openDropdown(`medical:${index}:medicationRequired`, 'Medication Required', MEDICATION_OPTIONS)}
                activeOpacity={0.86}
              >
                <Ionicons name="medical-outline" size={19} color="#6B7280" />
                <View style={styles.inputCopy}>
                  <Text style={styles.inputLabel}>Medication Required</Text>
                  <View style={styles.selectInput}>
                    <Text style={styles.selectValue}>{entry.medicationRequired || 'Select option'}</Text>
                    <Ionicons name="chevron-down-outline" size={18} color="#6B7280" />
                  </View>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.inputRow}
                onPress={() => openDatePicker('medicalDiagnosed', index)}
                activeOpacity={0.86}
              >
                <Ionicons name="calendar-outline" size={19} color="#6B7280" />
                <View style={styles.inputCopy}>
                  <Text style={styles.inputLabel}>Diagnosed</Text>
                  <View style={styles.selectInput}>
                    <Text style={styles.selectValue}>{entry.diagnosedDate || 'DD/MM/YYYY'}</Text>
                    <Ionicons name="chevron-down-outline" size={18} color="#6B7280" />
                  </View>
                </View>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.cardTitle}>Emergency Contacts</Text>
            <TouchableOpacity
              style={styles.plusIconButton}
              activeOpacity={0.86}
              onPress={addEmergencyEntry}
            >
              <Ionicons name="add" size={24} color="#2563EB" />
            </TouchableOpacity>
          </View>
          {emergencyEntries.map((entry, index) => (
            <View key={`emergency-${index}`} style={styles.dynamicItemBlock}>
              <View style={styles.inlineTitleRow}>
                <Text style={styles.contactSubTitle}>Emergency Contact {index + 1}</Text>
                {emergencyEntries.length > 1 ? (
                  <TouchableOpacity
                    style={styles.removeLinkButton}
                    onPress={() => removeEmergencyEntry(index)}
                    activeOpacity={0.86}
                  >
                    <Text style={styles.removeLinkText}>Remove</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              <View style={styles.inputRow}>
                <Ionicons name="person-outline" size={19} color="#6B7280" />
                <View style={styles.inputCopy}>
                  <Text style={styles.inputLabel}>Name</Text>
                  <TextInput
                    style={styles.input}
                    value={entry.name}
                    onChangeText={(value) => updateEmergencyEntry(index, 'name', value)}
                    placeholder="Enter contact name"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>
              </View>

              <TouchableOpacity
                style={styles.inputRow}
                onPress={() => openDropdown(`emergency:${index}:relationship`, 'Relationship', RELATIONSHIPS)}
                activeOpacity={0.86}
              >
                <Ionicons name="people-outline" size={19} color="#6B7280" />
                <View style={styles.inputCopy}>
                  <Text style={styles.inputLabel}>Relationship</Text>
                  <View style={styles.selectInput}>
                    <Text style={styles.selectValue}>{entry.relationship || 'Select relationship'}</Text>
                    <Ionicons name="chevron-down-outline" size={18} color="#6B7280" />
                  </View>
                </View>
              </TouchableOpacity>

              {(entry.relationship === CONDITION_OTHER || entry.relationshipCustom) ? (
                <View style={styles.inputRow}>
                  <Ionicons name="person-outline" size={19} color="#6B7280" />
                  <View style={styles.inputCopy}>
                    <Text style={styles.inputLabel}>Relationship (Others)</Text>
                    <TextInput
                      style={styles.input}
                      value={entry.relationshipCustom}
                      onChangeText={(value) => updateEmergencyEntry(index, 'relationshipCustom', value)}
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
                    value={entry.phone}
                    onChangeText={(value) => updateEmergencyEntry(index, 'phone', value)}
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
                    value={entry.email}
                    onChangeText={(value) => updateEmergencyEntry(index, 'email', value)}
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
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  cardTitle: { color: '#111827', fontSize: 19, fontWeight: '900' },
  plusIconButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    marginBottom: 10,
  },
  removeLinkButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
  },
  removeLinkText: {
    color: '#B91C1C',
    fontSize: 12,
    fontWeight: '800',
  },
  contactSubTitle: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '900',
  },
  dynamicItemBlock: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 10,
    marginTop: 10,
  },
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