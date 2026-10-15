
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { getProfile, type Role } from '@/lib/profiles';

type HomeAction = {
  title: string;
  description: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  route: '/scan' | '/history' | '/teacher' | '/admin' | '/admin-events' | '/admin-attendance' | '/profile';
  primary?: boolean;
};

const roleContent: Record<
  Role,
  {
    eyebrow: string;
    title: string;
    accent: string;
    description: string;
    status: string;
    sectionTitle: string;
    actions: HomeAction[];
    highlights: {
      icon: React.ComponentProps<typeof Ionicons>['name'];
      title: string;
      description: string;
    }[];
  }
> = {
  student: {
    eyebrow: 'CAMPUS CHECK-IN',
    title: 'School Event',
    accent: 'Attendance',
    description:
      'Scan event QR codes to record your attendance. Your records stay organized and easy to review.',
    status: 'READY',
    sectionTitle: 'GET STARTED',
    actions: [
      {
        title: 'Scan QR Code',
        description: 'Record attendance at a school event.',
        icon: 'qr-code-outline',
        route: '/scan',
        primary: true,
      },
      {
        title: 'Attendance History',
        description: 'Review your previous school activities.',
        icon: 'time-outline',
        route: '/history',
      },
      {
        title: 'My Profile',
        description: 'View your account and verification status.',
        icon: 'person-outline',
        route: '/profile',
      },
    ],
    highlights: [
      {
        icon: 'scan-outline',
        title: 'Quick check-in',
        description: 'Scan the QR code provided for your event.',
      },
      {
        icon: 'time-outline',
        title: 'Personal records',
        description: 'Keep track of the events you have attended.',
      },
    ],
  },

  teacher: {
    eyebrow: 'TEACHER WORKSPACE',
    title: 'Manage School',
    accent: 'Events',
    description:
      'Create attendance events, display event QR codes, and monitor student check-ins from one place.',
    status: 'TEACHER',
    sectionTitle: 'EVENT MANAGEMENT',
    actions: [
      {
        title: 'Create & Manage Events',
        description: 'Create events and manage their QR codes.',
        icon: 'calendar-outline',
        route: '/teacher',
        primary: true,
      },
      {
        title: 'Attendance Monitoring',
        description: 'Review attendance records for your events.',
        icon: 'clipboard-outline',
        route: '/history',
      },
      {
        title: 'My Profile',
        description: 'View your account information.',
        icon: 'person-outline',
        route: '/profile',
      },
    ],
    highlights: [
      {
        icon: 'qr-code-outline',
        title: 'Event check-in',
        description: 'Provide QR codes so students can register attendance.',
      },
      {
        icon: 'people-outline',
        title: 'Student attendance',
        description: 'Check recorded attendance through your monitoring page.',
      },
    ],
  },

  admin: {
    eyebrow: 'ADMINISTRATOR WORKSPACE',
    title: 'System',
    accent: 'Overview',
    description:
      'Manage registered accounts, review verification requests, oversee school events, and monitor attendance records.',
    status: 'ADMIN',
    sectionTitle: 'ADMINISTRATION',
    actions: [
      {
        title: 'User Management',
        description: 'Manage accounts and review pending requests.',
        icon: 'people-outline',
        route: '/admin',
        primary: true,
      },
      {
        title: 'Events Management',
        description: 'Review and oversee school attendance events.',
        icon: 'calendar-outline',
        route: '/admin-events',
      },
      {
        title: 'Attendance Records',
        description: 'Review attendance across the system.',
        icon: 'clipboard-outline',
        route: '/admin-attendance',
      },
      {
        title: 'My Profile',
        description: 'View your administrator account information.',
        icon: 'person-outline',
        route: '/profile',
      },
    ],
    highlights: [
      {
        icon: 'shield-checkmark-outline',
        title: 'Account oversight',
        description: 'Review teacher requests and student ID verification.',
      },
      {
        icon: 'stats-chart-outline',
        title: 'Attendance oversight',
        description: 'Access attendance records and event management tools.',
      },
    ],
  },
};

