/**
 * Core-X OpenResponses Client — Plain JS
 * Ported from core-x/lib/openresponses.ts
 *
 * Typed client for consuming /v1/responses SSE streams.
 * Used by the arena authoring surface and any AI-assisted generation.
 */

/**
 * Parse an SSE stream from /v1/responses into typed events.
 *
 * Supports two SSE formats:
 *  1. Standard — separate `event:` and `data:` lines
 *  2. Embedded — `data: {"type": "...", ...}` with type inside JSON payload
 *
 * The MLX backend uses format 2; the parser handles both transparently.
 *
 * @param {Response} response - Fetch Response with SSE body
 * @yields {{ type: string, data: object }}
 */
export async function* parseResponseStream(response) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";
  let currentEventType = null;
  let dataLines = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("event: ")) {
        currentEventType = line.slice(7).trim();
      } else if (line.startsWith("data: ")) {
        dataLines.push(line.slice(6));
      } else if (line === "" && dataLines.length > 0) {
        const raw = dataLines.join("\n");
        dataLines = [];

        if (raw.trim() === "[DONE]") {
          currentEventType = null;
          continue;
        }

        try {
          const data = JSON.parse(raw);
          const eventType =
            currentEventType ||
            (typeof data.type === "string" ? data.type : null);
          if (eventType) {
            yield { type: eventType, data };
          }
        } catch {
          if (currentEventType) {
            yield { type: currentEventType, data: { raw } };
          }
        }
        currentEventType = null;
      } else if (line === "") {
        currentEventType = null;
        dataLines = [];
      }
    }
  }
}

/**
 * High-level client for OpenResponses /v1/responses endpoint.
 */
export class OpenResponsesClient {
  /**
   * @param {string} baseUrl - Gateway base URL
   */
  constructor(baseUrl = "http://localhost:8090") {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  /**
   * Create a streaming response.
   * @param {{ model: string, input: string|Array, instructions?: string, tools?: Array, temperature?: number, max_output_tokens?: number, stream?: boolean, previous_response_id?: string }} request
   * @returns {Promise<AsyncGenerator<{ type: string, data: object }>>}
   */
  async createResponse(request) {
    const res = await fetch(`${this.baseUrl}/v1/responses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({ ...request, stream: true }),
    });

    if (!res.ok) {
      throw new Error(`OpenResponses error: ${res.status} ${res.statusText}`);
    }

    return parseResponseStream(res);
  }

  /**
   * Simple chat helper — collects all text deltas into a single string.
   * @param {string} prompt
   * @param {string} model
   * @returns {Promise<string>}
   */
  async chat(prompt, model = "default") {
    const stream = await this.createResponse({
      model,
      input: prompt,
      stream: true,
    });
    const parts = [];
    for await (const event of stream) {
      if (event.type === "response.output_text.delta") {
        parts.push(event.data?.delta || "");
      }
    }
    return parts.join("");
  }
}
