import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import {
  getAttendanceHistory,
  getTeacherEventAttendance,
  deleteAttendance,
  type AttendanceRecord,
  type TeacherEventAttendance,
} from '@/lib/attendance';
import { getProfile, type Role } from '@/lib/profiles';

type DisplayStatus = 'upcoming' | 'ongoing' | 'ended' | 'closed';

export default function HistoryScreen() {
  const { user } = useAuth();
  const [role, setRole] = useState<Role | null>(null);
  const [studentRecords, setStudentRecords] = useState<AttendanceRecord[]>([]);
  const [teacherEvents, setTeacherEvents] = useState<TeacherEventAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<TeacherEventAttendance | null>(null);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [attendanceBusy, setAttendanceBusy] = useState(false);

  const loadHistory = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const profile = await getProfile(user.id);
      const currentRole: Role = profile?.role ?? 'student';
      setRole(currentRole);

      if (currentRole === 'teacher') {
        setTeacherEvents(await getTeacherEventAttendance(user.id));
        setStudentRecords([]);
      } else {
        setStudentRecords(await getAttendanceHistory(user.id));
        setTeacherEvents([]);
      }
    } catch (error) {
      console.error('Failed to load attendance history:', error);
      setStudentRecords([]);
      setTeacherEvents([]);
    } finally {
      setLoading(false);
      setCurrentTime(Date.now());
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [loadHistory])
  );

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, []);

  const removeTeacherAttendance = (attendeeId: string, studentId: string) => {
    if (!selectedEvent || attendanceBusy) return;
    Alert.alert(
      'Remove Student Attendance',
      `Remove this student's attendance record from "${selectedEvent.title}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setAttendanceBusy(true);
            try {
              const result = await deleteAttendance(attendeeId);
              if (result.error) {
                Alert.alert('Unable to Remove Attendance', result.error);
                return;
              }
              setSelectedEvent(current => current ? {
                ...current,
                attendees: current.attendees.filter(item => item.id !== attendeeId),
                attendeeCount: Math.max(0, current.attendeeCount - 1),
              } : current);
              setTeacherEvents(current => current.map(event => event.eventId === selectedEvent.eventId ? {
                ...event,
                attendees: event.attendees.filter(item => item.id !== attendeeId),
                attendeeCount: Math.max(0, event.attendeeCount - 1),
              } : event));
            } catch {
              Alert.alert('Unable to Remove Attendance', 'Please try again.');
            } finally {
              setAttendanceBusy(false);
            }
          },
        },
      ],
    );
  };

  const removeAllTeacherAttendance = () => {
    if (!selectedEvent || selectedEvent.attendees.length === 0 || attendanceBusy) return;
    const event = selectedEvent;
    const attendeeIds = event.attendees.map(attendee => attendee.id);
    Alert.alert(
      'Remove All Attendance?',
      `Permanently remove all ${attendeeIds.length} attendance record(s) for "${event.title}"? The event and student accounts will not be deleted. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove All',
          style: 'destructive',
          onPress: async () => {
            setAttendanceBusy(true);
            try {
              const results = await Promise.all(attendeeIds.map(id => deleteAttendance(id)));
              const failedCount = results.filter(result => result.error).length;
              if (failedCount > 0) {
                Alert.alert('Some Records Could Not Be Removed', `${failedCount} record(s) could not be deleted. Please refresh and try again.`);
                await loadHistory();
                return;
              }
              setSelectedEvent(current => current ? { ...current, attendees: [], attendeeCount: 0 } : current);
              setTeacherEvents(current => current.map(item => item.eventId === event.eventId ? { ...item, attendees: [], attendeeCount: 0 } : item));
              Alert.alert('Attendance Cleared', 'All attendance records for this event have been removed.');
            } catch {
              Alert.alert('Unable to Remove Attendance', 'Please refresh and try again.');
            } finally {
              setAttendanceBusy(false);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.pageHeader}>
        <Text style={styles.eyebrow}>YOUR RECORDS</Text>
        <Text style={styles.title}>Attendance History</Text>
        <Text style={styles.subtitle}>
          {role === 'teacher'
            ? 'Review event status and attendance for the events you created.'
            : 'Review your attendance and check each event’s current status.'}
        </Text>
      </View>

      {loading ? (
        <View style={styles.stateContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.stateText}>Loading attendance records...</Text>
        </View>
      ) : role === 'teacher' ? (
        <FlatList
          data={teacherEvents}
          keyExtractor={(item) => item.eventId}
          contentContainerStyle={[styles.list, teacherEvents.length === 0 && styles.emptyList]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState
              icon="calendar-outline"
              title="No events yet"
              message="Events you create will appear here with their attendance records."
            />
          }
          renderItem={({ item }) => {
            const status = getDisplayStatus(item.startTime, item.endTime, item.eventStatus, currentTime);
            return (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.eventIcon}>
                    <Ionicons name="calendar-outline" size={21} color={COLORS.primary} />
                  </View>
                  <View style={styles.eventHeading}>
                    <Text style={styles.eventTitle}>{item.title}</Text>
                    <Text style={styles.eventCode}>{item.eventCode}</Text>
                  </View>
                  <View style={styles.countBadge}>
                    <Text style={styles.countNumber}>{item.attendeeCount}</Text>
                    <Text style={styles.countLabel}>attended</Text>
                  </View>
                </View>

                <View style={styles.statusAndTimeRow}>
                  <StatusBadge status={status} />
                  {item.startTime ? (
                    <Text style={styles.compactTime}>Starts {formatDate(item.startTime)}</Text>
                  ) : null}
                </View>

                {item.endTime ? (
                  <View style={styles.metaRow}>
                    <Ionicons name="flag-outline" size={16} color={COLORS.textSecondary} />
                    <Text style={styles.metaText}>Ends {formatDate(item.endTime)}</Text>
                  </View>
                ) : null}

                <View style={styles.divider} />
                <View style={styles.attendanceSummary}>
                  <View style={styles.summaryTextWrap}>
                    <Text style={styles.sectionTitle}>Student attendance</Text>
                    <Text style={styles.emptyAttendees}>
                      {item.attendeeCount === 1
                        ? '1 student has attended this event.'
                        : `${item.attendeeCount} students have attended this event.`}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    style={({ pressed }) => [styles.viewAttendeesButton, pressed && styles.pressed]}
                    onPress={() => setSelectedEvent(item)}
                  >
                    <Ionicons name="people-outline" size={17} color={COLORS.textOnPrimary} />
                    <Text style={styles.viewAttendeesText}>Manage Attendance</Text>
                  </Pressable>
                </View>
              </View>
            );
          }}
        />
      ) : (
        <FlatList
          data={studentRecords}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={[styles.list, studentRecords.length === 0 && styles.emptyList]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState
              icon="time-outline"
              title="No attendance yet"
              message="Once you scan a valid event QR code, your attendance record will appear here."
            />
          }
          renderItem={({ item }) => {
            const status = getDisplayStatus(item.startTime, item.endTime, item.eventStatus, currentTime);
            return (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.eventIcon}>
                    <Ionicons name="calendar-outline" size={21} color={COLORS.primary} />
                  </View>
                  <View style={styles.eventHeading}>
                    <Text style={styles.eventTitle}>{item.eventTitle}</Text>
                    <Text style={styles.eventCode}>Event ID: {item.eventId}</Text>
                  </View>
                  <View style={styles.attendedBadge}>
                    <Ionicons name="checkmark" size={16} color={COLORS.success} />
                  </View>
                </View>

                <View style={styles.statusAndTimeRow}>
                  <StatusBadge status={status} />
                  <View style={styles.attendanceRecordedBadge}>
                    <Ionicons name="checkmark-circle" size={14} color={COLORS.success} />
                    <Text style={styles.attendanceRecordedText}>Attendance recorded</Text>
                  </View>
                </View>

                <View style={styles.divider} />
                <View style={styles.metaRow}>
                  <Ionicons name="time-outline" size={16} color={COLORS.textSecondary} />
                  <Text style={styles.metaText}>Scanned {formatDate(item.scannedAt)}</Text>
                </View>
                {item.startTime ? (
                  <View style={styles.metaRow}>
                    <Ionicons name="play-outline" size={16} color={COLORS.textSecondary} />
                    <Text style={styles.metaText}>Starts {formatDate(item.startTime)}</Text>
                  </View>
                ) : null}
                {item.endTime ? (
                  <View style={styles.metaRow}>
                    <Ionicons name="flag-outline" size={16} color={COLORS.textSecondary} />
                    <Text style={styles.metaText}>Ends {formatDate(item.endTime)}</Text>
                  </View>
                ) : null}
              </View>
            );
          }}
        />
      )}

      <Modal
        visible={selectedEvent !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedEvent(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.attendeesModal}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderText}>
                <Text style={styles.eyebrow}>ATTENDANCE DETAILS</Text>
                <Text style={styles.modalTitle}>Students who attended</Text>
                <Text style={styles.modalSubtitle} numberOfLines={2}>
                  {selectedEvent?.title ?? 'Event'} · {selectedEvent?.attendeeCount ?? 0} total
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close attendance details"
                style={styles.modalCloseButton}
                onPress={() => setSelectedEvent(null)}
              >
                <Ionicons name="close" size={22} color={COLORS.textPrimary} />
              </Pressable>
            </View>

            {selectedEvent && selectedEvent.attendees.length > 0 ? (
              <Pressable
                accessibilityRole="button"
                disabled={attendanceBusy}
                style={({ pressed }) => [styles.removeAllAttendanceButton, pressed && styles.pressed, attendanceBusy && { opacity: 0.55 }]}
                onPress={removeAllTeacherAttendance}
              >
                {attendanceBusy ? <ActivityIndicator size="small" color={COLORS.error} /> : <Ionicons name="trash-bin-outline" size={17} color={COLORS.error} />}
                <Text style={styles.removeAllAttendanceText}>Remove All Attendance</Text>
              </Pressable>
            ) : null}

            <FlatList
              style={styles.attendeeList}
              data={selectedEvent?.attendees ?? []}
              keyExtractor={(attendee) =>
                `${selectedEvent?.eventId ?? 'event'}-${attendee.studentId}-${attendee.scannedAt}`
              }
              showsVerticalScrollIndicator
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <View style={styles.modalEmptyState}>
                  <Ionicons name="people-outline" size={30} color={COLORS.textSecondary} />
                  <Text style={styles.emptyTitle}>No students yet</Text>
                  <Text style={styles.emptyMessage}>
                    Attendance records will appear here after students scan the event QR code.
                  </Text>
                </View>
              }
              renderItem={({ item: attendee, index }) => (
                <View style={styles.modalAttendeeRow}>
                  <View style={styles.attendeeIcon}>
                    <Ionicons name="person-outline" size={17} color={COLORS.textSecondary} />
                  </View>
                  <View style={styles.attendeeInfo}>
                    <Text style={styles.studentName}>{attendee.studentName || 'Student name unavailable'}</Text>
                    <Text style={styles.studentIdPlaceholder}>School ID: {attendee.schoolId || 'Not provided'}</Text>
                    <Text style={styles.scanTime}>Scanned {formatDate(attendee.scannedAt)}</Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove attendance for ${attendee.studentName || 'this student'}`}
                    disabled={attendanceBusy}
                    style={({ pressed }) => [styles.removeAttendanceButton, pressed && styles.pressed, attendanceBusy && { opacity: 0.55 }]}
                    onPress={() => removeTeacherAttendance(attendee.id, attendee.studentId)}
                  >
                    <Ionicons name="trash-outline" size={17} color={COLORS.error} />
                  </Pressable>
                </View>
              )}
            />

            <Pressable
              style={({ pressed }) => [styles.modalDoneButton, pressed && styles.pressed]}
              onPress={() => setSelectedEvent(null)}
            >
              <Text style={styles.modalDoneText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function StatusBadge({ status }: { status: DisplayStatus }) {
  const labels: Record<DisplayStatus, string> = {
    upcoming: 'Upcoming',
    ongoing: 'Ongoing',
    ended: 'Ended',
    closed: 'Closed',
  };
  const badgeStyles = {
    upcoming: styles.statusUpcoming,
    ongoing: styles.statusOngoing,
    ended: styles.statusEnded,
    closed: styles.statusClosed,
  };
  const textStyles = {
    upcoming: styles.statusUpcomingText,
    ongoing: styles.statusOngoingText,
    ended: styles.statusEndedText,
    closed: styles.statusClosedText,
  };
  const dotColors: Record<DisplayStatus, string> = {
    upcoming: '#2563EB',
    ongoing: '#16834A',
    ended: '#B96B0A',
    closed: '#666674',
  };
  return (
    <View style={[styles.statusBadge, badgeStyles[status]]}>
      <View style={[styles.statusBadgeDot, { backgroundColor: dotColors[status] }]} />
      <Text style={[styles.statusBadgeText, textStyles[status]]}>{labels[status]}</Text>
    </View>
  );
}

function getDisplayStatus(
  startTime: string | null,
  endTime: string | null,
  eventStatus: 'open' | 'closed',
  now: number
): DisplayStatus {
  if (eventStatus === 'closed') return 'closed';
  const start = startTime ? new Date(startTime).getTime() : null;
  const end = endTime ? new Date(endTime).getTime() : null;
  if (start !== null && Number.isFinite(start) && now < start) return 'upcoming';
  if (end !== null && Number.isFinite(end) && now >= end) return 'ended';
  return 'ongoing';
}

function EmptyState({
  icon,
  title,
  message,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  message: string;
}) {
  return (
    <View style={styles.emptyCard}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={30} color={COLORS.primary} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyMessage}>{message}</Text>
    </View>
  );
}

function formatDate(iso: string) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? 'Time unavailable' : date.toLocaleString();
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  pageHeader: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 18 },
  eyebrow: { color: COLORS.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1.8, marginBottom: 7 },
  title: { color: COLORS.textPrimary, fontSize: 27, fontWeight: '800', letterSpacing: -0.6 },
  subtitle: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 20, marginTop: 7 },
  list: { paddingHorizontal: 20, paddingBottom: 28 },
  emptyList: { flexGrow: 1, justifyContent: 'center' },
  card: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 19, padding: 16, marginBottom: 13 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  eventIcon: { width: 45, height: 45, borderRadius: 14, backgroundColor: COLORS.primaryMuted, alignItems: 'center', justifyContent: 'center' },
  eventHeading: { flex: 1 },
  eventTitle: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '800', lineHeight: 21 },
  eventCode: { color: COLORS.textSecondary, fontSize: 11, lineHeight: 17, marginTop: 3 },
  countBadge: { minWidth: 58, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7, paddingVertical: 7, borderRadius: 12, backgroundColor: COLORS.successBackground },
  countNumber: { color: COLORS.success, fontSize: 17, fontWeight: '800' },
  countLabel: { color: COLORS.textSecondary, fontSize: 9, marginTop: 2 },
  attendedBadge: { width: 32, height: 32, borderRadius: 11, backgroundColor: COLORS.successBackground, alignItems: 'center', justifyContent: 'center' },
  statusAndTimeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 9, marginTop: 13 },
  compactTime: { flex: 1, color: COLORS.textSecondary, fontSize: 11, textAlign: 'right' },
  statusBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  statusBadgeDot: { width: 6, height: 6, borderRadius: 3 },
  statusBadgeText: { fontSize: 11, fontWeight: '800' },
  statusUpcoming: { backgroundColor: '#E1EDFF' },
  statusUpcomingText: { color: '#2563EB' },
  statusOngoing: { backgroundColor: '#DDF5E7' },
  statusOngoingText: { color: '#16834A' },
  statusEnded: { backgroundColor: '#FFF0D9' },
  statusEndedText: { color: '#B96B0A' },
  statusClosed: { backgroundColor: '#E8E8ED' },
  statusClosedText: { color: '#666674' },
  metaRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 10 },
  metaText: { flex: 1, color: COLORS.textSecondary, fontSize: 12, lineHeight: 18 },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 15 },
  attendanceSummary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  summaryTextWrap: { flex: 1 },
  sectionTitle: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '800', marginBottom: 5 },
  emptyAttendees: { color: COLORS.textSecondary, fontSize: 12, lineHeight: 19 },
  viewAttendeesButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: COLORS.primary, paddingHorizontal: 13, paddingVertical: 11, borderRadius: 12 },
  viewAttendeesText: { color: COLORS.textOnPrimary, fontSize: 12, fontWeight: '800' },
  attendanceRecordedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  attendanceRecordedText: { color: COLORS.success, fontSize: 10, fontWeight: '700' },
  attendeeIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center' },
  attendeeInfo: { flex: 1 },
  studentName: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '800' },
  studentIdPlaceholder: { color: COLORS.textSecondary, fontSize: 11, marginTop: 3 },
  scanTime: { color: COLORS.textSecondary, fontSize: 10, marginTop: 4 },
  stateContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  stateText: { color: COLORS.textSecondary, fontSize: 13, marginTop: 14 },
  emptyCard: { alignItems: 'center', backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 20, paddingHorizontal: 24, paddingVertical: 30 },
  emptyIcon: { width: 64, height: 64, borderRadius: 21, backgroundColor: COLORS.primaryMuted, alignItems: 'center', justifyContent: 'center', marginBottom: 17 },
  emptyTitle: { color: COLORS.textPrimary, fontSize: 17, fontWeight: '800', textAlign: 'center', marginTop: 8 },
  emptyMessage: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 21, textAlign: 'center', marginTop: 8 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  attendeesModal: { width: '100%', maxWidth: 520, maxHeight: '80%', backgroundColor: COLORS.card, borderRadius: 22, borderWidth: 1, borderColor: COLORS.border, padding: 18 },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  modalHeaderText: { flex: 1 },
  modalTitle: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '800', lineHeight: 26 },
  modalSubtitle: { color: COLORS.textSecondary, fontSize: 12, marginTop: 5, lineHeight: 18 },
  modalCloseButton: { width: 36, height: 36, borderRadius: 12, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center' },
  removeAllAttendanceButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, minHeight: 44, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12, borderWidth: 1, borderColor: COLORS.error, backgroundColor: COLORS.errorBackground, marginTop: 28, marginBottom: 14, marginHorizontal: 2 },
  removeAllAttendanceText: { color: COLORS.error, fontSize: 12, fontWeight: '900' },
  removeAttendanceButton: { width: 36, height: 36, borderRadius: 11, backgroundColor: COLORS.errorBackground, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  modalNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: COLORS.primaryMuted, padding: 11, borderRadius: 12, marginTop: 16, marginBottom: 8 },
  modalNoticeText: { flex: 1, color: COLORS.textSecondary, fontSize: 11, lineHeight: 17 },
  attendeeList: { flexGrow: 1, flexShrink: 1, minHeight: 72, marginTop: 2 },
  modalAttendeeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalEmptyState: { alignItems: 'center', paddingVertical: 25, paddingHorizontal: 12 },
  modalDoneButton: { alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary, borderRadius: 13, paddingVertical: 13, marginTop: 16 },
  modalDoneText: { color: COLORS.textOnPrimary, fontSize: 13, fontWeight: '800' },
  pressed: { opacity: 0.8 },
});
