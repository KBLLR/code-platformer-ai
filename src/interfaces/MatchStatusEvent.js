/**
 * MatchStatusEvent — Match lifecycle event schema.
 *
 * Emitted at each match phase transition via A2A event bus.
 */

/**
 * @typedef {Object} MatchStatusEvent
 * @property {string}  match_id     - Unique match identifier
 * @property {string}  arena_id     - Arena config seed or identifier
 * @property {string}  phase        - "warmup" | "active" | "final_zone" | "ended"
 * @property {number}  alive_count  - Number of players still alive
 * @property {boolean} human_alive  - Whether the human player is still alive
 * @property {string}  [winner_id]  - ID of the winning player (only when phase === "ended")
 * @property {string}  [severity]   - Optional severity marker
 */

/**
 * Create a MatchStatusEvent.
 * @param {Partial<MatchStatusEvent>} params
 * @returns {MatchStatusEvent}
 */
export function createMatchStatusEvent(params) {
  return {
    match_id: params.match_id || crypto.randomUUID(),
    arena_id: params.arena_id || "unknown",
    phase: params.phase || "warmup",
    alive_count: params.alive_count ?? 12,
    human_alive: params.human_alive ?? true,
    winner_id: params.winner_id || null,
    severity: params.severity || null,
  };
}

/**
 * Convert a MatchStatusEvent into an A2A-compatible message payload.
 * @param {MatchStatusEvent} event
 * @returns {{ type: string, payload: MatchStatusEvent }}
 */
export function matchStatusToA2A(event) {
  const typeMap = {
    warmup: "code-platformer-ai.match.started",
    active: "code-platformer-ai.match.started",
    final_zone: "code-platformer-ai.match.started",
    ended: "code-platformer-ai.match.completed",
  };

  return {
    type: typeMap[event.phase] || "code-platformer-ai.status",
    payload: event,
  };
}
