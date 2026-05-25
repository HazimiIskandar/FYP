const db = require("../config/db");

// link NOK to senior
const linkNOKToSenior = (senior_id, nok_id) => {

    const sql = `
        INSERT INTO Senior_has_NOK
        (senior_id, nok_id)
        VALUES (?, ?)
    `;

    db.query(sql, [senior_id, nok_id], (err) => {
        if (err) console.log(err);
        else console.log("NOK linked to senior");
    });
};

module.exports = {
    linkNOKToSenior
};