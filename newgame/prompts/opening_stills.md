# ภาพฉากเปิด 3 ภาพ (prompt สำหรับ AI สร้างภาพ)

ฉากเปิดตาม `gdd.md` ข้อ 2: ภาพนิ่ง 3 ภาพ ภาพละ 3 วิ ข้ามได้ เกมใส่ข้อความไทยใต้ภาพเอง (ในภาพห้ามมีตัวหนังสือ) · mockup: https://claude.ai/artifact/RGcVWt5puDWo4NEY471fJK

## สเปกทั้ง 3 ภาพ

| เรื่อง | ค่า |
|---|---|
| ไฟล์ | PNG ไม่มีลายน้ำ ชื่อ `opening_1.png` `opening_2.png` `opening_3.png` |
| สัดส่วน | สี่เหลี่ยมจัตุรัส 1:1 |
| ขนาด | ภาพ pixel แท้: 256×256 พิกเซล (เกมขยายเองแบบไม่เบลอ) · ถ้าเครื่องมือทำ pixel แท้ไม่ได้ ส่ง 2048×2048 มา ผมแปลงเป็น pixel ให้ |
| ส่วนสำคัญ | อยู่กลางภาพ กว้าง 60% สูง 80% (มือถือแนวตั้งตัดขอบซ้ายขวา จอแนวนอนตัดบนล่าง) |
| สี | ใช้ชุดสีของเกม (ด้านล่าง) ไม่เกิน 32 สี ไม่มีไล่สีเนียน ขอบคม |
| อารมณ์ | ภาพ 1 อุ่นและคึกคัก → ภาพ 2 ลึกลับ → ภาพ 3 เงียบและน่าหวั่น ทั้ง 3 ภาพมุมกล้องและแสงต่อเนื่องกัน |
| ห้าม | ตัวหนังสือ ป้ายร้าน โลโก้ แบรนด์จริง · วัด เจดีย์ พระพุทธรูป พระสงฆ์ ของทางศาสนา · หน้าคนที่จำได้ว่าเป็นใคร · เลือด |

**ชุดสีของเกม** (ใส่ใน prompt ได้เลย): `#181425 #262b44 #3a4466 #5a6988 #8b9bb4 #f4f4f4 #ead4aa #e8b796 #c28569 #be4a2f #f77622 #feae34 #fee761 #124e89 #0099db #2ce8f5 #e43b44 #63c74d` (ใกล้กับชุดสี Endesga 32)

ข้อความที่เกมใส่ใต้ภาพ: ภาพ 1 "ทุกอย่างเริ่มในคืนวันอาทิตย์ธรรมดา" · ภาพ 2 "จนฝนมานาเริ่มตก" · ภาพ 3 "และเชียงใหม่ทั้งเมืองก็หลับไป"

## ภาพ 1: คืนวันอาทิตย์ที่ประตูท่าแพ

ถนนคนเดินคืนวันอาทิตย์หน้าประตูท่าแพ กำแพงอิฐแดงเก่ามีใบเสมา คนเดินแน่นเป็นเงาเล็ก ๆ แผงลอยมีไฟสีส้มอุ่น ฟ้าสีครามเข้ม

```
16-bit pixel art, 256x256, limited palette (Endesga 32: #181425 #262b44 #3a4466 #be4a2f #f77622 #feae34 #fee761 #ead4aa), crisp hard-edged pixels, no anti-aliasing, no gradients.
Sunday night walking street in front of Tha Phae Gate, Chiang Mai, Thailand: an old red-brick city gate and city wall with square crenellations, seen from the open brick square in front of it, slightly low angle.
A dense crowd of tiny silhouetted people walking, food stalls with warm orange string lights and round paper lanterns, steam from a noodle pot.
Deep indigo night sky with a few stars. Warm, lively, ordinary, peaceful mood.
Main subject centered, safe margins on all sides, no text.
```

