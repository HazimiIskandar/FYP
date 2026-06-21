const db = require('./config/db');
const q = (sql, params = []) => new Promise((resolve, reject) => db.query(sql, params, (err, rows) => err ? reject(err) : resolve(rows)));
(async () => {
  try {
    const queries = [
      'SELECT COUNT(*) AS user_count FROM User_Account',
      'SELECT COUNT(*) AS senior_count FROM Senior',
      'SELECT senior_id, user_id FROM Senior LIMIT 20',
      'SELECT user_id, full_name, role_id, role, email FROM User_Account LIMIT 20',
      'SELECT s.senior_id, s.user_id, u.full_name, u.role_id, u.role, u.email FROM Senior s LEFT JOIN User_Account u ON s.user_id = u.user_id LIMIT 20'
    ];
    for (const sql of queries) {
      console.log('--- ' + sql + ' ---');
      const rows = await q(sql);
      console.log(JSON.stringify(rows, null, 2));
    }
  } catch (err) {
    console.error(err);
  } finally {
    db.end();
  }
})();
