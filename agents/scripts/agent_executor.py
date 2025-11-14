#!/usr/bin/env python3
"""
Agent Task Executor

Automates task selection and preparation for agent workflows.

Usage:
    # Auto-pick highest priority task
    python agent_executor.py --project webgpu-battle-royale --auto-pick

    # Execute specific task
    python agent_executor.py --project webgpu-battle-royale --task WBR-001

    # List available tasks
    python agent_executor.py --project webgpu-battle-royale --list
"""

import argparse
import re
from datetime import datetime
from pathlib import Path
import sys

# Add parent directory to path for imports
sys.path.append(str(Path(__file__).parent))
from utils import read_md, write_md, get_agents_root


def parse_tasks(tasks_md_content):
    """Parse tasks from tasks.md markdown file."""
    tasks = []

    # Pattern to match task rows in markdown table
    pattern = r'\|\s*([A-Z]+-\d+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|'

    for match in re.finditer(pattern, tasks_md_content):
        task_id = match.group(1).strip()
        title = match.group(2).strip()
        description = match.group(3).strip()
        priority = match.group(4).strip()
        status = match.group(5).strip()
        dependencies = match.group(6).strip()
        estimate = match.group(7).strip()

        tasks.append({
            'id': task_id,
            'title': title,
            'description': description,
            'priority': priority.lower(),
            'status': status.lower(),
            'dependencies': [d.strip() for d in dependencies.split(',') if d.strip() and d.strip() != '-'],
            'estimate': estimate
        })

    return tasks


def get_available_tasks(tasks):
    """Get tasks that are ready to be worked on (no incomplete dependencies)."""
    completed_ids = {t['id'] for t in tasks if t['status'] == 'completed'}

    available = []
    for task in tasks:
        if task['status'] in ['ready', 'backlog']:
            # Check if all dependencies are completed
            deps_met = all(dep in completed_ids for dep in task['dependencies'])
            if deps_met:
                available.append(task)

    return available


def prioritize_tasks(tasks):
    """Sort tasks by priority (critical > high > medium > low)."""
    priority_order = {'critical': 0, 'high': 1, 'medium': 2, 'low': 3}
    return sorted(tasks, key=lambda t: priority_order.get(t['priority'], 99))


def create_session_log(project_path, task):
    """Create a session log file for the task."""
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    session_file = project_path / 'sessions' / f"{timestamp}-{task['id']}.md"

    content = f"""# Session Log - {task['id']}

**Task:** {task['title']}
**Priority:** {task['priority'].capitalize()}
**Started:** {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
**Agent:** [Your codename]

---

## Task Description

{task['description']}

**Estimated Effort:** {task['estimate']}

**Dependencies:** {', '.join(task['dependencies']) if task['dependencies'] else 'None'}

---

## Approach

[Describe your implementation strategy here]

---

## Changes Made

### Files Modified
-

### Files Created
-

### Files Deleted
-

---

## Testing

[Describe how you tested the changes]

---

## Blockers

[List any issues or blockers encountered]

---

## Next Steps

[What remains to be done, or what should be done next]

---

## Session End

**Completed:** [Date and time]
**Status:** [Completed / Partially completed / Blocked]
**Summary:** [Brief summary of what was accomplished]
"""

    write_md(session_file, content)
    return session_file


def create_implementation_prompt(project_path, task, architecture_path):
    """Create an implementation prompt for the task."""
    prompt_file = project_path / 'sessions' / f"{task['id']}-prompt.md"

    # Try to read architecture document for context
    arch_context = ""
    if architecture_path.exists():
        arch_content = read_md(architecture_path)
        # Extract relevant section based on task ID
        arch_context = "\n\n## Architecture Reference\n\nSee: agents/audits/WEBGPU_BATTLE_ROYALE_ARCHITECTURE.md"

    content = f"""# Implementation Prompt - {task['id']}

## Task Overview

**ID:** {task['id']}
**Title:** {task['title']}
**Priority:** {task['priority'].capitalize()}
**Estimate:** {task['estimate']}

## Description

{task['description']}

## Dependencies

{', '.join(task['dependencies']) if task['dependencies'] else 'None - This task can be started immediately'}

## Implementation Guidelines

### Success Criteria

- Task objectives fully met
- Code follows existing architecture patterns
- Tests added or updated (if applicable)
- Documentation updated
- No regressions introduced

### Code Locations

Based on the architecture, you'll likely need to work in:

"""

    # Add suggested file locations based on task ID prefix
    if 'WBR-001' in task['id'] or 'WBR-002' in task['id'] or 'WBR-003' in task['id'] or 'WBR-004' in task['id']:
        content += """- `src/Game.js` - Renderer initialization
- `src/renderers/` - Create new directory for WebGPU renderer
- `vite.config.js` - May need WebGPU-specific config
"""
    elif 'WBR-005' <= task['id'] <= 'WBR-009':
        content += """- `src/InputController.js` - Refactor to InputManager
- `src/input/` - Create new directory for input devices
- `src/ui/` - Input configuration UI
"""
    elif 'WBR-010' <= task['id'] <= 'WBR-014':
        content += """- `src/Player.js` - Animation integration
- `src/animation/` - Create new directory for animation system
"""
    elif 'WBR-015' <= task['id'] <= 'WBR-020':
        content += """- `src/physics/` - Create new directory for physics
- `src/Player.js` - Physics integration
- `package.json` - Add Rapier dependency
"""
    else:
        content += """- [Review tasks.md and architecture document for specific file locations]
"""

    content += f"""{arch_context}

## Testing Plan

1. **Unit Tests:** [If applicable]
2. **Integration Tests:** [How to test with existing systems]
3. **Manual Testing:** [Steps to verify functionality]
4. **Performance Testing:** [If applicable]

## Notes

- Follow existing code style and patterns
- Update relevant documentation
- Reference this task ID ({task['id']}) in commit messages
- Link session log in PR description

---

**Ready to implement? Start your session log and begin coding!**
"""

    write_md(prompt_file, content)
    return prompt_file


