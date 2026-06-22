import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
} from 'react-native';
import Header from '../components/Header';

export default function LoginScreen({
  onLogin,
  loginError,
  // onForgot, // Uncomment to re-enable Forgot Password
  onSignUp,
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handlePress = () => {
    onLogin({ email: email.trim(), password });
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Haloapp" subtitle="Safe check-ins for seniors" />

      <View style={styles.content}>
        <Text style={styles.title}>Sign In</Text>

        <Text style={styles.subtitle}>
          Enter your Email and Password to continue
        </Text>

        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor="#000000"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          placeholderTextColor="#000000"
          secureTextEntry
        />

        {/* Forgot Password link — uncomment to re-enable
        <TouchableOpacity onPress={onForgot} style={styles.forgotLink}>
          <Text style={styles.forgotText}>Forgot password?</Text>
        </TouchableOpacity>
        */}

        {loginError ? (
          <Text style={styles.errorText}>{loginError}</Text>
        ) : null}

        <TouchableOpacity
          style={[
            styles.primaryButton,
            (!email.trim() || !password) && styles.disabledButton,
          ]}
          onPress={handlePress}
          disabled={!email.trim() || !password}
        >
          <Text style={styles.primaryButtonText}>Login</Text>
        </TouchableOpacity>

        <View style={styles.signUpContainer}>
          <Text style={styles.signUpLabel}>
            Haven't any account?{' '}
          </Text>

          <TouchableOpacity onPress={onSignUp} activeOpacity={0.7}>
            <Text style={styles.signUpLinkText}>Sign Up</Text>
          </TouchableOpacity>
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
    paddingHorizontal: 22,
  },

  title: {
    fontSize: 40,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 12,
  },

  subtitle: {
    fontSize: 22,
    color: '#4B5563',
    marginBottom: 32,
    lineHeight: 28,
  },

  input: {
    width: '100%',
    minHeight: 62,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    fontSize: 18,
    color: '#111827',
    marginBottom: 16,
  },

  // forgotLink: { // Uncomment to re-enable Forgot Password
  //   alignSelf: 'flex-end',
  //   marginBottom: 14,
  // },

  // forgotText: {
  //   color: '#2563EB',
  //   fontWeight: '700',
  //   fontSize: 22,
  // },

  errorText: {
    color: '#DC2626',
    marginBottom: 14,
    textAlign: 'center',
    fontSize: 16,
  },

  primaryButton: {
    minHeight: 68,
    borderRadius: 18,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    marginTop: 8,
  },

  disabledButton: {
    opacity: 0.5,
  },

  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
  },

  signUpContainer: {
    marginTop: 24,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
  },

  signUpLabel: {
    fontSize: 22,
    color: '#4B5563',
    fontWeight: '400',
  },

  signUpLinkText: {
    fontSize: 22,
    color: '#2563EB',
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});