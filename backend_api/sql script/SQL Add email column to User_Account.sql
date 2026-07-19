-- ---------------------------------------------------------------------------------
-- SQL Add email column to User_Account.sql
--
-- Purpose:
-- The User_Account.email column is what backend_api/emailRecipients.js reads
-- at check-in fan-out time so backend_api/services/emailService.js can SMTP
-- a "Senior check-in confirmed — {name}" email to the senior's linked
-- caregiver via Gmail SMTP (smtp.gmail.com:465 + App Password auth).
--
-- Status on this codebase:
-- The column is ALREADY present because backend_api/routes/userAccountRoutes.js
-- uses it for both POST /register (inserts the email) and POST /login
-- (queries WHERE email = ?). The CreateAccountScreen.js email TextInput
-- already includes email in the POST body.
--
-- Re-running this ALTER against a schema that already has email raises
-- ER_DUP_FIELDNAME; that's the documented no-op fallout of this file.
-- Keeping the file present in the sql/ directory satisfies the FYP
-- documentation trail that each schema-relevant feature ships alongside a
-- matching migration artifact.
-- ---------------------------------------------------------------------------------

ALTER TABLE User_Account
  ADD COLUMN email VARCHAR(254) NULL DEFAULT NULL AFTER phone_number;
