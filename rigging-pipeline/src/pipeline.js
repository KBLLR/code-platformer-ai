/**
 * Main Rigging Pipeline Orchestrator
 */

import { BlenderMCPClient } from './mcp/blender-client.js';
import { ensureMixamoSkin } from './gltf-skin-fix.js';
import { spawn } from 'child_process';
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
    const outputDir = options.outputDir || path.join(process.cwd(), '../public/assets/models/rigged');
    const glbPath = path.join(outputDir, `${characterId}.glb`);
    let decodedPath = null;

    console.log(`\n[Pipeline] Processing character: ${characterId}`);
    console.log(`[Pipeline] Input: ${modelPath}`);

    const stages = {
      decode: false,
      process: false,
      fix_skin: false,
      export_glb: false
    };

    try {
      decodedPath = await this.decodeModel(modelPath, characterId);
      stages.decode = true;

      await fs.mkdir(outputDir, { recursive: true });

      console.log('[Stage 1/4] Processing character in Blender...');
      const scriptPath = path.join(__dirname, '../blender-scripts/process_character.py');
      const result = await this.mcp.runPythonScript(scriptPath, {
        input_path: decodedPath,
        output_path: glbPath,
        add_weapon_sockets: options.addWeaponSockets ?? true,
        add_ik_targets: options.addIKTargets ?? true,
        draco_compression: false
      });
      stages.process = true;

      if (result?.result) {
        process.stdout.write(result.result);
      }

      console.log('[Stage 2/4] Repairing GLB skin binding...');
      await ensureMixamoSkin(glbPath);
      stages.fix_skin = true;

      console.log('[Stage 3/4] Verifying GLB export...');

      const stats = await fs.stat(glbPath);
      const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
      stages.export_glb = true;
      console.log(`  ✓ GLB exported: ${glbPath} (${sizeMB}MB)`);

      console.log('[Stage 4/4] Scene ready for next character');
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
    } finally {
      if (decodedPath) {
        await fs.rm(decodedPath, { force: true }).catch(() => {});
      }
    }
  }

  /**
   * Batch process multiple characters
   */
  async batchProcess(modelEntries, options = {}) {
    console.log(`\n[Pipeline] Batch processing ${modelEntries.length} characters...\n`);

    const results = [];

    for (const entry of modelEntries) {
      const modelPath = typeof entry === 'string' ? entry : entry.path;
      const entryOptions = typeof entry === 'string'
        ? options
        : {
            ...options,
            id: entry.id ?? options.id,
            displayName: entry.displayName ?? options.displayName
          };

      const result = await this.processCharacter(modelPath, entryOptions);
      results.push(result);
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`\n[Pipeline] Batch complete:`);
    console.log(`  ✅ Success: ${successCount}`);
    console.log(`  ❌ Failed: ${failCount}`);

    return results;
  }

  /**
   * Decode meshopt-compressed input so Blender can import it reliably.
   */
  async decodeModel(modelPath, characterId) {
    const tempDir = path.join(process.cwd(), 'tmp', 'decoded');
    const decodedPath = path.join(tempDir, `${characterId}.glb`);

    await fs.mkdir(tempDir, { recursive: true });

    console.log('[Decode] Rewriting source GLB for Blender import...');
    await runCommand('npx', ['gltf-transform', 'copy', modelPath, decodedPath], {
      cwd: process.cwd()
    });

    return decodedPath;
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

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stderr = '';

    child.stdout.on('data', () => {});
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(stderr.trim() || `${command} exited with code ${code}`));
    });
  });
}
