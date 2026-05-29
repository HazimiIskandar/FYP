const axios = require("axios");


// WORKFLOW
const triggerServiceNowWorkflow = (
    senior_id,
    event_type
) => {

    console.log(`
        ServiceNow Workflow Triggered
        Senior ID: ${senior_id}
        Event: ${event_type}
    `);

};


// REAL INCIDENT API 
const createIncident = async (
    short_description,
    description
) => {

    // CHANGE THESE LATER
    const SERVICENOW_URL =
        "https://YOUR-INSTANCE.service-now.com/api/now/table/incident";

    const USERNAME = "admin";
    const PASSWORD = "yourpassword";

    try {

        const response = await axios.post(
            SERVICENOW_URL,
            {
                short_description,
                description,
                urgency: "1",
                impact: "1"
            },
            {
                auth: {
                    username: USERNAME,
                    password: PASSWORD
                },
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                }
            }
        );

        console.log("ServiceNow Incident Created");

        return response.data;

    } catch (err) {

        console.log(
            "ServiceNow Error:",
            err.response?.data || err.message
        );
    }
};


// EXPORT BOTH
module.exports = {
    triggerServiceNowWorkflow,
    createIncident
};