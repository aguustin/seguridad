# Llevar el sistema a producción

## Qué ya está hecho (código)

- **URL del backend por variable de entorno** en vez de hardcodeada
  (`mobile/src/config/constants.js` lee `EXPO_PUBLIC_API_URL`; en local sale
  de `mobile/.env.local`, en builds de EAS de la variable configurada en el
  proyecto).
- **`GOOGLE_MAPS_API` ya está copiada** a los entornos `development`,
  `preview` y `production` de EAS.
- **Zona horaria correcta para los check-ins**: `docker-compose.yml` fija
  `TZ=America/Argentina/Buenos_Aires` en el contenedor del backend (sin
  esto, un servidor en UTC calcula la demora de turno con ~3h de error —
  ver `authController.js`).
- **`sequelize.sync({alter:true})` ya no corre en cada reinicio** en
  producción (`DB_AUTO_SYNC=false` en el compose) — se corre a demanda con
  `docker compose exec backend npm run db:sync` cuando hace falta aplicar un
  cambio de esquema.
- **Soporte SSL/`DATABASE_URL`** en `backend/src/config/database.js`, por si
  en el futuro se usa un Postgres administrado en vez del de Docker Compose.
- **`helmet`** agregado al backend (headers de seguridad HTTP básicos).
- **Permisos `RECORD_AUDIO`, `READ_EXTERNAL_STORAGE` y `WRITE_EXTERNAL_STORAGE`
  sacados** de `mobile/app.config.js` — no se usan en ningún lado del código
  (la selección de foto usa `expo-image-picker`, que en Android moderno no
  necesita estos permisos legacy) y Google Play puede rechazar la app si
  detecta un permiso "sensible" declarado sin un uso que lo justifique.
- **Verificado contra el proyecto real**: Expo SDK 57 ya genera
  `compileSdk`/`targetSdk` **36 (Android 16)**, que es lo que Google Play
  exige para apps nuevas/actualizaciones desde el 31 de agosto de 2026 — no
  hace falta ningún cambio para cumplir este requisito.
- **`Dockerfile`** del backend (`backend/Dockerfile`, Debian slim — Alpine da
  problemas con el módulo `canvas`).
- **`docker-compose.yml`** en la raíz: Postgres + backend + Caddy (proxy con
  TLS automático), todo en una red interna, sin exponer Postgres ni el
  backend directo al host — Caddy es el único punto de entrada público.
