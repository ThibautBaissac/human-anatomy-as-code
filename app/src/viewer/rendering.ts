// Lights, environment, tone mapping and the ambient-occlusion pipeline of the 3D view.
import * as THREE from 'three/webgpu';
import { builtinAOContext, mrt, normalView, pass, screenUV } from 'three/tsl';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/** `high`: ambient occlusion on; `low`: direct rendering (phones, slow GPUs). */
export type Quality = 'high' | 'low';

/**
 * Soft studio lighting: a blurred room as environment (indirect light, reflections), a key light from above and
 * in front, a headlight that follows the camera. Neutral tone mapping keeps the kind colours close to their values.
 */
export function setupLighting(renderer: THREE.WebGPURenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 0.95;
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  // low: the environment fills the shadows, the key light shapes the forms
  scene.environmentIntensity = 0.35;
  pmrem.dispose();
  const key = new THREE.DirectionalLight(0xfff4e8, 2.4);
  key.position.set(0.6, -1, 1.6); // front-left of the subject, above (BodyParts3D frame: −y front, +z up)
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xe8f0ff, 0.5);
  rim.position.set(-0.8, 1, 0.6);
  scene.add(rim);
  camera.add(new THREE.DirectionalLight(0xffffff, 0.35));
}

/**
 * Ground-truth ambient occlusion (GTAO) at half resolution, applied to the indirect light of opaque materials.
 * The depth and normal pre-pass leaves the transparent batches out: ghosted layers cast no occlusion.
 */
export function aoPipeline(renderer: THREE.WebGPURenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera): THREE.RenderPipeline {
  const prePass = pass(scene, camera);
  prePass.transparent = false;
  prePass.setMRT(mrt({ output: normalView }));
  const aoPass = ao(prePass.getTextureNode('depth'), prePass.getTextureNode(), camera);
  aoPass.resolutionScale = 0.5;
  // world units are millimetres: occlusion gathered within ~4 cm, a thin layer does not hide what is behind it
  aoPass.radius.value = 40;
  aoPass.thickness.value = 12;
  const scenePass = pass(scene, camera);
  scenePass.contextNode = builtinAOContext(aoPass.getTextureNode().sample(screenUV).r);
  const pipeline = new THREE.RenderPipeline(renderer);
  pipeline.outputNode = scenePass;
  return pipeline;
}
