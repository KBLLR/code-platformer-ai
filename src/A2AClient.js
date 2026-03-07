// src/A2AClient.js
// Plain-JS port of the Core-X A2A event bus client.
// Publishes game events over SSE POST and subscribes to inbound streams.

const DEFAULT_GATEWAY = import.meta.env?.VITE_A2A_GATEWAY_URL || 'http://localhost:4000';
const SOURCE_ID       = 'code-platformer-ai';

export class A2AClient {
  /**
   * @param {string} [gatewayUrl]  Override the default gateway base URL
   */
  constructor(gatewayUrl = DEFAULT_GATEWAY) {
    this._base    = gatewayUrl.replace(/\/$/, '');
    this._sse     = null;
    this._handlers = {};
    console.log(`[A2AClient] Initialized → ${this._base}`);
  }

  // ── Publishing ──────────────────────────────────────────────────────────────

  /**
   * Publish a single event to the A2A bus.
   * Fire-and-forget; logs on failure but never throws.
   * @param {{type:string, timestamp:string, source:string, data:object}} event
   */
  async publish(event) {
    try {
      const res = await fetch(`${this._base}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...event, source: SOURCE_ID }),
      });
      if (!res.ok) {
        console.warn(`[A2AClient] Publish failed (${res.status}):`, event.type);
      } else {
        console.log(`[A2AClient] Published: ${event.type}`);
      }
    } catch (err) {
      // Gateway may not be running in dev — degrade gracefully
      console.warn(`[A2AClient] Gateway unreachable, event dropped: ${event.type}`, err.message);
    }
  }

  // ── Subscribing ─────────────────────────────────────────────────────────────

  /**
   * Open an SSE stream and register a handler for a specific event type.
   * Multiple handlers for different types can coexist on the same connection.
   * @param {string}   eventType  e.g. 'code-platformer-ai.match.started'
   * @param {function} handler    Called with the parsed event object
   */
  subscribe(eventType, handler) {
    this._handlers[eventType] = handler;
    if (!this._sse) this._openStream();
    console.log(`[A2AClient] Subscribed to: ${eventType}`);
  }

  unsubscribe(eventType) {
    delete this._handlers[eventType];
    console.log(`[A2AClient] Unsubscribed from: ${eventType}`);
  }

  _openStream() {
    const url = `${this._base}/events/stream?source=${SOURCE_ID}`;
    try {
      this._sse = new EventSource(url);
      this._sse.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data);
          const handler = this._handlers[event.type];
          if (handler) handler(event);
        } catch { /* malformed message */ }
      };
      this._sse.onerror = () => {
        console.warn('[A2AClient] SSE stream error — will retry automatically');
      };
      console.log(`[A2AClient] SSE stream opened: ${url}`);
    } catch (err) {
      console.warn('[A2AClient] Could not open SSE stream:', err.message);
    }
  }

  close() {
    if (this._sse) {
      this._sse.close();
      this._sse = null;
    }
    this._handlers = {};
    console.log('[A2AClient] Closed');
  }
}
