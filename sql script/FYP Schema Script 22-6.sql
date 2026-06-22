-- MySQL Workbench Forward Engineering

SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0;
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;
SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

-- -----------------------------------------------------
-- Schema mydb
-- -----------------------------------------------------
-- -----------------------------------------------------
-- Schema senior_connect_curiousago
-- -----------------------------------------------------

-- -----------------------------------------------------
-- Schema senior_connect_curiousago
-- -----------------------------------------------------
CREATE SCHEMA IF NOT EXISTS `senior_connect_curiousago` DEFAULT CHARACTER SET utf8mb4 ;
USE `senior_connect_curiousago` ;

-- -----------------------------------------------------
-- Table `senior_connect_curiousago`.`Role`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `senior_connect_curiousago`.`Role` (
  `role_id` INT NOT NULL AUTO_INCREMENT,
  `role` VARCHAR(50) NOT NULL,
  PRIMARY KEY (`role_id`))
ENGINE = InnoDB
AUTO_INCREMENT = 5
DEFAULT CHARACTER SET = utf8mb4;


-- -----------------------------------------------------
-- Table `senior_connect_curiousago`.`User_Account`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `senior_connect_curiousago`.`User_Account` (
  `user_id` INT NOT NULL AUTO_INCREMENT,
  `role_id` INT NOT NULL,
  `full_name` VARCHAR(100) NOT NULL,
  `phone_number` VARCHAR(20) NULL DEFAULT NULL,
  `email` VARCHAR(100) NOT NULL,
  `dob` DATE NULL DEFAULT NULL,
  `gender` VARCHAR(10) NULL DEFAULT NULL,
  `address` VARCHAR(255) NULL DEFAULT NULL,
  `postal_code` CHAR(6) NULL DEFAULT NULL,
  `unit_number` VARCHAR(10) NULL DEFAULT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `account_status` VARCHAR(50) NULL DEFAULT NULL,
  `last_login` TIMESTAMP NULL DEFAULT NULL,
  `password` VARCHAR(255) NOT NULL,
  PRIMARY KEY (`user_id`),
  INDEX `fk_User_Account_Role` (`role_id` ASC) VISIBLE,
  CONSTRAINT `fk_User_Account_Role`
    FOREIGN KEY (`role_id`)
    REFERENCES `senior_connect_curiousago`.`Role` (`role_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE)
ENGINE = InnoDB
AUTO_INCREMENT = 3
DEFAULT CHARACTER SET = utf8mb4;


-- -----------------------------------------------------
-- Table `senior_connect_curiousago`.`AIC_Staff`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `senior_connect_curiousago`.`AIC_Staff` (
  `staff_id` INT NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  PRIMARY KEY (`staff_id`),
  INDEX `fk_AICStaff_User_Account` (`user_id` ASC) VISIBLE,
  CONSTRAINT `fk_AICStaff_User_Account`
    FOREIGN KEY (`user_id`)
    REFERENCES `senior_connect_curiousago`.`User_Account` (`user_id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4;


-- -----------------------------------------------------
-- Table `senior_connect_curiousago`.`Senior`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `senior_connect_curiousago`.`Senior` (
  `senior_id` INT NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `preferred_checkin_time` VARCHAR(20) NULL DEFAULT '9:00 AM',
  PRIMARY KEY (`senior_id`),
  INDEX `fk_Senior_User_Account` (`user_id` ASC) VISIBLE,
  CONSTRAINT `fk_Senior_User_Account`
    FOREIGN KEY (`user_id`)
    REFERENCES `senior_connect_curiousago`.`User_Account` (`user_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE)
ENGINE = InnoDB
AUTO_INCREMENT = 6
DEFAULT CHARACTER SET = utf8mb4;


-- -----------------------------------------------------
-- Table `senior_connect_curiousago`.`Community_Hub`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `senior_connect_curiousago`.`Community_Hub` (
  `activity_id` INT NOT NULL AUTO_INCREMENT,
  `senior_id` INT NULL DEFAULT NULL,
  `activity_name` VARCHAR(100) NOT NULL,
  `activity_type` VARCHAR(100) NOT NULL,
  `activity_date` DATETIME NOT NULL,
  `participation_status` VARCHAR(50) NOT NULL,
  PRIMARY KEY (`activity_id`),
  INDEX `senior_id` (`senior_id` ASC) VISIBLE,
  CONSTRAINT `Community_Hub_ibfk_1`
    FOREIGN KEY (`senior_id`)
    REFERENCES `senior_connect_curiousago`.`Senior` (`senior_id`))
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4;


-- -----------------------------------------------------
-- Table `senior_connect_curiousago`.`Reward_Streak`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `senior_connect_curiousago`.`Reward_Streak` (
  `reward_id` INT NOT NULL AUTO_INCREMENT,
  `senior_id` INT NOT NULL,
  `current_streak` INT NOT NULL,
  `total_points` INT NOT NULL,
  PRIMARY KEY (`reward_id`),
  INDEX `senior_id` (`senior_id` ASC) VISIBLE,
  CONSTRAINT `Reward_Streak_ibfk_1`
    FOREIGN KEY (`senior_id`)
    REFERENCES `senior_connect_curiousago`.`Senior` (`senior_id`))
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4;


-- -----------------------------------------------------
-- Table `senior_connect_curiousago`.`Daily_CheckIn`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `senior_connect_curiousago`.`Daily_CheckIn` (
  `checkin_id` INT NOT NULL AUTO_INCREMENT,
  `senior_id` INT NOT NULL,
  `checkin_status` VARCHAR(20) NOT NULL DEFAULT 'Unresolved',
  `checkin_timestamp` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `reward_id` INT NOT NULL,
  PRIMARY KEY (`checkin_id`),
  INDEX `senior_id` (`senior_id` ASC) VISIBLE,
  INDEX `fk_Daily_CheckIn_Reward_Streak1_idx` (`reward_id` ASC) VISIBLE,
  CONSTRAINT `Daily_CheckIn_ibfk_1`
    FOREIGN KEY (`senior_id`)
    REFERENCES `senior_connect_curiousago`.`Senior` (`senior_id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_Daily_CheckIn_Reward_Streak1`
    FOREIGN KEY (`reward_id`)
    REFERENCES `senior_connect_curiousago`.`Reward_Streak` (`reward_id`))
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4;


-- -----------------------------------------------------
-- Table `senior_connect_curiousago`.`Sensor`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `senior_connect_curiousago`.`Sensor` (
  `sensor_id` INT NOT NULL AUTO_INCREMENT,
  `sensor_type` VARCHAR(50) NOT NULL,
  `device_name` VARCHAR(100) NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'Active',
  `installed_date` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`sensor_id`))
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4;


-- -----------------------------------------------------
-- Table `senior_connect_curiousago`.`Sensor_Alert`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `senior_connect_curiousago`.`Sensor_Alert` (
  `alert_id` INT NOT NULL AUTO_INCREMENT,
  `alert_type` VARCHAR(50) NOT NULL,
  `message` VARCHAR(255) NOT NULL,
  `alert_time` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `sensor_id` INT NOT NULL,
  PRIMARY KEY (`alert_id`, `sensor_id`),
  INDEX `fk_Sensor_Alert_Sensor1_idx` (`sensor_id` ASC) VISIBLE,
  CONSTRAINT `fk_Sensor_Alert_Sensor1`
    FOREIGN KEY (`sensor_id`)
    REFERENCES `senior_connect_curiousago`.`Sensor` (`sensor_id`))
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4;


-- -----------------------------------------------------
-- Table `senior_connect_curiousago`.`Emergency_Event`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `senior_connect_curiousago`.`Emergency_Event` (
  `event_id` INT NOT NULL AUTO_INCREMENT,
  `senior_id` INT NOT NULL,
  `event_status` VARCHAR(50) NOT NULL DEFAULT 'Open',
  `escalation_level` VARCHAR(50) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `alert_id` INT NOT NULL,
  `sensor_id` INT NOT NULL,
  PRIMARY KEY (`event_id`),
  INDEX `senior_id` (`senior_id` ASC) VISIBLE,
  INDEX `fk_Emergency_Event_Sensor_Alert1_idx` (`alert_id` ASC, `sensor_id` ASC) VISIBLE,
  CONSTRAINT `Emergency_Event_ibfk_1`
    FOREIGN KEY (`senior_id`)
    REFERENCES `senior_connect_curiousago`.`Senior` (`senior_id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_Emergency_Event_Sensor_Alert1`
    FOREIGN KEY (`alert_id` , `sensor_id`)
    REFERENCES `senior_connect_curiousago`.`Sensor_Alert` (`alert_id` , `sensor_id`))
ENGINE = InnoDB
AUTO_INCREMENT = 282
DEFAULT CHARACTER SET = utf8mb4;


-- -----------------------------------------------------
-- Table `senior_connect_curiousago`.`Escalation_History`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `senior_connect_curiousago`.`Escalation_History` (
  `escalation_id` INT NOT NULL AUTO_INCREMENT,
  `event_id` INT NOT NULL,
  `escalation_time` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `escalation_status` VARCHAR(50) NOT NULL,
  PRIMARY KEY (`escalation_id`),
  INDEX `event_id` (`event_id` ASC) VISIBLE,
  CONSTRAINT `Escalation_History_ibfk_1`
    FOREIGN KEY (`event_id`)
    REFERENCES `senior_connect_curiousago`.`Emergency_Event` (`event_id`))
ENGINE = InnoDB
AUTO_INCREMENT = 841
DEFAULT CHARACTER SET = utf8mb4;


-- -----------------------------------------------------
-- Table `senior_connect_curiousago`.`Escalation_Assignment`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `senior_connect_curiousago`.`Escalation_Assignment` (
  `staff_id` INT NOT NULL,
  `escalation_id` INT NOT NULL,
  INDEX `fk_AIC_Staff_has_Escalation_History_Escalation_History1_idx` (`escalation_id` ASC) VISIBLE,
  INDEX `fk_AIC_Staff_has_Escalation_History_AIC_Staff1_idx` (`staff_id` ASC) VISIBLE,
  CONSTRAINT `fk_AIC_Staff_has_Escalation_History_AIC_Staff1`
    FOREIGN KEY (`staff_id`)
    REFERENCES `senior_connect_curiousago`.`AIC_Staff` (`staff_id`),
  CONSTRAINT `fk_AIC_Staff_has_Escalation_History_Escalation_History1`
    FOREIGN KEY (`escalation_id`)
    REFERENCES `senior_connect_curiousago`.`Escalation_History` (`escalation_id`))
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;


-- -----------------------------------------------------
-- Table `senior_connect_curiousago`.`Medical_Condition`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `senior_connect_curiousago`.`Medical_Condition` (
  `condition_id` INT NOT NULL AUTO_INCREMENT,
  `condition_name` VARCHAR(100) NOT NULL,
  `severity_level` VARCHAR(50) NOT NULL,
  `medication_required` VARCHAR(10) NOT NULL,
  PRIMARY KEY (`condition_id`))
ENGINE = InnoDB
AUTO_INCREMENT = 13
DEFAULT CHARACTER SET = utf8mb4;


-- -----------------------------------------------------
-- Table `senior_connect_curiousago`.`NOK`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `senior_connect_curiousago`.`NOK` (
  `nok_id` INT NOT NULL AUTO_INCREMENT,
  `full_name` VARCHAR(100) NOT NULL,
  `phone_number` VARCHAR(20) NOT NULL,
  `email` VARCHAR(100) NOT NULL,
  `relationship_to_senior` VARCHAR(50) NOT NULL,
  PRIMARY KEY (`nok_id`))
ENGINE = InnoDB
AUTO_INCREMENT = 4
DEFAULT CHARACTER SET = utf8mb4;


-- -----------------------------------------------------
-- Table `senior_connect_curiousago`.`Notification`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `senior_connect_curiousago`.`Notification` (
  `notification_id` INT NOT NULL AUTO_INCREMENT,
  `notification_status` VARCHAR(50) NOT NULL,
  `sent_timestamp` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `senior_id` INT NOT NULL,
  `event_id` INT NULL DEFAULT NULL,
  `checkin_id` INT NOT NULL,
  `alert_id` INT NOT NULL,
  `sensor_id` INT NOT NULL,
  PRIMARY KEY (`notification_id`),
  INDEX `fk_Notification_Senior1_idx1` (`senior_id` ASC) VISIBLE,
  INDEX `fk_Notification_Emergency_Event1_idx` (`event_id` ASC) VISIBLE,
  INDEX `fk_Notification_Daily_CheckIn1_idx` (`checkin_id` ASC) VISIBLE,
  INDEX `fk_Notification_Sensor_Alert1_idx` (`alert_id` ASC, `sensor_id` ASC) VISIBLE,
  CONSTRAINT `fk_Notification_Daily_CheckIn1`
    FOREIGN KEY (`checkin_id`)
    REFERENCES `senior_connect_curiousago`.`Daily_CheckIn` (`checkin_id`),
  CONSTRAINT `fk_Notification_Emergency_Event1`
    FOREIGN KEY (`event_id`)
    REFERENCES `senior_connect_curiousago`.`Emergency_Event` (`event_id`),
  CONSTRAINT `fk_Notification_Senior1`
    FOREIGN KEY (`senior_id`)
    REFERENCES `senior_connect_curiousago`.`Senior` (`senior_id`),
  CONSTRAINT `fk_Notification_Sensor_Alert1`
    FOREIGN KEY (`alert_id` , `sensor_id`)
    REFERENCES `senior_connect_curiousago`.`Sensor_Alert` (`alert_id` , `sensor_id`))
ENGINE = InnoDB
AUTO_INCREMENT = 2
DEFAULT CHARACTER SET = utf8mb4;


-- -----------------------------------------------------
-- Table `senior_connect_curiousago`.`Notification_Assignment`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `senior_connect_curiousago`.`Notification_Assignment` (
  `notification_id` INT NOT NULL,
  `staff_id` INT NOT NULL,
  INDEX `fk_Notification_has_AIC_Staff_AIC_Staff1_idx` (`staff_id` ASC) VISIBLE,
  INDEX `fk_Notification_has_AIC_Staff_Notification1_idx` (`notification_id` ASC) VISIBLE,
  CONSTRAINT `fk_Notification_has_AIC_Staff_AIC_Staff1`
    FOREIGN KEY (`staff_id`)
    REFERENCES `senior_connect_curiousago`.`AIC_Staff` (`staff_id`),
  CONSTRAINT `fk_Notification_has_AIC_Staff_Notification1`
    FOREIGN KEY (`notification_id`)
    REFERENCES `senior_connect_curiousago`.`Notification` (`notification_id`))
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;


-- -----------------------------------------------------
-- Table `senior_connect_curiousago`.`Reward_Redemption`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `senior_connect_curiousago`.`Reward_Redemption` (
  `redemption_id` INT NOT NULL AUTO_INCREMENT,
  `reward_id` INT NOT NULL,
  `reward_redeemed` VARCHAR(255) NULL DEFAULT NULL,
  `redemption_date` DATETIME NULL DEFAULT NULL,
  PRIMARY KEY (`redemption_id`),
  INDEX `reward_id` (`reward_id` ASC) VISIBLE,
  CONSTRAINT `Reward_Redemption_ibfk_1`
    FOREIGN KEY (`reward_id`)
    REFERENCES `senior_connect_curiousago`.`Reward_Streak` (`reward_id`)
    ON DELETE CASCADE)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4;


-- -----------------------------------------------------
-- Table `senior_connect_curiousago`.`Senior_Link_Code`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `senior_connect_curiousago`.`Senior_Link_Code` (
  `senior_id` INT NOT NULL,
  `link_code` VARCHAR(6) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`senior_id`),
  UNIQUE INDEX `link_code` (`link_code` ASC) VISIBLE,
  CONSTRAINT `fk_Senior_Link_Code_Senior`
    FOREIGN KEY (`senior_id`)
    REFERENCES `senior_connect_curiousago`.`Senior` (`senior_id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4;


-- -----------------------------------------------------
-- Table `senior_connect_curiousago`.`Senior_Medical_Condition`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `senior_connect_curiousago`.`Senior_Medical_Condition` (
  `senior_id` INT NOT NULL,
  `condition_id` INT NOT NULL,
  `diagnosed_date` DATE NOT NULL,
  PRIMARY KEY (`senior_id`, `condition_id`),
  INDEX `condition_id` (`condition_id` ASC) VISIBLE,
  CONSTRAINT `Senior_Medical_Condition_ibfk_1`
    FOREIGN KEY (`senior_id`)
    REFERENCES `senior_connect_curiousago`.`Senior` (`senior_id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `Senior_Medical_Condition_ibfk_2`
    FOREIGN KEY (`condition_id`)
    REFERENCES `senior_connect_curiousago`.`Medical_Condition` (`condition_id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4;


-- -----------------------------------------------------
-- Table `senior_connect_curiousago`.`Senior_has_AIC_Staff`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `senior_connect_curiousago`.`Senior_has_AIC_Staff` (
  `senior_id` INT NOT NULL,
  `staff_id` INT NOT NULL,
  INDEX `fk_Senior_has_AIC_Staff_AIC_Staff1_idx` (`staff_id` ASC) VISIBLE,
  INDEX `fk_Senior_has_AIC_Staff_Senior1_idx` (`senior_id` ASC) VISIBLE,
  CONSTRAINT `fk_Senior_has_AIC_Staff_AIC_Staff1`
    FOREIGN KEY (`staff_id`)
    REFERENCES `senior_connect_curiousago`.`AIC_Staff` (`staff_id`),
  CONSTRAINT `fk_Senior_has_AIC_Staff_Senior1`
    FOREIGN KEY (`senior_id`)
    REFERENCES `senior_connect_curiousago`.`Senior` (`senior_id`))
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;


-- -----------------------------------------------------
-- Table `senior_connect_curiousago`.`Senior_has_Caregiver`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `senior_connect_curiousago`.`Senior_has_Caregiver` (
  `senior_id` INT NOT NULL,
  `caregiver_id` INT NOT NULL,
  PRIMARY KEY (`senior_id`),
  INDEX `fk_Senior_has_Caregiver_Caregiver_idx` (`caregiver_id` ASC) VISIBLE,
  CONSTRAINT `fk_Senior_has_Caregiver_Caregiver`
    FOREIGN KEY (`caregiver_id`)
    REFERENCES `senior_connect_curiousago`.`User_Account` (`user_id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_Senior_has_Caregiver_Senior`
    FOREIGN KEY (`senior_id`)
    REFERENCES `senior_connect_curiousago`.`Senior` (`senior_id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4;


-- -----------------------------------------------------
-- Table `senior_connect_curiousago`.`Senior_has_NOK`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `senior_connect_curiousago`.`Senior_has_NOK` (
  `senior_id` INT NOT NULL,
  `nok_id` INT NOT NULL,
  PRIMARY KEY (`senior_id`, `nok_id`),
  INDEX `fk_Senior_has_NOK_NOK1_idx` (`nok_id` ASC) VISIBLE,
  INDEX `fk_Senior_has_NOK_Senior1_idx` (`senior_id` ASC) VISIBLE,
  CONSTRAINT `fk_Senior_has_NOK_NOK1`
    FOREIGN KEY (`nok_id`)
    REFERENCES `senior_connect_curiousago`.`NOK` (`nok_id`),
  CONSTRAINT `fk_Senior_has_NOK_Senior1`
    FOREIGN KEY (`senior_id`)
    REFERENCES `senior_connect_curiousago`.`Senior` (`senior_id`))
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4;


-- -----------------------------------------------------
-- Table `senior_connect_curiousago`.`Sensor_Reading`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `senior_connect_curiousago`.`Sensor_Reading` (
  `reading_id` INT NOT NULL AUTO_INCREMENT,
  `reading_type` VARCHAR(50) NOT NULL,
  `reading_value` VARCHAR(50) NOT NULL,
  `unit` VARCHAR(20) NOT NULL,
  `recorded_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `sensor_id` INT NOT NULL,
  `event_id` INT NULL DEFAULT NULL,
  PRIMARY KEY (`reading_id`, `sensor_id`),
  INDEX `fk_Sensor_Reading_Sensor1_idx` (`sensor_id` ASC) VISIBLE,
  INDEX `fk_Sensor_Reading_Emergency_Event1_idx` (`event_id` ASC) VISIBLE,
  CONSTRAINT `fk_Sensor_Reading_Emergency_Event1`
    FOREIGN KEY (`event_id`)
    REFERENCES `senior_connect_curiousago`.`Emergency_Event` (`event_id`),
  CONSTRAINT `fk_Sensor_Reading_Sensor1`
    FOREIGN KEY (`sensor_id`)
    REFERENCES `senior_connect_curiousago`.`Sensor` (`sensor_id`))
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4;


SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;
