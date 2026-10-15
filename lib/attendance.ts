import { supabase } from './supabase';
import { getEventByCode } from './events';
import { parseQRPayload } from './qr';
import { getProfile } from './profiles';

export type AttendanceRecord = {
  id: string;
  eventId: string;
  eventTitle: string;
  scannedAt: string;
  startTime: string | null;
  endTime: string | null;
  eventStatus: 'open' | 'closed';
};

export type RegisterResult = {
  success: boolean;
  message: string;
  eventTitle?: string;
};

export type TeacherEventAttendance = {
  eventId: string;
  eventCode: string;
  title: string;
  startTime: string | null;
  endTime: string | null;
  eventStatus: 'open' | 'closed';
  attendeeCount: number;
  attendees: {
    id: string;
    studentId: string;
    scannedAt: string;
    studentName: string | null;
    schoolId: string | null;
  }[];
};

export type TeacherEventSummary = {
  eventId: string;
  eventCode: string;
  title: string;
  attendeeCount: number;
};

export type AdminAttendanceRecord = {
  id: string;
  studentId: string;
  eventId: string;
  eventTitle: string;
  eventCode: string;
  scannedAt: string;
};

export async function registerAttendance(
  rawPayload: string,
  studentId: string
): Promise<RegisterResult> {
  if (!studentId) {
    return {
      success: false,
      message:
        'You must be logged in as a student.',
    };
  }

  const profile = await getProfile(studentId);
  if (!profile) {
    return { success: false, message: 'Your account profile could not be verified. Please sign in again.' };
  }
  if (profile.role !== 'student' || profile.requested_role === 'teacher') {
    return { success: false, message: 'Only student accounts can record attendance.' };
  }
  if (profile.school_id_status !== 'verified' && profile.school_id_status !== 'not_required') {
    return { success: false, message: 'Your school ID is awaiting administrator verification.' };
  }

  const parsed = parseQRPayload(rawPayload);

  if (!parsed.ok) {
    return {
      success: false,
      message: 'Invalid QR code.',
    };
  }

  const payload = parsed.payload;

  if (!payload.event) {
    return {
      success: false,
      message: 'Invalid event QR code.',
    };
  }

  const event = await getEventByCode(
    payload.event
  );

  if (!event) {
    return {
      success: false,
      message: 'Event not found.',
    };
  }

  if (event.status === 'closed') {
    return {
      success: false,
      message: 'This event is closed.',
      eventTitle: event.title,
    };
  }

  const now = Date.now();

  const start = event.start_time
    ? new Date(
        event.start_time
      ).getTime()
    : null;

  const end = event.end_time
    ? new Date(
        event.end_time
      ).getTime()
    : null;

  if (
    start !== null &&
    Number.isNaN(start)
  ) {
    return {
      success: false,
      message:
        'This event has an invalid start time.',
      eventTitle: event.title,
    };
  }

  if (
    end !== null &&
    Number.isNaN(end)
  ) {
    return {
      success: false,
      message:
        'This event has an invalid end time.',
      eventTitle: event.title,
    };
  }

  if (
    start !== null &&
    now < start
  ) {
    return {
      success: false,
      message:
        'Event has not started yet.',
      eventTitle: event.title,
    };
  }

  if (
    end !== null &&
    now > end
  ) {
    return {
      success: false,
      message:
        'Event has already ended.',
      eventTitle: event.title,
    };
  }

  const {
    data: existingAttendance,
    error: attendanceCheckError,
  } = await supabase
    .from('attendance')
    .select('id')
    .eq('student_id', studentId)
    .eq('event_id', event.id)
    .maybeSingle();

  if (attendanceCheckError) {
    console.error(
      'Failed to check attendance:',
      attendanceCheckError
    );

    return {
      success: false,
      message:
        'Could not check your attendance.',
      eventTitle: event.title,
    };
  }

  if (existingAttendance) {
    return {
      success: false,
      message:
        'Already registered for this event.',
      eventTitle: event.title,
    };
  }

  const {
    error: attendanceError,
  } = await supabase
    .from('attendance')
    .insert([
      {
        student_id: studentId,
        event_id: event.id,
      },
    ]);

  if (attendanceError) {
    if (
      attendanceError.code === '23505'
    ) {
      return {
        success: false,
        message:
          'Already registered for this event.',
        eventTitle: event.title,
      };
    }

    console.error(
      'Failed to record attendance:',
      attendanceError
    );

    const databaseMessage = attendanceError.message || '';
    const friendlyMessage = /school ID must be verified/i.test(databaseMessage)
      ? 'Your school ID is awaiting administrator verification.'
      : /event has not started/i.test(databaseMessage)
        ? 'Event has not started yet.'
        : /event has already ended/i.test(databaseMessage)
          ? 'Event has already ended.'
          : /event is closed/i.test(databaseMessage)
            ? 'This event is closed.'
            : /approved student account/i.test(databaseMessage)
              ? 'Only verified student accounts can record attendance.'
              : 'Failed to record attendance.';

    return {
      success: false,
      message: friendlyMessage,
      eventTitle: event.title,
    };
  }

  return {
    success: true,
    message: 'Attendance recorded!',
    eventTitle: event.title,
  };
}

