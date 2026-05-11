"""FastAPI main application entry point."""

import logging
import json
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.ws.manager import manager
from app.services.llm_service import llm_service
from app.services.tts_service import tts_service
from app.services.stt_service import stt_service

# Configure logging
logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    version="0.2.0",
    description="3D Anime AI Voice Assistant Backend"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "status": "online",
        "app": settings.APP_NAME,
        "version": "0.2.0",
        "connections": len(manager.active_connections)
    }


@app.get("/health")
async def health():
    """Detailed health check."""
    return {
        "status": "healthy",
        "apis": {
            "llm": settings.LLM_PROVIDER,
            "llm_configured": bool(
                settings.OPENAI_API_KEY if settings.LLM_PROVIDER == "openai"
                else settings.GOOGLE_GEMINI_API_KEY
            ),
            "tts_configured": bool(settings.ELEVENLABS_API_KEY),
            "stt_configured": bool(settings.OPENAI_API_KEY),
        }
    }


async def process_text_message(client_id: str, user_text: str):
    """
    Process a text message through the full AI pipeline:
    Text → LLM → TTS → Send character_speak event.
    Falls back to text-only if TTS is unavailable.
    """
    logger.info(f"[{client_id}] Processing text: {user_text}")
    manager.add_to_history(client_id, "user", user_text)

    # Step 1: Generate LLM response
    try:
        history = manager.get_history(client_id)
        response_text = await llm_service.generate_response(user_text, history[:-1])
        manager.add_to_history(client_id, "assistant", response_text)
    except Exception as e:
        logger.error(f"[{client_id}] LLM error: {e}")
        response_text = "Gomen ne~ I had a little brain freeze! Could you say that again? 😅"
        manager.add_to_history(client_id, "assistant", response_text)
        # Send text-only fallback
        await manager.send_json(client_id, {
            "event": "character_text",
            "data": {"text": response_text}
        })
        return

    # Step 2: Synthesize speech via TTS
    try:
        if settings.ELEVENLABS_API_KEY:
            audio_base64 = await tts_service.synthesize(response_text)
            await manager.send_json(client_id, {
                "event": "character_speak",
                "data": {
                    "text": response_text,
                    "audio_base64": audio_base64,
                }
            })
        else:
            # No TTS configured — send text-only
            logger.warning(f"[{client_id}] No TTS key configured, sending text only")
            await manager.send_json(client_id, {
                "event": "character_text",
                "data": {"text": response_text}
            })
    except Exception as e:
        logger.error(f"[{client_id}] TTS error: {e}")
        # Fallback to text-only response
        await manager.send_json(client_id, {
            "event": "character_text",
            "data": {"text": response_text}
        })


async def process_audio_message(client_id: str, audio_base64: str):
    """
    Process an audio message through the full AI pipeline:
    Audio → STT → Transcription event → LLM → TTS → character_speak event.
    """
    logger.info(f"[{client_id}] Processing audio...")

    # Step 1: Transcribe audio via STT
    try:
        if not settings.OPENAI_API_KEY:
            await manager.send_json(client_id, {
                "event": "character_text",
                "data": {
                    "text": "🎤 Voice processing requires an OpenAI API key for Whisper STT. "
                            "Please configure OPENAI_API_KEY in your .env file!"
                }
            })
            return

        transcribed_text = await stt_service.transcribe(audio_base64)

        if not transcribed_text:
            await manager.send_json(client_id, {
                "event": "character_text",
                "data": {"text": "🤔 I couldn't hear you clearly. Could you try again?"}
            })
            return

        # Send transcription back to client so they see what was heard
        await manager.send_json(client_id, {
            "event": "transcription",
            "data": {"text": transcribed_text}
        })

    except Exception as e:
        logger.error(f"[{client_id}] STT error: {e}")
        await manager.send_json(client_id, {
            "event": "character_text",
            "data": {"text": "🎤 I had trouble hearing that. Could you try again?"}
        })
        return

    # Step 2: Process the transcribed text through LLM → TTS
    await process_text_message(client_id, transcribed_text)


@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    """
    Main WebSocket endpoint for real-time voice assistant communication.

    Events from client:
      - { "event": "user_text", "data": { "text": "..." } }
      - { "event": "user_audio", "data": { "audio_base64": "..." } }
      - { "event": "ping" }

    Events to client:
      - { "event": "character_speak", "data": { "text": "...", "audio_base64": "..." } }
      - { "event": "character_text", "data": { "text": "..." } }
      - { "event": "transcription", "data": { "text": "..." } }
      - { "event": "error", "data": { "message": "..." } }
      - { "event": "pong" }
    """
    await manager.connect(websocket, client_id)

    try:
        # Send welcome message
        welcome = "✨ Konnichiwa! I'm Sakura, your 3D AI assistant. Ask me anything or press the mic to talk! 🌸"
        await manager.send_json(client_id, {
            "event": "character_text",
            "data": {"text": welcome}
        })

        while True:
            # Receive messages from the client
            raw = await websocket.receive_text()

            try:
                message = json.loads(raw)
            except Exception:
                await manager.send_json(client_id, {
                    "event": "error",
                    "data": {"message": "Invalid JSON payload"}
                })
                continue

            event = message.get("event", "")
            data = message.get("data", {})

            if event == "ping":
                await manager.send_json(client_id, {"event": "pong"})

            elif event == "user_text":
                user_text = data.get("text", "").strip()
                if not user_text:
                    continue

                # Send a thinking indicator
                await manager.send_json(client_id, {
                    "event": "character_text",
                    "data": {"text": "💭 Thinking..."}
                })

                await process_text_message(client_id, user_text)

            elif event == "user_audio":
                audio_base64 = data.get("audio_base64", "")
                if not audio_base64:
                    continue

                await manager.send_json(client_id, {
                    "event": "character_text",
                    "data": {"text": "🎧 Processing your voice..."}
                })

                await process_audio_message(client_id, audio_base64)

            else:
                logger.warning(f"[{client_id}] Unknown event: {event}")

    except WebSocketDisconnect:
        manager.disconnect(client_id)
        logger.info(f"Client {client_id} disconnected normally.")
    except Exception as e:
        logger.error(f"WebSocket error for {client_id}: {e}")
        manager.disconnect(client_id)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=True)
