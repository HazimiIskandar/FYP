import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function CaregiverEmergencyScreen({ onCancel, onCallHelp, seniorName }) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.alertHeader}>
        <View style={styles.warningCircle}>
          <Ionicons name="warning" size={92} color="#FFFFFF" />
        </View>
        <Text style={styles.alertTitle}>Call Emergency Contact?</Text>
        <Text style={styles.alertSubtitle}>Are you sure you want to call the emergency contact for {seniorName}? This will trigger an emergency escalation.</Text>
      </View>

      <View style={styles.alertActionArea}>
        <TouchableOpacity style={styles.massiveRedButton} onPress={onCallHelp} activeOpacity={0.86}>
          <Ionicons name="call" size={30} color="#FFFFFF" />
          <Text style={styles.massiveRedButtonText}>Yes, Call Now</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelOutlineButton} onPress={onCancel} activeOpacity={0.86}>
          <Text style={styles.cancelOutlineText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827' },
  alertHeader: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  warningCircle: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  alertTitle: { color: '#FFFFFF', fontSize: 38, fontWeight: '900', textAlign: 'center' },
  alertSubtitle: { color: '#D1D5DB', fontSize: 20, lineHeight: 29, textAlign: 'center', marginTop: 16 },
  alertActionArea: { paddingHorizontal: 20, paddingBottom: 28 },
  massiveRedButton: {
    backgroundColor: '#DC2626',
    minHeight: 82,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  massiveRedButtonText: { color: '#FFFFFF', fontSize: 26, fontWeight: '900' },
  cancelOutlineButton: {
    backgroundColor: '#374151',
    minHeight: 70,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelOutlineText: { color: '#FFFFFF', fontSize: 22, fontWeight: '900' },
});
