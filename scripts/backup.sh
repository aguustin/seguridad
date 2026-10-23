#!/usr/bin/env bash
# Backup diario de la base de datos + fotos subidas (uploads). Se corre en
# el VPS, FUERA de los contenedores (usa `docker compose exec` para hablar
# con ellos).
#
# Instalación (una vez, en el VPS, como el usuario que tiene docker compose
# levantado desde esta carpeta):
#   chmod +x scripts/backup.sh
#   crontab -e
#   # todos los días a las 3am:
#   0 3 * * * /ruta/completa/al/repo/scripts/backup.sh >> /var/log/seguridad-backup.log 2>&1
#
# Restaurar un backup de DB:
#   gunzip -c backups/db_YYYY-MM-DD.sql.gz | docker compose exec -T postgres psql -U "$DB_USER" -d "$DB_NAME"
#
# Restaurar uploads:
#   docker compose exec -T backend tar xzf - -C /app/uploads < backups/uploads_YYYY-MM-DD.tar.gz
set -euo pipefail

cd "$(dirname "$0")/.."   # raíz del repo, donde vive docker-compose.yml + .env
set -a; source .env; set +a   # trae DB_USER / DB_NAME

BACKUP_DIR="./backups"
DATE=$(date +%F)
RETENTION_DAYS=14

mkdir -p "$BACKUP_DIR"

echo "[$(date)] Backup de base de datos..."
docker compose exec -T postgres pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_DIR/db_$DATE.sql.gz"

echo "[$(date)] Backup de uploads (fotos de perfil/facial)..."
docker compose exec -T backend tar czf - -C /app/uploads . > "$BACKUP_DIR/uploads_$DATE.tar.gz"

echo "[$(date)] Borrando backups locales de más de $RETENTION_DAYS días..."
find "$BACKUP_DIR" -name "*.gz" -mtime +"$RETENTION_DAYS" -delete

echo "[$(date)] Listo: $BACKUP_DIR/db_$DATE.sql.gz + uploads_$DATE.tar.gz"
echo "IMPORTANTE: esto solo queda guardado en el mismo servidor. Para que sirva"
echo "de verdad ante una falla de disco, copiá $BACKUP_DIR afuera con algo como"
echo "rclone, rsync a otra máquina, o un bucket S3/Backblaze — no viene configurado acá."
