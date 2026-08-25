/**
 * faceService.js
 *
 * Punto de entrada único al reconocimiento facial. Toda la detección corre
 * en un worker_thread aparte (ver workers/faceWorker.js): si face-api/WASM
 * crashea, el worker muere pero el proceso principal de Express sigue
 * funcionando con normalidad. El worker se reinicia solo en la próxima
 * llamada.
 *
 * Se llama UNA vez por escaneo (evento "se detectó una cara" del cliente),
 * nunca en un loop — el volumen esperado es bajo (guardias entrando/saliendo
 * por una puerta), así que no hace falta ninguna cola ni pool de workers.
 */
const { Worker } = require('worker_threads');
const path = require('path');

const WORKER_PATH = path.join(__dirname, '../workers/faceWorker.js');
const THRESHOLD = parseFloat(process.env.FACE_MATCH_THRESHOLD) || 0.5;
// Tiempo máximo para extraer un descriptor. Los modelos ya están cargados en
// memoria del lado del worker antes de que llegue la primera imagen real
// (ver loadModels(), se llama al arrancar el servidor), así que un timeout
// largo acá solo demoraría la respuesta de un escaneo real que falló.
const EXTRACT_TIMEOUT_MS = parseInt(process.env.FACE_EXTRACT_TIMEOUT_MS, 10) || 20_000;

let worker = null;
const pending = new Map(); // id → { resolve, timer }
let nextId = 1;

// ── Worker lifecycle ───────────────────────────────────────────────────────

function spawnWorker() {
  const w = new Worker(WORKER_PATH);

  w.on('message', ({ id, descriptor }) => {
    const entry = pending.get(id);
    if (!entry) return;

    clearTimeout(entry.timer);
    pending.delete(id);
    entry.resolve(descriptor ? new Float32Array(descriptor) : null);
  });

  w.on('error', (err) => {
    console.error('[FaceService] Worker error:', err.message);
    _flushPending(null);
    worker = null;
  });

  w.on('exit', (code) => {
    if (code !== 0) {
      console.warn('[FaceService] Worker salió con código', code);
      _flushPending(null);
      worker = null;
    }
  });

  return w;
}

function _flushPending(value) {
  for (const { resolve, timer } of pending.values()) {
    clearTimeout(timer);
    resolve(value);
  }
  pending.clear();
}

function getWorker() {
  if (!worker) worker = spawnWorker();
  return worker;
}

// Inicializar el worker al arrancar el servidor (warm-up): así los modelos
// ya están cargados en memoria cuando llegue el primer escaneo real.
function loadModels() {
  getWorker();
  return Promise.resolve(true);
}

// ── API pública ────────────────────────────────────────────────────────────

/**
 * Extrae el descriptor facial de un buffer de imagen.
 * Resuelve con Float32Array o null si no se detecta rostro.
 * NUNCA rechaza: ante cualquier error (timeout, crash del worker, imagen
 * inválida) resuelve null — es responsabilidad del caller tratar null como
 * "no se pudo procesar la imagen".
 */
function extractDescriptor(imageBuffer) {
  return new Promise((resolve) => {
    const id = nextId++;

    const timer = setTimeout(() => {
      pending.delete(id);
      console.warn(`[FaceService] Timeout (${EXTRACT_TIMEOUT_MS}ms) esperando descriptor id=${id}`);
      resolve(null);
    }, EXTRACT_TIMEOUT_MS);

    pending.set(id, { resolve, timer });

    try {
      const buf = Buffer.isBuffer(imageBuffer) ? imageBuffer : Buffer.from(imageBuffer);
      getWorker().postMessage({ id, imageData: buf }, [buf.buffer]);
    } catch (err) {
      clearTimeout(timer);
      pending.delete(id);
      console.error('[FaceService] Error enviando imagen al worker:', err.message);
      resolve(null);
    }
  });
}

/**
 * Compara un descriptor recién extraído contra uno almacenado en DB (JSON string).
 * Distancia euclidiana manual: face-api no corre en el hilo principal, así
 * que no hay que importar toda la librería solo para esta cuenta.
 */
function compareDescriptors(descriptor1, storedDescriptorJson) {
  const stored = new Float32Array(JSON.parse(storedDescriptorJson));
  let sum = 0;
  for (let i = 0; i < descriptor1.length; i++) {
    const diff = descriptor1[i] - stored[i];
    sum += diff * diff;
  }
  const distance = Math.sqrt(sum);
  return { match: distance <= THRESHOLD, distance };
}

/**
 * Serializa un descriptor facial a JSON para guardar en DB.
 */
function descriptorToJson(descriptor) {
  return JSON.stringify(Array.from(descriptor));
}

module.exports = { loadModels, extractDescriptor, compareDescriptors, descriptorToJson };
