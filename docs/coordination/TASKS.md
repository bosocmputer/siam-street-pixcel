# กระดานงานร่วม

อัปเดต 2026-10-15 · รายละเอียด milestone อยู่ใน [07-development-plan](../roblox/07-development-plan.md)

## งานเอกสารรอบนี้

| ID             | งาน                                                                               | Owner                       | สถานะ  | Acceptance / Verify                                                                         |
| -------------- | --------------------------------------------------------------------------------- | --------------------------- | ------ | ------------------------------------------------------------------------------------------- |
| DOC-001        | สร้าง GDD, story, combat, RPG, map, asset, architecture, roadmap, future business | Codex / DOCS-2026-10-15-01  | review | ไฟล์ครบ อ่านเชื่อมกันได้ ไม่มีผลทดสอบ Roblox ที่แต่งขึ้น                                    |
| COLLAB-001     | สร้างกติกาและเอกสารส่งต่อ Codex/Claude                                            | Codex / DOCS-2026-10-15-01  | done   | entry point ตรงกัน สถานะ/ownership/evidence/prompt ส่งต่อครบ                                |
| DOC-REVIEW-001 | ตรวจแบบและส่งความเห็นกลับใน repo                                                  | Claude / REVIEW-2026-10-15-01 | review | ตรวจ scope, เรื่อง, balance, network, persistence, asset และนโยบาย พร้อมบันทึกข้อพบ/ข้อเสนอ |

### ขอบเขตไฟล์ที่แก้ใน session เอกสาร

`game_design_document.md`, `README.md`, `PRODUCT.md`, `AGENTS.md`, `CLAUDE.md`, `docs/roblox/`, `docs/coordination/` เท่านั้น ในรอบถัดมาผู้สร้างอนุญาต cleanup plan และ commit/push งานทั้งหมด จึงลบ snapshot เหล่านั้นแล้ว และเก็บ crowd code เดิมใน commit แยก ไม่มี ownership ของ Studio

ปล่อย ownership แล้วตอนส่งมอบ ไม่มีไฟล์หรือ Studio ที่ Codex ถืออยู่ใน session นี้ ผู้รับถัดไปต้อง claim งานของตน ผลตรวจอยู่ใน STATUS/WORKLOG

### DOC-REVIEW-001 สำหรับผู้รับ

Dependency: DOC-001 ส่ง review และ COLLAB-001 done แล้ว; ก่อนเริ่มยืนยันผู้สร้างกำลังขอให้ review ใน session ของคุณ

ไฟล์เริ่มต้น: AGENTS, STATUS, HANDOFF, GDD แล้วเอกสาร 01–09 ขอบเขตแก้คือข้อผิดพลาดเอกสารและ coordination; การเปลี่ยนทิศทางใหญ่ให้บันทึกทางเลือกก่อน อย่าเริ่ม implementation หรือแก้ต้นแบบเว็บในงาน review

Acceptance:

- บอกความขัดแย้งและอ้างไฟล์/หัวข้อพร้อมผลต่อการพัฒนา
- แยกบั๊กเอกสารออกจากความเห็นออกแบบและข้อที่ต้องพิสูจน์ด้วยผู้เล่น
- ตรวจเควสต์ 6+1, นักดาบชุดเดียว, 12 ผู้เล่น/32 ศัตรูเป็นเป้า, หน่วย map/combat, reward replay และข้อจำกัดโฆษณา
- ตรวจว่าไม่มีข้อเสนอถูกตีความว่าอนุมัติหรือสร้างแล้ว
- บันทึก feedback ใน INBOX thread `MSG-001` และ append WORKLOG พร้อม handoff ใหม่

## งานพัฒนาที่วางไว้ ยังไม่เริ่ม

