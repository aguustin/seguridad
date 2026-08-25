const jwt = require('jsonwebtoken');
const { Admin, SecurityStaff, Client } = require('../models');
const faceService = require('../services/faceService');

function generateToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

// ── ADMIN ──────────────────────────────────────────────────────────────────
exports.adminLogin = async (req, res) => {
  try {
    const { username, password } = req.body;
    const admin = await Admin.findOne({ where: { username, isActive: true } });
    if (!admin || !(await admin.validatePassword(password))) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }
    const token = generateToken({ id: admin.id, role: 'admin' });
    res.json({ token, user: { id: admin.id, username: admin.username, name: admin.name, role: 'admin' } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.adminRegister = async (req, res) => {
  try {
    // Este endpoint es público a propósito para poder crear el primer
    // administrador del sistema (ver README). Una vez que existe al menos
    // un admin, se cierra: cualquier alta posterior debe hacerse desde el
    // panel (ver adminController.createAdmin, protegido por requireAdmin).
    const existingAdmins = await Admin.count();
    if (existingAdmins > 0) {
      return res.status(403).json({
        error: 'Ya existe un administrador. Pedile a un administrador activo que te cree una cuenta desde el panel.',
      });
    }

    const { username, password, name } = req.body;
    const admin = await Admin.create({ username, password, name });
    const token = generateToken({ id: admin.id, role: 'admin' });
    res.status(201).json({ token, user: { id: admin.id, username: admin.username, name: admin.name, role: 'admin' } });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: 'El usuario ya existe' });
    }
    res.status(500).json({ error: err.message });
  }
};

// ── SECURITY STAFF ─────────────────────────────────────────────────────────
// El alta de guardias (creación del registro + extracción del descriptor
// facial) vive ahora en adminController.createSecurityStaff, protegida por
// requireAdmin — ver POST /api/admin/security. Acá solo queda el escaneo
// facial (check-in/check-out), que sigue siendo público porque el
// dispositivo kiosco no tiene sesión.
exports.securityFaceScan = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Se requiere imagen del escaneo facial' });
    }

    const imageBuffer = req.file.buffer;

    // Extraer descriptor de la imagen capturada
    let scannedDescriptor;
    try {
      scannedDescriptor = await faceService.extractDescriptor(imageBuffer);
    } catch (err) {
      return res.status(503).json({ error: 'Servicio de reconocimiento facial no disponible', details: err.message });
    }

    if (!scannedDescriptor) {
      return res.status(400).json({ error: 'No se detectó un rostro en la imagen' });
    }

    // Buscar guardias activos con descriptor facial. Se comparan en memoria
    // acá porque el volumen es bajo (decenas/pocos cientos de guardias por
    // barrio) — no vale la pena traer una librería de vector search para esto.
    const allStaff = await SecurityStaff.findAll({
      where: { isActive: true },
      attributes: ['id', 'firstName', 'lastName', 'faceDescriptor', 'neighborhoodId', 'isOnDuty', 'shiftStart', 'shiftEnd'],
    });

    let matched = null;
    let bestDistance = Infinity;

    for (const staff of allStaff) {
      if (!staff.faceDescriptor) continue;

      const result = faceService.compareDescriptors(scannedDescriptor, staff.faceDescriptor);

      if (result.match && result.distance < bestDistance) {
        bestDistance = result.distance;
        matched = staff;
      }
    }

    if (!matched) {
      // Verificar si hay guardias sin descriptor (recién registrados, WASM todavía procesando)
      const pendingCount = allStaff.filter((s) => !s.faceDescriptor).length;
      const extra = pendingCount > 0
        ? ` (${pendingCount} guardia${pendingCount > 1 ? 's' : ''} con reconocimiento facial pendiente)`
        : '';
      return res.status(404).json({ error: `Rostro no reconocido. Contacte al administrador.${extra}` });
    }

    // Determinar si es ingreso o salida
    const { AttendanceRecord } = require('../models');

    const lastRecord = await AttendanceRecord.findOne({
      where: { securityStaffId: matched.id },
      order: [['createdAt', 'DESC']],
    });

    const isCheckIn = !lastRecord || lastRecord.checkOut !== null;

    if (isCheckIn) {
      // Calcular delay respecto al turno
      let delayMinutes = 0;
      if (matched.shiftStart) {
        const [h, m] = matched.shiftStart.split(':').map(Number);
        const shiftStartToday = new Date();
        shiftStartToday.setHours(h, m, 0, 0);
        delayMinutes = Math.max(0, Math.round((new Date() - shiftStartToday) / 60000));
      }

      const record = await AttendanceRecord.create({
        securityStaffId: matched.id,
        neighborhoodId: matched.neighborhoodId,
        checkIn: new Date(),
        checkInDelayMinutes: delayMinutes,
      });

      const token = generateToken({
        id: matched.id,
        role: 'security',
        neighborhoodId: matched.neighborhoodId,
      });

      res.json({
        action: 'check_in',
        message: `Bienvenido ${matched.firstName} ${matched.lastName}`,
        time: new Date(),
        delayMinutes,
        record,
        token,
        staff: { id: matched.id, role: 'security', firstName: matched.firstName, lastName: matched.lastName, neighborhoodId: matched.neighborhoodId },
      });
    } else {
      // Check out
      await AttendanceRecord.update(
        { checkOut: new Date() },
        { where: { id: lastRecord.id } }
      );

      res.json({
        action: 'check_out',
        message: `Hasta pronto, ${matched.firstName} ${matched.lastName}`,
        time: new Date(),
        record: { ...lastRecord.toJSON(), checkOut: new Date() },
        staff: { id: matched.id, firstName: matched.firstName, lastName: matched.lastName, neighborhoodId: matched.neighborhoodId },
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── CLIENT ─────────────────────────────────────────────────────────────────
exports.clientLogin = async (req, res) => {
  try {
    const { username, password } = req.body;
    const client = await Client.findOne({
      where: { username, isActive: true },
      include: [{ association: 'neighborhood', attributes: ['id', 'name'] }],
    });

    if (!client || !(await client.validatePassword(password))) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }

    const token = generateToken({
      id: client.id,
      role: 'client',
      neighborhoodId: client.neighborhoodId,
    });

    res.json({
      token,
      user: {
        id: client.id,
        username: client.username,
        firstName: client.firstName,
        lastName: client.lastName,
        profilePhoto: client.profilePhoto,
        neighborhood: client.neighborhood,
        role: 'client',
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
