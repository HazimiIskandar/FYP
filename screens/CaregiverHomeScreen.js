import React from 'react';
import { StyleSheet, Text, View, ScrollView, SafeAreaView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import CaregiverBottomNav from '../components/CaregiverBottomNav';

export default function CaregiverHomeScreen({ onGoToRoster, onLogout }) {
  return (
    <SafeAreaView style={styles.container}>
      <Header title="Caregiver Portal" subtitle="Priority alerts and senior wellbeing" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryTile}>
            <Text style={styles.summaryNumber}>1</Text>
            <Text style={styles.summaryLabel}>Urgent</Text>
          </View>
          <View style={styles.summaryTile}>
            <Text style={styles.summaryNumber}>4/5</Text>
            <Text style={styles.summaryLabel}>Checked in</Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <View>
            <Text style={styles.cardEyebrow}>Assigned senior</Text>
            <Text style={styles.name}>Mr Tan, 79</Text>
            <Text style={styles.meta}>Unit #04-12 | Son: Adrian Tan</Text>
          </View>
          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>Monitor</Text>
          </View>
        </View>

        <View style={styles.aiCard}>
          <Ionicons name="sparkles" size={24} color="#0369A1" />
          <Text style={styles.aiText}>AI insight: Mr Tan's check-in time shifted 45 minutes later this week.</Text>
        </View>

        <View style={styles.ticketActive}>
          <View style={styles.ticketHeader}>
            <Ionicons name="warning" size={24} color="#DC2626" />
            <Text style={styles.ticketTitle}>Missed check-in</Text>
          </View>
          <Text style={styles.ticketMeta}>Ticket ID: INC0016767</Text>
          <Text style={styles.ticketMeta}>Last update: 10 minutes ago</Text>
        </View>

        <TouchableOpacity style={styles.callButton} activeOpacity={0.86}>
          <Ionicons name="call" size={24} color="#FFFFFF" />
          <Text style={styles.callButtonText}>Call emergency contact</Text>
        </TouchableOpacity>
      </ScrollView>

      <CaregiverBottomNav activeTab="Home" onHome={() => {}} onSeniors={onGoToRoster} onLogout={onLogout} />
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
  infoCard: {
    backgroundColor: '#FFFFFF',
    padding: 18,
    borderRadius: 18,
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
  aiCard: {
    backgroundColor: '#E0F2FE',
    padding: 16,
    borderRadius: 18,
    marginBottom: 14,
    flexDirection: 'row',
    gap: 10,
  },
  aiText: { color: '#075985', fontSize: 16, lineHeight: 23, fontWeight: '700', flex: 1 },
  ticketActive: {
    backgroundColor: '#FFFFFF',
    padding: 18,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#FCA5A5',
    marginBottom: 18,
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
