import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { REQUIRED_RUNTIME_CLIPS, validateRiggedRuntimeManifest } from "../content/contracts.js";

const FIGHTER_COLORS = {
  blue: "#4f7cff",
  red: "#f45b69",
  pink: "#ff7cc9",
  black: "#2a2d43",
};

const LOOP_STATES = new Set(["idle", "run", "fall"]);
const PROCEDURAL_CLIPS = createProceduralClipSet();

function createFallbackModel(fighterId) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.55, 1.7, 6, 12),
    new THREE.MeshStandardMaterial({
      color: FIGHTER_COLORS[fighterId] ?? "#8a96b8",
      emissive: FIGHTER_COLORS[fighterId] ?? "#8a96b8",
      emissiveIntensity: 0.08,
      roughness: 0.34,
      metalness: 0.18,
    }),
  );
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.72, 0.09, 8, 24),
    new THREE.MeshStandardMaterial({
      color: "#fff4c6",
      emissive: "#ffe085",
      emissiveIntensity: 0.18,
      roughness: 0.25,
      metalness: 0.62,
    }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.2;
  group.add(body, ring);
  group.userData.isFallback = true;
  return group;
}

function localizeInstanceMaterials(root) {
  root.traverse((child) => {
    if (!child.isMesh) return;
    child.userData.keepSharedGeometry = true;
    if (Array.isArray(child.material)) {
      child.material = child.material.map((entry) => entry?.clone?.() ?? entry);
      return;
    }
    if (child.material?.isMaterial) {
      child.material = child.material.clone();
    }
  });
}

function normalizeTemplate(group) {
  const box = new THREE.Box3().setFromObject(group);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  const height = size.y || 1;
  const scale = 3.2 / height;
  group.scale.setScalar(scale);
  group.position.sub(center.multiplyScalar(scale));
  const groundedBox = new THREE.Box3().setFromObject(group);
  group.position.y -= groundedBox.min.y;
  group.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = true;
    child.receiveShadow = true;
    if (child.material?.isMaterial) {
      child.material = child.material.clone();
    }
  });
  return group;
}

