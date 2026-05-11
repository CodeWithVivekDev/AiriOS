"use client";

/**
 * Subtitle overlay that displays above the 3D canvas.
 * Shows the currently spoken text with animated entry and a label.
 */
export default function SubtitleOverlay({ text, speaker }) {
  if (!text) return null;

  const isThinking = text === "💭 Thinking..." || text === "🎧 Processing your voice...";

  return (
    <div className="subtitle-overlay">
      <div className="subtitle-bubble">
        {speaker && (
          <span className="subtitle-label">
            {speaker === "user" ? "🎤 You" : "✨ Sakura"}
          </span>
        )}
        <p
          className={`subtitle-text ${
            speaker === "user" ? "subtitle-text--user" : ""
          }`}
        >
          {text}
        </p>
        {isThinking && (
          <div className="speaking-indicator" style={{ justifyContent: "center", marginTop: 6 }}>
            <div className="speaking-indicator__bar" />
            <div className="speaking-indicator__bar" />
            <div className="speaking-indicator__bar" />
            <div className="speaking-indicator__bar" />
          </div>
        )}
      </div>
    </div>
  );
}
