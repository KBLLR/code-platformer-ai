/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { extractHtmlFromText } from "../utils/html";

const MLX_GATEWAY_URL =
  (import.meta as any).env?.VITE_MLX_GATEWAY_URL || "http://localhost:8090";
const MLX_IMAGE_URL = `${String(MLX_GATEWAY_URL).replace(/\/$/, '')}/v1/images/generations`;
const MLX_VISION_URL = `${String(MLX_GATEWAY_URL).replace(/\/$/, '')}/v1/vision/chat`;

const DEFAULT_IMAGE_MODEL = "/Users/davidcaballero/core-x-kbllr_0/model-zoo/models/image/flux-schnell-4bit";
const DEFAULT_VISION_MODEL = "/Users/davidcaballero/core-x-kbllr_0/model-zoo/models/vision/qwen2.5-vl-7b-instruct-4bit";

export const IMAGE_SYSTEM_PROMPT = "Generate an isolated object/scene on a simple background.";
export const VOXEL_PROMPT = "I have provided an image. Code a beautiful voxel art scene inspired by this image. Write threejs code as a single-page.";

const aspectRatioToSize = (aspectRatio: string) => {
  switch (aspectRatio) {
    case '16:9':
      return '1280x720';
    case '9:16':
      return '720x1280';
    case '4:3':
      return '1024x768';
    case '3:4':
      return '768x1024';
    case '21:9':
      return '1536x640';
    default:
      return '1024x1024';
  }
};

export const generateImage = async (
  prompt: string,
  aspectRatio: string = '1:1',
  optimize: boolean = true
): Promise<string> => {
  try {
    let finalPrompt = prompt;

    if (optimize) {
      finalPrompt = `${IMAGE_SYSTEM_PROMPT}\n\nSubject: ${prompt}`;
    }

    const response = await fetch(MLX_IMAGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: DEFAULT_IMAGE_MODEL,
        prompt: finalPrompt,
        n: 1,
        size: aspectRatioToSize(aspectRatio),
        response_format: 'b64_json',
        num_inference_steps: 4,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`MLX image generation failed (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const image = data?.data?.[0]?.b64_json;
    if (!image) {
      throw new Error("No image generated.");
    }
    return `data:image/png;base64,${image}`;
  } catch (error) {
    console.error("Image generation failed:", error);
    throw error;
  }
};

export const generateVoxelScene = async (
  imageBase64: string,
  onThoughtUpdate?: (thought: string) => void
): Promise<string> => {
  const base64Data = imageBase64.split(',')[1] || imageBase64;
  const mimeMatch = imageBase64.match(/^data:(.*?);base64,/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';

  let fullHtml = "";

  try {
    const response = await fetch(MLX_VISION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: DEFAULT_VISION_MODEL,
        stream: false,
        max_tokens: 2048,
        temperature: 0.2,
        messages: [
          {
            role: 'user',
            content: VOXEL_PROMPT,
            images: [`data:${mimeType};base64,${base64Data}`],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`MLX vision request failed (${response.status}): ${errText}`);
    }

    const payload = await response.json();
    fullHtml = payload?.choices?.[0]?.message?.content || '';
    if (onThoughtUpdate && fullHtml) {
      onThoughtUpdate('MLX vision response received.');
    }

    return extractHtmlFromText(fullHtml);
  } catch (error) {
    console.error("Voxel scene generation failed:", error);
    throw error;
  }
};
