# src/routes/admin_routes.py
from datetime import datetime
from fastapi import APIRouter, Request, Response, HTTPException, status, Depends
from fastapi.responses import HTMLResponse, RedirectResponse
from pydantic import BaseModel
from typing import Optional, List
from pathlib import Path
from config.settings import BASE_DIR, ADMIN_USERNAME, ADMIN_PASSWORD, COOKIE_NAME
from config.constants import LOCATIONS
from src.auth import is_admin_authenticated, generate_session_token, require_admin_auth
from src.database import get_db_connection
from src.services.booking_service import (
    generate_mail_client_links, get_week_slots, get_month_slots, 
    toggle_admin_slot_lock, generate_google_calendar_link
)
from src.services.template_service import (
    load_templates, get_template_by_id, add_or_update_template, delete_template
)

router = APIRouter()
TEMPLATES_DIR = BASE_DIR / "templates"

class LoginRequest(BaseModel):
    username: str
    password: str

class BookingActionRequest(BaseModel):
    action: str  # 'confirm', 'reschedule', 'cancel', 'complete'
    template_id: Optional[str] = "in_person"
    custom_subject: Optional[str] = ""
    custom_body: Optional[str] = ""

class BlockSlotRequest(BaseModel):
    meeting_date: str
    time_slot: str
    reason: Optional[str] = "Giám đốc bận việc nội bộ / Họp HĐQT"

class TemplateUpdateRequest(BaseModel):
    id: str
    title: str
    subject: str
    body: str

@router.get("/login", response_class=HTMLResponse)
def login_page(request: Request):
    if is_admin_authenticated(request):
        return RedirectResponse(url="/admin", status_code=status.HTTP_302_FOUND)
    html_file = TEMPLATES_DIR / "login.html"
    with open(html_file, "r", encoding="utf-8") as f:
        return f.read()

@router.post("/api/admin/login")
def api_login(payload: LoginRequest, response: Response):
    if payload.username == ADMIN_USERNAME and payload.password == ADMIN_PASSWORD:
        token = generate_session_token(payload.username)
        response.set_cookie(
            key=COOKIE_NAME,
            value=token,
            httponly=True,
            samesite="lax",
            max_age=86400 * 7 # 7 days
        )
        return {"success": True, "message": "Đăng nhập thành công!"}
    raise HTTPException(status_code=400, detail="Sai tên đăng nhập hoặc mật khẩu! (Host123 / 000000)")

@router.get("/api/admin/logout")
def api_logout(response: Response):
    response.delete_cookie(COOKIE_NAME)
    return RedirectResponse(url="/login", status_code=status.HTTP_302_FOUND)

@router.get("/admin", response_class=HTMLResponse)
def admin_page(request: Request):
    if not is_admin_authenticated(request):
        return RedirectResponse(url="/login", status_code=status.HTTP_302_FOUND)
    html_file = TEMPLATES_DIR / "admin.html"
    with open(html_file, "r", encoding="utf-8") as f:
        return f.read()

@router.get("/admin/templates", response_class=HTMLResponse)
def admin_templates_page(request: Request):
    if not is_admin_authenticated(request):
        return RedirectResponse(url="/login", status_code=status.HTTP_302_FOUND)
    html_file = TEMPLATES_DIR / "admin_templates.html"
    with open(html_file, "r", encoding="utf-8") as f:
        return f.read()

@router.get("/api/admin/week-slots")
def api_admin_week_slots(request: Request, date: Optional[str] = None):
    require_admin_auth(request)
    data = get_week_slots(target_date_str=date, is_admin=True)
    return data

@router.get("/api/admin/month-slots")
def api_admin_month_slots(request: Request, year: Optional[int] = None, month: Optional[int] = None):
    require_admin_auth(request)
    now = datetime.now()
    y = year or now.year
    m = month or now.month
    return get_month_slots(year=y, month=m, is_admin=True)

@router.post("/api/admin/toggle-slot-lock")
def api_toggle_slot_lock(payload: BlockSlotRequest, request: Request):
    require_admin_auth(request)
    res = toggle_admin_slot_lock(payload.meeting_date, payload.time_slot, payload.reason or "Giám đốc bận")
    return res

