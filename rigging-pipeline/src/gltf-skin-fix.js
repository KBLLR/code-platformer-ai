import fs from 'fs/promises';

const GLB_MAGIC = 0x46546c67;
const JSON_CHUNK_TYPE = 0x4e4f534a;
const BIN_CHUNK_TYPE = 0x004e4942;

const DEFORM_BONE_NAMES = [
  'mixamorigHips',
  'mixamorigSpine',
  'mixamorigSpine1',
  'mixamorigSpine2',
  'mixamorigNeck',
  'mixamorigHead',
  'mixamorigLeftShoulder',
  'mixamorigLeftArm',
  'mixamorigLeftForeArm',
  'mixamorigLeftHand',
  'mixamorigRightShoulder',
  'mixamorigRightArm',
  'mixamorigRightForeArm',
  'mixamorigRightHand',
  'mixamorigLeftUpLeg',
  'mixamorigLeftLeg',
  'mixamorigLeftFoot',
  'mixamorigLeftToeBase',
  'mixamorigRightUpLeg',
  'mixamorigRightLeg',
  'mixamorigRightFoot',
  'mixamorigRightToeBase'
];

const DEFORM_BONE_ALIASES = Object.fromEntries(
  DEFORM_BONE_NAMES.map((name) => [name, [name, name.replace('mixamorig', 'mixamorig:')]])
);

export async function ensureMixamoSkin(glbPath) {
  const source = await fs.readFile(glbPath);
  const { json, chunks } = parseGlb(source);

  if (json.skins?.length) {
    return;
  }

  const meshNodeIndices = [];
  const nodeIndexByName = new Map();
  const parentIndex = new Array((json.nodes || []).length).fill(-1);

  for (const [index, node] of (json.nodes || []).entries()) {
    if (node.name) {
      nodeIndexByName.set(node.name, index);
    }
    if (node.mesh !== undefined) {
      meshNodeIndices.push(index);
    }
    for (const child of node.children || []) {
      parentIndex[child] = index;
    }
  }

  if (!meshNodeIndices.length) {
    throw new Error('No mesh nodes found in GLB export');
  }

  const jointNodeIndices = DEFORM_BONE_NAMES.map((name) => resolveNodeIndex(nodeIndexByName, DEFORM_BONE_ALIASES[name]));

  const meshNodeIndex = meshNodeIndices[0];
  const worldMatrices = buildWorldMatrices(json.nodes || [], parentIndex);
  const meshWorld = worldMatrices[meshNodeIndex];
  const inverseBindMatrices = new Float32Array(jointNodeIndices.length * 16);

  for (const [jointOrder, jointNodeIndex] of jointNodeIndices.entries()) {
    const inverseBind = multiplyMatrices(invertMatrix(worldMatrices[jointNodeIndex]), meshWorld);
    inverseBindMatrices.set(inverseBind, jointOrder * 16);
  }

  const binChunk = chunks.find((chunk) => chunk.type === BIN_CHUNK_TYPE);
  if (!binChunk) {
    throw new Error('GLB export does not contain a BIN chunk');
  }

  const inverseBindBuffer = Buffer.from(inverseBindMatrices.buffer);
  const paddedBin = padBinary(binChunk.data);
  const byteOffset = paddedBin.length;
  const combinedBin = Buffer.concat([paddedBin, inverseBindBuffer]);

  json.bufferViews = json.bufferViews || [];
  json.accessors = json.accessors || [];
  json.buffers = json.buffers || [{ byteLength: 0 }];

  const bufferViewIndex = json.bufferViews.length;
  json.bufferViews.push({
    buffer: 0,
    byteOffset,
    byteLength: inverseBindBuffer.length
  });

  const accessorIndex = json.accessors.length;
  json.accessors.push({
    bufferView: bufferViewIndex,
    componentType: 5126,
    count: jointNodeIndices.length,
    type: 'MAT4'
  });

  json.buffers[0].byteLength = combinedBin.length;
  json.skins = [
    {
      inverseBindMatrices: accessorIndex,
      joints: jointNodeIndices,
      name: 'Armature',
      skeleton: jointNodeIndices[0]
    }
  ];

  for (const meshNodeIdx of meshNodeIndices) {
    json.nodes[meshNodeIdx].skin = 0;
  }

  chunks.splice(chunks.indexOf(binChunk), 1, {
    type: BIN_CHUNK_TYPE,
    data: combinedBin
  });

  await fs.writeFile(glbPath, serializeGlb(json, chunks));
}

