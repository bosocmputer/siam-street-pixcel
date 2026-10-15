# สถานะล่าสุด — ECHO ATLAS

อัปเดต 2026-10-16 โดย Claude (Windows PC) · session `REVIEW-2026-10-15-01` (ปิดงานเพราะโควต้าเต็ม)

## ทิศทางปัจจุบัน

เกม Roblox Action MMORPG ที่อ้างอิงแผนที่จริง เริ่มเชียงใหม่ (ท่าแพ) รายละเอียด gameplay, story, จำนวนผู้เล่น และ balance ใน GDD เป็นข้อเสนอ/เป้าทดลอง **ผู้สร้างตัดสินใจรอบนี้:** ใช้ Place2 เป็นฐานแมพ, ผู้สร้างจะ copy ตึกจาก `EchoAtlas-City.rbxl` เอง, ระบบต่อสู้ปิดชั่วคราว, สั่งงานทีละขั้น

| รายการ | สถานะจริง |
| --- | --- |
| GDD และ docs/roblox 01–10 | ครบ; `04-real-world-map.md` ยังเขียนตามแผนเมืองจริงเดิม (ยังไม่ได้ปรับตามการเลือกวางตึกโดยผู้สร้าง) |
| Place2 (`C:\dev\Pixel Walke\roblox\studio\EchoAtlas-Place2.rbxl`) | แมพท่าแพ walkable ใน Studio — **มีการแก้ที่ยังไม่ได้เซฟ** ไฟล์นอก repo ไม่ถูก commit |
| ประตูท่าแพ (กำแพง 6×24 stud, ซุ้ม 12×16 stud, วงหินโค้ง, ซี่กำแพง, อิฐเก่า) | ทำแล้ว ตรวจด้วยภาพ + เดินผ่านใน Play ผ่าน |
| บานประตูไม้คู่ กด E เปิด/ปิด (เริ่มเปิด) — `GateService` | ทำแล้ว ทดสอบกด E จริงใน Play ผ่าน; NOT RUN: หลายผู้เล่น/มือถือ/จอยจริง/ผู้เล่นยืนขวางบาน |
| คูเมืองและสะพานทางเข้า | **สร้างผิดตำแหน่ง** (ชิดกำแพงด้านลาน ผู้สร้างแจ้งว่าของจริงไม่ได้อยู่ตรงนั้น) ต้องย้อนและสร้างใหม่ — ดู INBOX MSG-002, HANDOFF |
| ระบบดาบ/สไลม์/ต่อสู้ | **ปิดอยู่** (`Config.features.combat=false`) โค้ดครบ เปิดกลับได้; เคยทดสอบด้วยสคริปต์แล้ว แต่ไม่ได้ทดสอบซ้ำหลังซิงก์ล่าสุด |
| ถนนจากชิ้น City template (`OldCityBuilder` + ข้อมูล OpenFreeMap) | ทำใน `EchoAtlas-City.rbxl` แล้วผู้สร้างเลือก Place2 เป็นฐาน จึงพักไว้ (โค้ดและข้อมูลยังอยู่ใน repo) |
| อาการกะพริบ (flicker) | **ยังไม่ได้แยกต้นเหตุ** |
| เกม Roblox publish / asset upload / multiplayer / save / performance | ไม่มี / NOT RUN |
| โฆษณา ร้านจริง และระบบขายของ | แผนอนาคต ไม่อยู่ใน MVP |
| โค้ดเว็บและ crowd prototype เดิม | ยกเลิกเป็นทิศทางผลิตภัณฑ์ เก็บไว้ใน Git เป็น legacy |

## Git และการย้าย

- Remote: `https://github.com/bosocmputer/siam-street-pixcel.git` branch ส่งต่อ `codex/chiangmai-old-city-3d` (ชื่อเดิม เนื้อหาเป็นแผน Roblox)
- ฐานก่อนรอบนี้: `d9c431b` (commit รอบนี้รวมงานทั้งหมดของ session นี้ — ใช้ `git log` ดู hash ล่าสุด)
- git บน PC ฟ้อง dubious ownership: ใช้ `git -c safe.directory='C:/dev/Echo Atlas' …` (ไม่ได้ตั้งค่าถาวร)
- ไฟล์ Studio (.rbxl) อยู่ที่ `C:\dev\Pixel Walke\roblox\studio\` ไม่อยู่ใน repo: `EchoAtlas-Place2.rbxl` (ฐานแมพ), `EchoAtlas-City.rbxl` (สำเนา City template ที่มีตัวสร้างถนน/ระบบต่อสู้), `template-city.rbxl` (ต้นฉบับ template ห้ามแก้)

## เครื่องมือบนเครื่องนี้

Studio, Git 2.47.1, Node 22.14.0, pnpm 10.28.0, Python 3.14, Claude CLI; RAM ราว 64 GB, RTX 3050 ไม่มี: Codex CLI, Rojo, Rokit, StyLua, Selene, luau-lsp, Blender, GitHub CLI การซิงก์ repo → Studio ใช้เซิร์ฟเวอร์ไฟล์ local (`python -I -m http.server 8765 --bind 127.0.0.1` ใน `roblox/`) + `execute_luau` ดู `roblox/README.md`

## ผลตรวจที่รันรอบนี้ (Studio บน PC, 2026-10-15/16) — รายละเอียดใน WORKLOG ต่อ 11–26

PASS: ซิงก์ไฟล์ repo → Place2 ตาม manifest; Play: เซิร์ฟเวอร์เริ่มได้, ไม่มีสไลม์/ดาบ/HUD เมื่อ combat ปิด, ประตูเปิดตามค่าเริ่มต้น, กด E จริงสลับสถานะ + cooldown ทำงาน, ตัวละครเดินจากลานข้ามสะพานผ่านซุ้มไปฝั่งเมืองได้
NOT RUN: unit test หลังเพิ่ม `features`; หลายผู้เล่น; มือถือ/จอยจริง; FPS ของฉากปัจจุบัน; ตรวจกะพริบ; เทียบกับของจริงด้วยภาพอ้างอิง; `pnpm lint/typecheck/test/build` ของโค้ดเว็บเดิม (ไม่ได้รันรอบนี้ — ผลล่าสุดที่เคยผ่านเป็นของ commit `8b2b172`)

## Ownership และงานถัดไป

ปล่อย ownership แล้ว ไม่มี Studio session ที่ถืออยู่ งานถัดไป: ถามผู้สร้างตำแหน่งคูเมือง/สะพานที่ถูกต้อง (INBOX MSG-002) แล้วย้อนของที่สร้างผิดที่และสร้างใหม่ — ดู HANDOFF สำหรับวิธีย้อนและ prompt ส่งต่อ
