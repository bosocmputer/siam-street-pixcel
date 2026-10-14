# งานค้นคว้า v4 — ตลาด ระบบในเกมอื่น และเทคนิค

ค้นคว้า: 14 ตุลาคม 2569 (2026-10-14)  
ใช้กับ: [GDD v4](../game_design_document.md) · [ทิศทางเทคนิค](technical_direction.md) · [แผนพัฒนา](development_plan.md)

## วิธีอ่าน

- **[ตรวจแล้ว]** มีแหล่งอ้างอิงจากการค้นในวันที่ระบุ ระวังข้อจำกัดที่เขียนกำกับ
- **[ความรู้ทั่วไป]** มาจากความรู้ด้านการออกแบบเกมทั่วไป ไม่ได้ค้นยืนยันในรอบนี้ ใช้เป็นแรงบันดาลใจ ไม่ใช่หลักฐาน
- ข่าวจากบริษัทเกมเองเป็นตัวเลขที่บริษัทรายงาน ไม่ใช่ผู้ตรวจสอบอิสระ

## 1. ตลาดไทยและคู่แข่งโดยตรง

| ข้อค้นพบ | สถานะ | ผลต่อการออกแบบ |
|---|---|---|
| Ragnarok Idle Adventure เปิดในไทย 18 ม.ค. 2024 บริษัทรายงานว่าขึ้นอันดับ 1 ดาวน์โหลดฟรีทั้ง App Store และ Google Play และอันดับ 1 รายได้บน App Store ไทย [R1] | ตรวจแล้ว (บริษัทรายงานเอง) | แนว RO + idle มีคนเล่นในไทยจริง แต่มี IP ใหญ่ครองอยู่ เกมเราต้องต่างที่ “ย่านของเรา” ไม่ใช่แข่งเป็น RO ที่ดีกว่า |
| Ragnarok: Twilight ติดอันดับ 2 ทั้งดาวน์โหลดฟรีและรายได้บน App Store ไทย (ก.พ. 2026) [R2] | ตรวจแล้ว (บริษัทรายงานเอง) | แฟน RO ในไทยยังมีอยู่มากในปี 2026 |
| Sensor Tower: MMORPG แบบดั้งเดิมในเอเชียตะวันออกเฉียงใต้ลดลงเกือบ 20% ขณะที่เกมกลยุทธ์ 4X โต (ต้นปี 2025, ทั้งภูมิภาค) [R3] | ตรวจแล้ว (ภูมิภาค ไม่ใช่ไทย) | สนับสนุนการไม่ทำ MMORPG เต็มรูปแบบ |
| ไม่พบข้อมูลรายได้/ผู้เล่นเฉพาะแนว idle RPG ในไทย [R4] | ช่องว่าง | “คนไทยชอบ idle” ยังเป็นสมมติฐาน ต้องวัดเอง |
| ผู้เล่นไทยใช้ Facebook, TikTok, YouTube, Instagram, LINE เกมแนวสบาย ๆ มักใช้ภาษาไทยไม่เป็นทางการ [R5] | ตรวจแล้ว (บริษัทแปลเกม แหล่งเชิงโฆษณา) | น้ำเสียงกันเอง + การ์ดอวดสไลม์สำหรับแชร์ |
| มีข่าวปี 2024 ว่ารัฐบาลไทยอยากให้สถานที่ท่องเที่ยวจังหวัดอยู่ใน Ragnarok Origin [R6] | ตรวจแล้ว (ข่าวเก่า ไม่ทราบผล) | การเชื่อมเกมกับสถานที่จริงในไทยมีผู้สนใจ เป็นทางร่วมมือในอนาคต |

## 2. เกมแนวสไลม์

| ข้อค้นพบ | สถานะ | ผลต่อการออกแบบ |
|---|---|---|
| เกม Tensura ทางการ (ISEKAI Memories, Bandai Namco) เป็น 3D battle RPG แบบสั่งการ มีการสร้างประเทศจากหมู่บ้านเป็นเมือง ไม่ใช่ idle [S1] | ตรวจแล้ว | ใช้แค่โครงเรื่อง “เกิดใหม่เป็นสไลม์” ซึ่งเป็นแนวทั่วไป **ห้ามใช้ชื่อ ตัวละคร หรือชื่อสกิลของ Tensura** |
| Legend of Slime: Idle RPG มีอยู่แล้ว ตัวเลขจาก Sensor Tower ขัดกันหลายเท่า สรุปความสำเร็จไม่ได้ [S2] | ตรวจแล้ว (ข้อมูลไม่สอดคล้อง) | สไลม์ idle อย่างเดียวไม่ใช่จุดต่าง |

