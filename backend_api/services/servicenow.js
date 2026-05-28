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
        "https://dev316146.service-now.com/login.do?user_name=admin&sys_action=sysverb_login&user_password=R9zu%2B*3kXIPa";

    const USERNAME = "admin";
    const PASSWORD = "";

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
                    username: "admin",
                    password: ""
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