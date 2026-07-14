import React, { useEffect, useState, useCallback, useMemo } from 'react';
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

import { FontSizeProvider } from './context/FontSizeContext';

// Locales shipped in /locales + the languages listed in
// screens/LanguageScreen.js. Mirrored server-side in
// backend_api/routes/userAccountRoutes.js as SUPPORTED_LANGUAGES so the
// mobile app never sends — and the server never stores — anything outside
// this allowlist.
const APP_LANGUAGE_CODES = ['en', 'zh', 'ms', 'ta'];

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
  // Linkage gate: true once we have evidence the senior is linked to a
  // caregiver (`is_fully_linked: true` from /seniors/:id/linkage-summary).
  // Defaults CONSERVATIVELY to false so a newly-registered senior who
  // opens the app before the linkage fetch resolves is shown the
  // restricted Home view rather than the full dashboard; we accept a
  // tiny flicker for already-linked seniors (full -> restricted -> full)
  // in exchange for the safety guarantee that no unlinked senior
  // accidentally exercises I'm-Okay / SOS / Community before their
  // caregiver has linked them. /seniors/SeniorEditProfileScreen.js etc
  // receive `restrictedMode = !linkageComplete` from this state.
  const [linkageComplete, setLinkageComplete] = useState(false);
  // Tracks whether the senior has tapped OK on the Profile yellow
  // warning popup during the current session. Stays sticky for the
  // rest of the app session and is reset to false on logout so a
  // different senior signing in on the same device sees the popup
  // again. Lives at App.js level so the modal doesn't pop back up
  // every time the senior navigates Home -> Settings -> Profile
  // during their caregiver-link wait.
  const [dismissedSetupNotice, setDismissedSetupNotice] = useState(false);

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

  // Fetch the senior's caregiver + NOK link counts. Returns a TRI-STATE
  // so handleLogin can route accurately even on transient failures:
  //   'linked'   — 200 OK with `is_fully_linked: true`. Senior has an
  //                active caregiver on the backend. Marker state.
  //   'unlinked' — 200 OK with `is_fully_linked: false`. Senior has
  //                AUTHORITATIVELY no caregiver link (handles the re-
  //                onboarding case where Caregiver 1 explicitly removed
  //                them — Caregiver 1's row is gone from
  //                Senior_has_Caregiver). Marker state.
  //   'error'    — non-OK response, malformed JSON, or network/timeout
  //                exception. We deliberately do NOT distinguish whether
  //                this is a "genuinely unlinked but backend broken"
  //                or "timestamp-level transient network blip". A
  //                transient error must not violently bounce a known-
  //                linked senior into SeniorSettings + auto-modal at
  //                login (which would lock them out behind a Caregiver
  //                modal they can't dismiss until linkage re-checks).
  //                Marker state — see handleLogin for policy.
  //
  // Side-effect on linkageComplete (React state):
  //   'linked'   -> setLinkageComplete(true)
  //   'unlinked' -> setLinkageComplete(false)
  //   'error'    -> LEAVE prior linkageComplete untouched (fail-open
  //                 for already-linked seniors on transient blips).
  const LINKAGE_STATES = { LINKED: 'linked', UNLINKED: 'unlinked', ERROR: 'error' };
  const fetchLinkageSummary = async (seniorId, baseOverride = null) => {
    const targetBase = baseOverride || apiBase;
    if (!targetBase || !seniorId) {
      // Pathological preconditions (no API base resolved / no senior
      // row at all). Treat as unlinked-but-only-on-initial-mount; the
      // safe default here is the conservative one.
      console.log(
        '[linkage] fetchLinkageSummary: missing prerequisites — targetBase=' +
          String(targetBase) + ' seniorId=' + String(seniorId) +
          ' -> returning UNLINKED. If Margaret Tan style cases keep failing ' +
          "this line, the app didn't have a resolved backend base at the time of the call."
      );
      setLinkageComplete(false);
      return LINKAGE_STATES.UNLINKED;
    }
    try {
      const response = await fetchWithTimeout(
        `${targetBase}/seniors/${seniorId}/linkage-summary`,
        {},
        8000
      );
      if (!response.ok) {
        // Transient or server error — leave any prior linkageComplete
        // state intact and signal 'error' to the caller. The user has
        // already proved they're linked via an earlier successful
        // fetch; a single !ok on a background re-fetch shouldn't tear
        // down their access. The caller (handleLogin) falls back to
        // the Home screen on 'error' rather than auto-modal-into-
        // Settings, which is the safer default for an already-linked
        // senior whose backend hiccupped at login.
        console.log(
          `[linkage] non-OK ${response.status} for senior_id=${seniorId} on ${targetBase}/seniors/${seniorId}/linkage-summary — leaving linkageComplete untouched. Margaret Tan cases: inspect this line to confirm the right senior_id is being queried.`
        );
        return LINKAGE_STATES.ERROR;
      }
      const data = await response.json().catch(() => null);
      const isLinked = Boolean(data && data.is_fully_linked);
      // DIAGNOSTIC: dump the full response so a Margaret Tan or any
      // other "caregiver portal says linked but senior app says
      // restricted" case can be root-caused directly from the browser
      // console without needing to deploy additional telemetry. The
      // voluntary refresh button on the restricted Home card (see
      // SeniorHomeScreen.js onRefreshLinkage) is what a senior taps
      // to invoke this line on demand.
      console.log(
        `[linkage] response senior_id=${seniorId} payload=${JSON.stringify(data)} is_fully_linked=${isLinked} -> ${
          isLinked ? 'LINKED' : 'UNLINKED'
        }. If this prints UNLINKED for a Margaret Tan who the caregiver portal shows as linked, then either (a) the senior_id here is wrong (refreshAll found a phantom duplicate Senior row instead of the linked one), or (b) the underlying Senior_has_Caregiver row is genuinely missing.`
      );
      setLinkageComplete(isLinked);
      return isLinked ? LINKAGE_STATES.LINKED : LINKAGE_STATES.UNLINKED;
    } catch (err) {
      // Network error / abort / timeout — also leave linkageComplete
      // intact and signal 'error'. Caller falls back to Home.
      console.log(
        `[linkage] fetch exception senior_id=${seniorId} on ${targetBase}/seniors/${seniorId}/linkage-summary err=${err?.message || err} — leaving linkageComplete untouched`
      );
      return LINKAGE_STATES.ERROR;
    }
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

      // Apply the user's saved UI locale BEFORE navigation so the senior
      // sees their language on the Home screen on first paint (no flash
      // of the default 'en').
      if (body?.preferred_language && APP_LANGUAGE_CODES.includes(body.preferred_language)) {
        i18n.changeLanguage(body.preferred_language);
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

      // Decide the post-login screen:
      //   1. AIC staff (role_id === 3)  -> AICPortal
      //   2. Caregiver   (role_id === 2) -> CaregiverHome
      //   3. Senior role (any user_id with role_id === 1 OR a role
      //      name containing "senior") -> branch by linkage:
      //        'linked'   -> Home   (full check-in / Community / SOS
      //                             surface)
      //        'unlinked' -> SeniorSettings + auto-opened Caregiver
      //                      modal (re-onboarding case: the senior's
      //                      previous caregiver removed them via
      //                      DELETE FROM Senior_has_Caregiver, OR the
      //                      senior just registered and has no caregiver
      //                      yet — same UX from the senior's POV).
      //                      We also cancel any device-level local
      //                      missed-check-in reminders left over from
      //                      the previous caregiver era so the senior
      //                      doesn't get a stale "we noticed you missed
      //                      your morning check-in" push while sitting
      //                      on SeniorSettings.
      //        'error'    -> Home (fail-OPEN fallback — a transient
      //                      5xx on /linkage-summary during login must
      //                      NOT lock a previously-linked senior
      //                      behind a Caregiver modal they can't
      //                      dismiss. The Home screen's restricted
      //                      Setup-Required card will still surface the
      //                      "Generate Link Code" CTA and the linkage
      //                      state will self-correct on the next
      //                      successful background re-fetch.)
      //   4. Anything else -> no screen transition.
      let linkageRoutingState =
        loggedInSenior && loggedInSenior.senior_id ? 'linked' : null;
      if (loggedInSenior && loggedInSenior.senior_id) {
        try {
          linkageRoutingState = await fetchLinkageSummary(
            loggedInSenior.senior_id,
            activeBase
          );
        } catch (err) {
          // Belt-and-braces: a thrown error here usually means
          // fetchWithTimeout rejected after our own catch block,
          // which is theoretically unreachable today. Treat as 'error'
          // so we still fall open into Home rather than locking the
          // user into a modal.
          console.log(
            'handleLogin linkage fetch threw senior_id=' +
              String(loggedInSenior.senior_id) +
              ' err=' + ((err && err.message) || String(err))
          );
          linkageRoutingState = 'error';
        }
      } else {
        setLinkageComplete(false);
        linkageRoutingState = 'unlinked';
      }

      if (roleId === 3 || roleName.includes('aic')) {
        setCurrentScreen('AICPortal');
      } else if (roleId === 2 || roleName.includes('caregiver')) {
        setCurrentScreen('CaregiverHome');
      } else if (isSeniorRole) {
        // Senior role: branch the destination by live linkage state.
        // See the post-login decision block above for the full per-case
        // rationale. Two key invariants:
        //   * 'linked'   -> Home           (everything works)
        //   * 'unlinked' -> SeniorSettings + Caregiver modal auto-open
        //                   (the senior is in the brand-new-account
        //                    OR re-onboarding flow; both cases resolve
        //                    to the same screen-from-their-POV "you
        //                    need a caregiver right now, generate a
        //                    link code").
        //   * 'error'    -> Home fallback  (transient backend blip)
        if (linkageRoutingState === 'unlinked') {
          setOpenCaregiverLinkOnSettings(true);
          // Cancel any device-local check-in reminders left over from
          // a previous linkage era so an unlinked senior doesn't get
          // a stale push notification while sitting on SeniorSettings
          // waiting for Caregiver 2 to enter the new code.
          try {
            cancelMissedCheckInReminders();
          } catch (err) {
            console.log('cancelMissedCheckInReminders failed:', err);
          }
          setCurrentScreen('SeniorSettings');
        } else {
          // 'linked' or 'error' (fallback): both land on Home. The
          // IMPORTANT nuance for the 'error' branch: an existing
          // senior (one with a senior_id) MUST see the full Home
          // view rather than the restricted Setup-Required card,
          // because a transient 5xx on /linkage-summary at login
          // time should NOT lock an existing-caregiver senior out
          // of their dashboard. We optimise linkageComplete to TRUE
          // specifically on the 'error' branch when a senior_id
          // already exists (i.e. the senior actually has an account
          // in the DB). This protects the user's invariant:
          // "existing seniors with a caregiver must always see Home
          // on login" doesn't depend on the /linkage-summary
          // response being successful.
          //
          // To avoid leaving the senior sitting on Home with a
          // stale optimistic state for the entire window until
          // their next user-triggered refreshAll() (a window that
          // could be minutes if they just sit on the home screen),
          // we also kick off an immediate verification fetch in the
          // background. fetchLinkageSummary is idempotent and
          // returns the tri-state again — if it confirms the senior
          // IS in fact unlinked, it will setLinkageComplete(false)
          // and the next render will flip Home into the restricted
          // Setup Required card automatically (with the user's
          // existing data intact, exactly as the re-onboarding
          // scenario requires). Fire-and-forget so the optimistic
          // Home render isn't blocked on the verification round-
          // trip. Errors on this verification fetch leave
          // linkageComplete untouched (already set to optimistic
          // true above) — still showing Home rather than locking
          // out a known senior.
          if (linkageRoutingState === 'error' && loggedInSenior?.senior_id) {
            setLinkageComplete(true);
            fetchLinkageSummary(loggedInSenior.senior_id, activeBase).catch(
              (verifyErr) => {
                console.log(
                  'handleLogin post-optimistic verification fetch failed senior_id=' +
                    String(loggedInSenior.senior_id) +
                    ' err=' +
                    ((verifyErr && verifyErr.message) || String(verifyErr))
                );
              }
            );
          }
          setCurrentScreen('Home');
        }
      }
      // Unrecognised role: leave them on the screen they were on
      // (Login by default). This silent fall-through is intentional
      // — a future admin role will be added as its own branch above
      // rather than auto-routed into the senior Home.
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
      // Carry the locale the senior just picked (or the current default)
      // through registration so the next login re-applies it automatically.
      const currentLanguage = APP_LANGUAGE_CODES.includes(i18n.language)
        ? i18n.language
        : 'en';

      const response = await fetchWithTimeout(`${activeBase}/users/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: normalizedName,
          email: normalizedEmail,
          password,
          phone_number: '',
          role: role || 'Senior',
          preferred_language: currentLanguage,
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
    // Decorate the selected senior with the same derived status used in
    // decoratedSeniors so the detail screen mirrors what the roster showed
    // when the caregiver tapped the row.
    const derivedStatus = getDerivedStatus(
      enhancedSenior,
      getDateKey(new Date())
    );

    setSelectedSenior({ ...(enhancedSenior || {}), status: derivedStatus });
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

  // Derive the caregiver-facing status of a senior from the live
  // Daily_CheckIn + Emergency_Event state. Returns one of:
  //   "Urgent"     — non-resolved Emergency_Event exists.
  //   "Checked In" — any 'Completed' Daily_CheckIn for this senior today.
  //   "Pending"    — neither of the above.
  //
  // The /caregiver/:id/seniors endpoint only returns Senior + User_Account
  // columns (no status), so caregiver screens rely on this helper to show
  // any status value at all instead of silently falling through to
  // 'Pending'.
  const getDerivedStatus = (senior, todayKeyValue) => {
    const seniorId = String(senior?.senior_id || '');

    const hasUrgentEvent =
      Array.isArray(emergencyEvents) &&
      emergencyEvents.some((event) => {
        if (String(event?.senior_id) !== seniorId) return false;
        const eventStatus = String(event?.event_status || '').trim();
        if (!eventStatus) return false;
        return !/^(resolved|closed|cancelled)$/i.test(eventStatus);
      });
    if (hasUrgentEvent) return 'Urgent';

    const hasCheckedInToday =
      Array.isArray(checkIns) &&
      checkIns.some(
        (entry) =>
          String(entry?.senior_id) === seniorId &&
          (entry?.checkin_status || '').toLowerCase().includes('completed') &&
          (!entry?.checkin_timestamp ||
            getDateKey(entry?.checkin_timestamp) === todayKeyValue)
      );
    if (hasCheckedInToday) return 'Checked In';

    return 'Pending';
  };

  // Pick the most recent completed Daily_CheckIn row for a given senior.
  // The /checkins endpoint already returns the full set of rows ordered
  // DESC, so the front-end can resolve "latest check-in" without a
  // round-trip to /checkin/:senior_id. Returns the raw row (or null) so
  // callers can format the timestamp however they want — the Caregiver
  // Home screen renders it through formatRelativeTime.
  const getLatestCheckInFor = (seniorId) => {
    if (!seniorId) return null;
    const matching = (Array.isArray(checkIns) ? checkIns : []).filter(
      (entry) =>
        String(entry?.senior_id) === String(seniorId) &&
        (entry?.checkin_status || '').toLowerCase().includes('completed')
    );
    if (!matching.length) return null;
    return matching
      .slice()
      .sort(
        (left, right) =>
          new Date(right?.checkin_timestamp || 0).getTime() -
          new Date(left?.checkin_timestamp || 0).getTime()
      )[0];
  };

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

  const hasCheckedInMorning = currentSenior?.senior_id
    ? checkIns.some((c) =>
        String(c?.senior_id) === String(currentSenior.senior_id) &&
        (c?.checkin_status || '').toLowerCase().includes('completed') &&
        (!c.checkin_timestamp || getDateKey(c.checkin_timestamp) === todayKey) &&
        (new Date(c.checkin_timestamp).getHours() < 16)
      )
    : false;

  const hasCheckedInEvening = currentSenior?.senior_id
    ? checkIns.some((c) =>
        String(c?.senior_id) === String(currentSenior.senior_id) &&
        (c?.checkin_status || '').toLowerCase().includes('completed') &&
        (!c.checkin_timestamp || getDateKey(c.checkin_timestamp) === todayKey) &&
        (new Date(c.checkin_timestamp).getHours() >= 16)
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
      // Each fetch is independent — failing one endpoint never blocks the
      // others (Promise.allSettled instead of Promise.all). Seniors stays
      // empty until an authenticated user triggers a role-aware refreshAll.
      const safeFetch = async (url) => {
        try {
          const response = await fetch(url);
          if (!response.ok) return [];
          return await response.json();
        } catch (err) {
          console.log(`safeFetch failed for ${url}:`, err?.message || err);
          return [];
        }
      };

      try {
        const [usersData, checkInsData, emergencyData, rewardsData, communitiesData] =
          await Promise.all([
            safeFetch(`${apiBase}/users`),
            safeFetch(`${apiBase}/checkins`),
            safeFetch(`${apiBase}/emergency-events`),
            safeFetch(`${apiBase}/rewards`),
            safeFetch(`${apiBase}/community/activities/all`),
          ]);

        console.log('=== FETCHED USERS DATA ===');
        console.log('=== USING API BASE ===', apiBase);

        const userMap = new Map(
          (Array.isArray(usersData) ? usersData : []).map((user) => [user.user_id, user])
        );

        setUsers(Array.isArray(usersData) ? usersData : []);
        // Seniors is intentionally NOT touched here. The role-aware
        // refreshAll() populated summary data after login (so seniors
        // already reflects this caregiver's roster). Touching seniors
        // state inside this mount-time fetchAllData effect races with
        // a concurrent login — the slow Promise.all below resolves
        // *after* handleLogin has called refreshAll(), and an
        // unconditional setSeniors([]) silently wipes the populated
        // roster to empty, leaving the Caregiver Home tile stuck at
        // 0/0 even though Amanda actually has 5 linked seniors.
        // Initial useState([]) keeps the list empty before login;
        // refreshAll() owns the roster end-to-end; handleLogout()
        // clears it on sign-out.
        setCheckIns(Array.isArray(checkInsData) ? checkInsData : []);
        setCommunityActivities(Array.isArray(communitiesData) ? communitiesData : []);
        setEmergencyEvents(Array.isArray(emergencyData) ? emergencyData : []);
        setRewardStreaks(Array.isArray(rewardsData) ? rewardsData : []);
      } catch (err) {
        console.log('API fetch error:', err);

        // Skip setSeniors([]) here for the same race-condition reason
        // documented above. Other datasets are still cleared because
        // they were never populated and could be left with stale rows
        // from a previous session.
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

      // Bullet-proof caregiver detection: accept either numeric role_id === 2
      // OR a role name string containing "caregiver" (case-insensitive, ignoring
      // leading/trailing whitespace). Falls through to /seniors for everyone
      // else (AIC staff, seniors, etc.).
      const effectiveRoleName = String(
        effectiveUser?.role || effectiveUser?.role_name || effectiveUser?.roleName || ''
      ).toLowerCase().trim();
      const effectiveRoleId = Number(effectiveUser?.role_id);
      const isCaregiver = Number.isFinite(effectiveRoleId) && effectiveRoleId === 2
        ? true
        : effectiveRoleName.includes('caregiver');
      const seniorsUrl =
        isCaregiver && effectiveUser?.user_id
          ? `${apiBase}/caregiver/${effectiveUser.user_id}/seniors`
          : `${apiBase}/seniors`;

      // Diagnostic: confirm the caregiver path is exercised in the browser console.
      console.log(
        '[refreshAll] caregiver path ->',
        JSON.stringify({
          user_id: effectiveUser?.user_id,
          role_id: effectiveUser?.role_id,
          role_name: effectiveRoleName,
          isCaregiver,
          seniorsUrl,
        })
      );

      // Each endpoint fetched independently so one failing endpoint never
      // drops the seniors data that the user is actually waiting on.
      const safeJson = async (url) => {
        try {
          const response = await fetch(url);
          if (!response.ok) {
            console.log(`[refreshAll] non-OK ${response.status} for ${url}`);
            return [];
          }
          return await response.json();
        } catch (err) {
          console.log(`[refreshAll] fetch failed for ${url}:`, err?.message || err);
          return [];
        }
      };

      const [seniorsData, usersData, checkinsData, rewardsData, communityData, emergencyData] =
        await Promise.all([
          safeJson(seniorsUrl),
          safeJson(`${apiBase}/users`),
          safeJson(`${apiBase}/checkins`),
          safeJson(`${apiBase}/rewards`),
          safeJson(`${apiBase}/community/activities/all`),
          safeJson(`${apiBase}/emergency-events`),
        ]);

      console.log(
        '[refreshAll] result ->',
        JSON.stringify({
          seniorsUrl,
          seniorsCount: Array.isArray(seniorsData) ? seniorsData.length : 0,
          usersCount: Array.isArray(usersData) ? usersData.length : 0,
        })
      );

      const userMap = new Map(
        (Array.isArray(usersData) ? usersData : []).map((user) => [user.user_id, user])
      );
      // IMPORTANT: do NOT filter out placeholder "Unknown Senior" rows here.
      // A legacy filter dropped any senior whose User_Account.full_name was
      // missing/blank, which silently shrank Amanda Lee's roster from 5 to 0
      // in production: even after the backend's INNER JOIN had passed the
      // link through, normalizeSenior's fallback to 'Unknown Senior' kicked
      // in for any senior with a NULL or empty-string `full_name`, and this
      // .filter then deleted the row before the caregiver ever saw it.
      // Caregivers must see every Senior_has_Caregiver linkage regardless of
      // display-name integrity -- placeholders are far easier to debug than
      // a silently empty roster.
      const normalizedSeniors = Array.isArray(seniorsData)
        ? seniorsData.map((senior) => normalizeSenior(senior, userMap))
        : [];
      setUsers(Array.isArray(usersData) ? usersData : []);
      setCheckIns(Array.isArray(checkinsData) ? checkinsData : []);
      setCommunityActivities(Array.isArray(communityData) ? communityData : []);
      setRewardStreaks(Array.isArray(rewardsData) ? rewardsData : []);
      setEmergencyEvents(Array.isArray(emergencyData) ? emergencyData : []);

      // For caregivers, fan-out a per-senior fetch for NOK contacts + medical
      // conditions in parallel so the priority card on the Caregiver Home
      // screen can render "Emergency contact" + "Relationship" without an
      // extra round-trip when the user navigates between screens.
      // /caregiver/:id/seniors only JOINs Senior + User_Account so this
      // additional envelope is required to surface the elder's contact
      // network on the front-end.
      // Uses fetchWithTimeout so a single slow backend endpoint cannot
      // pin the whole refreshAll indefinitely on a flaky network.
      let enrichedSeniors = normalizedSeniors;
      if (
        isCaregiver &&
        apiBase &&
        Array.isArray(normalizedSeniors) &&
        normalizedSeniors.length > 0
      ) {
        try {
          const fetchEnvelope = async (path) => {
            const response = await fetchWithTimeout(
              `${apiBase}${path}`,
              {},
              8000
            );
            return response.ok ? response.json() : [];
          };
          const enriched = await Promise.all(
            normalizedSeniors.map(async (senior) => {
              if (!senior?.senior_id) {
                return senior;
              }
              const [nokData, conditionsData] = await Promise.all([
                fetchEnvelope(`/seniors/${senior.senior_id}/nok`),
                fetchEnvelope(`/seniors/${senior.senior_id}/medical-conditions`),
              ]);
              return {
                ...senior,
                nokContacts: Array.isArray(nokData) ? nokData : [],
                medicalConditions: Array.isArray(conditionsData)
                  ? conditionsData
                  : [],
              };
            })
          );
          enrichedSeniors = enriched;
          setSeniors(enrichedSeniors);
        } catch (err) {
          console.log(
            '[refreshAll] caregiver roster enrichment failed:',
            err?.message || err
          );
          // Fall back to the un-enriched list — still better than wiping
          // out the roster because one NOK endpoint hiccupped.
          setSeniors(normalizedSeniors);
        }
      } else {
        setSeniors(normalizedSeniors);
      }
      // if someone is authenticated, update their cached user object too
      let updatedSeniorWithExtras = null;
      if (effectiveUser && effectiveUser.user_id) {
        const updated = (Array.isArray(usersData) ? usersData : []).find(
          (u) => String(u.user_id) === String(effectiveUser.user_id)
        );
        if (updated) setAuthenticatedUser(updated);

        // Filter (NOT .find) so we can DETECT + LOG when multiple Senior
        // rows match the same user_id — a data-integrity hazard that
        // surfaced as the Margaret Tan case where the caregiver portal
        // shows her linked but her own senior app shows restricted,
        // because Array.find blindly picked the first row (which happens
        to be an orphan phantom Senior row never linked to a caregiver)
        // instead of the row that's actually in Senior_has_Caregiver.
        // Once we surface the candidate senior_ids via this console.warn,
        // the right operational fix is a backend cleanup migration that
        // (a) deletes phantom orphan Senior rows and (b) adds
        // ALTER TABLE Senior ADD UNIQUE (user_id) so future duplicates
        // can't slip through. Without the UNIQUE constraint, the
        // duplicate row can re-materialise after any future buggy
        // POST /seniors call.
        const matchingSeniorCandidates = (Array.isArray(normalizedSeniors) ? normalizedSeniors : []).filter(
          (s) => String(s?.user_id) === String(effectiveUser?.user_id)
        );

        // DISAMBIGUATION: when multiple Senior rows point at the same
        // user_id (the Margaret Tan data-hygiene case — a phantom orphan
        // Senior row created in the past before a UNIQUE(user_id) INDEX
        // was on the backend, plus the originally-linked row that the
        // caregiver portal shows as linked), we probe /linkage-summary
        // for each candidate and prefer the one whose is_fully_linked
        // toggles true. Falls back to the first candidate if none do.
        // Bounded to one extra round-trip per duplicate candidate so
        // normal users (one Senior row) pay nothing; users with
        // duplicates get one round-trip per extra row, capped at 4s
        // per candidate so a slow backend can't stall login.
        let matchingSenior = matchingSeniorCandidates[0] || null;

        if (matchingSeniorCandidates.length > 1) {
          console.warn(
            '[refreshAll] DATA INTEGRITY: multiple Senior rows for user_id=' +
              String(effectiveUser?.user_id) +
              ' candidate_ids=' +
              JSON.stringify(matchingSeniorCandidates.map((c) => c.senior_id)) +
              ' picked_preliminary=' +
              String(matchingSenior?.senior_id) +
              ' -> running per-candidate /linkage-summary to find the linked one'
          );

          for (const candidate of matchingSeniorCandidates) {
            const cid = candidate?.senior_id;
            if (cid === undefined || cid === null) continue;
            try {
              const lsResponse = await fetchWithTimeout(
                `${apiBase}/seniors/${cid}/linkage-summary`,
                {},
                4000
              );
              if (!lsResponse.ok) continue;
              const lsData = await lsResponse.json().catch(() => null);
              if (lsData && lsData.is_fully_linked === true) {
                matchingSenior = candidate;
                console.log(
                  '[refreshAll] disambiguation: chose candidate senior_id=' +
                    String(cid) +
                    ' because /linkage-summary returned is_fully_linked=true'
                );
                break;
              }
            } catch (lsErr) {
              // skip this candidate; try the next
            }
          }

          if (matchingSenior) {
            console.log(
              '[refreshAll] disambiguation final pick: senior_id=' +
                String(matchingSenior.senior_id) +
                ' (user_id=' + String(effectiveUser?.user_id) + ')'
            );
          }
        }

        updatedSeniorWithExtras = matchingSenior;

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

      // Re-fetch linkage so a caregiver that just linked on their
      // phone (via /caregiver/link-senior) auto-promotes the senior
      // app to the full Home view the next refresh tick. We do this
      // whenever we have a senior record — login flow, post-save
      // refresh on Profile, post-checkin refresh — instead of only
      // once at login. The fetch is fire-and-forget so a transient
      // backend hiccup never blocks the rest of refreshAll.
      if (matchingSenior?.senior_id) {
        fetchLinkageSummary(matchingSenior.senior_id).catch((err) => {
          console.log(
            'refreshAll linkage fetch failed senior_id=' +
              String(matchingSenior.senior_id) +
              ' err=' + ((err && err.message) || String(err))
          );
        });
      } else if (updatedSeniorWithExtras?.senior_id) {
        fetchLinkageSummary(updatedSeniorWithExtras.senior_id).catch(() => {});
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

      // Removed local setHasCheckedIn state to rely on backend refresh
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
    setSeniors([]);
    setSelectedSeniorOrigin('Status');
    // Reset linkage + dismissed-popup flags so the next senior who
    // logs in on this device starts from a clean slate — otherwise a
    // previously-restricted session could leak into the next user's
    // view after the Linkage tab / Setup Notice already dismissed.
    setLinkageComplete(false);
    setDismissedSetupNotice(false);
    // Intentionally do NOT reset i18n.language here — the senior is going
    // back to the Login screen which will re-fetch the saved preference
    // via /users/login the moment they re-authenticate.
    setCurrentScreen('Login');
  };

  // Persist the user's chosen language to User_Account.preferred_language.
  // Fire-and-forget: we don't want a transient backend error to block the
  // already-completed i18n.changeLanguage() UX, but we update local state
  // synchronously so a quick logout/login doesn't clobber it with stale
  // /users data from the server.
  const saveLanguagePreference = (userId, langCode) => {
    if (!userId || !langCode) return;
    if (!APP_LANGUAGE_CODES.includes(langCode)) return;

    setAuthenticatedUser((current) =>
      current && String(current.user_id) === String(userId)
        ? { ...current, preferred_language: langCode }
        : current
    );

    const targetBase = apiBase || REMOTE_API_BASE;

    fetchWithTimeout(
      `${targetBase}/users/${userId}/language`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferred_language: langCode }),
      },
      8000
    ).catch((err) => {
      console.log('saveLanguagePreference failed:', err?.message || err);
    });
  };

  // -------------------------
  // DERIVED STATUS (caregiver-side status fix)
  // -------------------------
  // /caregiver/:id/seniors only returns Senior + User_Account columns — there
  // is no "status" field on the row. The actual check-in records live in
  // Daily_CheckIn and emergency events in Emergency_Event. Decorate every
  // senior with a derived `status` ("Urgent" | "Checked In" | "Pending") so
  // the caregiver screens can read senior.status like a normal property and
  // correctly reflect today's reality instead of always falling through to
  // "Pending".
  const decoratedSeniors = useMemo(
    () =>
      seniors.map((senior) => ({
        ...senior,
        status: getDerivedStatus(senior, getDateKey(new Date())),
      })),
    // getDerivedStatus reads emergencyEvents + checkIns at call time; list
    // them in the deps so the memo invalidates when either changes.
    [seniors, checkIns, emergencyEvents]
  );

  // Single source of truth for "this senior is currently without an
  // active caregiver link". Used to gate every restricted surface:
  //   * SeniorHomeScreen   — early-return into a Setup Required card
  //                          (one-tap CTA into SeniorSettings modal).
  //   * SeniorSettingsScreen — Caregiver row + auto-open Caregiver
  //                          modal are visible.
  //   * SeniorProfileScreen — yellow Setup Required popup.
  //   * SeniorBottomNav    (via restrictedMode on every screen) —
  //                          Community tab is hidden.
  //
  // We deliberately dropped the previous AND-conjunction with
  // `!isSeniorProfileComplete(currentSenior)`. The user's current
  // mandate is: "currently not linked to a caregiver" is the
  // SINGLE gating condition, regardless of whether the senior
  // is a brand-new account OR a previously-linked senior whose
  // caregiver just removed them. Profile completeness is now
  // orthogonal to feature availability. The legacy
  // isSeniorProfileComplete helper has been removed from this
  // file as part of the same cleanup pass.
  const isNewAccount = !linkageComplete;

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
            // Persist for currently-signed-in users (e.g. someone who
            // hopped back to LanguageScreen from the Login screen).
            // Pre-login picks are kept in-memory; handleRegister will
            // re-send this same value at registration time.
            if (authenticatedUser?.user_id) {
              saveLanguagePreference(authenticatedUser.user_id, langCode);
            }
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
          hasCheckedInMorning={hasCheckedInMorning}
          hasCheckedInEvening={hasCheckedInEvening}
          currentStreak={currentStreak}
          onCheckIn={handleCheckIn}
          onSOS={() => setCurrentScreen('Emergency')}
          onCommunity={() => setCurrentScreen('Community')}
          onProfile={() => setCurrentScreen('SeniorProfile')}
          onSettings={() => setCurrentScreen('SeniorSettings')}
          onSelectLanguage={(langCode) => {
            i18n.changeLanguage(langCode);
            if (authenticatedUser?.user_id) {
              saveLanguagePreference(authenticatedUser.user_id, langCode);
            }
          }}
          // Single-flag restricted View: the senior has no active
          // caregiver link, regardless of which onboarding path got
          // them here (brand-new account, OR re-onboarding after
          // Caregiver 1 explicitly removed them via DELETE FROM
          // Senior_has_Caregiver). SeniorHomeScreen.js owns the early-
          // return; App.js only supplies this boolean.
          isLinkageIncomplete={!linkageComplete}
          onGenerateLinkCode={() => {
            // Reuse the existing Caregiver modal flow. Same UX as
            // tapping the "Caregiver" row inside SeniorSettings, just
            // reached in one tap from the prominent Home CTA.
            setOpenCaregiverLinkOnSettings(true);
            setCurrentScreen('SeniorSettings');
          }}
          // Optional 'Refresh Linkage Status' button on the restricted
          // card — fires refreshAll() which fans out fetchLinkageSummary
          // in the background. The diagnostic console.log inside
          // fetchLinkageSummary prints the senior_id + full response so
          // any Margaret Tan style mis-routing is debuggable directly
          // from the browser console. If the response flips to
          // is_fully_linked: true, the senior's restricted card
          // vanishes on the next React render and they get the full
          // Home dashboard automatically (no logout/login needed).
          onRefreshLinkage={() => {
            if (refreshAll) {
              refreshAll(authenticatedUser);
            }
          }}
        />
      );
    }

    if (currentScreen === 'SeniorProfile') {
      // restrictedMode fed into SeniorBottomNav (Community tab hidden
      // for Case 4 new-account onboarding only). Profile BottomNav now
      // matches Home + Settings: existing unlinked profile-complete
      // seniors (Case 5, e.g. Margaret Tan) keep the Community tab.
      // showLinkageWarning mirrors the same rule plus the sticky
      // dismissedSetupNotice flag so navigating Home -> Profile ->
      // Settings -> Profile doesn't re-pop the yellow popup.
      return (
        <SeniorProfileScreen
          senior={currentSenior}
          apiBase={apiBase}
          onHome={() => setCurrentScreen('Home')}
          onCommunity={() => setCurrentScreen('Community')}
          onSettings={() => setCurrentScreen('SeniorSettings')}
          isLinkageIncomplete={isNewAccount}
          restrictedMode={isNewAccount}
          showLinkageWarning={
            isNewAccount && !dismissedSetupNotice
          }
          onDismissLinkageWarning={() => setDismissedSetupNotice(true)}
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
          restrictedMode={isNewAccount}
        />
      );
    }

    if (currentScreen === 'SeniorSettings') {
      // Single-flag gate: restrictedMode = !linkageComplete (see
      // isNewAccount above). SeniorSettingsScreen owns the Caregiver
      // row + modal visibility off restrictedMode alone now that the
      // profile-completeness conjunction has been removed — a senior
      // whose previous caregiver was removed must still be able to
      // generate a fresh code from this screen.
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
          restrictedMode={isNewAccount}
        />
      );
    }

    if (currentScreen === 'CaregiverHome') {
      // Pick the most-urgent senior for the priority card rather than just
      // the alphabetically-first row — otherwise an Urgent senior could be
      // hidden behind a Checked In senior with a name starting 'A'.
      const topPrioritySenior =
        decoratedSeniors.find((s) => s.status === 'Urgent') ||
        decoratedSeniors.find((s) => s.status === 'Pending') ||
        decoratedSeniors[0];
      // Latest completed Daily_CheckIn row for that senior, surfaced as
      // a "Latest check-in" timestamp on the priority card so the line is
      // driven by the check-in schema (not hardcoded).
      const topPriorityLatestCheckIn = topPrioritySenior
        ? getLatestCheckInFor(topPrioritySenior.senior_id)
        : null;
      return (
        <CaregiverHomeScreen
          summary={{
            // Total / Checked In / Urgent must all be scoped to the SAME
            // set — this caregiver's roster (decoratedSeniors). The previous
            // implementation mixed checkedInCount (computed from /checkins,
            // which is a global endpoint) into a numerator alongside a
            // roster-scoped denominator => ratios > 1 (e.g. "21/5") on a
            // roster of 5 seniors. decoratedSeniors[i].status already encodes
            // "Checked In" via getDerivedStatus, so all three counts come
            // from the same scoped set.
            total: decoratedSeniors.length,
            checkedIn: decoratedSeniors.filter((s) => s.status === 'Checked In').length,
            urgent: decoratedSeniors.filter((s) => s.status === 'Urgent').length
          }}
          prioritySenior={topPrioritySenior}
          latestCheckIn={topPriorityLatestCheckIn}
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
          seniors={decoratedSeniors}
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
          seniors={decoratedSeniors}
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
      // Pass decoratedSeniors (not raw `seniors`) so AIC staff see the
      // same derived Urgent / Checked In / Missing status that the
      // caregiver screens do. AICPortalScreen already reads
      // senior?.status as the first source in its getRawStatus helper,
      // so no screen-side change is required.
      return (
        <AICPortalScreen
          seniors={decoratedSeniors}
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
    <FontSizeProvider>
      <View style={styles.previewBackground}>
        <View style={styles.phoneShell}>
          <View style={styles.speaker} />
          <View style={styles.phoneScreen}>{children}</View>
        </View>
      </View>
    </FontSizeProvider>
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
