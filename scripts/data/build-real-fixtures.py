#!/usr/bin/env python3
"""
Construit les FIXTURES de seeding à partir des datasets OCR des 3 groupes WhatsApp réels
(docs/donnees-reelles/datasets/{stand,usine,admin}.jsonl).

Sortie : scripts/data/real/*.json — référentiels + transactions historiques, consommés
par scripts/seed-real-data.ts au déploiement.

Principes : fidélité (rien d'inventé), total_vente fait foi pour le CA, prix unitaires
DÉRIVÉS des feuilles (recette / unités vendues), chaque enregistrement garde sa photo source.
"""
import json, re, statistics, os
from collections import defaultdict, Counter

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA = os.path.join(ROOT, 'docs', 'donnees-reelles', 'datasets')
OUT = os.path.join(ROOT, 'scripts', 'data', 'real')
os.makedirs(OUT, exist_ok=True)

def load(name):
    p = os.path.join(DATA, f'{name}.jsonl')
    return [json.loads(l) for l in open(p, encoding='utf-8') if l.strip()]

# ---------------------------------------------------------------- Produits
# Catalogue canonique (code, libellé, prix de référence FCFA, catégorie).
# Prix issus de la dérivation recette/unités sur les 812 feuilles réelles.
CATALOG = [
    ('7IEM',          '7ème ciel',          10000, 'Confiserie'),
    ('COMPLET-90',    'Complet-A 90g',       5000, 'Complet-A'),
    ('COMPLET-150',   'Complet-A 150g',     10000, 'Complet-A'),
    ('COMPLET-300',   'Complet-A 300g',     18000, 'Complet-A'),
    ('DELICES',       'Délices',             6000, 'Confiserie'),
    ('FEVES-AIL',     "Fèves à l'ail",       6000, 'Fèves'),
    ('FEVES-PCOLA',   'Fèves petit cola',   10000, 'Fèves'),
    ('PETIT-COLA',    'Petit cola',          2500, 'Petit cola'),
    ('FUT',           'Fût',                 6000, 'Confiserie'),
    ('AMANDE-BISSAP', 'Amande bissap',      10000, 'Amande'),
    ('AMANDE-BAOBAB', 'Amande baobab',       6000, 'Amande'),
    ('AMANDE-PCOLA',  'Amande petit cola',   6000, 'Amande'),
    ('LINGOT',        'Lingot',              6000, 'Confiserie'),
    ('COEUR-CACAO',   'Cœur de cacao',       2500, 'Cacao'),
    ('CAJOU',         'Cajou cola',         10000, 'Cajou'),
    ('GRANULE',       'Granulé petit cola',  6000, 'Confiserie'),
    ('POT-MIEL',      'Pot de miel',        10000, 'Miel'),
]
CODE_BY = {c: (c, n, p, cat) for c, n, p, cat in CATALOG}

def canon_product(raw):
    """Mappe un libellé manuscrit OCR vers un code canonique, ou None si non identifiable."""
    s = (raw or '').strip().lower()
    s = re.sub(r'[^a-zàâçéèêëîïôûùüÿ0-9 ]', ' ', s)
    s = re.sub(r'\s+', ' ', s).strip()
    if not s:
        return None
    has = lambda *ws: any(w in s for w in ws)
    if has('cajou', 'cajoux', 'cajoo'): return 'CAJOU'
    if has('granul'): return 'GRANULE'
    if has('pot', 'scoops') and has('miel'): return 'POT-MIEL'
    if has('complet', 'complét', 'compléta', 'completa', 'cmplt'):
        if '300' in s: return 'COMPLET-300'
        if '150' in s: return 'COMPLET-150'
        if '90' in s: return 'COMPLET-90'
        return 'COMPLET-150'
    if re.search(r'\b7\b', s) or has('7em', '7ème', '7eme', '7iem', '7ie', '7è', 'eme ciel', 'ciel'):
        return '7IEM'
    if has('delice', 'délice'): return 'DELICES'
    if has('coeur', 'cœur', 'coer'): return 'COEUR-CACAO'
    if has('lingot', 'lingo'): return 'LINGOT'
    if has('fève', 'feve', 'fèv', 'fev', 'f.'):
        if has('ail'): return 'FEVES-AIL'
        if has('cola', 'pcola', 'p.cola'): return 'FEVES-PCOLA'
        if has('bao', 'baobab', 'cacao'): return 'AMANDE-BAOBAB'
        return 'FEVES-AIL'
    if has('amande', 'aman', 'amand'):
        if has('bissap'): return 'AMANDE-BISSAP'
        if has('bao', 'baobab'): return 'AMANDE-BAOBAB'
        if has('cola'): return 'AMANDE-PCOLA'
        return 'AMANDE-BISSAP'
    if has('bissap'): return 'AMANDE-BISSAP'
    if has('bao', 'baobab', 'fovo'): return 'AMANDE-BAOBAB'
    if has('fut', 'fût'): return 'FUT'
    if has('petit cola', 'p cola', 'p.cola', 'pcola', 'p. cola'): return 'PETIT-COLA'
    if s == 'cola' or s.startswith('c.cola') or s.startswith('c. cola'): return 'PETIT-COLA'
    return None

