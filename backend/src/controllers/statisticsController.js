/**
 * statisticsController.js
 *
 * Estadísticas OPERATIVAS (Rondas, Visitas, Asignaciones, Alertas,
 * Clientes, Asistencia de guardias) — separado de
 * adminController.getFinancialStats a propósito: son dominios distintos
 * (finanzas vs. operación diaria) y mezclar ambos en un solo endpoint
 * hubiera significado una función gigante y difícil de mantener.
 *
 * Mismo criterio de performance que el resto del proyecto (ver
 * getFinancialStats, patrolController.deleteCheckpoint): consultas
 * agregadas con `count`, nunca cargar todas las filas para contarlas a
 * mano — salvo donde hace falta un promedio (tiempo de resolución de
 * alertas), que sí requiere traer los dos timestamps de un conjunto ya
 * acotado por período.
 *
 * No se usa `group`/`sequelize.fn` para los conteos por estado: el resto
 * del proyecto nunca usó agregación SQL agrupada (siempre son counts
 * simples o reduce en JS sobre un conjunto ya filtrado y chico — ver
 * getFinancialStats), así que unos pocos `count()` en paralelo por cada
 * valor posible de un campo mantiene el mismo estilo ya probado en vez de
 * introducir una sintaxis nueva sin poder validarla contra una base real
 * en este entorno.
 */
const { Op } = require('sequelize');
const {
  PatrolRoute, PatrolSession, PatrolCheckpointVisit,
  Visit, Assignment, Alert, Client, AttendanceRecord,
} = require('../models');
const { getPeriodRange } = require('../utils/periodRange');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// El QR de invitación de visita no tiene un campo booleano propio (ver
// decisión documentada en la etapa QR) — se detecta por el prefijo fijo
// que securityController.scanVisitInvitation siempre escribe en
// `authorizedBy`. Es una aproximación basada en una convención de texto
// que el propio proyecto controla en su único punto de escritura, no un
// dato inventado.
const QR_AUTHORIZED_BY_PREFIX = 'Invitación QR';

function avgMinutes(rows, startField, endField) {
  if (rows.length === 0) return null;
  const totalMs = rows.reduce((sum, r) => sum + (new Date(r[endField]) - new Date(r[startField])), 0);
  return Math.round(totalMs / rows.length / 60000);
}

