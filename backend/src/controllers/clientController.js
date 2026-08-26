const QRCode = require('qrcode');
const { Client, Message, Alert, VisitInvitation, Admin } = require('../models');
const { sendPushNotification } = require('../services/notificationService');

// Vigencia de una invitación de visita: simple y fija (no hace falta que el
// residente elija una fecha) — alcanza de sobra para "espero una visita hoy
// o mañana" sin agregar un date-picker que hoy no existe en la app.
const INVITATION_VALID_HOURS = 24;

// El QR nunca contiene los datos reales de la visita, solo esta referencia
// opaca al registro — toda la validación (vencimiento, uso único, barrio)
// se hace en el servidor al escanear (ver securityController.scanVisitInvitation).
const QR_PREFIX = 'visit-invite:';

exports.getMyProfile = async (req, res) => {
  try {
    const client = await Client.findByPk(req.user.id, {
      attributes: { exclude: ['password'] },
      include: [{ association: 'neighborhood', attributes: ['id', 'name'] }],
    });
    if (!client) return res.status(404).json({ error: 'Perfil no encontrado' });
    res.json(client);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.toggleLocationSharing = async (req, res) => {
  try {
    const { enabled } = req.body;
    await Client.update(
      { locationSharingEnabled: enabled },
      { where: { id: req.user.id } }
    );
    res.json({ locationSharingEnabled: enabled });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Self-service: el propio cliente carga/corrige su teléfono de contacto —
// es su propio dato, no hace falta pasar por el admin (que hoy además no
// tiene ninguna pantalla para editar clientes existentes, solo para darlos
// de alta). Mismo criterio de "sin formato forzado" que
// SecurityStaff.contact (ver models/Client.js).
exports.updateContact = async (req, res) => {
  try {
    const { contact } = req.body;
    const value = contact?.trim() || null;
    await Client.update({ contact: value }, { where: { id: req.user.id } });
    res.json({ contact: value });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getChatMessages = async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const messages = await Message.findAndCountAll({
      where: { roomType: 'client_admin', roomId: req.user.id },
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    res.json({ ...messages, rows: messages.rows.reverse() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.sendEmergencyAlert = async (req, res) => {
  try {
    const { message, latitude, longitude } = req.body;
    const client = await Client.findByPk(req.user.id, {
      attributes: ['firstName', 'lastName', 'contact'],
      include: [{ association: 'neighborhood', attributes: ['name'] }],
    });

    const alert = await Alert.create({
      type: 'client_emergency',
      title: '🚨 EMERGENCIA DE CLIENTE',
      message: message || `${client.firstName} ${client.lastName} necesita asistencia urgente`,
      senderId: req.user.id,
      senderType: 'client',
      clientLatitude: latitude,
      clientLongitude: longitude,
    });

    // Emitir via socket. clientName/clientNeighborhood van también acá (no
    // solo en el REST de getAlerts) para que la notificación en vivo y la
    // lista recargada muestren siempre lo mismo — antes solo el socket
    // llevaba el nombre y quedaba desactualizado al refrescar.
    const io = req.app.get('io');
    if (io) {
      io.to('role:admin').emit('emergency_alert', {
        ...alert.toJSON(),
        clientName: `${client.firstName} ${client.lastName}`,
        clientNeighborhood: client.neighborhood?.name || null,
        clientContact: client.contact || null,
      });
    }

    // Push a todos los admins, no solo socket: una emergencia es exactamente
    // el caso en el que importa que se entere aunque no tenga la app
    // abierta en ese momento (antes el admin dependía 100% de estar
    // conectado al socket para enterarse de una emergencia).
    const admins = await Admin.findAll({ where: { isActive: true }, attributes: ['expoPushToken'] });
    const adminTokens = admins.map((a) => a.expoPushToken).filter(Boolean);
    if (adminTokens.length > 0) {
      await sendPushNotification(
        adminTokens,
        alert.title,
        alert.message,
        { type: 'client_emergency' }
      );
    }

    res.status(201).json({ message: 'Alerta enviada. Los administradores han sido notificados.', alert });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── INVITACIONES DE VISITA (QR) ─────────────────────────────────────────────
exports.createVisitInvitation = async (req, res) => {
  try {
    const { visitorName } = req.body;
    if (!visitorName?.trim()) {
      return res.status(400).json({ error: 'El nombre del visitante es obligatorio' });
    }

    const client = await Client.findByPk(req.user.id, { attributes: ['neighborhoodId'] });
    if (!client?.neighborhoodId) {
      return res.status(400).json({ error: 'Todavía no fuiste asignado a un barrio' });
    }

    const invitation = await VisitInvitation.create({
      neighborhoodId: client.neighborhoodId,
      createdByClientId: req.user.id,
      visitorName: visitorName.trim(),
      expiresAt: new Date(Date.now() + INVITATION_VALID_HOURS * 60 * 60 * 1000),
    });

    const qrDataUrl = await QRCode.toDataURL(`${QR_PREFIX}${invitation.id}`, { margin: 1, width: 300 });

    res.status(201).json({
      id: invitation.id,
      visitorName: invitation.visitorName,
      expiresAt: invitation.expiresAt,
      qrDataUrl,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getVisitInvitations = async (req, res) => {
  try {
    const invitations = await VisitInvitation.findAll({
      where: { createdByClientId: req.user.id },
      order: [['createdAt', 'DESC']],
      limit: 20,
    });

    const now = new Date();
    const result = await Promise.all(
      invitations.map(async (inv) => {
        const isValid = !inv.usedAt && inv.expiresAt > now;
        return {
          id: inv.id,
          visitorName: inv.visitorName,
          expiresAt: inv.expiresAt,
          usedAt: inv.usedAt,
          // El QR se recalcula al vuelo (solo codifica el id) — no hace
          // falta guardar la imagen, así se evita duplicar información
          // que ya se puede derivar del propio registro.
          qrDataUrl: isValid ? await QRCode.toDataURL(`${QR_PREFIX}${inv.id}`, { margin: 1, width: 300 }) : null,
        };
      })
    );

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
