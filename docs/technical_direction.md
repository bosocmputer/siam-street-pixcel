# Technical Direction v4 — SLIME HOOD

วันที่: 14 ตุลาคม 2569 (2026-10-14)  
สถานะ: Proposed ยังไม่มี implementation  
อ้างอิง: [GDD v4](../game_design_document.md) · [แผนพัฒนา](development_plan.md) · [งานค้นคว้า](research_v4.md)  
เอกสารเก่า: [technical v3](archive/technical_direction_v3_2026-10-14.md)

## 1. สิ่งที่เปลี่ยนจาก v3

v3 เป็นเกมแอ็กชัน real-time ต้องมีเซิร์ฟเวอร์ห้อง (Colyseus) ตัดสินการชนทุกเฟรม  
v4 เป็น **idle แบบไม่ต้องออนไลน์พร้อมกัน** เซิร์ฟเวอร์คำนวณผลเป็นช่วงเวลาเมื่อผู้เล่นกดรับของ จึง:

- **ไม่ต้องมีเซิร์ฟเวอร์ real-time** ในขั้น 1 → ตัด Colyseus
- ใช้ฐานข้อมูล + ฟังก์ชันบนเซิร์ฟเวอร์ (serverless) ได้
- ภาระหลักย้ายไปที่ **ความถูกต้องของการคำนวณ idle** และ **กันโกง**

## 2. Stack ที่เลือก

| ส่วน | เลือก | เหตุผล | ทางเลือกที่ไม่เลือก |
|---|---|---|---|
| ภาษา | **TypeScript (strict)** ทุกส่วน | ใช้ตรรกะเกมชุดเดียวทั้งเครื่องผู้เล่นและเซิร์ฟเวอร์ | — |
| Monorepo | **pnpm workspaces** | แยก `game-core` ให้ทั้ง web และ server ใช้ | Turborepo (เกินจำเป็นตอนนี้) |
| ตรรกะเกม | **`packages/game-core`** TS ล้วน ไม่มี dependency, deterministic | ทดสอบง่าย ใช้ซ้ำได้ทั้งสองฝั่ง | เขียนตรรกะแยกสองที่ (เสี่ยงผลไม่ตรงกัน) |
| UI/เมนู | **React 18 + Vite** | เกม idle เป็นหน้าเมนูเยอะ (กระเป๋า สกิล แรงก์) DOM ทำง่ายกว่า canvas | ทำเมนูใน Phaser ทั้งหมด (ช้าและยากเรื่องข้อความไทย) |
| ฉากเกม | **Phaser 3.90.0** (pin) ฝังใน React | ฉากฟาร์ม ลานย่าน แผนที่ย่าน; ใช้ใน `demo/` แล้ว; ตัวอย่างเยอะ | Phaser 4 (เพิ่งออก เม.ย. 2026 ประเมินหลังขั้น 1), PixiJS (ต้องเขียนระบบเกมเองมากกว่า) |
| State ฝั่ง client | **Zustand** | เล็ก เข้าใจง่าย | Redux (เกินจำเป็น) |
| Style | **CSS Modules + design tokens** | ควบคุมความเป็นพิกเซลได้ละเอียด | Tailwind (ใช้ได้ แต่คลาสยาวทำให้ UI พิกเซลอ่านยาก) |
| ฟอนต์ | **Kanit / Prompt / Mitr** (Google Fonts) สำหรับไทย + ฟอนต์พิกเซลสำหรับตัวเลข/อังกฤษ | PixelLab สร้างฟอนต์ไทยไม่ได้ | ฟอนต์พิกเซลไทย (หายากและต้องตรวจสิทธิ์) |
| PWA | **vite-plugin-pwa** | เพิ่มลงหน้าจอได้ เปิดเร็ว | แอปบนสโตร์ (ช้า แพง ในขั้น 1) |
| Backend | **Supabase**: Postgres + Auth + Edge Functions + pg_cron + Realtime (ขั้น 2) | คนเดียวดูแลได้ ไม่ต้องจัดการเซิร์ฟเวอร์ | Node + Fastify บน VPS (ต้องดูแลเอง), Firebase (NoSQL คิวรีแรงก์ยากกว่า) |
| Auth | Supabase **anonymous sign-in** → ผูก Google/อีเมลภายหลัง; LINE Login ต้องตรวจวิธีเชื่อมก่อน | เล่นได้ทันทีไม่ต้องสมัคร | บังคับสมัครก่อนเล่น |
| งานตามเวลา | **pg_cron** | รีเซ็ตบอสย่าน ปิดโหวต สรุปแรงก์ | cron ภายนอก |
| แผนที่ | **GeoJSON ย่านที่เตรียมไว้ล่วงหน้า** จาก OSM แล้ววาดเป็นแผนที่พิกเซลใน Phaser | ภาพเข้าสไตล์เดียวกัน ไม่ต้องจ่ายค่า tile | MapLibre + tile server (ค่าใช้จ่าย/สไตล์ไม่เข้ากับพิกเซลในขั้น 1) |
| ทดสอบ | **Vitest** (game-core, server), **Playwright** (e2e smoke) | เร็ว ใช้ TS ตรง | Jest |
| CI | **GitHub Actions** | lint + typecheck + test + build ทุก push | — |
| Hosting web | **Vercel** (ผู้สร้างติดตั้ง Vercel app บน GitHub แล้ว) | deploy อัตโนมัติจาก branch | Cloudflare Pages (ทางเลือกสำรอง) |
| ภาพ | **PixelLab** (MCP/API v2) + ตรวจ/เกลาเอง | ตกลงแล้ว | — |
| Analytics | ตาราง `events` ของตัวเองใน Supabase | ไม่ส่งข้อมูลผู้เล่นให้บริษัทอื่นในขั้น 1 | PostHog/GA (พิจารณาภายหลัง) |

