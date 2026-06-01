const mysql = require("mysql2");

// Create connection pool with reduced size (respecting max_user_connections limit of 5)
const db = mysql.createPool({
  host: "cplofo.h.filess.io",
  user: "senior_connect_curiousago",
  password: "fe9c8311734fbb029d7fec8b715366ee54ec0751",
  database: "senior_connect_curiousago",
  port: 61032,
  waitForConnections: true,
  connectionLimit: 3,  // REDUCED: was 10, now 3 (respects max_user_connections=5)
  queueLimit: 0,
  enableKeepAlive: true,
  idleTimeout: 60000,  // close idle connections after 1 minute
  maxIdle: 3
});

// Test connection
db.getConnection((err, connection) => {
  if (err) {
    if (err.code === 'PROTOCOL_CONNECTION_LOST') {
      console.error('❌ Database connection lost');
    } else if (err.code === 'ER_CON_COUNT_ERROR') {
      console.error('❌ Database has too many connections');
    } else if (err.code === 'ER_AUTHENTICATION_PLUGIN_ERROR') {
      console.error('❌ Database authentication failed');
    } else if (err.code === 'ER_USER_LIMIT_REACHED') {
      console.error('❌ User connection limit exceeded - too many connections open');
    } else {
      console.error('❌ Database connection error:', err.message);
    }
    return;
  }
  if (connection) {
    console.log("✅ MySQL Connected with Pool (max 3 connections)");
    connection.release();
  }
});

// Export the pool for use in routes
module.exports = db;