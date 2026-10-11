import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { signUp } from '../lib/auth';
import { COLORS } from '@/constants/colors';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function RegisterScreen() {
  const router = useRouter();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

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
      setError('Please enter your email.');
      return;
    }

    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setLoading(true);

    const { data, error: authError } =
      await signUp(
        email.trim(),
        password,
        {
          full_name: fullName.trim(),
          role: 'student',
        }
      );

    setLoading(false);

    if (authError) {
      setError(authError.message);
    } else if (data.session) {
      router.replace('/(tabs)');
    } else {
      setSuccess(true);
    }
  };

  if (success) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>
            Account Created
          </Text>

          <Text style={styles.message}>
            Your account has been created successfully.
            Please check your email if confirmation is required.
          </Text>

          <Pressable
            style={styles.button}
            onPress={() =>
              router.replace('/login')
            }
          >
            <Text style={styles.buttonText}>
              Go to Login
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>
          Create Account
        </Text>

        <Text style={styles.label}>
          Full Name
        </Text>

        <TextInput
          style={styles.input}
          value={fullName}
          onChangeText={setFullName}
          placeholder="Enter your full name"
          autoCapitalize="words"
        />

        <Text style={styles.label}>
          Email
        </Text>

        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="Enter your email"
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <Text style={styles.label}>
          Password
        </Text>

        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="Enter your password"
          secureTextEntry
        />

        <Text style={styles.accountType}>
          New accounts are registered as Student.
        </Text>

        {error ? (
          <Text style={styles.error}>
            {error}
          </Text>
        ) : null}

        <Pressable
          style={styles.button}
          onPress={handleRegister}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading
              ? 'Creating Account...'
              : 'Create Account'}
          </Text>
        </Pressable>

        <Pressable
          style={styles.loginButton}
          onPress={() =>
            router.replace('/login')
          }
        >
          <Text style={styles.loginText}>
            Already have an account? Login
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },

  card: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 20,
  },

  title: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },

  message: {
    fontSize: 15,
    color: COLORS.textSecondary,
    lineHeight: 21,
    marginBottom: 20,
  },

  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 6,
    marginTop: 10,
  },

  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    backgroundColor: COLORS.card,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.textPrimary,
  },

  accountType: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 12,
  },

  error: {
    fontSize: 14,
    color: '#D32F2F',
    marginTop: 12,
  },

  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 20,
  },

  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },

  loginButton: {
    alignItems: 'center',
    marginTop: 18,
  },

  loginText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
});