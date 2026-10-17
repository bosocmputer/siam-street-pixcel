# เดินเมืองเก่าเชียงใหม่ (แผนที่ทดสอบ)

ต้นแบบ 3D สำหรับเกมใหม่: เดินในคูเมืองเชียงใหม่และรอบนอก เพื่อดูว่าคนจำเมืองได้ไหม ยังไม่มีเนื้อเรื่องหรือการต่อสู้

- ข้อมูล: OpenStreetMap ดึงด้วย `tools/fetch_osm.sh` แปลงด้วย `pnpm data` (`tools/osm_to_world.py`) ได้ `public/world.json`
- เครดิตที่ต้องแสดง: © OpenStreetMap contributors (ODbL)
- รัน: `pnpm dev` · เทสต์: `pnpm test` และ `pnpm e2e` (`?debug=1` เปิด `window.__walk` ให้เทสต์)
- วัดและศาสนสถานเป็นฉากหลังเท่านั้น ไม่มีการต่อสู้
