import React, { useEffect, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform, StyleSheet, View, Text } from 'react-native';

// Import all your screens
import LanguageScreen from './screens/LanguageScreen';
import LoginScreen from './screens/LoginScreen';
import SeniorHomeScreen from './screens/SeniorHomeScreen';
import EmergencyScreen from './screens/EmergencyScreen';
import CaregiverHomeScreen from './screens/CaregiverHomeScreen';
import CaregiverRosterScreen from './screens/CaregiverRosterScreen';
import CommunityScreen from './screens/CommunityScreen';

import {
  cancelMissedCheckInReminders,
  scheduleMissedCheckInReminders,
  setupCheckInNotifications,
} from './services/checkInNotifications';

export default function App() {
  // Master State
  const [currentScreen, setCurrentScreen] = useState('Language');
  const [hasCheckedIn, setHasCheckedIn] = useState(false);

  // API Base URL
  const API_BASE = 'https://fyp-senior-connect.onrender.com';

  // Database States
  const [seniors, setSeniors] = useState([]);
  const [checkIns, setCheckIns] = useState([]);
  const [emergencyEvents, setEmergencyEvents] = useState([]);
  const [rewardStreaks, setRewardStreaks] = useState([]);

  // Loading State
  const [loading, setLoading] = useState(true);

  // Helpers
  const getRawText = (value) => (value ?? '').toString();

  const getStreakValue = (item) =>
    item?.current_streak ??
    item?.streak ??
    item?.reward_streak ??
    item?.days ??
    0;

  const currentSenior = seniors[0] || null;

  const seniorName =
    currentSenior?.name ||
    currentSenior?.full_name ||
    `${currentSenior?.first_name || 'Mr'} ${currentSenior?.last_name || 'Tan'}` ||
    'Mr Tan';

  const normalizeStatus = (item) => {
    const raw = getRawText(
      item?.status ||
      item?.checkin_status ||
      item?.health_status ||
      item?.event_status ||
      item?.event_type
    ).toLowerCase();

    if (/urgent|critical|fall|emergency|alert|missed/.test(raw))
      return 'Urgent';

    if (/missed|overdue/.test(raw))
      return 'Missed';

    if (/pending|waiting|follow/.test(raw))
      return 'Pending';

    if (/checked|ok|safe|completed/.test(raw))
      return 'Checked In';

    return 'Pending';
  };

  const prioritySenior =
    seniors.find((item) =>
      /(urgent|critical|fall|missed)/i.test(
        getRawText(
          item?.status ||
          item?.checkin_status ||
          item?.health_status ||
          item?.event_type
        )
      )
    ) || currentSenior;

  const summary = {
    total: seniors.length,

    urgent: seniors.filter((item) =>
      /(urgent|critical|fall|missed)/i.test(
        getRawText(
          item?.status ||
          item?.checkin_status ||
          item?.health_status ||
          item?.event_type
        )
      )
    ).length,

    checkedIn: checkIns.filter((item) =>
      /(checked|ok|safe|completed)/i.test(
        getRawText(
          item?.status ||
          item?.checkin_status ||
          item?.result
        )
      )
    ).length,
  };

  const currentStreak =
    getStreakValue(rewardStreaks[0]) ||
    getStreakValue(currentSenior);

  // Setup notifications
  useEffect(() => {
    setupCheckInNotifications();
  }, []);

  // Notification tap
  useEffect(() => {
    const subscription =
      Notifications.addNotificationResponseReceivedListener(() => {
        setCurrentScreen('Home');
      });

    return () => subscription.remove();
  }, []);

  // Reminder logic
  useEffect(() => {
    const seniorIsLoggedIn =
      currentScreen === 'Home' ||
      currentScreen === 'Community' ||
      currentScreen === 'Emergency';

    if (seniorIsLoggedIn && !hasCheckedIn) {
      scheduleMissedCheckInReminders(seniorName);
    } else {
      cancelMissedCheckInReminders();
    }
  }, [currentScreen, hasCheckedIn, seniorName]);

  // Fetch API Data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const load = async (path) => {
          const response = await fetch(`${API_BASE}/${path}`);

          if (!response.ok) {
            console.log(`Failed route: ${path}`);
            return [];
          }

          return await response.json();
        };

        const [
          seniorsData,
          checkInsData,
          emergencyData,
          rewardsData,
        ] = await Promise.all([
          load('seniors'),
          load('checkins'),
          load('emergency-events'),
          load('rewards'),
        ]);

        setSeniors(Array.isArray(seniorsData) ? seniorsData : []);
        setCheckIns(Array.isArray(checkInsData) ? checkInsData : []);
        setEmergencyEvents(Array.isArray(emergencyData) ? emergencyData : []);
        setRewardStreaks(Array.isArray(rewardsData) ? rewardsData : []);

      } catch (error) {
        console.log('API connection error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Check-in logic
  const handleCheckIn = () => {
    setHasCheckedIn(true);
    cancelMissedCheckInReminders();
  };

  // Logout
  const handleSeniorLogout = () => {
    cancelMissedCheckInReminders();
    setCurrentScreen('Login');
  };

  // Loading Screen
  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Text>Loading data...</Text>
      </View>
    );
  }

  // Navigation
  const renderScreen = () => {

    if (currentScreen === 'Language') {
      return (
        <LanguageScreen
          onSelectLanguage={() => setCurrentScreen('Login')}
        />
      );
    }

    if (currentScreen === 'Login') {
      return (
        <LoginScreen
          onLogin={() => setCurrentScreen('Home')}
          onCaregiverLogin={() => setCurrentScreen('CaregiverHome')}
        />
      );
    }

    if (currentScreen === 'Home') {
      return (
        <SeniorHomeScreen
          senior={currentSenior}
          hasCheckedIn={hasCheckedIn}
          currentStreak={currentStreak}
          onCheckIn={handleCheckIn}
          onSOS={() => setCurrentScreen('Emergency')}
          onCommunity={() => setCurrentScreen('Community')}
          onLogout={handleSeniorLogout}
        />
      );
    }

    if (currentScreen === 'Community') {
      return (
        <CommunityScreen
          onHome={() => setCurrentScreen('Home')}
          onLogout={handleSeniorLogout}
        />
      );
    }

    if (currentScreen === 'Emergency') {
      return (
        <EmergencyScreen
          onCancel={() => setCurrentScreen('Home')}
          onCallHelp={() => {}}
        />
      );
    }

    if (currentScreen === 'CaregiverHome') {
      return (
        <CaregiverHomeScreen
          summary={summary}
          prioritySenior={prioritySenior}
          activeTicket={emergencyEvents[0]}
          onCallEmergencyContact={() => {}}
          onGoToRoster={() => setCurrentScreen('CaregiverRoster')}
          onLogout={() => setCurrentScreen('Login')}
        />
      );
    }

    if (currentScreen === 'CaregiverRoster') {
      return (
        <CaregiverRosterScreen
          seniors={seniors}
          onGoToHome={() => setCurrentScreen('CaregiverHome')}
          onLogout={() => setCurrentScreen('Login')}
        />
      );
    }

    return null;
  };

  return <PhonePreview>{renderScreen()}</PhonePreview>;
}

// Phone wrapper for web
function PhonePreview({ children }) {
  if (Platform.OS !== 'web') return children;

  return (
    <View style={styles.previewBackground}>
      <View style={styles.phoneShell}>
        <View style={styles.speaker} />
        <View style={styles.phoneScreen}>
          {children}
        </View>
      </View>
    </View>
  );
}

// Styles
const styles = StyleSheet.create({
  previewBackground: {
    flex: 1,
    minHeight: '100vh',
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },

  phoneShell: {
    width: 390,
    height: 844,
    maxHeight: '94vh',
    backgroundColor: '#111827',
    borderRadius: 46,
    paddingHorizontal: 12,
    paddingTop: 28,
    paddingBottom: 12,
  },

  speaker: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    width: 72,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#374151',
  },

  phoneScreen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 34,
    overflow: 'hidden',
  },
});