export default function Index() {
  const { user, loading: authLoading } = useAuth();
  const [role, setRole] = useState<Role>('student');
  const [fullName, setFullName] = useState('');
  const [profileLoading, setProfileLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const loadProfile = async () => {
        if (authLoading) return;

        if (!user) {
          if (active) {
            setRole('student');
            setFullName('');
            setProfileLoading(false);
          }
          return;
        }

        setProfileLoading(true);

        try {
          const profile = await getProfile(user.id);

          if (active) {
            setRole(profile?.role ?? 'student');
            setFullName(profile?.full_name?.trim() ?? '');
          }
        } catch (error) {
          console.error('Unable to load home profile:', error);

          if (active) {
            Alert.alert(
              'Unable to load account',
              'Some home page information may be unavailable.'
            );
          }
        } finally {
          if (active) setProfileLoading(false);
        }
      };

      loadProfile();

      return () => {
        active = false;
      };
    }, [user?.id, authLoading])
  );

  if (authLoading || profileLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['top']}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Preparing your workspace...</Text>
      </SafeAreaView>
    );
  }

  const content = roleContent[role] ?? roleContent.student;

  const firstName = fullName
    ? fullName.split(/\s+/)[0]
    : role === 'admin'
      ? 'Administrator'
      : role === 'teacher'
        ? 'Teacher'
        : 'Student';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brandRow}>
          <View style={styles.brandIcon}>
            <Ionicons
              name="qr-code"
              size={25}
              color={COLORS.primaryLight}
            />
          </View>

          <View style={styles.brandTextContainer}>
            <Text style={styles.brandTitle}>QR Attendance</Text>
            <Text style={styles.brandSubtitle}>
              SCHOOL EVENT MANAGEMENT
            </Text>
          </View>

          <View style={styles.onlineBadge}>
            <View style={styles.onlineDot} />
            <Text style={styles.onlineText}>{content.status}</Text>
          </View>
        </View>

        <View style={styles.welcomeCard}>
          <Text style={styles.welcomeLabel}>WELCOME BACK</Text>
          <Text style={styles.welcomeName}>{firstName}</Text>
          <Text style={styles.welcomeDescription}>
            {role === 'student'
              ? 'Your school activities, all in one place.'
              : role === 'teacher'
                ? 'Your event and attendance workspace.'
                : 'Your school attendance control center.'}
          </Text>
        </View>

        <View style={styles.intro}>
          <View style={styles.eyebrowContainer}>
            <View style={styles.eyebrowLine} />
            <Text style={styles.eyebrow}>{content.eyebrow}</Text>
          </View>

          <Text style={styles.mainTitle}>
            {content.title}{'\n'}
            <Text style={styles.titleAccent}>{content.accent}</Text>
          </Text>

          <Text style={styles.description}>{content.description}</Text>
        </View>

        <View style={styles.highlights}>
          {content.highlights.map((item) => (
            <View key={item.title} style={styles.highlightCard}>
              <View style={styles.featureIcon}>
                <Ionicons
                  name={item.icon}
                  size={23}
                  color={COLORS.primaryLight}
                />
              </View>

              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>{item.title}</Text>
                <Text style={styles.featureDescription}>
                  {item.description}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.actions}>
          <Text style={styles.sectionTitle}>{content.sectionTitle}</Text>

          {content.actions.map((action) => (
            <Pressable
              key={action.title}
              accessibilityRole="button"
              accessibilityLabel={action.title}
              onPress={() => router.push(action.route)}
              style={({ pressed }) => [
                styles.actionButton,
                action.primary && styles.primaryButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <View
                style={[
                  styles.actionIcon,
                  action.primary && styles.primaryActionIcon,
                ]}
              >
                <Ionicons
                  name={action.icon}
                  size={22}
                  color={
                    action.primary
                      ? COLORS.white
                      : COLORS.primaryLight
                  }
                />
              </View>

              <View style={styles.actionContent}>
                <Text
                  style={[
                    styles.actionTitle,
                    action.primary && styles.primaryActionTitle,
                  ]}
                >
                  {action.title}
                </Text>
                <Text
                  style={[
                    styles.actionDescription,
                    action.primary && styles.primaryActionDescription,
                  ]}
                >
                  {action.description}
                </Text>
              </View>

              <Ionicons
                name="chevron-forward"
                size={19}
                color={action.primary ? COLORS.white : COLORS.textMuted}
              />
            </Pressable>
          ))}
        </View>

        <View style={styles.footer}>
          <View style={styles.footerLine} />
          <Text style={styles.footerText}>
            QR Attendance · {roleLabel(role)}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function roleLabel(role: Role) {
  if (role === 'admin') return 'Administration';
  if (role === 'teacher') return 'Teacher Workspace';
  return 'School Event Attendance';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
    gap: 12,
  },

  loadingText: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },

  scrollView: {
    flex: 1,
  },

  content: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 30,
  },

  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 22,
    gap: 12,
  },

  brandIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: COLORS.primaryMuted,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  brandTextContainer: {
    flex: 1,
  },

  brandTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: -0.3,
  },

  brandSubtitle: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.1,
    color: COLORS.textMuted,
    marginTop: 4,
  },

  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },

  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.success,
  },

  onlineText: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
  },

  welcomeCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    padding: 17,
    marginBottom: 29,
  },

  welcomeLabel: {
    color: COLORS.primaryLight,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 7,
  },

  welcomeName: {
    color: COLORS.textPrimary,
    fontSize: 23,
    fontWeight: '800',
  },

  welcomeDescription: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 5,
  },

  intro: {
    marginBottom: 24,
  },

  eyebrowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginBottom: 13,
  },

  eyebrowLine: {
    width: 23,
    height: 3,
    borderRadius: 2,
    backgroundColor: COLORS.primary,
  },

  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: COLORS.primaryLight,
  },

  mainTitle: {
    fontSize: 36,
    lineHeight: 43,
    fontWeight: '800',
    letterSpacing: -1.1,
    color: COLORS.textPrimary,
  },

  titleAccent: {
    color: COLORS.primaryLight,
  },

  description: {
    fontSize: 14,
    lineHeight: 23,
    color: COLORS.textSecondary,
    marginTop: 14,
    maxWidth: 390,
  },

  highlights: {
    gap: 11,
    marginBottom: 29,
  },

  highlightCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 17,
    padding: 14,
  },

  featureIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: COLORS.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },

  featureContent: {
    flex: 1,
  },

  featureTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },

  featureDescription: {
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.textSecondary,
  },

  actions: {
    gap: 11,
  },

  sectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: COLORS.textMuted,
    marginBottom: 3,
  },

  actionButton: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 13,
    paddingVertical: 12,
    borderRadius: 15,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  primaryButton: {
    backgroundColor: COLORS.primaryDark,
    borderColor: COLORS.primary,
  },

  actionIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: COLORS.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },

  primaryActionIcon: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },

  actionContent: {
    flex: 1,
    gap: 4,
  },

  actionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },

  primaryActionTitle: {
    color: COLORS.white,
  },

  actionDescription: {
    fontSize: 11,
    lineHeight: 16,
    color: COLORS.textSecondary,
  },

  primaryActionDescription: {
    color: COLORS.white,
  },

  buttonPressed: {
    opacity: 0.72,
  },

  footer: {
    alignItems: 'center',
    marginTop: 29,
    gap: 12,
  },

  footerLine: {
    width: 36,
    height: 2,
    borderRadius: 2,
    backgroundColor: COLORS.border,
  },

  footerText: {
    fontSize: 10,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
});
