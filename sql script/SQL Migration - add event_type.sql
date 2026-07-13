-- ---------------------------------------------------------------------------------
-- Live-DB migration: nullable sensor/alert FKs + event_type discriminator.
--
-- Apply on top of the existing schema in `SQL Update 4-7.sql`. Safe to re-run:
-- every ALTER is guarded by an INFORMATION_SCHEMA check that short-circuits
-- with a SELECT instead of re-applying. No DELIMITER blocks, so this file
-- works the same way under the mysql CLI (`mysql < file.sql`), MySQL
-- Workbench's script runner, and any other client.
--
-- Requires MySQL 8.0.16+ for native CHECK constraint enforcement.
--
-- What this migration does (matches the canonical schema in `SQL Update 4-7.sql`)
--   1. Emergency_Event
--        * ADD COLUMN event_type VARCHAR(50)
--        * Backfill existing rows: alert_id set -> 'Sensor Alert', else 'SOS'.
--        * MODIFY event_type VARCHAR(50) NOT NULL    (reconciled with canonical)
--        * MODIFY alert_id  INT NULL DEFAULT NULL
--        * MODIFY sensor_id INT NULL DEFAULT NULL
--        * ADD CONSTRAINT chk_Emergency_Event_sensor_alert_pair
--   2. Escalation_History
--        * ADD COLUMN escalated_to VARCHAR(100) NULL DEFAULT NULL
--   3. Notification
--        * Pre-flight SELECT counts Notification rows that would fail the
--          new CHECK constraint. If the count is non-zero, the script
--          SKIPS adding the CHECK and prints a clear message - the
--          operator must fix the orphans manually before re-running.
--        * ADD COLUMN recipient_type VARCHAR(50) NULL
--        * ADD COLUMN recipient_name VARCHAR(100) NULL
--        * MODIFY checkin_id / alert_id / sensor_id to NULLable
--        * ADD CONSTRAINT chk_Notification_one_link (if no orphans)
--
-- Idempotency
--   Re-runs print `info` rows and DO NOT re-modify the schema.
-- ---------------------------------------------------------------------------------

USE `senior_connect_curiousago`;


-- =============================================================================
-- 1. Emergency_Event
-- =============================================================================

-- 1a. Add event_type NULLable first (so ADD works on a populated table).
SET @col_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME   = 'Emergency_Event'
       AND COLUMN_NAME  = 'event_type'
);
SET @sql := IF(@col_exists = 0,
    'ALTER TABLE `Emergency_Event` ADD COLUMN `event_type` VARCHAR(50) NULL AFTER `senior_id`',
    'SELECT ''event_type already exists'' AS info'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 1b. Backfill any pre-existing rows (only updates rows where event_type is NULL).
UPDATE `Emergency_Event`
   SET `event_type` = CASE
       WHEN `alert_id` IS NOT NULL THEN 'Sensor Alert'
       ELSE 'SOS'
   END
 WHERE `event_type` IS NULL;

-- 1c. MODIFY event_type to NOT NULL (reconciles live DB with the canonical
-- schema in `SQL Update 4-7.sql`). Safe because every row is now backfilled.
ALTER TABLE `Emergency_Event` MODIFY COLUMN `event_type` VARCHAR(50) NOT NULL;

-- 1d. Make alert_id / sensor_id NULLable. MODIFY is a no-op on rerun if already NULLable.
ALTER TABLE `Emergency_Event` MODIFY COLUMN `alert_id`  INT NULL DEFAULT NULL;
ALTER TABLE `Emergency_Event` MODIFY COLUMN `sensor_id` INT NULL DEFAULT NULL;

-- 1e. Composite-key all-or-nothing CHECK.
SET @constraint_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
     WHERE TABLE_SCHEMA   = DATABASE()
       AND TABLE_NAME     = 'Emergency_Event'
       AND CONSTRAINT_NAME = 'chk_Emergency_Event_sensor_alert_pair'
);
SET @sql := IF(@constraint_exists = 0,
    'ALTER TABLE `Emergency_Event` ADD CONSTRAINT `chk_Emergency_Event_sensor_alert_pair` '
    'CHECK ((`alert_id` IS NULL AND `sensor_id` IS NULL) '
    '    OR (`alert_id` IS NOT NULL AND `sensor_id` IS NOT NULL))',
    'SELECT ''chk_Emergency_Event_sensor_alert_pair already exists'' AS info'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;


-- =============================================================================
-- 2. Escalation_History
-- ============================================================================
SET @col_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME   = 'Escalation_History'
       AND COLUMN_NAME  = 'escalated_to'
);
SET @sql := IF(@col_exists = 0,
    'ALTER TABLE `Escalation_History` ADD COLUMN `escalated_to` VARCHAR(100) NULL DEFAULT NULL AFTER `event_id`',
    'SELECT ''escalated_to already exists'' AS info'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;


-- =============================================================================
-- 3. Notification
-- ============================================================================
-- Gate: only ADD the CHECK constraint if no Notification rows already violate
-- it (event_id AND checkin_id AND alert_id all NULL). If orphans exist we
-- SKIP the constraint add and emit a clear skip message - the operator must
-- resolve orphan rows in application code first, then rerun.
SET @orphan_count := (
    SELECT COUNT(*) FROM `Notification`
     WHERE `event_id` IS NULL
       AND `checkin_id` IS NULL
       AND `alert_id` IS NULL
);
SET @constraint_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
     WHERE TABLE_SCHEMA   = DATABASE()
       AND TABLE_NAME     = 'Notification'
       AND CONSTRAINT_NAME = 'chk_Notification_one_link'
);

