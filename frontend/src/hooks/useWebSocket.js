"use client";

import { useRef, useState, useCallback, useEffect } from "react";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/ws";

/**
 * Custom hook for managing the WebSocket connection to the backend.
 * Handles auto-reconnect, heartbeat ping, and message dispatch.
 */
export function useWebSocket() {
  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const pingIntervalRef = useRef(null);
  const clientIdRef = useRef(null);

  const [status, setStatus] = useState("disconnected"); // "connecting" | "connected" | "disconnected"
  const [messages, setMessages] = useState([]);
  const [lastEvent, setLastEvent] = useState(null);

  // Generate a stable client ID
  const getClientId = useCallback(() => {
    if (!clientIdRef.current) {
      clientIdRef.current =
        "client_" + Math.random().toString(36).substring(2, 10);
    }
    return clientIdRef.current;
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setStatus("connecting");
    const clientId = getClientId();
    const ws = new WebSocket(`${WS_URL}/${clientId}`);

    ws.onopen = () => {
      setStatus("connected");
      console.log("[WS] Connected as", clientId);

      // Start heartbeat
      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ event: "ping" }));
        }
      }, 25000);
    };

    ws.onmessage = (evt) => {
      try {
        const payload = JSON.parse(evt.data);
        setLastEvent(payload);

        if (payload.event === "pong") return;

        // Add to message history
        if (
          payload.event === "character_text" ||
          payload.event === "character_speak"
        ) {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              text: payload.data.text,
              audio: payload.data.audio_base64 || null,
              timestamp: Date.now(),
            },
          ]);
        } else if (payload.event === "transcription") {
          setMessages((prev) => [
            ...prev,
            {
              role: "user",
              text: payload.data.text,
              timestamp: Date.now(),
            },
          ]);
        }
      } catch (err) {
        console.error("[WS] Parse error:", err);
      }
    };

    ws.onerror = (err) => {
      console.error("[WS] Error:", err);
    };

    ws.onclose = (evt) => {
      setStatus("disconnected");
      clearInterval(pingIntervalRef.current);
      console.log("[WS] Disconnected, code:", evt.code);

      // Auto-reconnect after 3 seconds
      reconnectTimerRef.current = setTimeout(() => {
        console.log("[WS] Attempting reconnect...");
        connect();
      }, 3000);
    };

    wsRef.current = ws;
  }, [getClientId]);

  const disconnect = useCallback(() => {
    clearTimeout(reconnectTimerRef.current);
    clearInterval(pingIntervalRef.current);
    if (wsRef.current) {
      wsRef.current.close(1000, "User disconnect");
      wsRef.current = null;
    }
    setStatus("disconnected");
  }, []);

  const sendEvent = useCallback((event, data = {}) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ event, data }));
      return true;
    }
    console.warn("[WS] Not connected, cannot send event:", event);
    return false;
  }, []);

  const sendText = useCallback(
    (text) => {
      const sent = sendEvent("user_text", { text });
      if (sent) {
        setMessages((prev) => [
          ...prev,
          { role: "user", text, timestamp: Date.now() },
        ]);
      }
      return sent;
    },
    [sendEvent]
  );

  const sendAudio = useCallback(
    (audioBase64) => {
      return sendEvent("user_audio", { audio_base64: audioBase64 });
    },
    [sendEvent]
  );

  // Auto-connect on mount
  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return {
    status,
    messages,
    lastEvent,
    connect,
    disconnect,
    sendText,
    sendAudio,
    sendEvent,
  };
}
