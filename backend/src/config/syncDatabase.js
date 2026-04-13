require('dotenv').config();
const { Client } = require('pg');
const sequelize = require('./database');
require('../models');

async function createDatabaseIfNotExists() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: 'postgres', // conectar a la DB por defecto para poder crear la nuestra
  });

  await client.connect();
  const dbName = process.env.DB_NAME;
  const result = await client.query(
    `SELECT 1 FROM pg_database WHERE datname = $1`, [dbName]
  );

  if (result.rowCount === 0) {
    await client.query(`CREATE DATABASE "${dbName}"`);
    console.log(`✅ Base de datos "${dbName}" creada.`);
  } else {
    console.log(`ℹ️  Base de datos "${dbName}" ya existe.`);
  }

  await client.end();
}

async function syncDatabase() {
  try {
    await createDatabaseIfNotExists();
    await sequelize.authenticate();
    console.log('✅ Conexión establecida.');
    await sequelize.sync({ alter: true });
    console.log('✅ Tablas sincronizadas correctamente.');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

syncDatabase();
