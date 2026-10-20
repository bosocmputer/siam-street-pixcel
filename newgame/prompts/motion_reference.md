# วิดีโอต้นแบบท่าทาง (prompt สำหรับ Google Flow)

ใช้ Flow สร้างวิดีโอคนจริงทำท่า แล้วผู้พัฒนาดูทีละเฟรมและลอกมุมข้อต่อมาเป็นท่าในเกม (`apps/citywalk/src/anim/clips.ts`) วิดีโอไม่ได้เข้าเกมโดยตรง ตัวละครในวิดีโอจึงไม่ต้องหน้าตาเหมือนในเกม ขอแค่ท่าชัด

## ทำไมไม่เอาวิดีโอมาทำภาพในเกมตรง ๆ (วิเคราะห์ 19 ต.ค. 2569)

| เรื่อง | ลอกท่าจากวิดีโอ (ใช้ทางนี้) | เอาภาพวิดีโอเข้าเกมตรง ๆ |
|---|---|---|
| ท่าเป็นธรรมชาติ | ใกล้วิดีโอ | เหมือนวิดีโอที่สุด |
| หน้าสร้างตัวละคร (อนุมัติแล้ว 18 ต.ค.) | ใช้ได้ครบทุกแบบ | ใช้ไม่ได้ ทุกคนหน้าตาเดียวกัน |
| เปลี่ยนชุด เปลี่ยนอาวุธทีหลัง | ได้ทันที | ต้องสร้างวิดีโอใหม่ทุกท่าทุกมุม |
| 5 มุมกล้องตรงกัน | ตรงเสมอ (มาจากโมเดลเดียว) | AI มักวาดแต่ละมุมไม่เหมือนกัน |
| จำนวนคลิป | ประมาณ 10 | 50 ขึ้นไป รวมที่ต้องลองซ้ำ |

## ตั้งค่าใน Flow

- โหมด Text to Video (ถ้าอยากให้ตัวละครเหมือนกันทุกคลิป ใช้ Ingredients to Video กับภาพตัวละครภาพเดียว แต่ไม่จำเป็น)
- ลองด้วยรุ่น Fast ก่อนเพื่อประหยัดเครดิต ถ้าท่าดีแล้วค่อยใช้รุ่นคุณภาพสูง
- แนวนอน 16:9 · ยาว 8 วินาที · 1 ผลลัพธ์ต่อครั้ง
- ดาวน์โหลดเป็น MP4 แล้วส่งมาในแชต (ชื่อไฟล์ตามเลขคลิปด้านล่าง เช่น `ref_04.mp4`)

## ตรวจก่อนส่ง

- กล้องนิ่งตลอด ไม่ซูม ไม่ตัดภาพ
- เห็นเต็มตัวตั้งแต่หัวถึงเท้าทุกเฟรม
- คนอยู่กลางภาพ ไม่เดินออกจากภาพ
- มือขวาถือท่อตลอด ท่อไม่หายหรือเปลี่ยนมือ

ถ้าคลิปไหนไม่ผ่าน ให้สร้างใหม่ หรือส่งมาพร้อมบอกว่าวินาทีไหนใช้ได้

## ธีม (ใส่หน้าทุก prompt)

```
Animation motion reference video. A young Thai street fighter: short black hair, plain black t-shirt, dark trousers, white sneakers, holding an 80 cm grey iron pipe in the RIGHT hand with a one-handed grip. Full body always in frame from head to feet. Empty plain light-grey studio with a flat light-grey floor, soft even lighting. Locked-off static camera: no camera movement, no zoom, no cuts, long lens, camera at chest height looking slightly down. The character stays in the centre of the frame and does not travel. Movement style: light, fast and agile like the hero of a modern anime action RPG, clear readable poses, snappy timing with a short hold after each hit. No text, no music, no other people, no props except the pipe.
```

มุมกล้อง (เลือกตามคลิป):

- **ข้าง** = `Camera exactly side-on, the character faces screen right.`
- **เฉียง** = `Camera at the character's front-left diagonal (45 degrees), the character faces the camera's right side.`

## 10 คลิป (ต่อท้ายธีม + มุมกล้อง)

| คลิป | มุม | ท่า (ต่อท้าย prompt) |
|---|---|---|
| ref_01 เดิน | ข้าง | `He walks in place at a relaxed brisk pace, like on a treadmill, arms swinging naturally, the pipe held low pointing forward and down. Repeat for the whole clip.` |
| ref_02 วิ่ง | ข้าง | `He runs in place at full speed, like on a treadmill, leaning forward, knees high, the pipe held low. Repeat for the whole clip.` |
| ref_03 ยืนพัก | เฉียง | `He stands relaxed but ready, breathing, weight shifting slightly, the pipe resting low in the right hand.` |
| ref_04 ตี 1 | เฉียง | `From a ready stance he swings the pipe in one fast flat horizontal strike from his right side across his body to his left, hips and shoulders turning into it, then returns to stance. Do this three times with a one-second pause between.` |
| ref_05 ตี 2 | เฉียง | `Starting with the pipe on his left side, he swings a fast backhand horizontal strike from his left back out to his right, then returns to stance. Do this three times with a one-second pause between.` |
| ref_06 ตี 3 | ข้าง | `He jumps a little, raising the pipe high over his head with both hands, and slams it straight down hard in front of him as he lands, low and forward, holds for a moment, then stands up. Do this twice.` |
| ref_07 คอมโบ | เฉียง | `A three-hit combo without stopping: a flat strike right to left, a backhand strike left to right, then a small jump and an overhead slam down. Pause, then do the whole combo again.` |
| ref_08 พุ่งหลบ | ข้าง | `He does a very quick low dash forward about two steps, body low and leaning, the pipe trailing behind, then recovers to stance. Do this three times.` |
| ref_09 ตั้งการ์ด | เฉียง | `He raises the pipe horizontally in front of his chest, left hand pressing the far end, knees bent, and holds the guard for two seconds, then lowers it. Do this twice.` |
| ref_10 โดนตี | ข้าง | `He is hit in the chest by an unseen blow: he flinches back a step, upper body bending back, then recovers to stance. Do this three times.` |

## สถานะ

19 ต.ค. 2569 เขียน prompt แล้ว · ref_01 (เดิน) ได้แล้ว: กล้องนิ่ง เดินอยู่กลางภาพ 10 วินาที หนึ่งรอบก้าว 28 เฟรม (24 fps) ลอกท่าแขนซ้ายและลำตัวมาใส่ `WALK` แล้ว · 20 ต.ค. ผู้สร้างทักว่าถือท่อชี้หน้าต่ำ ๆ ดูเหมือนไม้เท้าคนตาบอด จึงเปลี่ยนเป็นพาดท่อบนบ่าขวาตอนยืน เดิน วิ่ง (`CARRY` ใน `clips.ts`) ท่าตีเริ่มจากบ่า · คลิปอื่นรอผู้สร้าง
