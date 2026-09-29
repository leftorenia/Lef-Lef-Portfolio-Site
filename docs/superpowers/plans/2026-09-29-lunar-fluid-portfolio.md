# Lunar Fluid Portfolio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing static cosmic background with a responsive WebGL2 moonlit cloud experience and add opt-in procedurally generated ambient audio while preserving every verified portfolio page and content item.

**Architecture:** Keep the dependency-free GitHub Pages structure. A new `lunar-field.js` module owns page presets, pointer trails, quality control, and lifecycle; `lunar-shaders.js` owns GLSL source generation; `ambient-sound.js` owns the four-state Web Audio UI and graph. Semantic HTML and CSS remain the complete readable fallback, while the existing Works preview stays an independent Canvas 2D enhancement.

**Tech Stack:** HTML5, CSS3, browser ES modules, WebGL2 / GLSL ES 3.00, Web Audio API, Canvas 2D, Node.js built-in test runner

**Spec:** `docs/superpowers/specs/2026-09-29-lunar-fluid-portfolio-design.md`

## Global Constraints

- Keep exactly `PROFILE / WORKS / CONTACT` in public navigation and preserve `about.html` as an `index.html` compatibility redirect.
- Preserve the current Profile copy and four interests, one `COSMO EFFECTS` work plus six inert `COMING SOON` cards, its detail copy/tags, all four Contact links, metadata, and footer copy.
- Use only generated visuals and browser-generated audio; add no raster image, audio file, reference-site asset, external library, CDN, remote font, build step, CMS, analytics, or invented portfolio claim.
- Use WebGL2 only; WebGL2 or shader failure falls back to the CSS moonlit background without a WebGL1 or Canvas 2D background implementation.
- Cap device pixel ratio at `1.5`; use internal render scales `0.75 / 0.625 / 0.5` for High / Medium / Low.
- Keep the shared background Canvas `aria-hidden="true"` and `pointer-events: none`; all content and navigation must work without JavaScript.
- Do not autoplay audio. Persist intent at `lef-lef-portfolio:ambient-enabled`; maximum Master Gain is `0.06`.
- Honor live `prefers-reduced-motion`, resize, visibility, context loss/restoration, and cleanup.
- Keep all page, stylesheet, script, module-import, and navigation URLs relative for `https://leftorenia.github.io/Lef-Lef-Portfolio-Site/`.

## Review Focus

- WebGL2 unavailable or context lost: HTML remains readable, `.lunar-fallback` stays visible, animation stops, and restoration creates one renderer only; Task 2 and Task 3 test these paths.
- Rapid resize, high-DPR mobile, and slow frames: buffers stay finite and capped, quality downgrades once after 90 slow frames, and no horizontal overflow appears; Task 2, Task 3, and Task 6 own these checks.
- Stored audio intent without a user gesture: no `AudioContext` is created, UI says `START SOUND`, and one click can retry after a transient rejection; Task 4 tests the full state graph.
- Repeated Sound toggles and tab visibility changes: base nodes and schedulers never duplicate, fades remain finite and at or below `0.06`, and destroy disconnects everything; Task 4 tests these lifecycle failures.
- Nested GitHub Pages routes: every `href`, `src`, and module import resolves from the page that owns it, especially `works/cosmo-effects/index.html`; Task 1 and Task 6 test the repository subpath.

---

### Task 1: Establish the Lunar Reverie HTML and CSS fallback shell

**Files:**
- Modify: `tests/site-structure.test.mjs:27-249`
- Modify: `tests/style-contract.test.mjs:15-97`
- Modify: `index.html:1-79`
- Modify: `works.html:1-141`
- Modify: `contact.html:1-68`
- Modify: `works/cosmo-effects/index.html:1-98`
- Modify: `assets/css/style.css:1-1295`
- Create: `assets/js/lunar-field.js` (temporary no-op shell; Task 2 supplies the renderer)
- Create: `assets/js/ambient-sound.js` (temporary no-op shell; Task 4 supplies the audio state machine)

