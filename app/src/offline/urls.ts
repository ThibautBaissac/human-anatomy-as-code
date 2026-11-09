// Where the offline data lives: cache names and URL layout, shared by the service worker and the page. Pure.
export const ASSETS_CACHE = 'haac-assets';
export const DATA_CACHE = 'haac-data';
export const ATLAS_URL = '/atlas.json';
export const MANIFEST_URL = '/assets/manifest.json';
export const DATA_URLS = [ATLAS_URL, MANIFEST_URL];
/** atlas of one model (atlas-male.json, atlas-female.json) */
export const atlasUrl = (model: string) => `/atlas-${model}.json`;
export const isDataPath = (path: string) => path === ATLAS_URL || path === MANIFEST_URL || /^\/atlas-(male|female)\.json$/.test(path);
export const modelUrl = (file: string) => `/assets/${file}`;
export const isModelPath = (path: string) => /^\/assets\/[^/]+\.glb$/.test(path);
