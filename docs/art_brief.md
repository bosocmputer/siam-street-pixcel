# Art Brief — ภาพทดลองสไตล์ (M2.5 ข้อ 2.5.3)

สถานะ: **ร่าง พร้อมให้ Claude Code บนเครื่องผู้สร้างรัน** ยังไม่ได้สร้างภาพใด ๆ
อ้างอิง: [ทิศทาง UI](ui_design.md) · [มาตรฐานสไตล์ภาพ technical ข้อ 7.1](technical_direction.md) · [แผน M2.5](development_plan.md)

เอกสารนี้เขียนให้ agent ที่มีเครื่องมือ PixelLab (MCP) รันตามได้โดยไม่ต้องเดา เซสชันคลาวด์ที่เขียนเอกสารนี้ยังเรียก PixelLab ไม่ได้ (ดูหัวข้อ 1)

## 0. กติกาบังคับ (ห้ามข้าม)

1. **เริ่มด้วย `get_balance` แล้วรายงานยอดให้ผู้สร้างก่อนสร้างอะไร**
2. ภาพทดลองชุดนี้จำกัดงบที่ **ไม่เกิน 60 generations** (ค่าเริ่มต้นที่ผู้พัฒนาเสนอ ผู้สร้างปรับได้ ยังไม่ได้เช็กยอดเครดิตจริง) ถ้างานใดจะทำให้เกิน ให้หยุดและถามผู้สร้าง (ตัวเลขต้นทุนด้านล่างมาจากคำอธิบายของเครื่องมือ ไม่ใช่ค่าที่วัดจริง ยอดจริงอาจต่างจากนี้)
3. สร้างทีละชิ้น ดูผล แล้วค่อยสร้างชิ้นถัดไป ห้ามสั่งทั้งชุดพร้อมกัน
4. **ห้ามเรียกคำสั่งลบ** (`delete_*`) ผลลัพธ์ที่ไม่ใช้ทิ้งไว้ได้
5. ห้าม commit token ใส่ใน repo, สคริปต์ หรือแชต เก็บเฉพาะใน environment variable
6. ใช้ได้เฉพาะภาพที่ผู้สร้างตรวจแล้ว ห้ามใช้ภาพที่ดูเหมือนตัวละคร/ไอพีของคนอื่น (Tensura, SAO, RO) ห้ามวัดหรือศาสนสถานเป็นฉากต่อสู้
7. บันทึกที่มาของทุกภาพใน `assets/credits.json` (ดูหัวข้อ 6)

## 1. ต่อ PixelLab บนเครื่องผู้สร้าง

ใน Claude Code บนเครื่อง ที่โฟลเดอร์ repo `siam-street-pixcel`:

```
export PIXELLAB_TOKEN='<token ใหม่ ห้ามใช้อันที่เคยโพสต์ในแชต>'   # ใส่ใน ~/.zshrc ของเครื่อง ไม่ใส่ใน repo
claude mcp add pixellab https://api.pixellab.ai/mcp -t http -H "Authorization: Bearer ${PIXELLAB_TOKEN}"
```

