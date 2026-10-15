# สถานะล่าสุด — ECHO ATLAS

อัปเดต 2026-10-15 โดย Codex · session `SYNC-2026-10-15-01`

## ทิศทางปัจจุบัน

เกม Roblox Action MMORPG ที่อ้างอิงแผนที่จริง เริ่มเชียงใหม่แล้วขยายทั่วโลก รายละเอียด gameplay, story, จำนวนผู้เล่น และ balance ใน GDD เป็นข้อเสนอ/เป้าทดลอง ผู้สร้างยังไม่ได้ review รายละเอียดทั้งหมด

| รายการ                                  | สถานะจริง                                                             |
| --------------------------------------- | --------------------------------------------------------------------- |
| GDD และ docs/roblox 01–09               | ครบและพร้อมให้ผู้สร้าง/Claude review                                  |
| ระบบส่งต่องาน                           | AGENTS, CLAUDE และ coordination พร้อม ยังไม่มีการตอบรับจาก Claude     |
| เกม Roblox / Place / asset upload       | ยังไม่ได้สร้างหรือยืนยัน                                              |
| Studio MCP บน Mac หรือ PC               | รองรับตามเอกสาร แต่ยังไม่พิสูจน์การเชื่อมบนเครื่องผู้สร้าง            |
| Roblox multiplayer / save / performance | NOT RUN                                                               |
| โค้ดเว็บและ crowd prototype เดิม        | ยกเลิกเป็นทิศทางผลิตภัณฑ์ เก็บโค้ดและเทสต์ไว้ใน Git เป็น legacy       |
| แผนเก่าและ archive snapshots            | ลบจาก working tree ตามคำสั่งผู้สร้าง ป้องกันความสับสน                 |
| โฆษณา ร้านจริง และระบบขายของ            | แผนอนาคต ไม่อยู่ใน MVP                                                |
| การส่งผ่าน Git                          | อยู่ระหว่าง commit/push ตามคำสั่งล่าสุด ดูใบส่งต่อและผล sync ด้านล่าง |

## Git และการย้ายไป Windows

- Remote: `https://github.com/bosocmputer/siam-street-pixcel.git`
- Branch ส่งต่อ: `codex/chiangmai-old-city-3d` ชื่อเดิม แต่เนื้อหาปัจจุบันเป็นแผน Roblox
- ฐานก่อนรอบเอกสาร: `ac7454cb170529f34d2a417af90fac00f42b4d81`
- Commit เก็บ crowd prototype และ Serena: `341c55d`
- ตำแหน่ง Mac เดิม `/Users/nontawatwongnuk/dev_bos/siam-street-pixcel` เป็นข้อมูลที่มา ไม่ใช่ path ที่ต้องใช้บน Windows
- บน PC ให้ clone branch โดยตรงตาม README/HANDOFF อย่าใช้ค่า default branch แล้วสรุปว่าเอกสารหาย
- ตรวจ `git status --short` และ `git log -3 --oneline` ทุกครั้งก่อนเริ่ม ไม่ถือ snapshot นี้เป็น lock

## งาน cleanup ที่ผู้สร้างอนุญาต

ผู้สร้างสั่ง commit/push งานทั้งหมดและลบ plan ที่เก่าแล้ว จึงรวม crowd code/tests และ config Serena ที่เคยค้างไว้หลังตรวจ พร้อมลบเอกสารแนวเดิมทั้งหมดนอก `docs/roblox` และ `docs/coordination` รวม 27 ไฟล์ ณ ตอน cleanup (23 ไฟล์ที่ tracked และ 4 snapshot ที่ยังไม่เคย commit)

ลบ GDD เก่าใน archive, roadmap, technical/art/UI briefs, pitch/research ที่ชี้แนวเก่า, mockup และ balance reports โค้ดเกมเก่าไม่ได้ถูกลบหรือพัฒนาต่อ README ของต้นแบบ/เครื่องมือถูกทำเครื่องหมาย LEGACY และชี้แผนปัจจุบัน ประวัติที่เคย commit ยังอยู่ใน Git

## ผลตรวจรอบส่งขึ้น Git

- PASS: `pnpm lint`
- PASS: `pnpm typecheck`
- PASS: `pnpm test` — 167 tests (world 35, game-core 114, web 18) ทั้งหมดเป็นการตรวจโค้ดเว็บเดิม ไม่ใช่ Roblox
- PASS: `pnpm build` — มีคำเตือน bundle ใหญ่ของต้นแบบเดิม และ test runtime มีคำเตือน localStorage ไม่ทำให้คำสั่งล้ม
- PASS: mutation check ทดลองกลับเงื่อนไข enemyAI แล้วเทสต์ crowd ตรวจพบ จากนั้นคืน source เดิมแบบ byte-for-byte และรัน crowd tests ผ่าน 4 ข้อ
- PASS: รูปแบบ Markdown หลัง cleanup; local links 86 รายการใน Markdown 25 ไฟล์, fences/UTF-8 และโครง docs เหลือเฉพาะ roblox/coordination
- PASS: `git diff --check`; ตรวจ staged file scope และ credential patterns ก่อนส่งแต่ละ commit
- NOT RUN: browser gameplay ใหม่ และ Roblox Studio/หลาย client/เครื่องจริง ไม่มีผล benchmark ใหม่ที่รับรองความจุ

## Ownership และงานถัดไป

Codex ถือเอกสาร cleanup/coordination ระหว่างส่งมอบ; ไม่มี Studio session ที่ควบคุม (studio_id/checkpoint = none)

งานถัดไปเสนอ `DOC-REVIEW-001` บน PC ให้ Claude ตรวจเอกสารและบันทึกตอบใน INBOX MSG-001 หากผู้สร้างสั่งเริ่มเกมให้เริ่ม R00 ไม่ต้องกลับไปทำ idle หรือ Three.js
