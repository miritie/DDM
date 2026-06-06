-- Migration : compteurs de numérotation de documents (idempotente)
--
-- Sert de source atomique pour les numéros de documents (ventes,
-- transactions, paiements, approvisionnements…). Voir
-- lib/database/doc-counters.ts pour l'usage.
--
-- Chaque compteur est amorcé paresseusement par le code applicatif à
-- partir du COUNT(*) existant — pas de seed à faire ici.

CREATE TABLE IF NOT EXISTS doc_counters (
  scope      VARCHAR(160) PRIMARY KEY,
  value      BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

COMMENT ON TABLE doc_counters IS
  'Séquences de numérotation de documents — incrément atomique via UPDATE ... RETURNING. Une ligne par scope (workspace + type de document [+ période]).';
