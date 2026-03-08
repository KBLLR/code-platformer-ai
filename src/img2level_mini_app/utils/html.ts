/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export interface SceneSettings {
  backgroundColor: string;
  fogDensity: number;
  lightIntensity: number;
  sunlightColor: string;
  ambientLightColor: string;
  sunlightPosition: { x: number; y: number; z: number };
}

/**
 * Extracts a complete HTML document from a string that might contain
 * conversational text, markdown code blocks, etc.
 */
export const extractHtmlFromText = (text: string): string => {
  if (!text) return "";

  // 1. Try to find a complete HTML document structure (most reliable)
  const htmlMatch = text.match(/(<!DOCTYPE html>|<html)[\s\S]*?<\/html>/i);
  if (htmlMatch) {
    return htmlMatch[0];
  }

  // 2. Fallback: Try to extract content from markdown code blocks
  const codeBlockMatch = text.match(/```(?:html)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  // 3. Return raw text if no structure is found
  return text.trim();
};

/**
 * Injects CSS to hide common text elements (like loading screens, info overlays)
 */
export const hideBodyText = (html: string): string => {
  const cssToInject = `
    <style>
      #info, #loading, #ui, #instructions, .label, .overlay, #description {
        display: none !important; opacity: 0 !important;
        pointer-events: none !important; visibility: hidden !important;
      }
      body { user-select: none !important; }
    </style>
  `;
  if (html.toLowerCase().includes('</head>')) {
    return html.replace(/<\/head>/i, `${cssToInject}</head>`);
  }
  return html + cssToInject;
};

/**
 * Zooms the camera in by modifying the camera.position.set() call.
 */
export const zoomCamera = (html: string, zoomFactor: number = 0.8): string => {
  const regex = /camera\.position\.set\(\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*\)/g;
  return html.replace(regex, (match, x, y, z) => {
    return `camera.position.set(${parseFloat(x) * zoomFactor}, ${parseFloat(y) * zoomFactor}, ${parseFloat(z) * zoomFactor})`;
  });
};

/**
 * Applies scene settings by replacing values in the Three.js code.
 */
export const applySceneSettings = (html: string, settings: SceneSettings): string => {
  let modifiedHtml = html;

  // 1. Background Color
  const bgColorRegex = /scene\.background\s*=\s*new\s*THREE\.Color\s*\([^)]+\)/g;
  modifiedHtml = modifiedHtml.replace(bgColorRegex, `scene.background = new THREE.Color("${settings.backgroundColor}")`);

  // 2. Fog Density (targets FogExp2)
  const fogExp2Regex = /scene\.fog\s*=\s*new\s*THREE\.FogExp2\s*\(([^,]+),\s*[^)]+\)/g;
  modifiedHtml = modifiedHtml.replace(fogExp2Regex, (match, color) => {
    return `scene.fog = new THREE.FogExp2(${color}, ${settings.fogDensity})`;
  });

  // 3. Light Intensity (targets both Ambient and Directional)
  const ambientIntensityRegex = /(new\s*THREE\.AmbientLight\s*\([^,]+,)\s*([^)]+)\)/g;
  modifiedHtml = modifiedHtml.replace(ambientIntensityRegex, `$1 ${settings.lightIntensity})`);
  
  const directionalIntensityRegex = /(new\s*THREE\.DirectionalLight\s*\([^,]+,)\s*([^)]+)\)/g;
  modifiedHtml = modifiedHtml.replace(directionalIntensityRegex, `$1 ${settings.lightIntensity})`);

  // 4. Ambient Light Color
  const ambientColorRegex = /new\s*THREE\.AmbientLight\s*\(([^,]+)/g;
  modifiedHtml = modifiedHtml.replace(ambientColorRegex, `new THREE.AmbientLight("${settings.ambientLightColor}"`);
  
  // 5. Directional Light Color (Sunlight)
  const directionalColorRegex = /new\s*THREE\.DirectionalLight\s*\(([^,]+)/g;
  modifiedHtml = modifiedHtml.replace(directionalColorRegex, `new THREE.DirectionalLight("${settings.sunlightColor}"`);

  // 6. Directional Light Position (Sunlight)
  const { x, y, z } = settings.sunlightPosition;
  const lightPositionRegex = /\.position\.set\(\s*-?\d*\.?\d+\s*,\s*-?\d*\.?\d+\s*,\s*-?\d*\.?\d+\s*\)/g;
  
  // This is a bit broad, so we try to find a variable name associated with DirectionalLight
  const lightVarRegex = /const\s+([a-zA-Z0-9_]+)\s*=\s*new\s*THREE\.DirectionalLight/g;
  let match;
  let lightVarName = null;
  
  // Find the first directional light variable name
  if ((match = lightVarRegex.exec(modifiedHtml)) !== null) {
      lightVarName = match[1];
  }
  
  // If we found a name, create a specific regex for it to avoid changing camera position etc.
  if (lightVarName) {
      const specificLightPosRegex = new RegExp(`${lightVarName}\\.position\\.set\\([^)]+\\)`, 'g');
      modifiedHtml = modifiedHtml.replace(specificLightPosRegex, `${lightVarName}.position.set(${x}, ${y}, ${z})`);
  }

  return modifiedHtml;
};