@router.get("/api/admin/bookings")
def api_get_admin_bookings(request: Request):
    require_admin_auth(request)
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT * FROM bookings ORDER BY meeting_date DESC, time_slot ASC
    """)
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return {"bookings": rows}

@router.post("/api/admin/bookings/{booking_id}/action")
def api_booking_action(booking_id: int, payload: BookingActionRequest, request: Request):
    require_admin_auth(request)
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM bookings WHERE id = ?", (booking_id,))
    booking = cursor.fetchone()
    if not booking:
        conn.close()
        raise HTTPException(status_code=404, detail="Không tìm thấy lịch hẹn")

    b_dict = dict(booking)

    # Status mapping
    status_map = {
        "confirm": "confirmed",
        "reschedule": "rescheduled",
        "cancel": "cancelled",
        "complete": "completed"
    }
    new_status = status_map.get(payload.action, "confirmed")

    # Generate or retrieve Google Calendar Link
    cal_link = b_dict.get("google_calendar_url")
    if not cal_link:
        cal_link = generate_google_calendar_link(
            title=f"Lịch họp Giám đốc - {b_dict['company_name']}",
            date_str=b_dict["meeting_date"],
            time_slot=b_dict["time_slot"],
            location=b_dict.get("location", "Phòng Giám Đốc Bệnh Viện (Lầu 9)"),
            description=f"Nội dung: {b_dict.get('purpose', '')} - Đại diện: {b_dict.get('contact_person', '')}"
        )

    # Prepare subject & body
    if payload.custom_subject and payload.custom_body:
        final_subject = payload.custom_subject
        final_body = payload.custom_body
    else:
        tpl = get_template_by_id(payload.template_id or "in_person")
        if not tpl:
            tpl = load_templates()[0]
        
        is_individual = b_dict.get("booking_type") == "individual"
        loai_doi_tuong = "Anh/Chị" if is_individual else "Quý Doanh nghiệp/Tổ chức"
        ten_doi_tuong = b_dict["contact_person"] if is_individual else b_dict["company_name"]

        final_subject = tpl["subject"].replace("{ngay_hop}", b_dict["meeting_date"])
        final_body = tpl["body"] \
            .replace("{loai_doi_tuong}", loai_doi_tuong) \
            .replace("{ten_doi_tuong}", ten_doi_tuong) \
            .replace("{ten_cty}", b_dict["company_name"]) \
            .replace("{nguoi_lien_he}", b_dict["contact_person"]) \
            .replace("{ngay_hop}", b_dict["meeting_date"]) \
            .replace("{gio_hop}", b_dict["time_slot"]) \
            .replace("{dia_diem}", b_dict.get("location", "Phòng Giám Đốc Bệnh Viện (Lầu 9)")) \
            .replace("{muc_dich}", b_dict.get("purpose", "Trao đổi công tác")) \
            .replace("{google_calendar_link}", cal_link) \
            .replace("{ghi_chu_them}", "")

    # Generate quick mail client links
    mail_links = generate_mail_client_links(b_dict["email"], final_subject, final_body)

    # Save to DB
    cursor.execute("""
        UPDATE bookings 
        SET status = ?, email_sent = ?, google_calendar_url = ?
        WHERE id = ?
    """, (new_status, final_body, cal_link, booking_id))
    conn.commit()
    conn.close()

    status_labels = {
        "confirmed": "Đã phê duyệt (Đã xác nhận)",
        "rescheduled": "Đã dời lịch hẹn",
        "cancelled": "Đã từ chối / Hủy lịch",
        "completed": "Đã hoàn thành buổi họp"
    }

    return {
        "success": True,
        "new_status": new_status,
        "status_label": status_labels.get(new_status, new_status),
        "mail_links": mail_links,
        "google_calendar_link": cal_link,
        "subject": final_subject,
        "body": final_body,
        "guest_email": b_dict["email"],
        "message": f"Đã cập nhật trạng thái: {status_labels.get(new_status, new_status)}!"
    }

@router.get("/api/admin/templates")
def api_get_templates(request: Request):
    require_admin_auth(request)
    return {"templates": load_templates()}

@router.post("/api/admin/templates")
def api_save_template(payload: TemplateUpdateRequest, request: Request):
    require_admin_auth(request)
    add_or_update_template(payload.id, payload.title, payload.subject, payload.body)
    return {"success": True, "message": "Đã lưu mẫu email thành công!"}

@router.delete("/api/admin/templates/{tpl_id}")
def api_delete_template(tpl_id: str, request: Request):
    require_admin_auth(request)
    ok = delete_template(tpl_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Không tìm thấy mẫu email để xóa")
    return {"success": True, "message": "Đã xóa mẫu email!"}
