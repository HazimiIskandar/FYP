import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

export default function SeniorBottomNav({
  onHome,
  onCommunity,
  onProfile,
  onSettings,
  activeTab,
  // When the senior has not yet linked a caregiver (newly created
  // account), the app forces all access through Profile + Settings. The
  // Community tab is REMOVED from the rendered list rather than disabled
  // so the senior cannot accidentally tap into games / community
  // activities before their caregiver finishes the setup. We KEEP the
  // onCommunity prop in the signature (called via App.js routing) so
  // existing screen contracts stay intact — the button simply does not
  // appear. Default false to keep the legacy full-access behaviour for
  // caregivers / middle-aged seniors who share the same UI shell.
  restrictedMode = false,
}) {
  const { t } = useTranslation();

  return (
    <View style={styles.bottomNav}>
      <TouchableOpacity style={styles.navItem} onPress={onHome}>
        <Ionicons name="home" size={26} color={activeTab === 'Home' ? '#2563EB' : '#6B7280'} />
        <Text style={[styles.navText, { color: activeTab === 'Home' ? '#2563EB' : '#6B7280' }]}>{t('navigation.home')}</Text>
      </TouchableOpacity>

      {restrictedMode ? null : (
        <TouchableOpacity style={styles.navItem} onPress={onCommunity}>
          <Ionicons name="people" size={26} color={activeTab === 'Community' ? '#2563EB' : '#6B7280'} />
          <Text style={[styles.navText, { color: activeTab === 'Community' ? '#2563EB' : '#6B7280' }]}>{t('navigation.community')}</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.navItem} onPress={onProfile}>
        <Ionicons name="person-circle" size={26} color={activeTab === 'Profile' ? '#2563EB' : '#6B7280'} />
        <Text style={[styles.navText, { color: activeTab === 'Profile' ? '#2563EB' : '#6B7280' }]}>{t('navigation.profile')}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.navItem} onPress={onSettings}>
        <Ionicons name="settings" size={26} color={activeTab === 'Settings' ? '#2563EB' : '#6B7280'} />
        <Text style={[styles.navText, { color: activeTab === 'Settings' ? '#2563EB' : '#6B7280' }]}>{t('navigation.settings')}</Text>
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
    borderTopColor: '#E5E7EB',
  },
  navItem: { alignItems: 'center', minWidth: 72 },
  navText: { color: '#6B7280', fontSize: 12, marginTop: 4, fontWeight: '700' },
});
