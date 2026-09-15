import { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { getProfile, updateProfile, Profile } from '../../lib/profiles';
import { supabase } from '../../lib/supabase';

export default function ProfileScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [draftName, setDraftName] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const user = supabase.auth.getUser;

  const loadProfile = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return;
    }

    const p = await getProfile(user.id);

    setProfile(p);
    setDraftName(p?.full_name ?? '');
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile])
  );

  const handleSaveName = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return;
    }

    if (!draftName.trim()) {
      Alert.alert('Error', 'Please enter your name.');
      return;
    }

    setSaving(true);

    const { error } = await updateProfile(user.id, {
      full_name: draftName.trim(),
    });

    setSaving(false);

    if (error) {
      Alert.alert('Error', error);
    } else {
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              full_name: draftName.trim(),
            }
          : prev
      );

      setEditing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Profile</Text>

        <Text style={styles.label}>Name</Text>

        {editing ? (
          <View style={styles.nameEditRow}>
            <TextInput
              style={styles.input}
              value={draftName}
              onChangeText={setDraftName}
              placeholder="Enter your name"
            />

            <Pressable
              style={styles.saveButton}
              onPress={handleSaveName}
              disabled={saving}
            >
              <Text style={styles.saveText}>
                {saving ? 'Saving...' : 'Save'}
              </Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={() => setEditing(true)}
            style={styles.nameRow}
          >
            <Text style={styles.value}>
              {profile?.full_name || 'Tap to add your name'}
            </Text>

            <Text style={styles.editHint}>Edit</Text>
          </Pressable>
        )}

        <Text style={styles.label}>Role</Text>

        {profile?.role === 'teacher' ? (
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>Teacher</Text>
          </View>
        ) : (
          <View
            style={[
              styles.roleBadge,
              styles.roleBadgeStudent,
            ]}
          >
            <Text style={styles.roleBadgeText}>Student</Text>
          </View>
        )}

        <Text style={styles.label}>Email</Text>

        <Text style={styles.value}>
          {profile?.email || 'Loading...'}
        </Text>

        <Text style={styles.label}>User ID</Text>

        <Text style={styles.userId}>
          {profile?.id || 'Loading...'}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#25292e',
    padding: 20,
  },

  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
  },

  title: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 20,
  },

  label: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 15,
    marginBottom: 6,
  },

  value: {
    fontSize: 16,
    color: '#222',
  },

  userId: {
    fontSize: 12,
    color: '#666',
  },

  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
  },

  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
    padding: 12,
  },

  nameEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  editHint: {
    color: '#777',
    fontSize: 14,
  },

  saveButton: {
    backgroundColor: '#ffd33d',
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 8,
  },

  saveText: {
    fontWeight: 'bold',
    color: '#000',
  },

  roleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#ffd33d',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 20,
  },

  roleBadgeStudent: {
    backgroundColor: '#eee',
  },

  roleBadgeText: {
    fontWeight: 'bold',
    color: '#000',
  },
});