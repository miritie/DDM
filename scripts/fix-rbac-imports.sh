#!/bin/bash

# Script pour corriger les imports RBAC dans les API routes
# Remplace @/lib/rbac par @/lib/rbac/server dans tous les fichiers API

echo "🔧 Correction des imports RBAC dans les API routes..."

# Compter les fichiers concernés
count=$(find app/api -type f -name "*.ts" -exec grep -l "from '@/lib/rbac'" {} \; | wc -l)
echo "📊 Fichiers à modifier: $count"

# Remplacer dans tous les fichiers API
find app/api -type f -name "*.ts" -exec sed -i '' "s/from '@\/lib\/rbac'/from '@\/lib\/rbac\/server'/g" {} \;

echo "✅ Remplacement terminé!"

# Vérifier qu'il ne reste plus d'imports incorrects
remaining=$(find app/api -type f -name "*.ts" -exec grep -l "from '@/lib/rbac'" {} \; 2>/dev/null | wc -l)
echo "📊 Fichiers restants avec ancien import: $remaining"

if [ "$remaining" -eq 0 ]; then
  echo "✅ Tous les imports ont été corrigés!"
else
  echo "⚠️  Il reste des fichiers à corriger manuellement"
fi
