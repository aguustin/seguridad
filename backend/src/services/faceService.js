/**
 * faceService.js
 *
 * Toda la detección facial corre en un worker_thread separado.
 * Si el WASM crashea (Error: Failed to convert napi value ...), el worker
 * muere pero el proceso principal sigue funcionando normalmente.
 */
const { Worker } = require('worker_threads');
const path = require('path');

const WORKER_PATH = path.join(__dirname, '../workers/faceWorker.js');
const THRESHOLD = parseFloat(process.env.FACE_MATCH_THRESHOLD) || 0.5;

let worker = null;
const pending = new Map(); // id → { resolve, timer }
let nextId = 1;

// ── Worker lifecycle ───────────────────────────────────────────────────────

function spawnWorker() {
  const w = new Worker(WORKER_PATH);

 w.on('message', ({ id, descriptor }) => {
  console.log("[FaceService] Respuesta worker ID:", id);

  const entry = pending.get(id);

  if (!entry) return;

  clearTimeout(entry.timer);

  pending.delete(id);

  console.log(
    "[FaceService] Descriptor recibido:",
    descriptor ? "OK" : "NULL"
  );

  entry.resolve(
    descriptor
      ? new Float32Array(descriptor)
      : null
  );
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

// Inicializar el worker al arrancar el servidor (warm-up)
function loadModels() {
  // Apenas se obtiene el worker empieza a cargar los modelos
  getWorker();
  return Promise.resolve(true);
}

// ── API pública ────────────────────────────────────────────────────────────

/**
 * Extrae el descriptor facial de un buffer de imagen.
 * Resuelve con Float32Array o null si no se detecta rostro.
 * NUNCA rechaza: ante cualquier error resuelve null.
 */
function extractDescriptor(imageBuffer) {
  return new Promise((resolve) => {
    const id = nextId++;

    console.log("[FaceService] Iniciando extracción descriptor ID:", id);

    const timer = setTimeout(() => {
      pending.delete(id);

      console.warn('[FaceService] Timeout para id', id);

      resolve(null);
    }, 120_000);

    pending.set(id, { resolve, timer });

    try {
      const buf = Buffer.isBuffer(imageBuffer)
        ? imageBuffer
        : Buffer.from(imageBuffer);

      console.log("[FaceService] Enviando imagen al worker ID:", id);

      getWorker().postMessage(
        { id, imageData: buf },
        [buf.buffer]
      );

    } catch (err) {
      clearTimeout(timer);

      pending.delete(id);

      console.error(
        '[FaceService] Error enviando mensaje al worker:',
        err.message
      );

      resolve(null);
    }
  });
}

/**
 * Compara un descriptor extraído contra uno almacenado en DB (JSON string).
 */
function compareDescriptors(descriptor1, storedDescriptorJson) {
  const stored = new Float32Array(JSON.parse(storedDescriptorJson));
  // Distancia euclidiana manual (face-api no está disponible en hilo principal)
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
