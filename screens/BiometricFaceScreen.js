import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';

export default function BiometricFaceScreen({ onAuthenticated }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );

    pulse.start();

    const timer = setTimeout(() => {
      pulse.stop();
      onAuthenticated();
    }, 2500);

    return () => {
      clearTimeout(timer);
      pulse.stop();
    };
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Haloapp"
        subtitle="Secure biometric verification"
      />

      <View style={styles.content}>
        <Animated.View
          style={[
            styles.faceCircle,
            { transform: [{ scale: pulseAnim }] },
          ]}
        >
          <Ionicons
            name="scan-circle"
            size={140}
            color="#2563EB"
          />
        </Animated.View>

        <Text style={styles.title}>
          Verifying Face ID
        </Text>

        <Text style={styles.subtitle}>
          Please look at the screen
        </Text>

        <View style={styles.statusCard}>
          <Ionicons
            name="shield-checkmark"
            size={24}
            color="#2563EB"
          />
          <Text style={styles.statusText}>
            Secure authentication in progress...
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },

  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },

  faceCircle: {
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 5,
    borderColor: '#93C5FD',
  },

  title: {
    marginTop: 40,
    fontSize: 32,
    fontWeight: '900',
    color: '#111827',
  },

  subtitle: {
    marginTop: 8,
    fontSize: 18,
    color: '#6B7280',
  },

  statusCard: {
    marginTop: 40,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },

  statusText: {
    marginLeft: 10,
    fontSize: 15,
    color: '#374151',
    fontWeight: '600',
  },
});