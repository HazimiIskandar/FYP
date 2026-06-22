import React, { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';

const getSeniorId = (senior, fallback) => senior?.senior_id || senior?.id || fallback + 1;

const findSeniorById = (seniors, seniorId) =>
  seniors.find((senior, index) => `${getSeniorId(senior, index)}` === `${seniorId}`) || null;

const getSeniorName = (senior) =>
  senior?.full_name ||
  senior?.User_Account?.full_name ||
  senior?.user?.full_name ||
  'Unknown Senior';

const formatDate = (value) => {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not recorded';
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const formatDateTime = (value) => {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not recorded';
  return date.toLocaleString('en-SG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

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

export default function AICPortalScreen({
  seniors = [],
  checkIns = [],
  emergencyEvents = [],
  authenticatedUser = {},
  apiBase,
  onLogout,
}) {
  const [selectedCaseId, setSelectedCaseId] = useState(null);
  const [activeFilter, setActiveFilter] = useState('All');
  const [assignedCaseRows, setAssignedCaseRows] = useState([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const currentStaffName =
    authenticatedUser?.full_name ||
    authenticatedUser?.name ||
    authenticatedUser?.email ||
    'AIC Staff';

  useEffect(() => {
    if (!apiBase || !authenticatedUser?.user_id) {
      setAssignedCaseRows([]);
      return;
    }

    let isCancelled = false;
    setLoadingAssignments(true);

    fetch(`${apiBase}/staff/assigned-cases/by-user/${authenticatedUser.user_id}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load assigned cases (${response.status})`);
        }
        return response.json();
      })
      .then((payload) => {
        if (isCancelled) return;
        const nextCases = Array.isArray(payload?.cases) ? payload.cases : [];
        setAssignedCaseRows(nextCases);
      })
      .catch((err) => {
        console.log('Failed to load assigned AIC cases:', err);
        if (!isCancelled) setAssignedCaseRows([]);
      })
      .finally(() => {
        if (!isCancelled) setLoadingAssignments(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [apiBase, authenticatedUser?.user_id]);

  const cases = useMemo(() => {
    return assignedCaseRows.map((assignedCase, index) => {
      const seniorId = assignedCase?.senior_id;
      const senior = findSeniorById(seniors, seniorId) || {};
      const eventId = assignedCase?.event_id;
      const seniorCheckIns = checkIns
        .filter((item) => `${item?.senior_id}` === `${seniorId}`)
        .sort((a, b) => new Date(b?.checkin_timestamp || 0) - new Date(a?.checkin_timestamp || 0));
      const matchedEvent = emergencyEvents.find((event) => `${event?.event_id}` === `${eventId}`) || null;
      const latestEvent = matchedEvent || assignedCase;
      const missedCount = seniorCheckIns.filter((item) =>
        `${item?.checkin_status || ''}`.toLowerCase().includes('missed')
      ).length;
      const sourceStatus = getRawStatus(senior, missedCount, Boolean(latestEvent));
      const riskLevel = getRiskLevel(sourceStatus, missedCount);
      const currentStatus = getCaseStatus(sourceStatus);
      const createdAt =
        assignedCase?.assigned_at ||
        latestEvent?.created_at ||
        seniorCheckIns[0]?.checkin_timestamp ||
        null;

      return {
        id: eventId || `assigned-${index}`,
        caseId: eventId ? `CASE-${eventId}` : `CASE-${String(index + 1).padStart(3, '0')}`,
        title: eventId ? `Case ${eventId}` : `Case ${index + 1}`,
        senior,
        seniorId,
        seniorName: getSeniorName(senior),
        riskLevel,
        currentStatus,
        sourceStatus,
        reason: getReason(sourceStatus, latestEvent),
        createdAt,
        assignedStaff: { name: currentStaffName },
        missedCount,
      };
    });
  }, [assignedCaseRows, seniors, checkIns, emergencyEvents, currentStaffName]);

  const assignedCases = cases;
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
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
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
            <Text style={styles.emptyTitle}>{loadingAssignments ? 'Loading assigned cases...' : 'No assigned cases'}</Text>
            <Text style={styles.mutedText}>Assigned cases will appear after they are linked in the database.</Text>
          </View>
        ) : null}
      </ScrollView>

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
    </SafeAreaView>
  );
}

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
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: { color: '#B91C1C', fontSize: 18, fontWeight: '900' },
  caseCopy: { flex: 1 },
  caseTitle: { color: '#111827', fontSize: 22, fontWeight: '900' },
  caseMeta: { color: '#6B7280', fontSize: 13, fontWeight: '700', marginTop: 3 },
  emptyState: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 18,
    alignItems: 'center',
  },
  emptyTitle: { color: '#111827', fontSize: 18, fontWeight: '900', marginBottom: 6 },
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
    backgroundColor: '#FFFFFF',
    paddingTop: 12,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderColor: '#E5E7EB',
  },
  navItem: { alignItems: 'center', minWidth: 88 },
  navText: { color: '#6B7280', fontSize: 13, marginTop: 4, fontWeight: '700' },
  navTextActive: { color: '#2563EB' },
});
