require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const sequelize = require('./config/database');
require('./models'); // cargar asociaciones
const { initSocket } = require('./services/socketService');
const { loadModels } = require('./services/faceService');
const checkinService = require('./services/checkinService');

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

    // Intentar cargar modelos de reconocimiento facial (no bloquea si falla)
    const faceModelsLoaded = await loadModels();
    if (faceModelsLoaded) {
      console.log('✅ Modelos de reconocimiento facial cargados');
    } else {
      console.warn('⚠️  Modelos de reconocimiento facial no disponibles');
      console.warn('   Para activarlos: npm run download-models');
    }

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
