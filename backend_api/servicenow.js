const triggerServiceNowWorkflow = (
    senior_id,
    event_type
) => {

    console.log(`
        ServiceNow Workflow Triggered
        Senior ID: ${senior_id}
        Event: ${event_type}
    `);

    // future:
    // actual API call to ServiceNow
};

module.exports = {
    triggerServiceNowWorkflow
};