-- 3a. Add recipient_type / recipient_name (idempotent).
SET @col_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME   = 'Notification'
       AND COLUMN_NAME  = 'recipient_type'
);
SET @sql := IF(@col_exists = 0,
    'ALTER TABLE `Notification` ADD COLUMN `recipient_type` VARCHAR(50) NULL DEFAULT NULL AFTER `notification_status`',
    'SELECT ''recipient_type already exists'' AS info'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME   = 'Notification'
       AND COLUMN_NAME  = 'recipient_name'
);
SET @sql := IF(@col_exists = 0,
    'ALTER TABLE `Notification` ADD COLUMN `recipient_name` VARCHAR(100) NULL DEFAULT NULL AFTER `recipient_type`',
    'SELECT ''recipient_name already exists'' AS info'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3b. MODIFY FK columns to NULLable (idempotent no-ops if already NULLable).
ALTER TABLE `Notification` MODIFY COLUMN `checkin_id` INT NULL DEFAULT NULL;
ALTER TABLE `Notification` MODIFY COLUMN `alert_id`   INT NULL DEFAULT NULL;
ALTER TABLE `Notification` MODIFY COLUMN `sensor_id`  INT NULL DEFAULT NULL;

-- 3c. Add the one-link CHECK constraint only if it doesn't exist AND no
-- orphans remain (event_id AND checkin_id AND alert_id all NULL).
--
-- Note: an alert_id + sensor_id pair-parity CHECK on Notification would mirror
-- chk_Emergency_Event_sensor_alert_pair, but no caller in the codebase
-- currently populates the alert_id/sensor_id branch of Notification (sensor
-- alerts are linked through Emergency_Event.event_id). The schema leaves the
-- pair NULLable so a future direct-from-Sensor_Alert notification path is
-- allowed without re-migration; add the pair CHECK then, NOT preemptively.
SET @sql := IF(@constraint_exists = 0 AND @orphan_count = 0,
    'ALTER TABLE `Notification` ADD CONSTRAINT `chk_Notification_one_link` '
    'CHECK (`event_id` IS NOT NULL OR `checkin_id` IS NOT NULL OR `alert_id` IS NOT NULL)',
    'SELECT IF(@constraint_exists > 0,
               ''chk_Notification_one_link already exists'',
               CONCAT(''SKIPPED: '', @orphan_count,
                      '' orphan Notification rows would violate chk_Notification_one_link. ''
                      ''Resolve them in application code (each row must reference exactly one ''
                      ''source: Daily_CheckIn / Emergency_Event / Sensor_Alert) and rerun.'')) AS info'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
