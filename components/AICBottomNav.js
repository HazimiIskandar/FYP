import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function AICBottomNav({ activeTab, onCases, onSettings }) {
  return (
    <View style={styles.bottomNav}>
      <TouchableOpacity style={styles.navItem} onPress={onCases}>
        <Ionicons
          name="folder-open"
          size={26}
          color={activeTab === 'Cases' ? '#2563EB' : '#6B7280'}
        />
        <Text style={[styles.navText, activeTab === 'Cases' && styles.navTextActive]}>Cases</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.navItem} onPress={onSettings}>
        <Ionicons
          name="settings-outline"
          size={26}
          color={activeTab === 'Settings' ? '#2563EB' : '#6B7280'}
        />
        <Text style={[styles.navText, activeTab === 'Settings' && styles.navTextActive]}>
          Settings
        </Text>
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
  navItem: { alignItems: 'center', minWidth: 88 },
  navText: { color: '#6B7280', fontSize: 13, marginTop: 4, fontWeight: '700' },
  navTextActive: { color: '#2563EB' },
});
