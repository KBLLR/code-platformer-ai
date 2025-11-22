#!/usr/bin/env python3
"""
Register CODE Platformer AI as a house in HTDI Agentic Lab
One-time setup script to add this repo to the central registry
"""

import json
import sys
from pathlib import Path
from datetime import datetime

# Paths
REPO_ROOT = Path(__file__).resolve().parents[2]
CONFIG_PATH = REPO_ROOT / ".htdi-lab.config.json"
LAB_REGISTRY_PATH = Path("/Users/davidcaballero/htdi-agentic-lab/var/agents.registry.json")


def main():
    print("🏠 Registering CODE Platformer AI with HTDI Lab")
    print("=" * 60)

    # Load config
    if not CONFIG_PATH.exists():
        print(f"❌ Config not found: {CONFIG_PATH}")
        sys.exit(1)

    with open(CONFIG_PATH, "r") as f:
        config = json.load(f)

    # Load registry
    if not LAB_REGISTRY_PATH.exists():
        print(f"❌ Lab registry not found: {LAB_REGISTRY_PATH}")
        print("Make sure htdi-agentic-lab is cloned and set up.")
        sys.exit(1)

    with open(LAB_REGISTRY_PATH, "r") as f:
        registry = json.load(f)

    # Check if already registered
    house_id = config["house"]["id"]
    for house in registry.get("houses", []):
        if house["id"] == house_id:
            print(f"✅ House already registered: {house_id}")
            print(f"   Name: {house['name']}")
            print(f"   Agents: {len(house.get('agents', []))}")
            return

    # Create house entry
    house_entry = {
        "id": house_id,
        "name": config["house"]["name"],
        "type": config["house"]["type"],
        "agentshipVersion": config["house"]["agentshipVersion"],
        "description": config["house"]["description"],
        "repository": config["house"]["repository"]["url"],
        "agents": []
    }

    # Add to registry
    if "houses" not in registry:
        registry["houses"] = []

    registry["houses"].append(house_entry)
    registry["generatedAt"] = datetime.utcnow().isoformat() + "Z"

    # Save registry
    with open(LAB_REGISTRY_PATH, "w") as f:
        json.dump(registry, f, indent=2)

    print(f"✅ House registered successfully!")
    print(f"   ID: {house_id}")
    print(f"   Name: {config['house']['name']}")
    print(f"   Type: {config['house']['type']}")
    print(f"\n📝 Registry updated: {LAB_REGISTRY_PATH}")
    print("\n🚀 Next steps:")
    print("   1. Run: npm run agents:sync")
    print("   2. Check dashboard at http://localhost:3000")
    print("=" * 60)


if __name__ == "__main__":
    main()