**เวอร์ชัน:** pin เวอร์ชันแน่นอนใน `package.json` และ commit lockfile ห้ามใช้ `latest` หรือช่วงเวอร์ชันกว้าง เลือกเวอร์ชันที่ออกมาแล้วอย่างน้อย 2 สัปดาห์

## 3. โครงสร้าง repo

```
/
├─ game_design_document.md
├─ CLAUDE.md                     กติกาสำหรับ coding agent
├─ docs/                         เอกสาร
├─ demo/                         ต้นแบบ v3 (แอ็กชัน) เก็บไว้อ้างอิง ไม่พัฒนาต่อ
├─ packages/
│  └─ game-core/                 ตรรกะเกมล้วน + config สมดุล
│     ├─ src/ (stats, elements, skills, combat, idle, loot, inventory, evolution, rng, district)
│     ├─ config/*.json           ค่าสมดุลทั้งหมด
│     └─ test/
├─ apps/
│  └─ web/                       React + Phaser + PWA
│     ├─ src/ui/                 หน้าเมนู
│     ├─ src/scenes/             ฉาก Phaser
│     ├─ src/i18n/th.json        ข้อความทั้งหมด
│     └─ public/assets/          ภาพ + manifest.json
├─ supabase/
│  ├─ migrations/                SQL schema + RLS
│  └─ functions/                 Edge Functions (ใช้ game-core)
├─ tools/
│  ├─ balance-sim/               จำลองความก้าวหน้า 30 วัน
│  ├─ osm-districts/             สร้าง GeoJSON ย่าน
│  └─ asset-pipeline/            จัดการภาพจาก PixelLab
└─ .github/workflows/ci.yml
```

## 4. ตรรกะ idle และกันโกง

### 4.1 หลักการ

- **เซิร์ฟเวอร์เป็นผู้ตัดสิน** เครื่องผู้เล่นแสดงการต่อสู้เป็นภาพเคลื่อนไหวเพื่อความสวยงามเท่านั้น
- ผู้เล่นส่งแค่ **คำสั่ง** (รับของ, กลืน, ใส่อุปกรณ์, เลือกย่านฟาร์ม) ไม่ส่ง **ผลลัพธ์** (ได้ของอะไร ดาเมจเท่าไร)
- ใช้ **เวลาของเซิร์ฟเวอร์** เสมอ ไม่เชื่อนาฬิกาเครื่องผู้เล่น

### 4.2 การคำนวณของออโต้ (claim)

```
elapsed = min(server_now - last_claim_at, cap_seconds)   // cap ค่าเริ่มต้น 8 ชม.
power   = computePower(loadout)                         // จาก game-core
rate    = killsPerSecond(power, district, stage, ruleModifiers)
kills   = floor(elapsed * rate)
loot    = rollLoot(kills, district, seed)               // seed = hash(user_id, claim_window_start)
```

- RNG แบบ seed ได้ (เช่น mulberry32) ผลเดิมเสมอเมื่อ input เดิม → ทดสอบได้ และ retry ไม่ได้ของซ้ำ
- ใช้ **ค่าคาดหวัง + สุ่มเล็กน้อย** สำหรับจำนวนมาก (ไม่สุ่มทีละตัวเป็นหมื่นครั้ง)
- **idempotent**: claim หนึ่งครั้งมี `claim_id` ส่งซ้ำได้ผลเดิม ไม่ได้ของซ้ำ
- ทำในทรานแซกชันเดียว: อ่านสถานะ → คำนวณ → เขียนกระเป๋า/เหรียญ/แต้มย่าน/ดาเมจบอส → อัปเดต `last_claim_at`
- จำกัดอัตรา: claim ได้ไม่เกิน 1 ครั้งต่อ 30 วินาที (ค่าเริ่มต้น)

