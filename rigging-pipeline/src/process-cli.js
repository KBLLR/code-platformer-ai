#!/usr/bin/env node
/**
 * Simple CLI to process characters using Blender command-line
 * (Doesn't require MCP server)
 */

import { BlenderCLI } from './blender-cli.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  const command = args[0];

  switch (command) {
    case 'single':
      await processSingle(args.slice(1));
      break;

    case 'batch':
      await processBatch();
      break;

    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

function printHelp() {
  console.log(`
Rigging Pipeline CLI (Blender Command-Line Mode)

Usage:
  npm run process -- <command> [options]

Commands:
  single <file>            Process a single character model
  batch                    Process all characters from manifest

Examples:
  npm run process -- single ../public/assets/models/player_001-v1.glb
  npm run process -- batch

Note: This uses Blender in background mode (no MCP server required).
  `);
}

async function processSingle(args) {
  if (args.length === 0) {
    console.error('Error: No file specified');
    console.error('Usage: npm run process -- single <file.glb>');
    process.exit(1);
  }

  const inputPath = path.resolve(args[0]);

  // Check if file exists
  try {
    await fs.access(inputPath);
  } catch {
    console.error(`Error: File not found: ${inputPath}`);
    process.exit(1);
  }

  const blender = new BlenderCLI();

  const characterId = path.basename(inputPath, path.extname(inputPath));
  const outputDir = path.join(__dirname, '../../public/assets/models/rigged');
  const outputPath = path.join(outputDir, `${characterId}.glb`);
  const vrmOutputPath = path.join(outputDir, `${characterId}.vrm`);

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Processing: ${characterId}`);
  console.log(`${'='.repeat(60)}\n`);

  try {
    await fs.mkdir(outputDir, { recursive: true });

    await blender.processCharacter(inputPath, outputPath, {
      addWeaponSockets: true,
      addIKTargets: true,
      dracoCompression: true,
      exportVRM: true,
      vrmOutputPath
    });

    console.log('\n✅ Processing complete!');
    console.log(`\nOutput:`);
    console.log(`  GLB: ${outputPath}`);
    console.log(`  VRM: ${vrmOutputPath}`);

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Processing failed:', error.message);
    process.exit(1);
  }
}

async function processBatch() {
  console.log(`\n${'='.repeat(60)}`);
  console.log('Batch Processing All Characters');
  console.log(`${'='.repeat(60)}\n`);

  // Load manifest
  const manifestPath = path.join(__dirname, '../../public/characters/manifest.json');
  let manifest;

  try {
    const manifestData = await fs.readFile(manifestPath, 'utf-8');
    manifest = JSON.parse(manifestData);
  } catch (error) {
    console.error('Error loading manifest:', error.message);
    process.exit(1);
  }

  const blender = new BlenderCLI();
  const outputDir = path.join(__dirname, '../../public/assets/models/rigged');
  await fs.mkdir(outputDir, { recursive: true });

  const results = [];

  for (const char of manifest.characters) {
    const inputPath = path.join(__dirname, '../../public', char.glb);
    const outputPath = path.join(outputDir, `${char.id}.glb`);
    const vrmOutputPath = path.join(outputDir, `${char.id}.vrm`);

    console.log(`\nProcessing: ${char.id} (${char.displayName})`);
    console.log('-'.repeat(60));

    try {
      await blender.processCharacter(inputPath, outputPath, {
        addWeaponSockets: true,
        addIKTargets: true,
        dracoCompression: true,
        exportVRM: true,
        vrmOutputPath
      });

      results.push({ id: char.id, success: true });

    } catch (error) {
      console.error(`❌ Failed: ${error.message}`);
      results.push({ id: char.id, success: false, error: error.message });
    }
  }

  // Print summary
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;

  console.log(`\n${'='.repeat(60)}`);
  console.log('BATCH PROCESSING COMPLETE');
  console.log(`${'='.repeat(60)}`);
  console.log(`✅ Success: ${successCount}/${manifest.characters.length}`);
  console.log(`❌ Failed: ${failCount}/${manifest.characters.length}`);

  if (failCount > 0) {
    console.log('\nFailed characters:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`  - ${r.id}: ${r.error}`);
    });
  }

  console.log(`\nOutput directory: ${outputDir}\n`);

  process.exit(failCount > 0 ? 1 : 0);
}

// Run
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
