import React from 'react';
import { StyleSheet, Text, View, SafeAreaView, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import CaregiverBottomNav from '../components/CaregiverBottomNav';

export default function SeniorDetailsScreen({ senior, medicalConditions = [], onGoBack, onGoToHome, onLogout }) {
  const name = senior?.full_name || 'Unknown Senior';
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

          <View style={[styles.statusBadge, { backgroundColor: getStatusColor() }]}>
            <Text style={styles.statusText}>
              {senior?.status || 'Pending'}
            </Text>
          </View>
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

          <View style={styles.row}>
            <Ionicons name="person-outline" size={18} color="#6B7280" />
            <Text style={styles.rowText}>
              {senior?.emergencyContact?.name || 'Not available'}
            </Text>
          </View>

          <View style={styles.row}>
            <Ionicons name="call-outline" size={18} color="#6B7280" />
            <Text style={styles.rowText}>
              {senior?.emergencyContact?.phone || 'Not available'}
            </Text>
          </View>
        </View>

        {/* ACTION BUTTONS */}
        <TouchableOpacity style={styles.emergencyBtn} onPress={handleEmergency}>
          <Ionicons name="alert-circle" size={20} color="#fff" />
          <Text style={styles.emergencyText}>Trigger Emergency</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.backBtn} onPress={onGoBack}>
          <Text style={styles.backText}>Go Back</Text>
        </TouchableOpacity>

      </ScrollView>

      <CaregiverBottomNav
        activeTab="Seniors"
        onHome={onGoToHome}
        onSeniors={() => { }}
        onLogout={onLogout}
      />

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

  backBtn: {
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#696969',
    marginTop: 10,
  },

  backText: {
    fontWeight: '900',
    color: '#111827',
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
});