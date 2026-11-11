# src/database.py
import sqlite3
from typing import Generator
from config.settings import DB_PATH

def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
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
            status TEXT DEFAULT 'pending', -- 'pending', 'confirmed', 'rescheduled', 'cancelled', 'completed'
            email_sent TEXT,
            client_ip TEXT,
            booking_type TEXT DEFAULT 'business', -- 'business' or 'individual'
            is_sig_member INTEGER DEFAULT 0,     -- 1 if member of SIG, 0 otherwise
            department TEXT,                      -- Khoa / Phòng / Bộ phận
            location TEXT,                        -- Địa điểm họp
            google_calendar_url TEXT,             -- Link thêm nhanh vào Google Calendar
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Check and migrate columns if missing
    cursor.execute("PRAGMA table_info(bookings)")
    columns = [row["name"] for row in cursor.fetchall()]

    new_columns = [
        ("client_ip", "TEXT"),
        ("booking_type", "TEXT DEFAULT 'business'"),
        ("is_sig_member", "INTEGER DEFAULT 0"),
        ("department", "TEXT"),
        ("location", "TEXT"),
        ("google_calendar_url", "TEXT")
    ]

    for col_name, col_type in new_columns:
        if col_name not in columns:
            cursor.execute(f"ALTER TABLE bookings ADD COLUMN {col_name} {col_type}")

    conn.commit()
    conn.close()
