import { useEffect, useState } from 'react';
import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { getProfile, type Role } from '@/lib/profiles';

export default function TabLayout() {
  const { user } = useAuth();

  const [role, setRole] =
    useState<Role | null>(null);

  useEffect(() => {
    let active = true;

    async function loadRole() {
      if (!user?.id) {
        setRole(null);
        return;
      }

      const profile =
        await getProfile(user.id);

      if (active) {
        setRole(
          profile?.role ?? 'student'
        );
      }
    }

    loadRole();

    return () => {
      active = false;
    };
  }, [user?.id]);

  const isStudent =
    role === 'student';

  const isTeacher =
    role === 'teacher';

  const isAdmin =
    role === 'admin';

  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor:
            COLORS.background,
        },
        headerTintColor:
          COLORS.textPrimary,
        headerTitleStyle: {
          fontWeight: '700',
        },
        tabBarActiveTintColor:
          COLORS.primary,
        tabBarInactiveTintColor:
          COLORS.textSecondary,
        tabBarStyle: {
          backgroundColor:
            COLORS.card,
          borderTopWidth: 1,
          borderTopColor:
            COLORS.border,
          elevation: 0,
          shadowOpacity: 0,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({
            color,
            size,
          }) => (
            <Ionicons
              name="home-outline"
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="scan"
        options={{
          title: 'Scan',
          href: isStudent
            ? undefined
            : null,
          tabBarIcon: ({
            color,
            size,
          }) => (
            <Ionicons
              name="qr-code-outline"
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          href: isStudent
            ? undefined
            : null,
          tabBarIcon: ({
            color,
            size,
          }) => (
            <Ionicons
              name="time-outline"
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="teacher"
        options={{
          title: 'Teacher',
          href: isTeacher
            ? undefined
            : null,
          tabBarIcon: ({
            color,
            size,
          }) => (
            <Ionicons
              name="school-outline"
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="admin"
        options={{
          title: 'Admin',
          href: isAdmin
            ? undefined
            : null,
          tabBarIcon: ({
            color,
            size,
          }) => (
            <Ionicons
              name="shield-checkmark-outline"
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({
            color,
            size,
          }) => (
            <Ionicons
              name="person-outline"
              size={size}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}