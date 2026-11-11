# config/constants.py

WORKING_SLOTS = [
    {
        "id": "slot_1",
        "label": "Ca 1 (Sáng sớm)",
        "time": "07:30 - 09:00",
        "period": "morning"
    },
    {
        "id": "slot_2",
        "label": "Ca 2 (Giữa sáng)",
        "time": "09:30 - 11:00",
        "period": "morning"
    },
    {
        "id": "slot_3",
        "label": "Ca 3 (Đầu chiều)",
        "time": "13:00 - 14:30",
        "period": "afternoon"
    },
    {
        "id": "slot_4",
        "label": "Ca 4 (Cuối chiều)",
        "time": "15:00 - 16:30",
        "period": "afternoon"
    },
    {
        "id": "slot_5",
        "label": "Ca 5 (Tối)",
        "time": "18:00 - 19:30",
        "period": "evening"
    }
]

SLOT_TIMES = [s["time"] for s in WORKING_SLOTS]

DAYS_OF_WEEK_VN = [
    {"index": 0, "name": "Thứ Hai", "short": "T2"},
    {"index": 1, "name": "Thứ Ba", "short": "T3"},
    {"index": 2, "name": "Thứ Tư", "short": "T4"},
    {"index": 3, "name": "Thứ Năm", "short": "T5"},
    {"index": 4, "name": "Thứ Sáu", "short": "T6"},
    {"index": 5, "name": "Thứ Bảy", "short": "T7"},
    {"index": 6, "name": "Chủ Nhật", "short": "CN"}
]

BOOKING_STATUS = {
    "AVAILABLE": "available",
    "PENDING": "pending",
    "CONFIRMED": "confirmed",
    "REJECTED": "rejected"
}
