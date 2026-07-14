const axios = require("axios");

// Fallback to the user's credentials so it works immediately for their FYP demo
// In a real production app, we would only use process.env!
const INSTANCE_URL = process.env.SOS_SN_INSTANCE_URL || "https://dev395498.service-now.com";
const USERNAME = process.env.SOS_SN_USERNAME || "admin";
const PASSWORD = process.env.SOS_SN_PASSWORD || "mWqm$H7%iBL2";

/**
 * Creates an Incident in the user's personal ServiceNow instance to trigger the SOS Workflow
 */
async function createSosIncident(seniorId, seniorName = "Unknown") {
  try {
    const payload = {
      // THIS is the magic link! The workflow is listening for this exact short_description
      short_description: "SOS Trigger",
      description: `Emergency SOS manually triggered from the mobile app by ${seniorName} (Senior ID: ${seniorId})`,
      urgency: "1", // High Urgency
      impact: "2", // Medium Impact
    };

    const response = await axios.post(
      `${INSTANCE_URL}/api/now/table/incident`,
      payload,
      {
        auth: {
          username: USERNAME,
          password: PASSWORD,
        },
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        timeout: 5000,
      }
    );

    const incidentNumber = response?.data?.result?.number || "Unknown";
    console.log(`[SOS ServiceNow] SUCCESS! Created Incident ${incidentNumber} for ${seniorName} (Senior ${seniorId}). Workflow should be running!`);
    return true;
  } catch (error) {
    console.error(
      "[SOS ServiceNow] Failed to create Incident:",
      error?.response?.data || error.message
    );
    return false;
  }
}

module.exports = {
  createSosIncident,
};
