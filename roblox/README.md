# roblox/ — Echo Atlas Studio sources (Windows PC)

สถานะ: R01 slice แรก "ท่าแพ walkable" สร้างและทดสอบเดินใน Place2 แล้ว (ดู docs/coordination/STATUS.md) ไม่ใช่เกมที่เล่นได้เต็มระบบ

## ไฟล์

| ไฟล์                                       | หน้าที่                                                                        |
| ------------------------------------------ | ------------------------------------------------------------------------------ |
| `world/source/osm_thapae_2026-10-15.json`  | snapshot ดิบจาก OpenStreetMap (Overpass) ห้ามแก้ — ODbL ต้องให้เครดิตก่อน publish |
| `world/ThapaeData.luau`                    | ข้อมูลแปลงแล้ว (เมตร, X ตะวันออก, Z ใต้, origin = ประตูท่าแพ) สร้างโดย tools     |
| `world/ThapaeBuilder.luau`                 | โค้ดสร้างเมืองใน Workspace.ThapaeWorld (เมตร→stud ที่จุดเดียว 1 stud = 0.28 ม.) |
| `../tools/roblox/gen_thapae_data.py`       | snapshot → ThapaeData.luau (`python -I tools/roblox/gen_thapae_data.py 105`)     |

## โหลดเข้า Studio (วิธีที่ใช้ตอนนี้ ไม่ต้องติดตั้งอะไรเพิ่ม)

1. รันเซิร์ฟเวอร์ไฟล์ local อ่านอย่างเดียว: `cd roblox && python -I -m http.server 8765 --bind 127.0.0.1`
2. ใน Studio (Edit) ให้ AI รัน `execute_luau`: เปิด `HttpService.HttpEnabled`, ดึง `/world/ThapaeData.luau` และ `/world/ThapaeBuilder.luau` ไปสร้าง ModuleScript ที่ `ServerStorage.EchoAtlas` แล้วเรียก `Builder.clear()`, `init`, `ground`, `roads`, `markings`, `water`, `walls`, `trees`, `props`, `spawn`, `lighting`, `buildings(1, N)`
3. ปิดเซิร์ฟเวอร์เมื่อเสร็จ

ข้อจำกัดของวิธีนี้: เป็น one-way (repo → Studio) ถ้าแก้ใน Studio ต้องคัดลอกกลับ repo เอง ทางเลือกถาวร (Rojo) ยังไม่ได้ติดตั้ง ต้องให้ผู้สร้างตัดสินใจใน R01-01

## src/ — โค้ดเกมเพลย์ชุดแรก (R01–R02a) · สถานะ: ทดสอบด้วยสคริปต์แล้ว ยังไม่ได้ทดสอบความรู้สึก/มือถือจริง

| ที่เก็บใน Studio | ไฟล์ใน repo | ชนิด | หน้าที่ |
| --- | --- | --- | --- |
| ReplicatedStorage/Shared | `src/shared/Config.luau` | ModuleScript | ค่าสมดุลทั้งหมด (ค่าทดลอง) |
| ReplicatedStorage/Shared | `src/shared/DamageMath.luau`, `ComboLogic.luau`, `RateLimiter.luau` | ModuleScript | ตรรกะล้วน ทดสอบได้ |
| ServerScriptService/Server | `src/server/Bootstrap.server.luau` | Script | สร้าง RemoteEvent แล้วเริ่มบริการ |
| ServerScriptService/Server | `src/server/EnemyService.luau`, `CombatService.luau`, `PlayerService.luau`, `GateService.luau` | ModuleScript | ศัตรูสไลม์, การต่อสู้ฝั่งเซิร์ฟเวอร์, ค่าผู้เล่น, เปิด/ปิดบานประตูท่าแพด้วยปุ่ม E (ProximityPrompt, เซิร์ฟเวอร์ตัดสินสถานะ) |
| StarterPlayer/StarterPlayerScripts | `src/client/CombatClient.client.luau`, `HudClient.client.luau` | LocalScript | รับอินพุต, เอฟเฟกต์, HUD |
| ServerStorage/EchoAtlas | `tests/UnitTests.luau` | ModuleScript | ชุดทดสอบตรรกะล้วน |

Remotes (สร้างโดย Bootstrap): `ReplicatedStorage.Remotes.ActionRequest` (ผู้เล่น → เซิร์ฟเวอร์: เจตนา `{seq, action="attack", aim}`) และ `ActionResult` (เซิร์ฟเวอร์ → ผู้เล่น: ผลและรายการที่โดน)

ซิงก์เข้า Studio: เปิดเซิร์ฟเวอร์ไฟล์ (ข้างบน) แล้วรัน `tools/roblox/sync_to_studio.luau` ผ่าน `execute_luau` (ทางเดียว repo → Studio, สร้าง script ใหม่ทุกครั้งเพื่อกัน cache) รันชุดทดสอบ: `require(game.ServerStorage.EchoAtlas.UnitTests).run()`
