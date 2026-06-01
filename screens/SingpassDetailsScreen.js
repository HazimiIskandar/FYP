import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const requestedFields = [
  ['Name', 'Pass Type'],
  ['Alias Name', 'Pass Status'],
  ['Sex', 'Pass Expiry'],
  ['Nationality/Citizenship', 'Occupation'],
  ['Date of Birth', 'Employment Sector'],
  ['Registered Address', ''],
  ['NRIC/FIN', ''],
];

export default function SingpassDetailsScreen({ onAgree, onCancel }) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.govBar}>
        <Ionicons name="shield-checkmark" size={16} color="#EF3340" />
        <Text style={styles.govText}>A Singapore Government Agency Website</Text>
        <Text style={styles.govLink}>How to identify</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.detailsCard}>
          <View style={styles.redLine} />

          <View style={styles.introArea}>
            <Text style={styles.logo}>singpass</Text>
            <Text style={styles.description}>
              Singpass retrieves personal data from relevant government agencies to pre-fill the relevant fields, making digital transactions faster and more convenient.
            </Text>
            <Text style={styles.serviceText}>
              This digital service, Haloapp, is requesting the following information from Singpass, for the purpose of senior account registration.
            </Text>
          </View>

          <View style={styles.fieldArea}>
            {requestedFields.map(([left, right]) => (
              <View key={left} style={styles.fieldRow}>
                <View style={styles.fieldCell}>
                  <Text style={styles.fieldText}>› {left}</Text>
                </View>
                <View style={styles.fieldCell}>
                  {right ? <Text style={styles.fieldText}>› {right}</Text> : null}
                </View>
              </View>
            ))}
          </View>
        </View>

        <Text style={styles.termsText}>
          Clicking the "I Agree" button permits this digital service to retrieve your data based on the <Text style={styles.termsLink}>Terms of Use</Text>.
        </Text>

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.cancelButton} onPress={onCancel} activeOpacity={0.86}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.agreeButton} onPress={onAgree} activeOpacity={0.86}>
            <Text style={styles.agreeText}>I Agree</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F3FA' },
  govBar: {
    minHeight: 32,
    backgroundColor: '#EFEFEF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 5,
  },
  govText: { color: '#4B5563', fontSize: 11, fontWeight: '700', flexShrink: 1 },
  govLink: { color: '#2563EB', fontSize: 11, fontWeight: '800', textDecorationLine: 'underline' },
  scrollContent: { padding: 16, paddingBottom: 28 },
  detailsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  redLine: { height: 4, backgroundColor: '#D42B2B' },
  introArea: {
    backgroundColor: '#E8E6EA',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
  },
  logo: {
    color: '#EF3340',
    fontSize: 40,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    color: '#4B5563',
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '700',
    marginBottom: 12,
  },
  serviceText: {
    color: '#202124',
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '900',
  },
  fieldArea: { paddingHorizontal: 16, paddingVertical: 14 },
  fieldRow: { flexDirection: 'row', marginBottom: 13 },
  fieldCell: { flex: 1, paddingRight: 8 },
  fieldText: { color: '#374151', fontSize: 15, fontWeight: '800', lineHeight: 21 },
  termsText: {
    color: '#6B7280',
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 22,
    marginHorizontal: 8,
  },
  termsLink: { color: '#C62828', fontWeight: '900' },
  actionRow: {
    flexDirection: 'row',
    gap: 18,
    marginTop: 24,
    paddingHorizontal: 6,
  },
  cancelButton: {
    flex: 1,
    minHeight: 60,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { color: '#6B7280', fontSize: 18, fontWeight: '800' },
  agreeButton: {
    flex: 1,
    minHeight: 60,
    borderRadius: 4,
    backgroundColor: '#C62828',
    alignItems: 'center',
    justifyContent: 'center',
  },
  agreeText: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
});
