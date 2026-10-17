# ค้นคว้า: เกม 3D แอ็กชัน MMORPG บนแผนที่จริงของไทย (เริ่มเชียงใหม่)

ค้นคว้า: 17 ตุลาคม 2569 · สถานะ: desk research ยังไม่ได้ทดลองสร้างจริง ยังไม่ได้คุยกับผู้เล่น
คำขอของผู้สร้าง: ใช้แผนที่จริงทำเส้นทางและสถานที่สำคัญ เริ่มเชียงใหม่ แล้วขยายทั้งประเทศ เป็น 3D ดูสมจริง แนว action MMORPG ให้คนอินเพราะอยู่ในที่คุ้นเคย

## 1. คำตอบสั้น

- **ไอเดียนี้มีจุดแข็งจริง** คนไทยเห็นถนน คูเมือง ดอย ตลาดที่ตัวเองรู้จักในเกมแล้วอยากแชร์ และยังไม่พบเกมไทยที่ทำ 3D บนแผนที่จริงแบบนี้ (ผลค้นหาไม่พอจะบอกว่า “ไม่มีเลย”)
- **ข้อมูลแผนที่หาได้ฟรี** ถนน อาคาร แม่น้ำ จาก OpenStreetMap/Overture และความสูงภูเขาจากข้อมูลดาวเทียม แต่ **ภาพ 3D สมจริงแบบ Google Earth เอามาใส่เกมไม่ได้** (ห้ามเก็บไว้ในเกม ต้องดึงสดเท่านั้น)
- **“3D สมจริง + ทั้งประเทศ + MMORPG” พร้อมกันคือโครงการระดับหลายพันล้านบาท** เกม MMO เชิงพาณิชย์ใช้งบราว 50 ล้านดอลลาร์ขึ้นไป ทีมหลักร้อยคน 2–4 ปี
- **ทางที่ทำได้จริง** เริ่มจากชิ้นเล็กที่เล่นได้ (vertical slice) เช่น เมืองเก่าเชียงใหม่ย่อขนาด 1 แห่ง เล่นคนเดียวหรือ co-op 2–4 คน ถ้าคนชอบค่อยขยายจังหวัดและเพิ่มออนไลน์

## 2. ใช้แผนที่จริงได้แค่ไหน

| แหล่ง | ได้อะไร | ใช้ในเกมได้ไหม |
|---|---|---|
| Google Photorealistic 3D Tiles | ภาพ 3D เหมือน Google Earth | **ไม่เหมาะ** ต้องดึงสดทุกครั้ง ห้ามเก็บ/แคช/ใช้ออฟไลน์ ต้องแสดงเครดิต มีโควตาและค่าใช้จ่าย ระยะใกล้ระดับคนเดินดูเละ ข้อมูลเปลี่ยนเองได้ [G1][G2][G3][G4] |
| OpenStreetMap / Overture | ถนน รูปตึก แม่น้ำ ชื่อสถานที่ | **ใช้ได้** ต้องให้เครดิต ถ้าเผยแพร่ฐานข้อมูลที่ดัดแปลงต้องเปิดตามสัญญา ODbL [O1][O2] |
| ข้อมูลความสูง (SRTM, Copernicus DEM) | รูปทรงภูเขา ดอยสุเทพ หุบเขา | ใช้ได้ (ข้อมูลเปิดระดับโลก) ข้อมูลละเอียดของ GISTDA ยังไม่ได้ยืนยันว่าเปิด [D1] |
| โมเดลเชียงใหม่ที่ขาย (TurboSquid, RenderHub) | ตึกกล่องจากข้อมูล GIS | ใช้ได้ตามสัญญาซื้อ แต่เป็นกล่องหยาบ ไม่ช่วยเรื่องสมจริง [M1][M2] |
| ถ่ายเองด้วยมือถือ (RealityScan) | วัตถุ/ซุ้ม/ร้านเฉพาะจุด | ใช้ได้ ฟรี เหมาะกับของชิ้นเด่น [P1] |
| โดรน | มุมสูง ทำโมเดลพื้นที่ | ต้องลงทะเบียน กสทช. + CAAT มีเขตห้ามบิน [P2] |

