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
            status TEXT DEFAULT 'pending', -- 'pending', 'confirmed', 'rejected'
            email_sent TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()
