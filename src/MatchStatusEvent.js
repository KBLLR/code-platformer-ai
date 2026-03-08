// src/MatchStatusEvent.js
// Translates match lifecycle changes into A2A-compatible event payloads.
// Keeps all Core-X event structure in one place.

export const EventTypes = {
  MATCH_STARTED:   'code-platformer-ai.match.started',
  MATCH_COMPLETED: 'code-platformer-ai.match.completed',
  PHASE_CHANGED:   'code-platformer-ai.match.phase_changed',
  PLAYER_DIED:     'code-platformer-ai.match.player_died',
  PLAYER_WON:      'code-platformer-ai.match.player_won',
  ALIVE_COUNT:     'code-platformer-ai.match.alive_count',
};

/**
 * Build a structured A2A event payload for a given lifecycle change.
 * @param {string} type  One of EventTypes.*
 * @param {object} data  Event-specific payload
 * @returns {{type:string, timestamp:string, source:string, data:object}}
 */
export function buildMatchEvent(type, data = {}) {
  return {
    type,
    timestamp: new Date().toISOString(),
    source: 'code-platformer-ai',
    data,
  };
}

export const MatchStatusEvent = {
  started(arenaConfig) {
    return buildMatchEvent(EventTypes.MATCH_STARTED, {
      seed: arenaConfig.seed,
      size: arenaConfig.size,
      numPlayers: arenaConfig.numPlayers,
    });
  },

  completed(winnerIndex, scores, durationSeconds) {
    return buildMatchEvent(EventTypes.MATCH_COMPLETED, {
      winnerIndex,
      scores,
      durationSeconds,
    });
  },

  phaseChanged(phase, safeZoneRadius) {
    return buildMatchEvent(EventTypes.PHASE_CHANGED, { phase, safeZoneRadius });
  },

  playerDied(playerIndex, isHuman, killedBy) {
    return buildMatchEvent(EventTypes.PLAYER_DIED, { playerIndex, isHuman, killedBy });
  },

  playerWon(playerIndex, isHuman, score) {
    return buildMatchEvent(EventTypes.PLAYER_WON, { playerIndex, isHuman, score });
  },

  aliveCount(count, total) {
    return buildMatchEvent(EventTypes.ALIVE_COUNT, { count, total });
  },
};
