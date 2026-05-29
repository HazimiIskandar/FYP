import React, { useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  PanResponder
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import CaregiverBottomNav from '../components/CaregiverBottomNav';

export default function CaregiverRosterScreen({
  seniors = [],
  onGoToHome,
  onLogout
}) {

  const getName = (senior) => senior?.full_name || 'Unknown Senior';

  const getUnit = (senior) =>
    senior?.unit_number || senior?.unit_no || senior?.unit || '#N/A';

  // TEMP STATUS (since DB has no status yet)
  const getStatusTag = () => 'Pending';

  const getRosterLabel = (senior) => {
    const unit = getUnit(senior);
    return `Follow up required | ${unit}`;
  };

  // Map Seniors to List Items
  const rosterItems = seniors.map((senior, index) => ({
    id: senior?.senior_id || index,
    name: getName(senior),
    statusTag: getStatusTag(senior),
    subtitle: getRosterLabel(senior),
    avatarLetter: getName(senior).charAt(0) || '?',
    colorScheme: 'alert',
  }));

  // Counts
  const counts = rosterItems.reduce(
    (acc) => {
      acc.All += 1;
      acc.Pending += 1;
      return acc;
    },
    { All: 0, Pending: 0 }
  );

  const filters = [
    `All (${counts.All})`,
    `⚠️ Pending (${counts.Pending})`
  ];

  const [activeFilter, setActiveFilter] = useState(filters[0]);

  const visibleRoster =
    activeFilter.includes('All')
      ? rosterItems
      : rosterItems;

  const topItem = rosterItems[0] || null;

  // Filter Bar Scroll (unchanged)
  const filterScrollRef = useRef(null);
  const filterScrollX = useRef(0);
  const filterDragStartX = useRef(0);

  const filterDragResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 4 &&
        Math.abs(gesture.dx) > Math.abs(gesture.dy),

      onPanResponderGrant: () => {
        filterDragStartX.current = filterScrollX.current;
      },

      onPanResponderMove: (_, gesture) => {
        filterScrollRef.current?.scrollTo({
          x: Math.max(0, filterDragStartX.current - gesture.dx),
          animated: false,
        });
      },
    })
  ).current;

  // UI
  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Senior List"
        subtitle="All assigned seniors"
      />

      {/* Filter Bar */}
      <View style={styles.filterArea}>
        <ScrollView
          ref={filterScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContent}
          onScroll={(e) =>
            (filterScrollX.current =
              e.nativeEvent.contentOffset.x)
          }
          {...filterDragResponder.panHandlers}
        >
          {filters.map((filter) => (
            <TouchableOpacity
              key={filter}
              style={[
                styles.filterPill,
                activeFilter === filter &&
                  styles.filterPillActive,
              ]}
              onPress={() => setActiveFilter(filter)}
            >
              <Text
                style={[
                  styles.filterText,
                  activeFilter === filter &&
                    styles.filterTextActive,
                ]}
              >
                {filter}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* List */}
      <ScrollView contentContainerStyle={styles.scrollContent}>

        {/* Top Card */}
        {topItem && (
          <View style={styles.urgentCard}>
            <View style={styles.urgentIcon}>
              <Ionicons
                name="people"
                size={30}
                color="#FFFFFF"
              />
            </View>

            <View style={styles.urgentCopy}>
              <Text style={styles.urgentTitle}>
                Senior List
              </Text>
              <Text style={styles.urgentSub}>
                {topItem.name}
              </Text>
            </View>
          </View>
        )}

        {/* LIST */}
        {visibleRoster.length > 0 ? (
          visibleRoster.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.rosterCard}
              onPress={onGoToHome}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {item.avatarLetter}
                </Text>
              </View>

              <View style={styles.rosterCopy}>
                <Text style={styles.rosterText}>
                  {item.name}
                </Text>
                <Text style={styles.rosterSub}>
                  {item.subtitle}
                </Text>
              </View>

              <Ionicons
                name="chevron-forward"
                size={24}
                color="#6B7280"
              />
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>
              No seniors found
            </Text>
            <Text style={styles.emptyText}>
              Check database connection
            </Text>
          </View>
        )}
      </ScrollView>

      <CaregiverBottomNav
        activeTab="Seniors"
        onHome={onGoToHome}
        onSeniors={() => {}}
        onLogout={onLogout}
      />
    </SafeAreaView>
  );
}

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },

  filterArea: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },

  filterContent: {
    padding: 12,
    gap: 10,
  },

  filterPill: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: '#F3F4F6',
  },

  filterPillActive: {
    backgroundColor: '#111827',
  },

  filterText: {
    fontWeight: '700',
    color: '#374151',
  },

  filterTextActive: {
    color: '#FFFFFF',
  },

  scrollContent: {
    padding: 20,
  },

  urgentCard: {
    backgroundColor: '#2563EB',
    padding: 16,
    borderRadius: 16,
    flexDirection: 'row',
    marginBottom: 16,
  },

  urgentIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#1D4ED8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  urgentCopy: {
    flex: 1,
  },

  urgentTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },

  urgentSub: {
    color: '#DBEAFE',
    marginTop: 4,
  },

  rosterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 14,
    marginBottom: 12,
  },

  avatar: {
    width: 45,
    height: 45,
    borderRadius: 22,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  avatarText: {
    fontWeight: '800',
    color: '#111827',
  },

  rosterCopy: {
    flex: 1,
  },

  rosterText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },

  rosterSub: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },

  emptyState: {
    padding: 20,
    alignItems: 'center',
  },

  emptyTitle: {
    fontWeight: '800',
    fontSize: 16,
  },

  emptyText: {
    color: '#6B7280',
    marginTop: 4,
  },
});