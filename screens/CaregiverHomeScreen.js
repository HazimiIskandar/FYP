import React from 'react';
import { StyleSheet, Text, View, ScrollView, SafeAreaView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import CaregiverBottomNav from '../components/CaregiverBottomNav';
import { formatRelativeTime } from '../utils/time';

export default function CaregiverHomeScreen({
  summary = { total: 0, urgent: 0, checkedIn: 0 },
  prioritySenior = {},
  latestCheckIn = null,
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
    senior?.unit_number || senior?.unit_no || senior?.unit || senior?.unitLabel || 'Not recorded';

  // Singapore 8-digit local numbers are conventionally rendered "XXXX XYYY"
  // for readability. If the stored value is anything else (already has a
  // +65 prefix, different length, etc.) we return it untouched so we never
  // strip real formatting or invent digits.
  const formatPhoneNumber = (raw) => {
    const text = String(raw || '').replace(/\D/g, '');
    if (text.length === 8) return `${text.slice(0, 4)} ${text.slice(4)}`;
    return String(raw || '').trim();
  };

  // Emergency contact line — now shows Name + phone number together so the
  // caregiver can both identify and ring the contact without scrolling.
  // Falls back through every known source (legacy flat fields first,
  // then the NOK records App.js's refreshAll populated onto the senior),
  // and gracefully degrades to just one of the two if only one exists.
  const getContactDisplay = (senior) => {
    const primary = Array.isArray(senior?.nokContacts) && senior.nokContacts.length > 0
      ? senior.nokContacts[0]
      : null;
    const name =
      senior?.emergency_contact ||
      senior?.next_of_kin ||
      senior?.next_of_kin_name ||
      primary?.full_name ||
      null;
    const phone =
      senior?.emergency_contact_phone ||
      senior?.next_of_kin_phone ||
      primary?.phone_number ||
      null;
    const cleanName = String(name || '').trim();
    const cleanPhone = formatPhoneNumber(phone);

    if (cleanName && cleanPhone) return `${cleanName} · ${cleanPhone}`;
    if (cleanName) return cleanName;
    if (cleanPhone) return cleanPhone;
    return 'Not recorded';
  };

  const getRelationship = (senior) => {
    // The backend stores relationship_to_senior on the NOK row.
    const primary = Array.isArray(senior?.nokContacts) ? senior.nokContacts[0] : null;
    const raw = primary?.relationship_to_senior || senior?.relationship || null;
    if (!raw) return 'Not recorded';
    return String(raw).trim() || 'Not recorded';
  };

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
  const contactName = getContactDisplay(prioritySenior);
  const relationshipLabel = getRelationship(prioritySenior);
  const statusBadgeText = getStatusBadge(prioritySenior);
  // The priority card only carries weight when something actually needs
  // attention. If the top-priority senior is Checked In, swap the red
  // alarm for a calmer "everyone is accounted for" card so the caregiver
  // isn't staring at a red banner when there's nothing to act on.
  const priorityStatus = (prioritySenior?.status || '').toString().trim();
  const isCalm =
    priorityStatus === 'Checked In' || !prioritySenior?.senior_id;
  const ticketTitle = activeTicket?.title || activeTicket?.event_name || 'Missed check-in';
  const ticketId = activeTicket?.id || activeTicket?.ticket_id || activeTicket?.event_id || 'INC0016767';
  // Ticket update is the SGT-aware formatted version of the emergency
  // event time (or legacy string field). Falls back to the original
  // hardcoded placeholder only when both the timestamp AND every string
  // field are missing — so a caregiver who has a real emergency ticket
  // always sees something better than a fake "10 minutes ago".
  const ticketRawTimestamp =
    activeTicket?.created_at || activeTicket?.timestamp || activeTicket?.event_time;
  const ticketUpdate =
    formatRelativeTime(ticketRawTimestamp) ||
    activeTicket?.last_update ||
    activeTicket?.updated_at ||
    activeTicket?.time ||
    '10 minutes ago';
  const latestCheckInRelative = formatRelativeTime(
    latestCheckIn?.checkin_timestamp,
    'No check-in yet'
  );

  return (
    <SafeAreaView style={styles.container}>
      <Header 
        title="Caregiver Portal" 
        subtitle="Priority alerts and senior wellbeing" 
        badge={
          <View style={{ backgroundColor: '#DBEAFE', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4 }}>
            <Ionicons name="medical" size={14} color="#1D4ED8" />
            <Text style={{ color: '#1D4ED8', fontSize: 12, fontWeight: '700', letterSpacing: 0.5 }}>CAREGIVER</Text>
          </View>
        }
      />

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

        {isCalm ? (
          <View style={styles.calmCard}>
            <View style={styles.calmHeader}>
              <Ionicons name="checkmark-circle" size={48} color="#16A34A" />
            </View>
            <Text style={styles.calmTitle}>
              {summary.total > 0
                ? 'Every senior has checked in today'
                : 'No seniors assigned yet'}
            </Text>
          </View>
        ) : (
        <View style={styles.priorityCard}>
          <View style={styles.priorityHeader}>
            <Ionicons name="alert-circle" size={26} color="#DC2626" />
            <Text style={styles.priorityTitle}>🚨 Immediate Action Required</Text>
          </View>

          <View style={styles.infoCard}>
            <View style={styles.infoCopy}>
              <Text style={styles.cardEyebrow}>Priority senior</Text>
              <Text style={styles.name} numberOfLines={2} ellipsizeMode="tail">{`${seniorName}${seniorAge ? ` (Age: ${seniorAge})` : ''}`}</Text>
              {/* Each label sits on its own line — no numberOfLines so long
                  "Not recorded" placeholders stay readable on small phones
                  and at the larger FontSizeContext scales. Each Text also
                  uses flexShrink: 1 so a long emergency-contact name wraps
                  gracefully into the line instead of pushing siblings off
                  the right edge. */}
              <Text style={styles.metaLine}>
                <Text style={styles.metaLabel}>Unit: </Text>
                <Text style={styles.metaValue}>{seniorUnit}</Text>
              </Text>
              <Text style={styles.metaLine}>
                <Text style={styles.metaLabel}>Emergency contact: </Text>
                <Text style={styles.metaValue}>{contactName}</Text>
              </Text>
              <Text style={styles.metaLine}>
                <Text style={styles.metaLabel}>Relationship: </Text>
                <Text style={styles.metaValue}>{relationshipLabel}</Text>
              </Text>
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
            {/* Active emergency ticket update time — preserved alongside
                the new "Latest check-in" line so a live incident never
                gets lost when we add the check-in timestamp. */}
            <Text style={styles.ticketMeta}>Ticket updated: {ticketUpdate}</Text>
            <Text style={styles.ticketMeta}>
              Latest check-in: {latestCheckInRelative}
            </Text>
          </View>

          <TouchableOpacity style={styles.callButton} onPress={onCallEmergencyContact} activeOpacity={0.86}>
            <Ionicons name="call" size={24} color="#FFFFFF" />
            <Text style={styles.callButtonText}>Call emergency contact</Text>
          </TouchableOpacity>
        </View>
        )}
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
  // Calm state — green border + large green checkmark + calm copy.
  // Replaces the red priority card when nothing is urgent and the top
  // senior has checked in (or no seniors are linked yet).
  calmCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 50,
    paddingHorizontal: 26,
    borderWidth: 1,
    borderColor: '#5ac392',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#065F46',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  calmHeader: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  calmTitle: {
    color: '#065F46',
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
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
  // Long names used to expand this inner View and push the status badge
  // (and the call button below it) off-screen. Constrain it with flex:1
  // + minWidth:0 so a long name ellipsizes inside the row instead.
  infoCopy: { flex: 1, flexShrink: 1, minWidth: 0 },
  name: { color: '#111827', fontSize: 24, fontWeight: '900', flexShrink: 1 },
  // The 3 stacked meta lines (Unit / Emergency contact / Relationship).
  // No numberOfLines so "Not recorded" placeholders stay intact on
  // small-screen devices and at the larger FontSizeContext scales.
  metaLine: { color: '#4B5563', fontSize: 15, marginTop: 4, flexShrink: 1 },
  metaLabel: { color: '#6B7280', fontWeight: '800', flexShrink: 1 },
  metaValue: { color: '#111827', fontWeight: '700', flexShrink: 1 },
  // (Previously a single `meta` style with numberOfLines={1} lived here.
  // It was removed when the meta block was split into the 3 explicit
  // labelled lines below so a long emergency-contact name or a "Not
  // recorded" placeholder never got cut off.)
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
    paddingHorizontal: 12,
    alignSelf: 'stretch',
  },
  callButtonText: { color: '#FFFFFF', fontSize: 19, fontWeight: '900', flexShrink: 1 },
});