## 3. เกมแผนที่จริง

| ข้อค้นพบ | สถานะ | ผลต่อการออกแบบ |
|---|---|---|
| Dragon Quest Walk: รายได้เกิน 2,000 ล้านดอลลาร์ในไม่ถึง 5 ปี ผู้เล่นใช้เวลาเฉลี่ย 545 นาที/สัปดาห์ (Pokémon GO 192) แหล่งระบุว่าความสำเร็จมาจากแฟนเกมเดิมในญี่ปุ่น [L1][L2] | ตรวจแล้ว (ประมาณการ Sensor Tower) | เกมแผนที่ที่สำเร็จมักมี IP ดัง เราไม่มี จึงต้องใช้ “ตัวตนท้องถิ่น” แทน |
| Monster Hunter Now: 336.9 ล้านดอลลาร์ใน 3 ปี ส่วนใหญ่ปีแรก ปีที่ 3 มี 68% จากญี่ปุ่น [L3] | ตรวจแล้ว | กระแสเปิดตัวลดเร็ว ต้องมีแรงดึงระยะยาวที่ไม่ใช่ความแปลกใหม่ |
| Pokémon GO จัดงานพบปะ Community Celebrations ในหลายเมือง (ก.ค. 2026) โดยมี Community Ambassador เป็นผู้จัด [L4] | ตรวจแล้ว (ประกาศงาน ไม่ใช่ผลลัพธ์) | งานพบปะจริงควรมีผู้จัดที่ทีมรับรอง ไม่ใช่ผู้เล่นนัดกันเอง |
| Ingress “First Saturdays” งานพบปะรายเดือนกว่า 100 เมือง สำหรับผู้เล่นใหม่ [L5] | ตรวจแล้ว (ข้อมูลราว 10 ปีก่อน) | ใช้เป็นแบบอย่างงานพบปะในขั้น 4 |
| ไม่พบตัวเลขว่างานพบปะช่วยรักษาผู้เล่นได้แค่ไหน | ช่องว่าง | ไม่สัญญาผลของงานพบปะ |

## 4. ระบบสังคมและการเลิกเล่น

| ข้อค้นพบ | สถานะ | ผลต่อการออกแบบ |
|---|---|---|
| งานวิจัย World of Warcraft: ผู้เล่นไม่อยู่กิลด์เลิกเล่นมากกว่า 1.33 เท่า [C1] | ตรวจแล้ว (เกมเดียว บริบทต่างกัน) | ระบบย่าน/กิลด์เป็นแกน ไม่ใช่ของเสริม |
| งานวิจัย MMO อื่น: ผู้เล่นเดี่ยวมีแนวโน้มเลิกเล่นมากกว่าผู้เล่นสายสังคม; เครือข่ายเพื่อนส่งผลต่อการเลิกเล่น [C1] | ตรวจแล้ว (สรุปจากผลค้น) | ทำให้ผู้เล่นคนเดียวได้เจอคนอื่นตั้งแต่วันแรก (ลานย่าน, แบกเพื่อน) |
| Fate/Grand Order: ผู้เล่นตั้งตัวละคร support ให้คนอื่นยืมได้ เจ้าของได้ Friend Points เมื่อมีคนใช้ [C2] | ตรวจแล้ว | ต้นแบบของ **แบกเพื่อน** — เราให้แต้มแบก ไม่ผูกกับกาชา |
| เกม idle (Guild of Guardians) เก็บของ AFK สะสมได้ 12 ชม. และเพิ่มได้ด้วยสิทธิพิเศษ [C3] | ตรวจแล้ว (เกมเดียว) | เราตั้งค่าเริ่มต้น 10 ชม. (ผลจำลอง: 8 ชม. ทำให้คนเปิดทุก 2 วันช้ากว่าคนเปิดปกติเกิน 2 เท่า) ให้กลับมาวันละ 2–3 ครั้ง ปรับตาม playtest |
| แนวทางเกม idle: ผู้เล่นต้องอยู่ได้นาน, การจำกัดจังหวะช่วยดึงกลับ, กิลด์ช่วยระยะยาว [C4] | ตรวจแล้ว (แหล่งคุณภาพต่ำ) | ใช้เป็นแนวคิด ไม่ใช่ตัวเลขเป้าหมาย |

