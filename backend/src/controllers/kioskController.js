const kioskService = require('../services/kioskService');
const { Admin } = require('../models');

// ── Público ────────────────────────────────────────────────────────────────
// Lo consulta el dispositivo kiosco (ScannerScreen) ANTES de cualquier
// login/escaneo — por eso no puede requerir autenticación.
exports.getPublicStatus = async (req, res) => {
  try {
    const state = await kioskService.getState();
    res.json({ isOpen: state.isOpen });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── Admin ──────────────────────────────────────────────────────────────────
exports.getState = async (req, res) => {
  try {
    const state = await kioskService.getState();
    let updatedByAdminName = null;
    if (state.updatedByAdminId) {
      const admin = await Admin.findByPk(state.updatedByAdminId, { attributes: ['name'] });
      updatedByAdminName = admin?.name || null;
    }
    res.json({
      isOpen: state.isOpen,
      updatedAt: state.updatedAt,
      updatedByAdminName,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.setState = async (req, res) => {
  try {
    const { isOpen } = req.body;
    if (typeof isOpen !== 'boolean') {
      return res.status(400).json({ error: 'isOpen debe ser true o false' });
    }
    const state = await kioskService.setOpen(isOpen, req.user.id);
    res.json({ isOpen: state.isOpen, updatedAt: state.updatedAt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
