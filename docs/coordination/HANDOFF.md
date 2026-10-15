# Handoff — จบงานรอบวันที่ 2026-10-15/16 (Claude บน Windows PC) → Claude / Codex รอบถัดไป

From: Claude (Windows PC, Sonnet 5.5) · To: Claude session ถัดไป (หลังโควต้ารีเซ็ต) หรือ Codex บน Mac
ผู้สร้างสั่งจบงานเพราะโควต้า Claude เต็ม ให้อัปเดตสถานะ/เอกสาร + commit + push + ทิ้ง prompt ส่งต่อ (ท้ายไฟล์นี้)
Branch: `codex/chiangmai-old-city-3d` · ฐานก่อนรอบนี้ `d9c431b` · รอบนี้ commit รวมงานทั้งหมดที่ค้าง (ดู git log)
Studio: **Place2** = `C:\dev\Pixel Walke\roblox\studio\EchoAtlas-Place2.rbxl` (ไฟล์อยู่นอก repo, **ไม่ถูก commit**) — มีการแก้ **ที่ยังไม่ได้เซฟ** ต้องให้ผู้สร้างกด Ctrl+S ก่อนปิด (instance id เปลี่ยนทุกครั้งที่เปิดใหม่ ให้เรียก `list_roblox_studios` ใหม่); owner ตอนส่งมอบ = none

## สิ่งที่ผู้สร้างตัดสินใจ (ยึดตามนี้)
- **Place2 คือฐานของแมพ** (ลงตัวกว่าที่ลองใน City template) ตึกอื่น ๆ **ผู้สร้างจะ copy จาก `EchoAtlas-City.rbxl` มาวางเอง**; ไฟล์ City/`template-city.rbxl` ใช้เป็นแหล่งชิ้นส่วนเท่านั้น (ไม่ต้องแก้)
- ระบบดาบ/สไลม์/ต่อสู้ **ปิดชั่วคราว** (`Config.features.combat = false`) เพื่อโฟกัสแมพและเดินสำรวจ เปิดกลับด้วยค่าเดียว
- ผู้สร้างจะ **สั่งทีละขั้น** อย่าทำหลายขั้นรวด/อย่าเดาเกินคำสั่ง (เคยทำพลาดเพราะทำรวดเดียว)
- คำเตือนสำคัญ: **ห้ามรัน `Builder.clear()` หรือสร้าง `ThapaeWorld` ใหม่ทั้งชุด** ใน Place2 โดยไม่ถามก่อน (จะลบตึกที่ผู้สร้างวาง) ขั้นตอนที่ทำเฉพาะกลุ่ม: `B.init(Data)` → ลบลูกของ `ThapaeWorld.Walls` → `B.walls()`

## ทำเสร็จรอบนี้ (รายละเอียด+หลักฐานใน WORKLOG ต่อ 11–25)
1. **ประตูท่าแพใน Place2:** กำแพงหนา 6 × สูง 24 stud (หน่วย stud แปลง 1 stud = 0.28 ม.), ซุ้มช่องโค้ง 12 × 16 stud โค้งแบน (superellipse) + วงหินโค้ง (voussoir) + หินเสาข้าง, ซี่กำแพง 3/3/3 stud, อิฐเก่าหลายโทน (ตัดชิ้นตาม tile 4 stud เพื่อลายอิฐต่อเนื่อง), กำแพงเมืองสองข้างปรับเป็นสเปกเดียวกัน (**เปลี่ยนจากข้อมูล OSM ตามสั่ง**)
2. **บานประตูไม้คู่** (WoodPlanks, แถบเหล็กดำ, ลูกหมุดครึ่งทรงกลม) **กด E เปิด/ปิด ค่าเริ่มต้นเปิด**: `roblox/src/server/GateService.luau` (เซิร์ฟเวอร์ตัดสิน: ตรวจระยะ ≤ 30 stud, cooldown 1.2 วิ, tween บาน 0.9 วิ) + ProximityPrompt สร้างโดย builder; ทดสอบกดปุ่ม E จริงใน Play ผ่าน (หมายเหตุ: prompt ของ Roblox โผล่เฉพาะเมื่อ prompt อยู่ในมุมกล้อง)
3. **ปิดระบบต่อสู้** (`Config.features.combat=false` → Bootstrap/CombatClient/HudClient เช็คค่านี้) ทดสอบ Play: ไม่มีสไลม์/ดาบ/HUD, ประตูยังทำงาน
4. **ข้อมูลเมืองเก่าจาก OpenFreeMap** (6 tile z14 ใน `roblox/world/source/openfreemap/`, ถอดรหัสด้วย `tools/roblox/gen_oldcity_roads.py` → `roblox/world/OldCityRoads.luau` ถนนรถวิ่ง ≈ 160 กม. ย่านคูเมือง) และตัวสร้างถนนจากชิ้น City template `roblox/world/OldCityBuilder.luau` (ใช้ใน `EchoAtlas-City.rbxl` เท่านั้น ไม่เกี่ยวกับ Place2; ผลยังไม่เป็นที่พอใจของผู้สร้างเมื่อเทียบกับ Place2)
5. เทียบ OpenFreeMap กับ OSM snapshot ท่าแพ: ถนนห่าง ≤ 0.29 ม. (ข้อมูลตรงกัน)