## 5. ระบบจากเกมอื่นที่นำมาปรับ

| ระบบในเกมอื่น | ที่มา | ปรับเป็นของเรา |
|---|---|---|
| แต้มสถานะ + เปลี่ยนอาชีพ (RO) | ความรู้ทั่วไป | 4 ค่าหลัก รีเซ็ตฟรี + **อัปร่าง** |
| การ์ดมอนสเตอร์ฝังอุปกรณ์ (RO) | ความรู้ทั่วไป | **การ์ดมอน** (ขั้น 2) |
| หมวกเห็นบนหัว + ชุดแต่งแยกจากค่าสถานะ (RO) | ความรู้ทั่วไป | อุปกรณ์เห็นบนตัว + **ชุดแต่ง** |
| ยืมตัวช่วยของผู้เล่นอื่น (FGO) | [C2] | **แบกเพื่อน** |
| ของ AFK สะสมมีเพดาน | [C3] | ของออโต้ 10 ชม. |
| ฝ่าย/ทีมระดับเมือง (Ingress) | ความรู้ทั่วไป | **ย่านเรา** + ศึกย่าน (แข่งผลงาน ไม่ตีกัน) |
| Raid ร่วมกันในพื้นที่ (Pokémon GO) | ความรู้ทั่วไป | **บอสย่าน** แบบไม่ต้องออนไลน์พร้อมกัน |
| สร้างประเทศจากหมู่บ้าน (Tensura ISEKAI Memories) | [S1] | **ย่านเปลี่ยน** เมื่อชาวย่านล้มบอส |
| ตัวละครโตด้วยการกลืน (แนวสไลม์ทั่วไป) | ความรู้ทั่วไป | **กลืน → ส่วนงอก** |
| ระบบลับที่ชุมชนช่วยกันค้นหา | ความรู้ทั่วไป | **ฟิวชัน + ร่างลับ** (ขั้น 2) |

## 6. เทคนิค

| ข้อค้นพบ | สถานะ | ผลต่อการตัดสินใจ |
|---|---|---|
| Phaser 4.0.0 ออก 10 เม.ย. 2026 และ 4.1.0 ออก 30 เม.ย. 2026 มี renderer ใหม่ [T1][T2] | ตรวจแล้ว | ขั้น 1 ใช้ Phaser **3.90.0** ที่ใช้ใน `demo/` แล้ว (ตัวอย่างและเอกสารเยอะกว่า, AI เขียนผิดน้อยกว่า) ประเมินย้ายไป 4 หลังขั้น 1 |
| Supabase ฟรี: 2 โปรเจกต์, **หยุดโปรเจกต์หลังไม่มีการใช้งาน 7 วัน**, Edge Functions 500,000 ครั้ง/เดือน, Realtime 200 การเชื่อมต่อพร้อมกัน, DB 500 MB (แหล่งรอง ต้องเช็กหน้าราคาจริง) [T3] | ตรวจแล้ว (แหล่งรอง) | พอสำหรับ playtest ขั้น 1 แต่ช่วง playtest ต้องไม่ปล่อยให้โปรเจกต์ถูกหยุด หรือใช้แผนจ่ายเงิน |
| ข้อมูล OpenStreetMap ใช้สัญญา ODbL งานที่เผยแพร่ต้องแสดงเครดิตให้ผู้ใช้เห็น สำหรับแผนที่แบบโต้ตอบ เครดิตที่มุมจอถือว่าพอ ถ้าเห็นชัดพอ [T4] | ตรวจแล้ว | แสดง “© ผู้ร่วมสร้าง OpenStreetMap” บนหน้าแผนที่ + หน้าเครดิต |
| นโยบายการใช้ Overpass API | ยังไม่ได้ตรวจ | ดึงข้อมูลครั้งเดียวแบบออฟไลน์แล้วเก็บไฟล์ ไม่ยิง API ตอนผู้เล่นเล่น |
| PixelLab `create_font` สร้างได้ 80 ตัวอักษรละติน/ตัวเลข/สัญลักษณ์เท่านั้น (จากเอกสาร MCP ที่ผู้สร้างส่งมา) | ตรวจจากเอกสาร | ฟอนต์ไทยใช้ Google Fonts (เช่น Kanit / Prompt / Mitr) ฟอนต์พิกเซลใช้กับตัวเลขและภาษาอังกฤษเท่านั้น |

## 7. ช่องว่างที่ต้องหาคำตอบต่อ

