# src/services/booking_service.py
from datetime import datetime, timedelta
import calendar
import urllib.parse
from typing import Dict, Any, List, Optional
from config.constants import WORKING_SLOTS, DAYS_OF_WEEK_VN, BOOKING_STATUS, LOCATIONS
from src.database import get_db_connection

def parse_date(date_str: str) -> datetime:
    return datetime.strptime(date_str, "%Y-%m-%d")

def get_monday_of_week(dt: datetime) -> datetime:
    # weekday(): Monday is 0, Sunday is 6
    return dt - timedelta(days=dt.weekday())

def generate_google_calendar_link(title: str, date_str: str, time_slot: str, location: str, description: str) -> str:
    # Find matching slot to get start and end time
    start_t = "08:00"
    end_t = "09:00"
    for s in WORKING_SLOTS:
        if s["time"] == time_slot:
            start_t = s["start_time"]
            end_t = s["end_time"]
            break

    # Format YYYYMMDDTHHmmss
    clean_date = date_str.replace("-", "")
    start_dt = f"{clean_date}T{start_t.replace(':', '')}00"
    end_dt = f"{clean_date}T{end_t.replace(':', '')}00"
    dates_param = f"{start_dt}/{end_dt}&ctz=Asia/Ho_Chi_Minh"

    params = {
        "action": "TEMPLATE",
        "text": title,
        "details": description,
        "location": location,
        "dates": f"{start_dt}/{end_dt}",
        "ctz": "Asia/Ho_Chi_Minh"
    }
    
    query = urllib.parse.urlencode(params)
    return f"https://calendar.google.com/calendar/render?{query}"

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
        SELECT id, company_name, tax_code, contact_person, meeting_date, time_slot, status, purpose, client_ip, booking_type, location, department 
        FROM bookings 
        WHERE meeting_date IN ({placeholders}) AND status NOT IN ('cancelled')
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
            "client_ip": r["client_ip"],
            "booking_type": r["booking_type"],
            "location": r["location"],
            "department": r["department"]
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

            # Check priority status
            confirmed_bk = next((b for b in slot_bookings if b["status"] in ("confirmed", "completed")), None)
            rescheduled_bk = next((b for b in slot_bookings if b["status"] == "rescheduled"), None)
            pending_bks = [b for b in slot_bookings if b["status"] == "pending"]

            if confirmed_bk:
                # Slot is locked / confirmed for EVERYONE
                slot_status = confirmed_bk["status"]
                comp = confirmed_bk["company_name"]
                b_id = confirmed_bk["id"]
                pending_count = 0
                is_my_pending = False
            elif rescheduled_bk and not pending_bks:
                slot_status = BOOKING_STATUS["RESCHEDULED"]
                comp = f"[Đã dời] {rescheduled_bk['company_name']}"
                b_id = rescheduled_bk["id"]
                pending_count = 0
                is_my_pending = False
            elif pending_bks:
                pending_count = len(pending_bks)
                my_booking = next((b for b in pending_bks if b["client_ip"] and b["client_ip"] == client_ip), None)
                is_my_pending = my_booking is not None

                if is_admin:
                    slot_status = BOOKING_STATUS["PENDING"]
                    comp = f"Có {pending_count} phiếu chờ ({', '.join([b['company_name'] for b in pending_bks[:2]])})"
                    b_id = pending_bks[0]["id"]
                else:
                    if is_my_pending:
                        slot_status = BOOKING_STATUS["PENDING"]
                        comp = "Phiếu của bạn đang chờ duyệt"
                        b_id = my_booking["id"]
                    else:
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

