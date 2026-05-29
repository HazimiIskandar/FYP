import React, { useRef, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, SafeAreaView, TouchableOpacity, PanResponder } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import CaregiverBottomNav from '../components/CaregiverBottomNav';

export default function CaregiverRosterScreen({ seniors = [], onGoToHome, onLogout }) {
  const getRawText = (value) => (value ?? '').toString();
  const getStatusTag = (senior) => {
    const raw = getRawText(senior?.status || senior?.checkin_status || senior?.health_status || '')
      .toLowerCase();
    if (/urgent|critical|fall|emergency|alert/.test(raw)) return 'Urgent';
    if (/missed|overdue/.test(raw)) return 'Missed';
    if (/pending|waiting|follow/.test(raw)) return 'Pending';
    if (/checked|ok|safe|completed/.test(raw)) return 'Checked In';
    return 'Pending';
  };

  const getRosterLabel = (senior) => {
    const status = getStatusTag(senior);
    const unit = senior?.unit_number || senior?.unit_no || senior?.unit || '#04-12';
    if (status === 'Urgent') return `Fall detected | ${unit}`;
    if (status === 'Missed') return `Missed check-in | ${unit}`;
    if (status === 'Checked In') return `Checked in today | ${unit}`;
    return `Pending follow up | ${unit}`;
  };

  const getSeniorDisplayName = (senior) => {
    return senior?.full_name ?? 'Unknown Senior';
  };

  const rosterItems = seniors.map((senior, index) => ({
    id: senior?.id || senior?.SeniorID || index,
    name: getName(senior),
    statusTag: getStatusTag(senior),
    subtitle: getRosterLabel(senior),
    avatarLetter: getName(senior).charAt(0),
    colorScheme: getStatusTag(senior) === 'Checked In' ? 'safe' : 'alert',
  }));

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

  const filters = [
    `All (${counts.All})`,
    `🚨 Urgent (${counts.Urgent})`,
    `⚠️ Pending (${counts.Pending})`,
    `❌ Missed (${counts.Missed})`,
    `✅ Checked In (${counts.Checked})`,
  ];

  const [activeFilter, setActiveFilter] = useState(filters[0]);
  const activeFilterKey = activeFilter.replace(/[^A-Za-z ]/g, '').trim().split(' ')[0] || 'All';
  const visibleRoster =
    activeFilterKey === 'All'
      ? rosterItems
      : rosterItems.filter((item) => item.statusTag === activeFilterKey);

  const topUrgent = rosterItems.find((item) => item.statusTag === 'Urgent') || rosterItems[0] || null;
  const filterScrollRef = useRef(null);
  const filterScrollX = useRef(0);
  const filterDragStartX = useRef(0);
  const filterDragResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => (
        Math.abs(gesture.dx) > 4 && Math.abs(gesture.dx) > Math.abs(gesture.dy)
      ),
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
      <Header title="Seniors Roster" subtitle="Sort by urgency and follow up quickly" />

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
          {filters.map((filter, index) => (
            <TouchableOpacity
              key={filter}
              style={[styles.filterPill, activeFilter === filter ? styles.filterPillActive : null]}
              onPress={() => setActiveFilter(filter)}
              activeOpacity={0.86}
            >
              <Text style={[styles.filterText, activeFilter === filter ? styles.filterTextActive : null]}>{filter}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {topUrgent ? (
          <View style={styles.urgentCard}>
            <View style={styles.urgentIcon}>
              <Ionicons name="alert" size={30} color="#FFFFFF" />
            </View>
            <View style={styles.urgentCopy}>
              <Text style={styles.urgentTitle}>{topUrgent.statusTag === 'Urgent' ? 'Fall detected' : topUrgent.statusTag}</Text>
              <Text style={styles.urgentSub}>{`${topUrgent.name} | ${topUrgent.subtitle.split('|')[1]?.trim() || ''}`}</Text>
              <Text style={styles.urgentTime}>{topUrgent.updatedAt || 'Recent alert'}</Text>
            </View>
            <TouchableOpacity style={styles.ack} activeOpacity={0.86}>
              <Text style={styles.ackText}>Acknowledge</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {visibleRoster.length > 0 ? (
          visibleRoster.map((item) => (
            <TouchableOpacity key={item.id} style={styles.rosterCard} onPress={onGoToHome} activeOpacity={0.86}>
              <View style={[styles.avatar, item.colorScheme === 'safe' ? styles.safeAvatar : null]}>
                <Text style={[styles.avatarText, item.colorScheme === 'safe' ? styles.safeAvatarText : null]}>{item.avatarLetter}</Text>
              </View>
              <View style={styles.rosterCopy}>
                <Text style={styles.rosterText}>{item.name}</Text>
                <Text style={styles.rosterSub}>{item.subtitle}</Text>
              </View>
              <Ionicons
                name={item.statusTag === 'Checked In' ? 'checkmark-circle' : 'warning-outline'}
                size={26}
                color={item.statusTag === 'Checked In' ? '#16A34A' : '#DC2626'}
              />
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No seniors found</Text>
            <Text style={styles.emptyText}>Please sync your roster or check your database connection.</Text>
          </View>
        )}
      </ScrollView>

      <CaregiverBottomNav activeTab="Seniors" onHome={onGoToHome} onSeniors={() => {}} onLogout={onLogout} />
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
  urgentSub: { color: '#FEE2E2', fontSize: 15, fontWeight: '700', marginTop: 3 },
  urgentTime: { color: '#FFFFFF', fontSize: 14, fontWeight: '900', marginTop: 5 },
  ack: { backgroundColor: '#FFFFFF', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 18 },
  ackText: { color: '#991B1B', fontSize: 13, fontWeight: '900' },
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
  avatarText: { color: '#B91C1C', fontSize: 20, fontWeight: '900' },
  safeAvatar: { backgroundColor: '#DCFCE7' },
  safeAvatarText: { color: '#166534' },
  rosterCopy: { flex: 1 },
  rosterText: { color: '#111827', fontSize: 21, fontWeight: '900' },
  rosterSub: { color: '#6B7280', fontSize: 14, marginTop: 4 },
});