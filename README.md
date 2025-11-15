# CODE Platformer AI

## Overview

A simple 2D platformer game built using HTML5 Canvas and JavaScript. The game features a player character that can move left and right, jump, and interact with platforms and obstacles. Here is the guide with instructions on how to defeat Eleanor.

A Pen created on CodePen.io. Original URL: https://codepen.io/d-knight/pen/GPzpXw.

### Technical Documentation

For comprehensive technical documentation, architecture proposals, and agent workflows, see:

- **[WebGPU Battle Royale Architecture](agents/audits/WEBGPU_BATTLE_ROYALE_ARCHITECTURE.md)** - Complete transformation roadmap
- **[Repository Audit](agents/audits/REPOSITORY_AUDIT.md)** - Current codebase analysis
- **[Agent Documentation](agents/AGENTS.md)** - Agent workflow and automation
- **[Open Tasks](agents/OPENTASKS.md)** - Active task ledger
- **[WebGPU Project](agents/projects/webgpu-battle-royale/)** - Battle royale transformation project (104 tasks)

---

## GitHub Workflows & Automation

This repository uses AI-powered automation through GitHub Actions workflows. The workflows are designed to execute tasks from the agent system using different AI providers.

### Available Workflows

#### 1. **Agents CI** (`.github/workflows/agents-ci.yml`)
Automated continuous integration for agent documentation and validation.

**Triggers:**
- Push to `main` branch
- Manual dispatch with validation options
- Weekly schedule (Mondays at 09:00 UTC)
- Pull request merges (for handoff tracking)

**Actions:**
- Generates agent documentation (audit, sitemap, opentasks)
- Runs markdown linting
- Auto-commits documentation updates
- Tracks handoff entries

#### 2. **Claude Runner** (`.github/workflows/agents-claude.yml`)
Execute tasks using Claude AI (Anthropic).

**Trigger:** Manual dispatch with task ID

**Actions:**
- Uses Claude 3.5 Sonnet to analyze and plan task execution
- Runs agent Python scripts
- Commits changes to `agents/` directory
- Creates `agents/audits/claude-summary.md` with task summary

**Required Secret:** `ANTHROPIC_API_KEY`

#### 3. **OpenAI Runner** (`.github/workflows/agents-codex.yml`)
Execute tasks using OpenAI GPT-4.

**Trigger:** Manual dispatch with task ID

**Actions:**
- Uses GPT-4 to analyze and plan task execution
- Runs agent Python scripts
- Commits changes to `agents/` directory
- Creates `agents/audits/openai-summary.md` with task summary

**Required Secret:** `OPENAI_API_KEY`

#### 4. **Gemini Runner** (`.github/workflows/agents-gemini.yml`)
Execute tasks using Google Gemini AI.

**Trigger:** Manual dispatch with task ID

**Actions:**
- Uses Gemini 1.5 Pro to analyze and plan task execution
- Runs agent Python scripts
- Commits changes to `agents/` directory
- Creates `gemini-output.md` with task summary

**Required Secret:** `GEMINI_API_KEY`

#### 5. **Jules Bridge** (`.github/workflows/agents-jules-bridge.yml`)
Creates GitHub issues from OPENTASKS for Jules agent handoffs.

**Trigger:** Manual dispatch with task ID

**Actions:**
- Parses `agents/OPENTASKS.md` to find task details
- Creates or updates GitHub issue with task brief
- Labels issue with `jules` and `handoff`

#### 6. **Agent Auto-Execute** (`.github/workflows/agent-auto-execute.yml`)
Automated task preparation and PR creation for agent tasks.

**Triggers:**
- Manual dispatch (select project and task)
- Daily schedule at 00:00 UTC (auto-picks highest priority task)

**Actions:**
- Executes agent task selector script
- Creates feature branch for task
- Generates session log and implementation prompt
- Creates draft PR with task details

**Projects:** `webgpu-battle-royale`, `gameplay-hardening`

### Required Secrets

To use the AI-powered workflows, configure these secrets in your repository:

```
ANTHROPIC_API_KEY   # For Claude Runner
OPENAI_API_KEY      # For OpenAI Runner
GEMINI_API_KEY      # For Gemini Runner
```

### Workflow Best Practices

1. **Task Execution:** Use the AI runners to execute specific tasks from `agents/OPENTASKS.md`
1. **Auto-Execute:** The daily auto-execute workflow handles high-priority tasks automatically
1. **CI Validation:** The CI workflow ensures documentation stays synchronized
1. **Handoffs:** Use Jules Bridge to create trackable GitHub issues for complex tasks

### Agent Scripts

The workflows utilize Python scripts in `agents/scripts/`:
- `generate_audit.py` - Creates repository audit documentation
- `generate_sitemap.py` - Generates codebase sitemap
- `collect_opentasks.py` - Aggregates open tasks from projects
- `agent_executor.py` - Executes agent tasks with session logging
- `handoff_sync.py` - Manages agent handoff tracking

---

## Original Game: Fund Fun Factory 2018 - Factory Battle Royale

<table>
  <tr>
    <td width="50%">
      <img src="https://docs.google.com/uc?id=1WIytsk3VCZLLf_YjEMzqwUChsTP1ThE7" alt="Screenshot 1" width="100%"/>
    </td>
    <td width="50%">
      <img src="https://docs.google.com/uc?id=1msGwWIlsMfhQKyv-6eg49_LZ-cS1xMpX" alt="Screenshot 2" width="100%"/>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <img src="https://docs.google.com/uc?id=1MTlQze9cNbrO_mK8SwvrAQABZgG11nBt" alt="Screenshot 3" width="100%"/>
    </td>
    <td width="50%">
      <img src="https://docs.google.com/uc?id=1SN5rpQuwPhy9m5OzmBdWhikwqdudRbNR" alt="Screenshot 4" width="100%"/>
    </td>
  </tr>
</table>

---
## Updated Proto: Fund Fun Factory 2025 AI Edition - Global Battle Royale 
<table>
  <tr>
    <td width="50%">
      <img src="public/assets/images/FFF-2ndPart/20250523_1206_3D Virtual Reality Scene_remix_01jvy9nbd6eewvxvvcepv1v10q.png" alt="VR Scene" width="100%"/>
    </td>
    <td width="50%">
      <img src="public/assets/images/FFF-2ndPart/20250523_1209_3D Characters in Action_remix_01jvy9tc7pejsaftw05a1br1y7.png" alt="Characters in Action" width="100%"/>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <img src="public/assets/images/FFF-2ndPart/20250523_1212_Colorful 3D Mascot_remix_01jvy9zmhhffb8h1bxeg89s6ek.png" alt="3D Mascot" width="100%"/>
    </td>
    <td width="50%">
      <img src="public/assets/images/FFF-2ndPart/20250523_1215_3D Character Display_remix_01jvya53zbe079gbzsdk6zz6m5.png" alt="Character Display" width="100%"/>
    </td>
  </tr>
</table>