### 4.3 ช่วงลงมือ “แตะจุดอ่อน 20 วิ”

- เซิร์ฟเวอร์ออก `session_token` พร้อม seed ของตำแหน่งจุดอ่อน
- เครื่องผู้เล่นส่งจำนวนครั้งที่แตะโดน + เวลา
- เซิร์ฟเวอร์ตรวจว่าเป็นไปได้ (ไม่เกินจำนวนจุดที่ออก, ไม่เร็วผิดมนุษย์) แล้ว **จำกัดตัวคูณสูงสุด** (ค่าเริ่มต้น ×2) และจำกัดรอบต่อวัน
- ยอมรับว่าโกงได้บ้าง จึงจำกัดผลสูงสุดให้ไม่ทำลายสมดุล

### 4.4 แบกเพื่อน

- ทุกครั้งที่ claim เลือก snapshot สไลม์ของผู้เล่นอื่นในย่านเดียวกัน/กิลด์ ที่ไม่ได้ออนไลน์ 1 ตัว
- ตัวช่วยเพิ่มพลัง X% (ค่าเริ่มต้น 10%)
- เจ้าของสไลม์ได้ **แต้มแบก** สะสมในตารางรวม (ไม่เขียนทีละแถวต่อครั้ง) จำกัดต่อวัน

### 4.5 บอสย่าน / โหวตกฎย่าน / ศึกย่าน

- **บอสย่าน:** HP ตั้งตอนเริ่มสัปดาห์จากจำนวนผู้เล่น active ของย่าน ดาเมจเพิ่มจาก claim (บวกแบบ atomic)
- **โหวตกฎย่าน:** เปิดวันจันทร์ ปิดวันอาทิตย์ (เวลาไทย) ผลเสมอใช้ seed ตัดสิน กฎเป็น modifier ใน config
- **ศึกย่าน:** คะแนน = ผลงานรวม ÷ จำนวนผู้เล่น active (เพื่อไม่ให้ย่านคนเยอะชนะเสมอ) สรุปด้วย pg_cron

## 5. ข้อมูลหลัก (ร่าง schema)

| ตาราง | เก็บอะไร |
|---|---|
| `players` | id, ชื่อแสดง, home_district_id, home_changed_at, level, exp, coins, stat_points, last_claim_at, created_at |
| `slime_state` | form_id, allocated stats, equipped skills (3+2), equipped items (4), skin palette |
| `skills_owned` | player_id, skill_id, level, cores |
| `inventory_items` | id, player_id, item_def_id, rarity, upgrade_level |
| `materials` | player_id, material_id, qty |
| `bestiary` | player_id, monster_id, first_absorbed_at, count |
| `claims` | claim_id, player_id, window_start, window_end, result json (เก็บไว้ตรวจย้อน) |
| `districts` | id, ชื่อ, ธาตุ, geojson ref |
| `district_week` | district_id, week, boss_hp_max, boss_damage, active_rule_id |
| `rule_votes` | district_id, week, player_id, rule_id |
| `carry_stats` | player_id, day, carry_points |
| `season_scores` | season, district_id, score, active_players |
| `events` | analytics: player_id, name, props, at |

ค่าคงที่ของเกม (มอนสเตอร์ สกิล อุปกรณ์ ร่าง กฎย่าน) อยู่ใน `packages/game-core/config/*.json` ไม่อยู่ในฐานข้อมูล

**RLS:** ผู้เล่นอ่านเขียนได้เฉพาะแถวของตัวเอง; ตารางย่าน/แรงก์อ่านได้ทุกคน เขียนได้เฉพาะ Edge Functions/cron (service role)

## 6. แผนที่จาก OpenStreetMap

1. สคริปต์ `tools/osm-districts` ดึงข้อมูลเชียงใหม่ **ครั้งเดียว** (Geofabrik extract หรือ Overpass ตามนโยบายการใช้งาน) แล้ว commit ผลลัพธ์
2. วาดขอบเขต 4 ย่านเอง (polygon) โดยอ้างอิงถนน แม่น้ำ คูเมือง จาก OSM
3. ส่งออก `districts.geojson` (ย่าน), `landmarks.json` (จุดสังเกต พร้อมธง `no_combat` สำหรับวัด/โรงเรียน/โรงพยาบาล)
4. ใน Phaser แปลงพิกัดเป็นตารางพิกเซล วาดด้วย tileset จาก PixelLab
5. แสดงเครดิต “© ผู้ร่วมสร้าง OpenStreetMap” บนหน้าแผนที่ และมีหน้าเครดิตลิงก์ไป ODbL

ไม่เก็บและไม่ขอตำแหน่งจริงของผู้เล่น

## 7. Asset pipeline (PixelLab)

### 7.1 มาตรฐานสไตล์

