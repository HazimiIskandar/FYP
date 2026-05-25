import React, { useState } from 'react';

// Import all your screens
import LanguageScreen from './screens/LanguageScreen';
import LoginScreen from './screens/LoginScreen';
import SeniorHomeScreen from './screens/SeniorHomeScreen';
import EmergencyScreen from './screens/EmergencyScreen';
import CaregiverHomeScreen from './screens/CaregiverHomeScreen';
import CaregiverRosterScreen from './screens/CaregiverRosterScreen';
import CommunityScreen from './screens/CommunityScreen'; // Added this!

export default function App() {
  // Master State
  const [currentScreen, setCurrentScreen] = useState('Language');
  const [hasCheckedIn, setHasCheckedIn] = useState(false);
  const [currentStreak, setCurrentStreak] = useState(4);

  // Helper function to handle check-in logic
  const handleCheckIn = () => {
    setHasCheckedIn(true);
    // Future Note: This is where your teammate will trigger the MySQL update!
  };

  const handleSeniorLogout = () => {
    setCurrentScreen('Login');
  };

  // --- NAVIGATION LOGIC ---
  
  if (currentScreen === 'Language') {
    return <LanguageScreen onSelectLanguage={() => setCurrentScreen('Login')} />;
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

  // NEW: Logic for the Community Hub
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
        onCallHelp={() => { /* Logic for ServiceNow ticket */ }} 
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
}