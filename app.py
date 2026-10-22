import os
import sqlite3
import json
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from typing import Optional
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import requests

app = FastAPI(title="Lịch Hẹn Giám Đốc")

# Email credentials configuration (using App Password)
SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587
SENDER_EMAIL = os.getenv("SENDER_EMAIL", "khangtestmachine@gmail.com")
SENDER_PASSWORD = os.getenv("SENDER_PASSWORD", "qkgwlqqfivmvfrlz")

def send_real_email(to_email: str, subject: str, content: str):
    if not SENDER_PASSWORD:
        return False, "Chưa cấu hình Mật khẩu ứng dụng (App Password)"
    try:
        msg = MIMEMultipart()
        msg['From'] = f"Bộ Phận Trợ Lý Giám Đốc <{SENDER_EMAIL}>"
        msg['To'] = to_email
        msg['Subject'] = subject
        msg.attach(MIMEText(content, 'plain', 'utf-8'))

        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT, timeout=10)
        server.ehlo()
        server.starttls()
        server.ehlo()
        server.login(SENDER_EMAIL, SENDER_PASSWORD)
        server.sendmail(SENDER_EMAIL, [to_email], msg.as_string())
        server.quit()
        return True, "Email đã được gửi thành công!"
    except Exception as e:
        return False, str(e)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = os.path.join(os.path.dirname(__file__), "bookings.db")

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS bookings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            company_name TEXT NOT NULL,
            tax_code TEXT NOT NULL,
            contact_person TEXT NOT NULL,
            phone TEXT NOT NULL,
            email TEXT NOT NULL,
            meeting_date TEXT NOT NULL,
            time_slot TEXT NOT NULL,
            purpose TEXT,
            attendees_count INTEGER DEFAULT 1,
            questions TEXT,
            status TEXT DEFAULT 'pending', -- 'pending', 'confirmed', 'rejected'
            email_sent TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()

init_db()

# Standard working slots
SLOTS = [
    "08:30 - 09:30",
    "09:45 - 10:45",
    "11:00 - 12:00",
    "14:00 - 15:00",
    "15:15 - 16:15",
    "16:30 - 17:30"
]

class BookingCreate(BaseModel):
    company_name: str
    tax_code: str
    contact_person: str
    phone: str
    email: str
    meeting_date: str
    time_slot: str
    purpose: str
    attendees_count: int = 1
    questions: Optional[str] = ""

class BookingAction(BaseModel):
    action: str  # 'confirm' or 'reject'
    template_type: str  # 'in_person', 'online', 'reschedule'
    custom_note: Optional[str] = ""

@app.get("/api/lookup-tax/{tax_code}")
def lookup_tax(tax_code: str):
    tax_code = tax_code.strip()
    try:
        url = f"https://api.vietqr.io/v2/business/{tax_code}"
        res = requests.get(url, timeout=5)
        data = res.json()
        if data.get("code") == "00" and data.get("data"):
            biz = data["data"]
            return {
                "success": True,
                "name": biz.get("name", ""),
                "address": biz.get("address", "")
            }
        return {"success": False, "message": "Không tìm thấy thông tin doanh nghiệp"}
    except Exception as e:
        return {"success": False, "message": str(e)}

@app.get("/api/slots")
def get_slots(date: str):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("""
        SELECT time_slot, status, company_name FROM bookings 
        WHERE meeting_date = ? AND status IN ('pending', 'confirmed')
    """, (date,))
    rows = cursor.fetchall()
    conn.close()

    booked_map = {}
    for r in rows:
        booked_map[r["time_slot"]] = {
            "status": r["status"],
            "company_name": r["company_name"]
        }

    results = []
    for s in SLOTS:
        if s in booked_map:
            results.append({
                "time_slot": s,
                "status": booked_map[s]["status"], # 'confirmed' or 'pending'
                "company_name": booked_map[s]["company_name"]
            })
        else:
            results.append({
                "time_slot": s,
                "status": "available",
                "company_name": None
            })
    return {"date": date, "slots": results}

@app.post("/api/bookings")
def create_booking(booking: BookingCreate):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    # Check if slot already confirmed
    cursor.execute("""
        SELECT id FROM bookings 
        WHERE meeting_date = ? AND time_slot = ? AND status = 'confirmed'
    """, (booking.meeting_date, booking.time_slot))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail="Khung giờ này đã có lịch hẹn được duyệt!")

    cursor.execute("""
        INSERT INTO bookings (company_name, tax_code, contact_person, phone, email, meeting_date, time_slot, purpose, attendees_count, questions, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    """, (
        booking.company_name,
        booking.tax_code,
        booking.contact_person,
        booking.phone,
        booking.email,
        booking.meeting_date,
        booking.time_slot,
        booking.purpose,
        booking.attendees_count,
        booking.questions
    ))
    booking_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return {"success": True, "booking_id": booking_id, "message": "Yêu cầu đặt lịch đã được ghi nhận!"}

