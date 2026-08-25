const { PatrolRoute, PatrolCheckpoint, Neighborhood } = require('../models');

// ── Validación ─────────────────────────────────────────────────────────────
// Funciones simples, locales a este controller — no ameritan un service
// propio (misma lógica que ya usan otros controllers inline, ej.
// adminController.createAdmin).
function validateCoordinates(latitude, longitude) {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return 'latitude y longitude son requeridos y deben ser números';
  }
  if (latitude < -90 || latitude > 90) {
    return 'latitude debe estar entre -90 y 90';
  }
  if (longitude < -180 || longitude > 180) {
    return 'longitude debe estar entre -180 y 180';
  }
  return null;
}

function validateRadius(radiusMeters) {
  if (radiusMeters === undefined || radiusMeters === null) return null; // usa el default del modelo (20)
  if (typeof radiusMeters !== 'number' || radiusMeters <= 0) {
    return 'radiusMeters debe ser un número positivo';
  }
  return null;
}

// ── RUTAS DE RONDA (PatrolRoute) ────────────────────────────────────────────
exports.createRoute = async (req, res) => {
  try {
    const { neighborhoodId, name, description } = req.body;
    if (!neighborhoodId || !name?.trim()) {
      return res.status(400).json({ error: 'neighborhoodId y name son obligatorios' });
    }

    const neighborhood = await Neighborhood.findByPk(neighborhoodId);
    if (!neighborhood) {
      return res.status(400).json({ error: 'El barrio indicado no existe' });
    }

    const route = await PatrolRoute.create({
      neighborhoodId,
      name: name.trim(),
      description,
    });
    res.status(201).json(route);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getRoutes = async (req, res) => {
  try {
    const { neighborhoodId } = req.query;
    const where = { isActive: true };
    if (neighborhoodId) where.neighborhoodId = neighborhoodId;

    const routes = await PatrolRoute.findAll({
      where,
      include: [{ association: 'neighborhood', attributes: ['id', 'name'] }],
      order: [['name', 'ASC']],
    });
    res.json(routes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Ruta + sus checkpoints (no filtra por isActive: permite ver/gestionar una
// ruta ya desactivada por id directo, igual que getSecurityProfile).
exports.getRoute = async (req, res) => {
  try {
    const { id } = req.params;
    const route = await PatrolRoute.findByPk(id, {
      include: [
        { association: 'neighborhood', attributes: ['id', 'name'] },
        { association: 'checkpoints' },
      ],
    });
    if (!route) return res.status(404).json({ error: 'Ruta no encontrada' });
    res.json(route);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateRoute = async (req, res) => {
  try {
    const { id } = req.params;
    const route = await PatrolRoute.findByPk(id);
    if (!route) return res.status(404).json({ error: 'Ruta no encontrada' });

    // isActive queda afuera a propósito: la desactivación tiene su propio
    // endpoint (deactivateRoute), mismo criterio que
    // updateSecurityStaff/updateNeighborhood.
    const allowedFields = ['name', 'description', 'neighborhoodId'];
    const updates = {};
    allowedFields.forEach((f) => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    if (updates.name !== undefined && !updates.name.trim()) {
      return res.status(400).json({ error: 'name no puede estar vacío' });
    }
    if (updates.neighborhoodId) {
      const neighborhood = await Neighborhood.findByPk(updates.neighborhoodId);
      if (!neighborhood) return res.status(400).json({ error: 'El barrio indicado no existe' });
    }

    await route.update(updates);
    res.json(route);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deactivateRoute = async (req, res) => {
  try {
    const { id } = req.params;
    const route = await PatrolRoute.findByPk(id);
    if (!route) return res.status(404).json({ error: 'Ruta no encontrada' });

    await route.update({ isActive: false });
    res.json({ message: 'Ruta desactivada correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── CHECKPOINTS (PatrolCheckpoint) ──────────────────────────────────────────
exports.createCheckpoint = async (req, res) => {
  try {
    const { id: patrolRouteId } = req.params;
    const route = await PatrolRoute.findByPk(patrolRouteId);
    if (!route) return res.status(404).json({ error: 'Ruta no encontrada' });

    const { name, latitude, longitude, radiusMeters } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ error: 'name es obligatorio' });
    }
    const coordError = validateCoordinates(latitude, longitude);
    if (coordError) return res.status(400).json({ error: coordError });
    const radiusError = validateRadius(radiusMeters);
    if (radiusError) return res.status(400).json({ error: radiusError });

    const payload = { patrolRouteId, name: name.trim(), latitude, longitude };
    if (radiusMeters !== undefined && radiusMeters !== null) payload.radiusMeters = radiusMeters;

    const checkpoint = await PatrolCheckpoint.create(payload);
    res.status(201).json(checkpoint);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateCheckpoint = async (req, res) => {
  try {
    const { id } = req.params;
    const checkpoint = await PatrolCheckpoint.findByPk(id);
    if (!checkpoint) return res.status(404).json({ error: 'Checkpoint no encontrado' });

    const { name, latitude, longitude, radiusMeters } = req.body;
    const updates = {};

    if (name !== undefined) {
      if (!name.trim()) return res.status(400).json({ error: 'name no puede estar vacío' });
      updates.name = name.trim();
    }
    if (latitude !== undefined || longitude !== undefined) {
      const lat = latitude !== undefined ? latitude : checkpoint.latitude;
      const lng = longitude !== undefined ? longitude : checkpoint.longitude;
      const coordError = validateCoordinates(lat, lng);
      if (coordError) return res.status(400).json({ error: coordError });
      updates.latitude = lat;
      updates.longitude = lng;
    }
    if (radiusMeters !== undefined) {
      const radiusError = validateRadius(radiusMeters);
      if (radiusError) return res.status(400).json({ error: radiusError });
      updates.radiusMeters = radiusMeters;
    }

    await checkpoint.update(updates);
    res.json(checkpoint);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteCheckpoint = async (req, res) => {
  try {
    const { id } = req.params;
    const checkpoint = await PatrolCheckpoint.findByPk(id);
    if (!checkpoint) return res.status(404).json({ error: 'Checkpoint no encontrado' });

    // Eliminación real (no hay isActive en PatrolCheckpoint) — a esta
    // altura no hay PatrolCheckpointVisit todavía (la ejecución de rondas
    // no está implementada), así que no hay riesgo de dejar huérfanos.
    await checkpoint.destroy();
    res.json({ message: 'Checkpoint eliminado correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
