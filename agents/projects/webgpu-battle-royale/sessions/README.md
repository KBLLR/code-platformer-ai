# Session Logs - WebGPU Battle Royale

This directory contains session logs for all agent work on the WebGPU Battle Royale transformation project.

## Naming Convention

Session logs follow this pattern:
```
YYYYMMDD-HHMMSS-TASKID.md
```

Example: `20251114-140530-WBR-001.md`

## Auto-Generation

Session logs are automatically created when using the agent executor:

```bash
python agents/scripts/agent_executor.py --project webgpu-battle-royale --task WBR-001
```

## Session Log Template

Each session log should include:

1. **Task Information** - Task ID, title, priority
1. **Session Start** - Date, time, agent codename
1. **Approach** - Strategy and implementation plan
1. **Changes Made** - Files modified, created, deleted
1. **Testing** - How changes were validated
1. **Blockers** - Any issues encountered
1. **Next Steps** - What remains or what should be done next
1. **Session End** - Completion time, summary

## Implementation Prompts

Task-specific implementation prompts are also generated:
```
TASKID-prompt.md
```

These contain:
- Task description
- Architecture references
- Implementation guidelines
- Success criteria
- Related code locations

## Usage

Agents should:
1. Read the task prompt before starting
1. Log all work in the session file
1. Update the session log as work progresses
1. Link the session in the PR description
1. Mark the task as completed when done

## Archiving

Completed session logs remain here for historical reference and knowledge transfer.