# ---------------------------------------------------------------- Stands
def canon_stand(raw):
    s = (raw or '').strip().upper()
    if 'COSMOS' in s: return ('COSMOS-YOPOUGON', 'Cosmos Yopougon', 'Yopougon')
    if 'SUPER U' in s: return ('SUPER-U-DJIBI', 'Super U Djibi', 'Cocody Djibi')
    if 'TRADE' in s: return ('TRADE-CENTER', 'Trade Center', 'Marcory Zone 4')
    if 'PLAYCE MARCORY' in s: return ('PLAYCE-MARCORY', 'Playce Marcory', 'Marcory')
    if 'PLAYCE PALMERAIE' in s or s == 'PALMERAIE': return ('PLAYCE-PALMERAIE', 'Playce Palmeraie', 'Cocody Palmeraie')
    if 'DJITA' in s: return ('MARCORY-DJITA', 'Marcory Djita', 'Marcory')
    if 'MARCORY DJIBI' in s: return ('MARCORY-DJIBI', 'Marcory Djibi', 'Marcory')
    if 'ANGRE' in s: return ('ANGRE-DJIBI', 'Angré Djibi', 'Cocody Angré')
    if s == 'DJIBI': return ('SUPER-U-DJIBI', 'Super U Djibi', 'Cocody Djibi')
    if s == 'MARCORY': return ('PLAYCE-MARCORY', 'Playce Marcory', 'Marcory')
    return None

def units_sold(p):
    """Unités vendues = somme commerciaux, sinon delta table, sinon delta inventaire."""
    sc = [p.get('sold_c1'), p.get('sold_c2'), p.get('sold_c3')]
    sc = [x for x in sc if isinstance(x, (int, float))]
    if sc and sum(sc) > 0:
        return sum(sc)
    ot, rem = p.get('on_table'), p.get('remaining')
    if isinstance(ot, (int, float)) and isinstance(rem, (int, float)) and ot - rem > 0:
        return ot - rem
    io, ic = p.get('inv_open'), p.get('inv_close')
    if isinstance(io, (int, float)) and isinstance(ic, (int, float)) and io - ic > 0:
        return io - ic
    return None

def strip_accents(s):
    import unicodedata
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')

def canon_commercial(raw):
    """Fusionne les variantes OCR d'un nom de commercial vers un nom canonique, ou None."""
    s = strip_accents((raw or '').strip().lower())
    s = re.sub(r'[^a-z /.]', '', s).strip()
    if not s or '/' in s:  # cellule multi-personnes ignorée
        return None
    p = lambda *pre: any(s.startswith(x) for x in pre)
    has = lambda *w: any(x in s for x in w)
    if p('christ', 'crist'): return 'Christelle'
    if p('anic', 'amic', 'aric', 'amin') or s == 'ami': return 'Anicet'
    if has('carine', 'tahe', 'canime') or s in ('dc', 'dc carine', 'carine dc'): return 'Carine Die'
    if p('soni', 'soma'): return 'Sonia'
    if p('estell', 'estell', 'estel'): return 'Estelle'
    if p('tatian', 'tatan'): return 'Tatiana'
    if p('djen'): return 'Djeneba'
    if p('debor'): return 'Débora'
    if p('dominiq'): return 'Dominique'
    if p('grace'): return 'Grâce'
    if p('marina'): return 'Marina'
    if p('sandrine'): return 'Sandrine'
    if p('doroth'): return 'Dorothée'
    if p('rebecca'): return 'Rebecca'
    if p('samira'): return 'Samira'
    if p('marie'): return 'Marie'
    if p('kouame'): return 'Kouamé'
    return None

