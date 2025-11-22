# HTDI Agentic Lab Integration

**CODE Platformer AI** is integrated with the **HTDI Agentic Lab** — a central orchestration system for managing AI agents across multiple repositories ("houses").

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  HTDI Lab Dashboard (React + Vite)                          │
│  http://localhost:3000                                       │
└─────────────────────────────────────────────────────────────┘
                            ↕ REST API
┌─────────────────────────────────────────────────────────────┐
│  HTDI Dashboard API (Express)                                │
│  - Agent Registry Management                                 │
│  - Diary System (LeAgentDiary)                               │
│  - Mission Orchestration                                     │
│  - Cross-House Synchronization                               │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│  CODE Platformer AI (This House)                             │
│  - agentship-x-htdi/ (agent profiles, sessions, tasks)      │
│  - GitHub Workflows (lab-aware CI/CD)                        │
│  - Local CLI (sync commands)                                 │
└─────────────────────────────────────────────────────────────┘
```

## 📋 Configuration

The lab integration is configured via `.htdi-lab.config.json`:

```json
{
  "house": {
    "id": "code-platformer-ai",
    "name": "CODE Platformer AI",
    "type": "house"
  },
  "lab": {
    "enabled": true,
    "apiUrl": "http://localhost:3000",
    "registryPath": "/Users/davidcaballero/htdi-agentic-lab/var/agents.registry.json",
    "syncProfiles": true,
    "syncDiary": true
  }
}
```

## 🚀 Getting Started

### 1. Register This House

First-time setup to add CODE Platformer AI to the central lab registry:

```bash
npm run agents:register
```

This will:
- Add an entry in the central `agents.registry.json`
- Configure bidirectional sync
- Prepare the house for lab orchestration

### 2. Sync Agents

Sync local agent profiles with the central lab:

```bash
npm run agents:sync
```

This will:
- Scan `agentship-x-htdi/profiles/*.json` for agent definitions
- Update the central registry with current agents
- Pull any updates from the lab (if applicable)
- Notify the lab API of sync completion

### 3. Start Lab Services

Start the lab dashboard and API server:

```bash
# Option 1: Start dashboard (includes API)
npm run lab:dashboard

# Option 2: Start API only
npm run lab:api
```

Then visit: **http://localhost:3000**

## 🔄 Sync Workflow

### Automatic Sync (GitHub Actions)

The improved CI workflow (`agents-ci-improved.yml`) automatically syncs with the lab on:
- Push to `main` branch
- Manual workflow dispatch
- Weekly schedule (Mondays at 09:00 UTC)

### Manual Sync (Local)

```bash
# Update local docs and sync with lab
npm run agents:update && npm run agents:sync
```

## 📚 Agent Registry

The central lab maintains a registry of all agents across all houses:

**Location:** `/Users/davidcaballero/htdi-agentic-lab/var/agents.registry.json`

**Structure:**
```json
{
  "houses": [
    {
      "id": "code-platformer-ai",
      "name": "CODE Platformer AI",
      "type": "house",
      "agents": [
        {
          "alias": "agent.vault-keeper",
          "name": "Vault Keeper",
          "role": "Builder",
          "status": "active",
          "promptPath": "agentship-x-htdi/profiles/vault-keeper.json"
        }
      ]
    }
  ]
}
```

## 🤖 Agent Collectives

Agents are organized into collectives based on their role:

- **C2 (Command & Control)**: Orchestrators, strategic planners
- **Builders**: Core developers, feature implementers
- **QA**: Quality assurance, testing specialists
- **Docs**: Documentation, knowledge management

Configure your agent's collective in `.htdi-lab.config.json`:

```json
{
  "collectives": {
    "primary": "builders",
    "secondary": ["qa", "docs"]
  }
}
```

## 🔌 API Endpoints

The lab API provides endpoints for integration:

### Core Endpoints

```bash
# Get diary entries
GET http://localhost:3000/api/diary

# Run command
POST http://localhost:3000/api/run-command
Body: { "command": "echo", "args": ["hello"] }

# Run diary parser
POST http://localhost:3000/api/automation/parse

# Run autopilot
POST http://localhost:3000/api/automation/autopilot
```

### Example: Query Agents

```bash
curl http://localhost:3000/api/registry/agents \
  -H "Content-Type: application/json" \
  | jq '.houses[] | select(.id == "code-platformer-ai")'
```

## 📊 Dashboard Features

The HTDI Lab Dashboard provides:

1. **Agent Fleet View**
   - See all agents across all houses
   - Filter by status, role, collective
   - View agent profiles and prompts

2. **Mission Console**
   - Dispatch tasks to agents
   - Monitor execution status
   - View session logs

3. **Diary System (LeAgentDiary)**
   - Track agent activity
   - Record sessions and decisions
   - Generate reports

4. **Cross-House Sync**
   - Sync profiles between houses
   - Share agent templates
   - Coordinate multi-repo workflows

## 🛠️ Improved Workflows

### New: Lab-Aware CI (`agents-ci-improved.yml`)

Enhancements over the standard CI workflow:

**✅ Configuration Validation**
- Validates `.htdi-lab.config.json` before execution
- Checks if lab integration is enabled
- Gracefully handles missing config

**✅ Lab Synchronization**
- Automatically syncs agents after doc updates
- Updates central registry on push
- Notifies lab API of changes

**✅ Better Error Handling**
- Continues on non-critical failures
- Clear error messages and logs
- Proper exit codes

**✅ Enhanced Validation**
- Validates generated files
- Checks required paths
- Lints markdown with better reporting

**✅ Workflow Summary**
- Generates detailed summary in GitHub Actions UI
- Shows sync status, lab connectivity
- Reports on all job outcomes

### Usage

```yaml
# Run manually with lab sync
gh workflow run agents-ci-improved.yml \
  --field sync_with_lab=true \
  --field reason="manual-sync"

# Run without lab sync
gh workflow run agents-ci-improved.yml \
  --field sync_with_lab=false \
  --field reason="docs-only"
```

## 📝 Scripts Reference

### Lab Integration Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `register_house.py` | Register this repo as a house | `npm run agents:register` |
| `sync_with_lab.py` | Bidirectional sync with lab | `npm run agents:sync` |

### Existing Scripts (Updated)

| Script | Purpose | Usage |
|--------|---------|-------|
| `generate_audit.py` | Generate audit documentation | Part of `agents:update` |
| `generate_sitemap.py` | Generate codebase sitemap | Part of `agents:update` |
| `collect_opentasks.py` | Aggregate open tasks | Part of `agents:update` |

### NPM Scripts

```bash
# Agent management
npm run agents:cli          # Run local agent CLI
npm run agents:update       # Update docs (audit, sitemap, tasks)
npm run agents:sync         # Sync with lab
npm run agents:register     # Register house (first-time)

# Lab services
npm run lab:dashboard       # Start lab dashboard
npm run lab:api            # Start lab API only

# Development
npm run dev                # Start game dev server
npm run build              # Build for production
```

## 🔍 Troubleshooting

### Sync Issues

**Problem:** Sync fails with "Lab API not reachable"
**Solution:** Start the lab API first:
```bash
npm run lab:api
```

**Problem:** "Registry not found"
**Solution:** Ensure htdi-agentic-lab is cloned and path is correct in config

### Configuration Issues

**Problem:** Config validation fails in CI
**Solution:** Commit `.htdi-lab.config.json` to repo:
```bash
git add .htdi-lab.config.json
git commit -m "chore: add lab config"
```

### Permission Issues

**Problem:** Cannot write to registry
**Solution:** Check file permissions:
```bash
chmod 644 /Users/davidcaballero/htdi-agentic-lab/var/agents.registry.json
```

## 🎯 Best Practices

### Agent Profile Management

1. **Keep Profiles Updated**
   - Run `npm run agents:sync` after profile changes
   - Validate with `node agentship-x-htdi/profiles/validate-profile.cjs`

2. **Use Descriptive IDs**
   - Agent IDs should be unique and descriptive
   - Format: `agent.{role}-{name}` (e.g., `agent.vault-keeper`)

3. **Document Changes**
   - Update agent bio when role changes
   - Record major decisions in diary

### Sync Cadence

- **On Profile Changes:** Immediate sync
- **On Task Completion:** Sync with diary update
- **Weekly:** Automatic via GitHub Actions
- **Before Major Release:** Manual validation sync

## 📖 Related Documentation

- [HTDI Lab API Specification](../../htdi-agentic-lab/api/API_DOCUMENTATION.md)
- [Agent Registry Format](../../htdi-agentic-lab/docs/AGENTS_REGISTRY.md)
- [Automation Overview](./AUTOMATION_OVERVIEW.md)
- [Agent Profiles](./profiles/README.md)

## 🤝 Contributing

When adding new agents:

1. Create profile JSON in `agentship-x-htdi/profiles/`
2. Validate profile: `node agentship-x-htdi/profiles/validate-profile.cjs <file>`
3. Sync with lab: `npm run agents:sync`
4. Update collectives in config if needed
5. Commit and push (CI will auto-sync)

## 🔗 Quick Links

- **Lab Dashboard:** http://localhost:3000
- **API Docs:** http://localhost:3000/api/docs
- **Agent Registry:** `/Users/davidcaballero/htdi-agentic-lab/var/agents.registry.json`
- **Lab Repo:** `/Users/davidcaballero/htdi-agentic-lab`

---

**Status:** ✅ Lab integration active
**Last Updated:** 2025-11-19
**Version:** 2.0 (Collective-based agency model)
