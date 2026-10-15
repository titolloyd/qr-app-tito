import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { getAllProfiles, getProfile, type Profile } from '@/lib/profiles';
import { getAllEvents, type CloudEvent } from '@/lib/events';
import { deleteAttendance, getAllAttendance, type AdminAttendanceRecord } from '@/lib/attendance';

type AttendanceStudent = { name: string; schoolId: string };

export default function AdminAttendanceScreen() {
  const { user } = useAuth();
  const [records, setRecords] = useState<AdminAttendanceRecord[]>([]);
  const [events, setEvents] = useState<CloudEvent[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CloudEvent | null>(null);
  const [busy, setBusy] = useState(false);

  const loadData = async () => {
    try {
      if (!user?.id) {
        setAuthorized(false);
        setLoading(false);
        return;
      }
      const profile = await getProfile(user.id);
      if (profile?.role !== 'admin' || profile.approval_status !== 'approved') {
        setAuthorized(false);
        return;
      }
      setAuthorized(true);
      const [allRecords, allEvents, allProfiles] = await Promise.all([
        getAllAttendance(), getAllEvents(), getAllProfiles(),
      ]);
      setRecords(allRecords);
      setEvents(allEvents);
      setProfiles(allProfiles);
    } catch {
      Alert.alert('Error', 'Unable to load attendance records. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { loadData(); }, [user?.id]));

  const refresh = async () => {
    setRefreshing(true);
    await loadData();
  };

  const formatDate = (value: string | null) => {
    if (!value) return 'Not available';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Invalid date' : date.toLocaleString();
  };

  const profileById = useMemo(() => {
    const map = new Map<string, Profile>();
    profiles.forEach(profile => map.set(profile.id, profile));
    return map;
  }, [profiles]);

  const getStudent = (studentId: string): AttendanceStudent => {
    const profile = profileById.get(studentId);
    return {
      name: profile?.full_name?.trim() || 'Student name unavailable',
      schoolId: profile?.school_id?.trim() || 'Not provided',
    };
  };

  const eventRecords = useMemo(
    () => selectedEvent ? records.filter(record => record.eventId === selectedEvent.id) : [],
    [records, selectedEvent],
  );

  const removeOne = (record: AdminAttendanceRecord) => {
    const student = getStudent(record.studentId);
    Alert.alert(
      'Remove Attendance',
      `Remove ${student.name}'s attendance from ${record.eventTitle}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: async () => {
          setBusy(true);
          const result = await deleteAttendance(record.id);
          setBusy(false);
          if (result.error) { Alert.alert('Error', result.error); return; }
          setRecords(current => current.filter(item => item.id !== record.id));
        } },
      ],
    );
  };

  const removeAllForEvent = () => {
    if (!selectedEvent || eventRecords.length === 0) return;
    Alert.alert(
      'Remove All Attendance?',
      `This will permanently remove all ${eventRecords.length} attendance record(s) for “${selectedEvent.title}”. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove All', style: 'destructive', onPress: async () => {
          setBusy(true);
          const results = await Promise.all(eventRecords.map(record => deleteAttendance(record.id)));
          const failed = results.filter(result => result.error);
          setBusy(false);
          if (failed.length) {
            Alert.alert('Some Records Could Not Be Removed', `${failed.length} record(s) failed to delete. Refresh the page and try again.`);
            await loadData();
            return;
          }
          setRecords(current => current.filter(record => record.eventId !== selectedEvent.id));
          Alert.alert('Attendance Cleared', 'All attendance records for this event have been removed.');
        } },
      ],
    );
  };

  if (loading) return (
    <SafeAreaView style={styles.center} edges={['top', 'left', 'right']}>
      <ActivityIndicator size="large" color={COLORS.primary} />
      <Text style={styles.loadingText}>Loading attendance overview...</Text>
    </SafeAreaView>
  );

  if (!authorized) return (
    <SafeAreaView style={styles.center} edges={['top', 'left', 'right']}>
      <Ionicons name="lock-closed-outline" size={34} color={COLORS.primary} />
      <Text style={styles.heroTitle}>Administrators Only</Text>
      <Text style={styles.description}>This page is available only to approved administrator accounts.</Text>
    </SafeAreaView>
  );

  const eventsWithAttendance = new Set(records.map(record => record.eventId));

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={COLORS.primary} />}
      >
        <View style={styles.hero}>
          <View style={styles.eyebrowRow}><View style={styles.eyebrowLine} /><Text style={styles.eyebrow}>ADMINISTRATION</Text></View>
          <View style={styles.heroTitleRow}>
            <Text style={[styles.heroTitle, { flex: 1 }]}>Attendance <Text style={styles.heroAccent}>overview.</Text></Text>
            <Pressable style={styles.refreshButton} onPress={refresh} accessibilityLabel="Refresh attendance">
              <Text style={{ fontSize: 21 }}>📋</Text>
            </Pressable>
          </View>
          <Text style={styles.description}>Review attendance by event and manage individual or bulk attendance records.</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}><Text style={styles.statValue}>{records.length}</Text><Text style={styles.statLabel}>TOTAL RECORDS</Text></View>
          <View style={styles.statCard}><Text style={styles.statValue}>{eventsWithAttendance.size}</Text><Text style={styles.statLabel}>EVENTS WITH ATTENDANCE</Text></View>
          <View style={styles.statCard}><Text style={styles.statValue}>{events.length}</Text><Text style={styles.statLabel}>TOTAL EVENTS</Text></View>
        </View>

        <View style={styles.sectionHeader}>
          <View style={{ flex: 1 }}><Text style={styles.sectionTitle}>Attendance by Event</Text><Text style={styles.sectionSubtitle}>Tap an event to view its students and manage attendance.</Text></View>
          <View style={styles.countBadge}><Text style={styles.countText}>{events.length}</Text></View>
        </View>

        {events.length === 0 ? <Text style={styles.emptyText}>No events available.</Text> : events.map(event => {
          const count = records.filter(record => record.eventId === event.id).length;
          return (
            <Pressable key={event.id} style={({ pressed }) => [styles.summaryCard, pressed && styles.summaryPressed]} onPress={() => setSelectedEvent(event)}>
              <View style={styles.summaryIcon}><Ionicons name="calendar-outline" size={19} color={COLORS.primary} /></View>
              <View style={{ flex: 1 }}><Text style={styles.summaryTitle}>{event.title}</Text><Text style={styles.summarySubtitle}>Code: {event.event_code}</Text><Text style={styles.tapHint}>Tap to view attendance</Text></View>
              <View style={styles.summaryCount}><Text style={styles.summaryCountText}>{count}</Text></View>
              <Ionicons name="chevron-forward" size={17} color={COLORS.textMuted} />
            </Pressable>
          );
        })}
      </ScrollView>

      <Modal visible={!!selectedEvent} animationType="slide" transparent onRequestClose={() => setSelectedEvent(null)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => !busy && setSelectedEvent(null)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalEyebrow}>EVENT ATTENDANCE</Text>
                <Text style={styles.modalTitle} numberOfLines={2}>{selectedEvent?.title}</Text>
                <Text style={styles.modalSubtitle}>{eventRecords.length} student attendance record(s)</Text>
              </View>
              <Pressable style={styles.closeButton} onPress={() => !busy && setSelectedEvent(null)}><Ionicons name="close" size={22} color={COLORS.textPrimary} /></Pressable>
            </View>

            {eventRecords.length > 0 && <Pressable disabled={busy} style={[styles.removeAllButton, busy && { opacity: 0.55 }]} onPress={removeAllForEvent}>
              {busy ? <ActivityIndicator size="small" color={COLORS.error} /> : <Ionicons name="trash-bin-outline" size={17} color={COLORS.error} />}
              <Text style={styles.removeAllText}>Remove All Attendance</Text>
            </Pressable>}

            {eventRecords.length === 0 ? (
              <View style={styles.modalEmpty}><Ionicons name="people-outline" size={32} color={COLORS.textMuted} /><Text style={styles.emptyText}>No students have recorded attendance for this event.</Text></View>
            ) : (
              <FlatList
                data={eventRecords}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.attendeeList}
                renderItem={({ item }) => {
                  const student = getStudent(item.studentId);
                  return <View style={styles.attendeeCard}>
                    <View style={styles.attendeeAvatar}><Ionicons name="person-outline" size={19} color={COLORS.primaryLight} /></View>
                    <View style={styles.attendeeDetails}>
                      <Text style={styles.attendeeName}>{student.name}</Text>
                      <Text style={styles.attendeeMeta}>School ID: {student.schoolId}</Text>
                      <Text style={styles.attendeeMeta}>Time: {formatDate(item.scannedAt)}</Text>
                    </View>
                    <Pressable disabled={busy} style={styles.removeIconButton} onPress={() => removeOne(item)} accessibilityLabel={`Remove attendance for ${student.name}`}>
                      <Ionicons name="trash-outline" size={17} color={COLORS.error} />
                    </Pressable>
                  </View>;
                }}
              />
            )}
            <Text style={styles.modalFootnote}>Removing attendance deletes only the selected record(s), not the event or student account.</Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 36 },
  center: { flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center', padding: 28 },
  loadingText: { color: COLORS.textSecondary, marginTop: 12, fontSize: 13 },
  hero: { marginBottom: 22 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 14 },
  eyebrowLine: { height: 3, width: 24, borderRadius: 5, backgroundColor: COLORS.primary },
  eyebrow: { color: COLORS.primary, fontSize: 10, fontWeight: '800', letterSpacing: 2 },
  heroTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  heroTitle: { color: COLORS.textPrimary, fontSize: 30, lineHeight: 38, fontWeight: '900' },
  heroAccent: { color: COLORS.primary },
  description: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 20, marginTop: 12 },
  refreshButton: { width: 43, height: 43, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card, justifyContent: 'center', alignItems: 'center' },
  statsRow: { flexDirection: 'row', gap: 9, marginBottom: 26 },
  statCard: { flex: 1, padding: 12, borderRadius: 16, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  statValue: { color: COLORS.textPrimary, fontSize: 22, fontWeight: '900' },
  statLabel: { color: COLORS.textSecondary, fontSize: 8, fontWeight: '800', marginTop: 5 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 13 },
  sectionTitle: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '900', marginTop: 8 },
  sectionSubtitle: { color: COLORS.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 4 },
  countBadge: { width: 34, height: 34, borderRadius: 11, backgroundColor: COLORS.primaryMuted, alignItems: 'center', justifyContent: 'center' },
  countText: { color: COLORS.primaryLight, fontSize: 13, fontWeight: '900' },
  emptyText: { color: COLORS.textSecondary, fontSize: 13, paddingVertical: 16, lineHeight: 20 },
  summaryCard: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 13, marginBottom: 9, borderRadius: 15, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  summaryPressed: { opacity: 0.78, borderColor: COLORS.primary },
  summaryIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: COLORS.primaryMuted, alignItems: 'center', justifyContent: 'center' },
  summaryTitle: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '800' },
  summarySubtitle: { color: COLORS.textSecondary, fontSize: 11, marginTop: 4 },
  tapHint: { color: COLORS.primaryLight, fontSize: 10, marginTop: 5, fontWeight: '700' },
  summaryCount: { minWidth: 34, height: 34, borderRadius: 11, backgroundColor: COLORS.primaryMuted, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  summaryCountText: { color: COLORS.primaryLight, fontSize: 13, fontWeight: '900' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalSheet: { height: '82%', backgroundColor: COLORS.background, borderTopLeftRadius: 25, borderTopRightRadius: 25, borderWidth: 1, borderColor: COLORS.border, paddingTop: 10, paddingHorizontal: 18, paddingBottom: 20 },
  modalHandle: { width: 42, height: 4, borderRadius: 3, backgroundColor: COLORS.textMuted, alignSelf: 'center', marginBottom: 18 },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  modalEyebrow: { color: COLORS.primary, fontSize: 9, letterSpacing: 1.8, fontWeight: '900', marginBottom: 6 },
  modalTitle: { color: COLORS.textPrimary, fontSize: 22, lineHeight: 28, fontWeight: '900' },
  modalSubtitle: { color: COLORS.textSecondary, fontSize: 12, marginTop: 5 },
  closeButton: { width: 38, height: 38, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  removeAllButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: COLORS.error, backgroundColor: COLORS.errorBackground, marginBottom: 12 },
  removeAllText: { color: COLORS.error, fontSize: 12, fontWeight: '900' },
  attendeeList: { paddingBottom: 12 },
  attendeeCard: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card, marginBottom: 9 },
  attendeeAvatar: { width: 40, height: 40, borderRadius: 13, backgroundColor: COLORS.primaryMuted, alignItems: 'center', justifyContent: 'center' },
  attendeeDetails: { flex: 1 },
  attendeeName: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '800', marginBottom: 4 },
  attendeeMeta: { color: COLORS.textSecondary, fontSize: 11, lineHeight: 17 },
  removeIconButton: { width: 36, height: 36, borderRadius: 11, backgroundColor: COLORS.errorBackground, alignItems: 'center', justifyContent: 'center' },
  modalEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  modalFootnote: { color: COLORS.textMuted, fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: 8 },
});
