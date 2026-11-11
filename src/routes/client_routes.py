# src/routes/client_routes.py
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from typing import Optional
from pathlib import Path
from src.services.booking_service import get_week_slots, create_booking
from src.services.company_service import predict_companies
from config.settings import BASE_DIR

router = APIRouter()

TEMPLATES_DIR = BASE_DIR / "templates"

class BookingRequest(BaseModel):
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

@router.get("/", response_class=HTMLResponse)
def index_page():
    html_file = TEMPLATES_DIR / "index.html"
    with open(html_file, "r", encoding="utf-8") as f:
        return f.read()

@router.get("/api/week-slots")
def api_week_slots(date: Optional[str] = Query(None)):
    data = get_week_slots(date)
    return data

@router.get("/api/search-company")
def api_search_company(q: str = Query("", min_length=1)):
    predictions = predict_companies(q)
    return {"query": q, "results": predictions}

@router.post("/api/bookings")
def api_create_booking(booking: BookingRequest):
    res = create_booking(booking.model_dump())
    if not res["success"]:
        raise HTTPException(status_code=400, detail=res["message"])
    return res
