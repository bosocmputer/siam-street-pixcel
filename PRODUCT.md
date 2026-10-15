# Old City Swordsman

## Register

product

## Users and purpose

The creator wants a new 3D MMORPG foundation, starting with a walkable reconstruction of
Chiang Mai's walled Old City. The immediate deliverable is first-person swordsman combat
against three slimes at the eastern gate plaza. Use the two supplied maps as geographic references and OpenStreetMap as
the source of reproducible street and building geometry.

## Experience

A full-screen, daylight 3D world with a restrained, legible combat HUD. The city is
the main surface. Let people walk at street level, inspect the whole city from above,
locate themselves on a north-up map, and fight with visible arms and a sword. Remove real
place names, road labels, and POI markers from the playing screen and minimap. Thai is the primary UI
language. Desktop keyboard/mouse and mobile touch controls are both available.

## Design principles

- Preserve real street geometry and geographic scale before decorative detail.
- Clearly distinguish mapped geometry from estimated heights and stylized architecture.
- Start exploring immediately; keep setup and menus out of the way.
- Keep the real street layout while letting the city function as a game world.
- Telegraph enemy attacks; show damage, health, stamina, and progression clearly.
- Keep the previous abandoned game separate from this new application.

## Accessibility and inclusion

Labeled keyboard-accessible UI, visible focus, high-contrast controls, touch alternatives,
optional camera bob, and an overview mode that does not require first-person navigation.
This visual walking prototype does not claim full screen-reader navigation of the 3D world.

## Scope

Build locally in `apps/chiangmai-world`. Local real-time melee combat, blocking, enemy
respawn, defeat/restart, XP and levels. No public deployment, accounts, persistence,
VR headset support, or networked players in this prototype.
