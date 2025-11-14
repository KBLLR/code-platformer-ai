#!/usr/bin/env python3
"""
Agent Task Executor

Automates task execution for AI agents working on the project.
Agents can pick tasks, execute them, and update the task board.

Usage:
    python agents/scripts/agent_executor.py --project webgpu-battle-royale --task WBR-001
    python agents/scripts/agent_executor.py --project webgpu-battle-royale --auto-pick
"""

import argparse
import json
import os
import re
import subprocess
from datetime import datetime
from pathlib import Path

# Project root
ROOT = Path(__file__).parent.parent.parent

class AgentExecutor:
    def __init__(self, project_name):
        self.project_name = project_name
        self.project_path = ROOT / "agents" / "projects" / project_name
        self.tasks_file = self.project_path / "tasks.md"

        if not self.project_path.exists():
            raise ValueError(f"Project not found: {project_name}")

        if not self.tasks_file.exists():
            raise ValueError(f"Tasks file not found: {self.tasks_file}")

    def parse_tasks(self):
        """Parse tasks.md and extract all tasks"""
        with open(self.tasks_file, 'r') as f:
            content = f.read()

        tasks = []

        # Find all task tables in Backlog section
        backlog_match = re.search(r'## Backlog\s+(.*?)(?=##|$)', content, re.DOTALL)
        if backlog_match:
            backlog_content = backlog_match.group(1)

            # Extract tasks from markdown table
            lines = backlog_content.split('\n')
            for line in lines:
                if line.strip().startswith('| WBR-'):
                    parts = [p.strip() for p in line.split('|')[1:-1]]
                    if len(parts) >= 7:
                        tasks.append({
                            'id': parts[0],
                            'title': parts[1],
                            'description': parts[2],
                            'priority': parts[3],
                            'owner': parts[4],
                            'effort': parts[5],
                            'dependencies': parts[6],
                            'status': 'backlog'
                        })

        return tasks

    def get_task(self, task_id):
        """Get a specific task by ID"""
        tasks = self.parse_tasks()
        for task in tasks:
            if task['id'] == task_id:
                return task
        return None

    def auto_pick_task(self):
        """Automatically pick the highest priority task with no dependencies"""
        tasks = self.parse_tasks()

        # Priority order
        priority_order = {'Critical': 0, 'High': 1, 'Medium': 2, 'Low': 3}

        # Filter available tasks (no dependencies or dependencies met)
        available_tasks = []
        for task in tasks:
            deps = task['dependencies'].strip()
            if not deps or deps == '' or deps == '-':
                available_tasks.append(task)

        if not available_tasks:
            print("No available tasks without dependencies")
            return None

        # Sort by priority
        available_tasks.sort(key=lambda t: priority_order.get(t['priority'], 999))

        return available_tasks[0]

    def move_task_to_in_progress(self, task_id, owner="AI Agent"):
        """Move a task from Backlog to In Progress"""
        with open(self.tasks_file, 'r') as f:
            content = f.read()

        # Find task line in Backlog
        task_pattern = rf'\| {task_id} \|([^\n]+)'
        match = re.search(task_pattern, content)

        if not match:
            print(f"Task {task_id} not found in Backlog")
            return False

        task_line = match.group(0)
        task_data = match.group(1)

        # Extract task title
        title_match = re.match(r'\s*([^|]+)', task_data)
        title = title_match.group(1).strip() if title_match else "Task"

        # Remove from Backlog
        content = content.replace(task_line + '\n', '')

        # Add to In Progress
        in_progress_section = re.search(r'(## In Progress\s+.*?\n)(.*?)(?=##|$)', content, re.DOTALL)
        if in_progress_section:
            header = in_progress_section.group(1)
            today = datetime.now().strftime('%Y-%m-%d')
            new_task_line = f"| {task_id} | {title} | {today} | {owner} | Automated execution |\n"

            # Insert after header
            insert_pos = in_progress_section.start(2)
            content = content[:insert_pos] + new_task_line + content[insert_pos:]

        # Write back
        with open(self.tasks_file, 'w') as f:
            f.write(content)

        print(f"✓ Moved {task_id} to In Progress")
        return True

    def create_session_log(self, task_id, task_title):
        """Create a session log for the task"""
        timestamp = datetime.now().strftime('%Y%m%d-%H%M%S')
        session_file = self.project_path / "sessions" / f"{timestamp}-{task_id}.md"

        session_content = f"""# Session Log: {task_id}

**Task:** {task_title}
**Started:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
**Agent:** AI Agent (Automated)

## Objectives

- Implement {task_title}
- Follow architecture specifications
- Write tests where applicable
- Update documentation

## Entry Points

- Task: `agents/projects/{self.project_name}/tasks.md#{task_id}`
- Architecture: `agents/WEBGPU_BATTLE_ROYALE_ARCHITECTURE.md`

## Work Log

### {datetime.now().strftime('%H:%M')} - Session Started

Task picked from backlog automatically.

### Implementation Steps

1. [ ] Review architecture specifications
2. [ ] Implement core functionality
3. [ ] Add tests
4. [ ] Update documentation
5. [ ] Test and verify
6. [ ] Move to Review/QA

## Commands Run

```bash
# Session initialized
python agents/scripts/agent_executor.py --project {self.project_name} --task {task_id}
```

## Changes Made

- TBD (to be filled by implementing agent)

## Testing

- TBD

## Notes

- Automated session log generated
- Agent should update this file with implementation details

## Completion Checklist

- [ ] Code implemented
- [ ] Tests written and passing
- [ ] Documentation updated
- [ ] QA checklist completed
- [ ] PR created
- [ ] Task moved to Review/QA

---

> This session log tracks work on {task_id}. Update it as implementation progresses.
"""

        session_file.parent.mkdir(parents=True, exist_ok=True)
        with open(session_file, 'w') as f:
            f.write(session_content)

        print(f"✓ Created session log: {session_file}")
        return session_file

    def generate_implementation_prompt(self, task):
        """Generate a prompt for an AI agent to implement the task"""
        prompt = f"""# Task Implementation Request

**Project:** {self.project_name}
**Task ID:** {task['id']}
**Title:** {task['title']}

## Description

{task['description']}

## Priority

{task['priority']}

## Estimated Effort

{task['effort']}

## Dependencies

{task['dependencies'] if task['dependencies'].strip() else 'None'}

## Architecture Reference

Please refer to:
- `agents/WEBGPU_BATTLE_ROYALE_ARCHITECTURE.md` for detailed architecture
- `agents/audits/REPOSITORY_AUDIT.md` for current codebase state

## Implementation Guidelines

1. Follow the existing code style (ES modules, 2-space indentation)
2. Use Vite path aliases (@, @ui, @assets, etc.)
3. Add descriptive logging with [Module] prefixes
4. Write tests where applicable
5. Update session log with changes made

## Success Criteria

- Code implements the task description
- Follows architecture specifications
- Tests pass (if applicable)
- Documentation updated
- Session log completed

## Next Steps

1. Review the architecture section for this task
2. Implement the functionality
3. Test thoroughly
4. Update the session log
5. Move task to Review/QA when complete

---

Please implement this task and update the session log with your progress.
"""
        return prompt

    def execute_task(self, task_id, owner="AI Agent"):
        """Execute a task (automation entry point)"""
        task = self.get_task(task_id)

        if not task:
            print(f"Task {task_id} not found")
            return False

        print(f"\n{'='*60}")
        print(f"EXECUTING TASK: {task_id}")
        print(f"Title: {task['title']}")
        print(f"Priority: {task['priority']}")
        print(f"Effort: {task['effort']}")
        print(f"{'='*60}\n")

        # Move to In Progress
        if not self.move_task_to_in_progress(task_id, owner):
            return False

        # Create session log
        session_file = self.create_session_log(task_id, task['title'])

        # Generate implementation prompt
        prompt = self.generate_implementation_prompt(task)
        prompt_file = self.project_path / "sessions" / f"{task_id}-prompt.md"

        with open(prompt_file, 'w') as f:
            f.write(prompt)

        print(f"✓ Generated implementation prompt: {prompt_file}")

        print(f"\n{'='*60}")
        print(f"TASK READY FOR IMPLEMENTATION")
        print(f"{'='*60}")
        print(f"\nSession log: {session_file}")
        print(f"Implementation prompt: {prompt_file}")
        print(f"\nNext: An AI agent should implement this task following the prompt.")
        print(f"Update the session log as you work.\n")

        return True

def main():
    parser = argparse.ArgumentParser(description='Agent Task Executor')
    parser.add_argument('--project', required=True, help='Project name')
    parser.add_argument('--task', help='Task ID to execute')
    parser.add_argument('--auto-pick', action='store_true', help='Automatically pick highest priority task')
    parser.add_argument('--list', action='store_true', help='List all available tasks')
    parser.add_argument('--owner', default='AI Agent', help='Task owner name')

    args = parser.parse_args()

    executor = AgentExecutor(args.project)

    if args.list:
        tasks = executor.parse_tasks()
        print(f"\nAvailable tasks in {args.project}:\n")
        for task in tasks[:10]:  # Show first 10
            print(f"  {task['id']}: {task['title']} ({task['priority']})")
        print(f"\nTotal: {len(tasks)} tasks")
        return

    if args.auto_pick:
        task = executor.auto_pick_task()
        if task:
            print(f"Auto-picked task: {task['id']} - {task['title']}")
            executor.execute_task(task['id'], args.owner)
        else:
            print("No tasks available to pick")
        return

    if args.task:
        executor.execute_task(args.task, args.owner)
        return

    parser.print_help()

if __name__ == '__main__':
    main()
