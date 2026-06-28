import React, { useEffect, useState, useCallback } from 'react';
import './i18n';
import i18n from './i18n';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform, StyleSheet, View } from 'react-native';
import { getSgtDateKey } from './utils/time';

// Screens
import LanguageScreen from './screens/LanguageScreen';
import LoginScreen from './screens/LoginScreen';
import CaregiverLoginScreen from './screens/CaregiverLoginScreen';
import BiometricFaceScreen from './screens/BiometricFaceScreen';
import CreateAccountScreen from './screens/CreateAccountScreen';
// import ForgotPasswordScreen from './screens/ForgotPasswordScreen'; // Uncomment to re-enable Forgot Password
import SeniorHomeScreen from './screens/SeniorHomeScreen';
import SeniorProfileScreen from './screens/SeniorProfileScreen';
import SeniorEditProfileScreen from './screens/SeniorEditProfileScreen';
import SeniorSettingsScreen from './screens/SeniorSettingsScreen';
import EmergencyScreen from './screens/EmergencyScreen';
import CaregiverHomeScreen from './screens/CaregiverHomeScreen';
import CaregiverSeniorsListScreen from './screens/CaregiverSeniorsListScreen';
import CaregiverRosterScreen from './screens/CaregiverRosterScreen';
import CaregiverEditSeniorMenuScreen from './screens/CaregiverEditSeniorMenuScreen';
import AICPortalScreen from './screens/AICPortalScreen';
import StaffSettingsScreen from './screens/StaffSettingsScreen';
import SeniorDetailsScreen from './screens/SeniorDetailsScreen';
import CommunityScreen from './screens/CommunityScreen';
import FakeCallScreen from './screens/FakeCallScreen';

import {
  cancelMissedCheckInReminders,
  setupCheckInNotifications,
} from './services/checkInNotifications';

