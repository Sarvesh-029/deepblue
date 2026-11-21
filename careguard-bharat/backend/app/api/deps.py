from typing import Generator, Optional, List
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.core.security import decode_access_token
from app.models.user import User
from app.adapters import (
    FaceService,
    SnapshotStorage,
    AlertService,
    EventStore,
    get_face_service,
    get_storage_service,
    get_alert_service,
    get_event_store,
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception
        
    user_id_str: Optional[str] = payload.get("sub")
    if user_id_str is None:
        raise credentials_exception
        
    try:
        user_id = int(user_id_str)
    except ValueError:
        raise credentials_exception

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user account")
    return user


def require_roles(allowed_roles: List[str]):
    """Role-based access check dependency factory."""
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Operation restricted to roles: {', '.join(allowed_roles)}"
            )
        return current_user
    return role_checker


# Adapter dependency helpers
def get_face_svc() -> FaceService:
    return get_face_service()


def get_storage_svc() -> SnapshotStorage:
    return get_storage_service()


def get_alert_svc() -> AlertService:
    return get_alert_service()


def get_event_svc() -> EventStore:
    return get_event_store()


def get_rule_engine() -> "RuleEngine":
    from app.rules.engine import RuleEngine
    return RuleEngine(
        face_service=get_face_service(),
        storage_service=get_storage_service(),
        alert_service=get_alert_service(),
        event_store=get_event_store()
    )