1. ข้อมูลผู้เล่น idle RPG ในไทย (Sensor Tower / data.ai รายประเทศ)
2. นโยบาย Overpass API และ attribution guideline ฉบับปัจจุบันของ OSMF
3. หน้าราคา Supabase จริง ณ วันที่จะ deploy
4. การล็อกอินด้วย LINE กับ Supabase (คนไทยใช้ LINE มาก) — ยังไม่ได้ตรวจว่ารองรับแบบใด
5. ชื่อย่านและความรู้สึกของคนเชียงใหม่ต่อการเอาย่านมาแข่งกัน — ต้องถามคนในพื้นที่
6. ตรวจชื่อเกมซ้ำและเครื่องหมายการค้า

## แหล่งอ้างอิง

- R1: [Ragnarok Idle Adventure ranked top on both markets after its launching in Thailand (Gravity, ม.ค. 2024)](https://www.stocktitan.net/news/GRVY/ragnarok-idle-adventure-ranked-top-on-both-markets-after-its-poub261mek2g.html)
- R2: [Ragnarok: Twilight Has Successfully Launched in Southeast Asia (Gravity, พ.ย. 2025)](https://www.globenewswire.com/news-release/2025/11/03/3178991/0/en/Ragnarok-Twilight-Has-Successfully-Launched-in-Southeast-Asia.html)
- R3: [Sensor Tower — Southeast Asia Mobile Gaming 2025](https://gameindustrylibrary.com/documents/sensor-tower-southeast-asia-mobile-gaming-2025/read)
- R4: [42matters — Top Grossing Mobile Games: Thailand](https://42matters.com/top-grossing-mobile-games-thailand)
- R5: [LangLink — Thai game localization (gamescom asia 2025)](https://games.langlinking.com/blog-thai-game-localization-lqa-strategies-thailand-gamescom-asia-2025/)
- R6: [TIN — Thailand plans to boost tourism through a mobile game](https://www.tin.media/news/details/thailand-plans-to-boost-tourism-through-a-mobile-game)
- S1: [Gematsu — That Time I Got Reincarnated as a Slime: ISEKAI Memories now available](https://www.gematsu.com/2021/10/that-time-i-got-reincarnated-as-a-slime-isekai-memories-now-available)
- S2: [Sensor Tower — Q2 2024 iOS top 5 idle RPG](https://sensortower.com/blog/2024-q2-ios-top-5-idle%20rpg-units-cz-6040bbc2241bc16eb883a0cb)
- L1: [Sensor Tower — Dragon Quest Walk first month](https://sensortower.com/blog/dragon-quest-walk-first-month)
- L2: [PocketGamer.biz — Dragon Quest Walk top grossing](https://www.pocketgamer.biz/japan-only-location-ar-mobile-game-dragon-quest-walk-top-grossing)
- L3: [PocketGamer.biz — Monster Hunter Now makes $336.9m in three years](https://www.pocketgamer.biz/monster-hunter-now-makes-3369m-in-three-years-on-mobile/)
- L4: [Pokémon GO — Community Celebrations GO Fest 2026](https://pokemongo.com/en/news/community-celebrations-go-fest-2026-details-en)
- L5: [PocketGamer.biz — Niantic Labs launches Ingress First Saturdays](https://www.pocketgamer.biz/niantic-labs-launches-ingress-first-saturdays)
- C1: [Predicting Customer Churn in World of Warcraft (arXiv)](https://arxiv.org/pdf/2006.15735)
- C2: [Fate/Grand Order — Earning Friend Points](https://samurai-gamers.com/fate-grand-order/earning-friend-points/)
- C3: [Guild of Guardians — AFK rewards and FTUE update](https://guildofguardians.com/news/afk-rewards-and-ftue-update)
- C4: [Adjust — How to make an idle game](https://www.adjust.com/blog/how-to-make-an-idle-game)
- T1: [Phaser — v4 download / releases](https://phaser.io/download/phaser4)
- T2: [Phaser World Issue 236](https://phaserworld.beehiiv.com/p/phaser-world-issue-236)
- T3: [Supabase free tier limits 2026 (แหล่งรอง)](https://automationatlas.io/answers/supabase-free-tier-limits-2026/)
- T4: [OSMF — Attribution Guidelines](https://osmfoundation.org/wiki/Attribution) · [OSMF — Licence and Legal FAQ](https://osmfoundation.org/wiki/Licence_and_Legal_FAQ)
