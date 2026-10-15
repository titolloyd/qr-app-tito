import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';

import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import {
  closeEvent,
  createEvent,
  getEventsByTeacher,
  updateEvent,
  CloudEvent,
} from '@/lib/events';
import { getProfile, Role } from '@/lib/profiles';
import { buildQRPayload } from '@/lib/qr';

type EditTarget = 'start' | 'end' | null;

type QREventInfo = {
  title: string;
  eventCode: string;
  payload: string;
};

// Include the timezone when saving timestamps to Supabase. A local datetime
// without an offset can shift when the event is fetched again.
const toLocalISO = (date: Date) => date.toISOString();

const formatDateTime = (date: Date) => {
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatEventDate = (value: string | null | undefined) => {
  if (!value) return 'Not set';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return 'Not set';

  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

type EventDisplayStatus = 'upcoming' | 'ongoing' | 'ended' | 'closed';

const getEventDisplayStatus = (
  event: CloudEvent,
  now: number
): EventDisplayStatus => {
  // A teacher's manual close always takes precedence over the scheduled times.
  if (event.status === 'closed') return 'closed';

  const start = event.start_time ? new Date(event.start_time).getTime() : null;
  const end = event.end_time ? new Date(event.end_time).getTime() : null;

  if (start !== null && Number.isFinite(start) && now < start) {
    return 'upcoming';
  }

  if (end !== null && Number.isFinite(end) && now >= end) {
    return 'ended';
  }

  return 'ongoing';
};

export default function TeacherScreen() {
  const { user } = useAuth();

  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [events, setEvents] = useState<CloudEvent[]>([]);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [message, setMessage] = useState('');

  const [title, setTitle] = useState('');
  const [eventId, setEventId] = useState('');
  const [venue, setVenue] = useState('');
  const [description, setDescription] = useState('');

  const [startDate, setStartDate] = useState(
    () => new Date(Date.now() + 5 * 60 * 1000)
  );
  const [endDate, setEndDate] = useState(
    () => new Date(Date.now() + 60 * 60 * 1000)
  );

  const [showPicker, setShowPicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<'date' | 'time' | 'datetime'>(
    Platform.OS === 'ios' ? 'datetime' : 'date'
  );
  const [editingPart, setEditingPart] = useState<EditTarget>(null);
  const [editTarget, setEditTarget] = useState<CloudEvent | null>(null);

  const [qrEvent, setQrEvent] = useState<QREventInfo | null>(null);
  const [showEventForm, setShowEventForm] = useState(false);

  // Keep Upcoming / Ongoing / Ended labels updated while this screen is open.
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const loadData = useCallback(async () => {
    if (!user?.id) {
      setRole(null);
      setEvents([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const profile = await getProfile(user.id);
      const currentRole = profile?.role ?? 'student';
      const approvedTeacher = currentRole === 'teacher' && profile?.approval_status === 'approved';

      setRole(approvedTeacher ? 'teacher' : currentRole);

      if (approvedTeacher) {
        const teacherEvents = await getEventsByTeacher(user.id);
        setEvents(teacherEvents);
      } else {
        setEvents([]);
      }
    } catch (error) {
      console.error('Failed to load teacher events:', error);
      setMessage('Unable to load your events. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const resetForm = () => {
    setShowEventForm(false);
    setTitle('');
    setEventId('');
    setVenue('');
    setDescription('');
    setStartDate(new Date(Date.now() + 5 * 60 * 1000));
    setEndDate(new Date(Date.now() + 60 * 60 * 1000));
    setEditTarget(null);
    setMessage('');
  };

  const openPicker = (part: EditTarget) => {
    setEditingPart(part);
    // Android's native picker supports date and time separately, not datetime.
    // iOS supports the combined date/time spinner.
    setPickerMode(Platform.OS === 'ios' ? 'datetime' : 'date');
    setShowPicker(true);
  };

  const onPickerChange = (
    event: { type?: string },
    selectedDate?: Date
  ) => {
    if (event.type === 'dismissed' || !selectedDate) {
      setShowPicker(false);
      return;
    }

    const currentDate = editingPart === 'end' ? endDate : startDate;

    if (Platform.OS === 'android' && pickerMode === 'date') {
      // Keep the currently selected time while changing the calendar date,
      // then remount the native picker in time mode.
      const nextDate = new Date(currentDate);
      nextDate.setFullYear(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        selectedDate.getDate()
      );

      if (editingPart === 'start') {
        setStartDate(nextDate);
      } else if (editingPart === 'end') {
        setEndDate(nextDate);
      }

      setPickerMode('time');
      return;
    }

    let nextDate: Date;

    if (Platform.OS === 'android' && pickerMode === 'time') {
      // Keep the date selected in the previous step and apply the chosen time.
      nextDate = new Date(currentDate);
      nextDate.setHours(
        selectedDate.getHours(),
        selectedDate.getMinutes(),
        0,
        0
      );
    } else {
      // iOS uses the combined date/time picker.
      nextDate = selectedDate;
    }

    if (editingPart === 'start') {
      setStartDate(nextDate);
    } else if (editingPart === 'end') {
      setEndDate(nextDate);
    }

    setShowPicker(false);
  };

  const handleQuickEnd = (minutes: number) => {
    setEndDate(
      new Date(startDate.getTime() + minutes * 60 * 1000)
    );
  };

  const handleCreateEvent = async () => {
    setMessage('');

    if (!user?.id) {
      setMessage('Please log in before creating an event.');
      return;
    }

    if (!title.trim() || !eventId.trim()) {
      setMessage('Please enter both the event title and event code.');
      return;
    }

    if (startDate <= new Date()) {
      setMessage('The event start time must be in the future.');
      return;
    }

    if (endDate <= startDate) {
      setMessage('The event end time must be after its start time.');
      return;
    }

    try {
      setSaving(true);

      const result = await createEvent({
        event_code: eventId.trim(),
        title: title.trim(),
        start_time: toLocalISO(startDate),
        end_time: toLocalISO(endDate),
        venue: venue.trim() || null,
        description: description.trim() || null,
      });

      if (result.error) {
        setMessage(result.error);
        return;
      }


      const payload = buildQRPayload({
        eventId: eventId.trim(),
        title: title.trim(),
        start: toLocalISO(startDate),
        end: toLocalISO(endDate),
      });

      setQrEvent({
        title: title.trim(),
        eventCode: eventId.trim(),
        payload,
      });

      resetForm();
      await loadData();
    } catch (error) {
      console.error('Create event error:', error);
      setMessage('Something went wrong while creating the event.');
    } finally {
      setSaving(false);
    }
  };

  const handleEditEvent = (event: CloudEvent) => {
    setEditTarget(event);
    setTitle(event.title);
    setEventId(event.event_code);
    setVenue(event.venue ?? '');
    setDescription(event.description ?? '');

    setStartDate(
      event.start_time ? new Date(event.start_time) : new Date()
    );

    setEndDate(
      event.end_time
        ? new Date(event.end_time)
        : new Date(Date.now() + 60 * 60 * 1000)
    );

    setMessage('');
    setShowEventForm(true);
  };

  const handleUpdateEvent = async () => {
    if (!editTarget) return;

    setMessage('');

    if (!title.trim() || !eventId.trim()) {
      setMessage('Please enter both the event title and event code.');
      return;
    }

    if (endDate <= startDate) {
      setMessage('The event end time must be after its start time.');
      return;
    }

    if (editTarget.status === 'closed' && startDate.getTime() < Date.now()) {
      setMessage('To reopen a closed event, choose a start time that is now or in the future.');
      return;
    }

    const wasClosed = editTarget.status === 'closed';

    try {
      setSaving(true);

      const result = await updateEvent(editTarget.id, {
        title: title.trim(),
        event_code: eventId.trim(),
        start_time: toLocalISO(startDate),
        end_time: toLocalISO(endDate),
        venue: venue.trim() || null,
        description: description.trim() || null,
        ...(wasClosed ? { status: 'open' as const } : {}),
      });

      if (result.error) {
        setMessage(result.error);
        return;
      }

      const payload = buildQRPayload({
        eventId: eventId.trim(),
        title: title.trim(),
        start: toLocalISO(startDate),
        end: toLocalISO(endDate),
      });

      setQrEvent({
        title: title.trim(),
        eventCode: eventId.trim(),
        payload,
      });

      resetForm();
      if (wasClosed) {
        setMessage('Event reopened and updated successfully.');
      }
      await loadData();
    } catch (error) {
      console.error('Update event error:', error);
      setMessage('Something went wrong while updating the event.');
    } finally {
      setSaving(false);
    }
  };

  const handleCloseEvent = async (event: CloudEvent) => {
    try {
      setMessage('');

      const result = await closeEvent(event.id);

      if (result.error) {
        setMessage(result.error);
        return;
      }

      await loadData();
    } catch (error) {
      console.error('Close event error:', error);
      setMessage('Unable to close this event. Please try again.');
    }
  };

  const handleShowQR = (event: CloudEvent) => {
    const payload = buildQRPayload({
      eventId: event.event_code,
      title: event.title,
      start: event.start_time ?? undefined,
      end: event.end_time ?? undefined,
    });

    setQrEvent({
      title: event.title,
      eventCode: event.event_code,
      payload,
    });
  };

  const totalEvents = events.length;

  const openEvents = events.filter(
    (event) => event.status !== 'closed'
  ).length;

  if (loading) {
    return (
      <SafeAreaView
        style={styles.loadingContainer}
        edges={['top']}
      >
        <ActivityIndicator size="large" color={COLORS.primary} />

        <Text style={styles.loadingText}>
          Loading event dashboard...
        </Text>
      </SafeAreaView>
    );
  }

  if (role !== 'teacher') {
    return (
      <SafeAreaView
        style={styles.loadingContainer}
        edges={['top']}
      >
        <View style={styles.restrictedIcon}>
          <Ionicons
            name="lock-closed-outline"
            size={32}
            color={COLORS.primary}
          />
        </View>

        <Text style={styles.restrictedTitle}>Teachers Only</Text>

        <Text style={styles.restrictedText}>
          {role === 'student'
            ? 'Teacher features are available only after an administrator approves your teacher account request.'
            : 'This page is available only to approved teacher accounts.'}
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Page introduction */}
        <View style={styles.hero}>
          <View style={styles.eyebrowRow}>
            <View style={styles.eyebrowLine} />
            <Text style={styles.eyebrow}>TEACHER DASHBOARD</Text>
          </View>

          <View style={styles.heroTitleRow}>
            <Text style={styles.heroTitle}>
              Manage your{'\n'}
              <Text style={styles.heroAccent}>school events.</Text>
            </Text>

            <Pressable
              style={({ pressed }) => [styles.refreshButton, pressed && styles.buttonPressed]}
              onPress={loadData}
              accessibilityLabel="Refresh events"
              hitSlop={8}
            >
              <Text style={{ fontSize: 21 }}>📅</Text>
            </Pressable>
          </View>

          <Text style={styles.heroDescription}>
            Create events, manage attendance sessions, and share QR codes
            with your students.
          </Text>
        </View>

        {/* Event statistics */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={styles.statIcon}>
              <Ionicons
                name="calendar-outline"
                size={20}
                color={COLORS.primary}
              />
            </View>

            <Text style={styles.statValue}>{totalEvents}</Text>
            <Text style={styles.statLabel}>TOTAL EVENTS</Text>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statIcon}>
              <Ionicons
                name="radio-button-on-outline"
                size={20}
                color={COLORS.success}
              />
            </View>

            <Text style={styles.statValue}>{openEvents}</Text>
            <Text style={styles.statLabel}>OPEN EVENTS</Text>
          </View>
        </View>

        {/* Create event action */}
        <Pressable
          style={({ pressed }) => [styles.createEventButton, pressed && styles.buttonPressed]}
          onPress={() => {
            resetForm();
            setShowEventForm(true);
          }}
        >
          <Ionicons name="add-circle-outline" size={21} color={COLORS.textOnPrimary} />
          <Text style={styles.createEventButtonText}>Create Event</Text>
        </Pressable>

        {/* Existing events */}
        <View style={styles.eventsSection}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Your Events</Text>
              <Text style={styles.sectionSubtitle}>
                Manage your existing school activities.
              </Text>
            </View>

            <View style={styles.eventCountBadge}>
              <Text style={styles.eventCountText}>{events.length}</Text>
            </View>
          </View>

          {events.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIcon}>
                <Ionicons
                  name="calendar-outline"
                  size={29}
                  color={COLORS.primary}
                />
              </View>

              <Text style={styles.emptyTitle}>No events yet</Text>

              <Text style={styles.emptyDescription}>
                Create your first school event using the form above. Your
                events will appear here once they are saved.
              </Text>
            </View>
          ) : (
            <View style={styles.eventList}>
              {events.map((event) => {
                const displayStatus = getEventDisplayStatus(event, currentTime);
                const isClosed = displayStatus === 'closed';
                const statusLabel = {
                  upcoming: 'Upcoming',
                  ongoing: 'Ongoing',
                  ended: 'Ended',
                  closed: 'Closed',
                }[displayStatus];
                const statusBadgeStyle = {
                  upcoming: styles.upcomingStatus,
                  ongoing: styles.ongoingStatus,
                  ended: styles.endedStatus,
                  closed: styles.closedStatus,
                }[displayStatus];
                const statusDotStyle = {
                  upcoming: styles.upcomingDot,
                  ongoing: styles.ongoingDot,
                  ended: styles.endedDot,
                  closed: styles.closedDot,
                }[displayStatus];
                const statusTextStyle = {
                  upcoming: styles.upcomingStatusText,
                  ongoing: styles.ongoingStatusText,
                  ended: styles.endedStatusText,
                  closed: styles.closedStatusText,
                }[displayStatus];

                return (
                  <View key={event.id} style={styles.eventCard}>
                    <View style={styles.eventCardTop}>
                      <View style={styles.eventIcon}>
                        <Ionicons
                          name="qr-code-outline"
                          size={23}
                          color={COLORS.primary}
                        />
                      </View>

                      <View style={styles.eventTitleContainer}>
                        <Text style={styles.eventTitle}>
                          {event.title}
                        </Text>

                        <Text style={styles.eventCode}>
                          CODE: {event.event_code}
                        </Text>
                      </View>

                      <View
                        style={[styles.statusBadge, statusBadgeStyle]}
                      >
                        <View style={[styles.statusDot, statusDotStyle]} />

                        <Text style={[styles.statusText, statusTextStyle]}>
                          {statusLabel}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.eventDivider} />

                    <View style={styles.eventDetailRow}>
                      <Ionicons
                        name="time-outline"
                        size={17}
                        color={COLORS.textSecondary}
                      />

                      <View style={styles.eventDetailText}>
                        <Text style={styles.eventDetailLabel}>Starts</Text>
                        <Text style={styles.eventDetailValue}>
                          {formatEventDate(event.start_time)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.eventDetailRow}>
                      <Ionicons
                        name="flag-outline"
                        size={17}
                        color={COLORS.textSecondary}
                      />

                      <View style={styles.eventDetailText}>
                        <Text style={styles.eventDetailLabel}>Ends</Text>
                        <Text style={styles.eventDetailValue}>
                          {formatEventDate(event.end_time)}
                        </Text>
                      </View>
                    </View>

                    {!!event.venue && (
                      <View style={styles.eventDetailRow}>
                        <Ionicons
                          name="location-outline"
                          size={17}
                          color={COLORS.textSecondary}
                        />

                        <View style={styles.eventDetailText}>
                          <Text style={styles.eventDetailLabel}>Venue</Text>
                          <Text style={styles.eventDetailValue}>
                            {event.venue}
                          </Text>
                        </View>
                      </View>
                    )}

                    <View style={styles.eventActions}>
                      <Pressable
                        style={styles.qrButton}
                        onPress={() => handleShowQR(event)}
                      >
                        <Ionicons
                          name="qr-code-outline"
                          size={18}
                          color={COLORS.textOnPrimary}
                        />

                        <Text style={styles.qrButtonText}>View QR</Text>
                      </Pressable>

                      <Pressable
                        style={styles.editButton}
                        onPress={() => handleEditEvent(event)}
                      >
                        <Ionicons
                          name="create-outline"
                          size={18}
                          color={COLORS.textPrimary}
                        />

                        <Text style={styles.editButtonText}>{isClosed ? 'Reopen & Edit' : 'Edit'}</Text>
                      </Pressable>

                      {!isClosed && (
                        <Pressable
                          style={styles.closeButton}
                          onPress={() => handleCloseEvent(event)}
                        >
                          <Ionicons
                            name="lock-closed-outline"
                            size={17}
                            color="#FF6B6B"
                          />
                        </Pressable>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.footerLine} />
          <Text style={styles.footerText}>QR ATTENDANCE</Text>
          <Text style={styles.footerSubtext}>
            School Event Management
          </Text>
        </View>
      </ScrollView>

      {/* Create / edit event popup */}
      <Modal
        visible={showEventForm}
        transparent
        animationType="fade"
        onRequestClose={resetForm}
        statusBarTranslucent
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.eventFormModal}>
            <View style={styles.eventFormModalHeader}>
              <View style={styles.eventFormModalHeading}>
                <Text style={styles.modalEyebrow}>{editTarget ? 'UPDATE DETAILS' : 'EVENT SETUP'}</Text>
                <Text style={styles.eventFormModalTitle}>{editTarget ? 'Edit event details' : 'Create a school event'}</Text>
              </View>
              <Pressable
                style={styles.modalCloseButton}
                onPress={resetForm}
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
              <Ionicons
                name="clipboard-outline"
                size={23}
                color={COLORS.primary}
              />
            </View>

            <View style={styles.formHeadingText}>
              <Text style={styles.formHeadingTitle}>
                Event information
              </Text>

              <Text style={styles.formHeadingSubtitle}>
                Add the event details and schedule.
              </Text>
            </View>
          </View>

          <Text style={styles.inputLabel}>EVENT TITLE</Text>

          <TextInput
            style={styles.input}
            placeholder="e.g. School Foundation Day"
            placeholderTextColor={COLORS.textSecondary}
            value={title}
            onChangeText={setTitle}
            autoCapitalize="sentences"
          />

          <Text style={styles.inputLabel}>EVENT CODE</Text>

          <TextInput
            style={styles.input}
            placeholder="e.g. FOUNDATION2026"
            placeholderTextColor={COLORS.textSecondary}
            value={eventId}
            onChangeText={setEventId}
            autoCapitalize="characters"
            autoCorrect={false}
          />

          <Text style={styles.inputLabel}>VENUE</Text>

          <TextInput
            style={styles.input}
            placeholder="e.g. School Gymnasium"
            placeholderTextColor={COLORS.textSecondary}
            value={venue}
            onChangeText={setVenue}
            autoCapitalize="sentences"
          />

          <Text style={styles.inputLabel}>DESCRIPTION</Text>

          <TextInput
            style={[styles.input, styles.descriptionInput]}
            placeholder="Add a short event description..."
            placeholderTextColor={COLORS.textSecondary}
            value={description}
            onChangeText={setDescription}
            multiline
            textAlignVertical="top"
          />

          <Text style={styles.inputLabel}>START DATE AND TIME</Text>

          <Pressable
            style={styles.dateButton}
            onPress={() => openPicker('start')}
          >
            <View style={styles.dateButtonIcon}>
              <Ionicons
                name="calendar-outline"
                size={20}
                color={COLORS.primary}
              />
            </View>

            <View style={styles.dateButtonText}>
              <Text style={styles.dateButtonLabel}>Starts</Text>
              <Text style={styles.dateButtonValue}>
                {formatDateTime(startDate)}
              </Text>
            </View>

            <Ionicons
              name="chevron-forward"
              size={18}
              color={COLORS.textSecondary}
            />
          </Pressable>

          <Text style={styles.inputLabel}>END DATE AND TIME</Text>

          <Pressable
            style={styles.dateButton}
            onPress={() => openPicker('end')}
          >
            <View style={styles.dateButtonIcon}>
              <Ionicons
                name="time-outline"
                size={20}
                color={COLORS.primary}
              />
            </View>

            <View style={styles.dateButtonText}>
              <Text style={styles.dateButtonLabel}>Ends</Text>
              <Text style={styles.dateButtonValue}>
                {formatDateTime(endDate)}
              </Text>
            </View>

            <Ionicons
              name="chevron-forward"
              size={18}
              color={COLORS.textSecondary}
            />
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
            ].map((option) => {
              const selected =
                endDate.getTime() ===
                startDate.getTime() + option.minutes * 60 * 1000;

              return (
                <Pressable
                  key={option.minutes}
                  style={[
                    styles.quickEndButton,
                    selected && styles.quickEndButtonSelected,
                  ]}
                  onPress={() => handleQuickEnd(option.minutes)}
                >
                  <Text
                    style={[
                      styles.quickEndText,
                      selected && styles.quickEndTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {showPicker && (
            <DateTimePicker
              key={`${editingPart ?? 'event'}-${pickerMode}`}
              value={editingPart === 'end' ? endDate : startDate}
              mode={pickerMode}
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={onPickerChange}
              minimumDate={pickerMode === 'date' ? new Date() : undefined}
            />
          )}

          {!!message && (
            <View style={styles.messageBox}>
              <Ionicons
                name="alert-circle-outline"
                size={19}
                color="#FF6B6B"
              />

              <Text style={styles.messageText}>{message}</Text>
            </View>
          )}

          <Pressable
            style={({ pressed }) => [
              styles.submitButton,
              pressed && styles.buttonPressed,
              saving && styles.disabledButton,
            ]}
            onPress={editTarget ? handleUpdateEvent : handleCreateEvent}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={COLORS.textOnPrimary} />
            ) : (
              <>
                <Ionicons
                  name={editTarget ? 'save-outline' : 'add-circle-outline'}
                  size={21}
                  color={COLORS.textOnPrimary}
                />

                <Text style={styles.submitButtonText}>
                  {editTarget ? 'Save Changes' : 'Create Event'}
                </Text>
              </>
            )}
          </Pressable>

          {!editTarget && (
            <Text style={styles.formFootnote}>
              Your event will be saved and a QR code will be generated.
            </Text>
          )}
        </View>

            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* QR code popup */}
      <Modal
        visible={!!qrEvent}
        transparent
        animationType="fade"
        onRequestClose={() => setQrEvent(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.qrModal}>
            <Pressable
              style={styles.modalCloseButton}
              onPress={() => setQrEvent(null)}
              accessibilityLabel="Close QR code"
            >
              <Ionicons
                name="close"
                size={22}
                color={COLORS.textSecondary}
              />
            </Pressable>

            <View style={styles.modalQrIcon}>
              <Ionicons
                name="qr-code-outline"
                size={27}
                color={COLORS.primary}
              />
            </View>

            <Text style={styles.modalEyebrow}>EVENT QR CODE</Text>

            <Text style={styles.modalTitle}>
              {qrEvent?.title ?? 'Event QR Code'}
            </Text>

            <Text style={styles.modalDescription}>
              Students can scan this code to record their attendance.
            </Text>

            {qrEvent && (
              <>
                <View style={styles.qrCodeContainer}>
                  <QRCode
                    value={qrEvent.payload}
                    size={210}
                    backgroundColor="#FFFFFF"
                    color="#17151D"
                  />
                </View>

                <View style={styles.modalEventCode}>
                  <Text style={styles.modalEventCodeLabel}>
                    EVENT CODE
                  </Text>

                  <Text style={styles.modalEventCodeValue}>
                    {qrEvent.eventCode}
                  </Text>
                </View>
              </>
            )}

            <Pressable
              style={styles.modalDoneButton}
              onPress={() => setQrEvent(null)}
            >
              <Text style={styles.modalDoneText}>Done</Text>
            </Pressable>
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

  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },

  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },

  loadingText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginTop: 14,
  },

  createEventButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 28,
  },

  createEventButtonText: {
    color: COLORS.textOnPrimary,
    fontSize: 15,
    fontWeight: '800',
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

  eventFormModalHeading: {
    flex: 1,
    gap: 5,
  },

  eventFormModalTitle: {
    color: COLORS.textPrimary,
    fontSize: 25,
    fontWeight: '900',
  },

  eventFormScroll: {
    flexShrink: 1,
  },

  eventFormScrollContent: {
    paddingBottom: 12,
  },

  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  brandIcon: {
    width: 47,
    height: 47,
    borderRadius: 15,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },

  brandTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.5,
  },

  brandSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.4,
    marginTop: 4,
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

  hero: {
    marginBottom: 24,
  },

  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
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

  heroTitle: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '900',
    letterSpacing: -1.4,
  },

  heroAccent: {
    color: COLORS.primary,
  },

  heroDescription: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 22,
    marginTop: 14,
    maxWidth: 340,
  },

  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 34,
  },

  statCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    padding: 16,
  },

  statIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },

  statValue: {
    color: COLORS.textPrimary,
    fontSize: 28,
    fontWeight: '900',
  },

  statLabel: {
    color: COLORS.textSecondary,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.1,
    marginTop: 5,
  },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },

  sectionTitle: {
    color: COLORS.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },

  sectionSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
  },

  cancelEditButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  cancelEditText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },

  formCard: {
    backgroundColor: COLORS.card,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
    marginBottom: 36,
  },

  formCardHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 12,
  },

  formHeadingIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },

  formHeadingText: {
    flex: 1,
  },

  formHeadingTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },

  formHeadingSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },

  inputLabel: {
    color: COLORS.textSecondary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 9,
    marginTop: 4,
  },

  input: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: COLORS.textPrimary,
    fontSize: 14,
    marginBottom: 19,
  },

  descriptionInput: {
    minHeight: 95,
    paddingTop: 14,
  },

  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 12,
    marginBottom: 19,
    gap: 12,
  },

  dateButtonIcon: {
    width: 39,
    height: 39,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },

  dateButtonText: {
    flex: 1,
  },

  dateButtonLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginBottom: 4,
  },

  dateButtonValue: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },

  quickEndHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },

  quickEndHint: {
    color: COLORS.textSecondary,
    fontSize: 10,
  },

  quickEndRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },

  quickEndButton: {
    flexGrow: 1,
    minWidth: '20%',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },

  quickEndButtonSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },

  quickEndText: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },

  quickEndTextSelected: {
    color: COLORS.textOnPrimary,
  },

  messageBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    marginBottom: 16,
  },

  messageText: {
    flex: 1,
    color: '#FF6B6B',
    fontSize: 12,
    lineHeight: 18,
  },

  submitButton: {
    minHeight: 53,
    backgroundColor: COLORS.primary,
    borderRadius: 15,
    paddingHorizontal: 18,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },

  buttonPressed: {
    opacity: 0.8,
  },

  disabledButton: {
    opacity: 0.6,
  },

  submitButtonText: {
    color: COLORS.textOnPrimary,
    fontSize: 14,
    fontWeight: '800',
  },

  formFootnote: {
    color: COLORS.textSecondary,
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 13,
  },

  eventsSection: {
    marginBottom: 12,
  },

  eventCountBadge: {
    minWidth: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },

  eventCountText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '800',
  },

  emptyCard: {
    backgroundColor: COLORS.card,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 24,
    paddingVertical: 32,
    alignItems: 'center',
  },

  emptyIcon: {
    width: 62,
    height: 62,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 17,
  },

  emptyTitle: {
    color: COLORS.textPrimary,
    fontSize: 17,
    fontWeight: '800',
  },

  emptyDescription: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 9,
  },

  eventList: {
    gap: 14,
  },

  eventCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
  },

  eventCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },

  eventIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },

  eventTitleContainer: {
    flex: 1,
  },

  eventTitle: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },

  eventCode: {
    color: COLORS.textSecondary,
    fontSize: 10,
    letterSpacing: 0.8,
    fontWeight: '700',
    marginTop: 5,
  },

  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 9,
  },

  upcomingStatus: {
    backgroundColor: 'rgba(90, 156, 255, 0.13)',
  },

  ongoingStatus: {
    backgroundColor: 'rgba(83, 190, 135, 0.12)',
  },

  endedStatus: {
    backgroundColor: 'rgba(255, 173, 66, 0.13)',
  },

  closedStatus: {
    backgroundColor: 'rgba(150, 150, 165, 0.12)',
  },

  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  upcomingDot: {
    backgroundColor: '#5A9CFF',
  },

  ongoingDot: {
    backgroundColor: COLORS.success,
  },

  endedDot: {
    backgroundColor: '#FFAD42',
  },

  closedDot: {
    backgroundColor: COLORS.textSecondary,
  },

  statusText: {
    fontSize: 10,
    fontWeight: '800',
  },

  upcomingStatusText: {
    color: '#5A9CFF',
  },

  ongoingStatusText: {
    color: COLORS.success,
  },

  endedStatusText: {
    color: '#FFAD42',
  },

  closedStatusText: {
    color: COLORS.textSecondary,
  },

  eventDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 16,
  },

  eventDetailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },

  eventDetailText: {
    flex: 1,
  },

  eventDetailLabel: {
    color: COLORS.textSecondary,
    fontSize: 10,
    marginBottom: 4,
  },

  eventDetailValue: {
    color: COLORS.textPrimary,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },

  eventActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 7,
  },

  qrButton: {
    flex: 1,
    minHeight: 43,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 10,
  },

  qrButtonText: {
    color: COLORS.textOnPrimary,
    fontSize: 12,
    fontWeight: '800',
  },

  editButton: {
    minHeight: 43,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
  },

  editButtonText: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },

  closeButton: {
    width: 43,
    height: 43,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },

  footer: {
    alignItems: 'center',
    paddingTop: 25,
    paddingBottom: 12,
  },

  footerLine: {
    width: 35,
    height: 3,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
    marginBottom: 13,
  },

  footerText: {
    color: COLORS.textSecondary,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
  },

  footerSubtext: {
    color: COLORS.textSecondary,
    fontSize: 10,
    marginTop: 5,
  },

  restrictedIcon: {
    width: 72,
    height: 72,
    borderRadius: 23,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },

  restrictedTitle: {
    color: COLORS.textPrimary,
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 10,
  },

  restrictedText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 290,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(8, 7, 13, 0.86)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },

  qrModal: {
    width: '100%',
    maxWidth: 390,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 26,
    padding: 24,
    alignItems: 'center',
  },

  modalCloseButton: {
    alignSelf: 'flex-end',
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 5,
  },

  modalQrIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },

  modalEyebrow: {
    color: COLORS.primary,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
  },

  modalTitle: {
    color: COLORS.textPrimary,
    fontSize: 22,
    lineHeight: 29,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 9,
  },

  modalDescription: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 9,
    marginBottom: 22,
  },

  qrCodeContainer: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  modalEventCode: {
    width: '100%',
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 13,
    padding: 13,
    alignItems: 'center',
    marginTop: 18,
  },

  modalEventCodeLabel: {
    color: COLORS.textSecondary,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.4,
  },

  modalEventCodeValue: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
    marginTop: 6,
  },

  modalDoneButton: {
    width: '100%',
    minHeight: 49,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },

  modalDoneText: {
    color: COLORS.textOnPrimary,
    fontSize: 14,
    fontWeight: '900',
  },
});