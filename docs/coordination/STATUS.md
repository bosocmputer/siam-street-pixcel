# สถานะล่าสุด — ECHO ATLAS

อัปเดต 2026-10-16 โดย Antigravity (Windows PC) · session `AGY-2026-10-16-01`

## ทิศทางปัจจุบัน

เกม Roblox Action MMORPG ที่อ้างอิงแผนที่จริง เริ่มเชียงใหม่ (ท่าแพ) รายละเอียด gameplay, story, จำนวนผู้เล่น และ balance ใน GDD เป็นข้อเสนอ/เป้าทดลอง **ผู้สร้างตัดสินใจรอบนี้:** ใช้ Place2 เป็นฐานแมพ, ผู้สร้างจะ copy ตึกจาก `EchoAtlas-City.rbxl` เอง, ระบบต่อสู้ปิดชั่วคราว, สั่งงานทีละขั้น

| รายการ | สถานะจริง |
| --- | --- |
| GDD และ docs/roblox 01–10 | ครบ; `04-real-world-map.md` ยังเขียนตามแผนเมืองจริงเดิม (ยังไม่ได้ปรับตามการเลือกวางตึกโดยผู้สร้าง) |
| Place2 (`C:\dev\Pixel Walke\roblox\studio\EchoAtlas-Place2.rbxl`) | แมพท่าแพ walkable ใน Studio — **มีการแก้ที่ยังไม่ได้เซฟ** ไฟล์นอก repo ไม่ถูก commit |
| ประตูท่าแพ (กำแพง 6×24 stud, ซุ้ม 12×16 stud, วงหินโค้ง, ซี่กำแพง, อิฐเก่า) | ทำแล้ว ตรวจด้วยภาพ + เดินผ่านใน Play ผ่าน |
| บานประตูไม้คู่ กด E เปิด/ปิด (เริ่มเปิด) — `GateService` | ทำแล้ว ทดสอบกด E จริงใน Play ผ่าน; NOT RUN: หลายผู้เล่น/มือถือ/จอยจริง/ผู้เล่นยืนขวางบาน |
| คูเมืองจริงสมมาตรทั้ง 2 ฝั่ง (เหนือ-ใต้ขนาบลานท่าแพ) + แก้พื้นเกินถนน + โมเดลสำเร็จรูปจาก Toolbox (`MOAT-001`) | **ทำเสร็จแล้ว** — (1) แก้พื้นลาน/ทางเดินที่เกินออกไปนอกถนนและตัดผ่านคูเมือง โดยเปลี่ยนแผ่นพื้นฐานเป็นสี่เหลี่ยม `Part` ล้วน (`BaseSlab_Center/NW/NE/SW/SE` + `_BankGround` ไม่มี `WedgePart` ที่ยื่นล้ำขอบถนน), ลดระดับพื้นลาน (`bdb6a6`) และเกาะถนน (`c2b49b`) ให้อยู่ต่ำกว่าผิวถนนลาดยาง (`0.082 ม. < ROAD_TOP 0.10 ม.`), และเปลี่ยนทางเดินซุ้มประตูเป็น `GateThreshold` พอดีขอบทางเท้า (2) ปรับคูเมืองทั้ง 2 ฝั่ง (`NorthMoat` และ `SouthMoat`) ให้มีรูปทรงสี่เหลี่ยมผืนผ้าสมมาตรกัน กว้าง `18.0 ม.` ลึก `6 stud` บุหิน `Slate` ตะไคร่น้ำ + ขอบหิน `Coping` + น้ำ `Terrain` สีเขียวอมน้ำเงิน + ขยายถนนและทางเท้าด้านนอกขนาบคูเมืองจนสุดปลายทั้งสองฝั่ง (3) นำเข้าโมเดลฟรีจาก Creator Store (Toolbox) ที่ตรวจสอบและลบสคริปต์แล้วเข้า `ServerStorage.EchoAtlas.Prefabs` (`MoatFountain` id `2332885124`, `StoneBridge` id `222836185`, `ParkBench` id `393609716`) วางสมมาตรกันทั้งคูเหนือและคูใต้ (`Buildings` 97 หลัง / 5,195 ชิ้นไม่ถูกแตะ) |
| ระบบดาบ/สไลม์/ต่อสู้ | **ปิดอยู่** (`Config.features.combat=false`) โค้ดครบ เปิดกลับได้; UnitTests 30/30 ผ่าน |
| ถนนจากชิ้น City template (`OldCityBuilder` + ข้อมูล OpenFreeMap) | ทำใน `EchoAtlas-City.rbxl` แล้วผู้สร้างเลือก Place2 เป็นฐาน จึงพักไว้ (โค้ดและข้อมูลยังอยู่ใน repo) |
| อาการกะพริบ (flicker) | **ยังไม่ได้แยกต้นเหตุ** |
| เกม Roblox publish / asset upload / multiplayer / save / performance | ไม่มี / NOT RUN |
| โฆษณา ร้านจริง และระบบขายของ | แผนอนาคต ไม่อยู่ใน MVP |
| โค้ดเว็บและ crowd prototype เดิม | ยกเลิกเป็นทิศทางผลิตภัณฑ์ เก็บไว้ใน Git เป็น legacy |

