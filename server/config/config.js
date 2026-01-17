require('dotenv').config(); // Load environment variables

// Function to parse DATABASE_URL
const parseDatabaseUrl = (databaseUrl) => {
  if (!databaseUrl) {
    return null;
  }

  const url = new URL(databaseUrl);
  return {
    username: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.split('/')[1],
    host: url.hostname,
    port: url.port,
  };
};

// Determine configuration based on environment and available variables
let dbConfig = {
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
};

// If DATABASE_URL is available (production environments like Render), parse it
if (process.env.DATABASE_URL) {
  const parsed = parseDatabaseUrl(process.env.DATABASE_URL);
  if (parsed) {
    dbConfig = { ...dbConfig, ...parsed };
  }
}

module.exports = {
  development: {
    username: dbConfig.username || process.env.DB_USER,
    password: dbConfig.password || process.env.DB_PASSWORD,
    database: dbConfig.database || process.env.DB_NAME,
    host: dbConfig.host || process.env.DB_HOST,
    port: dbConfig.port || process.env.DB_PORT,
    dialect: 'postgres',
    logging: console.log // Change to false to disable SQL logging
  },
  test: {
    username: dbConfig.username || process.env.DB_USER,
    password: dbConfig.password || process.env.DB_PASSWORD,
    database: `${dbConfig.database || process.env.DB_NAME}_test`,
    host: dbConfig.host || process.env.DB_HOST,
    port: dbConfig.port || process.env.DB_PORT,
    dialect: 'postgres'
  },
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
    }
  }
};