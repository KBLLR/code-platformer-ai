/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import type { SceneSettings } from '../utils/html';

interface SceneSettingsPanelProps {
  settings: SceneSettings;
  onSettingChange: (key: keyof SceneSettings, value: any) => void;
}

const SceneSettingsPanel: React.FC<SceneSettingsPanelProps> = ({ settings, onSettingChange }) => {
  const [isOpen, setIsOpen] = React.useState(false);

  const handlePositionChange = (axis: 'x' | 'y' | 'z', value: number) => {
    onSettingChange('sunlightPosition', { [axis]: value });
  };

  return (
    <div className="pt-2 animate-in fade-in duration-300">
      <button onClick={() => setIsOpen(!isOpen)} type="button" className="btn-secondary w-full text-sm flex items-center justify-center gap-2">
        Scene Settings
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={`w-5 h-5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}><path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" /></svg>
      </button>
      {isOpen && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 border-2 border-black p-4 mt-2 bg-gray-50 shadow-md animate-in fade-in duration-200">
          {/* Basic Settings */}
          <div className="flex flex-col">
            <label htmlFor="bgColor" className="text-sm font-bold mb-2 uppercase flex items-center justify-between">Background <span>{settings.backgroundColor}</span></label>
            <input id="bgColor" type="color" value={settings.backgroundColor} onChange={e => onSettingChange('backgroundColor', e.target.value)} className="w-full h-10 border-2 border-black cursor-pointer bg-white" />
          </div>
          <div className="flex flex-col">
            <label htmlFor="fogDensity" className="text-sm font-bold mb-2 uppercase flex items-center justify-between">Fog <span>{settings.fogDensity.toFixed(3)}</span></label>
            <input id="fogDensity" type="range" min="0" max="0.1" step="0.001" value={settings.fogDensity} onChange={e => onSettingChange('fogDensity', parseFloat(e.target.value))} />
          </div>
          <div className="flex flex-col">
            <label htmlFor="lightIntensity" className="text-sm font-bold mb-2 uppercase flex items-center justify-between">Intensity <span>{settings.lightIntensity.toFixed(1)}</span></label>
            <input id="lightIntensity" type="range" min="0" max="3" step="0.1" value={settings.lightIntensity} onChange={e => onSettingChange('lightIntensity', parseFloat(e.target.value))} />
          </div>
          
          {/* Advanced Lighting */}
          <div className="flex flex-col">
            <label htmlFor="sunlightColor" className="text-sm font-bold mb-2 uppercase flex items-center justify-between">Sunlight <span>{settings.sunlightColor}</span></label>
            <input id="sunlightColor" type="color" value={settings.sunlightColor} onChange={e => onSettingChange('sunlightColor', e.target.value)} className="w-full h-10 border-2 border-black cursor-pointer bg-white" />
          </div>
          <div className="flex flex-col">
            <label htmlFor="ambientLightColor" className="text-sm font-bold mb-2 uppercase flex items-center justify-between">Ambient <span>{settings.ambientLightColor}</span></label>
            <input id="ambientLightColor" type="color" value={settings.ambientLightColor} onChange={e => onSettingChange('ambientLightColor', e.target.value)} className="w-full h-10 border-2 border-black cursor-pointer bg-white" />
          </div>
          <div />

          {/* Light Position */}
          <div className="flex flex-col sm:col-span-1">
            <label htmlFor="lightPosX" className="text-sm font-bold mb-2 uppercase flex items-center justify-between">Sun X <span>{settings.sunlightPosition.x}</span></label>
            <input id="lightPosX" type="range" min="-100" max="100" step="1" value={settings.sunlightPosition.x} onChange={e => handlePositionChange('x', parseInt(e.target.value, 10))} />
          </div>
          <div className="flex flex-col sm:col-span-1">
            <label htmlFor="lightPosY" className="text-sm font-bold mb-2 uppercase flex items-center justify-between">Sun Y <span>{settings.sunlightPosition.y}</span></label>
            <input id="lightPosY" type="range" min="0" max="200" step="1" value={settings.sunlightPosition.y} onChange={e => handlePositionChange('y', parseInt(e.target.value, 10))} />
          </div>
          <div className="flex flex-col sm:col-span-1">
            <label htmlFor="lightPosZ" className="text-sm font-bold mb-2 uppercase flex items-center justify-between">Sun Z <span>{settings.sunlightPosition.z}</span></label>
            <input id="lightPosZ" type="range" min="-100" max="100" step="1" value={settings.sunlightPosition.z} onChange={e => handlePositionChange('z', parseInt(e.target.value, 10))} />
          </div>
        </div>
      )}
    </div>
  );
};

export default SceneSettingsPanel;