def update_task_status(tasks_file, task_id, new_status):
    """Update task status in tasks.md file."""
    content = read_md(tasks_file)

    # Find and update the task status
    pattern = rf'(\|\s*{re.escape(task_id)}\s*\|[^|]*\|[^|]*\|[^|]*\|\s*)\w+(\s*\|)'
    updated = re.sub(pattern, rf'\1{new_status}\2', content)

    write_md(tasks_file, updated)


def list_tasks(tasks, show_all=False):
    """Print available tasks."""
    available = get_available_tasks(tasks)
    prioritized = prioritize_tasks(available)

    if not prioritized:
        print("No tasks available. All tasks either completed or blocked by dependencies.")
        return

    print(f"\n{'='*80}")
    print(f"AVAILABLE TASKS ({len(prioritized)} ready)")
    print(f"{'='*80}\n")

    for i, task in enumerate(prioritized[:10 if not show_all else None], 1):
        print(f"{i}. [{task['priority'].upper()}] {task['id']}: {task['title']}")
        print(f"   {task['description'][:100]}...")
        print(f"   Estimate: {task['estimate']} | Dependencies: {', '.join(task['dependencies']) if task['dependencies'] else 'None'}")
        print()

    if len(prioritized) > 10 and not show_all:
        print(f"... and {len(prioritized) - 10} more tasks")
        print("Use --list --all to see all tasks\n")


def main():
    parser = argparse.ArgumentParser(description='Agent Task Executor')
    parser.add_argument('--project', required=True, help='Project name (e.g., webgpu-battle-royale)')
    parser.add_argument('--task', help='Specific task ID to execute (e.g., WBR-001)')
    parser.add_argument('--auto-pick', action='store_true', help='Automatically pick highest priority task')
    parser.add_argument('--list', action='store_true', help='List available tasks')
    parser.add_argument('--all', action='store_true', help='Show all tasks (use with --list)')

    args = parser.parse_args()

    # Get project path
    agents_root = get_agents_root()
    project_path = agents_root / 'projects' / args.project

    if not project_path.exists():
        print(f"Error: Project '{args.project}' not found at {project_path}")
        sys.exit(1)

    tasks_file = project_path / 'tasks.md'
    if not tasks_file.exists():
        print(f"Error: tasks.md not found in project {args.project}")
        sys.exit(1)

    # Parse tasks
    tasks_content = read_md(tasks_file)
    tasks = parse_tasks(tasks_content)

    if not tasks:
        print("Error: No tasks found in tasks.md")
        sys.exit(1)

    # List mode
    if args.list:
        list_tasks(tasks, show_all=args.all)
        return

    # Select task
    selected_task = None

    if args.task:
        # Specific task requested
        selected_task = next((t for t in tasks if t['id'] == args.task), None)
        if not selected_task:
            print(f"Error: Task {args.task} not found")
            sys.exit(1)

        # Check dependencies
        if selected_task['status'] not in ['ready', 'backlog']:
            print(f"Warning: Task {args.task} is {selected_task['status']}")

        completed_ids = {t['id'] for t in tasks if t['status'] == 'completed'}
        unmet_deps = [d for d in selected_task['dependencies'] if d not in completed_ids]
        if unmet_deps:
            print(f"Warning: Task has unmet dependencies: {', '.join(unmet_deps)}")
            print("Continue anyway? (y/n): ", end='')
            if input().lower() != 'y':
                sys.exit(0)

    elif args.auto_pick:
        # Auto-pick highest priority available task
        available = get_available_tasks(tasks)
        if not available:
            print("No tasks available. All tasks either completed or blocked by dependencies.")
            sys.exit(0)

        prioritized = prioritize_tasks(available)
        selected_task = prioritized[0]

        print(f"Auto-picked task: {selected_task['id']} - {selected_task['title']}")
        print(f"Priority: {selected_task['priority'].capitalize()}")
        print(f"Estimate: {selected_task['estimate']}")

    else:
        print("Error: Must specify --task, --auto-pick, or --list")
        sys.exit(1)

    # Create session log and prompt
    print(f"\n{'='*80}")
    print(f"PREPARING TASK: {selected_task['id']}")
    print(f"{'='*80}\n")

    session_file = create_session_log(project_path, selected_task)
    print(f"✓ Created session log: {session_file.relative_to(agents_root)}")

    architecture_path = agents_root / 'audits' / 'WEBGPU_BATTLE_ROYALE_ARCHITECTURE.md'
    prompt_file = create_implementation_prompt(project_path, selected_task, architecture_path)
    print(f"✓ Created implementation prompt: {prompt_file.relative_to(agents_root)}")

    # Update task status to in_progress
    update_task_status(tasks_file, selected_task['id'], 'In Progress')
    print(f"✓ Updated task status to 'In Progress'")

    print(f"\n{'='*80}")
    print(f"TASK READY FOR EXECUTION")
    print(f"{'='*80}\n")
    print(f"Task: {selected_task['id']} - {selected_task['title']}")
    print(f"Priority: {selected_task['priority'].capitalize()}")
    print(f"Estimate: {selected_task['estimate']}")
    print(f"\nNext steps:")
    print(f"1. Review implementation prompt: {prompt_file.relative_to(agents_root)}")
    print(f"2. Start coding and log progress in: {session_file.relative_to(agents_root)}")
    print(f"3. Reference {selected_task['id']} in commit messages")
    print(f"4. Link session log in PR description\n")


if __name__ == '__main__':
    main()
