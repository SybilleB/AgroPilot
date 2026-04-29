/**
 * hooks/useAuth.ts — État de la session Supabase
 *
 * Écoute les changements d'auth et expose { session, user, loading }.
 * Utilisé dans _layout.tsx pour la redirection automatique.
 */
import { useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/services/supabase';

interface UseAuthReturn {
  session: Session | null;
  user: User | null;
  loading: boolean;
}

export function useAuth(): UseAuthReturn {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // onAuthStateChange fire immédiatement avec INITIAL_SESSION dès l'abonnement.
    // C'est la façon fiable d'initialiser l'état d'auth sur iOS/Android.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false); // toujours déverrouiller, même sur SIGNED_OUT
    });

    // Fallback : getSession() en parallèle pour éviter un blocage si
    // onAuthStateChange tarde (réseau lent, cold start).
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(prev => prev ?? session); // ne pas écraser si déjà défini
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return { session, user: session?.user ?? null, loading };
}
