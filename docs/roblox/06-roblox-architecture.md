# 06 — สถาปัตยกรรม Roblox และการพัฒนาด้วย AI

[สารบัญ](README.md) · [แผนพัฒนา](07-development-plan.md) · [คู่มือส่งต่องาน](../coordination/README.md)

สถานะ: แบบเทคนิคเสนอ ยังไม่มีโฟลเดอร์ implementation Roblox, MCP ที่ทดสอบสำเร็จ, Place ID หรือผลทดสอบเกมใหม่ คำว่า Service/Controller ในเอกสารเป็นโมดูลของเรา ไม่ได้แปลว่า Roblox มีคลาสชื่อนั้นให้แล้ว

## 1. Stack ที่เสนอ

| ส่วน             | ทางเลือกเริ่มต้น                                   | เหตุผล                                                      |
| ---------------- | -------------------------------------------------- | ----------------------------------------------------------- |
| Engine / runtime | Roblox Studio / Roblox client                      | ใช้โครงออนไลน์และเครื่องมือฉากที่มี                         |
| ภาษา             | Luau แบบ `--!strict`                               | ตรงกับแพลตฟอร์ม ลดชั้นแปลง                                  |
| ตัวละคร          | avatar/rig ที่รองรับและทดสอบแล้ว                   | ไม่สร้างระบบตัวละครทุกส่วนเอง                               |
| เครือข่าย        | RemoteEvent และข้อมูลสถานะที่กำหนดรูปแบบ           | คำสั่งชัด ตรวจฝั่ง server ได้                               |
| Persistence      | DataStoreService ฝั่ง server                       | โปรไฟล์ผูกบัญชี Roblox                                      |
| การทดสอบ         | ตรรกะ pure + test harness ใน Studio + multi-client | เลือกเครื่องมือจริงเมื่อเริ่ม ไม่อ้างว่ามี test runner แล้ว |
| Version control  | Git: Luau, config, manifest และบันทึก              | อ่าน diff และย้อนการเปลี่ยนได้                              |
| AI connector     | Studio MCP ทางการ เมื่อเชื่อมพิสูจน์แล้ว           | ทำงานกับฉากและทดสอบได้                                      |
| Asset source     | procedural/Blender หรือเครื่องมือที่เหมาะ          | ไม่บังคับเครื่องมือเสียเงินตั้งแต่ต้น                       |

ยังไม่ต้องมี backend ภายนอก ฐานข้อมูลแยก Kubernetes หรือบริการ AI NPC สด ใช้เท่าที่วงจรเกมจำเป็นก่อน Rojo เป็นทางเลือกเมื่อโครงไฟล์มากขึ้น ต้องเลือกเวอร์ชันและตรวจ workflow ตอนนำมาใช้

## 2. Capability map และลำดับ dependency

| Module ID    | หน้าที่                                   | ขึ้นกับ                         |
| ------------ | ----------------------------------------- | ------------------------------- |
| catalog      | IDs, config, balance, localization keys   | —                               |
| profiles     | โหลด บันทึก schema และธุรกรรมโปรไฟล์      | catalog                         |
| world        | พื้นที่ โซน collision metadata และจุดเกิด | catalog                         |
| characters   | ตัวละคร loadout สถานะ และค่าสำหรับต่อสู้  | profiles, world                 |
| combat       | คำสั่ง action, timeline, hit, HP          | characters, world               |
| encounters   | รอบมอน AI บอส และผลจบรอบ                  | combat, world                   |
| rewards      | คำนวณ/ส่งของ ตรวจ grant ซ้ำ               | profiles, catalog               |
| quests       | ความคืบหน้าจากเหตุการณ์และรางวัล          | encounters, rewards             |
| party        | สมาชิก การพร้อม และการเชิญ                | characters                      |
| presentation | input, กล้อง, HUD, เสียง, animation, VFX  | read model จากระบบที่เกี่ยวข้อง |
| travel       | เดินทางข้าม Place เป็นกลุ่ม               | profiles, party; หลัง MVP       |

เหตุการณ์ encounter จบส่ง outcome ให้ quests/rewards ผ่านตัวประสานที่ bootstrap ไม่ให้ combat เรียกเควสต์แล้วเควสต์กลับมาคำนวณ combat เป็นวง วาง contracts ของ event ใน shared แต่สิทธิ์แก้ state อยู่ server

## 3. โครงสร้างที่เสนอเมื่อเริ่มสร้าง

