import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function SeniorBottomNav({ onHome, onCommunity, onProfile, onLogout, activeTab }) {
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const handleLogout = () => {
    setShowLogoutModal(false);
    onLogout();
  };

  return (
    <>
      {showLogoutModal ? (
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIcon}>
              <Ionicons name="log-out-outline" size={34} color="#2563EB" />
            </View>
            <Text style={styles.modalTitle}>Log out?</Text>
            <Text style={styles.modalMessage}>Please confirm before leaving your senior account.</Text>

            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.86}>
              <Text style={styles.logoutButtonText}>Log out</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.stayButton} onPress={() => setShowLogoutModal(false)} activeOpacity={0.86}>
              <Text style={styles.stayButtonText}>Stay logged in</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem} onPress={onHome}>
          <Ionicons name="home" size={26} color={activeTab === 'Home' ? '#2563EB' : '#6B7280'} />
          <Text style={[styles.navText, { color: activeTab === 'Home' ? '#2563EB' : '#6B7280' }]}>Home</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.navItem} onPress={onCommunity}>
          <Ionicons name="people" size={26} color={activeTab === 'Community' ? '#2563EB' : '#6B7280'} />
          <Text style={[styles.navText, { color: activeTab === 'Community' ? '#2563EB' : '#6B7280' }]}>Community</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={onProfile}>
          <Ionicons name="person-circle" size={26} color={activeTab === 'Profile' ? '#2563EB' : '#6B7280'} />
          <Text style={[styles.navText, { color: activeTab === 'Profile' ? '#2563EB' : '#6B7280' }]}>Profile</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => setShowLogoutModal(true)}>
          <Ionicons name="log-out-outline" size={26} color="#6B7280" />
          <Text style={styles.navText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}
const styles = StyleSheet.create({
  modalOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 20,
    backgroundColor: 'rgba(17, 24, 39, 0.55)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 22,
    alignItems: 'center',
  },
  modalIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  modalTitle: { color: '#111827', fontSize: 28, fontWeight: '900', textAlign: 'center' },
  modalMessage: {
    color: '#4B5563',
    fontSize: 17,
    lineHeight: 24,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  logoutButton: {
    backgroundColor: '#DC2626',
    width: '100%',
    minHeight: 58,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  logoutButtonText: { color: '#FFFFFF', fontSize: 20, fontWeight: '900' },
  stayButton: {
    backgroundColor: '#EFF6FF',
    width: '100%',
    minHeight: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stayButtonText: { color: '#2563EB', fontSize: 18, fontWeight: '900' },
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
