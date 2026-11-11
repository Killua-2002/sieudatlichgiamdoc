# src/routes/admin_routes.py
from fastapi import APIRouter, Request, Response, HTTPException, status, Depends
from fastapi.responses import HTMLResponse, RedirectResponse
from pydantic import BaseModel
from typing import Optional, List
from pathlib import Path
from config.settings import BASE_DIR, ADMIN_USERNAME, ADMIN_PASSWORD, COOKIE_NAME
from src.auth import is_admin_authenticated, generate_session_token, require_admin_auth
from src.database import get_db_connection
from src.services.booking_service import generate_mail_client_links
from src.services.template_service import (
    load_templates, get_template_by_id, add_or_update_template, delete_template
)

router = APIRouter()
TEMPLATES_DIR = BASE_DIR / "templates"

class LoginRequest(BaseModel):
    username: str
    password: str

class BookingActionRequest(BaseModel):
    action: str  # 'confirm' or 'reject'
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
    new_status = 'confirmed' if payload.action == 'confirm' else 'rejected'

    # Prepare subject & body
    if payload.custom_subject and payload.custom_body:
        final_subject = payload.custom_subject
        final_body = payload.custom_body
    else:
        tpl = get_template_by_id(payload.template_id or "in_person")
        if not tpl:
            tpl = load_templates()[0]
        final_subject = tpl["subject"].replace("{ngay_hop}", b_dict["meeting_date"])
        final_body = tpl["body"].replace("{ten_cty}", b_dict["company_name"]) \
                                 .replace("{nguoi_lien_he}", b_dict["contact_person"]) \
                                 .replace("{ngay_hop}", b_dict["meeting_date"]) \
                                 .replace("{gio_hop}", b_dict["time_slot"]) \
                                 .replace("{ghi_chu_them}", "")

    # Generate quick mail client links
    mail_links = generate_mail_client_links(b_dict["email"], final_subject, final_body)

    # Save to DB
    cursor.execute("""
        UPDATE bookings 
        SET status = ?, email_sent = ?
        WHERE id = ?
    """, (new_status, final_body, booking_id))
    conn.commit()
    conn.close()

    return {
        "success": True,
        "new_status": new_status,
        "mail_links": mail_links,
        "subject": final_subject,
        "body": final_body,
        "guest_email": b_dict["email"],
        "message": f"Đã cập nhật trạng thái '{new_status}' thành công!"
    }

@router.post("/api/admin/block-slot")
def api_block_slot(payload: BlockSlotRequest, request: Request):
    require_admin_auth(request)
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO bookings (company_name, tax_code, contact_person, phone, email, meeting_date, time_slot, purpose, attendees_count, questions, status)
        VALUES (?, 'NOIBO-001', 'Trợ lý Giám đốc', 'Nội bộ', 'admin@noibo.com', ?, ?, ?, 1, '', 'confirmed')
    """, (f"[LỊCH NỘI BỘ] {payload.reason}", payload.meeting_date, payload.time_slot, payload.reason))
    conn.commit()
    conn.close()
    return {"success": True, "message": f"Đã khóa thành công khung giờ {payload.time_slot} ngày {payload.meeting_date}!"}

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
