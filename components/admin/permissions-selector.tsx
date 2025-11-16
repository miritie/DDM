'use client';

/**
 * Composant - Sélecteur de Permissions par Module
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Permission } from '@/types/modules';

interface PermissionsSelectorProps {
  selectedPermissionIds: string[];
  onPermissionsChange: (permissionIds: string[]) => void;
}

export function PermissionsSelector({
  selectedPermissionIds,
  onPermissionsChange,
}: PermissionsSelectorProps) {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupedPermissions, setGroupedPermissions] = useState<Record<string, Permission[]>>({});

  useEffect(() => {
    loadPermissions();
  }, []);

  useEffect(() => {
    // Grouper les permissions par module
    const grouped: Record<string, Permission[]> = {};
    permissions.forEach((perm) => {
      const module = perm.Module || 'Autre';
      if (!grouped[module]) {
        grouped[module] = [];
      }
      grouped[module].push(perm);
    });
    setGroupedPermissions(grouped);
  }, [permissions]);

  async function loadPermissions() {
    try {
      const res = await fetch('/api/admin/permissions');
      if (res.ok) {
        const data = await res.json();
        setPermissions(data.data || []);
      }
    } catch (error) {
      console.error('Error loading permissions:', error);
    } finally {
      setLoading(false);
    }
  }

  function handlePermissionToggle(permissionId: string, checked: boolean) {
    let newSelection: string[];
    if (checked) {
      newSelection = [...selectedPermissionIds, permissionId];
    } else {
      newSelection = selectedPermissionIds.filter((id) => id !== permissionId);
    }
    onPermissionsChange(newSelection);
  }

  function handleModuleToggle(module: string, checked: boolean) {
    const modulePermissions = groupedPermissions[module] || [];
    const modulePermissionIds = modulePermissions.map((p) => (p as any).id);

    let newSelection: string[];
    if (checked) {
      // Ajouter toutes les permissions du module
      newSelection = [...new Set([...selectedPermissionIds, ...modulePermissionIds])];
    } else {
      // Retirer toutes les permissions du module
      newSelection = selectedPermissionIds.filter((id) => !modulePermissionIds.includes(id));
    }
    onPermissionsChange(newSelection);
  }

  function isModuleSelected(module: string): boolean {
    const modulePermissions = groupedPermissions[module] || [];
    if (modulePermissions.length === 0) return false;

    const modulePermissionIds = modulePermissions.map((p) => (p as any).id);
    return modulePermissionIds.every((id) => selectedPermissionIds.includes(id));
  }

  function isModulePartiallySelected(module: string): boolean {
    const modulePermissions = groupedPermissions[module] || [];
    if (modulePermissions.length === 0) return false;

    const modulePermissionIds = modulePermissions.map((p) => (p as any).id);
    const selectedCount = modulePermissionIds.filter((id) => selectedPermissionIds.includes(id))
      .length;

    return selectedCount > 0 && selectedCount < modulePermissionIds.length;
  }

  const moduleLabels: Record<string, string> = {
    admin: 'Administration',
    sales: 'Ventes',
    stock: 'Stock',
    treasury: 'Trésorerie',
    production: 'Production',
    expense: 'Dépenses',
    consignment: 'Consignation',
    partner: 'Partenaires',
    advance: 'Avances',
    debt: 'Dettes',
    hr: 'Ressources Humaines',
    customer: 'Clients',
    loyalty: 'Fidélité',
    ai: 'IA & Décisions',
    reports: 'Rapports',
    notification: 'Notifications',
  };

  if (loading) {
    return <div className="text-center py-8">Chargement des permissions...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">
          Permissions ({selectedPermissionIds.length}/{permissions.length})
        </h3>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onPermissionsChange(permissions.map((p) => (p as any).id))}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Tout sélectionner
          </button>
          <span className="text-gray-400">|</span>
          <button
            type="button"
            onClick={() => onPermissionsChange([])}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Tout désélectionner
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.keys(groupedPermissions)
          .sort()
          .map((module) => {
            const modulePerms = groupedPermissions[module];
            const isSelected = isModuleSelected(module);
            const isPartial = isModulePartiallySelected(module);

            return (
              <Card key={module}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(checked) =>
                        handleModuleToggle(module, checked as boolean)
                      }
                      className={isPartial ? 'bg-blue-100' : ''}
                    />
                    <span>
                      {moduleLabels[module] || module} ({modulePerms.length})
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {modulePerms.map((perm) => (
                    <div key={(perm as any).id} className="flex items-start gap-2">
                      <Checkbox
                        id={`perm-${(perm as any).id}`}
                        checked={selectedPermissionIds.includes((perm as any).id)}
                        onCheckedChange={(checked) =>
                          handlePermissionToggle((perm as any).id, checked as boolean)
                        }
                      />
                      <label
                        htmlFor={`perm-${(perm as any).id}`}
                        className="text-sm cursor-pointer flex-1"
                      >
                        <div className="font-medium">{perm.Name}</div>
                        {perm.Description && (
                          <div className="text-xs text-gray-500">{perm.Description}</div>
                        )}
                      </label>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}
      </div>
    </div>
  );
}
