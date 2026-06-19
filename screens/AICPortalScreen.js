import React, { useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';

const STAFF_POOL = [
  { id: 'aic-1', name: 'AIC Staff Amanda', role: 'Case Lead' },
  { id: 'aic-2', name: 'AIC Staff Kumar', role: 'Field Visit' },
  { id: 'aic-3', name: 'AIC Staff Nurul', role: 'Family Liaison' },
];

const getSeniorId = (senior, fallback) => senior?.senior_id || senior?.id || fallback + 1;

const getSeniorName = (senior) =>
  senior?.full_name ||
  senior?.User_Account?.full_name ||
  senior?.user?.full_name ||
  'Unknown Senior';

const getStatusTag = (senior, missedCount, hasEscalation) => {
  const raw = `${senior?.status || senior?.checkin_status || senior?.health_status || ''}`.toLowerCase();
  if (hasEscalation || /urgent|critical|fall|emergency|alert/.test(raw)) return 'Urgent';
  if (missedCount > 0 || /missed|overdue/.test(raw)) return 'Missed';
  if (/checked|ok|safe|completed/.test(raw)) return 'Stable';
  return 'Pending';
};

const formatDateTime = (value) => {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not recorded';
  return date.toLocaleString('en-SG', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function AICPortalScreen({
  seniors = [],
  checkIns = [],
  emergencyEvents = [],
  authenticatedUser = {},
  onLogout,
}) {
  const [selectedCaseId, setSelectedCaseId] = useState(null);
  const [activeFilter, setActiveFilter] = useState('All');
  const currentStaffName =
    authenticatedUser?.full_name ||
    authenticatedUser?.name ||
    authenticatedUser?.email ||
    'AIC Staff';
  const currentStaff =
    STAFF_POOL.find((staff) =>
      `${currentStaffName}`.toLowerCase().includes(staff.name.replace('AIC Staff ', '').toLowerCase())
    ) || { ...STAFF_POOL[0], name: currentStaffName };

  const cases = useMemo(() => {
    return seniors.map((senior, index) => {
      const seniorId = getSeniorId(senior, index);
      const seniorCheckIns = checkIns
        .filter((item) => `${item?.senior_id}` === `${seniorId}`)
        .sort((a, b) => new Date(b?.checkin_timestamp || 0) - new Date(a?.checkin_timestamp || 0));
      const seniorEvents = emergencyEvents.filter((event) => `${event?.senior_id}` === `${seniorId}`);
      const missedCount = seniorCheckIns.filter((item) =>
        `${item?.checkin_status || ''}`.toLowerCase().includes('missed')
      ).length;
      const status = getStatusTag(senior, missedCount, seniorEvents.length > 0);
      const primaryStaff = STAFF_POOL[index % STAFF_POOL.length];
      const assignedStaff = [{ ...primaryStaff, name: primaryStaff.id === currentStaff.id ? currentStaff.name : primaryStaff.name }];

      return {
        id: seniorId,
        senior,
        name: getSeniorName(senior),
        address: senior?.address || senior?.unit_number || senior?.unit_no || 'Address not recorded',
        status,
        missedCount,
        assignedStaff,
        checkInHistory: seniorCheckIns.slice(0, 4),
        notificationLogs: seniorEvents.slice(0, 3),
        actionsTaken: [
          {
            id: `${seniorId}-call`,
            label: status === 'Stable' ? 'Routine check completed' : 'Call attempted',
            time: seniorEvents[0]?.created_at || seniorEvents[0]?.event_timestamp,
          },
          {
            id: `${seniorId}-visit`,
            label: status === 'Stable' ? 'Monitoring' : 'Follow-up assigned',
            time: seniorEvents[0]?.updated_at || seniorCheckIns[0]?.checkin_timestamp,
          },
          {
            id: `${seniorId}-resolved`,
            label: status === 'Stable' ? 'Resolved' : 'Pending follow-up',
            time: seniorCheckIns[0]?.checkin_timestamp,
          },
        ],
      };
    });
  }, [seniors, checkIns, emergencyEvents, currentStaff.id, currentStaff.name]);

  const assignedCases = cases.filter((item) =>
    item.assignedStaff.some((staff) => staff.id === currentStaff.id)
  );
  const selectedCase = assignedCases.find((item) => item.id === selectedCaseId) || null;
  const urgentCount = assignedCases.filter((item) => item.status === 'Urgent').length;
  const missedCount = assignedCases.reduce((total, item) => total + item.missedCount, 0);
  const pendingCount = assignedCases.filter((item) => item.status === 'Pending').length;
  const stableCount = assignedCases.filter((item) => item.status === 'Stable').length;
  const filterOptions = [
    { key: 'All', label: `All (${assignedCases.length})` },
    { key: 'Urgent', label: `Urgent (${urgentCount})` },
    { key: 'Missed', label: `Missed (${assignedCases.filter((item) => item.status === 'Missed').length})` },
    { key: 'Pending', label: `Pending (${pendingCount})` },
    { key: 'Stable', label: `Stable (${stableCount})` },
  ];
  const visibleCases =
    activeFilter === 'All'
      ? assignedCases
      : assignedCases.filter((item) => item.status === activeFilter);

  return (
    <SafeAreaView style={styles.container}>
      <Header title="AIC Portal" subtitle="Assigned seniors and escalated cases" />

      <View style={styles.filterArea}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator
          contentContainerStyle={styles.filterContent}
        >
          {filterOptions.map((filter) => (
            <TouchableOpacity
              key={filter.key}
              style={[
                styles.filterPill,
                activeFilter === filter.key && styles.filterPillActive,
              ]}
              onPress={() => {
                setActiveFilter(filter.key);
                setSelectedCaseId(null);
              }}
              activeOpacity={0.86}
            >
              <Text
                style={[
                  styles.filterText,
                  activeFilter === filter.key && styles.filterTextActive,
                ]}
              >
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.staffBanner}>
          <View>
            <Text style={styles.bannerEyebrow}>Logged in as</Text>
            <Text style={styles.bannerName}>{authenticatedUser?.full_name || authenticatedUser?.name || 'AIC Staff'}</Text>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryTile}>
            <Text style={styles.summaryNumber}>{assignedCases.length}</Text>
            <Text style={styles.summaryLabel}>Assigned cases</Text>
          </View>
          <View style={styles.summaryTile}>
            <Text style={styles.summaryNumber}>{urgentCount}</Text>
            <Text style={styles.summaryLabel}>Urgent</Text>
          </View>
          <View style={styles.summaryTile}>
            <Text style={styles.summaryNumber}>{missedCount}</Text>
            <Text style={styles.summaryLabel}>Missed checks</Text>
          </View>
        </View>

        <Text style={styles.listHeading}>Assigned senior cases</Text>
        {visibleCases.map((item) => (
          <View key={item.id}>
            <TouchableOpacity
              style={[styles.caseCard, selectedCase?.id === item.id && styles.caseCardActive]}
              onPress={() => setSelectedCaseId(selectedCase?.id === item.id ? null : item.id)}
              activeOpacity={0.86}
            >
              <View style={styles.caseTop}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.caseCopy}>
                  <Text style={styles.caseName}>{item.name}</Text>
                  <Text style={styles.caseMeta}>{item.address}</Text>
                </View>
                <View style={[styles.statusPill, styles[`status${item.status}`]]}>
                  <Text style={styles.statusText}>{item.status}</Text>
                </View>
              </View>
              <Text style={styles.assignedText}>
                Assigned: {item.assignedStaff.map((staff) => staff.name).join(', ')}
              </Text>
              <Ionicons
                name={selectedCase?.id === item.id ? 'chevron-up' : 'chevron-down'}
                size={22}
                color="#6B7280"
                style={styles.expandIcon}
              />
            </TouchableOpacity>

            {selectedCase?.id === item.id ? (
              <View style={styles.detailCard}>
                <Text style={styles.detailTitle}>{item.name}</Text>

                <View style={styles.detailSection}>
                  <Text style={styles.detailHeading}>Check-in history</Text>
                  {item.checkInHistory.length > 0 ? (
                    item.checkInHistory.map((checkIn, index) => (
                      <Text key={checkIn?.checkin_id || index} style={styles.timelineText}>
                        {formatDateTime(checkIn?.checkin_timestamp)} - {checkIn?.checkin_status || 'Recorded'}
                      </Text>
                    ))
                  ) : (
                    <Text style={styles.mutedText}>No check-in history recorded.</Text>
                  )}
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailHeading}>Missed check-ins</Text>
                  <Text style={styles.timelineText}>
                    {item.missedCount > 0
                      ? `${item.missedCount} missed check-in record(s)`
                      : 'No missed check-ins recorded'}
                  </Text>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailHeading}>Notification logs</Text>
                  {item.notificationLogs.length > 0 ? (
                    item.notificationLogs.map((event, index) => (
                      <Text key={event?.event_id || index} style={styles.timelineText}>
                        {formatDateTime(event?.created_at || event?.event_timestamp)} - {event?.event_type || 'Escalation alert'} ({event?.event_status || 'Open'})
                      </Text>
                    ))
                  ) : (
                    <Text style={styles.mutedText}>No notification logs for this senior.</Text>
                  )}
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailHeading}>Actions taken</Text>
                  {item.actionsTaken.map((action) => (
                    <Text key={action.id} style={styles.timelineText}>
                      {action.label} - {formatDateTime(action.time)}
                    </Text>
                  ))}
                </View>
              </View>
            ) : null}
          </View>
        ))}
        {visibleCases.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No cases in this filter</Text>
            <Text style={styles.mutedText}>Try another status filter above.</Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem} onPress={onLogout} activeOpacity={0.86}>
          <Ionicons name="log-out-outline" size={26} color="#6B7280" />
          <Text style={styles.navText}>Log Out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scrollContent: { padding: 20, paddingBottom: 34 },
  filterArea: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  filterContent: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 10,
  },
  filterPill: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  filterPillActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  filterText: { color: '#374151', fontSize: 15, fontWeight: '900' },
  filterTextActive: { color: '#FFFFFF' },
  staffBanner: {
    backgroundColor: '#111827',
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  bannerEyebrow: { color: '#CBD5E1', fontSize: 13, fontWeight: '800' },
  bannerName: { color: '#FFFFFF', fontSize: 21, fontWeight: '900', marginTop: 3 },
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  summaryTile: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 13,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  summaryNumber: { color: '#111827', fontSize: 26, fontWeight: '900' },
  summaryLabel: { color: '#6B7280', fontSize: 12, fontWeight: '800', marginTop: 2 },
  mutedText: { color: '#6B7280', fontSize: 14, fontWeight: '700', lineHeight: 20 },
  listHeading: { color: '#111827', fontSize: 22, fontWeight: '900', marginBottom: 10 },
  caseCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
  },
  caseCardActive: { borderColor: '#2563EB', borderWidth: 2 },
  caseTop: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarText: { color: '#3730A3', fontSize: 19, fontWeight: '900' },
  caseCopy: { flex: 1 },
  caseName: { color: '#111827', fontSize: 18, fontWeight: '900' },
  caseMeta: { color: '#6B7280', fontSize: 13, fontWeight: '700', marginTop: 3 },
  statusPill: { borderRadius: 999, paddingVertical: 6, paddingHorizontal: 9 },
  statusUrgent: { backgroundColor: '#FEE2E2' },
  statusMissed: { backgroundColor: '#FEF3C7' },
  statusPending: { backgroundColor: '#E0F2FE' },
  statusStable: { backgroundColor: '#DCFCE7' },
  statusText: { color: '#111827', fontSize: 12, fontWeight: '900' },
  assignedText: { color: '#374151', fontSize: 13, fontWeight: '700', marginTop: 10, lineHeight: 18 },
  expandIcon: { alignSelf: 'flex-end', marginTop: -22 },
  detailCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    marginTop: -4,
    marginBottom: 12,
  },
  detailTitle: { color: '#111827', fontSize: 24, fontWeight: '900' },
  detailSection: { paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  detailHeading: { color: '#111827', fontSize: 17, fontWeight: '900', marginBottom: 8 },
  timelineText: { color: '#374151', fontSize: 14, fontWeight: '700', marginBottom: 8, lineHeight: 20 },
  emptyState: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 18,
    alignItems: 'center',
  },
  emptyTitle: { color: '#111827', fontSize: 18, fontWeight: '900', marginBottom: 6 },
  bottomNav: {
    backgroundColor: '#FFFFFF',
    paddingTop: 12,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  navItem: { alignItems: 'center', minWidth: 88 },
  navText: { color: '#6B7280', fontSize: 13, marginTop: 4, fontWeight: '700' },
});