**Interfaces:**
- Consumes: existing semantic content, routes, `.work-preview`, and three-page navigation.
- Produces: `#lunar-field`, `.static-nebula.lunar-fallback`, `body[data-page]`, `[data-sound-toggle]`, `.hero-status`, and script references consumed by Tasks 2–5.

- [ ] **Step 1: Record the current baseline failure**

Run: `node --test tests/site-structure.test.mjs tests/style-contract.test.mjs`

Expected: exactly the known Profile title and `brand-name` assertions fail before product changes.

- [ ] **Step 2: Add failing HTML contracts for the approved shell**

In `tests/site-structure.test.mjs`, add `all primary pages expose Lunar Reverie controls and relative modules`. Assert:

```js
assert.match(pages['index.html'], /<title>PROFILE — れふれふ<\/title>/i);
assert.match(pages['index.html'], /class="brand-name"[^>]*>LEFLEF<\/span>/i);
for (const html of [...Object.values(pages), read(detailFile)]) {
  assert.match(html, /class="[^"]*lunar-fallback[^"]*"/i);
  assert.match(html, /data-sound-toggle[^>]*aria-pressed="false"/i);
  assert.match(html, /ambient-sound\.js/i);
  assert.match(html, /lunar-field\.js/i);
  assert.doesNotMatch(html, /cosmic-field\.js/i);
}
assert.match(pages['index.html'], /class="hero-status"/i);
assert.match(pages['index.html'], /COSMO EFFECTS/i);
```

Update the local-reference assertion so `src` values on the nested detail page resolve relative to that file and no public file contains `(?:href|src)="/`.

- [ ] **Step 3: Add failing style contracts for the new composition**

In `tests/style-contract.test.mjs`, replace the old cosmic palette/masthead expectations with exact checks for `#030815`, `#08152d`, `#284d86`, `#6d91c9`, `#bed6f6`, and `#eef4ff`; require hooks for `#lunar-field`, `.lunar-fallback`, `.hero-status`, `.sound-toggle`, `.hero-moon-note`, and a desktop one-row header. Keep existing responsive Works, focus-visible, overflow, and reduced-motion contracts.

- [ ] **Step 4: Run the focused tests and confirm the new failures**

Run: `node --test tests/site-structure.test.mjs tests/style-contract.test.mjs`

Expected: FAIL for missing Lunar Reverie hooks, sound controls, and module paths.

- [ ] **Step 5: Implement the semantic shell and static fallback**

Update all four content pages without changing verified copy. Use a one-row brand-left/nav-right masthead on desktop, the approved 40/60 Profile hero, a bottom `.hero-status` containing the inert Sound button, `COSMO EFFECTS` link, and scroll label, plus relative `lunar-field.js` and `ambient-sound.js` script paths. Keep Works at seven cards, Contact at four destinations, and detail metadata intact. Add empty safe ES modules at both new script paths so every public reference resolves during this independently testable task; they must not start rendering or audio.

- [ ] **Step 6: Restyle the site around Lunar Reverie**

Rework `assets/css/style.css` using the spec palette, 16px minimum body text, 14px regular control labels, dark left readability field, CSS-gradient cloud fallback, thin moonlight rules, desktop 40/60 hero, and responsive tablet/mobile stacking. Keep Works 3/2/1 columns, focus outlines, skip link, `overflow-x: hidden/clip`, and `prefers-reduced-motion` static behavior.

- [ ] **Step 7: Run focused tests and inspect the static page**

Run: `node --test tests/site-structure.test.mjs tests/style-contract.test.mjs`

Expected: PASS. With JavaScript disabled, Profile copy, all navigation, all seven Works cards, detail text, and four Contact links remain visible.

- [ ] **Step 8: Commit the shell**

