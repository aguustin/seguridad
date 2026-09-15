/**
 * Script de datos de prueba (mock) para testear la app completa sin tener
 * que cargar todo a mano desde la UI: barrios, guardias, clientes, rondas
 * (rutas + checkpoints + sesiones), asignaciones, alertas, visitas e
 * invitaciones de visita.
 *
 * Uso:
 *   cd backend
 *   node scripts/seed.js
 *
 * Es idempotente: si detecta que ya se corrió antes (busca un guardia con
 * documentNumber que empieza con "MOCK-"), no vuelve a crear nada — así se
 * puede correr de nuevo sin miedo a duplicar todo. Para volver a generar
 * desde cero, borrar manualmente los registros con ese prefijo primero.
 *
 * LIMITACIÓN CONOCIDA: los guardias mock no tienen foto ni faceDescriptor
 * real (no hay fotos reales para procesar con face-api), así que en la app
 * van a figurar sin foto y con "Procesando facial..." para siempre — es
 * esperable, no es un bug. Sirven igual para testear listados, asignaciones,
 * rondas, alertas, etc. Si necesitás probar el check-in facial real, hay
 * que registrar al menos un guardia de verdad desde la app con una foto real
 * (como ya se hizo con el guardia de prueba existente).
 */
const sequelize = require('../src/config/database');
const {
  Admin,
  Neighborhood,
  SecurityStaff,
  Client,
  Alert,
  PatrolRoute,
  PatrolCheckpoint,
  PatrolSession,
  PatrolCheckpointVisit,
  Assignment,
  Visit,
  VisitInvitation,
  AttendanceRecord,
} = require('../src/models');

const MOCK_PREFIX = 'MOCK-';

