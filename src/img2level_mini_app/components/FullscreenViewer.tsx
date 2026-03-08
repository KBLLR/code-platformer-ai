/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import type { Example } from '../types';

interface FullscreenViewerProps {
  isOpen: boolean;
  onClose: () => void;
  examples: Example[];
  currentExampleIndex: number | null;
  loadedThumbnails: Record<string, string>;
  isLoading: boolean;
  voxelCode: string | null;
  imageData: string | null;
  viewMode: 'image' | 'voxel';
  onExampleClick: (index: number) => void;
  onViewModeChange: (mode: 'image' | 'voxel') => void;
  onDownload: () => void;
}

const FullscreenViewer: React.FC<FullscreenViewerProps> = ({
  isOpen, onClose, examples, currentExampleIndex, loadedThumbnails,
  isLoading, voxelCode, imageData, viewMode, onExampleClick,
  onViewModeChange, onDownload
}) => {
  if (!isOpen || currentExampleIndex === null) return null;

  const currentExample = examples[currentExampleIndex];

  return (
    <div className="fixed inset-0 bg-gray-800 z-50 animate-in fade-in font-sans">
      {isLoading && (<div className="absolute inset-0 bg-black/50 z-30 flex items-center justify-center" aria-live="polite"><p className="text-white text-2xl font-bold animate-pulse">Loading Scene...</p></div>)}
      
      {viewMode === 'voxel' && voxelCode && (
        <iframe key={currentExampleIndex} title="Voxel Scene" srcDoc={voxelCode} className="w-full h-full border-0" sandbox="allow-scripts allow-same-origin allow-popups"/>
      )}
      
      {viewMode === 'image' && imageData && (
        <div className="w-full h-full bg-gray-200 flex items-center justify-center">
          <img src={imageData} alt={currentExample.title} className="max-w-full max-h-full object-contain" />
        </div>
      )}

      <div className="absolute inset-0 grid grid-cols-1 md:grid-cols-12 gap-6 p-4 md:p-8 pointer-events-none">
        <div className="md:col-span-4 lg:col-span-3 flex flex-col justify-start pointer-events-auto">
          <div className="bg-white/80 backdrop-blur-md p-4 border-2 border-black shadow-md space-y-4">
            <div className="flex justify-between items-center border-b-2 border-black pb-2">
              <h2 className="text-xl font-black uppercase tracking-tight">Examples</h2>
              <button onClick={onClose} className="p-2 -m-2 hover:bg-gray-200 transition-colors" title="Close Viewer" aria-label="Close example viewer">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="square" strokeLinejoin="miter" d="M6 18 18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <h3 className="text-lg font-bold">{currentExample.title}</h3>
            <p className="text-sm font-semibold text-gray-700 max-h-32 overflow-y-auto">{currentExample.description}</p>
            
            <div className="grid grid-cols-3 gap-2 pt-2 border-t-2 border-gray-200">
              {examples.map((ex, idx) => (
                <button
                  key={idx} onClick={() => onExampleClick(idx)} disabled={isLoading}
                  className={`aspect-square border-2 ${currentExampleIndex === idx ? 'border-black' : 'border-transparent hover:border-gray-500'} transition-all disabled:opacity-50`}
                  title={`View Example: ${ex.title}`}
                >
                  {loadedThumbnails[ex.img] && <img src={loadedThumbnails[ex.img]} alt={ex.title} className="w-full h-full object-cover" />}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="hidden md:block md:col-span-5 lg:col-span-6"></div>

        <div className="md:col-span-3 lg:col-span-3 flex flex-col justify-end pointer-events-auto">
          <div className="bg-white/80 backdrop-blur-md p-4 border-2 border-black shadow-md space-y-3">
            {imageData && voxelCode && (
              <button type="button" onClick={() => onViewModeChange(viewMode === 'image' ? 'voxel' : 'image')} disabled={isLoading} className="btn-secondary w-full">
                {viewMode === 'image' ? 'View Scene' : 'View Image'}
              </button>
            )}
            <button type="button" onClick={onDownload} disabled={isLoading} className="btn-secondary w-full">
              {viewMode === 'image' ? 'Download Image' : 'Download HTML'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FullscreenViewer;
