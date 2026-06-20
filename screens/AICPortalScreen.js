import React, { useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';

const STAFF_POOL = [
<<<<<<< HEAD
  { id: 'aic-1', name: 'AIC Staff Amanda' },
  { id: 'aic-2', name: 'AIC Staff Kumar' },
  { id: 'aic-3', name: 'AIC Staff Nurul' },
=======
  { id: 'aic-1', name: 'AIC Staff Amanda', role: 'Case Lead' },
  { id: 'aic-2', name: 'AIC Staff Kumar', role: 'Field Visit' },
  { id: 'aic-3', name: 'AIC Staff Nurul', role: 'Family Liaison' },
>>>>>>> b87e0623916809f1b1f00eea660c852baf58c56e
];

const getSeniorId = (senior, fallback) => senior?.senior_id || senior?.id || fallback + 1;

const getSeniorName = (senior) =>
  senior?.full_name ||
  senior?.User_Account?.full_name ||
  senior?.user?.full_name ||
  'Unknown Senior';

<<<<<<< HEAD
const formatDate = (value) => {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not recorded';
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
=======
const getStatusTag = (senior, missedCount, hasEscalation) => {
  const raw = `${senior?.status || senior?.checkin_status || senior?.health_status || ''}`.toLowerCase();
  if (hasEscalation || /urgent|critical|fall|emergency|alert/.test(raw)) return 'Urgent';
  if (missedCount > 0 || /missed|overdue/.test(raw)) return 'Missed';
  if (/checked|ok|safe|completed/.test(raw)) return 'Stable';
  return 'Pending';
>>>>>>> b87e0623916809f1b1f00eea660c852baf58c56e
};

const formatDateTime = (value) => {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not recorded';
  return date.toLocaleString('en-SG', {
    day: '2-digit',
    month: 'short',
<<<<<<< HEAD
    year: 'numeric',
=======
>>>>>>> b87e0623916809f1b1f00eea660c852baf58c56e
    hour: '2-digit',
    minute: '2-digit',
  });
};

<<<<<<< HEAD
const getRawStatus = (senior, missedCount, hasEscalation) => {
  const raw = `${senior?.status || senior?.checkin_status || senior?.health_status || ''}`.toLowerCase();
  if (hasEscalation || /urgent|critical|fall|emergency|alert/.test(raw)) return 'Urgent';
  if (missedCount > 0 || /missed|overdue/.test(raw)) return 'Missed';
  if (/checked|ok|safe|completed/.test(raw)) return 'Stable';
  return 'Pending';
};

const getRiskLevel = (status, missedCount) => {
  if (status === 'Urgent' || missedCount >= 2) return 'High';
  if (status === 'Missed' || status === 'Pending') return 'Medium';
  return 'Low';
};

const getCaseStatus = (status) => {
  if (status === 'Stable') return 'Resolved';
  if (status === 'Missed') return 'In Progress';
  return 'Open';
};

const getReason = (status, event) => {
  if (event?.event_type) return event.event_type;
  if (status === 'Urgent') return 'Fall detected';
  if (status === 'Missed') return 'Missed check-in';
  if (status === 'Stable') return 'Wellbeing check completed';
  return 'Pending follow-up';
};

=======
>>>>>>> b87e0623916809f1b1f00eea660c852baf58c56e
export default function AICPortalScreen({
  seniors = [],
  checkIns = [],
  emergencyEvents = [],
  authenticatedUser = {},
  onLogout,
}) {
  const [selectedCaseId, setSelectedCaseId] = useState(null);
  const [activeFilter, setActiveFilter] = useState('All');
<<<<<<< HEAD

=======
>>>>>>> b87e0623916809f1b1f00eea660c852baf58c56e
  const currentStaffName =
    authenticatedUser?.full_name ||
    authenticatedUser?.name ||
    authenticatedUser?.email ||
    'AIC Staff';
<<<<<<< HEAD

=======
>>>>>>> b87e0623916809f1b1f00eea660c852baf58c56e
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
<<<<<<< HEAD
      const latestEvent = seniorEvents[0] || null;
      const missedCount = seniorCheckIns.filter((item) =>
        `${item?.checkin_status || ''}`.toLowerCase().includes('missed')
      ).length;
      const sourceStatus = getRawStatus(senior, missedCount, seniorEvents.length > 0);
      const riskLevel = getRiskLevel(sourceStatus, missedCount);
      const currentStatus = getCaseStatus(sourceStatus);
      const primaryStaff = STAFF_POOL[index % STAFF_POOL.length];
      const assignedStaff = {
        ...primaryStaff,
        name: primaryStaff.id === currentStaff.id ? currentStaff.name : primaryStaff.name,
      };
      const createdAt =
        latestEvent?.created_at ||
        latestEvent?.event_timestamp ||
        seniorCheckIns[0]?.checkin_timestamp ||
        null;

      return {
        id: latestEvent?.event_id || seniorId,
        caseId: latestEvent?.event_id ? `CASE-${latestEvent.event_id}` : `CASE-${String(index + 1).padStart(3, '0')}`,
        title: `Case ${index + 1}`,
        senior,
        seniorId,
        seniorName: getSeniorName(senior),
        riskLevel,
        currentStatus,
        sourceStatus,
        reason: getReason(sourceStatus, latestEvent),
        createdAt,
        assignedStaff,
        missedCount,
=======
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
>>>>>>> b87e0623916809f1b1f00eea660c852baf58c56e
      };
    });
  }, [seniors, checkIns, emergencyEvents, currentStaff.id, currentStaff.name]);

