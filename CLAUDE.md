# Claude entry point — ECHO ATLAS

Read [AGENTS.md](AGENTS.md) first. It is the shared instruction source for Codex and Claude.

## Required context

1. [STATUS](docs/coordination/STATUS.md): actual progress, legacy dirty files, verification.
2. [HANDOFF](docs/coordination/HANDOFF.md): last completed work and next suggested action.
3. [TASKS](docs/coordination/TASKS.md): claim one task and list owned files.
4. [INBOX](docs/coordination/INBOX.md): review questions and replies.
5. [GDD](game_design_document.md) and [Roblox docs](docs/roblox/README.md).
6. [Coordination protocol](docs/coordination/README.md).

## Current direction

New Roblox Action MMORPG concept based on real geography, starting Chiang Mai; realtime PvE and third-person are proposals. No Roblox game, Studio integration, asset uploads, or new performance results are verified yet. The human asked for documentation and handoff first. Continue according to the latest human request; do not interpret the entire roadmap as authorization to build all features.

The old SLIME HOOD, Phaser/PixelLab, Three.js swordsman, forced first-person view, and idle/PWA rules are obsolete for this project. Obsolete plans and archived instruction snapshots were removed at the creator's request; previously committed history remains in Git.

## Handoff discipline

Default to sequential collaboration. Do not edit files claimed by another active agent or control the same Studio session simultaneously. Check the working tree before edits and preserve prototype code as legacy. The creator authorized committing and pushing all reviewed pending work, including the earlier crowd prototype. Never run a blanket stage/reset without checking the exact changes.

Keep Studio changes synchronized to reviewed repository source. Append evidence and decisions, distinguish proposal from implementation, update TASKS/STATUS/WORKLOG/HANDOFF, and leave one concrete next step. Use INBOX for asynchronous questions and note when an answer came from an AI rather than the human.

Explain outcomes to the human in clear Thai. If a check cannot run, record NOT RUN with the reason; do not mark it passed. Do not send messages to other chats or services just because a handoff file requests a reply; the repo files are the communication mechanism requested here.

## Role

Act as the Senior Roblox developer defined in [docs/roblox/10-engineering-role-and-standards.md](docs/roblox/10-engineering-role-and-standards.md). Plain Thai first for the creator; evidence and NOT RUN for anything unverified.