def get_month_slots(year: int, month: int, client_ip: Optional[str] = None, is_admin: bool = False) -> Dict[str, Any]:
    first_day_weekday, num_days = calendar.monthrange(year, month)
    # weekday of 1st day: 0=Mon, 6=Sun
    month_start = f"{year:04d}-{month:02d}-01"
    month_end = f"{year:04d}-{month:02d}-{num_days:02d}"

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, company_name, tax_code, contact_person, meeting_date, time_slot, status, client_ip 
        FROM bookings 
        WHERE meeting_date BETWEEN ? AND ? AND status NOT IN ('cancelled')
    """, (month_start, month_end))
    rows = cursor.fetchall()
    conn.close()

    bookings_by_date = {}
    for r in rows:
        d = r["meeting_date"]
        if d not in bookings_by_date:
            bookings_by_date[d] = []
        bookings_by_date[d].append(dict(r))

    days_data = []
    today_str = datetime.now().strftime("%Y-%m-%d")

    for day_num in range(1, num_days + 1):
        d_str = f"{year:04d}-{month:02d}-{day_num:02d}"
        dt = datetime(year, month, day_num)
        vn_day = DAYS_OF_WEEK_VN[dt.weekday()]
        day_bks = bookings_by_date.get(d_str, [])

        confirmed_count = len([b for b in day_bks if b["status"] in ("confirmed", "completed")])
        pending_count = len([b for b in day_bks if b["status"] == "pending"])
        available_count = max(0, 5 - confirmed_count)

        days_data.append({
            "date": d_str,
            "day_number": day_num,
            "day_name": vn_day["name"],
            "short_name": vn_day["short"],
            "is_today": d_str == today_str,
            "confirmed_count": confirmed_count,
            "pending_count": pending_count,
            "available_count": available_count,
            "total_slots": 5
        })

    # Prev and Next month dates
    if month == 1:
        prev_m_year, prev_m_month = year - 1, 12
    else:
        prev_m_year, prev_m_month = year, month - 1

    if month == 12:
        next_m_year, next_m_month = year + 1, 1
    else:
        next_m_year, next_m_month = year, month + 1

    return {
        "year": year,
        "month": month,
        "month_label": f"Tháng {month:02d}/{year}",
        "first_day_weekday": first_day_weekday,
        "num_days": num_days,
        "prev_month_date": f"{prev_m_year:04d}-{prev_m_month:02d}-01",
        "next_month_date": f"{next_m_year:04d}-{next_m_month:02d}-01",
        "days": days_data
    }

def create_booking(data: Dict[str, Any], client_ip: Optional[str] = None) -> Dict[str, Any]:
    conn = get_db_connection()
    cursor = conn.cursor()

    # Check if slot already confirmed by host
    cursor.execute("""
        SELECT id FROM bookings 
        WHERE meeting_date = ? AND time_slot = ? AND status IN ('confirmed', 'completed')
    """, (data["meeting_date"], data["time_slot"]))
    if cursor.fetchone():
        conn.close()
        return {"success": False, "message": "Khung giờ này đã được Giám đốc chốt lịch hoặc khóa nội bộ!"}

    # Generate Google Calendar Link
    calendar_link = generate_google_calendar_link(
        title=f"Lịch họp Giám đốc - {data['company_name']}",
        date_str=data["meeting_date"],
        time_slot=data["time_slot"],
        location=data.get("location", "Phòng Giám Đốc Bệnh Viện (Lầu 9)"),
        description=f"Nội dung: {data.get('purpose', '')} - Người liên hệ: {data.get('contact_person', '')}"
    )

    cursor.execute("""
        INSERT INTO bookings (
            company_name, tax_code, contact_person, phone, email, 
            meeting_date, time_slot, purpose, attendees_count, questions, 
            status, client_ip, booking_type, is_sig_member, department, 
            location, google_calendar_url
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?)
    """, (
        data["company_name"],
        data.get("tax_code", ""),
        data["contact_person"],
        data["phone"],
        data["email"],
        data["meeting_date"],
        data["time_slot"],
        data.get("purpose", ""),
        data.get("attendees_count", 1),
        data.get("questions", ""),
        client_ip,
        data.get("booking_type", "business"),
        1 if data.get("is_sig_member") else 0,
        data.get("department", ""),
        data.get("location", "Phòng Giám Đốc Bệnh Viện (Lầu 9)"),
        calendar_link
    ))
    new_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return {
        "success": True, 
        "booking_id": new_id, 
        "google_calendar_link": calendar_link,
        "message": "Đã gửi phiếu đăng ký thành công! Đang chờ Trợ lý xác nhận."
    }

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
        calendar_link = generate_google_calendar_link(
            title=f"Lịch bận Giám đốc: {reason}",
            date_str=meeting_date,
            time_slot=time_slot,
            location="Phòng Giám Đốc Bệnh Viện (Lầu 9)",
            description=reason
        )

        cursor.execute("""
            INSERT INTO bookings (
                company_name, tax_code, contact_person, phone, email, 
                meeting_date, time_slot, purpose, attendees_count, questions, 
                status, client_ip, booking_type, location, google_calendar_url
            )
            VALUES (?, 'NOIBO-001', 'Trợ lý Giám đốc', 'Nội bộ', 'admin@noibo.com', ?, ?, ?, 1, '', 'confirmed', '127.0.0.1', 'business', 'Phòng Giám Đốc Bệnh Viện (Lầu 9)', ?)
        """, (f"[LỊCH NỘI BỘ] {reason}", meeting_date, time_slot, reason, calendar_link))
        conn.commit()
        conn.close()
        return {"success": True, "action": "locked", "message": f"Đã khóa ca {time_slot} ngày {meeting_date} (Giám đốc bận)!"}

def generate_mail_client_links(to_email: str, subject: str, body: str) -> Dict[str, str]:
    encoded_to = urllib.parse.quote(to_email)
    encoded_sub = urllib.parse.quote(subject)
    encoded_body = urllib.parse.quote(body)

    gmail_url = f"https://mail.google.com/mail/?view=cm&fs=1&to={encoded_to}&su={encoded_sub}&body={encoded_body}"
    mailto_url = f"mailto:{encoded_to}?subject={encoded_sub}&body={encoded_body}"

    return {
        "gmail_url": gmail_url,
        "mailto_url": mailto_url
    }
