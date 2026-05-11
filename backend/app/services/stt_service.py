"""STT service using OpenAI Whisper for speech-to-text transcription."""

import base64
import io
import logging

from openai import OpenAI

from app.config import settings

logger = logging.getLogger(__name__)


class STTService:
    """Handles speech-to-text using OpenAI Whisper API."""

    def __init__(self):
        self._client = None

    def _get_client(self):
        """Lazily initialize the OpenAI client."""
        if self._client is None:
            api_key = settings.OPENAI_API_KEY
            if not api_key:
                raise ValueError(
                    "OPENAI_API_KEY is not configured. "
                    "Please set it in your .env file."
                )
            self._client = OpenAI(api_key=api_key)
        return self._client

    async def transcribe(self, audio_base64: str) -> str:
        """
        Transcribe base64-encoded audio to text using Whisper.

        Args:
            audio_base64: Base64-encoded audio data (webm/opus format).

        Returns:
            Transcribed text string.
        """
        try:
            client = self._get_client()

            # Decode base64 audio
            audio_bytes = base64.b64decode(audio_base64)

            # Create a file-like object for the API
            audio_file = io.BytesIO(audio_bytes)
            audio_file.name = "recording.webm"

            # Transcribe using Whisper
            transcript = client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                language="en",
            )

            result = transcript.text.strip()
            logger.info(f"[STT] Transcribed: {result[:80]}...")
            return result

        except Exception as e:
            logger.error(f"[STT] Error transcribing audio: {e}")
            raise


# Singleton
stt_service = STTService()