```bash
git add index.html works.html contact.html works/cosmo-effects/index.html assets/css/style.css assets/js/lunar-field.js assets/js/ambient-sound.js tests/site-structure.test.mjs tests/style-contract.test.mjs
git commit -m "feat: establish lunar reverie portfolio shell"
```

### Task 2: Build the WebGL2 moonlit cloud renderer

**Files:**
- Create: `assets/js/lunar-shaders.js`
- Modify: `assets/js/lunar-field.js`
- Create: `tests/lunar-field.test.mjs`
- Remove: `assets/js/cosmic-field.js`
- Remove: `tests/cosmic-field.test.mjs`

**Interfaces:**
- Consumes: `#lunar-field`, `.lunar-fallback`, and `body[data-page]` from Task 1.
- Produces: `getSceneMetrics(options)`, `getPagePreset(pageMode)`, `createPointerTrail(options)`, `createLunarScene(canvas, options)`, `bootLunarField(root, windowTarget)`, and `createFragmentShaderSource({ octaves, splatCount })` for Task 3.

- [ ] **Step 1: Write failing pure-helper and shader tests**

Create `tests/lunar-field.test.mjs` with named tests asserting:

```js
const high = getSceneMetrics({ width: 1440, height: 1000, devicePixelRatio: 3, mobile: false, reducedMotion: false });
assert.equal(high.pixelRatio, 1.5);
assert.equal(high.quality, 'high');
assert.equal(high.renderScale, 0.75);
assert.equal(high.octaves, 4);
assert.equal(high.splatCount, 12);
assert.equal(high.animate, true);

const mobile = getSceneMetrics({ width: 390, height: 844, devicePixelRatio: 3, mobile: true, reducedMotion: false });
assert.equal(mobile.pixelRatio, 1);
assert.equal(mobile.quality, 'medium');
assert.equal(mobile.renderScale, 0.625);

assert.deepEqual(getPagePreset('contact'), { cloudStrength: 0.45, trailStrength: 0, starBoost: 1, moonStrength: 0 });
assert.match(createFragmentShaderSource({ octaves: 3, splatCount: 8 }), /#version 300 es/);
assert.match(createFragmentShaderSource({ octaves: 3, splatCount: 8 }), /uTrailPosition\[8\]/);
```

Also assert zero dimensions return finite non-negative buffer sizes, reduced motion sets `animate: false`, and a pointer trail retains no more than its configured limit and decays all samples by `decayMs`.

- [ ] **Step 2: Run the new tests and confirm missing exports**

Run: `node --test tests/lunar-field.test.mjs`

Expected: FAIL because `lunar-field.js` and `lunar-shaders.js` do not exist.

- [ ] **Step 3: Implement shader-source generation**

In `assets/js/lunar-shaders.js`, export:

```js
export const VERTEX_SHADER_SOURCE;
export function createFragmentShaderSource({ octaves, splatCount });
```

Generate GLSL ES 3.00 source for layered FBM clouds, hash stars, crescent SDF, left readability mask, page-preset strengths, and packed trail arrays. Loop bounds must be compile-time values supplied by the quality tier.

- [ ] **Step 4: Implement metrics, presets, trail, and static renderer lifecycle**

In `assets/js/lunar-field.js`, replace the Task 1 no-op shell and export the Task 2 interfaces. `createLunarScene` accepts injectable `rendererFactory`, `requestFrame`, `cancelFrame`, `now`, `windowTarget`, `documentTarget`, and `reducedMotion`; default `rendererFactory` compiles WebGL2 and returns `{ render(frame), resize(width, height), destroy() }`. On WebGL2/compile/link failure return a safe scene with `fallback: true` and leave `.lunar-fallback` visible. At the module boundary, call `bootLunarField(document, window)` immediately when DOM is ready and do nothing when those globals are absent.

- [ ] **Step 5: Run tests and confirm the renderer helpers pass**

Run: `node --test tests/lunar-field.test.mjs`

