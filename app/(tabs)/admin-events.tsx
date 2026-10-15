
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker from '@react-native-community/datetimepicker';

import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { getProfile } from '@/lib/profiles';
import { closeEvent, deleteEvent, getAllEvents, updateEvent, type CloudEvent } from '@/lib/events';
import { supabase } from '@/lib/supabase';

export default function AdminEventsScreen() {
  const { user } = useAuth();

  const [events, setEvents] = useState<CloudEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CloudEvent | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editVenue, setEditVenue] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editStartDate, setEditStartDate] = useState(() => new Date(Date.now() + 5 * 60 * 1000));
  const [editEndDate, setEditEndDate] = useState(() => new Date(Date.now() + 60 * 60 * 1000));
  const [showPicker, setShowPicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<'date' | 'time' | 'datetime'>(
    Platform.OS === 'ios' ? 'datetime' : 'date'
  );
  const [editingPart, setEditingPart] = useState<'start' | 'end' | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const statusSnapshot = useRef<Map<string, string | undefined>>(new Map());

  const loadData = async () => {
    try {
      if (!user?.id) {
        setAuthorized(false);
        setLoading(false);
        return;
      }

      const profile = await getProfile(user.id);

      if (
        profile?.role !== 'admin' ||
        profile.approval_status !== 'approved'
      ) {
        setAuthorized(false);
        return;
      }

      const loadedEvents = await getAllEvents();
      statusSnapshot.current = new Map(
        loadedEvents.map(event => [event.id, event.status])
      );
      setEvents(loadedEvents);
      setAuthorized(true);
    } catch {
      Alert.alert('Error', 'Unable to load events. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [user?.id])
  );

  useEffect(() => {
    if (!authorized) return;

    const channel = supabase
      .channel('admin-event-status-notifications')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'events' },
        payload => {
          const updated = payload.new as Record<string, unknown>;
          const eventId = typeof updated.id === 'string' ? updated.id : null;
          const nextStatus = typeof updated.status === 'string' ? updated.status : undefined;
          const previousStatus = eventId
            ? statusSnapshot.current.get(eventId)
            : undefined;

          if (
            eventId &&
            previousStatus !== undefined &&
            nextStatus !== undefined &&
            previousStatus !== nextStatus &&
            typeof updated.title === 'string'
          ) {
            statusSnapshot.current.set(eventId, nextStatus);
            const status = nextStatus === 'closed' ? 'Closed' : 'Open';
            Alert.alert(
              'Event Status Updated',
              `"${updated.title}" is now ${status}.`
            );
            void loadData();
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [authorized]);

  const refresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const formatDate = (value: string | null) => {
    if (!value) return 'Not set';

    const date = new Date(value);

    return Number.isNaN(date.getTime())
      ? 'Invalid date'
      : date.toLocaleString();
  };

  const handleClose = (event: CloudEvent) => {
    Alert.alert(
      'Close Event',
      `Are you sure you want to close "${event.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Close',
          style: 'destructive',
          onPress: async () => {
            const result = await closeEvent(event.id);

            if (result.error) {
              Alert.alert('Error', result.error);
              return;
            }

            Alert.alert('Success', 'Event has been closed.');
            await loadData();
          },
        },
      ]
    );
  };


  const openEdit = (event: CloudEvent) => {
    setEditingEvent(event);
    setEditTitle(event.title ?? '');
    setEditCode(event.event_code ?? '');
    setEditVenue(event.venue ?? '');
    setEditDescription(event.description ?? '');
    setEditStartDate(event.start_time ? new Date(event.start_time) : new Date(Date.now() + 5 * 60 * 1000));
    setEditEndDate(event.end_time ? new Date(event.end_time) : new Date(Date.now() + 60 * 60 * 1000));
    setShowPicker(false);
    setEditingPart(null);
  };

  const formatEditDateTime = (date: Date) =>
    date.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const openPicker = (part: 'start' | 'end') => {
    setEditingPart(part);
    setPickerMode(Platform.OS === 'ios' ? 'datetime' : 'date');
    setShowPicker(true);
  };

  const onPickerChange = (event: { type?: string }, selectedDate?: Date) => {
    if (event.type === 'dismissed' || !selectedDate) {
      setShowPicker(false);
      return;
    }

    const currentDate = editingPart === 'end' ? editEndDate : editStartDate;

    if (Platform.OS === 'android' && pickerMode === 'date') {
      const nextDate = new Date(currentDate);
      nextDate.setFullYear(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        selectedDate.getDate()
      );
      if (editingPart === 'start') setEditStartDate(nextDate);
      else if (editingPart === 'end') setEditEndDate(nextDate);
      setPickerMode('time');
      return;
    }

    let nextDate: Date;
    if (Platform.OS === 'android' && pickerMode === 'time') {
      nextDate = new Date(currentDate);
      nextDate.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);
    } else {
      nextDate = selectedDate;
    }

    if (editingPart === 'start') setEditStartDate(nextDate);
    else if (editingPart === 'end') setEditEndDate(nextDate);
    setShowPicker(false);
  };

  const handleQuickEnd = (minutes: number) => {
    setEditEndDate(new Date(editStartDate.getTime() + minutes * 60 * 1000));
  };

  const handleSaveEdit = async () => {
    if (!editingEvent) return;
    if (!editTitle.trim() || !editCode.trim()) {
      Alert.alert('Missing Information', 'Please enter both the event title and event code.');
      return;
    }

    if (editEndDate <= editStartDate) {
      Alert.alert('Invalid Event Time', 'The event end time must be after its start time.');
      return;
    }

    if (editingEvent.status === 'closed' && editStartDate.getTime() < Date.now()) {
      Alert.alert('Choose a Future Start Time', 'To reopen a manually closed event, set its new start time to now or a future time. This keeps the event schedule from contradicting the past.');
      return;
    }

    setSavingEdit(true);
    try {
      const result = await updateEvent(editingEvent.id, {
        title: editTitle.trim(),
        event_code: editCode.trim(),
        venue: editVenue.trim() || null,
        description: editDescription.trim() || null,
        start_time: editStartDate.toISOString(),
        end_time: editEndDate.toISOString(),
        ...(editingEvent.status === 'closed' ? { status: 'open' as const } : {}),
      });

      if (result.error) {
        Alert.alert('Unable to Update Event', result.error);
        return;
      }

      setEditingEvent(null);
      setShowPicker(false);
      Alert.alert(editingEvent.status === 'closed' ? 'Event Reopened' : 'Event Updated', editingEvent.status === 'closed' ? `"${editTitle.trim()}" has been reopened with the updated schedule.` : `"${editTitle.trim()}" was updated successfully. If its QR code contains the old event details, generate or share an updated QR code.`);
      await loadData();
    } catch {
      Alert.alert('Unable to Update Event', 'Something went wrong while saving the event. Please try again.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = (event: CloudEvent) => {
    Alert.alert(
      'Delete Event',
      `Delete "${event.title}" permanently? Its attendance records will also be removed. This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Event',
          style: 'destructive',
          onPress: async () => {
            const result = await deleteEvent(event.id);

            if (result.error) {
              Alert.alert('Unable to Delete Event', result.error);
              return;
            }

            setEvents(current => current.filter(item => item.id !== event.id));
            Alert.alert('Event Deleted', `"${event.title}" was deleted.`);
            await loadData();
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView
        style={styles.center}
        edges={['top', 'left', 'right']}
      >
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>
          Loading event management...
        </Text>
      </SafeAreaView>
    );
  }

  if (!authorized) {
    return (
      <SafeAreaView
        style={styles.center}
        edges={['top', 'left', 'right']}
      >
        <Ionicons
          name="lock-closed-outline"
          size={34}
          color={COLORS.primary}
        />
        <Text style={styles.heroTitle}>Administrators Only</Text>
        <Text style={styles.description}>
          This page is available only to approved administrator accounts.
        </Text>
      </SafeAreaView>
    );
  }

  const openCount = events.filter(
    event => event.status !== 'closed'
  ).length;

  return (
    <SafeAreaView
      style={styles.container}
      edges={['top', 'left', 'right']}
    >
      <FlatList
        data={events}
        keyExtractor={item => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={COLORS.primary}
          />
        }
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View>
            <View style={styles.hero}>
              <View style={styles.eyebrowRow}>
                <View style={styles.eyebrowLine} />
                <Text style={styles.eyebrow}>ADMINISTRATION</Text>
              </View>

              <View style={styles.heroTitleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.heroTitle}>
                    Manage your{' '}
                    <Text style={styles.heroAccent}>school events.</Text>
                  </Text>
                </View>

                <Pressable
                  style={styles.refreshButton}
                  onPress={refresh}
                  accessibilityLabel="Refresh events"
                >
                  <Text style={{ fontSize: 21 }}>📅</Text>
                </Pressable>
              </View>

              <Text style={styles.description}>
                Review event details, monitor status changes, close events, or delete events when needed.
              </Text>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{events.length}</Text>
                <Text style={styles.statLabel}>TOTAL EVENTS</Text>
              </View>

              <View style={styles.statCard}>
                <Text style={[styles.statValue, { color: COLORS.success }]}>
                  {openCount}
                </Text>
                <Text style={styles.statLabel}>OPEN EVENTS</Text>
              </View>

              <View style={styles.statCard}>
                <Text style={[styles.statValue, { color: COLORS.error }]}>
                  {events.length - openCount}
                </Text>
                <Text style={styles.statLabel}>CLOSED EVENTS</Text>
              </View>
            </View>

            <View style={styles.sectionHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>All Events</Text>
                <Text style={styles.sectionSubtitle}>
                  Events created in the attendance system.
                </Text>
              </View>

              <View style={styles.countBadge}>
                <Text style={styles.countText}>{events.length}</Text>
              </View>
            </View>

            {events.length === 0 && (
              <Text style={styles.emptyText}>No events found yet.</Text>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.eventCard}>
            <View style={styles.eventHeader}>
              <Text style={styles.eventTitle}>{item.title}</Text>

              <View
                style={[
                  styles.statusBadge,
                  item.status === 'closed'
                    ? styles.closedBadge
                    : styles.openBadge,
                ]}
              >
                <Text style={styles.statusText}>
                  {item.status === 'closed' ? 'Closed' : 'Open'}
                </Text>
              </View>
            </View>

            <Text style={styles.eventCode}>
              Code: {item.event_code}
            </Text>

            <View style={styles.detailRow}>
              <Ionicons
                name="location-outline"
                size={15}
                color={COLORS.textSecondary}
              />
              <Text style={styles.eventDetail}>
                Venue: {item.venue || 'Not set'}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Ionicons
                name="time-outline"
                size={15}
                color={COLORS.textSecondary}
              />
              <Text style={styles.eventDetail}>
                Start: {formatDate(item.start_time)}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Ionicons
                name="calendar-outline"
                size={15}
                color={COLORS.textSecondary}
              />
              <Text style={styles.eventDetail}>
                End: {formatDate(item.end_time)}
              </Text>
            </View>

            {item.description ? (
              <Text style={styles.eventDescription}>
                {item.description}
              </Text>
            ) : null}

            <View style={styles.actionsRow}>
              <Pressable
                style={[styles.editButton, styles.actionButton]}
                onPress={() => openEdit(item)}
              >
                <Ionicons name="create-outline" size={16} color={COLORS.primary} />
                <Text style={styles.editButtonText}>{item.status === 'closed' ? 'Reopen & Edit' : 'Edit Event'}</Text>
              </Pressable>

              {item.status !== 'closed' && (
                <Pressable
                  style={[styles.closeButton, styles.actionButton]}
                  onPress={() => handleClose(item)}
                >
                  <Ionicons
                    name="lock-closed-outline"
                    size={16}
                    color={COLORS.error}
                  />
                  <Text style={styles.closeButtonText}>Close Event</Text>
                </Pressable>
              )}

              <Pressable
                style={[styles.deleteButton, styles.actionButton]}
                onPress={() => handleDelete(item)}
              >
                <Ionicons
                  name="trash-outline"
                  size={16}
                  color={COLORS.error}
                />
                <Text style={styles.deleteButtonText}>Delete Event</Text>
              </Pressable>
            </View>
          </View>
        )}
      />

      <Modal
        visible={editingEvent !== null}
        transparent
        animationType="fade"
        onRequestClose={() => !savingEdit && (setEditingEvent(null), setShowPicker(false))}
        statusBarTranslucent
      >
        <View style={styles.formModalBackdrop}>
          <View style={styles.eventFormModal}>
            <View style={styles.eventFormModalHeader}>
              <View style={styles.eventFormModalHeading}>
                <Text style={styles.modalEyebrow}>UPDATE DETAILS</Text>
                <Text style={styles.eventFormModalTitle}>Edit event details</Text>
              </View>
              <Pressable
                style={styles.modalCloseButton}
                onPress={() => !savingEdit && (setEditingEvent(null), setShowPicker(false))}
                disabled={savingEdit}
                accessibilityLabel="Close event form"
              >
                <Ionicons name="close" size={22} color={COLORS.textSecondary} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.eventFormScroll}
              contentContainerStyle={styles.eventFormScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.formCard}>
                <View style={styles.formCardHeading}>
                  <View style={styles.formHeadingIcon}>
                    <Ionicons name="clipboard-outline" size={23} color={COLORS.primary} />
                  </View>
                  <View style={styles.formHeadingText}>
                    <Text style={styles.formHeadingTitle}>Event information</Text>
                    <Text style={styles.formHeadingSubtitle}>Update the event details and schedule.</Text>
                  </View>
                </View>

                <Text style={styles.inputLabel}>EVENT TITLE</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. School Foundation Day"
                  placeholderTextColor={COLORS.textSecondary}
                  value={editTitle}
                  onChangeText={setEditTitle}
                  autoCapitalize="sentences"
                  maxLength={120}
                />

                <Text style={styles.inputLabel}>EVENT CODE</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. FOUNDATION2026"
                  placeholderTextColor={COLORS.textSecondary}
                  value={editCode}
                  onChangeText={setEditCode}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={80}
                />
                <Text style={styles.formHint}>Changing the code may require updating QR codes already shared.</Text>

                <Text style={styles.inputLabel}>VENUE</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. School Gymnasium"
                  placeholderTextColor={COLORS.textSecondary}
                  value={editVenue}
                  onChangeText={setEditVenue}
                  autoCapitalize="sentences"
                  maxLength={160}
                />

                <Text style={styles.inputLabel}>DESCRIPTION</Text>
                <TextInput
                  style={[styles.input, styles.descriptionInput]}
                  placeholder="Add a short event description..."
                  placeholderTextColor={COLORS.textSecondary}
                  value={editDescription}
                  onChangeText={setEditDescription}
                  multiline
                  textAlignVertical="top"
                  maxLength={1000}
                />

                <Text style={styles.inputLabel}>START DATE AND TIME</Text>
                <Pressable style={styles.dateButton} onPress={() => openPicker('start')}>
                  <View style={styles.dateButtonIcon}><Ionicons name="calendar-outline" size={20} color={COLORS.primary} /></View>
                  <View style={styles.dateButtonText}>
                    <Text style={styles.dateButtonLabel}>Starts</Text>
                    <Text style={styles.dateButtonValue}>{formatEditDateTime(editStartDate)}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
                </Pressable>

                <Text style={styles.inputLabel}>END DATE AND TIME</Text>
                <Pressable style={styles.dateButton} onPress={() => openPicker('end')}>
                  <View style={styles.dateButtonIcon}><Ionicons name="time-outline" size={20} color={COLORS.primary} /></View>
                  <View style={styles.dateButtonText}>
                    <Text style={styles.dateButtonLabel}>Ends</Text>
                    <Text style={styles.dateButtonValue}>{formatEditDateTime(editEndDate)}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
                </Pressable>

                <View style={styles.quickEndHeader}>
                  <Text style={styles.inputLabel}>QUICK END TIME</Text>
                  <Text style={styles.quickEndHint}>After start time</Text>
                </View>
                <View style={styles.quickEndRow}>
                  {[
                    { label: '30 min', minutes: 30 },
                    { label: '1 hour', minutes: 60 },
                    { label: '2 hours', minutes: 120 },
                    { label: '4 hours', minutes: 240 },
                  ].map(option => {
                    const selected = editEndDate.getTime() === editStartDate.getTime() + option.minutes * 60 * 1000;
                    return (
                      <Pressable
                        key={option.minutes}
                        style={[styles.quickEndButton, selected && styles.quickEndButtonSelected]}
                        onPress={() => handleQuickEnd(option.minutes)}
                      >
                        <Text style={[styles.quickEndText, selected && styles.quickEndTextSelected]}>{option.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                {showPicker && (
                  <DateTimePicker
                    key={`${editingPart ?? 'event'}-${pickerMode}`}
                    value={editingPart === 'end' ? editEndDate : editStartDate}
                    mode={pickerMode}
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={onPickerChange}
                  />
                )}

                <View style={styles.editActions}>
                  <Pressable
                    style={styles.cancelEditButton}
                    onPress={() => { setEditingEvent(null); setShowPicker(false); }}
                    disabled={savingEdit}
                  >
                    <Text style={styles.cancelEditText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.submitButton, savingEdit && styles.disabledButton]}
                    onPress={handleSaveEdit}
                    disabled={savingEdit}
                  >
                    {savingEdit ? <ActivityIndicator color={COLORS.textOnPrimary} /> : <Ionicons name="save-outline" size={21} color={COLORS.textOnPrimary} />}
                    <Text style={styles.submitButtonText}>{savingEdit ? 'Saving...' : 'Save Changes'}</Text>
                  </Pressable>
                </View>
              </View>
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
  content: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 36,
  },
  center: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  loadingText: {
    color: COLORS.textSecondary,
    marginTop: 12,
    fontSize: 13,
  },
  hero: {
    marginBottom: 22,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginBottom: 14,
  },
  eyebrowLine: {
    height: 3,
    width: 24,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
  },
  eyebrow: {
    color: COLORS.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
  },
  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  heroTitle: {
    color: COLORS.textPrimary,
    fontSize: 30,
    lineHeight: 38,
    fontWeight: '900',
  },
  heroAccent: {
    color: COLORS.primary,
  },
  description: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 12,
  },
  refreshButton: {
    width: 43,
    height: 43,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 9,
    marginBottom: 26,
  },
  statCard: {
    flex: 1,
    padding: 12,
    borderRadius: 16,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statValue: {
    color: COLORS.textPrimary,
    fontSize: 23,
    fontWeight: '900',
  },
  statLabel: {
    color: COLORS.textSecondary,
    fontSize: 9,
    fontWeight: '800',
    marginTop: 5,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 13,
  },
  sectionTitle: {
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: '900',
  },
  sectionSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  countBadge: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: COLORS.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    color: COLORS.primaryLight,
    fontSize: 13,
    fontWeight: '900',
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    paddingVertical: 18,
  },
  eventCard: {
    padding: 16,
    marginBottom: 12,
    borderRadius: 18,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  eventTitle: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '800',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  openBadge: {
    backgroundColor: COLORS.successBackground,
    borderColor: COLORS.success,
  },
  closedBadge: {
    backgroundColor: COLORS.errorBackground,
    borderColor: COLORS.error,
  },
  statusText: {
    color: COLORS.textPrimary,
    fontSize: 11,
    fontWeight: '800',
  },
  eventCode: {
    marginTop: 7,
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    marginTop: 8,
  },
  eventDetail: {
    flex: 1,
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  eventDescription: {
    marginTop: 11,
    color: COLORS.textPrimary,
    fontSize: 13,
    lineHeight: 20,
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
    marginTop: 14,
  },
  actionButton: {
    marginTop: 0,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 7,
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 11,
    backgroundColor: COLORS.primaryMuted,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  editButtonText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.62)',
  },
  editSheet: {
    maxHeight: '92%',
    minHeight: '55%',
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  editHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  editTitle: {
    color: COLORS.textPrimary,
    fontSize: 21,
    fontWeight: '900',
  },
  editSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  modalCloseButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.card,
  },
  editFormContent: {
    paddingTop: 16,
    paddingBottom: 12,
  },
  fieldLabel: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 7,
    marginTop: 12,
  },
  editInput: {
    color: COLORS.textPrimary,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 12,
    fontSize: 14,
  },
  fieldHint: {
    color: COLORS.textSecondary,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 6,
  },
  editTextArea: {
    minHeight: 94,
    paddingTop: 12,
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 22,
  },
  cancelEditButton: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelEditText: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  saveEditButton: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  saveEditText: {
    color: COLORS.background,
    fontSize: 13,
    fontWeight: '900',
  },
  disabledButton: {
    opacity: 0.65,
  },
  closeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 7,
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 11,
    backgroundColor: COLORS.errorBackground,
  },
  closeButtonText: {
    color: COLORS.error,
    fontSize: 12,
    fontWeight: '800',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 7,
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 11,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  deleteButtonText: {
    color: COLORS.error,
    fontSize: 12,
    fontWeight: '800',
  },
  formModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  eventFormModal: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '92%',
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 24,
    padding: 18,
    overflow: 'hidden',
  },
  eventFormModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  eventFormModalHeading: { flex: 1, gap: 5 },
  modalEyebrow: {
    color: COLORS.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.8,
  },
  eventFormModalTitle: {
    color: COLORS.textPrimary,
    fontSize: 25,
    fontWeight: '900',
  },
  eventFormScroll: { flexShrink: 1 },
  eventFormScrollContent: { paddingBottom: 12 },
  formCard: {
    backgroundColor: COLORS.card,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
    marginBottom: 12,
  },
  formCardHeading: { flexDirection: 'row', alignItems: 'center', marginBottom: 24, gap: 12 },
  formHeadingIcon: {
    width: 46, height: 46, borderRadius: 15, backgroundColor: COLORS.surface,
    justifyContent: 'center', alignItems: 'center',
  },
  formHeadingText: { flex: 1 },
  formHeadingTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '800' },
  formHeadingSubtitle: { color: COLORS.textSecondary, fontSize: 12, marginTop: 4 },
  inputLabel: {
    color: COLORS.textSecondary, fontSize: 10, fontWeight: '800', letterSpacing: 1.2,
    marginBottom: 9, marginTop: 4,
  },
  input: {
    backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 13, paddingHorizontal: 14, paddingVertical: 13,
    color: COLORS.textPrimary, fontSize: 14, marginBottom: 19,
  },
  descriptionInput: { minHeight: 95, paddingTop: 14 },
  formHint: { color: COLORS.textSecondary, fontSize: 11, lineHeight: 16, marginTop: -12, marginBottom: 16 },
  dateButton: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.background,
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, padding: 12,
    marginBottom: 19, gap: 12,
  },
  dateButtonIcon: {
    width: 39, height: 39, borderRadius: 12, backgroundColor: COLORS.surface,
    justifyContent: 'center', alignItems: 'center',
  },
  dateButtonText: { flex: 1 },
  dateButtonLabel: { color: COLORS.textSecondary, fontSize: 11, marginBottom: 4 },
  dateButtonValue: { color: COLORS.textPrimary, fontSize: 12, fontWeight: '700' },
  quickEndHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  quickEndHint: { color: COLORS.textSecondary, fontSize: 10 },
  quickEndRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  quickEndButton: {
    flexGrow: 1, minWidth: '20%', paddingVertical: 10, paddingHorizontal: 8,
    borderRadius: 10, borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center', backgroundColor: COLORS.background,
  },
  quickEndButtonSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  quickEndText: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '700' },
  quickEndTextSelected: { color: COLORS.textOnPrimary },
  submitButton: {
    flex: 1, minHeight: 48, backgroundColor: COLORS.primary, borderRadius: 15,
    paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10,
  },
  submitButtonText: { color: COLORS.textOnPrimary, fontSize: 14, fontWeight: '800' },

});