# Travailleurs usine (depuis les paies), rôle production
USINE_WORKERS = ['Gervais', 'Angenor', 'Christian', 'Michel', 'Anderson']

def build_people(stand):
    """Construit la liste des personnes (commerciaux fusionnés + ouvriers usine) -> users/employees."""
    sheets = defaultdict(int)
    first_seen = {}
    for r in stand:
        date = r.get('date_clean')
        for pr in r.get('primes', []):
            c = canon_commercial(pr.get('commercial'))
            if not c:
                continue
            sheets[c] += 1
            if date and (c not in first_seen or date < first_seen[c]):
                first_seen[c] = date
    people = []
    used_usernames = set()
    def mk_username(name):
        base = re.sub(r'[^a-z]', '', strip_accents(name.split()[0].lower())) or 'agent'
        u, i = base, 1
        while u in used_usernames:
            i += 1; u = f'{base}{i}'
        used_usernames.add(u)
        return u
    for name, n in sorted(sheets.items(), key=lambda x: -x[1]):
        if n < 3:  # bruit OCR (variantes vues 1-2 fois) écarté
            continue
        un = mk_username(name)
        people.append({'full_name': name, 'username': un, 'email': f'{un}@dunedemiel.ci',
                       'role': 'agent_commercial', 'position': 'Commerciale', 'category': 'journalier',
                       'contract_type': 'temporary', 'hire_date': first_seen.get(name), 'sheets': n,
                       'source': 'stand'})
    for w in USINE_WORKERS:
        un = mk_username(w)
        people.append({'full_name': w, 'username': un, 'email': f'{un}@dunedemiel.ci',
                       'role': 'operateur_production', 'position': 'Ouvrier production',
                       'category': 'ouvrier', 'contract_type': 'permanent', 'hire_date': None,
                       'sheets': 0, 'source': 'usine'})
    return people

def file_date(fn):
    m = re.search(r'PHOTO-(\d{4})-(\d{2})-(\d{2})', fn or '')
    return f"{m.group(1)}-{m.group(2)}-{m.group(3)}" if m else None

def rec_date(r):
    d = r.get('date')
    if isinstance(d, str) and re.match(r'^\d{4}-\d{2}-\d{2}$', d):
        return d
    return file_date(r.get('file'))

# Catégories de dépenses (code, libellé)
EXPENSE_CATS = [
    ('LOYER', 'Loyer'), ('SALAIRE', 'Salaires'), ('MAT-PREM', 'Matières premières'),
    ('CACAO', 'Cacao'), ('EMBALLAGE', 'Emballage'), ('TRANSPORT', 'Transport & expédition'),
    ('MAIN-OEUVRE', "Main d'œuvre usine"), ('ACHAT-USINE', 'Achats usine'),
]

def build_expenses(admin, usine):
    """Extrait les dépenses réelles payées (admin catégorisées + paies/achats usine)."""
    out = []
    MIN, MAX = 1000, 3_000_000
    # --- Admin : catégories fiables uniquement ---
    catmap = {'loyer': 'LOYER', 'salaire': 'SALAIRE', 'matiere_premiere': 'MAT-PREM',
              'cacao': 'CACAO', 'emballage': 'EMBALLAGE'}
    titles = {'LOYER': 'Loyer usine', 'SALAIRE': 'Salaires', 'MAT-PREM': 'Matières premières',
              'CACAO': 'Achat cacao', 'EMBALLAGE': 'Emballage', 'TRANSPORT': 'Transport & expédition',
              'MAIN-OEUVRE': 'Paie ouvriers usine', 'ACHAT-USINE': 'Achats usine'}
    for r in admin:
        amt = r.get('amount_total')
        cat = catmap.get((r.get('category') or '').strip().lower())
        if r.get('doc_type') == 'rent':
            cat = 'LOYER'
        if r.get('doc_type') == 'salary':
            cat = cat or 'SALAIRE'
        d = rec_date(r)
        if not cat or not d or not isinstance(amt, (int, float)) or not (MIN <= amt <= MAX):
            continue
        title = titles[cat]
        if r.get('party'):
            title += f" — {r['party'][:40]}"
        out.append({'date': d, 'title': title, 'amount': round(amt), 'category': cat,
                    'source_file': r.get('file'), 'origin': 'admin'})
    # --- Usine : paies ouvriers + achats ---
    for r in usine:
        dt = r.get('doc_type')
        d = rec_date(r)
        if not d:
            continue
        if dt == 'worker_pay':
            cat, title = 'MAIN-OEUVRE', 'Paie ouvriers usine'
        elif dt == 'purchase_need':
            cat, title = 'ACHAT-USINE', 'Achats usine'
        elif dt == 'shipment':
            cat, title = 'TRANSPORT', 'Transport & expédition'
        else:
            continue
        amt = r.get('amount_total')
        if not isinstance(amt, (int, float)) or amt <= 0:
            amt = sum(ln['amount'] for ln in r.get('lines', [])
                      if isinstance(ln.get('amount'), (int, float)) and 0 < ln['amount'] < 500_000)
        if not (MIN <= amt <= MAX):
            continue
        lbl = next((ln.get('label') for ln in r.get('lines', []) if ln.get('label')), None)
        if dt == 'purchase_need' and lbl:
            title += f" — {lbl[:40]}"
        out.append({'date': d, 'title': title, 'amount': round(amt), 'category': cat,
                    'source_file': r.get('file'), 'origin': 'usine'})
    out = [e for e in out if e['date'] >= '2025-01-01']  # fenêtre cohérente
    out.sort(key=lambda x: x['date'])
    return out

