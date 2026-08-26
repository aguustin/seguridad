/**
 * reminderService.js
 *
 * Recordatorios operativos con componente temporal real, usando datos que
 * ya existen (createdAt de Assignment, startedAt de PatrolSession) — no se
 * agregó ninguna fecha "esperada"/programada porque hoy no existe ese
 * concepto en el sistema (ni rutas con horario, ni asignaciones con
 * vencimiento) y agregarlo sería una decisión de diseño mayor, fuera de
 * alcance de esta etapa.
 *
 * Mismo patrón que checkinService.js: un barrido periódico con setInterval,
 * sin ninguna librería de scheduling nueva. Cada recordatorio se manda una
 * sola vez por asignación/ronda (campo reminderSentAt) para no generar
 * ruido en cada barrido mientras la condición se siga cumpliendo.
 */

const { sendPushNotification } = require('./notificationService');

const CHECK_INTERVAL_MS = 30 * 60 * 1000; // cada 30 minutos

// Una asignación pending hace más de esto probablemente se olvidó.
const ASSIGNMENT_PENDING_THRESHOLD_MS = 3 * 60 * 60 * 1000; // 3 horas

// Una ronda in_progress hace más de esto probablemente el guardia se
// olvidó de finalizarla (una ronda normal dura mucho menos).
const PATROL_IN_PROGRESS_THRESHOLD_MS = 5 * 60 * 60 * 1000; // 5 horas

function init() {
  setInterval(checkAssignmentReminders, CHECK_INTERVAL_MS);
  setInterval(checkPatrolReminders, CHECK_INTERVAL_MS);
  console.log('[Reminders] Servicio iniciado — intervalo 30 min');
}

async function checkAssignmentReminders() {
  try {
    const { Op } = require('sequelize');
    const { Assignment } = require('../models');

    const stale = await Assignment.findAll({
      where: {
        status: 'pending',
        reminderSentAt: null,
        createdAt: { [Op.lte]: new Date(Date.now() - ASSIGNMENT_PENDING_THRESHOLD_MS) },
      },
      include: [{ association: 'staff', attributes: ['expoPushToken'] }],
    });

    for (const assignment of stale) {
      if (assignment.staff?.expoPushToken) {
        await sendPushNotification(
          assignment.staff.expoPushToken,
          '⏰ Tarea pendiente',
          assignment.title,
          { type: 'assignment' }
        );
      }
      // Se marca aunque el guardia no tenga token: evita reintentar cada
      // barrido una asignación que nunca va a poder notificarse.
      await assignment.update({ reminderSentAt: new Date() });
    }
    if (stale.length) console.log(`[Reminders] ${stale.length} asignación(es) recordada(s)`);
  } catch (err) {
    console.error('[Reminders] Error en recordatorio de asignaciones:', err.message);
  }
}

async function checkPatrolReminders() {
  try {
    const { Op } = require('sequelize');
    const { PatrolSession } = require('../models');

    const stale = await PatrolSession.findAll({
      where: {
        status: 'in_progress',
        reminderSentAt: null,
        startedAt: { [Op.lte]: new Date(Date.now() - PATROL_IN_PROGRESS_THRESHOLD_MS) },
      },
      include: [{ association: 'staff', attributes: ['expoPushToken'] }],
    });

    for (const session of stale) {
      if (session.staff?.expoPushToken) {
        await sendPushNotification(
          session.staff.expoPushToken,
          '⏰ Ronda sin finalizar',
          'Tenés una ronda en curso hace varias horas — no te olvides de finalizarla.',
          { type: 'patrol_reminder' }
        );
      }
      await session.update({ reminderSentAt: new Date() });
    }
    if (stale.length) console.log(`[Reminders] ${stale.length} ronda(s) recordada(s)`);
  } catch (err) {
    console.error('[Reminders] Error en recordatorio de rondas:', err.message);
  }
}

module.exports = { init };
