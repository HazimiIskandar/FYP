const express = require("express");
const router = express.Router();
const db = require("../config/db");


// CREATE NOK 
router.post("/", (req, res) => {

    const { full_name, relationship_to_senior, phone_number, email } = req.body;

    const sql = `
        INSERT INTO NOK
        (full_name, relationship_to_senior, phone_number, email)
        VALUES (?, ?, ?, ?)
    `;

    db.query(
        sql,
        [full_name, relationship_to_senior, phone_number, email],
        (err) => {
            if (err) return res.send(err);

            res.send("NOK created successfully");
        }
    );
});


// GET ALL NOK 
router.get("/", (req, res) => {

    const sql = `
        SELECT * FROM NOK
    `;

    db.query(sql, (err, result) => {
        if (err) return res.send(err);

        res.json(result);
    });
});


// LINK NOK TO SENIOR 
router.post("/link", (req, res) => {

    const { senior_id, nok_id } = req.body;

    const sql = `
        INSERT INTO Senior_has_NOK
        (senior_id, nok_id)
        VALUES (?, ?)
    `;

    db.query(sql, [senior_id, nok_id], (err) => {
        if (err) return res.send(err);

        res.send("NOK linked to Senior successfully");
    });
});


// GET NOK BY SENIOR 
router.get("/senior/:senior_id", (req, res) => {

    const sql = `
        SELECT n.*
        FROM NOK n
        JOIN Senior_has_NOK sn
        ON n.nok_id = sn.nok_id
        WHERE sn.senior_id = ?
    `;

    db.query(sql, [req.params.senior_id], (err, result) => {
        if (err) return res.send(err);

        res.json(result);
    });
});

router.put('/:nok_id', (req, res) => {
  const { full_name, relationship_to_senior, phone_number, email } = req.body;
  const nokId = req.params.nok_id;

  const fields = [];
  const params = [];

  if (full_name !== undefined) {
    fields.push('full_name = ?');
    params.push(full_name);
  }
  if (relationship_to_senior !== undefined) {
    fields.push('relationship_to_senior = ?');
    params.push(relationship_to_senior);
  }
  if (phone_number !== undefined) {
    fields.push('phone_number = ?');
    params.push(phone_number);
  }
  if (email !== undefined) {
    fields.push('email = ?');
    params.push(email);
  }

  if (!fields.length) {
    return res.status(400).json({ error: 'No NOK fields to update.' });
  }

  const sql = `UPDATE NOK SET ${fields.join(', ')} WHERE nok_id = ?`;
  params.push(nokId);

  db.query(sql, params, (err) => {
    if (err) return res.status(500).json({ error: err.message || err });
    res.json({ message: 'NOK updated successfully' });
  });
});

router.delete('/:nok_id', (req, res) => {
  const nokId = req.params.nok_id;

  const unlinkSql = `DELETE FROM Senior_has_NOK WHERE nok_id = ?`;
  const deleteSql = `DELETE FROM NOK WHERE nok_id = ?`;

  db.query(unlinkSql, [nokId], (unlinkErr) => {
    if (unlinkErr) return res.status(500).json({ error: unlinkErr.message || unlinkErr });

    db.query(deleteSql, [nokId], (deleteErr) => {
      if (deleteErr) return res.status(500).json({ error: deleteErr.message || deleteErr });
      res.json({ message: 'NOK deleted successfully' });
    });
  });
});

module.exports = router;