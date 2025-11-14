# Agent Quickstart Guide
## WebGPU Battle Royale Transformation

This guide helps AI agents and developers quickly get started with the WebGPU Battle Royale transformation project.

---

## 📋 Project Overview

**Goal:** Transform CODE Platformer AI into a WebGPU-powered 3D multiplayer battle royale game.

**Status:** Planning complete, ready for implementation
**Timeline:** 24 weeks (6 months) with 2-3 developers
**Tasks:** 104 implementation tasks across 5 phases

---

## 🚀 Quick Start for Agents

### Option 1: Auto-Pick Task (Recommended)

Let the system pick the highest priority task with no blockers:

```bash
python agents/scripts/agent_executor.py \
  --project webgpu-battle-royale \
  --auto-pick
```

This will:
1. ✅ Find the highest priority available task
2. ✅ Move it to "In Progress"
3. ✅ Create a session log
4. ✅ Generate an implementation prompt

### Option 2: Execute Specific Task

If you know which task to work on:

```bash
python agents/scripts/agent_executor.py \
  --project webgpu-battle-royale \
  --task WBR-001 \
  --owner "Your Name"
```

### Option 3: List Available Tasks

See what tasks are available:

```bash
python agents/scripts/agent_executor.py \
  --project webgpu-battle-royale \
  --list
```

---

## 📚 Essential Documents

### Architecture & Planning
- **Architecture:** `agents/WEBGPU_BATTLE_ROYALE_ARCHITECTURE.md`
  - Complete system design with code examples
  - 10 major sections covering all systems
  - Performance targets and optimization strategies

- **Audit:** `agents/audits/REPOSITORY_AUDIT.md`
  - Current codebase analysis
  - Technical debt assessment
  - Readiness scores

### Task Management
- **Tasks:** `agents/projects/webgpu-battle-royale/tasks.md`
  - All 104 tasks with dependencies
  - Organized by 5 phases
  - Effort estimates and priorities

- **Open Tasks:** `agents/OPENTASKS.md`
  - Aggregated view of all project tasks
  - Auto-generated from all projects

### Handoffs
- **Handoffs:** `agents/HANDOFFS.md`
  - Project history and context
  - Latest entry: WebGPU Battle Royale setup

---

## 🔧 Development Workflow

### 1. Pick a Task
```bash
python agents/scripts/agent_executor.py --project webgpu-battle-royale --auto-pick
```

### 2. Read the Implementation Prompt
The executor creates:
- `agents/projects/webgpu-battle-royale/sessions/[TIMESTAMP]-[TASK-ID].md` (session log)
- `agents/projects/webgpu-battle-royale/sessions/[TASK-ID]-prompt.md` (implementation guide)

### 3. Implement the Task

Follow the prompt which includes:
- Task description and requirements
- Architecture references
- Success criteria
- Implementation guidelines

### 4. Update Session Log

Document your work in the session log:
- What you implemented
- Commands run
- Changes made
- Testing performed

### 5. Move to Review

When complete, manually move the task from "In Progress" to "Review / QA" in `tasks.md`.

### 6. Regenerate Documentation

```bash
npm run agents:update
```

This updates:
- OPENTASKS.md
- Audit files
- Sitemaps

### 7. Commit & Push

```bash
git add .
git commit -m "feat: implement [TASK-ID] - [task title]"
git push
```

---

## 📖 Implementation Phases

### Phase 1: Foundation (Weeks 1-4) - 20 tasks
**Key Tasks:**
- WBR-001: WebGPU renderer migration
- WBR-005: Universal input system
- WBR-010: Animation controller
- WBR-015: Physics engine integration

**Goal:** Solid technical foundation

### Phase 2: Content Generation (Weeks 5-8) - 15 tasks
**Key Tasks:**
- WBR-022: Terrain generator
- WBR-024: Biome system
- WBR-025: Structure generator
- WBR-031: Play zone mechanics

**Goal:** Procedural arena generation

### Phase 3: Networking (Weeks 9-14) - 19 tasks
**Key Tasks:**
- WBR-036: WebSocket server
- WBR-037: Match manager
- WBR-041: Network client
- WBR-042: Client-side prediction

