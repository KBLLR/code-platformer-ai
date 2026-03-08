/**
 * Core-X A2A Client — Plain JS
 * Ported from core-x/lib/a2a-client.ts
 *
 * Inter-house communication via the event bus SSE stream.
 * Used by the match runtime to broadcast match lifecycle events
 * and subscribe to ecosystem directives.
 */

const HOUSE_ID = "code-platformer-ai";

/**
 * A2A (Agent-to-Agent) client for inter-house communication.
 */
export class A2AClient {
  /**
   * @param {{ houseId?: string, capabilities?: string[], busUrl?: string }} config
   */
  constructor(config = {}) {
    this.houseId = config.houseId || HOUSE_ID;
    this.capabilities = config.capabilities || [];
    this.busUrl = (config.busUrl || "http://localhost:8085").replace(/\/$/, "");
    /** @type {Map<string, Function[]>} */
    this.handlers = new Map();
    /** @type {EventSource|null} */
    this.eventSource = null;
  }

  /**
   * Register this house with the event bus.
   */
  async connect() {
    try {
      await fetch(`${this.busUrl}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          house_id: this.houseId,
          capabilities: this.capabilities,
        }),
      });
      console.log(`[A2A] Registered house "${this.houseId}" with event bus.`);
    } catch (err) {
      console.warn(`[A2A] Failed to register with event bus:`, err.message);
    }
  }

  /**
   * Subscribe to event bus SSE stream.
   * @param {string[]} [patterns] - Event type patterns to subscribe to
   */
  subscribe(patterns) {
    const params = new URLSearchParams({ house: this.houseId });
    if (patterns) params.set("subscribe", patterns.join(","));

    this.eventSource = new EventSource(`${this.busUrl}/events?${params}`);

    this.eventSource.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        const type = message.type;

        // Call type-specific handlers
        const typeHandlers = this.handlers.get(type) || [];
        typeHandlers.forEach((h) => h(message));

        // Call wildcard handlers
        const wildcardHandlers = this.handlers.get("*") || [];
        wildcardHandlers.forEach((h) => h(message));
      } catch {
        // Ignore parse errors (keepalive pings etc.)
      }
    };

    this.eventSource.onerror = () => {
      console.warn("[A2A] SSE connection error — will auto-reconnect.");
    };

    console.log(`[A2A] Subscribed to event bus.`);
  }

  /**
   * Send a message to the event bus.
   * @param {Partial<{ type: string, target: object, correlation_id: string, payload: object, ttl_seconds: number, priority: string }>} message
   */
  async send(message) {
    const full = {
      message_id: crypto.randomUUID(),
      type: message.type || "context.share",
      source_house: this.houseId,
      target: message.target || { broadcast: true },
      correlation_id: message.correlation_id || crypto.randomUUID(),
      payload: message.payload || {},
      ttl_seconds: message.ttl_seconds || 300,
      timestamp: new Date().toISOString(),
      priority: message.priority || "normal",
      ...message,
    };

    try {
      await fetch(`${this.busUrl}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(full),
      });
    } catch (err) {
      console.warn(`[A2A] Failed to send event:`, err.message);
    }
  }

  /**
   * Send a request and wait for a correlated response.
   * @param {string} targetHouse
   * @param {object} payload
   * @param {string} type
   * @param {number} timeout
   * @returns {Promise<object>}
   */
  async request(targetHouse, payload, type = "task.request", timeout = 30000) {
    const correlationId = crypto.randomUUID();

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(`A2A request to ${targetHouse} timed out`));
      }, timeout);

      const responseHandler = (msg) => {
        if (msg.correlation_id === correlationId) {
          cleanup();
          resolve(msg);
        }
      };

      const cleanup = () => {
        clearTimeout(timer);
        ["task.accept", "task.complete", "task.fail", "capability.response"].forEach((t) => {
          this.off(t, responseHandler);
        });
      };

      ["task.accept", "task.complete", "task.fail", "capability.response"].forEach((t) => {
        this.on(t, responseHandler);
      });

      this.send({
        type,
        target: { house_id: targetHouse },
        correlation_id: correlationId,
        payload,
      });
    });
  }

  /**
   * Register an event handler.
   * @param {string} type - Event type or "*" for wildcard
   * @param {Function} handler
   */
  on(type, handler) {
    const existing = this.handlers.get(type) || [];
    existing.push(handler);
    this.handlers.set(type, existing);
  }

  /**
   * Remove an event handler.
   * @param {string} type
   * @param {Function} handler
   */
  off(type, handler) {
    const existing = this.handlers.get(type) || [];
    this.handlers.set(
      type,
      existing.filter((h) => h !== handler)
    );
  }

  /**
   * Disconnect from the event bus.
   */
  disconnect() {
    this.eventSource?.close();
    this.eventSource = null;
    this.handlers.clear();
    console.log("[A2A] Disconnected from event bus.");
  }
}
