import React, { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import AICBottomNav from '../components/AICBottomNav';
import { formatDate, formatDateTime } from '../utils/time';

const fetchJsonOrEmpty = async (url) => {
    try {
        const response = await fetch(url);
        if (!response.ok) return [];
        const body = await response.json().catch(() => null);
        return Array.isArray(body) ? body : [];
    } catch (err) {
        console.log('fetchJsonOrEmpty error:', url, err);
        return [];
    }
};

const getSeniorId = (senior, fallback) => senior?.senior_id || senior?.id || fallback + 1;

const findSeniorById = (seniors, seniorId) =>
  seniors.find((senior, index) => `${getSeniorId(senior, index)}` === `${seniorId}`) || null;

const getSeniorName = (senior) =>
  senior?.full_name ||
  senior?.User_Account?.full_name ||
  senior?.user?.full_name ||
  'Unknown Senior';



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

const STATUS_COLOR_MAP = {
  Open: {
    cardBackground: '#fff0f0',
    cardBorder: '#FCA5A5',
    avatarBackground: '#ffc6c6',
    avatarText: '#7F1D1D',
    icon: '#B91C1C',
  },
  New: {
    cardBackground: '#ffe2e2',
    cardBorder: '#FCA5A5',
    avatarBackground: '#FCA5A5',
    avatarText: '#7F1D1D',
    icon: '#B91C1C',
  },
  'In Progress': {
    cardBackground: '#ffe9d5',
    cardBorder: '#fc9f4d',
    avatarBackground: '#ffc497',
    avatarText: '#78350F',
    icon: '#D97706',
  },
  'On Hold': {
    cardBackground: '#fdfadd',
    cardBorder: '#fbd828',
    avatarBackground: '#fff1a8',
    avatarText: '#713F12',
    icon: '#ffdd00',
  },
  Resolved: {
    cardBackground: '#e0ffe3',
    cardBorder: '#86EFAC',
    avatarBackground: '#a1ffaf',
    avatarText: '#14532D',
    icon: '#16A34A',
  },
  Closed: {
    cardBackground: '#DBEAFE',
    cardBorder: '#93C5FD',
    avatarBackground: '#93C5FD',
    avatarText: '#1E3A8A',
    icon: '#2563EB',
  },
  Cancelled: {
    cardBackground: '#E5E7EB',
    cardBorder: '#D1D5DB',
    avatarBackground: '#D1D5DB',
    avatarText: '#374151',
    icon: '#6B7280',
  },
};

const getStatusTheme = (status) => STATUS_COLOR_MAP[status] || STATUS_COLOR_MAP.Open;

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
  onSettings,
}) {
  const [selectedCaseId, setSelectedCaseId] = useState(null);
  const [activeFilter, setActiveFilter] = useState('All');
  const [showMyCasesOnly, setShowMyCasesOnly] = useState(false);
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

  const updateCaseRowByEventId = (eventId, updates) => {
    if (!eventId) return;

    setAssignedCaseRows((previousRows) =>
      previousRows.map((row) => {
        if (`${row?.event_id}` !== `${eventId}`) return row;
        return { ...row, ...updates };
      })
    );
  };

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
      const eventStatus = assignedCase?.event_status || latestEvent?.event_status || null;
      const safeCurrentStatus = ['Open', 'New', 'In Progress', 'On Hold', 'Resolved', 'Closed', 'Cancelled'].includes(eventStatus)
        ? eventStatus
        : getCaseStatus(sourceStatus);
      const assignedStaffNames = assignedCase?.assigned_staff_names || 'Unassigned';
      const assignedStaffUserIds = (assignedCase?.assigned_staff_user_ids || '')
        .split(',')
        .map((id) => id && id.trim())
        .filter(Boolean);
      const createdAt =
        assignedCase?.assigned_at ||
        latestEvent?.created_at ||
        seniorCheckIns[0]?.checkin_timestamp ||
        null;

      return {
        id: eventId || `assigned-${index}`,
        caseId: eventId ? `${eventId}` : String(index + 1),
        title: eventId ? `Case ${eventId}` : `Case ${index + 1}`,
        senior,
        seniorId,
        seniorName: getSeniorName(senior),
        riskLevel,
        currentStatus: safeCurrentStatus,
        sourceStatus,
        eventStatus,
        reason: getReason(sourceStatus, latestEvent),
        createdAt,
        assignedStaff: { names: assignedStaffNames, userIds: assignedStaffUserIds },
        missedCount,
        isAssignedToMe: authenticatedUser?.user_id ? assignedStaffUserIds.includes(`${authenticatedUser.user_id}`) : false,
      };
    });
  }, [assignedCaseRows, seniors, checkIns, emergencyEvents, currentStaffName]);

  const assignedCases = cases;
  const selectedCase = assignedCases.find((item) => item.id === selectedCaseId) || null;

  // Cases assigned specifically to the current logged-in user
  const myCases = useMemo(() => {
    const currentUserId = authenticatedUser?.user_id ? `${authenticatedUser.user_id}` : null;
    if (!currentUserId) return [];
    return assignedCases.filter((item) => {
      const assignedUserIds = item.assignedStaff?.userIds || [];
      return assignedUserIds.includes(currentUserId);
    });
  }, [assignedCases, authenticatedUser?.user_id]);

  const myCasesCount = myCases.length;
  const myCasesOpenCount = myCases.filter((item) => !['Resolved', 'Closed', 'Cancelled'].includes(item.currentStatus)).length;

  const filterOptions = [
    { key: 'All', label: `All (${assignedCases.length})` },
    { key: 'Open', label: `Open (${assignedCases.filter((item) => item.currentStatus === 'Open').length})` },
    { key: 'In Progress', label: `In Progress (${assignedCases.filter((item) => item.currentStatus === 'In Progress').length})` },
    { key: 'Resolved', label: `Resolved (${assignedCases.filter((item) => item.currentStatus === 'Resolved').length})` },
    { key: 'On Hold', label: `On Hold (${assignedCases.filter((item) => item.currentStatus === 'On Hold').length})` },
    { key: 'Closed', label: `Closed (${assignedCases.filter((item) => item.currentStatus === 'Closed').length})` },
    { key: 'Cancelled', label: `Cancelled (${assignedCases.filter((item) => item.currentStatus === 'Cancelled').length})` },
  ];

  const [searchQuery, setSearchQuery] = useState('');

  const visibleCases = assignedCases.filter((item) => {
    if (searchQuery && !item.seniorName.toLowerCase().includes(searchQuery.toLowerCase()) && !item.caseId.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (showMyCasesOnly) {
      const currentUserId = authenticatedUser?.user_id ? `${authenticatedUser.user_id}` : null;
      if (!currentUserId) return false;
      const assignedUserIds = item.assignedStaff?.userIds || [];
      return assignedUserIds.includes(currentUserId);
    }
    if (activeFilter !== 'All') {
      if (item.riskLevel !== activeFilter && item.currentStatus !== activeFilter) {
        return false;
      }
    }
    return true;
  });

  const highRiskCount = assignedCases.filter((item) => item.riskLevel === 'High').length;
  const openCount = assignedCases.filter((item) => !['Resolved', 'Closed', 'Cancelled'].includes(item.currentStatus)).length;

  if (selectedCase) {
    return (
      <CaseDetailView
        caseItem={selectedCase}
        onBack={() => setSelectedCaseId(null)}
        onCaseStatusUpdated={(eventId, nextStatus) => {
          updateCaseRowByEventId(eventId, { event_status: nextStatus });
        }}
        onCaseAssigned={(eventId, nextAssignedStaffNames, nextAssignedStaffUserIds) => {
          updateCaseRowByEventId(eventId, {
            event_status: 'In Progress',
            assigned_staff_names: nextAssignedStaffNames,
            assigned_staff_user_ids: nextAssignedStaffUserIds,
          });
        }}
        onSettings={onSettings}
        apiBase={apiBase}
        authenticatedUser={authenticatedUser}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header 
        title="Assigned Cases" 
        subtitle="Sort by urgency and follow up quickly" 
        rightContent={
          <TouchableOpacity
            style={[styles.myCasesTopButton, showMyCasesOnly && styles.myCasesTopButtonActive]}
            onPress={() => setShowMyCasesOnly((previous) => !previous)}
            activeOpacity={0.86}
          >
            <Ionicons
              name="person"
              size={14}
              color={showMyCasesOnly ? '#FFFFFF' : '#1E3A8A'}
            />
            <Text style={[styles.myCasesTopButtonText, showMyCasesOnly && styles.myCasesTopButtonTextActive]}>
              My Cases ({myCasesCount})
            </Text>
          </TouchableOpacity>
        }
        badge={
          <View style={{ backgroundColor: '#F3E8FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4 }}>
            <Ionicons name="business" size={14} color="#7E22CE" />
            <Text style={{ color: '#7E22CE', fontSize: 12, fontWeight: '700', letterSpacing: 0.5 }}>AIC STAFF</Text>
          </View>
        }
      />

      <View style={[styles.filterArea, { width: '100%' }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={true} contentContainerStyle={styles.filterContent} style={{ flexGrow: 0 }}>
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

      <View style={styles.searchSection}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#6B7280" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by senior name or case ID..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close-circle" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent}>
        <View style={styles.alertCard}>
          <View style={styles.alertIcon}>
            <Ionicons name="alert" size={24} color="#FFFFFF" />
          </View>
          <View style={styles.alertCopy}>
            <Text style={styles.alertTitle}>{highRiskCount > 0 ? 'High Risk' : 'Pending'}</Text>
              <Text style={styles.alertSub}>
                {showMyCasesOnly
                  ? `${myCasesOpenCount} open case(s) assigned to you`
                  : `${openCount} open case(s) in queue`}
              </Text>
          </View>
        </View>

          {visibleCases.map((item) => {
            const statusTheme = getStatusTheme(item.currentStatus);

            return (
              <TouchableOpacity
            key={item.id}
              style={[
                styles.caseCard,
                {
                  backgroundColor: statusTheme.cardBackground,
                  borderColor: statusTheme.cardBorder,
                },
              ]}
            onPress={() => setSelectedCaseId(item.id)}
            activeOpacity={0.86}
          >
              <View style={[styles.avatar, { backgroundColor: statusTheme.avatarBackground }]}>
                <Text style={[styles.avatarText, { color: statusTheme.avatarText }]}>{item.seniorName.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.caseCopy}>
              <View style={styles.caseTitleRow}>
                <Text style={styles.caseTitle}>{item.title}</Text>
                {item.isAssignedToMe && (
                  <View style={styles.myCaseBadge}>
                    <Ionicons name="person" size={10} color="#FFFFFF" />
                    <Text style={styles.myCaseBadgeText}>My Case</Text>
                  </View>
                )}
              </View>
              <Text style={styles.caseMeta}>{item.seniorName} | {item.reason}</Text>
            </View>
            <Ionicons
              name={item.riskLevel === 'High' ? 'warning' : 'ellipse'}
              size={25}
              color={statusTheme.icon}
            />
          </TouchableOpacity>
          );
        })}

        {visibleCases.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>{loadingAssignments ? 'Loading assigned cases...' : 'No assigned cases'}</Text>
            <Text style={styles.mutedText}>Assigned cases will appear after they are linked in the database.</Text>
          </View>
        ) : null}
      </ScrollView>

      <AICBottomNav activeTab="Cases" onCases={() => setActiveFilter('All')} onSettings={onSettings} />
    </SafeAreaView>
  );
}

function CaseDetailView({
  caseItem,
  onBack,
  onSettings,
  apiBase,
  authenticatedUser,
  onCaseStatusUpdated,
  onCaseAssigned,
}) {
  const [seniorDetailsVisible, setSeniorDetailsVisible] = useState(false);
  const [statusComment, setStatusComment] = useState('');
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [statusMessageMeta, setStatusMessageMeta] = useState({ status: '', serviceNowUpdated: null });
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignMessage, setAssignMessage] = useState('');
  const [assignedStaff, setAssignedStaff] = useState(caseItem?.assignedStaff || { names: 'Unassigned', userIds: [] });
  const currentStaffName = authenticatedUser?.full_name || authenticatedUser?.name || authenticatedUser?.email || 'AIC Staff';
  // Medical condition + NOK + Caregiver arrays fetched on demand for the
  // viewed senior. App.js only hydrates these for the logged-in user; AIC
  // staff have no senior_id, so we hit /seniors/:id/medical-conditions,
  // /seniors/:id/nok, and /seniors/:id/caregivers ourselves (the same
  // endpoints the caregiver profile uses).
  const [extras, setExtras] = useState({ conditions: [], nokContacts: [], caregivers: [] });
  const senior = caseItem.senior || {};
  const seniorId = caseItem?.seniorId || senior?.senior_id;

  const availableStatusOptions = ['Open', 'In Progress', 'On Hold', 'Resolved', 'Closed', 'Cancelled'];

  const currentEventStatus = caseItem?.eventStatus || caseItem?.currentStatus || 'Open';
  const [currentStatus, setCurrentStatus] = useState(currentEventStatus);

  const assignedStaffUserIds = assignedStaff?.userIds || [];
  const currentUserId = authenticatedUser?.user_id ? `${authenticatedUser.user_id}` : null;
  const isAssignedToMe = currentUserId ? assignedStaffUserIds.includes(currentUserId) : false;
  const canAssignToMe = !!currentUserId && !isAssignedToMe && !['Resolved', 'Closed', 'Cancelled'].includes(currentStatus);

  useEffect(() => {
    setCurrentStatus(currentEventStatus);
    setAssignedStaff(caseItem?.assignedStaff || { names: 'Unassigned', userIds: [] });
  }, [currentEventStatus, caseItem]);

  useEffect(() => {
    if (!apiBase || !seniorId) return undefined;

    let isCancelled = false;

    Promise.all([
      fetchJsonOrEmpty(`${apiBase}/seniors/${seniorId}/medical-conditions`),
      fetchJsonOrEmpty(`${apiBase}/seniors/${seniorId}/nok`),
      fetchJsonOrEmpty(`${apiBase}/seniors/${seniorId}/caregivers`),
    ])
      .then(([conditions, nokContacts, caregivers]) => {
        if (isCancelled) return;
        setExtras({ conditions, nokContacts, caregivers });
      })
      .catch((err) => {
        if (isCancelled) return;
        console.log('Failed to load senior extras:', err);
        setExtras({ conditions: [], nokContacts: [], caregivers: [] });
      });

    return () => {
      isCancelled = true;
    };
  }, [apiBase, seniorId]);

  // Use the freshly fetched arrays when present; otherwise fall back to
  // anything already on the senior prop (handles the brief pre-fetch frame).
  const conditions = extras.conditions.length
    ? extras.conditions
    : (senior.medicalConditions || []);
  const nokContacts = extras.nokContacts.length
    ? extras.nokContacts
    : (senior.nokContacts || []);
  const caregivers = extras.caregivers.length
    ? extras.caregivers
    : (senior.caregivers || []);
  const firstCondition = conditions[0] || {};
  const firstNok = nokContacts[0] || {};

  const handleChangeStatus = async (newStatus) => {
    if (!apiBase || !caseItem?.caseId) {
      setStatusMessage('Unable to update status: missing API or case ID.');
      return;
    }

    setStatusLoading(true);
    setStatusMessage('');
    setStatusMessageMeta({ status: '', serviceNowUpdated: null });

    try {
      const response = await fetch(`${apiBase}/staff/case/${caseItem.caseId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, comment: '', staff_user_id: authenticatedUser?.user_id || null }),
      });
      const json = await response.json();

      if (!response.ok) {
        setStatusMessage(`Status update failed: ${json?.error || response.statusText}`);
        setStatusMessageMeta({ status: '', serviceNowUpdated: null });
      } else {
        setCurrentStatus(newStatus);
        onCaseStatusUpdated?.(caseItem?.caseId, newStatus);
        setStatusMessage('');
        setStatusMessageMeta({ status: newStatus, serviceNowUpdated: json.serviceNowUpdated });
      }
    } catch (err) {
      console.log('Failed to update case status:', err);
      setStatusMessage('Unable to update case status at this time.');
    } finally {
      setStatusLoading(false);
    }
  };

  const handleAssignToMe = async () => {
    if (!apiBase || !caseItem?.caseId || !authenticatedUser?.user_id) {
      setAssignMessage('Unable to assign case: missing API, case ID, or user.');
      return;
    }

    setAssignLoading(true);
    setAssignMessage('');

    try {
      const response = await fetch(`${apiBase}/staff/case/${caseItem.caseId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: authenticatedUser.user_id, comment: '' }),
      });
      const json = await response.json();

      if (!response.ok) {
        setAssignMessage(`Assignment failed: ${json?.error || response.statusText}`);
      } else {
        setCurrentStatus('In Progress');
        setAssignedStaff({ names: currentStaffName, userIds: [currentUserId] });
        onCaseAssigned?.(caseItem?.caseId, currentStaffName, currentUserId || '');
        setAssignMessage(`Assigned to you. ServiceNow updated: ${json.serviceNowUpdated ? 'yes' : 'no'}`);
      }
    } catch (err) {
      console.log('Failed to assign case:', err);
      setAssignMessage('Unable to assign case at this time.');
    } finally {
      setAssignLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header title={caseItem.title} subtitle="Care details & status overview" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.detailHeroCard}>
          <View style={styles.detailHeroCopy}>
            <Text style={styles.detailSeniorName}>{caseItem.seniorName}</Text>
            <TouchableOpacity
              style={styles.viewSeniorButton}
              onPress={() => setSeniorDetailsVisible(true)}
              activeOpacity={0.86}
            >
              <Text style={styles.viewSeniorText}>View Senior Details</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Case Details</Text>
          <InfoRow icon="folder-outline" label="Case ID" value={caseItem.caseId} />
          <InfoRow icon="warning-outline" label="Risk Level" value={caseItem.riskLevel} />
          <InfoRow icon="sync-circle-outline" label="Current Status" value={currentStatus} />
          <InfoRow icon="alert-circle-outline" label="Reason for Escalation" value={caseItem.reason} />
          <InfoRow icon="time-outline" label="Date & Time Created" value={formatDateTime(caseItem.createdAt)} />
          <InfoRow icon="person-outline" label="Assigned Staff" value={assignedStaff.names || 'Unassigned'} />
        </View>

        {canAssignToMe ? (
          <View style={styles.assignActionCard}>
            <Text style={styles.infoTitle}>Assign this case to me</Text>
            <Text style={styles.mutedText}>Claim the case and move it to In Progress.</Text>
            {/* Comment input removed — assignments use buttons only. */}
            <TouchableOpacity
              style={[styles.assignButton, assignLoading && styles.assignButtonDisabled]}
              onPress={handleAssignToMe}
              disabled={assignLoading}
              activeOpacity={0.86}
            >
              <Text style={[styles.assignButtonText, assignLoading && styles.assignButtonTextDisabled]}>
                {assignLoading ? 'Assigning...' : 'Assign to me'}
              </Text>
            </TouchableOpacity>
            {assignMessage ? <Text style={styles.statusMessage}>{assignMessage}</Text> : null}
          </View>
        ) : null}

        <View style={styles.statusActionCard}>
          <Text style={styles.infoTitle}>Update Case Status</Text>
          <Text style={styles.mutedText}>Select the next state.</Text>

          <View style={styles.statusButtonsRow}>
            {availableStatusOptions.map((option) => (
              <TouchableOpacity
                key={option}
                style={[
                  styles.statusButton,
                  currentStatus === option && styles.statusButtonActive,
                ]}
                onPress={() => handleChangeStatus(option)}
                disabled={statusLoading}
                activeOpacity={0.86}
              >
                <Text style={[styles.statusButtonText, currentStatus === option && styles.statusButtonTextActive]}>
                  {option}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {statusMessageMeta.status ? (
            <Text style={styles.statusMessage}>
              Status updated to <Text style={styles.statusMessageBold}>{statusMessageMeta.status}</Text>. ServiceNow updated: <Text style={styles.statusMessageBold}>{statusMessageMeta.serviceNowUpdated ? 'Yes' : 'No'}</Text>
            </Text>
          ) : statusMessage ? (
            <Text style={styles.statusMessage}>{statusMessage}</Text>
          ) : null}
        </View>

        <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.86}>
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          <Text style={styles.backButtonText}>Back to Cases</Text>
        </TouchableOpacity>
      </ScrollView>

      <AICBottomNav activeTab="Cases" onCases={onBack} onSettings={onSettings} />

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
              {caregivers.length > 0
                ? caregivers.map((caregiver, index) => (
                    <View key={caregiver?.user_id ?? `caregiver-${index}`} style={styles.infoCard}>
                      <Text style={styles.infoTitle}>
                        {caregivers.length > 1
                          ? `Assigned Caretaker (${index + 1})`
                          : 'Assigned Caretaker'}
                      </Text>
                      <InfoRow icon="person-outline" label="Name" value={caregiver?.full_name} />
                      <InfoRow icon="call-outline" label="Phone" value={caregiver?.phone_number} />
                      <InfoRow icon="mail-outline" label="Email" value={caregiver?.email} />
                    </View>
                  ))
                : (
                    <View style={styles.infoCard}>
                      <Text style={styles.infoTitle}>Assigned Caretaker</Text>
                      <Text style={styles.mutedText}>No caregiver assigned for this senior.</Text>
                    </View>
                  )}

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
  caseTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  caseTitle: { color: '#111827', fontSize: 22, fontWeight: '900' },
  myCaseBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
  },
  myCaseBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  caseMeta: { color: '#6B7280', fontSize: 13, fontWeight: '700', marginTop: 3 },
  myCasesTopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#93C5FD',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  myCasesTopButtonActive: {
    backgroundColor: '#1D4ED8',
    borderColor: '#1D4ED8',
  },
  myCasesTopButtonText: {
    color: '#1E3A8A',
    fontSize: 12,
    fontWeight: '800',
  },
  myCasesTopButtonTextActive: {
    color: '#FFFFFF',
  },
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
    marginBottom: 14,
  },
  detailHeroCopy: { width: '100%' },
  detailSeniorName: { color: '#111827', fontSize: 28, fontWeight: '900' },
  detailCaseId: { color: '#6B7280', fontSize: 14, fontWeight: '800', marginTop: 3 },
  viewSeniorButton: {
    minWidth: 80,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#4056b8',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    alignSelf: 'flex-start',
    marginTop: 12,
  },
  viewSeniorText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
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
  statusActionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    marginBottom: 14,
  },
  statusCommentInput: {
    backgroundColor: '#F8FAFC',
    borderColor: '#D1D5DB',
    borderWidth: 1,
    borderRadius: 14,
    minHeight: 100,
    padding: 12,
    marginTop: 10,
    marginBottom: 14,
    color: '#111827',
    textAlignVertical: 'top',
  },
  statusButtonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 10,
    marginBottom: 10,
  },
  statusButton: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#F8FAFC',
    paddingVertical: 12,
    paddingHorizontal: 14,
    minWidth: 110,
    alignItems: 'center',
  },
  statusButtonActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  statusButtonText: {
    color: '#1F2937',
    fontWeight: '800',
    fontSize: 14,
  },
  statusButtonTextActive: {
    color: '#FFFFFF',
  },
  assignActionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    marginBottom: 14,
  },
  assignButton: {
    borderRadius: 14,
    backgroundColor: '#111827',
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
    marginTop: 14,
  },
  assignButtonDisabled: {
    backgroundColor: '#94A3B8',
  },
  assignButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 15,
  },
  assignButtonTextDisabled: {
    color: '#E2E8F0',
  },
  statusMessage: {
    marginTop: 10,
    color: '#111827',
    fontSize: 13,
    fontWeight: '700',
  },
  statusMessageBold: {
    fontWeight: '900',
    color: '#2563EB',
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
  searchSection: {
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
  },
});
