// Where the offline data lives: cache names and URL layout, shared by the service worker and the page. Pure.
export const ASSETS_CACHE = 'haac-assets';
export const DATA_CACHE = 'haac-data';
export const MANIFEST_URL = '/assets/manifest.json';
/** atlas of one model (atlas-male.json, atlas-female.json) */
export const atlasUrl = (model: string) => `/atlas-${model}.json`;
/** data of a manifest without models: the male atlas and the manifest */
export const DATA_URLS = [atlasUrl('male'), MANIFEST_URL];
export const isDataPath = (path: string) => path === MANIFEST_URL || /^\/atlas-(male|female)\.json$/.test(path);
export const modelUrl = (file: string) => `/assets/${file}`;
export const isModelPath = (path: string) => /^\/assets\/[^/]+\.glb$/.test(path);
