-- Migration : ajout de la table historique_cultures
-- À exécuter dans l'éditeur SQL de Supabase (dashboard → SQL Editor)

-- ── Table ──────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS historique_cultures (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exploitation_id  uuid NOT NULL REFERENCES exploitations(id) ON DELETE CASCADE,
  annee            integer NOT NULL CHECK (annee >= 1950 AND annee <= 2100),
  type_culture     text    NOT NULL,
  surface_ha       numeric(8,2),
  rendement        numeric(8,2),   -- t/ha réalisé (optionnel)
  created_at       timestamptz DEFAULT now()
);

-- Index pour les requêtes courantes
CREATE INDEX IF NOT EXISTS idx_historique_exploitation
  ON historique_cultures (exploitation_id, annee DESC);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE historique_cultures ENABLE ROW LEVEL SECURITY;

-- L'utilisateur peut lire/écrire uniquement l'historique de ses propres exploitations
CREATE POLICY "historique: owner full access"
  ON historique_cultures
  FOR ALL
  USING (
    exploitation_id IN (
      SELECT id FROM exploitations WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    exploitation_id IN (
      SELECT id FROM exploitations WHERE user_id = auth.uid()
    )
  );
