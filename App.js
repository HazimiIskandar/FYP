import React, { useEffect, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform, StyleSheet, View } from 'react-native';

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

  // From SQL (backend)
  const [seniorData, setSeniorData] = useState([]);
  const [currentStreak, setCurrentStreak] = useState(0);

  // Setup notifications once
  useEffect(() => {
    setupCheckInNotifications();
  }, []);

  // Handle notification tap
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
      scheduleMissedCheckInReminders('Mr. Tan');
    } else {
      cancelMissedCheckInReminders();
    }
  }, [currentScreen, hasCheckedIn]);

  // Connect to Backend API
  useEffect(() => {
    fetch('https://fyp-senior-connect.onrender.com/seniors')
      .then(res => res.json())
      .then(data => {
        setSeniorData(data);

        // If your DB has streak column
        if (data.length > 0) {
          setCurrentStreak(data[0].current_streak || 0);
        }
      })
      .catch(err => {
        console.log('API error:', err);
      });
  }, []);

  // Check-in logic
  const handleCheckIn = () => {
    setHasCheckedIn(true);
    cancelMissedCheckInReminders();

  };

  const handleSeniorLogout = () => {
    cancelMissedCheckInReminders();
    setCurrentScreen('Login');
  };

  // Screen routing
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
          onGoToRoster={() => setCurrentScreen('CaregiverRoster')}
          onLogout={() => setCurrentScreen('Login')}
        />
      );
    }

    if (currentScreen === 'CaregiverRoster') {
      return (
        <CaregiverRosterScreen
          onGoToHome={() => setCurrentScreen('CaregiverHome')}
          onLogout={() => setCurrentScreen('Login')}
        />
      );
    }

    return null;
  };

  return <PhonePreview>{renderScreen()}</PhonePreview>;
}

// Phone UI wrapper (web preview)
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