import threading
import serial
import customtkinter as ctk

# ==========================
# CONFIGURATION
# ==========================
SERIAL_PORT = "/dev/serial0"
BAUD_RATE = 115200

HR_MIN = 60
HR_MAX = 100

RR_MIN = 12
RR_MAX = 22

# ==========================
# CUSTOMTKINTER SETUP
# ==========================
ctk.set_appearance_mode("dark")
ctk.set_default_color_theme("blue")


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

        # ==========================
        # GUI
        # ==========================
        self.title_label = ctk.CTkLabel(
            self,
            text="PATIENT VITALS",
            font=("Arial", 24, "bold")
        )
        self.title_label.pack(pady=20)
        
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
        
        # ==========================
    # SERIAL THREAD
    # ==========================
    # ==========================
    # SERIAL THREAD
    # ==========================
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
                        # Read the remaining 8 bytes of the 10-byte packet
                        pkt = b'\x53\x59' + self.ser.read(8)

                        if len(pkt) == 10:
                            report_type = pkt[3]

                            # Report type 0x03 contains both vitals
                            if report_type == 0x03:
                                breath_rate = pkt[6]
                                heart_rate = pkt[7]

                                # Update values if valid
                                if heart_rate > 0:
                                    self.hr_value = heart_rate
                                if breath_rate > 0:
                                    self.rr_value = breath_rate

                                print(f"Parsed Vitals -> HR: {heart_rate} | BR: {breath_rate}")

        except Exception as e:
            print("Serial Error:", e)
            
        # ==========================
    # GUI UPDATE LOOP
    # ==========================
    def update_gui(self):

        if self.hr_value is not None:

            self.hr_label.configure(
                text=f"Heart Rate: {self.hr_value} BPM"
            )

            if self.hr_value < HR_MIN or self.hr_value > HR_MAX:
                self.hr_frame.configure(
                    fg_color="#B71C1C"
                )
            else:
                self.hr_frame.configure(
                    fg_color="#1B5E20"
                )

        if self.rr_value is not None:

            self.rr_label.configure(
                text=f"Respiration: {self.rr_value} breaths/min"
            )

            if self.rr_value < RR_MIN or self.rr_value > RR_MAX:
                self.rr_frame.configure(
                    fg_color="#B71C1C"
                )
            else:
                self.rr_frame.configure(
                    fg_color="#1B5E20"
                )

        if self.running:
            self.after(200, self.update_gui)

    # ==========================
    # CLEAN SHUTDOWN
    # ==========================
    def on_closing(self):

        self.running = False

        try:
            if self.ser and self.ser.is_open:
                self.ser.close()
        except:
            pass

        self.destroy()


# ==========================
# MAIN
# ==========================
if __name__ == "__main__":
    app = VitalsApp()
    app.mainloop()