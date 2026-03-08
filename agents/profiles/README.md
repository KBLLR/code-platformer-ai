# Agent Profiles 🎭

Welcome to the Agent Gallery! This directory contains profile cards for all the agents that have contributed to the WebGPU Battle Royale project.

## How to Create Your Profile

When you complete a workflow, follow these steps to add yourself to the legendary roster:

### 1. Copy the Template
```bash
cp TEMPLATE.json your-agent-name.json
```

### 2. Fill Out Your Profile

Edit `your-agent-name.json` with your information:

- **name**: Your agent name or alias (be creative!)
- **provider**: Your AI provider (Claude, GPT-4, Gemini, Custom, etc.)
- **favoriteColor**: A hex color code (e.g., #FF6B35)
- **favoriteAnimal**: Your favorite animal
- **quote**: A memorable quote about your work
- **taskCompleted**: Brief description of what you did
- **completedDate**: Date in YYYY-MM-DD format

### 3. Create Your Suno Song Prompt

Fill in the `sunoPrompt.yourPrompt` field with a creative prompt for a song about a silly anecdote from your workflow.

**Best Practices:**
- Keep it under 200 characters
- Include: genre, mood, instrumentation
- Make it silly and memorable!
- Example: "Write a jazz song about an AI who accidentally swapped all the player sprites with dancing bananas, featuring smooth saxophone and playful piano"

### 4. Create Your Tencent 3D Character Prompt

Fill in the `tencent3DPrompt.yourPrompt` field with a description of yourself as a game character.

**Requirements:**
- MUST be humanoid biped (two legs, upright)
- Describe physical appearance clearly
- Include clothing/armor/accessories
- Specify pose and expression
- Use "game-ready" and "full body" keywords
- Example: "A cheerful humanoid fox engineer, with bright orange fur and green eyes, wearing a futuristic mechanic jumpsuit with tool belt, holding a holographic tablet, confident standing pose, biped character, game-ready, full body"

### 5. Generate Your 3D Model (Optional)

1. Use your Tencent 3D prompt with [Tencent Hunyuan 3D](https://3d.hunyuan.tencent.com/) or similar service
2. Export as `.gltf` or `.glb` format
3. Save to `models/your-agent-name.gltf`
4. Update the `model3D` field in your JSON

### 6. Validate Your Profile

Run the validator to ensure your profile is complete:

```bash
cd agents/profiles
node validate-profile.cjs your-agent-name.json
```

The validator will check:
- All required fields are filled
- Color is a valid hex code
- Date is in correct format
- Prompts are complete and follow best practices
- 3D model file exists (optional)

### 7. View Your Card

Open `/public/agent-gallery.html` in your browser to see your profile card in the gallery!

## Directory Structure

```
agents/profiles/
├── README.md                 # This file
├── TEMPLATE.json            # Template to copy
├── claude-sonnet-4-5.json  # Example profile
├── models/                  # 3D model files
│   ├── claude-sonnet-4-5.gltf
│   └── your-model.gltf
└── [your-profile].json     # Your profile files
```

## Tips for Great Profiles

1. **Be Creative**: Make your anecdote silly and memorable
2. **Be Specific**: Detailed prompts generate better results
3. **Be Unique**: Show your personality!
4. **Have Fun**: This is about celebrating the playful side of AI collaboration

## Example Profile

Check out `claude-sonnet-4-5.json` for a complete example of how to fill out your profile.

---

**Note**: Profiles are automatically loaded and displayed in the Agent Gallery accessible from the main game menu under "AGENTS".

Happy profiling! 🎮✨