```text
roblox/                         # ยังไม่สร้าง implementation ในรอบเอกสาร
  src/shared/                   # types, catalog, config, pure calculations
  src/server/                   # profiles, combat, encounters, quests, party
  src/client/                   # input, camera, UI, VFX, animation
  world/                        # scene builders, placement data, map manifests
  assets/                       # logical IDs, Roblox IDs, ownership, versions
  tests/                        # unit, integration และ scenario definitions
  tools/                        # import/export ที่เลือกใช้จริง
docs/roblox/                    # แบบเกมและเทคนิค
docs/coordination/              # สถานะ งาน และการส่งต่อ Codex/Claude
```

ใน Studio: Shared/Remotes ไป ReplicatedStorage, server scripts ไป ServerScriptService, server-only templates ไป ServerStorage, client controllers ไป StarterPlayerScripts/StarterGui, geometry ที่ต้อง streaming ไป Workspace

อย่าใช้ path นี้อ้างว่าไฟล์มีอยู่แล้ว งาน R00–R01 ต้องสร้างและยืนยัน mapping ก่อน ตั้ง bootstrap ให้รายงานว่าแต่ละโมดูลพร้อม ไม่อาศัยลำดับรัน script แบบเดา

## 4. ใครตัดสินอะไร

| Client รับผิดชอบ                       | Server รับผิดชอบ                    |
| -------------------------------------- | ----------------------------------- |
| อ่าน input และแสดง animation ตอบสนอง   | ตรวจว่า action ทำได้จริง            |
| กล้อง เสียง trail และ UI               | HP, stamina, spirit, cooldown       |
| แสดงตำแหน่ง/เป้าหมายตามข้อมูลที่ได้รับ | ผลโดน ระยะ ผนัง encounter และรางวัล |
| คาดการณ์ภาพแล้วปรับกลับเมื่อถูกปฏิเสธ  | inventory, currency, quest และ save |

การให้ server ตัดสิน combat ไม่ได้แปลว่าเปิดฟีเจอร์ server-authoritative physics ของ engine แล้ว การเคลื่อน avatar และ network ownership ต้องตรวจแยก มี validation ความเร็ว/ระยะที่ทน latency ไม่รับตำแหน่ง client โดยไม่มีขอบเขต

