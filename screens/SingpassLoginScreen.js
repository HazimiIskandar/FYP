import React from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function SingpassLoginScreen({ onRetrieve, onClose }) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.86}>
          <Ionicons name="close" size={26} color="#D1D5DB" />
        </TouchableOpacity>

        <Text style={styles.logo}>singpass</Text>
        <Text style={styles.title}>Retrieve your details with Singpass to continue</Text>
        <Text style={styles.subtitle}>
          With your consent, we will auto-fill the form making the registration process more seamless.
        </Text>

        <TouchableOpacity style={styles.retrieveButton} onPress={onRetrieve} activeOpacity={0.86}>
          <Text style={styles.retrieveButtonText}>Retrieve Myinfo with Singpass</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
    paddingHorizontal: 26,
    paddingTop: 54,
    paddingBottom: 38,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 14,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    color: '#EF3340',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 0,
    marginBottom: 20,
  },
  title: {
    color: '#3F3F46',
    fontSize: 23,
    lineHeight: 29,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    color: '#4B5563',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 24,
  },
  retrieveButton: {
    backgroundColor: '#EF3340',
    minHeight: 54,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  retrieveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
  },
});
