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
- Auto-commits documentation updates (only when changes exist)
- Tracks handoff entries

**Behavior:**
- **Idempotent:** The workflow passes cleanly when there are no documentation changes to commit
- **Bytecode handling:** Python bytecode (`.pyc`, `__pycache__`) files are automatically cleaned and ignored to prevent spurious failures
- **Loop prevention:** Auto-commits include `[skip ci]` to avoid infinite workflow re-triggering
- **Scoped commits:** Only stages and commits files in `agents/` documentation paths, not accidental artifacts

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

### Local Agent CLI

Use the local CLI to replicate the workflow behavior without leaving your terminal:

```bash
pnpm agents:cli
# or
python scripts/agent_cli.py
```

> The CLI uses the [`rich`](https://github.com/Textualize/rich) library for its TUI. Install it once with `pip install rich` (or your preferred Python package manager) before running the commands above.

The CLI mirrors the workflows documented above:

- **Model Runner:** pick Claude Sonnet 4.5 (`claude --print --model claude-sonnet-4-5-20250929`), OpenAI via Codex CLI (`codex exec --model gpt-5.1-codex` — the 0.58 release exposes `gpt-5.1-codex`, `gpt-5.1-codex-mini`, and raw `gpt-5.1`), Gemini 2.5 Flash (`gemini --model gemini-2.5-flash --sandbox`), or Jules (`jules new --repo <path>`). Each run matches the GitHub workflows, writes the same summary artifacts (`agents/audits/claude-summary.md`, `agents/audits/openai-summary.md`, `gemini-output.md`, `agents/audits/jules-summary.md`), and then offers to run the generator scripts. (For Gemini CLI, enable sandbox mode globally via `gemini settings --sandbox=ON` or pass `--sandbox` per run so the agent can execute shell commands.)
- **Multi-Agent Dispatch:** select one or many agents in a single session. If a runner hits quota (e.g., Claude weekly cap), the CLI logs the error and keeps going with the remaining selections so you still get Codex/Gemini/Jules coverage.
- **Jules Quota Awareness:** Jules runs are asynchronous and limited to 15 free dispatches per day. The CLI tracks usage (stored under `agents/logs/jules-usage.json`), warns when the cap is hit, and asks for confirmation before spending additional runs.
- **Auto Execute:** wrap `agents/scripts/agent_executor.py` for the same preparation handled by `.github/workflows/agent-auto-execute.yml`.
- **Workflow Summary:** lists each workflow so you can jump between GitHub and local runs quickly.
- **Generators:** optionally runs `generate_audit.py`, `generate_sitemap.py`, and `collect_opentasks.py` just like the CI workflow once your model summary is captured.

> Install and authenticate the CLI agents (`claude`, `codex`, `gemini`, `jules`) before running `agents:cli`. The CLI surfaces the error text from each agent when credentials or quotas need attention.

**Agent-specific setup**
- Claude CLI: run `claude login` (or `claude --print --model claude-sonnet-4-5-20250929 "hi"`) so the tool can refresh tokens and honor the weekly quota. If you hit the cap, the CLI will report “Weekly limit reached…”.
- Codex CLI: run `codex login` and ensure your account can access the configured model (`gpt-5.1-codex` by default; `gpt-5.1-codex-mini` and `gpt-5.1` are also available). If you need a different tier, change the `CODEX_MODEL` constant in `scripts/agent_cli.py`.
- Gemini CLI: enable its sandbox so the agent may execute shell commands (`gemini settings --sandbox=ON`, or pass `--sandbox` per invocation). Without the sandbox, Gemini only returns planning text.
- Jules CLI: run `jules login` to authorize via Google, then the CLI can dispatch asynchronous sessions via `jules new --repo <path>`. Remember the local tool enforces the 15 free runs/day limit and logs usage in `agents/logs/jules-usage.json`.

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
