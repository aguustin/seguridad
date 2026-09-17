# Levantar el entorno de desarrollo (Development Build)

Guía para volver a levantar todo desde cero después de reiniciar la PC o
cerrar los procesos — sin repetir el proceso de diagnóstico. Última
actualización: sesión de depuración de Development Build (sept. 2026).

## Por qué este setup es así (contexto necesario)

- El teléfono de prueba **no tiene ninguna conectividad LAN** con la PC
  (confirmado probando puertos 3000/8081/9000 directo desde el navegador
  del celular: ninguno responde), aunque esté en la "misma" wifi — parece
  aislamiento de clientes del router/AP. Por eso todo pasa por túneles.
- La app corre como **Development Build nativa** (no Expo Go — Expo Go no
  soporta push notifications remotas de Android desde el SDK 53, y
  tampoco carga `react-native-vision-camera`).
- Las extensiones de VS Code **"Language Support for Java(TM) by Red Hat"**
  y **"Gradle for Java"** deben quedar deshabilitadas para este workspace
  (ya está hecho — `Disable (Workspace)` desde el panel de Extensiones).
  Si se reactivan, auto-importan `mobile/android/` y sus demonios de
  Gradle bloquean los archivos de caché, rompiendo cualquier build o
  `expo prebuild`.

## 1. Levantar Postgres (Docker)

```bash
# Si Docker Desktop no está abierto, abrilo manualmente primero (GUI).
docker ps -a --filter "name=seguridad-postgres"   # ver si existe
docker start seguridad-postgres                    # si ya existe, solo arrancarlo
# (el contenedor ya está creado con las credenciales de backend/.env — no hace falta recrearlo)
```

## 2. Levantar el backend

```bash
cd backend
npm start          # puerto 3000 — esperar "✅ Base de datos conectada"
```

## 3. Túnel para el backend (ngrok)

El teléfono no llega a la IP LAN, así que el backend necesita su propio
túnel público. Usamos el **ngrok v3 real** (no el que trae `@expo/ngrok`,
que es v2 y ya no es compatible con el servicio de ngrok):

```bash
# Ubicación del binario descargado en esta máquina (fuera del repo):
# revisar la carpeta scratchpad de la sesión de Claude Code si no está a mano,
# o descargar de nuevo:
#   curl -sL -o ngrok.zip "https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-windows-amd64.zip"
#   unzip ngrok.zip

# Ya tiene el authtoken guardado (uno lo configuró una vez con `ngrok authtoken <token>`,
# queda persistido en C:\Users\<user>\.ngrok2\ngrok.yml — no hace falta repetirlo)

./ngrok.exe http 3000
# copiar la URL pública que imprime, ej: https://xxxx-xxx-xx-xxx-xxx.ngrok-free.app
```

⚠️ **La URL cambia cada vez que se reinicia este comando** (plan free, dominio
efímero). Cada vez que se reinicia el túnel hay que repetir el paso 5.

> Nota: para llamadas GET simples (como las que hace el navegador) ngrok free
> muestra una página de advertencia HTML en vez de conectar directo, si el
> pedido "parece" venir de un navegador. Esto **no afecta** al backend porque
> la app le pega con POST/JSON, que no dispara esa advertencia — confirmado
> con pruebas reales. Si en algún momento sí la dispara, agregar
> `-H "ngrok-skip-browser-warning: true"` sirve para probarlo con curl, pero
> la app no puede mandar ese header, así que si esto empieza a fallar hay que
> reconsiderar el enfoque (ver sección "Alternativas" más abajo).

## 4. Metro (bundler JS) con túnel

**No usar ngrok directo para Metro** — sus pedidos GET (manifest/bundle) sí
disparan la advertencia de ngrok free y quedan bloqueados sin aviso claro
("no hace nada" en la app). Usar el túnel propio de Expo:

```bash
cd mobile
npx expo start --dev-client --tunnel
```

Es **intermitente** — a veces falla con `CommandError: failed to start
tunnel / remote gone away`. Si falla, simplemente reintentar el mismo
comando (2-3 intentos suele alcanzar).

Cuando conecta, mostrará algo como:
```
Tunnel connected.
Tunnel ready.
```
La URL del túnel se puede confirmar con:
```bash
curl -s http://127.0.0.1:4040/api/tunnels
```
(buscar el `public_url` con formato `https://xxxxxxx-agustin1994-8081.exp.direct`)

## 5. Apuntar la app al túnel del backend

Editar `mobile/src/config/constants.js`, la constante `API_BASE_URL`, con
la URL de ngrok del paso 3 (con `https://`, sin barra final):

```js
const API_BASE_URL = 'https://xxxx-xxx-xx-xxx-xxx.ngrok-free.app';
```

**No hace falta un nuevo build nativo** — el dev client recarga el JS
desde Metro solo. Si no se refleja el cambio, recargar manualmente
(shake del teléfono → "Reload").

## 6. Conectar el teléfono

En la app del **dev client** instalada (no Expo Go):
- "Enter URL manually" → pegar `exp://` + el host del túnel de Metro del
  paso 4, ej: `exp://xxxxxxx-agustin1994-8081.exp.direct`

## Checklist rápido de reinicio

1. Docker Desktop abierto → `docker start seguridad-postgres`
2. `cd backend && npm start` → esperar "Base de datos conectada"
3. `./ngrok.exe http 3000./ngrok.exe http 3000` → copiar URL
4. Pegar esa URL en `mobile/src/config/constants.js` (`API_BASE_URL`)
5. `cd mobile && npx expo start --dev-client --tunnel` → reintentar si falla
6. Copiar la URL `exp.direct` del túnel de Metro (log o `:4040/api/tunnels`)
7. Dev client en el teléfono → "Enter URL manually" con esa URL

## Alternativas para cuando se resuelva la red (pendiente)

Esto es un workaround mientras el teléfono no tiene LAN real. Opciones más
estables a futuro, sin decidir todavía:
- **USB + adb reverse**: instalar Android Platform Tools (`adb`) y correr
  `adb reverse tcp:8081 tcp:8081` (+ el puerto del backend) con el
  teléfono conectado por cable. Evita todo el tema de túneles/redes.
- **Emulador Android** en una PC más potente (en curso — la idea del
  usuario de clonar el repo en otra PC y correr el emulador ahí). El
  emulador alcanza el backend/Metro del host vía `10.0.2.2` sin
  necesidad de túneles, siempre que backend y Metro corran en esa misma
  PC.
- Resolver el aislamiento de red del router/AP (fuera de nuestro control
  directo, requiere acceso a la configuración del router).
