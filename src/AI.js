// src/AI.js
import * as THREE from "three";
import { game_config } from "./game_config.js";
import { Level } from "./Level.js";

export class AIController {
  constructor(player, difficulty = 'normal') {
    this.player = player;
    this.difficulty = difficulty;
    this.isAI = true;
    
    // AI State
    this.currentTarget = null;
    this.lastDecisionTime = 0;
    this.decisionCooldown = 500; // ms between decisions
    this.lastActionTime = 0;
    this.actionCooldown = 200; // ms between actions
    
    // Behavior settings based on difficulty
    this.settings = this.getDifficultySettings(difficulty);
    
    // Movement state
    this.desiredPosition = null;
    this.isPathfinding = false;
    this.stuckCounter = 0;
    this.lastPosition = new THREE.Vector3();
    
    // Combat state
    this.lastAttackTime = 0;
    this.attackCooldown = 1000;
    this.combatRange = 8;
    this.fleeHealthThreshold = 30;
    
    // Personality traits
    this.personality = this.generatePersonality();
    
    console.log(`[AI] Created AI controller for Player ${this.player.player_number + 1} with difficulty: ${difficulty}`);
  }

  getDifficultySettings(difficulty) {
    const settings = {
      easy: {
        reactionTime: 800,
        accuracy: 0.6,
        aggression: 0.3,
        jumpPrecision: 0.4,
        movementSpeed: 0.7,
        decisionQuality: 0.5
      },
      normal: {
        reactionTime: 500,
        accuracy: 0.75,
        aggression: 0.6,
        jumpPrecision: 0.7,
        movementSpeed: 0.85,
        decisionQuality: 0.7
      },
      hard: {
        reactionTime: 300,
        accuracy: 0.9,
        aggression: 0.8,
        jumpPrecision: 0.9,
        movementSpeed: 1.0,
        decisionQuality: 0.9
      },
      expert: {
        reactionTime: 150,
        accuracy: 0.95,
        aggression: 0.9,
        jumpPrecision: 0.95,
        movementSpeed: 1.0,
        decisionQuality: 0.95
      }
    };
    return settings[difficulty] || settings.normal;
  }

  generatePersonality() {
    const personalities = [
      {
        name: "Aggressive",
        traits: { aggression: 1.2, patience: 0.5, riskTaking: 0.9 }
      },
      {
        name: "Defensive", 
        traits: { aggression: 0.6, patience: 1.3, riskTaking: 0.3 }
      },
      {
        name: "Opportunist",
        traits: { aggression: 0.8, patience: 0.9, riskTaking: 0.7 }
      },
      {
        name: "Berserker",
        traits: { aggression: 1.5, patience: 0.2, riskTaking: 1.2 }
      }
    ];
    
    return personalities[Math.floor(Math.random() * personalities.length)];
  }

  update(deltaTime, allPlayers) {
    if (!this.player || this.player.dead) return;
    
    const now = performance.now();
    
    // Decision making cooldown
    if (now - this.lastDecisionTime < this.decisionCooldown) return;
    
    // Update AI state
    this.analyzeEnvironment(allPlayers);
    this.makeDecision(deltaTime, allPlayers);
    this.executeActions(deltaTime);
    
    this.lastDecisionTime = now;
    this.detectIfStuck();
  }

  analyzeEnvironment(allPlayers) {
    // Find nearby players
    const nearbyPlayers = this.findNearbyPlayers(allPlayers);
    
    // Find money/objectives
    const objectives = this.findObjectives();
    
    // Assess threats
    const threats = this.assessThreats(nearbyPlayers);
    
    // Update current target based on priorities
    this.selectTarget(nearbyPlayers, objectives, threats);
  }

  findNearbyPlayers(allPlayers) {
    const myPos = this.player.mesh.position;
    return allPlayers
      .filter(p => p && !p.dead && p !== this.player)
      .map(p => ({
        player: p,
        distance: myPos.distanceTo(p.mesh.position),
        direction: p.mesh.position.clone().sub(myPos).normalize()
      }))
      .sort((a, b) => a.distance - b.distance);
  }