| เรื่อง | ค่า |
|---|---|
| มุมกล้อง | `low top-down` ทุกชิ้น |
| ทิศ | 4 ทิศ (south, east, north, west) — ฉากฟาร์มใช้ทิศ east |
| ขนาดสไลม์ | ตัว ~32–48 px (`size` 48) |
| ขนาดหมวก/อาวุธ/ส่วนงอก | 16–32 px |
| ขนาดไอคอน | 32 px |
| ไทล์ | 16 px (`create_topdown_tileset`) |
| เส้นขอบ | `single color black outline` |
| พาเลต | พาเลตเดียวทั้งเกม (เลือกจาก Lospec แล้วตรวจสิทธิ์ใช้) ใช้ `reduce_colors` บังคับทุกภาพ |
| อ้างอิงสไตล์ | ใช้สไลม์ร่างเริ่มต้นที่ผ่านการอนุมัติเป็น style reference ของทุกชิ้นถัดไป |

### 7.2 ระบบซ้อนภาพ (paper-doll)

- ลำดับชั้น: ผิวสไลม์ (palette swap) → ส่วนงอก (สูงสุด 3) → อาวุธ → หมวก
- **จุดยึดอัตโนมัติ:** สคริปต์หาจุดสูงสุดและจุดกึ่งกลางของตัวสไลม์ในแต่ละเฟรมจาก alpha แล้วบันทึกเป็น `anchors.json` ต่อร่าง ต่อทิศ ต่อเฟรม
- หมวก/อาวุธวาด 3 ทิศ (south, north, east) ทิศ west ใช้การกลับภาพ
- ห้ามใช้ `create_character_state` เพื่อทำชุดผสม (จำนวนภาพพุ่งตามจำนวนคู่ของ)

### 7.3 ขั้นตอน

1. ตรวจยอดคงเหลือ (`get_balance`) และประเมินจำนวน generation ก่อนสั่งทำเป็นชุด **ถามผู้สร้างก่อนใช้ generation จำนวนมาก**
2. สร้างภาพ → ดาวน์โหลดลง `tools/asset-pipeline/raw/` (ไม่ commit ไฟล์ดิบขนาดใหญ่)
3. สคริปต์: ตัดภาพ, บังคับพาเลต, คำนวณจุดยึด, รวมเป็น atlas, อัปเดต `apps/web/public/assets/manifest.json`
4. ตรวจด้วยตา: ทุกหมวก × ทุกร่าง, ทุกส่วนงอก × ทุกร่าง
5. บันทึกที่มาของทุกภาพ (prompt, tool, seed, วันที่) ใน `assets/credits.json`

### 7.4 ความปลอดภัยของ token

- token ของ PixelLab เก็บใน environment variable (`PIXELLAB_TOKEN`) หรือ secret ของ environment เท่านั้น **ห้าม commit**
- token ที่เคยถูกวางในแชต **ต้องหมุนใหม่** ก่อนใช้งาน
- environment ต้องอนุญาต `api.pixellab.ai` ในนโยบายเครือข่าย

## 8. ความเป็นส่วนตัวและความปลอดภัย

- ไม่เก็บตำแหน่งจริง ไม่ขอ GPS
- ชื่อแสดงผ่านตัวกรองคำหยาบ ภาษาไทย + อังกฤษ
- ลานย่านใช้อิโมจิและข้อความสำเร็จรูป ไม่มีแชตอิสระในขั้น 1
- log ไม่มีข้อมูลส่วนตัวเกินจำเป็น
- มีหน้านโยบายความเป็นส่วนตัวภาษาไทยก่อนเปิด playtest (อ้างอิง PDPA ให้ผู้รู้ตรวจ)

## 9. ประสิทธิภาพเป้าหมาย (ค่าเริ่มต้น ต้องวัด)

- โหลดครั้งแรกบนมือถือระดับกลางผ่าน 4G: เล่นได้ภายใน 5 วินาที (bundle เริ่มต้นเล็ก, โหลดภาพตามหน้า)
- ฉากฟาร์ม ≥ 30 FPS บนมือถือระดับกลาง
- claim ตอบกลับภายใน 1 วินาที (p95)

## 10. ค่าใช้จ่าย

ขั้น 1 ตั้งใจให้อยู่ในแผนฟรีของ Supabase และ Vercel ได้ **ยกเว้น**:

- Supabase ฟรีหยุดโปรเจกต์หลังไม่ใช้ 7 วัน → ระหว่าง playtest ต้องดูแลไม่ให้ถูกหยุด หรือใช้แผนจ่ายเงิน
- PixelLab คิดตาม generation → ประเมินก่อนสร้างเป็นชุด

ตัวเลขแผนฟรีมาจากแหล่งรอง ต้องเช็กหน้าราคาจริงก่อนตัดสินใจ
