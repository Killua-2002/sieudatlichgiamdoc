# src/services/booking_service.py
from datetime import datetime, timedelta
import urllib.parse
from typing import Dict, Any, List, Optional
from config.constants import WORKING_SLOTS, DAYS_OF_WEEK_VN, BOOKING_STATUS
from src.database import get_db_connection

def parse_date(date_str: str) -> datetime:
    return datetime.strptime(date_str, "%Y-%m-%d")

def get_monday_of_week(dt: datetime) -> datetime:
    # weekday(): Monday is 0, Sunday is 6
    return dt - timedelta(days=dt.weekday())

def get_week_slots(target_date_str: Optional[str] = None, client_ip: Optional[str] = None, is_admin: bool = False) -> Dict[str, Any]:
    if not target_date_str:
        today = datetime.now()
    else:
        try:
            today = parse_date(target_date_str)
        except Exception:
            today = datetime.now()

    monday = get_monday_of_week(today)
    week_days = []
    date_strings = []

    for i in range(7):
        day_dt = monday + timedelta(days=i)
        day_str = day_dt.strftime("%Y-%m-%d")
        date_strings.append(day_str)
        vn_day = DAYS_OF_WEEK_VN[i]
        is_today = day_str == datetime.now().strftime("%Y-%m-%d")

        week_days.append({
            "date": day_str,
            "day_name": vn_day["name"],
            "short_name": vn_day["short"],
            "day_number": day_dt.strftime("%d/%m"),
            "full_date_label": f"{vn_day['name']}, {day_dt.strftime('%d/%m/%Y')}",
            "is_today": is_today,
            "weekday_index": i
        })

    # Query DB for bookings in this week
    conn = get_db_connection()
    cursor = conn.cursor()
    placeholders = ",".join("?" for _ in date_strings)
    cursor.execute(f"""
        SELECT id, company_name, tax_code, contact_person, meeting_date, time_slot, status, purpose, client_ip 
        FROM bookings 
        WHERE meeting_date IN ({placeholders}) AND status IN ('pending', 'confirmed')
    """, date_strings)
    rows = cursor.fetchall()
    conn.close()

    # Group bookings by key: date_timeslot
    booked_map = {}
    for r in rows:
        key = f"{r['meeting_date']}_{r['time_slot']}"
        if key not in booked_map:
            booked_map[key] = []
        booked_map[key].append({
            "id": r["id"],
            "status": r["status"],
            "company_name": r["company_name"],
            "contact_person": r["contact_person"],
            "purpose": r["purpose"],
            "client_ip": r["client_ip"]
        })

    # Construct matrix: 7 days, each having 5 shifts
    days_data = []
    for day_info in week_days:
        day_slots = []
        d_str = day_info["date"]

        for slot_def in WORKING_SLOTS:
            s_time = slot_def["time"]
            key = f"{d_str}_{s_time}"
            slot_bookings = booked_map.get(key, [])

            # Check if there is a confirmed booking
            confirmed_bk = next((b for b in slot_bookings if b["status"] == "confirmed"), None)
            pending_bks = [b for b in slot_bookings if b["status"] == "pending"]

            if confirmed_bk:
                # Slot is locked / confirmed for EVERYONE
                slot_status = BOOKING_STATUS["CONFIRMED"]
                comp = confirmed_bk["company_name"]
                b_id = confirmed_bk["id"]
                pending_count = 0
                is_my_pending = False
            elif pending_bks:
                # Slot has pending booking(s)
                pending_count = len(pending_bks)
                # Check if current client IP booked this slot
                my_booking = next((b for b in pending_bks if b["client_ip"] and b["client_ip"] == client_ip), None)
                is_my_pending = my_booking is not None

                if is_admin:
                    # Admin sees all pending
                    slot_status = BOOKING_STATUS["PENDING"]
                    comp = f"Có {pending_count} phiếu chờ duyệt ({', '.join([b['company_name'] for b in pending_bks[:2]])})"
                    b_id = pending_bks[0]["id"]
                else:
                    if is_my_pending:
                        # The user who placed the booking sees yellow PENDING
                        slot_status = BOOKING_STATUS["PENDING"]
                        comp = "Phiếu của bạn đang chờ duyệt"
                        b_id = my_booking["id"]
                    else:
                        # OTHER USERS with different IP still see this slot as AVAILABLE!
                        slot_status = BOOKING_STATUS["AVAILABLE"]
                        comp = None
                        b_id = None
            else:
                slot_status = BOOKING_STATUS["AVAILABLE"]
                comp = None
                b_id = None
                pending_count = 0
                is_my_pending = False

            day_slots.append({
                "slot_id": slot_def["id"],
                "label": slot_def["label"],
                "time": s_time,
                "period": slot_def["period"],
                "status": slot_status,
                "company_name": comp,
                "booking_id": b_id,
                "pending_count": pending_count,
                "is_my_pending": is_my_pending
            })

        days_data.append({
            "day_info": day_info,
            "slots": day_slots
        })

    prev_week = (monday - timedelta(days=7)).strftime("%Y-%m-%d")
    next_week = (monday + timedelta(days=7)).strftime("%Y-%m-%d")

    return {
        "start_date": monday.strftime("%Y-%m-%d"),
        "end_date": (monday + timedelta(days=6)).strftime("%Y-%m-%d"),
        "prev_week_date": prev_week,
        "next_week_date": next_week,
        "working_slots": WORKING_SLOTS,
        "days": days_data
    }

