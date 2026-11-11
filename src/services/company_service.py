# src/services/company_service.py
import re
import requests
from typing import List, Dict, Any

# Curated dataset of prominent Vietnamese enterprises for instant typeahead prediction
POPULAR_ENTERPRISES = [
    {
        "name": "TẬP ĐOÀN CÔNG NGHIỆP - VIỄN THÔNG QUÂN ĐỘI (VIETTEL)",
        "tax_code": "0100109106",
        "address": "Lô D26 Khu đô thị mới Cầu Giấy, P. Yên Hòa, Q. Cầu Giấy, TP. Hà Nội"
    },
    {
        "name": "TẬP ĐOÀN BƯU CHÍNH VIỄN THÔNG VIỆT NAM (VNPT)",
        "tax_code": "0100684378",
        "address": "Số 57 phố Huỳnh Thúc Kháng, P. Láng Hạ, Q. Đống Đa, TP. Hà Nội"
    },
    {
        "name": "CÔNG TY CỔ PHẦN FPT",
        "tax_code": "0101248141",
        "address": "Tòa nhà FPT, số 10 phố Phạm Văn Bạch, P. Dịch Vọng, Q. Cầu Giấy, TP. Hà Nội"
    },
    {
        "name": "TẬP ĐOÀN VINGROUP - CÔNG TY CP",
        "tax_code": "0101245486",
        "address": "Số 7 đường Bằng Lăng 1, KĐT Vinhomes Riverside, P. Việt Hưng, Q. Long Biên, TP. Hà Nội"
    },
    {
        "name": "CÔNG TY CỔ PHẦN SỮA VIỆT NAM (VINAMILK)",
        "tax_code": "0300588569",
        "address": "Số 10 Tân Trào, P. Tân Phú, Quận 7, TP. Hồ Chí Minh"
    },
    {
        "name": "NGÂN HÀNG THƯƠNG MẠI CỔ PHẦN NGOẠI THƯƠNG VIỆT NAM (VIETCOMBANK)",
        "tax_code": "0100112437",
        "address": "Số 198 Trần Quang Khải, P. Lý Thái Tổ, Q. Hoàn Kiếm, TP. Hà Nội"
    },
    {
        "name": "NGÂN HÀNG THƯƠNG MẠI CỔ PHẦN KỸ THƯƠNG VIỆT NAM (TECHCOMBANK)",
        "tax_code": "0100230800",
        "address": "Số 6 phố Quang Trung, P. Trần Hưng Đạo, Q. Hoàn Kiếm, TP. Hà Nội"
    },
    {
        "name": "TẬP ĐOÀN HÒA PHÁT",
        "tax_code": "0900189284",
        "address": "Khu công nghiệp Phố Nối A, Xã Giai Phạm, Huyện Yên Mỹ, Tỉnh Hưng Yên"
    },
    {
        "name": "TẬP ĐOÀN MASAN",
        "tax_code": "0303576603",
        "address": "Phòng 802, Tầng 8, Tòa nhà Central Plaza, 17 Lê Duẩn, P. Bến Nghé, Quận 1, TP. Hồ Chí Minh"
    },
    {
        "name": "TẬP ĐOÀN DẦU KHÍ VIỆT NAM (PETROVIETNAM)",
        "tax_code": "0100150619",
        "address": "Số 18 Láng Hạ, P. Thành Công, Q. Ba Đình, TP. Hà Nội"
    },
    {
        "name": "CÔNG TY CỔ PHẦN TẬP ĐOÀN TH (TH TRUE MILK)",
        "tax_code": "2901111664",
        "address": "Xã Nghĩa Sơn, Huyện Nghĩa Đàn, Tỉnh Nghệ An"
    },
    {
        "name": "CÔNG TY CỔ PHẦN HÀNG KHÔNG VIETJET",
        "tax_code": "0102325379",
        "address": "302/3 phố Kim Mã, P. Ngọc Khánh, Q. Ba Đình, TP. Hà Nội"
    },
    {
        "name": "TỔNG CÔNG TY HÀNG KHÔNG VIỆT NAM - CTCP (VIETNAM AIRLINES)",
        "tax_code": "0100107518",
        "address": "Số 200 đường Nguyễn Sơn, P. Bồ Đề, Q. Long Biên, TP. Hà Nội"
    },
    {
        "name": "CÔNG TY CỔ PHẦN THẾ GIỚI DI ĐỘNG (MWG)",
        "tax_code": "0303217354",
        "address": "Số 128 Trần Quang Khải, P. Tân Định, Quận 1, TP. Hồ Chí Minh"
    }
]

def lookup_tax_from_vietqr(tax_code: str) -> Dict[str, Any]:
    cleaned = re.sub(r"[^0-9]", "", tax_code)
    try:
        url = f"https://api.vietqr.io/v2/business/{cleaned}"
        res = requests.get(url, timeout=5)
        data = res.json()
        if data.get("code") == "00" and data.get("data"):
            biz = data["data"]
            return {
                "success": True,
                "name": biz.get("name", "").upper(),
                "tax_code": tax_code,
                "address": biz.get("address", "")
            }
    except Exception:
        pass
    return {"success": False}

def predict_companies(query: str) -> List[Dict[str, Any]]:
    query = query.strip()
    if not query or len(query) < 2:
        return []

    results = []
    # 1. If it looks like a tax code or branch code (mostly digits, 10 or 13 digits)
    is_numeric = re.match(r"^\d{3,14}(-\d{1,4})?$", query)

    if is_numeric:
        # Check in local popular list first
        clean_q = re.sub(r"[^0-9]", "", query)
        for item in POPULAR_ENTERPRISES:
            if clean_q in re.sub(r"[^0-9]", "", item["tax_code"]):
                results.append(item)

        # If clean_q length >= 10, call live VietQR API
        if len(clean_q) >= 10:
            online_res = lookup_tax_from_vietqr(query)
            if online_res.get("success"):
                # Avoid duplicate
                if not any(r["tax_code"] == online_res["tax_code"] for r in results):
                    results.insert(0, {
                        "name": online_res["name"],
                        "tax_code": online_res["tax_code"],
                        "address": online_res["address"]
                    })
    else:
        # Keyword / Company Name search
        query_lower = query.lower()
        for item in POPULAR_ENTERPRISES:
            if query_lower in item["name"].lower() or query_lower in item["tax_code"]:
                results.append(item)

    return results[:8]
