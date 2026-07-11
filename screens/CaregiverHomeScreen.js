import React from 'react';
import { StyleSheet, Text, View, ScrollView, SafeAreaView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import CaregiverBottomNav from '../components/CaregiverBottomNav';

export default function CaregiverHomeScreen({
  summary = { total: 0, urgent: 0, checkedIn: 0 },
  prioritySenior = {},
  activeTicket = {},
  onCallEmergencyContact = () => {},
  onGoToSeniorsList,
  onGoToRoster,
  onSettings,
}) {
  const getDisplayName = (senior) => {
    if (!senior) return 'Unknown Senior';
    if (senior.full_name) return senior.full_name;
    if (senior.name) return senior.name;
    const firstName = senior.first_name || senior.firstName || '';
    const lastName = senior.last_name || senior.lastName || '';
    const combined = `${firstName} ${lastName}`.trim();
    return combined || 'Unknown Senior';
  };

  const getUnitLabel = (senior) =>
    senior?.unit_number || senior?.unit_no || senior?.unit || senior?.unitLabel || '#04-12';

  const getContactName = (senior) =>
    senior?.emergency_contact || senior?.next_of_kin || senior?.next_of_kin_name || 'Adrian Tan';

  const getStatusBadge = (senior) => {
    const raw = `${senior?.status || senior?.checkin_status || senior?.health_status || ''}`.toLowerCase();
    if (/urgent|critical|fall/.test(raw)) return 'Monitor';
    if (/pending|waiting|follow/.test(raw)) return 'Pending';
    if (/checked|safe|ok|stable/.test(raw)) return 'Stable';
    return 'Monitor';
  };

  const getSeniorAge = (senior) => {
    if (!senior) return null;
    if (senior?.age !== undefined && senior?.age !== null) return senior.age;
    if (senior?.age_range) return senior.age_range;

    const dob = senior?.dob;
    if (!dob) return null;

    const birthDate = new Date(dob);
    if (isNaN(birthDate.getTime())) return null;

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }
    return age;
  };

  const seniorName = getDisplayName(prioritySenior);
  const seniorAge = getSeniorAge(prioritySenior) ?? '';
  const seniorUnit = getUnitLabel(prioritySenior);
  const contactName = getContactName(prioritySenior);
  const statusBadgeText = getStatusBadge(prioritySenior);
  const ticketTitle = activeTicket?.title || activeTicket?.event_name || 'Missed check-in';
  const ticketId = activeTicket?.id || activeTicket?.ticket_id || activeTicket?.event_id || 'INC0016767';
  const ticketUpdate = activeTicket?.last_update || activeTicket?.updated_at || activeTicket?.time || '10 minutes ago';

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Caregiver Portal" subtitle="Priority alerts and senior wellbeing" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryTile}>
            <Text style={styles.summaryNumber}>{summary.urgent}</Text>
            <Text style={styles.summaryLabel}>Urgent</Text>
          </View>
          <View style={styles.summaryTile}>
            <Text style={styles.summaryNumber}>{summary.checkedIn}/{summary.total}</Text>
            <Text style={styles.summaryLabel}>Checked in</Text>
          </View>
        </View>

        <View style={styles.priorityCard}>
          <View style={styles.priorityHeader}>
            <Ionicons name="alert-circle" size={26} color="#DC2626" />
            <Text style={styles.priorityTitle}>🚨 Immediate Action Required</Text>
          </View>

          <View style={styles.infoCard}>
            <View>
              <Text style={styles.cardEyebrow}>Priority senior</Text>
              <Text style={styles.name}>{`${seniorName}${seniorAge ? ` (Age: ${seniorAge})` : ''}`}</Text>
              <Text style={styles.meta}>{`Unit ${seniorUnit} | ${contactName}`}</Text>
            </View>
            <View style={styles.statusBadge}>
              <Text style={styles.statusBadgeText}>{statusBadgeText}</Text>
            </View>
          </View>

          <View style={styles.ticketActive}>
            <View style={styles.ticketHeader}>
              <Ionicons name="warning" size={24} color="#DC2626" />
              <Text style={styles.ticketTitle}>{ticketTitle}</Text>
            </View>
            <Text style={styles.ticketMeta}>Ticket ID: {ticketId}</Text>
            <Text style={styles.ticketMeta}>Last update: {ticketUpdate}</Text>
          </View>

          <TouchableOpacity style={styles.callButton} onPress={onCallEmergencyContact} activeOpacity={0.86}>
            <Ionicons name="call" size={24} color="#FFFFFF" />
            <Text style={styles.callButtonText}>Call emergency contact</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <CaregiverBottomNav
        activeTab="Home"
        onHome={() => {}}
        onSeniors={onGoToSeniorsList}
        onStatus={onGoToRoster}
        onSettings={onSettings}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scrollContent: { padding: 20, paddingBottom: 28 },
  summaryRow: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  summaryTile: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  summaryNumber: { color: '#111827', fontSize: 30, fontWeight: '900' },
  summaryLabel: { color: '#6B7280', fontSize: 14, fontWeight: '800', marginTop: 2 },
  priorityCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    elevation: 3,
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  priorityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  priorityTitle: { color: '#B91C1C', fontSize: 21, fontWeight: '900', flex: 1 },
  infoCard: {
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardEyebrow: { color: '#6B7280', fontSize: 13, fontWeight: '800', marginBottom: 4 },
  name: { color: '#111827', fontSize: 24, fontWeight: '900' },
  meta: { color: '#4B5563', fontSize: 15, marginTop: 4 },
  statusBadge: { backgroundColor: '#FEF3C7', borderRadius: 16, paddingVertical: 7, paddingHorizontal: 10 },
  statusBadgeText: { color: '#92400E', fontSize: 13, fontWeight: '900' },
  ticketActive: {
    backgroundColor: '#FEF2F2',
    padding: 16,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#FCA5A5',
    marginBottom: 14,
  },
  ticketHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  ticketTitle: { color: '#B91C1C', fontSize: 21, fontWeight: '900' },
  ticketMeta: { color: '#4B5563', fontSize: 16, marginTop: 4 },
  callButton: {
    backgroundColor: '#2563EB',
    minHeight: 68,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  callButtonText: { color: '#FFFFFF', fontSize: 19, fontWeight: '900' },
});
