// src/OpenResponsesClient.js
// SSE client for the Core-X LLM gateway.
// Used to stream ArenaConfig mutations from the language model.

const DEFAULT_GATEWAY = import.meta.env?.VITE_A2A_GATEWAY_URL || 'http://localhost:4000';

export class OpenResponsesClient {
  /**
   * @param {string} [gatewayUrl]
   */
  constructor(gatewayUrl = DEFAULT_GATEWAY) {
    this._base = gatewayUrl.replace(/\/$/, '');
    console.log(`[OpenResponsesClient] Initialized → ${this._base}`);
  }

  /**
   * Stream a text generation request from the gateway.
   * The gateway accepts a prompt and returns an SSE stream of token deltas.
   *
   * @param {string}   prompt     The user/system prompt
   * @param {function} onChunk    Called with each text chunk as it arrives
   * @param {function} [onDone]   Called when the stream ends
   * @param {function} [onError]  Called on error
   * @returns {function} abort — call to cancel the stream
   */
  streamGenerate(prompt, onChunk, onDone = () => {}, onError = () => {}) {
    let aborted = false;
    const abort = () => { aborted = true; };

    const run = async () => {
      try {
        const res = await fetch(`${this._base}/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, stream: true }),
        });

        if (!res.ok) {
          throw new Error(`Gateway returned ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (!aborted) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          // Parse SSE lines
          const lines = buffer.split('\n');
          buffer = lines.pop(); // last partial line back into buffer

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const raw = line.slice(6).trim();
              if (raw === '[DONE]') { onDone(); return; }
              try {
                const parsed = JSON.parse(raw);
                const chunk = parsed.delta || parsed.text || raw;
                onChunk(chunk);
              } catch {
                onChunk(raw);
              }
            }
          }
        }

        onDone();
      } catch (err) {
        console.warn('[OpenResponsesClient] Stream error:', err.message);
        onError(err);
      }
    };

    run();
    return abort;
  }

  /**
   * Ask the gateway to generate or mutate an ArenaConfig JSON.
   * Returns a Promise that resolves to a plain object (parsed JSON).
   *
   * @param {string} instruction  Natural-language description of desired changes
   * @param {object} [existing]   Existing ArenaConfig.toJSON() to mutate
   * @returns {Promise<object>}
   */
  async generateArenaConfig(instruction, existing = null) {
    const prompt = existing
      ? `Mutate this JSON arena config based on the instruction below.\n\nInstruction: ${instruction}\n\nExisting config:\n${JSON.stringify(existing, null, 2)}\n\nReturn ONLY valid JSON.`
      : `Generate a new arena config JSON for a 12-player battle royale based on: ${instruction}\n\nReturn ONLY valid JSON.`;

    return new Promise((resolve, reject) => {
      let accumulated = '';

      this.streamGenerate(
        prompt,
        (chunk) => { accumulated += chunk; },
        () => {
          try {
            // Extract JSON from potential markdown code fences
            const match = accumulated.match(/```(?:json)?\s*([\s\S]*?)```/) ||
                          accumulated.match(/(\{[\s\S]*\})/);
            const json = match ? match[1] : accumulated;
            resolve(JSON.parse(json.trim()));
          } catch (e) {
            console.warn('[OpenResponsesClient] Could not parse JSON response, returning null');
            resolve(null);
          }
        },
        reject
      );
    });
  }
}
