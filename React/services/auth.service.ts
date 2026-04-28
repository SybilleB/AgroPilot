/**
 * services/auth.service.ts — Authentification Supabase
 *
 * Fonctions exposées :
 *  - register()       : création de compte + profil
 *  - login()          : connexion par email/mot de passe
 *  - logout()         : déconnexion (la redirection est gérée par app/_layout.tsx)
 *  - changeEmail()    : changement d'email (Supabase envoie un lien de confirmation)
 *  - changePassword() : changement de mot de passe (vérifie l'ancien d'abord)
 */
import { supabase } from "@/services/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RegisterParams {
  prenom: string;
  nom: string;
  email: string;
  password: string;
}

export interface AuthResult {
  success: boolean;
  error?: string;
  /** Message informatif à afficher en vert (ex: "Email de confirmation envoyé") */
  message?: string;
}

// ─── Inscription ──────────────────────────────────────────────────────────────

export async function register({
  prenom,
  nom,
  email,
  password,
}: RegisterParams): Promise<AuthResult> {
  // 1. Création du compte Supabase Auth
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return { success: false, error: error.message };
  if (!data.user) return { success: false, error: "Compte non créé." };

  // 2. Création du profil en base (table profiles)
  const { error: profileError } = await supabase
    .from("profiles")
    .insert({ id: data.user.id, prenom, nom });

  if (profileError) return { success: false, error: profileError.message };
  return { success: true };
}

// ─── Connexion ────────────────────────────────────────────────────────────────

export async function login(
  email: string,
  password: string,
): Promise<AuthResult> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { success: false, error: error.message };
  return { success: true };
}

// ─── Déconnexion ──────────────────────────────────────────────────────────────
// ⚠️  Ne pas appeler router.replace() après logout.
//     Le guard dans app/_layout.tsx détecte la session nulle et redirige seul.

export async function logout(): Promise<void> {
  await supabase.auth.signOut();
}

// ─── Changer l'email ─────────────────────────────────────────────────────────
// Supabase envoie un email de confirmation à la nouvelle adresse.
// L'email n'est mis à jour qu'une fois le lien cliqué.

export async function changeEmail(newEmail: string): Promise<AuthResult> {
  if (!newEmail.trim())
    return { success: false, error: "Merci de renseigner un email." };

  const { error } = await supabase.auth.updateUser({ email: newEmail });
  if (error) return { success: false, error: error.message };

  return {
    success: true,
    message: `Un lien de confirmation a été envoyé à ${newEmail}. Cliquez dessus pour valider le changement.`,
  };
}

// ─── Changer le mot de passe ──────────────────────────────────────────────────
// On vérifie l'ancien mot de passe en se reconnectant avant de changer.

export async function changePassword(
  currentEmail: string,
  currentPassword: string,
  newPassword: string,
): Promise<AuthResult> {
  if (!currentPassword)
    return {
      success: false,
      error: "Merci de saisir votre mot de passe actuel.",
    };
  if (!newPassword)
    return {
      success: false,
      error: "Merci de saisir un nouveau mot de passe.",
    };
  if (newPassword.length < 6)
    return {
      success: false,
      error: "Le nouveau mot de passe doit contenir au moins 6 caractères.",
    };
  if (currentPassword === newPassword)
    return {
      success: false,
      error: "Le nouveau mot de passe doit être différent de lancien.",
    };

  // 1. Vérification de l'ancien mot de passe (re-login)
  const { error: authError } = await supabase.auth.signInWithPassword({
    email: currentEmail,
    password: currentPassword,
  });
  if (authError)
    return { success: false, error: "Mot de passe actuel incorrect." };

  // 2. Mise à jour du mot de passe
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { success: false, error: error.message };

  return { success: true, message: "Mot de passe mis à jour avec succès." };
}