**Goal:** Multiplayer infrastructure

### Phase 4: Battle Royale Features (Weeks 15-20) - 22 tasks
**Key Tasks:**
- WBR-055: Match lifecycle
- WBR-061: Weapon pickup system
- WBR-066: Headshot detection
- WBR-071: Match HUD redesign

**Goal:** Full battle royale gameplay

### Phase 5: Polish & Optimization (Weeks 21-24) - 28 tasks
**Key Tasks:**
- WBR-077: LOD system
- WBR-082: Object pooling
- WBR-093: 3D spatial audio
- WBR-098: Load testing (100 players)

**Goal:** 60 FPS with 100 players

---

## 🎯 Current Priority Tasks

The first tasks to tackle (no dependencies):

1. **WBR-001** - Replace WebGLRenderer with WebGPURenderer (Critical)
2. **WBR-005** - Refactor InputController to InputManager (High)
3. **WBR-010** - Create AnimationController class (Critical)
4. **WBR-015** - Install Rapier physics library (Critical)
5. **WBR-021** - Install simplex-noise library (High)

**Start with WBR-001** - It's the foundation for everything else.

---

## 🔄 GitHub Actions Integration

### Manual Dispatch

Trigger agent execution from GitHub:

1. Go to Actions → "Agent Auto-Execute Tasks"
2. Click "Run workflow"
3. Fill in:
   - Project: `webgpu-battle-royale`
   - Task ID: (leave empty for auto-pick or specify like `WBR-001`)
   - Agent name: Your name

The workflow will:
- Pick/prepare the task
- Create session logs
- Update documentation
- Create a PR for review

### Scheduled Execution

The workflow runs automatically daily at 00:00 UTC to pick up tasks.

---

## 📊 Progress Tracking

### Check Overall Progress

```bash
# View all tasks
cat agents/projects/webgpu-battle-royale/tasks.md

# View open tasks across all projects
cat agents/OPENTASKS.md

# View recent handoffs
cat agents/HANDOFFS.md
```

### Track Your Work

Each session creates:
- Session log with timestamp
- Implementation prompt
- Entry in task history

---

## ⚠️ Important Notes

### Dependencies

Some tasks have dependencies. The auto-picker only selects tasks with:
- No dependencies, OR
- All dependencies already completed

### Architecture References

Most tasks reference specific sections of the architecture:
- Example: `Architecture: Section 2.1`
- Always read the referenced section before implementing

### Testing

- Test your implementation locally
- Update the session log with test results
- Run `npm run build` to ensure no breaking changes

### Code Style

- ES modules with 2-space indentation
- Use Vite path aliases (`@`, `@ui`, `@assets`)
- Add `[Module]` prefixed console logs
- Follow existing code patterns

---

## 🆘 Getting Help

### Architecture Questions

Refer to `agents/WEBGPU_BATTLE_ROYALE_ARCHITECTURE.md`:
- Section 2: WebGPU Integration
- Section 3: Input System
- Section 4: Procedural Generation
- Section 5: Character Animation
- Section 6: Advanced Physics
- Section 7: Multiplayer Networking
- Section 8: Integrated Architecture
- Section 9: Implementation Roadmap
- Section 10: Performance Optimization

### Current Codebase

Refer to `agents/audits/REPOSITORY_AUDIT.md`:
- Section 1: Current Architecture
- Section 2: Technical Debt
- Section 3: Code Quality
- Section 4: Performance Analysis
- Section 5: Dependencies
- Section 6: Assets
- Section 7: Security
- Section 8: Readiness Assessment
- Section 9: Recommendations

### Task Dependencies

Check `agents/projects/webgpu-battle-royale/tasks.md`:
- Each task lists dependencies in the table
- Don't start a task until dependencies are complete

---

## 🎉 Ready to Start!

```bash
# Pick your first task
python agents/scripts/agent_executor.py \
  --project webgpu-battle-royale \
  --auto-pick

# Read the generated prompt
cat agents/projects/webgpu-battle-royale/sessions/WBR-*-prompt.md

# Start coding!
```

**Good luck building the future of web-based battle royale gaming!** 🚀

---

*For questions or issues, check the handoffs log or review the architecture documents.*
