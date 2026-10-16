# Third-party (Creator Store) assets — vetting log

กติกา (เสนอ ใช้ตามเอกสาร docs/roblox/05 §10): ใช้เฉพาะของ **ฟรี** จาก Creator Store, ใส่เข้า `ServerStorage.AssetQuarantine` ก่อน, ตรวจ (1) ไม่มี Script/ModuleScript/Require ที่ไม่รู้ที่มา (ลบทิ้งถ้ามี), (2) จำนวน MeshPart/ขนาดจริงเป็นเมตร, (3) สไตล์เข้ากับชุดเดิม, (4) ภาพจริงใน Studio, แล้วบันทึกที่นี่ก่อนย้ายเข้าฉาก ตรวจสิทธิ์/เงื่อนไขของ Roblox อีกครั้งก่อน publish

| asset id | ชื่อ | ผู้สร้าง (ตามร้าน) | ผลตรวจ 2026-10-15 | ตัดสินใจ |
| --- | --- | --- | --- | --- |
| 108445747319342 | Tropical Trees Pack Low Poly | Letaij | ไม่มี script; 30 MeshPart; ต้นไม้ 17 ต้น สูง 8–13 ม.; สไตล์ป่าฝน ใบบางและมืด ไม่เหมือนต้นไม้ริมถนนเชียงใหม่ | ไม่ใช้ (ไม่เข้ากับฉาก) ลบออกจาก Place2 แล้ว |
| 126224677255100 | Utility Pole Set Lines Power Grid City Road | Gold3n5DStormj102626 | 30 ชิ้น/คู่เสา 23.7 ม. มี Script 3 ตัว (LightConfig, Type, EasyConfiguration) — ลบทิ้งทั้งหมด; ภาพ: เสาไม้+สายไฟเข้ากับถนนเมือง | ใช้ → prefab `PolePair` (ลบสคริปต์ + collider เสา) วาง 27 คู่ริมถนนใหญ่ |
| 96737362774149 | Utility Pole Set Power Lines City Street Road | QueenWwShadeu1321 | เหมือนตัวบน (ซ้ำ) | ไม่ใช้ (ซ้ำกับตัวบน) ลบแล้ว |
| 214414469 | [HH]Detailed Tree | uJordy | 729 Part ไม่มี Script; ขนาดเดิมเล็ก 4.4 ม. → ขยาย ×2.6 = 11.5 ม.; สไตล์ low-poly ต้นใหญ่เข้ากับเมือง แต่หนัก | ใช้เป็น "ต้นเด่น" prefab `TreeRain` ทุกต้นที่ 3 (9 ต้น) เท่านั้น ห้ามใช้ทั้ง 28 ต้น (จะ ~20k Part) |
| 139213891908665 | [Best!] Realistic Tree! Gear New Home Beach Tools | Megotati102 | มี Script น่าสงสัย 6 ตัว (CoreValidation + LocalScript หลายตัว อ้างอิง Players / Parent=nil) | **ปฏิเสธ** ลบแล้ว |
| 3479373926 | my tuktuk | 1lq_Armx4 | 488 Part + 19 MeshPart + สคริปต์รถ A-Chassis 15 ตัว (ลบทั้งหมด) ขนาด 2.7×3.1×5.0 ม. | ใช้เป็นพร็อพจอดนิ่ง prefab `TukTuk` 2 คัน ติดตามประสิทธิภาพ |

การปรับให้เข้าสไตล์ที่ทำแล้ว: ลบสคริปต์/กล้องทั้งหมด, ตั้ง Anchored, ปิดการชนของรายละเอียดและใช้ collider ใสแทน, ย้าย pivot ไปฐานโมเดล, ปรับสเกลเป็นเมตรจริง, ตั้งชื่อ/โครงสร้างใหม่ใน `ServerStorage.EchoAtlas.Prefabs` (ไม่เปลี่ยนสีเพราะต้นเดิมเข้ากับโทนอยู่แล้ว)

