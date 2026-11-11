# src/auth.py
import hmac
import hashlib
from fastapi import Request, HTTPException, status
from fastapi.responses import RedirectResponse
from config.settings import ADMIN_USERNAME, ADMIN_PASSWORD, SECRET_KEY, COOKIE_NAME

def generate_session_token(username: str) -> str:
    signature = hmac.new(SECRET_KEY.encode(), username.encode(), hashlib.sha256).hexdigest()
    return f"{username}:{signature}"

def verify_session_token(token: str) -> bool:
    if not token or ":" not in token:
        return False
    parts = token.split(":", 1)
    username, sig = parts[0], parts[1]
    if username != ADMIN_USERNAME:
        return False
    expected = hmac.new(SECRET_KEY.encode(), username.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(sig, expected)

def is_admin_authenticated(request: Request) -> bool:
    token = request.cookies.get(COOKIE_NAME)
    return verify_session_token(token)

def require_admin_auth(request: Request):
    if not is_admin_authenticated(request):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Bạn cần đăng nhập bằng tài khoản Host123 để truy cập!"
        )
