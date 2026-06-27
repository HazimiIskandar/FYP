import React, { useState } from 'react';
import { StyleSheet, Text, View, SafeAreaView, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import CaregiverBottomNav from '../components/CaregiverBottomNav';

export default function SeniorDetailsScreen({
  senior,
  medicalConditions = [],
  showStatusBadge = true,
  onGoBack,
  onGoToHome,
  onGoToSeniorsList,
  onGoToStatus,
  onGoToEditMenu,
  onSettings,
  apiBase,
  authenticatedUser,
  onRefresh,
}) {
  const [removeConfirmVisible, setRemoveConfirmVisible] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [settingsError, setSettingsError] = useState('');
  console.log('=== SENIOR DETAILS SCREEN MOUNTED ===');
  console.log('Senior prop received:', JSON.stringify(senior, null, 2));
  console.log('Medical conditions prop:', medicalConditions);
  
  const name =
    senior?.full_name ||
    'Unknown Senior';
  const initial = name.charAt(0).toUpperCase();

  const status = (senior?.status || 'Pending').toLowerCase();

  const getStatusColor = () => {
    if (status.includes('urgent') || status.includes('critical')) return '#DC2626';
    if (status.includes('missed')) return '#F59E0B';
    if (status.includes('checked')) return '#16A34A';
    return '#6B7280';
  };

  const handleEmergency = () => {
    Alert.alert(
      "Emergency Alert",
      `Trigger emergency for ${name}?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Confirm", style: "destructive", onPress: () => console.log("Emergency sent") }
      ]
    );
  };

  const formatDate = (date) => {
    if (!date) return 'Not recorded';
    return new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  // prefer explicit prop, fall back to `senior.medicalConditions` set by App
  const conditions =
    (Array.isArray(medicalConditions) && medicalConditions.length > 0)
      ? medicalConditions
      : Array.isArray(senior?.medicalConditions)
        ? senior.medicalConditions
        : [];

  const nokContacts = Array.isArray(senior?.nokContacts) ? senior.nokContacts : [];

  const confirmRemoveSenior = async () => {
    if (!apiBase || !senior?.senior_id || !authenticatedUser?.user_id) return;
    setRemoving(true);
    setSettingsError('');
    try {
      const response = await fetch(`${apiBase}/seniors/${senior.senior_id}/caregivers/${authenticatedUser.user_id}`, {
        method: 'DELETE',
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error || 'Failed to remove senior.');
      }
      setRemoveConfirmVisible(false);
      if (onRefresh) onRefresh();
      onGoToSeniorsList();
    } catch (err) {
      setSettingsError(err?.message || 'Unable to remove senior.');
    } finally {
      setRemoving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>

      <Header title="Senior Profile" subtitle="Care details & status overview" />

      <ScrollView contentContainerStyle={styles.scrollContent}>

        {/* PROFILE CARD */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>

          <View style={styles.profileInfo}>
            <Text style={styles.name}>{name}</Text>
          </View>

          {showStatusBadge ? (
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor() }]}>
              <Text style={styles.statusText}>
                {senior?.status || 'Pending'}
              </Text>
            </View>
          ) : null}
        </View>

        {/* PERSONAL DETAILS CARD */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Personal Details</Text>

          <View style={styles.row}>
            <Ionicons name="calendar-outline" size={18} color="#6B7280" />
            <Text style={styles.rowText}>
              Date-of-Birth: {formatDate(senior?.dob)}
            </Text>
          </View>

          <View style={styles.row}>
            <Ionicons name="person-outline" size={18} color="#6B7280" />
            <Text style={styles.rowText}>
              Gender: {senior?.gender || 'Not recorded'}
            </Text>
          </View>

          <View style={styles.row}>
            <Ionicons name="home-outline" size={18} color="#6B7280" />
            <Text style={styles.rowText}>
              Address: {senior?.address || 'Not recorded'}
            </Text>
          </View>

          <View style={styles.row}>
            <Ionicons name="mail-outline" size={18} color="#6B7280" />
            <Text style={styles.rowText}>
              Postal Code: {senior?.postal_code || 'Not recorded'}
            </Text>
          </View>

          <View style={styles.row}>
            <Ionicons name="business-outline" size={18} color="#6B7280" />
            <Text style={styles.rowText}>
              Unit Number: {senior?.unit_number || senior?.unit_no || 'Not recorded'}
            </Text>
          </View>

          <View style={styles.row}>
            <Ionicons name="call-outline" size={18} color="#6B7280" />
            <Text style={styles.rowText}>
              Phone: {senior?.phone_number || senior?.contact || 'Not recorded'}
            </Text>
          </View>
        </View>

        {/* MEDICAL CONDITIONS */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Medical Conditions</Text>

          {conditions.length > 0 ? (
            conditions.map((condition, index) => (
              <View key={condition.condition_id || index} style={styles.conditionBlock}>

                <View style={styles.row}>
                  <Ionicons name="fitness-outline" size={18} color="#6B7280" />
                  <Text style={styles.rowText}>
                    Condition: {condition.condition_name || 'Not recorded'}
                  </Text>
                </View>

                <View style={styles.row}>
                  <Ionicons name="warning-outline" size={18} color="#6B7280" />
                  <Text style={styles.rowText}>
                    Severity: {condition.severity_level || 'Not recorded'}
                  </Text>
                </View>

                <View style={styles.row}>
                  <Ionicons name="medical-outline" size={18} color="#6B7280" />
                  <Text style={styles.rowText}>
                    Medication Required: {condition.medication_required || 'Not recorded'}
                  </Text>
                </View>

                <View style={styles.row}>
                  <Ionicons name="calendar-outline" size={18} color="#6B7280" />
                  <Text style={styles.rowText}>
                    Diagnosed: {formatDate(condition.diagnosed_date)}
                  </Text>
                </View>
                
                {/* divider only between items */}
                {index !== conditions.length - 1 && (
                  <View style={styles.conditionDivider} />
                )}

              </View>
            ))
          ) : (
            <View style={styles.row}>
              <Ionicons name="alert-circle-outline" size={18} color="#6B7280" />
              <Text style={styles.rowText}>
                No medical conditions recorded
              </Text>
            </View>
          )}
        </View>

        {/* EMERGENCY CONTACT */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Emergency Contact</Text>

          {nokContacts.length > 0 ? (
            nokContacts.map((nok, index) => (
              <View key={nok.nok_id || index} style={styles.nokBlock}>

                <View style={styles.row}>
                  <Ionicons name="person-outline" size={18} color="#6B7280" />
                  <Text style={styles.rowText}>
                    {nok.full_name || 'Not available'} ({nok.relationship_to_senior || 'N/A'})
                  </Text>
                </View>

                <View style={styles.row}>
                  <Ionicons name="call-outline" size={18} color="#6B7280" />
                  <Text style={styles.rowText}>
                    {nok.phone_number || 'Not available'}
                  </Text>
                </View>

                {nok.email && (
                  <View style={styles.row}>
                    <Ionicons name="mail-outline" size={18} color="#6B7280" />
                    <Text style={styles.rowText}>
                      {nok.email}
                    </Text>
                  </View>
                )}

                {nok.address && (
                  <View style={styles.row}>
                    <Ionicons name="home-outline" size={18} color="#6B7280" />
                    <Text style={styles.rowText}>
                      {nok.address}
                    </Text>
                  </View>
                )}

                {index !== nokContacts.length - 1 && (
                  <View style={styles.conditionDivider} />
                )}

              </View>
            ))
          ) : (
            <View style={styles.row}>
              <Ionicons name="alert-circle-outline" size={18} color="#6B7280" />
              <Text style={styles.rowText}>
                No emergency contact recorded
              </Text>
            </View>
          )}
        </View>

        <TouchableOpacity style={styles.updateBtn} onPress={onGoToEditMenu}>
          <Text style={styles.updateBtnText}>Update Senior Profile</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.removeBtn} onPress={() => setRemoveConfirmVisible(true)}>
          <Text style={styles.removeBtnText}>Remove Senior</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.backBtn} onPress={onGoBack}>
          <Text style={styles.backText}>Go Back</Text>
        </TouchableOpacity>

      </ScrollView>

      <CaregiverBottomNav
        activeTab="Seniors"
        onHome={onGoToHome}
        onSeniors={onGoToSeniorsList}
        onStatus={onGoToStatus}
        onSettings={onSettings}
      />

      {removeConfirmVisible ? (
        <View style={styles.modalOverlay}>
          <View style={styles.confirmCard}>
            <View style={styles.confirmIcon}>
              <Ionicons name="warning" size={32} color="#DC2626" />
            </View>
            <Text style={styles.confirmTitle}>Remove Senior?</Text>
            <Text style={styles.confirmMessage}>
              Are you sure you want to stop monitoring {name}? This action cannot be undone.
            </Text>
            {settingsError ? <Text style={styles.errorText}>{settingsError}</Text> : null}
            <TouchableOpacity
              style={[styles.dangerButton, removing && { opacity: 0.6 }]}
              onPress={confirmRemoveSenior}
              disabled={removing}
            >
              <Text style={styles.dangerButtonText}>
                {removing ? 'Removing...' : 'Yes, Remove Senior'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setRemoveConfirmVisible(false)}
              disabled={removing}
            >
              <Text style={styles.cancelButtonText}>No, Keep Monitoring</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },

  scrollContent: {
    padding: 20,
    paddingBottom: 30,
  },

  // PROFILE CARD (similar to rosterCard style)
  profileCard: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#696969',
    marginBottom: 14,
  },

  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  avatarText: {
    color: '#B91C1C',
    fontSize: 22,
    fontWeight: '900',
  },

  profileInfo: {
    flex: 1,
  },

  name: {
    fontSize: 22,
    fontWeight: '900',
    color: '#111827',
  },

  sub: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
    fontWeight: '600',
  },

  statusBadge: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
  },

  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
  },

  // INFO CARDS
  card: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#696969',
    marginBottom: 12,
  },

  cardTitle: {
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 10,
    color: '#111827',
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },

  rowText: {
    marginLeft: 10,
    fontSize: 14,
    color: '#374151',
    fontWeight: '600',
  },

  // BUTTONS
  emergencyBtn: {
    backgroundColor: '#DC2626',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 14,
    borderRadius: 18,
    marginTop: 10,
  },

  emergencyText: {
    color: '#fff',
    fontWeight: '900',
    marginLeft: 8,
  },

  updateBtn: {
    backgroundColor: '#111827',
    minHeight: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },

  updateBtnText: {
    fontWeight: '900',
    color: '#FFFFFF',
    fontSize: 16,
  },

  removeBtn: {
    backgroundColor: '#DC2626',
    minHeight: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },

  removeBtnText: {
    fontWeight: '900',
    color: '#FFFFFF',
    fontSize: 16,
  },

  backBtn: {
    backgroundColor: '#2563EB',
    minHeight: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },

  backText: {
    fontWeight: '900',
    color: '#FFFFFF',
    fontSize: 16,
  },

  conditionItem: {
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },

  conditionName: {
    fontSize: 15,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 2,
  },

  conditionMeta: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '600',
    marginTop: 2,
  },

  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  conditionDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 10,
  },
  conditionBlock: {
    marginBottom: 6,
  },
  nokBlock: {
    marginBottom: 6,
  },
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
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  confirmTitle: { color: '#111827', fontSize: 27, fontWeight: '900', textAlign: 'center' },
  confirmMessage: {
    color: '#4B5563',
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  dangerButton: {
    backgroundColor: '#DC2626',
    width: '100%',
    minHeight: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  dangerButtonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
  cancelButton: {
    backgroundColor: '#EFF6FF',
    width: '100%',
    minHeight: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: { color: '#2563EB', fontSize: 17, fontWeight: '900' },
  errorText: { color: '#DC2626', fontSize: 14, fontWeight: '800', textAlign: 'center', marginBottom: 12 },
});
