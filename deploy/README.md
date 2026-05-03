# Déploiement DDM — conteneurisé via GitHub Actions

## Architecture

```
GitHub push (main)
      │
      ▼
GitHub Actions
  ├─ Build image Docker
  ├─ Push vers ghcr.io/miritie/ddm:latest
  └─ SSH au serveur → docker compose pull + up

Serveur Ubuntu (204.168.150.125)
  ├─ nginx (port 80, public)
  │    ├─ /ddm/*  → app:3001/* (rewrite)
  │    ├─ /api/*  → app:3001/api/*
  │    ├─ /_next/* → app:3001/_next/*
  │    └─ /scan/* → app:3001/scan/*  (QR client public)
  │
  └─ Docker
       └─ ddm-app (Next.js sur :3001, env_file .env)
            └→ Neon PostgreSQL (cloud)
```

## Initialisation du serveur (une fois)

1. Se connecter en SSH avec une clé (pas de mot de passe).

2. Cloner le repo :
   ```bash
   cd /tmp
   git clone https://github.com/miritie/DDM.git
   cd DDM/deploy
   ```

3. Lancer le setup :
   ```bash
   sudo bash setup-server.sh
   ```
   Installe Docker + nginx, copie la config nginx et docker-compose.yml dans `/opt/ddm`.

4. Créer `/opt/ddm/.env` (voir `env.example`) :
   ```bash
   sudo -u <votre-user> cp env.example /opt/ddm/.env
   sudo -u <votre-user> nano /opt/ddm/.env
   sudo chmod 600 /opt/ddm/.env
   ```

5. Login Docker pour pouvoir pull depuis ghcr.io :
   - Sur GitHub, créer un Personal Access Token avec scope `read:packages`.
   - Sur le serveur :
     ```bash
     echo <TOKEN> | sudo docker login ghcr.io -u <github-username> --password-stdin
     ```

6. Premier déploiement manuel pour vérifier :
   ```bash
   cd /opt/ddm
   sudo docker compose pull
   sudo docker compose up -d
   curl -I http://localhost/ddm/auth/login    # devrait répondre 200 ou 302
   ```

## Configuration des secrets GitHub

Settings → Secrets and variables → Actions → New repository secret :

| Nom                | Valeur                                                      |
| ------------------ | ----------------------------------------------------------- |
| `SSH_HOST`         | IP ou DNS du serveur (`204.168.150.125`)                    |
| `SSH_USER`         | utilisateur SSH (ex. `miritie`)                             |
| `SSH_PRIVATE_KEY`  | clé privée SSH (en clair, multi-lignes — la clé publique est dans `~/.ssh/authorized_keys` côté serveur) |
| `SSH_PORT`         | (optionnel, 22 par défaut)                                  |
| `GHCR_PULL_TOKEN`  | PAT GitHub avec scope `read:packages`                       |
| `GHCR_USER`        | (optionnel, sinon `github.actor` du push)                   |

## Cycle de vie

À chaque `git push` sur `main` :
1. CI build l'image (multi-stage, ~150 Mo)
2. Push sur `ghcr.io/miritie/ddm:latest` + tag `<sha>`
3. SSH au serveur, `docker compose pull` puis `up -d`
4. Container redémarré sans interruption visible (l'ancien tourne pendant le pull)

Rollback à une version précédente :
```bash
sudo docker pull ghcr.io/miritie/ddm:<sha-précédent>
sudo docker tag ghcr.io/miritie/ddm:<sha-précédent> ghcr.io/miritie/ddm:latest
sudo docker compose up -d
```

## Sécurité — actions à prendre côté serveur

- [ ] Désactiver l'auth SSH par mot de passe (`/etc/ssh/sshd_config` → `PasswordAuthentication no`)
- [ ] Changer le mot de passe par défaut (`passwd`)
- [ ] Activer UFW (`sudo ufw enable` après vérification SSH OK)
- [ ] (Recommandé) Mettre du HTTPS via Let's Encrypt + nom de domaine
- [ ] (Recommandé) Lock down `/api` à des origines de confiance via nginx

## Logs et debug

```bash
# Logs container
sudo docker compose -f /opt/ddm/docker-compose.yml logs -f --tail 200 app

# Logs nginx
sudo tail -f /var/log/nginx/ddm-access.log
sudo tail -f /var/log/nginx/ddm-error.log

# État
sudo docker compose -f /opt/ddm/docker-compose.yml ps
sudo docker stats ddm-app

# Restart simple
sudo docker compose -f /opt/ddm/docker-compose.yml restart
```
