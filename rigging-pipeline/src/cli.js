#!/usr/bin/env node
/**
 * CLI tool for rigging pipeline
 */

import { RiggingPipeline } from './pipeline.js';
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

  // Parse command
  const command = args[0];

  switch (command) {
    case 'check':
      await checkBlender();
      break;

    case 'process':
      await processCharacters(args.slice(1));
      break;

    case 'batch':
      await batchProcess(args.slice(1));
      break;

    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

function printHelp() {
  console.log(`
Rigging Pipeline CLI

Usage:
  npm run rig -- <command> [options]

Commands:
  check                    Check if Blender MCP server is running
  process <file>           Process a single character model
  batch                    Process all characters from manifest

Examples:
  npm run rig -- check
  npm run rig -- process ../public/assets/models/player_001-v1.glb
  npm run rig -- batch

Options:
  -h, --help               Show this help message
  `);
}

async function checkBlender() {
  console.log('🔍 Checking Blender MCP connection...\n');

  const pipeline = new RiggingPipeline();

  try {
    await pipeline.initialize();
    console.log('\n✅ Blender MCP server is running!\n');
    await pipeline.shutdown();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Cannot connect to Blender MCP server!\n');
    console.error('Error:', error.message);
    console.error('\n📝 Make sure:');
    console.error('   1. Blender is open');
    console.error('   2. MCP server addon is installed and enabled');
    console.error('   3. Server is running on port 9876\n');
    process.exit(1);
  }
}

async function processCharacters(args) {
  if (args.length === 0) {
    console.error('Error: No file specified');
    console.error('Usage: npm run rig -- process <file.glb>');
    process.exit(1);
  }

  const modelPath = path.resolve(args[0]);

  // Check if file exists
  try {
    await fs.access(modelPath);
  } catch {
    console.error(`Error: File not found: ${modelPath}`);
    process.exit(1);
  }

  const pipeline = new RiggingPipeline();

  try {
    await pipeline.initialize();

    const result = await pipeline.processCharacter(modelPath, {
      id: path.basename(modelPath, path.extname(modelPath)),
      addWeaponSockets: true,
      addIKTargets: true,
      exportVRM: true
    });

    await pipeline.shutdown();

    if (result.success) {
      console.log('\n🎉 Processing complete!');
      process.exit(0);
    } else {
      console.error('\n❌ Processing failed!');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Pipeline error:', error.message);
    await pipeline.shutdown();
    process.exit(1);
  }
}

async function batchProcess() {
  console.log('📦 Batch processing all characters...\n');

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

  // Get all character model paths
  const modelPaths = manifest.characters.map(char => {
    return path.join(__dirname, '../../public', char.glb);
  });

  console.log(`Found ${modelPaths.length} characters to process:\n`);
  modelPaths.forEach((p, i) => {
    console.log(`  ${i + 1}. ${path.basename(p)}`);
  });
  console.log('');

  const pipeline = new RiggingPipeline();

  try {
    await pipeline.initialize();

    const results = await pipeline.batchProcess(modelPaths, {
      addWeaponSockets: true,
      addIKTargets: true,
      exportVRM: true,
      outputDir: path.join(__dirname, '../../public/assets/models/rigged')
    });

    await pipeline.shutdown();

    // Print summary
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log('\n' + '='.repeat(50));
    console.log('BATCH PROCESSING COMPLETE');
    console.log('='.repeat(50));
    console.log(`✅ Success: ${successCount}/${modelPaths.length}`);
    console.log(`❌ Failed: ${failCount}/${modelPaths.length}`);

    if (failCount > 0) {
      console.log('\nFailed characters:');
      results.filter(r => !r.success).forEach(r => {
        console.log(`  - ${r.characterId}: ${r.error}`);
      });
    }

    console.log('');

    process.exit(failCount > 0 ? 1 : 0);

  } catch (error) {
    console.error('\n❌ Batch processing error:', error.message);
    await pipeline.shutdown();
    process.exit(1);
  }
}

// Run CLI
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
