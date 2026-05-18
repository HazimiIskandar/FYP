import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function Header({ title = 'Halo', subtitle, backgroundColor = '#FFFFFF' }) {
  return (
    <View style={[styles.header, { backgroundColor }]}>
      <View>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <Ionicons name="menu-outline" size={30} color="#1F2937" />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: { color: '#111827', fontSize: 24, fontWeight: '800' },
  subtitle: { color: '#6B7280', fontSize: 14, marginTop: 2 },
});