  findObjectives() {
    // Look for money, weapons, power-ups, etc.
    const objectives = [];
    
    // Check for money spawns if level has them
    if (Level.ActiveLevel && Level.ActiveLevel.moneySpawns) {
      Level.ActiveLevel.moneySpawns.forEach(spawn => {
        const distance = this.player.mesh.position.distanceTo(spawn);
        objectives.push({
          type: 'money',
          position: spawn,
          distance: distance,
          priority: 10 - Math.min(distance, 10) // Closer = higher priority
        });
      });
    }
    
    return objectives.sort((a, b) => b.priority - a.priority);
  }

  assessThreats(nearbyPlayers) {
    return nearbyPlayers
      .filter(p => p.distance < this.combatRange)
      .map(p => ({
        ...p,
        threatLevel: this.calculateThreatLevel(p.player)
      }))
      .sort((a, b) => b.threatLevel - a.threatLevel);
  }

  calculateThreatLevel(enemy) {
    let threat = 0;
    
    // Health comparison
    const healthRatio = enemy.health / this.player.health;
    threat += healthRatio * 30;
    
    // Weapon comparison
    if (enemy.currentWeapon && !this.player.currentWeapon) {
      threat += 40;
    }
    
    // Distance (closer = more threatening)
    const distance = this.player.mesh.position.distanceTo(enemy.mesh.position);
    threat += Math.max(0, 50 - distance * 5);
    
    return threat;
  }

  selectTarget(nearbyPlayers, objectives, threats) {
    const healthPercentage = this.player.health / this.player.maxHealth;
    
    // If low health, prioritize fleeing or finding health
    if (healthPercentage < this.fleeHealthThreshold / 100) {
      this.currentTarget = this.findSafePosition(threats);
      return;
    }
    
    // If no weapon, prioritize finding weapons
    if (!this.player.currentWeapon) {
      const weaponObjective = objectives.find(obj => obj.type === 'weapon');
      if (weaponObjective) {
        this.currentTarget = weaponObjective;
        return;
      }
    }
    
    // Combat behavior based on personality
    const aggression = this.settings.aggression * this.personality.traits.aggression;
    
    if (threats.length > 0 && aggression > 0.5) {
      // Aggressive: target nearest enemy
      this.currentTarget = threats[0];
    } else if (objectives.length > 0) {
      // Opportunistic: go for objectives
      this.currentTarget = objectives[0];
    } else if (nearbyPlayers.length > 0) {
      // Default: move toward action
      this.currentTarget = nearbyPlayers[Math.floor(Math.random() * Math.min(3, nearbyPlayers.length))];
    }
  }

  findSafePosition(threats) {
    const myPos = this.player.mesh.position;
    const safePositions = [];
    
    // Generate potential safe positions
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
      const distance = 10;
      const pos = new THREE.Vector3(
        myPos.x + Math.cos(angle) * distance,
        myPos.y,
        myPos.z + Math.sin(angle) * distance
      );
      
      // Check if position is away from threats
      const avgThreatDistance = threats.reduce((sum, threat) => {
        return sum + pos.distanceTo(threat.player.mesh.position);
      }, 0) / Math.max(threats.length, 1);
      
      safePositions.push({
        position: pos,
        safety: avgThreatDistance
      });
    }
    
