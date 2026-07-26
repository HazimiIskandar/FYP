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

const STATE_CODE_MAP = {
  'New': '1',
  'Open': '1',
  'In Progress': '2',
  'On Hold': '3',
  'Resolved': '6',
  'Closed': '7',
  'Cancelled': '8',
};

const normalizeText = (value) => String(value || '').toLowerCase();

const mapStatusToStateCode = (statusName) => STATE_CODE_MAP[statusName] || '2';

const incidentMatches = (incident, seniorName, eventType) => {
  const blob = [incident?.short_description, incident?.description]
    .map((value) => String(value || ''))
    .join(' ')
    .toLowerCase();

  if (!blob.includes(normalizeText(seniorName))) return false;
  if (!eventType) return true;

  const eventHint = normalizeText(eventType)
    .replace(/check-?in/g, 'check in')
    .replace(/\s+/g, ' ')
    .trim();

  if (!eventHint) return true;
  return blob.includes(eventHint) || blob.includes('missed check-in') || blob.includes('missed check in');
};

const enrichPayloadForTerminalStates = (payload, statusName, workNotes = '') => {
  const normalized = String(statusName || '').trim().toLowerCase();
  const note = String(workNotes || '').trim() || `Case updated from mobile app with status: ${statusName}.`;

  if (normalized === 'resolved' || normalized === 'closed') {
    payload.close_code = payload.close_code || 'Solution provided';
    payload.close_notes = payload.close_notes || note;
  }

  return payload;
};

async function resolveAssigneeSysId(auth, assignee = null) {
  if (!assignee || typeof assignee !== 'object') return null;

  const email = String(assignee.email || '').trim();
  const fullName = String(assignee.fullName || '').trim();

  const pickBest = (rows = []) => {
    if (!Array.isArray(rows) || rows.length === 0) return null;
    return rows
      .slice()
      .sort((a, b) => {
        const aActive = String(a?.active || '').toLowerCase() === 'true' ? 1 : 0;
        const bActive = String(b?.active || '').toLowerCase() === 'true' ? 1 : 0;
        return bActive - aActive;
      })[0];
  };

  if (email) {
    try {
      const byEmail = await axios.get(
        `${INSTANCE_URL}/api/now/table/sys_user?sysparm_query=${encodeURIComponent(`email=${email}`)}&sysparm_fields=sys_id,name,user_name,email,active&sysparm_limit=10`,
        { auth }
      );
      const row = pickBest(byEmail?.data?.result || []);
      if (row?.sys_id) return String(row.sys_id);
    } catch (err) {
      console.warn('[Caregiver ServiceNow] sys_user email lookup failed:', err?.response?.data || err?.message || err);
    }
  }

  if (fullName) {
    try {
      const byName = await axios.get(
        `${INSTANCE_URL}/api/now/table/sys_user?sysparm_query=${encodeURIComponent(`name=${fullName}`)}&sysparm_fields=sys_id,name,user_name,email,active&sysparm_limit=10`,
        { auth }
      );
      const row = pickBest(byName?.data?.result || []);
      if (row?.sys_id) return String(row.sys_id);
    } catch (err) {
      console.warn('[Caregiver ServiceNow] sys_user name lookup failed:', err?.response?.data || err?.message || err);
    }
  }

  return null;
}

async function findLatestIncidentForSenior(auth, seniorName = 'Unknown', eventType = null) {
  const fields = 'sys_id,number,short_description,description,state,sys_created_on';
  const query = 'active=true^ORDERBYDESCsys_created_on';
  const response = await axios.get(
    `${INSTANCE_URL}/api/now/table/incident?sysparm_query=${encodeURIComponent(query)}&sysparm_fields=${encodeURIComponent(fields)}&sysparm_limit=50`,
    { auth }
  );

  const incidents = Array.isArray(response?.data?.result) ? response.data.result : [];
  return incidents.find((item) => incidentMatches(item, seniorName, eventType)) || null;
}

async function findIncidentBySourceEventId(auth, sourceEventId = null) {
  if (!sourceEventId && sourceEventId !== 0) return null;

  const fields = 'sys_id,number,short_description,description,state,sys_created_on,correlation_id';
  const query = `correlation_id=${String(sourceEventId)}^ORDERBYDESCsys_created_on`;
  const response = await axios.get(
    `${INSTANCE_URL}/api/now/table/incident?sysparm_query=${encodeURIComponent(query)}&sysparm_fields=${encodeURIComponent(fields)}&sysparm_limit=1`,
    { auth }
  );

  const incidents = Array.isArray(response?.data?.result) ? response.data.result : [];
  return incidents[0] || null;
}

