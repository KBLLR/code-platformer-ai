#!/usr/bin/env python3
"""
Sync agentship-x-htdi with HTDI Agentic Lab
Bidirectional sync of agent profiles, registry, and diary entries
"""

import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional
import requests
import shutil

# Resolve paths
REPO_ROOT = Path(__file__).resolve().parents[2]
CONFIG_PATH = REPO_ROOT / ".htdi-lab.config.json"
PROFILES_DIR = REPO_ROOT / "agentship-x-htdi" / "profiles"
OPENTASKS_PATH = REPO_ROOT / "agentship-x-htdi" / "OPENTASKS.md"


def load_config() -> Dict:
    """Load lab configuration"""
    if not CONFIG_PATH.exists():
        print(f"❌ Config not found: {CONFIG_PATH}")
        print("Run this script from the repository root.")
        sys.exit(1)

    with open(CONFIG_PATH, "r") as f:
        return json.load(f)


def load_registry(registry_path: Path) -> Dict:
    """Load the central agent registry"""
    if not registry_path.exists():
        print(f"⚠️  Registry not found: {registry_path}")
        return {"houses": []}

    with open(registry_path, "r") as f:
        return json.load(f)


def save_registry(registry: Dict, registry_path: Path) -> None:
    """Save the central agent registry"""
    registry["generatedAt"] = datetime.utcnow().isoformat() + "Z"

    with open(registry_path, "w") as f:
        json.dump(registry, f, indent=2)

    print(f"✅ Registry saved to {registry_path}")


def scan_local_agents() -> List[Dict]:
    """Scan local profiles directory for agent JSON files"""
    agents = []

    if not PROFILES_DIR.exists():
        return agents

    for json_file in PROFILES_DIR.glob("*.json"):
        if json_file.name == "TEMPLATE.json":
            continue

        try:
            with open(json_file, "r") as f:
                profile = json.load(f)

            # Extract relevant info
            agent = {
                "alias": f"agent.{profile.get('agentId', json_file.stem)}",
                "name": profile.get("name", json_file.stem),
                "role": profile.get("role", "Builder"),
                "category": profile.get("category", "worker"),
                "status": "active",
                "promptPath": f"agentship-x-htdi/profiles/{json_file.name}",
                "description": profile.get("bio", profile.get("quote", "No description"))[:200],
                "provider": profile.get("provider", "Unknown"),
                "model3D": profile.get("model3D"),
                "favoriteColor": profile.get("favoriteColor")
            }

            agents.append(agent)
            print(f"  📋 Found agent: {agent['name']} ({agent['alias']})")

        except Exception as e:
            print(f"  ⚠️  Failed to parse {json_file.name}: {e}")

    return agents


def sync_to_registry(config: Dict) -> None:
    """Sync local agents to the central registry"""
    print("\n🔄 Syncing to central registry...")

    registry_path = Path(config["lab"]["registryPath"])
    registry = load_registry(registry_path)

    # Scan local agents
    local_agents = scan_local_agents()

    if not local_agents:
        print("  ℹ️  No local agents found to sync")
        return

    # Find or create house entry
    house_id = config["house"]["id"]
    house_entry = None

    for house in registry.get("houses", []):
        if house["id"] == house_id:
            house_entry = house
            break

    if house_entry is None:
        # Create new house entry
        house_entry = {
            "id": house_id,
            "name": config["house"]["name"],
            "type": config["house"]["type"],
            "agents": []
        }
        if "houses" not in registry:
            registry["houses"] = []
        registry["houses"].append(house_entry)
        print(f"  ✨ Created new house entry: {house_id}")

    # Update agents
    house_entry["agents"] = local_agents

    # Save registry
    save_registry(registry, registry_path)

    print(f"  ✅ Synced {len(local_agents)} agent(s) to registry")


def sync_from_registry(config: Dict) -> None:
    """Pull updates from central registry (if needed)"""
    print("\n🔽 Checking for registry updates...")

    registry_path = Path(config["lab"]["registryPath"])
    registry = load_registry(registry_path)

    house_id = config["house"]["id"]

    for house in registry.get("houses", []):
        if house["id"] == house_id:
            print(f"  ℹ️  Found house entry with {len(house.get('agents', []))} agent(s)")
            return

    print("  ℹ️  House not yet registered in central lab")


def notify_lab_api(config: Dict, action: str) -> None:
    """Notify the lab API of sync completion"""
    if not config["lab"]["enabled"]:
        return

    api_url = config["lab"]["apiUrl"]

    try:
        response = requests.post(
            f"{api_url}/api/run-command",
            json={
                "command": "echo",
                "args": [f"Sync completed for {config['house']['name']}: {action}"]
            },
            timeout=5
        )

        if response.ok:
            print(f"  ✅ Notified lab API: {action}")
        else:
            print(f"  ⚠️  Lab API returned: {response.status_code}")

    except requests.RequestException as e:
        print(f"  ⚠️  Lab API not reachable (this is OK if not running): {e}")


def main():
    """Main sync routine"""
    print("🚀 HTDI Lab Sync - agentship-x-htdi")
    print("=" * 60)

    config = load_config()

    if not config["lab"]["enabled"]:
        print("❌ Lab integration is disabled in config")
        sys.exit(0)

    print(f"📍 House: {config['house']['name']} ({config['house']['id']})")
    print(f"🔗 Lab API: {config['lab']['apiUrl']}")
    print(f"📚 Registry: {config['lab']['registryPath']}")

    # Sync operations
    sync_to_registry(config)
    sync_from_registry(config)

    # Notify lab
    notify_lab_api(config, "bidirectional-sync")

    print("\n✅ Sync complete!")
    print("=" * 60)


if __name__ == "__main__":
    main()
