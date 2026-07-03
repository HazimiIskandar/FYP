import React, { useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import CaregiverBottomNav from '../components/CaregiverBottomNav';

export default function CaregiverSeniorsListScreen({
  seniors = [],
  onGoToHome,
  onGoToStatus,
  onSettings,
  onSelectSenior,
  backendError,
  apiBase,
  authenticatedUser,
  onRefresh,
}) {
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [linkCode, setLinkCode] = useState('');
  const [submitMessage, setSubmitMessage] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [removeModalVisible, setRemoveModalVisible] = useState(false);
  const [removingSenior, setRemovingSenior] = useState(false);
  const [seniorToRemove, setSeniorToRemove] = useState(null);
  const [removeError, setRemoveError] = useState('');

  const getRawText = (value) => (value ?? '').toString();

  const getStatusTag = (senior) => {
    const raw = getRawText(
      senior?.status || senior?.checkin_status || senior?.health_status || ''
    ).toLowerCase();

    if (/urgent|critical|fall|emergency|alert/.test(raw)) return 'Urgent';
    if (/missed|overdue/.test(raw)) return 'Missed';
    if (/pending|waiting|follow/.test(raw)) return 'Pending';
    if (/checked|ok|safe|completed/.test(raw)) return 'Checked In';
    return 'Pending';
  };

  const getRosterLabel = (senior) => {
    const status = getStatusTag(senior);

    if (status === 'Urgent') return 'Fall detected';
    if (status === 'Missed') return 'Missed check-in';
    if (status === 'Checked In') return 'Checked in today';
    return 'Pending follow up';
  };

  const getSeniorDisplayName = (senior) => (
    senior?.User_Account?.full_name ||
    senior?.user?.full_name ||
    senior?.full_name ||
    'Unknown Senior'
  );

  // Helper to get age
  const getSeniorAge = (senior) => {
    if (senior?.age) return senior.age;
    if (senior?.date_of_birth) {
      const dob = new Date(senior.date_of_birth);
      const diff = Date.now() - dob.getTime();
      const ageDate = new Date(diff);
      return Math.abs(ageDate.getUTCFullYear() - 1970);
    }
    return null;
  };

  const rosterItems = seniors.map((senior, index) => {
    const name = getSeniorDisplayName(senior);
    const statusTag = getStatusTag(senior);
    const age = getSeniorAge(senior);

    return {
      id: senior?.senior_id || senior?.id || index,
      raw: senior,
      name,
      age,
      statusTag,
      subtitle: getRosterLabel(senior),
      avatarLetter: name?.charAt(0)?.toUpperCase() || '?',
      colorScheme: statusTag === 'Checked In' ? 'safe' : 'alert',
    };
  });

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Seniors List" subtitle="All assigned seniors" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <TouchableOpacity
          style={styles.addSeniorButton}
          onPress={() => {
            setAddModalVisible(true);
            setSubmitMessage('');
            setSubmitError('');
          }}
          activeOpacity={0.86}
        >
          <Ionicons name="add-circle" size={26} color="#FFFFFF" />
          <Text style={styles.addSeniorButtonText}>Add New Senior</Text>
        </TouchableOpacity>

        {rosterItems.length > 0 ? (
          rosterItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.rosterCard}
              activeOpacity={0.86}
              onPress={() => {
                if (onSelectSenior) {
                  onSelectSenior(item.raw);
                }
              }}
            >
              <View
                style={[
                  styles.avatar,
                  item.colorScheme === 'safe' && styles.safeAvatar,
                ]}
              >
                <Text
                  style={[
                    styles.avatarText,
                    item.colorScheme === 'safe' && styles.safeAvatarText,
                  ]}
                >
                  {item.avatarLetter}
                </Text>
              </View>

              <View style={styles.rosterCopy}>
                {/* UPDATED: Show name with age in parentheses */}
                <Text style={styles.rosterText}>
                  {item.name}{item.age ? ` Age: ${item.age}` : ''}
                </Text>
                <Text style={styles.rosterSub}>{item.subtitle}</Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Ionicons
                  name={item.statusTag === 'Checked In' ? 'checkmark-circle' : 'warning-outline'}
                  size={26}
                  color={item.statusTag === 'Checked In' ? '#16A34A' : '#DC2626'}
                />
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    setSeniorToRemove(item.raw);
                    setRemoveError('');
                    setRemoveModalVisible(true);
                  }}
                  hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
                >
                  <Ionicons name="trash-outline" size={24} color="#DC2626" />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No seniors found</Text>
            <Text style={styles.emptyText}>
              Please sync your roster or check your database connection.
            </Text>
            {backendError ? (
              <Text style={styles.errorText}>{backendError}</Text>
            ) : null}
          </View>
        )}
      </ScrollView>

      <CaregiverBottomNav
        activeTab="Seniors"
        onHome={onGoToHome}
        onSeniors={() => {}}
        onStatus={onGoToStatus}
        onSettings={onSettings}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scrollContent: { padding: 20, paddingBottom: 28 },
  addSeniorButton: {
    backgroundColor: '#2563EB',
    minHeight: 62,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  addSeniorButtonText: { color: '#FFFFFF', fontSize: 20, fontWeight: '900' },
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
  avatarText: {
    color: '#B91C1C',
    fontSize: 20,
    fontWeight: '900',
  },
  safeAvatar: { backgroundColor: '#DCFCE7' },
  safeAvatarText: { color: '#166534' },
  rosterCopy: { flex: 1 },
  rosterText: { color: '#111827', fontSize: 21, fontWeight: '900' },
  rosterSub: { color: '#6B7280', fontSize: 14, marginTop: 4 },
  emptyState: { alignItems: 'center', marginTop: 40 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#111827' },
  emptyText: { fontSize: 14, color: '#6B7280', marginTop: 8, textAlign: 'center' },
  errorText: { fontSize: 14, color: '#DC2626', marginTop: 8 },
});