# ทดสอบตัวละครจาก Meshy (ภาพ → โมเดล 3D)

ผู้สร้างตกลงลองแบบฟรีก่อน 1 ตัว (19 ต.ค. 2569) เพื่อดูว่าหน้าตาแบบวิดีโอ Flow เข้ากับเกม pixel 3D ไหม ถ้าชอบค่อยสมัคร Pro ตอนทำตัวจริง (แบบฟรีโมเดลเป็นสาธารณะ ต้องใส่เครดิต Meshy · แบบ Pro เป็นของเรา) ปุ่มและชื่อเมนูใน Meshy เปลี่ยนบ่อย ถ้าไม่ตรงกับที่เขียน เลือกที่ใกล้ที่สุดแล้วบอกผู้พัฒนา

ระหว่างทดสอบ ตัวเลือกบนหน้าสร้างตัวละครจะไม่เปลี่ยนรูปร่างตัวนี้ (ดู `character_import.md`)

## ขั้น 1: สร้างภาพตัวละครใน Flow (โหมดสร้างภาพ)

มือเปล่า ไม่ถือท่อ (ท่อเป็นชิ้นแยกในเกม ถ้าติดมากับมือจะขยับไม่ได้) ยืนแขนกางลงเล็กน้อย (A-pose) พื้นขาว แสงเรียบ

ภาพหน้า (จำเป็น):

```
Full-body character reference for building a 3D game model, exact front view. A young Thai man about 20 years old, slim athletic build, realistic adult proportions (about 7 heads tall), short black hair with a light messy fringe, plain black crew-neck t-shirt, dark navy straight trousers, white low sneakers, empty hands. Standing in a relaxed A-pose: arms straight, hanging down and about 30 degrees away from the body, palms facing the thighs, fingers together, legs straight and slightly apart, feet pointing forward. Stylized anime 3D game character like a modern action RPG hero, clean simple shapes and clothing folds, flat even studio lighting, no cast shadows, plain pure white background, the whole body in frame from head to feet with margin, centred, camera at waist height with a long lens so there is no perspective distortion. No weapon, no bag, no jewellery, no text, no logo.
```

ภาพข้างและหลัง (ถ้า Meshy มีช่องใส่หลายภาพ): ใช้ภาพหน้าเป็นภาพอ้างอิง (Ingredients) แล้วใช้ prompt เดิม เปลี่ยนแค่ `exact front view` เป็น `exact left side view, the character faces screen left` หรือ `exact back view` และเติม `the same character as the reference image, same clothes and hair`

ตรวจภาพ: เห็นเต็มตัว · มือห้านิ้วไม่ติดกับตัว · ขาไม่ติดกัน · ไม่มีเงาบนพื้นมาก · เสื้อผ้าไม่มีตัวหนังสือ

## ขั้น 2: สร้างโมเดลใน Meshy

1. เข้า meshy.ai สมัครแบบฟรี (ใช้บัญชี Google ได้) ยังไม่ต้องจ่ายเงิน
2. เลือก **Image to 3D** ใส่ภาพหน้า (ถ้ามี Multi-view ใส่ภาพข้างและหลังด้วย)
3. ตั้งค่า (ถ้ามีช่องนั้น):

| ช่อง | เลือก |
|---|---|
| AI Model | รุ่นใหม่ที่สุด |
| Symmetry | On หรือ Auto |
| Topology | Triangle |
| Target Polycount | ประมาณ 10,000 (มือถือเล่นลื่น) |
| Texture | เปิด · PBR / Normal map ไม่ต้อง (เกมใช้แสงเป็นขั้น) |
| Pose | A-pose |

4. ดูจำนวนเครดิตก่อนกดสร้าง (แบบฟรีมีเครดิตจำกัดต่อเดือน)
5. ตรวจผล: หมุนดูรอบตัว นิ้ว แขน ขาไม่ติดกัน ใบหน้าไม่เบี้ยว ถ้าเสียมาก สร้างใหม่ได้ 1–2 ครั้ง อย่ากด Refine/Retexture ซ้ำหลายรอบ (เปลืองเครดิต)

## ขั้น 3: ใส่ข้อต่อ (Rig)

1. ในโมเดลที่ได้ กด **Animate** หรือ **Rig** แบบ **Humanoid**
2. ถ้าให้วางจุด (คาง ข้อมือ ข้อศอก เข่า หว่างขา) วางตามรูปตัวอย่างบนจอ
3. ไม่ต้องเลือกท่า (Animation) เกมขยับเองด้วยโค้ด ถ้าบังคับให้เลือก เลือกท่ายืนนิ่ง (Idle) อันไหนก็ได้

## ขั้น 4: ดาวน์โหลดแล้วส่งมา

- Format: **GLB** แบบที่มีโครงกระดูก (Rigged) · Texture 1024 หรือ 2048
- ถ้าแบบฟรีดาวน์โหลดไม่ได้ หยุดแล้วบอกผู้พัฒนาก่อน อย่าเพิ่งจ่าย
- แนบไฟล์ .glb มาในแชต (ภาพหน้าที่ใช้ส่งมาด้วยก็ดี)

## ผู้พัฒนาทำต่อ

ตรวจกระดูกและจับคู่ชื่อกับ `config/rig.json` (`joints` ใน assets.json) · แก้ท่ายืนเริ่มต้น (`restFix`) · ย่อให้สูง 1.70 ม. · ใส่ท่อที่มือขวา · แสงเป็นขั้นแบบ pixel 3D · ถ่ายภาพในเกมเทียบกับตัวปัจจุบันและวิดีโอ Flow ให้ผู้สร้างดู

## สถานะ

19 ต.ค. 2569 เขียนขั้นตอนแล้ว รอผู้สร้างลอง
