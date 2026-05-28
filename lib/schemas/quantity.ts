/**
 * Schémas Zod réutilisables pour les quantités.
 *
 * Règle métier : les produits finis (sale_items, stock_items, stock_movements,
 * production_orders, production_batches, recipes.output_quantity, stock_transfer_lines,
 * stand_replenishment_*) se comptent en unités entières. Les dosages d'ingrédients
 * (recipe_lines, ingredient_consumptions, ingredients.*, purchase_request_lines)
 * restent fractionnaires (kg/g/L).
 */

import { z } from 'zod';

export const finishedProductQuantity = z
  .number({ message: 'Quantité numérique requise' })
  .int('La quantité doit être un nombre entier')
  .nonnegative('La quantité ne peut pas être négative');

export const positiveFinishedProductQuantity = z
  .number({ message: 'Quantité numérique requise' })
  .int('La quantité doit être un nombre entier')
  .positive('La quantité doit être strictement positive');

/**
 * Helper : applique le schéma à une valeur en lançant un message clair.
 * À appeler en tête de service avant tout INSERT/UPDATE sur une colonne « produit fini ».
 */
export function assertFinishedProductQuantity(value: unknown, fieldLabel = 'quantité'): number {
  const r = finishedProductQuantity.safeParse(value);
  if (!r.success) {
    throw new Error(`${fieldLabel} invalide : ${r.error.issues[0]?.message ?? 'valeur incorrecte'}`);
  }
  return r.data;
}

export function assertPositiveFinishedProductQuantity(value: unknown, fieldLabel = 'quantité'): number {
  const r = positiveFinishedProductQuantity.safeParse(value);
  if (!r.success) {
    throw new Error(`${fieldLabel} invalide : ${r.error.issues[0]?.message ?? 'valeur incorrecte'}`);
  }
  return r.data;
}
