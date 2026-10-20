# Real-world AI-agent 3D game workflows (2025-2026): case studies, pipelines, pitfalls

> Method note (read first): researched 20 Oct 2026. In this container, page fetching (WebFetch/curl) was blocked by the egress proxy (DNS/403 for dev.to, syntystore.com, developers.poki.com). So every finding below comes from search-engine result summaries of the cited pages, not full reads. Numbers that matter for decisions (licence clauses, portal size limits) should be re-checked on the official page before acting. Many hits were vendor/SEO blogs (cinevva, strayspark, meshy, tripo); they are marked as such.

## 1. Case studies: who built 3D games mostly with AI agents, with what stack and assets, and with what results

### Takeaway
The best-known success, Pieter Levels' fly.pieter.com, was a very simple three.js browser game built with Cursor. It made money from in-game ad slots, which worked because Levels already had a large audience on X, not because the game had high production values. Jam winners were small browser games with one clear hook. I found no well-documented commercial 3D action RPG that was built mostly by an AI agent and shipped to a polished standard.

### Cited Findings
**fly.pieter.com (Pieter Levels, launched Feb-Mar 2025)**
- Built with Cursor + three.js from an initial prompt in roughly three hours as a multiplayer browser flight sim. — [404 Media](https://404media.co/this-game-created-by-ai-vibe-coding-makes-50-000-a-month-yours-probably-wont); [DEV Community](https://dev.to/promptway/he-built-a-flight-simulator-in-three-hours-and-hit-1m-a-year-in-17-days-then-it-went-to-zero-1b1l)
- Monetisation was ads sold directly as in-world objects (blimps, planets, planes), not ad networks. After 10 days, Levels posted "19x Blimps sold at various prices = $38,000/mo + 12x F16's sold @ $29.99 = ~$360", with about 16,000 players that day. — [@levelsio on X](https://x.com/levelsio/status/1896690611257844116?lang=en); [Ben's Bites on X](https://x.com/bensbitesdaily/status/1898394885608079412)
- Later posts: a record of 22,000 players in a day. He capped ad slots ("6 slots left and then it's full") so the game would not be overloaded with ads. — [@levelsio on X](https://x.com/levelsio/status/1898894090466427386)
- Reported peak: $87,000 MRR (about $1M ARR) at 17 days, 320,000 users, and 74M impressions. These figures are self-reported and not audited. — [DeepNewz](https://deepnewz.com/startups/pieter-levels-ai-coded-flying-game-hits-87000-mrr-1-million-arr-320000-users-74-222303f7); [builtwithagents.ai](https://www.builtwithagents.ai/strategy/vibe-coded-flight-sim-1m-arr-17-days)
- Critical view: 404 Media's headline is "makes $50,000 a month, yours probably won't". The success depended on Levels' audience and on Elon Musk sharing the game. A 2026 analysis is titled "It Took 10 Years of Setup", meaning the audience Levels had built over a decade. — [404 Media](https://404media.co/this-game-created-by-ai-vibe-coding-makes-50-000-a-month-yours-probably-wont); [KODiQ](https://kodiq.ai/article/ai-news-2026-05-19-pieter-levels-flight-sim-1m-arr-17-days/)
- A DEV Community article is titled "...hit $1M a year in 17 days. Then it went to zero". I could not open it to check what "zero" refers to (revenue, players or ad sales), so the decline is unverified. — [DEV Community](https://dev.to/promptway/he-built-a-flight-simulator-in-three-hours-and-hit-1m-a-year-in-17-days-then-it-went-to-zero-1b1l)
- Concurrent player figures conflict between sources: 17k, 26k and "89K players" all appear. — [avgeekery](https://avgeekery.com/new-flight-simulator-made-with-ai-earns-creator-5000-per-month/); [builtwithagents.ai](https://www.builtwithagents.ai/strategy/vibe-coded-flight-sim-1m-arr-17-days)

**2025 Vibe Coding Game Jam (organised by Levels)**
- Rules: at least 80% of the code and assets had to be AI-generated, and games had to be free and playable in a browser. 1,170 games were submitted. Sponsors were Bolt.new, CodeRabbit and Lambda. — [Indie Hackers](https://www.indiehackers.com/post/Uz0wHG4pI3KBOiFhP5YR)
- Winners: 1st was "The Great Taxi Assignment" by Tomas Bencko ($10k, a GTA-like taxi sim). 2nd was "Vibeware" by Matt Gordon ($5k). 3rd was "Vector Tango" by Scoble ($2.5k, air-traffic control). — [Indie Hackers](https://www.indiehackers.com/post/Uz0wHG4pI3KBOiFhP5YR)
- One site claims "10,000+ submissions". This conflicts with the 1,170 figure and the site looks low quality. — [CO/AI](https://getcoai.com/video/the-best-ai-made-videogames-2025-vibe-coding-game-jam/)

**Cursor Vibe Jam 2026**
- three.js was the recommended engine, but any engine was allowed. Cursor was the main sponsor. The official page lists prizes of $25k/$10k/$5k plus 12 special prizes of $1k; an older snapshot lists $35k in total. — [vibej.am/2026](https://vibej.am/2026/); [jam.pieter.com/2026](https://jam.pieter.com/2026/); [press](https://vibej.am/2026/press)
- The jam has ended. Colyseus reported 945 submissions, of which 48 (about 1 in 7 multiplayer games) used its multiplayer library. — [Colyseus blog](https://colyseus.io/blog/vibe-jam-2026/)

**Other build logs**
- A 1v1 multiplayer three.js FPS built with Grok 3 + Cursor grew to about 5,000 lines. The author: "there are known bugs but it is surprising that it worked at all". This is a build log, not a postmortem. — [Tejas Kulkarni Substack](https://tejaskulkarni.substack.com/p/vibe-coding-a-3d-game-using-ai)
- An a16z partner: you can't just "spin up Cursor, input 'make flappy birds,' and one shot a game, at least not yet." — cited via [cinevva guide](https://app.cinevva.com/guides/vibe-coding-games)

**Industry-wide AI use (context)**
- As of 13 Jul 2025, 7,818 of about 114,126 Steam games (about 7%) disclosed generative AI use, about 20% of 2025 releases did, and there were about 1,000 in 2024. About 60% of disclosures were for visual assets. This is a minimum, because disclosure is self-reported. — [VGC](https://www.videogameschronicle.com/news/steam-games-disclosing-generative-ai-use-are-up-800-this-year/); [Insider Gaming](https://insider-gaming.com/nearly-20-of-new-steam-games-in-2025-use-generative-ai/)
- About 1,700 of about 8,600 demos in a Steam Next Fest (about 20%) had an AI disclosure. The date of that Next Fest is unclear. — [letsdatascience](https://letsdatascience.com/news/over-1000-steam-next-fest-games-disclose-generative-ai-6c11ab90)
- Engine MCP context: Slay the Spire II moved from Unity to Godot after the 2023 runtime-fee controversy. This was an engine choice, not AI-built. — [Wikipedia](https://en.wikipedia.org/wiki/Slay_the_Spire_II)

### Inferences
- What succeeded with AI was scope discipline plus distribution. Every visible winner had one mechanic, loaded instantly in a browser, and looked simple and cohesive. None was a content-heavy RPG.
- The fly.pieter.com ad model (brands placed as in-world objects) is the opposite of a story RPG set in a real city. It also connects to this project's rule against using institutions or religious sites. If real Chiang Mai shops ever appear as sponsored storefronts, that is a design and ethics decision for the creator.
- For a solo non-programmer, the gap between demo and shippable comes from content volume and polish (animation, art consistency, UI, onboarding, performance), not from the AI's ability to write code. In the jam, AI produced 80% or more of the code and assets, yet the results were still jam-scale.

### Gaps
- I found no detailed postmortem of a commercial 3D action RPG built mostly with Claude Code or Cursor, and no retention or revenue data beyond the first weeks for fly.pieter.com.
- I could not verify whether the 2025 jam winners used bought asset packs or AI-generated assets, or what their player numbers were.
- I found no winners list for Vibe Jam 2026.
- I could not check the 404 Media and DEV articles in full (fetching was blocked).

## 2. Running Claude Code locally vs in the cloud for game dev (MCP servers, Remote Control, hardware)

### Takeaway
All engine and tool MCPs (Blender, Unity, Unreal, Godot) talk to a desktop application running on the user's own computer. They cannot run in this cloud container, which has no GPU and no display. Claude Code "Remote Control" keeps the session on the user's PC, with local MCPs available, and lets it be driven from claude.ai or the phone app. A three.js + glTF pipeline needs none of these MCPs; that is its main advantage for this project.

### Cited Findings
- Official docs: in Remote Control, "your local filesystem, MCP servers, tools, and project configuration remain available". Remote Control sessions run on your machine, unlike cloud sessions. It is started with `--remote-control`/`--rc` or `/remote-control` in the desktop app's Code tab. It needs Claude Code v2.1.273 or later. — [Claude Code Docs: Remote Control](https://code.claude.com/docs/en/remote-control)
- A local stdio MCP server is a program Claude Code starts as a subprocess on your machine. Cloud sessions load MCP setup from a committed `.mcp.json`, not from local config. — [Claude Code Docs: MCP quickstart](https://code.claude.com/docs/en/mcp-quickstart)
- Third-party: cloud sessions do not get local MCP servers or config, but they keep running after the laptop is closed. Remote Control stops when the local process stops (use tmux/screen; the machine must not sleep), and network drops of about 10 minutes or more time out. — [agentsroom.dev](https://agentsroom.dev/blog/claude-remote-agents-cloud-sessions-remote-control-or-ssh); [cloudroom.dev](https://www.cloudroom.dev/blog/claude-code-remote-control)
- Blender MCP (ahujasid/blender-mcp) needs Blender 4.0 or newer (4.3 recommended), Python 3.10+ and `uv`. You install a Blender add-on, and Claude Desktop runs `uvx blender-mcp`. Poly Haven assets need no key. Hyper3D Rodin generation uses a shared trial key with a daily cap, or your own key from hyper3d.ai/fal.ai. Sketchfab models must be downloadable. (These details come from forks and mirrors of the README.) — [glama mirror of README](https://glama.ai/mcp/servers/@ahujasid/blender-mcp/blob/7636d13bded82eca58eb93c3f4cd8708dfdfbe8b/README.md); [naab007 fork](https://github.com/naab007/blender_mcp)
- How practitioners use Blender MCP: treat Blender as the source of truth and Claude as the "control layer". Inspect the scene first, give specific direction, review in Blender, then ask for targeted revisions. — [The Rundown guide, May 2026](https://app.therundown.ai/guides/how-to-3d-model-anything-with-claude-blender); [UX Planet](https://uxplanet.org/3d-modeling-with-claude-code-a-practical-blender-workflow-97e6e0b536b0)
- Caveat from a news roundup: "vibe-coding 3D doesn't replace solid understanding of topology, rigging or performance". It also flags MCP security risk. — [ainauten](https://news.ainauten.com/en/story/claude-code-plugins-guide-easily-automate-blander-asset-creation-and-more)
- Unity reportedly has an official MCP server (added to its CLI in June 2026) and a first-party Claude Code plugin with 29 skills. The community CoplayDev/unity-mcp has about 15k stars, is MIT-licensed, and needs Unity 2021.3 LTS to 6.x and Python 3.10+. Godot MCPs can write GDScript and `.tscn` files; Godot is MIT and at 4.7.2. These come from vendor and comparison blogs and are unverified. — [strayspark](https://www.strayspark.studio/blog/unity-mcp-server-vs-unreal-godot-blender-2026); [mcp.directory](https://mcp.directory/blog/godot-vs-unity-vs-blender-mcp-skills-2026); [explainx](https://explainx.ai/blog/claude-code-unity-mcp-guide-2026)

### Inferences
- Hardware for a local workflow: any recent PC or Mac that can run Blender 4.x smoothly (a dedicated GPU helps for viewport and rendering). Building an iOS app later needs a Mac with Xcode (see section 5). The creator would have to keep the PC awake while a Remote Control session runs.
- Without a local PC, the cloud container can still: run Blender headless (`blender --background --python script.py`, a standard Blender feature) for scripted retopo, rig, glTF export, decimation and thumbnails, if Blender can be installed in the environment. It can also run gltf-transform/gltfpack (Node) for compression and Playwright/Chromium for screenshots. This covers most asset processing; what it cannot do is interactive modelling. (Headless Blender in this environment was not tested in this research.)
- Switching to Unity, Godot or Unreal to use their MCPs would mean a local machine and a rewrite of the existing three.js game. That is a high cost for little gain, since the problem is the art, not the engine.

### Gaps
- I did not verify whether claude.ai remote (HTTP) connectors exist for Blender or engines; all servers found were local stdio.
- I did not test whether Blender installs and runs headless in this specific container (disk, apt access).
- Official Unity MCP docs were not reached directly.

## 3. Asset strategy for consistent quality: bought packs vs CC0 vs AI generation

### Takeaway
Consistency matters more than fidelity. The practical route is to pick one cohesive stylised low-poly family (KayKit, Quaternius, Kenney are free; Synty is paid), all from one artist or studio so proportions and palette match, and use AI generation only to fill gaps, passed through the same style and optimisation pipeline. AI 3D generators in 2026 still output dense meshes of inconsistent style, and rigging is mostly limited to standard bipeds.

### Cited Findings
- KayKit Character Pack: Adventurers is CC0, with 5 rigged and animated characters and 25+ weapons and accessories, in FBX and glTF. Most KayKit packs are free and CC0, with a paid bundle. — [cinevva guide (Sep 2026)](https://app.cinevva.com/guides/free-rigged-3d-character-models)
- Quaternius: the Ultimate Animated Character Pack has 50+ characters. Its licence requires no attribution (the guide calls it the "Quaternius license", not CC0). There are about 80 themed packs and 1,100+ models in glTF/GLB and FBX. — [cinevva guide](https://app.cinevva.com/guides/free-rigged-3d-character-models); [cinevva free model sites](https://app.cinevva.com/fr/guides/free-3d-model-sites)
- Kenney Animated Characters (Protagonists, Retro, Survivors) are CC0, rigged and blocky, in FBX and glTF. — [cinevva](https://app.cinevva.com/game-assets/free-3d-character-models)
- Synty: the one-time-purchase EULA is worldwide, royalty-free and "not limited by game engine, OS, platform or device", which suggests web/WebGL is allowed. The subscription (SyntyPass) EULA permits video games, VR/AR and more. The FAQ allows commercial games. Its Metaverse clause forbids software that lets users build their own games with the assets. Humble Bundle copies come under a different EULA. Nothing I found explicitly addresses three.js or browser games, so web use is inferred; in a browser the raw .glb files can be downloaded by anyone. — [Synty licences overview](https://syntystore.com/pages/licences-overview); [One-time EULA](https://syntystore.com/pages/one-time-purchase-licence); [Subscription EULA](https://syntystore.com/pages/standard-subscription-licence); [Synty FAQ](https://syntystore.com/community/faq)
- AI 3D tools, from vendor comparisons (biased):
  - Meshy auto-rigs humanoids and quadrupeds, has 600+ preset animations, does not support models over 300k faces, and can rig any GLB. — [Meshy vs Tripo](https://www.meshy.ai/compare/meshy-vs-tripo); [Meshy vs Hunyuan3D](https://www.meshy.ai/compare/meshy-vs-hunyuan3d)
  - Tripo rigs, including multi-legged creatures, but has no motion library. Its "Smart Mesh" gives cleaner quad topology at 500-50K faces. — [Meshy blog](https://www.meshy.ai/blog/hi3d-vs-meshy-vs-tripo); [Tripo blog](https://www.tripo3d.ai/blog/meshy-alternative)
  - Open-source Hunyuan3D produces dense static meshes that need remeshing. Its rigging details are disputed between sources. — [Meshy vs Hunyuan3D](https://www.meshy.ai/compare/meshy-vs-hunyuan3d); [Tripo vs Hunyuan](https://www.tripo3d.ai/compare/tripo-vs-hunyuan)
  - Multi-view reference input (front/side/back sheets) is the main lever for consistency across one asset. — [fuser.studio](https://fuser.studio/articles/best-ai-3d-model-generators)
- About 60% of Steam AI disclosures concern visual assets, so AI art is now common in shipped games and not by itself a store blocker. — [VGC](https://www.videogameschronicle.com/news/steam-games-disclosing-generative-ai-use-are-up-800-this-year/)

### Inferences
- For this project (pixel-3D look, real Chiang Mai): buildings should come from OSM footprints with code-generated, stylised facades (shared trim, roof and window modules, a texture atlas), not from one-off AI models per building. A modular kit (bought, CC0, or one coherent AI-generated kit) gives a consistent city with few draw calls.
- For characters, a CC0 rigged base (KayKit, Quaternius) mapped to `config/rig.json` via `joints`/`restFix`, plus code animation, removes the "procedural character" look quickly at zero cost. The pixel-3D post-process also hides mismatched texture detail, which helps consistency.
- The style should be locked in a one-page style guide (palette, polygon budget, outline/no outline, texel density) before buying or generating anything. Mixing Synty, Kenney and AI meshes without this is the usual cause of an "asset flip" look. This is a general art-direction principle; no source in this research quantifies it.
- Generated assets should go through Meshy or Tripo, then a Blender headless clean-up/retopo/rig-rename script, then gltf-transform, then the existing `check-model` gate. The repo already has a gate concept; it should also cover polygon and texture budgets.

### Gaps
- Original Kenney, Quaternius and KayKit licence pages were not reached; the licence summaries come from a third-party guide.
- No source states whether Synty assets in a web game must be obfuscated or protected. The full EULA text needs checking.
- I found no data on whether players or portals (Poki, CrazyGames) penalise visibly AI-generated art.

## 4. Verifying game feel and visual quality when the AI cannot see or play

### Takeaway
The proven pattern is an "implement, act, observe" loop: Playwright drives the game with deterministic time stepping, captures screenshots or video, and dumps game state as JSON, and the agent inspects the images. This catches broken visuals and logic. It does not measure fun or feel, which still needs human playtests after every feature, plus simple telemetry.

### Cited Findings
- Without screenshots, an agent "predicts visual results from code alone". Round-trip screenshot testing has the agent run tests, auto-capture images, then inspect them for layout problems. — [Medium, Rotbart](https://medium.com/@rotbart/giving-claude-code-eyes-round-trip-screenshot-testing-ce52f7dcc563)
- Community Claude Code skills for web games use an "implement-act-observe" cycle: Playwright input, screenshots, deterministic time stepping, and JSON-serialised game state alongside images, with visuals treated as the source of truth. — [Develop Web Game skill](https://mcpmarket.com/tools/skills/develop-web-game); [Web Game Development Loop skill](https://mcpmarket.com/tools/skills/web-game-developer)
- The claude-show-your-work plugin records Playwright runs and shows before/after comparisons. A Show HN Playwright skill returns only screenshots and console output to save tokens. Caveat from the HN thread: page content and console output are sent to Anthropic, so use dummy data. — [GitHub](https://github.com/iamumeransari/claude-show-your-work); [Hacker News](https://news.ycombinator.com/item?id=45642911)
- The most serious bugs in AI-written games are silent logic and error-handling bugs (a score that doesn't save, collisions that miss fast objects), which "you only catch by playing". Guides recommend playtesting after every feature and adding one system per prompt so changes stay small, verifiable and easy to undo. — [cinevva vibe-coding guide](https://app.cinevva.com/guides/vibe-coding-games); [Summer Engine tutorial](https://www.summerengine.com/blog/vibe-coding-games-tutorial)
- A CEO-Simulator postmortem tried an RL agent playing in the browser. It found some strange UX behaviour but "actual game mechanics insights were limited", so traditional playtesting was still needed. — [cinevva guide](https://app.cinevva.com/guides/vibe-coding-games)
- A vibe-coded game reached 10k+ players in a weekend; the article was listed but not read in full. — [generativeai.pub](https://generativeai.pub/i-vibe-coded-a-game-that-attracted-10k-players-in-a-single-weekend-6cff508bad58?gi=1fdc6d3c96d6)

### Inferences
- This repo already has most of the loop: `?debug=1` with `window.__walk`, Playwright e2e and screens.spec at three viewports, and `?art=` modes. Possible additions:
  - (a) A "golden shots" script that takes the same 6-10 camera angles of key places (Tha Phae plaza, a fight, the HUD) after every art change and puts them side by side with the previous ones in one artifact page for the creator to approve.
  - (b) Short WebM recordings of the combo and dash using Playwright's video, plus frame strips, so the creator can judge feel on a phone.
  - (c) An FPS and draw-call readout (`renderer.info.render.calls`) asserted in e2e as a performance budget.
  - (d) Lightweight anonymous telemetry once testers exist: session length, where players die or quit, first-minute funnel. It is stored locally or sent to a simple endpoint, and only with the creator's approval because it involves deployment.
- Game feel can be checked partly by numbers: hit-stop frames, input-to-animation latency, and camera shake amplitude are all in config. Comparing them with reference videos (task #38) gives the AI an objective target, even though it cannot feel the game.
- The creator is the only judge of "fun". A cheap but disciplined option is 3-5 human testers on real phones with a 5-question form after each milestone.

### Gaps
- I found no study measuring how well vision-LLM screenshot review matches human judgement of game visuals.
- I found no telemetry case study specific to AI-built web games.

## 5. Production checklist: releasing a 3D web game on mobile, portals, and wrapping as an app

### Takeaway
Design to portal limits from the start. Poki aims for an initial download of 8 MB or less (some Poki guidance says 5 MB initial and 8 MB total) and 30 FPS minimum (60 target). CrazyGames caps the initial download at 50 MB (20 MB to appear on the mobile homepage) and the total at 250 MB. For three.js that means KTX2 textures, Meshopt/Draco geometry, instancing/batching, progressive loading of the city, and draw calls in the low hundreds. Capacitor can wrap the same build later, but performance depends on the device's system WebView, and iOS needs a Mac.

### Cited Findings
**Portals**
- Poki: aim for an initial download under 8 MB. Players leave if loading takes more than 10 s, so use progressive loading. The game must fill the screen on mobile, with a 16:9 canvas scaling to 640x360, 836x470 and 1031x580. — [Poki requirements](https://sdk.poki.com/new-requirements.html); [Poki quality requirements](https://developers.poki.com/guide/requirements-quality)
- Poki performance: minimum 30 FPS, target 60. — [Poki deal types](https://sdk.poki.com/deals)
- The Poki engine guide says initial download of 5 MB or less and 8 MB or less in total. Defold's Poki-oriented advice is a looser "under 20 MB total". These sources conflict, and Poki's own pages are authoritative. — [Poki web engine guide](https://developers.poki.com/guide/web-engine); [Defold blog (Jun 2026)](https://defold.com/2026/06/02/Best-practices-when-building-for-the-web/); [portalready comparison](https://portalready.world/portals/)
- CrazyGames: initial download of 50 MB or less (20 MB or less for the mobile homepage), measured from the start of loading to the SDK `gameplayStart` event. Total of 250 MB or less, 1,500 files or less, and gameplay reached in 20 s or less if files are hosted externally. — [CrazyGames technical requirements](https://docs.crazygames.com/requirements/technical); [CrazyGames intro](https://docs.crazygames.com/requirements/intro/)

**three.js performance budget** (community guides, rules of thumb)
- Draw calls under 500 per frame for broad mobile/desktop, ideally under 100. Monitor `renderer.info.render.calls`. Fix with InstancedMesh, BatchedMesh and geometry merging. — [MetaDesign Solutions](https://metadesignsolutions.com/blog/threejs-performance-optimization-best-practices)
- Textures should be KTX2/Basis, not PNG/JPEG, in production. Use ETC1S for colour maps on mobile; UASTC costs more VRAM. — [MetaDesign Solutions](https://metadesignsolutions.com/blog/threejs-performance-optimization-best-practices); [three-best-practices skill](https://skills.cat/skills/emalorenzo/three-agent-skills/three-best-practices)
- Draco cuts geometry size by about 90-95%; Meshopt decodes faster. A suggested mobile-web budget is about 2 MB per glTF file, 50K triangles and 1024 px textures. The pipeline is assess, clean, resize, KTX2, compress and validate, using gltf-transform or gltfpack. — [threejs model optimizer skill](https://skillselion.com/skills/openaec-foundation/three.js-claude-skill-package/threejs-agents-model-optimizer); [three-best-practices](https://tessl.io/registry/skills/github/zebbern/claude-code-guide/three-best-practices)
- A 2026 comparison of web engines (PlayCanvas, three.js, Babylon, Unity WebGL) exists but was not read in full. — [cinevva](https://app.cinevva.com/blog/2026-06-09-web-game-engines-2026-comparison)

**Wrapping as an app (Capacitor)**
- Capacitor uses the system WebView (WKWebView on iOS, Chromium WebView on Android), so WebGL behaviour and performance follow the device. Flagship phones are fine; budget Android may struggle with heavy shaders or large canvases. Test on real devices, not emulators. — [abratabia: Capacitor games](https://abratabia.com/native-wrappers/capacitor-games.php)
- The wrapper adds about 2-5 MB (single source, unverified). Startup time is dominated by JavaScript parse and compile. Cordova has sometimes outperformed Capacitor on Android. — [abratabia](https://www.abratabia.com/native-wrappers/); [Capgo](https://capgo.app/ja/blog/ultimate-guide-to-animation-performance-in-capacitor-apps/)
- Audio is blocked until a user tap, so the AudioContext has to be resumed on a gesture. — [abratabia](https://abratabia.com/native-wrappers/capacitor-games.php)
- iOS builds need a Mac with Xcode; Android needs Android Studio. — [abratabia](https://abratabia.com/native-wrappers/capacitor-games.php)
- A three.js forum discussion asks whether a wrapped three.js app can feel native. — [three.js forum](https://discourse.threejs.org/t/is-it-possible-to-wrap-app-a-three-js-app-and-get-a-native-like-ios-app/9573)

### Inferences
Suggested checklist for this project:
1. **First-play download**
   - Ship the boot scene (opening, plaza, hero, slimes) at 8 MB or less, compressed. Stream other districts of the OSM city by tile.
   - Measure it in CI with the Vite build size plus a Playwright network log up to the first playable frame.
2. **Runtime budget, mid-range Android**
   - 30 FPS floor and 60 target at the 844x390 landscape viewport.
   - Draw calls under about 150, triangles in view under about 150-300k, textures 1024 or less, KTX2.
   - The pixel-3D render target is already low-res, which helps fill-rate.
   - These targets are inferred from the rules of thumb above, not from a source.
3. **Asset gate**
   - Extend `check-model` with polygon count, texture size and file size limits.
   - Run gltf-transform (`optimize`, KTX2, meshopt) in the build.
4. **Portal readiness**
   - 16:9 fill, a pause/mute hook, no external links, audio unlocked on tap, and a save that tolerates iframe storage loss (the save is already local-first).
   - Portal ad SDK rules (Poki/CrazyGames) prohibit unrelated ad networks. This rule was not directly verified here; check the SDK docs.
5. **itch.io**: the lowest-friction place for private or unlisted playtests. Deploying needs the creator's approval per CLAUDE.md.
6. **App later**
   - Capacitor wrapping, Android first (no Mac needed).
   - iOS needs a Mac, an Apple developer account and store review. Store fees are a paid-service decision for the creator.
7. **Monetisation**
   - Phase-1 rules here ban gacha and paid currency.
   - Portal ad revenue share and in-world sponsorship (the Levels model) remain options for later. Real-business sponsorship inside a real-city map needs a creator decision.

### Gaps
- I could not open Poki's full requirements page (fetch blocked) to confirm the current numbers and ad-SDK rules, or itch.io's limits.
- I found no 2026 data on Poki or CrazyGames revenue for 3D RPGs specifically; portal audiences favour short sessions, which may conflict with a long RPG.
- There are no official three.js or Khronos numeric budgets; all budgets above are community rules of thumb.
