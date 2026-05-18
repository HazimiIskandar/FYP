import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import SeniorBottomNav from '../components/SeniorBottomNav';

export default function SeniorHomeScreen({ hasCheckedIn, onCheckIn, onSOS, onCommunity, onLogout, currentStreak }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const displayStreak = hasCheckedIn ? currentStreak + 1 : currentStreak;

  useEffect(() => {
    if (!hasCheckedIn) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.04, duration: 1200, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }

    Animated.spring(scaleAnim, { toValue: 1, friction: 5, useNativeDriver: true }).start();
  }, [hasCheckedIn, pulseAnim, scaleAnim]);

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Good morning" subtitle="Tap once to let your caregiver know you are okay" />

      <View style={styles.content}>
        <View style={styles.statusCard}>
          <View style={styles.statusIcon}>
            <Ionicons name={hasCheckedIn ? 'checkmark-circle' : 'sunny'} size={30} color={hasCheckedIn ? '#16A34A' : '#F59E0B'} />
          </View>
          <View style={styles.statusCopy}>
            <Text style={styles.statusTitle}>
              {hasCheckedIn ? 'You checked in today' : 'Daily check-in is ready'}
            </Text>
            <Text style={styles.statusSubtitle}>
              {hasCheckedIn ? `${displayStreak}-day streak. Two more days to redeem kopi.` : 'Your family will see your status after you tap.'}
            </Text>
          </View>
        </View>

        <View style={styles.stampCard}>
          {[1, 2, 3, 4, 5, 6, 7].map((day) => {
            const filled = day <= displayStreak;
            return (
              <View key={day} style={styles.stampItem}>
                <View style={[styles.stampCircle, filled ? styles.stampFilled : styles.stampEmpty]}>
                  {filled ? <Ionicons name="checkmark-sharp" size={18} color="#FFFFFF" /> : <Text style={styles.stampNumber}>{day}</Text>}
                </View>
                <Text style={styles.stampLabel}>Day {day}</Text>
              </View>
            );
          })}
        </View>

        <View style={styles.mainActionArea}>
          {hasCheckedIn ? (
            <Animated.View style={[styles.giantCircle, styles.checkedCircle, { transform: [{ scale: scaleAnim }] }]}>
              <Ionicons name="checkmark" size={128} color="#FFFFFF" />
              <Text style={styles.checkedText}>Done</Text>
            </Animated.View>
          ) : (
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <TouchableOpacity style={styles.giantCircle} onPress={onCheckIn} activeOpacity={0.86}>
                <Text style={styles.giantCircleText}>I am okay</Text>
                <Text style={styles.giantCircleSubtext}>Check in now</Text>
              </TouchableOpacity>
            </Animated.View>
          )}
        </View>

        <TouchableOpacity style={styles.sosButton} onPress={onSOS} activeOpacity={0.86}>
          <Ionicons name="alert-circle" size={28} color="#FFFFFF" />
          <Text style={styles.sosText}>SOS Emergency</Text>
        </TouchableOpacity>
      </View>

      <SeniorBottomNav activeTab="Home" onHome={() => {}} onCommunity={onCommunity} onLogout={onLogout} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { flex: 1, alignItems: 'center', paddingHorizontal: 20, paddingTop: 18 },
  statusCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statusIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  statusCopy: { flex: 1 },
  statusTitle: { color: '#111827', fontSize: 20, fontWeight: '900' },
  statusSubtitle: { color: '#4B5563', fontSize: 15, lineHeight: 21, marginTop: 4 },
  stampCard: {
    width: '100%',
    backgroundColor: '#EFF6FF',
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  stampItem: { alignItems: 'center', width: 44 },
  stampCircle: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  stampFilled: { backgroundColor: '#16A34A' },
  stampEmpty: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#BFDBFE' },
  stampNumber: { color: '#6B7280', fontSize: 13, fontWeight: '800' },
  stampLabel: { color: '#4B5563', fontSize: 10, fontWeight: '700', marginTop: 5 },
  mainActionArea: { flex: 1, justifyContent: 'center' },
  giantCircle: {
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: '#22C55E',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 8,
    borderColor: '#BBF7D0',
  },
  checkedCircle: { backgroundColor: '#16A34A' },
  giantCircleText: { color: '#FFFFFF', fontSize: 42, fontWeight: '900', textAlign: 'center', lineHeight: 48 },
  giantCircleSubtext: { color: '#DCFCE7', fontSize: 18, fontWeight: '800', marginTop: 8 },
  checkedText: { color: '#FFFFFF', fontSize: 26, fontWeight: '900', marginTop: -8 },
  sosButton: {
    backgroundColor: '#DC2626',
    width: '100%',
    minHeight: 66,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  sosText: { color: '#FFFFFF', fontSize: 22, fontWeight: '900' },
});
