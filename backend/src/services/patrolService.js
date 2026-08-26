/**
 * patrolService.js
 *
 * Arma la respuesta de detalle de una PatrolSession (ruta, barrio, guardia y
 * checkpoints con su estado de visita) — la misma forma que ya usa
 * getActivePatrol para la ronda en curso, reutilizada acá para el
 * historial del guardia y la vista administrativa. Se extrae a un service
 * recién ahora porque esta etapa agrega 2 endpoints nuevos que necesitan
 * exactamente esta misma forma (guard history detail + admin session
 * detail) — antes de esto no había reutilización real que lo justificara.
 *
 * No hace queries por sí solo: solo transforma una PatrolSession ya
 * cargada con SESSION_INCLUDE. Los controllers siguen siendo dueños de la
 * autorización (a quién le pertenece la sesión) y de los filtros de listado.
 */
const SESSION_INCLUDE = [
  {
    association: 'route',
    include: [
      { association: 'checkpoints' },
      { association: 'neighborhood', attributes: ['id', 'name'] },
    ],
  },
  { association: 'checkpointVisits' },
  { association: 'staff', attributes: ['id', 'firstName', 'lastName'] },
];

function serializeSession(session) {
  const visitByCheckpoint = new Map(
    session.checkpointVisits.map((v) => [v.patrolCheckpointId, v])
  );

  const checkpoints = session.route.checkpoints.map((cp) => {
    const visit = visitByCheckpoint.get(cp.id);
    return {
      id: cp.id,
      name: cp.name,
      latitude: cp.latitude,
      longitude: cp.longitude,
      radiusMeters: cp.radiusMeters,
      visited: !!visit,
      visitedAt: visit?.visitedAt || null,
      // 'gps' | 'qr' | null (no visitado) — ver models/PatrolCheckpointVisit.js.
      method: visit?.method || null,
    };
  });

  return {
    session: {
      id: session.id,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      status: session.status,
    },
    route: {
      id: session.route.id,
      name: session.route.name,
      description: session.route.description,
      neighborhoodId: session.route.neighborhoodId,
      neighborhood: session.route.neighborhood
        ? { id: session.route.neighborhood.id, name: session.route.neighborhood.name }
        : null,
    },
    staff: session.staff
      ? { id: session.staff.id, firstName: session.staff.firstName, lastName: session.staff.lastName }
      : null,
    checkpoints,
  };
}

module.exports = { SESSION_INCLUDE, serializeSession };