## Git และการย้าย

- Remote: `https://github.com/bosocmputer/siam-street-pixcel.git` branch ส่งต่อ `codex/chiangmai-old-city-3d` (ชื่อเดิม เนื้อหาเป็นแผน Roblox)
- ฐานก่อนรอบนี้: `95ac560` (ต่อจาก `d9c431b`; ยังไม่ได้ commit รอบ `AGY-2026-10-16-01` เพราะรอคำสั่งผู้สร้าง)
- git บน PC ฟ้อง dubious ownership: ใช้ `git -c safe.directory='C:/dev/Echo Atlas' …` (ไม่ได้ตั้งค่าถาวร)
- ไฟล์ Studio (.rbxl) อยู่ที่ `C:\dev\Pixel Walke\roblox\studio\` ไม่อยู่ใน repo: `EchoAtlas-Place2.rbxl` (ฐานแมพ), `EchoAtlas-City.rbxl` (สำเนา City template ที่มีตัวสร้างถนน/ระบบต่อสู้), `template-city.rbxl` (ต้นฉบับ template ห้ามแก้)

## เครื่องมือบนเครื่องนี้

Studio, Git 2.47.1, Node 22.14.0, pnpm 10.28.0, Python 3.14, Claude CLI, Antigravity (พร้อม Roblox_Studio MCP); RAM ราว 64 GB, RTX 3050 ไม่มี: Codex CLI, Rojo, Rokit, StyLua, Selene, luau-lsp, Blender, GitHub CLI

## ผลตรวจที่รันรอบนี้ (Studio บน PC, 2026-10-16) — รายละเอียดใน WORKLOG ต่อ 27

PASS: ย้อน `ThapaeWorld.Moat` เดิม + ล้างน้ำ Terrain หน้ากำแพง + คืน `Ground`/`Roads`/`Sidewalks`/`Markings`/`Props`/`StreetDecor` จาก `ServerStorage.ThapaeBackup_before_moat`; ซิงก์ `ThapaeBuilder.luau` เข้า `ServerStorage.EchoAtlas.ThapaeBuilder` แล้วรัน `Builder.moat()` สร้างคูเมืองจริง 2 ช่วง (`Data.water`) + ทางเดินเชื่อมซุ้มประตู; `UnitTests` 30/30 ผ่าน; Play: ตัวละครเดินจากลานข่วงประตูท่าแพ (`X=10 ม.`) ผ่านซุ้มประตูเข้าสู่ถนนมูลเมือง/ราชดำเนิน (`X=-13.81 ม.`) บนพื้นเรียบต่อเนื่อง (`minY = 1.25 ม.`), raycast ตรวจผิวน้ำในคูเหนือและคูใต้พบ `Enum.Material.Water` ที่ `-0.28 ม.` (1 stud ใต้ขอบ)
NOT RUN: หลายผู้เล่น; มือถือ/จอยจริง; FPS ของฉากปัจจุบัน; ตรวจกะพริบ; เปิด `combat=true` ทดสอบซ้ำ; `pnpm lint/typecheck/test/build` ของโค้ดเว็บเดิม (ไม่ได้รันรอบนี้ — ผลล่าสุดที่เคยผ่านเป็นของ commit `8b2b172`)

## Ownership และงานถัดไป

ปล่อย ownership แล้ว ไม่มี Studio session ที่ถืออยู่ งานถัดไป: ให้ผู้สร้างตรวจสอบลานข่วงประตูท่าแพ คูเมืองฝั่งเหนือ-ใต้ และเส้นถนนใน Studio ด้วยตา (แล้วกด `Ctrl+S` เซฟ `EchoAtlas-Place2.rbxl`) ก่อนสั่งงานขั้นถัดไป