ข้อสรุป: **ใช้ข้อมูลจริงเป็น “โครงกระดูก”** (ผังถนน ตำแหน่งคูเมือง ประตู ภูเขา แม่น้ำ) แล้ว **ทีมศิลป์สร้างเนื้อหนังเอง** นี่คือวิธีที่เกมใหญ่ใช้

## 3. เครื่องมือที่มีอยู่แล้ว

- **Unreal Engine 5** ฟรีจนกว่าเกมจะทำเงินเกิน 1 ล้านดอลลาร์ แล้วจ่าย 5% (หรือ 3.5% ถ้าเข้าโปรแกรม Launch Everywhere) [U1]
- **Cesium for Unreal / ArcGIS Maps SDK for Unreal** โหลดแผนที่จริงเข้า Unreal ได้ เหมาะทำต้นแบบดูภาพรวม [G1][A1]
- **Blosm (Blender)** ดึงตึก/ถนนจาก OSM เข้า Blender เพื่อแต่งต่อ [B1]
- มีผู้ขายเครื่องมือแปลง OSM เป็นเมืองใน UE5 บน Fab [F1]
- **AI สร้างโมเดล 3D** (Meshy, Tripo, TRELLIS) ช่วยของประกอบฉากได้ ต้องเช็กสิทธิ์เชิงพาณิชย์ของแต่ละเจ้า [AI1]

## 4. ข้อเท็จจริงเรื่องขนาด

- **แผนที่จริงต้องย่อ** Ghost of Tsushima ทำเกาะจริง 274 ตร.ไมล์ เหลือในเกมราว 11 ตร.ไมล์ ผู้พัฒนาบอกว่าเลือก “ความแน่น” มากกว่า “ความใหญ่” [S1][S2] ถ้าทำเชียงใหม่ 1:1 จะได้ถนนยาวว่างเปล่า ต้องย่อและคัดจุดที่คนจำได้
- **ทั้งประเทศ 77 จังหวัด** ถ้าแต่ละจังหวัดทำละเอียดระดับเชียงใหม่ ปริมาณงานคูณ 77 ต้องวางรูปแบบ “ภูมิภาค” แล้วเลือกจุดเด่นจังหวัดละไม่กี่แห่ง
- **MMORPG** งบเชิงพาณิชย์ราว 50 ล้านดอลลาร์ขึ้นไป ทีม 200–300 คน 2–4 ปีขึ้นไป [C1][C2] ตัวอย่างทีมเล็ก Brighter Shores พัฒนาตั้งแต่ 2016 เปิดทดลอง พ.ย. 2024 ผู้เล่นพร้อมกันลดจาก ~8,000 เหลือ ~250 (ตัวเลขจากแหล่งรอง) [C3] เซิร์ฟเวอร์ MMO ต้องมีคนเล่นพร้อมกันมากถึงจะสนุก ถ้าคนน้อยโลกจะว่าง

## 5. ตลาดไทย

- ตลาดเกมไทย ~37,000 ล้านบาท มือถือ ~18,000 ล้าน พีซี ~12,400 ล้าน (depa 2568 ในงานวิจัยเดิมของโครงการ) และแหล่งต่างประเทศประเมินผู้เล่น ~41 ล้านคน มือถือเป็นส่วนใหญ่ [K1][K2]
- **3D สมจริงบนมือถือหนักมาก** เครื่องคนส่วนใหญ่ไม่แรง ถ้าเริ่มบนพีซีจะได้ภาพสวยกว่าแต่กลุ่มคนเล็กลง
- มีหลักฐานว่าภาครัฐสนใจเกมกับสถานที่จริง: ข้อเสนอใช้ Ragnarok Origin โปรโมตอยุธยา [R1], ททท. ร่วม Pokémon GO 24 จังหวัด [R2] และมีงานแฟนเมดสร้างกรุงเทพฯ ใน Roblox [R3] ช่องทางพันธมิตรท่องเที่ยวเป็นไปได้ (ยังไม่ได้ติดต่อจริง)
- เกม 3D ไทยที่พบ เช่น Dead Sea (open world survival, CryEngine) และ PRETA (สยองขวัญ, Unreal) ยังไม่ใช่โลกไทยจริงแบบที่เราคิด [R4]

## 6. ความเสี่ยงด้านวัฒนธรรมและกฎหมาย

