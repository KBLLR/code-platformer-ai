/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useRef, useEffect } from 'react';
import { generateImage, generateVoxelScene } from './services/mlx';
import { extractHtmlFromText, hideBodyText, zoomCamera, applySceneSettings, SceneSettings } from './utils/html';
import { AppStatus, Example, UserContent } from './types';
import Header from './components/Header';
import ExampleGrid from './components/ExampleGrid';
import GeneratorPanel from './components/GeneratorPanel';
import VoxelViewer from './components/VoxelViewer';
import SceneSettingsPanel from './components/SceneSettings';
import FullscreenViewer from './components/FullscreenViewer';

// Constants
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif'];
const SAMPLE_PROMPTS = [
    "A tree house under the sea", "A cyberpunk street food stall", "An ancient temple floating in the sky",
    "A cozy winter cabin with smoke", "A futuristic mars rover", "A dragon guarding gold"
];
const DEFAULT_SCENE_SETTINGS: SceneSettings = { 
    backgroundColor: '#87CEEB', 
    fogDensity: 0.015, 
    lightIntensity: 1.0,
    sunlightColor: '#FFFFFF',
    ambientLightColor: '#FFFFFF',
    sunlightPosition: { x: 50, y: 50, z: 50 },
};
const EXAMPLES: Example[] = [
  { 
    img: 'https://www.gstatic.com/aistudio/starter-apps/image_to_voxel/example1.png', 
    html: '/examples/example1.html',
    title: 'Floating Sakura Island',
    description: "This serene scene features a floating island with a blooming cherry blossom tree and an animated waterfall. It was generated procedurally, using simplex noise to create the island's organic shape and a particle system for the flowing water and falling petals."
  },
  { 
    img: 'https://www.gstatic.com/aistudio/starter-apps/image_to_voxel/example2.png', 
    html: '/examples/example2.html',
    title: 'Voxel Jetpack Cat',
    description: "An adventurous cat soaring through the sky with a custom-built jetpack. Inspired by a 2D image, the model constructed this character from simple voxel shapes for a modular look. The scene is brought to life with a dynamic particle system for the jetpack's exhaust."
  },
  { 
    img: 'https://www.gstatic.com/aistudio/starter-apps/image_to_voxel/example3.png', 
    html: '/examples/example3.html',
    title: 'Japanese Garden Pagoda',
    description: "A tranquil Japanese garden featuring a multi-tiered pagoda and lush greenery. To render thousands of voxels efficiently, the model generated code using Three.js's `InstancedMesh`. The entire world, including terrain, structures, and vegetation, was built procedurally."
  },
];

