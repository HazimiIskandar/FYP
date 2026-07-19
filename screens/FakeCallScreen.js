import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function FakeCallScreen({ onEndCall, title = "Calling Caregiver..." }) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = () => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;

    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topSection}>
        <View style={styles.avatarCircle}>
          <Ionicons name="person" size={90} color="#FFFFFF" />
        </View>

        <Text style={styles.callingText}>{title}</Text>
        <Text style={styles.timerText}>{formatTime()}</Text>
      </View>

      <View style={styles.bottomSection}>
        <TouchableOpacity
          style={styles.endButton}
          onPress={onEndCall}
          activeOpacity={0.8}
        >
          <Ionicons name="call" size={30} color="#FFFFFF" />
          <Text style={styles.endButtonText}>End Call</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
    justifyContent: 'space-between',
  },

  topSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  avatarCircle: {
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: '#DC2626',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  },

  callingText: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '900',
    textAlign: 'center',
    paddingHorizontal: 20,
  },

  timerText: {
    color: '#D1D5DB',
    fontSize: 22,
    marginTop: 12,
  },

  bottomSection: {
    padding: 24,
  },

  endButton: {
    backgroundColor: '#DC2626',
    minHeight: 80,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },

  endButtonText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
  },
});