async function createIncidentForSenior(auth, {
  seniorName = 'Unknown',
  statusName = 'In Progress',
  workNotes = '',
  eventType = null,
  assignedToSysId = null,
  assignedToDisplayName = null,
  sourceEventId = null,
}) {
  const eventLabel = eventType || 'Caregiver Escalation';
  const payload = {
    short_description: `${eventLabel} - ${seniorName}`,
    description: workNotes || `Case synchronized from mobile app for ${seniorName}. Event type: ${eventLabel}.`,
    urgency: '1',
    impact: '2',
    state: mapStatusToStateCode(statusName),
    work_notes: workNotes || `Case created from app and set to ${statusName}.`,
  };
  if (assignedToSysId) payload.assigned_to = assignedToSysId;
  else if (assignedToDisplayName) payload.assigned_to = assignedToDisplayName;
  if (sourceEventId || sourceEventId === 0) payload.correlation_id = String(sourceEventId);
  enrichPayloadForTerminalStates(payload, statusName, workNotes);

  const created = await axios.post(
    `${INSTANCE_URL}/api/now/table/incident?sysparm_input_display_value=true`,
    payload,
    { auth, headers: { 'Content-Type': 'application/json' } }
  );

  return created?.data?.result || null;
}

async function updateIncidentState(seniorName = 'Unknown', statusName = 'In Progress', workNotes = '', options = {}) {
  try {
    const auth = {
      username: USERNAME,
      password: PASSWORD,
    };

    const eventType = options?.eventType || null;
    const sourceEventId = options?.sourceEventId ?? null;
    const assignedToDisplayName = String(options?.assignee?.fullName || '').trim() || null;
    const assignedToSysId = await resolveAssigneeSysId(auth, options?.assignee || null);

    console.log(`[Caregiver ServiceNow] Searching incident for ${seniorName} (eventType=${eventType || 'any'})...`);
    let incident = sourceEventId || sourceEventId === 0
      ? await findIncidentBySourceEventId(auth, sourceEventId)
      : null;

    if (!incident) {
      incident = await findLatestIncidentForSenior(auth, seniorName, eventType);
    }

    if (!incident) {
      console.log(`[Caregiver ServiceNow] No matching incident found for ${seniorName}. Creating one...`);
      incident = await createIncidentForSenior(auth, {
        seniorName,
        statusName,
        workNotes,
        eventType,
        assignedToSysId,
        assignedToDisplayName,
        sourceEventId,
      });
      if (!incident?.sys_id) {
        return false;
      }
      console.log(`[Caregiver ServiceNow] Created Incident ${incident.number || 'Unknown'} for ${seniorName}.`);
      return true;
    }

    const sysId = incident.sys_id;
    const incidentNumber = incident.number;
    console.log(`[Caregiver ServiceNow] Found Incident ${incidentNumber} (sys_id: ${sysId}). Updating state to ${statusName}...`);

    const updatePayload = {
      state: mapStatusToStateCode(statusName),
    };
    if (workNotes) {
      updatePayload.work_notes = workNotes;
    }
    if (assignedToSysId) {
      updatePayload.assigned_to = assignedToSysId;
    } else if (assignedToDisplayName) {
      updatePayload.assigned_to = assignedToDisplayName;
    }
    if (sourceEventId || sourceEventId === 0) {
      updatePayload.correlation_id = String(sourceEventId);
    }
    enrichPayloadForTerminalStates(updatePayload, statusName, workNotes);

    await axios.put(
      `${INSTANCE_URL}/api/now/table/incident/${sysId}?sysparm_input_display_value=true`,
      updatePayload,
      { auth, headers: { 'Content-Type': 'application/json' } }
    );

    console.log(`[Caregiver ServiceNow] SUCCESS! Incident ${incidentNumber} updated to state ${statusName}.`);
    return true;
  } catch (error) {
    console.error(
      '[Caregiver ServiceNow] Failed to update Incident state:',
      error?.response?.data || error.message
    );
    return false;
  }
}

module.exports = {
  updateIncidentToInProgress,
  updateIncidentState,
};
