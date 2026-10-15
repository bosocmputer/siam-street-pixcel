# Chiang Mai Old City Walk

## Register

product

## Users and purpose

The creator wants a new 3D MMORPG foundation, starting with a walkable reconstruction of
Chiang Mai's walled Old City. The immediate deliverable is exploration, not combat or MMO
infrastructure. Use the two supplied maps as geographic references and OpenStreetMap as
the source of reproducible street and building geometry.

## Experience

A full-screen, daylight 3D world with a restrained, legible exploration HUD. The city is
the main surface. Let people walk at street level, inspect the whole city from above,
locate themselves on a north-up map, and jump to named landmarks. Thai is the primary UI
language. Desktop keyboard/mouse and mobile touch controls are both available.

## Design principles

- Preserve real street geometry and geographic scale before decorative detail.
- Clearly distinguish mapped geometry from estimated heights and stylized architecture.
- Start exploring immediately; keep setup and menus out of the way.
- Ground place names and landmarks in the imported dataset.
- Keep the previous abandoned game separate from this new application.

## Accessibility and inclusion

Labeled keyboard-accessible UI, visible focus, high-contrast controls, touch alternatives,
optional camera bob, and an overview mode that does not require first-person navigation.
This visual walking prototype does not claim full screen-reader navigation of the 3D world.

## Scope

Build locally in `apps/chiangmai-world`. No public deployment, accounts, combat, VR headset
support, or networked players in this walking prototype.
