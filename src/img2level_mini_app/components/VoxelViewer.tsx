/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import type { AppStatus } from '../types';

interface VoxelViewerProps {
  isLoading: boolean;
  status: AppStatus;
  viewMode: 'image' | 'voxel';
  imageData: string | null;
  voxelCode: string | null;
  thinkingText: string | null;
  displayPrompt: string;
  hasUserContent: boolean;
  onViewModeChange: (mode: 'image' | 'voxel') => void;
  onDownload: () => void;
  onVoxelize: () => void;
}

const VoxelViewer: React.FC<VoxelViewerProps> = ({
  isLoading, status, viewMode, imageData, voxelCode,
  thinkingText, displayPrompt, hasUserContent,
  onViewModeChange, onDownload, onVoxelize
}) => {
  return (
    <div className="space-y-2">
      <div className="w-full aspect-square border-2 border-black relative bg-gray-50 flex items-center justify-center overflow-hidden shadow-md" role="region" aria-label="Content Viewer">
        {isLoading && (
          <div className="absolute inset-0 bg-white z-20 flex flex-col items-start justify-center p-8 sm:p-12 overflow-hidden" aria-live="polite">
            <div className="w-full max-w-3xl mb-10 text-xl font-bold tracking-tight">
              {status === 'generating_image'
                ? 'Generating scene with MLX vision'
                : 'Generating scene with MLX'}
            </div>
            <div className="w-full max-w-3xl mb-8 opacity-70 font-mono text-xs sm:text-sm whitespace-pre-wrap break-words leading-relaxed border-l-2 border-gray-300 pl-4 max-h-[40%] overflow-y-auto">
              {status === 'generating_voxels' && imageData && (<img src={imageData} alt="Source" className="inline-block h-[1.5em] w-auto mr-2 align-middle border border-gray-300"/>)}
              <span className="align-middle">{displayPrompt}</span>
            </div>
            <div className="w-full max-w-3xl opacity-70 font-mono text-xs sm:text-sm whitespace-pre-wrap break-words max-h-[40%] overflow-y-auto">
              {thinkingText ? (<span>{thinkingText}<span className="loading-dots"></span></span>) : (<span className="loading-dots">Thinking</span>)}
            </div>
          </div>
        )}

        {!imageData && !isLoading && status !== 'error' && (<div className="text-gray-400 text-center px-6 pointer-events-none"><p className="text-lg">Select an example, or generate your own!</p></div>)}
        {imageData && viewMode === 'image' && (<img src={imageData} alt="Generated or Uploaded" className="w-full h-full object-contain" />)}
        {voxelCode && viewMode === 'voxel' && (<iframe title="Voxel Scene" srcDoc={voxelCode} className="w-full h-full border-0" sandbox="allow-scripts allow-same-origin allow-popups"/>)}
      </div>

      <div className="flex flex-wrap gap-4 pt-4">
        {imageData && voxelCode && (
          <button type="button" onClick={() => onViewModeChange(viewMode === 'image' ? 'voxel' : 'image')} disabled={isLoading} className="btn-secondary flex-1 min-w-[140px]">
            {viewMode === 'image' ? 'View Scene' : 'View Image'}
          </button>
        )}
        {((viewMode === 'image' && imageData) || (viewMode === 'voxel' && voxelCode)) && (
          <button type="button" onClick={onDownload} disabled={isLoading} className="btn-secondary flex-1 min-w-[140px]">
            {viewMode === 'image' ? 'Download Image' : 'Download HTML'}
          </button>
        )}
        {imageData && (
          <button type="button" onClick={onVoxelize} disabled={isLoading} className="btn-primary flex-1 min-w-[160px]">
            {hasUserContent ? 'Regenerate voxels' : 'Generate voxels'}
          </button>
        )}
      </div>
    </div>
  );
};

export default VoxelViewer;
