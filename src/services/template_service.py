# src/services/template_service.py
import json
from typing import List, Dict, Any, Optional
from config.settings import TEMPLATES_JSON_PATH

DEFAULT_TEMPLATES = [
    {
        "id": "in_person",
        "title": "Gặp tại Văn phòng",
        "subject": "[XÁC NHẬN] Lịch hẹn làm việc với Giám đốc ({ngay_hop})",
        "body": "Kính gửi Quý Doanh nghiệp {ten_cty},\nNgười liên hệ: {nguoi_lien_he}\n\nChúng tôi trân trọng thông báo: Yêu cầu đặt lịch hẹn với Giám đốc của Quý đơn vị đã được PHÊ DUYỆT.\n\nTHÔNG TIN LỊCH HẸN:\n- Thời gian: {gio_hop} ngày {ngay_hop}\n- Hình thức: Gặp trực tiếp tại Văn phòng\n- Địa chỉ: Tầng 12, Tòa nhà Trụ sở, TP. Hà Nội\n- Lưu ý: Quý khách vui lòng gửi xe tại hầm B2 và xuất trình CCCD tại bàn lễ tân để nhận thẻ lên tầng.\n\n{ghi_chu_them}\n\nTrân trọng cảm ơn,\nBộ phận Trợ lý Giám đốc."
    },
    {
        "id": "online",
        "title": "Họp Trực Tuyến (Google Meet)",
        "subject": "[XÁC NHẬN] Lịch họp trực tuyến với Giám đốc ({ngay_hop})",
        "body": "Kính gửi Quý Doanh nghiệp {ten_cty},\nNgười liên hệ: {nguoi_lien_he}\n\nChúng tôi trân trọng thông báo: Yêu cầu đặt lịch hẹn với Giám đốc của Quý đơn vị đã được PHÊ DUYỆT (HỌP TRỰC TUYẾN).\n\nTHÔNG TIN LỊCH HẸN:\n- Thời gian: {gio_hop} ngày {ngay_hop}\n- Hình thức: Họp Trực Tuyến qua Google Meet\n- Đường dẫn tham gia: https://meet.google.com/abc-xyz-meeting\n- Nội dung trao đổi: Trao đổi công việc theo phiếu đăng ký\n\n{ghi_chu_them}\n\nTrân trọng cảm ơn,\nBộ phận Trợ lý Giám đốc."
    },
    {
        "id": "reschedule",
        "title": "Đổi giờ / Sếp bận công tác",
        "subject": "[THÔNG BÁO] Về việc điều chỉnh lịch hẹn làm việc với Giám đốc ({ngay_hop})",
        "body": "Kính gửi Quý Doanh nghiệp {ten_cty},\nNgười liên hệ: {nguoi_lien_he}\n\nRất tiếc vào khung giờ {gio_hop} ngày {ngay_hop}, Giám đốc có lịch công tác đột xuất của Ban điều hành nên chưa thể tiếp đoàn vào thời gian này.\n\n{ghi_chu_them}\n\nKính mong Quý đơn vị thông cảm. Quý đơn vị vui lòng truy cập lại cổng đặt lịch để chọn khung giờ phù hợp khác.\n\nTrân trọng cảm ơn,\nBộ phận Trợ lý Giám đốc."
    }
]

def load_templates() -> List[Dict[str, Any]]:
    if not TEMPLATES_JSON_PATH.exists():
        save_templates(DEFAULT_TEMPLATES)
        return DEFAULT_TEMPLATES
    try:
        with open(TEMPLATES_JSON_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return DEFAULT_TEMPLATES

def save_templates(templates: List[Dict[str, Any]]):
    with open(TEMPLATES_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(templates, f, ensure_ascii=False, indent=2)

def get_template_by_id(tpl_id: str) -> Optional[Dict[str, Any]]:
    templates = load_templates()
    for t in templates:
        if t["id"] == tpl_id:
            return t
    return None

def add_or_update_template(tpl_id: str, title: str, subject: str, body: str):
    templates = load_templates()
    found = False
    for t in templates:
        if t["id"] == tpl_id:
            t["title"] = title
            t["subject"] = subject
            t["body"] = body
            found = True
            break
    if not found:
        templates.append({
            "id": tpl_id,
            "title": title,
            "subject": subject,
            "body": body
        })
    save_templates(templates)

def delete_template(tpl_id: str) -> bool:
    templates = load_templates()
    new_list = [t for t in templates if t["id"] != tpl_id]
    if len(new_list) < len(templates):
        save_templates(new_list)
        return True
    return False
