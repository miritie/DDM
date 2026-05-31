-- Migration : fiches produit enrichies (bienfaits, indications, composition)
-- + table product_images pour images additionnelles (carrousel POS).
--
-- Idempotente — réexécutable sans danger.

-- 1. Sections texte structurées sur products.
ALTER TABLE products ADD COLUMN IF NOT EXISTS benefits TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS usage_notes TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS composition TEXT;

COMMENT ON COLUMN products.description IS  'Pitch court visible en POS (1-2 lignes).';
COMMENT ON COLUMN products.benefits IS     'Bienfaits / propriétés du produit (aide-mémoire vendeur).';
COMMENT ON COLUMN products.usage_notes IS  'Indications / mode d''emploi / conseils d''utilisation.';
COMMENT ON COLUMN products.composition IS  'Ingrédients / origine / composition détaillée.';

-- 2. Images additionnelles (carrousel sur la fiche produit).
-- L'image principale reste products.image_url ; product_images = celles en plus.
CREATE TABLE IF NOT EXISTS product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  position INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_product_images_product_id
  ON product_images(product_id, position);
