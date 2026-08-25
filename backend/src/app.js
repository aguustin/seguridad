require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Servir archivos estáticos (fotos de perfil)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Rutas
app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/security', require('./routes/security'));
app.use('/api/client', require('./routes/client'));
app.use('/api/kiosk', require('./routes/kiosk'));
app.use('/api/admin/patrol', require('./routes/patrol'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

// Manejo de errores
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || 'Error interno del servidor' });
});

module.exports = app;
