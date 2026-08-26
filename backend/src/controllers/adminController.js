const { Op } = require('sequelize');
const {
  Admin,
  SecurityStaff,
  Client,
  Neighborhood,
  AttendanceRecord,
  Alert,
  FinancialRecord,
} = require('../models');
const { sendWakeUpAlert, sendPushNotification } = require('../services/notificationService');
const { makeUserJoinRoom, makeUserLeaveRoom } = require('../services/socketService');
const faceService = require('../services/faceService');
const auditService = require('../services/auditService');
const { getPeriodRange } = require('../utils/periodRange');
const path = require('path');

// ── ADMINISTRADORES ────────────────────────────────────────────────────────
// Alta de administradores adicionales, solo accesible para un admin ya
// autenticado (ver middleware requireAdmin en routes/admin.js). El primer
// admin del sistema se crea vía POST /api/auth/admin/register (público solo
// mientras no exista ninguno — ver authController.adminRegister).
exports.createAdmin = async (req, res) => {
  try {
    const { username, password, name } = req.body;
    if (!username || !password || !name) {
      return res.status(400).json({ error: 'Usuario, contraseña y nombre son obligatorios' });
    }
    const admin = await Admin.create({ username, password, name });
    await auditService.log({
      actorId: req.user.id,
      action: 'admin.create',
      entityType: 'Admin',
      entityId: admin.id,
      metadata: { username: admin.username, name: admin.name },
    });
    res.status(201).json({ id: admin.id, username: admin.username, name: admin.name });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: 'El usuario ya existe' });
    }
    res.status(500).json({ error: err.message });
  }
};