<<<<<<< HEAD
  const assignedCases = cases.filter((item) => item.assignedStaff.id === currentStaff.id);
  const selectedCase = assignedCases.find((item) => item.id === selectedCaseId) || null;
  const filterOptions = [
    { key: 'All', label: `All (${assignedCases.length})` },
    { key: 'High', label: `High Risk (${assignedCases.filter((item) => item.riskLevel === 'High').length})` },
    { key: 'Open', label: `Open (${assignedCases.filter((item) => item.currentStatus === 'Open').length})` },
    { key: 'In Progress', label: `In Progress (${assignedCases.filter((item) => item.currentStatus === 'In Progress').length})` },
    { key: 'Resolved', label: `Resolved (${assignedCases.filter((item) => item.currentStatus === 'Resolved').length})` },
  ];

  const visibleCases =
    activeFilter === 'All'
      ? assignedCases
      : assignedCases.filter((item) => item.riskLevel === activeFilter || item.currentStatus === activeFilter);

  const highRiskCount = assignedCases.filter((item) => item.riskLevel === 'High').length;
  const openCount = assignedCases.filter((item) => item.currentStatus !== 'Resolved').length;

  if (selectedCase) {
    return (
      <CaseDetailView
        caseItem={selectedCase}
        onBack={() => setSelectedCaseId(null)}
        onLogout={onLogout}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Assigned Cases" subtitle="Sort by urgency and follow up quickly" />

      <View style={styles.filterArea}>
        <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.filterContent}>
          {filterOptions.map((filter) => (
            <TouchableOpacity
              key={filter.key}
              style={[styles.filterPill, activeFilter === filter.key && styles.filterPillActive]}
              onPress={() => setActiveFilter(filter.key)}
              activeOpacity={0.86}
            >
              <Text style={[styles.filterText, activeFilter === filter.key && styles.filterTextActive]}>
=======
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
>>>>>>> b87e0623916809f1b1f00eea660c852baf58c56e
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
<<<<<<< HEAD
        <View style={styles.alertCard}>
          <View style={styles.alertIcon}>
            <Ionicons name="alert" size={24} color="#FFFFFF" />
          </View>
          <View style={styles.alertCopy}>
            <Text style={styles.alertTitle}>{highRiskCount > 0 ? 'High Risk' : 'Pending'}</Text>
            <Text style={styles.alertSub}>{openCount} open case(s) assigned to you</Text>
          </View>
        </View>

        {visibleCases.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.caseCard}
            onPress={() => setSelectedCaseId(item.id)}
            activeOpacity={0.86}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{item.seniorName.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.caseCopy}>
              <Text style={styles.caseTitle}>{item.title}</Text>
              <Text style={styles.caseMeta}>{item.seniorName} | {item.reason}</Text>
            </View>
            <Ionicons
              name={item.riskLevel === 'High' ? 'warning' : 'alert-circle-outline'}
              size={25}
              color={item.riskLevel === 'High' ? '#DC2626' : '#B45309'}
            />
          </TouchableOpacity>
        ))}

        {visibleCases.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No cases found</Text>
            <Text style={styles.mutedText}>Try another filter above.</Text>
=======
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
>>>>>>> b87e0623916809f1b1f00eea660c852baf58c56e
          </View>
        ) : null}
      </ScrollView>

<<<<<<< HEAD
      <AICBottomNav activeTab="Cases" onCases={() => setActiveFilter('All')} onLogout={onLogout} />
    </SafeAreaView>
  );
}