Negative: `text, letters, signs, logos, watermark, temple, pagoda, stupa, Buddha, monk, religious symbols, recognizable faces, blur, smooth gradient, photorealistic, 3d render`

## ภาพ 2: ฝนมานาเริ่มตก

ฝ่ามือหงายขึ้น หยดฝนสีฟ้าเรืองแสงหยดเดียวตกลงกลางฝ่ามือ มีหยดเรืองแสงอีกหลายเม็ดตกอยู่รอบ ๆ ไฟถนนเบลอไกล ๆ ด้านหลัง (มือไม่บอกเพศ ผิวคนไทย)

```
16-bit pixel art, 256x256, limited palette (Endesga 32: #181425 #262b44 #3a4466 #e8b796 #c28569 #0099db #2ce8f5 #f4f4f4), crisp hard-edged pixels, no anti-aliasing, no gradients.
Close-up of one open palm facing up, gender-neutral hand with warm Thai skin tone, at night.
A single glowing cyan raindrop is landing in the middle of the palm, with a small cyan glow and splash.
More glowing cyan raindrops falling straight down in the dark around it; far behind, a few out-of-focus warm street lights as simple pixel dots.
Mysterious, quiet, wonder. Hand and drop centered, safe margins on all sides, no text.
```

Negative: `text, letters, logos, watermark, ring, jewelry, tattoo, nail polish, blood, horror, blur, smooth gradient, photorealistic, 3d render`

## ภาพ 3: ทั้งเมืองหลับไป

มุมกว้างของเมืองเก่าเชียงใหม่ คูเมืองสี่เหลี่ยมและกำแพงอิฐ ตึกเตี้ย ๆ ดอยสุเทพเป็นเงาภูเขาไกล ๆ (ไม่มีสิ่งก่อสร้างบนดอย) โดมแสงสีฟ้าโปร่งใสใหญ่ครอบทั้งเมือง คนตัวเล็ก ๆ หลับอยู่บนถนนและม้านั่ง

```
16-bit pixel art, 256x256, limited palette (Endesga 32: #181425 #262b44 #3a4466 #5a6988 #8b9bb4 #be4a2f #2ce8f5 #0099db #fee761), crisp hard-edged pixels, no anti-aliasing, no gradients.
Wide view over the old city of Chiang Mai at night: a square moat with red-brick walls, low rooftops and a few lit windows, a mountain silhouette on the horizon with nothing built on it.
A giant translucent glowing cyan dome of light covers the whole city, its edge drawn as a bright pixel arc.
In the foreground street, a few tiny figures lie asleep on the ground and on a bench, small "z" shapes floating above them as simple pixels.
Silent, eerie, still. Dome centered, safe margins on all sides, no text.
```

Negative: `text, letters, signs, logos, watermark, temple, pagoda, stupa, Buddha, monk, religious symbols, buildings on the mountain, recognizable faces, blood, dead bodies, blur, smooth gradient, photorealistic, 3d render`

## ถ้าใช้ PixelLab

ใช้ `create_image_pixflux` (หรือรุ่น pro) ขนาด 256×256 ใส่ prompt ข้างบนได้เลย ส่วน negative ใส่ในช่อง negative description · การสร้างภาพใช้เครดิต ถ้าจะให้ผมสั่งสร้างเอง ผมจะเช็กเครดิตและบอกค่าใช้จ่ายก่อน

## ส่งไฟล์มาแล้วผมทำอะไร

ผมจะใส่ไว้ที่ `apps/citywalk/public/opening/` ลงทะเบียนใน `assets.json` ลดสีให้เหลือชุดสีของเกมถ้าเกิน แล้วถ่ายภาพหน้าจอทั้ง 3 ขนาดให้ดู ถ้ายังไม่มีไฟล์ เกมจะใช้ภาพ pixel ที่วาดด้วยโค้ดแบบใน mockup ไปก่อน
