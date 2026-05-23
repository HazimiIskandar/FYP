import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function Header({ title = 'Haloapp', subtitle, backgroundColor = '#FFFFFF' }) {
  return (
    <View style={[styles.header, { backgroundColor }]}>
      <View>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: { color: '#111827', fontSize: 24, fontWeight: '800' },
  subtitle: { color: '#6B7280', fontSize: 14, marginTop: 2 },
});
