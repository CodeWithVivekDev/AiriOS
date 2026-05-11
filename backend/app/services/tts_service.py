"""TTS service using ElevenLabs for high-quality voice synthesis."""

import base64
import logging

from elevenlabs import ElevenLabs

from app.config import settings

logger = logging.getLogger(__name__)


class TTSService:
    """Handles text-to-speech using ElevenLabs API."""

    def __init__(self):
        self._client = None

    def _get_client(self):
        """Lazily initialize the ElevenLabs client."""
        if self._client is None:
            api_key = settings.ELEVENLABS_API_KEY
            if not api_key:
                raise ValueError(
                    "ELEVENLABS_API_KEY is not configured. "
                    "Please set it in your .env file."
                )
            self._client = ElevenLabs(api_key=api_key)
        return self._client

    async def synthesize(self, text: str) -> str:
        """
        Convert text to speech and return base64-encoded audio.

        Args:
            text: The text to synthesize.

        Returns:
            Base64-encoded MP3 audio string.
        """
        try:
            client = self._get_client()

            # Generate audio using ElevenLabs
            audio_iterator = client.text_to_speech.convert(
                text=text,
                voice_id=settings.ELEVENLABS_VOICE_ID,
                model_id="eleven_multilingual_v2",
                output_format="mp3_44100_128",
            )

            # Collect all audio chunks
            audio_bytes = b""
            for chunk in audio_iterator:
                audio_bytes += chunk

            if not audio_bytes:
                raise ValueError("No audio data received from ElevenLabs")

            # Encode to base64
            audio_base64 = base64.b64encode(audio_bytes).decode("utf-8")

            logger.info(
                f"[TTS] Synthesized {len(audio_bytes)} bytes "
                f"({len(text)} chars of text)"
            )
            return audio_base64

        except Exception as e:
            logger.error(f"[TTS] Error synthesizing speech: {e}")
            raise


# Singleton
tts_service = TTSService()
