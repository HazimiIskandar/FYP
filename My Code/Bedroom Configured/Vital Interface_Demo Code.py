import threading
import serial
import customtkinter as ctk
import mysql.connector
from datetime import datetime
import time

# ==========================
# CONFIGURATION
# ==========================
SERIAL_PORT = "/dev/serial0"
BAUD_RATE = 115200

HR_MIN = 60
HR_MAX = 100

RR_MIN = 12
RR_MAX = 22

def ts():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")

# ==========================
# CUSTOMTKINTER SETUP
# ==========================
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
        self.hr_alert_active = False
        self.rr_alert_active = False

        # ==========================
        # GUI
        # ==========================
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
                                    # Check Heart Rate Spike/Drop
                                    if heart_rate > HR_MAX or heart_rate < HR_MIN:
                                        if not self.hr_alert_active:
                                            log_vital_alert_to_db("Heart Rate", f"Abnormal Heart Rate: {heart_rate} BPM")
                                            self.hr_alert_active = True
                                    else:
                                        self.hr_alert_active = False # Reset when back to normal
                                    
                                if breath_rate > 0:
                                    self.rr_value = breath_rate
                                    # Check Respiration Spike/Drop
                                    if breath_rate > RR_MAX or breath_rate < RR_MIN:
                                        if not self.rr_alert_active:
                                            log_vital_alert_to_db("Breath Rate", f"Abnormal Respiration: {breath_rate} BPM")
                                            self.rr_alert_active = True
                                    else:
                                        self.rr_alert_active = False # Reset when back to normal


                                print(f"Parsed Vitals -> HR: {heart_rate} | BR: {breath_rate}")

        except Exception as e:
            print("Serial Error:", e)
            
        
    # GUI UPDATE LOOP
    
    def update_gui(self):
        
        current_time = datetime.now().strftime("%H:%M:%S")
        self.clock_label.configure(text=current_time)
        
        if self.hr_value is not None:
            self.hr_label.configure(text=f"Heart Rate: {self.hr_value} BPM")
            if self.hr_value < HR_MIN or self.hr_value > HR_MAX:
                self.hr_frame.configure(fg_color="#B71C1C")
            else:
                self.hr_frame.configure(fg_color="#1B5E20")

        if self.rr_value is not None:
            self.rr_label.configure(text=f"Respiration: {self.rr_value} breaths/min")
            if self.rr_value < RR_MIN or self.rr_value > RR_MAX:
                self.rr_frame.configure(fg_color="#B71C1C")
            else:
                self.rr_frame.configure(fg_color="#1B5E20")

        if self.running:
            self.update_id = self.after(200, self.update_gui)


    # CLEAN SHUTDOWN
    def on_closing(self):
        self.running = False
        
        if hasattr(self, 'update_id'):
            self.after_cancel(self.update_id)

        try:
            if self.ser and self.ser.is_open:
                self.ser.close()
        except:
            pass

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