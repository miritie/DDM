#!/usr/bin/env python3
"""
Parse l'artefact Excel COMPOSITIONS P.R-P.V. vers /tmp/compositions.json.

Format produit par bloc :
  ligne FINANCES : col A = nom_produit, col B = 'FINANCES', cols D-M = ingrédients
  ligne suivante  : col A = poids_g, cols D-M = quantités en grammes
  ligne RECETTE   : col A = 'PRIX/SACHET', col B = 'RECETTE', cols D-M = %
  ligne pricing   : col A = prix_vente, col B = total_recette
  ligne COMMANDE  : col A = 'COMMANDE/U', col B = 'BENEFICE BRUT', cols D-M = coûts
  ligne net       : col A = 1, col B = bénéfice_brut

Particularités gérées :
  - Header parfois décalé (FEVE BAOBAB, 7ÈME France) : on regarde ±1 ligne
    pour trouver les noms d'ingrédients et la ligne quantités.
  - Normalisation des doublons d'ingrédients (CACAO P/SACO/POUDRE/etc.).
"""
import openpyxl
import json
import sys

ARTIFACT = '/Volumes/DATA/DEVS/DDM/artefacts/COMPOSITIONS  P.R-P.V. 2026.xlsx'
OUT = '/tmp/compositions.json'

NORMALIZE = {
    'CACAO': 'CACAO POUDRE',
    'CACAO P': 'CACAO POUDRE',
    'CACAO SACO': 'CACAO POUDRE',
    'CACAO POUDRE': 'CACAO POUDRE',
    'PT COLA': 'PETIT COLA',
    'PETIT COLA': 'PETIT COLA',
    'CLOU DE G': 'CLOU DE GIROFLE',
    'CLOUS DE GIROFLE': 'CLOU DE GIROFLE',
    'CLOU DE GIROFLE': 'CLOU DE GIROFLE',
    'B  KARITE': 'BEURRE DE KARITE',
    'B KARITE': 'BEURRE DE KARITE',
    'FEVE': 'FEVE DE CACAO',
    'MACERAT GIROFLE 50/150 30MN': 'MACERAT GIROFLE',
    'MACERAT LIN 50/150 15MN': 'MACERAT LIN',
    'MACERA PT COLA 50/150 30MN': 'MACERAT PETIT COLA',
    'CANNELLE': 'CANNELLE',
    'CANNELLE SEILAND': 'CANNELLE',
}


def normalize_ing(name: str) -> str:
    return NORMALIZE.get(name.strip().upper(), name.strip().upper())


def is_str(v) -> bool:
    return isinstance(v, str) and v.strip() != ''


def is_num(v) -> bool:
    return isinstance(v, (int, float))


def main():
    wb = openpyxl.load_workbook(ARTIFACT, data_only=True)
    ws = wb['COMPOS et ESTIMATION']
    rows = [list(r) for r in ws.iter_rows(values_only=True)]

    products = []
    i = 0
    while i < len(rows):
        row = rows[i]
        if not (is_str(row[1]) and row[1].strip() == 'FINANCES'):
            i += 1
            continue

        name = row[0].strip() if is_str(row[0]) else None
        if not name:
            i += 1
            continue

        # Cherche les noms d'ingrédients dans les 3 lignes autour (header parfois décalé)
        candidates = []
        if i > 0:
            candidates.append(rows[i - 1])
        candidates.append(row)
        if i + 1 < len(rows):
            candidates.append(rows[i + 1])
        ing_names = [None] * 13
        for c in candidates:
            for col in range(3, 13):
                if col >= len(c):
                    continue
                if is_str(c[col]) and ing_names[col] is None:
                    ing_names[col] = c[col].strip()

        # Ligne quantités : juste après FINANCES, sauf si elle contient des
        # strings dans D-M (cas 7ÈME France) → on prend la suivante.
        # Important : on garde le poids total depuis la ligne ORIGINALE
        # (col A), même si on décale les colonnes ingrédients.
        original_first_row = rows[i + 1] if i + 1 < len(rows) else []
        weight_g_keep = original_first_row[0] if is_num(original_first_row[0]) else None
        weights_row = original_first_row
        if any(is_str(weights_row[c]) for c in range(3, 13) if c < len(weights_row)):
            # Cherche dans les 3 lignes suivantes une ligne dont col A n'est
            # pas un libellé et dont la somme des D-M numériques est plausible.
            for offset in (2, 3):
                if i + offset >= len(rows):
                    break
                r = rows[i + offset]
                if is_str(r[0]):
                    continue
                weights_row = r
                break

        # Cost row : ligne contenant 'COMMANDE' en col A
        cost_row = None
        for j in range(i + 1, min(i + 7, len(rows))):
            if is_str(rows[j][0]) and 'COMMANDE' in rows[j][0].upper():
                cost_row = rows[j]
                break

        # On préfère le poids capturé sur la ligne originale (avant décalage)
        weight_g = weight_g_keep
        if weight_g is None and is_num(weights_row[0]):
            weight_g = weights_row[0]

        # Prix de vente : ligne après "PRIX/..."
        sale_price = None
        for j in range(i + 1, min(i + 6, len(rows))):
            if is_str(rows[j][0]) and 'PRIX' in rows[j][0].upper():
                if j + 1 < len(rows) and is_num(rows[j + 1][0]):
                    sale_price = float(rows[j + 1][0])
                break

        # Bénéfice brut
        benefice = None
        for j in range(i + 1, min(i + 8, len(rows))):
            if is_str(rows[j][1]) and 'BENEFICE BRUT' in rows[j][1].upper():
                if j + 1 < len(rows) and is_num(rows[j + 1][1]):
                    benefice = float(rows[j + 1][1])
                break

        ingredients = []
        for col in range(3, 13):
            raw = ing_names[col]
            if not raw:
                continue
            qty = weights_row[col] if col < len(weights_row) else None
            if not is_num(qty) or qty <= 0:
                continue
            cost = cost_row[col] if cost_row and col < len(cost_row) and is_num(cost_row[col]) else None
            cost_per_g = (cost / qty) if cost and qty else None
            ingredients.append({
                'raw_name': raw,
                'name': normalize_ing(raw),
                'quantity_g': float(qty),
                'unit_cost_per_sachet': cost,
                'cost_per_g': cost_per_g,
            })

        products.append({
            'name': name,
            'weight_g': float(weight_g) if weight_g else None,
            'sale_price_xof': sale_price,
            'benefice_brut_xof': benefice,
            'ingredients': ingredients,
        })
        i += 6

    # Agrégation ingrédients pour PMP moyens
    summary = {}
    for p in products:
        for ing in p['ingredients']:
            n = ing['name']
            summary.setdefault(n, {'count': 0, 'cost_per_g_values': []})
            summary[n]['count'] += 1
            if ing['cost_per_g']:
                summary[n]['cost_per_g_values'].append(ing['cost_per_g'])

    ingredients_summary = {}
    for n, d in summary.items():
        vs = d['cost_per_g_values']
        ingredients_summary[n] = {
            'count': d['count'],
            'avg_cost_per_g_xof': (sum(vs) / len(vs)) if vs else None,
        }

    with open(OUT, 'w') as f:
        json.dump({'products': products, 'ingredients_summary': ingredients_summary}, f, indent=2, ensure_ascii=False)

    print(f"✓ {len(products)} produits, {len(ingredients_summary)} ingrédients → {OUT}")


if __name__ == '__main__':
    main()
