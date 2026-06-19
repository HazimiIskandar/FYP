const db = require("../config/db");

// create user account
const createUser = (data) => {

    const sql = `
        INSERT INTO User_Account
        (name, phone_number, role, email)
        VALUES (?, ?, ?, ?)
    `;

    db.query(sql, [
        data.name,
        data.phone_number,
        data.role,
        data.email,
    ], (err) => {
        if (err) console.log(err);
        else console.log("User created");
    });
};

module.exports = {
    createUser
};