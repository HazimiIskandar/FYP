import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, SafeAreaView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import CaregiverBottomNav from '../components/CaregiverBottomNav';

export default function CaregiverRosterScreen({ onGoToHome, onLogout }) {
  const filters = ['All (40)', '🚨 Urgent (1)', '⚠️ Pending (5)', '❌ Missed (1)', '✅ Checked In (34)'];
  const [activeFilter, setActiveFilter] = useState(filters[0]);

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Seniors Roster" subtitle="Sort by urgency and follow up quickly" />

      <View style={styles.filterArea}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterContent}>
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
        <View style={styles.urgentCard}>
          <View style={styles.urgentIcon}>
            <Ionicons name="alert" size={30} color="#FFFFFF" />
          </View>
          <View style={styles.urgentCopy}>
            <Text style={styles.urgentTitle}>Fall detected</Text>
            <Text style={styles.urgentSub}>Mr Tan | Unit #04-12</Text>
            <Text style={styles.urgentTime}>23 May 2026 | 02:45 PM</Text>
          </View>
          <TouchableOpacity style={styles.ack} activeOpacity={0.86}>
            <Text style={styles.ackText}>Acknowledge</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.rosterCard} onPress={onGoToHome} activeOpacity={0.86}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>T</Text>
          </View>
          <View style={styles.rosterCopy}>
            <Text style={styles.rosterText}>Mr Tan</Text>
            <Text style={styles.rosterSub}>Missed check-in | Unit #04-12</Text>
          </View>
          <Ionicons name="warning-outline" size={26} color="#DC2626" />
        </TouchableOpacity>

        <View style={styles.rosterCard}>
          <View style={[styles.avatar, styles.safeAvatar]}>
            <Text style={[styles.avatarText, styles.safeAvatarText]}>L</Text>
          </View>
          <View style={styles.rosterCopy}>
            <Text style={styles.rosterText}>Mdm Lim</Text>
            <Text style={styles.rosterSub}>Checked in today | Unit #08-03</Text>
          </View>
          <Ionicons name="checkmark-circle" size={26} color="#16A34A" />
        </View>
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
