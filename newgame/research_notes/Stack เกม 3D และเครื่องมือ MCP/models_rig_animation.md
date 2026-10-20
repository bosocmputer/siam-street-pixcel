# AI tools for game-ready 3D models, auto-rigging and animation (as of 20 Oct 2026), and how Claude can call them

Context: the game is web-based (three.js, GLB) and runs on phones. The hero is a humanoid about 1.7 m tall, holding an iron pipe in the right hand. Monsters are slimes for now. The project rig (`packages/rpg-core/config/rig.json`) uses its own joint names (`Hips`, `UpperArm_R`, `Hand_R`, …), not Mixamo names. Other bone names are mapped through `joints`/`restFix` in `assets.json`.

Method note: from this cloud session the proxy refused WebFetch/curl to docs.meshy.ai, developers.tripo3d.ai and huggingface.co (DNS failure or 403 CONNECT). The npm and PyPI registries were reachable. Package READMEs read straight from those registries are the primary sources below. Most other facts come from web-search summaries, many of them third-party. Each finding is labelled with how strong its source is.

## 1. Model generation: which tools, prices, licences, formats, and which suit stylized low-poly mobile characters

### Takeaway
For an agent-driven pipeline, **Meshy** and **Tripo** are the only two that combine generation, auto-rig (Mixamo-style humanoid) and preset animation behind one REST API with official agent tooling.
- **Meshy:** an official MCP server, updated 13 Oct 2026.
- **Tripo:** an official CLI and JS SDK for its v3 API. Its official MCP server is an old alpha that needs Blender.

Both need a paid plan for commercial, private use:
- Meshy free output is CC BY 4.0, and its API needs Pro.
- Tripo free output is reportedly non-commercial.

Rodin's API needs the $96–120/month Business plan. Hunyuan3D and TRELLIS have open weights, but they need a GPU and carry licence problems: Hunyuan excludes the EU, UK and South Korea, and TRELLIS depends on NVIDIA libraries.

### Cited Findings

