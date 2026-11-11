# config/constants.py

WORKING_SLOTS = [
    {
        "id": "slot_1",
        "label": "Ca 1 (Sáng sớm)",
        "time": "07:30 - 09:00",
        "start_time": "07:30",
        "end_time": "09:00",
        "period": "morning"
    },
    {
        "id": "slot_2",
        "label": "Ca 2 (Giữa sáng)",
        "time": "09:30 - 11:00",
        "start_time": "09:30",
        "end_time": "11:00",
        "period": "morning"
    },
    {
        "id": "slot_3",
        "label": "Ca 3 (Đầu chiều)",
        "time": "13:00 - 14:30",
        "start_time": "13:00",
        "end_time": "14:30",
        "period": "afternoon"
    },
    {
        "id": "slot_4",
        "label": "Ca 4 (Cuối chiều)",
        "time": "15:00 - 16:30",
        "start_time": "15:00",
        "end_time": "16:30",
        "period": "afternoon"
    },
    {
        "id": "slot_5",
        "label": "Ca 5 (Tối)",
        "time": "18:00 - 19:30",
        "start_time": "18:00",
        "end_time": "19:30",
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
    "PENDING": "pending",         # ⏳ Chờ duyệt
    "CONFIRMED": "confirmed",     # ✓ Đã xác nhận
    "RESCHEDULED": "rescheduled", # 🔄 Đã dời lịch
    "CANCELLED": "cancelled",     # ✕ Đã hủy / Từ chối
    "COMPLETED": "completed",     # 🎯 Đã hoàn thành
    "AVAILABLE": "available"      # ● Còn trống
}

BOOKING_TYPES = {
    "BUSINESS": "business",       # Doanh nghiệp
    "INDIVIDUAL": "individual"    # Cá nhân
}

LOCATIONS = [
    {
        "id": "phong_gd_lau9",
        "name": "Phòng Giám Đốc Bệnh Viện (Lầu 9)",
        "address": "Lầu 9, Bệnh Viện",
        "type": "offline"
    },
    {
        "id": "phong_hop_lau8_tvc",
        "name": "Phòng họp Lầu 8, Tòa nhà 9-15 Trịnh Văn Cấn",
        "address": "Lầu 8, 9-15 Trịnh Văn Cấn, P. Cầu Ông Lãnh, Quận 1, TP. HCM",
        "type": "offline"
    },
    {
        "id": "phong_hop_lau7_tvc",
        "name": "Phòng họp Lầu 7, Tòa nhà 1-3 Trịnh Văn Cấn",
        "address": "Lầu 7, 1-3 Trịnh Văn Cấn, P. Cầu Ông Lãnh, Quận 1, TP. HCM",
        "type": "offline"
    },
    {
        "id": "online_meet",
        "name": "Họp Trực Tuyến (Online Google Meet / Zoom)",
        "address": "https://meet.google.com/abc-xyz-meeting",
        "type": "online"
    }
]
