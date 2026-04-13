/**
 * Servicio de check-in de guardias.
 *
 * Cada 15 minutos emite `checkin_request` a todos los guardias en turno.
 * Después de 1 minuto, verifica quién no respondió y notifica al operador
 * mediante el evento `checkin_missed`.
 */

const { randomUUID } = require('crypto');

let io;

// Sesión actual de check-in: { id, pendingGuardIds: Set<string> }
let currentSession = null;

const CHECK_INTERVAL_MS  = 15 * 60 * 1000; // 15 minutos
const RESPONSE_WINDOW_MS =      60 * 1000; // 1 minuto para responder

function init(_io) {
  io = _io;
  setInterval(startCheckin, CHECK_INTERVAL_MS);
  console.log('[Checkin] Servicio iniciado — intervalo 15 min');
}

async function startCheckin() {
  try {
    const { SecurityStaff } = require('../models');
    const activeGuards = await SecurityStaff.findAll({
      where: { isOnDuty: true, isActive: true },
      attributes: ['id', 'firstName', 'lastName', 'contact'],
    });

    if (!activeGuards.length) return;

    const sessionId = randomUUID();
    currentSession = {
      id: sessionId,
      pendingGuardIds: new Set(activeGuards.map((g) => g.id)),
    };

    console.log(`[Checkin] Sesión ${sessionId} — ${activeGuards.length} guardias activos`);

    io.to('role:security').emit('checkin_request', {
      sessionId,
      message: 'Confirmá que la situación está controlada',
    });

    // Después de 1 minuto, verificar quién no respondió
    setTimeout(() => checkMissed(sessionId), RESPONSE_WINDOW_MS);
  } catch (err) {
    console.error('[Checkin] Error al iniciar sesión:', err.message);
  }
}

async function checkMissed(sessionId) {
  try {
    if (!currentSession || currentSession.id !== sessionId) return;
    const missed = [...currentSession.pendingGuardIds];
    if (!missed.length) return;

    const { SecurityStaff } = require('../models');
    const guards = await SecurityStaff.findAll({
      where: { id: missed },
      attributes: ['id', 'firstName', 'lastName', 'contact'],
    });

    console.log(`[Checkin] ${guards.length} guardia(s) no respondieron`);

    io.to('role:operator').emit('checkin_missed', {
      sessionId,
      guards: guards.map((g) => g.toJSON()),
    });
  } catch (err) {
    console.error('[Checkin] Error al verificar respuestas:', err.message);
  }
}

/**
 * Llamado por el controller cuando el guardia confirma el check-in.
 * @param {string} guardId
 * @param {string} sessionId
 */
function confirmCheckin(guardId, sessionId) {
  if (currentSession?.id === sessionId) {
    currentSession.pendingGuardIds.delete(guardId);
    console.log(`[Checkin] Guardia ${guardId} confirmó sesión ${sessionId}`);
  }
}

/**
 * Devuelve el ID de la sesión activa (puede ser null).
 */
function getCurrentSessionId() {
  return currentSession?.id || null;
}

module.exports = { init, confirmCheckin, getCurrentSessionId };
