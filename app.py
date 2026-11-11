# app.py - Compatibility bridge to main.py
from main import app

if __name__ == "__main__":
    import uvicorn
    from config.settings import HOST, PORT
    uvicorn.run("main:app", host=HOST, port=PORT, reload=True)