function CaseDetailView({ caseItem, onBack, onLogout }) {
  const [seniorDetailsVisible, setSeniorDetailsVisible] = useState(false);
  const senior = caseItem.senior || {};
  const conditions = Array.isArray(senior.medicalConditions) ? senior.medicalConditions : [];
  const nokContacts = Array.isArray(senior.nokContacts) ? senior.nokContacts : [];
  const firstCondition = conditions[0] || {};
  const firstNok = nokContacts[0] || {};

  return (
    <SafeAreaView style={styles.container}>
      <Header title={caseItem.title} subtitle="Care details & status overview" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.detailHeroCard}>
          <View style={styles.detailHeroCopy}>
            <Text style={styles.detailSeniorName}>{caseItem.seniorName}</Text>
            <Text style={styles.detailCaseId}>{caseItem.caseId}</Text>
          </View>
          <TouchableOpacity
            style={styles.viewSeniorButton}
            onPress={() => setSeniorDetailsVisible(true)}
            activeOpacity={0.86}
          >
            <Text style={styles.viewSeniorText}>View Senior Details</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Case Details</Text>
          <InfoRow icon="folder-outline" label="Case ID" value={caseItem.caseId} />
          <InfoRow icon="warning-outline" label="Risk Level" value={caseItem.riskLevel} />
          <InfoRow icon="sync-circle-outline" label="Current Status" value={caseItem.currentStatus} />
          <InfoRow icon="alert-circle-outline" label="Reason for Escalation" value={caseItem.reason} />
          <InfoRow icon="time-outline" label="Date & Time Created" value={formatDateTime(caseItem.createdAt)} />
          <InfoRow icon="person-outline" label="Assigned Staff" value={caseItem.assignedStaff.name} />
        </View>

        <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.86}>
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          <Text style={styles.backButtonText}>Back to Cases</Text>
        </TouchableOpacity>
      </ScrollView>

      <AICBottomNav activeTab="Cases" onCases={onBack} onLogout={onLogout} />

      {seniorDetailsVisible ? (
        <View style={styles.modalOverlay}>
          <View style={styles.seniorModalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{caseItem.seniorName}</Text>
                <Text style={styles.modalSubtitle}>Senior details</Text>
              </View>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setSeniorDetailsVisible(false)}
                activeOpacity={0.86}
              >
                <Ionicons name="close" size={24} color="#111827" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalScrollContent}>
              <View style={styles.infoCard}>
                <Text style={styles.infoTitle}>Personal Details</Text>
                <InfoRow icon="calendar-outline" label="Date-of-Birth" value={formatDate(senior?.dob)} />
                <InfoRow icon="person-outline" label="Gender" value={senior?.gender || 'Not recorded'} />
                <InfoRow icon="home-outline" label="Address" value={senior?.address || 'Not recorded'} />
                <InfoRow icon="mail-outline" label="Postal Code" value={senior?.postal_code || 'Not recorded'} />
                <InfoRow icon="business-outline" label="Unit Number" value={senior?.unit_number || senior?.unit_no || 'Not recorded'} />
                <InfoRow icon="call-outline" label="Phone" value={senior?.phone_number || senior?.contact || 'Not recorded'} />
              </View>

              <View style={styles.infoCard}>
                <Text style={styles.infoTitle}>Medical Conditions</Text>
                <InfoRow icon="fitness-outline" label="Condition" value={firstCondition.condition_name || 'Not recorded'} />
                <InfoRow icon="warning-outline" label="Severity" value={firstCondition.severity_level || 'Not recorded'} />
                <InfoRow icon="medical-outline" label="Medication Required" value={firstCondition.medication_required || 'Not recorded'} />
                <InfoRow icon="calendar-outline" label="Diagnosed" value={formatDate(firstCondition.diagnosed_date)} />
              </View>

              <View style={styles.infoCard}>
                <Text style={styles.infoTitle}>Emergency Contact</Text>
                <InfoRow
                  icon="person-outline"
                  label="Name"
                  value={firstNok.full_name ? `${firstNok.full_name} (${firstNok.relationship_to_senior || 'N/A'})` : 'Not recorded'}
                />
                <InfoRow icon="call-outline" label="Phone" value={firstNok.phone_number || 'Not recorded'} />
                <InfoRow icon="mail-outline" label="Email" value={firstNok.email || 'Not recorded'} />
              </View>
            </ScrollView>
          </View>
        </View>
      ) : null}
=======
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem} onPress={onLogout} activeOpacity={0.86}>
          <Ionicons name="log-out-outline" size={26} color="#6B7280" />
          <Text style={styles.navText}>Log Out</Text>
        </TouchableOpacity>
      </View>
>>>>>>> b87e0623916809f1b1f00eea660c852baf58c56e
    </SafeAreaView>
  );
}

