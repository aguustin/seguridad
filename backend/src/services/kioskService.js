/**
 * kioskService.js
 *
 * Estado global de apertura/cierre del kiosco de acceso (fila única,
 * ver models/KioskState.js). Se centraliza acá el get-or-create del
 * singleton para que ningún controller tenga que reimplementarlo — lo usan
 * tanto el endpoint público (kiosco sin sesión) como los endpoints de admin.
 */
const { KioskState } = require('../models');

const SINGLETON_ID = 1;

async function getState() {
  const [state] = await KioskState.findOrCreate({
    where: { id: SINGLETON_ID },
    defaults: { isOpen: false },
  });
  return state;
}

async function setOpen(isOpen, adminId) {
  const state = await getState();
  await state.update({ isOpen, updatedByAdminId: adminId });
  return state;
}

module.exports = { getState, setOpen };
