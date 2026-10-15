# Handoff — ย้ายงานจาก Mac ไป Windows PC

ผู้เขียน Codex · 2026-10-15 · session `SYNC-2026-10-15-01`

## คำสั่งล่าสุดและขอบเขต

ผู้สร้างให้ commit/push ทุกงานที่ค้าง และลบ plan เก่าที่เลิกใช้เพื่อไม่ให้ Claude สับสน ย้ายการทำงานไป Windows PC โดยใช้ Codex และ Claude ผ่านเอกสารร่วมใน repo

## สิ่งที่รับช่วง

- GDD ECHO ATLAS และ docs/roblox 01–09: story, action combat, RPG/social, map, asset, architecture, roadmap และแผนธุรกิจอนาคต
- AGENTS/CLAUDE/README/PRODUCT ชี้ทิศทาง Roblox เหมือนกัน
- coordination สำหรับสถานะ task ownership worklog และข้อความตอบกลับ
- งาน crowd benchmark เดิมถูกตรวจและ commit เป็น legacy ใน `341c55d` ไม่ใช่ระบบออนไลน์ Roblox
- แผนเก่าและ planning artifacts 27 ไฟล์ถูกลบ; ไม่มีโฟลเดอร์ archive แผนเก่าค้างให้ตีความเป็นงานปัจจุบัน โค้ดต้นแบบเก่ายังอยู่และมีป้าย LEGACY

ยังไม่ติดตั้งหรือเชื่อม Studio ไม่สร้าง Roblox source/Place ไม่ปั้น asset ไม่เปิดขาย/โฆษณา และไม่มีการทดสอบ Roblox ใหม่ ตัวเลขในแบบเป็นค่าทดลอง

## สถานะ Git ที่ยืนยันแล้ว

Push สำเร็จบน `origin/codex/chiangmai-old-city-3d` ชุดโค้ด legacy คือ `341c55d` และชุดเอกสาร/cleanup คือ `8b2b172` ตรวจ remote hash ตรงกับ local ที่ `8b2b1728ac1879e7d9c5d46dd8b8d3949ba13dea` และ working tree สะอาดก่อนบันทึก receipt นี้ ไฟล์สถานะ/ใบส่งต่ออาจมี commit receipt ต่อท้าย ให้ใช้ HEAD ล่าสุดของ branch เมื่อ clone ไม่มีไฟล์หรือ Studio ที่ Codex ถือค้าง

## รับ repo ให้ถูก branch

```powershell
git clone --branch codex/chiangmai-old-city-3d https://github.com/bosocmputer/siam-street-pixcel.git
cd siam-street-pixcel
git status --short
git log -3 --oneline
```

หากมี clone อยู่แล้ว ให้ตรวจ working tree ก่อน fetch/switch อย่า reset งานใน PC ทิ้ง ชื่อ branch เป็นชื่อเดิมของต้นแบบ ไม่ใช่ชื่อแนวเกมปัจจุบัน ไม่ต้องติดตั้ง Node/pnpm เพียงเพื่ออ่านเอกสาร

## การตรวจและข้อจำกัด

Typecheck, lint, build และ tests เว็บเดิม 167 ข้อผ่าน มีคำเตือน bundle ใหญ่ที่ไม่ทำให้ build ล้ม ตรวจ mutation ของเงื่อนไข enemyAI แล้วเทสต์จับได้ คืนไฟล์และทดสอบ crowd ผ่านอีกครั้ง

ผล Markdown/local links/staged diff และผล sync ล่าสุดให้ดู STATUS/WORKLOG แยกจากผลทดสอบ Roblox ซึ่งยัง NOT RUN ไม่มี Studio session/checkpoint หรือ agent owner ของ Studio ในรอบนี้

## งานแรกที่แนะนำให้ Claude ทำ

รับ `DOC-REVIEW-001`: ตรวจความขัดแย้ง ขอบเขต MVP และสมมติฐานเทคนิค ส่งข้อพบใน INBOX MSG-001 แล้วอัปเดต TASKS/STATUS/WORKLOG/HANDOFF ให้ Codex อ่านต่อ ไม่มีหลักฐานว่า Claude รับหรืออ่านงานแล้วจนกว่ามันจะเขียนตอบ

## Prompt พร้อมใช้บน PC

```text
คุณกำลังรับงานต่อจาก Codex บน Mac มาพัฒนาต่อบน Windows PC
Repository: https://github.com/bosocmputer/siam-street-pixcel.git
Branch: codex/chiangmai-old-city-3d

ตรวจ git status/branch ก่อน แล้วอ่าน AGENTS.md, CLAUDE.md,
docs/coordination/STATUS.md, HANDOFF.md, TASKS.md และ INBOX.md
ตามด้วย game_design_document.md และ docs/roblox/README.md กับเอกสาร 01–09
หากไม่พบไฟล์เหล่านี้ให้ตรวจ branch และการ sync อย่าใช้แผนเก่าทดแทน

ฉันไม่มีพื้นฐาน Roblox หรือโปรแกรม ต้องการใช้ทั้ง Claude และ Codex ทำงานร่วมกัน
เป้าหมายคือ Action MMORPG อ้างอิงแผนที่จริง เริ่มพื้นที่เล็กในเชียงใหม่แล้วขยายทั่วโลก
ไม่บังคับ GPS หรือบุคคลที่หนึ่ง เริ่มนักดาบ สไลม์ และคลื่นคมจันทร์
แผนเก่าถูกลบแล้ว โค้ดเว็บที่ยังอยู่เป็น legacy ไม่ต้องพัฒนาต่อตามแนวเดิม

รอบแรกให้รับ DOC-REVIEW-001 ตรวจเอกสารและสำรวจความพร้อม Windows แบบอ่านข้อมูล
ยังไม่ติดตั้งเครื่องมือหรือเขียนเกมในรอบ review แก้บั๊กเอกสารชัดเจนได้
ถ้าจะเปลี่ยนทิศทางใหญ่ให้เสนอเหตุผลและทางเลือก แล้วสรุปขั้นตอน R00 ที่แนะนำ

Claim งานและขอบเขตไฟล์ก่อนแก้ ตอบ feedback ใน INBOX thread MSG-001
จบแล้วอัปเดต TASKS, STATUS, WORKLOG และ HANDOFF เพื่อให้ Codex รับช่วง
แยกข้อเสนอ ผลทดสอบจริง และสิ่งที่ยังไม่ได้ทำ ไม่อ้างว่าเชื่อม Studio หรือเกมผ่านแล้ว
อธิบายกับฉันเป็นภาษาไทยที่เข้าใจง่าย
```

Prompt นี้เป็นข้อความให้ผู้สร้างใช้เปิด session ไม่ใช่หลักฐานว่าได้ส่งข้อความถึง Claude อัตโนมัติ
