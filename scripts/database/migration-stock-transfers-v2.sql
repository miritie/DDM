-- ============================================================================
-- Migration STOCK TRANSFERS v2 — Statut 'recalled' (rappel émetteur)
-- ============================================================================
-- Ajoute la valeur 'recalled' à l'enum stock_transfer_leg_status pour
-- distinguer un refus côté destinataire d'un rappel côté émetteur.
-- Idempotente (IF NOT EXISTS).
-- ============================================================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'stock_transfer_leg_status'::regtype AND enumlabel = 'recalled'
  ) THEN
    ALTER TYPE stock_transfer_leg_status ADD VALUE 'recalled' AFTER 'refused';
  END IF;
END $$;

DO $$ BEGIN
  RAISE NOTICE 'enum recalled .............. %',
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_enum WHERE enumtypid='stock_transfer_leg_status'::regtype AND enumlabel='recalled'
    ) THEN 'OK' ELSE 'MANQUANT' END;
END $$;
