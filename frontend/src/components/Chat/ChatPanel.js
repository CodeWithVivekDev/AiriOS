"use client";

import { useRef, useEffect } from "react";

/**
 * Slide-out chat history panel.
 * Shows the full conversation history.
 */
export default function ChatPanel({ isOpen, onClose, messages }) {
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className={`chat-panel ${isOpen ? "chat-panel--open" : ""}`}>
      <div className="chat-panel__header">
        <h2 className="chat-panel__title">💬 Conversation</h2>
        <button className="icon-btn" onClick={onClose} aria-label="Close chat">
          ✕
        </button>
      </div>
      <div className="chat-panel__messages">
        {messages.length === 0 && (
          <div className="chat-message chat-message--system">
            Start a conversation with Sakura!
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`chat-message chat-message--${msg.role}`}
          >
            {msg.text}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
