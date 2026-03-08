/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useRef, useState } from 'react';
import { IMAGE_SYSTEM_PROMPT } from '../services/mlx';

interface GeneratorPanelProps {
  prompt: string;
  setPrompt: (prompt: string) => void;
  aspectRatio: string;
  setAspectRatio: (ratio: string) => void;
  useOptimization: boolean;
  setUseOptimization: (optimize: boolean) => void;
  isLoading: boolean;
  onImageGenerate: () => void;
  onFileUpload: (file: File) => void;
  samplePrompts: string[];
  placeholderIndex: number;
}

const ASPECT_RATIOS = ["1:1", "3:4", "4:3", "16:9", "9:16"];
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif'];

const GeneratorPanel: React.FC<GeneratorPanelProps> = ({
  prompt, setPrompt, aspectRatio, setAspectRatio,
  useOptimization, setUseOptimization, isLoading,
  onImageGenerate, onFileUpload, samplePrompts, placeholderIndex
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFileUpload(file);
  };
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onFileUpload(file);
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-top-4 fade-in duration-300 border-2 border-black p-6 bg-gray-50 shadow-md relative z-10">
      <div className="w-full">
        <label className="block text-sm font-bold mb-2 uppercase">Upload Image</label>
        <div 
          onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`w-full h-64 border-2 border-dashed border-black flex flex-col items-center justify-center cursor-pointer transition-colors ${isDragging ? 'bg-gray-200' : 'bg-white hover:bg-gray-50'}`}
        >
          <input type="file" accept={ALLOWED_MIME_TYPES.join(',')} ref={fileInputRef} onChange={handleFileChange} className="hidden" />
          <p className="font-bold uppercase text-sm text-gray-600">Drag and drop or click to upload image</p>
        </div>
      </div>
      
      <div className="relative flex items-center justify-center w-full">
        <div className="border-t-2 border-gray-200 w-full absolute"></div>
        <span className="bg-gray-50 px-3 text-xs font-bold text-gray-400 uppercase relative z-10">OR</span>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-grow w-full">
          <label htmlFor="prompt" className="block text-sm font-bold mb-2 uppercase">Generate with MLX Vision</label>
          <input id="prompt" type="text" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={samplePrompts[placeholderIndex]} aria-label="Image prompt description" className="w-full px-3 border-2 border-black focus:outline-none focus:ring-0 rounded-none text-lg placeholder-gray-400 bg-white h-12" disabled={isLoading} />
        </div>
        <div className="w-full sm:w-40 flex-shrink-0">
          <label htmlFor="aspect" className="block text-sm font-bold mb-2 uppercase">Aspect ratio</label>
          <select id="aspect" value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} disabled={isLoading} aria-label="Select aspect ratio" className="w-full px-3 border-2 border-black focus:outline-none rounded-none bg-white h-12">
            {ASPECT_RATIOS.map(ratio => (<option key={ratio} value={ratio}>{ratio}</option>))}
          </select>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-end items-center gap-6 mt-2">
        <label className="flex items-center cursor-pointer select-none" title={`Add instruction: ${IMAGE_SYSTEM_PROMPT}`}>
          <div className="relative">
            <input type="checkbox" className="sr-only" checked={useOptimization} onChange={(e) => setUseOptimization(e.target.checked)} disabled={isLoading} aria-label="Toggle scene prompt optimization"/>
            <div className={`block w-10 h-6 border-2 border-black ${useOptimization ? 'bg-black' : 'bg-gray-500'}`}></div>
            <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 transition-transform ${useOptimization ? 'translate-x-4' : ''}`}></div>
          </div>
          <div className="ml-3 text-sm font-bold uppercase">Optimise Scene</div>
        </label>
        <button type="button" onClick={onImageGenerate} disabled={isLoading || !prompt.trim()} title="Generate a new image based on your prompt" aria-label="Generate image" className="btn-primary w-full sm:w-40 h-12 text-sm whitespace-nowrap">
          {status === 'generating_image' ? 'Generating...' : 'Generate'}
        </button>
      </div>
    </div>
  );
};

export default GeneratorPanel;
