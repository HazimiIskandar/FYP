import threading
import serial
import customtkinter as ctk
import mysql.connector
from datetime import datetime
import time
import requests
from requests.auth import HTTPBasicAuth


# CONFIGURATION
SERIAL_PORT = "/dev/serial0"
BAUD_RATE = 115200


# Heart Rate Thresholds
HR_EMERGENCY_MIN = 50
HR_WARNING_MIN = 60
HR_WARNING_MAX = 100
HR_EMERGENCY_MAX = 120

# Respiration Rate Thresholds
RR_EMERGENCY_MIN = 10
RR_WARNING_MIN = 12
RR_WARNING_MAX = 22
RR_EMERGENCY_MAX = 28

def ts():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")

# CUSTOMTKINTER SETUP
ctk.set_appearance_mode("dark")
ctk.set_default_color_theme("blue")

def log_vital_alert_to_db(alert_type, message):
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
        query = "INSERT INTO Sensor_Alert (alert_type, message, alert_time, sensor_id) VALUES (%s, %s, NOW(), %s)"
        cursor.execute(query, (alert_type, message, 2)) 
        db.commit()
        cursor.close()
    except mysql.connector.Error as err:
        print(f"Database Alert Error: {err}")
    finally:
        if db and db.is_connected():
            db.close()

def log_vital_alert_to_servicenow(alert_type, message):
    url = "https://dev350314.service-now.com/api/now/table/x_2047483_haloapp_vital_sensor"
    
    payload = {
        "reading_type": alert_type,
        "detail": message,
        "sensor_id": "2",
        "location": "Bedroom",
        "datetime": ts()
    }
    
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    
    try:
        response = requests.post(
            url, 
            auth=HTTPBasicAuth('admin', 'qLj60F@TiQ/x'), 
            json=payload,
            headers=headers
        )
        print(f"ServiceNow Status: {response.status_code}")
    except Exception as e:
        print(f"API Error: {e}")

def log_vital_alert_to_telegram(message):
    token = "8825184684:AAHigw0fIo0gh9ZBlJQgCUxCgMZ5Dr2aw48"
    chat_id = "1708283023"
    url = f"https://api.telegram.org/bot8825184684:AAHigw0fIo0gh9ZBlJQgCUxCgMZ5Dr2aw48/sendMessage"
    payload = {"chat_id": chat_id, "text": message}
    
    try:
        requests.post(url, json=payload)
    except Exception as e:
        print(f"Telegram API Error: {e}")
        
