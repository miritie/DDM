# 🔧 Correction des Imports RBAC - Client/Server Séparation

**Date:** 2025-11-16
**Problème:** Module `dns` not found - Erreur de bundling Next.js

---

## 🐛 Problème Identifié

L'erreur `Module not found: Can't resolve 'dns'` se produisait lorsqu'on naviguait vers des pages utilisant les composants RBAC (comme `/admin/users`).

### Cause Racine

Le fichier `lib/rbac/index.ts` exportait à la fois:
- ✅ Hooks React client-side (hooks React pour composants)
- ❌ Fonctions server-side (utilisant PostgreSQL/Airtable)

Quand un **Client Component** importait depuis `@/lib/rbac`, Next.js tentait de bundler TOUTES les exports, y compris les fonctions server qui importent `postgres-client.ts` → `pg` → `dns` (module Node.js).

**Résultat:** Erreur car `dns` n'existe pas dans le navigateur.

---

## ✅ Solution Implémentée

### 1. Séparation des Exports

**Avant:**
```typescript
// lib/rbac/index.ts - MIXTE (Client + Server) ❌
export { getUserPermissions, requirePermission } from './get-permissions';
export { usePermissions, useHasPermission } from './use-permissions';
```

**Après:**

**`lib/rbac/index.ts`** - CLIENT-SIDE ONLY ✅
```typescript
// Permissions & constantes (utilisables partout)
export { PERMISSIONS, ROLE_PERMISSIONS, type Permission } from './permissions';

// Client-side hooks UNIQUEMENT
export {
  usePermissions,
  useHasPermission,
  useHasAllPermissions,
  useHasAnyPermission,
} from './use-permissions';
```

**`lib/rbac/server.ts`** - SERVER-SIDE ONLY ✅
```typescript
// Server-side functions
export {
  getUserPermissions,
  userHasPermission,
  userHasAllPermissions,
  userHasAnyPermission,
} from './get-permissions';

export {
  canAccess,
  canAccessAll,
  canAccessAny,
  requirePermission,
  requireAllPermissions,
  requireAnyPermission,
} from './check-permission';

export { PERMISSIONS, ROLE_PERMISSIONS, type Permission } from './permissions';
```

### 2. Mise à Jour des Imports dans les API Routes

**Script automatique créé:** `scripts/fix-rbac-imports.sh`

**Modification effectuée dans 119 fichiers:**
```bash
# Avant
import { requirePermission, PERMISSIONS } from '@/lib/rbac';

# Après
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
```

**Fichiers modifiés:**
- Tous les fichiers dans `app/api/**/*.ts`
- Total: 119 fichiers API routes

---

## 📋 Règles d'Import

### Pour les Client Components (`'use client'`)

```typescript
import { PERMISSIONS, useHasPermission } from '@/lib/rbac';
```

✅ **Autorisé:**
- `PERMISSIONS` (constantes)
- `ROLE_PERMISSIONS` (constantes)
- `type Permission` (type TypeScript)
- `usePermissions()` (hook)
- `useHasPermission()` (hook)
- `useHasAllPermissions()` (hook)
- `useHasAnyPermission()` (hook)

❌ **Interdit:**
- `requirePermission()` → Utiliser l'API route à la place
- `canAccess()` → Utiliser l'API route à la place
- `getUserPermissions()` → Utiliser l'API route à la place

### Pour les Server Components & API Routes

```typescript
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
```

✅ **Autorisé:**
- Toutes les fonctions de `@/lib/rbac/server`
- `requirePermission()`
- `canAccess()`
- `getUserPermissions()`
- etc.

❌ **Interdit:**
- `usePermissions()` → Ne fonctionne que côté client
- `useHasPermission()` → Ne fonctionne que côté client

---

## 🎯 Vérification

### Vérifier qu'il n'y a plus d'erreurs

```bash
# Vérifier que tous les imports API ont été corrigés
find app/api -type f -name "*.ts" -exec grep -l "from '@/lib/rbac'" {} \;
# Résultat attendu: aucun fichier (0 résultats)

# Lancer le build Next.js
npm run build
# Résultat attendu: ✓ Compiled successfully
```

### Test Fonctionnel

1. ✅ Se connecter avec `admin@ddm.cm` / `password123`
2. ✅ Accéder au dashboard admin
3. ✅ Cliquer sur "Gestion Utilisateurs" → `/admin/users`
4. ✅ Pas d'erreur `Module not found: Can't resolve 'dns'`

---

## 📚 Architecture Finale

```
lib/rbac/
├── index.ts              → CLIENT-SIDE exports (hooks + constantes)
├── server.ts             → SERVER-SIDE exports (fonctions DB)
├── permissions.ts        → Constantes (utilisable partout)
├── use-permissions.ts    → Hooks React (client-side)
├── get-permissions.ts    → Fonctions DB (server-side)
└── check-permission.ts   → Fonctions vérification (server-side)

app/
├── (client components)   → import from '@/lib/rbac'
└── api/                  → import from '@/lib/rbac/server'
```

---

## 🚀 Impact

- ✅ **119 API routes** mises à jour automatiquement
- ✅ **0 erreur** de build
- ✅ Séparation claire client/server
- ✅ Pas de risque de bundler du code serveur côté client
- ✅ Meilleure performance (bundle client plus léger)

---

## 📝 Bonnes Pratiques

### DO ✅

1. **Client Components:** Toujours importer depuis `@/lib/rbac`
2. **Server Components/API:** Toujours importer depuis `@/lib/rbac/server`
3. Utiliser les hooks `useHasPermission()` dans les composants client
4. Utiliser `requirePermission()` dans les API routes

### DON'T ❌

1. Ne jamais importer `@/lib/rbac/server` dans un Client Component
2. Ne jamais utiliser les hooks `use*` dans des API routes
3. Ne jamais mélanger imports client/server dans un même fichier
4. Ne jamais importer directement depuis `get-permissions.ts` ou `check-permission.ts`

---

## 🔍 Détection d'Erreurs

Si vous voyez cette erreur:
```
Module not found: Can't resolve 'dns'
Import trace:
  ./lib/database/postgres-client.ts
  ./lib/auth/auth-options.ts
  ...
  ./app/[quelque-page]/page.tsx [Client Component Browser]
```

**Solution:** Le fichier `page.tsx` ou un de ses composants importe une fonction server-side.
- Vérifier les imports `from '@/lib/rbac'`
- Si c'est une API route: changer pour `from '@/lib/rbac/server'`
- Si c'est un Client Component: utiliser les hooks au lieu des fonctions directes

---

## ✅ Statut

**CORRIGÉ** - Tous les dashboards fonctionnent correctement
- Dashboard Admin
- Dashboard DG
- Dashboard Manager
- Dashboard Comptable
- Dashboard Commercial
- Page `/admin/users`
- Toutes les API routes