Expected: PASS for metrics, presets, shader source, bounded trail, no-context fallback, and reduced-motion no-RAF behavior.

- [ ] **Step 6: Remove the old field and run the full suite**

Delete `assets/js/cosmic-field.js` and `tests/cosmic-field.test.mjs`. Run: `npm test`

Expected: PASS; no HTML or README reference to `cosmic-field.js` remains.

- [ ] **Step 7: Commit the renderer core**

```bash
git add assets/js/lunar-shaders.js assets/js/lunar-field.js tests/lunar-field.test.mjs assets/js/cosmic-field.js tests/cosmic-field.test.mjs
git commit -m "feat: render interactive moonlit clouds with webgl2"
```

### Task 3: Complete pointer, quality, and WebGL lifecycle behavior

**Files:**
- Modify: `assets/js/lunar-field.js`
- Modify: `tests/lunar-field.test.mjs`

**Interfaces:**
- Consumes: Task 2 renderer, metrics, page presets, and pointer trail.
- Produces: live pointer/touch splats, one-way quality downgrade, resize and reduced-motion redraws, context loss/restoration, visibility pausing, and complete cleanup for final integration.

- [ ] **Step 1: Add failing lifecycle tests**

Extend `tests/lunar-field.test.mjs` with tests that use fake targets and renderer factories to assert:

- `pointermove` is registered on `windowTarget` with `{ passive: true }`, normalized coordinates are clamped to `[0, 1]`, and no `preventDefault` is called.
- 90 consecutive frame durations over `22ms` downgrade High to Medium once and call renderer recreation/resize exactly once.
- Reduced-motion startup schedules no RAF but redraws on resize and live preference change.
- Hidden documents cancel RAF; visible documents resume only when motion is allowed.
- `webglcontextlost` calls `preventDefault`, stops RAF, and activates fallback; one `webglcontextrestored` reinitializes one renderer.
- `destroy()` removes pointer, resize, visibility, media-query, and WebGL context listeners and destroys the renderer once.

- [ ] **Step 2: Run focused tests and confirm lifecycle failures**

Run: `node --test tests/lunar-field.test.mjs`

Expected: FAIL for unimplemented listeners, downgrade, and context restoration.

- [ ] **Step 3: Implement input and adaptive quality**

Use passive `pointermove` on `windowTarget`, map `clientX/clientY` against `innerWidth/innerHeight`, derive clamped velocity strength, and feed the bounded trail. Track a rolling 90-frame duration window and downgrade `high → medium → low` once per threshold breach without auto-upgrading.

- [ ] **Step 4: Implement live lifecycle and cleanup**

Add resize, visibility, live media-query, `webglcontextlost`, and `webglcontextrestored` handling. Reduced motion renders only on startup/configuration/resize events. Ensure repeated start, restore, and destroy calls are idempotent.

- [ ] **Step 5: Run focused and full tests**

Run: `node --test tests/lunar-field.test.mjs && npm test`

Expected: all tests PASS.

- [ ] **Step 6: Commit interaction and lifecycle behavior**

```bash
git add assets/js/lunar-field.js tests/lunar-field.test.mjs
git commit -m "feat: add adaptive lunar field interactions"
```

### Task 4: Generate opt-in ambient sound in the browser

**Files:**
- Modify: `assets/js/ambient-sound.js`
- Create: `tests/ambient-sound.test.mjs`
- Modify: `tests/site-structure.test.mjs:35-249`

**Interfaces:**
- Consumes: `[data-sound-toggle]` buttons from Task 1.
- Produces: `AMBIENT_STORAGE_KEY`, `readAmbientPreference(storage)`, `createAmbientSound(options)`, and `bootAmbientSound(root, windowTarget)` with states `off | needs-gesture | playing | unavailable`.

- [ ] **Step 1: Write failing preference and no-autoplay tests**

Create `tests/ambient-sound.test.mjs`. Assert the namespaced key, safe reads when storage throws, default `off`, stored-on `needs-gesture`, and that constructing/booting does not call the injected `audioContextFactory`.

