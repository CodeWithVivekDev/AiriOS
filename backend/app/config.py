from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Server
    APP_NAME: str = "3D Anime AI Voice Assistant"
    DEBUG: bool = True
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # CORS
    FRONTEND_URL: str = "http://localhost:3000"

    # AI API Keys (Phase 3+)
    OPENAI_API_KEY: Optional[str] = None
    GOOGLE_GEMINI_API_KEY: Optional[str] = None
    ELEVENLABS_API_KEY: Optional[str] = None
    MESHY_API_KEY: Optional[str] = None

    # LLM Config
    LLM_PROVIDER: str = "gemini"  # "openai" or "gemini"
    LLM_MODEL: str = "gemini-2.0-flash"
    CHARACTER_PERSONA: str = (
        "You are a friendly, enthusiastic anime-style AI assistant named Sakura. "
        "You speak in a warm, cheerful tone with occasional Japanese expressions. "
        "Keep responses concise (2-3 sentences max) for natural conversation flow. "
        "You are helpful, witty, and have a playful personality."
    )

    # TTS Config
    TTS_PROVIDER: str = "elevenlabs"
    ELEVENLABS_VOICE_ID: str = "EXAVITQu4vr4xnSDxMaL"  # Default voice

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
