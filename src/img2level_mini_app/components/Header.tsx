/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';

const Header: React.FC = () => (
  <div className="text-center border-b-2 border-black pb-6">
    <h1 className="text-4xl sm:text-5xl font-black leading-[0.9] tracking-tight">IMAGE TO VOXEL ART</h1>
    <p className="mt-2 text-lg text-gray-600 font-semibold">Create voxel art scenes inspired by any image, with MLX local vision.</p>
  </div>
);

export default Header;