const App: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [imageData, setImageData] = useState<string | null>(null);
  const [voxelCode, setVoxelCode] = useState<string | null>(null);
  const [userContent, setUserContent] = useState<UserContent | null>(null);
  const [selectedTile, setSelectedTile] = useState<number | 'user' | null>(null);
  const [showGenerator, setShowGenerator] = useState(false);
  const [status, setStatus] = useState<AppStatus>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [useOptimization, setUseOptimization] = useState(true);
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [viewMode, setViewMode] = useState<'image' | 'voxel'>('image');
  const [thinkingText, setThinkingText] = useState<string | null>(null);
  const [loadedThumbnails, setLoadedThumbnails] = useState<Record<string, string>>({});
  const [isViewerVisible, setIsViewerVisible] = useState(true);
  const [sceneSettings, setSceneSettings] = useState<SceneSettings>(DEFAULT_SCENE_SETTINGS);
  const [isExampleViewerOpen, setIsExampleViewerOpen] = useState(false);
  const [currentExampleIndex, setCurrentExampleIndex] = useState<number | null>(null);

  useEffect(() => {
    if (selectedTile === 'user' && userContent?.voxel) {
      const finalHtml = applySceneSettings(zoomCamera(hideBodyText(userContent.voxel)), sceneSettings);
      setVoxelCode(finalHtml);
    }
  }, [sceneSettings, selectedTile, userContent?.voxel]);

  useEffect(() => {
    const interval = setInterval(() => setPlaceholderIndex((prev) => (prev + 1) % SAMPLE_PROMPTS.length), 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const createdUrls: string[] = [];
    const loadThumbnails = async () => {
      const loaded: Record<string, string> = {};
      await Promise.all(EXAMPLES.map(async (ex) => {
        try {
          const response = await fetch(ex.img);
          if (response.ok) {
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            createdUrls.push(url);
            loaded[ex.img] = url;
          }
        } catch (e) { console.error("Failed to load thumbnail:", ex.img, e); }
      }));
      setLoadedThumbnails(loaded);
    };
    loadThumbnails();
    return () => { createdUrls.forEach(url => URL.revokeObjectURL(url)); };
  }, []);

  const handleError = (err: any) => {
    setStatus('error');
    setErrorMsg(err.message || 'An unexpected error occurred.');
    console.error(err);
  };

  const handleImageGenerate = async () => {
    if (!prompt.trim()) return;
    setStatus('generating_image');
    setErrorMsg('');
    setImageData(null);
    setVoxelCode(null);
    setThinkingText(null);
    setViewMode('image');
    setIsViewerVisible(true);

    try {
      const imageUrl = await generateImage(prompt, aspectRatio, useOptimization);
      setUserContent({ image: imageUrl, voxel: null, prompt: prompt, settings: null });
      setImageData(imageUrl);
      setSelectedTile('user');
      setStatus('idle');
      setShowGenerator(false);
    } catch (err) { handleError(err); }
  };

  const processFile = (file: File) => {
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      handleError(new Error("Invalid file type. Please upload PNG, JPEG, WEBP, HEIC, or HEIF."));
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setUserContent({ image: result, voxel: null, prompt: '', settings: null });
      setImageData(result);
      setVoxelCode(null);
      setViewMode('image');
      setStatus('idle');
      setErrorMsg('');
      setSelectedTile('user');
      setShowGenerator(false);
      setIsViewerVisible(true);
    };
    reader.onerror = () => handleError(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  };

  const handleExampleClick = async (index: number) => {
    const example = EXAMPLES[index];
    if (status !== 'idle' && status !== 'error' && !(isExampleViewerOpen && currentExampleIndex !== index)) return;
    if (isExampleViewerOpen && currentExampleIndex === index) return;
    if (!isExampleViewerOpen) setShowGenerator(false);
    
    setStatus('generating_voxels');
    setErrorMsg('');
    setThinkingText(null);
    setSelectedTile(index);
    setCurrentExampleIndex(index);
    setIsExampleViewerOpen(true);
    
    try {
      const imgResponse = await fetch(example.img);
      if (!imgResponse.ok) throw new Error(`Failed to load example image: ${imgResponse.statusText}`);
      const imgBlob = await imgResponse.blob();
      const base64Img = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(imgBlob);
      });

      const htmlResponse = await fetch(example.html);
      const rawText = htmlResponse.ok ? await htmlResponse.text() : `<html><body>${example.html} not found.</body></html>`;
      const htmlText = zoomCamera(hideBodyText(extractHtmlFromText(rawText)));

      setImageData(base64Img);
      setVoxelCode(htmlText);
      setViewMode('voxel');
      setStatus('idle');
    } catch (err) {
      handleError(err);
      setIsExampleViewerOpen(false);
    }
  };

  const handleUserTileClick = () => {
    if (status !== 'idle' && status !== 'error') return;
    if (selectedTile === 'user') {
      const willShow = !showGenerator;
      setShowGenerator(willShow);
      setIsViewerVisible(!willShow);
      if (!willShow && !userContent) setSelectedTile(null);
    } else {
      setSelectedTile('user');
      setShowGenerator(true); 
      setIsViewerVisible(false);
      if (userContent) {
        setImageData(userContent.image);
        setPrompt(userContent.prompt);
        if (userContent.voxel && userContent.settings) {
          setSceneSettings(userContent.settings);
          setVoxelCode(applySceneSettings(zoomCamera(hideBodyText(userContent.voxel)), userContent.settings));
          setViewMode('voxel');
        } else {
          setVoxelCode(null);
          setViewMode('image');
        }
      } else {
        setImageData(null);
        setVoxelCode(null);
        setViewMode('image');
      }
    }
  };

  const handleVoxelize = async () => {
    if (!imageData) return;
    setStatus('generating_voxels');
    setErrorMsg('');
    setThinkingText(null);
    setIsViewerVisible(true);
    
    let thoughtBuffer = "";
    try {
      const codeRaw = await generateVoxelScene(imageData, (thoughtFragment) => {
        thoughtBuffer += thoughtFragment;
        const matches = thoughtBuffer.match(/\*\*([^*]+)\*\*/g);
        if (matches) {
          const header = matches[matches.length - 1].replace(/\*\*/g, '').trim();
          setThinkingText(prev => prev === header ? prev : header);
        }
      });
      
      const pristineCode = extractHtmlFromText(codeRaw);
      const finalHtml = applySceneSettings(zoomCamera(hideBodyText(pristineCode)), DEFAULT_SCENE_SETTINGS);
      
      setVoxelCode(finalHtml);
      setSceneSettings(DEFAULT_SCENE_SETTINGS);
      if (selectedTile === 'user') {
        setUserContent(prev => prev ? ({...prev, voxel: pristineCode, settings: DEFAULT_SCENE_SETTINGS}) : null);
      }
      
      setViewMode('voxel');
      setStatus('idle');
      setThinkingText(null);
    } catch (err) { handleError(err); }
  };

  const handleDownload = () => {
    const a = document.createElement('a');
    if (viewMode === 'image' && imageData) {
      a.href = imageData;
      a.download = `voxel-art-image-${Date.now()}.${imageData.includes('jpeg') ? 'jpg' : 'png'}`;
    } else if (viewMode === 'voxel' && voxelCode) {
      a.href = `data:text/html;charset=utf-8,${encodeURIComponent(voxelCode)}`;
      a.download = `voxel-scene-${Date.now()}.html`;
    } else { return; }
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const isLoading = status !== 'idle' && status !== 'error';

  const getDisplayPrompt = () => {
    if (status === 'generating_image') return useOptimization ? `Subject: ${prompt}` : prompt;
    return 'I have provided an image. Code a beautiful voxel art scene inspired by this image. Write threejs code as a single-page.';
  };

  return (
    <>
      <div className={`min-h-screen flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8 font-sans bg-white ${isExampleViewerOpen ? 'hidden' : 'flex'}`}>
        <div className="w-full max-w-2xl space-y-8">
          <Header />
          <ExampleGrid
            examples={EXAMPLES}
            loadedThumbnails={loadedThumbnails}
            selectedTile={selectedTile}
            isLoading={isLoading}
            userContent={userContent}
            showGenerator={showGenerator}
            onExampleClick={handleExampleClick}
            onUserTileClick={handleUserTileClick}
          />

          {showGenerator && (
            <GeneratorPanel
              prompt={prompt} setPrompt={setPrompt}
              aspectRatio={aspectRatio} setAspectRatio={setAspectRatio}
              useOptimization={useOptimization} setUseOptimization={setUseOptimization}
              isLoading={status === 'generating_image'}
              onImageGenerate={handleImageGenerate}
              onFileUpload={processFile}
              samplePrompts={SAMPLE_PROMPTS}
              placeholderIndex={placeholderIndex}
            />
          )}

          {errorMsg && <div className="p-4 border-2 border-red-500 bg-red-50 text-red-700 text-sm font-bold animate-in fade-in" role="alert">ERROR: {errorMsg}</div>}

          {isViewerVisible && (
            <div className="space-y-2">
              <VoxelViewer
                isLoading={isLoading} status={status}
                viewMode={viewMode} imageData={imageData} voxelCode={voxelCode}
                thinkingText={thinkingText} displayPrompt={getDisplayPrompt()}
                onViewModeChange={setViewMode} onDownload={handleDownload}
                onVoxelize={handleVoxelize} hasUserContent={!!userContent?.voxel}
              />
              {voxelCode && selectedTile === 'user' && (
                <SceneSettingsPanel settings={sceneSettings} onSettingChange={(key, value) => {
                    if (typeof value === 'object' && value !== null) {
                        setSceneSettings(s => ({ ...s, [key]: { ...s[key as keyof SceneSettings], ...value } }));
                    } else {
                        setSceneSettings(s => ({...s, [key]: value}));
                    }
                }} />
              )}
            </div>
          )}
        </div>
      </div>

      <FullscreenViewer
        isOpen={isExampleViewerOpen}
        onClose={() => { setIsExampleViewerOpen(false); setSelectedTile(null); }}
        examples={EXAMPLES}
        currentExampleIndex={currentExampleIndex}
        loadedThumbnails={loadedThumbnails}
        isLoading={isLoading}
        voxelCode={voxelCode}
        imageData={imageData}
        viewMode={viewMode}
        onExampleClick={handleExampleClick}
        onViewModeChange={setViewMode}
        onDownload={handleDownload}
      />
    </>
  );
};

export default App;
