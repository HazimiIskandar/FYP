const mysql = require("mysql2");

const db = mysql.createPool({
  host: "cplofo.h.filess.io",
  user: "senior_connect_curiousago",
  password: "fe9c8311734fbb029d7fec8b715366ee54ec0751",
  database: "senior_connect_curiousago",
  port: 61032,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelayMs: 0
});

db.getConnection((err, connection) => {
  if (err) {
    if (err.code === 'PROTOCOL_CONNECTION_LOST') {
      console.error('❌ Database connection lost');
    }
    if (err.code === 'ER_CON_COUNT_ERROR') {
      console.error('❌ Database has too many connections');
    }
    if (err.code === 'ER_AUTHENTICATION_PLUGIN_ERROR') {
      console.error('❌ Database authentication failed');
    }
    return;
  }
  if (connection) {
    connection.release();
    console.log("✅ MySQL Connected with Pool");
  }
});

module.exports = db;