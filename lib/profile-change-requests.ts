import { supabase } from './supabase';

export type ProfileChangeType = 'name' | 'school_id';
export type ProfileChangeStatus = 'pending' | 'approved' | 'rejected';

export type ProfileChangeRequest = {
  id: string;
  user_id: string;
  request_type: ProfileChangeType;
  current_value: string | null;
  requested_value: string;
  reason: string;
  status: ProfileChangeStatus;
  admin_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  student_name?: string | null;
  student_email?: string | null;
};

export async function getMyProfileChangeRequests(): Promise<ProfileChangeRequest[]> {
  const { data, error } = await supabase
    .from('profile_change_requests')
    .select('id,user_id,request_type,current_value,requested_value,reason,status,admin_note,reviewed_by,reviewed_at,created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ProfileChangeRequest[];
}

export async function createProfileChangeRequest(input: {
  userId: string;
  requestType: ProfileChangeType;
  currentValue: string | null;
  requestedValue: string;
  reason: string;
}) {
  const { error } = await supabase.from('profile_change_requests').insert({
    user_id: input.userId,
    request_type: input.requestType,
    current_value: input.currentValue,
    requested_value: input.requestedValue.trim(),
    reason: input.reason.trim(),
  });
  if (error) throw error;
}

export async function getAllProfileChangeRequests(): Promise<ProfileChangeRequest[]> {
  const { data, error } = await supabase
    .from('profile_change_requests')
    .select('id,user_id,request_type,current_value,requested_value,reason,status,admin_note,reviewed_by,reviewed_at,created_at,profiles!profile_change_requests_user_id_fkey(full_name,email)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    ...row,
    student_name: row.profiles?.full_name ?? null,
    student_email: row.profiles?.email ?? null,
    profiles: undefined,
  })) as ProfileChangeRequest[];
}

export async function reviewProfileChangeRequest(
  requestId: string,
  approve: boolean,
  adminNote: string,
): Promise<void> {
  const { error } = await supabase.rpc('admin_review_profile_change_request', {
    request_id: requestId,
    approve_request: approve,
    review_note: adminNote.trim() || null,
  });
  if (error) throw error;
}
