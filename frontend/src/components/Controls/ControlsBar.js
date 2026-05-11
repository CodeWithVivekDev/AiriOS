"use client";

import { useState, useRef, useCallback } from "react";

/**
 * Bottom controls bar with talk button and text chat input.
 */
export default function ControlsBar({
  onSendText,
  onStartRecording,
  onStopRecording,
  isRecording,
  wsStatus,
}) {
  const [inputText, setInputText] = useState("");
  const inputRef = useRef(null);

  const handleSubmit = useCallback(
    (e) => {
      e.preventDefault();
      const text = inputText.trim();
      if (!text) return;
      onSendText(text);
      setInputText("");
      inputRef.current?.focus();
    },
    [inputText, onSendText]
  );

  const handleTalkToggle = useCallback(() => {
    if (isRecording) {
      onStopRecording?.();
    } else {
      onStartRecording?.();
    }
  }, [isRecording, onStartRecording, onStopRecording]);

  const isConnected = wsStatus === "connected";

  return (
    <div className="controls-bar">
      {/* Talk Button */}
      <button
        className={`talk-btn ${isRecording ? "talk-btn--recording" : ""}`}
        onClick={handleTalkToggle}
        disabled={!isConnected}
        aria-label={isRecording ? "Stop recording" : "Start recording"}
        title={
          !isConnected
            ? "Connect to server first"
            : isRecording
            ? "Click to stop"
            : "Click to talk"
        }
      >
        {isRecording ? "⏹" : "🎤"}
      </button>

      {/* Text Input */}
      <form className="chat-input-wrapper" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          className="chat-input"
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={
            isConnected ? "Type a message to Sakura..." : "Connecting..."
          }
          disabled={!isConnected}
          id="chat-input"
          autoComplete="off"
        />
        <button
          type="submit"
          className="chat-send-btn"
          disabled={!isConnected || !inputText.trim()}
          aria-label="Send message"
        >
          ➤
        </button>
      </form>
    </div>
  );
}