# Matières premières (ingredients kind=raw). Code préfixé MP- (namespace distinct des produits).
def canon_material(raw):
    s = strip_accents((raw or '').strip().lower())
    s = re.sub(r'[^a-z ]', ' ', s); s = re.sub(r'\s+', ' ', s).strip()
    if not s:
        return None
    has = lambda *w: any(x in s for x in w)
    # exclure emballages/consommables (ce ne sont pas des matières premières)
    if has('sachet', 'etiquette', 'aluminium', 'carton', 'scotch', 'savon', 'javel', 'gant', 'bidon'):
        return None
    if has('petit cola', 'p cola', 'pcola'): return ('MP-PETIT-COLA', 'Petit cola', 'kg')
    if has('poudre de cacao', 'poudre cacao'): return ('MP-CACAO-POUDRE', 'Poudre de cacao', 'kg')
    if s == 'cacao' or has(' cacao'): return ('MP-CACAO-POUDRE', 'Poudre de cacao', 'kg')
    if s == 'cola' or s.startswith('cola'): return ('MP-COLA', 'Cola', 'kg')
    if has('baobab', 'bao'): return ('MP-BAOBAB', 'Baobab', 'kg')
    if has('bissap'): return ('MP-BISSAP', 'Bissap', 'kg')
    if has('curcuma'): return ('MP-CURCUMA', 'Curcuma', 'kg')
    if s == 'ail' or has(' ail'): return ('MP-AIL', 'Ail', 'kg')
    if has('gingembre'): return ('MP-GINGEMBRE', 'Gingembre', 'kg')
    if has('miel'): return ('MP-MIEL', 'Miel', 'kg')
    if has('pepite', 'pepit'): return ('MP-PEPITE', 'Pépite de cacao', 'kg')
    if has('amande', 'amand'): return ('MP-AMANDE', 'Amande', 'kg')
    if has('arachide', 'cajou'): return ('MP-ARACHIDE', 'Arachide/Cajou', 'kg')
    return None

def build_raw_materials(usine):
    """Dernier inventaire connu par matière (snapshot OCR le plus récent contenant la matière)."""
    latest = {}  # code -> (date, name, unit, qty)
    for r in usine:
        if r.get('doc_type') != 'raw_material_inventory':
            continue
        d = rec_date(r)
        if not d:
            continue
        for ln in r.get('lines', []):
            c = canon_material(ln.get('label'))
            q = ln.get('qty')
            if not c or not isinstance(q, (int, float)) or q < 0:
                continue
            code, name, unit = c
            u = ln.get('unit') or unit
            qkg = q / 1000 if str(u).lower() in ('g', 'gr', 'gramme', 'grammes') else q
            if code not in latest or d > latest[code][0]:
                latest[code] = (d, name, 'kg', round(qkg, 3))
    return [{'code': c, 'name': n, 'unit': u, 'current_stock': q, 'as_of': d, 'kind': 'raw'}
            for c, (d, n, u, q) in sorted(latest.items())]