export async function getAttendanceHistory(
  studentId: string
): Promise<AttendanceRecord[]> {
  const {
    data,
    error,
  } = await supabase
    .from('attendance')
    .select(`
      id,
      event_id,
      scanned_at,
      events (
        title,
        start_time,
        end_time,
        status
      )
    `)
    .eq('student_id', studentId)
    .order('scanned_at', {
      ascending: false,
    });

  if (error || !data) {
    console.error(
      'Failed to load attendance history:',
      error
    );

    return [];
  }

  return data.map((row: any) => ({
    id: row.id,
    eventId: row.event_id,
    eventTitle:
      row.events?.title ??
      row.event_id,
    scannedAt: row.scanned_at,
    startTime: row.events?.start_time ?? null,
    endTime: row.events?.end_time ?? null,
    eventStatus: row.events?.status === 'closed' ? 'closed' : 'open',
  }));
}

export async function getTeacherEventAttendance(
  teacherId: string
): Promise<TeacherEventAttendance[]> {
  const {
    data: events,
    error: eventError,
  } = await supabase
    .from('events')
    .select(
      'id, event_code, title, start_time, end_time, status'
    )
    .eq('created_by', teacherId)
    .order('created_at', {
      ascending: false,
    });

  if (eventError || !events) {
    console.error(
      'Failed to load teacher events:',
      eventError
    );

    return [];
  }

  const eventIds = events.map(
    (event) => event.id
  );

  if (eventIds.length === 0) {
    return [];
  }

  const {
    data: attendance,
    error: attendanceError,
  } = await supabase
    .from('attendance')
    .select(
      'id, student_id, scanned_at, event_id'
    )
    .in('event_id', eventIds)
    .order('scanned_at', {
      ascending: false,
    });

  if (
    attendanceError ||
    !attendance
  ) {
    console.error(
      'Failed to load teacher attendance:',
      attendanceError
    );

    return events.map((event) => ({
      eventId: event.id,
      eventCode: event.event_code,
      title: event.title,
      startTime: event.start_time,
      endTime: event.end_time,
      eventStatus: event.status === 'closed' ? 'closed' : 'open',
      attendeeCount: 0,
      attendees: [],
    }));
  }

  // Fetch profiles separately: this avoids relying on a foreign-key join
  // between attendance and profiles, which is not configured in this schema.
  const studentIds = Array.from(new Set(attendance.map((row) => row.student_id).filter(Boolean)));
  const profileResults = await Promise.all(studentIds.map(async (studentId) => ({
    studentId,
    profile: await getProfile(studentId),
  })));
  const profilesById = new Map(
    profileResults.map(({ studentId, profile }) => [studentId, profile])
  );

  return events.map((event) => {
    const rows = attendance.filter((row) => row.event_id === event.id);

    return {
      eventId: event.id,
      eventCode: event.event_code,
      title: event.title,
      startTime: event.start_time,
      endTime: event.end_time,
      eventStatus: event.status === 'closed' ? 'closed' : 'open',
      attendeeCount: rows.length,
      attendees: rows.map((row) => {
        const profile = profilesById.get(row.student_id);
        return {
          id: row.id,
          studentId: row.student_id,
          scannedAt: row.scanned_at,
          studentName: profile?.full_name?.trim() || null,
          schoolId: profile?.school_id?.trim() || null,
        };
      }),
    };
  });
}

export async function getTeacherEventSummary(
  teacherId: string
): Promise<TeacherEventSummary[]> {
  const {
    data: events,
    error: eventError,
  } = await supabase
    .from('events')
    .select(
      'id, event_code, title'
    )
    .eq('created_by', teacherId)
    .order('created_at', {
      ascending: false,
    });

  if (eventError || !events) {
    console.error(
      'Failed to load teacher event summary:',
      eventError
    );

    return [];
  }

  const eventIds = events.map(
    (event) => event.id
  );

  if (eventIds.length === 0) {
    return [];
  }

  const {
    data: attRows,
    error: attError,
  } = await supabase
    .from('attendance')
    .select('event_id')
    .in('event_id', eventIds);

  if (attError || !attRows) {
    console.error(
      'Failed to load attendance counts:',
      attError
    );

    return events.map((event) => ({
      eventId: event.id,
      eventCode: event.event_code,
      title: event.title,
      attendeeCount: 0,
    }));
  }

  const counts: Record<
    string,
    number
  > = {};

  attRows.forEach((row) => {
    counts[row.event_id] =
      (counts[row.event_id] ?? 0) + 1;
  });

  return events.map((event) => ({
    eventId: event.id,
    eventCode: event.event_code,
    title: event.title,
    attendeeCount:
      counts[event.id] ?? 0,
  }));
}

export async function getAllAttendance(): Promise<
  AdminAttendanceRecord[]
> {
  const {
    data,
    error,
  } = await supabase
    .from('attendance')
    .select(`
      id,
      student_id,
      event_id,
      scanned_at,
      events (
        title,
        event_code
      )
    `)
    .order('scanned_at', {
      ascending: false,
    });

  if (error || !data) {
    console.error(
      'Failed to load all attendance:',
      error
    );

    return [];
  }

  return data.map((row: any) => ({
    id: row.id,
    studentId: row.student_id,
    eventId: row.event_id,
    eventTitle:
      row.events?.title ??
      row.event_id,
    eventCode:
      row.events?.event_code ??
      row.event_id,
    scannedAt: row.scanned_at,
  }));
}

export async function deleteAttendance(
  attendanceId: string
): Promise<{ error: string | null }> {
  const { error } =
    await supabase
      .from('attendance')
      .delete()
      .eq('id', attendanceId);

  return {
    error: error?.message ?? null,
  };
}