# config/settings.py
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)

DB_PATH = DATA_DIR / "bookings.db"
TEMPLATES_JSON_PATH = DATA_DIR / "email_templates.json"

ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "Host123")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "000000")
SECRET_KEY = os.getenv("SECRET_KEY", "dk_hop_dn_secure_session_token_2026")
COOKIE_NAME = "host_session_token"

PORT = int(os.getenv("PORT", 8000))
HOST = os.getenv("HOST", "0.0.0.0")