- **วัดและศาสนสถาน** ห้ามเป็นสนามต่อสู้/มอน/บอส (กติกาเดิมของโครงการ) มีกรณี Fight of Gods ถูกถอดจาก Steam ไทยเพราะพระพุทธเจ้าเป็นตัวละครต่อสู้ [L1] เชียงใหม่มีวัดเยอะมาก ฉากเมืองเก่าต้องวางเส้นทางสู้ให้เลี่ยงวัด
- **สถาบัน ตราหน่วยงาน ชื่อร้านจริง เครื่องหมายการค้า** ใช้ไม่ได้โดยไม่ขออนุญาต ใช้ชื่อเรียกทั่วไปแทน
- **บ้านคนจริง/ที่ส่วนตัว** ไม่ควรเป็นดันเจี้ยนที่ระบุตัวได้
- **ร่าง พ.ร.บ.ส่งเสริมอุตสาหกรรมเกม** อาจมีจัดเรตและลงทะเบียน สถานะยังไม่ยืนยัน [L2]
- ข้อมูลตำแหน่งจริงไม่ต้องใช้ GPS ผู้เล่นเลย (เล่นจากบ้านได้)

## 7. ข้อเสนอของผม (ในฐานะนักออกแบบ)

**ภาพ:** “สมจริงแบบมีสไตล์” ผังเมืองจริง แสงสวย วัสดุเหมือนจริงแต่ไม่ใช่สแกน ทำง่ายกว่า โหลดเบากว่า แก่ไม่เร็ว และเลี่ยงการก๊อปของ Google

**เนื้อเรื่อง:** story bible “ทวนน้ำ” ที่เขียนไว้ เข้ากับไทยจริงได้ดี แม่น้ำปิงไหลจากเชียงใหม่ลงเจ้าพระยา สมัยก่อนเรือขึ้นล่องจริง ใช้แม่น้ำเป็น “เส้นทางขยายจังหวัด” ได้ตามธรรมชาติ (เชียงใหม่ → ลำพูน → ตาก → นครสวรรค์ → ... → กรุงเทพฯ) ตัดโลกแฟนตาซีทิ้ง เหลือแก่นเรื่อง “เสียงที่ถูกลืมของแต่ละที่”

**ขั้นตอน:**

1. **กระดาษ (1–2 สัปดาห์)** เลือก 8–12 จุดในเชียงใหม่ที่คนจำได้ (คูเมือง ประตูท่าแพ กาดหลวง ถนนนิมมาน แม่ปิง ดอยสุเทพ-ส่วนป่าและถนน ไม่ใช่วัด) วางเส้นทางเรื่อง จุดสู้ จุดพัก
2. **ต้นแบบดูผังในเว็บ (ผมทำได้ในคลาวด์)** ดึง OSM เมืองเก่าเชียงใหม่ ขึ้นเป็นกล่อง 3D เดินดูได้ในเบราว์เซอร์ ย่อขนาดและทดลองว่าย่อแค่ไหนยังจำได้
3. **ต้นแบบเล่นได้ (2–4 เดือน, ต้องมีคนทำ Unreal อย่างน้อย 1–2 คน)** พื้นที่ ~1 ตร.กม. การต่อสู้ 1 แบบ ศัตรู 3 ชนิด บอส 1 ตัว เล่น 20–30 นาที
4. **ทดสอบกับคนเชียงใหม่ 10–20 คน** วัดว่า “อินเพราะคุ้นเคย” จริงไหม
5. **ผ่านแล้ว** เพิ่ม co-op ออนไลน์ 2–4 คน → จังหวัดที่ 2 → ระบบพื้นที่ส่วนกลาง (MMO-lite) → MMO เต็มเมื่อมีทุนและผู้เล่นพอ

## 8. ต้องให้ผู้สร้างตัดสินใจ

1. เครื่องเล่นหลัก: พีซี (ภาพสวย) หรือ มือถือ (คนเยอะ ภาพต้องเบา)
2. ระดับภาพ: สมจริงแบบมีสไตล์ (แนะนำ) หรือ เหมือนภาพถ่าย
3. ผู้เล่นพร้อมกัน: เริ่มคนเดียว/co-op (แนะนำ) หรือ MMO ตั้งแต่แรก
4. ทีมและงบ: จะหาคนทำ Unreal/3D artist ได้ไหม งบประมาณคร่าว ๆ เท่าไร
5. เนื้อเรื่อง: ใช้แก่น “ทวนน้ำ” ตามแม่น้ำจริง หรือเขียนใหม่

