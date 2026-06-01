const mysql = require("mysql2");

// ============================================
// POOL CONFIGURATION
// ============================================
const pool = mysql.createPool({
  host: "cplofo.h.filess.io",
  user: "senior_connect_curiousago",
  password: "fe9c8311734fbb029d7fec8b715366ee54ec0751",
  database: "senior_connect_curiousago",
  port: 61032,
  waitForConnections: true,
  connectionLimit: 3,
  queueLimit: 10,  // queue up to 10 requests
  enableKeepAlive: true,
  idleTimeout: 60000,
  maxIdle: 3
});

// ============================================
// ENHANCED QUERY WRAPPER WITH RETRY LOGIC
// ============================================
const queryWithRetry = (sql, params = [], retries = 3, delay = 500) => {
  return new Promise((resolve, reject) => {
    const attempt = (retriesLeft) => {
      pool.query(sql, params, (err, results) => {
        // Success
        if (!err) {
          return resolve(results);
        }

        // Don't retry on certain errors
        if (err.code === 'ER_AUTHENTICATION_PLUGIN_ERROR' || 
            err.code === 'ER_ACCESS_DENIED_ERROR' ||
            err.code === 'ER_BAD_FIELD_ERROR' ||
            err.code === 'ER_NO_SUCH_TABLE') {
          return reject(err);
        }

        // Retry on connection errors
        if (retriesLeft > 0 && 
            (err.code === 'PROTOCOL_CONNECTION_LOST' ||
             err.code === 'PROTOCOL_PACKETS_OUT_OF_ORDER' ||
             err.code === 'ER_USER_LIMIT_REACHED' ||
             err.code === 'ECONNREFUSED' ||
             err.code === 'ETIMEDOUT' ||
             err.message.includes('too many connections'))) {
          
          console.warn(`⚠️  Query retry attempt ${4 - retriesLeft}/${3} after ${delay}ms...`);
          setTimeout(() => attempt(retriesLeft - 1), delay);
          return;
        }

        // No retry for other errors
        reject(err);
      });
    };

    attempt(retries);
  });
};

// ============================================
// CONNECTION MONITORING
// ============================================
pool.on('acquire', (connection) => {
  console.log(`📊 Connection acquired (pool size: ${pool._allConnections?.length || 'unknown'})`);
});

pool.on('release', (connection) => {
  console.log(`📊 Connection released (pool size: ${pool._allConnections?.length || 'unknown'})`);
});

pool.on('error', (err) => {
  console.error('❌ Pool error:', err.message);
});

// ============================================
// INITIAL CONNECTION TEST
// ============================================
pool.getConnection((err, connection) => {
  if (err) {
    console.error('❌ Database connection error:', err.message);
    return;
  }
  if (connection) {
    console.log("✅ MySQL Connected (Pool: 3 connections max, respects DB limit)");
    connection.release();
  }
});

// ============================================
// EXPORTS
// ============================================
module.exports = {
  pool,
  // Promisified query with retry logic
  query: queryWithRetry,
  // Callback-based for backward compatibility
  queryCallback: (sql, params, callback) => {
    queryWithRetry(sql, params)
      .then((results) => callback(null, results))
      .catch((err) => callback(err, null));
  }
};
