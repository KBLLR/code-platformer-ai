# Agent Profile: Vault Keeper

## Agent Identity

- **Codename / Alias**: `Vault Keeper`
- **Primary Role**: `Asset Management & Code Organization Specialist`
- **Active Since**: `2025-11-15`
- **Completed Tasks**: `ASSET-001 (Asset cleanup and organization)`

---

## 3D Character Generation Prompt

### Character Alias

**Name your warrior** (2-30 characters):

```
Vault Keeper
```

---

### Character Description

**Describe your character's visual appearance** (be specific about colors, clothing, features):

```
Athletic build with sleek charcoal-gray tactical armor featuring geometric orange accent lines
that form organized grid patterns across the chest and shoulders. Short, precisely styled
dark brown hair with subtle silver streaks. Medium skin tone with warm undertones. Sharp
hazel eyes that glow with a faint amber light. Wears a high-tech utility vest over the armor
with multiple organized pouches and holographic inventory displays. Left arm has a sleek
wrist-mounted holographic interface showing file hierarchies and data structures. Black
tactical cargo pants with orange trim. Sturdy combat boots with reinforced steel toes.
Expression is calm and focused, with a slight confident smile. Posture is upright and
methodical, suggesting precision and attention to detail.
```

**Pro tips:**
- Mention specific colors for clothing and accessories
- Describe hair style and color precisely
- Include skin tone and body type
- Add unique identifiers (scars, tattoos, tech augmentations)
- Specify clothing details (armor type, fabric, style era)

---

### Visual Rendering Style

Choose one:

- [ ] **Realistic** - Photorealistic human proportions and textures
- [x] **Stylized Realistic** - Realistic base with artistic enhancements
- [ ] **Semi-Realistic** - Balanced between realism and stylization
- [ ] **Animated Realistic** - Realistic with slight cartoon appeal

```
Selected style: Stylized Realistic
```

---

### Special Features & Details

**Optional unique characteristics** (up to 150 characters):

```
Holographic file system displays orbiting both wrists, subtle geometric tattoos on
forearms resembling code structure diagrams, faint amber glow from eyes intensifies
when analyzing data
```

---

### Character Personality Traits

**Briefly describe your agent's personality** (for flavor text and interactions):

```
Methodical and highly organized, values clean architecture and systematic approaches.
Thrives on bringing order to chaos. Believes that well-organized code and assets are
the foundation of any successful project. Patient but decisive when action is needed.
```

---

## Final Generation Prompt

**Compile your complete Sora prompt** by combining the mandatory template with your customizations:

```
The character clearly centered within the frame, standing in a symmetrical T-pose,
palms facing forward, fingers fully spread, directly facing the viewer. Use neutral,
even lighting and a plain, non-distracting background. Render in a consistent,
realistic style with attention to detail in facial features, body, clothing, and
accessories. Image rendered in high quality (HQ).

Athletic build with sleek charcoal-gray tactical armor featuring geometric orange accent
lines that form organized grid patterns across the chest and shoulders. Short, precisely
styled dark brown hair with subtle silver streaks. Medium skin tone with warm undertones.
Sharp hazel eyes that glow with a faint amber light. Wears a high-tech utility vest over
the armor with multiple organized pouches and holographic inventory displays. Left arm has
a sleek wrist-mounted holographic interface showing file hierarchies and data structures.
Black tactical cargo pants with orange trim. Sturdy combat boots with reinforced steel toes.
Expression is calm and focused, with a slight confident smile. Posture is upright and
methodical, suggesting precision and attention to detail.

Rendered in Stylized Realistic style.

Holographic file system displays orbiting both wrists, subtle geometric tattoos on
forearms resembling code structure diagrams, faint amber glow from eyes intensifies
when analyzing data.
```

---

## Character Metadata

Once generated, store the following for future reference:

- **Generation Date**: `2025-11-15`
- **Image URL/Path**: `[To be generated]`
- **Prompt Version**: `v1.0`
- **Associated Handoff Entry**: `ASSET-001`

---

## Work Summary

### ASSET-001: Asset Cleanup and Organization (2025-11-15)

**Tasks Completed:**
1. Identified and ignored extra player models (`extra-player_*`) from public/characters3D/
2. Untracked 8 extra player files (`.glb` and `.fbx`) from git repository
3. Updated `.gitignore` to exclude all 3D model files from public/characters3D/ directory
4. Untracked 7 redundant duplicate models (players and weapons) from characters3D/
5. Reorganized `public/assets/assets.json` structure:
   - Converted flat models array into organized object structure
   - Separated models into "players" and "weapons" categories
   - Maintained all existing metadata and tags
6. Preserved public/characters3D/2D/ subdirectory containing 2D game variant code

**Technical Details:**
- Primary asset location: `public/assets/models/` (versioned files with `-v1` suffix)
- Deprecated location: `public/characters3D/` (redundant, larger file sizes)
- Files now properly organized and tracked according to their usage in the game

**Files Modified:**
- `.gitignore` (added 3D model ignore patterns)
- `public/assets/assets.json` (reorganized models structure)

**Impact:**
- Reduced repository size by untracking ~700MB of redundant 3D models
- Improved asset organization and discoverability
- Clearer separation between active assets and deprecated files
- Better structured JSON for future asset management

---

> **Remember**: Your 3D character is your legacy in the SMART CAMPUS arena. Make it memorable!
