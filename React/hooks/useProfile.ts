/**
 * hooks/useProfile.ts — Profil complet de l'utilisateur connecté
 *
 * Expose { fullProfile, loading, isComplete, refresh }.
 * Utilisé dans le dashboard, le profil et le wizard de complétion.
 */
import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getFullProfile, isProfileComplete, FullProfile } from '@/services/profile.service';

interface UseProfileReturn {
  fullProfile: FullProfile | null;
  loading: boolean;
  isComplete: boolean;
  refresh: () => Promise<void>;
}

export function useProfile(): UseProfileReturn {
  const { user } = useAuth();
  const [fullProfile, setFullProfile] = useState<FullProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) { setFullProfile(null); setLoading(false); return; }
    setLoading(true);
    const data = await getFullProfile(user.id);
    setFullProfile(data);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  return {
    fullProfile,
    loading,
    isComplete: isProfileComplete(fullProfile),
    refresh: load,
  };
}
