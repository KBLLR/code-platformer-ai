/**
 * Blender CLI Interface (Fallback when MCP not available)
 * Runs Blender in background mode with Python scripts
 */

import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class BlenderCLI {
  constructor(config = {}) {
    this.blenderPath = config.blenderPath || 'blender';
  }

  /**
   * Run Blender with Python script
   */
  async runScript(scriptPath, args = {}) {
    return new Promise((resolve, reject) => {
      const argsJson = JSON.stringify(args);

      const blenderArgs = [
        '--background',
        '--python', scriptPath,
        '--',
        argsJson
      ];

      console.log(`[Blender] Running script: ${path.basename(scriptPath)}`);

      const blender = spawn(this.blenderPath, blenderArgs, {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      blender.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        // Filter out Blender's startup noise
        if (!output.includes('Read new prefs') &&
            !output.includes('found bundled python')) {
          process.stdout.write(output);
        }
      });

      blender.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      blender.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(new Error(`Blender exited with code ${code}\n${stderr}`));
        }
      });

      blender.on('error', (error) => {
        reject(new Error(`Failed to start Blender: ${error.message}`));
      });
    });
  }

  /**
   * Process character model
   */
  async processCharacter(inputPath, outputPath, options = {}) {
    const scriptPath = path.join(__dirname, '../blender-scripts/process_character.py');

    const args = {
      input_path: path.resolve(inputPath),
      output_path: path.resolve(outputPath),
      add_weapon_sockets: options.addWeaponSockets ?? true,
      add_ik_targets: options.addIKTargets ?? true,
      draco_compression: options.dracoCompression ?? true,
      export_vrm: options.exportVRM ?? false,
      vrm_output_path: options.vrmOutputPath
    };

    const result = await this.runScript(scriptPath, args);
    return result;
  }
}
