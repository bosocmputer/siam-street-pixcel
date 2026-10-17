# ข้อมูลแผนที่เชียงใหม่

- `chiangmai.overpassql` คำสั่งดึงข้อมูลจาก OpenStreetMap: เมืองเก่า ท่าแพ ริมปิง กาดหลวง นิมมาน
  (กรอบ lat 18.775–18.805, lon 98.960–99.010)
- `chiangmai_osm.json` ผลที่ได้ (ดาวน์โหลดบนเครื่องผู้สร้าง เพราะคลาวด์ต่อ overpass-api.de ไม่ได้)

ข้อมูล © OpenStreetMap contributors, สัญญา ODbL https://www.openstreetmap.org/copyright
ต้องแสดงเครดิตนี้ในเกม

ดาวน์โหลดใหม่ (รันที่โฟลเดอร์หลักของ repo):

```
curl -sS --data-urlencode "data@newgame/data/chiangmai.overpassql" https://overpass-api.de/api/interpreter -o newgame/data/chiangmai_osm.json
```
