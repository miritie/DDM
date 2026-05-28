/**
 * Tests unitaires des helpers de validation quantité produit fini.
 * Couvrent les cas frontière : entiers acceptés, fractions/NaN/négatifs rejetés.
 */

import { describe, it, expect } from 'vitest';
import {
  finishedProductQuantity,
  positiveFinishedProductQuantity,
  assertFinishedProductQuantity,
  assertPositiveFinishedProductQuantity,
} from './quantity';

describe('finishedProductQuantity (>= 0)', () => {
  it('accepte 0', () => {
    expect(finishedProductQuantity.safeParse(0).success).toBe(true);
  });

  it('accepte un entier positif', () => {
    expect(finishedProductQuantity.safeParse(42).success).toBe(true);
  });

  it('rejette une fraction', () => {
    expect(finishedProductQuantity.safeParse(2.5).success).toBe(false);
  });

  it('rejette un négatif', () => {
    expect(finishedProductQuantity.safeParse(-1).success).toBe(false);
  });

  it('rejette NaN', () => {
    expect(finishedProductQuantity.safeParse(NaN).success).toBe(false);
  });

  it('rejette une chaîne', () => {
    expect(finishedProductQuantity.safeParse('5').success).toBe(false);
  });
});

describe('positiveFinishedProductQuantity (> 0)', () => {
  it('rejette 0', () => {
    expect(positiveFinishedProductQuantity.safeParse(0).success).toBe(false);
  });

  it('accepte 1', () => {
    expect(positiveFinishedProductQuantity.safeParse(1).success).toBe(true);
  });

  it('rejette une fraction même positive', () => {
    expect(positiveFinishedProductQuantity.safeParse(0.5).success).toBe(false);
  });
});

describe('assertFinishedProductQuantity', () => {
  it('retourne la valeur si valide', () => {
    expect(assertFinishedProductQuantity(7)).toBe(7);
  });

  it('throw avec le libellé fourni si fraction', () => {
    expect(() => assertFinishedProductQuantity(1.5, 'Quantité X'))
      .toThrowError(/Quantité X invalide/);
  });

  it('throw si négatif', () => {
    expect(() => assertFinishedProductQuantity(-3))
      .toThrowError(/négatif|positif|invalide/i);
  });
});

describe('assertPositiveFinishedProductQuantity', () => {
  it('retourne la valeur si > 0 et entière', () => {
    expect(assertPositiveFinishedProductQuantity(10)).toBe(10);
  });

  it('throw si 0', () => {
    expect(() => assertPositiveFinishedProductQuantity(0, 'Qté envoyée'))
      .toThrowError(/Qté envoyée invalide/);
  });

  it('throw si fraction', () => {
    expect(() => assertPositiveFinishedProductQuantity(2.25))
      .toThrowError(/entier|invalide/i);
  });
});