// ── BARRIOS ────────────────────────────────────────────────────────────────
exports.getNeighborhoods = async (req, res) => {
  try {
    const neighborhoods = await Neighborhood.findAll({ where: { isActive: true } });
    res.json(neighborhoods);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createNeighborhood = async (req, res) => {
  try {
    const { name, address, description } = req.body;
    const n = await Neighborhood.create({ name, address, description });
    res.status(201).json(n);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateNeighborhood = async (req, res) => {
  try {
    const { id } = req.params;
    await Neighborhood.update(req.body, { where: { id } });
    const updated = await Neighborhood.findByPk(id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── GUARDIAS ───────────────────────────────────────────────────────────────
// Alta de guardias (antes era pública en authController.securityRegister —
// ver disclosure en la conversación: ahora requiere admin autenticado).
// Misma lógica de siempre: extrae el descriptor facial de la foto de perfil
// mediante faceService antes de crear el registro.
exports.createSecurityStaff = async (req, res) => {
  try {
    const { firstName, lastName, documentNumber, age } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'Se requiere foto de perfil' });
    }

    const profilePhotoPath = req.file.path
      ? path.relative(path.join(__dirname, '../../'), req.file.path)
      : null;

    const imageBuffer =
      req.file.buffer || require('fs').readFileSync(req.file.path);

    const descriptor = await faceService.extractDescriptor(imageBuffer);

    if (!descriptor) {
      return res.status(400).json({
        error: 'No se detectó un rostro válido en la foto de perfil'
      });
    }

    const staff = await SecurityStaff.create({
      firstName,
      lastName,
      documentNumber,
      age: parseInt(age),
      profilePhoto: profilePhotoPath,
      faceDescriptor: faceService.descriptorToJson(descriptor),
    });

    res.status(201).json({
      message: 'Guardia registrado correctamente',
      staff
    });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: 'Ya existe un guardia con ese documento' });
    }
    res.status(500).json({ error: err.message });
  }
};

exports.getSecurityStaff = async (req, res) => {
  try {
    const { neighborhoodId } = req.query;
    const where = { isActive: true };
    if (neighborhoodId) where.neighborhoodId = neighborhoodId;

    const staff = await SecurityStaff.findAll({
      where,
      include: [{ association: 'neighborhood', attributes: ['id', 'name'] }],
      attributes: { exclude: ['faceDescriptor'] },
    });
    // Agregar flag booleano: ¿tiene descriptor facial listo?
    const result = staff.map((s) => ({
      ...s.toJSON(),
      faceDescriptor: s.getDataValue('faceDescriptor') != null,
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getSecurityProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const staff = await SecurityStaff.findByPk(id, {
      include: [{ association: 'neighborhood', attributes: ['id', 'name'] }],
      attributes: { exclude: ['faceDescriptor'] },
    });
    if (!staff) return res.status(404).json({ error: 'Guardia no encontrado' });
    res.json(staff);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateSecurityStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const allowedFields = [
      'firstName', 'lastName', 'documentNumber', 'age',
      'neighborhoodId', 'shiftStart', 'shiftEnd',
      'paymentDay', 'salary', 'contact',
    ];
    const updates = {};
    allowedFields.forEach((f) => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    await SecurityStaff.update(updates, { where: { id } });
    const updated = await SecurityStaff.findByPk(id, {
      attributes: { exclude: ['faceDescriptor'] },
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deactivateSecurityStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const staff = await SecurityStaff.findByPk(id, { attributes: ['firstName', 'lastName'] });
    if (!staff) return res.status(404).json({ error: 'Guardia no encontrado' });

    await staff.update({ isActive: false });
    await auditService.log({
      actorId: req.user.id,
      action: 'security_staff.deactivate',
      entityType: 'SecurityStaff',
      entityId: id,
      metadata: { firstName: staff.firstName, lastName: staff.lastName },
    });
    res.json({ message: 'Guardia dado de baja correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getAttendanceHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 50, offset = 0, from, to } = req.query;
    const where = { securityStaffId: id };
    if (from || to) {
      where.checkIn = {};
      if (from) where.checkIn[Op.gte] = new Date(from);
      if (to) where.checkIn[Op.lte] = new Date(to);
    }

    const records = await AttendanceRecord.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['checkIn', 'DESC']],
      include: [{ association: 'neighborhood', attributes: ['name'] }],
    });
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── ALERTAS ────────────────────────────────────────────────────────────────
exports.sendAlert = async (req, res) => {
  try {
    const { title, message, targetNeighborhoodId, targetSecurityId } = req.body;
    const adminId = req.user.id;

    const alert = await Alert.create({
      type: 'admin_to_security',
      title,
      message,
      senderId: adminId,
      senderType: 'admin',
      targetNeighborhoodId,
      targetSecurityId,
    });

    // Obtener tokens para notificación push
    const where = { isActive: true };
    if (targetSecurityId) {
      where.id = targetSecurityId;
    } else if (targetNeighborhoodId) {
      where.neighborhoodId = targetNeighborhoodId;
    }

    const staff = await SecurityStaff.findAll({ where, attributes: ['expoPushToken'] });
    const tokens = staff.map((s) => s.expoPushToken).filter(Boolean);

    if (tokens.length > 0) {
      await sendWakeUpAlert(tokens, message);
    }

    // Emitir via Socket.io
    const io = req.app.get('io');
    if (io) {
      if (targetSecurityId) {
        io.to(`user:${targetSecurityId}`).emit('admin_alert', alert.toJSON());
      } else if (targetNeighborhoodId) {
        io.to(`neighborhood:${targetNeighborhoodId}`).emit('admin_alert', alert.toJSON());
      } else {
        io.to('role:security').emit('admin_alert', alert.toJSON());
      }
    }

    res.status(201).json(alert);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── CLIENTES ───────────────────────────────────────────────────────────────
exports.registerClient = async (req, res) => {
  try {
    const { username, password, firstName, lastName, age, neighborhoodId, contact } = req.body;

    let profilePhoto = null;
    if (req.file) {
      profilePhoto = path.relative(path.join(__dirname, '../../'), req.file.path);
    }

    const client = await Client.create({
      username,
      password,
      firstName,
      lastName,
      age: age ? parseInt(age) : null,
      profilePhoto,
      neighborhoodId,
      contact: contact?.trim() || null,
    });

    res.status(201).json({
      id: client.id,
      username: client.username,
      firstName: client.firstName,
      lastName: client.lastName,
      profilePhoto: client.profilePhoto,
    });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: 'El usuario ya existe' });
    }
    res.status(500).json({ error: err.message });
  }
};

exports.getClients = async (req, res) => {
  try {
    const { neighborhoodId } = req.query;
    const where = { isActive: true };
    if (neighborhoodId) where.neighborhoodId = neighborhoodId;

    const clients = await Client.findAll({
      where,
      attributes: { exclude: ['password'] },
      include: [{ association: 'neighborhood', attributes: ['id', 'name'] }],
      order: [['firstName', 'ASC']],
    });
    res.json(clients);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Mismo criterio que updateSecurityStaff: whitelist de campos editables por
// el admin. Se excluyen a propósito username/password (credencial de
// login — cambiarla es una decisión aparte, no un dato administrativo) y
// profilePhoto (tampoco es editable acá para guardias; se carga solo al
// registrar).
exports.updateClient = async (req, res) => {
  try {
    const { id } = req.params;
    const client = await Client.findByPk(id);
    if (!client) return res.status(404).json({ error: 'Cliente no encontrado' });

    const allowedFields = ['firstName', 'lastName', 'age', 'neighborhoodId', 'contact'];
    const updates = {};
    allowedFields.forEach((f) => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    if (updates.firstName !== undefined && !updates.firstName.trim()) {
      return res.status(400).json({ error: 'firstName no puede estar vacío' });
    }
    if (updates.lastName !== undefined && !updates.lastName.trim()) {
      return res.status(400).json({ error: 'lastName no puede estar vacío' });
    }
    if (updates.age !== undefined) {
      updates.age = updates.age === '' || updates.age === null ? null : parseInt(updates.age, 10);
    }
    if (updates.contact !== undefined) {
      updates.contact = updates.contact?.trim() || null;
    }
    if (updates.neighborhoodId !== undefined) {
      // '' (el form de mobile lo manda así al destildar el barrio) no es un
      // UUID válido — sin esto, Sequelize lo rechazaba con un 500 crudo en
      // vez de guardar "sin barrio" como corresponde.
      if (!updates.neighborhoodId) {
        updates.neighborhoodId = null;
      } else {
        const neighborhood = await Neighborhood.findByPk(updates.neighborhoodId);
        if (!neighborhood) return res.status(400).json({ error: 'El barrio indicado no existe' });
      }
    }

    await client.update(updates);

    // Edición de datos administrativos del cliente — acción de admin sobre
    // otro usuario, mismo criterio que ya se audita para SecurityStaff/Admin.
    await auditService.log({
      actorId: req.user.id,
      action: 'client.update',
      entityType: 'Client',
      entityId: client.id,
      metadata: { fields: Object.keys(updates) },
    });

    const updated = await Client.findByPk(id, {
      attributes: { exclude: ['password'] },
      include: [{ association: 'neighborhood', attributes: ['id', 'name'] }],
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deactivateClient = async (req, res) => {
  try {
    const { id } = req.params;
    const client = await Client.findByPk(id, { attributes: ['firstName', 'lastName'] });
    if (!client) return res.status(404).json({ error: 'Cliente no encontrado' });

    // Soft-delete — mismo campo/criterio que SecurityStaff/Admin/Neighborhood
    // (isActive:false). No se borra la fila: el historial de Visitas/Alertas
    // que referencian a este cliente sigue siendo consultable sin cambios
    // (esas consultas no filtran por isActive — ver adminController.getAlerts,
    // securityController.getVisitHistory). Además, a partir de acá la cuenta
    // ya no puede loguearse ni usar el token que tuviera vigente (ver
    // middleware/auth.js → isStillActive, revalida en cada request y en el
    // handshake de sockets).
    await client.update({ isActive: false });

    await auditService.log({
      actorId: req.user.id,
      action: 'client.deactivate',
      entityType: 'Client',
      entityId: id,
      metadata: { firstName: client.firstName, lastName: client.lastName },
    });

    res.json({ message: 'Cliente dado de baja correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── FINANZAS ───────────────────────────────────────────────────────────────
exports.createFinancialRecord = async (req, res) => {
  try {
    const { type, category, description, amount, frequency, startDate, neighborhoodId, securityStaffId } = req.body;

    const record = await FinancialRecord.create({
      adminId: req.user.id,
      type,
      category,
      description,
      amount: parseFloat(amount),
      frequency,
      startDate,
      neighborhoodId,
      securityStaffId,
    });

    await auditService.log({
      actorId: req.user.id,
      action: 'financial_record.create',
      entityType: 'FinancialRecord',
      entityId: record.id,
      metadata: { type: record.type, amount: record.amount, description: record.description },
    });

    res.status(201).json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getFinancialRecords = async (req, res) => {
  try {
    const { type, from, to, neighborhoodId, frequency } = req.query;
    const where = { adminId: req.user.id, isActive: true };
    if (type) where.type = type;
    if (neighborhoodId) where.neighborhoodId = neighborhoodId;
    if (frequency) where.frequency = frequency;
    if (from || to) {
      where.startDate = {};
      if (from) where.startDate[Op.gte] = from;
      if (to) where.startDate[Op.lte] = to;
    }

    const records = await FinancialRecord.findAll({
      where,
      order: [['startDate', 'DESC']],
    });

    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getFinancialStats = async (req, res) => {
  try {
    const { period } = req.query; // 'day', 'week', 'month', 'year', 'total'
    const adminId = req.user.id;

    // Rango de fechas según período — mismo helper que ahora también usa
    // statisticsController, para no mantener este cálculo en dos lugares.
    const now = new Date();
    const { from } = getPeriodRange(period);

    const where = { adminId, isActive: true };
    if (from) where.startDate = { [Op.gte]: from.toISOString().split('T')[0] };

    const records = await FinancialRecord.findAll({ where });

    // Calcular totales considerando frecuencia
    let totalIncome = 0;
    let totalExpense = 0;

    for (const r of records) {
      const amount = parseFloat(r.amount);
      let effectiveAmount = amount;

      // Para registros recurrentes, calcular cuántas veces aplica en el periodo
      if (period && period !== 'total' && r.frequency !== 'unique') {
        const days = from ? Math.ceil((now - from) / (1000 * 60 * 60 * 24)) : 0;
        if (r.frequency === 'monthly') effectiveAmount = amount * (days / 30);
        else if (r.frequency === 'annual') effectiveAmount = amount * (days / 365);
        else if (r.frequency === 'biweekly') effectiveAmount = amount * (days / 15);
      }

      if (r.type === 'income') totalIncome += effectiveAmount;
      else totalExpense += effectiveAmount;
    }

    res.json({
      period: period || 'total',
      totalIncome: Math.round(totalIncome * 100) / 100,
      totalExpense: Math.round(totalExpense * 100) / 100,
      balance: Math.round((totalIncome - totalExpense) * 100) / 100,
      records,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateFinancialRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const [count] = await FinancialRecord.update(req.body, { where: { id, adminId: req.user.id } });
    if (count === 0) return res.status(404).json({ error: 'Registro no encontrado' });
    const updated = await FinancialRecord.findByPk(id);

    await auditService.log({
      actorId: req.user.id,
      action: 'financial_record.update',
      entityType: 'FinancialRecord',
      entityId: id,
      metadata: { changes: req.body },
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteFinancialRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await FinancialRecord.findOne({ where: { id, adminId: req.user.id } });
    if (!record) return res.status(404).json({ error: 'Registro no encontrado' });

    await record.update({ isActive: false });

    await auditService.log({
      actorId: req.user.id,
      action: 'financial_record.delete',
      entityType: 'FinancialRecord',
      entityId: id,
      metadata: { type: record.type, amount: record.amount, description: record.description },
    });

    res.json({ message: 'Registro eliminado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── GUARDIAS EN TIEMPO REAL ────────────────────────────────────────────────
exports.getGuardsLocations = async (req, res) => {
  try {
    const { neighborhoodId } = req.query;
    const where = { isActive: true, isOnDuty: true };
    if (neighborhoodId) where.neighborhoodId = neighborhoodId;

    const staff = await SecurityStaff.findAll({
      where,
      attributes: ['id', 'firstName', 'lastName', 'lastLatitude', 'lastLongitude', 'lastLocationUpdate', 'neighborhoodId'],
      include: [{ association: 'neighborhood', attributes: ['name'] }],
    });
    res.json(staff);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getClientsLocations = async (req, res) => {
  try {
    const { neighborhoodId } = req.query;
    const where = { isActive: true, locationSharingEnabled: true };
    if (neighborhoodId) where.neighborhoodId = neighborhoodId;

    const clients = await Client.findAll({
      where,
      attributes: ['id', 'firstName', 'lastName', 'lastLatitude', 'lastLongitude', 'lastLocationUpdate'],
    });
    res.json(clients);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getAlerts = async (req, res) => {
  try {
    const alerts = await Alert.findAll({
      where: { type: 'client_emergency' },
      order: [['createdAt', 'DESC']],
      limit: 50,
    });

    // Enriquecer con nombre y barrio del cliente que envió la alerta —
    // mismo criterio que getGuardAlerts (Alert no tiene FK real a Client,
    // ver decisión histórica documentada en el modelo). Antes esta lista no
    // traía ningún dato del cliente: el admin no tenía forma de saber quién
    // envió la emergencia salvo lo que el propio cliente haya escrito en el
    // mensaje.
    const enriched = await Promise.all(
      alerts.map(async (a) => {
        if (!a.senderId) return a.toJSON();
        const client = await Client.findByPk(a.senderId, {
          attributes: ['firstName', 'lastName', 'contact'],
          include: [{ association: 'neighborhood', attributes: ['name'] }],
        });
        return {
          ...a.toJSON(),
          clientName: client ? `${client.firstName} ${client.lastName}` : null,
          clientNeighborhood: client?.neighborhood?.name || null,
          // Para que el admin pueda llamar directo ante una emergencia —
          // antes solo veía nombre y barrio (ver models/Client.js).
          clientContact: client?.contact || null,
        };
      })
    );

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.resolveAlert = async (req, res) => {
  try {
    const { id } = req.params;
    // Acotado a client_emergency: este endpoint es "resolver emergencia de
    // cliente" (ver sección de rutas). guard_alert tiene su propio endpoint
    // de resolución (securityController.resolveGuardAlert, con su propia
    // regla de quién puede resolverla) — sin este filtro, este endpoint
    // podía en teoría tocar cualquier tipo de Alert por id.
    //
    // Se busca primero (en vez de un Alert.update directo por id) porque
    // ahora hace falta el senderId para avisarle al cliente que su
    // emergencia fue atendida — antes de esto no había ningún consumidor
    // de ese dato acá.
    const alert = await Alert.findOne({ where: { id, type: 'client_emergency' } });
    if (!alert) return res.status(404).json({ error: 'Alerta no encontrada' });

    await alert.update({ isRead: true, resolvedAt: new Date() });

    await auditService.log({
      actorId: req.user.id,
      action: 'alert.resolve',
      entityType: 'Alert',
      entityId: id,
    });

    // Notificar a todos los admins conectados para que actualicen el contador
    const io = req.app.get('io');
    if (io) io.emit('alert_resolved', { id });

    // Push al cliente que envió la emergencia — es quien más necesita
    // enterarse de que un admin ya la vio, sobre todo si cerró la app
    // después de mandarla (hasta ahora no tenía forma de saberlo).
    if (alert.senderId) {
      const client = await Client.findByPk(alert.senderId, { attributes: ['expoPushToken'] });
      if (client?.expoPushToken) {
        await sendPushNotification(
          client.expoPushToken,
          '✅ Alerta atendida',
          'Un administrador confirmó tu emergencia.',
          { type: 'alert_resolved' }
        );
      }
    }

    res.json({ message: 'Alerta resuelta' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── OPERADOR ───────────────────────────────────────────────────────────────

exports.assignOperator = async (req, res) => {
  try {
    const { id } = req.params;

    // Encontrar operador anterior (para sacarlo del room de socket)
    const prevOp = await SecurityStaff.findOne({
      where: { isOperator: true },
      attributes: ['id'],
    });

    // Solo puede haber un operador: quitar el anterior
    await SecurityStaff.update({ isOperator: false }, { where: { isOperator: true } });

    // Asignar el nuevo
    await SecurityStaff.update({ isOperator: true }, { where: { id, isActive: true } });

    const updated = await SecurityStaff.findByPk(id, {
      attributes: { exclude: ['faceDescriptor'] },
      include: [{ association: 'neighborhood', attributes: ['id', 'name'] }],
    });
    if (!updated) return res.status(404).json({ error: 'Guardia no encontrado' });

    const io = req.app.get('io');
    if (io) {
      // Sacar al operador anterior del room y notificarlo
      if (prevOp && prevOp.id !== id) {
        makeUserLeaveRoom(prevOp.id, 'role:operator');
        io.to(`user:${prevOp.id}`).emit('operator_assigned', { isOperator: false });
      }
      // Meter al nuevo operador en el room y notificarlo
      makeUserJoinRoom(id, 'role:operator');
      io.to(`user:${id}`).emit('operator_assigned', { isOperator: true });
    }

    res.json({ message: `${updated.firstName} ${updated.lastName} asignado como operador`, staff: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.removeOperator = async (req, res) => {
  try {
    // Encontrar operador actual antes de removerlo
    const prevOp = await SecurityStaff.findOne({
      where: { isOperator: true },
      attributes: ['id'],
    });

    await SecurityStaff.update({ isOperator: false }, { where: { isOperator: true } });

    const io = req.app.get('io');
    if (io && prevOp) {
      makeUserLeaveRoom(prevOp.id, 'role:operator');
      io.to(`user:${prevOp.id}`).emit('operator_assigned', { isOperator: false });
    }

    res.json({ message: 'Operador removido' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── HISTORIAL ALERTAS DE GUARDIAS ─────────────────────────────────────────

exports.getGuardAlerts = async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const alerts = await Alert.findAndCountAll({
      where: { type: 'guard_alert' },
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    // Enriquecer con nombre del guardia y su contacto
    const { rows, count } = alerts;
    const enriched = await Promise.all(
      rows.map(async (a) => {
        if (!a.senderId) return a.toJSON();
        const guard = await SecurityStaff.findByPk(a.senderId, {
          attributes: ['firstName', 'lastName', 'contact'],
        });
        return {
          ...a.toJSON(),
          guardFirstName: guard?.firstName || null,
          guardLastName:  guard?.lastName  || null,
          guardContact:   guard?.contact   || null,
        };
      })
    );

    res.json({ count, rows: enriched });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