- **`Caddyfile`**: pide y renueva el certificado HTTPS solo (Let's Encrypt),
  apenas el dominio apunte al servidor. No hace falta tocar nada de
  certificados a mano, y los WebSockets de Socket.IO funcionan sin
  configuración extra.
- **`scripts/backup.sh`**: backup diario de la base de datos + fotos
  subidas, con instrucciones de instalación (cron) y de restauración.
- **`.env.example`** en la raíz, con las variables que hacen falta completar.

Nada de esto se ejecuta solo — falta que exista el servidor real. Los pasos
de abajo son los que quedan de tu lado.

---

## Lo que tenés que hacer vos

### 1. Contratar un VPS

- 2 vCPU / 4 GB de RAM como mínimo (el reconocimiento facial con
  TensorFlow.js pesa; medilo con `docker stats` una vez arriba y ajustá si
  hace falta).
- Ubuntu 22.04 o 24.04 LTS.
- Con DigitalOcean: **no hay ninguna región en Sudamérica** (el datacenter
  más cercano a Argentina es EE.UU.). Usar **NYC3** — tiene el plan Basic
  sin restricciones. Evitar **ATL1** (Atlanta): hoy solo tiene disponibles
  CPUs Premium, no el plan Basic más económico que estamos usando.

### 2. Comprar/usar un dominio y apuntarlo al VPS

Crear un registro DNS tipo A (por ejemplo `api.tubarrio.com`) apuntando a
la IP pública del VPS. Sin esto Caddy no puede pedir el certificado TLS.

### 3. Instalar Docker en el VPS

```bash
curl -fsSL https://get.docker.com | sh
```
(o seguir la guía oficial de Docker para el sistema operativo que elijas)

### 4. Abrir los puertos 80 y 443 en el firewall

⚠️ **No alcanza con `ufw` solo.** Docker manipula `iptables` directamente
para publicar los puertos de los contenedores, y esas reglas pueden
saltarse el filtrado de `ufw` — es un problema conocido de Docker en
Ubuntu, no algo específico de este proyecto. La forma confiable es usar el
**Cloud Firewall de DigitalOcean** (un firewall de red, por fuera del
Droplet):

1. En el panel de DigitalOcean: Networking → Firewalls → Create Firewall.
2. Reglas de entrada: SSH (22), HTTP (80), HTTPS (443) — el resto bloqueado
   por defecto.
3. Aplicarlo al Droplet.

`ufw` dentro del Droplet lo podés dejar también como capa extra, pero el
firewall real que hay que configurar sí o sí es el de DigitalOcean:
```bash
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 22/tcp   # SSH, para no perder el acceso
ufw enable
```

### 5. Llevar el código al VPS y configurarlo

```bash
git clone <url-de-tu-repo> seguridad
cd seguridad
cp .env.example .env
nano .env   # completar DOMAIN, DB_PASSWORD y JWT_SECRET reales
```

Para generar un `JWT_SECRET` seguro: ⚠️ el Droplet recién creado no tiene
Node.js instalado (Node corre solo *dentro* de los contenedores Docker, no
en el servidor en sí) — usar `openssl`, que viene instalado por defecto en
Ubuntu:
```bash
openssl rand -hex 48
```

### 6. Levantar todo

```bash
docker compose up -d --build
docker compose logs -f backend   # esperar "✅ Base de datos conectada" y "🚀 Servidor corriendo"
```

Verificar que responde:
```bash
curl https://api.tudominio.com/api/health
```

⚠️ **Paso obligatorio, solo la primera vez**: como `DB_AUTO_SYNC=false` en
producción (ver más arriba), el `/api/health` puede responder bien aunque
la base esté completamente vacía — sin tablas, el login va a fallar. Hay
que crear el esquema una sola vez a mano:
```bash
docker compose exec backend npm run db:sync
```
Y recién después, crear el primer administrador (este endpoint solo
funciona mientras no exista ningún admin — ver `README.md`):
```bash
curl -X POST https://api.tudominio.com/api/auth/admin/register \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"UnaContraseñaSegura123!","name":"Administrador Principal"}'
```

### 7. Apuntar la app al backend real

En tu PC, con el proyecto EAS ya autenticado:
```bash
cd mobile
# eas env:create está deprecado (confirmado al correrlo: "Use eas env:set instead")
eas env:set production --name EXPO_PUBLIC_API_URL --value https://api.tudominio.com --visibility plaintext
eas env:set preview    --name EXPO_PUBLIC_API_URL --value https://api.tudominio.com --visibility plaintext
```

### 8. Firebase + push notifications (Android)

Sin esto los push de Android no llegan (ya funciona en iOS si algún día se
compila para eso, vía APNs, pero Android necesita FCM):

1. Crear un proyecto en [Firebase Console](https://console.firebase.google.com) (gratis).
2. Agregar una app Android con el package `com.seguridad.barrios`.
3. Generar una clave de servicio FCM (Configuración del proyecto → Cuentas
   de servicio → Generar nueva clave privada).
4. Subirla a EAS:
   ```bash
   cd mobile
   eas credentials
   # elegir Android → production (y preview) → Google Service Account → subir el JSON
   ```

### 9. Backups automáticos

En el VPS, dentro de la carpeta del repo:
```bash
chmod +x scripts/backup.sh
crontab -e
# agregar esta línea (corre todos los días a las 3am):
0 3 * * * /ruta/completa/a/seguridad/scripts/backup.sh >> /var/log/seguridad-backup.log 2>&1
```

Y **configurar que `./backups` se copie fuera del servidor** (rclone a un
bucket, rsync a otra máquina, etc.) — un backup que vive en el mismo disco
no protege contra la falla de ese disco. Esto no viene resuelto, es a tu
criterio según qué servicio de almacenamiento uses.

⚠️ **Si subís los backups a Backblaze B2 (o cualquier nube) hacelo cifrado**
— `./backups/uploads_*.tar.gz` contiene las fotos de rostro de los
guardias, un dato biométrico sensible. Por ejemplo, agregando este paso
antes de subir cada archivo (con una passphrase guardada aparte, nunca en
el repo):
```bash
gpg --batch --passphrase-file /ruta/segura/backup.key --symmetric backups/uploads_$DATE.tar.gz
# subir el .gpg resultante, no el .tar.gz sin cifrar
```

### 10. Generar los builds de producción

```bash
cd mobile
eas build --platform android --profile production   # .aab para Google Play
eas build --platform android --profile preview       # .apk para instalar directo (ej. en los celulares de los guardias, sin pasar por Play Store)
```

### 11. Google Play Console

- Crear cuenta de desarrollador (pago único, US$25).
- Completar la ficha de la app, capturas de pantalla, ícono.
- **Política de privacidad obligatoria** — la app usa cámara, ubicación en
  segundo plano y datos biométricos (rostro), Play la va a pedir sí o sí.
- **Prueba cerrada obligatoria** (cuentas personales creadas después del
  13/11/2023): al menos **12 testers** inscritos de forma continua durante
  **14 días corridos** antes de poder solicitar pasar a producción desde
  el panel ("Apply for production"). Si un tester se da de baja y vuelve a
  inscribirse, los 14 días se cuentan de nuevo.
- Verificado: el `.aab` que genera este proyecto ya cumple el requisito de
  targetear Android 16 / API 36 que exige Google Play desde el 31/08/2026
  (ver nota en "Qué ya está hecho" más arriba) — no hay que tocar nada para
  esto.

### 12. Aspecto legal (dato de contexto, no reemplaza asesoramiento)

El sistema procesa rostros (dato biométrico) de guardias y, si se comparte
ubicación, también de vecinos. En Argentina esto entra en la Ley 25.326 de
Protección de Datos Personales — vale la pena consultarlo con alguien del
área legal antes de operar con datos reales: consentimiento informado,
política de privacidad publicada, y eventual inscripción de la base de
datos ante la AAIP.

### 13. Prueba piloto antes de abrir a todos

Con 1-2 guardias y algún vecino de confianza: probar login, check-in
facial, una ronda completa, una visita, una alerta y el chat — de punta a
punta contra el servidor real, no contra el entorno de desarrollo.

---

## Resumen de lo pendiente de tu lado

| Paso | Depende de |
|---|---|
| VPS (región NYC3) + dominio | Vos (elegir proveedor, pagar) |
| Cloud Firewall de DigitalOcean (no solo `ufw`) | Vos, al crear el Droplet |
| Levantar el stack (`docker compose up`) | Vos, una vez tengas el VPS |
| **`db:sync` + crear primer admin** (una sola vez) | Vos, inmediatamente después de levantar el stack |
| `EXPO_PUBLIC_API_URL` en EAS (`eas env:set`) | Vos, una vez tengas el dominio funcionando |
| Firebase + FCM | Vos (cuenta de Google) |
| Backups fuera del servidor | Vos (elegir dónde guardarlos) |
| Google Play Console | Vos (cuenta + pago) |
| Revisión legal | Vos (alguien del área legal) |

Cuando tengas el VPS y el dominio listos, avisame y sigo desde el paso 6
en adelante (verificar que levantó bien, ajustar lo que haga falta).