function parseGlb(buffer) {
  if (buffer.readUInt32LE(0) !== GLB_MAGIC) {
    throw new Error('Invalid GLB file');
  }

  let offset = 12;
  let json = null;
  const chunks = [];

  while (offset < buffer.length) {
    const chunkLength = buffer.readUInt32LE(offset);
    const chunkType = buffer.readUInt32LE(offset + 4);
    const chunkData = buffer.subarray(offset + 8, offset + 8 + chunkLength);

    if (chunkType === JSON_CHUNK_TYPE) {
      json = JSON.parse(chunkData.toString('utf8').replace(/\0+$/, '').trimEnd());
    } else {
      chunks.push({
        type: chunkType,
        data: Buffer.from(chunkData)
      });
    }

    offset += 8 + chunkLength;
  }

  if (!json) {
    throw new Error('GLB does not contain a JSON chunk');
  }

  return { json, chunks };
}

function resolveNodeIndex(nodeIndexByName, aliases) {
  for (const alias of aliases) {
    const index = nodeIndexByName.get(alias);
    if (index !== undefined) {
      return index;
    }
  }

  throw new Error(`Missing deform bone in export: ${aliases.join(', ')}`);
}

function serializeGlb(json, chunks) {
  const jsonChunk = padJson(Buffer.from(JSON.stringify(json), 'utf8'));
  const outputChunks = [
    {
      type: JSON_CHUNK_TYPE,
      data: jsonChunk
    },
    ...chunks.map((chunk) => ({
      type: chunk.type,
      data: chunk.type === BIN_CHUNK_TYPE ? padBinary(chunk.data) : chunk.data
    }))
  ];

  const totalLength = 12 + outputChunks.reduce((sum, chunk) => sum + 8 + chunk.data.length, 0);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(GLB_MAGIC, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalLength, 8);

  const payload = outputChunks.flatMap((chunk) => {
    const chunkHeader = Buffer.alloc(8);
    chunkHeader.writeUInt32LE(chunk.data.length, 0);
    chunkHeader.writeUInt32LE(chunk.type, 4);
    return [chunkHeader, chunk.data];
  });

  return Buffer.concat([header, ...payload]);
}

function buildWorldMatrices(nodes, parentIndex) {
  const cache = new Map();

  const resolveWorld = (index) => {
    if (cache.has(index)) {
      return cache.get(index);
    }

    const local = getNodeMatrix(nodes[index] || {});
    const parent = parentIndex[index];
    const world = parent >= 0 ? multiplyMatrices(resolveWorld(parent), local) : local;
    cache.set(index, world);
    return world;
  };

  return nodes.map((_, index) => resolveWorld(index));
}

function getNodeMatrix(node) {
  if (node.matrix) {
    return Float32Array.from(node.matrix);
  }

  const translation = node.translation || [0, 0, 0];
  const rotation = node.rotation || [0, 0, 0, 1];
  const scale = node.scale || [1, 1, 1];

  const [x, y, z, w] = rotation;
  const [sx, sy, sz] = scale;
  const [tx, ty, tz] = translation;

  const x2 = x + x;
  const y2 = y + y;
  const z2 = z + z;
  const xx = x * x2;
  const xy = x * y2;
  const xz = x * z2;
  const yy = y * y2;
  const yz = y * z2;
  const zz = z * z2;
  const wx = w * x2;
  const wy = w * y2;
  const wz = w * z2;

  return new Float32Array([
    (1 - (yy + zz)) * sx,
    (xy + wz) * sx,
    (xz - wy) * sx,
    0,
    (xy - wz) * sy,
    (1 - (xx + zz)) * sy,
    (yz + wx) * sy,
    0,
    (xz + wy) * sz,
    (yz - wx) * sz,
    (1 - (xx + yy)) * sz,
    0,
    tx,
    ty,
    tz,
    1
  ]);
}

