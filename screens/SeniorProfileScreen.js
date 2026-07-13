import React, { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import Header from '../components/Header';
import SeniorBottomNav from '../components/SeniorBottomNav';
import { useFontScale } from '../context/FontSizeContext';
import { Modal, Pressable } from 'react-native';
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
  // Set by App.js when the linkage summary endpoint reports
  // `is_fully_linked = false`. When true the screen surfaces a yellow
  // warning popup (in the same color family as Tailwind yellow-50 +
  // amber accent) explaining the user must finish setup with their
  // caregiver before the rest of the app is usable. The Popup is
  // auto-shown on mount but dismissable so the user can still browse
  // the "Not recorded" details themselves.
  isLinkageIncomplete = false,
  // Forwarded to SeniorBottomNav via prop so the bottom navigation
  // also hides the Community tab from this screen, keeping the
  // restriction consistent across the tabs the senior CAN reach
  // (Home / Profile / Settings).
  restrictedMode = false,
  // Visibility of the yellow warning popup. App.js owns both this
  // flag and the dismissal-across-navigation state so the modal
  // doesn't pop back up the moment the senior moves between tabs.
  showLinkageWarning = false,
  // Called when the user taps OK on the yellow popup. Persists in
  // App.js for the rest of the session (cleared on logout) so a
  // second Profile visit doesn't re-pop the modal.
  onDismissLinkageWarning,
}) {
  const { t, i18n } = useTranslation();
  const { fontScale } = useFontScale();
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
  // Yellow popup visibility is now fully controlled by App.js via
  // the showLinkageWarning prop + onDismissLinkageWarning callback.
  // Keeping a local fallback for tests/snapshots: if App.js doesn't
  // pass the new prop name, fall back to the older isLinkageIncomplete
  // behaviour so an out-of-date parent doesn't break the popup.
  const showSetupNotice = typeof showLinkageWarning === 'boolean'
    ? showLinkageWarning
    : Boolean(isLinkageIncomplete);
  const dismissSetupNotice = () => {
    if (typeof onDismissLinkageWarning === 'function') {
      onDismissLinkageWarning();
    }
  };
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
        <Text style={[styles.infoLabel, { fontSize: 15 * fontScale }]}>{label}</Text>
        <Text style={[styles.infoValue, { fontSize: 16 * fontScale }]}>{value}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Header title={t('profile.myProfile')} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <Text style={[styles.cardTitle, { fontSize: 18 * fontScale }]}>{t('profile.personalDetails')}</Text>
          {renderInfoRow('person-outline', t('profile.fullName'), details.fullName)}
          {renderInfoRow('calendar-outline', t('profile.dateOfBirth'), details.dob)}
          {renderInfoRow('male-female-outline', t('profile.gender'), details.gender)}
          {renderInfoRow('home-outline', t('profile.address'), details.address)}
          {renderInfoRow('mail-outline', t('profile.postalCode'), details.postalCode)}
          {renderInfoRow('business-outline', t('profile.unitNumber'), details.unitNumber)}
          {renderInfoRow('call-outline', t('profile.phone'), details.phone)}
        </View>

        <View style={styles.card}>
          <Text style={[styles.cardTitle, { fontSize: 18 * fontScale }]}>{t('profile.medicalConditions')}</Text>
          {medicalConditions.length ? (
            medicalConditions.map((condition, index) => (
              <View key={`condition-${condition?.condition_id || index}`} style={styles.groupBlock}>
                <Text style={[styles.groupTitle, { fontSize: 16 * fontScale }]}>{t('profile.conditionNumber', { number: index + 1 })}</Text>
                {renderInfoRow('fitness-outline', t('profile.condition'), condition?.condition_name || t('profile.notRecorded'))}
                {renderInfoRow('warning-outline', t('profile.severity'), condition?.severity_level || t('profile.notRecorded'))}
                {renderInfoRow('medical-outline', t('profile.medicationRequired'), condition?.medication_required || t('profile.notRecorded'))}
                {renderInfoRow('calendar-outline', t('profile.diagnosed'), formatDate(condition?.diagnosed_date) || t('profile.notRecorded'))}
              </View>
            ))
          ) : (
            <Text style={[styles.emptyText, { fontSize: 15 * fontScale }]}>{t('profile.noMedicalConditions')}</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={[styles.cardTitle, { fontSize: 18 * fontScale }]}>{t('profile.emergencyContacts')}</Text>
          {emergencyContacts.length ? (
            emergencyContacts.map((contact, index) => {
              const relationship = contact?.relationship_to_senior || '';
              const displayRelationship = RELATIONSHIPS.includes(relationship)
                ? t(RELATIONSHIP_TRANSLATION_KEYS[relationship])
                : (relationship || t('profile.notRecorded'));

              return (
                <View key={`nok-${contact?.nok_id || index}`} style={styles.groupBlock}>
                  <Text style={[styles.groupTitle, { fontSize: 16 * fontScale }]}>{t('profile.contactNumber', { number: index + 1 })}</Text>
                  {renderInfoRow('person-outline', t('profile.name'), contact?.full_name || t('profile.notRecorded'))}
                  {renderInfoRow('people-outline', t('profile.relationship'), displayRelationship)}
                  {renderInfoRow('call-outline', t('profile.phone'), contact?.phone_number || t('profile.notRecorded'))}
                  {renderInfoRow('mail-outline', t('profile.email'), contact?.email || t('profile.notRecorded'))}
                </View>
              );
            })
          ) : (
            <Text style={[styles.emptyText, { fontSize: 15 * fontScale }]}>{t('profile.noEmergencyContacts')}</Text>
          )}
        </View>
      </ScrollView>

      <SeniorBottomNav
        activeTab="Profile"
        onHome={onHome}
        onCommunity={onCommunity}
        onProfile={() => {}}
        onSettings={onSettings}
        restrictedMode={restrictedMode}
      />

      {showSetupNotice ? (
        <Modal transparent animationType="fade" visible={true} onRequestClose={dismissSetupNotice}>
          <View style={styles.setupNoticeModal}>
            <Pressable style={styles.setupNoticeBackdrop} onPress={dismissSetupNotice} />
            <View style={styles.setupNoticeCard}>
              <View style={styles.setupNoticeIconRow}>
                <Ionicons name="warning" size={26} color="#92400E" />
              </View>
              <Text style={[styles.setupNoticeText, { fontSize: 16 * fontScale }]}>
                {t('profile.setupRequiredNotice')}
              </Text>
              <TouchableOpacity
                style={styles.setupNoticeOkButton}
                onPress={dismissSetupNotice}
                activeOpacity={0.86}
                accessibilityRole="button"
                accessibilityLabel={t('profile.setupRequiredOk')}
              >
                <Text style={[styles.setupNoticeOkText, { fontSize: 17 * fontScale }]}>{t('profile.setupRequiredOk')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      ) : null}
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

  // ----- Styles for the linkage-incomplete yellow warning popup (Profile only) -----
  // Tailwind yellow-50 (#FEFCE8) for the card body, amber-400 (#FBBF24) as
  // a top accent stripe, and amber-900 (#92400E) for the warning icon +
  // body text so the message reads with strong contrast despite the
  // pale background. The "OK" button inverts to amber-400 + white text
  // so it mirrors how SeniorSettingsScreen / Community already style
  // their confirm-step primary buttons.
  setupNoticeModal: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 22,
  },
  setupNoticeBackdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  setupNoticeCard: {
    width: '100%',
    backgroundColor: '#FEFCE8',
    borderRadius: 18,
    borderTopWidth: 4,
    borderTopColor: '#FBBF24',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#FCD34D',
    paddingVertical: 20,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  setupNoticeIconRow: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FDE68A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  setupNoticeText: {
    color: '#92400E',
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  setupNoticeOkButton: {
    backgroundColor: '#FBBF24',
    borderRadius: 16,
    minHeight: 54,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setupNoticeOkText: {
    color: '#FFFFFF',
    fontWeight: '900',
    textAlign: 'center',
  },
});
