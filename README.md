# ECHO ATLAS — โลกซ้อน

เอกสารออกแบบเกม Action MMORPG บน Roblox ใช้แผนที่จริงเป็นโลก เริ่มพื้นที่เล็กบริเวณท่าแพ เชียงใหม่ แล้วค่อยขยายสู่เมืองอื่น ผู้เล่นสำรวจ ต่อสู้กับมอนสเตอร์ เติบโต และสร้างเรื่องราวร่วมกับเพื่อน

**สถานะปัจจุบัน:** จัดทำแบบเกมและระบบส่งต่องาน ยังไม่ได้สร้างเกม Roblox หรือยืนยันการเชื่อม Studio บนเครื่องนี้ รายละเอียดใหม่เป็นข้อเสนอให้ผู้สร้างอ่าน

## เริ่มอ่าน

- [Game Design Document](game_design_document.md) — ภาพเกมและขอบเขตรุ่นแรก
- [ชุดเอกสารพัฒนา Roblox](docs/roblox/README.md) — story, combat, RPG, map, asset, architecture และ roadmap
- [เริ่มส่งต่องาน Codex / Claude](docs/coordination/README.md) — วิธีทำงานร่วมกันผ่าน repo
- [สถานะล่าสุด](docs/coordination/STATUS.md) และ [ใบส่งต่องาน](docs/coordination/HANDOFF.md)
- [AGENTS.md](AGENTS.md) — กติกากลางสำหรับ AI ทุกตัว

## สำหรับ Claude หรือ Codex ที่เพิ่งเข้ามา

อ่าน AGENTS.md → STATUS → HANDOFF → TASKS → INBOX ก่อนแก้ไฟล์ ใช้ข้อมูลจริงจาก repo และ Studio ตรวจซ้ำ ไม่ถือว่าเรื่องที่อยู่ในแผนสร้างแล้วหรือทดสอบผ่านแล้ว

ยังไม่มีคำสั่ง build/test สำหรับ Roblox ใน repo นี้ การเชื่อมเครื่องมือและเลือกวิธี sync/test เป็นงาน R00–R01 ใน [แผนพัฒนา](docs/roblox/07-development-plan.md)

## โค้ดต้นแบบเดิม

`apps/chiangmai-world`, `apps/web`, `packages/game-core`, `demo` และ tools เดิมเป็นประวัติของแนวที่ยกเลิกแล้ว เก็บไว้โดยไม่พัฒนาต่ออัตโนมัติ โดยเฉพาะ pnpm scripts เดิมตรวจหรือเปิดเว็บ ไม่ใช่เกม Roblox

แผน GDD, roadmap, art brief, research, mockup และ balance report ของแนวเก่าถูกลบจาก working tree แล้วตามคำสั่งผู้สร้าง ประวัติที่เคย commit ยังดูได้ใน Git ส่วน [คู่มือโค้ดต้นแบบ](apps/chiangmai-world/README.md) เก็บไว้อธิบายโค้ดที่ยังอยู่ ไม่ใช่แผนพัฒนา Roblox ข้อมูลแผนที่เดิมต้องตรวจสิทธิ์ วันที่ และความเหมาะสมใหม่ก่อนนำไปใช้

โค้ด crowd benchmark เดิมและ config Serena ถูกตรวจและรวมในการส่งต่องานตามคำสั่ง commit/push ทั้งหมดแล้ว ดูขอบเขตและผลตรวจใน STATUS เกม Roblox ใหม่ยังไม่ได้เริ่มสร้าง

## เปิดงานต่อบน Windows PC

Clone branch นี้โดยตรง เพื่อให้ได้ชุดเอกสารใหม่พร้อมโค้ดที่ส่งต่อ:

```powershell
git clone --branch codex/chiangmai-old-city-3d https://github.com/bosocmputer/siam-street-pixcel.git
cd siam-street-pixcel
```

จากนั้นเปิดโฟลเดอร์ใน Claude หรือ Codex แล้วให้อ่าน `AGENTS.md` และ `docs/coordination/HANDOFF.md` ชื่อ branch เป็นชื่อที่ใช้มาก่อนเปลี่ยนแนวเกม; เนื้อหาใน GDD/STATUS เป็นตัวกำหนดทิศทางปัจจุบัน ไม่ใช่ชื่อ branch

ไม่ต้องรัน pnpm เพื่ออ่านหรือรีวิวเอกสาร ขั้นตอนติดตั้ง Roblox Studio และเชื่อม AI บน Windows เป็นงาน R00 ที่ยังไม่ได้ทำ ดูข้อความพร้อมใช้ใน HANDOFF