- [ ] **Step 2: Write failing state and lifecycle tests**

Using a fake AudioContext and manual scheduler, assert:

- `enableFromGesture()` creates one base graph, resumes, ramps Master Gain to at most `0.06`, stores On, and reaches `playing`.
- transient resume rejection returns `needs-gesture` without storing Off; a later click retries.
- `disable()` ramps to zero, cancels one bell scheduler, suspends, stores Off, and reaches `off`.
- stored-on page boot labels the button `START SOUND` with `aria-pressed="false"`; playing uses `SOUND ON`/`true`; unavailable disables the button.
- repeated toggles do not duplicate base oscillators, looping noise source, compressor, or scheduler.
- `setHidden(true)` fades/suspends and reaches `needs-gesture` while keeping stored On.
- `destroy()` cancels timers, stops sources, disconnects nodes, removes UI/visibility listeners, and is idempotent.

- [ ] **Step 3: Run focused tests and confirm missing module failures**

Run: `node --test tests/ambient-sound.test.mjs`

Expected: FAIL because `ambient-sound.js` does not exist.

- [ ] **Step 4: Implement the ambient state machine and audio graph**

Replace the Task 1 no-op shell with a single reusable graph containing low pad oscillators with slow LFO modulation, a generated looping noise buffer through a low-pass filter, scheduled short bell oscillators, a `DynamicsCompressorNode`, and Master Gain capped at `0.06`. All platform objects, timers, random, and clock are injectable. `bootAmbientSound` owns button text/disabled/`aria-pressed` updates and `visibilitychange` handling. At the module boundary, boot when DOM is ready and do nothing when browser globals are absent.

- [ ] **Step 5: Extend HTML policy checks for sound safety**

In `tests/site-structure.test.mjs`, require exactly one Sound button and one `ambient-sound.js` module per primary/detail page, no `<audio>`/`<video>` elements, and no tracked `.mp3`, `.m4a`, `.wav`, or `.ogg` asset.

- [ ] **Step 6: Run focused and full tests**

Run: `node --test tests/ambient-sound.test.mjs tests/site-structure.test.mjs && npm test`

Expected: all tests PASS.

- [ ] **Step 7: Commit the sound system**

```bash
git add assets/js/ambient-sound.js tests/ambient-sound.test.mjs tests/site-structure.test.mjs
git commit -m "feat: add procedural ambient sound controls"
```

### Task 5: Harmonize the Works preview and finish the visual integration

**Files:**
- Modify: `assets/js/work-preview.js:1-394`
- Modify: `tests/work-preview.test.mjs:1-220`
- Modify: `assets/css/style.css`
- Modify: `index.html`
- Modify: `works.html`
- Modify: `contact.html`
- Modify: `works/cosmo-effects/index.html`

**Interfaces:**
- Consumes: Task 1 shell, Task 2/3 lunar field, Task 4 Sound UI, existing `createWorkPreview` API.
- Produces: the complete visitor-facing Lunar Reverie experience at desktop, tablet, and mobile widths.

- [ ] **Step 1: Add failing palette and integration tests**

Extend `tests/work-preview.test.mjs` so an injected recording context sees the Lunar Reverie RGB palette (`#284d86`, `#6d91c9`, `#bed6f6`, `#d7c4e7`) and retains current DPR, reduced-motion, resize, and visibility contracts. Extend `tests/style-contract.test.mjs` to require Profile 40/60 desktop columns, `hero-status` three-part layout, mobile stacking below `719px`, and a non-motion visual state for the linked Work card.

- [ ] **Step 2: Run focused tests and confirm the palette/layout failures**

Run: `node --test tests/work-preview.test.mjs tests/style-contract.test.mjs`

Expected: FAIL for old violet palette and missing final responsive rules.

- [ ] **Step 3: Update the generated Works preview**

