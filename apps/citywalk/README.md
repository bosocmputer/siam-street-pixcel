# เดินเมืองเก่าเชียงใหม่ (แผนที่ทดสอบ)

ต้นแบบ 3D สำหรับเกมใหม่: เดินในคูเมืองเชียงใหม่และรอบนอก เพื่อดูว่าคนจำเมืองได้ไหม ยังไม่มีเนื้อเรื่องหรือการต่อสู้

- ข้อมูล: OpenStreetMap ดึงด้วย `tools/fetch_osm.sh` แปลงด้วย `pnpm data` (`tools/osm_to_world.py`) ได้ `public/world.json`
- เครดิตที่ต้องแสดง: © OpenStreetMap contributors (ODbL)
- รัน: `pnpm dev` · เทสต์: `pnpm test` และ `pnpm e2e` (`?debug=1` เปิด `window.__walk` ให้เทสต์)
- ประตูท่าแพ: โมเดลของผู้สร้าง `public/models/thaphae_gate.glb` ปรับแค่ตำแหน่ง ทิศ และขนาดให้เข้ากับช่องกำแพงในแผนที่ (`src/gateModel.ts`)
- ลานท่าแพ: สร้างด้วยโค้ดจากข้อมูลแผนที่ (`src/plaza.ts`, `src/plazaShape.ts`) วิ่งระหว่างปลายคูน้ำสองข้างและยื่นถึงขอบถนน มีขอบหิน ทางเท้า และทางม้าลาย
- สไลม์: โมเดลของผู้สร้าง `public/models/slime_aquanaut.glb` ใช้ท่าทางในไฟล์ (Idle, Jumping, Squishing, Attacking) สมองอยู่ที่ `src/slimeBrain.ts` เคลื่อนที่เฉพาะตอนลอยกลางอากาศ
- วัดและศาสนสถานเป็นฉากหลังเท่านั้น ไม่มีการต่อสู้