@app.get("/api/admin/bookings")
def get_admin_bookings():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("""
        SELECT * FROM bookings ORDER BY meeting_date DESC, time_slot ASC
    """)
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return {"bookings": rows}

@app.post("/api/admin/bookings/{booking_id}/action")
def handle_booking_action(booking_id: int, payload: BookingAction):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM bookings WHERE id = ?", (booking_id,))
    booking = cursor.fetchone()
    if not booking:
        conn.close()
        raise HTTPException(status_code=404, detail="Không tìm thấy lịch hẹn")

    booking = dict(booking)
    new_status = 'confirmed' if payload.action == 'confirm' else 'rejected'

    # Generate Email Content based on template
    templates = {
        "in_person": f"""
Kính gửi Quý Doanh nghiệp {booking['company_name']},
Người liên hệ: {booking['contact_person']}

Chúng tôi trân trọng thông báo: Yêu cầu đặt lịch hẹn với Giám đốc của Quý đơn vị đã được PHÊ DUYỆT.

THÔNG TIN LỊCH HẸN:
- Thời gian: {booking['time_slot']} ngày {booking['meeting_date']}
- Hình thức: Gặp trực tiếp tại Văn phòng
- Địa chỉ: Tầng 12, Tòa nhà Trụ sở, Hà Nội
- Lưu ý: Quý khách vui lòng gửi xe tại hầm B2 và xuất trình CCCD tại lễ tân để nhận thẻ lên tầng.

{payload.custom_note if payload.custom_note else ''}

Trân trọng cảm ơn,
Bộ phận Trợ lý Giám đốc.
""",
        "online": f"""
Kính gửi Quý Doanh nghiệp {booking['company_name']},
Người liên hệ: {booking['contact_person']}

Chúng tôi trân trọng thông báo: Yêu cầu đặt lịch hẹn với Giám đốc của Quý đơn vị đã được PHÊ DUYỆT (HỌP TRỰC TUYẾN).

THÔNG TIN LỊCH HẸN:
- Thời gian: {booking['time_slot']} ngày {booking['meeting_date']}
- Hình thức: Họp Online qua Google Meet
- Đường dẫn tham gia: https://meet.google.com/abc-xyz-meeting
- Nội dung trao đổi: {booking['purpose']}

{payload.custom_note if payload.custom_note else ''}

Trân trọng cảm ơn,
Bộ phận Trợ lý Giám đốc.
""",
        "reschedule": f"""
Kính gửi Quý Doanh nghiệp {booking['company_name']},
Người liên hệ: {booking['contact_person']}

Rất tiếc vào khung giờ {booking['time_slot']} ngày {booking['meeting_date']}, Giám đốc có lịch công tác đột xuất nên không thể tiếp đoàn.

{payload.custom_note if payload.custom_note else 'Kính mong Quý đơn vị thông cảm và chọn lại khung giờ khác trên hệ thống.'}

Trân trọng cảm ơn,
Bộ phận Trợ lý Giám đốc.
"""
    }

    email_body = templates.get(payload.template_type, templates["in_person"])

    # Attempt to send real email
    subject = f"[{'XÁC NHẬN' if new_status == 'confirmed' else 'THÔNG BÁO'}] Lịch hẹn làm việc với Giám đốc ({booking['meeting_date']})"
    email_success, email_msg = send_real_email(booking['email'], subject, email_body)

    cursor.execute("""
        UPDATE bookings 
        SET status = ?, email_sent = ?
        WHERE id = ?
    """, (new_status, email_body, booking_id))
    conn.commit()
    conn.close()

    result_note = "Email thật đã được gửi tới hộp thư khách!" if email_success else f"Mô phỏng lưu email thành công (Chi tiết: {email_msg})"

    return {
        "success": True, 
        "new_status": new_status, 
        "email_preview": email_body,
        "email_sent_real": email_success,
        "message": f"Đã duyệt lịch hẹn! {result_note}"
    }

# Read templates
INDEX_HTML = os.path.join(os.path.dirname(__file__), "templates", "index.html")
ADMIN_HTML = os.path.join(os.path.dirname(__file__), "templates", "admin.html")

@app.get("/", response_class=HTMLResponse)
def serve_index():
    with open(INDEX_HTML, "r", encoding="utf-8") as f:
        return f.read()

@app.get("/admin", response_class=HTMLResponse)
def serve_admin():
    with open(ADMIN_HTML, "r", encoding="utf-8") as f:
        return f.read()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)
