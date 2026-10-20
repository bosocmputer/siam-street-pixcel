# VFX, textures/materials, environment art, UI art and sound tools for a three.js web 3D action RPG (agent-drivable, Oct 2026)

Scope note: researched 2026-10-20 from a Claude Code cloud container. Many vendor pages could not be fetched directly (see "Environment observations" under the last question), so a large share of pricing figures come from search-result summaries of official docs plus third-party aggregators. Every price below should be treated as "verify on the vendor page before buying". Prices in USD.

## 1. Code-based VFX for three.js (particles, trails, flipbooks) and AI-generated flipbook textures

### Takeaway
three.quarks is the most complete code-first particle/VFX library for three.js (billboard, stretched billboard, mesh and trail renderers, batched rendering, JSON save/load, visual editor), and it is pure TypeScript an agent can write directly — but its current 0.17.x release requires three >= 0.182, while this project pins three 0.170.0, so either pin three.quarks 0.16.0 (three >= 0.165) or upgrade three. For flipbook textures, PixelLab's vfx_workbench (already in the creator's MCP) exports a spritesheet PNG + JSON, which fits the project's pixel-3D look better than photoreal EmberGen-style flipbooks.

### Cited Findings
**three.quarks**
- Repo github.com/Alchemist0823/three.quarks; "high-performance javascript particle system based visual effect library for threejs written in modern TypeScript"; renderers: billboard, stretched billboard, mesh, trail; `BatchedParticleRenderer` batches multiple systems to reduce draw calls; custom Behaviors; visual editor "three.quarks-editor"; JSON save/load; packages `quarks.core` (zero-dependency) and `quarks.r3f` (React Three Fiber) — [libraries.io](https://libraries.io/npm/three.quarks); [gittrend](https://gittrend.io/repo/Alchemist0823/three.quarks)
- Third-party tracker: ~799 stars, 45 forks, last push Feb 5 2026 (may be stale) — [gittrend](https://gittrend.io/repo/Alchemist0823/three.quarks)
- npm (queried directly from the container's allowed npm registry, 2026-10-20): `three.quarks` latest 0.17.1 published 2026-05-21, MIT; 0.17.0 published 2026-02-04. Peer dependency of 0.17.x: `three >= 0.182.0`; 0.16.0 and 0.15.6: `three >= 0.165.0`. — [npm three.quarks](https://www.npmjs.com/package/three.quarks)
- Project context: `apps/citywalk/package.json` pins `"three": "0.170.0"`; current three on npm is 0.186.1 (2026-09-24) — [npm three](https://www.npmjs.com/package/three) (version observed via `npm view`)
- A community "DocSearch MCP" index of the three.quarks repo exists (docs lookup for agents, not generation) — [docsearch.algolia.com](https://docsearch.algolia.com/mcp/docs/repo/alchemist0823/three.quarks)
- An editor/runtime called "lesscad / mattermanifest" advertises easy integration with three.js for quarks-style effects (unverified product page) — [mattermanifest tutorial](https://lesscad.mattermanifest.com/runtime/tutorials/threejs)

**three-nebula**
- npm `three-nebula` 13.3.0 published 2026-09-19 (13.1.0 on 2026-09-11, 13.2.0 on 2026-09-12), MIT; peer `three >=0.122.0 <1.0.0` — i.e. actively republished in Sept 2026 and compatible with three 0.170 — [npm three-nebula](https://www.npmjs.com/package/three-nebula) (observed via `npm view`)
- (Could not fetch the GitHub repo for star count/maintainer notes; see Gaps.)

**Weapon trails / slashes (custom shader approach)**
- Common technique: sample blade tip and blade base positions each frame, build a ribbon mesh from that history, fade alpha/width along the ribbon in a shader; a three.js GPU-based, non-screen-space slow-motion sword trail was showcased by Ash Thornton — [80.lv](https://80.lv/articles/slow-motion-sword-trail-effect-recreated-with-three-js)
- TrailRendererJS is a known 3D object trail renderer for three.js (forum-recommended; setup of attributes/uniforms described as non-obvious) — [three.js forum](https://discourse.threejs.org/t/make-trail-with-three-js/27728)
- three.quarks includes a dedicated Trail renderer type — [libraries.io](https://libraries.io/npm/three.quarks)

**Babylon.js Node Particle Editor (comparison)**
- Babylon's Node Particle Editor (NPE) was announced mid-2025 and is part of Babylon.js 9.0; produces a "particle system set" loaded via `ParseFromSnippetAsync` → `buildAsync` → `start()`; feature checklist includes sprite sheet support — [Babylon forum](https://forum.babylonjs.com/t/new-feature-the-node-particle-editor-npe/59303); [NPE README](https://gitea.com/rfactor/Babylon.js/src/branch/master/packages/tools/nodeParticleEditor/README.md)
- `@babylonjs/core` latest 9.31.0 (2026-10-15), Apache-2.0 — [npm @babylonjs/core](https://www.npmjs.com/package/@babylonjs/core) (observed via `npm view`)
- A `babylon.quarks-editor` package exists (quarks ported to Babylon) — [libraries.io](https://libraries.io/npm/babylon.quarks-editor)

**AI / tool-generated flipbook textures**
- PixelLab MCP tool `vfx_workbench` (from the tool's own schema in this session): "Make an animated pixel-art effect (spell, hit, explosion, aura, projectile, weather...) ... around the user's sprite or on its own"; workflow `start [--sprite] [--projectile] [--preset]` → `add_part / set_part / throw / render` → `export`; export "returns a GIF and a spritesheet PNG + JSON; --game-pack adds a ZIP of every piece for a game engine"; saved to "My effects" on pixellab.ai; "Free for subscribers" — [PixelLab MCP tool description; PixelLab ToS](https://pixellab.ai/termsofservice)
- Older PixelLab VFX workflow (pre-workbench video): generate a 4x4 grid of 64x64 effect variations, then animate/cleanup in other tools (Pixelorama), deleting repeated frames manually — [SozAI transcript](https://sozai.app/transcript/make-animated-pixel-art-vfx-pixellab/)
- Free open-source "Pixel ability-fx forge" (itch.io) exports sprite atlas / PNG sequence / transparent GIF, 128–256 px frames, 24/32/48 frames — [itch.io](https://announcerua.itch.io/pixel-ability-fx-forge)
- EmberGen (JangaFX, real-time fluid sim with built-in flipbook export): indie perpetual $299.99 at 1.0 (2023); a 2026 report describes $300 first year + $180/yr optional maintenance for Indie (revenue < $1M); also a free-licence programme for laid-off artists — [CG Channel 2023](https://www.cgchannel.com/2023/03/jangafx-releases-embergen-1-0/); [Digital Production 2026](https://digitalproduction.com/2026/03/20/jangafx-makes-its-layoff-assistance-programme-permanent/). EmberGen is a GPU desktop app — not runnable in a headless no-GPU container.
- Video → frames route: Google Veo 3.1 on Gemini API reported at $0.40/s (720p/1080p), $0.60/s (4K); Veo 3.1 Fast $0.10–0.30/s; Veo 3.1 Lite $0.05/s (720p), $0.08/s (1080p); no free tier — [benchlm.ai (aggregator, read 2026-09-11)](https://benchlm.ai/media-pricing/veo)

### Inferences
- For this project (pixel-3D look, phones, three 0.170.0): best near-term path is (a) code-drawn effects in the existing `src/fx.ts` + ribbon-mesh weapon trails written by Claude, plus (b) PixelLab vfx_workbench spritesheets played as flipbook billboards (a few dozen lines of UV-offset shader or three.quarks' sprite-sheet tile animation). three.quarks 0.16.0 is the compatible pin unless three is upgraded to >=0.182.
- Veo/Flow → video → ffmpeg frame extraction → background removal → spritesheet is technically possible but expensive per second, produces non-pixel, non-looping, non-alpha frames; poor fit compared with PixelLab for this art direction.
- Babylon NPE is a stronger visual node editor than anything in three.js, but switching engines is out of scope; useful only as a design reference.
- The three.quarks-editor is a browser GUI; an agent would author the JSON/TS directly rather than drive the editor (the editor's value is for the human creator to tweak and export JSON).

### Gaps
- Could not fetch GitHub to confirm current star counts / last commits for three.quarks, three.quarks-editor, three-nebula, TrailRendererJS (GitHub access blocked for non-attached repos in this session).
- No source found for a native three.js (TSL/WebGPU) particle system replacing these libraries; not verified.
- Did not verify whether three.quarks 0.16.0 has known bugs with three 0.170.
- PixelLab vfx_workbench could not be test-called from this subagent (returned "401 Missing Authorization header"), so actual output size/frames are unverified.

## 2. Texture/material generation and CC0 libraries (PBR, stylised, facades)

### Takeaway
ambientCG (CC0, keyless GET API v3 released Feb 2026) is the cleanest agent-drivable source for ground/wall PBR materials; Poly Haven assets are CC0 but its API is free only for non-commercial use, so for a commercial game Claude should download assets once (or via the website) rather than build on the API. AI texture tools (Meshy retexture, Scenario, 3D AI Studio, etc.) exist, but none surfaced a dedicated programmatic building-facade generator; the practical facade route is "image model (Imagen/Gemini/OpenAI/PixelLab) → tileable base colour → derive normal/roughness locally".

### Cited Findings
**ambientCG**
- API v3 announced 2026-02-28; endpoints `/api/v3/assets`, `/api/v3/categories`, `/api/v3/collections`, `/api/v3/rss`; GET only; base `https://ambientCG.com/api/v3/`; v2 no longer updated (v1/v2 still work) — [ambientCG docs update](https://docs.ambientcg.com/updates/2026/02/28/documentation-for-the-new-api-v3/); [API v3 docs](https://docs.ambientcg.com/api/v3/)
- Described as public domain (CC0) PBR materials, HDRIs, models — [docs.rs ambientcg crate](https://docs.rs/ambientcg); catalogue 1,700–2,000+ materials, 400+ HDRIs, 1K–8K (third-party guide, figures vary) — [Cinevva guide](https://app.cinevva.com/guides/free-textures-hdris-materials)

**Poly Haven**
- Assets CC0; ~780 textures, ~980 HDRIs, ~520 models; textures 1K–16K JPG/PNG/EXR; models glTF/Blend/FBX (third-party guide) — [Cinevva guide](https://app.cinevva.com/guides/free-textures-hdris-materials)
- Official API page: API "free to use for non-commercial projects and academic research"; commercial use requires a custom licence, typically sponsorship; every request needs a unique User-Agent — [Poly Haven API](https://polyhaven.com/our-api)
- Corporate model: 5% revenue share with minimum annual fee for commercial licensing/partnerships — [Poly Haven corporate](https://polyhaven.com/corporate)

**Meshy (3D + texturing)**
- API is prepaid credits; Text-to-3D refine/texture 10 credits (2K/4K), 15 credits (8K); Retexture priced the same; Image-to-3D with texture 30 credits (Meshy-6), 35 with 8K — [Meshy API pricing](https://docs.meshy.ai/api/pricing)
- All paid plans allow commercial use; Free plan outputs CC BY 4.0 — [Meshy pricing & credits](https://docs.meshy.ai/en/webapp/pricing)
- Official MCP `meshy-dev/meshy-mcp-server` (~20 tools incl. text-to-3D, image-to-3D, `meshy_retexture`, remesh, rig, animate); runs locally with your API key; hosted endpoint "on the roadmap" — [Glama listing](https://glama.ai/mcp/servers/meshy-dev/meshy-mcp-server); [meshy.ai/mcp](https://www.meshy.ai/mcp)
- Community `pasie15/meshy-ai-mcp-server` exposes `create_text_to_texture_task` as alias of retexture — [GitHub](https://github.com/pasie15/meshy-ai-mcp-server)

**Other AI texture tools**
- 3D AI Studio Seamless Texture Generator (updated May 2026): tileable base colour, normal, roughness, metalness, height from text (10 credits) or image (7 credits); Material "Extract from Photo" 15 credits; web UI, no API seen — [3D AI Studio docs](https://docs.3daistudio.com/textures/seamless-texture)
- AI Texture Studio: image-to-PBR from building photos into repeatable panels (marketing page, no API) — [SimilarLabs](https://similarlabs.com/p/ai-texture-studio)
- Sorceress "Material Forge" pattern: image model makes base colour, normal/roughness/metallic/AO/emissive derived locally in browser — [Sorceress blog](https://sorceress.games/blog/ai-pbr-texture-generator-one-photo-to-game-ready-textures)
- Texturity (Belight) desktop seam-removal; Seamless AI (Unity-only, offline) — [Belight](https://www.belightsoft.com/products/texturity/); [Lovart roundup](https://www.lovart.ai/it/blog/5-best-ai-texture-material-generators-2026)
- PixelLab MCP also offers `create_building_kit`, `create_tiles_pro`, `create_topdown_tileset`, `create_normal_map` (tool names in this session's PixelLab MCP list) — [PixelLab](https://pixellab.ai/termsofservice)
- Phaser publishes a free seamless texture generator tool — [phaser.io](https://phaser.io/tools/seamless-texture-generator)

### Inferences
- For a phone WebGL game with a pixel-3D post-process (`scenePixel`), full PBR (normal+roughness+metal) mostly disappears after downscaling; a single tileable base-colour atlas (ground, wall, roof, shophouse facade strips) plus vertex colours is likely cheaper and sufficient. ambientCG base-colour maps or PixelLab tiles can be palette-reduced.
- Facades: an agent can generate a handful of Chiang Mai shophouse / wooden house facade strips with an image model, make them tile horizontally, and UV-map them onto OSM-extruded buildings procedurally; no turnkey "facade API" was found.
- Poly Haven: downloading individual CC0 files manually is fine; scripting the API for a commercial product needs their permission.

### Gaps
- Scenario's texture/PBR/skybox feature specifics and Stability's texture tools were not confirmed.
- Could not fetch ambientCG/Poly Haven APIs from the container (egress blocked), so query parameters and download-link formats are unverified.
- No source found for an AI tool that generates building facades from OSM footprints programmatically.

## 3. Skybox

### Takeaway
Blockade Labs Skybox AI remains the dedicated option with a REST API that returns equirectangular images (1K–8K), cube maps, HDRI and a depth map; API plans start around $20/month per conflicting pricing pages. No confirmed first-party MCP server. Free alternatives: CC0 HDRIs from Poly Haven/ambientCG, or a procedural/gradient sky in code (best fit for pixel style).

### Cited Findings
- API membership page: Project $20/mo (100 skyboxes/mo, overage $0.15), Company $100/mo (1,000/mo, overage $0.10), Enterprise custom; both include commercial licensing — [api.blockadelabs.com (via search summary)](https://api.blockadelabs.com)
- Conflicting plans page: per-seat plans $24 and $60/mo, Business $140/mo with full API access and usage-based pricing — [skybox.blockadelabs.com/plans](https://skybox.blockadelabs.com/plans); developer article recommends Team plans for apps (overage + concurrency) — [Blockade support](https://support.blockadelabs.com/hc/en-us/articles/30934112955026-Skybox-AI-Quick-Start-Introduction-To-Building-Application-With-Skybox-AI)
- Export types: equirectangular JPG/PNG, HDRI (exr, hdr), depth map (`depth-map-png`), cube map, video; 1K/2K/4K/8K (2:1, e.g. 8192×4096) — [Skybox exports API docs](https://api-documentation.blockadelabs.com/api/skybox-exports.html)
- Depth map always generated with Generate Skybox — [Blockade API changelog](https://api-documentation.blockadelabs.com/api/changelog.html)
- 3D mesh (GLB) export from depth is experimental — [Blockade support](https://support.blockadelabs.com/hc/en-us/articles/31649281677074-Export-3D-Models-from-Skybox-AI)
- Integrations page lists "MCP" but the entry describes a Blender add-on, not a documented MCP server — [Blockade integrations](https://www.blockadelabs.com/integrations)
- Poly Haven ~980 CC0 HDRIs; ambientCG 400+ HDRIs — [Cinevva guide](https://app.cinevva.com/guides/free-textures-hdris-materials)

### Inferences
- With the pixel post-process and a city viewed from a low third-person camera, a code-drawn gradient sky + a few cloud billboards (time-of-day tinted) is probably cheaper and more consistent than an 8K photoreal skybox; Blockade is worth it only if the creator wants painted mountain silhouettes (Doi Suthep) on the horizon. A one-month $20 API plan would cover experiments.
- Equirectangular → three.js: `TextureLoader` + `EquirectangularReflectionMapping` as `scene.background`; on phones use 2K, not 8K.

### Gaps
- Could not reach Blockade pages directly to resolve the $20 vs $24/$140 pricing conflict.
- No other AI skybox API (e.g., Scenario skybox) confirmed.

## 4. Sound effects and music

### Takeaway
ElevenLabs is the most agent-friendly AI audio vendor: official JS SDK, sound effects up to 30 s with looping, Eleven Music API, and an official MCP — whose local repo was archived Aug 20 2026 in favour of a hosted remote MCP at `https://api.elevenlabs.io/v1/mcp` (OAuth). Music licence for games is tier-dependent (Enterprise explicitly lists games). Suno is risky for games (licence not ownership after the Warner deal). CC0 libraries (Kenney, Freesound filtered to CC0) plus the project's existing code synth (`src/audio/synth.ts`) cover most SFX at zero cost.

### Cited Findings
**ElevenLabs**
- `elevenlabs/elevenlabs-mcp` (MIT, ~1.5k stars) archived 2026-08-20; README says local server is deprecated/"no longer actively maintained" in favour of hosted server `https://api.elevenlabs.io/v1/mcp` with OAuth; local install was `uvx elevenlabs-mcp`; named tools include `speech_to_text`, `isolate_audio`, `speech_to_speech`, `video_to_music`, `upload_music_for_inpainting` — [GitHub elevenlabs-mcp](https://github.com/elevenlabs/elevenlabs-mcp)
- Directory listings describe the official server as generating sound effects from text — [Glama](https://glama.ai/mcp/servers/elevenlabs/elevenlabs-mcp); a June-2026 guide says it covers SFX, music and agents (unverified) — [mcp.directory](https://mcp.directory/blog/elevenlabs-mcp-complete-guide-2026)
- Sound effects: duration 0.1–30 s; looping option for seamless repeats — [ElevenLabs SFX docs](https://elevenlabs.io/docs/overview/capabilities/sound-effects)
- SFX cost conflicting: help center says API default (auto duration) 100 credits/generation, or 11 credits per second if duration set (website 40 credits/s) — [ElevenLabs help center](https://elevenlabs.io/docs/help-center/product/content-production/sound-effects/how-much-does-it-cost-to-generate-sound-effects); main docs cite 40 credits/s — [ElevenLabs SFX docs](https://elevenlabs.io/docs/capabilities/sound-effects)
- Eleven Music API: Enterprise tier = "all media rights incl. film, TV, games"; self-serve = broad commercial use online and offline — [Eleven Music API](https://elevenlabs.io/hi/eleven-music-api); a third-party guide says self-serve excludes "Studio Games" (conflicts) — [Cinevva](https://app.cinevva.com/guides/ai-voice-acting-games)
- Free tier no commercial music use; commercial from Starter ($6/mo) — [licenseorg](https://licenseorg.com/blog/ai-music-licensing-suno-elevenlabs)
- Music v2 (May 2026): better vocals, section-level editing, API price cuts up to 50% — [createwith](https://www.createwith.com/tool/elevenlabs/updates/elevenlabs-launches-music-v2-with-better-vocals-and-50-price-cut); [mer.vin](https://mer.vin/2026/05/elevenlabs-music-v2-genre-switching-ai-songs-with-section-level-editing/)
- `@elevenlabs/elevenlabs-js` 2.74.0 (2026-10-20), MIT — [npm](https://www.npmjs.com/package/@elevenlabs/elevenlabs-js) (observed via `npm view`)

**Stable Audio (Stability AI)**
- API price reported ~$0.20/generation (third-party), 302.ai lists $0.40, reseller EmpirioLabs $0.68 — [costbench](https://www.costbench.com/software/ai-music-generators/stable-audio/hidden-costs/); [302.ai](https://302.ai/product/detail/stable-audio-2); [EmpirioLabs](https://empiriolabs.ai/models/stable-audio-2-5)
- Free outputs non-commercial; trained on licensed AudioSparx data — [listir](https://listir.is/tools/stable-audio)
- Stability Community License: free commercial use for orgs < $1M annual revenue; Enterprise above — [Stability license](https://stability.ai/license); [license update](https://stability.ai/news/license-update)

**Suno / Udio**
- Free-tier songs cannot be used commercially, no retroactive licence; paid tiers get commercial use rights; after the late-2025 Warner settlement ownership wording changed to Suno retaining authorship + perpetual commercial licence; 2026 changes include phasing out current models and limiting downloads — [Music in Africa](https://www.musicinafrica.net/magazine/suno-adjusts-ai-music-ownership-terms-after-warner-music-partnership); [Dubspot](https://blog.dubspot.com/ai-music-licensing-explained-2026)
- No public Suno developer API/MCP found in results (see Gaps).

**CC0 / free libraries and code synthesis**
- Kenney audio is CC0, no attribution; packs for UI, impacts, RPG — [Cinevva](https://app.cinevva.com/guides/free-sound-effects-music)
- Freesound licence is per sound: CC0, CC-BY, CC-BY-NC; NC not usable in a sold game; search can filter by licence — [Cinevva licences guide](https://app.cinevva.com/guides/game-asset-licenses)
- Code-synth libraries on npm: `zzfx` 1.4.0 (2026-10-01, MIT), `jsfxr` 1.4.1, `tone` 15.1.22 (MIT); `howler` 2.2.4 (last 2023) — [npm zzfx](https://www.npmjs.com/package/zzfx); [npm tone](https://www.npmjs.com/package/tone) (observed via `npm view`)
- Project already has `apps/citywalk/src/audio/{synth,engine,analyze,soundLab}.ts` with tested spectrogram/loudness analysis (local repo observation).

### Inferences
- Recommended stack: keep code-synth for UI blips/hits (zero assets, deterministic, tiny); use ElevenLabs SFX (via JS SDK from Node in the container, or remote MCP) for organic sounds (fire whoosh, water splash, crowd, tuk-tuk, market ambience loops up to 30 s); use Kenney CC0 as fallback. Claude can verify generated audio with the existing `analyze.ts` (peak/rms/clipping) since it cannot listen.
- Music: ElevenLabs Music or Stable Audio on a paid tier; avoid Suno for a commercial game unless terms are re-checked. Keep a licence log per file (source, plan, date).

### Gaps
- Could not read ElevenLabs pricing page; per-credit USD and plan prices for Oct 2026 unverified.
- Hosted ElevenLabs MCP tool list not verified from official docs.
- Udio licensing and any Suno API not researched successfully.

## 5. UI/2D art generators (icons, portraits, flat sprites): API, MCP, licence

### Takeaway
PixelLab (already connected via MCP, incl. `create_ui_asset`, `create_font`, `vfx_workbench`) is the best fit for the project's pixel UI rule. Scenario now has an official hosted MCP (`https://mcp.scenario.com/mcp`, OAuth or API key) with plans from $15/mo. Google image models (Imagen 4 Fast ~$0.02/image, Nano Banana ~$0.039) via Gemini API are cheapest for concept/reference images; OpenAI gpt-image is token-billed. Leonardo has no official MCP found. fal.ai offers an official hosted MCP over 1,000+ models (image/audio/3D) — a single endpoint giving access to many generators.

### Cited Findings
**Scenario**
- Official hosted MCP at `https://mcp.scenario.com/mcp`; API key fallback needs Contributor/Owner (write) scope, read-only keys get Forbidden on generate — [Scenario help](https://help.scenario.com/articles/2664328768-getting-started-with-the-scenario-mcp-server)
- API cost varies by resolution/steps/features; `dryRun=true` returns expected credit cost; `GET /usage` — [Scenario API pricing](https://docs.scenario.com/page/api-pricing)
- Plans (help center, updated 2026-05-25): Free, Starter $15/mo, Pro $45/mo (5,000 compute units, custom Flux training), Max $75/mo, Enterprise $125/user/mo — [Scenario pricing](https://help.scenario.com/en/articles/pricing-plans/); costbench reports an October 2026 plan change — [costbench](https://costbench.com/changelog/scenario-gg-plan-added-2026-10/)
- Older community MCP (`generate_image`, `remove_background`) also exists — [mcp.so](https://mcp.so/ja/servers/scenario-ai-mcp-server)

**Google (Imagen / Gemini image) via Gemini API**
- Imagen 4 Fast $0.02, Standard $0.04, Ultra $0.06 (disputed: up to ~$0.12) per image; Nano Banana (Gemini 2.5 Flash Image) $0.039; Nano Banana Pro ~$0.134 (1–2K) / $0.24 (4K); Nano Banana 2 figures vary $0.045–0.15 — [pricepertoken](https://pricepertoken.com/imagen-pricing); [perkstack tracker 2026-07-20](https://perkstack.co/blog/cheapest-nano-banana-api); [laozhang blog](https://blog.laozhang.ai/en/posts/gemini-3-pro-image-api-cost-per-image)
- Images carry an invisible SynthID watermark — [Google Developers Blog](https://developers.googleblog.com/ko/imagen-3-arrives-in-ai-studio)
- Google does not claim ownership; commercial use generally allowed subject to Prohibited Use Policy; no IP indemnity on Gemini API (Vertex AI offers indemnification) — [terms.law](https://terms.law/ai-output-rights/gemini/); [licenseorg](https://licenseorg.com/guide/ai-content/google-gemini-image)
- `@google/genai` 2.30.0 (2026-10-15) — [npm](https://www.npmjs.com/package/@google/genai) (observed)
- Community MCP `mcp-alphabanana` wraps Gemini image with transparent PNG/WebP via background removal — [Glama](https://glama.ai/mcp/servers/tasopen/mcp-alphabanana)

**OpenAI image API**
- Token-billed: image output ~$40 per 1M tokens; 1024² ≈ $0.011 low / $0.042 medium / $0.167 high (launch estimates $0.02/$0.07/$0.19) — [OpenAI community thread](https://community.openai.com/t/gpt-image-1-collected-pricing-information-and-why-responses-is-undocumented/1275254); [pricepertoken](https://pricepertoken.com/gpt-image-pricing)
- Third-party claim: gpt-image-1 retiring 2026-10-23, gpt-image-1.5 recommended (unverified) — [modelcompare](https://modelcompare.dev/zh-hans/models/openai/gpt-image-1)

**Leonardo**
- Consumer plans Essential $12, Premium $30, Ultimate $60/mo; paid plans include commercial rights; API billed separately (pay-as-you-go / "API Basic" $9/mo reported — conflicting) — [aiproductivity](https://aiproductivity.ai/pricing/leonardo/); [costbench](https://costbench.com/software/ai-media-apis/leonardo-ai-api/)
- Only community MCP servers found — [Glama](https://glama.ai/mcp/servers/@ish-joshi/leonardo-mcp-server/blob/7eb74b61add58ad98531a07644d56ff6b164053d/README.md); [mcp.so](https://mcp.so/servers/leonardo-ai-mcp-server?tab=config)

**fal.ai (aggregator)**
- Official hosted MCP at `mcp.fal.ai`, authorised with user's fal API key; tools include `search_models`, `get_model_schema`; catalogue 1,000+ models spanning image, video, audio, 3D — [fal MCP docs](https://fal.ai/docs/model-apis/mcp); [fal.ai/mcp](https://fal.ai/mcp)
- `@fal-ai/client` 1.10.1 (2026-10-06) — [npm](https://www.npmjs.com/package/@fal-ai/client) (observed)

**PixelLab** (already connected)
- MCP tool list in this session includes `create_ui_asset`, `create_font`, `create_image_pro`, `image_to_pixelart`, `reduce_colors`, `create_normal_map`, `create_building_kit`, `vfx_workbench`, `pixelart_workbench`; usage subject to PixelLab ToS; requires subscription with credit fallback — [PixelLab ToS](https://pixellab.ai/termsofservice)

### Inferences
- Project rule: icons must be pixel glyphs in `ui/pixelIcons.ts`, no curved SVG — so PixelLab `create_ui_asset` / `pixelart_workbench` (hand-precise) or Claude drawing glyph arrays in code are the compliant routes; Imagen/OpenAI best kept for reference/mood images that are then pixelated (`image_to_pixelart`, `reduce_colors`).
- fal.ai's single hosted MCP could replace several separate vendor accounts (Flux, Stable Audio, MusicGen-type models) for experiments, but each model's licence differs and must be checked per model.

### Gaps
- No official Leonardo API doc fetched; API licence terms unclear.
- OpenAI output-ownership terms and transparent-background parameter not confirmed in this pass.

## 6. MCP maturity summary (remote vs local) and environment observations

### Takeaway
As of Oct 2026, remote (hosted) MCPs exist for ElevenLabs, Scenario and fal.ai; Meshy's official MCP is local (hosted on roadmap); Blockade, Leonardo, Suno have no confirmed official MCP; PixelLab's MCP is already attached. Critically, this cloud container's egress proxy blocks most vendor hosts (elevenlabs.io, polyhaven.com, ambientcg.com, blockadelabs.com, help.scenario.com), so API/MCP use from Claude Code here requires adding those hosts to the environment's network allowlist and storing keys as environment secrets.

### Cited Findings
| Tool | MCP | Type | Source |
|---|---|---|---|
| ElevenLabs | Official, `https://api.elevenlabs.io/v1/mcp` (OAuth); local repo archived 2026-08-20 | Remote | [GitHub](https://github.com/elevenlabs/elevenlabs-mcp) |
| Scenario | Official, `https://mcp.scenario.com/mcp` (OAuth or API key) | Remote | [Scenario help](https://help.scenario.com/articles/2664328768-getting-started-with-the-scenario-mcp-server) |
| fal.ai | Official, `mcp.fal.ai` (API key) | Remote | [fal docs](https://fal.ai/docs/model-apis/mcp) |
| Meshy | Official `meshy-dev/meshy-mcp-server`, local; hosted planned | Local | [meshy.ai/mcp](https://www.meshy.ai/mcp) |
| Blockade Labs | Not confirmed (integrations page "MCP" = Blender add-on) | — | [Blockade integrations](https://www.blockadelabs.com/integrations) |
| Leonardo | Community only | Local | [mcp.so](https://mcp.so/servers/leonardo-ai-mcp-server?tab=config) |
| Gemini image | Community (`mcp-alphabanana`) | Local | [Glama](https://glama.ai/mcp/servers/tasopen/mcp-alphabanana) |
| PixelLab | Official, already connected (incl. vfx_workbench, git access to projects) | Remote | PixelLab MCP server instructions in session; [ToS](https://pixellab.ai/termsofservice) |
| three.quarks | Docs-search MCP only (not generation) | Remote | [DocSearch](https://docsearch.algolia.com/mcp/docs/repo/alchemist0823/three.quarks) |

Environment observations (first-hand, this container, 2026-10-20 — no external URL):
- `curl` to `api.polyhaven.com`, `ambientcg.com`, `elevenlabs.io` → proxy `CONNECT tunnel failed, response 403` ("host is not allowed for this session"); WebFetch also failed DNS for `api.blockadelabs.com`, `help.scenario.com`, `elevenlabs.io`, `docs.ambientcg.com`, `api-documentation.blockadelabs.com`.
- Proxy no-proxy/allowed list includes `registry.npmjs.org`, `pypi.org`, Anthropic hosts; npm queries worked.
- PixelLab `vfx_workbench` called from this subagent returned `401: Missing Authorization header` — the PixelLab MCP auth may not propagate to subagents (or token not configured), worth checking in the main session.
- GitHub API for non-attached repos returned 403 (repo access must be added via add_repo).

### Inferences
- Before any asset-generation sprint, the creator needs to (1) add vendor hosts to the cloud environment's network allowlist, (2) add API keys as environment secrets (never committed — matches CLAUDE.md secret rule), and (3) per CLAUDE.md, approve batch spend (check balance first, as with PixelLab).
- Remote MCPs (ElevenLabs/Scenario/fal) are configured at the claude.ai connector level; REST via Node SDKs (`@elevenlabs/elevenlabs-js`, `@google/genai`, `@fal-ai/client`, `openai`) is equally usable from scripts in `apps/citywalk/tools/` and is easier to make reproducible (prompt + seed + params saved in a JSON next to each asset).

### Gaps
- Could not verify whether claude.ai connector settings list ElevenLabs/Scenario/fal as installable connectors.
- No maturity data (uptime, rate limits) found for any hosted MCP.