<<<<<<< HEAD
function InfoRow({ icon, label, value }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={18} color="#6B7280" />
      <Text style={styles.infoText}>
        <Text style={styles.infoLabel}>{label}: </Text>
        {value || 'Not recorded'}
      </Text>
    </View>
  );
}

function AICBottomNav({ activeTab, onCases, onLogout }) {
  return (
    <View style={styles.bottomNav}>
      <TouchableOpacity style={styles.navItem} onPress={onCases}>
        <Ionicons name="folder-open" size={26} color={activeTab === 'Cases' ? '#2563EB' : '#6B7280'} />
        <Text style={[styles.navText, activeTab === 'Cases' && styles.navTextActive]}>Cases</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.navItem} onPress={onLogout}>
        <Ionicons name="log-out-outline" size={26} color="#6B7280" />
        <Text style={styles.navText}>Log Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
=======
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scrollContent: { padding: 20, paddingBottom: 34 },
>>>>>>> b87e0623916809f1b1f00eea660c852baf58c56e
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
<<<<<<< HEAD
  scrollContent: { padding: 20, paddingBottom: 28 },
  alertCard: {
    backgroundColor: '#DC2626',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  alertIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#991B1B',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  alertCopy: { flex: 1 },
  alertTitle: { color: '#FFFFFF', fontSize: 21, fontWeight: '900' },
  alertSub: { color: '#FEE2E2', fontSize: 13, fontWeight: '800', marginTop: 2 },
  caseCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
=======
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
>>>>>>> b87e0623916809f1b1f00eea660c852baf58c56e
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
<<<<<<< HEAD
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: { color: '#B91C1C', fontSize: 18, fontWeight: '900' },
  caseCopy: { flex: 1 },
  caseTitle: { color: '#111827', fontSize: 22, fontWeight: '900' },
  caseMeta: { color: '#6B7280', fontSize: 13, fontWeight: '700', marginTop: 3 },
=======
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
>>>>>>> b87e0623916809f1b1f00eea660c852baf58c56e
  emptyState: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 18,
    alignItems: 'center',
  },
  emptyTitle: { color: '#111827', fontSize: 18, fontWeight: '900', marginBottom: 6 },
<<<<<<< HEAD
  mutedText: { color: '#6B7280', fontSize: 14, fontWeight: '700', lineHeight: 20 },
  detailHeroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#696969',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  detailHeroCopy: { flex: 1 },
  detailSeniorName: { color: '#111827', fontSize: 28, fontWeight: '900' },
  detailCaseId: { color: '#6B7280', fontSize: 14, fontWeight: '800', marginTop: 3 },
  viewSeniorButton: {
    width: 82,
    minHeight: 58,
    borderRadius: 29,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    backgroundColor: '#FFFFFF',
  },
  viewSeniorText: { color: '#374151', fontSize: 11, fontWeight: '900', textAlign: 'center' },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#696969',
    padding: 16,
    marginBottom: 14,
  },
  infoTitle: { color: '#111827', fontSize: 18, fontWeight: '900', marginBottom: 12 },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  infoText: {
    flex: 1,
    marginLeft: 10,
    color: '#374151',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
  },
  infoLabel: { color: '#111827', fontWeight: '900' },
  backButton: {
    backgroundColor: '#2563EB',
    minHeight: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  backButtonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '900' },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 20,
    backgroundColor: 'rgba(17, 24, 39, 0.55)',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  seniorModalCard: {
    maxHeight: '82%',
    backgroundColor: '#F8FAFC',
    borderRadius: 22,
    overflow: 'hidden',
  },
  modalHeader: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: { color: '#111827', fontSize: 23, fontWeight: '900' },
  modalSubtitle: { color: '#6B7280', fontSize: 13, fontWeight: '700', marginTop: 2 },
  closeButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScrollContent: { padding: 14, paddingBottom: 4 },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
=======
  bottomNav: {
>>>>>>> b87e0623916809f1b1f00eea660c852baf58c56e
    backgroundColor: '#FFFFFF',
    paddingTop: 12,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderColor: '#E5E7EB',
<<<<<<< HEAD
  },
  navItem: { alignItems: 'center', minWidth: 88 },
  navText: { color: '#6B7280', fontSize: 13, marginTop: 4, fontWeight: '700' },
  navTextActive: { color: '#2563EB' },
=======
    alignItems: 'center',
  },
  navItem: { alignItems: 'center', minWidth: 88 },
  navText: { color: '#6B7280', fontSize: 13, marginTop: 4, fontWeight: '700' },
>>>>>>> b87e0623916809f1b1f00eea660c852baf58c56e
});
