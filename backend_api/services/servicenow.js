const axios = require("axios");

// CONFIG
const INSTANCE_URL = "https://dev316146.service-now.com";

const USERNAME = process.env.SN_USERNAME;
const PASSWORD = process.env.SN_PASSWORD;

const auth = {
    username: USERNAME,
    password: PASSWORD
};

// CREATE CHECK-IN RECORD
async function createCheckInResponse(
    seniorId,
    eventType,
    isOkay
) {
    try {

        const response = await axios.post(
            `${INSTANCE_URL}/api/now/table/u_checkin_response`,
            {
                u_senior_id: seniorId,
                u_event_type: eventType,
                u_im_okay: isOkay
            },
            {
                auth,
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                }
            }
        );

        console.log("Record Created");
        console.log(response.data.result);

        return response.data.result;

    } catch (error) {
        console.error(
            error.response?.data || error.message
        );
    }
}

// TRIGGER CHECK-IN
async function triggerCheckIn(
    seniorId,
    eventType,
    isOkay
) {

    return await createCheckInResponse(
        seniorId,
        eventType,
        isOkay
    );
}

// Example
triggerCheckIn(
    "S001",
    "Daily Check-In",
    false
);

module.exports = {
    triggerCheckIn,
    createCheckInResponse
};