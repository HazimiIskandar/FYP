const axios = require("axios");

// Fallback to the user's credentials so it works immediately for their FYP demo
// In a real production app, we would only use process.env!
const INSTANCE_URL = process.env.SOS_SN_INSTANCE_URL || "https://dev395498.service-now.com";
const USERNAME = process.env.SOS_SN_USERNAME || "admin";
const PASSWORD = process.env.SOS_SN_PASSWORD || "mWqm$H7%iBL2";

/**
 * Finds a Missed Check-in Incident for the senior and updates it to "In Progress"
 * If not found, it creates a new Caregiver Escalation incident to ensure the demo works.
 */
async function updateIncidentToInProgress(seniorName = "Unknown") {
  try {
    const auth = {
      username: USERNAME,
      password: PASSWORD,
    };

    // 1. Query for the active Missed Check-in Incident
    console.log(`[Caregiver ServiceNow] Searching for Missed Check-in incident for ${seniorName}...`);
    // Removed state=1 so it finds it even if it's already in progress or if state is mapped differently
    const query = `short_descriptionLIKEMissed check-in^short_descriptionLIKE${seniorName}^ORDERBYDESCsys_created_on`;
    const searchResponse = await axios.get(
      `${INSTANCE_URL}/api/now/table/incident?sysparm_query=${encodeURIComponent(query)}&sysparm_limit=1`,
      { auth }
    );

    const incidents = searchResponse?.data?.result;
    if (!incidents || incidents.length === 0) {
      console.log(`[Caregiver ServiceNow] No open Missed Check-in incident found for ${seniorName}. Creating a new Caregiver Escalation Incident instead...`);
      
      const payload = {
        short_description: `Caregiver Escalation - ${seniorName}`,
        description: `Caregiver manually triggered an emergency escalation from the mobile app for ${seniorName}. Calling Next of Kin...`,
        urgency: "1",
        impact: "2",
        state: "2" // In Progress
      };

      const createResponse = await axios.post(
        `${INSTANCE_URL}/api/now/table/incident`,
        payload,
        { auth, headers: { "Content-Type": "application/json" } }
      );
      
      const incidentNumber = createResponse?.data?.result?.number || "Unknown";
      console.log(`[Caregiver ServiceNow] SUCCESS! Created new Incident ${incidentNumber} for ${seniorName}.`);
      return true;
    }

    const incident = incidents[0];
    const sysId = incident.sys_id;
    const incidentNumber = incident.number;
    console.log(`[Caregiver ServiceNow] Found Incident ${incidentNumber} (sys_id: ${sysId}). Updating to In Progress...`);

    // 2. Update the Incident to trigger the Caregiver Action Workflow
    const updatePayload = {
      state: "2", // In Progress
      work_notes: "Caregiver has triggered the emergency contact workflow from the mobile app. Calling Next of Kin...",
    };

    await axios.put(
      `${INSTANCE_URL}/api/now/table/incident/${sysId}`,
      updatePayload,
      { auth }
    );

    console.log(`[Caregiver ServiceNow] SUCCESS! Incident ${incidentNumber} is now In Progress. Workflow should be running!`);
    return true;
  } catch (error) {
    console.error(
      "[Caregiver ServiceNow] Failed to interact with Incident:",
      error?.response?.data || error.message
    );
    return false;
  }
}

module.exports = {
  updateIncidentToInProgress,
};
