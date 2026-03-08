/**
 * Check if Blender MCP server is running
 */

import { BlenderMCPClient } from './blender-client.js';

async function checkBlender() {
  const client = new BlenderMCPClient({ port: 9876 });

  try {
    console.log('🔍 Checking Blender MCP server...\n');

    await client.connect();

    const tools = await client.listTools();

    console.log('✅ Blender MCP server is running!\n');
    console.log(`📦 Available tools: ${tools.length}\n`);

    if (tools.length > 0) {
      console.log('Tools:');
      tools.forEach((tool, i) => {
        console.log(`  ${i + 1}. ${tool.name}`);
        if (tool.description) {
          console.log(`     ${tool.description}`);
        }
      });
    }

    await client.disconnect();
    process.exit(0);

  } catch (error) {
    console.error('❌ Blender MCP server is not running!\n');
    console.error('Error:', error.message);
    console.error('\n📝 Make sure Blender is open with MCP server addon enabled.');
    console.error('   Server should be running on port 9876.\n');
    process.exit(1);
  }
}

checkBlender();
