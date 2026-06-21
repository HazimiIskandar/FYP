import React, { useEffect, useState } from 'react';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform, StyleSheet, View } from 'react-native';

// Screens
import LanguageScreen from './screens/LanguageScreen';
import LoginScreen from './screens/LoginScreen';
import CaregiverLoginScreen from './screens/CaregiverLoginScreen';
import BiometricFaceScreen from './screens/BiometricFaceScreen';
import CreateAccountScreen from './screens/CreateAccountScreen';
import ForgotPasswordScreen from './screens/ForgotPasswordScreen';
import SeniorHomeScreen from './screens/SeniorHomeScreen';
import SeniorProfileScreen from './screens/SeniorProfileScreen';
import SeniorSettingsScreen from './screens/SeniorSettingsScreen';
import EmergencyScreen from './screens/EmergencyScreen';
import CaregiverHomeScreen from './screens/CaregiverHomeScreen';
import CaregiverSeniorsListScreen from './screens/CaregiverSeniorsListScreen';
import CaregiverRosterScreen from './screens/CaregiverRosterScreen';
import AICPortalScreen from './screens/AICPortalScreen';
import SeniorDetailsScreen from './screens/SeniorDetailsScreen';
import CommunityScreen from './screens/CommunityScreen';
import FakeCallScreen from './screens/FakeCallScreen';

import {
  cancelMissedCheckInReminders,
  setupCheckInNotifications,
} from './services/checkInNotifications';

