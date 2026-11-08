# Offline PWA with large 3D assets (200 MB to 1 GB glTF/KTX2): constraints and architecture, as of Nov 2026

Research date: 2026-11-08. Primary sources: WebKit blog, MDN (page and browser-compat-data), developer.chrome.com, GitHub release APIs. Secondary/blog sources are marked as such.

## Q1. Storage quotas, eviction, persist() and estimate() per browser (2026)

### Takeaway
On paper, 1 GB fits on every current engine. Chrome/Edge allow up to 60% of disk per origin. Firefox best-effort allows min(10% of disk, 10 GiB), and persistent allows up to 50%. Safari 17+ (macOS 14 / iOS 17+) allows about 60% of disk per origin in Safari and in Home Screen web apps, and 15% in other WebKit apps (WKWebView). The real risk is eviction, not quota. Best-effort data is evicted under storage pressure (LRU, whole origin at once). In a Safari tab, data is also wiped after 7 days of browser use without interaction. Home Screen web apps keep their own day counter, which advances only with use of the app.

### Cited Findings
- **Chrome / Edge (Chromium):** best-effort and persistent both allow up to 60% of total disk per origin (for example 600 GiB on a 1 TiB disk). The browser-wide cap is 80% of disk. — [MDN Storage quotas and eviction criteria, last modified 2026-01-05](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)
- **Firefox:** best-effort allows the smaller of 10% of disk or 10 GiB (an eTLD+1 "group limit"). Persistent allows up to 50% of disk, capped at 8 TiB, and is not subject to the group limit. Example on a 500 GiB disk: 10 GiB best-effort, 250 GiB persistent. — [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)
- **Safari 17.0+ (iOS 17, iPadOS 17, macOS Sonoma) origin quota:** up to 60% of total disk for browser apps and up to 15% for other apps (embedded WebViews). Cross-origin frames get 10% of the main frame's quota. Safari 17 no longer prompts the user for more space. — [WebKit blog "Updates to Storage Policy", 2023-08-10](https://webkit.org/blog/14403/updates-to-storage-policy/)
- **Safari overall quota (all origins combined):** 80% of disk for browser apps, 20% for other apps. Exceeding it triggers eviction. — [WebKit blog, 2023-08-10](https://webkit.org/blog/14403/updates-to-storage-policy/)
- **Home Screen web apps / Dock web apps:** a standalone web app has the same origin quota and overall quota as in the browser app. — [WebKit blog, 2023-08-10](https://webkit.org/blog/14403/updates-to-storage-policy/); confirmed by [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)
- **Before Safari 17 (outdated, pre-Sept 2023):** each origin started at 1 GiB, then the user was prompted to allow more. — [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria). The web.dev "Storage for the web" article still says Safari allows about 1 GB, which is stale. — [web.dev](https://web.dev/articles/storage-for-the-web)
- **WebKit eviction triggers:** the overall quota is exceeded, the system is under storage pressure, or the site has not been interacted with for some time (ITP). Eviction is per origin, LRU, where "last use" means the last user interaction or the last storage operation. An origin is excluded if it has an active page or is in persistent mode. — [WebKit blog](https://webkit.org/blog/14403/updates-to-storage-policy/)
- **Safari proactive eviction:** with cross-site tracking prevention on, an origin with no click or tap in the last 7 days of browser use has all script-created data deleted (IndexedDB, Cache, service worker registrations, and so on). Server-set cookies are exempt. — [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)
- **7-day cap and Home Screen apps:** WebKit stated (2020) that apps added to the Home Screen "are not part of Safari and thus have their own counter of days of use", which matches actual use of the web app. Script-written cookies remain capped at a 7-day expiry, per John Wilander in 2022. — [WebKit Bugzilla 237350 (2022)](https://bugs.webkit.org/show_bug.cgi?id=237350); [The Register, 2020-03-26](https://www.theregister.com/2020/03/26/apple_relax_were_not_totally/); [webkit-unassigned list, 2021](https://lists.webkit.org/pipermail/webkit-unassigned/2021-August/990445.html)
- **Eviction is all-or-nothing per origin** (IndexedDB, Cache and the rest go together). Persistent origins are skipped under pressure. — [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)
- **persist():** Firefox shows a permission prompt. Chrome, Edge and Safari decide automatically from engagement heuristics, with no prompt. — [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria). WebKit grants persistence heuristically, for example when the site is opened as a Home Screen web app. — [WebKit blog](https://webkit.org/blog/14403/updates-to-storage-policy/)
- **estimate():** in WebKit it returns usage and the origin quota. The quota is an upper bound, not a guarantee, so code must still handle `QuotaExceededError`. The value can vary with usage and visit frequency, as an anti-fingerprinting measure. — [WebKit blog](https://webkit.org/blog/14403/updates-to-storage-policy/)
- **API support** (MDN browser-compat-data, main branch, fetched 2026-11-08): `StorageManager.persist` is supported since Chrome 55, Firefox 57 and Safari 15.2. `StorageManager.estimate` is supported since Chrome 61, Firefox 57 and Safari 17 (iOS mirrors Safari). — [mdn/browser-compat-data api/StorageManager.json](https://github.com/mdn/browser-compat-data/blob/main/api/StorageManager.json)
- **Conflicting secondary claims:** one blog says Home Screen apps have a storage container separate from Safari's ([progressivewebapps.com FAQ](https://progressivewebapps.com/reference/faq/)). Others cite a "~50 MB cache cap" on iOS ([tappwa](https://tappwa.com/blog/ios-pwa-limitations-2026)). The 50 MB figure is an outdated myth from the 2018-era Cache API limit and contradicts WebKit's own 2023 policy. Prefer WebKit and MDN.

### Inferences
- For 200 MB to 1 GB, quota is not the blocker on any target. On a 64 GB iPhone with 10 GB free, 60% of total disk is more than enough. The binding limit is free disk space: WebKit evicts under "storage pressure".
- Firefox best-effort (10 GiB) is fine for 1 GB.
- iOS Safari tab usage is risky. Seven days of Safari use without visiting the site wipes the whole 1 GB. The UX should push "Add to Home Screen" on iOS, and call `persist()` after install and after the first pack download.
- Always design for re-download: an integrity check on startup (a manifest of hashes compared against stored entries), with graceful partial-loss handling.

### Gaps
- No 2024-2026 primary WebKit source re-states the Home Screen app 7-day counter exemption. The latest explicit statements are from 2020-2022. Must be tested on iOS 26/27.
- No public data on how often WebKit grants `persist()` to Home Screen apps, or whether a granted persistence survives iOS "Offload"/low-storage cleanup.
- Safari 26.x and 27 release notes (2025-2026) mention no quota-policy changes ([Safari 27 beta post, 2026-06-08](https://webkit.org/blog/17967/news-from-wwdc26-webkit-in-safari-27-beta/)). The 2023 policy is assumed to be still current.

## Q2. Cache API vs IndexedDB vs OPFS for large binary assets

### Takeaway
Use the Cache API (for HTTP-addressable files served via the service worker) or OPFS (for file-like random access and streaming writes). Avoid IndexedDB for big binaries: it has serialization overhead, and Chrome limits a single Blob/ArrayBuffer to 2 GB. All three share the same origin quota and evict together. On iOS, OPFS `createSyncAccessHandle` has been available since Safari 15.2, and `createWritable` arrived only in Safari 26 (Sept 2025).

### Cited Findings
- **Chrome team recommendation** for caching large AI models (hundreds of MB to GB): prefer the Cache API, for quick access, shorter load times and responsiveness. IndexedDB is called the worst choice, because it serializes on write and deserializes on read. OPFS is a viable alternative with performant write access. The Cache API works without a service worker, from the main thread or a worker, by storing synthetic `Response` objects under fake URLs. — [developer.chrome.com "Cache AI models in the browser"](https://developer.chrome.com/docs/ai/cache-models) (undated, 2024-era)
- The same article recommends `Cache-Control: public, max-age=31536000, immutable` with a new URL per updated file. It suggests the Storage Buckets API with `persisted: true` where supported (Chromium only), and the `fetch-in-chunks` library for parallel chunked downloads with a progress callback. — [developer.chrome.com](https://developer.chrome.com/docs/ai/cache-models)
- **OPFS support** (MDN BCD, fetched 2026-11-08):
  - `navigator.storage.getDirectory`: Chrome 86, Firefox 111, Safari 15.2
  - `FileSystemFileHandle.createSyncAccessHandle` (worker-only, fastest path): Chrome 102, Firefox 111, Safari 15.2
  - `createWritable`: Chrome 86, Firefox 111, **Safari 26**
  - iOS mirrors desktop Safari for all three.
  - Sources: [BCD FileSystemFileHandle.json](https://github.com/mdn/browser-compat-data/blob/main/api/FileSystemFileHandle.json); MDN marks `createWritable` "Baseline 2025 newly available" ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/FileSystemFileHandle/createWritable))
- Older docs saying `createWritable` "is not supported in Safari" (for example RxDB) are outdated since Safari 26. — [RxDB OPFS docs](https://rxdb.info/rx-storage-opfs.md)
- Safari 27 beta (June 2026) fixes `FileSystemDirectoryHandle.resolve()` and `removeEntry()` bugs, which signals that OPFS was still maturing in WebKit in 2026. — [WebKit blog, 2026-06-08](https://webkit.org/blog/17967/news-from-wwdc26-webkit-in-safari-27-beta/)
- **IndexedDB** overhead on large ArrayBuffers makes it significantly slower than OPFS and the Cache API. Vendor benchmark: OPFS reads up to 4x faster than IndexedDB. — [Lumafield engineering blog](https://barndoors.lumafield.com/3x-faster-project-loads-with-the-origin-private-file-system/); [RxDB](https://rxdb.info/rx-storage-opfs.md) (vendor claim)
- **Cache API downside:** getting a cached entry's size is awkward (reading the body), while OPFS gives `file.size` directly. — [Lumafield](https://barndoors.lumafield.com/3x-faster-project-loads-with-the-origin-private-file-system/)
- **Chrome 2 GB per-Blob/ArrayBuffer limit** blocks loading large map archives into IndexedDB or memory. The workaround is chunking. — [protomaps/PMTiles discussion #100](https://github.com/protomaps/PMTiles/discussions/100)

### Inferences
- **For glTF/KTX2 served as discrete hashed files:** the Cache API is the natural fit. A service worker `fetch` handler serves `/assets/<hash>.glb` cache-first, so three.js `GLTFLoader`/`KTX2Loader` code is unchanged online and offline. Each file is typically 1-50 MB, well under the 2 GB blob limit.
- **OPFS is worth it only if:**
  - you pack assets into large archives (for example a single pack file with random-access reads, PMTiles-style), or
  - you need resumable, append-style writes (write chunk N at an offset via a sync access handle in a worker; Safari 15.2+).
- Mixing is fine: Cache API for assets plus IndexedDB for small metadata (pack manifest, installed versions, download state).

### Gaps
- No independent 2025-2026 benchmark of Cache API vs OPFS read throughput on iOS Safari for 10-100 MB files.
- Unknown whether Cache API `put()` of a streamed 100 MB+ Response holds the whole body in memory on iOS. This matters for older iPhones with low RAM. Needs testing.

## Q3. Service worker tooling, precache vs runtime caching, range requests, Background Fetch, progress, resumable downloads

### Takeaway
Workbox is alive but in maintenance mode: v7.4.0 (Nov 2025) and v7.4.1 (May 2026) are "critical dependency updates", and the repo was still pushed in Oct 2026. Serwist (Workbox fork, v9.5.12, July 2026) is the more actively developed alternative. vite-plugin-pwa v2.0.0 (Oct 2026) still builds on Workbox. Do not precache the 3D assets. Precache only the app shell, and download content packs with app-controlled code that writes to Cache/OPFS. Background Fetch is Chromium-only (Chrome 74+), so it is not available on Safari or Firefox.

### Cited Findings
- **Workbox releases:**
  - v7.3.0 (2024-10-29)
  - v7.4.0 (2025-11-19, release notes: "Critical dependency updates.")
  - v7.4.1 (2026-05-05)
  - Repo not archived, last push 2026-10-29.
  - Source: [GitHub GoogleChrome/workbox releases](https://github.com/GoogleChrome/workbox/releases) (via GitHub API, 2026-11-08)
- Workbox development stalled around 2023-2024, prompting the Serwist fork. Serwist reports that "a team at Google will resume maintaining Workbox", and Serwist will continue separately. — [serwist discussion #120](https://github.com/serwist/serwist/discussions/120)
- **Serwist:** latest `serwist@9.5.12` (2026-07-22). Integrations include `@serwist/vite`, `@serwist/next`, `@serwist/nuxt`, `@serwist/svelte` and `@serwist/webpack-plugin`. — [GitHub serwist/serwist releases](https://github.com/serwist/serwist/releases); [openapps.pro listing](https://openapps.pro/packages/serwist)
- **vite-plugin-pwa:** v1.2.0 (2025-11-27), v1.3.0 (2026-05-05), v2.0.0 (2026-10-03, mostly a peer-dependency bump for `@vite-pwa/assets-generator` ^2.0.0). It still uses Workbox (`generateSW` / `injectManifest`). Maintainers were unsure whether Workbox would be deprecated. — [GitHub vite-pwa releases](https://github.com/vite-pwa/vite-plugin-pwa/releases); [PR #634 comment](https://www.github.com/vite-pwa/vite-plugin-pwa/pull/634)
- **Background Fetch API (`BackgroundFetchManager.fetch`):** Chrome 74+, Firefox no, Safari no, iOS no. — [BCD BackgroundFetchManager.json](https://github.com/mdn/browser-compat-data/blob/main/api/BackgroundFetchManager.json)
- iOS has no Background Sync, Periodic Background Sync or Background Fetch, so a closed PWA cannot continue downloads. — [progressivewebapps.com iOS guide](https://progressivewebapps.com/platforms/ios-safari) (secondary); [MobiLoud 2026 guide](https://www.mobiloud.com/blog/progressive-web-apps-ios/) (secondary)
- **Safari 27 beta adds the Service Worker Static Routing API**, which lets the SW declare rules so the browser bypasses it for some requests. Chrome already had it. — [WebKit blog, 2026-06-08](https://webkit.org/blog/17967/news-from-wwdc26-webkit-in-safari-27-beta/)
- Safari 26.0 added automatic inspection and pausing of service workers in Web Inspector, including for Home Screen web apps. Safari 26.6 auto-unregisters registrations whose main script is missing. — [WebKit Features in Safari 26.0](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/); [Safari 26.6](https://webkit.org/blog/18178/webkit-features-for-safari-26-6/)
- **Chunk sizing:** keep files in the 10-100 MB range for reliable mobile downloads. A 500 MB single file over 3G/4G can fail. — [maplibre-offline-pmtiles README via pkgstats](https://www.pkgstats.com/pkg:@makina-corpus/maplibre-offline-pmtiles)
- **Progress:** `fetch-in-chunks` provides parallel ranged chunk downloads plus a `progressCallback(downloaded, total)`. — [developer.chrome.com](https://developer.chrome.com/docs/ai/cache-models)

### Inferences
- **Precache = app shell only** (JS/CSS/HTML/WASM decoders such as Draco/Meshopt/Basis transcoder, the UI, and a small default low-poly model of a few MB). Workbox/Serwist precaching downloads everything at SW install. A 1 GB precache would block installation, fail atomically, and re-download on every manifest change.
  - Background knowledge (not re-verified this session): Workbox's default `maximumFileSizeToCacheInBytes` is 2 MiB, which signals precache is not designed for big files.
- **Content packs:** a page-side (or dedicated worker) download manager:
  - fetch `packs/<pack>/manifest.<hash>.json`
  - for each file not already in the cache, `fetch()`, stream it through a `ReadableStream` reader to count bytes for progress, then `cache.put(url, response)`
  - record per-file completion in IndexedDB
  - Resumability comes for free at file granularity: restart skips completed files. For files over 50 MB, use HTTP `Range` requests and OPFS offset writes.
- **SW runtime route:** `CacheFirst` on `/assets/` (hashed, immutable), with a dedicated cache name per pack (for example `pack-muscular-v3`). Avoid Workbox `ExpirationPlugin` on pack caches: user-installed packs must not expire.
- **Range requests:** only needed if you stream media (video/audio) or use random-access archives. Glb/ktx2 files are fetched whole, so cache-first with full responses suffices.
  - Background knowledge: Workbox has a `workbox-range-requests` plugin for serving 206 responses from cached full responses.
- **Tool choice:**
  - Vite stack: `vite-plugin-pwa` in `injectManifest` mode (custom SW, Workbox modules) or `@serwist/vite`. Both are viable in late 2026.
  - Serwist is a safer bet for active development. Workbox is stable but only receives dependency updates.
  - The pack downloader is custom code in both cases.
- **Chrome/Edge (Android, desktop):** progressive enhancement with Background Fetch lets a large pack keep downloading after the tab closes, with a browser-provided progress UI. Fall back to in-page download elsewhere. On iOS, tell users to keep the app open, and use the Screen Wake Lock API if available (not verified here).

### Gaps
- No official Google/Workbox statement found on Workbox's 2026 roadmap. The "Google team resumes maintenance" claim is secondhand.
- vite-plugin-pwa docs pages were not fetched this session. Config details (maximumFileSizeToCacheInBytes, globIgnores) should be checked at https://vite-pwa-org.netlify.app.

## Q4. Optional content packs, versioning, delta updates, cache busting

### Takeaway
Ship content-addressed (hashed) asset files plus a small versioned manifest per pack. An update downloads only the files whose hash changed, which gives file-level deltas. True binary diffing of glb/ktx2 is not standard on the web and is rarely worth it if assets are split per anatomical structure or system.

### Cited Findings
- Use immutable caching with long `max-age` and a new URL for each updated file. — [developer.chrome.com cache-models](https://developer.chrome.com/docs/ai/cache-models)
- Large offline datasets are commonly split into chunks or multiple archives, both to stay under the 2 GB blob limit and for mobile reliability. — [PMTiles discussion #100](https://github.com/protomaps/PMTiles/discussions/100); [maplibre-offline-pmtiles](https://www.pkgstats.com/pkg:@makina-corpus/maplibre-offline-pmtiles)
- WebKit eviction is all-or-nothing per origin. Splitting into multiple caches does not protect individual packs from eviction. — [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)

### Inferences
- **Suggested layout:**
  - `/app/` holds the hashed shell, precached by the SW.
  - `/catalog.json` is network-first (falls back to cache), listing packs with `{id, version, sizeBytes, manifestUrl}`.
  - `/packs/<id>/manifest.<hash>.json` lists files `{path, sha256, bytes}`.
  - `/assets/<sha256-prefix>.glb|.ktx2` are content-addressed and shared across packs, so a bone mesh used by "skeletal" and "female model" downloads once.
- **Update flow:**
  - On startup (online), fetch `catalog.json` and compare against installed versions in IndexedDB.
  - Diff the file lists: download new hashes, then delete orphaned hashes once no installed pack references them (reference counting in IndexedDB).
  - Swap the manifest pointer atomically only after all files are present, so the app never renders a half-updated pack.
- **Pre-download check:** compute `estimate()` headroom against pack `sizeBytes`, add a safety margin (for example 1.2x), and show the size up front ("Muscular system - 180 MB").
- **Split granularity:** per body system, per sex model, and per LOD (low-poly default always cached, high-res optional). This keeps individual files at 5-50 MB and enables file-level deltas.
- **Integrity:** verify sha256 via `crypto.subtle.digest` after download. Cost is acceptable at 50 MB per file. Re-verify a sample on startup to detect eviction or partial loss.

### Gaps
- No found source documents binary delta-patching (bsdiff-style) for glTF/KTX2 in browsers. Assume file-level deltas.

## Q5. iOS-specific limits for installed PWAs (2026), EU DMA, and Capacitor/Tauri wrapping

### Takeaway
On iOS 26+, any site added to the Home Screen opens as a web app with no manifest requirement. It gets the same about 60% disk quota as Safari and has its own usage-day counter. There is no background download. In the EU, Home Screen web apps survived the 2024 DMA episode but remain WebKit-only in practice. A Capacitor wrapper brings App Store distribution and native file storage outside the web-storage eviction regime (with a native download plugin), but WKWebView inside a non-browser app gets only 15% of disk for web storage. That is still far more than 1 GB.

### Cited Findings
- **iOS/iPadOS 26:** every website added to the Home Screen opens as a web app by default, with zero installability requirements (no manifest needed). — [WebKit Features in Safari 26.0](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/)
- The Safari 27 beta (WWDC26, June 2026) has no Home Screen web app or quota changes. Safari 26.6 shipped 2026-07-27. — [WebKit blog Safari 27 beta](https://webkit.org/blog/17967/news-from-wwdc26-webkit-in-safari-27-beta/); [Apple Safari release notes](https://developer.apple.com/documentation/safari-release-notes)
- **EU DMA (2024):** Apple announced that iOS 17.4 would remove Home Screen web apps in the EU, then reversed course (March 2024), keeping them WebKit-based. — [MacRumors 2024-02-15](https://www.macrumors.com/2024/02/15/ios-17-4-web-apps-removed-apple/); [Engadget](https://www.engadget.com/apple-confirms-home-screen-web-apps-will-no-longer-work-on-european-ios-devices-112527560.html)
- iOS 18.2 (Oct 2024 reporting) allows EU third-party browsers with their own engines to create Home Screen web apps. Open Web Advocacy notes remaining contractual barriers, such as the ban on dual-engine browsers. — [MacRumors 2024-10-24](https://macrumors.com/2024/10/24/ios-18-2-eu-third-party-browser-web-apps); [Open Web Advocacy](https://open-web-advocacy.org/blog/apple-implements-six-of-owas-dma-compliance-requests/)
- WKWebView inside a non-browser app gets an origin quota of up to 15% of disk and an overall quota of 20%. — [WebKit blog](https://webkit.org/blog/14403/updates-to-storage-policy/)
- **Capacitor large files:** the stock `@capacitor/filesystem` `writeFile`/`readFile` uses base64 strings. Old benchmarks (iPhone 6) show out-of-memory errors at about 32 MB and WebView crashes on large writes. Use blob-capable or chunked plugins (capacitor-blob-writer, capacitor-file-chunk with Range support) or Capawesome's file manager. — [capacitor-blob-writer README](https://unpkg.com/capacitor-blob-writer@1.1.20/README.md); [capacitor-file-chunk](https://www.npmjs.com/package/capacitor-file-chunk); [Capawesome file handling guide](https://capawesome.io/blog/capacitor-file-handling-guide/)
- Capawesome docs say the 7-day script-writable deletion applies when running in a browser, not in native Capacitor apps. — [Capawesome file manager docs](https://capawesome.io/docs/sdks/capacitor/file-manager/)

### Inferences
- **The PWA alone is viable on iOS for 1 GB if the user installs to the Home Screen.** Remaining risks:
  - eviction under low-disk pressure, since `persist()` is heuristic
  - no background download, so a 1 GB download must happen with the app open; split into packs so a 5-minute session completes something
  - the iOS-side memory budget for WebGL/WebGPU decode, which is a separate topic
- **Wrap with Capacitor (or Tauri 2 mobile) if:**
  - App Store discoverability or institutional MDM deployment matters (medical schools)
  - or durable storage guarantees are required: download with native code (URLSession background transfers keep downloading when the app is suspended) into the app's Application Support directory, and serve to the WebView via a custom scheme or Capacitor's local server
  - This sidesteps WebKit quota and ITP eviction entirely.
  - Keep the same web codebase. The PWA remains the desktop and Android channel.
- Apple App Store Guideline 4.2 (minimum functionality) can reject thin web wrappers. A 3D atlas with offline content and native downloads should pass, but this is not verified in this session.
- **EU:** do not rely on non-WebKit engines for Home Screen apps. Treat Safari-installed web apps as the iOS PWA path in the EU too.

### Gaps
- No 2025-2026 primary source found on EU Home Screen web app status after iOS 18.2 (for example whether any third-party engine browser actually ships web app install in 2026).
- No current, official Capacitor or Apple doc fetched on native background downloads (URLSession background session) from Capacitor plugins. Tauri 2 mobile storage and download plugins were not researched.
- No current (iPhone 15+/iOS 26) benchmark of Capacitor large-file writes. Cited crash numbers are from old hardware.

## Q6. Real-world examples of offline PWAs with large assets

### Takeaway
There are few published case studies at the 1 GB scale. The closest are offline-map PWAs (PMTiles in OPFS) and Kiwix PWA (multi-GB ZIM archives in OPFS). The common patterns are OPFS or Cache for big archives, chunked or resumable downloads, and SW caching for small dynamic resources.

### Cited Findings
- **maplibre-offline-pmtiles:**
  - stores PMTiles archives in OPFS with quota management
  - claims near-native performance reading a 500 MB file from OPFS
  - recommends 10-100 MB files for mobile download reliability
  - lets the SW cache sprites and glyphs
  - Source: [pkgstats listing/README](https://www.pkgstats.com/pkg:@makina-corpus/maplibre-offline-pmtiles)
- **PMTiles community:** IndexedDB storage of offline maps hits Chrome's 2 GB per-blob limit, and the workaround is chunking. — [protomaps/PMTiles discussion #100](https://github.com/protomaps/PMTiles/discussions/100)
- **Kiwix PWA** uses OPFS for large ZIM archives (offline Wikipedia, multi-GB). Quota and export limitations remain on some browsers. — [TypeScript Daily summary](https://typescript-daily.beehiiv.com/p/summary-unlocking-offline-access-kiwix-pwas-groundbreaking-file-management) (secondary)
- **gps-map PWA:** the SW precaches the app shell, and map tiles go in IndexedDB. This is the older pattern affected by the blob limit. — [bmcbride/gps-map](https://github.com/bmcbride/gps-map)
- **Lumafield** (industrial CT/3D viewer): switching project loading to OPFS gave 3x faster loads. — [Lumafield engineering blog](https://barndoors.lumafield.com/3x-faster-project-loads-with-the-origin-private-file-system/)

### Inferences
- Photopea and Squoosh are offline-capable PWAs, but their offline payload is the app itself (tens of MB). They show SW app-shell caching, not GB-scale content handling. Neither was researched here.
- Lumafield is the closest analogue (heavy 3D in the browser) and supports OPFS for large binary scene data if you move to packed archives.

### Gaps
- No published post-mortem found for a 3D anatomy or medical viewer PWA with GB-scale offline content. No public data on real-world eviction rates for large-storage PWAs on iOS.
