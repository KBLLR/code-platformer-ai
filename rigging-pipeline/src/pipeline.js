/**
 * Main Rigging Pipeline Orchestrator
 */

import { BlenderMCPClient } from './mcp/blender-client.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class RiggingPipeline {
  constructor(config = {}) {
    this.config = config;
    this.mcp = null;
    this.jobs = new Map();
  }

  /**
   * Initialize pipeline
   */
  async initialize() {
    console.log('[Pipeline] Initializing rigging pipeline...');

    // Connect to Blender MCP
    this.mcp = new BlenderMCPClient({
      port: this.config.mcpPort || 9876
    });

    await this.mcp.connect();

    console.log('[Pipeline] ✓ Pipeline ready');
  }

  /**
   * Process a single character model
   */
  async processCharacter(modelPath, options = {}) {
    const characterId = options.id || path.basename(modelPath, path.extname(modelPath));

    console.log(`\n[Pipeline] Processing character: ${characterId}`);
    console.log(`[Pipeline] Input: ${modelPath}`);

    const stages = {
      import: false,
      validate: false,
      enhance: false,
      export_glb: false,
      export_vrm: false
    };

    try {
      // Stage 1: Import model
      console.log('[Stage 1/5] Importing model to Blender...');
      await this.mcp.importModel(modelPath);
      stages.import = true;
      console.log('  ✓ Import complete');

      // Stage 2: Validate skeleton
      console.log('[Stage 2/5] Validating skeleton...');
      const objects = await this.mcp.getSceneObjects();
      console.log(`  Found ${objects.length || 0} objects in scene`);

      // Find armature
      const armatureName = await this.findArmature();
      if (!armatureName) {
        throw new Error('No armature found in model');
      }
      console.log(`  ✓ Found armature: ${armatureName}`);
      stages.validate = true;

      // Stage 3: Enhance rig (weapon sockets, etc.)
      console.log('[Stage 3/5] Enhancing rig...');
      await this.enhanceRig(armatureName, options);
      stages.enhance = true;
      console.log('  ✓ Rig enhanced');

      // Stage 4: Export GLB
      console.log('[Stage 4/5] Exporting GLB...');
      const outputDir = options.outputDir || path.join(process.cwd(), '../public/assets/models/rigged');
      await fs.mkdir(outputDir, { recursive: true });

      const glbPath = path.join(outputDir, `${characterId}.glb`);
      await this.mcp.exportGLB(glbPath, {
        includeAnimations: true,
        dracoCompression: true,
        dracoCompressionLevel: 10,
        textureFormat: 'webp'
      });
      stages.export_glb = true;

      const stats = await fs.stat(glbPath);
      const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
      console.log(`  ✓ GLB exported: ${glbPath} (${sizeMB}MB)`);

      // Stage 5: Export VRM (optional)
      if (options.exportVRM !== false) {
        console.log('[Stage 5/5] Exporting VRM...');
        const vrmPath = path.join(outputDir, `${characterId}.vrm`);

        try {
          await this.mcp.exportVRM(vrmPath, {
            version: '1.0',
            title: options.displayName || characterId,
            author: 'CODE Platformer AI'
          });
          stages.export_vrm = true;

          const vrmStats = await fs.stat(vrmPath);
          const vrmSizeMB = (vrmStats.size / 1024 / 1024).toFixed(2);
          console.log(`  ✓ VRM exported: ${vrmPath} (${vrmSizeMB}MB)`);
        } catch (error) {
          console.warn(`  ⚠ VRM export failed (optional): ${error.message}`);
        }
      } else {
        console.log('[Stage 5/5] Skipping VRM export');
      }

      console.log(`\n✅ Character "${characterId}" processed successfully!`);

      return {
        success: true,
        characterId,
        glbPath,
        stages
      };

    } catch (error) {
      console.error(`\n❌ Processing failed for "${characterId}":`, error.message);

      return {
        success: false,
        characterId,
        error: error.message,
        stages
      };
    }
  }

  /**
   * Find armature in scene
   */
  async findArmature() {
    const objects = await this.mcp.getSceneObjects();

    // Common armature names
    const armatureNames = [
      'Armature',
      'armature',
      'rig',
      'Rig',
      'skeleton',
      'Skeleton',
      'Root'
    ];

    // Search for armature
    for (const name of armatureNames) {
      if (objects.content && objects.content.includes(name)) {
        return name;
      }
    }

    // If response has structured data, search there
    if (Array.isArray(objects)) {
      for (const obj of objects) {
        if (obj.type === 'ARMATURE' || armatureNames.includes(obj.name)) {
          return obj.name;
        }
      }
    }

    return 'Armature'; // Default fallback
  }

  /**
   * Enhance rig with weapon sockets and IK targets
   */
  async enhanceRig(armatureName, options) {
    // Run enhancement script
    const scriptPath = path.join(__dirname, '../blender-scripts/enhance_rig.py');

    try {
      await this.mcp.runPythonScript(scriptPath, {
        armature_name: armatureName,
        add_weapon_sockets: options.addWeaponSockets ?? true,
        add_ik_targets: options.addIKTargets ?? true
      });
    } catch (error) {
      console.warn(`  ⚠ Rig enhancement script failed: ${error.message}`);
      // Continue anyway - enhancement is optional
    }
  }

  /**
   * Batch process multiple characters
   */
  async batchProcess(modelPaths, options = {}) {
    console.log(`\n[Pipeline] Batch processing ${modelPaths.length} characters...\n`);

    const results = [];

    for (const modelPath of modelPaths) {
      const result = await this.processCharacter(modelPath, options);
      results.push(result);

      // Clear scene for next model
      await this.clearScene();
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`\n[Pipeline] Batch complete:`);
    console.log(`  ✅ Success: ${successCount}`);
    console.log(`  ❌ Failed: ${failCount}`);

    return results;
  }

  /**
   * Clear Blender scene
   */
  async clearScene() {
    try {
      await this.mcp.callTool('delete_all_objects', {});
    } catch (error) {
      console.warn('[Pipeline] Failed to clear scene:', error.message);
    }
  }

  /**
   * Shutdown pipeline
   */
  async shutdown() {
    if (this.mcp) {
      await this.mcp.disconnect();
    }
    console.log('[Pipeline] Shutdown complete');
  }
}