## แหล่งอ้างอิง

- [G1] Cesium — Photorealistic 3D Tiles in Unreal: https://cesium.com/learn/unreal/unreal-photorealistic-3d-tiles/
- [G2] Google Map Tiles API policies: https://developers.google.com/maps/documentation/tile/policies
- [G3] Cesium forum — Can I make a videogame with Cesium for Unreal: https://community.cesium.com/t/can-i-make-a-videogame-with-cesium-for-unreal/28962
- [G4] Cesium forum — Google tiles limitations: https://community.cesium.com/t/google-tiles-limitations/31034 · data changes over time: https://community.cesium.com/t/google-photorealistic-3d-tiles-changed-over-time-is-there-any-way-to-lock-or-preserve-previous-data/44682
- [O1] Overture Maps buildings: https://overturemaps.org/?p=349
- [O2] LWN — Overture and OSM licensing: https://lwn.net/Articles/996576
- [D1] awesome-thai-gis: https://github.com/pnphannisa/awesome-thai-gis
- [M1] TurboSquid Chiang Mai: https://www.turbosquid.com/es/3d-models/chiang-mai-city-and-surroundings-1502206
- [M2] RenderHub Chiang Mai 40 km: https://www.renderhub.com/3dstudio/chiang-mai-thailand-40km
- [P1] RealityScan mobile: https://hothardware.com/news/epic-realityscan-smartphone-3d-scanner
- [P2] TAT drone guide 2025: https://www.tatnews.org/2025/06/flying-a-drone-in-thailand-updated-guide-for-tourists/
- [U1] Unreal Engine license: https://www.unrealengine.com/license
- [A1] ArcGIS Maps SDK 2.0 for Unreal: https://www.esri.com/arcgis-blog/products/unreal-engine/developers/announcing-arcgis-maps-sdk-2-0-for-unreal-engine
- [B1] Blosm: https://github.com/vvoovv/blosm
- [F1] Fab — OSM city generator listing: https://www.fab.com/listings/17fa4dce-17b2-4812-8dda-4e8d651c167b
- [AI1] AI 3D model generators guide: https://app.cinevva.com/guides/ai-3d-model-generators
- [S1] Ghost of Tsushima map size: https://twinfinite.net/2020/07/how-big-ghost-of-tsushimas-map-is-measured/
- [S2] Ghost of Yōtei density vs size: https://automaton-media.com/en/news/ghost-of-yoteis-map-is-about-the-same-size-as-ghost-of-tsushimas-the-devs-didnt-want-to-compromise-on-density-for-a-larger-map/
- [C1] MMO budgets: https://cyberpost.co/how-much-does-the-average-mmo-budget/
- [C2] MMO team: https://online.maryville.edu/blog/what-goes-into-an-mmo-software-development-team/
- [C3] Brighter Shores: https://www.gamersunchained.com/news/from-launch-to-life-support-brighter-shores-lost-97-of-its-players
- [K1] IMARC Thailand gaming market: https://www.imarcgroup.com/thailand-gaming-market
- [K2] Allcorrect — Thailand 2026: https://allcorrectgames.com/insights/the-gaming-market-in-thailand-2026/
- [R1] Ragnarok Origin tourism: https://www.tin.media/news/details/thailand-plans-to-boost-tourism-through-a-mobile-game
- [R2] TAT x Pokémon GO: https://www.pattayamail.com/thailandnews/tat-names-24-provinces-hunting-rare-pokemon-characters-146852
- [R3] Roblox Mahanakhon Thonburi: https://www.roblox.com/games/94609520850236
- [R4] Dead Sea (Thai, CryEngine): https://80.lv/articles/dead-sea-cryengine-from-thailand
- [L1] Fight of Gods ban: https://www.khaosodenglish.com/life/arts/2017/09/14/thailand-bans-fight-gods-game/
- [L2] Draft gaming act: https://www.tilleke.com/insights/thailand-advances-draft-act-to-promote-online-gaming-industry
- งานวิจัยเดิมในโครงการ: `docs/thailand_research.md`, `docs/action_rpg_competitive_research.md`