    // Return safest position
    safePositions.sort((a, b) => b.safety - a.safety);
    return safePositions[0];
  }

  makeDecision(deltaTime, allPlayers) {
    if (!this.currentTarget) return;
    
    const myPos = this.player.mesh.position;
    const now = performance.now();
    
    // Combat decisions
    if (this.currentTarget.player) {
      const enemy = this.currentTarget.player;
      const distance = this.currentTarget.distance;
      
      if (distance < this.combatRange && this.player.currentWeapon) {
        if (now - this.lastAttackTime > this.attackCooldown) {
          this.planAttack(enemy);
        }
      } else {
        this.planMovement(enemy.mesh.position);
      }
    }
    // Objective decisions
    else if (this.currentTarget.position) {
      this.planMovement(this.currentTarget.position);
    }
  }

  planAttack(enemy) {
    const accuracy = this.settings.accuracy;
    const shouldAttack = Math.random() < accuracy;
    
    if (shouldAttack) {
      // Aim at target with some variance based on accuracy
      const aimVariance = (1 - accuracy) * 2; // Max 2 unit variance
      const targetPos = enemy.mesh.position.clone();
      targetPos.x += (Math.random() - 0.5) * aimVariance;
      targetPos.y += (Math.random() - 0.5) * aimVariance;
      
      // Set aim direction
      const aimDir = targetPos.sub(this.player.mesh.position).normalize();
      this.player.moveDir.copy(aimDir);
      
      // Set facing direction
      this.player.facingDirection = aimDir.x > 0 ? 1 : -1;
      
      // Schedule attack
      this.scheduledActions = this.scheduledActions || [];
      this.scheduledActions.push({
        action: 'attack',
        delay: this.settings.reactionTime + Math.random() * 100
      });
    }
  }

  planMovement(targetPosition) {
    this.desiredPosition = targetPosition.clone();
    
    // Simple pathfinding - move toward target
    const myPos = this.player.mesh.position;
    const direction = this.desiredPosition.clone().sub(myPos);
    direction.y = 0; // Ignore vertical for movement direction
    
    if (direction.length() > 0.5) {
      direction.normalize();
      
      // Check if we need to jump
      const needsJump = this.shouldJump(direction);
      
      // Schedule movement actions
      this.scheduledActions = this.scheduledActions || [];
      this.scheduledActions.push({
        action: 'move',
        direction: direction,
        delay: Math.random() * this.settings.reactionTime
      });
      
      if (needsJump) {
        this.scheduledActions.push({
          action: 'jump',
          delay: this.settings.reactionTime + Math.random() * 200
        });
      }
    }
  }

  shouldJump(moveDirection) {
    const myPos = this.player.mesh.position;
    const jumpPrecision = this.settings.jumpPrecision;
    
    // Check if there's an obstacle ahead
    const checkDistance = 2;
    const checkPos = myPos.clone().add(moveDirection.clone().multiplyScalar(checkDistance));
    
    // Simple jump logic - jump if target is higher or if we detect an obstacle
    if (this.desiredPosition && this.desiredPosition.y > myPos.y + 0.5) {
      return Math.random() < jumpPrecision;
    }
    
    // Random occasional jumps for movement variation
    if (Math.random() < 0.1 * jumpPrecision) {
      return true;
    }
    
    return false;
  }

  executeActions(deltaTime) {
    const now = performance.now();
    
    if (!this.scheduledActions) this.scheduledActions = [];
    
    // Execute scheduled actions
    for (let i = this.scheduledActions.length - 1; i >= 0; i--) {
      const action = this.scheduledActions[i];
      action.delay -= deltaTime * 1000;
      
      if (action.delay <= 0) {
        this.performAction(action);
        this.scheduledActions.splice(i, 1);
      }
    }
    
    // Clear actions that are too old
    this.scheduledActions = this.scheduledActions.filter(a => a.delay > -1000);
  }

  performAction(action) {
    if (!this.player || this.player.dead) return;
    
    switch (action.action) {
      case 'move':
        if (action.direction.x > 0) {
          this.player.moveRight();
        } else if (action.direction.x < 0) {
          this.player.moveLeft();
        }
        break;
        
      case 'jump':
        if (this.player.grounded) {
          this.player.jump();
        }
        break;
        
      case 'attack':
        if (this.player.currentWeapon) {
          this.player.attack(Level.ActiveLevel?.scene);
          this.lastAttackTime = performance.now();
        }
        break;
    }
  }

  detectIfStuck() {
    const myPos = this.player.mesh.position;
    const distanceMoved = myPos.distanceTo(this.lastPosition);
    
    if (distanceMoved < 0.1) {
      this.stuckCounter++;
    } else {
      this.stuckCounter = 0;
    }
    
    this.lastPosition.copy(myPos);
    
    // If stuck for too long, try to unstuck
    if (this.stuckCounter > 20) {
      this.unstuckBehavior();
      this.stuckCounter = 0;
    }
  }

  unstuckBehavior() {
    // Try jumping
    if (this.player.grounded && Math.random() < 0.7) {
      this.player.jump();
    }
    
    // Try moving in a random direction
    const randomDirection = Math.random() > 0.5 ? 1 : -1;
    this.scheduledActions = this.scheduledActions || [];
    this.scheduledActions.push({
      action: 'move',
      direction: new THREE.Vector3(randomDirection, 0, 0),
      delay: 0
    });
    
    console.log(`[AI] Player ${this.player.player_number + 1} attempting unstuck behavior`);
  }

  // Public methods for external control
  setDifficulty(newDifficulty) {
    this.difficulty = newDifficulty;
    this.settings = this.getDifficultySettings(newDifficulty);
    console.log(`[AI] Player ${this.player.player_number + 1} difficulty changed to: ${newDifficulty}`);
  }

  setPersonality(personalityName) {
    const personalities = {
      "Aggressive": { aggression: 1.2, patience: 0.5, riskTaking: 0.9 },
      "Defensive": { aggression: 0.6, patience: 1.3, riskTaking: 0.3 },
      "Opportunist": { aggression: 0.8, patience: 0.9, riskTaking: 0.7 },
      "Berserker": { aggression: 1.5, patience: 0.2, riskTaking: 1.2 }
    };
    
    if (personalities[personalityName]) {
      this.personality = {
        name: personalityName,
        traits: personalities[personalityName]
      };
      console.log(`[AI] Player ${this.player.player_number + 1} personality changed to: ${personalityName}`);
    }
  }

  getStatus() {
    return {
      difficulty: this.difficulty,
      personality: this.personality.name,
      currentTarget: this.currentTarget?.type || this.currentTarget?.player?.player_number || 'none',
      isStuck: this.stuckCounter > 10,
      scheduledActions: this.scheduledActions?.length || 0
    };
  }
}