วิธีสร้าง prefab ใหม่เมื่อ Place2 หาย: `insert_asset` ตาม id ข้างบนเข้า `ServerStorage.AssetQuarantine` → ลบ Script/Camera → freeze → `WorldPivot` ที่ฐาน → วางใน `ServerStorage.EchoAtlas.Prefabs` ชื่อ `PolePair`, `TreeRain`, `TukTuk` แล้วรัน `Builder.trees()` และ `Builder.freeAssets()`
| 12740288760 | ป้ายถนนซอย (Bangkok-style soi sign) | bruudhehlkdjwdkh | ไม่ได้นำเข้า: เป็น Decal ชื่อตัวอย่าง แก้ข้อความจริงไม่ได้ | ไม่ใช้ → สร้างเอง: ป้ายพร้อม SurfaceGui ข้อความไทย+อังกฤษจากชื่อถนนจริง (OSM) |
| 9112786813 | Gas Town Canada 3 (SFX) ambience loop 36 s | ProSoundEffects (Roblox audio library) | โหลดได้ 36.0 วินาที เล่นลูปได้ในโหมด Play; เป็นเสียงนักท่องเที่ยว+รถผ่านเบา ๆ (บันทึกจากแคนาดา ไม่ใช่ไทย) | ใช้ชั่วคราวเป็นบรรยากาศลานท่าแพ (Volume 0.35, RollOff 40–260 studs) หาเสียงที่ตรงบริบทไทยกว่านี้ภายหลัง |
| 132652534416062 | Trash Can Bin Trashcan Garbage Street City Recycle | (ร้านค้า) | 4 Part (union) 0.5×1.0×0.5 ม.; มี Script 2 ตัว (Runtime, ScreenBuilder อ้าง Players) → ลบทั้งหมด | ใช้ → prefab `TrashCan` 18 ใบ |
| 118610201116825 | Trash Can Bin Garbage Recycling Street Trashcan | Lesomaku610 | 1 MeshPart ขนาด 0.1×0.2 ม. เล็กเกินไป มี Script เหมือนกัน | ไม่ใช้ |
| 11668029649 | Low Poly Scooter Bundle Pack (Prop) | Mustrive | ไม่มี Script; 8 สกู๊ตเตอร์ ~93 Part/คัน; คันละ 0.6×1.4×2.2 ม. | ใช้คันแรก → prefab `Scooter` จอด 14 คัน (≈1,700 Part รวม) |
| 121597010240325 | 20 Potted Plants & Planters - Realistic | TheAngelGaming1 | ไม่มี Script แต่เป็น 554 Part ในโมเดลเดียว แยกต้นไม่ได้ (จัดกลุ่มได้ 3 ก้อนที่ปนกัน) | ไม่ใช้ → กระถางสร้างเอง (เทปูน + ใบไม้ 3–4 Part) |
| 9116971175 | Morning Forest Birds 2 (SFX) 36 s loop | ProSoundEffects (Roblox audio library) | โหลดได้ 36.0 วิ เล่นได้ในโหมด Play | ใช้ → นกเบา ๆ ใกล้ต้นไม้ (Volume 0.18) |
| (ค้นแล้วไม่พบ) | เสียงตลาด/เมืองไทย | — | ผลค้นเป็นเสียงนอกบริบท (คาสิโน ฟาร์ม ห้องควบคุมเรือบรรทุกเครื่องบิน) | ไม่มี → ต้องให้ผู้สร้างจัดหาเสียงที่มีสิทธิ์ใช้ หรือเก็บใช้ ambience ชั่วคราว |
| (ค้นแล้ว) | slime monster blob | หลายผู้สร้าง | ผลค้น: "Slime Suit", "Slime [Lv. 1]" (testtt), "green guy" ฯลฯ ไม่ตรงงานออกแบบ (สไลม์หยดฝน) และไม่มีตัวที่มีรายละเอียดบอก "No scripts" | ไม่ใช้ → สไลม์สร้างเองด้วย Part (ลูกแก้วโปร่งแสง + ตา) ใน `EnemyService` |
| 5789211405 | sword_swing_fast_whoosh_blade_ring_001 | Schnogrind | โหลดได้ ยาว 0.30 วิ ในโหมด Play | ใช้เป็นเสียงฟัน |
| 79207007520543 | hit_body_09 | ChipTheTrainer2 | โหลดได้ ยาว 0.39 วิ | ใช้เป็นเสียงโดน |
| 82867838509284 | Low Poly Tree (Trees Pack Forest Nature) | Roblox (บัญชีทางการ) | ดูภาพจริงแล้ว: ต้นไม้ low-poly สีเขียวหม่น 2 mesh ขนาด 8.5×11.5×7.8 ม.; ต้นฉบับมี Script 2 ตัว (ลบทั้งหมด) | ใช้ → prefab `StreetTreeA` (ปรับสีใบเป็นพาเลตต์โครงการ) |
| 70630071171182 | Arbol Low Poly Tree Model | Roblox (บัญชีทางการ) | ดูภาพแล้ว: ต้นสองพุ่ม 3 mesh 7.0×9.3×6.7 ม.; มี Script 2 ตัว (ลบ) | ใช้ → prefab `StreetTreeB` |
| 89384936911598 | Low Poly Tree Cartoon | Roblox | ดูภาพแล้ว สีเขียวสดเกินไป การ์ตูน | ไม่ใช้ |
| 119411990865533 | Arboles Realistas Trees Forest | Roblox | ดูภาพแล้ว เขียวนีออน | ไม่ใช้ |
| (ค้นแล้ว) | bush/hedge, bicycle, "tree" ทั่วไป | หลายผู้สร้าง | ผลค้นปนของขยะ (ชื่อไม่เกี่ยวข้อง, แท็กยัดคำ, ไม่มีรายละเอียด) แม้ตั้งค่า verified creators; ตัวที่มีสเปกชัด เช่น Bike Mesh 66 ชิ้น ยังไม่ได้ดูภาพ | ยังไม่ใช้ — วิธีที่ได้ผล: ดูภาพ thumbnail (ดาวน์โหลดผ่าน thumbnails API) ก่อนนำเข้า |
| 2332885124 | Park Fountain | barbarianblox | 28 Part (18 MeshPart) + 20 ParticleEmitter (ละอองน้ำพุ) + 1 Sound; **ไม่มี Script**; ขนาดจริง 3.08×3.00×3.08 ม. | **ใช้** → prefab `MoatFountain` วางบนแท่นหินกลางคูเมืองทั้งฝั่งเหนือ (2 จุด) และฝั่งใต้ (2 จุด) ให้สมมาตรกัน |
| 13782728612 | Better Low Poly Fountain | ComputerLider123 | 31 Part (23 MeshPart) + 5 ParticleEmitter; มี Script 1 ตัว (`Credits`) → ลบทิ้งแล้ว; ขนาด 6.85×6.28×7.42 ม. | เก็บเป็น prefab สำรอง `MoatFountainLarge` |
| 222836185 | Stone Bridge | Dexhall | 37 Part (Concrete); **ไม่มี Script**; ขนาดต้นฉบับ 5.14×2.11×9.68 ม. (แกนภายในเอียง 45° → ตั้ง WorldPivot ใหม่ให้ตั้งฉากกับคูเมืองและขยาย ×1.98 ข้ามคู 18 ม.) | **ใช้** → prefab `StoneBridge` วางพาดข้ามคูเมืองทั้งฝั่งเหนือและฝั่งใต้ |
| 393609716 | Park Bench | AeliteOfficial | 27 Part; มี Script 1 ตัว → ลบทิ้งแล้ว; ขนาด 2.80×1.12×2.69 ม. (ย่อ ×0.75) | **ใช้** → prefab `ParkBench` วางริมทางเดินหัวคูเมืองทั้งสองฝั่ง |
| 3413806622 | Canal | Danielut23 | 1 Union ขนาด 1.10×0.16×1.10 ม. (เป็นแค่ฝาท่อเล็ก ๆ) + 1 Script | **ปฏิเสธ** ลบออกจาก `AssetQuarantine` แล้ว |
