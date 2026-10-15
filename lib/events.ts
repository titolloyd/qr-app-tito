import { supabase } from './supabase';

export type EventStatus = 'open' | 'closed';

export type Event = {
  event_code: string;
  title: string;
  start_time: string | null;
  end_time: string | null;
  venue?: string | null;
  description?: string | null;
  status?: EventStatus;
};

export type CloudEvent = Event & {
  id: string;
  created_by: string | null;
  created_at: string;
};

export async function createEvent(
  event: Event
): Promise<{ error: string | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error:
        'You must be logged in to create an event.',
    };
  }

  const { error } = await supabase
    .from('events')
    .insert({
      event_code: event.event_code,
      title: event.title,
      start_time: event.start_time,
      end_time: event.end_time,
      venue: event.venue ?? null,
      description:
        event.description ?? null,
      status: event.status ?? 'open',
      created_by: user.id,
    });

  return {
    error: error?.message ?? null,
  };
}

export async function getEventsByTeacher(
  teacherId: string
): Promise<CloudEvent[]> {
  const { data, error } =
    await supabase
      .from('events')
      .select('*')
      .eq('created_by', teacherId)
      .order('created_at', {
        ascending: false,
      });

  if (error || !data) {
    return [];
  }

  return data as CloudEvent[];
}

export async function getAllEvents(): Promise<
  CloudEvent[]
> {
  const { data, error } =
    await supabase
      .from('events')
      .select('*')
      .order('created_at', {
        ascending: false,
      });

  if (error || !data) {
    console.error(
      'Failed to load all events:',
      error
    );

    return [];
  }

  return data as CloudEvent[];
}

export async function getEventByCode(
  code: string
): Promise<CloudEvent | null> {
  const { data, error } =
    await supabase
      .from('events')
      .select('*')
      .eq('event_code', code)
      .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as CloudEvent;
}

export async function updateEvent(
  eventId: string,
  updates: {
    title?: string;
    event_code?: string;
    start_time?: string | null;
    end_time?: string | null;
    venue?: string | null;
    description?: string | null;
    status?: EventStatus;
  }
): Promise<{ error: string | null }> {
  const { error } =
    await supabase
      .from('events')
      .update(updates)
      .eq('id', eventId);

  return {
    error: error?.message ?? null,
  };
}

export async function closeEvent(
  eventId: string
): Promise<{ error: string | null }> {
  const { error } =
    await supabase
      .from('events')
      .update({
        status: 'closed',
      })
      .eq('id', eventId);

  return {
    error: error?.message ?? null,
  };
}

/**
 * Permanently deletes an event and its attendance records.
 * Attendance rows are removed first to avoid foreign-key restrictions.
 */
export async function deleteEvent(
  eventId: string
): Promise<{ error: string | null }> {
  const { error: attendanceError } = await supabase
    .from('attendance')
    .delete()
    .eq('event_id', eventId);

  if (attendanceError) {
    return {
      error: `Could not remove the event's attendance records: ${attendanceError.message}`,
    };
  }

  const { error: eventError } = await supabase
    .from('events')
    .delete()
    .eq('id', eventId);

  return {
    error: eventError?.message ?? null,
  };
}
