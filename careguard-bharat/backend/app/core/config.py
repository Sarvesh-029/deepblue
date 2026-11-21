import os
from pathlib import Path
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # App Settings
    APP_NAME: str = "CareGuard Bharat"
    APP_ENV: str = "development"
    DEBUG: bool = True
    API_V1_PREFIX: str = "/api/v1"
    
    # Security & Auth
    SECRET_KEY: str = "careguard-bharat-dev-secret-key-change-in-prod-xyz123"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours
    
    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ]
    
    # Database
    DATABASE_URL: str = "sqlite:///./careguard.db"
    
    # Storage Configuration (Adapter Selection: 'local' | 's3')
    STORAGE_BACKEND: str = "local"
    LOCAL_SNAPSHOT_DIR: str = "./data/snapshots"
    S3_BUCKET_NAME: str = ""
    AWS_REGION: str = "ap-south-1"
    
    # Face Recognition Service Backend ('local' | 'rekognition')
    FACE_SERVICE_BACKEND: str = "local"
    YUNET_MODEL_PATH: str = "./models_data/face_detection_yunet_2023mar.onnx"
    SFACE_MODEL_PATH: str = "./models_data/face_recognition_sface_2021dec.onnx"
    ENABLE_YOLO_PERSON_DETECTION: bool = False
    
    # Alerts Configuration ('inapp' | 'sns' | 'smtp')
    ALERT_BACKEND: str = "inapp"
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    ALERT_EMAIL_FROM: str = ""
    ALERT_EMAIL_TO: str = ""
    
    # Event Store Configuration ('sqlite' | 'dynamodb')
    EVENT_STORE_BACKEND: str = "sqlite"
    
    # Privacy and Detection Rules Defaults
    SNAPSHOT_RETENTION_DAYS: int = 7
    DEFAULT_UNATTENDED_MINUTES: int = 10
    CAREGIVER_ABSENT_CHECK_MINUTES: int = 30
    FRAME_CAPTURE_INTERVAL_SECONDS: int = 4
    MAX_FRAME_WIDTH: int = 640

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env", "../../.env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()
