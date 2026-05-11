"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { useWebSocket } from "../hooks/useWebSocket";
import ChatPanel from "../components/Chat/ChatPanel";
import SubtitleOverlay from "../components/Chat/SubtitleOverlay";
import ControlsBar from "../components/Controls/ControlsBar";

import { useAudioQueue } from "../hooks/useAudioQueue";

// Dynamically import Scene3D to avoid SSR issues with Three.js
const Scene3D = dynamic(() => import("../components/Scene3D/Scene3D"), {
  ssr: false,
  loading: () => (
    <div className="loading-overlay">
      <div className="loading-spinner" />
      <p className="loading-text">Initializing 3D Engine...</p>
    </div>
  ),
});

export default function Home() {
  const { status, messages, lastEvent, sendText, sendAudio } = useWebSocket();
  const { analyserRef, isPlaying: isSpeaking, enqueueAudio, initAudio } = useAudioQueue();
  const [chatOpen, setChatOpen] = useState(false);
  const [subtitle, setSubtitle] = useState({ text: "", speaker: "" });
  const [isRecording, setIsRecording] = useState(false);
  const [vrmUrl, setVrmUrl] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const fileInputRef = useRef(null);

  // Handle custom avatar upload
  const handleAvatarUpload = useCallback((e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (vrmUrl && vrmUrl.startsWith("blob:")) {
        URL.revokeObjectURL(vrmUrl);
      }
      const url = URL.createObjectURL(file);
      setVrmUrl(url);
    }
  }, [vrmUrl]);

  // Cleanup object URLs
  useEffect(() => {
    return () => {
      if (vrmUrl && vrmUrl.startsWith("blob:")) {
        URL.revokeObjectURL(vrmUrl);
      }
    };
  }, [vrmUrl]);

  // Status display text
  const statusLabel =
    status === "connected"
      ? "Online"
      : status === "connecting"
      ? "Connecting..."
      : "Offline";

  // Handle incoming events for subtitle display
  useEffect(() => {
    if (!lastEvent) return;

    if (lastEvent.event === "character_text") {
      setSubtitle({
        text: lastEvent.data.text,
        speaker: "assistant",
      });

      // Clear subtitle after 6 seconds
      const timer = setTimeout(() => {
        setSubtitle({ text: "", speaker: "" });
      }, 6000);

      return () => clearTimeout(timer);
    } else if (lastEvent.event === "character_speak") {
      // Enqueue the audio chunk and set the subtitle when it starts playing
      enqueueAudio(lastEvent.data.audio_base64, () => {
        setSubtitle({
          text: lastEvent.data.text,
          speaker: "assistant",
        });
      });
    }
  }, [lastEvent, enqueueAudio]);

  // Handle text send
  const handleSendText = useCallback(
    (text) => {
      initAudio(); // Initialize audio context on first user interaction
      // Show user text as subtitle briefly
      setSubtitle({ text, speaker: "user" });
      setTimeout(() => setSubtitle({ text: "", speaker: "" }), 2000);

      sendText(text);
    },
    [sendText]
  );

  // Handle recording start
  const handleStartRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });

      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });

        // Convert to base64 and send
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result.split(",")[1];
          sendAudio(base64);
        };
        reader.readAsDataURL(audioBlob);

        // Stop all tracks
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.start(250); // Collect data every 250ms
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);

      setSubtitle({ text: "🎤 Listening...", speaker: "user" });
    } catch (err) {
      console.error("Microphone access denied:", err);
      setSubtitle({
        text: "⚠️ Microphone access denied. Please allow microphone access.",
        speaker: "assistant",
      });
    }
  }, [sendAudio]);

  // Handle recording stop
  const handleStopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setSubtitle({ text: "", speaker: "" });
  }, []);

  return (
    <div className="app-container">
      {/* 3D Scene (full background) */}
      <Scene3D audioAnalyserRef={analyserRef} isSpeaking={isSpeaking} vrmUrl={vrmUrl} />

      {/* Ambient floating particles (CSS) */}
      <div className="ambient-particles" aria-hidden="true">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="particle"
            style={{
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 8}s`,
              animationDuration: `${6 + Math.random() * 6}s`,
            }}
          />
        ))}
      </div>

      {/* Top Bar */}
      <div className="top-bar">
        <div className="top-bar__brand">
          <div className="top-bar__logo">🌸</div>
          <span className="top-bar__title">Sakura AI</span>
        </div>

        <div className="top-bar__status">
          <span
            className={`status-dot ${
              status === "connected"
                ? ""
                : status === "connecting"
                ? "status-dot--connecting"
                : "status-dot--offline"
            }`}
          />
          <span>{statusLabel}</span>
        </div>

        <div className="top-bar__actions">
          <input
            type="file"
            accept=".vrm"
            ref={fileInputRef}
            onChange={handleAvatarUpload}
            style={{ display: "none" }}
          />
          <button
            className="icon-btn"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Upload Custom Avatar"
            title="Upload .vrm Avatar"
          >
            👤
          </button>
          <button
            className="icon-btn"
            onClick={() => setChatOpen(!chatOpen)}
            aria-label="Toggle chat history"
            title="Chat History"
          >
            💬
          </button>
        </div>
      </div>

      {/* Subtitle Overlay */}
      <SubtitleOverlay text={subtitle.text} speaker={subtitle.speaker} />

      {/* Bottom Controls */}
      <ControlsBar
        onSendText={handleSendText}
        onStartRecording={handleStartRecording}
        onStopRecording={handleStopRecording}
        isRecording={isRecording}
        wsStatus={status}
      />

      {/* Chat History Panel */}
      <ChatPanel
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        messages={messages}
      />
    </div>
  );
}
