import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import AppButton from '@/components/AppButton';
import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import {
  closeEvent,
  createEvent,
  getEventsByTeacher,
  updateEvent,
  type CloudEvent,
} from '@/lib/events';
import { getProfile, type Role } from '@/lib/profiles';
import { buildQRPayload } from '@/lib/qr';

function toLocalISO(date: Date) {
  const pad = (n: number) =>
    String(n).padStart(2, '0');

  return (
    `${date.getFullYear()}-${pad(
      date.getMonth() + 1
    )}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(
      date.getMinutes()
    )}:00`
  );
}

function formatDateTime(date: Date) {
  const pad = (n: number) =>
    String(n).padStart(2, '0');

  const month = date.toLocaleString('en-US', {
    month: 'short',
  });

  return `${month} ${pad(
    date.getDate()
  )}, ${date.getFullYear()} at ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function formatEventDate(
  value: string | null
) {
  if (!value) {
    return 'Not set';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return formatDateTime(date);
}

const QUICK_END_OPTIONS = [
  {
    label: '+30 min',
    ms: 30 * 60 * 1000,
  },
  {
    label: '+1 hour',
    ms: 60 * 60 * 1000,
  },
  {
    label: '+2 hours',
    ms: 2 * 60 * 60 * 1000,
  },
];

type EditTarget = 'start' | 'end';

export default function TeacherScreen() {
  const { user } = useAuth();

  const [role, setRole] =
    useState<Role>('student');

  const [roleLoading, setRoleLoading] =
    useState(true);

  const [events, setEvents] =
    useState<CloudEvent[]>([]);

  const [eventsLoading, setEventsLoading] =
    useState(false);

  const [editingEvent, setEditingEvent] =
    useState<CloudEvent | null>(null);

  const [title, setTitle] = useState('');
  const [eventId, setEventId] = useState('');
  const [venue, setVenue] = useState('');
  const [description, setDescription] =
    useState('');

  const [startDate, setStartDate] =
    useState(() => new Date());

  const [endDate, setEndDate] =
    useState(
      () =>
        new Date(
          Date.now() +
            60 * 60 * 1000
        )
    );

  const [editTarget, setEditTarget] =
    useState<EditTarget | null>(null);

  const [editingPart, setEditingPart] =
    useState<'date' | 'time'>('date');

  const [payload, setPayload] =
    useState<string | null>(null);

  const [message, setMessage] =
    useState<string | null>(null);

  const [saving, setSaving] =
    useState(false);

  const isAndroid =
    Platform.OS === 'android';

  const loadEvents = useCallback(
    async (teacherId: string) => {
      setEventsLoading(true);

      const data =
        await getEventsByTeacher(
          teacherId
        );

      setEvents(data);
      setEventsLoading(false);
    },
    []
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function loadProfile() {
        setRoleLoading(true);

        if (!user?.id) {
          if (active) {
            setRole('student');
            setRoleLoading(false);
          }

          return;
        }

        const profile =
          await getProfile(user.id);

        if (active) {
          setRole(
            profile?.role ?? 'student'
          );

          setRoleLoading(false);
        }

        if (
          active &&
          profile?.role === 'teacher'
        ) {
          await loadEvents(user.id);
        }
      }

      loadProfile();

      return () => {
        active = false;
      };
    }, [user?.id, loadEvents])
  );

  const resetForm = () => {
    setEditingEvent(null);
    setTitle('');
    setEventId('');
    setVenue('');
    setDescription('');

    const start = new Date();

    const end = new Date(
      start.getTime() +
        60 * 60 * 1000
    );

    setStartDate(start);
    setEndDate(end);

    setPayload(null);
    setMessage(null);
    setEditTarget(null);
  };

  const openPicker = (
    target: EditTarget
  ) => {
    setMessage(null);
    setEditTarget(target);
    setEditingPart('date');
  };

  const onPickerChange = (
    event: DateTimePickerEvent,
    selected?: Date
  ) => {
    if (!editTarget) return;

    if (
      event.type === 'dismissed' ||
      !selected
    ) {
      setEditTarget(null);
      setEditingPart('date');

      return;
    }

    const current =
      editTarget === 'start'
        ? startDate
        : endDate;

    const next = new Date(current);

    next.setFullYear(
      selected.getFullYear(),
      selected.getMonth(),
      selected.getDate()
    );

    next.setHours(
      selected.getHours(),
      selected.getMinutes(),
      0,
      0
    );

    if (editTarget === 'start') {
      setStartDate(next);
    } else {
      setEndDate(next);
    }

    if (
      isAndroid &&
      editingPart === 'date'
    ) {
      setEditingPart('time');
    } else {
      setEditTarget(null);
      setEditingPart('date');
    }
  };

  const handleQuickEnd = (
    ms: number
  ) => {
    setMessage(null);

    setEndDate(
      new Date(
        startDate.getTime() + ms
      )
    );
  };

  const handleCreateEvent = async () => {
    const trimmedCode =
      eventId.trim();

    const trimmedTitle =
      title.trim();

    if (
      !trimmedCode ||
      !trimmedTitle
    ) {
      setMessage(
        'Event title and code are required.'
      );

      return;
    }

    if (
      endDate.getTime() <=
      startDate.getTime()
    ) {
      setMessage(
        'End time must be after start time.'
      );

      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const event = {
        event_code: trimmedCode,
        title: trimmedTitle,
        start_time:
          toLocalISO(startDate),
        end_time:
          toLocalISO(endDate),
        venue:
          venue.trim() || null,
        description:
          description.trim() || null,
        status: 'open' as const,
      };

      const { error } =
        await createEvent(event);

      if (error) {
        setMessage(error);
        setSaving(false);

        return;
      }

      setMessage(
        'Event created successfully.'
      );

      setPayload(
        buildQRPayload({
          eventId: event.event_code,
          title: event.title,
          start: event.start_time,
          end: event.end_time,
        })
      );

      setTitle('');
      setEventId('');
      setVenue('');
      setDescription('');

      if (user?.id) {
        await loadEvents(user.id);
      }
    } catch (error) {
      console.error(
        'Failed to create event:',
        error
      );

      setMessage(
        'Failed to create the event.'
      );
    }

    setSaving(false);
  };

  const handleStartEdit = (
    event: CloudEvent
  ) => {
    if (event.status === 'closed') {
      setMessage(
        'Closed events cannot be edited.'
      );

      return;
    }

    setEditingEvent(event);

    setTitle(event.title);
    setEventId(event.event_code);
    setVenue(event.venue ?? '');
    setDescription(
      event.description ?? ''
    );

    setStartDate(
      event.start_time
        ? new Date(event.start_time)
        : new Date()
    );

    setEndDate(
      event.end_time
        ? new Date(event.end_time)
        : new Date(
            Date.now() +
              60 * 60 * 1000
          )
    );

    setPayload(null);
    setMessage(null);
  };

  const handleUpdateEvent = async () => {
    if (!editingEvent) return;

    if (
      !eventId.trim() ||
      !title.trim()
    ) {
      setMessage(
        'Event title and code are required.'
      );

      return;
    }

    if (
      endDate.getTime() <=
      startDate.getTime()
    ) {
      setMessage(
        'End time must be after start time.'
      );

      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const { error } =
        await updateEvent(
          editingEvent.id,
          {
            event_code:
              eventId.trim(),
            title: title.trim(),
            start_time:
              toLocalISO(startDate),
            end_time:
              toLocalISO(endDate),
            venue:
              venue.trim() || null,
            description:
              description.trim() || null,
          }
        );

      if (error) {
        setMessage(error);
        setSaving(false);

        return;
      }

      setMessage(
        'Event updated successfully.'
      );

      setEditingEvent(null);

      setPayload(
        buildQRPayload({
          eventId:
            eventId.trim(),
          title: title.trim(),
          start: toLocalISO(
            startDate
          ),
          end: toLocalISO(
            endDate
          ),
        })
      );

      if (user?.id) {
        await loadEvents(user.id);
      }
    } catch (error) {
      console.error(
        'Failed to update event:',
        error
      );

      setMessage(
        'Failed to update the event.'
      );
    }

    setSaving(false);
  };

  const handleCloseEvent = async (
    event: CloudEvent
  ) => {
    if (event.status === 'closed') {
      setMessage(
        'This event is already closed.'
      );

      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const { error } =
        await closeEvent(event.id);

      if (error) {
        setMessage(error);
        setSaving(false);

        return;
      }

      setMessage(
        `${event.title} has been closed.`
      );

      if (
        editingEvent?.id === event.id
      ) {
        setEditingEvent(null);
      }

      if (user?.id) {
        await loadEvents(user.id);
      }
    } catch (error) {
      console.error(
        'Failed to close event:',
        error
      );

      setMessage(
        'Failed to close the event.'
      );
    }

    setSaving(false);
  };

  const handleShowQR = (
    event: CloudEvent
  ) => {
    setMessage(null);

    setPayload(
      buildQRPayload({
        eventId: event.event_code,
        title: event.title,
        start:
          event.start_time ?? '',
        end:
          event.end_time ?? '',
      })
    );
  };

  if (roleLoading) {
    return (
      <View style={styles.lockContainer}>
        <ActivityIndicator
          size="large"
          color={COLORS.primary}
        />

        <Text style={styles.lockTitle}>
          Checking your account...
        </Text>
      </View>
    );
  }

  if (role !== 'teacher') {
    return (
      <View style={styles.lockContainer}>
        <Ionicons
          name="lock-closed-outline"
          size={52}
          color={COLORS.primary}
        />

        <Text style={styles.lockTitle}>
          Teachers Only
        </Text>

        <Text style={styles.lockMessage}>
          Only teacher accounts can manage
          events.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>
        {editingEvent
          ? 'Edit Event'
          : 'Create Event'}
      </Text>

      <Text style={styles.subtitle}>
        {editingEvent
          ? 'Update the event details below.'
          : 'Create an event and generate its QR code.'}
      </Text>

      <Text style={styles.label}>
        Event Title
      </Text>

      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="e.g. Founders Day Assembly"
        placeholderTextColor={
          COLORS.textSecondary
        }
      />

      <Text style={styles.label}>
        Event Code
      </Text>

      <TextInput
        style={styles.input}
        value={eventId}
        onChangeText={setEventId}
        placeholder="e.g. EVT-2026-0002"
        placeholderTextColor={
          COLORS.textSecondary
        }
        autoCapitalize="characters"
      />

      <Text style={styles.label}>
        Venue
      </Text>

      <TextInput
        style={styles.input}
        value={venue}
        onChangeText={setVenue}
        placeholder="e.g. School Gymnasium"
        placeholderTextColor={
          COLORS.textSecondary
        }
      />

      <Text style={styles.label}>
        Description
      </Text>

      <TextInput
        style={[
          styles.input,
          styles.descriptionInput,
        ]}
        value={description}
        onChangeText={setDescription}
        placeholder="Enter event details"
        placeholderTextColor={
          COLORS.textSecondary
        }
        multiline
      />

      <Text style={styles.label}>
        Starts
      </Text>

      <PickerField
        value={formatDateTime(startDate)}
        icon="sunny-outline"
        onPress={() =>
          openPicker('start')
        }
      />

      <Text style={styles.label}>
        Ends
      </Text>

      <PickerField
        value={formatDateTime(endDate)}
        icon="moon-outline"
        onPress={() =>
          openPicker('end')
        }
      />

      <View style={styles.chipRow}>
        {QUICK_END_OPTIONS.map(
          (option) => (
            <Pressable
              key={option.label}
              style={styles.chip}
              onPress={() =>
                handleQuickEnd(
                  option.ms
                )
              }
            >
              <Text
                style={styles.chipText}
              >
                {option.label}
              </Text>
            </Pressable>
          )
        )}
      </View>

      <Text style={styles.hint}>
        Tap a chip to set the end time from
        start.
      </Text>

      {message && (
        <Text style={styles.message}>
          {message}
        </Text>
      )}

      <AppButton
        theme="primary"
        title={
          saving
            ? 'Saving...'
            : editingEvent
              ? 'Update Event'
              : 'Create Event'
        }
        icon={
          editingEvent
            ? 'save-outline'
            : 'add-circle-outline'
        }
        onPress={
          editingEvent
            ? handleUpdateEvent
            : handleCreateEvent
        }
      />

      {editingEvent && (
        <Pressable
          style={styles.cancelButton}
          onPress={resetForm}
        >
          <Text style={styles.cancelText}>
            Cancel Editing
          </Text>
        </Pressable>
      )}

      {editTarget && (
        <View
          style={styles.pickerContainer}
        >
          <DateTimePicker
            value={
              editTarget === 'start'
                ? startDate
                : endDate
            }
            mode={
              isAndroid
                ? editingPart
                : 'datetime'
            }
            display={
              isAndroid
                ? 'default'
                : 'spinner'
            }
            onChange={onPickerChange}
          />
        </View>
      )}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          My Events
        </Text>

        <Pressable
          onPress={() =>
            user?.id &&
            loadEvents(user.id)
          }
        >
          <Ionicons
            name="refresh-outline"
            size={22}
            color={COLORS.primary}
          />
        </Pressable>
      </View>

      {eventsLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator
            size="small"
            color={COLORS.primary}
          />

          <Text style={styles.emptyText}>
            Loading events...
          </Text>
        </View>
      ) : events.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons
            name="calendar-outline"
            size={42}
            color={COLORS.textSecondary}
          />

          <Text style={styles.emptyTitle}>
            No Events Yet
          </Text>

          <Text style={styles.emptyText}>
            Create your first event above.
          </Text>
        </View>
      ) : (
        events.map((event) => (
          <View
            key={event.id}
            style={styles.eventCard}
          >
            <View
              style={styles.eventHeader}
            >
              <View
                style={styles.eventTitleBox}
              >
                <Text
                  style={styles.eventTitle}
                >
                  {event.title}
                </Text>

                <Text
                  style={styles.eventCode}
                >
                  {event.event_code}
                </Text>
              </View>

              <View
                style={[
                  styles.statusBadge,
                  event.status ===
                    'closed'
                    ? styles.closedBadge
                    : styles.openBadge,
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    event.status ===
                      'closed'
                      ? styles.closedText
                      : styles.openText,
                  ]}
                >
                  {event.status ===
                  'closed'
                    ? 'Closed'
                    : 'Open'}
                </Text>
              </View>
            </View>

            {event.venue && (
              <View
                style={styles.detailRow}
              >
                <Ionicons
                  name="location-outline"
                  size={17}
                  color={
                    COLORS.textSecondary
                  }
                />

                <Text
                  style={styles.detailText}
                >
                  {event.venue}
                </Text>
              </View>
            )}

            <View
              style={styles.detailRow}
            >
              <Ionicons
                name="time-outline"
                size={17}
                color={
                  COLORS.textSecondary
                }
              />

              <Text
                style={styles.detailText}
              >
                {formatEventDate(
                  event.start_time
                )}
              </Text>
            </View>

            {event.description && (
              <Text
                style={styles.description}
              >
                {event.description}
              </Text>
            )}

            <View style={styles.actionRow}>
              <Pressable
                style={styles.actionButton}
                onPress={() =>
                  handleShowQR(event)
                }
              >
                <Ionicons
                  name="qr-code-outline"
                  size={18}
                  color={
                    COLORS.primary
                  }
                />

                <Text
                  style={styles.actionText}
                >
                  QR
                </Text>
              </Pressable>

              {event.status !==
                'closed' && (
                <>
                  <Pressable
                    style={styles.actionButton}
                    onPress={() =>
                      handleStartEdit(
                        event
                      )
                    }
                  >
                    <Ionicons
                      name="create-outline"
                      size={18}
                      color={
                        COLORS.primary
                      }
                    />

                    <Text
                      style={
                        styles.actionText
                      }
                    >
                      Edit
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.actionButton,
                      styles.closeAction,
                    ]}
                    onPress={() =>
                      handleCloseEvent(
                        event
                      )
                    }
                  >
                    <Ionicons
                      name="lock-closed-outline"
                      size={18}
                      color="#b00020"
                    />

                    <Text
                      style={
                        styles.closeActionText
                      }
                    >
                      Close
                    </Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>
        ))
      )}

      {payload && (
        <View style={styles.resultCard}>
          <Text
            style={styles.resultTitle}
          >
            Event QR Code
          </Text>

          <View style={styles.qrBox}>
            <QRCode
              value={payload}
              size={200}
            />
          </View>

          <Text
            style={styles.payloadText}
          >
            {payload}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

type PickerFieldProps = {
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
};

function PickerField({
  value,
  icon,
  onPress,
}: PickerFieldProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.pickerField,
        pressed &&
          styles.pickerFieldPressed,
      ]}
      onPress={onPress}
    >
      <Ionicons
        name={icon}
        size={20}
        color={COLORS.primary}
      />

      <Text
        style={styles.pickerValue}
      >
        {value}
      </Text>

      <Ionicons
        name="calendar-outline"
        size={18}
        color={COLORS.textSecondary}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  content: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
  },

  title: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },

  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },

  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 6,
    marginTop: 10,
  },

  input: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.textPrimary,
  },

  descriptionInput: {
    minHeight: 90,
    textAlignVertical: 'top',
  },

  pickerField: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },

  pickerFieldPressed: {
    backgroundColor: COLORS.surface,
  },

  pickerValue: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.textPrimary,
    marginHorizontal: 10,
  },

  chipRow: {
    flexDirection: 'row',
    marginTop: 8,
  },

  chip: {
    backgroundColor: COLORS.surface,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginRight: 8,
  },

  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },

  hint: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 6,
  },

  message: {
    fontSize: 14,
    color: COLORS.primary,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 12,
  },

  pickerContainer: {
    marginTop: 12,
    alignItems: 'center',
  },

  cancelButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },

  cancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 32,
    marginBottom: 12,
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },

  loadingBox: {
    alignItems: 'center',
    paddingVertical: 24,
  },

  emptyCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginTop: 10,
  },

  emptyText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 6,
    textAlign: 'center',
  },

  eventCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  eventHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },

  eventTitleBox: {
    flex: 1,
    paddingRight: 10,
  },

  eventTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },

  eventCode: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 3,
  },

  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },

  openBadge: {
    backgroundColor: '#dcfce7',
  },

  closedBadge: {
    backgroundColor: '#fee2e2',
  },

  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },

  openText: {
    color: '#166534',
  },

  closedText: {
    color: '#991b1b',
  },

  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },

  detailText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textSecondary,
    marginLeft: 7,
  },

  description: {
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.textSecondary,
    marginTop: 10,
  },

  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },

  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 18,
  },

  actionText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
    marginLeft: 5,
  },

  closeAction: {
    marginRight: 0,
  },

  closeActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#b00020',
    marginLeft: 5,
  },

  resultCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    marginTop: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  resultTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: 12,
  },

  qrBox: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
  },

  payloadText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
  },

  lockContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },

  lockTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: 16,
    textAlign: 'center',
  },

  lockMessage: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 8,
  },
});