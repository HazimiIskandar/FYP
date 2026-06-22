import React, { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
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
const RELATIONSHIPS = ['Son', 'Daughter', 'Spouse', 'Sibling', 'Friend', 'Neighbor', CONDITION_OTHER];

export default function SeniorProfileScreen({
  senior = {},
  apiBase,
  onHome,
  onCommunity,
  onSettings,
}) {
  const seniorConditionFromProp = senior?.medicalConditions?.[0] || {};
  const nokContactFromProp = senior?.nokContacts?.[0] || {};
  const [fetchedCondition, setFetchedCondition] = useState(seniorConditionFromProp);
  const [fetchedNok, setFetchedNok] = useState(nokContactFromProp);

  const seniorCondition = Object.keys(fetchedCondition || {}).length ? fetchedCondition : seniorConditionFromProp;
  const nokContact = Object.keys(fetchedNok || {}).length ? fetchedNok : nokContactFromProp;
  const initialRelationship = nokContact.relationship_to_senior || '';
  const isRelationshipStandard = RELATIONSHIPS.includes(initialRelationship);

  useEffect(() => {
    setFetchedCondition(seniorConditionFromProp);
    setFetchedNok(nokContactFromProp);
  }, [seniorConditionFromProp, nokContactFromProp]);

  useEffect(() => {
    if (!apiBase || !senior?.senior_id) return;
    let isActive = true;

    const fetchProfileExtras = async () => {
      try {
        const [conditionResponse, nokResponse] = await Promise.all([
          fetch(`${apiBase}/seniors/${senior.senior_id}/medical-conditions`),
          fetch(`${apiBase}/seniors/${senior.senior_id}/nok`),
        ]);

        if (!conditionResponse.ok || !nokResponse.ok) return;

        const [conditionData, nokData] = await Promise.all([
          conditionResponse.json(),
          nokResponse.json(),
        ]);

        if (!isActive) return;

        setFetchedCondition(Array.isArray(conditionData) ? conditionData[0] || {} : conditionData || {});
        setFetchedNok(Array.isArray(nokData) ? nokData[0] || {} : nokData || {});
      } catch (err) {
        console.log('Failed to fetch senior profile details:', err);
      }
    };

    fetchProfileExtras();

    return () => {
      isActive = false;
    };
  }, [apiBase, senior?.senior_id]);

  const details = useMemo(() => {
    return {
      fullName: getSeniorName(senior),
      dob: formatDate(senior?.dob) || 'Not recorded',
      gender: senior?.gender || 'Not recorded',
      address: senior?.address || 'Not recorded',
      postalCode: senior?.postal_code || 'Not recorded',
      unitNumber: senior?.unit_number || senior?.unit_no || 'Not recorded',
      phone: senior?.phone_number || senior?.contact || 'Not recorded',
      condition: seniorCondition?.condition_name || 'Not recorded',
      severity: seniorCondition?.severity_level || 'Not recorded',
      medicationRequired: seniorCondition?.medication_required || 'Not recorded',
      diagnosedDate: formatDate(seniorCondition?.diagnosed_date) || 'Not recorded',
      emergencyName: nokContact?.full_name || 'Not recorded',
      emergencyRelationship: isRelationshipStandard ? initialRelationship : (initialRelationship || 'Not recorded'),
      emergencyPhone: nokContact?.phone_number || 'Not recorded',
      emergencyEmail: nokContact?.email || 'Not recorded',
    };
  }, [senior, seniorCondition, nokContact, isRelationshipStandard, initialRelationship]);

  const renderInfoRow = (icon, label, value) => (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={19} color="#6B7280" />
      <View style={styles.infoCopy}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Header title="My Profile" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Personal Details</Text>
          {renderInfoRow('person-outline', 'Full Name', details.fullName)}
          {renderInfoRow('calendar-outline', 'Date of Birth', details.dob)}
          {renderInfoRow('male-female-outline', 'Gender', details.gender)}
          {renderInfoRow('home-outline', 'Address', details.address)}
          {renderInfoRow('mail-outline', 'Postal Code', details.postalCode)}
          {renderInfoRow('business-outline', 'Unit Number', details.unitNumber)}
          {renderInfoRow('call-outline', 'Phone', details.phone)}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Medical Conditions</Text>
          {renderInfoRow('fitness-outline', 'Condition', details.condition)}
          {renderInfoRow('warning-outline', 'Severity', details.severity)}
          {renderInfoRow('medical-outline', 'Medication Required', details.medicationRequired)}
          {renderInfoRow('calendar-outline', 'Diagnosed', details.diagnosedDate)}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Emergency Contact</Text>
          {renderInfoRow('person-outline', 'Name', details.emergencyName)}
          {renderInfoRow('people-outline', 'Relationship', details.emergencyRelationship)}
          {renderInfoRow('call-outline', 'Phone', details.emergencyPhone)}
          {renderInfoRow('mail-outline', 'Email', details.emergencyEmail)}
        </View>
      </ScrollView>

      <SeniorBottomNav
        activeTab="Profile"
        onHome={onHome}
        onCommunity={onCommunity}
        onProfile={() => {}}
        onSettings={onSettings}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scrollContent: { padding: 20, paddingBottom: 28 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    marginBottom: 14,
  },
  cardTitle: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoCopy: {
    marginLeft: 10,
    flex: 1,
  },
  infoLabel: {
    color: '#374151',
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 2,
  },
  infoValue: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '600',
  },
});