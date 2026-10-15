# Shared instructions for Codex, Claude, and other coding agents

## Active project

The current work is **ECHO ATLAS — โลกซ้อน**, a proposed Roblox Action MMORPG based on real geography, starting with a small Chiang Mai district and expanding later. The creator asked for design/development documents and a repository-based handoff workflow first. No Roblox implementation or working Studio connection has been verified yet.

The previous SLIME HOOD, idle/PWA, and Three.js Old City Swordsman prototypes are abandoned. Obsolete plans, archived specs, and planning artifacts were removed at the creator's request on 2026-10-15. Keep the remaining prototype source as legacy reference; do not resume its roadmaps or apply its platform-specific rules to Roblox.

## Read at the start of every session

1. `docs/coordination/STATUS.md` — actual state, evidence, and legacy dirty files.
2. `docs/coordination/HANDOFF.md` — latest outgoing handoff and next action.
3. `docs/coordination/TASKS.md` — work ownership and acceptance criteria.
4. `docs/coordination/INBOX.md` — questions and review messages to handle.
5. `game_design_document.md` and the relevant files under `docs/roblox/`.
6. `docs/coordination/README.md` for the coordination protocol.

Inspect `git status` and current Studio state before making changes. Files and handoffs do not prove that another assistant has read them or that Studio matches Git.

## Product boundaries

- Real map geography; no requirement to visit locations or provide GPS.
- Third-person realtime PvE is a proposal; first-person is not required.
- Start with swordsman combat in a small area, not all classes and cities.
- Business storefronts, advertising, monetization, trading, and PvP are future scope.
- Design details, limits, balance values, and performance budgets are **proposals/targets**, not user-approved facts or measured results.
- Real geometry, estimated architecture, and fictional scenes must remain distinguishable.

## Working agreement

Use the applicable development skills automatically. Prefer specific domain skills, a written spec, small reversible slices, meaningful verification, and a clear handoff. Communicate in plain Thai to the creator, who is new to Roblox and programming.

Follow the human's latest instructions over a stale plan. Proceed with already authorized work; clarify only when an unresolved choice materially changes the outcome. No installation, payment, publishing, or gameplay implementation was requested in the documentation session alone.

Default to sequential work between Codex and Claude. Claim a task and list files before editing. One writer per file and one agent controlling a Studio session at a time. Repository notes are a coordination convention, not an atomic lock or an automatic messaging service.

Do not overwrite another agent's changes, revert unexplained dirty files, or use `git add .` in a dirty workspace. Review the exact diff and stage only the intended deliverable. Never claim a push, installation, test, or handoff receipt without evidence.

## Implementation rules when implementation is authorized

Use Luau `--!strict`, configuration-driven balance, stable catalog/asset IDs, localized strings, server-side validation for combat/rewards, and cleanup for event connections/tasks/effects. Keep the code/config in Git synchronized with Studio before handoff. Document the sync method and Place checkpoint.

Pure logic tests, Studio runtime checks, multi-client checks, and real-device tests answer different questions. A legacy web test or ten simulated NPCs does not verify Roblox multiplayer capacity. Do not invent test commands before a Roblox harness exists.

## End-of-session requirements

Update task status, `STATUS.md`, append to `WORKLOG.md`, and refresh `HANDOFF.md`. Include changed paths, exact checks and outcomes, limitations, current Studio ownership/checkpoint, and one concrete next action. Mark tests NOT RUN when appropriate; planned work is not completed work.

For shared decisions use `docs/roblox/09-decisions-and-sources.md`. For questions/replies use `INBOX.md`; do not silently treat an AI suggestion as a human decision.
