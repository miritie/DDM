#!/usr/bin/env bash
# Script d'initialisation du serveur Ubuntu pour héberger DDM.
# À lancer UNE FOIS sur le serveur, puis CI/CD prend le relais.
#
# Usage : sudo bash setup-server.sh

set -euo pipefail

if [ "$EUID" -ne 0 ]; then
  echo "❌ Lancer en root (sudo)"; exit 1
fi

echo "📦 1/6 - Mise à jour du système"
apt update && apt upgrade -y

echo "📦 2/6 - Installation Docker + nginx"
apt install -y ca-certificates curl gnupg lsb-release nginx
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
  | tee /etc/apt/sources.list.d/docker.list >/dev/null
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

echo "📦 3/6 - Création arborescence /opt/ddm"
mkdir -p /opt/ddm
chown "$SUDO_USER":"$SUDO_USER" /opt/ddm

echo "📦 4/6 - Installation nginx config"
SCRIPT_DIR="$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cp "$SCRIPT_DIR/nginx-ddm.conf" /etc/nginx/sites-available/ddm
ln -sf /etc/nginx/sites-available/ddm /etc/nginx/sites-enabled/ddm
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo "📦 5/6 - Installation docker-compose.yml dans /opt/ddm"
cp "$SCRIPT_DIR/../docker-compose.yml" /opt/ddm/docker-compose.yml
chown "$SUDO_USER":"$SUDO_USER" /opt/ddm/docker-compose.yml

echo "📦 6/6 - Vérification firewall (UFW)"
if command -v ufw &> /dev/null; then
  ufw allow 22/tcp   || true
  ufw allow 80/tcp   || true
  echo "  ⚠️ Activez UFW avec : sudo ufw enable (après vérification SSH OK)"
fi

cat <<EOF

✅ Serveur prêt.

Étapes suivantes :
  1. Créer /opt/ddm/.env avec les variables (voir deploy/env.example)
     sudo -u $SUDO_USER nano /opt/ddm/.env

  2. Login Docker pour pull depuis ghcr.io :
     echo <GHCR_PULL_TOKEN> | sudo docker login ghcr.io -u <github-user> --password-stdin

  3. Premier déploiement manuel (test) :
     cd /opt/ddm && sudo docker compose pull && sudo docker compose up -d

  4. Vérifier que ça répond :
     curl -I http://localhost:3001/auth/login
     curl -I http://localhost/ddm/auth/login

  5. Configurer les secrets GitHub (Settings → Secrets → Actions) :
     SSH_HOST, SSH_USER, SSH_PRIVATE_KEY, GHCR_PULL_TOKEN, GHCR_USER (optionnel)

EOF
