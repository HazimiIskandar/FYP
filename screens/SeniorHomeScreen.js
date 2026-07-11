import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, Animated, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import Header from '../components/Header';
import SeniorBottomNav from '../components/SeniorBottomNav';
import { useFontScale } from '../context/FontSizeContext';

export default function SeniorHomeScreen({ senior = {}, hasCheckedInMorning, hasCheckedInEvening, onCheckIn, onSOS, onCommunity, onProfile, onSettings, currentStreak, onSelectLanguage }) {
  const { t } = useTranslation();
  const { fontScale } = useFontScale();
  const currentHour = new Date().getHours();
  const isMorning = currentHour < 16;
  const hasCheckedIn = isMorning ? hasCheckedInMorning : hasCheckedInEvening;
  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const displayStreak = Math.max(0, currentStreak ?? 0);
  const languages = [
    { code: 'en', label: t('language.english') },
    { code: 'zh', label: t('language.chinese') },
    { code: 'ms', label: t('language.malay') },
    { code: 'ta', label: t('language.tamil') },
  ];

  const getSeniorDisplayName = (senior) => {
    if (!senior) return 'Unknown Senior';
    if (senior.full_name) return senior.full_name;
    if (senior.name) return senior.name;
    const firstName = senior.first_name || senior.firstName || '';
    const lastName = senior.last_name || senior.lastName || '';
    const combined = `${firstName} ${lastName}`.trim();
    return combined || 'Unknown Senior';
  };

  const seniorName = getSeniorDisplayName(senior);

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
      <Header
        title={seniorName ? t('home.goodMorningName', { name: seniorName }) : t('home.goodMorning')}
        subtitle={isMorning ? t('home.checkInMorning') : t('home.checkInEvening')}
        rightContent={(
          <TouchableOpacity
            style={styles.languageButton}
            onPress={() => setLanguageModalVisible(true)}
            activeOpacity={0.86}
          >
            <Text style={styles.languageButtonText}>{t('home.language')}</Text>
          </TouchableOpacity>
        )}
      />

      <ScrollView contentContainerStyle={styles.contentScroll} showsVerticalScrollIndicator={false}>
        <View style={styles.statusCard}>
          <View style={styles.statusIcon}>
            <Ionicons name={hasCheckedIn ? 'checkmark-circle' : 'sunny'} size={30} color={hasCheckedIn ? '#16A34A' : '#F59E0B'} />
          </View>
          <View style={styles.statusCopy}>
            <Text style={[styles.statusTitle, { fontSize: 18 * fontScale }]}>
              {hasCheckedIn ? t('home.checkedInToday') : t('home.checkInReady')}
            </Text>
            <Text style={[styles.statusSubtitle, { fontSize: 14 * fontScale }]}>
              {hasCheckedIn ? t('home.streakDays', { streak: displayStreak }) : t('home.familyWillSee')}
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
                <Text style={styles.stampLabel}>{t('home.day', { number: day })}</Text>
              </View>
            );
          })}
        </View>

        <View style={styles.mainActionArea}>
          {hasCheckedIn ? (
            <Animated.View style={[styles.giantCircle, styles.checkedCircle, { transform: [{ scale: scaleAnim }] }]}>
              <Ionicons name="checkmark" size={128} color="#FFFFFF" />
              <Text style={[styles.checkedText, { fontSize: 28 * fontScale }]} adjustsFontSizeToFit numberOfLines={2}>
                {isMorning ? t('home.doneForMorning') : t('home.doneForEvening')}
              </Text>
            </Animated.View>
          ) : (
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <TouchableOpacity style={styles.giantCircle} onPress={onCheckIn} activeOpacity={0.86}>
                <Ionicons name="hand-right" size={96} color="#2563EB" />
                <Text style={[styles.giantCircleText, { fontSize: 32 * fontScale }]} adjustsFontSizeToFit numberOfLines={2}>
                  {t('home.iAmOkay')}
                </Text>
                <Text style={[styles.giantCircleSubtext, { fontSize: 16 * fontScale }]} adjustsFontSizeToFit numberOfLines={2}>
                  {t('home.checkInNow')}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          )}
        </View>

        <TouchableOpacity style={styles.sosButton} onPress={onSOS} activeOpacity={0.86}>
          <Ionicons name="alert-circle" size={28} color="#FFFFFF" />
          <Text style={[styles.sosText, { fontSize: 28 * fontScale }]} adjustsFontSizeToFit numberOfLines={1}>{t('home.sosEmergency')}</Text>
        </TouchableOpacity>
      </ScrollView>

      <SeniorBottomNav activeTab="Home" onHome={() => {}} onCommunity={onCommunity} onProfile={onProfile} onSettings={onSettings} />

      {languageModalVisible ? (
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setLanguageModalVisible(false)}
        >
          <View style={styles.languageModal}>
            <Text style={styles.modalTitle}>{t('home.language')}</Text>
            {languages.map((lang) => (
              <TouchableOpacity
                key={lang.code}
                style={styles.modalLanguageOption}
                onPress={() => {
                  if (typeof onSelectLanguage === 'function') {
                    onSelectLanguage(lang.code);
                  }
                  setLanguageModalVisible(false);
                }}
                activeOpacity={0.86}
              >
                <Text style={styles.modalLanguageText}>{lang.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  languageButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  languageButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  contentScroll: { flexGrow: 1, alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20 },
  statusCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statusIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  statusCopy: { flex: 1 },
  statusTitle: { color: '#111827', fontSize: 18, fontWeight: '900' },
  statusSubtitle: { color: '#4B5563', fontSize: 14, marginTop: 2 },
  stampCard: {
    width: '100%',
    backgroundColor: '#EFF6FF',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  stampItem: { alignItems: 'center', width: 42 },
  stampCircle: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  stampFilled: { backgroundColor: '#16A34A' },
  stampEmpty: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#BFDBFE' },
  stampNumber: { color: '#6B7280', fontSize: 13, fontWeight: '800' },
  stampLabel: { color: '#4B5563', fontSize: 9, fontWeight: '700', marginTop: 4 },
  mainActionArea: { flexGrow: 1, justifyContent: 'center', paddingVertical: 16 },
  giantCircle: {
    width: 294,
    height: 294,
    borderRadius: 147,
    backgroundColor: '#22C55E',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 8,
    borderColor: '#BBF7D0',
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 12,
  },
  checkedCircle: { backgroundColor: '#16A34A', shadowColor: '#16A34A' },
  giantCircleText: { color: '#FFFFFF', fontSize: 42, fontWeight: '900', textAlign: 'center' },
  giantCircleSubtext: { color: '#DCFCE7', fontSize: 18, fontWeight: '800', marginTop: 8 },
  checkedText: { color: '#FFFFFF', fontSize: 18, fontWeight: '900', marginTop: -8, textAlign: 'center', paddingBottom: 8 },
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
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 20,
    backgroundColor: 'rgba(17, 24, 39, 0.52)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  languageModal: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
  },
  modalTitle: { color: '#111827', fontSize: 26, fontWeight: '900', marginBottom: 16, textAlign: 'center' },
  modalLanguageOption: {
    minHeight: 58,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#D8E7FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    backgroundColor: '#F8FAFC',
  },
  modalLanguageText: { color: '#111827', fontSize: 21, fontWeight: '800' },
});