ตรวจ type, ค่าตัวเลขที่ finite, ขนาดข้อมูล, สิทธิ์, สถานะ, ระยะ, action sequence และ rate limit ก่อนคำนวณแพง หลักนี้สอดคล้องกับ [Securing the client-server boundary](https://create.roblox.com/docs/scripting/security/client-server-boundary) ส่วนค่าความเข้มและ penalty เป็นข้อเสนอที่ต้องทดสอบ ไม่ ban ถาวรจากความคลาดเคลื่อนครั้งเดียว

## 5. Contract ตัวอย่าง

```text
ActionRequest {
  sequence: integer,
  action: allowlisted action ID,
  phase: begin | release | cancel,
  aimDirection: finite normalized vector
}

ActionResult {
  sequence: integer,
  accepted: boolean,
  reasonCode: optional enum,
  serverActionId: optional string,
  authoritativeResources: bounded values
}
```

เป็นตัวอย่าง contract ไม่ใช่ API ที่มีแล้ว client ไม่ส่ง damage, item reward, arbitrary Instance path หรือเวลา cooldown ที่ให้ server เชื่อเอง `sequence` ป้องกันส่งซ้ำใน session; ไม่ใช้แทนรหัสธุรกรรมถาวรของไอเทม

สกิลชาร์จเก็บ begin ที่ server แล้ว release ใน sequence เดียวกัน ห้ามนับเวลาจากค่าที่ client ส่งมาเท่านั้น การส่ง VFX ให้คนใกล้ใช้ข้อมูลย่อ ไม่ broadcast ทุกเฟรมทั่วแผนที่

## 6. Persistence ที่ต้องพิสูจน์ก่อนออนไลน์จริง

โปรไฟล์ตัวอย่าง: schemaVersion, revision, level/xp, weaponMastery, inventory, equipment, currency, quests, discoveries, pendingRewards, processedGrants แบบมีขอบเขต, settings, lastCheckpoint, sessionLease

DataStore เป็น network operation ที่ล้มเหลวได้ เอกสาร Roblox อธิบาย `UpdateAsync` สำหรับแก้ค่าตามข้อมูลปัจจุบัน และ callback ห้าม yield ดู [Data stores](https://create.roblox.com/docs/cloud-services/data-stores) โครงการต้องออกแบบ session และการกู้คืนเพิ่มเอง ไม่ถือว่าใช้ UpdateAsync แล้วกันข้อมูลทับหรือของซ้ำได้อัตโนมัติ

### กติกาโปรไฟล์

1. โหลดและยึด session lease สำเร็จก่อนให้เริ่มเกมที่สร้าง progress; lease มี owner, fencing token และ expiry
2. ทุก write ตรวจ token ปัจจุบัน atomically เพื่อกันเซิร์ฟเวอร์เก่าเขียนทับหลัง lease เปลี่ยนมือ มี heartbeat และหยุด mutation เมื่อรักษา lease ไม่ได้
3. โอน session ด้วยการปล่อยหรือรอหมดอายุตามกติกาที่ทดสอบ ไม่เปิดโปรไฟล์ซ้อนแบบ last write wins
4. เปลี่ยน reward/inventory และ processed grant ใน payload เดียวกัน; อย่าใส่ side effect ใน callback ที่อาจถูกเรียกซ้ำ
5. บันทึกเป็นช่วงและ checkpoint สำคัญตาม request budget มี retry/backoff แบบมีขอบเขต ไม่เขียนทุก hit
6. โหลดล้มเหลวไม่สร้าง default ทับของเดิม ให้แสดงสถานะลองใหม่และไม่รับรางวัลใหม่จนปลอดภัย
7. ทุก schema migration มี fixture เดิม/ใหม่ มี rollback plan และบันทึกเวอร์ชัน

การ crash ยังอาจสูญความคืบหน้าที่ยังไม่ persist ต้องแสดง “กำลังบันทึก/บันทึกแล้ว” ตามจริง และแยกรางวัล pending ออกจากยืนยันถาวร ไม่สัญญาว่าไม่มีข้อมูลหายได้ทุกกรณี

processedGrants ห้ามโตไม่จำกัด กำหนด retention/compaction ที่ไม่ทำให้ grant เก่ากลับมารับได้ เช่น เก็บ completion marker ถาวรของเควสต์ครั้งแรก และ watermark/หน้ารายการของรางวัลรอบซ้ำ ก่อน prune ต้องมี test replay ของรอบเก่า

## 7. สถานะโลกกับสถานะผู้เล่น

HP มอน, boss phase, ผู้ถือแก่น และไฟกิจกรรมเป็นสถานะ server session; เควสต์ ของ เลเวล และ discovery เป็นโปรไฟล์ผู้เล่น แยกกันเพื่อไม่ save โลกทุกเฟรม

MVP ไฟเมืองที่เปลี่ยนหลังเหตุการณ์สำเร็จมีผลเฉพาะเซิร์ฟเวอร์นั้น ไม่ทำ global persistent world หรือเลือกจักรวาลประวัติศาสตร์หลายแบบ การแชร์สถานะข้ามเซิร์ฟเวอร์และ season เป็นงานใหม่ที่ต้องกำหนด consistency แยก

## 8. AI ศัตรูและประสิทธิภาพ

AI มอนใช้ state machine เช่น Idle → Notice → Chase → Windup → Attack → Recover → Return → Dead ไม่ใช่เรียก LLM ตัดสินทุกท่า ใช้ pathfinding เมื่อจำเป็นและจัดคิว ไม่ให้มอนทุกตัวคำนวณทางใหม่พร้อมกันทุกเฟรม

ค่าเริ่มต้นเสนอ decision tick 5 Hz สำหรับมอนใกล้ผู้เล่น ลด/หยุดมอนไกล การเคลื่อนและ hit timeline ยังมีระบบของตัวเอง ห้ามเอา tick นี้ไปทำให้ hitbox ข้ามเป้า เป้ารวม 32 active enemies ต่อเซิร์ฟเวอร์ต้องบังคับด้วย encounter budget เดียว

VFX ฝั่ง client, reuse assets, จำกัด collision, ปิดเงาพร็อพเล็ก และวัดด้วยเครื่องมือก่อน optimize วิธีหา bottleneck ดู [Identify performance issues](https://create.roblox.com/docs/performance-optimization/identify)

## 9. การทำงานกับ AI ใน Studio

Studio MCP ทางการให้ AI อ่าน/แก้ script สำรวจ data model รัน Luau เริ่มทดสอบ อ่าน console และดูภาพได้ตาม [Connect to Studio MCP](https://create.roblox.com/docs/studio/mcp) แต่ต้องเชื่อมกับ session ในเครื่องจริงก่อนและบันทึกผล R00

workflow ที่เสนอ: รับ task ID → อ่านข้อกำหนด/สถานะ → ตรวจฉากและ diff → แก้ slice เล็ก → รันทดสอบ → เก็บภาพ/console → อัปเดต handoff อย่ารันคำสั่งลบทั้ง Workspace เพื่อเริ่มใหม่โดยไม่รู้ ownership ของวัตถุ

โค้ดและ config ใน Git เป็นต้นทางที่ตรวจ diff; หากแก้ผ่าน MCP โดยตรงต้อง export/sync กลับก่อนส่งต่อ หากยังไม่มีเครื่องมือ sync ให้ใช้ขั้นตอน export ที่ตรวจซ้ำได้และบันทึก checkpoint ของ Place งานถือว่ายังไม่ส่งมอบถ้าของจริงใน Studio ไม่ตรงกับไฟล์ที่อีก AI อ่าน

เมื่อใช้ Rojo ให้กำหนดชัดว่า node ไหนถูกสร้างจากไฟล์ และ node ไหนแก้ใน Studio ห้ามทั้งสองทางเขียนทับ subtree เดียวโดยไม่ sync ตรวจชื่อและ studio_id ทุกครั้ง โดยเฉพาะเปิดหลายหน้าต่าง

## 10. Test strategy

| ระดับ                                  | เรื่องที่ตรวจ                                                        |
| -------------------------------------- | -------------------------------------------------------------------- |
| Pure unit                              | สูตรดาเมจ XP cooldown eligibility catalog และ migration              |
| Server integration                     | คำสั่งผิดรูป hit ซ้ำ reward replay save failure และ lease เปลี่ยนมือ |
| Studio playtest                        | กล้อง input VFX collision quest และ animation                        |
| Multi-client                           | ปาร์ตี้ บอสหลายคน head leave reconnect และการเห็นผลตรงกัน            |
| Published client เมื่อถึงช่วงที่อนุญาต | teleport จริง ความหน่วง และอุปกรณ์จริง                               |

Studio มีโหมดทดสอบ client/server และหลาย client ดู [Studio testing modes](https://create.roblox.com/docs/studio/testing-modes) บอต NPC 10 ตัวไม่ได้พิสูจน์ replication และภาระอุปกรณ์ของผู้เล่น 10 เครื่อง

ยังไม่มีคำสั่ง build/test สำหรับ Roblox ใน repo นี้ R01 ต้องเลือก harness และเพิ่มคำสั่งที่รันได้จริงก่อนอ้างผล `pnpm test:world` ตรวจเว็บเดิมเท่านั้น ไม่ใช่การตรวจ Roblox

## 11. Coding conventions

Luau `--!strict`, ชื่อโมดูลตามหน้าที่, ใช้ typed contracts, balance แยก config, ข้อความแยก localization, service lifecycle ชัด, connection/task ทุกตัวมี cleanup และ error เป็น reason code ที่ UI แปลได้

ตัวอย่างแนวสไตล์ ไม่ใช่ implementation ของ damage:

```lua
--!strict
export type AttackStats = { attackRating: number, defense: number }

local DamageMath = {}

function DamageMath.calculate(baseDamage: number, stats: AttackStats): number
    local scaled = baseDamage * stats.attackRating / 12
    return math.floor(scaled * 100 / (100 + stats.defense) + 0.5)
end

return DamageMath
```

caller ต้อง validate ค่าตาม contract ก่อนเรียก pure math และเขียน test กรณีขอบ ห้ามใช้ snippet นี้แทนการ validate remote

## 12. ขอบเขตการทำงาน

ทำเสมอ: ตรวจสถานะ repo/Studio, เก็บ config/asset ownership, ทดสอบส่วนที่เปลี่ยน, อัปเดต task/handoff และบอกข้อจำกัดตรงจริง

ให้ผู้สร้างตัดสินใจเมื่อจำเป็น: ขอบเขต product เปลี่ยนมาก, มีค่าใช้จ่ายใหม่, ใช้บัญชี/สิทธิ์ที่ยังไม่ให้, เปิดขายเงินจริงหรือเผยแพร่สู่สาธารณะที่ยังไม่ได้สั่ง การทำงานที่อนุญาตแล้วไม่ต้องถามซ้ำ

ห้าม: ฝัง secret, เชื่อ client เรื่องเงิน/ดาเมจ, สร้างข้อมูลหายเป็น default เงียบ ๆ, ใส่ asset script ไม่ตรวจ, เขียนทับงานอีก agent หรือรายงานว่าทดสอบผ่านทั้งที่ไม่ได้รัน
