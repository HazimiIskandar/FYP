import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFontScale } from '../context/FontSizeContext';

export default function Header({ title = 'Haloapp', subtitle, badge, backgroundColor = '#FFFFFF', rightContent }) {
  const { fontScale } = useFontScale();
  
  return (
    <View style={[styles.header, { backgroundColor }]}>
      <View style={styles.headerRow}>
        <View style={styles.copy}>
          {badge && <View style={styles.badgeContainer}>{badge}</View>}
          <Text style={[styles.title, { fontSize: 28 * fontScale }]}>{title}</Text>
          {subtitle ? <Text style={[styles.subtitle, { fontSize: 15 * fontScale }]}>{subtitle}</Text> : null}
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
  badgeContainer: { marginBottom: 8, flexDirection: 'row', alignItems: 'center' },
  rightContent: { marginTop: -2 },
  title: { color: '#111827', fontSize: 24, fontWeight: '800' },
  subtitle: { color: '#6B7280', fontSize: 14, marginTop: 2 },
});
