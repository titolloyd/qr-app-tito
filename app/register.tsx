
import { useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

import { signUp, type RequestedRole } from '@/lib/auth';
import { COLORS } from '@/constants/colors';
import AppButton from '@/components/AppButton';
import Header from '@/components/Header';

export default function RegisterScreen() {
  const router = useRouter();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accountType, setAccountType] = useState<RequestedRole>('student');
  const [schoolId, setSchoolId] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    setError('');

    if (!fullName.trim()) {
      setError('Please enter your full name.');
      return;
    }

    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    if (accountType === 'student' && !schoolId.trim()) {
      setError('Please enter your school ID.');
      return;
    }

    if (!password) {
      setError('Please enter a password.');
      return;
    }

    if (password.length < 6) {
      setError('Your password must contain at least 6 characters.');
      return;
    }

    setLoading(true);

    try {
      const { data, error: authError } = await signUp(
        email.trim(),
        password,
        {
          full_name: fullName.trim(),
          requested_role: accountType,
          school_id: accountType === 'student' ? schoolId.trim() : undefined,
        }
      );

      if (authError) {
  const errorMessage = authError.message || '';

  if (
    errorMessage.toLowerCase().includes('duplicate key') ||
    errorMessage.toLowerCase().includes('school_id') ||
    errorMessage.toLowerCase().includes('unique constraint')
  ) {
    setError(
      'This school ID is already registered. Please check your school ID and try again.'
    );
  } else if (
    errorMessage.toLowerCase().includes('already registered') ||
    errorMessage.toLowerCase().includes('user already exists')
  ) {
    setError(
      'An account with this email already exists. Please sign in instead.'
    );
  } else {
    setError(errorMessage || 'Unable to create your account.');
  }
} else {
  // Always show the registration confirmation screen.
  // The root layout handles navigation if a session is established.
  setSuccess(true);
}
    } catch (err: any) {
      setError(err?.message || 'Unable to create your account.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.successCard}>
          <View style={styles.successIcon}>
            <Ionicons
              name="checkmark-circle-outline"
              size={44}
              color={COLORS.success}
            />
          </View>

          <Text style={styles.title}>Account Created</Text>

          <Text style={styles.subtitle}>
            {accountType === 'teacher'
              ? 'Your teacher account request has been submitted. An administrator must approve it before you can use teacher features.'
              : 'Your account has been created. Your school ID is awaiting administrator verification.'}
            {' '}If email confirmation is enabled, check your inbox before signing in.
          </Text>

          <AppButton
            theme="primary"
            title="Go to Login"
            icon="log-in-outline"
            onPress={() => router.replace('/login')}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Header title="QR Attendance" />

            <View style={styles.card}>
              <Text style={styles.eyebrow}>GET STARTED</Text>

              <Text style={styles.title}>Create Account</Text>

              <Text style={styles.subtitle}>
                Register to start using QR Attendance.
              </Text>

              <Text style={styles.label}>Full Name</Text>

              <View style={styles.inputWrapper}>
                <Ionicons
                  name="person-outline"
                  size={19}
                  color={COLORS.textSecondary}
                />

                <TextInput
                  style={styles.input}
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="Enter your full name"
                  placeholderTextColor={COLORS.textMuted}
                  autoCapitalize="words"
                  editable={!loading}
                  returnKeyType="next"
                />
              </View>

              <Text style={styles.label}>Email Address</Text>

              <View style={styles.inputWrapper}>
                <Ionicons
                  name="mail-outline"
                  size={19}
                  color={COLORS.textSecondary}
                />

                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="your.email@school.edu"
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading}
                  returnKeyType="next"
                />
              </View>

              <Text style={styles.label}>Account Type</Text>

              <View style={styles.accountTypeChoices}>
                <Pressable
                  style={[styles.accountTypeChoice, accountType === 'student' && styles.accountTypeChoiceActive]}
                  onPress={() => setAccountType('student')}
                  disabled={loading}
                >
                  <Ionicons name="school-outline" size={18} color={accountType === 'student' ? COLORS.primaryLight : COLORS.textSecondary} />
                  <Text style={[styles.accountTypeChoiceText, accountType === 'student' && styles.accountTypeChoiceTextActive]}>Student</Text>
                </Pressable>
                <Pressable
                  style={[styles.accountTypeChoice, accountType === 'teacher' && styles.accountTypeChoiceActive]}
                  onPress={() => setAccountType('teacher')}
                  disabled={loading}
                >
                  <Ionicons name="person-circle-outline" size={18} color={accountType === 'teacher' ? COLORS.primaryLight : COLORS.textSecondary} />
                  <Text style={[styles.accountTypeChoiceText, accountType === 'teacher' && styles.accountTypeChoiceTextActive]}>Teacher</Text>
                </Pressable>
              </View>

              {accountType === 'student' ? (
                <>
                  <Text style={styles.label}>School ID Number</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="id-card-outline" size={19} color={COLORS.textSecondary} />
                    <TextInput
                      style={styles.input}
                      value={schoolId}
                      onChangeText={setSchoolId}
                      placeholder="Enter your school ID"
                      placeholderTextColor={COLORS.textMuted}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      editable={!loading}
                      returnKeyType="next"
                    />
                  </View>
                </>
              ) : (
                <View style={styles.accountType}>
                  <Ionicons name="shield-checkmark-outline" size={17} color={COLORS.primary} />
                  <Text style={styles.accountTypeText}>Teacher accounts require administrator approval before teacher features become available.</Text>
                </View>
              )}

              <Text style={styles.label}>Password</Text>

              <View style={styles.inputWrapper}>
                <Ionicons
                  name="lock-closed-outline"
                  size={19}
                  color={COLORS.textSecondary}
                />

                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="At least 6 characters"
                  placeholderTextColor={COLORS.textMuted}
                  secureTextEntry
                  editable={!loading}
                  returnKeyType="done"
                  onSubmitEditing={handleRegister}
                />
              </View>

              <View style={styles.accountType}>
                <Ionicons
                  name="information-circle-outline"
                  size={17}
                  color={COLORS.primary}
                />
                <Text style={styles.accountTypeText}>
                  {accountType === 'student'
                    ? 'Your school ID will remain pending until an administrator verifies it.'
                    : 'Your request will remain pending until an administrator approves it.'}
                </Text>
              </View>

              {error ? (
                <View style={styles.errorBox}>
                  <Ionicons
                    name="alert-circle-outline"
                    size={18}
                    color={COLORS.error}
                  />
                  <Text style={styles.error}>{error}</Text>
                </View>
              ) : null}

              <View style={styles.buttonContainer}>
                {loading ? (
                  <ActivityIndicator
                    size="large"
                    color={COLORS.primary}
                  />
                ) : (
                  <AppButton
                    theme="primary"
                    title="Create Account"
                    icon="person-add-outline"
                    onPress={handleRegister}
                  />
                )}
              </View>

              <View style={styles.footer}>
                <Text style={styles.footerText}>
                  Already have an account?
                </Text>

                <Pressable
                  onPress={() => router.replace('/login')}
                  disabled={loading}
                >
                  <Text style={styles.loginText}>Sign In</Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 22,
  },

  keyboardView: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 18,
  },

  card: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 22,
    padding: 22,
    marginBottom: 12,
  },

  successCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 22,
    padding: 24,
    alignItems: 'center',
  },

  successIcon: {
    width: 76,
    height: 76,
    borderRadius: 25,
    backgroundColor: COLORS.successBackground,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },

  eyebrow: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.8,
    marginBottom: 8,
  },

  title: {
    color: COLORS.textPrimary,
    fontSize: 27,
    fontWeight: '800',
    letterSpacing: -0.5,
    textAlign: 'center',
  },

  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 18,
  },

  label: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 15,
    marginBottom: 8,
  },

  inputWrapper: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: COLORS.inputBackground,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    borderRadius: 14,
    paddingHorizontal: 14,
  },

  input: {
    flex: 1,
    minHeight: 50,
    color: COLORS.textPrimary,
    fontSize: 14,
    paddingVertical: 10,
  },

  accountTypeChoices: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },

  accountTypeChoice: {
    flex: 1,
    minHeight: 48,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.inputBackground,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  accountTypeChoiceActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryMuted,
  },

  accountTypeChoiceText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },

  accountTypeChoiceTextActive: {
    color: COLORS.primaryLight,
  },

  accountType: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.primaryMuted,
    borderRadius: 11,
    padding: 12,
    marginTop: 17,
  },

  accountTypeText: {
    flex: 1,
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    backgroundColor: COLORS.errorBackground,
    borderWidth: 1,
    borderColor: COLORS.error,
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
  },

  error: {
    flex: 1,
    color: COLORS.error,
    fontSize: 13,
    lineHeight: 19,
  },

  buttonContainer: {
    marginTop: 24,
  },

  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 23,
  },

  footerText: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },

  loginText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '800',
  },
});
