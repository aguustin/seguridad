/**
 * Script para descargar los modelos de face-api desde el repositorio de vladmandic
 * Ejecutar: node scripts/downloadModels.js
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://raw.githubusercontent.com/vladmandic/face-api/master/model/';
const OUTPUT_DIR = path.join(__dirname, '../models/face-api');

const FILES = [
  // SSD MobileNet (detección de rostros)
  'ssd_mobilenetv1_model-weights_manifest.json',
  'ssd_mobilenetv1_model-shard1',
  'ssd_mobilenetv1_model-shard2',
  // Face Landmarks (68 puntos)
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model-shard1',
  // Face Recognition (descriptores)
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model-shard1',
  'face_recognition_model-shard2',
];

function download(filename) {
  return new Promise((resolve, reject) => {
    const url = BASE_URL + filename;
    const dest = path.join(OUTPUT_DIR, filename);

    if (fs.existsSync(dest)) {
      console.log(`✓ Ya existe: ${filename}`);
      return resolve();
    }

    console.log(`↓ Descargando: ${filename}...`);
    const file = fs.createWriteStream(dest);

    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        https.get(response.headers.location, (res2) => {
          res2.pipe(file);
          file.on('finish', () => { file.close(); resolve(); });
        }).on('error', reject);
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log(`✅ ${filename}`);
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log('Descargando modelos de reconocimiento facial...\n');

  for (const file of FILES) {
    try {
      await download(file);
    } catch (err) {
      console.error(`❌ Error descargando ${file}:`, err.message);
    }
  }

  console.log('\n✅ Descarga completada. Los modelos están en:', OUTPUT_DIR);
}

main();
