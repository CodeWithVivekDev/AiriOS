"""LLM service using Google Gemini for conversational AI responses."""

import logging
from typing import List, Dict

from google import genai
from google.genai import types

from app.config import settings

logger = logging.getLogger(__name__)


class LLMService:
    """Handles LLM inference using Google Gemini."""

    def __init__(self):
        self._client = None

    def _get_client(self):
        """Lazily initialize the Gemini client."""
        if self._client is None:
            api_key = settings.GOOGLE_GEMINI_API_KEY
            if not api_key:
                raise ValueError(
                    "GOOGLE_GEMINI_API_KEY is not configured. "
                    "Please set it in your .env file."
                )
            self._client = genai.Client(api_key=api_key)
        return self._client

    async def generate_response(
        self,
        user_message: str,
        conversation_history: List[Dict[str, str]],
    ) -> str:
        """
        Generate a response from the LLM given a user message and conversation history.

        Args:
            user_message: The latest user message.
            conversation_history: List of {"role": "user"|"assistant", "content": "..."}

        Returns:
            The assistant's reply as a string.
        """
        try:
            client = self._get_client()

            # Build the contents list for Gemini
            contents = []
            for msg in conversation_history:
                role = "user" if msg["role"] == "user" else "model"
                contents.append(
                    types.Content(
                        role=role,
                        parts=[types.Part.from_text(text=msg["content"])],
                    )
                )

            # Add the current user message
            contents.append(
                types.Content(
                    role="user",
                    parts=[types.Part.from_text(text=user_message)],
                )
            )

            # Generate response
            response = await client.aio.models.generate_content(
                model=settings.LLM_MODEL,
                contents=contents,
                config=types.GenerateContentConfig(
                    system_instruction=settings.CHARACTER_PERSONA,
                    temperature=0.8,
                    max_output_tokens=256,
                ),
            )

            result = response.text.strip()
            logger.info(f"[LLM] Generated response: {result[:80]}...")
            return result

        except Exception as e:
            logger.error(f"[LLM] Error generating response: {e}")
            return "Gomen ne~ I had a little brain freeze! Could you say that again? 😅"


# Singleton
llm_service = LLMService()
