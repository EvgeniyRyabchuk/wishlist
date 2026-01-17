require('dotenv').config(); // Load environment variables

// For Render.com, DATABASE_URL is provided as an environment variable
const parseDatabaseUrl = (databaseUrl) => {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not defined');
  }

  const url = new URL(databaseUrl);
  return {
    username: url.username,
    password: url.password,
    database: url.pathname.split('/')[1],
    host: url.hostname,
    port: url.port,
  };
};

let dbConfig = {
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
};

// If DATABASE_URL is available (Render.com), parse it
if (process.env.DATABASE_URL) {
  dbConfig = { ...dbConfig, ...parseDatabaseUrl(process.env.DATABASE_URL) };
}

module.exports = {
  production: {
    username: dbConfig.username,
    password: dbConfig.password,
    database: dbConfig.database,
    host: dbConfig.host,
    port: dbConfig.port,
    dialect: 'postgres',
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    },
    // Additional options for production
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
};