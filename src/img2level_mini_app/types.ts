/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import type { SceneSettings } from './utils/html';

export type AppStatus = 'idle' | 'generating_image' | 'generating_voxels' | 'error';

export interface Example {
  img: string;
  html: string;
  title: string;
  description: string;
}

export interface UserContent {
  image: string;
  voxel: string | null; // This stores the PRISTINE html from MLX
  prompt: string;
  settings: SceneSettings | null;
}
