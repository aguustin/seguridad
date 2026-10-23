const { Sequelize } = require('sequelize');
require('dotenv').config();

// DB_SSL=true habilita SSL con el certificado del proveedor sin validar la
// cadena completa (rejectUnauthorized: false) — es el modo que piden la
// mayoría de los Postgres administrados (RDS, Supabase, Neon, DigitalOcean
// managed DB, etc.) cuando no se les provee el CA público por separado. Para
// un Postgres propio en Docker Compose (misma red privada) no hace falta.
const sslOptions = process.env.DB_SSL === 'true'
  ? { ssl: { require: true, rejectUnauthorized: false } }
  : {};

const commonOptions = {
  dialect: 'postgres',
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
  dialectOptions: sslOptions,
};

// DATABASE_URL (formato postgres://user:pass@host:port/db) tiene prioridad
// si está definida — es como la mayoría de los hosts de Postgres
// administrados entregan la conexión. Si no está, se arma con las variables
// sueltas (DB_HOST/DB_NAME/etc.), que es como sigue funcionando el Docker
// Compose local de este proyecto.
const sequelize = process.env.DATABASE_URL
  ? new Sequelize(process.env.DATABASE_URL, commonOptions)
  : new Sequelize(
      process.env.DB_NAME,
      process.env.DB_USER,
      process.env.DB_PASSWORD,
      {
        ...commonOptions,
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
      }
    );

module.exports = sequelize;