**Meshy (meshy.ai)**
- The official MCP server is `@meshy-ai/meshy-mcp-server`, MIT, repo `github.com/meshy-dev/meshy-mcp-server`. Latest version 0.6.4 was published 2026-10-13; first published 2026-04-03. Primary source: [npm registry](https://registry.npmjs.org/@meshy-ai/meshy-mcp-server).
- It has 28 tools, including `meshy_text_to_3d`, `meshy_image_to_3d`, `meshy_multi_image_to_3d`, `meshy_remesh`, `meshy_retexture`, `meshy_rig`, `meshy_animate`, `meshy_text_to_motion`, `meshy_list_animations`, `meshy_convert`, `meshy_uv_unwrap`, `meshy_check_balance` and `meshy_download_model`. Source: [npm README](https://registry.npmjs.org/@meshy-ai/meshy-mcp-server).
- Transport is stdio by default via `npx -y @meshy-ai/meshy-mcp-server`. It also has an HTTP mode (`TRANSPORT=http`, `POST /mcp`), so it can be self-hosted as a remote MCP server. It needs `MESHY_API_KEY`, and the README says the API key "requires Pro plan or above". Install for Claude Code: `claude mcp add-json meshy '{"command":"npx","args":["-y","@meshy-ai/meshy-mcp-server"],"env":{"MESHY_API_KEY":"msy_..."}}'`. Source: [npm README](https://registry.npmjs.org/@meshy-ai/meshy-mcp-server).
- There is also an official CLI, `@meshy-ai/cli` / `meshy-cli` v0.4.4 (2026-10-15). Source: [npm search](https://registry.npmjs.org/-/v1/search?text=meshy%20mcp).
- API credit costs, as listed in the MCP README (which links docs.meshy.ai/en/api/pricing):

  | Model | Mesh only | With 2K/4K texture | With 8K texture |
  |---|---|---|---|
  | meshy-7.1 / meshy-6 | 20 | 30 | 35 |
  | meshy-6-lite | 5 | 15 | (2K only) |
  | Smart Topology meshy-t2 / t2.5 | 5 | 15 | 20 |

  Other costs: remesh 5, rig 5, animate 3 per action (up to 10 actions per file), text-to-motion 10 ("prime", FBX) or 3 ("swift", BVH), retexture 10, convert 1, UV unwrap 5. Source: [npm README](https://registry.npmjs.org/@meshy-ai/meshy-mcp-server). The official API pricing page agrees on rig 5 and animation 3 per action: [Meshy API pricing](https://docs.meshy.ai/en/api/pricing), via search snippet.
- **Smart Topology** generates a clean, part-separated triangle mesh directly at a target face count, which suits mobile:
  - meshy-t2: 100–15,000 faces, default 4,000
  - meshy-t2.5: 100–30,000 faces, default 15,000

  The older `model_type: "lowpoly"` retires on 2026-10-30, and meshy-5 is retired. Source: [npm README](https://registry.npmjs.org/@meshy-ai/meshy-mcp-server).
- Plans:
  - Free: $0, 100 credits/month, output under CC BY 4.0 (commercial use with attribution), lower queue priority
  - Pro: $20/month or $240/year, 1,000 credits, API access, private assets
  - Studio: $60/month or $576/year
  - Enterprise: custom

  Source: [Meshy pricing page](https://meshy.ai/pricing) and [Meshy docs (DE) pricing](https://docs.meshy.ai/de/webapp/pricing), both via search snippets. One aggregator lists annual Pro at $192, which conflicts.
- Whether the free plan can download at all is disputed. A competitor (Ludo) claims free users cannot download any model as of Aug 2026; another listing says 10 downloads/month. Source: [Ludo comparison](https://ludo.ai/compare/meshy-alternatives), a competitor, so low trust. This matches the creator's experience that a rigged download needed Pro.
- The web app may show rigging and animation at 0 credits while the API charges 5 and 3. API credits may be "pay-before-you-go, separate from web subscription credits" (third-party claim). Source: [meshyiai.com (unofficial)](https://meshyiai.com/pricing/).
- Rigging needs a T-pose or A-pose; a non-standard pose offsets the bones. Dense or uneven topology causes clipping, so remesh first. The docs cover humanoid and quadruped; props and vehicles are not supported. The product page says bone names follow Mixamo conventions. Sources: [Meshy rigging guide](https://docs.meshy.ai/en/webapp/guides/3d-model/rigging), [Meshy AI Rigging page](https://www.meshy.ai/features/ai-auto-rigging), via search snippets.
- Formats: GLB, FBX, OBJ, USDZ, STL and 3MF are supported through convert. Source: [npm README](https://registry.npmjs.org/@meshy-ai/meshy-mcp-server). That README mentions 3MF; the others are from general Meshy docs, so treat them as unverified in detail.

**Tripo (tripo3d.ai, VAST)**
- The official JS/TS SDK is `@vastai/tripo-sdk` v0.3.0 (2026-09-18), MIT, for the **v3** REST API. Base URLs are `https://openapi.tripo3d.ai/v3` (international) and `openapi.tripo3d.com/v3` (China).
  - Endpoints include text-to-model, image-to-model, multiview-to-model, texture, convert (GLTF/FBX/OBJ/STL/USDZ/3MF), mesh/segment, mesh/decimate, animations/rig-check, animations/rig and animations/retarget.
  - Model URLs expire about 5 minutes after the task succeeds.

  Source: [npm @vastai/tripo-sdk README](https://registry.npmjs.org/@vastai/tripo-sdk).
- Rig details:
  - `rig` takes `spec: 'mixamo'` (Mixamo bone names) or `spec: 'tripo'`.
  - `rig-check` recommends a `rig_type`.
  - `retarget` takes up to 5 preset animations per call and outputs GLB.
  - The SDK's example pipeline is image-to-model with model P2 and `face_limit: 5000`, then rig-check, rig (mixamo), and retarget IDLE/WALK/RUN to GLB. The comments say the P series has clean low-poly topology suited to mobile and games.

  Source: [npm @vastai/tripo-sdk README](https://registry.npmjs.org/@vastai/tripo-sdk).
- The official CLI is `tripo-cli` v0.7.2 (2026-10-20), MIT, repo vast-enterprise/Tripo-API-CLI. It is "agent-native": non-TTY runs are headless JSON. It has scenario presets (`--for game-mobile`) and chains such as `tripo make knight.png --for game-mobile --then texture,rig,convert:fbx`.
  - Model aliases: `tripo-p1` (P1-20260311, low-poly, chosen when the face budget is ≤20,000), `tripo-v3.1` (v3.1-20260211), and `tripo-p2` preview (P2-20260801, quad low-poly).
  - It prints a cost plan card before spending, and has a `tripo login` device flow that suits agents.

  Source: [npm tripo-cli README](https://registry.npmjs.org/tripo-cli).
- The official MCP server is `VAST-AI-Research/tripo-mcp`, MIT, about 219 stars, 8 commits, PyPI `tripo-mcp` 0.1.2 released 2025-04-12. It is **alpha and works only through the Tripo Blender add-on**, so it needs Blender on the user's computer. Sources: [GitHub](https://github.com/VAST-AI-Research/tripo-mcp) and [PyPI](https://pypi.org/pypi/tripo-mcp/json). A community server `lixmal/tripo-mcp` exposes rig and retarget using API credits: [GitHub](https://github.com/lixmal/tripo-mcp), via search snippet. Another community npm package is `tripo-ai-mcp-server` 1.1.0 (2026-04-27): [npm search](https://registry.npmjs.org/-/v1/search?text=tripo%20mcp).
- API pricing: 1 credit = $0.01. Rig-check is free, auto-rig is 25 credits ($0.25), animation retarget is 10 credits ($0.10) per animation. 100+ preset motions; animation and retarget tasks are limited to 3 in parallel. Sources: [Tripo developers pricing](https://developers.tripo3d.ai/en/pricing) and [Tripo rigging](https://developers.tripo3d.ai/en/models/rig), via search snippets. I could not read the generation credit cost per model.
- **Deprecation:** all V2 endpoints stop serving on 1 Nov 2026, so use v3 tools only. Source: [Tripo docs pricing](https://docs.tripo3d.ai/get-started/pricing.html), via search snippet.
- Web plans:
  - Free: 200–300 credits/month; output CC BY 4.0, "not licensed for commercial use" according to one review
  - Professional: $19.90/month ($11.94/month billed annually), 3,000 credits, commercial rights and private models

  Sources: [MakerStack review](https://makerstack.co/reviews/tripo-3d-review/), [Vantaige](https://vantaige.io/ai-tool/tripo-ai). The top tier reportedly rose to $329.70/month on 24 Aug 2026 (unverified): [CostBench](https://costbench.com/changelog/tripo-ai-price-increase-2026-08/).
- Reviewers favour Tripo for game pipelines. One reports a low-poly step cutting about 900k faces to about 7k, with quad topology that deforms better. These are vendor-adjacent sources. Source: [3D AI Studio comparison](https://www.3daistudio.com/blog/rodin-2-5-vs-tripo-vs-hunyuan-3d-comparison), [Ludo guide](https://ludo.ai/compare/best-ai-3d-model-generators).

**Hyper3D Rodin (hyper3d.ai, Deemos)**
- API access is only on the Business plan: $120/month, or $1,152/year (about $96/month). Enterprise is custom. Extra credits cost $1.5 each, and the rate limit is 120–240 requests/minute. Source: [hyper3d.ai/pricing](https://hyper3d.ai/pricing), via search snippet.
- A Gen-2 model costs an estimated 40 credits per download. Business reportedly includes 208 credits/month (unverified). Source: [CostBench](https://www.costbench.com/software/ai-3d-generation/rodin-hyper3d/).
- The commercial licence scope is unclear. The official page says "unlimited export and any use" from the Creator plan upward; third parties differ. Sources: [hyper3d.ai/pricing](https://hyper3d.ai/pricing), [VideoSDK listing](https://www.videosdk.live/ai-apps/hyper3d).
- There is no auto-rig; reviewers say it has the "cleanest geometry, no rigging". Source: [Ludo guide](https://ludo.ai/compare/best-ai-3d-model-generators). It can also be reached through MCP for Blender (section 4).

**Tencent Hunyuan3D (open weights, 2.0 / 2.1 / later)**
- The licence is the Tencent Hunyuan 3D Community License, and its Territory excludes the **EU, UK and South Korea**. Source: [2.1 LICENSE mirror](https://gitserver.onethingai.com/ai-models/Hunyuan3D-2.1/raw/branch/main/LICENSE), [HF 2.0 LICENSE](https://huggingface.co/tencent/Hunyuan3D-2/blob/main/LICENSE).
- Commercial use may be capped at 1M monthly active users (2.0 summary, secondary). Source: [DeepWiki](https://deepwiki.com/Tencent/Hunyuan3D-2/9-license-and-terms).
- Hosted API: a reseller lists about $0.02/generation (Atlas Cloud). I found no official Tencent Cloud price. Source: [Atlas Cloud](https://www.atlascloud.ai/providers/tencent).
- Reviewers call it the best for "maximum visual quality" but slower. Source: [3D AI Studio](https://www.3daistudio.com/blog/rodin-2-5-vs-tripo-vs-hunyuan-3d-comparison).

**Microsoft TRELLIS.2**
- The code and weights are MIT, 4B parameters, image-to-3D. However, it depends on NVIDIA nvdiffrast/nvdiffrec, which are under the NVIDIA Source Code License (research or evaluation only). Commercial use is therefore unclear. Sources: [CGWorld JP](https://cgworld.jp/flashnews/01-202601-TRELLIS2.html), [DeepWiki legal](https://deepwiki.com/microsoft/TRELLIS.2/9-legal).
- NVIDIA hosts a NIM endpoint: [NVIDIA NIM docs](https://docs.api.nvidia.com/nim/re/reference/microsoft-trellis).

**Stability Stable Fast 3D / SPAR3D**
- Both are under the Stability AI Community License: free commercial use below $1M annual revenue, with an enterprise licence above that. Sources: [Stability license](https://stability.ai/license), [SF3D model card](https://huggingface.co/stabilityai/stable-fast-3d), [The Decoder on SPAR3D](https://the-decoder.com/?p=20394).
- They are fast single-image models for props, with no rigging.

**Others (thin data)**
- Luma Genie, CSM and Kaedim appear live in 2026 aggregator listings. No shutdown notices were found, but there are also no confirmed API prices. Sources: [CostBench CSM vs Genie](https://www.costbench.com/compare/csm-vs-luma-genie/), [AlternativeTo Genie](https://alternativeto.net/software/luma-ai-genie).
- Scenario's "Genie" is a chat assistant that can generate 3D (a different product from Luma Genie). Source: [Scenario](https://www.scenario.com/features/Scenario-genie).
- Sudo AI: nothing found.

### Inferences
- **Best fit for an agent-driven pipeline:**
  - Tripo v3 (via `tripo-cli` or the SDK over HTTP) with model P1/P2 and `face_limit` ≈ 5k for the hero, then `rig spec: mixamo`.
  - Meshy (official MCP or REST) with Smart Topology meshy-t2 at about 4k faces, then rig.

  Both return GLB with Mixamo-like bone names. These map onto the project rig through `joints`/`restFix`, as is already supported.
- **Pick the hero source by A/B test, not by reviews.** No source tested anime or stylized characters head-to-head. Run the same front-facing A-pose concept image through Meshy-t2 and Tripo P1/P2 (a few dollars) and compare with `check-model`.
- **Slimes:** the game already draws slimes procedurally (code plus squash), so they need no AI model or rig. Use AI generation later for props and non-slime creatures.
- **Avoid for this project:**
  - Hunyuan3D and TRELLIS weights: no GPU in the container, plus licence risk. Hunyuan's licence would bar a worldwide web release from serving the EU and UK.
  - Rodin: $96–120/month just to get API access, and no rigging.

### Gaps
- I could not read Tripo's per-generation credit cost for P1/v3.1, or the official text of the Meshy and Tripo terms of service. The proxy blocked the docs sites.
- I did not confirm whether a Meshy API key on Pro draws on the 1,000 subscription credits or needs separately bought API credits.
- No source covers how Meshy or Tripo auto-rigs handle a weapon held in the hand. The recommended path is to generate the hero empty-handed and attach the pipe as a separate GLB to a `Hand_R` socket, as the project rules already require (outfit pieces in separate files).
- I found no data on Sudo AI, or on current Kaedim and CSM APIs and prices.

## 2. Auto-rigging options

### Takeaway
- **For a cloud agent:** built-in rigging in Meshy (5 credits) or Tripo (25 credits ≈ $0.25) is the only fully API-driven route.
- **Free, human in the loop:** Mixamo and AccuRIG are free but GUI-only. Mixamo is unmaintained and fragile.
- **Fully free and deterministic:** Blender Rigify or a script can run headless in the container through PyPI `bpy`, with no GPU or display. That fits the project's existing code-built rig.

### Cited Findings
- **Mixamo (Adobe):** still online and free in 2026. Characters and animations may be used royalty-free in commercial projects, including games. Raw files may not be resold. An Adobe ID is needed.
  - It is "not actively maintained", and the auto-rigger and account page have been intermittently broken since a mid-2025 outage.
  - There is no official API.

  Sources: [Cinevva 2026 guide](https://app.cinevva.com/guides/game-assets-guide), [AssetForgeIndex](https://assetforgeindex.com/tools/mixamo), [Adobe community thread](https://community.adobe.com/questions-696/mixamo-license-589295). All secondary; check mixamo.com FAQ.
- **Meshy rig:** 5 credits via the API; humanoid and quadruped; needs T/A-pose; Mixamo naming. Sources: [npm README](https://registry.npmjs.org/@meshy-ai/meshy-mcp-server), [Meshy rigging docs](https://docs.meshy.ai/en/webapp/guides/3d-model/rigging).
- **Tripo rig:** rig-check free, rig 25 credits, `spec: mixamo|tripo`. Sources: [Tripo pricing](https://developers.tripo3d.ai/en/pricing), [@vastai/tripo-sdk](https://registry.npmjs.org/@vastai/tripo-sdk).
- **Reallusion AccuRIG 2:** free desktop app. Commercial use is allowed (forum statement by a Reallusion admin). Exports FBX and USD; needs a free ActorCore account. AccuRIG 2 gives in-app access to 4,500+ ActorCore motions, which are paid. No API. Sources: [Reallusion forum](https://forum.reallusion.com/551972/reallusion-Accu-Rig-Free), [AccuRIG 2 press release](https://technode.global/prnasia/accurig-2-debuts-direct-in-app-access-to-4500-actorcore-motions/).
- **Anything World (Animate Anything):**
  - Rigs humanoids, quadrupeds, insects, fish and birds, and exports FBX/GLB.
  - No finger bones or props; a 2023 article says it suits lower-detail models.
  - Has a REST API.
  - Pricing found: free 3–20 credits/month, Micro $50/month, Pro $250/month. The sources are old or aggregators.

  Sources: [CG Channel](https://www.cgchannel.com/?p=150924), [Anything World API](https://Anything.World/anything-world-apis), [indexator](https://dev.indexator.ai/companies/anything-world-ai-3d-model-generator).
- **Uthana:** the Python client says it can "create and auto-rig characters" as well as generate motion. Source: [PyPI uthana 0.5.1](https://pypi.org/pypi/uthana/json).
- **Headless Blender:** PyPI `bpy` 5.2.2 (2026-09-15) ships a manylinux x86_64 wheel for Python 3.13, under GPL-3.0. It can run Rigify or custom armature scripts with no display. Source: [PyPI bpy](https://pypi.org/pypi/bpy/json).
- **Rokoko:** no auto-rig API found. Pro lists an "Advanced command API", which is a control interface. Source: [Rokoko pricing](https://rokoko.com/pricing/).

### Inferences
- The project already builds its rig in code (`tools/character/`) and maps foreign bones through `joints`/`restFix`. That makes the cheapest robust path to rig the hero through Meshy or Tripo once (about $0.05–0.25), or to bind with `bpy` in the container, and then validate with `check-model`.
- Auto-Rig Pro is a paid Blender add-on that needs the Blender GUI or a licence on the user's machine. Using it through the community MCP for Blender would need the user's own computer.

### Gaps
- I did not verify the current text of Mixamo's FAQ or the AccuRIG 2 EULA.
- Anything World's 2026 API price list was not found.

## 3. Animation sources, APIs and one-handed melee packs

### Takeaway
- **Best free source for this game:** Quaternius **Universal Animation Library 2** (Jan 2026, CC0) explicitly includes melee and armed 3- and 4-hit combos split into separate hits plus recoveries, on one humanoid rig, in GLB-friendly exports.
- **APIs Claude can call:** Meshy's `animate` (preset library) and `text_to_motion`, Tripo `retarget` (100+ presets), and Uthana (GraphQL API with official Python/JS clients). DeepMotion's API pricing is sales-only.
- **No API:** Cascadeur, Rokoko Vision, Plask and Move.ai are desktop or web tools.

### Cited Findings
- **Quaternius UAL1:** 120+ animations on a universal humanoid rig. The Standard (free) set is 45 animations, with melee and combat tags. Licence CC0; a paid Source version includes the .blend. Sources: [Quaternius](https://quaternius.com/packs/universalanimationlibrary.html), [OpenGameArt](https://opengameart.org/content/universal-animation-library).
- **Quaternius UAL2 (January 2026):** 130+ animations covering "melee and armed combos", parkour and more. It has "3 and 4 hit combos, split into separate hits with their recoveries, and full combo anims". The free Standard version is about 70% of the content (9.7 MB zip). CC0. Exports tested in Godot, Unity and Unreal. Sources: [Digital Production](https://digitalproduction.com/2026/02/10/130-animations-one-rig-zero-drama/), [80.lv](https://80.lv/articles/get-this-animation-asset-library-with-over-130-diverse-items), [itch.io](https://quaternius.itch.io/universal-animation-library-2), [OpenGameArt UAL2](https://opengameart.org/content/universal-animation-library-2).
- **Mixamo library:** free and commercial-OK (see section 2). It has sword-and-shield and other melee sets, but I found no source listing the current pack contents.
  - Retargeting to non-Mixamo GLB rigs in three.js commonly hits rest-pose and axis mismatches: mirrored arms, "lying on its back", stretched bones.
  - The usual fixes are matching the rest pose and using SkeletonUtils.retarget or careful Blender export.

  Sources: [Ready Player Me forum](https://forum.readyplayer.me/t/working-on-animations-testing-rpm-armature-mixamo-retargetting-for-web-app/3668), [three.js forum](https://discourse.threejs.org/t/fixing-skeletonutils-retarget-and-retargetclip-functions/65149/2), [Godot forum](https://forum.godotengine.org/t/retargeting-mixamo-animations-fails/39619).
- **Meshy animation:** 3 credits per preset action, up to 10 clips per file. Text-to-motion costs 10 credits (prime, FBX) or 3 (swift, BVH). One third-party source says the library is capped at 20 animations on Free versus 500+ paid. Sources: [npm README](https://registry.npmjs.org/@meshy-ai/meshy-mcp-server), [toolradar (unverified)](https://toolradar.com/tools/meshy/pricing).
- **Tripo retarget:** 10 credits ($0.10) per animation, 100+ presets, up to 5 per call (SDK). Sources: [Tripo pricing](https://developers.tripo3d.ai/en/pricing), [@vastai/tripo-sdk](https://registry.npmjs.org/@vastai/tripo-sdk).
- **Uthana:**
  - GraphQL API at uthana.com/graphql, with official clients `uthana` (PyPI 0.5.1, 2026-09-21, Apache-2.0) and `@uthana/client` (npm 0.5.1).
  - Covers text-to-motion and video-to-motion.
  - Downloads GLB, FBX or BVH with in-place and speed options.
  - The client says it can feed "MCP servers".
  - `text-to-motion-3.0` is in limited release since 15 Jun 2026 (access by request).

  Pricing on its page is unclear: snippets show "$1,920 billed yearly" and an "Enterprise $660/month", plus pay-as-you-go. Sources: [PyPI uthana](https://pypi.org/pypi/uthana/json), [npm @uthana/client](https://registry.npmjs.org/@uthana/client), [Uthana changelog](https://uthana.com/docs/api/changelog), [Uthana pricing](https://uthana.com/pricing).
- **DeepMotion (Animate 3D video mocap; SayMotion text-to-motion):** 1 credit = 1 second of animation. Aggregator tiers: Free (25–60 credits), Starter $15/month (180 credits, commercial licence), Innovator $38–48/month, Professional $117/month. API and SDK pricing require contacting sales. Sources: [SoftwareSuggest](https://www.softwaresuggest.com/deepmotion/pricing), [toolradar](https://toolradar.com/tools/deepmotion). All third-party and conflicting.
- **Cascadeur (AI-assisted keyframing and AutoPosing, desktop app):** Free is non-commercial with .casc export only. Indie (under $100k/year revenue) is $19/month or $96/year with FBX/DAE export. Pro is $49/month or $396/year. No API. Sources: [Cascadeur plans](https://cascadeur.com/payment/tariffs/), [Capterra](https://www.capterra.com/p/10015822/Cascadeur/).
- **Rokoko Vision (video mocap):** Free Starter tier gives 30 seconds/month; Basic 600 seconds/month; Plus 3,000 seconds/month. Source: [Rokoko pricing](https://rokoko.com/pricing/).
- **Plask:** free single-person tier; Standard from $18/month. Source: [RenderHub](https://www.renderhub.com/blog/budget-motion-capture-options-worth-considering).
- **Move.ai and Kinetix:** no reliable 2026 pricing or API data found. Source: [RenderHub](https://www.renderhub.com/blog/budget-motion-capture-options-worth-considering).
- **Tencent HY-Motion 1.0** (open text-to-motion model) has the same EU/UK/South Korea territory exclusion. Source: [GitHub issue](https://github.com/Tencent-Hunyuan/HY-Motion-1.0/issues/49).
- **Fab (Epic):** the Standard License allows use "with any compatible tools (not limited to Unreal Engine)", including commercial games. It forbids standalone redistribution. UE-only content from Epic and assets that rely on UE code are excluded. Some assets come only in uasset format and would need converting. Sources: [Fab CLA](https://www.fab.com/cla), [CG Channel](https://www.cgchannel.com/2024/11/epic-games-to-share-new-free-assets-on-fab-every-two-weeks), [UE forum](https://forums.unrealengine.com/t/update-on-products-generated-with-ai/2451166).

### Inferences
- The project rule is that hero moves are written in code (`src/hero.ts`, `src/anim/clips.ts`). AI or mocap clips are therefore best used as **reference or a starting point**, retargeted to `rig.json` names and then baked or hand-tuned into code clips. This is more useful than shipping them raw. UAL2's split hits-plus-recoveries match the existing 3-hit pipe combo.
- For an iron pipe (one-handed blunt weapon), sword or club one-hand combos from UAL2 or Mixamo are the closest match. The pipe should be a separate GLB parented to a `Hand_R` socket, not baked into the mesh.

### Gaps
- I did not see the exact clip list of the UAL2 Standard (free) zip, including which clips are one-handed weapon clips.
- I could not confirm Uthana's per-second API price or DeepMotion's API price.
- I could not confirm current Mixamo melee pack names.

## 4. MCP servers (official vs community, remote vs local) and how Claude Code in a cloud container could call each tool

### Takeaway
- The only **official, actively maintained 3D-generation MCP** is Meshy's: v0.6.4, 13 Oct 2026, stdio plus optional HTTP.
- Tripo's official MCP is an alpha that needs Blender. Tripo's agent route is really the official `tripo-cli` and SDK.
- MCP for Blender (the community project formerly called blender-mcp; tens of thousands of downloads, updated 20 Oct 2026) bridges Rodin and Hunyuan3D. It needs Blender running with a GUI add-on, so it is a local route on the user's computer.
- No hosted remote MCP (a URL for a claude.ai connector) from Meshy, Tripo, Rodin, Uthana or DeepMotion was found.

### Cited Findings

| Tool | Agent access | MCP status (Oct 2026) | Where it runs |
|---|---|---|---|
| Meshy | REST `api.meshy.ai`, official CLI | **Official** `@meshy-ai/meshy-mcp-server` 0.6.4 (2026-10-13), MIT, 28 tools, stdio or HTTP ([npm](https://registry.npmjs.org/@meshy-ai/meshy-mcp-server)) | Local via npx (works in the Claude Code container if `api.meshy.ai` is allowed), or self-hosted HTTP for remote use |
| Tripo | REST v3 `openapi.tripo3d.ai/v3`, official SDK `@vastai/tripo-sdk` and CLI `tripo-cli` 0.7.2 ([npm](https://registry.npmjs.org/tripo-cli)) | Official `tripo-mcp` 0.1.2 is alpha and needs the Blender add-on ([GitHub](https://github.com/VAST-AI-Research/tripo-mcp)). Community: `lixmal/tripo-mcp`, `tripo-ai-mcp-server` 1.1.0 | The CLI is headless and agent-native, so it suits the container. The official MCP only works on a desktop with Blender |
| Hyper3D Rodin | REST API (Business plan) | No standalone official MCP found. Reachable through MCP for Blender ([sources](https://www.mcp-for-blender.com/premium)) | User's desktop |
| Hunyuan3D | Open weights (GPU), reseller APIs | Through MCP for Blender | Desktop or GPU host |
| MCP for Blender (formerly blender-mcp) | — | Community (not Blender Foundation), MIT. PyPI `mcp-for-blender` 2.2.1 published 2026-10-20 ([PyPI](https://pypi.org/pypi/mcp-for-blender/json)). Reported 17k–22k GitHub stars ([Enterprise DNA](https://enterprisedna.co/directories/mcp/ahujasid-blender-mcp)). Includes Poly Haven, Sketchfab, Hyper3D and Hunyuan3D integrations. Has an `execute_blender_code` tool that runs arbitrary Python ([augmentcode](https://www.augmentcode.com/mcp/blender-mcp)) | Local stdio plus the Blender add-on on the user's computer |
| Uthana | GraphQL API plus official Python/JS clients | No official MCP found; the client mentions use from MCP servers ([PyPI](https://pypi.org/pypi/uthana/json)) | REST from the container |
| DeepMotion, Cascadeur, Rokoko, Plask, Move.ai, Mixamo, AccuRIG | Web or desktop GUI (DeepMotion API sales-only) | None found | Human operates |

Further notes on MCP for Blender:
- Its free tier is bring-your-own Rodin or Hunyuan keys.
- Paid plans are Hobby $10/month and Pro $20/month and bundle generation credits; Rodin is only on the higher tiers.

Source: [mcp-for-blender.com/premium](https://www.mcp-for-blender.com/premium), via search snippet.

### Inferences
- **In this cloud session:** WebFetch and curl to docs.meshy.ai and developers.tripo3d.ai were refused by the session proxy. The API hosts (`api.meshy.ai`, `openapi.tripo3d.ai`) would probably need adding to the environment's allowed network hosts before Claude Code could call them. Then:
  - The API keys (`MESHY_API_KEY`, `TRIPO_API_KEY`) must go in environment secrets, never in the repo, per the repo's secrets rule.
  - Meshy's MCP can run under `npx` inside the container, or Claude can call the REST APIs directly.
- **claude.ai remote connector:** possible only by self-hosting Meshy's MCP in HTTP mode behind a URL with auth, which is extra infrastructure. No vendor-hosted remote MCP was found.
- **Blender-based routes** (Tripo official MCP, Rodin, Hunyuan via MCP for Blender) need the creator's own computer with Claude Desktop and Blender installed. That is a poor fit for a non-technical creator. Headless `bpy` in the container is the scriptable alternative for rig and cleanup tasks.

### Gaps
- I did not check GitHub stars or last commit for meshy-dev/meshy-mcp-server or lixmal/tripo-mcp; GitHub API access was not enabled for this session.
- I did not confirm whether Meshy or Tripo offer a hosted remote MCP URL. None was mentioned in the READMEs.

## 5. Typical cost for 1 hero + 10 monster types + 30 animations

### Takeaway
At published API rates, **raw generation, rig and animation for this scope cost about $10–$60 in credits**. In practice a **$20–60 subscription for 1–2 months** is enough, because of retries and the minimum plan that unlocks the API and commercial rights.
- Meshy Pro: $20/month, 1,000 credits
- Tripo Professional: $19.90/month, 3,000 credits
- Free animation sources (Quaternius CC0, Mixamo) can cover most of the 30 clips at $0.

The real cost is human and agent cleanup time: topology checks, `check-model`, the weapon socket, and turning clips into code.

### Cited Findings
- **Meshy unit costs (credits):**
  - meshy-7.1 textured: 30
  - Smart Topology textured: 15
  - rig: 5
  - animation: 3 per action
  - text-to-motion: 10 or 3

  Source: [npm README](https://registry.npmjs.org/@meshy-ai/meshy-mcp-server). Pro gives 1,000 credits for $20 (about $0.02 per credit at subscription value). Source: [Meshy pricing](https://meshy.ai/pricing).
- **Tripo unit costs:** rig $0.25, retarget $0.10 per animation (1 credit = $0.01). Source: [Tripo pricing](https://developers.tripo3d.ai/en/pricing).
- **Free animation sources:** Quaternius UAL1/UAL2 CC0 ([itch.io](https://quaternius.itch.io/universal-animation-library-2)); Mixamo free ([AssetForgeIndex](https://assetforgeindex.com/tools/mixamo)).

### Inferences
Worked example on Meshy, assuming about 3 attempts per model:

| Item | Calculation | Credits |
|---|---|---|
| Hero | 3 × 15 (Smart Topology) + 5 (rig) | ≈ 50 |
| 10 monsters | 10 × 3 × 15–30 | 450–900 |
| 30 hero animations | 30 × 3 preset, or a mix with 10-credit text-to-motion | 90–300 |
| **Total** | | **≈ 600–1,250 credits** |

That is 1–2 months of Pro ($20–40) or one month of Studio ($60).

The same on Tripo would be about $3 in animation retargets plus a $0.25 rig, plus generation credits (per-model price not verified). That fits in one Professional month ($19.90).

Notes on scope:
- Slimes are procedural in code, so they need no rig. The 10 monster models only matter for future non-slime creatures.
- Non-humanoid monsters may need quadruped or "smart-rig" rigging, or code animation.
- A tool-free route costs $0 in money but more time: Quaternius CC0 clips, Mixamo for references, headless `bpy` for rigging, and the existing code-built character.
- Rodin or Hunyuan add $96–120/month (Rodin Business) or GPU hosting and licence risk. Not recommended at this stage.

### Gaps
- Tripo P1/v3.1 generation credit prices were not verified.
- Retry rates (how many generations it takes to get a usable stylized character) are not documented anywhere; the 3× figure is an assumption.
- Commercial-licence fine print for both vendors (whether ownership survives cancelling the subscription, and attribution) was not read from the official terms of service.
