# src/routes/client_routes.py
from datetime import datetime
from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from typing import Optional
from pathlib import Path
from src.services.booking_service import get_week_slots, get_month_slots, create_booking
from src.services.company_service import predict_companies
from config.constants import LOCATIONS
from config.settings import BASE_DIR

router = APIRouter()

TEMPLATES_DIR = BASE_DIR / "templates"

def get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"

class BookingRequest(BaseModel):
    company_name: str
    tax_code: Optional[str] = ""
    contact_person: str
    phone: str
    email: str
    meeting_date: str
    time_slot: str
    purpose: str
    attendees_count: int = 1
    questions: Optional[str] = ""
    booking_type: Optional[str] = "business" # 'business' or 'individual'
    is_sig_member: Optional[bool] = False
    department: Optional[str] = ""
    location: Optional[str] = "Phòng Giám Đốc Bệnh Viện (Lầu 9)"

@router.get("/", response_class=HTMLResponse)
def index_page():
    html_file = TEMPLATES_DIR / "index.html"
    with open(html_file, "r", encoding="utf-8") as f:
        return f.read()

@router.get("/api/locations")
def api_locations():
    return {"locations": LOCATIONS}

@router.get("/api/week-slots")
def api_week_slots(request: Request, date: Optional[str] = Query(None)):
    client_ip = get_client_ip(request)
    data = get_week_slots(target_date_str=date, client_ip=client_ip, is_admin=False)
    return data

@router.get("/api/month-slots")
def api_month_slots(request: Request, year: Optional[int] = Query(None), month: Optional[int] = Query(None)):
    client_ip = get_client_ip(request)
    now = datetime.now()
    y = year or now.year
    m = month or now.month
    data = get_month_slots(year=y, month=m, client_ip=client_ip, is_admin=False)
    return data

@router.get("/api/search-company")
def api_search_company(q: str = Query("", min_length=1)):
    predictions = predict_companies(q)
    return {"query": q, "results": predictions}

@router.post("/api/bookings")
def api_create_booking(booking: BookingRequest, request: Request):
    client_ip = get_client_ip(request)
    res = create_booking(booking.model_dump(), client_ip=client_ip)
    if not res["success"]:
        raise HTTPException(status_code=400, detail=res["message"])
    return res