async function main() {
  await sequelize.authenticate();

  const already = await SecurityStaff.findOne({
    where: { documentNumber: { [require('sequelize').Op.like]: `${MOCK_PREFIX}%` } },
  });
  if (already) {
    console.log('⚠️  Ya existe data mock (encontrado guardia con documentNumber MOCK-*).');
    console.log('   No se vuelve a crear nada. Si querés regenerarla, borrá manualmente');
    console.log('   los registros con ese prefijo primero.');
    process.exit(0);
  }

  const admin = await Admin.findOne();
  if (!admin) {
    console.log('❌ No hay ningún admin creado todavía. Creá el primer admin');
    console.log('   (POST /api/auth/admin/register — ver README.md) antes de correr el seed.');
    process.exit(1);
  }

  console.log('🌱 Creando barrios...');
  const neighborhoods = await Neighborhood.bulkCreate([
    {
      name: 'Vista Verde',
      address: 'Av. Libertador 4500, Buenos Aires',
      description: 'Barrio cerrado con acceso principal y secundario.',
      latitude: -34.5417,
      longitude: -58.4622,
    },
    {
      name: 'Los Aromos',
      address: 'Ruta 8 km 45, Pilar',
      description: 'Countryside con circuito de rondas perimetral.',
      latitude: -34.4586,
      longitude: -58.9145,
    },
    {
      name: 'El Mirador',
      address: 'Camino Real 1200, Escobar',
      description: 'Barrio con lago artificial y club house.',
      latitude: -34.3489,
      longitude: -58.7935,
    },
  ], { returning: true });
  const [vistaVerde, losAromos, elMirador] = neighborhoods;
  console.log(`   ✔ ${neighborhoods.length} barrios creados`);

  console.log('🌱 Creando guardias...');
  const guardsData = [
    { firstName: 'Carlos', lastName: 'Gómez', documentNumber: `${MOCK_PREFIX}30111222`, age: 34, neighborhoodId: vistaVerde.id, shiftStart: '06:00', shiftEnd: '14:00', paymentDay: 10, salary: 350000, contact: '1155501001', isOnDuty: true, isOperator: true },
    { firstName: 'Miguel', lastName: 'Fernández', documentNumber: `${MOCK_PREFIX}30111223`, age: 41, neighborhoodId: vistaVerde.id, shiftStart: '14:00', shiftEnd: '22:00', paymentDay: 10, salary: 350000, contact: '1155501002', isOnDuty: false },
    { firstName: 'Roberto', lastName: 'Silva', documentNumber: `${MOCK_PREFIX}30111224`, age: 29, neighborhoodId: losAromos.id, shiftStart: '22:00', shiftEnd: '06:00', paymentDay: 10, salary: 380000, contact: '1155501003', isOnDuty: true },
    { firstName: 'Diego', lastName: 'Martínez', documentNumber: `${MOCK_PREFIX}30111225`, age: 37, neighborhoodId: losAromos.id, shiftStart: '06:00', shiftEnd: '14:00', paymentDay: 10, salary: 350000, contact: '1155501004', isOnDuty: false },
    { firstName: 'Javier', lastName: 'López', documentNumber: `${MOCK_PREFIX}30111226`, age: 45, neighborhoodId: elMirador.id, shiftStart: '14:00', shiftEnd: '22:00', paymentDay: 10, salary: 360000, contact: '1155501005', isOnDuty: true },
    { firstName: 'Sergio', lastName: 'Rodríguez', documentNumber: `${MOCK_PREFIX}30111227`, age: 31, neighborhoodId: elMirador.id, shiftStart: '22:00', shiftEnd: '06:00', paymentDay: 10, salary: 380000, contact: '1155501006', isOnDuty: false },
  ];
  const guards = await SecurityStaff.bulkCreate(guardsData, { returning: true });
  console.log(`   ✔ ${guards.length} guardias creados (sin foto/facial — ver nota arriba)`);

  console.log('🌱 Creando clientes...');
  const clientsPlain = [
    { username: 'mock.perez',   password: 'Cliente123!', firstName: 'Ana',     lastName: 'Pérez',    age: 38, neighborhoodId: vistaVerde.id, contact: '1155502001', locationSharingEnabled: true },
    { username: 'mock.garcia',  password: 'Cliente123!', firstName: 'Luis',    lastName: 'García',   age: 52, neighborhoodId: vistaVerde.id, contact: '1155502002', locationSharingEnabled: false },
    { username: 'mock.torres',  password: 'Cliente123!', firstName: 'Marta',   lastName: 'Torres',   age: 29, neighborhoodId: losAromos.id,  contact: '1155502003', locationSharingEnabled: true },
    { username: 'mock.romero',  password: 'Cliente123!', firstName: 'Pablo',   lastName: 'Romero',   age: 61, neighborhoodId: losAromos.id,  contact: '1155502004', locationSharingEnabled: false },
    { username: 'mock.sosa',    password: 'Cliente123!', firstName: 'Valeria', lastName: 'Sosa',     age: 44, neighborhoodId: elMirador.id,  contact: '1155502005', locationSharingEnabled: true },
    { username: 'mock.diaz',    password: 'Cliente123!', firstName: 'Nicolás', lastName: 'Díaz',     age: 33, neighborhoodId: elMirador.id,  contact: '1155502006', locationSharingEnabled: false },
  ];
  // bulkCreate no dispara hooks individuales de instancia por defecto salvo
  // que se pida explícitamente — el hook beforeCreate que hashea la
  // password sí corre con bulkCreate mientras individualHooks:true.
  const clients = await Client.bulkCreate(clientsPlain, { returning: true, individualHooks: true });
  console.log(`   ✔ ${clients.length} clientes creados (todos con password: Cliente123!)`);

  console.log('🌱 Creando rutas de ronda + checkpoints...');
  const route1 = await PatrolRoute.create({ neighborhoodId: vistaVerde.id, name: 'Perímetro Vista Verde', description: 'Recorrido completo del perímetro exterior.' });
  const route2 = await PatrolRoute.create({ neighborhoodId: losAromos.id, name: 'Circuito Los Aromos', description: 'Recorrido por los sectores A, B y C.' });

  const checkpoints1 = await PatrolCheckpoint.bulkCreate([
    { patrolRouteId: route1.id, name: 'Portón principal', latitude: -34.5415, longitude: -58.4620, radiusMeters: 25 },
    { patrolRouteId: route1.id, name: 'Portón secundario', latitude: -34.5430, longitude: -58.4635, radiusMeters: 25 },
    { patrolRouteId: route1.id, name: 'Club house',        latitude: -34.5420, longitude: -58.4610, radiusMeters: 20 },
  ], { returning: true });
  const checkpoints2 = await PatrolCheckpoint.bulkCreate([
    { patrolRouteId: route2.id, name: 'Garita norte', latitude: -34.4580, longitude: -58.9140, radiusMeters: 25 },
    { patrolRouteId: route2.id, name: 'Garita sur',   latitude: -34.4595, longitude: -58.9155, radiusMeters: 25 },
  ], { returning: true });
  console.log(`   ✔ 2 rutas, ${checkpoints1.length + checkpoints2.length} checkpoints`);

  console.log('🌱 Creando sesiones de ronda...');
  const now = Date.now();
  const completedSession = await PatrolSession.create({
    securityStaffId: guards[0].id,
    patrolRouteId: route1.id,
    startedAt: new Date(now - 3 * 60 * 60 * 1000),
    endedAt: new Date(now - 2.5 * 60 * 60 * 1000),
    status: 'completed',
  });
  const inProgressSession = await PatrolSession.create({
    securityStaffId: guards[2].id,
    patrolRouteId: route2.id,
    startedAt: new Date(now - 20 * 60 * 1000),
    status: 'in_progress',
  });
  await PatrolCheckpointVisit.bulkCreate([
    { patrolSessionId: completedSession.id, patrolCheckpointId: checkpoints1[0].id, visitedAt: new Date(now - 3 * 60 * 60 * 1000 + 5 * 60 * 1000), method: 'gps' },
    { patrolSessionId: completedSession.id, patrolCheckpointId: checkpoints1[1].id, visitedAt: new Date(now - 3 * 60 * 60 * 1000 + 15 * 60 * 1000), method: 'qr' },
    { patrolSessionId: completedSession.id, patrolCheckpointId: checkpoints1[2].id, visitedAt: new Date(now - 3 * 60 * 60 * 1000 + 25 * 60 * 1000), method: 'gps' },
    { patrolSessionId: inProgressSession.id, patrolCheckpointId: checkpoints2[0].id, visitedAt: new Date(now - 10 * 60 * 1000), method: 'gps' },
  ]);
  console.log('   ✔ 1 ronda completada (con 3 checkpoints visitados), 1 en curso (1 checkpoint visitado)');

  console.log('🌱 Creando asignaciones...');
  await Assignment.bulkCreate([
    { neighborhoodId: vistaVerde.id, securityStaffId: guards[1].id, assignedByAdminId: admin.id, title: 'Revisar portón trasero', description: 'Reportaron que no cierra bien.', status: 'pending' },
    { neighborhoodId: losAromos.id,  securityStaffId: guards[3].id, assignedByAdminId: admin.id, title: 'Control de luces perimetrales', status: 'completed', completedAt: new Date(now - 60 * 60 * 1000) },
    { neighborhoodId: elMirador.id,  securityStaffId: guards[4].id, assignedByAdminId: admin.id, title: 'Verificar cámara sector lago', description: 'Se reportó imagen cortada.', status: 'pending' },
  ]);
  console.log('   ✔ 3 asignaciones (2 pending, 1 completed)');

  console.log('🌱 Creando alertas...');
  await Alert.bulkCreate([
    {
      type: 'client_emergency', title: 'Emergencia', message: 'Botón de pánico activado',
      senderId: clients[0].id, senderType: 'client',
      targetNeighborhoodId: vistaVerde.id,
      clientLatitude: -34.5417, clientLongitude: -58.4622,
      isRead: false,
    },
    {
      type: 'guard_alert', title: 'Movimiento sospechoso', message: 'Persona no identificada cerca del portón secundario',
      reason: 'Vehículo desconocido estacionado 20 min sin moverse',
      senderId: guards[1].id, senderType: 'security',
      targetNeighborhoodId: vistaVerde.id,
      isRead: true, resolvedAt: new Date(now - 30 * 60 * 1000),
    },
    {
      type: 'admin_to_security', title: 'Aviso general', message: 'Recuerden registrar cada checkpoint por GPS o QR',
      senderId: admin.id, senderType: 'admin',
      targetNeighborhoodId: losAromos.id,
      isRead: false,
    },
  ]);
  console.log('   ✔ 3 alertas (1 emergencia sin leer, 1 de guardia resuelta, 1 aviso de admin)');

  console.log('🌱 Creando visitas...');
  await Visit.bulkCreate([
    {
      neighborhoodId: vistaVerde.id, registeredByStaffId: guards[0].id,
      destinationClientId: clients[0].id, visitorName: 'Fernando Acosta', visitorDocument: '28555111',
      vehiclePlate: 'AB123CD', entryAt: new Date(now - 90 * 60 * 1000),
    },
    {
      neighborhoodId: vistaVerde.id, registeredByStaffId: guards[0].id,
      destinationClientId: clients[1].id, visitorName: 'Camila Ruiz', visitorDocument: '31222444',
      entryAt: new Date(now - 4 * 60 * 60 * 1000), exitAt: new Date(now - 3 * 60 * 60 * 1000),
    },
    {
      neighborhoodId: losAromos.id, registeredByStaffId: guards[2].id,
      destinationDescription: 'Técnico de gas — medidor sector B', visitorName: 'Técnico Metrogas',
      entryAt: new Date(now - 45 * 60 * 1000),
    },
  ]);
  console.log('   ✔ 3 visitas (1 adentro sin destino de cuenta, 1 ya salió, 1 en curso)');

  console.log('🌱 Creando invitación de visita...');
  await VisitInvitation.create({
    neighborhoodId: elMirador.id,
    createdByClientId: clients[4].id,
    visitorName: 'Familia Invitada (evento)',
    expiresAt: new Date(now + 24 * 60 * 60 * 1000),
  });
  console.log('   ✔ 1 invitación de visita pendiente de usar (QR)');

  console.log('🌱 Creando historial de asistencia...');
  await AttendanceRecord.bulkCreate([
    { securityStaffId: guards[0].id, neighborhoodId: vistaVerde.id, checkIn: new Date(now - 8 * 60 * 60 * 1000), checkOut: new Date(now - 2 * 60 * 60 * 1000), checkInDelayMinutes: 0 },
    { securityStaffId: guards[0].id, neighborhoodId: vistaVerde.id, checkIn: new Date(now - 32 * 60 * 60 * 1000), checkOut: new Date(now - 24 * 60 * 60 * 1000), checkInDelayMinutes: 12 },
    { securityStaffId: guards[2].id, neighborhoodId: losAromos.id, checkIn: new Date(now - 20 * 60 * 1000), checkInDelayMinutes: 0 }, // sigue en turno
  ]);
  console.log('   ✔ 3 registros de asistencia (2 cerrados, 1 en curso)');

  console.log('\n✅ Listo. Resumen:');
  console.log(`   Barrios: ${neighborhoods.map((n) => n.name).join(', ')}`);
  console.log(`   Guardias: ${guards.length} (documentNumber con prefijo ${MOCK_PREFIX})`);
  console.log(`   Clientes: ${clients.length} — usuario/contraseña de todos:`);
  clientsPlain.forEach((c) => console.log(`     - ${c.username} / Cliente123!`));
  console.log('\n   Recordá: los guardias mock no tienen foto real, van a figurar');
  console.log('   "Procesando facial..." siempre — es esperable, no es un bug.');

  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Error corriendo el seed:', err);
  process.exit(1);
});
