const { SecurityStaff, AttendanceRecord, Message, Alert, PatrolRoute, PatrolSession, PatrolCheckpoint, PatrolCheckpointVisit, Client, Visit, Assignment, VisitInvitation, Admin } = require('../models');
const checkinService = require('../services/checkinService');
const patrolService = require('../services/patrolService');
const { sendPushNotification } = require('../services/notificationService');

// ── UBICACIÓN (tracking en background) ─────────────────────────────────────
// El tracking en foreground manda la ubicación por Socket.IO (ver
// socketService.js → 'update_location'). El task de background
// (expo-task-manager) corre en un contexto headless/aislado que no puede
// depender de que exista un socket ya conectado, así que manda la
// ubicación por REST a este endpoint — misma lógica exacta que el socket:
// actualiza lastLatitude/lastLongitude/lastLocationUpdate, guarda el punto
// en LocationPoint, y emite el mismo evento realtime para el mapa en vivo.
exports.updateLocation = async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return res.status(400).json({ error: 'latitude y longitude son requeridos' });
    }

    await SecurityStaff.update(
      { lastLatitude: latitude, lastLongitude: longitude, lastLocationUpdate: new Date() },
      { where: { id: req.user.id } }
    );

    const { LocationPoint } = require('../models');
    try {
      await LocationPoint.create({ entityType: 'security', securityStaffId: req.user.id, latitude, longitude });
    } catch (err) {
      console.error('[Security] Error guardando LocationPoint (background):', err.message);
    }

    const io = req.app.get('io');
    if (io) {
      io.to('role:admin').emit('guard_location_update', {
        guardId: req.user.id,
        neighborhoodId: req.user.neighborhoodId,
        latitude,
        longitude,
        timestamp: new Date(),
      });
    }

    res.json({ message: 'Ubicación actualizada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getMyProfile = async (req, res) => {
  try {
    const staff = await SecurityStaff.findByPk(req.user.id, {
      attributes: { exclude: ['faceDescriptor'] },
      include: [{ association: 'neighborhood', attributes: ['id', 'name'] }],
    });
    if (!staff) return res.status(404).json({ error: 'Perfil no encontrado' });
    res.json(staff);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getMyAttendance = async (req, res) => {
  try {
    const { limit = 30, offset = 0 } = req.query;
    const records = await AttendanceRecord.findAndCountAll({
      where: { securityStaffId: req.user.id },
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['checkIn', 'DESC']],
    });
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getActiveColleagues = async (req, res) => {
  try {
    const staff = await SecurityStaff.findAll({
      where: {
        neighborhoodId: req.user.neighborhoodId,
        isOnDuty: true,
        isActive: true,
      },
      attributes: ['id', 'firstName', 'lastName', 'profilePhoto', 'isOnDuty', 'isOperator'],
    });
    res.json(staff);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Para el operador: lista todos los guardias activos de su barrio con estado de check-in
exports.getActiveGuardsStatus = async (req, res) => {
  try {
    const staff = await SecurityStaff.findAll({
      where: { isOnDuty: true, isActive: true },
      attributes: ['id', 'firstName', 'lastName', 'profilePhoto', 'contact', 'neighborhoodId'],
      include: [{ association: 'neighborhood', attributes: ['id', 'name'] }],
    });
    res.json(staff);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getChatMessages = async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const neighborhoodId = req.user.neighborhoodId;

    const messages = await Message.findAndCountAll({
      where: { roomType: 'security_chat', roomId: neighborhoodId },
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    res.json({ ...messages, rows: messages.rows.reverse() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getMyAlerts = async (req, res) => {
  try {
    const { Op } = require('sequelize');
    const neighborhoodId = req.user.neighborhoodId;

    const alerts = await Alert.findAll({
      where: {
        type: 'admin_to_security',
        [Op.or]: [
          { targetNeighborhoodId: neighborhoodId },
          { targetSecurityId: req.user.id },
          { targetNeighborhoodId: null, targetSecurityId: null },
        ],
      },
      order: [['createdAt', 'DESC']],
      limit: 20,
    });
    res.json(alerts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── ALERTAS DEL GUARDIA ────────────────────────────────────────────────────

exports.sendGuardAlert = async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason?.trim()) {
      return res.status(400).json({ error: 'La razón de la alerta es obligatoria' });
    }

    const guard = await SecurityStaff.findByPk(req.user.id, {
      attributes: ['firstName', 'lastName', 'contact'],
    });

    const alert = await Alert.create({
      type: 'guard_alert',
      title: '⚠️ ALERTA DE GUARDIA',
      message: `${guard.firstName} ${guard.lastName}: ${reason}`,
      reason,
      senderId: req.user.id,
      senderType: 'security',
    });

    const io = req.app.get('io');
    if (io) {
      const payload = {
        ...alert.toJSON(),
        guardFirstName: guard.firstName,
        guardLastName:  guard.lastName,
        guardContact:   guard.contact,
      };
      // Siempre va al admin
      io.to('role:admin').emit('guard_alert', payload);
      // También va al operador si hay uno
      io.to('role:operator').emit('guard_alert', payload);
    }

    // Push: un guardia pidiendo ayuda es tan urgente como una emergencia de
    // cliente — mismo criterio, avisar aunque la app esté cerrada. Va a
    // todos los admins con token + al operador puntual si hay uno (el
    // operador es un guardia más, con su propio expoPushToken).
    const [admins, operator] = await Promise.all([
      Admin.findAll({ where: { isActive: true }, attributes: ['expoPushToken'] }),
      SecurityStaff.findOne({ where: { isOperator: true, isActive: true }, attributes: ['expoPushToken'] }),
    ]);
    const pushTokens = [
      ...admins.map((a) => a.expoPushToken),
      operator?.expoPushToken,
    ].filter(Boolean);
    if (pushTokens.length > 0) {
      await sendPushNotification(pushTokens, alert.title, alert.message, { type: 'guard_alert' });
    }

    res.status(201).json({ message: 'Alerta enviada', alert });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.resolveGuardAlert = async (req, res) => {
  try {
    const { id } = req.params;
    // Solo el guardia que la envió puede resolverla
    const alert = await Alert.findOne({ where: { id, senderId: req.user.id, type: 'guard_alert' } });
    if (!alert) return res.status(404).json({ error: 'Alerta no encontrada' });

    await alert.update({ isRead: true, resolvedAt: new Date() });

    const io = req.app.get('io');
    if (io) {
      io.to('role:admin').emit('guard_alert_resolved', { id });
      io.to('role:operator').emit('guard_alert_resolved', { id });
    }

    res.json({ message: 'Alerta terminada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getMyActiveAlert = async (req, res) => {
  try {
    const alert = await Alert.findOne({
      where: { senderId: req.user.id, type: 'guard_alert', isRead: false },
      order: [['createdAt', 'DESC']],
    });
    res.json(alert || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── CHECK-IN ───────────────────────────────────────────────────────────────

exports.confirmCheckin = async (req, res) => {
  try {
    const { sessionId } = req.body;
    const current = checkinService.getCurrentSessionId();
    if (sessionId && sessionId !== current) {
      return res.status(400).json({ error: 'Sesión de check-in no válida o ya expirada' });
    }
    checkinService.confirmCheckin(req.user.id, sessionId || current);
    res.json({ message: 'Check-in confirmado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── RONDAS (inicio/fin de sesión) ───────────────────────────────────────────
// Solo start/end acá — sin checkpoints, sin validación GPS, sin sockets
// (fuera de alcance de esta etapa).

// Rutas de ronda disponibles para el guardia — a diferencia de
// patrolController.getRoutes (admin, sin restricción de barrio), acá se
// fuerza el scope al barrio del guardia autenticado (mismo criterio que
// getActiveColleagues/getChatMessages: un guardia solo ve su propio barrio).
exports.getPatrolRoutes = async (req, res) => {
  try {
    // Guardia sin barrio asignado todavía: se distingue explícitamente de
    // "tu barrio no tiene rutas cargadas" para que la pantalla (PatrolScreen)
    // pueda mostrar un mensaje claro en vez de una lista vacía ambigua.
    if (!req.user.neighborhoodId) {
      return res.json({ neighborhoodAssigned: false, routes: [] });
    }

    const routes = await PatrolRoute.findAll({
      where: { isActive: true, neighborhoodId: req.user.neighborhoodId },
      include: [{ association: 'neighborhood', attributes: ['id', 'name'] }],
      order: [['name', 'ASC']],
    });
    res.json({ neighborhoodAssigned: true, routes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.startPatrol = async (req, res) => {
  try {
    const { patrolRouteId } = req.body;
    if (!patrolRouteId) {
      return res.status(400).json({ error: 'patrolRouteId es obligatorio' });
    }

    const route = await PatrolRoute.findByPk(patrolRouteId);
    if (!route || !route.isActive) {
      return res.status(400).json({ error: 'La ruta de ronda indicada no existe o no está activa' });
    }

    const existing = await PatrolSession.findOne({
      where: { securityStaffId: req.user.id, status: 'in_progress' },
    });
    if (existing) {
      return res.status(400).json({ error: 'Ya tenés una ronda en curso. Finalizala antes de iniciar otra.' });
    }

    const session = await PatrolSession.create({
      securityStaffId: req.user.id,
      patrolRouteId,
      startedAt: new Date(),
      status: 'in_progress',
    });

    // Notifica al admin en tiempo real (ej. Centro de Control) — antes
    // startPatrol no emitía nada, así que "rondas activas" solo se podía
    // ver refrescando a mano. Puramente aditivo: nada escuchaba este
    // evento antes, no hay ningún consumidor que se pueda romper.
    const io = req.app.get('io');
    if (io) io.to('role:admin').emit('patrol_started', { sessionId: session.id, securityStaffId: req.user.id });

    res.status(201).json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.endPatrol = async (req, res) => {
  try {
    // No hace falta pedir el id de la sesión: un guardia solo puede tener
    // una ronda in_progress a la vez (garantizado por startPatrol).
    const session = await PatrolSession.findOne({
      where: { securityStaffId: req.user.id, status: 'in_progress' },
    });
    if (!session) {
      return res.status(404).json({ error: 'No tenés ninguna ronda en curso' });
    }

    await session.update({ endedAt: new Date(), status: 'completed' });

    const io = req.app.get('io');
    if (io) io.to('role:admin').emit('patrol_ended', { sessionId: session.id, securityStaffId: req.user.id });

    res.json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── RONDAS: estado de la ronda activa ───────────────────────────────────────
// Solo lectura — reutiliza las asociaciones ya definidas en models/index.js
// (PatrolSession→route→checkpoints, PatrolSession→route→neighborhood,
// PatrolSession→checkpointVisits), no agrega ninguna nueva.
exports.getActivePatrol = async (req, res) => {
  try {
    const session = await PatrolSession.findOne({
      where: { securityStaffId: req.user.id, status: 'in_progress' },
      include: [
        {
          association: 'route',
          include: [
            { association: 'checkpoints' },
            { association: 'neighborhood', attributes: ['id', 'name'] },
          ],
        },
        { association: 'checkpointVisits' },
      ],
    });

    if (!session) {
      return res.json({ active: false, message: 'No tenés ninguna ronda en curso' });
    }

    // Misma forma que el historial (serializeSession) — se reutiliza en vez
    // de duplicar el armado de checkpoints acá; ahora que hay dos formas de
    // registrar un checkpoint (GPS y QR, ver scanCheckpointQR) mantener esto
    // en un solo lugar evita que se desincronicen.
    const { session: sessionOut, route: routeOut, checkpoints } = patrolService.serializeSession(session);
    res.json({ active: true, session: sessionOut, route: routeOut, checkpoints });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── RONDAS: historial del guardia ───────────────────────────────────────────
// Listado liviano (sin checkpoints) — mismo criterio de paginación que
// getMyAttendance. El detalle completo va en getMyPatrolDetail.
exports.getMyPatrolHistory = async (req, res) => {
  try {
    const { limit = 30, offset = 0 } = req.query;
    const result = await PatrolSession.findAndCountAll({
      where: { securityStaffId: req.user.id },
      include: [{
        association: 'route',
        include: [{ association: 'neighborhood', attributes: ['id', 'name'] }],
      }],
      order: [['startedAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getMyPatrolDetail = async (req, res) => {
  try {
    const { id } = req.params;
    // where con securityStaffId en vez de findByPk + chequeo aparte: un
    // guardia nunca puede ver el detalle de una ronda que no es suya.
    const session = await PatrolSession.findOne({
      where: { id, securityStaffId: req.user.id },
      include: patrolService.SESSION_INCLUDE,
    });
    if (!session) return res.status(404).json({ error: 'Ronda no encontrada' });

    res.json(patrolService.serializeSession(session));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── RONDAS: registrar checkpoint ────────────────────────────────────────────
// Antigüedad máxima aceptada para lastLocationUpdate al registrar un
// checkpoint. El guardia reporta ubicación cada ~15s mientras la app está
// activa (ver watchPositionAsync en SecurityDashboardScreen / el tracking en
// background), así que 5 minutos da margen de sobra para cortes de
// conexión sin permitir usar una posición vieja para "falsear" un checkpoint.
const MAX_LOCATION_AGE_MS = 5 * 60 * 1000;

// Distancia entre dos coordenadas (fórmula de Haversine, matemática pura —
// no amerita una librería nueva solo para esta cuenta).
function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
  const EARTH_RADIUS_M = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_M * c;
}

// Chequeos comunes a las dos formas de registrar un checkpoint (GPS y QR,
// ver scanCheckpointQR más abajo): ronda en curso del guardia, pertenencia
// del checkpoint a esa ruta, y no-repetición. Se extrae acá para no
// duplicar esta lógica entre ambos flujos — lo único que difiere entre
// ellos es cómo se prueba la presencia física (radio GPS vs. escaneo del
// QR físico del lugar).
async function findCheckpointForActiveSession(req, patrolCheckpointId) {
  const session = await PatrolSession.findOne({
    where: { securityStaffId: req.user.id, status: 'in_progress' },
  });
  if (!session) {
    return { error: { status: 404, body: { error: 'No tenés ninguna ronda en curso' } } };
  }

  const checkpoint = await PatrolCheckpoint.findByPk(patrolCheckpointId);
  if (!checkpoint || checkpoint.patrolRouteId !== session.patrolRouteId) {
    return { error: { status: 400, body: { error: 'El checkpoint indicado no pertenece a la ruta de tu ronda actual' } } };
  }

  const alreadyVisited = await PatrolCheckpointVisit.findOne({
    where: { patrolSessionId: session.id, patrolCheckpointId: checkpoint.id },
  });
  if (alreadyVisited) {
    return { error: { status: 400, body: { error: 'Ya registraste este checkpoint en esta ronda' } } };
  }

  return { session, checkpoint };
}

exports.registerCheckpointVisit = async (req, res) => {
  try {
    const { patrolCheckpointId } = req.body;
    if (!patrolCheckpointId) {
      return res.status(400).json({ error: 'patrolCheckpointId es obligatorio' });
    }

    // 1-3. Ronda en curso, checkpoint de esa ruta, no repetido.
    const found = await findCheckpointForActiveSession(req, patrolCheckpointId);
    if (found.error) return res.status(found.error.status).json(found.error.body);
    const { session, checkpoint } = found;

    // 4. Última ubicación GPS conocida del guardia. Se lee lo que ya
    // mantiene actualizado el tracking existente (socket update_location /
    // REST updateLocation) — no se toca ni se agrega ninguna otra fuente.
    const guard = await SecurityStaff.findByPk(req.user.id, {
      attributes: ['lastLatitude', 'lastLongitude', 'lastLocationUpdate'],
    });
    if (guard?.lastLatitude == null || guard?.lastLongitude == null || !guard?.lastLocationUpdate) {
      return res.status(400).json({
        error: 'No hay una ubicación GPS disponible todavía. Esperá a que se actualice tu ubicación e intentá de nuevo.',
      });
    }

    // 4b. La ubicación no puede ser demasiado vieja (ver MAX_LOCATION_AGE_MS).
    const locationAgeMs = Date.now() - new Date(guard.lastLocationUpdate).getTime();
    if (locationAgeMs > MAX_LOCATION_AGE_MS) {
      return res.status(400).json({
        error: 'Tu ubicación GPS está desactualizada. Esperá a que se actualice e intentá de nuevo.',
        locationAgeSeconds: Math.round(locationAgeMs / 1000),
      });
    }

    // 5. Validar que esté dentro del radio del checkpoint.
    const distanceMeters = haversineDistanceMeters(
      guard.lastLatitude, guard.lastLongitude,
      checkpoint.latitude, checkpoint.longitude
    );

    if (distanceMeters > checkpoint.radiusMeters) {
      return res.status(400).json({
        error: `Estás a ${Math.round(distanceMeters)}m del checkpoint "${checkpoint.name}" — necesitás estar a ${checkpoint.radiusMeters}m o menos para registrarlo.`,
        distanceMeters: Math.round(distanceMeters),
        radiusMeters: checkpoint.radiusMeters,
      });
    }

    // 6. Dentro del radio: registrar la visita. El índice único en
    // (patrolSessionId, patrolCheckpointId) — ver models/PatrolCheckpointVisit.js —
    // es la garantía real ante dos requests casi simultáneas; el chequeo del
    // paso 3 ya cubre el caso normal con un mensaje más claro.
    let visit;
    try {
      visit = await PatrolCheckpointVisit.create({
        patrolSessionId: session.id,
        patrolCheckpointId: checkpoint.id,
        visitedAt: new Date(),
        method: 'gps',
      });
    } catch (err) {
      if (err.name === 'SequelizeUniqueConstraintError') {
        return res.status(400).json({ error: 'Ya registraste este checkpoint en esta ronda' });
      }
      throw err;
    }

    res.status(201).json({
      message: `Checkpoint "${checkpoint.name}" registrado`,
      visit,
      distanceMeters: Math.round(distanceMeters),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── RONDAS: registrar checkpoint por QR ─────────────────────────────────────
// Alternativa al registro por GPS de arriba, para checkpoints donde el GPS
// es poco confiable (interiores, garitas con mala señal): el guardia
// escanea un QR físico pegado en el lugar en vez de depender de la
// posición. El QR solo codifica el id del checkpoint — es un dato que ya es
// público dentro de la operación (un guardia con acceso a la ruta puede ver
// el checkpoint igual), así que no hace falta ningún token adicional: la
// "prueba" real es que el guardia tuvo que estar físicamente ahí para
// escanear el papel. A diferencia de VisitInvitation, este QR NO vence ni
// es de un solo uso — es un marcador fijo del lugar, pensado para
// escanearse una y otra vez en cada ronda futura (ver
// patrolController.getCheckpointQR, que lo genera para que el admin lo
// imprima y lo pegue).
//
// Importante: esto NO reemplaza ni modifica el flujo GPS de arriba — ambos
// escriben en la misma tabla (PatrolCheckpointVisit), y el admin puede ver
// con qué método se confirmó cada checkpoint (ver patrolService.serializeSession).
exports.scanCheckpointQR = async (req, res) => {
  try {
    const { patrolCheckpointId } = req.body;
    if (!patrolCheckpointId) {
      return res.status(400).json({ error: 'patrolCheckpointId es obligatorio' });
    }

    const found = await findCheckpointForActiveSession(req, patrolCheckpointId);
    if (found.error) return res.status(found.error.status).json(found.error.body);
    const { session, checkpoint } = found;

    let visit;
    try {
      visit = await PatrolCheckpointVisit.create({
        patrolSessionId: session.id,
        patrolCheckpointId: checkpoint.id,
        visitedAt: new Date(),
        method: 'qr',
      });
    } catch (err) {
      if (err.name === 'SequelizeUniqueConstraintError') {
        return res.status(400).json({ error: 'Ya registraste este checkpoint en esta ronda' });
      }
      throw err;
    }

    res.status(201).json({
      message: `Checkpoint "${checkpoint.name}" registrado por QR`,
      visit,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── VISITAS ──────────────────────────────────────────────────────────────────
// Registro de ingreso/egreso de visitantes al barrio del guardia — operado
// en tiempo real por cualquier guardia en turno (no es personal como
// AttendanceRecord: cualquier guardia del barrio puede registrar la salida
// de una visita que registró otro, por ej. en cambio de turno).

exports.registerVisit = async (req, res) => {
  try {
    if (!req.user.neighborhoodId) {
      return res.status(400).json({ error: 'Todavía no fuiste asignado a un barrio' });
    }

    const {
      visitorName, visitorDocument, destinationClientId, destinationDescription,
      authorizedBy, vehiclePlate, notes,
    } = req.body;

    if (!visitorName?.trim()) {
      return res.status(400).json({ error: 'El nombre del visitante es obligatorio' });
    }
    if (!destinationClientId && !destinationDescription?.trim()) {
      return res.status(400).json({ error: 'Indicá el destino de la visita' });
    }

    // Se guarda para reusarlo más abajo al mandar el push de "tu visita
    // llegó" — evita una segunda consulta por el mismo Client.
    let destClient = null;
    if (destinationClientId) {
      // El cliente destino tiene que ser del mismo barrio del guardia —
      // evita asociar una visita a un vecino de otro barrio por error. Y
      // tiene que seguir activo: un cliente dado de baja ya no debería
      // poder recibir visitas nuevas a su nombre (ver adminController.deactivateClient).
      destClient = await Client.findOne({
        where: { id: destinationClientId, neighborhoodId: req.user.neighborhoodId, isActive: true },
      });
      if (!destClient) return res.status(400).json({ error: 'El cliente indicado no pertenece a tu barrio' });
    }

    const visit = await Visit.create({
      neighborhoodId: req.user.neighborhoodId,
      registeredByStaffId: req.user.id,
      visitorName: visitorName.trim(),
      visitorDocument: visitorDocument?.trim() || null,
      destinationClientId: destinationClientId || null,
      destinationDescription: destinationDescription?.trim() || null,
      authorizedBy: authorizedBy?.trim() || null,
      vehiclePlate: vehiclePlate?.trim() || null,
      notes: notes?.trim() || null,
      entryAt: new Date(),
    });

    // Notifica al admin en tiempo real (ej. Centro de Control) — puramente
    // aditivo, ningún consumidor existente escuchaba este evento antes.
    const io = req.app.get('io');
    if (io) io.to('role:admin').emit('visit_registered', visit.toJSON());

    // Push al residente destino, si la visita se asoció a un Client
    // concreto (no aplica a destinationDescription libre, ahí no hay a
    // quién avisar) — le avisa que su visita llegó aunque no tenga la app
    // abierta en ese momento.
    if (destClient?.expoPushToken) {
      await sendPushNotification(
        destClient.expoPushToken,
        '🚪 Tu visita llegó',
        visitorName.trim(),
        { type: 'visit_arrived' }
      );
    }

    res.status(201).json(visit);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.registerVisitExit = async (req, res) => {
  try {
    const { id } = req.params;
    // Scope por barrio (no por quién la registró): un guardia distinto al
    // que registró el ingreso puede marcar la salida (cambio de turno).
    const visit = await Visit.findOne({ where: { id, neighborhoodId: req.user.neighborhoodId } });
    if (!visit) return res.status(404).json({ error: 'Visita no encontrada' });
    if (visit.exitAt) {
      return res.status(400).json({ error: 'Esta visita ya tiene salida registrada' });
    }

    await visit.update({ exitAt: new Date() });

    const io = req.app.get('io');
    if (io) io.to('role:admin').emit('visit_exited', { id: visit.id });

    res.json(visit);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Registra el ingreso de un visitante a partir de una invitación QR
// generada por un cliente (ver clientController.createVisitInvitation) en
// vez de tipear los datos a mano — crea el mismo Visit de siempre, así que
// el resto del flujo (activos, salida, historial, Centro de Control) no
// necesita ningún cambio.
exports.scanVisitInvitation = async (req, res) => {
  try {
    if (!req.user.neighborhoodId) {
      return res.status(400).json({ error: 'Todavía no fuiste asignado a un barrio' });
    }

    const { invitationId } = req.body;
    if (!invitationId) {
      return res.status(400).json({ error: 'invitationId es obligatorio' });
    }

    const invitation = await VisitInvitation.findByPk(invitationId, {
      include: [{ association: 'createdBy', attributes: ['id', 'firstName', 'lastName', 'isActive'] }],
    });
    if (!invitation) {
      return res.status(404).json({ error: 'Invitación no encontrada' });
    }
    // Mismo criterio que registerVisit con destinationClientId: no aceptar
    // una invitación de un barrio distinto al del guardia que escanea.
    if (invitation.neighborhoodId !== req.user.neighborhoodId) {
      return res.status(400).json({ error: 'Esta invitación no pertenece a tu barrio' });
    }
    // El cliente que la generó pudo haber sido dado de baja después de
    // crearla y antes de que se escanee (ventana de hasta 24hs) — ver
    // adminController.deactivateClient.
    if (!invitation.createdBy?.isActive) {
      return res.status(400).json({ error: 'El cliente que generó esta invitación ya no está activo' });
    }
    if (invitation.usedAt) {
      return res.status(400).json({
        error: `Esta invitación ya fue utilizada el ${invitation.usedAt.toLocaleString('es-AR')}`,
      });
    }
    if (invitation.expiresAt < new Date()) {
      return res.status(400).json({ error: 'Esta invitación venció' });
    }

    const visit = await Visit.create({
      neighborhoodId: req.user.neighborhoodId,
      registeredByStaffId: req.user.id,
      visitorName: invitation.visitorName,
      destinationClientId: invitation.createdByClientId,
      authorizedBy: invitation.createdBy
        ? `Invitación QR de ${invitation.createdBy.firstName} ${invitation.createdBy.lastName}`
        : 'Invitación QR',
      entryAt: new Date(),
    });

    await invitation.update({ usedAt: new Date(), usedVisitId: visit.id });

    // Mismo evento realtime que registerVisit — Centro de Control y
    // cualquier otro listener existente lo recibe sin cambios.
    const io = req.app.get('io');
    if (io) io.to('role:admin').emit('visit_registered', visit.toJSON());

    res.status(201).json(visit);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getActiveVisits = async (req, res) => {
  try {
    if (!req.user.neighborhoodId) {
      return res.json({ neighborhoodAssigned: false, visits: [] });
    }
    const visits = await Visit.findAll({
      where: { neighborhoodId: req.user.neighborhoodId, exitAt: null },
      // 'contact' para que el guardia pueda llamar al residente y
      // confirmar la visita si hace falta (ej. visita no anunciada por QR).
      include: [{ association: 'destinationClient', attributes: ['id', 'firstName', 'lastName', 'contact'] }],
      order: [['entryAt', 'ASC']],
    });
    res.json({ neighborhoodAssigned: true, visits });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getVisitHistory = async (req, res) => {
  try {
    const { limit = 30, offset = 0 } = req.query;
    if (!req.user.neighborhoodId) {
      return res.json({ neighborhoodAssigned: false, count: 0, rows: [] });
    }
    const result = await Visit.findAndCountAll({
      where: { neighborhoodId: req.user.neighborhoodId },
      // 'contact' para que el guardia pueda llamar al residente y
      // confirmar la visita si hace falta (ej. visita no anunciada por QR).
      include: [{ association: 'destinationClient', attributes: ['id', 'firstName', 'lastName', 'contact'] }],
      order: [['entryAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
    res.json({ neighborhoodAssigned: true, count: result.count, rows: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── ASIGNACIONES ─────────────────────────────────────────────────────────────
// Volumen bajo por guardia (a diferencia de Visitas/Rondas, que se acumulan
// con el tiempo) — un solo endpoint sin paginación alcanza.
exports.getMyAssignments = async (req, res) => {
  try {
    const assignments = await Assignment.findAll({
      where: { securityStaffId: req.user.id },
      order: [['createdAt', 'DESC']],
      limit: 50,
    });
    // Pendientes primero — se ordena en memoria en vez de con un CASE en el
    // ORDER BY para no complicar la query; el volumen lo permite sin problema.
    const sorted = [...assignments].sort((a, b) => {
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (a.status !== 'pending' && b.status === 'pending') return 1;
      return 0;
    });
    res.json(sorted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.completeAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    // Scope por guardia: uno no puede completar una asignación de otro.
    const assignment = await Assignment.findOne({ where: { id, securityStaffId: req.user.id } });
    if (!assignment) return res.status(404).json({ error: 'Asignación no encontrada' });
    if (assignment.status !== 'pending') {
      return res.status(400).json({ error: 'Esta asignación ya no está pendiente' });
    }

    await assignment.update({ status: 'completed', completedAt: new Date() });

    const io = req.app.get('io');
    if (io) {
      io.to('role:admin').emit('assignment_completed', { id, completedAt: assignment.completedAt });
    }

    res.json(assignment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── LOGOUT (limpia isOperator) ─────────────────────────────────────────────

exports.securityLogout = async (req, res) => {
  try {
    const staff = await SecurityStaff.findByPk(req.user.id, { attributes: ['isOperator'] });
    if (staff?.isOperator) {
      await SecurityStaff.update({ isOperator: false }, { where: { id: req.user.id } });
      // Notificar para que el socket salga de role:operator
      const io = req.app.get('io');
      if (io) {
        io.to(`user:${req.user.id}`).emit('operator_assigned', { isOperator: false });
      }
    }
    res.json({ message: 'Logout registrado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