exports.getOperationalStats = async (req, res) => {
  try {
    const { period, neighborhoodId, securityStaffId } = req.query;

    if (neighborhoodId && !UUID_RE.test(neighborhoodId)) {
      return res.status(400).json({ error: 'neighborhoodId inválido' });
    }
    if (securityStaffId && !UUID_RE.test(securityStaffId)) {
      return res.status(400).json({ error: 'securityStaffId inválido' });
    }

    const { from } = getPeriodRange(period);
    const filters = { from, neighborhoodId: neighborhoodId || null, securityStaffId: securityStaffId || null };

    const [patrol, visits, assignments, alerts, clients, attendance] = await Promise.all([
      getPatrolStats(filters),
      getVisitStats(filters),
      getAssignmentStats(filters),
      getAlertStats(filters),
      getClientStats(filters),
      getAttendanceStats(filters),
    ]);

    res.json({
      period: period || 'total',
      from: from || null,
      to: new Date(),
      filters: { neighborhoodId: filters.neighborhoodId, securityStaffId: filters.securityStaffId },
      patrol,
      visits,
      assignments,
      alerts,
      clients,
      attendance,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── RONDAS ───────────────────────────────────────────────────────────────
// "De las rondas iniciadas en el período, ¿cuántas se completaron, se
// cancelaron o siguen en curso?" + "¿cuántos checkpoints se registraron, y
// con qué método (GPS vs. QR)?" — responde tanto cobertura como adopción
// del escaneo QR agregado en la etapa de Rondas.
async function getPatrolStats({ from, neighborhoodId, securityStaffId }) {
  // patrulRouteId -> Neighborhood es la única forma de filtrar Rondas por
  // barrio (PatrolSession no tiene neighborhoodId propio) — se resuelve acá
  // una sola vez en vez de con un JOIN, mismo criterio del archivo.
  let routeIds = null;
  if (neighborhoodId) {
    const routes = await PatrolRoute.findAll({ where: { neighborhoodId }, attributes: ['id'] });
    routeIds = routes.map((r) => r.id);
  }

  const sessionWhere = {};
  if (from) sessionWhere.startedAt = { [Op.gte]: from };
  if (securityStaffId) sessionWhere.securityStaffId = securityStaffId;
  if (routeIds) sessionWhere.patrolRouteId = { [Op.in]: routeIds };

  const [completed, cancelled, inProgress] = await Promise.all([
    PatrolSession.count({ where: { ...sessionWhere, status: 'completed' } }),
    PatrolSession.count({ where: { ...sessionWhere, status: 'cancelled' } }),
    PatrolSession.count({ where: { ...sessionWhere, status: 'in_progress' } }),
  ]);

  // Checkpoints: filtrados por su propio visitedAt (no por el startedAt de
  // la sesión) — un checkpoint contado hoy vale aunque la ronda haya
  // arrancado ayer. El filtro de guardia/barrio sí pasa por la sesión.
  let sessionIdsForCheckpoints = null;
  if (neighborhoodId || securityStaffId) {
    const sessionFilterWhere = {};
    if (securityStaffId) sessionFilterWhere.securityStaffId = securityStaffId;
    if (routeIds) sessionFilterWhere.patrolRouteId = { [Op.in]: routeIds };
    const sessions = await PatrolSession.findAll({ where: sessionFilterWhere, attributes: ['id'] });
    sessionIdsForCheckpoints = sessions.map((s) => s.id);
  }

  const checkpointWhere = {};
  if (from) checkpointWhere.visitedAt = { [Op.gte]: from };
  if (sessionIdsForCheckpoints) checkpointWhere.patrolSessionId = { [Op.in]: sessionIdsForCheckpoints };

  const [checkpointsGps, checkpointsQr] = await Promise.all([
    PatrolCheckpointVisit.count({ where: { ...checkpointWhere, method: 'gps' } }),
    PatrolCheckpointVisit.count({ where: { ...checkpointWhere, method: 'qr' } }),
  ]);

  return {
    completed,
    cancelled,
    inProgress,
    checkpoints: { gps: checkpointsGps, qr: checkpointsQr, total: checkpointsGps + checkpointsQr },
  };
}

// ── VISITAS ──────────────────────────────────────────────────────────────
// "¿Cuántas visitas entraron en el período?", "¿cuántas hay adentro ahora
// mismo?" (operativo, no depende del período) y "¿cuánto se está usando la
// invitación por QR en vez del registro manual?" (adopción de la etapa QR).
async function getVisitStats({ from, neighborhoodId, securityStaffId }) {
  const periodWhere = {};
  if (from) periodWhere.entryAt = { [Op.gte]: from };
  if (neighborhoodId) periodWhere.neighborhoodId = neighborhoodId;
  if (securityStaffId) periodWhere.registeredByStaffId = securityStaffId;

  const activeWhere = { exitAt: null };
  if (neighborhoodId) activeWhere.neighborhoodId = neighborhoodId;
  if (securityStaffId) activeWhere.registeredByStaffId = securityStaffId;

  const [registered, activeNow, viaQR] = await Promise.all([
    Visit.count({ where: periodWhere }),
    Visit.count({ where: activeWhere }),
    Visit.count({ where: { ...periodWhere, authorizedBy: { [Op.startsWith]: QR_AUTHORIZED_BY_PREFIX } } }),
  ]);

  return { registered, activeNow, viaQR };
}

// ── ASIGNACIONES ─────────────────────────────────────────────────────────
// "De las tareas creadas en el período, ¿cuántas se completaron, se
// cancelaron o siguen pendientes?"
async function getAssignmentStats({ from, neighborhoodId, securityStaffId }) {
  const where = {};
  if (from) where.createdAt = { [Op.gte]: from };
  if (neighborhoodId) where.neighborhoodId = neighborhoodId;
  if (securityStaffId) where.securityStaffId = securityStaffId;

  const [pending, completed, cancelled] = await Promise.all([
    Assignment.count({ where: { ...where, status: 'pending' } }),
    Assignment.count({ where: { ...where, status: 'completed' } }),
    Assignment.count({ where: { ...where, status: 'cancelled' } }),
  ]);

  return { pending, completed, cancelled };
}

// ── ALERTAS ──────────────────────────────────────────────────────────────
// "¿Cuántas emergencias/alertas se generaron y cuántas se resolvieron en
// el período?" + tiempo promedio de resolución de emergencias de cliente
// (la más crítica operativamente). Alert no tiene neighborhoodId propio
// (limitación ya documentada en el modelo desde Centro de Control) ni un
// campo de guardia consistente entre tipos — por eso este bloque solo
// respeta el filtro de período, no barrio/guardia.
async function getAlertStats({ from }) {
  const generatedWhere = (type) => {
    const where = { type };
    if (from) where.createdAt = { [Op.gte]: from };
    return where;
  };
  const resolvedWhere = (type) => {
    const where = { type, resolvedAt: { [Op.ne]: null } };
    if (from) where.resolvedAt[Op.gte] = from;
    return where;
  };

  const [
    clientGenerated, clientResolvedRows,
    guardGenerated, guardResolved,
  ] = await Promise.all([
    Alert.count({ where: generatedWhere('client_emergency') }),
    Alert.findAll({ where: resolvedWhere('client_emergency'), attributes: ['createdAt', 'resolvedAt'] }),
    Alert.count({ where: generatedWhere('guard_alert') }),
    Alert.count({ where: resolvedWhere('guard_alert') }),
  ]);

  return {
    clientEmergency: {
      generated: clientGenerated,
      resolved: clientResolvedRows.length,
      avgResolutionMinutes: avgMinutes(clientResolvedRows, 'createdAt', 'resolvedAt'),
    },
    guardAlert: {
      generated: guardGenerated,
      resolved: guardResolved,
    },
  };
}

// ── CLIENTES ─────────────────────────────────────────────────────────────
// "¿Cuántos clientes activos hay hoy, y cuántos fueron dados de baja?" —
// no es una métrica de actividad por período (es un padrón, no un flujo),
// por eso ignora `from` a propósito, igual que el conteo de "Guardias" que
// ya muestra AdminDashboardScreen.
async function getClientStats({ neighborhoodId }) {
  const where = {};
  if (neighborhoodId) where.neighborhoodId = neighborhoodId;

  const [active, inactive] = await Promise.all([
    Client.count({ where: { ...where, isActive: true } }),
    Client.count({ where: { ...where, isActive: false } }),
  ]);

  return { active, inactive };
}

// ── ASISTENCIA DE GUARDIAS ───────────────────────────────────────────────
// "¿Cuántos check-ins hubo en el período, y cuántos llegaron tarde?" —
// complementa el "activos ahora" del dashboard con una métrica de
// actividad real a lo largo del tiempo.
async function getAttendanceStats({ from, neighborhoodId, securityStaffId }) {
  const where = {};
  if (from) where.checkIn = { [Op.gte]: from };
  if (neighborhoodId) where.neighborhoodId = neighborhoodId;
  if (securityStaffId) where.securityStaffId = securityStaffId;

  const [checkIns, lateCheckIns] = await Promise.all([
    AttendanceRecord.count({ where }),
    AttendanceRecord.count({ where: { ...where, checkInDelayMinutes: { [Op.gt]: 0 } } }),
  ]);

  return { checkIns, lateCheckIns };
}
