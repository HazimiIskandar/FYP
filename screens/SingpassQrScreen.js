import React, { useEffect } from 'react';
import { Image, SafeAreaView, StyleSheet, Text, View } from 'react-native';

const amandaLimQr = require('../assets/qrcode/margaret tan senior 1.png');

export default function SingpassQrScreen({ onDone }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 2000);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.logo}>singpass</Text>
        <Text style={styles.title}>Scan with Singpass app</Text>
        <Image source={amandaLimQr} style={styles.qrImage} resizeMode="contain" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  logo: {
    color: '#EF3340',
    fontSize: 28,
    fontWeight: '900',
    marginBottom: 14,
  },
  title: {
    color: '#111827',
    fontSize: 24,
    lineHeight: 31,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 18,
  },
  qrImage: {
    width: 250,
    height: 250,
    marginBottom: 16,
  },
  helperText: {
    color: '#6B7280',
    fontSize: 15,
    fontWeight: '800',
  },
});
