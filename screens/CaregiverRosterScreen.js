import React, { useRef, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, SafeAreaView, TouchableOpacity, PanResponder } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import CaregiverBottomNav from '../components/CaregiverBottomNav';

export default function CaregiverRosterScreen({
  seniors = [],
  onGoToHome,
  onGoToSeniorsList,
  onSettings,
  onSelectSenior,
  backendError,
}) {
  const getRawText = (value) => (value ?? '').toString();

  const getStatusTag = (senior) => {
    const raw = getRawText(
      senior?.status || senior?.checkin_status || senior?.health_status || ''
    ).toLowerCase();

    if (/urgent|critical|fall|emergency|alert/.test(raw)) return 'Urgent';
    if (/missed|overdue/.test(raw)) return 'Missed';
    if (/pending|waiting|follow/.test(raw)) return 'Pending';
    if (/checked|ok|safe|completed/.test(raw)) return 'Checked In';
    return 'Pending';
  };

  const getRosterLabel = (senior) => {
  const status = getStatusTag(senior);

  if (status === 'Urgent') return `Pending check-in`;
  if (status === 'Missed') return `Missed check-in`;
  if (status === 'Checked In') return `Checked in today`;
  return `Pending follow up`;
  };

  const getSeniorDisplayName = (senior) => {
    return (
      senior?.User_Account?.full_name ||
      senior?.user?.full_name ||
      senior?.full_name ||
      'Unknown Senior'
    );
  };

  const getSeniorAge = (senior) => {
    const dob =
      senior?.dob ||
      senior?.User_Account?.dob ||
      senior?.user?.dob;

    if (!dob) return null;

    const birthDate = new Date(dob);

    if (isNaN(birthDate.getTime())) {
      return null;
    }

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();

    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 &&
        today.getDate() < birthDate.getDate())
    ) {
      age--;
    }

    return age;
  };

  const rosterItems = seniors.map((senior, index) => {
    const name = getSeniorDisplayName(senior);
    const age = getSeniorAge(senior);

    const displayName =
      age !== null
        ? `${name} (Age: ${age})`
        : name;

    return {
      id: senior?.senior_id || senior?.id || index,
      raw: senior, // IMPORTANT: keep full object // test
      name: displayName,
      statusTag: getStatusTag(senior),
      subtitle: getRosterLabel(senior),
      avatarLetter: name?.charAt(0)?.toUpperCase() || '?',
      colorScheme: getStatusTag(senior) === 'Checked In' ? 'safe' : 'alert',
    };
  });

  const counts = rosterItems.reduce(
    (acc, item) => {
      acc.All += 1;
      if (item.statusTag === 'Urgent') acc.Urgent += 1;
      if (item.statusTag === 'Pending') acc.Pending += 1;
      if (item.statusTag === 'Missed') acc.Missed += 1;
      if (item.statusTag === 'Checked In') acc.Checked += 1;
      return acc;
    },
    { All: 0, Urgent: 0, Pending: 0, Missed: 0, Checked: 0 }
  );

  // Filter list uses explicit { key, label } pairs so the active filter
  // compares against the SAME canonical string that getStatusTag returns
  // (e.g. "Checked In"). The previous version parsed the label by taking
  // its first word, which dropped the "In" from "Checked In" and caused
  // that filter to show zero rows.
  const filters = [
    { key: 'All', label: `All (${counts.All})` },
    { key: 'Urgent', label: `🚨 Urgent (${counts.Urgent})` },
    { key: 'Pending', label: `⚠️ Pending (${counts.Pending})` },
    { key: 'Missed', label: `❌ Missed (${counts.Missed})` },
    { key: 'Checked In', label: `✅ Checked In (${counts.Checked})` },
  ];

  const [activeFilter, setActiveFilter] = useState(filters[0].key);

  const visibleRoster =
    activeFilter === 'All'
      ? rosterItems
      : rosterItems.filter((item) => item.statusTag === activeFilter);

  // Only show the urgent banner for a genuine Urgent status. The previous
  // fallback to `rosterItems[0]` would surface a red "Fall detected" card
  // for a Checked In or Pending senior whenever no Urgent senior existed,
  // which was misleading. With this tightened logic, the card silently
  // disappears when nothing is actually urgent.
  const topUrgent =
    rosterItems.find((item) => item.statusTag === 'Urgent') || null;

  const filterScrollRef = useRef(null);
  const filterScrollX = useRef(0);
  const filterDragStartX = useRef(0);

  const filterDragResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 4 && Math.abs(gesture.dx) > Math.abs(gesture.dy),

      onPanResponderGrant: () => {
        filterDragStartX.current = filterScrollX.current;
      },

      onPanResponderMove: (_, gesture) => {
        filterScrollRef.current?.scrollTo({
          x: Math.max(0, filterDragStartX.current - gesture.dx),
          animated: false,
        });
      },

      onShouldBlockNativeResponder: () => false,
    })
  ).current;

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Seniors Status" subtitle="Sort by urgency and follow up quickly" />

      {/* FILTERS */}
      <View style={styles.filterArea}>
        <ScrollView
          ref={filterScrollRef}
          horizontal
          showsHorizontalScrollIndicator
          scrollEventThrottle={16}
          style={styles.filterScroller}
          contentContainerStyle={styles.filterContent}
          onScroll={(event) => {
            filterScrollX.current = event.nativeEvent.contentOffset.x;
          }}
          {...filterDragResponder.panHandlers}
        >
          {filters.map((filter) => (
            <TouchableOpacity
              key={filter.key}
              style={[
                styles.filterPill,
                activeFilter === filter.key && styles.filterPillActive,
              ]}
              onPress={() => setActiveFilter(filter.key)}
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

      {/* LIST */}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {topUrgent ? (
          <View style={styles.urgentCard}>
            <View style={styles.urgentIcon}>
              <Ionicons name="alert" size={30} color="#FFFFFF" />
            </View>
            <View style={styles.urgentCopy}>
              <Text style={styles.urgentTitle}>
                {topUrgent.statusTag === 'Urgent' ? 'Pending check-in' : topUrgent.statusTag}
              </Text>
              <Text style={styles.urgentSub}>
                {`${topUrgent.name} | ${
                  topUrgent.subtitle.split('|')[1]?.trim() || ''
                }`}
              </Text>
            </View>
          </View>
        ) : null}

        {visibleRoster.length > 0 ? (
          visibleRoster.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.rosterCard}
              activeOpacity={0.86}
              onPress={() => {
                if (onSelectSenior) {
                  onSelectSenior(item.raw); // 👈 ALWAYS real DB object
                }
              }}
            >
              <View
                style={[
                  styles.avatar,
                  item.colorScheme === 'safe' && styles.safeAvatar,
                ]}
              >
                <Text
                  style={[
                    styles.avatarText,
                    item.colorScheme === 'safe' && styles.safeAvatarText,
                  ]}
                >
                  {item.avatarLetter}
                </Text>
              </View>

              <View style={styles.rosterCopy}>
                <Text style={styles.rosterText}>{item.name}</Text>
                <Text style={styles.rosterSub}>{item.subtitle}</Text>
              </View>

              <Ionicons
                name={
                  item.statusTag === 'Checked In'
                    ? 'checkmark-circle'
                    : 'warning-outline'
                }
                size={26}
                color={
                  item.statusTag === 'Checked In' ? '#16A34A' : '#DC2626'
                }
              />
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No seniors found</Text>
            <Text style={styles.emptyText}>
              Please sync your roster or check your database connection.
            </Text>
            {backendError ? (
              <Text style={styles.errorText}>{backendError}</Text>
            ) : null}
          </View>
        )}
      </ScrollView>

      <CaregiverBottomNav
        activeTab="Status"
        onHome={onGoToHome}
        onSeniors={onGoToSeniorsList}
        onStatus={() => {}}
        onSettings={onSettings}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  filterArea: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  filterScroller: { cursor: 'grab' },
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
  urgentCard: {
    backgroundColor: '#DC2626',
    padding: 18,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  urgentIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#991B1B',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  urgentCopy: { flex: 1 },
  urgentTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '900' },
  urgentSub: { color: '#FEE2E2', fontSize: 15, fontWeight: '700' },
  rosterCard: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#B91C1C',
    fontSize: 20,
    fontWeight: '900',
  },
  safeAvatar: { backgroundColor: '#DCFCE7' },
  safeAvatarText: { color: '#166534' },
  rosterCopy: { flex: 1 },
  rosterText: { color: '#111827', fontSize: 21, fontWeight: '900' },
  rosterSub: { color: '#6B7280', fontSize: 14, marginTop: 4 },
  emptyState: {
    marginTop: 28,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 6,
  },
  emptyText: {
    color: '#6B7280',
    fontSize: 14,
    textAlign: 'center',
    maxWidth: 280,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 10,
    maxWidth: 300,
  },
});