function normalizeClipName(name) {
  return String(name ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function createPresentationHierarchy(model) {
  const placementRoot = new THREE.Group();
  placementRoot.name = "fighterPlacementRoot";

  const animRoot = new THREE.Group();
  animRoot.name = "animRoot";

  const animSway = new THREE.Group();
  animSway.name = "animSway";

  const animBody = new THREE.Group();
  animBody.name = "animBody";

  placementRoot.add(animRoot);
  animRoot.add(animSway);
  animSway.add(animBody);
  animBody.add(model);

  return { placementRoot };
}

function buildClipMap(animations, runtimeManifest) {
  const resolved = new Map();
  const indexed = new Map();

  for (const clip of animations ?? []) {
    indexed.set(normalizeClipName(clip.name), clip);
  }

  for (const clipName of runtimeManifest.requiredClips ?? REQUIRED_RUNTIME_CLIPS) {
    const normalized = normalizeClipName(clipName);
    resolved.set(clipName, indexed.get(normalized) ?? PROCEDURAL_CLIPS.get(clipName));
  }

  REQUIRED_RUNTIME_CLIPS.forEach((clipName) => {
    if (!resolved.has(clipName)) {
      resolved.set(clipName, PROCEDURAL_CLIPS.get(clipName));
    }
  });

  return resolved;
}

function proceduralNumberTrack(path, times, values) {
  return new THREE.NumberKeyframeTrack(path, times, values);
}

function proceduralVectorTrack(path, times, values) {
  return new THREE.VectorKeyframeTrack(path, times, values);
}

function createProceduralClipSet() {
  return new Map([
    [
      "idle",
      new THREE.AnimationClip("idle", 1.8, [
        proceduralVectorTrack("animBody.position", [0, 0.9, 1.8], [0, 0.04, 0, 0, 0.11, 0, 0, 0.04, 0]),
        proceduralNumberTrack("animSway.rotation[z]", [0, 0.9, 1.8], [0.03, -0.03, 0.03]),
        proceduralVectorTrack("animBody.scale", [0, 0.9, 1.8], [1, 1, 1, 1.02, 0.98, 1, 1, 1, 1]),
      ]),
    ],
    [
      "run",
      new THREE.AnimationClip("run", 0.55, [
        proceduralVectorTrack("animBody.position", [0, 0.14, 0.28, 0.42, 0.55], [0, 0.05, 0, 0, 0.22, 0, 0, 0.08, 0, 0, 0.2, 0, 0, 0.05, 0]),
        proceduralNumberTrack("animSway.rotation[z]", [0, 0.14, 0.28, 0.42, 0.55], [0.12, -0.18, 0.12, -0.18, 0.12]),
        proceduralNumberTrack("animRoot.rotation[x]", [0, 0.28, 0.55], [0.02, -0.03, 0.02]),
      ]),
    ],
    [
      "jump_start",
      new THREE.AnimationClip("jump_start", 0.22, [
        proceduralVectorTrack("animBody.scale", [0, 0.08, 0.22], [1, 1, 1, 1.08, 0.84, 1, 0.96, 1.06, 1]),
        proceduralVectorTrack("animBody.position", [0, 0.08, 0.22], [0, 0, 0, 0, -0.12, 0, 0, 0.28, 0]),
        proceduralNumberTrack("animRoot.rotation[x]", [0, 0.08, 0.22], [0, -0.12, 0.04]),
      ]),
    ],
    [
      "fall",
      new THREE.AnimationClip("fall", 0.6, [
        proceduralNumberTrack("animRoot.rotation[x]", [0, 0.3, 0.6], [-0.14, -0.06, -0.14]),
        proceduralNumberTrack("animSway.rotation[z]", [0, 0.3, 0.6], [0.02, -0.02, 0.02]),
        proceduralVectorTrack("animBody.scale", [0, 0.3, 0.6], [0.98, 1.04, 1, 1, 1.02, 1, 0.98, 1.04, 1]),
      ]),
    ],
    [
      "land",
      new THREE.AnimationClip("land", 0.18, [
        proceduralVectorTrack("animBody.scale", [0, 0.08, 0.18], [1, 1, 1, 1.16, 0.82, 1, 0.98, 1.02, 1]),
        proceduralVectorTrack("animBody.position", [0, 0.08, 0.18], [0, 0.14, 0, 0, -0.18, 0, 0, 0.02, 0]),
      ]),
    ],
    [
      "attack",
      new THREE.AnimationClip("attack", 0.22, [
        proceduralNumberTrack("animSway.rotation[z]", [0, 0.08, 0.14, 0.22], [0, -0.26, 0.38, 0]),
        proceduralNumberTrack("animRoot.rotation[x]", [0, 0.08, 0.22], [0, -0.08, 0]),
        proceduralVectorTrack("animBody.position", [0, 0.08, 0.22], [0, 0, 0, 0.2, 0.06, 0, 0, 0, 0]),
      ]),
    ],
    [
      "stomp",
      new THREE.AnimationClip("stomp", 0.18, [
        proceduralNumberTrack("animRoot.rotation[x]", [0, 0.08, 0.18], [0, -0.42, 0.06]),
        proceduralVectorTrack("animBody.scale", [0, 0.08, 0.18], [1, 1, 1, 0.92, 1.08, 1, 1, 1, 1]),
      ]),
    ],
    [
      "pickup",
      new THREE.AnimationClip("pickup", 0.2, [
        proceduralVectorTrack("animBody.position", [0, 0.1, 0.2], [0, 0, 0, 0, -0.28, 0, 0, 0, 0]),
        proceduralNumberTrack("animRoot.rotation[x]", [0, 0.1, 0.2], [0, 0.16, 0]),
      ]),
    ],
    [
      "throw",
      new THREE.AnimationClip("throw", 0.24, [
        proceduralNumberTrack("animSway.rotation[z]", [0, 0.08, 0.16, 0.24], [0, -0.2, 0.42, 0]),
        proceduralVectorTrack("animBody.position", [0, 0.08, 0.16, 0.24], [0, 0, 0, -0.08, 0.03, 0, 0.16, 0.08, 0, 0, 0, 0]),
      ]),
    ],
    [
      "ringout",
      new THREE.AnimationClip("ringout", 0.72, [
        proceduralNumberTrack("animRoot.rotation[z]", [0, 0.36, 0.72], [0, Math.PI * 2, Math.PI * 4]),
        proceduralVectorTrack("animBody.position", [0, 0.36, 0.72], [0, 0, 0, 0, 1.1, 0, 0, 2.4, 0]),
        proceduralVectorTrack("animBody.scale", [0, 0.36, 0.72], [1, 1, 1, 0.9, 0.9, 0.9, 0.18, 0.18, 0.18]),
      ]),
    ],
  ]);
}

class FighterPresentation {
  constructor({ root, mixer, actions, runtimeManifest, assetSource, proceduralFallback }) {
    this.root = root;
    this.mixer = mixer;
    this.actions = actions;
    this.runtimeManifest = runtimeManifest;
    this.assetSource = assetSource;
    this.proceduralFallback = proceduralFallback;
    this.activeLoop = null;
    this.activeAction = null;
    this.pendingLoop = "idle";
    this.lastState = "idle";
    this.lastNonce = -1;
    this.oneShotAction = null;
    this._boundFinished = (event) => {
      if (event.action !== this.oneShotAction) return;
      this.oneShotAction = null;
      this._playLoop(this.pendingLoop, 0.08);
    };
    this.mixer.addEventListener("finished", this._boundFinished);
    this.root.userData.runtimeManifest = runtimeManifest;
    this.root.userData.assetSource = assetSource;
    this.root.userData.proceduralFallback = proceduralFallback;
    this.root.userData.fighterPresentation = this;
  }

  setPreviewAnimation() {
    this._playLoop("idle", 0.16);
  }

  applyMatchAnimation({ animationState, loopAnimationState, animationNonce }) {
    this.pendingLoop = loopAnimationState ?? animationState ?? "idle";
    if (!animationState) {
      this._playLoop(this.pendingLoop, 0.12);
      return;
    }

    if (LOOP_STATES.has(animationState)) {
      this.lastState = animationState;
      this._playLoop(animationState, 0.14);
      return;
    }

    if (animationNonce !== this.lastNonce || animationState !== this.lastState) {
      this.lastNonce = animationNonce;
      this.lastState = animationState;
      this._playOneShot(animationState);
      return;
    }

    if (!this.oneShotAction) {
      this._playLoop(this.pendingLoop, 0.08);
    }
  }

  update(delta) {
    this.mixer.update(delta);
  }

  dispose() {
    this.mixer.removeEventListener("finished", this._boundFinished);
  }

  _playLoop(name, fade) {
    const action = this.actions.get(name) ?? this.actions.get("idle");
    if (!action) return;
    if (this.activeLoop === name && this.activeAction === action && !this.oneShotAction) return;

    if (this.activeAction && this.activeAction !== action) {
      this.activeAction.fadeOut(fade);
    }

    action.enabled = true;
    action.reset();
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.clampWhenFinished = false;
    action.fadeIn(fade);
    action.play();
    this.activeAction = action;
    this.activeLoop = name;
  }

  _playOneShot(name) {
    const action = this.actions.get(name) ?? this.actions.get("idle");
    if (!action) return;

    if (this.activeAction && this.activeAction !== action) {
      this.activeAction.fadeOut(0.08);
    }

    action.enabled = true;
    action.reset();
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.fadeIn(0.08);
    action.play();
    this.activeAction = action;
    this.oneShotAction = action;
  }
}

export class GLTFAssetLoader {
  constructor() {
    this.loader = new GLTFLoader();
    this.loader.setMeshoptDecoder(MeshoptDecoder);
    this.templateCache = new Map();
    this.runtimeManifestCache = new Map();
  }

  async createFighterInstance(fighterDefinition) {
    const template = await this._getTemplate(fighterDefinition);
    const clone = template.scene.userData.isFallback ? template.scene.clone(true) : cloneSkinned(template.scene);
    clone.userData.fighterId = fighterDefinition.id;
    localizeInstanceMaterials(clone);

    const { placementRoot } = createPresentationHierarchy(clone);
    const mixer = new THREE.AnimationMixer(placementRoot);
    const actions = new Map();

    for (const [clipName, clip] of template.clips) {
      if (!clip) continue;
      actions.set(clipName, mixer.clipAction(clip));
    }

    return new FighterPresentation({
      root: placementRoot,
      mixer,
      actions,
      runtimeManifest: template.runtimeManifest,
      assetSource: template.assetSource,
      proceduralFallback: template.proceduralFallback,
    });
  }

  async _getTemplate(fighterDefinition) {
    if (!this.templateCache.has(fighterDefinition.id)) {
      this.templateCache.set(fighterDefinition.id, this._loadTemplate(fighterDefinition));
    }
    return this.templateCache.get(fighterDefinition.id);
  }

  async _loadTemplate(fighterDefinition) {
    const runtimeManifest = await this._getRuntimeManifest(fighterDefinition);
    const attemptedUrls = [];
    const candidates = [];

    if (runtimeManifest.exportStatus === "ready") {
      candidates.push({
        url: runtimeManifest.runtimeGlb,
        assetSource: "rigged-runtime",
      });
    }

    candidates.push({
      url: fighterDefinition.mirroredSourceFile,
      assetSource: "source-mirror",
    });

    for (const candidate of candidates) {
      attemptedUrls.push(candidate.url);
      try {
        const gltf = await this._loadScene(candidate.url);
        return {
          scene: normalizeTemplate(gltf.scene),
          clips: buildClipMap(gltf.animations, runtimeManifest),
          runtimeManifest,
          assetSource: candidate.assetSource,
          proceduralFallback: !gltf.animations?.length,
        };
      } catch (error) {
        console.warn(`[ToyboxArena] Failed to load ${fighterDefinition.id} from ${candidate.url}: ${error.message}`);
      }
    }

    return {
      scene: normalizeTemplate(createFallbackModel(fighterDefinition.id)),
      clips: buildClipMap([], runtimeManifest),
      runtimeManifest,
      assetSource: attemptedUrls.join(", "),
      proceduralFallback: true,
    };
  }

  async _getRuntimeManifest(fighterDefinition) {
    if (!this.runtimeManifestCache.has(fighterDefinition.id)) {
      this.runtimeManifestCache.set(fighterDefinition.id, this._loadRuntimeManifest(fighterDefinition));
    }
    return this.runtimeManifestCache.get(fighterDefinition.id);
  }

  async _loadRuntimeManifest(fighterDefinition) {
    const fallbackManifest = validateRiggedRuntimeManifest({
      fighterId: fighterDefinition.id,
      producerHouse: fighterDefinition.runtimeRig.producerHouse,
      sourceModel: fighterDefinition.mirroredSourceFile,
      runtimeGlb: fighterDefinition.mirroredRuntimeFile,
      exportStatus: fighterDefinition.runtimeRig.exportStatus,
      animationSetVersion: fighterDefinition.animationSetVersion,
      requiredClips: fighterDefinition.runtimeRig.requiredClips,
      availableClips: [],
    }, fighterDefinition.id);

    try {
      const response = await fetch(fighterDefinition.runtimeRig.manifestFile, { cache: "no-store" });
      if (!response.ok) {
        return fallbackManifest;
      }
      return validateRiggedRuntimeManifest(await response.json(), fighterDefinition.id);
    } catch {
      return fallbackManifest;
    }
  }

  async _loadScene(url) {
    return new Promise((resolve, reject) => {
      this.loader.load(url, resolve, undefined, reject);
    });
  }
}
