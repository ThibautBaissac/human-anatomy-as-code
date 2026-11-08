import { test } from 'node:test';
import assert from 'node:assert/strict';
import { offlineStatus } from '../src/offline/offline-state.ts';
import { isIosNotInstalled } from '../src/offline/platform.ts';
import { tabsKeyReducer } from '../src/ui/tabs-model.ts';

const manifest = { kinds: { bone: { file: 'bone.aaaaaaaa.glb', bytes: 600 }, muscle: { file: 'muscle.bbbbbbbb.glb', bytes: 400 } }, totalBytes: 1000 };
const DATA = ['/atlas.json', '/assets/manifest.json'];

test('offlineStatus: nothing cached', () => {
  assert.deepEqual(offlineStatus(manifest, [], false), { state: 'none', cachedBytes: 0, totalBytes: 1000, missing: ['/assets/bone.aaaaaaaa.glb', '/assets/muscle.bbbbbbbb.glb', ...DATA], persisted: false });
});

test('offlineStatus: some models cached is partial, bytes counted', () => {
  const s = offlineStatus(manifest, ['/assets/bone.aaaaaaaa.glb', '/atlas.json'], true);
  assert.equal(s.state, 'partial');
  assert.equal(s.cachedBytes, 600);
  assert.deepEqual(s.missing, ['/assets/muscle.bbbbbbbb.glb', '/assets/manifest.json']);
  assert.equal(s.persisted, true);
});

test('offlineStatus: every model plus atlas and manifest is complete; foreign entries ignored', () => {
  const s = offlineStatus(manifest, ['/assets/bone.aaaaaaaa.glb', '/assets/muscle.bbbbbbbb.glb', ...DATA, '/assets/old.11111111.glb'], false);
  assert.equal(s.state, 'complete');
  assert.equal(s.cachedBytes, 1000);
  assert.deepEqual(s.missing, []);
});

test('offlineStatus: all models but no atlas is still partial', () => {
  assert.equal(offlineStatus(manifest, ['/assets/bone.aaaaaaaa.glb', '/assets/muscle.bbbbbbbb.glb'], false).state, 'partial');
});

test('isIosNotInstalled: Safari on iPhone outside the home screen', () => {
  const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1';
  assert.equal(isIosNotInstalled({ userAgent: iphone, standalone: false, maxTouchPoints: 5 }), true);
  assert.equal(isIosNotInstalled({ userAgent: iphone, standalone: true, maxTouchPoints: 5 }), false);
});

test('isIosNotInstalled: iPad reporting a Mac user agent counts, a real Mac and Android do not', () => {
  const mac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15';
  assert.equal(isIosNotInstalled({ userAgent: mac, standalone: false, maxTouchPoints: 5 }), true);
  assert.equal(isIosNotInstalled({ userAgent: mac, standalone: undefined, maxTouchPoints: 0 }), false);
  assert.equal(isIosNotInstalled({ userAgent: 'Mozilla/5.0 (Linux; Android 15; Pixel 7) Chrome/140 Mobile', standalone: undefined, maxTouchPoints: 5 }), false);
});

test('tabsKeyReducer: arrows wrap around, Home/End jump, other keys do nothing', () => {
  const tabs = ['tree', 'info', 'controls'];
  assert.equal(tabsKeyReducer(tabs, 'tree', 'ArrowRight'), 'info');
  assert.equal(tabsKeyReducer(tabs, 'controls', 'ArrowRight'), 'tree');
  assert.equal(tabsKeyReducer(tabs, 'tree', 'ArrowLeft'), 'controls');
  assert.equal(tabsKeyReducer(tabs, 'info', 'Home'), 'tree');
  assert.equal(tabsKeyReducer(tabs, 'info', 'End'), 'controls');
  assert.equal(tabsKeyReducer(tabs, 'info', 'x'), 'info');
});
