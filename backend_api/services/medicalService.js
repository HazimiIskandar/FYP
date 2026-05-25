const db = require("../config/db");

// assign condition to senior
const assignMedicalCondition = (senior_id, condition_id) => {

    const sql = `
        INSERT INTO Senior_Medical_Condition
        (senior_id, condition_id)
        VALUES (?, ?)
    `;

    db.query(sql, [senior_id, condition_id], (err) => {
        if (err) console.log(err);
        else console.log("Medical condition assigned");
    });
};

module.exports = {
    assignMedicalCondition
};