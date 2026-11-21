import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from app.core.config import settings
from app.core.database import engine, Base
from app.core.scheduler import start_scheduler, shutdown_scheduler
import app.models  # Register all models with Base.metadata
from app.api.auth import router as auth_router
from app.api.status import router as status_router
from app.api.monitor import router as monitor_router
from app.api.persons import router as persons_router
from app.api.events import router as events_router
from app.api.alerts import router as alerts_router

# Configure logging
logging.basicConfig(
    level=logging.INFO if not settings.DEBUG else logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("careguard")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure tables exist in SQLite
    logger.info("Initializing CareGuard Bharat database schemas...")
    Base.metadata.create_all(bind=engine)
    
    # Ensure local snapshot storage directory exists
    Path(settings.LOCAL_SNAPSHOT_DIR).mkdir(parents=True, exist_ok=True)
    
    # Start background scheduler (caregiver shift check + 7-day snapshot cleanup)
    start_scheduler()
    
    logger.info(f"CareGuard Bharat Backend ready. Adapters: "
                f"Face={settings.FACE_SERVICE_BACKEND}, "
                f"Storage={settings.STORAGE_BACKEND}, "
                f"Alerts={settings.ALERT_BACKEND}, "
                f"Events={settings.EVENT_STORE_BACKEND}")
    yield
    shutdown_scheduler()
    logger.info("CareGuard Bharat Backend shutting down...")


app = FastAPI(
    title=settings.APP_NAME,
    description="Privacy-First Smart Caregiver Safety & Monitoring System for Project Deep Blue",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration for frontend web app
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Routers
app.include_router(auth_router, prefix=settings.API_V1_PREFIX)
app.include_router(status_router, prefix=settings.API_V1_PREFIX)
app.include_router(monitor_router, prefix=settings.API_V1_PREFIX)
app.include_router(persons_router, prefix=settings.API_V1_PREFIX)
app.include_router(events_router, prefix=settings.API_V1_PREFIX)
app.include_router(alerts_router, prefix=settings.API_V1_PREFIX)

# Static Mount for Blurred Snapshots
Path(settings.LOCAL_SNAPSHOT_DIR).mkdir(parents=True, exist_ok=True)
app.mount("/snapshots", StaticFiles(directory=settings.LOCAL_SNAPSHOT_DIR), name="snapshots")


@app.get("/")
def root():
    return {
        "message": f"Welcome to {settings.APP_NAME} API",
        "docs_url": "/docs",
        "health_url": f"{settings.API_V1_PREFIX}/health"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