class VitalsApp(ctk.CTk):
    def __init__(self):
        super().__init__()

        self.title(" Vitals - Live Patient Monitor")
        self.geometry("500x350")

        # Program state
        self.running = True
        self.ser = None

        # Latest sensor values
        self.hr_value = None
        self.rr_value = None
        
        # Prevent database spamming
        self.hr_alert_state = None
        self.rr_alert_state = None

        # GUI
        self.title_label = ctk.CTkLabel(
            self,
            text="PATIENT VITALS",
            font=("Arial", 24, "bold")
        )
        self.title_label.pack(pady=20)
        
        #Area and Real time Clock
        self.area_label = ctk.CTkLabel(
            self,
            text="Area: Bedroom",
            font=("Arial", 16, "bold"),
            text_color="#4da6ff"
        )
        self.area_label.pack(pady=(0, 5))

        self.clock_label = ctk.CTkLabel(
            self,
            text="00:00:00",
            font=("Arial", 40, "bold")
        )
        self.clock_label.pack(pady=(0, 15))
        
        # Heart Rate Card
        self.hr_frame = ctk.CTkFrame(self)
        self.hr_frame.pack(fill="x", padx=40, pady=10)

        self.hr_label = ctk.CTkLabel(
            self.hr_frame,
            text="Heart Rate: -- BPM",
            font=("Arial", 18)
        )
        self.hr_label.pack(pady=15)
        

        # Respiration Card
        self.rr_frame = ctk.CTkFrame(self)
        self.rr_frame.pack(fill="x", padx=40, pady=10)

        self.rr_label = ctk.CTkLabel(
            self.rr_frame,
            text="Respiration: -- breaths/min",
            font=("Arial", 18)
        )
        self.rr_label.pack(pady=15)

        # Handle window closing properly
        self.protocol("WM_DELETE_WINDOW", self.on_closing)

        # Start serial reader thread
        self.serial_thread = threading.Thread(
            target=self.read_serial_background,
            daemon=True
        )
        self.serial_thread.start()

        # Start GUI updater
        self.after(200, self.update_gui)

    def evaluate_vital(self, vital_name, value, e_min, w_min, w_max, e_max, current_state):
        new_state = None
        
        # Check Emergency First
        if value >= e_max or value <= e_min:
            new_state = "Emergency"
        # Check Warning Second
        elif (w_max < value < e_max) or (e_min < value < w_min):
            new_state = "Warning"
            
        # Log to DB only if the state has escalated or changed
        if new_state != current_state:
            if new_state == "Emergency":
                #log_vital_alert_to_db(f"EMERGENCY", f"{vital_name} CRITICAL: {value}")
                log_vital_alert_to_servicenow(f"EMERGENCY", f"{vital_name} CRITICAL: {value}")
                if vital_name == "Heart Rate":
                    log_vital_alert_to_telegram(f"EMERGENCY ALERT: {vital_name} CRITICAL ({value} BPM) detected in Bedroom!")
                    log_vital_alert_to_telegram(f"Please send emergency help immediately!")
                else:
                    log_vital_alert_to_telegram(f"EMERGENCY ALERT: {vital_name} CRITICAL ({value} breaths/min) detected in Bedroom!")
                    log_vital_alert_to_telegram(f"Please send emergency help immediately!")
            elif new_state == "Warning":
                #log_vital_alert_to_db(f"Warning", f"{vital_name}  ELEVATED: {value}")
                log_vital_alert_to_servicenow(f"WARNING", f"{vital_name} ELEVATED: {value}")

        return new_state
    
    # SERIAL THREAD
    def read_serial_background(self):
        try:
            self.ser = serial.Serial(
                SERIAL_PORT,
                BAUD_RATE,
                timeout=0.1
            )

            print(f"Connected to {SERIAL_PORT}")

            while self.running:
                b = self.ser.read(1)
                if b == b'\x53':
                    second = self.ser.read(1)
                    if second == b'\x59':
                        pkt = b'\x53\x59' + self.ser.read(8)

                        if len(pkt) == 10:
                            report_type = pkt[3]

                            if report_type == 0x03:
                                breath_rate = pkt[6]
                                heart_rate = pkt[7]

                                if heart_rate > 0:
                                    self.hr_value = heart_rate
                                    self.hr_alert_state = self.evaluate_vital(
                                        "Heart Rate", heart_rate, 
                                        HR_EMERGENCY_MIN, HR_WARNING_MIN, 
                                        HR_WARNING_MAX, HR_EMERGENCY_MAX, 
                                        self.hr_alert_state
                                    )
                                    
                                if breath_rate > 0:
                                    self.rr_value = breath_rate
                                    self.rr_alert_state = self.evaluate_vital(
                                        "Respiration", breath_rate, 
                                        RR_EMERGENCY_MIN, RR_WARNING_MIN, 
                                        RR_WARNING_MAX, RR_EMERGENCY_MAX, 
                                        self.rr_alert_state
                                    )

                                print(f"Parsed Vitals -> HR: {heart_rate} | BR: {breath_rate}")

        except Exception as e:
            print("Serial Error:", e)

    # GUI UPDATE LOOP
    
    def update_gui(self):
        current_time = datetime.now().strftime("%H:%M:%S")
        self.clock_label.configure(text=current_time)
        
        if self.hr_value is not None:
            self.hr_label.configure(text=f"Heart Rate: {self.hr_value} BPM")
            if self.hr_alert_state == "Emergency":
                self.hr_frame.configure(fg_color="#B71C1C") # Red
            elif self.hr_alert_state == "Warning":
                self.hr_frame.configure(fg_color="#E65100") # Orange
            else:
                self.hr_frame.configure(fg_color="#1B5E20") # Green

        if self.rr_value is not None:
            self.rr_label.configure(text=f"Respiration: {self.rr_value} breaths/min")
            if self.rr_alert_state == "Emergency":
                self.rr_frame.configure(fg_color="#B71C1C") # Red
            elif self.rr_alert_state == "Warning":
                self.rr_frame.configure(fg_color="#E65100") # Orange
            else:
                self.rr_frame.configure(fg_color="#1B5E20") # Green

        if self.running:
            self.update_id = self.after(200, self.update_gui)

    # CLEAN SHUTDOWN
    def on_closing(self):
        self.running = False
        
        # FIX: Cancel the pending GUI update loop
        if hasattr(self, 'update_id'):
            self.after_cancel(self.update_id)

        try:
            if self.ser and self.ser.is_open:
                self.ser.close()
        except:
            pass

        # FIX: Withdraw the window first to stop internal loops smoothly, then destroy
        self.withdraw()
        self.after(100, self.destroy)

    # CLEAN SHUTDOWN
    def on_closing(self):

        self.running = False

        try:
            if self.ser and self.ser.is_open:
                self.ser.close()
        except:
            pass

        self.destroy()


# MAIN
if __name__ == "__main__":
    app = VitalsApp()
    app.mainloop()