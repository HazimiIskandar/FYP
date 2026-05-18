import React from 'react';
import { StyleSheet, Text, View, SafeAreaView, ScrollView, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import SeniorBottomNav from '../components/SeniorBottomNav';

export default function CommunityScreen({ onHome, onLogout }) {
  return (
    <SafeAreaView style={styles.container}>
      <Header title="Community" subtitle="Activities and rewards near you" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Live activity</Text>
          <Text style={styles.sectionMeta}>Today</Text>
        </View>

        <TouchableOpacity style={styles.activityCard} activeOpacity={0.9}>
          <Image
            source={{ uri: 'https://img.freepik.com/free-vector/old-people-playing-mahjong-illustration_23-2148733240.jpg' }}
            style={styles.activityImage}
            resizeMode="cover"
          />
          <View style={styles.cardInfo}>
            <View style={styles.livePill}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>Live now</Text>
            </View>
            <Text style={styles.activityName}>Morning Mahjong</Text>
            <View style={styles.detailRow}>
              <Ionicons name="location" size={20} color="#2563EB" />
              <Text style={styles.detailText}>Woodlands Community Club</Text>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="time" size={20} color="#2563EB" />
              <Text style={styles.detailText}>10:00 AM to 12:00 PM</Text>
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.kopiButton} activeOpacity={0.86}>
          <Ionicons name="cafe" size={28} color="#FFFFFF" />
          <View style={styles.kopiCopy}>
            <Text style={styles.kopiButtonText}>Redeem free kopi</Text>
            <Text style={styles.kopiButtonSubtext}>Available after 7 daily check-ins</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.chatCard} activeOpacity={0.86}>
          <View style={styles.avatarCircle}>
            <Ionicons name="chatbubbles" size={26} color="#2563EB" />
          </View>
          <View style={styles.chatTextContainer}>
            <Text style={styles.chatTitle}>Talk to someone</Text>
            <Text style={styles.chatSubtitle}>Fiqachu is online if you want a friendly chat.</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#6B7280" />
        </TouchableOpacity>
      </ScrollView>

      <SeniorBottomNav onHome={onHome} onCommunity={() => {}} onLogout={onLogout} activeTab="Community" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scrollContent: { padding: 20, paddingBottom: 28 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: { color: '#111827', fontSize: 24, fontWeight: '900' },
  sectionMeta: { color: '#2563EB', fontSize: 16, fontWeight: '800' },
  activityCard: {
    backgroundColor: '#FFFFFF',
    width: '100%',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    marginBottom: 18,
  },
  activityImage: { width: '100%', height: 190 },
  cardInfo: { padding: 16 },
  livePill: {
    alignSelf: 'flex-start',
    backgroundColor: '#DCFCE7',
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#16A34A', marginRight: 7 },
  liveText: { color: '#166534', fontSize: 14, fontWeight: '900' },
  activityName: { fontSize: 24, color: '#111827', fontWeight: '900', marginBottom: 10 },
  detailRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  detailText: { color: '#374151', fontSize: 17, marginLeft: 8, flex: 1 },
  kopiButton: {
    backgroundColor: '#2563EB',
    width: '100%',
    minHeight: 78,
    borderRadius: 18,
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 18,
    marginBottom: 18,
  },
  kopiCopy: { flex: 1, marginLeft: 12 },
  kopiButtonText: { color: '#FFFFFF', fontSize: 21, fontWeight: '900' },
  kopiButtonSubtext: { color: '#DBEAFE', fontSize: 14, fontWeight: '700', marginTop: 3 },
  chatCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    width: '100%',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    alignItems: 'center',
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  chatTextContainer: { flex: 1 },
  chatTitle: { fontSize: 20, fontWeight: '900', color: '#111827' },
  chatSubtitle: { fontSize: 15, color: '#4B5563', lineHeight: 21, marginTop: 3 },
});
