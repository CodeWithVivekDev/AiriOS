"use client";

import { useRef, useCallback, useState, useEffect } from "react";

/**
 * Manages sequential playback of audio chunks.
 * Feeds audio through an AnalyserNode for lip-syncing.
 */
export function useAudioQueue() {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const queueRef = useRef([]);
  const isProcessingRef = useRef(false);

  // Initialize Web Audio API
  const initAudio = useCallback(() => {
    if (!audioContextRef.current) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.5;
      
      analyserRef.current = analyser;
      audioContextRef.current = ctx;
    }
    
    // Resume context if suspended (browser policy)
    if (audioContextRef.current.state === "suspended") {
      audioContextRef.current.resume();
    }
  }, []);

  const processQueue = useCallback(async () => {
    if (isProcessingRef.current || queueRef.current.length === 0) {
      return;
    }

    isProcessingRef.current = true;
    setIsPlaying(true);

    while (queueRef.current.length > 0) {
      const { audioBase64, onStart } = queueRef.current.shift();
      
      try {
        initAudio();
        const ctx = audioContextRef.current;
        const analyser = analyserRef.current;

        // Decode base64 to array buffer
        const binaryString = window.atob(audioBase64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        // Decode audio data
        const audioBuffer = await ctx.decodeAudioData(bytes.buffer);
        
        // Create source and connect to analyser & destination
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(analyser);
        analyser.connect(ctx.destination);

        // Notify that this chunk is starting to play
        if (onStart) onStart();

        // Play and wait for completion
        await new Promise((resolve) => {
          source.onended = resolve;
          source.start(0);
        });

      } catch (err) {
        console.error("[AudioQueue] Error playing chunk:", err);
      }
    }

    isProcessingRef.current = false;
    setIsPlaying(false);
  }, [initAudio]);

  const enqueueAudio = useCallback(
    (audioBase64, onStart) => {
      queueRef.current.push({ audioBase64, onStart });
      processQueue();
    },
    [processQueue]
  );

  const clearQueue = useCallback(() => {
    queueRef.current = [];
  }, []);

  return {
    analyserRef,
    isPlaying,
    enqueueAudio,
    clearQueue,
    initAudio,
  };
}
