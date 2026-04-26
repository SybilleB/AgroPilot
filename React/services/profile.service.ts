/**
 * services/profile.service.ts — CRUD profil, exploitation, cultures
 */
import { supabase } from '@/services/supabase';
import { Profile, Exploitation, CultureExploitation, TypeCulture } from '@/types/index';

export interface FullProfile {
  profile: Profile;
  exploitation: Exploitation | null;
  cultures: CultureExploitation[];
}

/** Charge le profil complet d'un utilisateur (profil + exploitation + cultures) */
export async function getFullProfile(userId: string): Promise<FullProfile | null> {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error || !profile) return null;

  const { data: exploitation } = await supabase
    .from('exploitations')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  let cultures: CultureExploitation[] = [];
  if (exploitation?.id) {
    const { data } = await supabase
      .from('cultures_exploitation')
      .select('*')
      .eq('exploitation_id', exploitation.id);
    cultures = data ?? [];
  }

  return { profile, exploitation: exploitation ?? null, cultures };
}

/** Étape 1 du wizard : situation personnelle */
export async function saveProfileStep1(
  userId: string,
  data: Pick<Profile, 'phone' | 'situation_familiale' | 'date_naissance' | 'nb_enfants'>
): Promise<void> {
  const { error } = await supabase.from('profiles').update(data).eq('id', userId);
  if (error) throw error;
}

/** Étape 2 : données de l'exploitation */
export async function saveExploitation(
  userId: string,
  data: Partial<Omit<Exploitation, 'id' | 'user_id'>>
): Promise<string> {
  // Check-then-insert-or-update (évite les problèmes de contrainte onConflict)
  const { data: existing } = await supabase
    .from('exploitations')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (existing?.id) {
    const { data: result, error } = await supabase
      .from('exploitations')
      .update(data)
      .eq('user_id', userId)
      .select('id')
      .single();
    if (error) throw error;
    return result.id;
  } else {
    const { data: result, error } = await supabase
      .from('exploitations')
      .insert({ user_id: userId, ...data })
      .select('id')
      .single();
    if (error) throw error;
    return result.id;
  }
}

/** Étape 3 : cultures (remplace toutes les cultures existantes) */
export async function saveCultures(
  exploitationId: string,
  cultures: Array<{ type_culture: TypeCulture; surface_ha?: number; rendement_moyen?: number }>
): Promise<void> {
  await supabase.from('cultures_exploitation').delete().eq('exploitation_id', exploitationId);

  if (cultures.length > 0) {
    const { error } = await supabase
      .from('cultures_exploitation')
      .insert(cultures.map(c => ({ ...c, exploitation_id: exploitationId })));
    if (error) throw error;
  }
}

/** Retourne true si le profil est suffisamment rempli pour utiliser l'app */
export function isProfileComplete(profile: FullProfile | null): boolean {
  if (!profile) return false;
  const { exploitation } = profile;
  return !!(exploitation?.surface_ha && exploitation?.type_exploitation);
}