// AI Manager for handling all AI players
export class AIManager {
  constructor() {
    this.aiControllers = [];
    this.updateInterval = 100; // Update AI every 100ms
    this.lastUpdate = 0;
  }

  addAIPlayer(player, difficulty = 'normal') {
    const controller = new AIController(player, difficulty);
    player.aiController = controller;
    player.isAI = true;
    this.aiControllers.push(controller);
    
    console.log(`[AIManager] Added AI controller for Player ${player.player_number + 1}`);
    return controller;
  }

  removeAIPlayer(player) {
    const index = this.aiControllers.findIndex(ai => ai.player === player);
    if (index > -1) {
      this.aiControllers.splice(index, 1);
      player.aiController = null;
      player.isAI = false;
      console.log(`[AIManager] Removed AI controller for Player ${player.player_number + 1}`);
    }
  }

  update(deltaTime, allPlayers) {
    const now = performance.now();
    
    if (now - this.lastUpdate < this.updateInterval) return;
    
    // Update all AI controllers
    this.aiControllers.forEach(ai => {
      if (ai.player && !ai.player.dead) {
        ai.update(deltaTime, allPlayers);
      }
    });
    
    this.lastUpdate = now;
  }

  setGlobalDifficulty(difficulty) {
    this.aiControllers.forEach(ai => {
      ai.setDifficulty(difficulty);
    });
    console.log(`[AIManager] Set global AI difficulty to: ${difficulty}`);
  }

  getAIStatus() {
    return this.aiControllers.map(ai => ({
      playerNumber: ai.player.player_number + 1,
      ...ai.getStatus()
    }));
  }

  cleanup() {
    this.aiControllers.length = 0;
  }
}

// Export singleton instance
export const aiManager = new AIManager();