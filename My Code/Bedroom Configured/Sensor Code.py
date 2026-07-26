import serial
import time
import json
import paho.mqtt.client as mqtt
from datetime import datetime
from gpiozero import MotionSensor
import csv
import os
import mysql.connector

CSV_FILE = "sensor_log.csv"
AREA_LOCATION = "Living Room"

if not os.path.isfile(CSV_FILE):
    with open(CSV_FILE, mode='w', newline='') as file:
        csv.writer(file).writerow(["Timestamp", "Area", "Event"])

def log_event(event_description):
    """Appends an event with timestamp and area to the CSV."""
    try:
        with open(CSV_FILE, mode='a', newline='') as file:
            csv.writer(file).writerow([ts(), AREA_LOCATION, event_description])
    except Exception as e:
        print(f"CSV Logging Error: {e}")
        
def log_event_to_db(event_desc):
    db = None
    try:
        db = mysql.connector.connect(
            host="cplofo.h.filess.io",
            user="senior_connect_curiousago",
            password="fe9c8311734fbb029d7fec8b715366ee54ec0751",
            database="senior_connect_curiousago",
            port=61032,
            ssl_disabled=True,
            connect_timeout=10 
        )
        cursor = db.cursor()
        query = "INSERT INTO Sensor_Reading (reading_type, reading_value, unit, recorded_at, sensor_id) VALUES (%s, %s, %s, NOW(), %s)"
        cursor.execute(query, ("presence", event_desc, AREA_LOCATION, 1))
        db.commit()
        cursor.close()
    except mysql.connector.Error as err:
        print(f"Database Error: {err}")
    finally:
        if db and db.is_connected():
            db.close()

def log_alert_to_db(alert_type, message):
    db = None
    try:
        db = mysql.connector.connect(
            host="cplofo.h.filess.io",
            user="senior_connect_curiousago",
            password="fe9c8311734fbb029d7fec8b715366ee54ec0751", # Tip: Consider using environment variables for security
            database="senior_connect_curiousago",
            port=61032,
            ssl_disabled=True,
            connect_timeout=10 
        )
        cursor = db.cursor()
        # alert_id is typically auto-incremented, so we omit it from the insert
        query = "INSERT INTO Sensor_Alert (alert_type, message, alert_time, sensor_id) VALUES (%s, %s, NOW(), %s)"
        
        # Using sensor_id = 1 as established in your previous function
        cursor.execute(query, (alert_type, message, 1))
        db.commit()
        cursor.close()
    except mysql.connector.Error as err:
        print(f"Database Alert Error: {err}")
    finally:
        if db and db.is_connected():
            db.close()


# ?? CONFIGURATION

SERIAL_PORT = "/dev/serial0"
BAUD_RATE = 115200
NO_DATA_TIMEOUT = 6.0
PUBLISH_INTERVAL = 10.0  
DEBOUNCE_TIME = 0.5
DEBOUNCE_GRACE = 0.3
human_present = False
last_presence_time = 0
presence_confirmed_time = 2.0
EXIT_GRACE_PERIOD = 3.0

# FALL VERIFICATION SETTINGS
FALL_VERIFY_TIME = 15.0 

# PIR Settings
PIR_PIN = 17
PIR_THRESHOLD = 0.30

# MQTT Settings
BROKER_ADDRESS = "raspberrypi.local"
TOPIC = "senior_connect/sensors/combined_living"

# ==============================

def ts():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")

client = mqtt.Client()

def connect_mqtt():
    try:
        client.connect(BROKER_ADDRESS, 1883, 60)
        client.loop_start()
        print(f"? Connected to Controller at {BROKER_ADDRESS}")
        return True
    except Exception as e:
        print(f"?? MQTT Connection Failed: {e}")
        return False

def publish_alert(alert_type, sensor_type="mmWave", is_emergency=False):
    payload = {
        "timestamp": ts(),
        "type": sensor_type,
        "location": "Living Room",
        "value": alert_type,
        "status": "EMERGENCY" if is_emergency else ("Active" if "PRESENCE" in alert_type or "Motion" in alert_type else "Inactive")
    }
    try:
        qos_level = 2 if is_emergency else 1
        client.publish(TOPIC, json.dumps(payload), qos=qos_level, retain=is_emergency)
        print(f"?? [MQTT SENT] {alert_type}")
    except Exception as e:
        print(f"?? Publish Failed: {e}")

# ----- INITIALIZATION -----
ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=0.5)
pir = MotionSensor(PIR_PIN, threshold=PIR_THRESHOLD)

print("Warming up PIR...")
time.sleep(10) 
print("=== MONITOR READY (10s PUBLISH INTERVAL) ===")

connected = connect_mqtt()
last_data_time = time.time()
presence_start_time = None
last_publish_time = 0
last_print_time = time.time()

