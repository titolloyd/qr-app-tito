import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

export type SignUpProfile = {
  full_name: string;
  role: 'student' | 'teacher';
};

let currentSession: Session | null = null;

export function setAuth(session: Session | null) {
  currentSession = session;
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(
    currentSession
  );

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;

      currentSession = data.session;
      setSession(data.session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        currentSession = newSession;

        if (mounted) {
          setSession(newSession);
          setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return {
    session,
    user: session?.user ?? null,
    loading,
  };
}

export async function signIn(
  email: string,
  password: string
) {
  const { data, error } =
    await supabase.auth.signInWithPassword({
      email,
      password,
    });

  if (!error) {
    setAuth(data.session);
  }

  return { data, error };
}

export async function signUp(
  email: string,
  password: string,
  profile?: SignUpProfile
) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    return { data, error };
  }

  if (data.session && profile) {
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        full_name: profile.full_name,
        role: profile.role,
      })
      .eq('id', data.session.user.id);

    if (profileError) {
      return {
        data,
        error: profileError,
      };
    }
  }

  if (data.session) {
    setAuth(data.session);
  }

  return { data, error };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();

  if (!error) {
    setAuth(null);
  }

  return { error };
}