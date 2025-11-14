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
2. **Session Start** - Date, time, agent codename
3. **Approach** - Strategy and implementation plan
4. **Changes Made** - Files modified, created, deleted
5. **Testing** - How changes were validated
6. **Blockers** - Any issues encountered
7. **Next Steps** - What remains or what should be done next
8. **Session End** - Completion time, summary

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
2. Log all work in the session file
3. Update the session log as work progresses
4. Link the session in the PR description
5. Mark the task as completed when done

## Archiving

Completed session logs remain here for historical reference and knowledge transfer.
