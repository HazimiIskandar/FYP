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
  const medicalFromProp = useMemo(
    () => (Array.isArray(senior?.medicalConditions) ? senior.medicalConditions : []),
    [senior?.medicalConditions]
  );
  const nokFromProp = useMemo(
    () => (Array.isArray(senior?.nokContacts) ? senior.nokContacts : []),
    [senior?.nokContacts]
  );
  const [fetchedConditions, setFetchedConditions] = useState([]);
  const [fetchedNoks, setFetchedNoks] = useState([]);

  const medicalConditions = fetchedConditions.length ? fetchedConditions : medicalFromProp;
  const emergencyContacts = fetchedNoks.length ? fetchedNoks : nokFromProp;

  useEffect(() => {
    setFetchedConditions([]);
    setFetchedNoks([]);
  }, [senior?.senior_id]);

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

        setFetchedConditions(Array.isArray(conditionData) ? conditionData : (conditionData ? [conditionData] : []));
        setFetchedNoks(Array.isArray(nokData) ? nokData : (nokData ? [nokData] : []));
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
    };
  }, [senior]);

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
          {medicalConditions.length ? (
            medicalConditions.map((condition, index) => (
              <View key={`condition-${condition?.condition_id || index}`} style={styles.groupBlock}>
                <Text style={styles.groupTitle}>Condition {index + 1}</Text>
                {renderInfoRow('fitness-outline', 'Condition', condition?.condition_name || 'Not recorded')}
                {renderInfoRow('warning-outline', 'Severity', condition?.severity_level || 'Not recorded')}
                {renderInfoRow('medical-outline', 'Medication Required', condition?.medication_required || 'Not recorded')}
                {renderInfoRow('calendar-outline', 'Diagnosed', formatDate(condition?.diagnosed_date) || 'Not recorded')}
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No medical conditions recorded.</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Emergency Contacts</Text>
          {emergencyContacts.length ? (
            emergencyContacts.map((contact, index) => {
              const relationship = contact?.relationship_to_senior || '';
              const displayRelationship = RELATIONSHIPS.includes(relationship)
                ? relationship
                : (relationship || 'Not recorded');

              return (
                <View key={`nok-${contact?.nok_id || index}`} style={styles.groupBlock}>
                  <Text style={styles.groupTitle}>Contact {index + 1}</Text>
                  {renderInfoRow('person-outline', 'Name', contact?.full_name || 'Not recorded')}
                  {renderInfoRow('people-outline', 'Relationship', displayRelationship)}
                  {renderInfoRow('call-outline', 'Phone', contact?.phone_number || 'Not recorded')}
                  {renderInfoRow('mail-outline', 'Email', contact?.email || 'Not recorded')}
                </View>
              );
            })
          ) : (
            <Text style={styles.emptyText}>No emergency contacts recorded.</Text>
          )}
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
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 2,
  },
  infoValue: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '600',
  },
  groupBlock: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 10,
    marginTop: 10,
  },
  groupTitle: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 8,
  },
  emptyText: {
    color: '#6B7280',
    fontSize: 15,
    fontWeight: '700',
  },
});