Keep `getPreviewMetrics`, `createWorkPreview`, and `bootWorkPreviews` signatures. Replace only colors and compositing needed to match moonlit blue/lavender clouds; retain Canvas 2D fallback, DPR cap, visibility, live reduced-motion, resize, and destroy behavior.

- [ ] **Step 4: Finish the four page layouts and interaction states**

Apply final spacing, header, hero, status bar, Works-card hover/focus, Contact clarity, detail emphasis, and mobile rules. Use `data-page` presets instead of page-specific extra canvases. Keep button/link hit areas at least 44px in the compact layout and ensure the canvas never becomes an input target.

- [ ] **Step 5: Run the complete automated suite**

Run: `npm test`

Expected: all tests PASS.

- [ ] **Step 6: Commit visual integration**

```bash
git add assets/js/work-preview.js tests/work-preview.test.mjs assets/css/style.css index.html works.html contact.html works/cosmo-effects/index.html tests/style-contract.test.mjs
git commit -m "feat: complete lunar reverie visual system"
```

### Task 6: Document and verify the complete GitHub Pages experience

**Files:**
- Modify: `README.md:1-54`
- Modify: `tests/site-structure.test.mjs`
- Modify: `tests/helpers/public-html.mjs` if module-import discovery needs a shared helper

**Interfaces:**
- Consumes: all completed page, renderer, sound, and preview interfaces.
- Produces: repository policy checks, user-facing maintenance notes, and final verification evidence.

- [ ] **Step 1: Add failing repository-policy tests**

Require README coverage for WebGL2/CSS fallback, generated audio, initial Sound Off, `prefers-reduced-motion`, local preview, and `npm test`. Recursively validate every public HTML `href`/`src` and every relative ES module import against the repository root and `https://leftorenia.github.io/Lef-Lef-Portfolio-Site/`; forbid root-relative `/assets`, remote code/font/media, raster images, and audio files.

- [ ] **Step 2: Run the policy test and confirm documentation gaps**

Run: `node --test tests/site-structure.test.mjs`

Expected: FAIL until README and import discovery match the completed implementation.

- [ ] **Step 3: Update README**

Describe Lunar Reverie, WebGL2 quality/fallback behavior, pointer interaction, generated ambient layers, Sound state behavior, motion/accessibility behavior, local preview, verification, and future-work workflow. State explicitly that the reference images and reference-site assets are not included.

- [ ] **Step 4: Run automated integrity checks**

Run: `npm test`

Expected: all tests PASS.

Run: `git diff --check`

Expected: no output.

Run: `git ls-files | rg -i "\.(png|jpe?g|webp|gif|mp3|m4a|wav|ogg)$"`

Expected: no output.

- [ ] **Step 5: Verify desktop, tablet, and mobile rendering**

Start `python -m http.server 4173` at the repository root. Inspect `index.html`, `works.html`, `contact.html`, and `works/cosmo-effects/index.html` at approximately `1440×1000`, `900×1000`, and `390×844`. Confirm the 40/60 hero, 3/2/1 Works columns, readable Contact/detail pages, no clipping or horizontal overflow, visible focus, and no console errors.

- [ ] **Step 6: Verify motion, fallback, and sound behavior**

Confirm pointer and touch trails decay after about 2.5 seconds, Contact uses star-only reaction, Sound begins only after a click and follows all four UI states, repeated toggles create no audible stacking, tab hiding suspends it, reduced motion has no RAF loop, and WebGL2 disabled leaves the CSS moonlit background and all content usable.

- [ ] **Step 7: Commit documentation and final policy checks**

```bash
git add README.md tests/site-structure.test.mjs tests/helpers/public-html.mjs
git commit -m "docs: document lunar portfolio behavior"
```

## Final verification

Run: `npm test && git diff --check && git status --short`

Expected: all tests PASS, no whitespace errors, and a clean working tree.

Do not push or publish without a separate explicit request.
