require('dotenv').config();
const { Sequelize } = require('sequelize');

let sequelize;

if (process.env.DATABASE_URL) {
  // Use DATABASE_URL for production (like Render.com)
  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    logging: console.log, // Set to false to disable SQL logging
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    }
  });
} else {
  // Use individual environment variables for development
  const {
    DB_HOST: host,
    DB_PORT: port,
    DB_USER: username,
    DB_PASSWORD: password,
    DB_NAME: database
  } = process.env;

  sequelize = new Sequelize(database, username, password, {
    host,
    port,
    dialect: 'postgres',
    logging: console.log, // Set to false to disable SQL logging
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    dialectOptions: {
      ssl: process.env.NODE_ENV === 'production'
        ? { require: true, rejectUnauthorized: false }
        : false
    }
  });
}

// Test the connection
const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('Connection to the database has been established successfully.');
    
    // Sync all models (create tables if they don't exist)
    await sequelize.sync({ alter: true }); // Use { force: true } to drop and recreate tables
    console.log('Database synchronized successfully.');
  } catch (error) {
    console.error('Unable to connect to the database:', error);
  }
};

module.exports = { sequelize, connectDB };