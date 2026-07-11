// One-off diagnostic: confirms that the auto-migration in
// backend_api/routes/userAccountRoutes.js actually added the
// User_Account.preferred_language column to the running MySQL instance,
// and dumps a few rows so you can sanity-check that registrations /
// SeniorHomeScreen language-modal picks are landing in the DB.
//
// Run from the backend_api/ directory:
//   node _inspect_preferred_language.js
//
// Mirrors the q()-promise + IIFE + finally/db.end pattern used in
// _inspect_db_rows.js so anyone familiar with the sibling scripts will
// recognise the shape instantly.
const db = require('./config/db');

const q = (sql) =>
  new Promise((resolve, reject) =>
    db.query(sql, (err, rows) => (err ? reject(err) : resolve(rows)))
  );

(async () => {
  try {
    console.log('--- preferred_language column verification ---\n');

    // 1. Confirm the column actually exists after the auto-migration.
    const cols = await q("SHOW COLUMNS FROM User_Account LIKE 'preferred_language'");
    console.log("--- SHOW COLUMNS FROM User_Account LIKE 'preferred_language' ---");
    console.log(JSON.stringify(cols, null, 2));

    if (!cols.length) {
      console.log(
        '\nX COLUMN preferred_language IS MISSING FROM User_Account.\n' +
          '  -> Restart the backend_api server; the module-load\n' +
          '     migration in routes/userAccountRoutes.js will add it.\n' +
          '  -> Expected schema after migration:\n' +
          '     preferred_language VARCHAR(8) NULL DEFAULT NULL'
      );
      return;
    }

    console.log('\nOK Column exists. Compare against expected schema: VARCHAR(8) NULL DEFAULT NULL');

    // 2. Distribution of stored values — lets you confirm registrations
    //    captured the locale and modal selections are saving.
    const stats = await q(
      'SELECT preferred_language, COUNT(*) AS user_count ' +
        'FROM User_Account ' +
        'GROUP BY preferred_language ' +
        'ORDER BY user_count DESC'
    );
    console.log('\n--- value distribution across User_Account ---');
    console.log(JSON.stringify(stats, null, 2));

    // 3. Most-recent sign-ins with a non-null language. If you just
    //    tested the flow (register/logout/login), your user should
    //    show up here.
    const sample = await q(
      'SELECT user_id, full_name, email, preferred_language, last_login ' +
        'FROM User_Account ' +
        'WHERE preferred_language IS NOT NULL ' +
        'ORDER BY last_login DESC, user_id DESC ' +
        'LIMIT 20'
    );
    console.log('\n--- sample users with a saved language ---');
    console.log(JSON.stringify(sample, null, 2));

    if (!sample.length) {
      console.log('(no users have picked a language yet — expected on a fresh deploy)');
    }

    // 4. Sanity check: any rows where the column was written with
    //    something outside the allowlist? The server rejects these in
    //    PUT /users/:id/language, so any hit here is worth inspecting.
    const invalid = await q(
      "SELECT user_id, full_name, email, preferred_language " +
        "FROM User_Account " +
        "WHERE preferred_language IS NOT NULL " +
        "AND preferred_language NOT IN ('en','zh','ms','ta')"
    );
    console.log('\n--- rows outside the en/zh/ms/ta allowlist ---');
    console.log(JSON.stringify(invalid, null, 2));

    if (!invalid.length) {
      console.log('\nOK all stored values fall inside the en/zh/ms/ta allowlist.');
    }
  } catch (err) {
    console.error('VERIFY FAILED:', err);
  } finally {
    db.end();
  }
})();
