
import { supabase } from './supabase';

export type Role = 'student' | 'teacher' | 'admin';
export type RequestedRole = 'student' | 'teacher';
export type ApprovalStatus = 'approved' | 'pending' | 'rejected';
export type SchoolIdStatus =
  | 'not_required'
  | 'pending'
  | 'verified'
  | 'rejected';

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  requested_role: RequestedRole;
  approval_status: ApprovalStatus;
  school_id: string | null;
  school_id_status: SchoolIdStatus;
};

export async function getProfile(
  userId: string
): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id, email, full_name, role, requested_role, approval_status, school_id, school_id_status'
    )
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) {
    if (error) {
      console.error('Failed to load profile:', error.message);
    }

    return null;
  }

  return data as Profile;
}

export async function getAllProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id, email, full_name, role, requested_role, approval_status, school_id, school_id_status, created_at'
    )
    .order('created_at', { ascending: false });

  if (error || !data) {
    console.error('Failed to load profiles:', error);
    return [];
  }

  return data as Profile[];
}

export async function updateProfile(
  userId: string,
  updates: { full_name?: string }
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId);

  return { error: error?.message ?? null };
}

export async function adminSetUserRole(
  targetUserId: string,
  role: Role
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('admin_set_user_role', {
    target_user_id: targetUserId,
    new_role: role,
  });

  return { error: error?.message ?? null };
}

export async function reviewTeacherRequest(
  targetUserId: string,
  approve: boolean
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc(
    'admin_review_teacher_request',
    {
      target_user_id: targetUserId,
      approve_request: approve,
    }
  );

  return { error: error?.message ?? null };
}

export async function reviewStudentSchoolId(
  targetUserId: string,
  approve: boolean
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc(
    'admin_review_student_school_id',
    {
      target_user_id: targetUserId,
      approve_id: approve,
    }
  );

  return { error: error?.message ?? null };
}
