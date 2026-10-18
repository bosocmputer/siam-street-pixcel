# ใส่ภาพ pixel จาก PixelLab (หรือวาดเอง) แทนภาพที่เกมวาด

ตอนนี้เกมวาดภาพ pixel ของผู้เล่นและมอนจากโมเดล 3D เอง ถ้าอยากใช้ภาพจาก PixelLab แทน ทำตามนี้ ตัวไหนไม่มีไฟล์ เกมก็วาดเองเหมือนเดิม

## 1. สร้างใน PixelLab

- ตัวละคร: แบบ 8 ทิศ (หรือ 4 ทิศก็ได้ เกมใช้ทิศใกล้สุดแทน) มุมกล้องมองลงเล็กน้อย (low top-down)
- ขนาดภาพ 64 หรือ 96 พิกเซล พื้นโปร่งใส
- ท่าผู้เล่น: `idle` `walk` `run` `cast` (ยกมือขวาร่ายพลัง) `hurt` `down` (ล้มลง) `ride` (ขี่มอเตอร์ไซค์) อย่างน้อยต้องมีภาพยืน
- ท่ามอน: ตั้งชื่อตามท่าในโมเดล `Idle` `Jumping` `Squishing` `Attacking` (บอสเพิ่ม `Boss_Tidal_Charge` `Boss_Ground_Slam`)
- ดาวน์โหลดเป็น zip แล้วแตกไฟล์

## 2. รวมภาพเป็นชุดเดียว

```
python3 apps/citywalk/tools/sprites/pack.py <โฟลเดอร์ที่แตก> apps/citywalk/public/sprites/hero --height 1.7 --fps walk=10,run=12,idle=4
```

- `--height` ความสูงจริงของตัวนั้น (เมตร) เกมย่อขยายให้พอดี
- `--name ชื่อเดิม=ชื่อใหม่` ถ้าชื่อท่าใน PixelLab ไม่ตรง
- โปรแกรมบอกว่าทิศไหนขาดและใช้ทิศไหนแทน

โฟลเดอร์ที่โปรแกรมอ่าน: `animations/<ท่า>/<ทิศ>/<ภาพ>.png` และ `rotations/<ทิศ>.png` (ทิศ: south, south-east, east, north-east, north, north-west, west, south-west)

## 3. บอกเกม

เพิ่มใน `apps/citywalk/public/assets.json`:

```json
"sprites": {
  "hero": "sprites/hero/sheet.json",
  "slime_fire": "sprites/slime_fire/sheet.json"
}
```

ชื่อด้านซ้าย: `hero` = ผู้เล่น หรือรหัสมอน (`slime_water` `slime_fire` `slime_giant` `slime_mini` `boss_tide_regent`)

หมายเหตุ: ภาพผู้เล่นจากไฟล์ไม่เปลี่ยนตามหน้าตาที่เลือกในหน้าสร้างตัวละคร (ต้องทำภาพแยกต่อแบบ)

## 4. ตรวจ

`pnpm --filter @newgame/citywalk e2e` มีเทสต์ใส่ภาพจากไฟล์ (`e2e/sprites.spec.ts`) ถ้าภาพไม่ครบตามที่ไฟล์บอก เกมแจ้งใน console และกลับไปวาดเอง
