# main.py
import uvicorn
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from config.settings import BASE_DIR, PORT, HOST
from src.database import init_db
from src.routes.client_routes import router as client_router
from src.routes.admin_routes import router as admin_router

app = FastAPI(
    title="Lịch Đặt Hẹn Giám Đốc V2",
    description="Hệ thống đăng ký lịch tiếp doanh nghiệp dành cho Giám đốc",
    version="2.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Static Files (Separate CSS & JS)
static_dir = BASE_DIR / "static"
app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

# Include Modular Routers
app.include_router(client_router)
app.include_router(admin_router)

# Initialize Database on Startup
@app.on_event("startup")
def on_startup():
    init_db()

if __name__ == "__main__":
    uvicorn.run("main:app", host=HOST, port=PORT, reload=True)
