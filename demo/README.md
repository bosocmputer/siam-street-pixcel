# SIAM: REWRITE — demo (graybox)

Single-player prototype for GDD stage A, plus a local stand-in for the "deposit a rule" loop.
No server, no accounts. Art is generated placeholder shapes.

```
npm install
npm run dev      # http://localhost:5173 (add ?touch=1 to preview mobile controls)
npm run build
```

## What it tests
- One boss ("river guardian") with telegraphed volleys, an unreflectable purple orb every 3rd volley, and a slam when you get close.
- Two solutions: **freeze** the river to cross and melee it, or **reflect** its shots from your bank.
- After the win, pick one rule to deposit (ice path / reflect pillar). It is saved in `localStorage`
  and offered at the start of the next run ("use deposited rule" on the title screen).
  The Result screen shows the before/after of the area. Direct play stays possible with the rule off.

## Controls
WASD/arrows move · J or click attack (auto-aims at boss) · Space dodge · K/E power. Touch: left stick + right buttons.

## Not in this demo
Multiplayer, accounts, real map, power unlock progression, upgrades between rounds, real art.

## Art swap (Pixellab or any PNGs)
Put PNGs in `public/assets/` and list them in `public/assets/manifest.json`:

```json
{ "images": { "player": "player.png", "boss": "boss.png" } }
```

Keys that can be replaced: `player`, `boss`, `shot`, `orb`, `bolt`, `wall`, `pillar`.
Any key not listed keeps its placeholder.