ตรวจว่าต่อติด: ให้ agent เรียก `get_balance` ถ้าได้ 401 แปลว่า header ไม่ถูกส่ง ให้ตรวจชื่อตัวแปรและรูปแบบ `Bearer <token>` (ผมยังไม่ได้ลองคำสั่งนี้บนเครื่องจริง ถ้าไม่ผ่านให้ดูเอกสาร https://api.pixellab.ai/mcp/docs)

## 2. มาตรฐานสไตล์ (สรุปจาก technical 7.1 + ทิศทาง UI)

| เรื่อง | ค่า |
|---|---|
| มุมกล้อง | `low top-down` ทุกชิ้น (ตัวละคร/วัตถุ) ไทล์ฉากใช้ `low top-down` ให้เข้ากัน |
| เส้นขอบ | `single color black outline` (หรือใกล้เคียงที่สุดที่เครื่องมือรองรับ) |
| ขนาด | สไลม์/มอน ~48 px · หมวก/อาวุธ/ส่วนงอก 16–32 px · ไอคอน 32 px · ไทล์ 16 px |
| บรรยากาศ | ตลาดกลางคืนเชียงใหม่ พื้นม่วงเข้ม แสงโคมสีส้ม สไลม์ต้องเด่นกว่าฉากเสมอ |
| พาเลต | ล็อกด้วย `reduce_colors` ให้ทุกภาพในชุดเดียวกันใช้พาเลตร่วม (ส่งทุกเฟรม/ทุกชิ้นของชุดในคำสั่งเดียวเพื่อให้ได้พาเลตเดียวกัน) ค่าสีตั้งต้นจากแบบหน้าจอด้านล่าง |
| พื้นหลัง | โปร่งใสทุกชิ้น ยกเว้นไทล์ |

สีตั้งต้นของเกม (จาก `docs/ui/mockup.html`) ใช้เป็นแนวทางเลือกพาเลต ไม่ใช่ข้อบังคับ:
พื้นกลางคืน `#12102a` · แผง `#251f4a` · แสงโคม `#ffb84d` · สไลม์ `#5fe0b0` · ธาตุน้ำ `#5aa9e6` · ไฟ `#ff8a3d` · ลม `#cdeaf5` · ดิน `#c9825a` · อันตราย `#ef5a50`

## 3. ชุดภาพทดลอง

ประมาณการต้นทุนอ้างอิงจากคำอธิบายเครื่องมือ (ยอดจริงดูจาก `get_balance` ก่อนและหลังแต่ละชิ้น)

| # | ภาพ | เครื่องมือแนะนำ | ขนาด | ต้นทุนโดยประมาณ | ไฟล์ปลายทาง |
|---|---|---|---|---|---|
| A | สไลม์ใสร่างเริ่มต้น แบบที่ 1: กลมนุ่ม ขอบหนา ประกายสะท้อน | `create_image_pro_flash` (ถ้า `get_pro_flash_capabilities` รองรับขนาดนี้) หรือ `create_1_direction_object` | 48×48 | ไม่แน่ใจ ตรวจ capabilities ก่อน | `assets/trial/slime_a.png` |
| B | สไลม์ใส แบบที่ 2: เงาเยอะขึ้น ตาโต | เหมือน A ใช้ภาพ A เป็น style reference | 48×48 | เหมือน A | `assets/trial/slime_b.png` |
| C | สไลม์ใส แบบที่ 3: เส้นขอบบาง ลายเส้นเรียบ | เหมือน A | 48×48 | เหมือน A | `assets/trial/slime_c.png` |
| D | อนิเมชันเด้งเบา ๆ ของแบบที่ผู้สร้างเลือกในสามแบบข้างบน (4 เฟรม) | `animate_image` (frame_count 4) | 48×48 | ราว 1 | `assets/trial/slime_idle.png` (sprite sheet) |
| E | มอนอิฐ (ก้อนอิฐมีเขา หน้าบึ้ง เป็นมอนประจำในเวียง) | `create_character` mode standard (ถ้าทรงเข้ากับ humanoid ไม่ได้ ใช้ `create_1_direction_object`) | 48×48 | 1–10 | `assets/trial/monster_brick_imp.png` |
| F | หมวกงอบ (ทรงกรวยกว้าง สานไม้ไผ่) | `create_1_direction_object` | 32×32 | 10–25 (ได้หลายตัวเลือก) | `assets/trial/hat_ngob.png` |
| G | กระติบข้าวเหนียว (ใช้เป็นถุงของออโต้) | `create_1_direction_object` | 32×32 | 10–25 | `assets/trial/basket_kratip.png` |
| H | ไทล์พื้นตลาด: lower = พื้นอิฐเก่ากลางคืนสีม่วงเทา, upper = พื้นดินอัดแน่นมีคราบแสงโคม | `create_topdown_tileset` | 16 px, low top-down | 3–4 | `assets/trial/tiles_market.png` |
| I | กรอบ UI: แผงสีม่วงเข้มขอบมุมแหว่งแบบพิกเซลสีส้มโคม (panel + button) | `create_ui_asset` ใส่ `elements: ["panel","button"]` และ `color_palette: "deep indigo with amber trim"` | ราว 256×256 | 10–25 | `assets/trial/ui_panel.png` |

รวมประมาณ: ถ้าทุกชิ้นเข้าใกล้ค่ากลางของช่วงบนตาราง จะเกิน 60 generations ได้ ลำดับที่แนะนำเพื่อคุมงบ: **A → (ดู) → E → H → F → B,C → D → I → G** แล้วหยุดถามผู้สร้างทันทีที่ยอดสะสมถึง 60

### ตัวอย่าง prompt (ภาษาอังกฤษ ใช้กับเครื่องมือ)

- **A:** `cute round jelly slime, translucent mint green, thick dark outline, glossy highlight on top left, two small black eyes, tiny smile, low top-down view, pixel art, game sprite`
- **B:** `same slime but darker shading at the bottom, bigger shiny eyes, soft blush`
- **C:** `same slime with thin outline and flat colors, minimal shading`
- **E:** `small brick imp monster made of clay bricks with two little horns, angry eyes, low top-down view, pixel art, game sprite, Chiang Mai old city wall theme`
- **F:** `Northern Thai farmer's hat (ngob), wide cone shape, woven bamboo, tan and gold, pixel art item, low top-down view`
- **G:** `kratip, small woven bamboo sticky rice basket with lid, warm brown, pixel art item, low top-down view`
- **H:** lower: `dark purple-grey old brick pavement at night`, upper: `packed earth path with warm lantern light stains`, `transition_description: "worn brick edges"`
- **I:** `pixel art game UI panel, deep indigo background, amber trim, notched pixel corners, night market lantern feel`

ข้อควรระวัง: สไลม์ไม่ใช่ humanoid/quadruped เครื่องมือ `create_character` จึงไม่เหมาะกับตัวสไลม์ (technical ข้อ 7.1 เขียนไว้ว่า 4 ทิศผ่าน `create_character` ซึ่งต้องทบทวน) แนะนำให้สไลม์เป็นภาพทิศเดียวหันตะวันออก + พลิกภาพเมื่อจำเป็น ผู้สร้างต้องตัดสินว่ารับได้ไหมหลังเห็นผลทดลอง

## 4. ตรวจให้ผู้สร้างดู

1. ประกอบภาพในเกม: สไลม์ใส่หมวกงอบยืนบนไทล์ ข้างมอนอิฐ พร้อมกรอบ UI และกระติบ ถ่ายภาพหน้าจอ
2. ใส่ภาพเหล่านี้ลงในแบบหน้าจอหน้าฟาร์ม/หน้าสร้างสไลม์ (`docs/ui/mockup.html`) เพื่อดูว่าเข้ากับ UI จริงไหม
3. ถามผู้สร้าง: เลือกสไลม์แบบไหน (A/B/C), สไตล์เข้ากับบรรยากาศไหม, ความละเอียดพอไหม, ข้อที่ไม่ชอบ
4. แจ้งยอด generations ที่ใช้จริง และประมาณการสำหรับ M6 ทั้งชุด **ผู้สร้างต้องอนุมัติก่อนสร้างเป็นชุด**

## 5. สิ่งที่ห้ามทำในงานนี้

- สร้างเกิน 60 generations โดยไม่ถาม
- ใช้ `create_character` mode pro ทดลองโดยไม่จำเป็น (10–25 generations ต่อตัว)
- เปลี่ยนสไตล์กลางชุดโดยไม่แจ้ง ทุกภาพในชุดควรอ้างอิงสไลม์แบบที่ผู้สร้างเลือก (`style_object_id` หรือ style image)
- เก็บไฟล์ดิบขนาดใหญ่ใน repo (ไฟล์ดิบใส่ `tools/asset-pipeline/raw/` ซึ่งไม่ commit)

## 6. การส่งมอบ

- ไฟล์ PNG ที่ผู้สร้างเลือกแล้วอยู่ใน `assets/trial/` (ขนาดเล็กพอ commit ได้)
- `assets/credits.json` เพิ่มรายการต่อภาพ: ชื่อไฟล์, เครื่องมือ, prompt, seed, วันที่, id ของงานใน PixelLab, ต้นทุน generations ที่ใช้จริง
- ภาพหน้าจอการประกอบ (ข้อ 4) ใน `docs/ui/trial/`
- อัปเดตสถานะ M2.5 ข้อ 2.5.3 ใน `docs/development_plan.md` ตามจริง (ทำเสร็จข้อไหน ข้ามข้อไหน ใช้ไปเท่าไร)
- commit ด้วย `pnpm lint && pnpm typecheck && pnpm test && pnpm build` ผ่าน (ไม่มีโค้ดเกมเปลี่ยนในงานนี้ จึงควรผ่านอยู่แล้ว)