| ID     | ผลลัพธ์                                 | Dependency               | สถานะ   |
| ------ | --------------------------------------- | ------------------------ | ------- |
| R00-01 | ตรวจเครื่อง เปิด Studio และ Place ทดสอบ | คำสั่งเริ่มพัฒนา/ตั้งค่า | done (อ่านอย่างเดียว) |
| R00-02 | เชื่อม AI อ่าน session จริง             | R00-01                   | done (list/state/tree) |
| R00-03 | แก้ script/scene ทดสอบและ sync กลับ     | R00-02                   | ready — รอผู้สร้างสั่งเริ่ม |
| R01-01 | โครง source และ mapping                 | R00-03                   | done (manifest + sync_to_studio; ยังไม่มี Rojo) |
| R01-02 | เดิน/กล้อง/collision/มือถือ             | R01-01                   | review (เดินทั้งแผนที่ผ่าน; ปุ่มมือถือผูกแล้วแต่ NOT RUN บนอุปกรณ์) |
| R01-03 | catalog และ test harness                | R01-01                   | done (Config + UnitTests 30 ข้อผ่าน; harness = รันผ่าน Studio MCP) |
| R02-01 | ฟันกับสไลม์และผลโดน server              | R01-02, R01-03           | review (integration ด้วยสคริปต์ผ่าน; ความรู้สึก NOT RUN) |
| R02-02 | รับ/หลบ/stamina                         | R02-01                   | backlog |
| R02-03 | คลื่นคมจันทร์และ cleanup                | R02-02                   | backlog |
| R02-04 | ทดสอบความรู้สึกการต่อสู้                | R02-03                   | backlog |

ช่วง R03–R08 ให้แตกงานเมื่อจะเริ่มตามหลักฐานจริง ไม่เขียนว่า ready ทุกระบบล่วงหน้า

## แบบฟอร์ม task ใหม่

```markdown
ID / title:
User-authorized scope:
Owner / session / claimed at:
Status:
Depends on:
Files / Studio subtree owned:
Acceptance:
Verify command or scenario:
Result / evidence:
Handoff / open questions:
```

## รอบย้ายไป PC — SYNC-2026-10-15-01

- **SYNC-001** — ลบแผนเก่า ตรวจงานค้างทั้งหมด commit และ push ไป branch ส่งต่อ
  - Owner: Codex
  - Status: done
  - Acceptance: เหลือแผน Roblox/coordination, local links ผ่าน, โค้ดค้างถูกตรวจและ commit, remote hash ตรง local HEAD, working tree สะอาด
  - Verify: lint/typecheck/test/build, Markdown/link scan, staged review, credential-pattern scan, git status และ ls-remote
  - Legacy snapshot commit: `341c55d`
  - Design/cleanup commit: `8b2b172`
  - Result: push origin สำเร็จ ตรวจ remote hash ตรง local และ working tree สะอาดก่อนบันทึก receipt; ownership released

## สถานะงาน 2026-10-16 (Claude, Windows PC — ปิดงานเพราะโควต้าเต็ม; ownership ปล่อยแล้ว ไม่มี Studio ที่ถืออยู่)

| ID | งาน | สถานะ | หมายเหตุ |
| --- | --- | --- | --- |
| GATE-001 | กำแพงหนา 6 × สูง 24 stud + ซุ้มโค้ง 12 × 16 stud + ซี่กำแพง + อิฐเก่า (Place2) | done (รอผู้สร้างดูด้วยตา; ยังไม่ได้เซฟไฟล์) | WORKLOG ต่อ 20–23 |
| GATE-002 | บานประตูไม้คู่ กด E เปิด/ปิด ค่าเริ่มต้นเปิด (`GateService`) | done (ทดสอบ Play ผ่าน) | ต่อ 22–23 |
| COMBAT-OFF | ปิดดาบ/สไลม์/ต่อสู้ด้วย `Config.features.combat=false` | done (ทดสอบ Play ผ่าน) | ต่อ 24; R02-* ย้ายเป็นพักไว้ |
| MOAT-001 | คูเมือง+สะพานทางเข้า | **ผิดตำแหน่ง ต้องแก้** — รอผู้สร้างบอกตำแหน่งจริง (INBOX MSG-002) แล้วย้อนและสร้างใหม่ | ต่อ 25; วิธีย้อนใน HANDOFF |
| CITY-ROADS | ถนน/ทางเท้าจากชิ้น City template ใน `EchoAtlas-City.rbxl` | พักไว้ (ผู้สร้างเลือก Place2 เป็นฐาน) | ต่อ 14–18; ไฟล์ OldCity* ยังอยู่ใน repo |
| MAP-LIGHT | แสง/สีเงาออกน้ำเงินจัด, ผิวถนน/ทางม้าลายแบบ template ใน Place2 | proposed — รอผู้สร้างสั่ง | ต่อ 12–13 |
| FLICKER | แยกต้นเหตุอาการกะพริบ | ยังไม่ได้แยก | ต่อ 3, 17 |
