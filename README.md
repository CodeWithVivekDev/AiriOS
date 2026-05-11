# 🌸 Sakura AI — 3D Anime Voice Assistant

A web-based conversational AI voice assistant featuring a fully rigged, real-time lip-syncing 3D anime avatar powered by VRM technology.

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────┐
│                    Frontend (Next.js)              │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐   │
│  │ Three.js  │  │ Chat UI  │  │ Audio Manager │   │
│  │ + VRM     │  │ Subtitles│  │ MediaRecorder │   │
│  └──────────┘  └──────────┘  └───────────────┘   │
│                    │ WebSocket │                    │
└────────────────────┼──────────┼────────────────────┘
                     │          │
┌────────────────────┼──────────┼────────────────────┐
│                    Backend (FastAPI)                │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐   │
│  │ WS Mgr   │  │ STT/LLM  │  │ TTS Streamer │   │
│  │          │  │ Pipeline  │  │              │   │
│  └──────────┘  └──────────┘  └───────────────┘   │
└──────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- **Node.js** ≥ 18
- **Python** ≥ 3.10
- **pip** (Python package manager)

### 1. Backend Setup

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

### 3. Open the App

Navigate to `http://localhost:3000` in your browser.

## 🔑 API Keys (Phase 3+)

Copy `backend/.env` and fill in your keys:

| Key | Purpose |
|-----|---------|
| `OPENAI_API_KEY` | Whisper STT + GPT-4o |
| `GOOGLE_GEMINI_API_KEY` | Gemini LLM |
| `ELEVENLABS_API_KEY` | TTS voice synthesis |
| `MESHY_API_KEY` | Photo-to-3D avatar generation |

## 📦 Tech Stack

- **Frontend:** Next.js, Three.js, @pixiv/three-vrm
- **Backend:** Python FastAPI, WebSockets
- **AI:** Whisper, Gemini/GPT-4o, ElevenLabs

## 📋 Development Phases

- ✅ Phase 1: WebSocket skeleton + UI shell
- ✅ Phase 2: 3D scene + VRM avatar rendering
- ✅ Phase 3: Voice loop (STT → LLM → TTS)
- ✅ Phase 4: Audio sync + lip-sync + subtitles
- ✅ Phase 5: Custom avatar upload pipeline