function multiplyMatrices(a, b) {
  const out = new Float32Array(16);

  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      out[column * 4 + row] =
        a[0 * 4 + row] * b[column * 4 + 0] +
        a[1 * 4 + row] * b[column * 4 + 1] +
        a[2 * 4 + row] * b[column * 4 + 2] +
        a[3 * 4 + row] * b[column * 4 + 3];
    }
  }

  return out;
}

function invertMatrix(matrix) {
  const out = new Float32Array(16);
  const m = matrix;

  const b00 = m[0] * m[5] - m[1] * m[4];
  const b01 = m[0] * m[6] - m[2] * m[4];
  const b02 = m[0] * m[7] - m[3] * m[4];
  const b03 = m[1] * m[6] - m[2] * m[5];
  const b04 = m[1] * m[7] - m[3] * m[5];
  const b05 = m[2] * m[7] - m[3] * m[6];
  const b06 = m[8] * m[13] - m[9] * m[12];
  const b07 = m[8] * m[14] - m[10] * m[12];
  const b08 = m[8] * m[15] - m[11] * m[12];
  const b09 = m[9] * m[14] - m[10] * m[13];
  const b10 = m[9] * m[15] - m[11] * m[13];
  const b11 = m[10] * m[15] - m[11] * m[14];

  const determinant =
    b00 * b11 - b01 * b10 + b02 * b09 +
    b03 * b08 - b04 * b07 + b05 * b06;

  if (!determinant) {
    throw new Error('Skin repair failed: non-invertible joint matrix');
  }

  const det = 1.0 / determinant;

  out[0] = (m[5] * b11 - m[6] * b10 + m[7] * b09) * det;
  out[1] = (-m[1] * b11 + m[2] * b10 - m[3] * b09) * det;
  out[2] = (m[13] * b05 - m[14] * b04 + m[15] * b03) * det;
  out[3] = (-m[9] * b05 + m[10] * b04 - m[11] * b03) * det;
  out[4] = (-m[4] * b11 + m[6] * b08 - m[7] * b07) * det;
  out[5] = (m[0] * b11 - m[2] * b08 + m[3] * b07) * det;
  out[6] = (-m[12] * b05 + m[14] * b02 - m[15] * b01) * det;
  out[7] = (m[8] * b05 - m[10] * b02 + m[11] * b01) * det;
  out[8] = (m[4] * b10 - m[5] * b08 + m[7] * b06) * det;
  out[9] = (-m[0] * b10 + m[1] * b08 - m[3] * b06) * det;
  out[10] = (m[12] * b04 - m[13] * b02 + m[15] * b00) * det;
  out[11] = (-m[8] * b04 + m[9] * b02 - m[11] * b00) * det;
  out[12] = (-m[4] * b09 + m[5] * b07 - m[6] * b06) * det;
  out[13] = (m[0] * b09 - m[1] * b07 + m[2] * b06) * det;
  out[14] = (-m[12] * b03 + m[13] * b01 - m[14] * b00) * det;
  out[15] = (m[8] * b03 - m[9] * b01 + m[10] * b00) * det;

  return out;
}

function padJson(buffer) {
  const remainder = buffer.length % 4;
  if (remainder === 0) {
    return buffer;
  }
  return Buffer.concat([buffer, Buffer.alloc(4 - remainder, 0x20)]);
}

function padBinary(buffer) {
  const remainder = buffer.length % 4;
  if (remainder === 0) {
    return buffer;
  }
  return Buffer.concat([buffer, Buffer.alloc(4 - remainder)]);
}