# State Tracking
state = "NO_PRESENCE"
last_published_state = None
is_fallen = False
fall_pending = False
fall_start_time = 0

try:
    while True:
        data = ser.read(128)
        now = time.time()
        pir_motion = pir.motion_detected

        # 1. READ mmWAVE DATA
        if data:
            last_data_time = now
            
            # --- FALL DETECTION TRIGGER ---
            if data[0] == 0x53 and data[1] == 0x59:
                # data[2] must be 0x80 (Group), data[3] must be 0x02 (Fall Cmd)
                if data[2] == 0x80 and data[3] == 0x02:
                    
                    # 0x02 means an actual fall occurred
                    if pir_motion and data[6] == 0x02 and not is_fallen and not fall_pending:
                        fall_pending = True
                        fall_start_time = now
                        print(f"\n[{ts()}] ?? [PRE-ALERT] Fall detected. Verifying immobility for {FALL_VERIFY_TIME}s...")
                    
                    # 0x01 means standing/sitting up (clears the alert)
                    elif data[6] == 0x01:
                        if fall_pending:
                            fall_pending = False
                            print(f"[{ts()}] False alarm: Person is sitting/standing safely.")
                        if is_fallen:
                            is_fallen = False
                            print(f"[{ts()}] Recovery detected.")

            # --- PRESENCE DEBOUNCE ---
            if state == "NO_PRESENCE":
                if presence_start_time is None:
                    presence_start_time = now
                if (now - presence_start_time) >= DEBOUNCE_TIME:
                    state = "PRESENCE"
                    print(f"\n[{ts()}] [EVENT] >>> HUMAN ENTERED AREA")
                    log_event("Human Entered Area")
                    log_event_to_db("Fiqachuuu Entered Area")
        
        else:
            if state == "NO_PRESENCE" and presence_start_time is not None:
                if (now - last_data_time) > DEBOUNCE_GRACE:
                    presence_start_time = None

        # 2. FALL VERIFICATION LOGIC
        if fall_pending:
            if pir_motion:
                fall_pending = False
                print(f"[{ts()}] ?? [CANCELLED] Motion detected. Fall ignored.")
            
            elif (now - fall_start_time) >= FALL_VERIFY_TIME:
                fall_pending = False
                is_fallen = True
                print(f"\n[{ts()}] ?? [ALERT] NO MOTION DETECTED. SENDING FALL ALERT!")
                log_event("EMERGENCY: Fall Detected")
                log_alert_to_db("FALL", f"EMERGENCY: Fall detected in {AREA_LOCATION}")

                if connected:
                    publish_alert("FALL_DETECTED", is_emergency=True)

        # 3. RECOVERY LOGIC
        if is_fallen and pir_motion:
            is_fallen = False
            print(f"\n[{ts()}] ? [RECOVERY] PIR DETECTED MOTION")
            log_event("Recovery: Motion Detected")
            if connected:
                publish_alert("RECOVERY_DETECTION", sensor_type="PIR")

        # 4. TIMEOUT CHECK
        if state == "PRESENCE" and (now - last_data_time) > NO_DATA_TIMEOUT:
            state = "NO_PRESENCE"
            is_fallen = False
            fall_pending = False
            presence_start_time = None
            print(f"\n[{ts()}] [EVENT] <<< HUMAN LEFT AREA")
            log_event("Human Left Area")

        # 5. MQTT PUBLISHING LOGIC (NOW EVERY 10 SECONDS)
        if (now - last_publish_time) >= PUBLISH_INTERVAL:
            if connected and not is_fallen and not fall_pending:
                if state == "PRESENCE":
                    publish_alert("PRESENCE_DETECTED")
                    last_published_state = "PRESENCE"
                    last_publish_time = now
                elif state == "NO_PRESENCE" and last_published_state != "NO_MOTION":
                    publish_alert("NO_MOTION_DETECTED")
                    last_published_state = "NO_MOTION"
                    last_publish_time = now

        # 6. CONSOLE STATUS MONITOR
        if (now - last_print_time) >= 1.0:
            current_ts = ts().split(" ")[1]
            if fall_pending:
                status_text = f"? VERIFYING FALL ({int(FALL_VERIFY_TIME - (now - fall_start_time))}s left)"
            elif is_fallen:
                status_text = "?? FALL STATE ACTIVE (WAITING FOR PIR)"
            else:
                status_text = "Presence detected" if state == "PRESENCE" else "No human detected"
            print(f"[{current_ts}] STATUS: {status_text}", end='\r')
            last_print_time = now

        time.sleep(0.05)

except KeyboardInterrupt:
    print("\n?? Stopping Combined Monitor...")

finally:
    ser.close()
    pir.close()
    client.loop_stop()
    client.disconnect()