## ⚠ ข้อผิดพลาดที่ค้างและต้องแก้ก่อน: คูเมืองและสะพาน (WORKLOG ต่อ 25)
ผู้สร้างแจ้งว่า **ผม (Claude) เข้าใจผิดตำแหน่ง**: สร้างคูเมือง+สะพานชิดกำแพงด้านลาน แต่ **ของจริงไม่ได้อยู่ตรงนั้น** (ผู้สร้างจะบอกตำแหน่งที่ถูกต้องรอบหน้า — ยังไม่รู้ว่าอยู่ตรงไหน **อย่าเดา ให้ถามผู้สร้างพร้อมแผนที่/ภาพอ้างอิงก่อน**) สิ่งที่อยู่ใน Place2 ตอนนี้ (ยังไม่ได้เซฟ):
- `ThapaeWorld.Moat` (ผนัง/พื้นหิน Slate, สะพานคอนกรีต, ราว) + น้ำ Terrain ในแถบ s ≈ 0.84–5.32 ม. หน้ากำแพงด้านลาน ยาว 70 ม.
- พื้นลานและพื้นฐาน 250 × 250 ม. ถูก **ตัดเป็นแถบ**, เส้นข้อต่อพื้นปลายถูกตัด, เสาไฟ/ม้านั่ง 17 ชิ้นถูกเลื่อน +5.3 ม., ฝาท่อ 1 ชิ้นถูกลบ
- **วิธีย้อนกลับเต็ม (ถ้าผู้สร้างสั่งยกเลิก):** (1) ลบ `ThapaeWorld.Moat`; (2) ล้างน้ำ: `workspace.Terrain:FillBlock(CFrame ครอบแถบ, Vector3.new(264,12,~(4.48+2)/0.28), Enum.Material.Air)` ที่ศูนย์กลางแถบ (สูตรอยู่ใน WORKLOG ต่อ 25 / ดูโค้ดที่ใช้ล้างใน session นี้: ศูนย์กลาง = anchor + gateNrm × 3.08 ม. , y ≈ −3.5 stud); (3) คืนกลุ่ม Ground, Roads, Sidewalks, Markings, Props, StreetDecor จาก `ServerStorage.ThapaeBackup_before_moat` (ลบลูกของกลุ่มเดิม แล้ว clone ลูกจากสำรองกลับ) — ระวังอย่าแตะ `Buildings`
- ถ้าผู้สร้างต้องการ "ย้ายตำแหน่ง" แทนยกเลิก: `Builder.moat()` ผูกกับ gate frame (`MOAT_*`, `S0 = GATE_THICK/2`, `MOAT_HALF_LEN`) ต้องปรับพารามิเตอร์ตำแหน่ง/ทิศ (ปัจจุบันฮาร์ดโค้ดเป็น "หน้ากำแพงด้านลาน") แล้วย้อนของเดิมก่อนรันใหม่; มันเป็น post-pass ที่แก้พื้น **ทับของเดิม** จึงต้องย้อนก่อนทุกครั้ง
- ข้อมูลที่เกี่ยวข้อง: คูตาม OSM เดิมใน Place2 (2 ชิ้นน้ำที่ a ≈ 77 ม. s ≈ 14 ม. จากประตู) ยังอยู่ ไม่ได้แตะ; ถนนขนานกำแพงอยู่ฝั่งเมือง (s ≈ −9 ม.) ฝั่งลานไม่มีถนนติดกำแพง

## สำรองใน ServerStorage ของ Place2 (ย้อนกลับได้ ลบเมื่อไม่ต้องการ)
`ThapaeBackup_before_moat` (Ground/Roads/Sidewalks/Markings/Props/StreetDecor/Walls ก่อนขั้นคู), `WallsBackup_before_openable_doors`, `WallsBackup_spec_gate_thin`, `WallsBackup_6m_gate`, `WallsBackup_before_gate_widen` (กำแพงรุ่นก่อน ๆ) — ฉากเปิดแล้วจะอยู่ในไฟล์ถ้าผู้สร้างเซฟ

