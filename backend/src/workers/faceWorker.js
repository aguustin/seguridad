/**
 * Worker thread para reconocimiento facial.
 * Corre aislado del proceso principal.
 */

const { parentPort } = require('worker_threads');
const path = require('path');
const fs = require('fs');

const MODELS_PATH = path.join(
  __dirname,
  '../../node_modules/@vladmandic/face-api/model'
);

let faceapi = null;
let loadImage = null;
let ready = false;
let initPromise = null;


/**
 * Inicializa modelos una sola vez.
 */
async function init() {
  if (ready) return;

  if (initPromise) return initPromise;

  initPromise = (async () => {
    const canvas = require('canvas');

    const {
      Canvas,
      Image,
      ImageData
    } = canvas;

    loadImage = canvas.loadImage;

    faceapi = require('@vladmandic/face-api/dist/face-api.node-wasm.js');

    faceapi.env.monkeyPatch({
      Canvas,
      Image,
      ImageData
    });

    await faceapi.tf.setBackend('wasm');
    await faceapi.tf.ready();

    if (!fs.existsSync(MODELS_PATH)) {
      throw new Error(`Modelos no encontrados en: ${MODELS_PATH}`);
    }

    await faceapi.nets.ssdMobilenetv1.loadFromDisk(MODELS_PATH);
    await faceapi.nets.faceLandmark68Net.loadFromDisk(MODELS_PATH);
    await faceapi.nets.faceRecognitionNet.loadFromDisk(MODELS_PATH);

    ready = true;

    console.log('[FaceWorker] Modelos cargados correctamente');
  })();

  return initPromise;
}


/**
 * Manejo errores globales.
 */
process.on('unhandledRejection', (err) => {
  console.error('[FaceWorker] Unhandled rejection:', err);
});

process.on('uncaughtException', (err) => {
  console.error('[FaceWorker] Uncaught exception:', err);
});


/**
 * Inicializar apenas arranca.
 */
init().catch(err => {
  console.error('[FaceWorker] Error inicializando:', err.message);
});


/**
 * Escuchar mensajes.
 */
parentPort.on('message', async ({ id, imageData }) => {
  try {
    await init();

    const buffer = Buffer.isBuffer(imageData)
      ? imageData
      : Buffer.from(imageData);

    const img = await loadImage(buffer);

    if (!img.width || !img.height) {
      parentPort.postMessage({
        id,
        descriptor: null
      });
      return;
    }

    const detection = await faceapi
      .detectSingleFace(img)
      .withFaceLandmarks()
      .withFaceDescriptor();

    parentPort.postMessage({
      id,
      descriptor: detection
        ? Array.from(detection.descriptor)
        : null
    });

  } catch (err) {
    console.error(`[FaceWorker] Error procesando ID ${id}:`, err);

    parentPort.postMessage({
      id,
      descriptor: null,
      error: err.message
    });
  }
});