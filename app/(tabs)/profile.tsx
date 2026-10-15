import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

import { COLORS } from '@/constants/colors';
import AppButton from '@/components/AppButton';
import { getProfile, updateProfile, type Profile } from '@/lib/profiles';
import { supabase } from '@/lib/supabase';
import { signOut } from '@/lib/auth';
import {
  createProfileChangeRequest,
  getMyProfileChangeRequests,
  type ProfileChangeRequest,
  type ProfileChangeType,
} from '@/lib/profile-change-requests';

export default function ProfileScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [emailDraft, setEmailDraft] = useState('');
  const [passwordDraft, setPasswordDraft] = useState('');
  const [confirmPasswordDraft, setConfirmPasswordDraft] = useState('');
  const [requestType, setRequestType] = useState<ProfileChangeType>('name');
  const [requestValue, setRequestValue] = useState('');
  const [requestReason, setRequestReason] = useState('');
  const [requests, setRequests] = useState<ProfileChangeRequest[]>([]);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setProfile(null);
        return;
      }
      const [nextProfile, ownRequests] = await Promise.all([
        getProfile(user.id),
        getMyProfileChangeRequests().catch(() => [] as ProfileChangeRequest[]),
      ]);
      setProfile(nextProfile);
      setNameDraft(nextProfile?.full_name ?? '');
      setEmailDraft(user.email ?? nextProfile?.email ?? '');
      setRequests(ownRequests);
    } catch (error: any) {
      Alert.alert('Unable to load profile', error?.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadProfile(); }, [loadProfile]));

  const saveName = async () => {
    Keyboard.dismiss();
    const nextName = nameDraft.trim();
    if (!nextName) return Alert.alert('Name required', 'Enter your full name.');
    if (!profile || profile.role === 'student') return Alert.alert('Not allowed', 'Students must request name corrections from an administrator.');
    setBusy(true);
    try {
      const { error } = await updateProfile(profile.id, { full_name: nextName });
      if (error) throw new Error(error);
      setProfile({ ...profile, full_name: nextName });
      setEditingName(false);
      Alert.alert('Profile updated', 'Your name has been updated.');
    } catch (error: any) {
      Alert.alert('Unable to save name', error?.message || 'Please try again.');
    } finally { setBusy(false); }
  };

  const saveEmail = async () => {
    Keyboard.dismiss();
    const nextEmail = emailDraft.trim().toLowerCase();
    if (!nextEmail || !/^\S+@\S+\.\S+$/.test(nextEmail)) return Alert.alert('Invalid email', 'Enter a valid email address.');
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: nextEmail });
      if (error) throw error;
      Alert.alert('Email update requested', 'If email confirmation is enabled, open the verification message sent by Supabase to complete the change. Your profile will update after confirmation.');
      await loadProfile();
    } catch (error: any) {
      Alert.alert('Unable to update email', error?.message || 'Please try again.');
    } finally { setBusy(false); }
  };

  const savePassword = async () => {
    Keyboard.dismiss();
    if (passwordDraft.length < 8) return Alert.alert('Password too short', 'Use at least 8 characters for your new password.');
    if (passwordDraft !== confirmPasswordDraft) return Alert.alert('Passwords do not match', 'Re-enter the same password in both fields.');
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: passwordDraft });
      if (error) throw error;
      setPasswordDraft('');
      setConfirmPasswordDraft('');
      Alert.alert('Password updated', 'Your password has been changed successfully.');
    } catch (error: any) {
      Alert.alert('Unable to update password', error?.message || 'Please try again.');
    } finally { setBusy(false); }
  };

  const submitChangeRequest = async () => {
    Keyboard.dismiss();
    if (!profile || profile.role !== 'student') return;
    const value = requestValue.trim();
    const reason = requestReason.trim();
    if (!value) return Alert.alert('Requested value required', 'Enter the corrected name or School ID.');
    if (!reason) return Alert.alert('Reason required', 'Briefly explain why this correction is needed.');
    if (requests.some(r => r.status === 'pending' && r.request_type === requestType)) {
      return Alert.alert('Request already pending', 'You already have a pending request of this type. Wait for an administrator to review it.');
    }
    setBusy(true);
    try {
      await createProfileChangeRequest({
        userId: profile.id,
        requestType,
        currentValue: requestType === 'name' ? profile.full_name : profile.school_id,
        requestedValue: value,
        reason,
      });
      setRequestValue('');
      setRequestReason('');
      await loadProfile();
      Alert.alert('Request submitted', 'Your correction request has been sent to the administrator.');
    } catch (error: any) {
      Alert.alert('Unable to submit request', error?.message || 'Please try again.');
    } finally { setBusy(false); }
  };

  const handleSignOut = async () => {
    setBusy(true);
    try {
      const { error } = await signOut();
      if (error) throw error;
      // app/_layout.tsx redirects to /login when the session becomes null.
      // Avoid a second navigation action here to prevent a route replacement race.
    } catch (error: any) {
      Alert.alert('Unable to sign out', error?.message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const role = profile?.role ?? 'student';
  const roleLabel = role === 'admin' ? 'Administrator' : role === 'teacher' ? 'Teacher' : 'Student';
  const statusColor = (status: string) => status === 'approved' ? COLORS.success : status === 'rejected' ? COLORS.error : COLORS.info;

  if (loading) return <SafeAreaView style={styles.centered} edges={['top']}><ActivityIndicator size="large" color={COLORS.primary} /><Text style={styles.muted}>Loading profile...</Text></SafeAreaView>;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}>
        <View style={styles.pageHeader}>
          <Text style={styles.eyebrow}>ACCOUNT</Text>
          <Text style={styles.title}>My Profile</Text>
          <Text style={styles.subtitle}>Manage your account information and security.</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.identity}>
            <View style={styles.avatar}><Ionicons name="person" size={31} color={COLORS.primaryLight} /></View>
            <View style={styles.identityCopy}>
              <Text style={styles.displayName}>{profile?.full_name || 'Your Profile'}</Text>
              <Text style={styles.emailText}>{profile?.email || 'Email unavailable'}</Text>
              <View style={[styles.roleBadge, role === 'admin' ? styles.adminBadge : role === 'teacher' ? styles.teacherBadge : styles.studentBadge]}><Text style={styles.roleBadgeText}>{roleLabel}</Text></View>
            </View>
          </View>
          <View style={styles.divider} />
          <Text style={styles.sectionTitle}>Personal Information</Text>

          {role === 'student' ? (
            <View style={styles.notice}>
              <Ionicons name="information-circle-outline" size={20} color={COLORS.info} />
              <Text style={styles.noticeText}>Your name and School ID are protected. Submit a correction request below if either detail needs to be changed.</Text>
            </View>
          ) : null}

          {profile?.requested_role === 'teacher' ? (
            <View style={styles.notice}><Ionicons name="shield-checkmark-outline" size={19} color={COLORS.info} /><Text style={styles.noticeText}>Teacher request: {profile.approval_status}. {profile.approval_status === 'approved' ? 'Teacher access is approved.' : profile.approval_status === 'rejected' ? 'Contact an administrator if you believe this is an error.' : 'Teacher features require administrator approval.'}</Text></View>
          ) : role === 'student' ? (
            <View style={styles.notice}><Ionicons name="card-outline" size={19} color={COLORS.info} /><Text style={styles.noticeText}>School ID: {profile?.school_id || 'Not provided'} · Status: {(profile?.school_id_status || 'not_required').replace('_', ' ')}</Text></View>
          ) : null}

          <Text style={styles.label}>Full Name</Text>
          {role !== 'student' && editingName ? (
            <View style={styles.inlineForm}>
              <TextInput style={[styles.input, styles.flexInput]} value={nameDraft} onChangeText={setNameDraft} placeholder="Full name" placeholderTextColor={COLORS.textMuted} autoCapitalize="words" editable={!busy} returnKeyType="done" onSubmitEditing={saveName} />
              <Pressable style={styles.iconButton} onPress={saveName} disabled={busy} accessibilityLabel="Save name"><Ionicons name="checkmark" size={22} color={COLORS.success} /></Pressable>
              <Pressable style={styles.iconButton} onPress={() => { setNameDraft(profile?.full_name ?? ''); setEditingName(false); }} disabled={busy} accessibilityLabel="Cancel name edit"><Ionicons name="close" size={22} color={COLORS.textSecondary} /></Pressable>
            </View>
          ) : (
            <View style={styles.infoRow}>
              <Text style={styles.value}>{profile?.full_name || 'Not provided'}</Text>
              {role !== 'student' ? <Pressable style={styles.editAction} onPress={() => setEditingName(true)}><Ionicons name="create-outline" size={17} color={COLORS.primary} /><Text style={styles.editHint}>Edit</Text></Pressable> : <Text style={styles.lockHint}><Ionicons name="lock-closed" size={12} color={COLORS.textMuted} /> Locked</Text>}
            </View>
          )}

          {role === 'student' ? (
            <>
              <Text style={styles.label}>School ID</Text>
              <View style={styles.infoRow}>
                <Ionicons name="card-outline" size={18} color={COLORS.textSecondary} />
                <Text style={styles.value}>{profile?.school_id || 'Not provided'}</Text>
              </View>
            </>
          ) : null}
          <Text style={styles.label}>Account Role</Text>
          <View style={styles.infoRow}><Ionicons name="shield-checkmark-outline" size={18} color={COLORS.textSecondary} /><Text style={styles.value}>{roleLabel}</Text></View>
          <Text style={styles.label}>Account ID</Text>
          <View style={styles.userIdContainer}><Text style={styles.userId} selectable>{profile?.id || 'Unavailable'}</Text></View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Email Address</Text>
          <Text style={styles.helper}>Changing your email may require confirmation from your new email inbox.</Text>
          <TextInput style={styles.input} value={emailDraft} onChangeText={setEmailDraft} placeholder="name@example.com" placeholderTextColor={COLORS.textMuted} autoCapitalize="none" keyboardType="email-address" autoComplete="email" editable={!busy} />
          <AppButton title={busy ? 'Please wait...' : 'Update Email'} icon="mail-outline" onPress={saveEmail} loading={busy} />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Change Password</Text>
          <Text style={styles.helper}>Use at least 8 characters. Keep your password private.</Text>
          <Text style={styles.label}>New Password</Text>
          <TextInput style={styles.input} value={passwordDraft} onChangeText={setPasswordDraft} placeholder="Enter new password" placeholderTextColor={COLORS.textMuted} secureTextEntry autoCapitalize="none" autoComplete="new-password" editable={!busy} />
          <Text style={styles.label}>Confirm New Password</Text>
          <TextInput style={styles.input} value={confirmPasswordDraft} onChangeText={setConfirmPasswordDraft} placeholder="Re-enter new password" placeholderTextColor={COLORS.textMuted} secureTextEntry autoCapitalize="none" autoComplete="new-password" editable={!busy} onSubmitEditing={savePassword} />
          <AppButton title={busy ? 'Please wait...' : 'Update Password'} icon="key-outline" theme="outline" onPress={savePassword} loading={busy} />
        </View>

        {role === 'student' ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Request a Profile Correction</Text>
            <Text style={styles.helper}>Submit a request if your registered name or School ID needs to be corrected. An administrator must review it before your profile changes.</Text>
            <Text style={styles.label}>What needs correcting?</Text>
            <View style={styles.segmentRow}>
              <Pressable style={[styles.segment, requestType === 'name' && styles.segmentActive]} onPress={() => { setRequestType('name'); setRequestValue(''); }}><Text style={[styles.segmentText, requestType === 'name' && styles.segmentTextActive]}>Full Name</Text></Pressable>
              <Pressable style={[styles.segment, requestType === 'school_id' && styles.segmentActive]} onPress={() => { setRequestType('school_id'); setRequestValue(''); }}><Text style={[styles.segmentText, requestType === 'school_id' && styles.segmentTextActive]}>School ID</Text></Pressable>
            </View>
            <Text style={styles.label}>Current Value</Text>
            <View style={styles.readOnlyValue}><Text style={styles.value}>{requestType === 'name' ? profile?.full_name || 'Not provided' : profile?.school_id || 'Not provided'}</Text></View>
            <Text style={styles.label}>Requested {requestType === 'name' ? 'Full Name' : 'School ID'}</Text>
            <TextInput style={styles.input} value={requestValue} onChangeText={setRequestValue} placeholder={requestType === 'name' ? 'Enter correct full name' : 'Enter correct School ID'} placeholderTextColor={COLORS.textMuted} autoCapitalize={requestType === 'name' ? 'words' : 'none'} editable={!busy} />
            <Text style={styles.label}>Reason for Request</Text>
            <TextInput style={[styles.input, styles.reasonInput]} value={requestReason} onChangeText={setRequestReason} placeholder="Explain why this correction is needed" placeholderTextColor={COLORS.textMuted} multiline textAlignVertical="top" editable={!busy} />
            <AppButton title={busy ? 'Submitting...' : 'Submit Correction Request'} icon="paper-plane-outline" onPress={submitChangeRequest} loading={busy} />
            <View style={styles.divider} />
            <Text style={styles.sectionTitle}>My Correction Requests</Text>
            {requests.length === 0 ? <Text style={styles.helper}>You have not submitted any correction requests yet.</Text> : requests.map((item) => (
              <View key={item.id} style={styles.requestItem}>
                <View style={styles.requestTop}><Text style={styles.requestTitle}>{item.request_type === 'name' ? 'Name correction' : 'School ID correction'}</Text><Text style={[styles.status, { color: statusColor(item.status) }]}>{item.status.toUpperCase()}</Text></View>
                <Text style={styles.requestDetail}>Requested: {item.requested_value}</Text>
                <Text style={styles.requestDetail}>Submitted: {new Date(item.created_at).toLocaleDateString()}</Text>
                {item.admin_note ? <Text style={styles.helper}>Admin note: {item.admin_note}</Text> : null}
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.logoutContainer}>
          <AppButton theme="outline" title={busy ? 'Please wait...' : 'Sign Out'} icon="log-out-outline" onPress={handleSignOut} loading={busy} />
          <Text style={styles.footerNote}>QR Attendance · Account Settings</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: { flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center', padding: 24 },
  content: { flexGrow: 1, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 32, gap: 16 },
  pageHeader: { marginBottom: 2 },
  eyebrow: { color: COLORS.primaryLight, fontSize: 11, fontWeight: '800', letterSpacing: 1.8, marginBottom: 7 },
  title: { color: COLORS.textPrimary, fontSize: 29, fontWeight: '800', letterSpacing: -0.6 },
  subtitle: { color: COLORS.textSecondary, fontSize: 14, lineHeight: 21, marginTop: 6 },
  card: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 20, padding: 17, gap: 8 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  avatar: { width: 62, height: 62, borderRadius: 21, backgroundColor: COLORS.primaryMuted, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  identityCopy: { flex: 1, minWidth: 0, gap: 3 },
  displayName: { color: COLORS.textPrimary, fontSize: 19, fontWeight: '800' },
  emailText: { color: COLORS.textSecondary, fontSize: 12 },
  roleBadge: { alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 9, paddingVertical: 4, marginTop: 4 },
  studentBadge: { backgroundColor: COLORS.infoBackground },
  teacherBadge: { backgroundColor: COLORS.successBackground },
  adminBadge: { backgroundColor: COLORS.primaryMuted },
  roleBadgeText: { color: COLORS.primaryLight, fontSize: 10, fontWeight: '800' },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 7 },
  sectionTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '800', marginBottom: 2 },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, backgroundColor: COLORS.infoBackground, borderRadius: 12, padding: 11, marginBottom: 4 },
  noticeText: { flex: 1, color: COLORS.textSecondary, fontSize: 12, lineHeight: 18 },
  label: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '700', marginTop: 5 },
  infoRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: COLORS.inputBackground, borderWidth: 1, borderColor: COLORS.inputBorder, borderRadius: 11, paddingHorizontal: 12, paddingVertical: 10 },
  value: { flex: 1, minWidth: 0, color: COLORS.textPrimary, fontSize: 13, lineHeight: 19 },
  editAction: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 6 },
  editHint: { color: COLORS.primary, fontSize: 12, fontWeight: '700' },
  lockHint: { color: COLORS.textMuted, fontSize: 11 },
  inlineForm: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  flexInput: { flex: 1 },
  input: { minHeight: 46, borderRadius: 11, borderWidth: 1, borderColor: COLORS.inputBorder, backgroundColor: COLORS.inputBackground, color: COLORS.textPrimary, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14 },
  iconButton: { width: 40, height: 44, borderRadius: 10, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  userIdContainer: { borderRadius: 10, backgroundColor: COLORS.inputBackground, borderWidth: 1, borderColor: COLORS.inputBorder, padding: 11 },
  userId: { color: COLORS.textSecondary, fontSize: 11, lineHeight: 17 },
  helper: { color: COLORS.textSecondary, fontSize: 12, lineHeight: 18 },
  segmentRow: { flexDirection: 'row', gap: 8 },
  segment: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.inputBackground, paddingHorizontal: 8 },
  segmentActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryMuted },
  segmentText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '700' },
  segmentTextActive: { color: COLORS.primaryLight },
  readOnlyValue: { borderRadius: 10, backgroundColor: COLORS.inputBackground, borderWidth: 1, borderColor: COLORS.inputBorder, padding: 11, minHeight: 43, justifyContent: 'center' },
  reasonInput: { minHeight: 88 },
  requestItem: { borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.inputBackground, borderRadius: 12, padding: 12, gap: 5, marginTop: 7 },
  requestTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  requestTitle: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '800', flex: 1 },
  status: { fontSize: 10, fontWeight: '900', letterSpacing: 0.4 },
  requestDetail: { color: COLORS.textSecondary, fontSize: 12, lineHeight: 17 },
  logoutContainer: { gap: 12, paddingTop: 2 },
  footerNote: { color: COLORS.textMuted, fontSize: 11, textAlign: 'center' },
  muted: { color: COLORS.textSecondary, marginTop: 12 },
});
