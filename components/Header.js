import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function Header({ title = 'Haloapp', subtitle, backgroundColor = '#FFFFFF', rightContent }) {
  return (
    <View style={[styles.header, { backgroundColor }]}>
      <View style={styles.headerRow}>
        <View style={styles.copy}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {rightContent ? <View style={styles.rightContent}>{rightContent}</View> : null}
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
  headerRow: { flexDirection: 'row', alignItems: 'flex-start' },
  copy: { flex: 1, paddingRight: 12 },
  rightContent: { marginTop: -2 },
  title: { color: '#111827', fontSize: 24, fontWeight: '800' },
  subtitle: { color: '#6B7280', fontSize: 14, marginTop: 2 },
});
