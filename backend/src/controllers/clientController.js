const { Client, Message, Alert } = require('../models');

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
    const client = await Client.findByPk(req.user.id, { attributes: ['firstName', 'lastName'] });

    const alert = await Alert.create({
      type: 'client_emergency',
      title: '🚨 EMERGENCIA DE CLIENTE',
      message: message || `${client.firstName} ${client.lastName} necesita asistencia urgente`,
      senderId: req.user.id,
      senderType: 'client',
      clientLatitude: latitude,
      clientLongitude: longitude,
    });

    // Emitir via socket
    const io = req.app.get('io');
    if (io) {
      io.to('role:admin').emit('emergency_alert', {
        ...alert.toJSON(),
        clientName: `${client.firstName} ${client.lastName}`,
      });
    }

    res.status(201).json({ message: 'Alerta enviada. Los administradores han sido notificados.', alert });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
