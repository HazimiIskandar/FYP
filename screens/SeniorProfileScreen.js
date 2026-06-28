import React, { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import Header from '../components/Header';
import SeniorBottomNav from '../components/SeniorBottomNav';
import { formatDate } from '../utils/time';

const getSeniorName = (senior) =>
  senior?.full_name ||
  senior?.User_Account?.full_name ||
  senior?.user?.full_name ||
  senior?.name ||
  [senior?.first_name, senior?.last_name].filter(Boolean).join(' ') ||
  'Senior';

const CONDITION_OTHER = 'Others';
const RELATIONSHIPS = ['Son', 'Daughter', 'Spouse', 'Sibling', 'Friend', 'Neighbor', CONDITION_OTHER];
const RELATIONSHIP_TRANSLATION_KEYS = {
  Son: 'profile.relationships.son',
  Daughter: 'profile.relationships.daughter',
  Spouse: 'profile.relationships.spouse',
  Sibling: 'profile.relationships.sibling',
  Friend: 'profile.relationships.friend',
  Neighbor: 'profile.relationships.neighbor',
  Others: 'profile.relationships.others',
};

export default function SeniorProfileScreen({
  senior = {},
  apiBase,
  onHome,
  onCommunity,
  onSettings,
}) {
  const { t, i18n } = useTranslation();
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
  const [fetchedProfile, setFetchedProfile] = useState(null);
  const personalDetailsKey = JSON.stringify({
    fullName: getSeniorName(senior),
    dob: senior?.dob || '',
    gender: senior?.gender || '',
    address: senior?.address || '',
    postalCode: senior?.postal_code || '',
    unitNumber: senior?.unit_number || senior?.unit_no || '',
    phone: senior?.phone_number || senior?.contact || '',
  });

  const medicalConditions = fetchedConditions.length ? fetchedConditions : medicalFromProp;
  const emergencyContacts = fetchedNoks.length ? fetchedNoks : nokFromProp;
  const profileSource = fetchedProfile ? { ...senior, ...fetchedProfile } : senior;

  useEffect(() => {
    setFetchedProfile(null);
    setFetchedConditions([]);
    setFetchedNoks([]);
  }, [senior?.senior_id, personalDetailsKey]);

  useEffect(() => {
    if (!apiBase || !senior?.senior_id) return;
    let isActive = true;

    const fetchProfileExtras = async () => {
      try {
        const [profileResponse, conditionResponse, nokResponse] = await Promise.all([
          fetch(`${apiBase}/seniors/${senior.senior_id}`),
          fetch(`${apiBase}/seniors/${senior.senior_id}/medical-conditions`),
          fetch(`${apiBase}/seniors/${senior.senior_id}/nok`),
        ]);

        if (!profileResponse.ok || !conditionResponse.ok || !nokResponse.ok) return;

        const [profileData, conditionData, nokData] = await Promise.all([
          profileResponse.json(),
          conditionResponse.json(),
          nokResponse.json(),
        ]);

        if (!isActive) return;

        setFetchedProfile(profileData && typeof profileData === 'object' ? profileData : null);
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
  }, [apiBase, senior?.senior_id, personalDetailsKey]);

  const details = useMemo(() => {
    const notRecorded = t('profile.notRecorded');

    return {
      fullName: getSeniorName(profileSource),
      dob: formatDate(profileSource?.dob) || notRecorded,
      gender: profileSource?.gender || notRecorded,
      address: profileSource?.address || notRecorded,
      postalCode: profileSource?.postal_code || notRecorded,
      unitNumber: profileSource?.unit_number || profileSource?.unit_no || notRecorded,
      phone: profileSource?.phone_number || profileSource?.contact || notRecorded,
    };
  }, [profileSource, t, i18n.language]);

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
      <Header title={t('profile.myProfile')} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('profile.personalDetails')}</Text>
          {renderInfoRow('person-outline', t('profile.fullName'), details.fullName)}
          {renderInfoRow('calendar-outline', t('profile.dateOfBirth'), details.dob)}
          {renderInfoRow('male-female-outline', t('profile.gender'), details.gender)}
          {renderInfoRow('home-outline', t('profile.address'), details.address)}
          {renderInfoRow('mail-outline', t('profile.postalCode'), details.postalCode)}
          {renderInfoRow('business-outline', t('profile.unitNumber'), details.unitNumber)}
          {renderInfoRow('call-outline', t('profile.phone'), details.phone)}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('profile.medicalConditions')}</Text>
          {medicalConditions.length ? (
            medicalConditions.map((condition, index) => (
              <View key={`condition-${condition?.condition_id || index}`} style={styles.groupBlock}>
                <Text style={styles.groupTitle}>{t('profile.conditionNumber', { number: index + 1 })}</Text>
                {renderInfoRow('fitness-outline', t('profile.condition'), condition?.condition_name || t('profile.notRecorded'))}
                {renderInfoRow('warning-outline', t('profile.severity'), condition?.severity_level || t('profile.notRecorded'))}
                {renderInfoRow('medical-outline', t('profile.medicationRequired'), condition?.medication_required || t('profile.notRecorded'))}
                {renderInfoRow('calendar-outline', t('profile.diagnosed'), formatDate(condition?.diagnosed_date) || t('profile.notRecorded'))}
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>{t('profile.noMedicalConditions')}</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('profile.emergencyContacts')}</Text>
          {emergencyContacts.length ? (
            emergencyContacts.map((contact, index) => {
              const relationship = contact?.relationship_to_senior || '';
              const displayRelationship = RELATIONSHIPS.includes(relationship)
                ? t(RELATIONSHIP_TRANSLATION_KEYS[relationship])
                : (relationship || t('profile.notRecorded'));

              return (
                <View key={`nok-${contact?.nok_id || index}`} style={styles.groupBlock}>
                  <Text style={styles.groupTitle}>{t('profile.contactNumber', { number: index + 1 })}</Text>
                  {renderInfoRow('person-outline', t('profile.name'), contact?.full_name || t('profile.notRecorded'))}
                  {renderInfoRow('people-outline', t('profile.relationship'), displayRelationship)}
                  {renderInfoRow('call-outline', t('profile.phone'), contact?.phone_number || t('profile.notRecorded'))}
                  {renderInfoRow('mail-outline', t('profile.email'), contact?.email || t('profile.notRecorded'))}
                </View>
              );
            })
          ) : (
            <Text style={styles.emptyText}>{t('profile.noEmergencyContacts')}</Text>
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
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 8,
  },
  emptyText: {
    color: '#6B7280',
    fontSize: 15,
    fontWeight: '700',
  },
});
