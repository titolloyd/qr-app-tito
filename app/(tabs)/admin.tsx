import {
  useCallback,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  useFocusEffect,
} from '@react-navigation/native';

import { COLORS } from '@/constants/colors';

import {
  getAllProfiles,
  updateProfile,
  type Profile,
  type Role,
} from '@/lib/profiles';

import {
  closeEvent,
  getAllEvents,
  type CloudEvent,
} from '@/lib/events';

import {
  deleteAttendance,
  getAllAttendance,
  type AdminAttendanceRecord,
} from '@/lib/attendance';

export default function AdminScreen() {
  const [users, setUsers] =
    useState<Profile[]>([]);

  const [events, setEvents] =
    useState<CloudEvent[]>([]);

  const [attendance, setAttendance] =
    useState<AdminAttendanceRecord[]>(
      []
    );

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const loadData = async () => {
    const [
      profiles,
      allEvents,
      allAttendance,
    ] = await Promise.all([
      getAllProfiles(),
      getAllEvents(),
      getAllAttendance(),
    ]);

    setUsers(profiles);
    setEvents(allEvents);
    setAttendance(allAttendance);
    setLoading(false);
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const handleRefresh = async () => {
    setRefreshing(true);

    await loadData();

    setRefreshing(false);
  };

  const handleCloseEvent = (
    event: CloudEvent
  ) => {
    Alert.alert(
      'Close Event',
      `Are you sure you want to close "${event.title}"?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Close',
          style: 'destructive',
          onPress: async () => {
            const result =
              await closeEvent(
                event.id
              );

            if (result.error) {
              Alert.alert(
                'Error',
                result.error
              );
              return;
            }

            Alert.alert(
              'Success',
              'Event has been closed.'
            );

            await loadData();
          },
        },
      ]
    );
  };

  const handleDeleteAttendance = (
    record: AdminAttendanceRecord
  ) => {
    Alert.alert(
      'Remove Attendance',
      `Are you sure you want to remove this attendance record for "${record.eventTitle}"?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const result =
              await deleteAttendance(
                record.id
              );

            if (result.error) {
              Alert.alert(
                'Error',
                result.error
              );
              return;
            }

            Alert.alert(
              'Success',
              'Attendance record removed.'
            );

            await loadData();
          },
        },
      ]
    );
  };

  const handleChangeRole = (
    user: Profile
  ) => {
    if (user.role === 'admin') {
      Alert.alert(
        'Administrator Account',
        'Administrator roles cannot be changed from this screen.'
      );

      return;
    }

    const newRole: Role =
      user.role === 'student'
        ? 'teacher'
        : 'student';

    const roleLabel =
      newRole === 'teacher'
        ? 'Teacher'
        : 'Student';

    Alert.alert(
      'Change User Role',
      `Change ${user.full_name || user.email} to ${roleLabel}?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Change',
          onPress: async () => {
            const result =
              await updateProfile(
                user.id,
                {
                  role: newRole,
                }
              );

            if (result.error) {
              Alert.alert(
                'Error',
                result.error
              );
              return;
            }

            Alert.alert(
              'Success',
              `User role changed to ${roleLabel}.`
            );

            await loadData();
          },
        },
      ]
    );
  };

  const getRoleLabel = (
    role: Role
  ) => {
    if (role === 'admin') {
      return 'Administrator';
    }

    if (role === 'teacher') {
      return 'Teacher';
    }

    return 'Student';
  };

  const formatDate = (
    value: string | null
  ) => {
    if (!value) {
      return 'Not set';
    }

    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return 'Invalid date';
    }

    return date.toLocaleString();
  };

  const studentCount =
    users.filter(
      (user) =>
        user.role === 'student'
    ).length;

  const teacherCount =
    users.filter(
      (user) =>
        user.role === 'teacher'
    ).length;

  const adminCount =
    users.filter(
      (user) =>
        user.role === 'admin'
    ).length;

  const openEventCount =
    events.filter(
      (event) =>
        event.status !== 'closed'
    ).length;

  const closedEventCount =
    events.filter(
      (event) =>
        event.status === 'closed'
    ).length;

  const attendanceByEvent =
    events.map((event) => {
      const count =
        attendance.filter(
          (record) =>
            record.eventId ===
            event.id
        ).length;

      return {
        ...event,
        attendanceCount: count,
      };
    });

  if (loading) {
    return (
      <SafeAreaView
        style={styles.container}
      >
        <View style={styles.center}>
          <ActivityIndicator
            size="large"
            color={COLORS.primary}
          />

          <Text style={styles.loadingText}>
            Loading admin dashboard...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={styles.container}
    >
      <FlatList
        data={[]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
          />
        }
        contentContainerStyle={
          styles.listContainer
        }
        ListHeaderComponent={
          <View>
            <Text style={styles.title}>
              Admin Dashboard
            </Text>

            <Text style={styles.subtitle}>
              Manage users, events, and attendance
            </Text>

            <View style={styles.summaryRow}>
              <View
                style={styles.summaryCard}
              >
                <Text
                  style={
                    styles.summaryNumber
                  }
                >
                  {users.length}
                </Text>

                <Text
                  style={
                    styles.summaryLabel
                  }
                >
                  Users
                </Text>
              </View>

              <View
                style={styles.summaryCard}
              >
                <Text
                  style={
                    styles.summaryNumber
                  }
                >
                  {events.length}
                </Text>

                <Text
                  style={
                    styles.summaryLabel
                  }
                >
                  Events
                </Text>
              </View>

              <View
                style={styles.summaryCard}
              >
                <Text
                  style={
                    styles.summaryNumber
                  }
                >
                  {attendance.length}
                </Text>

                <Text
                  style={
                    styles.summaryLabel
                  }
                >
                  Attendance
                </Text>
              </View>
            </View>

            <Text
              style={styles.sectionTitle}
            >
              User Management
            </Text>

            {users.length === 0 ? (
              <Text
                style={styles.emptyText}
              >
                No users found.
              </Text>
            ) : (
              users.map((user) => (
                <View
                  key={user.id}
                  style={styles.userCard}
                >
                  <Text
                    style={styles.userName}
                  >
                    {user.full_name ||
                      'No name'}
                  </Text>

                  <Text
                    style={styles.email}
                  >
                    {user.email}
                  </Text>

                  <View
                    style={[
                      styles.roleBadge,
                      user.role ===
                        'admin' &&
                        styles.adminBadge,
                      user.role ===
                        'teacher' &&
                        styles.teacherBadge,
                      user.role ===
                        'student' &&
                        styles.studentBadge,
                    ]}
                  >
                    <Text
                      style={
                        styles.roleText
                      }
                    >
                      {getRoleLabel(
                        user.role
                      )}
                    </Text>
                  </View>

                  {user.role !==
                    'admin' && (
                    <Text
                      style={
                        styles.roleButton
                      }
                      onPress={() =>
                        handleChangeRole(
                          user
                        )
                      }
                    >
                      Change Role
                    </Text>
                  )}
                </View>
              ))
            )}

            <Text
              style={styles.sectionTitle}
            >
              Event Management
            </Text>

            {events.length === 0 ? (
              <Text
                style={styles.emptyText}
              >
                No events found.
              </Text>
            ) : (
              events.map((event) => (
                <View
                  key={event.id}
                  style={styles.eventCard}
                >
                  <View
                    style={
                      styles.eventHeader
                    }
                  >
                    <Text
                      style={
                        styles.eventTitle
                      }
                    >
                      {event.title}
                    </Text>

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
                        style={
                          styles.statusText
                        }
                      >
                        {event.status ===
                        'closed'
                          ? 'Closed'
                          : 'Open'}
                      </Text>
                    </View>
                  </View>

                  <Text
                    style={
                      styles.eventCode
                    }
                  >
                    Code: {event.event_code}
                  </Text>

                  <Text
                    style={
                      styles.eventDetail
                    }
                  >
                    Venue:{' '}
                    {event.venue ||
                      'Not set'}
                  </Text>

                  <Text
                    style={
                      styles.eventDetail
                    }
                  >
                    Start:{' '}
                    {formatDate(
                      event.start_time
                    )}
                  </Text>

                  <Text
                    style={
                      styles.eventDetail
                    }
                  >
                    End:{' '}
                    {formatDate(
                      event.end_time
                    )}
                  </Text>

                  {event.description ? (
                    <Text
                      style={
                        styles.description
                      }
                    >
                      {event.description}
                    </Text>
                  ) : null}

                  {event.status !==
                    'closed' && (
                    <Text
                      style={
                        styles.closeButton
                      }
                      onPress={() =>
                        handleCloseEvent(
                          event
                        )
                      }
                    >
                      Close Event
                    </Text>
                  )}
                </View>
              ))
            )}

            <Text
              style={styles.sectionTitle}
            >
              Attendance Overview
            </Text>

            <View
              style={styles.attendanceSummary}
            >
              <Text
                style={
                  styles.attendanceNumber
                }
              >
                {attendance.length}
              </Text>

              <Text
                style={
                  styles.attendanceLabel
                }
              >
                Total Attendance Records
              </Text>
            </View>

            {attendance.length === 0 ? (
              <Text
                style={styles.emptyText}
              >
                No attendance records found.
              </Text>
            ) : (
              attendance.map(
                (record) => (
                  <View
                    key={record.id}
                    style={
                      styles.attendanceCard
                    }
                  >
                    <Text
                      style={
                        styles.attendanceEvent
                      }
                    >
                      {record.eventTitle}
                    </Text>

                    <Text
                      style={
                        styles.attendanceCode
                      }
                    >
                      Event Code:{' '}
                      {record.eventCode}
                    </Text>

                    <Text
                      style={
                        styles.attendanceDetail
                      }
                    >
                      Student ID:{' '}
                      {record.studentId}
                    </Text>

                    <Text
                      style={
                        styles.attendanceDetail
                      }
                    >
                      Scanned:{' '}
                      {formatDate(
                        record.scannedAt
                      )}
                    </Text>

                    <Text
                      style={
                        styles.removeButton
                      }
                      onPress={() =>
                        handleDeleteAttendance(
                          record
                        )
                      }
                    >
                      Remove Attendance
                    </Text>
                  </View>
                )
              )
            )}

            <Text
              style={styles.sectionTitle}
            >
              System Reports
            </Text>

            <View
              style={styles.reportCard}
            >
              <Text
                style={styles.reportTitle}
              >
                User Summary
              </Text>

              <View
                style={styles.reportRow}
              >
                <Text
                  style={
                    styles.reportLabel
                  }
                >
                  Students
                </Text>

                <Text
                  style={
                    styles.reportValue
                  }
                >
                  {studentCount}
                </Text>
              </View>

              <View
                style={styles.reportRow}
              >
                <Text
                  style={
                    styles.reportLabel
                  }
                >
                  Teachers
                </Text>

                <Text
                  style={
                    styles.reportValue
                  }
                >
                  {teacherCount}
                </Text>
              </View>

              <View
                style={styles.reportRow}
              >
                <Text
                  style={
                    styles.reportLabel
                  }
                >
                  Administrators
                </Text>

                <Text
                  style={
                    styles.reportValue
                  }
                >
                  {adminCount}
                </Text>
              </View>
            </View>

            <View
              style={styles.reportCard}
            >
              <Text
                style={styles.reportTitle}
              >
                Event Summary
              </Text>

              <View
                style={styles.reportRow}
              >
                <Text
                  style={
                    styles.reportLabel
                  }
                >
                  Total Events
                </Text>

                <Text
                  style={
                    styles.reportValue
                  }
                >
                  {events.length}
                </Text>
              </View>

              <View
                style={styles.reportRow}
              >
                <Text
                  style={
                    styles.reportLabel
                  }
                >
                  Open Events
                </Text>

                <Text
                  style={
                    styles.reportValue
                  }
                >
                  {openEventCount}
                </Text>
              </View>

              <View
                style={styles.reportRow}
              >
                <Text
                  style={
                    styles.reportLabel
                  }
                >
                  Closed Events
                </Text>

                <Text
                  style={
                    styles.reportValue
                  }
                >
                  {closedEventCount}
                </Text>
              </View>
            </View>

            <View
              style={styles.reportCard}
            >
              <Text
                style={styles.reportTitle}
              >
                Attendance by Event
              </Text>

              {attendanceByEvent.length ===
              0 ? (
                <Text
                  style={
                    styles.emptyReportText
                  }
                >
                  No events available.
                </Text>
              ) : (
                attendanceByEvent.map(
                  (event) => (
                    <View
                      key={event.id}
                      style={
                        styles.reportRow
                      }
                    >
                      <Text
                        style={
                          styles.reportLabel
                        }
                      >
                        {event.title}
                      </Text>

                      <Text
                        style={
                          styles.reportValue
                        }
                      >
                        {event.attendanceCount}
                      </Text>
                    </View>
                  )
                )
              )}
            </View>
          </View>
        }
        renderItem={null}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor:
      COLORS.background,
  },

  listContainer: {
    padding: 20,
    paddingBottom: 40,
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingText: {
    marginTop: 10,
    color: COLORS.textSecondary,
  },

  title: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },

  subtitle: {
    marginTop: 4,
    marginBottom: 18,
    fontSize: 16,
    color: COLORS.textSecondary,
  },

  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },

  summaryCard: {
    flex: 1,
    padding: 14,
    borderRadius: 14,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  summaryNumber: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.primary,
  },

  summaryLabel: {
    marginTop: 2,
    fontSize: 12,
    color: COLORS.textSecondary,
  },

  sectionTitle: {
    marginTop: 8,
    marginBottom: 12,
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },

  userCard: {
    padding: 16,
    marginBottom: 10,
    borderRadius: 14,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  userName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },

  email: {
    marginTop: 3,
    fontSize: 14,
    color: COLORS.textSecondary,
  },

  roleBadge: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },

  adminBadge: {
    backgroundColor: '#d9c2ff',
  },

  teacherBadge: {
    backgroundColor: '#c8e6ff',
  },

  studentBadge: {
    backgroundColor: '#d7f5d1',
  },

  roleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#25292e',
  },

  roleButton: {
    alignSelf: 'flex-start',
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#d9c2ff',
    color: '#25292e',
    fontWeight: '700',
  },

  eventCard: {
    padding: 16,
    marginBottom: 12,
    borderRadius: 14,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  eventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },

  eventTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },

  eventCode: {
    marginTop: 5,
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '600',
  },

  eventDetail: {
    marginTop: 5,
    fontSize: 14,
    color: COLORS.textSecondary,
  },

  description: {
    marginTop: 10,
    fontSize: 14,
    color: COLORS.textPrimary,
  },

  statusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
  },

  openBadge: {
    backgroundColor: '#d7f5d1',
  },

  closedBadge: {
    backgroundColor: '#ffd6d6',
  },

  statusText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#25292e',
  },

  closeButton: {
    alignSelf: 'flex-start',
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#ffd6d6',
    color: '#9b1c1c',
    fontWeight: '700',
  },

  attendanceSummary: {
    padding: 18,
    marginBottom: 12,
    borderRadius: 14,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  attendanceNumber: {
    fontSize: 30,
    fontWeight: '800',
    color: COLORS.primary,
  },

  attendanceLabel: {
    marginTop: 3,
    color: COLORS.textSecondary,
  },

  attendanceCard: {
    padding: 16,
    marginBottom: 10,
    borderRadius: 14,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  attendanceEvent: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },

  attendanceCode: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },

  attendanceDetail: {
    marginTop: 5,
    fontSize: 14,
    color: COLORS.textSecondary,
  },

  removeButton: {
    alignSelf: 'flex-start',
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#ffd6d6',
    color: '#9b1c1c',
    fontWeight: '700',
  },

  reportCard: {
    padding: 16,
    marginBottom: 12,
    borderRadius: 14,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  reportTitle: {
    marginBottom: 12,
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },

  reportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },

  reportLabel: {
    flex: 1,
    paddingRight: 10,
    color: COLORS.textSecondary,
  },

  reportValue: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.primary,
  },

  emptyReportText: {
    color: COLORS.textSecondary,
  },

  emptyText: {
    marginBottom: 16,
    color: COLORS.textSecondary,
  },
});