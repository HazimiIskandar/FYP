import React, { useEffect, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform, StyleSheet, View } from 'react-native';

// Screens
import LanguageScreen from './screens/LanguageScreen';
import LoginScreen from './screens/LoginScreen';
import SeniorHomeScreen from './screens/SeniorHomeScreen';
import EmergencyScreen from './screens/EmergencyScreen';
import CaregiverHomeScreen from './screens/CaregiverHomeScreen';
import CaregiverRosterScreen from './screens/CaregiverRosterScreen';
import SeniorDetailsScreen from './screens/SeniorDetailsScreen';
import CommunityScreen from './screens/CommunityScreen';

import {
  cancelMissedCheckInReminders,
  scheduleMissedCheckInReminders,
  setupCheckInNotifications,
} from './services/checkInNotifications';

export default function App() {

  const [currentScreen, setCurrentScreen] = useState('Language');
  const [hasCheckedIn, setHasCheckedIn] = useState(false);

  const [selectedSenior, setSelectedSenior] = useState(null);

  const API_BASE = 'https://fyp-senior-connect.onrender.com';

  const [seniors, setSeniors] = useState([]);
  const [checkIns, setCheckIns] = useState([]);
  const [emergencyEvents, setEmergencyEvents] = useState([]);
  const [rewardStreaks, setRewardStreaks] = useState([]);

  const currentSenior =
    seniors.find((s) => parseInt(s?.senior_id, 10) === 1) || seniors?.[0] || null;

  const getSeniorDisplayName = (senior) => {
    return senior?.full_name ?? 'Unknown Senior';
  };

  const seniorName = getSeniorDisplayName(currentSenior);

  const handleSelectSenior = async (senior) => {
    try {
      const res = await fetch(
        `${API_BASE}/seniors/${senior.senior_id}/medical-conditions`
      );

      const conditions = await res.json();

      setSelectedSenior({
        ...senior,
        medicalConditions: Array.isArray(conditions) ? conditions : []
      });

      setCurrentScreen('SeniorDetails');
    } catch (err) {
      console.log('Failed to fetch medical conditions:', err);

      setSelectedSenior({
        ...senior,
        medicalConditions: []
      });

      setCurrentScreen('SeniorDetails');
    }
  };

  const getStreakValue = (item) =>
    item?.current_streak ?? item?.streak ?? item?.days ?? 0;

  const currentStreak =
    getStreakValue(rewardStreaks?.[0]) || getStreakValue(currentSenior);

  const todayString = new Date().toDateString();
  const checkedInCount = Array.from(
    new Set(
      checkIns
        .filter((c) =>
          (c?.checkin_status || '').toLowerCase().includes('completed')
        )
        .filter((c) =>
          !c?.checkin_timestamp ||
          new Date(c.checkin_timestamp).toDateString() === todayString
        )
        .map((c) => c.senior_id)
    )
  ).length;

  // -------------------------
  // Notifications setup
  // -------------------------
  useEffect(() => {
    setupCheckInNotifications();
  }, []);

  // -------------------------
  // Fetch backend data
  // -------------------------
  useEffect(() => {
    const fetchJson = async (url) => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Request failed: ${response.status} ${response.statusText}`);
      }
      return response.json();
    };

    const fetchData = async () => {
      try {
        const [seniorsData, checkInsData, emergencyData, rewardsData] =
          await Promise.all([
            fetchJson(`${API_BASE}/seniors`),
            fetchJson(`${API_BASE}/checkins`),
            fetchJson(`${API_BASE}/emergency-events`),
            fetchJson(`${API_BASE}/rewards`),
          ]);

        setSeniors(Array.isArray(seniorsData) ? seniorsData : []);
        setCheckIns(Array.isArray(checkInsData) ? checkInsData : []);
        setEmergencyEvents(Array.isArray(emergencyData) ? emergencyData : []);
        setRewardStreaks(Array.isArray(rewardsData) ? rewardsData : []);
      } catch (err) {
        console.log("API fetch error:", err);
        setSeniors([]);
        setCheckIns([]);
        setEmergencyEvents([]);
        setRewardStreaks([]);
      }
    };

    fetchData();
  }, []);

  // -------------------------
  // Check-in function
  // -------------------------
  const handleCheckIn = async () => {
    try {
      if (!currentSenior?.senior_id) {
        console.log("No senior_id found");
        return;
      }

      await fetch(`${API_BASE}/checkin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          senior_id: currentSenior.senior_id
        })
      });

      setHasCheckedIn(true);
      cancelMissedCheckInReminders();

    } catch (err) {
      console.log("Check-in error:", err);
    }
  };

  // -------------------------
  // Screen routing
  // -------------------------
  const renderScreen = () => {

    if (currentScreen === 'Language') {
      return (
        <LanguageScreen onSelectLanguage={() => setCurrentScreen('Login')} />
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
          seniorName={seniorName}
          hasCheckedIn={hasCheckedIn}
          currentStreak={currentStreak}
          onCheckIn={handleCheckIn}
          onSOS={() => setCurrentScreen('Emergency')}
          onCommunity={() => setCurrentScreen('Community')}
          onLogout={() => setCurrentScreen('Login')}
        />
      );
    }

    if (currentScreen === 'Community') {
      return (
        <CommunityScreen onHome={() => setCurrentScreen('Home')} />
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
          summary={{
            total: seniors.length,
            checkedIn: checkedInCount,
            urgent: 0
          }}
          prioritySenior={currentSenior}
          activeTicket={emergencyEvents?.[0]}
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
            onSelectSenior={handleSelectSenior}
        />
      );
    }

    if (currentScreen === 'SeniorDetails') {
      return (
        <SeniorDetailsScreen
          senior={selectedSenior ?? currentSenior}
          onGoToHome={() => setCurrentScreen('CaregiverHome')}
          onGoBack={() => setCurrentScreen('CaregiverRoster')}
          onLogout={() => setCurrentScreen('Login')}
          navigation={{
            goBack: () => setCurrentScreen('CaregiverRoster')
          }}
        />
      );
    }

    return null;
  };

  return <PhonePreview>{renderScreen()}</PhonePreview>;
}

// -------------------------
// UI wrapper
// -------------------------
function PhonePreview({ children }) {
  if (Platform.OS !== 'web') return children;

  return (
    <View style={styles.previewBackground}>
      <View style={styles.phoneShell}>
        <View style={styles.speaker} />
        <View style={styles.phoneScreen}>{children}</View>
      </View>
    </View>
  );
}

// -------------------------
// Styles
// -------------------------
const styles = StyleSheet.create({
  previewBackground: {
    flex: 1,
    minHeight: '100vh',
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneShell: {
    width: 390,
    height: 844,
    backgroundColor: '#111827',
    borderRadius: 40,
  },
  speaker: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    width: 60,
    height: 6,
    backgroundColor: '#374151',
  },
  phoneScreen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 34,
    overflow: 'hidden',
  },
});