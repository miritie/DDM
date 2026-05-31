-- Migration : observations journalières des stands.
--
-- Un seul commentaire libre par stand et par jour, saisi par le
-- commercial depuis le journal POS. Apparaît dans le PDF journal
-- comme la colonne "OBSERVATION DE LA JOURNEE" du formulaire papier.
--
-- Upsert sur (outlet_id, observation_date) pour qu'il n'y ait qu'une
-- entrée par jour, peu importe combien de fois c'est modifié.
--
-- Idempotente.

CREATE TABLE IF NOT EXISTS outlet_daily_observations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id         UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
  observation_date  DATE NOT NULL,
  observation       TEXT NOT NULL,
  author_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  workspace_id      UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,

  UNIQUE (outlet_id, observation_date)
);

CREATE INDEX IF NOT EXISTS idx_outlet_daily_obs_date
  ON outlet_daily_observations(outlet_id, observation_date DESC);

DROP TRIGGER IF EXISTS update_outlet_daily_observations_updated_at ON outlet_daily_observations;
CREATE TRIGGER update_outlet_daily_observations_updated_at
  BEFORE UPDATE ON outlet_daily_observations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
