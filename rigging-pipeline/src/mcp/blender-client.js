/**
 * MCP Blender Client
 * Connects to Blender MCP server on port 9876
 */

import fs from 'fs/promises';
import path from 'path';

export class BlenderMCPClient {
  constructor(config = {}) {
    this.host = config.host || 'localhost';
    this.port = config.port || 9876;
    this.baseUrl = `http://${this.host}:${this.port}`;
    this.connected = false;
  }

  /**
   * Connect to Blender MCP server
   */
  async connect() {
    try {
      console.log(`[MCP] Connecting to Blender server at ${this.baseUrl}...`);

      // Test connection with a simple HTTP request
      const response = await fetch(`${this.baseUrl}/tools`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      this.connected = true;
      console.log('[MCP] ✓ Connected to Blender server');

      // List available tools
      const tools = await this.listTools();
      console.log(`[MCP] Available tools: ${tools.length || 'unknown'}`);

      return true;
    } catch (error) {
      console.error('[MCP] ✗ Connection failed:', error.message);
      this.connected = false;
      throw error;
    }
  }

  /**
   * Check if connected
   */
  isConnected() {
    return this.connected;
  }

  /**
   * List available MCP tools
   */
  async listTools() {
    if (!this.connected) {
      throw new Error('Not connected to Blender MCP server');
    }

    try {
      const response = await fetch(`${this.baseUrl}/tools`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      return data.tools || data || [];
    } catch (error) {
      console.warn('[MCP] Could not list tools:', error.message);
      return [];
    }
  }

  /**
   * Call an MCP tool
   */
  async callTool(toolName, args = {}) {
    if (!this.connected) {
      throw new Error('Not connected to Blender MCP server');
    }

    console.log(`[MCP] Calling tool: ${toolName}`);

    const response = await fetch(`${this.baseUrl}/tool/${toolName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(args)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Tool call failed: ${error}`);
    }

    const result = await response.json();
    return result;
  }

  /**
   * Import model into Blender
   */
  async importModel(filePath) {
    const absolutePath = path.resolve(filePath);
    const ext = path.extname(filePath).toLowerCase();

    console.log(`[MCP] Importing model: ${filePath}`);

    let toolName;
    switch (ext) {
      case '.fbx':
        toolName = 'import_fbx';
        break;
      case '.obj':
        toolName = 'import_obj';
        break;
      case '.glb':
      case '.gltf':
        toolName = 'import_gltf';
        break;
      case '.dae':
        toolName = 'import_collada';
        break;
      default:
        throw new Error(`Unsupported file format: ${ext}`);
    }

    return await this.callTool(toolName, {
      filepath: absolutePath,
      import_animations: true,
      import_materials: true
    });
  }

  /**
   * Run Python script in Blender
   */
  async runPythonScript(scriptPath, args = {}) {
    console.log(`[MCP] Running Python script: ${scriptPath}`);

    const scriptContent = await fs.readFile(scriptPath, 'utf-8');

    return await this.callTool('execute_python', {
      script: scriptContent,
      arguments: JSON.stringify(args)
    });
  }

  /**
   * Get scene objects
   */
  async getSceneObjects() {
    return await this.callTool('list_objects', {});
  }

  /**
   * Select object by name
   */
  async selectObject(objectName) {
    return await this.callTool('select_object', {
      name: objectName
    });
  }

  /**
   * Export GLB
   */
  async exportGLB(outputPath, options = {}) {
    console.log(`[MCP] Exporting GLB: ${outputPath}`);

    return await this.callTool('export_gltf', {
      filepath: path.resolve(outputPath),
      export_format: 'GLB',
      export_animations: options.includeAnimations ?? true,
      export_draco_mesh_compression_enable: options.dracoCompression ?? true,
      export_draco_mesh_compression_level: options.dracoCompressionLevel ?? 10,
      export_image_format: options.textureFormat?.toUpperCase() || 'WEBP',
      export_texture_dir: '',
      export_keep_originals: false
    });
  }

  /**
   * Export VRM
   */
  async exportVRM(outputPath, vrmMetadata = {}) {
    console.log(`[MCP] Exporting VRM: ${outputPath}`);

    return await this.callTool('export_vrm', {
      filepath: path.resolve(outputPath),
      vrm_version: vrmMetadata.version || '1.0',
      export_preset: 'ALL'
    });
  }

  /**
   * Get armature info
   */
  async getArmatureInfo(armatureName) {
    return await this.callTool('get_armature_info', {
      name: armatureName
    });
  }

  /**
   * Disconnect from server
   */
  async disconnect() {
    if (this.client) {
      await this.client.close();
      this.connected = false;
      console.log('[MCP] Disconnected from Blender');
    }
  }
}
