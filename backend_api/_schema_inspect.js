const db = require('./config/db');

db.query('SHOW TABLES', (err, results) => {
  if (err) {
    console.error('SHOW TABLES ERR', err);
    process.exit(1);
  }
  const tables = results.map((row) => Object.values(row)[0]);
  console.log('TABLES:');
  console.log(tables.join('\n'));

  const targets = tables.filter((name) => /caregiver|senior/i.test(name));
  if (!targets.length) {
    db.end();
    return;
  }

  let pending = targets.length;
  targets.forEach((table) => {
    db.query(`SHOW CREATE TABLE \`${table}\``, (err2, res2) => {
      if (err2) {
        console.error('ERR SHOW CREATE TABLE', table, err2);
      } else {
        console.log(`\nCREATE TABLE ${table}:\n` + res2[0]['Create Table']);
      }
      if (!--pending) db.end();
    });
  });
});
