import React, { useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import CaregiverBottomNav from '../components/CaregiverBottomNav';

export default function CaregiverSeniorsListScreen({
  seniors = [],
  onGoToHome,
  onGoToStatus,
  onLogout,
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

  const rosterItems = seniors.map((senior, index) => {
    const name = getSeniorDisplayName(senior);
    const statusTag = getStatusTag(senior);

    return {
      id: senior?.senior_id || senior?.id || index,
      raw: senior,
      name,
      statusTag,
      subtitle: getRosterLabel(senior),
      avatarLetter: name?.charAt(0)?.toUpperCase() || '?',
      colorScheme: statusTag === 'Checked In' ? 'safe' : 'alert',
    };
  });

  const submitLinkCode = async () => {
    const cleanedCode = linkCode.trim().toUpperCase();

    if (!/^\d{6}$/.test(cleanedCode)) {
      setSubmitError('Please enter a valid 6-digit link code.');
      setSubmitMessage('');
      return;
    }

    if (!apiBase) {
      setSubmitError('Backend server is not available yet.');
      setSubmitMessage('');
      return;
    }

    if (!authenticatedUser?.user_id) {
      setSubmitError('You must be signed in as a caregiver to link a senior.');
      setSubmitMessage('');
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');
    setSubmitMessage('');

    try {
      const response = await fetch(`${apiBase}/caregiver/link-senior`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          link_code: cleanedCode,
          caregiver_id: authenticatedUser.user_id,
        }),
      });

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error || body?.message || 'Unable to link senior.');
      }

      setSubmitMessage('Senior linked successfully.');
      setLinkCode('');
      if (onRefresh) await onRefresh(authenticatedUser);
    } catch (error) {
      setSubmitError(error?.message || 'Unable to submit link code.');
    } finally {
      setIsSubmitting(false);
    }
  };

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
                <Text style={styles.rosterText}>{item.name}</Text>
                <Text style={styles.rosterSub}>{item.subtitle}</Text>
              </View>

              <Ionicons
                name={item.statusTag === 'Checked In' ? 'checkmark-circle' : 'warning-outline'}
                size={26}
                color={item.statusTag === 'Checked In' ? '#16A34A' : '#DC2626'}
              />
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
        onLogout={onLogout}
      />

      {addModalVisible ? (
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Add New Senior</Text>
                <Text style={styles.modalSubtitle}>Enter Senior's Link Code</Text>
              </View>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setAddModalVisible(false)}
                activeOpacity={0.86}
              >
                <Ionicons name="close" size={24} color="#111827" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Senior's Link Code</Text>
            <TextInput
              style={styles.codeInput}
              value={linkCode}
              onChangeText={(value) => {
                setLinkCode(value.replace(/\D/g, '').slice(0, 6));
                setSubmitError('');
                setSubmitMessage('');
              }}
              placeholder="Enter 6-digit code"
              placeholderTextColor="#9CA3AF"
              keyboardType="number-pad"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={6}
            />

            {submitError ? <Text style={styles.errorText}>{submitError}</Text> : null}
            {submitMessage ? <Text style={styles.successText}>{submitMessage}</Text> : null}

            <TouchableOpacity
              style={[styles.submitButton, isSubmitting && styles.disabledButton]}
              onPress={submitLinkCode}
              activeOpacity={0.86}
              disabled={isSubmitting}
            >
              <Text style={styles.submitButtonText}>{isSubmitting ? 'Linking...' : 'Link Senior'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
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
  emptyState: {
    marginTop: 28,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 6,
  },
  emptyText: {
    color: '#6B7280',
    fontSize: 14,
    textAlign: 'center',
    maxWidth: 280,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 10,
    maxWidth: 300,
  },
  successText: {
    color: '#15803D',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 10,
    fontWeight: '800',
  },
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
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  modalTitle: { color: '#111827', fontSize: 25, fontWeight: '900' },
  modalSubtitle: { color: '#6B7280', fontSize: 14, fontWeight: '700', marginTop: 2 },
  closeButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputLabel: { color: '#374151', fontSize: 14, fontWeight: '900', marginBottom: 8 },
  codeInput: {
    minHeight: 58,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#F8FAFC',
    color: '#111827',
    paddingHorizontal: 16,
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 2,
  },
  submitButton: {
    backgroundColor: '#2563EB',
    minHeight: 58,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  disabledButton: { opacity: 0.6 },
  submitButtonText: { color: '#FFFFFF', fontSize: 19, fontWeight: '900' },
});
