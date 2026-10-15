
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  ScrollView,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import {
  adminSetUserRole,
  getAllProfiles,
  reviewStudentSchoolId,
  reviewTeacherRequest,
  type Profile,
  type Role,
} from '@/lib/profiles';
import { getAllEvents, type CloudEvent } from '@/lib/events';
import { getAllAttendance, type AdminAttendanceRecord } from '@/lib/attendance';
import { getAllProfileChangeRequests, reviewProfileChangeRequest, type ProfileChangeRequest } from '@/lib/profile-change-requests';

type ProfileWithTeacherRequest = Profile & {
  teacher_request_status?: string;
};

export default function AdminScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [users, setUsers] = useState<Profile[]>([]);
  const [events, setEvents] = useState<CloudEvent[]>([]);
  const [attendance, setAttendance] = useState<AdminAttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [pendingProfileChanges, setPendingProfileChanges] = useState<ProfileChangeRequest[]>([]);
  const [reportModal, setReportModal] = useState<'teachers' | 'schoolIds' | 'profileChanges' | null>(null);
  const [userDrawerVisible, setUserDrawerVisible] = useState(false);
  const [roleModalProfile, setRoleModalProfile] = useState<Profile | null>(null);
  const [selectedRole, setSelectedRole] = useState<Role>('student');

  const loadDashboard = useCallback(async () => {
    try {
      const [userData, eventData, attendanceData] = await Promise.all([
        getAllProfiles(),
        getAllEvents(),
        getAllAttendance(),
      ]);

      setUsers(userData);
      setEvents(eventData);
      setAttendance(attendanceData);
      // Profile corrections are an added feature; a missing migration must not break the existing dashboard.
      try {
        const profileChangeRequests = await getAllProfileChangeRequests();
        setPendingProfileChanges(profileChangeRequests.filter((request) => request.status === 'pending'));
      } catch (requestError) {
        console.warn('Profile correction requests could not be loaded:', requestError);
        setPendingProfileChanges([]);
      }
    } catch (error) {
      console.error('Failed to load admin dashboard:', error);
      Alert.alert('Loading Error', 'Unable to load dashboard information.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
    }, [loadDashboard])
  );

  const refresh = () => {
    setRefreshing(true);
    loadDashboard();
  };

  const handleRoleChange = (profile: Profile) => {
    setRoleModalProfile(profile);
    setSelectedRole((profile.role || 'student') as Role);
  };

  const saveRoleChange = async () => {
    if (!roleModalProfile) return;
    if (selectedRole === (roleModalProfile.role || 'student')) {
      setRoleModalProfile(null);
      return;
    }

    try {
      setProcessingId(String(roleModalProfile.id));
      await adminSetUserRole(roleModalProfile.id, selectedRole);
      setRoleModalProfile(null);
      await loadDashboard();
      Alert.alert('Success', `User role changed to ${selectedRole}.`);
    } catch (error) {
      console.error('Failed to update user role:', error);
      Alert.alert('Error', 'Could not update the user role. Please try again.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleTeacherRequest = (profile: Profile, approved: boolean) => {
    Alert.alert(
      approved ? 'Approve Teacher Request' : 'Reject Teacher Request',
      `Are you sure you want to ${approved ? 'approve' : 'reject'} this request?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: approved ? 'Approve' : 'Reject',
          style: approved ? 'default' : 'destructive',
          onPress: async () => {
            try {
              setProcessingId(String(profile.id));
              await reviewTeacherRequest(profile.id, approved);
              await loadDashboard();
            } catch (error) {
              console.error(error);
              Alert.alert('Error', 'Could not review the teacher request.');
            } finally {
              setProcessingId(null);
            }
          },
        },
      ]
    );
  };

  const handleSchoolIdReview = (profile: Profile, approved: boolean) => {
    Alert.alert(
      approved ? 'Verify School ID' : 'Reject School ID',
      `Are you sure you want to ${approved ? 'verify' : 'reject'} this school ID?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: approved ? 'Verify' : 'Reject',
          style: approved ? 'default' : 'destructive',
          onPress: async () => {
            try {
              setProcessingId(String(profile.id));
              await reviewStudentSchoolId(profile.id, approved);
              await loadDashboard();
            } catch (error) {
              console.error(error);
              Alert.alert('Error', 'Could not review the school ID.');
            } finally {
              setProcessingId(null);
            }
          },
        },
      ]
    );
  };

  const handleProfileChangeReview = (request: ProfileChangeRequest, approve: boolean) => {
    Alert.alert(
      approve ? 'Approve Profile Correction' : 'Reject Profile Correction',
      `${request.student_name || request.student_email || 'Student'}\n${request.request_type === 'name' ? 'Name' : 'School ID'}: ${request.requested_value}${approve ? '\n\nThis will apply the correction to the student profile.' : ''}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: approve ? 'Approve' : 'Reject',
          style: approve ? 'default' : 'destructive',
          onPress: async () => {
            try {
              setProcessingId(request.id);
              await reviewProfileChangeRequest(request.id, approve, '');
              const updated = await getAllProfileChangeRequests();
              setPendingProfileChanges(updated.filter((item) => item.status === 'pending'));
              Alert.alert('Review Complete', approve ? 'The correction was approved and applied.' : 'The correction request was rejected.');
            } catch (error: any) {
              console.error(error);
              Alert.alert('Review Error', error?.message || 'Could not review this profile correction request.');
            } finally {
              setProcessingId(null);
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centered} edges={['top', 'bottom']}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading admin dashboard...</Text>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.centered} edges={['top', 'bottom']}>
        <Ionicons
          name="lock-closed-outline"
          size={42}
          color={COLORS.textSecondary}
        />
        <Text style={styles.emptyTitle}>Access Restricted</Text>
        <Text style={styles.emptyText}>
          Please sign in with an administrator account.
        </Text>
      </SafeAreaView>
    );
  }

  const isAdmin = users.some(
    (profile) => profile.id === user.id && profile.role === 'admin'
  );

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.centered} edges={['top', 'bottom']}>
        <Ionicons
          name="shield-checkmark-outline"
          size={42}
          color={COLORS.error}
        />
        <Text style={styles.emptyTitle}>Admin Access Required</Text>
        <Text style={styles.emptyText}>
          This page is only available to approved administrators.
        </Text>
      </SafeAreaView>
    );
  }

  const pendingTeachers = users.filter(
    (profile) =>
      (profile as ProfileWithTeacherRequest).teacher_request_status === 'pending'
  );

  const pendingSchoolIds = users.filter(
    (profile) =>
      profile.role === 'student' &&
      profile.school_id &&
      profile.school_id_status === 'pending'
  );

  const renderUser = ({ item }: { item: Profile }) => {
    const isProcessing = processingId === String(item.id);

    const teacherRequestStatus = (
      item as ProfileWithTeacherRequest
    ).teacher_request_status;

    return (
      <View style={styles.userCard}>
        <View style={styles.userHeader}>
          <View style={styles.avatar}>
            <Ionicons
              name="person-outline"
              size={22}
              color={COLORS.primary}
            />
          </View>

          <View style={styles.userInfo}>
            <Text style={styles.userName}>
              {item.full_name || item.email || 'Unnamed User'}
            </Text>
            <Text style={styles.userEmail}>
              {item.email || 'No email provided'}
            </Text>
            <Text style={styles.userMeta}>
              Role: {item.role || 'student'}
            </Text>
          </View>

          {item.role === 'admin' ? (
            <View style={[styles.roleButton, styles.roleButtonUnavailable]}>
              <Ionicons
                name="shield-checkmark-outline"
                size={19}
                color={COLORS.textSecondary}
              />
            </View>
          ) : (
            <Pressable
              style={styles.roleButton}
              onPress={() => handleRoleChange(item)}
              disabled={isProcessing || item.id === user.id}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <Ionicons
                  name="settings-outline"
                  size={19}
                  color={COLORS.primary}
                />
              )}
            </Pressable>
          )}
        </View>

        {teacherRequestStatus === 'pending' && (
          <View style={styles.reviewSection}>
            <Text style={styles.reviewTitle}>
              Teacher Request Pending
            </Text>
            <View style={styles.actionRow}>
              <Pressable
                style={[styles.actionButton, styles.approveButton]}
                onPress={() => handleTeacherRequest(item, true)}
                disabled={isProcessing}
              >
                <Text style={styles.approveText}>Approve</Text>
              </Pressable>
              <Pressable
                style={[styles.actionButton, styles.rejectButton]}
                onPress={() => handleTeacherRequest(item, false)}
                disabled={isProcessing}
              >
                <Text style={styles.rejectText}>Reject</Text>
              </Pressable>
            </View>
          </View>
        )}

        {item.school_id && item.school_id_status === 'pending' && (
          <View style={styles.reviewSection}>
            <Text style={styles.reviewTitle}>
              School ID: {item.school_id}
            </Text>
            <View style={styles.actionRow}>
              <Pressable
                style={[styles.actionButton, styles.approveButton]}
                onPress={() => handleSchoolIdReview(item, true)}
                disabled={isProcessing}
              >
                <Text style={styles.approveText}>Verify ID</Text>
              </Pressable>
              <Pressable
                style={[styles.actionButton, styles.rejectButton]}
                onPress={() => handleSchoolIdReview(item, false)}
                disabled={isProcessing}
              >
                <Text style={styles.rejectText}>Reject ID</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <FlatList
        data={[]}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderUser}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={COLORS.primary}
          />
        }
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View>
            <View style={styles.pageHeader}>
              <View>
                <Text style={styles.pageEyebrow}>ADMINISTRATION</Text>
                <Text style={styles.pageTitle}>Admin Dashboard</Text>
                <Text style={styles.pageSubtitle}>
                  Manage users and monitor school attendance.
                </Text>
              </View>
              <View style={styles.headerIcon}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={25}
                  color={COLORS.primary}
                />
              </View>
            </View>

            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <View
                  style={[
                    styles.statIcon,
                    { backgroundColor: COLORS.primaryMuted },
                  ]}
                >
                  <Ionicons
                    name="people-outline"
                    size={21}
                    color={COLORS.primary}
                  />
                </View>
                <Text style={styles.statNumber}>{users.length}</Text>
                <Text style={styles.statLabel}>Total Users</Text>
              </View>

              <View style={styles.statCard}>
                <View
                  style={[
                    styles.statIcon,
                    { backgroundColor: COLORS.infoBackground },
                  ]}
                >
                  <Ionicons
                    name="calendar-outline"
                    size={21}
                    color={COLORS.info}
                  />
                </View>
                <Text style={styles.statNumber}>{events.length}</Text>
                <Text style={styles.statLabel}>Events</Text>
              </View>

              <View style={styles.statCard}>
                <View
                  style={[
                    styles.statIcon,
                    { backgroundColor: COLORS.successBackground },
                  ]}
                >
                  <Ionicons
                    name="clipboard-outline"
                    size={21}
                    color={COLORS.success}
                  />
                </View>
                <Text style={styles.statNumber}>{attendance.length}</Text>
                <Text style={styles.statLabel}>Attendance</Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Management</Text>

            <Pressable
              style={styles.navigationCard}
              onPress={() => router.push('/(tabs)/admin-events')}
            >
              <View
                style={[
                  styles.navigationIcon,
                  { backgroundColor: COLORS.infoBackground },
                ]}
              >
                <Ionicons
                  name="calendar-outline"
                  size={23}
                  color={COLORS.info}
                />
              </View>
              <View style={styles.navigationCopy}>
                <Text style={styles.navigationTitle}>Event Management</Text>
                <Text style={styles.navigationSubtitle}>
                  {events.length} events · View and manage events
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={21}
                color={COLORS.textMuted}
              />
            </Pressable>

            <Pressable
              style={styles.navigationCard}
              onPress={() => router.push('/(tabs)/admin-attendance')}
            >
              <View
                style={[
                  styles.navigationIcon,
                  { backgroundColor: COLORS.successBackground },
                ]}
              >
                <Ionicons
                  name="clipboard-outline"
                  size={23}
                  color={COLORS.success}
                />
              </View>
              <View style={styles.navigationCopy}>
                <Text style={styles.navigationTitle}>
                  Attendance Overview
                </Text>
                <Text style={styles.navigationSubtitle}>
                  {attendance.length} records · Review or remove records
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={21}
                color={COLORS.textMuted}
              />
            </Pressable>

            <Text style={styles.sectionTitle}>System Reports</Text>

            <Pressable style={styles.navigationCard} onPress={() => setReportModal('teachers')}>
              <View style={[styles.navigationIcon, { backgroundColor: COLORS.infoBackground }]}>
                <Ionicons name="person-add-outline" size={23} color={COLORS.info} />
              </View>
              <View style={styles.navigationCopy}>
                <Text style={styles.navigationTitle}>Pending teacher requests</Text>
                <Text style={styles.navigationSubtitle}>{pendingTeachers.length} pending · Tap to review requests</Text>
              </View>
              <Ionicons name="chevron-forward" size={21} color={COLORS.textMuted} />
            </Pressable>

            <Pressable style={styles.navigationCard} onPress={() => setReportModal('schoolIds')}>
              <View style={[styles.navigationIcon, { backgroundColor: COLORS.successBackground }]}>
                <Ionicons name="card-outline" size={23} color={COLORS.success} />
              </View>
              <View style={styles.navigationCopy}>
                <Text style={styles.navigationTitle}>Pending school ID reviews</Text>
                <Text style={styles.navigationSubtitle}>{pendingSchoolIds.length} pending · Tap to verify IDs</Text>
              </View>
              <Ionicons name="chevron-forward" size={21} color={COLORS.textMuted} />
            </Pressable>

            <Pressable style={styles.navigationCard} onPress={() => setReportModal('profileChanges')}>
              <View style={[styles.navigationIcon, { backgroundColor: COLORS.infoBackground }]}>
                <Ionicons name="document-text-outline" size={23} color={COLORS.info} />
              </View>
              <View style={styles.navigationCopy}>
                <Text style={styles.navigationTitle}>Profile correction requests</Text>
                <Text style={styles.navigationSubtitle}>{pendingProfileChanges.length} pending · Review name and School ID corrections</Text>
              </View>
              <Ionicons name="chevron-forward" size={21} color={COLORS.textMuted} />
            </Pressable>

            <View style={styles.reportCard}>
              <View style={styles.reportRow}><Text style={styles.reportLabel}>Registered students</Text><Text style={styles.reportValue}>{users.filter((profile) => profile.role === 'student').length}</Text></View>
              <View style={styles.reportDivider} />
              <View style={styles.reportRow}><Text style={styles.reportLabel}>Registered teachers</Text><Text style={styles.reportValue}>{users.filter((profile) => profile.role === 'teacher').length}</Text></View>
              <View style={styles.reportDivider} />
              <View style={styles.reportRow}><Text style={styles.reportLabel}>Total attendance records</Text><Text style={styles.reportValue}>{attendance.length}</Text></View>
            </View>

            <Pressable style={styles.navigationCard} onPress={() => setUserDrawerVisible(true)}>
              <View style={[styles.navigationIcon, { backgroundColor: COLORS.primaryMuted }]}>
                <Ionicons name="people-outline" size={23} color={COLORS.primary} />
              </View>
              <View style={styles.navigationCopy}>
                <Text style={styles.navigationTitle}>User Management</Text>
                <Text style={styles.navigationSubtitle}>{users.length} users · Open the user management drawer</Text>
              </View>
              <Ionicons name="chevron-forward" size={21} color={COLORS.textMuted} />
            </Pressable>
          </View>
        }
        ListEmptyComponent={null}
      />

      <Modal visible={userDrawerVisible} animationType="fade" transparent statusBarTranslucent onRequestClose={() => setUserDrawerVisible(false)}>
        <View style={styles.drawerBackdrop}>
          <View style={styles.drawerPanel}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalEyebrow}>ADMINISTRATION</Text>
                <Text style={styles.modalTitle}>User Management</Text>
                <Text style={styles.modalSubtitle}>{users.length} registered users</Text>
              </View>
              <Pressable style={styles.modalCloseButton} onPress={() => setUserDrawerVisible(false)}>
                <Ionicons name="close" size={23} color={COLORS.textPrimary} />
              </Pressable>
            </View>
            <FlatList data={users} keyExtractor={(item) => String(item.id)} renderItem={renderUser} contentContainerStyle={styles.drawerList} ListEmptyComponent={<Text style={styles.modalEmpty}>No registered users found.</Text>} />
          </View>
        </View>
      </Modal>

      <Modal
        visible={roleModalProfile !== null}
        animationType="fade"
        transparent
        statusBarTranslucent
        onRequestClose={() => setRoleModalProfile(null)}
      >
        <View style={styles.roleModalBackdrop}>
          <View style={styles.roleModalPanel}>
            <View style={styles.roleModalHeader}>
              <View style={styles.roleModalIcon}>
                <Ionicons name="people-outline" size={23} color={COLORS.primary} />
              </View>
              <Pressable style={styles.modalCloseButton} onPress={() => setRoleModalProfile(null)}>
                <Ionicons name="close" size={22} color={COLORS.textPrimary} />
              </Pressable>
            </View>
            <Text style={styles.modalEyebrow}>USER MANAGEMENT</Text>
            <Text style={styles.modalTitle}>Change user role</Text>
            <Text style={styles.modalSubtitle}>
              {roleModalProfile?.full_name || roleModalProfile?.email || 'Selected user'}
            </Text>
            <Text style={styles.roleChoiceLabel}>Choose an account role</Text>
            {([
              { value: 'student' as Role, title: 'Student', detail: 'Access student attendance features', icon: 'school-outline' as const },
              { value: 'teacher' as Role, title: 'Teacher', detail: 'Manage events and review attendance', icon: 'easel-outline' as const },
              { value: 'admin' as Role, title: 'Admin', detail: 'Manage users and system settings', icon: 'shield-checkmark-outline' as const },
            ]).map((option) => {
              const selected = selectedRole === option.value;
              return (
                <Pressable
                  key={option.value}
                  style={[styles.roleChoice, selected && styles.roleChoiceSelected]}
                  onPress={() => setSelectedRole(option.value)}
                >
                  <View style={[styles.roleChoiceIcon, selected && styles.roleChoiceIconSelected]}>
                    <Ionicons name={option.icon} size={21} color={selected ? COLORS.primary : COLORS.textSecondary} />
                  </View>
                  <View style={styles.roleChoiceText}>
                    <Text style={styles.roleChoiceTitle}>{option.title}</Text>
                    <Text style={styles.roleChoiceDetail}>{option.detail}</Text>
                  </View>
                  <Ionicons
                    name={selected ? 'radio-button-on' : 'radio-button-off'}
                    size={21}
                    color={selected ? COLORS.primary : COLORS.textMuted}
                  />
                </Pressable>
              );
            })}
            <View style={styles.roleModalActions}>
              <Pressable style={styles.roleCancelButton} onPress={() => setRoleModalProfile(null)}>
                <Text style={styles.roleCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.roleSaveButton, processingId === String(roleModalProfile?.id) && styles.roleSaveButtonDisabled]}
                onPress={saveRoleChange}
                disabled={!roleModalProfile || processingId === String(roleModalProfile.id)}
              >
                {processingId === String(roleModalProfile?.id) ? (
                  <ActivityIndicator size="small" color={COLORS.background} />
                ) : (
                  <Text style={styles.roleSaveText}>Save role</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={reportModal !== null} animationType="slide" transparent onRequestClose={() => setReportModal(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.reportModalPanel}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalEyebrow}>SYSTEM REPORTS</Text>
                <Text style={styles.modalTitle}>{reportModal === 'teachers' ? 'Teacher Requests' : reportModal === 'schoolIds' ? 'School ID Reviews' : 'Profile Correction Requests'}</Text>
                <Text style={styles.modalSubtitle}>{reportModal === 'teachers' ? `${pendingTeachers.length} requests awaiting review` : reportModal === 'schoolIds' ? `${pendingSchoolIds.length} IDs awaiting verification` : `${pendingProfileChanges.length} profile corrections awaiting review`}</Text>
              </View>
              <Pressable style={styles.modalCloseButton} onPress={() => setReportModal(null)}>
                <Ionicons name="close" size={23} color={COLORS.textPrimary} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.reportModalContent}>
              {reportModal === 'teachers' ? (
                pendingTeachers.length ? pendingTeachers.map((profile) => <View key={String(profile.id)} style={styles.modalRequestCard}>
                  <Text style={styles.modalRequestName}>{profile.full_name || profile.email || 'Teacher applicant'}</Text>
                  <Text style={styles.modalRequestMeta}>{profile.email || 'No email provided'}</Text>
                  <View style={styles.modalActionRow}>
                    <Pressable style={[styles.actionButton, styles.approveButton]} onPress={() => handleTeacherRequest(profile, true)} disabled={!!processingId}><Text style={styles.approveText}>Approve</Text></Pressable>
                    <Pressable style={[styles.actionButton, styles.rejectButton]} onPress={() => handleTeacherRequest(profile, false)} disabled={!!processingId}><Text style={styles.rejectText}>Reject</Text></Pressable>
                  </View>
                </View>) : <Text style={styles.modalEmpty}>There are no pending teacher requests.</Text>
              ) : reportModal === 'schoolIds' ? (
                pendingSchoolIds.length ? pendingSchoolIds.map((profile) => <View key={String(profile.id)} style={styles.modalRequestCard}>
                  <Text style={styles.modalRequestName}>{profile.full_name || profile.email || 'Student'}</Text>
                  <Text style={styles.modalRequestMeta}>{profile.email || 'No email provided'}</Text>
                  <Text style={styles.modalRequestValue}>School ID: {profile.school_id}</Text>
                  <View style={styles.modalActionRow}>
                    <Pressable style={[styles.actionButton, styles.approveButton]} onPress={() => handleSchoolIdReview(profile, true)} disabled={!!processingId}><Text style={styles.approveText}>Verify ID</Text></Pressable>
                    <Pressable style={[styles.actionButton, styles.rejectButton]} onPress={() => handleSchoolIdReview(profile, false)} disabled={!!processingId}><Text style={styles.rejectText}>Reject</Text></Pressable>
                  </View>
                </View>) : <Text style={styles.modalEmpty}>There are no pending School ID reviews.</Text>
              ) : (
                pendingProfileChanges.length ? pendingProfileChanges.map((request) => <View key={request.id} style={styles.modalRequestCard}>
                  <View style={styles.modalRequestTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modalRequestName}>{request.student_name || 'Student account'}</Text>
                      <Text style={styles.modalRequestMeta}>{request.student_email || request.user_id}</Text>
                    </View>
                    <Text style={styles.modalRequestType}>{request.request_type === 'name' ? 'NAME' : 'SCHOOL ID'}</Text>
                  </View>
                  <Text style={styles.modalFieldLabel}>Current value</Text>
                  <Text style={styles.modalRequestMeta}>{request.current_value || 'Not provided'}</Text>
                  <Text style={styles.modalFieldLabel}>Requested value</Text>
                  <Text style={styles.modalRequestValue}>{request.requested_value}</Text>
                  <Text style={styles.modalFieldLabel}>Reason</Text>
                  <Text style={styles.modalReason}>{request.reason}</Text>
                  <Text style={styles.modalRequestMeta}>Submitted {new Date(request.created_at).toLocaleString()}</Text>
                  <View style={styles.modalActionRow}>
                    <Pressable style={[styles.actionButton, styles.approveButton]} onPress={() => handleProfileChangeReview(request, true)} disabled={!!processingId}><Text style={styles.approveText}>{processingId === request.id ? 'Processing...' : 'Approve'}</Text></Pressable>
                    <Pressable style={[styles.actionButton, styles.rejectButton]} onPress={() => handleProfileChangeReview(request, false)} disabled={!!processingId}><Text style={styles.rejectText}>Reject</Text></Pressable>
                  </View>
                </View>) : <Text style={styles.modalEmpty}>There are no pending profile correction requests.</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centered: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  loadingText: {
    color: COLORS.textSecondary,
    marginTop: 12,
    fontSize: 14,
  },
  listContent: {
    padding: 18,
    paddingBottom: 35,
  },
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 22,
  },
  pageEyebrow: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 7,
  },
  pageTitle: {
    color: COLORS.textPrimary,
    fontSize: 27,
    fontWeight: '800',
  },
  pageSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 6,
    maxWidth: 260,
    lineHeight: 19,
  },
  headerIcon: {
    width: 49,
    height: 49,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 27,
  },
  statCard: {
    flex: 1,
    padding: 13,
    borderRadius: 17,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statNumber: {
    color: COLORS.textPrimary,
    fontSize: 24,
    fontWeight: '800',
  },
  statLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 4,
  },
  sectionTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 13,
  },
  navigationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 17,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 11,
  },
  navigationIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },
  navigationCopy: {
    flex: 1,
  },
  navigationTitle: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  navigationSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 5,
    lineHeight: 16,
  },
  reportCard: {
    backgroundColor: COLORS.card,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
    paddingVertical: 4,
    marginBottom: 27,
  },
  reportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  reportLabel: {
    color: COLORS.textSecondary,
    fontSize: 13,
    flex: 1,
  },
  reportValue: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '800',
    marginLeft: 12,
  },
  reportDivider: {
    height: 1,
    backgroundColor: COLORS.border,
  },
  usersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  usersCount: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginBottom: 13,
  },
  userCard: {
    backgroundColor: COLORS.card,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 15,
    marginBottom: 12,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 43,
    height: 43,
    borderRadius: 14,
    backgroundColor: COLORS.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  userEmail: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 4,
  },
  userMeta: {
    color: COLORS.primary,
    fontSize: 11,
    marginTop: 5,
    textTransform: 'capitalize',
  },
  roleButtonUnavailable: { opacity: 0.75 },
  roleButton: {
    width: 39,
    height: 39,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  reviewSection: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginTop: 14,
    paddingTop: 13,
  },
  reviewTitle: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 10,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 9,
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingVertical: 10,
  },
  approveButton: {
    backgroundColor: COLORS.successBackground,
  },
  rejectButton: {
    backgroundColor: COLORS.errorBackground,
  },
  approveText: {
    color: COLORS.success,
    fontSize: 12,
    fontWeight: '700',
  },
  rejectText: {
    color: COLORS.error,
    fontSize: 12,
    fontWeight: '700',
  },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.62)', justifyContent: 'flex-end' },
  roleModalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 22, paddingVertical: 24 },
  roleModalPanel: { width: '100%', maxWidth: 430, backgroundColor: COLORS.background, borderRadius: 22, padding: 20, borderWidth: 1, borderColor: COLORS.border },
  roleModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  roleModalIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: COLORS.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  roleChoiceLabel: { color: COLORS.textPrimary, fontSize: 12, fontWeight: '800', marginTop: 22, marginBottom: 10 },
  roleChoice: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card, marginBottom: 9 },
  roleChoiceSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.card },
  roleChoiceIcon: { width: 39, height: 39, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background },
  roleChoiceIconSelected: { borderWidth: 1, borderColor: COLORS.primary },
  roleChoiceText: { flex: 1 },
  roleChoiceTitle: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '800' },
  roleChoiceDetail: { color: COLORS.textSecondary, fontSize: 10, marginTop: 3, lineHeight: 14 },
  roleModalActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  roleCancelButton: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 12, paddingVertical: 13, borderWidth: 1, borderColor: COLORS.border },
  roleCancelText: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '700' },
  roleSaveButton: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 12, paddingVertical: 13, backgroundColor: COLORS.primary },
  roleSaveButtonDisabled: { opacity: 0.6 },
  roleSaveText: { color: COLORS.background, fontSize: 13, fontWeight: '900' },
  drawerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.68)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 28 },
  drawerPanel: { width: '100%', maxWidth: 480, height: '82%', maxHeight: 720, minHeight: 300, backgroundColor: COLORS.background, paddingTop: 18, borderRadius: 22, overflow: 'hidden' },
  reportModalPanel: { height: '88%', backgroundColor: COLORS.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 18 },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 18, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: 12 },
  modalEyebrow: { color: COLORS.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1.4, marginBottom: 5 },
  modalTitle: { color: COLORS.textPrimary, fontSize: 21, fontWeight: '800' },
  modalSubtitle: { color: COLORS.textSecondary, fontSize: 12, marginTop: 5, lineHeight: 17 },
  modalCloseButton: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  drawerList: { padding: 16, paddingBottom: 30, flexGrow: 1 },
  reportModalContent: { padding: 16, paddingBottom: 32, flexGrow: 1 },
  modalRequestCard: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 15, padding: 14, marginBottom: 12, gap: 8 },
  modalRequestTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  modalRequestName: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '800' },
  modalRequestMeta: { color: COLORS.textSecondary, fontSize: 11, lineHeight: 16 },
  modalRequestValue: { color: COLORS.primary, fontSize: 13, fontWeight: '800', lineHeight: 18 },
  modalRequestType: { color: COLORS.info, fontSize: 10, fontWeight: '900' },
  modalFieldLabel: { color: COLORS.textMuted, fontSize: 10, fontWeight: '900', letterSpacing: 0.8, marginTop: 2 },
  modalReason: { color: COLORS.textPrimary, fontSize: 12, lineHeight: 18 },
  modalActionRow: { flexDirection: 'row', gap: 9, marginTop: 5 },
  modalEmpty: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 20, textAlign: 'center', padding: 24 },
  emptyCard: {
    alignItems: 'center',
    padding: 25,
    borderRadius: 17,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyTitle: {
    color: COLORS.textPrimary,
    fontSize: 17,
    fontWeight: '800',
    marginTop: 12,
    textAlign: 'center',
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 7,
  },
});