export default function App() {

  const [currentScreen, setCurrentScreen] = useState('Language');
  const [previousScreen, setPreviousScreen] = useState(null);
  const [hasCheckedIn, setHasCheckedIn] = useState(false);
  const [selectedSenior, setSelectedSenior] = useState(null);
  const [selectedSeniorOrigin, setSelectedSeniorOrigin] = useState('Status');
  const [authenticatedUser, setAuthenticatedUser] = useState(null);
  const [loginError, setLoginError] = useState(null);
  const [registerError, setRegisterError] = useState(null);
  const [openCaregiverLinkOnSettings, setOpenCaregiverLinkOnSettings] = useState(false);

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
  const [apiBase, setApiBase] = useState(REMOTE_API_BASE);
  const [backendError, setBackendError] = useState(null);

  const [seniors, setSeniors] = useState([]);
  const [users, setUsers] = useState([]);
  const [checkIns, setCheckIns] = useState([]);
  const [communityActivities, setCommunityActivities] = useState([]);
  const [emergencyEvents, setEmergencyEvents] = useState([]);
  const [rewardStreaks, setRewardStreaks] = useState([]);

  const fetchWithTimeout = async (url, options = {}, timeoutMs = 12000) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const testEndpoint = async (baseUrl, timeoutMs = 4000) => {
    try {
      const response = await fetchWithTimeout(`${baseUrl}/test`, {}, timeoutMs);
      return response.ok;
    } catch (error) {
      return false;
    }
  };

  const resolveBackendBase = async () => {
    const candidates = [
      ...new Set([
        apiBase,
        ...LOCAL_API_BASES,
        REMOTE_API_BASE,
      ].filter(Boolean)),
    ];

    for (const baseUrl of candidates) {
      if (await testEndpoint(baseUrl)) {
        if (baseUrl !== apiBase) setApiBase(baseUrl);
        setBackendError(null);
        return baseUrl;
      }
    }

    return null;
  };

  const ensureSeniorRecord = async (userId, baseOverride = null) => {
    const targetBase = baseOverride || apiBase;
    if (!targetBase || !userId) return null;

    try {
      const response = await fetchWithTimeout(`${targetBase}/seniors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      }, 12000);

      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error || body?.message || 'Failed to create senior record.');
      }

      return body?.senior_id || null;
    } catch (err) {
      console.log('ensureSeniorRecord error:', err);
      return null;
    }
  };

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
      medicalConditions: combined?.medicalConditions || [],
      nokContacts: combined?.nokContacts || [],

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

  const currentSenior = (() => {
    if (!authenticatedUser) return null;

    const matchedSenior = seniors.find(
      (s) => String(s?.user_id) === String(authenticatedUser.user_id)
    );

    if (matchedSenior) {
      return matchedSenior;
    }

    return {
      ...authenticatedUser,
      senior_id: null,
      medicalConditions: [],
      nokContacts: [],
    };
  })();

  const getSeniorDisplayName = (senior) => {
    return (
      senior?.full_name ||
      senior?.User_Account?.full_name ||
      senior?.user?.full_name ||
      'Unknown Senior'
    );
  };

  const seniorName = getSeniorDisplayName(currentSenior);

  const fetchSeniorWithExtras = async (senior) => {
    if (!apiBase || !senior?.senior_id) {
      return senior ? normalizeSenior(senior) : null;
    }

    try {
      const [profileRes, conditionsRes, nokRes] = await Promise.all([
        fetch(`${apiBase}/seniors/${senior.senior_id}`),
        fetch(`${apiBase}/seniors/${senior.senior_id}/medical-conditions`),
        fetch(`${apiBase}/seniors/${senior.senior_id}/nok`),
      ]);

      const profileData = profileRes.ok ? await profileRes.json() : null;
      const conditionsData = conditionsRes.ok ? await conditionsRes.json() : [];
      const nokData = nokRes.ok ? await nokRes.json() : [];

      return {
        ...normalizeSenior({
          ...senior,
          ...(profileData || {}),
        }),
        medicalConditions: Array.isArray(conditionsData) ? conditionsData : [],
        nokContacts: Array.isArray(nokData) ? nokData : [],
      };
    } catch (err) {
      console.log('Failed to fetch senior details:', err);
      return {
        ...normalizeSenior(senior),
        medicalConditions: Array.isArray(senior?.medicalConditions) ? senior.medicalConditions : [],
        nokContacts: Array.isArray(senior?.nokContacts) ? senior.nokContacts : [],
      };
    }
  };

  const isSeniorProfileComplete = (senior) => {
    if (!senior) return false;
    if (!senior.senior_id) return false;

    return [
      senior.full_name,
      senior.dob,
      senior.gender,
      senior.address,
      senior.postal_code,
      senior.unit_number || senior.unit_no,
      senior.phone_number || senior.contact,
    ].every((value) => `${value ?? ''}`.trim().length > 0);
  };

  const capitalizeWords = (value) =>
    String(value || '')
      .replace(/\d/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');

  const isValidName = (value) => {
    const text = String(value || '').trim();
    return Boolean(text) && !/\d/.test(text);
  };

  const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.com$/i.test(String(value || '').trim());

  const isStrongPassword = (value) => {
    const password = String(value || '');
    const hasStrongMix =
      password.length >= 12 &&
      password.length <= 64 &&
      /[a-z]/.test(password) &&
      /[A-Z]/.test(password) &&
      /\d/.test(password) &&
      /[^A-Za-z0-9]/.test(password);
    const hasPassphrase =
      password.length >= 16 &&
      password.length <= 64 &&
      password.trim().split(/\s+/).filter(Boolean).length >= 3;

    return hasStrongMix || hasPassphrase;
  };

  const handleLogin = async (payload) => {
    const email = typeof payload === 'string' ? payload : payload?.email;
    const password = typeof payload === 'string' ? null : payload?.password;

    if (!email || !password) {
      setLoginError('Please enter your email address and password.');
      return;
    }

    const activeBase = await resolveBackendBase();
    if (!activeBase) {
      setLoginError('Unable to connect to backend. Please ensure backend_api is running on port 10000.');
      return;
    }

    try {
      const response = await fetchWithTimeout(`${activeBase}/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      }, 12000);

      const body = await response.json().catch(() => null);
      if (!response.ok) {
        const message = body?.error || body || 'Login failed';
        throw new Error(message);
      }

      setAuthenticatedUser(body);
      setLoginError(null);
      let refreshed = await refreshAll(body);

      // If a senior user has no Senior row yet, create it and refresh mappings.
      const roleName = `${body?.role || body?.role_name || body?.roleName || ''}`.toLowerCase();
      const roleId = Number(body?.role_id);
      const isSeniorRole = !roleName || roleName.includes('senior') || roleId === 1;

      if (isSeniorRole && !refreshed?.senior?.senior_id && body?.user_id) {
        await ensureSeniorRecord(body.user_id, activeBase);
        refreshed = await refreshAll(body);
      }
      
      const loggedInSenior = refreshed?.senior || {
        ...body,
        senior_id: null,
        medicalConditions: [],
        nokContacts: [],
      };

      // Route based on role_id or role name
      if (roleId === 3 || roleName.includes('aic')) {
        setCurrentScreen('AICPortal');
      } else if (roleId === 2 || roleName.includes('caregiver')) {
        setCurrentScreen('CaregiverHome');
      } else if (!isSeniorProfileComplete(loggedInSenior)) {
        setOpenCaregiverLinkOnSettings(true);
        setCurrentScreen('SeniorSettings');
      } else {
        setCurrentScreen('Home');
      }
    } catch (err) {
      console.log('Login error:', err);
      setLoginError(err?.message || 'Login failed');
    }
  };

  const handleRegister = async ({ name, email, password, role }) => {
    const normalizedName = capitalizeWords(name);
    const normalizedEmail = String(email || '').trim().toLowerCase();

    if (!normalizedName || !normalizedEmail || !password) {
      setRegisterError('Please enter name, email, and password.');
      return;
    }

    if (!isValidName(name)) {
      setRegisterError('Full name cannot contain numbers.');
      return;
    }

    if (!isValidEmail(normalizedEmail)) {
      setRegisterError('Email must include @ and end with .com.');
      return;
    }

    if (!isStrongPassword(password)) {
      setRegisterError('Password must be 12+ characters with uppercase, lowercase, number, and symbol, or a 16+ character multi-word passphrase.');
      return;
    }

    const activeBase = await resolveBackendBase();
    if (!activeBase) {
      setRegisterError('Unable to connect to backend. Please ensure backend_api is running on port 10000.');
      return;
    }

    try {
      const response = await fetchWithTimeout(`${activeBase}/users/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: normalizedName,
          email: normalizedEmail,
          password,
          phone_number: '',
          role: role || 'Senior',
        }),
      }, 12000);

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

    const enhancedSenior = await fetchSeniorWithExtras(senior);
    setSelectedSenior(enhancedSenior);
    setCurrentScreen('SeniorDetails');
  };

  // -------------------------
  // STREAK + CHECKIN LOGIC
  // -------------------------
  const getStreakValue = (item) =>
    item?.current_streak ?? item?.streak ?? item?.days ?? 0;

  // SGT-strip a JS Date / ISO string to a YYYY-MM-DD key (Asia/Singapore).
  // Used everywhere "today" / "this check-in day" / streak math needs to
  // bucket by the SGT calendar day, not the device-local one.
  const getDateKey = (value) => getSgtDateKey(value);

  const calculateCheckInStreak = (seniorId) => {
    if (!seniorId) return 0;

    // Collect dates from completed check-ins
    const checkInDates = checkIns
      .filter((checkIn) => String(checkIn?.senior_id) === String(seniorId))
      .filter((checkIn) => (checkIn?.checkin_status || '').toLowerCase().includes('completed'))
      .map((checkIn) => getDateKey(checkIn?.checkin_timestamp))
      .filter(Boolean);

    // Collect dates from completed community activities (games)
    const communityDates = communityActivities
      .filter((activity) => String(activity?.senior_id) === String(seniorId))
      .filter((activity) => (activity?.participation_status || '').toLowerCase() === 'completed')
      .map((activity) => getDateKey(activity?.activity_date))
      .filter(Boolean);

    // Combine all engagement dates and remove duplicates
    const allEngagementDates = Array.from(new Set([...checkInDates, ...communityDates]));

    if (!allEngagementDates.length) return 0;

    // Sort dates in descending order (most recent first)
    const orderedDates = allEngagementDates.sort((left, right) => right.localeCompare(left));
    const todayKey = getDateKey(new Date());
    // Anchor to SGT midnight (UTC+08:00) so day-diff math is consistent
    // regardless of where the runtime is hosted.
    const mostRecentDate = new Date(`${orderedDates[0]}T00:00:00+08:00`);
    const today = new Date(`${todayKey}T00:00:00+08:00`);
    const daysSinceLastEngagement = Math.round((today - mostRecentDate) / (24 * 60 * 60 * 1000));

    if (daysSinceLastEngagement > 1) return 0;

    let streak = 1;
    let previousDate = mostRecentDate;

    for (let index = 1; index < orderedDates.length; index += 1) {
      const currentDate = new Date(`${orderedDates[index]}T00:00:00+08:00`);
      const differenceInDays = Math.round((previousDate - currentDate) / (24 * 60 * 60 * 1000));

      if (differenceInDays === 0) {
        continue;
      }

      if (differenceInDays === 1) {
        streak += 1;
        previousDate = currentDate;
        continue;
      }

      break;
    }

    return streak;
  };

  const currentRewardRow = currentSenior?.senior_id
    ? rewardStreaks.find((reward) => String(reward?.senior_id) === String(currentSenior.senior_id))
    : null;

  const currentStreak =
    calculateCheckInStreak(currentSenior?.senior_id) ||
    getStreakValue(currentRewardRow) ||
    getStreakValue(currentSenior);

  // SGT-aware "today" bucket — used for both the global checked-in count
  // and the per-senior "checked in today" boolean so these are stable on
  // UTC laptops and SGT phones alike.
  const todayKey = getDateKey(new Date());

  const checkedInCount = Array.from(
    new Set(
      checkIns
        .filter((c) =>
          (c?.checkin_status || '').toLowerCase().includes('completed')
        )
        .filter((c) =>
          !c?.checkin_timestamp ||
          getDateKey(c.checkin_timestamp) === todayKey
        )
        .map((c) => c.senior_id)
    )
  ).length;

  // determine if the current senior has a completed check-in for today
  const isCheckedInToday = currentSenior?.senior_id
    ? checkIns.some((c) =>
        String(c?.senior_id) === String(currentSenior.senior_id) &&
        (c?.checkin_status || '').toLowerCase().includes('completed') &&
        (!c.checkin_timestamp || getDateKey(c.checkin_timestamp) === todayKey)
      )
    : false;

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
    const bootstrapBackendBase = async () => {
      const baseUrl = await resolveBackendBase();

      if (!baseUrl) {
        setBackendError(
          `Unable to reach backend on ${REMOTE_API_BASE} or ${LOCAL_API_BASES.join(
            ', '
          )}. Please start your backend server.`
        );
      }
    };

    bootstrapBackendBase();
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

    const fetchAllData = async () => {
      try {
        const [seniorsData, usersData, checkInsData, emergencyData, rewardsData, communitiesData] =
          await Promise.all([
            fetchJson(`${apiBase}/seniors`),
            fetchJson(`${apiBase}/users`),
            fetchJson(`${apiBase}/checkins`),
            fetchJson(`${apiBase}/emergency-events`),
            fetchJson(`${apiBase}/rewards`),
            fetchJson(`${apiBase}/community/activities/all`).catch(() => []),
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
            ? seniorsData
                .map((senior) => normalizeSenior(senior, userMap))
                .filter((normalizedSenior) => normalizedSenior.full_name !== 'Unknown Senior')
            : []
        );

        setCheckIns(Array.isArray(checkInsData) ? checkInsData : []);
        setCommunityActivities(Array.isArray(communitiesData) ? communitiesData : []);
        setEmergencyEvents(Array.isArray(emergencyData) ? emergencyData : []);
        setRewardStreaks(Array.isArray(rewardsData) ? rewardsData : []);
      } catch (err) {
        console.log('API fetch error:', err);

        setSeniors([]);
        setUsers([]);
        setCheckIns([]);
        setCommunityActivities([]);
        setEmergencyEvents([]);
        setRewardStreaks([]);
      }
    };

    // expose fetchAllData on component scope so child screens can trigger a refresh
    fetchAllData();

    // attach to state so it can be passed as prop later (memoized inline function)
    // Note: we don't store the function in state; we'll pass a wrapper below when needed.
  }, [apiBase]);

  // helper to refresh users + seniors on demand
  const refreshAll = async (userOverride = null) => {
    if (!apiBase) return;
    try {
      const effectiveUser = userOverride || authenticatedUser;
      const effectiveRoleId = Number(effectiveUser?.role_id);
      const seniorsUrl =
        effectiveRoleId === 2 && effectiveUser?.user_id
          ? `${apiBase}/caregiver/${effectiveUser.user_id}/seniors`
          : `${apiBase}/seniors`;
      const [seniorsRes, usersRes, checkinsRes, rewardsRes, communityRes] = await Promise.all([
        fetch(seniorsUrl),
        fetch(`${apiBase}/users`),
        fetch(`${apiBase}/checkins`),
        fetch(`${apiBase}/rewards`),
        fetch(`${apiBase}/community/activities/all`),
      ]);
      if (!seniorsRes.ok || !usersRes.ok || !checkinsRes.ok || !rewardsRes.ok) return;
      const seniorsData = await seniorsRes.json();
      const usersData = await usersRes.json();
      const checkinsData = await checkinsRes.json();
      const rewardsData = await rewardsRes.json();
      const communityData = communityRes.ok ? await communityRes.json() : [];
      const userMap = new Map(
        (Array.isArray(usersData) ? usersData : []).map((user) => [user.user_id, user])
      );
      const normalizedSeniors = Array.isArray(seniorsData)
        ? seniorsData
            .map((senior) => normalizeSenior(senior, userMap))
            .filter((normalizedSenior) => normalizedSenior.full_name !== 'Unknown Senior')
        : [];
      setUsers(Array.isArray(usersData) ? usersData : []);
      setSeniors(normalizedSeniors);
      setCheckIns(Array.isArray(checkinsData) ? checkinsData : []);
      setCommunityActivities(Array.isArray(communityData) ? communityData : []);
      setRewardStreaks(Array.isArray(rewardsData) ? rewardsData : []);
      // if someone is authenticated, update their cached user object too
      let updatedSeniorWithExtras = null;
      if (effectiveUser && effectiveUser.user_id) {
        const updated = (Array.isArray(usersData) ? usersData : []).find(
          (u) => String(u.user_id) === String(effectiveUser.user_id)
        );
        if (updated) setAuthenticatedUser(updated);

        const matchingSenior = normalizedSeniors.find(
          (s) => String(s.user_id) === String(effectiveUser.user_id)
        );
        updatedSeniorWithExtras = matchingSenior || null;

        if (matchingSenior?.senior_id && apiBase) {
          try {
            const [conditionResponse, nokResponse] = await Promise.all([
              fetch(`${apiBase}/seniors/${matchingSenior.senior_id}/medical-conditions`),
              fetch(`${apiBase}/seniors/${matchingSenior.senior_id}/nok`),
            ]);

            if (conditionResponse.ok && nokResponse.ok) {
              const [conditionData, nokData] = await Promise.all([
                conditionResponse.json(),
                nokResponse.json(),
              ]);

              updatedSeniorWithExtras = {
                ...matchingSenior,
                medicalConditions: Array.isArray(conditionData) ? conditionData : [conditionData],
                nokContacts: Array.isArray(nokData) ? nokData : [nokData],
              };
            }
          } catch (err) {
            console.log('Failed to load senior extras during refresh:', err);
          }
        }
      }

      if (updatedSeniorWithExtras) {
        setSeniors((current) =>
          current.map((senior) =>
            String(senior.senior_id) === String(updatedSeniorWithExtras.senior_id)
              ? updatedSeniorWithExtras
              : senior
          )
        );
      }

      if (selectedSenior?.senior_id) {
        const matchingSelectedSenior =
          normalizedSeniors.find(
            (senior) => String(senior.senior_id) === String(selectedSenior.senior_id)
          ) || selectedSenior;
        const refreshedSelectedSenior = await fetchSeniorWithExtras(matchingSelectedSenior);

        if (refreshedSelectedSenior) {
          setSelectedSenior(refreshedSelectedSenior);
        }
      }

      return {
        users: Array.isArray(usersData) ? usersData : [],
        seniors: normalizedSeniors,
        checkins: Array.isArray(checkinsData) ? checkinsData : [],
        rewards: Array.isArray(rewardsData) ? rewardsData : [],
        senior: updatedSeniorWithExtras,
      };
    } catch (err) {
      console.log('refreshAll error:', err);
      return null;
    }
  };

  // -------------------------
  // CHECK-IN
  // -------------------------
  const handleCheckIn = async () => {
    try {
      if (!apiBase) return;

      let seniorId = currentSenior?.senior_id;

      if (!seniorId && authenticatedUser?.user_id) {
        const createdSeniorId = await ensureSeniorRecord(authenticatedUser.user_id);
        if (createdSeniorId) {
          await refreshAll(authenticatedUser);
          seniorId = createdSeniorId;
        }
      }

      if (!seniorId) return;

      await fetch(`${apiBase}/checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senior_id: seniorId
        })
      });

      setHasCheckedIn(true);
      await refreshAll(authenticatedUser);
      cancelMissedCheckInReminders();

    } catch (err) {
      console.log("Check-in error:", err);
    }
  };

  const handleLogout = () => {
    setAuthenticatedUser(null);
    setSelectedSenior(null);
    setLoginError(null);
    setCurrentScreen('Login');
  };

  // -------------------------
  // SCREEN ROUTING
  // -------------------------
  const renderScreen = () => {

    if (currentScreen === 'Language') {
      const goBackTo = previousScreen || 'CreateAccount';
      return (
        <LanguageScreen
          onSelectLanguage={(langCode) => {
            i18n.changeLanguage(langCode);
            setCurrentScreen(goBackTo);
          }}
        />
      );
    }

    if (currentScreen === 'CreateAccount') {
      return (
        <CreateAccountScreen
          onCreate={handleRegister}
          onSignIn={() => setCurrentScreen('Login')}
          onLanguage={() => {
            setPreviousScreen('CreateAccount');
            setCurrentScreen('Language');
          }}
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
          // onForgot={() => setCurrentScreen('ForgotPassword')} // Uncomment to re-enable Forgot Password
          onSignUp={() => setCurrentScreen('CreateAccount')}
          onLanguage={() => {
            setPreviousScreen('Login');
            setCurrentScreen('Language');
          }}
        />
      );
    }

    // if (currentScreen === 'ForgotPassword') { // Uncomment to re-enable Forgot Password
    //   return (
    //     <ForgotPasswordScreen onBack={() => setCurrentScreen('Login')} />
    //   );
    // }

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
          hasCheckedIn={isCheckedInToday}
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
          apiBase={apiBase}
          onHome={() => setCurrentScreen('Home')}
          onCommunity={() => setCurrentScreen('Community')}
          onSettings={() => setCurrentScreen('SeniorSettings')}
        />
      );
    }

    if (currentScreen === 'SeniorEditProfile') {
      return (
        <SeniorEditProfileScreen
          senior={currentSenior}
          apiBase={apiBase}
          onHome={() => setCurrentScreen('Home')}
          onCommunity={() => setCurrentScreen('Community')}
          onSettings={() => setCurrentScreen('SeniorSettings')}
          onBack={() => setCurrentScreen('SeniorSettings')}
          onProfile={() => setCurrentScreen('SeniorProfile')}
          onRefresh={refreshAll}
        />
      );
    }

    if (currentScreen === 'SeniorSettings') {
      return (
        <SeniorSettingsScreen
          senior={currentSenior}
          apiBase={apiBase}
          initialModal={openCaregiverLinkOnSettings ? 'Caregiver' : null}
          onInitialModalConsumed={() => setOpenCaregiverLinkOnSettings(false)}
          onHome={() => setCurrentScreen('Home')}
          onCommunity={() => setCurrentScreen('Community')}
          onProfile={() => setCurrentScreen('SeniorProfile')}
          onEditProfile={() => setCurrentScreen('SeniorEditProfile')}
          onLogout={handleLogout}
          onRefresh={refreshAll}
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
          prioritySenior={seniors[0]}
          activeTicket={emergencyEvents?.[0]}
          onGoToSeniorsList={() => setCurrentScreen('CaregiverSeniorsList')}
          onGoToRoster={() => setCurrentScreen('CaregiverRoster')}
          onSettings={() => setCurrentScreen('StaffSettings')}
        />
      );
    }

    if (currentScreen === 'CaregiverSeniorsList') {
      return (
        <CaregiverSeniorsListScreen
          seniors={seniors}
          apiBase={apiBase}
          authenticatedUser={authenticatedUser}
          onRefresh={refreshAll}
          onGoToHome={() => setCurrentScreen('CaregiverHome')}
          onGoToStatus={() => setCurrentScreen('CaregiverRoster')}
          onSettings={() => setCurrentScreen('StaffSettings')}
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
          onSettings={() => setCurrentScreen('StaffSettings')}
          onSelectSenior={(senior) => handleSelectSenior(senior, 'Status')}
          backendError={backendError}
        />
      );
    }

    if (currentScreen === 'StaffSettings') {
      return (
        <StaffSettingsScreen
          authenticatedUser={authenticatedUser}
          apiBase={apiBase}
          onLogout={handleLogout}
          onRefresh={refreshAll}
          onCases={() => setCurrentScreen('AICPortal')}
          onHome={() => setCurrentScreen('CaregiverHome')}
          onSeniors={() => setCurrentScreen('CaregiverSeniorsList')}
          onStatus={() => setCurrentScreen('CaregiverRoster')}
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
          apiBase={apiBase}
          onSettings={() => setCurrentScreen('StaffSettings')}
        />
      );
    }

    if (currentScreen === 'SeniorDetails') {
      return (
        <SeniorDetailsScreen
          senior={selectedSenior}
          medicalConditions={selectedSenior?.medicalConditions ?? []}
          showStatusBadge={selectedSeniorOrigin !== 'SeniorsList'}
          apiBase={apiBase}
          authenticatedUser={authenticatedUser}
          onRefresh={refreshAll}
          onGoToHome={() => setCurrentScreen('CaregiverHome')}
          onGoToSeniorsList={() => setCurrentScreen('CaregiverSeniorsList')}
          onGoToStatus={() => setCurrentScreen('CaregiverRoster')}
          onGoToEditMenu={() => setCurrentScreen('CaregiverEditSeniorMenu')}
          onGoBack={() =>
            setCurrentScreen(
              selectedSeniorOrigin === 'SeniorsList'
                ? 'CaregiverSeniorsList'
                : 'CaregiverRoster'
            )
          }
          onSettings={() => setCurrentScreen('StaffSettings')}
        />
      );
    }

    if (currentScreen === 'CaregiverEditSeniorMenu') {
      return (
        <CaregiverEditSeniorMenuScreen
          senior={selectedSenior}
          apiBase={apiBase}
          authenticatedUser={authenticatedUser}
          onGoToHome={() => setCurrentScreen('CaregiverHome')}
          onGoToSeniorsList={() => setCurrentScreen('CaregiverSeniorsList')}
          onGoToStatus={() => setCurrentScreen('CaregiverRoster')}
          onGoBack={() => setCurrentScreen('SeniorDetails')}
          onEditProfile={() => setCurrentScreen('CaregiverSeniorEditProfile')}
          onSettings={() => setCurrentScreen('StaffSettings')}
          onRefresh={refreshAll}
        />
      );
    }

    if (currentScreen === 'CaregiverSeniorEditProfile') {
      return (
        <SeniorEditProfileScreen
          senior={selectedSenior}
          apiBase={apiBase}
          onBack={() => setCurrentScreen('CaregiverEditSeniorMenu')}
          isCaregiverView={true}
          onRefresh={refreshAll}
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
          apiBase={apiBase}
          medicalConditions={currentSenior?.medicalConditions ?? []}
          onHome={() => setCurrentScreen('Home')}
          onProfile={() => setCurrentScreen('SeniorProfile')}
          onSettings={() => setCurrentScreen('SeniorSettings')}
          onRefresh={refreshAll}
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
