/**
 * auditService.js
 *
 * Helper puntual para registrar acciones administrativas de alto impacto —
 * se llama a mano desde los controllers que ya hacen la acción (no hay
 * middleware global: cada acción auditable es demasiado distinta como para
 * interceptarla genéricamente sin perder el contexto útil que va en
 * `metadata`).
 *
 * Si falla el guardado del log, NUNCA debe tirar abajo la acción real que
 * se está auditando — mismo criterio que ya usa el proyecto para
 * LocationPoint (ver socketService.js: un problema al guardar el
 * histórico de ubicación no debe romper la actualización real).
 */
const { AuditLog } = require('../models');

async function log({ actorId, actorRole = 'admin', action, entityType, entityId, metadata }) {
  try {
    await AuditLog.create({ actorId, actorRole, action, entityType, entityId, metadata: metadata || null });
  } catch (err) {
    console.error(`[Audit] Error registrando "${action}":`, err.message);
  }
}

module.exports = { log };