export default function App() {

  const [currentScreen, setCurrentScreen] = useState('Language');
  const [hasCheckedIn, setHasCheckedIn] = useState(false);
  const [selectedSenior, setSelectedSenior] = useState(null);
  const [selectedSeniorOrigin, setSelectedSeniorOrigin] = useState('Status');
  const [authenticatedUser, setAuthenticatedUser] = useState(null);
  const [loginError, setLoginError] = useState(null);
  const [registerError, setRegisterError] = useState(null);

  const REMOTE_API_BASE = 'https://fyp-senior-connect.onrender.com';
  const getHostFromUri = (uri) => {
    if (!uri) return null;
    const match = uri.match(/^(?:https?:\/\/)?([^:\/]+)(?::\d+)?/);
    return match ? match[1] : null;
  };
  const expoHost =
    getHostFromUri(Constants.manifest?.debuggerHost) ||
    getHostFromUri(Constants.expoConfig?.hostUri);
  const LOCAL_API_BASES = [
    Platform.OS === 'android' ? 'http://10.0.2.2:10000' : 'http://localhost:10000',
    expoHost && expoHost !== 'localhost' ? `http://${expoHost}:10000` : null,
  ].filter(Boolean);
  const [apiBase, setApiBase] = useState(null);
  const [backendError, setBackendError] = useState(null);

  const [seniors, setSeniors] = useState([]);
  const [users, setUsers] = useState([]);
  const [checkIns, setCheckIns] = useState([]);
  const [emergencyEvents, setEmergencyEvents] = useState([]);
  const [rewardStreaks, setRewardStreaks] = useState([]);

  // -------------------------
  // DB NORMALIZER (IMPORTANT FIX)
  // -------------------------
  const mergeSeniorWithUser = (senior, userMap = null) => {
    const user = userMap
      ? userMap.get(senior.user_id)
      : users.find((u) => u.user_id === senior.user_id);

    return {
      ...senior,
      ...(user || {}),
    };
  };

  const normalizeSenior = (s, userMap = null) => {
    const combined = mergeSeniorWithUser(s, userMap);

    return {
      ...combined,

      full_name:
        combined?.full_name ||
        combined?.User_Account?.full_name ||
        combined?.user?.full_name ||
        'Unknown Senior',

      dob:
        combined?.dob ||
        combined?.User_Account?.dob ||
        null,

      gender:
        combined?.gender ||
        combined?.User_Account?.gender ||
        null,

      address:
        combined?.address ||
        combined?.User_Account?.address ||
        null,

      postal_code:
        combined?.postal_code ||
        combined?.User_Account?.postal_code ||
        null,

      unit_number:
        combined?.unit_number ||
        combined?.User_Account?.unit_number ||
        null,
    };
  };

  const currentSenior =
  seniors.find((s) => parseInt(s?.senior_id, 10) === 1) ||
  seniors?.[0] ||
  null;

  const getSeniorDisplayName = (senior) => {
    return (
      senior?.full_name ||
      senior?.User_Account?.full_name ||
      senior?.user?.full_name ||
      'Unknown Senior'
    );
  };

  const seniorName = getSeniorDisplayName(currentSenior);

  const handleLogin = async (payload) => {
    const email = typeof payload === 'string' ? payload : payload?.email;
    const password = typeof payload === 'string' ? null : payload?.password;

    if (!email || !password) {
      setLoginError('Please enter your email address and password.');
      return;
    }
    if (!apiBase) {
      setLoginError('Backend server is not available yet.');
      return;
    }

    try {
      const response = await fetch(`${apiBase}/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const body = await response.json().catch(() => null);
      if (!response.ok) {
        const message = body?.error || body || 'Login failed';
        throw new Error(message);
      }

      setAuthenticatedUser(body);
      setLoginError(null);
      
      const roleName = `${body?.role || body?.role_name || body?.roleName || ''}`.toLowerCase();
      const roleId = Number(body?.role_id);

      // Route based on role_id or role name
      if (roleId === 3 || roleName.includes('aic')) {
        setCurrentScreen('AICPortal');
      } else if (roleId === 2 || roleName.includes('caregiver')) {
        setCurrentScreen('CaregiverHome');
      } else {
        setCurrentScreen('Home');
      }
    } catch (err) {
      console.log('Login error:', err);
      setLoginError(err?.message || 'Login failed');
    }
  };

  const handleRegister = async ({ name, email, password, role }) => {
    if (!name || !email) {
      setRegisterError('Please enter both name and email.');
      return;
    }

    if (!apiBase) {
      setRegisterError('Backend server is not available yet.');
      return;
    }

    try {
      const response = await fetch(`${apiBase}/users/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          password,
          phone_number: '',
          role: role || 'Senior',
        }),
      });

      const body = await response.json().catch(() => null);
      if (!response.ok) {
        const message = body?.error || body || 'Registration failed';
        throw new Error(message);
      }

      setRegisterError(null);
      setLoginError('Account created. Please sign in.');
      setCurrentScreen('Login');
    } catch (err) {
      console.log('Register error:', err);
      setRegisterError(err?.message || 'Registration failed');
    }
  };

  // -------------------------
  // SELECT SENIOR (UPDATED)
  // -------------------------
  const handleSelectSenior = async (senior, origin = 'Status') => {
    console.log('=== SELECTING SENIOR ===');
    setSelectedSeniorOrigin(origin);

    try {
      if (!apiBase) throw new Error('Backend not configured');
      const [conditionsRes, nokRes] = await Promise.all([
        fetch(`${apiBase}/seniors/${senior.senior_id}/medical-conditions`),
        fetch(`${apiBase}/seniors/${senior.senior_id}/nok`)
      ]);

      const conditionsData = await conditionsRes.json();
      const conditions = Array.isArray(conditionsData) ? conditionsData : [];
      const nokData = await nokRes.json();
      const nokList = Array.isArray(nokData) ? nokData : [];

      const enhancedSenior = {
        ...normalizeSenior(senior),
        medicalConditions: Array.isArray(conditions) ? conditions : [],
        nokContacts: Array.isArray(nokList) ? nokList : []
      };

      setSelectedSenior(enhancedSenior);
      setCurrentScreen('SeniorDetails');

    } catch (err) {
      console.log('Failed to fetch senior details:', err);

      setSelectedSenior({
        ...normalizeSenior(senior),
        medicalConditions: [],
        nokContacts: []
      });

      setCurrentScreen('SeniorDetails');
    }
  };

  // -------------------------
  // STREAK + CHECKIN LOGIC
  // -------------------------
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
  // NOTIFICATIONS
  // -------------------------
  useEffect(() => {
    setupCheckInNotifications();
  }, []);

  // -------------------------
  // FETCH DATA (FIXED NORMALIZATION)
  // -------------------------
  useEffect(() => {
    const testEndpoint = async (baseUrl) => {
      try {
        const response = await fetch(`${baseUrl}/test`);
        return response.ok;
      } catch (error) {
        return false;
      }
    };

    const resolveBackendBase = async () => {
      if (await testEndpoint(REMOTE_API_BASE)) {
        setApiBase(REMOTE_API_BASE);
        return;
      }

      for (const localBase of LOCAL_API_BASES) {
        if (await testEndpoint(localBase)) {
          setApiBase(localBase);
          return;
        }
      }

      setBackendError(
        `Unable to reach backend on ${REMOTE_API_BASE} or ${LOCAL_API_BASES.join(
          ', '
        )}. Please start your backend server.`
      );
    };

    resolveBackendBase();
  }, []);

  useEffect(() => {
    if (!apiBase) return;

    const fetchJson = async (url) => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }
      return response.json();
    };

    const fetchData = async () => {
      try {
        const [seniorsData, usersData, checkInsData, emergencyData, rewardsData] =
          await Promise.all([
            fetchJson(`${apiBase}/seniors`),
            fetchJson(`${apiBase}/users`),
            fetchJson(`${apiBase}/checkins`),
            fetchJson(`${apiBase}/emergency-events`),
            fetchJson(`${apiBase}/rewards`),
          ]);

        console.log('=== FETCHED SENIORS DATA ===');
        console.log('=== FETCHED USERS DATA ===');
        console.log('=== USING API BASE ===', apiBase);

        const userMap = new Map(
          (Array.isArray(usersData) ? usersData : []).map((user) => [user.user_id, user])
        );

        setUsers(Array.isArray(usersData) ? usersData : []);
        setSeniors(
          Array.isArray(seniorsData)
            ? seniorsData.map((senior) => normalizeSenior(senior, userMap))
            : []
        );

        setCheckIns(Array.isArray(checkInsData) ? checkInsData : []);
        setEmergencyEvents(Array.isArray(emergencyData) ? emergencyData : []);
        setRewardStreaks(Array.isArray(rewardsData) ? rewardsData : []);
      } catch (err) {
        console.log('API fetch error:', err);

        setSeniors([]);
        setUsers([]);
        setCheckIns([]);
        setEmergencyEvents([]);
        setRewardStreaks([]);
      }
    };

    fetchData();
  }, [apiBase]);

  // -------------------------
  // CHECK-IN
  // -------------------------
  const handleCheckIn = async () => {
    try {
      if (!currentSenior?.senior_id || !apiBase) return;

      await fetch(`${apiBase}/checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
  // SCREEN ROUTING
  // -------------------------
  const renderScreen = () => {

    if (currentScreen === 'Language') {
      return <LanguageScreen onSelectLanguage={() => setCurrentScreen('CreateAccount')} />;
    }

    // Account choice screen removed; language now goes directly to CreateAccount

    if (currentScreen === 'CreateAccount') {
      return (
        <CreateAccountScreen
          onCreate={handleRegister}
          onSignIn={() => setCurrentScreen('Login')}
          error={registerError}
        />
      );
    }

    if (currentScreen === 'Login') {
      return (
        <LoginScreen
          onLogin={handleLogin}
          onCaregiverLogin={() => setCurrentScreen('CaregiverLogin')}
          loginError={loginError}
          onForgot={() => setCurrentScreen('ForgotPassword')}
          onSignUp={() => setCurrentScreen('CreateAccount')}
        />
      );
    }

    if (currentScreen === 'ForgotPassword') {
      return (
        <ForgotPasswordScreen onBack={() => setCurrentScreen('Login')} />
      );
    }

    if (currentScreen === 'CaregiverLogin') {
      return (
        <CaregiverLoginScreen
          onBack={() => setCurrentScreen('Login')}
          onFaceId={() => setCurrentScreen('CaregiverBiometric')}
        />
      );
    }

    if (currentScreen === 'Biometric') {
      return (
        <BiometricFaceScreen
          onAuthenticated={() => setCurrentScreen('Home')}
        />
     );
    }

    if (currentScreen === 'CaregiverBiometric') {
      return (
        <BiometricFaceScreen
          onAuthenticated={() => setCurrentScreen('CaregiverHome')}
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
          onProfile={() => setCurrentScreen('SeniorProfile')}
          onSettings={() => setCurrentScreen('SeniorSettings')}
        />
      );
    }

    if (currentScreen === 'SeniorProfile') {
      return (
        <SeniorProfileScreen
          senior={currentSenior}
          onHome={() => setCurrentScreen('Home')}
          onCommunity={() => setCurrentScreen('Community')}
          onSettings={() => setCurrentScreen('SeniorSettings')}
        />
      );
    }

    if (currentScreen === 'SeniorSettings') {
      return (
        <SeniorSettingsScreen
          senior={currentSenior}
          apiBase={apiBase}
          onHome={() => setCurrentScreen('Home')}
          onCommunity={() => setCurrentScreen('Community')}
          onProfile={() => setCurrentScreen('SeniorProfile')}
          onLogout={() => setCurrentScreen('Login')}
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
          onGoToSeniorsList={() => setCurrentScreen('CaregiverSeniorsList')}
          onGoToRoster={() => setCurrentScreen('CaregiverRoster')}
          onLogout={() => setCurrentScreen('Login')}
        />
      );
    }

    if (currentScreen === 'CaregiverSeniorsList') {
      return (
        <CaregiverSeniorsListScreen
          seniors={seniors}
          apiBase={apiBase}
          authenticatedUser={authenticatedUser}
          onGoToHome={() => setCurrentScreen('CaregiverHome')}
          onGoToStatus={() => setCurrentScreen('CaregiverRoster')}
          onLogout={() => setCurrentScreen('Login')}
          onSelectSenior={(senior) => handleSelectSenior(senior, 'SeniorsList')}
          backendError={backendError}
        />
      );
    }

    if (currentScreen === 'CaregiverRoster') {
      return (
        <CaregiverRosterScreen
          seniors={seniors}
          onGoToHome={() => setCurrentScreen('CaregiverHome')}
          onGoToSeniorsList={() => setCurrentScreen('CaregiverSeniorsList')}
          onLogout={() => setCurrentScreen('Login')}
          onSelectSenior={(senior) => handleSelectSenior(senior, 'Status')}
          backendError={backendError}
        />
      );
    }

    if (currentScreen === 'AICPortal') {
      return (
        <AICPortalScreen
          seniors={seniors}
          checkIns={checkIns}
          emergencyEvents={emergencyEvents}
          authenticatedUser={authenticatedUser}
          onLogout={() => setCurrentScreen('Login')}
        />
      );
    }

    if (currentScreen === 'SeniorDetails') {
      return (
        <SeniorDetailsScreen
          senior={selectedSenior}
          medicalConditions={selectedSenior?.medicalConditions ?? []}
          showStatusBadge={selectedSeniorOrigin !== 'SeniorsList'}
          onGoToHome={() => setCurrentScreen('CaregiverHome')}
          onGoToSeniorsList={() => setCurrentScreen('CaregiverSeniorsList')}
          onGoToStatus={() => setCurrentScreen('CaregiverRoster')}
          onGoBack={() =>
            setCurrentScreen(
              selectedSeniorOrigin === 'SeniorsList'
                ? 'CaregiverSeniorsList'
                : 'CaregiverRoster'
            )
          }
          onLogout={() => setCurrentScreen('Login')}
        />
      );
    }

    if (currentScreen === 'Emergency') {
      return (
        <EmergencyScreen
          onCancel={() => setCurrentScreen('Home')}
          onCallHelp={() => setCurrentScreen('FakeCall')}
        />
      );
    }

    if (currentScreen === 'FakeCall') {
      return (
        <FakeCallScreen
          onEndCall={() => setCurrentScreen('Home')}
        />
      );
    }

    if (currentScreen === 'Community') {
      return (
        <CommunityScreen
          senior={currentSenior}
          medicalConditions={currentSenior?.medicalConditions ?? []}
          onHome={() => setCurrentScreen('Home')}
          onProfile={() => setCurrentScreen('SeniorProfile')}
          onSettings={() => setCurrentScreen('SeniorSettings')}
        />
      );
    }

    return null;
  };

  return <PhonePreview>{renderScreen()}</PhonePreview>;
}

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
