/**
 * MCP Blender Client
 * Connects to the Blender MCP socket server on port 9876.
 */

import fs from 'fs/promises';
import net from 'net';

const DEFAULT_TOOLS = [
  {
    name: 'get_scene_info',
    description: 'Inspect the current Blender scene'
  },
  {
    name: 'get_object_info',
    description: 'Inspect a single Blender object'
  },
  {
    name: 'execute_code',
    description: 'Run Python code inside the live Blender session'
  }
];

export class BlenderMCPClient {
  constructor(config = {}) {
    this.host = config.host || '127.0.0.1';
    this.port = config.port || 9876;
    this.timeoutMs = config.timeoutMs || 180_000;
    this.connected = false;
  }

  async connect() {
    console.log(`[MCP] Connecting to Blender server at ${this.host}:${this.port}...`);

    await this.sendCommand('get_scene_info');
    this.connected = true;

    console.log('[MCP] ✓ Connected to Blender server');
    return true;
  }

  isConnected() {
    return this.connected;
  }

  async listTools() {
    return DEFAULT_TOOLS;
  }

  async executeCode(code) {
    return this.sendCommand('execute_code', { code });
  }

  async getSceneInfo() {
    return this.sendCommand('get_scene_info');
  }

  async getObjectInfo(objectName) {
    return this.sendCommand('get_object_info', { name: objectName });
  }

  async getSceneObjects() {
    const scene = await this.getSceneInfo();
    return scene.objects || [];
  }

  async runPythonScript(scriptPath, args = {}) {
    const scriptContent = await fs.readFile(scriptPath, 'utf-8');
    const code = buildScriptWrapper(scriptContent, scriptPath, args);
    return this.executeCode(code);
  }

  async callTool(toolName, args = {}) {
    return this.sendCommand(toolName, args);
  }

  async disconnect() {
    this.connected = false;
    console.log('[MCP] Disconnected from Blender');
  }

  async sendCommand(commandType, params = {}) {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection({
        host: this.host,
        port: this.port
      });

      let buffer = '';
      let settled = false;

      const finish = (error, result) => {
        if (settled) {
          return;
        }

        settled = true;
        socket.removeAllListeners();
        socket.destroy();

        if (error) {
          this.connected = false;
          reject(error);
          return;
        }

        resolve(result);
      };

      socket.setTimeout(this.timeoutMs);

      socket.on('connect', () => {
        const payload = JSON.stringify({
          type: commandType,
          params
        });

        socket.write(payload);
      });

      socket.on('data', (chunk) => {
        buffer += chunk.toString('utf-8');

        try {
          const response = JSON.parse(buffer);

          if (response.status === 'error') {
            finish(new Error(response.message || `Blender command failed: ${commandType}`));
            return;
          }

          finish(null, response.result ?? response);
        } catch (error) {
          if (error instanceof SyntaxError) {
            return;
          }

          finish(error);
        }
      });

      socket.on('timeout', () => {
        finish(new Error(`Timeout waiting for Blender response to ${commandType}`));
      });

      socket.on('error', (error) => {
        finish(error);
      });

      socket.on('end', () => {
        if (!settled) {
          finish(new Error(`Connection closed before complete response to ${commandType}`));
        }
      });
    });
  }
}

function buildScriptWrapper(scriptContent, scriptPath, args) {
  const argsJson = JSON.stringify(args);

  return [
    'import json',
    `SCRIPT_ARGS = json.loads(${JSON.stringify(argsJson)})`,
    'IN_MCP = True',
    '__name__ = "__main__"',
    `__file__ = ${JSON.stringify(scriptPath)}`,
    scriptContent
  ].join('\n');
}
