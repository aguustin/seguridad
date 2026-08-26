require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const sequelize = require('./config/database');
require('./models'); // cargar asociaciones
const { initSocket } = require('./services/socketService');
const { loadModels } = require('./services/faceService');
const checkinService = require('./services/checkinService');
const reminderService = require('./services/reminderService');

const PORT = process.env.PORT || 3000;

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

app.set('io', io);
initSocket(io);
checkinService.init(io);
reminderService.init();

async function start() {
  try {
    await sequelize.authenticate();
    console.log('✅ Base de datos conectada');

    await sequelize.sync({ alter: true }); // agrega columnas nuevas sin borrar datos
    console.log('✅ Modelos sincronizados');

    // Limpiar estado de conexión del arranque anterior
    // (si el servidor crasheó, los guards pueden haber quedado isOnDuty: true)
    const { SecurityStaff } = require('./models');
    await SecurityStaff.update({ isOnDuty: false }, { where: { isOnDuty: true } });
    console.log('✅ Estado de guardias reiniciado');

    // Arrancar el worker de reconocimiento facial (warm-up). Los modelos de
    // face-api vienen empaquetados dentro de node_modules/@vladmandic/face-api,
    // así que no hace falta descargar ni configurar nada aparte.
    await loadModels();
    console.log('✅ Worker de reconocimiento facial iniciado');

    httpServer.listen(PORT, () => {
      console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
      console.log(`📡 Socket.IO activo`);
    });
  } catch (err) {
    console.error('❌ Error al iniciar el servidor:', err);
    process.exit(1);
  }
}

start();
