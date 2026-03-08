/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import type { Example, UserContent } from '../types';

interface ExampleGridProps {
  examples: Example[];
  loadedThumbnails: Record<string, string>;
  selectedTile: number | 'user' | null;
  isLoading: boolean;
  userContent: UserContent | null;
  showGenerator: boolean;
  onExampleClick: (index: number) => void;
  onUserTileClick: () => void;
}

const ExampleGrid: React.FC<ExampleGridProps> = ({
  examples,
  loadedThumbnails,
  selectedTile,
  isLoading,
  userContent,
  showGenerator,
  onExampleClick,
  onUserTileClick
}) => {
  return (
    <div className="grid grid-cols-4 gap-4 w-full">
      {examples.map((ex, idx) => (
        <button
          key={idx}
          type="button"
          onClick={() => onExampleClick(idx)}
          disabled={isLoading}
          aria-label={`Load Example: ${ex.title}`}
          className={`aspect-square relative overflow-hidden group focus:outline-none disabled:opacity-50 cursor-pointer bg-gray-100 transition-all duration-200
              border-2 border-black
              active:translate-y-0 active:shadow-sm active:scale-100
              ${selectedTile === idx 
                  ? 'scale-[1.02] shadow-lg -translate-y-1' 
                  : 'hover:border-gray-600 shadow-md hover:-translate-y-1 hover:shadow-lg'}
          `}
          title="Click to view example scene"
        >
          {loadedThumbnails[ex.img] ? (
            <img 
              src={loadedThumbnails[ex.img]} 
              alt={ex.title} 
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-200 text-gray-400 text-xs uppercase font-bold animate-pulse">
                Loading...
            </div>
          )}
          {selectedTile !== idx && <div className="absolute inset-0 bg-white bg-opacity-40 group-hover:bg-opacity-0 transition-all duration-200"></div>}
        </button>
      ))}

      <button
        type="button"
        onClick={onUserTileClick}
        disabled={isLoading}
        aria-label="Generate new scene"
        className={`aspect-square flex flex-col items-center justify-center transition-all duration-200 focus:outline-none disabled:opacity-50 group overflow-hidden relative border-2 border-black
            active:translate-y-0 active:shadow-sm active:scale-100
            ${selectedTile === 'user' ? 'scale-[1.02] -translate-y-1' : 'hover:border-gray-600 hover:-translate-y-1 hover:shadow-lg'}
            ${!userContent && !showGenerator ? 'bg-white text-black hover:bg-gray-50 shadow-md' : 'bg-white'}
            ${showGenerator && selectedTile === 'user' 
                ? 'bg-black text-white shadow-[4px_4px_0px_0px_#888]' 
                : (selectedTile === 'user' ? 'shadow-lg' : 'shadow-md')}
        `}
        title={userContent ? "View your creation" : "Generate a new image"}
      >
        {userContent ? (
          <>
            <img src={userContent.image} alt="My Generation" className="w-full h-full object-cover" />
            {selectedTile !== 'user' && (
              <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center group-hover:bg-opacity-50 transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-12 h-12 text-white drop-shadow-md">
                  <path strokeLinecap="square" strokeLinejoin="miter" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </div>
            )}
            {selectedTile === 'user' && showGenerator && (
              <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                <span className="text-white font-bold uppercase text-sm">Editing</span>
              </div>
            )}
          </>
        ) : (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={`w-10 h-10 transition-transform duration-300 ${showGenerator ? 'rotate-45' : 'group-hover:scale-110'}`}>
              <path strokeLinecap="square" strokeLinejoin="miter" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            <span className="text-xs font-bold uppercase mt-2">{showGenerator ? 'Close' : 'Generate'}</span>
          </>
        )}
      </button>
    </div>
  );
};

export default ExampleGrid;