# Conversion paquet -> unités (sachets) pour aligner la production sur les ventes/stocks
PAQUET_UNITS = {'COMPLET-300': 10, 'COMPLET-150': 20, 'COMPLET-90': 20, '7IEM': 20}
def build_production(usine):
    """Production prête à l'expédition -> entrées de stock produits finis (en unités)."""
    out = []
    for r in usine:
        if r.get('doc_type') != 'production_ready':
            continue
        d = rec_date(r)
        if not d:
            continue
        for ln in r.get('lines', []):
            code = canon_product(ln.get('label'))
            q = ln.get('qty')
            if not code or not isinstance(q, (int, float)) or q <= 0:
                continue
            units = round(q * PAQUET_UNITS.get(code, 20))
            out.append({'date': d, 'product_code': code, 'paquets': q, 'units': units,
                        'source_file': r.get('file')})
    out.sort(key=lambda x: x['date'])
    return out

def main():
    stand = load('stand')
    admin = load('admin')
    usine = load('usine')

    # 1) Prix dérivés par produit canonique (médiane recette/unités), fallback catalogue
    derived = defaultdict(list)
    for r in stand:
        for p in r.get('products', []):
            code = canon_product(p.get('product'))
            u = units_sold(p)
            rec = p.get('recette')
            if code and isinstance(rec, (int, float)) and rec > 0 and u and u > 0:
                derived[code].append(rec / u)
    products = []
    for code, name, ref_price, cat in CATALOG:
        vals = derived.get(code, [])
        price = round(statistics.median(vals) / 500) * 500 if len(vals) >= 5 else ref_price
        products.append({'code': code, 'name': name, 'unit_price': price,
                         'category': cat, 'observations': len(vals)})

    # 2) Stands
    stands = {}
    for r in stand:
        c = canon_stand(r.get('stand_clean') or r.get('stand'))
        if c and c[0] not in stands:
            stands[c[0]] = {'code': c[0], 'name': c[1], 'city': c[2]}
    stands = list(stands.values())

    # 3) Commerciaux (depuis les primes) + observations -> users
    commercials = Counter()
    for r in stand:
        for pr in r.get('primes', []):
            nm = (pr.get('commercial') or '').strip()
            if nm and len(nm) > 1 and not nm.isdigit():
                commercials[nm.title()] += 1
    commercials = [{'name': n, 'sheets': c} for n, c in commercials.most_common() if c >= 2]

    # 4) Ventes détaillées par produit + primes + observation, une feuille = une vente
    sales = []
    price_map = {p['code']: p['unit_price'] for p in products}
    for r in stand:
        c = canon_stand(r.get('stand_clean') or r.get('stand'))
        date = r.get('date_clean')
        if not c or not date:
            continue
        items = []
        for p in r.get('products', []):
            code = canon_product(p.get('product'))
            rec = p.get('recette')
            # Fidélité : une ligne de vente n'existe QUE si une recette est inscrite.
            # Les deltas d'inventaire ne valent pas vente (réappros/transferts).
            if not code or not isinstance(rec, (int, float)) or rec <= 0:
                continue
            u = units_sold(p)
            if not u or u <= 0:
                # qty déduite de la recette et du prix de référence
                pr = price_map.get(code) or 0
                u = max(1, round(rec / pr)) if pr else 1
            unit = round(rec / u)
            items.append({'product_code': code, 'qty': u, 'unit_price': unit, 'total': rec})
        # Réconciliation : le total caisse plausible fait foi ; sinon Σrecette.
        tv = r.get('total_vente')
        base = sum(it['total'] for it in items)
        plausible = tv if isinstance(tv, (int, float)) and tv >= 1000 else None
        target = plausible if plausible else (base if base > 0 else None)
        if target and base > 0:
            if base > target * 1.02:
                # détail dépasse le total caisse -> mise à l'échelle proportionnelle (préserve le mix)
                scale = target / base
                for it in items:
                    it['total'] = round(it['total'] * scale)
                    it['unit_price'] = round(it['total'] / it['qty']) if it['qty'] else it['total']
            elif target > base + 500:
                # total caisse dépasse le détail -> revenu réel non ventilé par produit
                items.append({'product_code': None, 'qty': 1, 'unit_price': round(target - base),
                              'total': round(target - base), 'unallocated': True})
        # Fusion des lignes d'un même produit (plusieurs cases recette -> une ligne)
        merged = {}
        order = []
        for it in items:
            k = it.get('product_code') or '__resid__'
            if k not in merged:
                merged[k] = dict(it); order.append(k)
            else:
                merged[k]['qty'] += it['qty']; merged[k]['total'] += it['total']
        items = [merged[k] for k in order]
        for it in items:
            if it['qty']:
                it['unit_price'] = round(it['total'] / it['qty'])
        total_vente = target
        primes = []
        for pr in r.get('primes', []):
            cc = canon_commercial(pr.get('commercial'))
            if cc and isinstance(pr.get('somme'), (int, float)) and pr['somme'] > 0:
                primes.append({'commercial': cc, 'amount': round(pr['somme'])})
        # vendeur principal = celui à la prime la plus élevée du jour
        seller = max(primes, key=lambda x: x['amount'])['commercial'] if primes else None
        sales.append({
            'date': date, 'outlet_code': c[0], 'total_vente': total_vente,
            'seller': seller, 'items': items, 'primes': primes,
            'observation': r.get('observation'),
            'source_file': r.get('file'), 'confidence': r.get('confidence'),
        })

    # Écriture
    def dump(name, obj):
        json.dump(obj, open(os.path.join(OUT, name), 'w', encoding='utf-8'),
                  ensure_ascii=False, indent=1)
    people = build_people(stand)

    # 5) Stock : inventaire de clôture le plus récent par stand/produit
    latest = {}  # outlet -> (date, {code: inv_close})
    for r in stand:
        c = canon_stand(r.get('stand_clean') or r.get('stand'))
        date = r.get('date_clean')
        if not c or not date:
            continue
        snap = {}
        for p in r.get('products', []):
            code = canon_product(p.get('product'))
            ic = p.get('inv_close')
            if code and isinstance(ic, (int, float)) and ic >= 0:
                snap[code] = ic
        if snap and (c[0] not in latest or date > latest[c[0]][0]):
            latest[c[0]] = (date, snap)
    stock = []
    for outlet, (date, snap) in latest.items():
        for code, qty in snap.items():
            stock.append({'outlet_code': outlet, 'product_code': code, 'quantity': qty, 'as_of': date})

    dump('products.json', products)
    dump('outlets.json', stands)
    dump('commercials.json', commercials)
    expenses = build_expenses(admin, usine)
    raw_materials = build_raw_materials(usine)
    production = build_production(usine)

    dump('people.json', people)
    dump('stock.json', stock)
    dump('sales.json', sales)
    dump('expenses.json', expenses)
    dump('expense-categories.json', [{'code': c, 'label': l} for c, l in EXPENSE_CATS])
    dump('raw-materials.json', raw_materials)
    dump('production.json', production)

    # Récap
    ca = sum(s['total_vente'] or 0 for s in sales)
    ca_items = sum(it['total'] for s in sales for it in s['items'])
    nitems = sum(len(s['items']) for s in sales)
    print(f"products.json    : {len(products)} produits")
    print(f"outlets.json     : {len(stands)} stands")
    print(f"commercials.json : {len(commercials)} libellés bruts")
    print(f"people.json      : {len(people)} personnes ({sum(1 for p in people if p['role']=='agent_commercial')} commerciaux + {sum(1 for p in people if p['role']=='operateur_production')} usine)")
    print(f"stock.json       : {len(stock)} lignes de stock (clôture récente par stand/produit)")
    exp_tot = sum(e['amount'] for e in expenses)
    from collections import Counter as _C
    bycat = _C(e['category'] for e in expenses)
    print(f"expenses.json    : {len(expenses)} dépenses · {exp_tot:,.0f} F · {dict(bycat)}")
    print(f"raw-materials.json: {len(raw_materials)} matières premières (dernier inventaire)")
    prod_u = sum(p['units'] for p in production)
    print(f"production.json  : {len(production)} entrées production · {prod_u:,} unités")
    print(f"sales.json       : {len(sales)} ventes/jours · {nitems} lignes produit")
    print(f"  CA (Σ total_vente feuilles) : {ca:>13,.0f} F")
    print(f"  CA (Σ lignes produit)       : {ca_items:>13,.0f} F  ({ca_items/ca*100:.0f}% reconstitué en détail)")

if __name__ == '__main__':
    main()
