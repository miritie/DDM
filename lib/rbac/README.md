# RBAC - Role-Based Access Control

Système de contrôle d'accès basé sur les rôles pour le système DDM.

## Architecture

Le système RBAC est composé de 3 éléments:

1. **Permissions** - Actions atomiques (ex: `expense:create`, `expense:approve`)
2. **Rôles** - Collections de permissions (ex: `role_admin`, `role_manager`)
3. **Utilisateurs** - Assignés à un rôle via `User.RoleId`

## Utilisation

### Côté Serveur (Server Components, API Routes)

```typescript
import { canAccess, requirePermission, PERMISSIONS } from '@/lib/rbac';

// Vérifier une permission
const hasAccess = await canAccess(PERMISSIONS.EXPENSE_CREATE);
if (hasAccess) {
  // L'utilisateur peut créer une dépense
}

// Exiger une permission (lance une erreur si non autorisé)
await requirePermission(PERMISSIONS.EXPENSE_APPROVE);
```

### Côté Client (Client Components)

#### Hook useHasPermission

```typescript
'use client';

import { useHasPermission, PERMISSIONS } from '@/lib/rbac';
import { Button } from '@/components/ui/button';

export function ExpenseActions() {
  const { hasPermission, loading } = useHasPermission(PERMISSIONS.EXPENSE_CREATE);

  if (loading) return <div>Chargement...</div>;

  if (!hasPermission) return null;

  return <Button>Créer une dépense</Button>;
}
```

#### Composant Can

```typescript
'use client';

import { Can } from '@/components/rbac/can';
import { PERMISSIONS } from '@/lib/rbac';
import { Button } from '@/components/ui/button';

export function ExpenseActions() {
  return (
    <div>
      <Can permission={PERMISSIONS.EXPENSE_CREATE}>
        <Button>Créer</Button>
      </Can>

      <Can permission={PERMISSIONS.EXPENSE_APPROVE}>
        <Button>Approuver</Button>
      </Can>

      <Can permissions={[PERMISSIONS.EXPENSE_EDIT, PERMISSIONS.EXPENSE_DELETE]} requireAll>
        <Button>Modifier et Supprimer</Button>
      </Can>
    </div>
  );
}
```

#### Composant ProtectedPage

```typescript
'use client';

import { ProtectedPage } from '@/components/rbac/protected-page';
import { PERMISSIONS } from '@/lib/rbac';

export default function ExpensesPage() {
  return (
    <ProtectedPage permission={PERMISSIONS.EXPENSE_VIEW}>
      <div>
        <h1>Dépenses</h1>
        {/* Contenu de la page */}
      </div>
    </ProtectedPage>
  );
}
```

## Permissions Disponibles

### Module 7.1 - Ventes
- `sales:view` - Voir les ventes
- `sales:create` - Créer des ventes
- `sales:edit` - Modifier des ventes
- `sales:delete` - Supprimer des ventes

### Module 7.2 - Stocks
- `stock:view` - Voir les stocks
- `stock:create` - Créer des mouvements de stock
- `stock:edit` - Modifier des stocks
- `stock:delete` - Supprimer des mouvements
- `stock:transfer` - Transférer des stocks

### Module 7.3 - Trésorerie
- `treasury:view` - Voir la trésorerie
- `treasury:create` - Créer des transactions
- `treasury:edit` - Modifier la trésorerie
- `treasury:delete` - Supprimer des transactions
- `treasury:approve` - Approuver des transactions

### Module 7.4 - Dépenses
- `expense:view` - Voir les dépenses
- `expense:create` - Créer des demandes de dépenses
- `expense:edit` - Modifier des dépenses
- `expense:delete` - Supprimer des dépenses
- `expense:approve` - Approuver des dépenses
- `expense:pay` - Payer des dépenses

### Module 7.5 - Avances & Dettes
- `advance:view` - Voir les avances
- `advance:create` - Créer des avances
- `advance:edit` - Modifier des avances
- `advance:delete` - Supprimer des avances
- `advance:approve` - Approuver des avances
- `debt:view` - Voir les dettes
- `debt:create` - Créer des dettes
- `debt:edit` - Modifier des dettes
- `debt:delete` - Supprimer des dettes

### Module 7.6 - Ressources Humaines
- `hr:view` - Voir les RH
- `hr:create` - Créer des enregistrements RH
- `hr:edit` - Modifier des RH
- `hr:delete` - Supprimer des RH
- `hr:payroll` - Gérer la paie

### Administration
- `admin:users` - Gérer les utilisateurs
- `admin:roles` - Gérer les rôles
- `admin:settings` - Gérer les paramètres
- `admin:audit` - Voir les logs d'audit

### Rapports
- `reports:view` - Voir les rapports
- `reports:export` - Exporter les rapports

## Rôles Prédéfinis

### role_admin
Accès complet à tout le système (toutes les permissions).

### role_manager
- Gestion complète des ventes, stocks, dépenses
- Approbation des dépenses et avances
- Accès aux rapports

### role_accountant
- Gestion de la trésorerie
- Gestion des dépenses (création, modification, paiement)
- Gestion des avances et dettes
- Accès aux rapports

### role_user
- Lecture uniquement sur la plupart des modules
- Création de demandes de dépenses
- Consultation des rapports

## Ajouter de Nouvelles Permissions

1. Ajouter la permission dans `lib/rbac/permissions.ts`:

```typescript
export const PERMISSIONS = {
  // ... existant
  MY_NEW_PERMISSION: 'module:action',
};
```

2. Assigner aux rôles appropriés:

```typescript
export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  role_admin: [
    // ... existant
    PERMISSIONS.MY_NEW_PERMISSION,
  ],
};
```

3. Créer la permission dans Airtable (table `Permission`):
   - PermissionId: `perm_xxx`
   - Code: `module:action`
   - Name: "Action Module"
   - Module: "Module Name"

4. Assigner aux rôles dans Airtable (table `Role`):
   - Ajouter `perm_xxx` au champ `PermissionIds`

## Bonnes Pratiques

1. **Principe du moindre privilège** - Accordez uniquement les permissions nécessaires
2. **Granularité** - Créez des permissions spécifiques plutôt que générales
3. **Nommage cohérent** - Utilisez le format `module:action` (ex: `expense:create`)
4. **Documentation** - Documentez toujours les nouvelles permissions
5. **Tests** - Testez les permissions dans différents scénarios
