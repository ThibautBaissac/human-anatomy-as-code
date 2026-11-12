// Where the offline data lives: cache names and URL layout, shared by the service worker and the page. Pure.
export const ASSETS_CACHE = 'haac-assets';
export const DATA_CACHE = 'haac-data';
/** path the app is served under: '/' locally, '/human-anatomy-as-code/' on GitHub Pages; '/' outside Vite (unit tests) */
export const BASE: string = import.meta.env?.BASE_URL ?? '/';
export const MANIFEST_URL = `${BASE}assets/manifest.json`;
/** atlas of one model (atlas-male.json, atlas-female.json) */
export const atlasUrl = (model: string) => `${BASE}atlas-${model}.json`;
/** data of a manifest without models: the male atlas and the manifest */
export const DATA_URLS = [atlasUrl('male'), MANIFEST_URL];
export const isDataPath = (path: string) => path === MANIFEST_URL || path === atlasUrl('male') || path === atlasUrl('female');
export const modelUrl = (file: string) => `${BASE}assets/${file}`;
export const isModelPath = (path: string) => path.startsWith(modelUrl('')) && /^[^/]+\.glb$/.test(path.slice(modelUrl('').length));
