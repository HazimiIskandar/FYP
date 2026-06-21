const db = require('./config/db');
db.query('SHOW CREATE TABLE `User_Account`', (err, result) => {
  if (err) {
    console.error('ERR', err);
    process.exit(1);
  }
  console.log(result[0]['Create Table']);
  db.end();
});
