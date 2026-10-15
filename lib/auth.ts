import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

export type RequestedRole = 'student' | 'teacher';

export type SignUpProfile = {
  full_name: string;
  requested_role: RequestedRole;
  school_id?: string;
};

let currentSession: Session | null = null;

export function setAuth(session: Session | null) {
  currentSession = session;
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(currentSession);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      currentSession = data.session;
      setSession(data.session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      currentSession = newSession;
      if (mounted) {
        setSession(newSession);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return { session, user: session?.user ?? null, loading };
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (!error) setAuth(data.session);
  return { data, error };
}

export async function signUp(email: string, password: string, profile: SignUpProfile) {
  // The database trigger reads these values and creates the profile safely,
  // including when email confirmation means the client has no session yet.
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: profile.full_name,
        requested_role: profile.requested_role,
        school_id: profile.requested_role === 'student' ? profile.school_id?.trim() : null,
      },
    },
  });

  if (!error && data.session) setAuth(data.session);
  return { data, error };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (!error) setAuth(null);
  return { error };
}
