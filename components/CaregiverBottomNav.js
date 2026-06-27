import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function CaregiverBottomNav({ activeTab, onHome, onSeniors, onStatus, onSettings }) {
  return (
    <View style={styles.bottomNav}>
      <TouchableOpacity style={styles.navItem} onPress={onHome}>
        <Ionicons name="home" size={26} color={activeTab === 'Home' ? '#2563EB' : '#6B7280'} />
        <Text style={[styles.navText, { color: activeTab === 'Home' ? '#2563EB' : '#6B7280' }]}>Home</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.navItem} onPress={onSeniors}>
        <Ionicons name="accessibility" size={26} color={activeTab === 'Seniors' ? '#2563EB' : '#6B7280'} />
        <Text style={[styles.navText, { color: activeTab === 'Seniors' ? '#2563EB' : '#6B7280' }]}>Seniors</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.navItem} onPress={onStatus}>
        <Ionicons name="pulse" size={26} color={activeTab === 'Status' ? '#2563EB' : '#6B7280'} />
        <Text style={[styles.navText, { color: activeTab === 'Status' ? '#2563EB' : '#6B7280' }]}>Status</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.navItem} onPress={onSettings}>
        <Ionicons name="settings" size={26} color={activeTab === 'Settings' ? '#2563EB' : '#6B7280'} />
        <Text style={[styles.navText, { color: activeTab === 'Settings' ? '#2563EB' : '#6B7280' }]}>Settings</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#FFFFFF',
    paddingTop: 12,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderColor: '#E5E7EB',
  },
  navItem: { alignItems: 'center', minWidth: 72 },
  navText: { color: '#6B7280', fontSize: 12, marginTop: 4, fontWeight: '700' },
});
