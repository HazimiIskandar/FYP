import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import CaregiverBottomNav from '../components/CaregiverBottomNav';

// Maximum number of seniors a single caregiver is allowed to have linked
// at the same time. Caregivers can effectively monitor and check in on
// their assigned seniors only when their roster is bounded; capping at 5
// forces caregivers to drop an existing senior before tracking a new
// one instead of silently growing the roster indefinitely. Keep this in
// sync with MAX_SENIORS_PER_CAREGIVER in
// backend_api/routes/caregiverRoutes.js so the front-end banner and
// back-end gate agree on the same number.
const MAX_SENIORS_PER_CAREGIVER = 5;

// Single source of truth for the limit-reached hint surfaced everywhere
// on this screen (inline banner, button hint, modal submitError fallback,
// backend-error short-circuit). Keeping the wording in one place means
// a future translation / re-phrasing edit doesn't quietly drift between
// the four places that need to agree on the same sentence.
const MAX_REACHED_MESSAGE = `You have reached the maximum of ${MAX_SENIORS_PER_CAREGIVER} seniors per caregiver. Please remove a senior before adding a new one.`;

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
  const [warningModalVisible, setWarningModalVisible] = useState(false);
  const [linkCode, setLinkCode] = useState('');
  const [submitMessage, setSubmitMessage] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');

  const getRawText = (value) => (value ?? '').toString();

  // Number of seniors currently linked to this caregiver, plus the
  // derived `isAtLimit` flag the banner + add-button check both read.
  // `Array.isArray` guard keeps `seniors` undefined-safe (default prop
  // is `[]`, but defensive code here prevents a future caller from
  // crashing the screen by passing e.g. a fetch error body).
  const seniorCount = Array.isArray(seniors) ? seniors.length : 0;
  const isAtLimit = seniorCount >= MAX_SENIORS_PER_CAREGIVER;

  const openAddModal = () => {
    // Show a warning prompt if they are at or above the recommended limit (5)
    if (isAtLimit) {
      setWarningModalVisible(true);
      return;
    }

    setAddModalVisible(true);
    setSubmitMessage('');
    setSubmitError('');
  };

  const closeAddModal = () => {
    if (isSubmitting) return;
    setAddModalVisible(false);
    setLinkCode('');
    setSubmitError('');
    setSubmitMessage('');
  };

  const handleLinkSenior = async () => {
    const caregiverId = authenticatedUser?.user_id;
    const normalizedCode = getRawText(linkCode).trim().toUpperCase();

    setSubmitError('');
    setSubmitMessage('');

    if (!caregiverId) {
      setSubmitError('Unable to identify caregiver account. Please sign in again.');
      return;
    }

    if (!/^[A-Z0-9]{6}$/.test(normalizedCode)) {
      setSubmitError('Please enter a valid 6-character link code.');
      return;
    }

    if (!apiBase) {
      setSubmitError('Unable to connect to server. Please try again.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`${apiBase}/caregiver/link-senior`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caregiver_id: caregiverId,
          link_code: normalizedCode,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        // Special-case the backend's CAREGIVER_AT_SENIOR_LIMIT error so a
        // back-end rejection presents the same message the inline banner
        // shows on the main screen. Falls back to the generic message for
        // every other error so we never surface incomplete data.
        if (payload?.code === 'CAREGIVER_AT_SENIOR_LIMIT') {
          setSubmitError(MAX_REACHED_MESSAGE);
        } else {
          setSubmitError(payload?.error || 'Unable to add senior. Please verify the code and try again.');
        }
        return;
      }

      setSubmitMessage('Senior linked successfully.');
      setLinkCode('');

      if (onRefresh) {
        await onRefresh(authenticatedUser);
      }
    } catch (err) {
      setSubmitError(err?.message || 'Network error while adding senior. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
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
    const age = getSeniorAge(senior);

    // Card layout is intentionally minimal — just the senior's name and
    // age. Status / "Checked in today" / "Pending follow up" subtitles
    // were removed because the user wants the list to act as a roster of
    // names only. Caregivers can drill into a senior's profile to see
    // their full status.
    return {
      id: senior?.senior_id || senior?.id || index,
      raw: senior,
      name,
      age,
      avatarLetter: name?.charAt(0)?.toUpperCase() || '?',
    };
  }).filter((item) => {
    if (searchQuery && !item.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Seniors List" subtitle="All assigned seniors" />

      <ScrollView contentContainerStyle={styles.scrollContent}>

        <TouchableOpacity
          style={styles.addSeniorButton}
          activeOpacity={0.86}
          onPress={openAddModal}
        >
          <Ionicons
            name="add-circle"
            size={22}
            color="#FFFFFF"
          />
          <Text
            style={styles.addSeniorButtonText}
            numberOfLines={1}
          >
            Add New Senior
          </Text>
        </TouchableOpacity>

        {/*
          Limit-reached banner. Rendered ABOVE the Add Senior button so the
          caregiver sees the reason the button is disabled before tapping
          it, and below the button so the natural reading order on the
          screen is: search bar → CTA → warning (which is the same order
          the eye lands on when scrolling). Uses an alert-amber palette
          (rather than red) because the situation is a soft warning, not
          an error — the caregiver can still interact with the rest of
          their roster normally, and clearing one slot will re-enable
          the CTA on the very next refresh tick.
        */}
        {isAtLimit ? (
          <View
            style={styles.limitBanner}
            // accessibilityRole="alert" + accessibilityLiveRegion="polite"
            // tell VoiceOver / TalkBack to announce the limit warning as
            // soon as it appears on screen. Without these the banner is
            // visually obvious but silent for screen-reader users, which
            // is the exact inverse of the "show me why the button is
            // disabled" question a caregiver would otherwise ask aloud.
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            accessibilityLabel={`Maximum reached: ${seniorCount} of ${MAX_SENIORS_PER_CAREGIVER} senior slots used. You can't add more seniors unless one is removed.`}
          >
            <View
              style={styles.limitBannerIconWrap}
              // Mark the icon wrapper as decorative so VoiceOver / TalkBack
              // doesn't announce an isolated "warning" graphic *before*
              // the parent's accessibilityLabel ("Maximum reached …"). With
              // this flag the screen-reader jumps straight to the labelled
              // sentence instead of tripping over the visual symbol.
              accessibilityElementsHidden={true}
              importantForAccessibility="no"
            >
              <Ionicons name="warning" size={22} color="#B45309" />
            </View>
            <View style={styles.limitBannerCopy}>
              <Text style={styles.limitBannerTitle}>
                Recommended Maximum Reached
              </Text>
              <Text style={styles.limitBannerBody}>
                You have {seniorCount} seniors. We recommend a max of 5 for quality monitoring.
              </Text>
            </View>
          </View>
        ) : null}
        {!isAtLimit && seniorCount > 0 ? (
          <Text style={styles.slotHint} numberOfLines={2}>
            {seniorCount}/{MAX_SENIORS_PER_CAREGIVER} senior slots used
          </Text>
        ) : null}

        {/*
          Submit-error notice rendered ABOVE the roster so a stray tap on
          the disabled button (e.g. via screen-reader accessibility) still
          surfaces the same limit-reached hint the banner is displaying.
          Kept separate from the modal's submitError so the message
          remains visible AFTER the modal has been dismissed / never
          opened.
        */}
        {!addModalVisible && submitError ? (
          <Text style={styles.errorText}>{submitError}</Text>
        ) : null}

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
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {item.avatarLetter}
                </Text>
              </View>

              <View style={styles.rosterCopy}>
                {/* Minimal card: only name + age, no status subtitle. */}
                <Text style={styles.rosterText}>
                  {item.name}{item.age ? ` (Age: ${item.age})` : ''}
                </Text>
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

      <Modal
        visible={addModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeAddModal}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={closeAddModal} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add New Senior</Text>
            <Text style={styles.modalDescription}>
              Enter the 6-character link code provided by the senior.
            </Text>

            <TextInput
              value={linkCode}
              onChangeText={(value) => setLinkCode(getRawText(value).toUpperCase())}
              placeholder="Enter link code"
              autoCapitalize="characters"
              maxLength={6}
              style={styles.codeInput}
              editable={!isSubmitting}
            />

            {submitError ? <Text style={styles.errorText}>{submitError}</Text> : null}
            {submitMessage ? <Text style={styles.successText}>{submitMessage}</Text> : null}

            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={closeAddModal}
                style={[styles.modalActionButton, styles.cancelButton]}
                disabled={isSubmitting}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleLinkSenior}
                style={[styles.modalActionButton, styles.submitButton]}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitButtonText}>Add Senior</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={warningModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setWarningModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setWarningModalVisible(false)} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Recommended Limit</Text>
            <Text style={[styles.modalDescription, { marginBottom: 24 }]}>
              You already have {seniorCount} seniors. We strongly recommend a maximum of {MAX_SENIORS_PER_CAREGIVER} seniors per caregiver to ensure quality care.{"\n\n"}Are you sure you want to continue adding more seniors?
            </Text>

            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setWarningModalVisible(false)}
                style={[styles.modalActionButton, styles.cancelButton]}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setWarningModalVisible(false);
                  setAddModalVisible(true);
                  setSubmitMessage('');
                  setSubmitError('');
                }}
                style={[styles.modalActionButton, styles.submitButton]}
              >
                <Text style={styles.submitButtonText}>Continue</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
    minHeight: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
    width: '100%',
    paddingHorizontal: 18,
  },
  // Disabled state for the Add Senior CTA when the caregiver has hit
  // the per-caregiver cap. Mirrors the existing grey-100 / grey-500
  // disabled palette used by the other TouchableOpacity buttons on
  // this screen (see `cancelButton`) so the visual cue is consistent
  // with the rest of the screen rather than introducing a fresh
  // grey shade for a single tap target.
  addSeniorButtonDisabled: {
    backgroundColor: '#E5E7EB',
    marginBottom: 14,
  },
  addSeniorButtonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '900', flexShrink: 1 },
  addSeniorButtonTextDisabled: { color: '#6B7280' },
  // Inline alert shown when the caregiver has hit the 5-senior cap.
  // Amber palette was chosen over red because the situation is a soft
  // warning (the caregiver can still see / tap their existing
  // roster), not an outright error — the deep amber icons stay
  // legible on the larger FontSizeContext scales without a layout
  // shift when the message wraps to two lines on smaller phones.
  limitBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 14,
    gap: 12,
  },
  limitBannerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FDE68A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  limitBannerCopy: { flex: 1, flexShrink: 1 },
  limitBannerTitle: {
    color: '#92400E',
    fontSize: 15,
    fontWeight: '900',
  },
  limitBannerBody: {
    color: '#78350F',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
    flexShrink: 1,
  },
  // Subtle grey line under the Add Senior CTA when below cap, showing
  // {used}/{total} slots so the caregiver always knows how close they
  // are to the limit. Hidden at the limit itself because the louder
  // amber banner takes over the same slot.
  slotHint: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 14,
  },
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
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#374151',
    fontSize: 20,
    fontWeight: '900',
  },
  rosterCopy: { flex: 1 },
  rosterText: { color: '#111827', fontSize: 21, fontWeight: '900' },
  emptyState: { alignItems: 'center', marginTop: 40 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#111827' },
  emptyText: { fontSize: 14, color: '#6B7280', marginTop: 8, textAlign: 'center' },
  errorText: { fontSize: 14, color: '#DC2626', marginTop: 8 },
  successText: { fontSize: 14, color: '#15803D', marginTop: 8 },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: 'rgba(17, 24, 39, 0.35)',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    alignSelf: 'center',
    width: '50%',
    maxWidth: 300,
    minWidth: 300,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 18,
  },
  modalTitle: { fontSize: 22, fontWeight: '900', color: '#111827' },
  modalDescription: { fontSize: 14, color: '#4B5563', marginTop: 6, marginBottom: 14 },
  codeInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 1,
    color: '#111827',
    backgroundColor: '#F9FAFB',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
  },
  modalActionButton: {
    minHeight: 44,
    minWidth: 110,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
  },
  cancelButtonText: {
    color: '#374151',
    fontSize: 15,
    fontWeight: '800',
  },
  submitButton: {
    backgroundColor: '#2563EB',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  errorText: {
    color: '#DC2626',
    marginTop: 12,
    fontSize: 14,
    textAlign: 'center',
  },
  filterSection: {
    marginBottom: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
  },
});