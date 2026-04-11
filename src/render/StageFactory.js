import * as THREE from "three";

const STAGE_PALETTES = {
  balanced: {
    skyTop: "#8fd3ff",
    skyBottom: "#f8f1d1",
    platform: "#69c1ff",
    accent: "#ffef87",
    hazard: "#ff9b5c",
  },
  vertical: {
    skyTop: "#7ad6ff",
    skyBottom: "#ffe0f3",
    platform: "#8f80ff",
    accent: "#fff7b8",
    hazard: "#ff8ec8",
  },
  hazard: {
    skyTop: "#ffb877",
    skyBottom: "#ff7d98",
    platform: "#ffdf8a",
    accent: "#ffd4e6",
    hazard: "#ff5c5c",
  },
};

function makeRoundedPlatform(platform, palette) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(platform.width, platform.height, 3.2),
    new THREE.MeshStandardMaterial({
      color: palette.platform,
      emissive: palette.accent,
      emissiveIntensity: 0.1,
      roughness: 0.52,
      metalness: 0.12,
    }),
  );
  mesh.position.set(platform.x, platform.y, 0);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function makeBackdrop(stage, palette) {
  const group = new THREE.Group();

  const sky = new THREE.Mesh(
    new THREE.PlaneGeometry(42, 26),
    new THREE.MeshBasicMaterial({
      color: palette.skyBottom,
    }),
  );
  sky.position.set(0, 7, -8);
  group.add(sky);

  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(2.6, 32),
    new THREE.MeshBasicMaterial({
      color: palette.accent,
      transparent: true,
      opacity: 0.9,
    }),
  );
  sun.position.set(stage.id === "hazard" ? 8 : -7, 12, -7.5);
  group.add(sun);

  for (let index = 0; index < 7; index += 1) {
    const cloud = new THREE.Mesh(
      new THREE.SphereGeometry(0.75 + index * 0.03, 16, 16),
      new THREE.MeshStandardMaterial({
        color: "#ffffff",
        transparent: true,
        opacity: 0.9,
        roughness: 0.85,
        metalness: 0.02,
      }),
    );
    cloud.position.set(-13 + index * 4.1, 10 + Math.sin(index * 1.7), -6.7 - (index % 2) * 0.4);
    group.add(cloud);
  }

  return group;
}

function makeHazardFloor(stage, palette) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(40, 1.2, 6),
    new THREE.MeshStandardMaterial({
      color: palette.hazard,
      emissive: palette.hazard,
      emissiveIntensity: 0.25,
      roughness: 0.4,
      metalness: 0.2,
      transparent: true,
      opacity: 0.92,
    }),
  );
  mesh.position.set(0, stage.hazardFloor - 0.7, 0);
  return mesh;
}

function makeStageProps(stage, palette) {
  const props = new THREE.Group();
  const count = stage.id === "vertical" ? 6 : 4;
  for (let index = 0; index < count; index += 1) {
    const prop = new THREE.Mesh(
      new THREE.TorusKnotGeometry(0.32 + index * 0.04, 0.12, 64, 10),
      new THREE.MeshStandardMaterial({
        color: index % 2 === 0 ? palette.accent : palette.platform,
        emissive: palette.accent,
        emissiveIntensity: 0.12,
        roughness: 0.28,
        metalness: 0.38,
      }),
    );
    prop.position.set(-11 + index * 5.5, 11 + (index % 3) * 1.3, -4.5 - (index % 2));
    prop.userData.baseY = prop.position.y;
    prop.rotation.set(index * 0.2, index * 0.7, index * 0.3);
    props.add(prop);
  }
  return props;
}

export function buildStageGroup(stage, { preview = false } = {}) {
  const palette = STAGE_PALETTES[stage.theme] ?? STAGE_PALETTES.balanced;
  const group = new THREE.Group();
  const platformMeshes = stage.platforms.map((platform) => makeRoundedPlatform(platform, palette));
  platformMeshes.forEach((mesh) => group.add(mesh));

  const backdrop = makeBackdrop(stage, palette);
  const props = makeStageProps(stage, palette);
  const hazardFloor = makeHazardFloor(stage, palette);

  group.add(backdrop, props, hazardFloor);

  if (preview) {
    group.scale.setScalar(0.72);
    group.position.y = -0.8;
  }

  return {
    group,
    hazardFloor,
    props,
    palette,
    baseHazardFloor: stage.hazardFloor,
  };
}

export function updateStageGroup(stageRuntime, snapshot) {
  const time = snapshot.elapsed;
  stageRuntime.props.children.forEach((prop, index) => {
    prop.rotation.x += 0.002 + index * 0.0002;
    prop.rotation.y += 0.003;
    prop.position.y = (prop.userData.baseY ?? prop.position.y) + Math.sin(time * 0.8 + index) * 0.14;
  });
  stageRuntime.hazardFloor.position.y = snapshot.hazardFloor - 0.7;
}