## เครื่องมือ/วิธีซิงก์ (repo → Studio, ทางเดียว)
`python -I -m http.server 8765 --bind 127.0.0.1` ใน `roblox/` แล้วรัน `execute_luau` (Edit) ที่ดึงไฟล์ผ่าน `HttpService:GetAsync` (ใน Place2 `HttpEnabled = true` อยู่แล้ว) — สคริปต์เกม: `tools/roblox/sync_to_studio.luau` (ตาม `roblox/src/manifest.json`) ส่วน `ThapaeBuilder` ต้องสร้าง/แทนที่โมดูลใน `ServerStorage.EchoAtlas` เอง; **ปิดเซิร์ฟเวอร์เมื่อเสร็จ** (ตอนส่งมอบปิดแล้ว) git บนเครื่องนี้ฟ้อง dubious ownership: ใช้ `git -c safe.directory='C:/dev/Echo Atlas' …` (ไม่ได้แก้ config ถาวร)

## ยังไม่ได้ทดสอบ (NOT RUN)
unit test หลังเพิ่ม `features`; เปิด `combat=true` กลับแล้วเล่นซ้ำ; ผู้เล่นหลายคน/มือถือ/จอยจริง; FPS ของฉากปัจจุบัน (Walls เพิ่มเป็น ~700 ชิ้น); การชนของบานเมื่อผู้เล่นยืนขวาง; อาการกะพริบ (flicker) ที่ผู้สร้างเคยรายงาน — ยังไม่ได้แยกต้นเหตุ (ยอดซุ้มแก้แล้วแต่ไม่ได้ตรวจซ้ำ; เส้นถนนหนา 5 ซม. เป็นการเดา ไม่พิสูจน์); แสงออกน้ำเงินจัดที่เงา และสัดส่วนประตูเทียบรูปจริง (ค่าทั้งหมดเป็นของผู้สร้าง/ประมาณ ไม่ใช่การสำรวจ)

## Next action (ข้อเดียว)
**ถามผู้สร้างว่าคูเมืองและสะพานทางเข้าจริงอยู่ตรงไหนเมื่อเทียบกับประตูท่าแพ (ขอภาพ OpenFreeMap/ภาพถ่ายที่ใช้ได้) ก่อน** แล้วย้อนคู/สะพานที่สร้างผิดที่ (ดูวิธีย้อนด้านบน) จากนั้นค่อยสร้างใหม่ตามสเปก stud เดิมที่ตำแหน่งที่ถูกต้อง Acceptance: ผู้สร้างเห็นตำแหน่งตรงกับของจริง; Place2 เดินผ่านประตูและข้ามสะพานได้; Buildings ยังไม่ถูกแตะ; บันทึก WORKLOG + commit

## Prompt ส่งต่อ (วางให้ Claude/Codex session ใหม่)
```
อ่าน AGENTS.md, CLAUDE.md แล้ว docs/coordination/STATUS.md, HANDOFF.md, TASKS.md, INBOX.md (MSG-002) และท้าย WORKLOG.md (ต่อ 11–26) ก่อนทำอะไร
สถานะ: ใช้ Place2 (C:\dev\Pixel Walke\roblox\studio\EchoAtlas-Place2.rbxl) เป็นฐานแมพ ตึกผู้สร้างจะ copy จาก EchoAtlas-City.rbxl เอง ระบบต่อสู้ปิดอยู่ (Config.features.combat=false) ประตูท่าแพ+บานไม้กด E ทำแล้ว
งานแรก: ผู้สร้างบอกว่าคูเมืองและสะพานที่ Claude สร้างชิดกำแพงด้านลาน "ผิดตำแหน่ง ของจริงไม่ได้อยู่ตรงนั้น" — ห้ามเดา ให้ถามผู้สร้างว่าตำแหน่งจริงอยู่ตรงไหน (ขอแผนที่/ภาพอ้างอิง) ก่อน แล้วย้อนของที่สร้างผิดที่ตามวิธีใน HANDOFF (ลบ ThapaeWorld.Moat, ล้างน้ำ Terrain, คืน Ground/Roads/Sidewalks/Markings/Props/StreetDecor จาก ServerStorage.ThapaeBackup_before_moat) แล้วสร้างใหม่ที่ตำแหน่งที่ถูกต้องด้วยสเปกเดิม (คู 16 กว้าง × 6 ลึก stud หินสเลตมอส น้ำ Terrain สีเขียวน้ำเงิน; สะพานคอนกรีต 12 × 16 stud ผิวสูงกว่าน้ำ 1 stud ราวกันตก)
กฎ: ผู้สร้างสั่งทีละขั้น อย่าทำหลายขั้นรวด; ห้ามรัน Builder.clear()/สร้าง ThapaeWorld ใหม่ทั้งชุด (จะลบตึกที่ผู้สร้างวาง); ตอบเป็นภาษาไทยเข้าใจง่าย บอก NOT RUN ถ้าไม่ได้ทดสอบ; อย่า commit/push ถ้าผู้สร้างไม่ได้สั่ง; ก่อนแก้ฉากต้องให้ผู้สร้างหยุด Play (Edit mode) และอย่า blanket git add
เมื่อเสร็จ: อัปเดต STATUS/TASKS/WORKLOG/HANDOFF แล้วทิ้ง next action ข้อเดียว
```
