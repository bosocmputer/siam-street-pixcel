# Active project: Old City Swordsman (15 October 2026)

The user abandoned SLIME HOOD and all earlier gameplay concepts. The active request is
a detailed, walkable 3D reconstruction of Chiang Mai's Old City using real map geometry,
with first-person swordsman combat against three slimes at the eastern gate plaza.
Remove real place/road labels and POI pins from gameplay and the minimap. Keep map data
and attribution intact. Combat is local, real-time, with blocking, HP/stamina, XP/levels,
enemy respawn and player restart. No networked MMO or persistence is implemented yet.
E casts a charged spirit crescent: 0.9 s charge, 30 m horizontal projectile, 35 spirit,
5 s cooldown, piercing enemies but stopping at mapped obstacles. See `docs/chiangmai_combat.md`.
Read `README.md` and `apps/chiangmai-world/README.md` first. The new app is in
`apps/chiangmai-world`, using Three.js and a cached OpenStreetMap extract.

Run `pnpm dev:world`, `pnpm test:world`, and `pnpm build:world`. Keep real OSM geometry
separate from estimated architecture. Never claim that generic facades or landmark models
are scans, photogrammetry, or verified reconstructions. Public deployment is not requested.
Preserve old files for Git history; do not continue the abandoned game's roadmap.

The rules below describe the legacy SLIME HOOD implementation only. Its Phaser, idle,
PixelLab, UI mockup, and GDD approval requirements do not govern the new 3D application.

# Legacy: SLIME HOOD (สไลม์คุมย่าน)

Idle RPG บนแผนที่จริงของเชียงใหม่ ผู้เล่นเป็นสไลม์ที่กลืนมอนแล้วงอกส่วนต่าง ๆ และแข่งกันเป็นย่าน

## อ่านก่อนเริ่มงาน

1. `game_design_document.md` — GDD v4 (ข้อที่เขียนว่า “ตัดสินแล้ว” ห้ามเปลี่ยนโดยไม่ถามผู้สร้าง)
2. `docs/development_plan.md` — milestone, งาน, เกณฑ์ผ่าน, จุดหยุดถามผู้สร้าง
3. `docs/technical_direction.md` — stack, สถาปัตยกรรม, idle/กันโกง, asset pipeline
4. `docs/research_v4.md` — ข้อมูลอ้างอิงและช่องว่าง

`docs/archive/` และ `demo/` เป็นของเวอร์ชันเก่า ใช้อ้างอิงเท่านั้น

## ผู้สร้าง

ผู้สร้างไม่มีพื้นฐานด้านเกมหรือโปรแกรม อธิบายเป็นภาษาไทยที่เข้าใจง่าย บอกผลตามจริง (เทสต์ไม่ผ่าน, ข้ามขั้น, ยังไม่ได้ตรวจ) และเสนอทางเลือกพร้อมคำแนะนำเมื่อต้องตัดสินใจ

## กติกาโค้ด

- TypeScript strict ทุกที่ pnpm workspaces
- ตรรกะเกมอยู่ใน `packages/game-core` เท่านั้น: pure, deterministic, ห้ามใช้ `Math.random()`/`Date.now()` ข้างใน, ทุกฟังก์ชันมีเทสต์
- ตัวเลขสมดุลอยู่ใน `packages/game-core/config/*.json` ห้ามฝังในโค้ด
- เซิร์ฟเวอร์เป็นผู้ตัดสินผล client ส่งแค่คำสั่ง ใช้เวลาเซิร์ฟเวอร์เสมอ
- ข้อความที่ผู้เล่นเห็นอยู่ใน `apps/web/src/i18n/th.json` ใช้น้ำเสียงและศัพท์ตาม GDD ข้อ 2
- pin เวอร์ชัน dependency แบบแน่นอน และ commit lockfile; Phaser ใช้ 3.90.0
- ห้าม commit secret (`PIXELLAB_TOKEN`, Supabase keys) ใช้ env เท่านั้น
- Playwright ในคลาวด์ใช้ Chromium ที่ `/opt/pw-browsers` ห้ามรัน `playwright install`

## ก่อน commit

```
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

จบแต่ละ milestone ให้อัปเดตตารางสถานะใน `docs/development_plan.md` หัวข้อ 9

## หยุดถามผู้สร้างก่อน

- ใช้ PixelLab generation เป็นชุด (เช็ก `get_balance` และแจ้งประมาณการก่อน)
- deploy สาธารณะ หรือส่งลิงก์ให้ผู้ทดสอบ
- สมัครหรือจ่ายเงินบริการใด ๆ
- เปลี่ยนข้อที่ GDD ระบุว่า “ตัดสินแล้ว”
- ทำหน้าจอใหม่หรือเปลี่ยน layout ใหญ่ก่อนผู้สร้างอนุมัติ mockup (ดู M2.5) และก่อนส่งให้ลองเล่นต้องดูภาพหน้าจอจริงทุกหน้าด้วยตัวเอง
- ผลจำลองสมดุลไม่เข้าเป้า

## ทดสอบเว็บ

- `pnpm e2e` build ใหม่ก่อนรันเสมอ ใช้ `?debug=1` เพื่อให้เทสต์ย้ายนาฬิกา (`__slime.advance`) และใส่ของ (`__slime.grant`) ได้
- ข้อความภาษาไทยทุกอันอยู่ใน `th.json` เทสต์จะล้มถ้ามี `t('...')` ที่ไม่มี key หรือมี key ที่ไม่ได้ใช้

## ห้ามทำในขั้น 1

กาชา/เงินเติม · แชตพิมพ์อิสระ · ระบบนัดเจอ · PvP ตีกันตรง ๆ · ตลาดซื้อขาย · GPS · real-time server · ใช้ชื่อ/ตัวละคร/สกิลจาก Tensura, SAO, RO · ใช้วัด ศาสนสถาน สถาบัน เป็นสนามต่อสู้ มอน บอส หรือของแต่ง · รางวัลล็อกอินต่อเนื่องที่หายเมื่อขาด