def create_booking(data: Dict[str, Any], client_ip: Optional[str] = None) -> Dict[str, Any]:
    conn = get_db_connection()
    cursor = conn.cursor()

    # Check if slot already confirmed by host
    cursor.execute("""
        SELECT id FROM bookings 
        WHERE meeting_date = ? AND time_slot = ? AND status = 'confirmed'
    """, (data["meeting_date"], data["time_slot"]))
    if cursor.fetchone():
        conn.close()
        return {"success": False, "message": "Khung giờ này đã được Giám đốc chốt lịch hoặc khóa nội bộ!"}

    cursor.execute("""
        INSERT INTO bookings (company_name, tax_code, contact_person, phone, email, meeting_date, time_slot, purpose, attendees_count, questions, status, client_ip)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
    """, (
        data["company_name"],
        data["tax_code"],
        data["contact_person"],
        data["phone"],
        data["email"],
        data["meeting_date"],
        data["time_slot"],
        data["purpose"],
        data.get("attendees_count", 1),
        data.get("questions", ""),
        client_ip
    ))
    new_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return {"success": True, "booking_id": new_id, "message": "Đã gửi phiếu đăng ký thành công! Đang chờ Trợ lý xác nhận."}

def toggle_admin_slot_lock(meeting_date: str, time_slot: str, reason: str = "Giám đốc bận việc riêng / Họp nội bộ") -> Dict[str, Any]:
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT id, tax_code, company_name, status FROM bookings 
        WHERE meeting_date = ? AND time_slot = ? AND status = 'confirmed'
    """, (meeting_date, time_slot))
    existing_lock = cursor.fetchone()

    if existing_lock:
        # Unlock this slot
        cursor.execute("DELETE FROM bookings WHERE id = ?", (existing_lock["id"],))
        conn.commit()
        conn.close()
        return {"success": True, "action": "unlocked", "message": f"Đã mở lại ca {time_slot} ngày {meeting_date} thành Còn trống!"}
    else:
        # Lock this slot directly as confirmed
        cursor.execute("""
            INSERT INTO bookings (company_name, tax_code, contact_person, phone, email, meeting_date, time_slot, purpose, attendees_count, questions, status, client_ip)
            VALUES (?, 'NOIBO-001', 'Trợ lý Giám đốc', 'Nội bộ', 'admin@noibo.com', ?, ?, ?, 1, '', 'confirmed', '127.0.0.1')
        """, (f"[LỊCH NỘI BỘ] {reason}", meeting_date, time_slot, reason))
        conn.commit()
        conn.close()
        return {"success": True, "action": "locked", "message": f"Đã khóa ca {time_slot} ngày {meeting_date} (Giám đốc bận)!"}


def generate_mail_client_links(to_email: str, subject: str, body: str) -> Dict[str, str]:
    encoded_to = urllib.parse.quote(to_email)
    encoded_sub = urllib.parse.quote(subject)
    encoded_body = urllib.parse.quote(body)

    # Gmail Web Compose URL
    gmail_url = f"https://mail.google.com/mail/?view=cm&fs=1&to={encoded_to}&su={encoded_sub}&body={encoded_body}"

    # Native Mail Client mailto: protocol
    mailto_url = f"mailto:{encoded_to}?subject={encoded_sub}&body={encoded_body}"

    return {
        "gmail_url": gmail_url,
        "mailto_url": mailto_url
    }
