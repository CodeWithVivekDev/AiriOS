"""WebSocket connection manager for real-time communication."""

import json
import logging
from typing import Dict, List
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages WebSocket connections and conversation state."""

    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.conversation_histories: Dict[str, List[dict]] = {}

    async def connect(self, websocket: WebSocket, client_id: str):
        """Accept a new WebSocket connection."""
        await websocket.accept()
        self.active_connections[client_id] = websocket
        self.conversation_histories[client_id] = []
        logger.info(f"Client {client_id} connected. Active: {len(self.active_connections)}")

    def disconnect(self, client_id: str):
        """Remove a disconnected client."""
        self.active_connections.pop(client_id, None)
        self.conversation_histories.pop(client_id, None)
        logger.info(f"Client {client_id} disconnected. Active: {len(self.active_connections)}")

    def get_history(self, client_id: str) -> List[dict]:
        """Get conversation history for a client."""
        return self.conversation_histories.get(client_id, [])

    def add_to_history(self, client_id: str, role: str, content: str):
        """Add a message to conversation history."""
        if client_id in self.conversation_histories:
            self.conversation_histories[client_id].append({
                "role": role,
                "content": content
            })
            # Keep only last 20 messages to manage context window
            if len(self.conversation_histories[client_id]) > 20:
                self.conversation_histories[client_id] = self.conversation_histories[client_id][-20:]

    async def send_json(self, client_id: str, data: dict):
        """Send JSON data to a specific client."""
        if client_id in self.active_connections:
            try:
                await self.active_connections[client_id].send_json(data)
            except Exception as e:
                logger.error(f"Error sending to {client_id}: {e}")
                self.disconnect(client_id)

    async def broadcast(self, data: dict):
        """Broadcast JSON data to all connected clients."""
        disconnected = []
        for client_id, ws in self.active_connections.items():
            try:
                await ws.send_json(data)
            except Exception:
                disconnected.append(client_id)
        for cid in disconnected:
            self.disconnect(cid)


manager = ConnectionManager()
