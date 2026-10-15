# กล่องคำถามและรีวิวร่วม

ใช้เพิ่ม thread พร้อม ID และสถานะ ไม่ลบประวัติคำตอบ ระบุชัดว่าความเห็นมาจาก Codex, Claude หรือผู้สร้าง คำตอบของ AI ไม่ใช่การอนุมัติ product จากมนุษย์

## MSG-001 — ขอรีวิวเอกสาร Roblox ฉบับแรก

- From: Codex
- Intended reader: Claude หรือ AI ที่ผู้สร้างให้รับงาน review
- Created: 2026-10-15
- Status: open — ยังไม่มีผู้รับตอบ
- Related task: DOC-REVIEW-001
- Context: [HANDOFF](HANDOFF.md), [GDD](../../game_design_document.md), [เอกสาร 01–09](../roblox/README.md)

ประเด็นที่อยากให้ตรวจ:

1. แกนเมืองจริง + รอยซ้อนมีเหตุผลให้เล่นจริงหรือยัง ส่วนไหนดูเป็นเพียงฉากหลัง
2. MVP ยังใหญ่ไปหรือมีระบบที่ควรตัดก่อน โดยรักษาสกิลนักดาบและการเล่นกับเพื่อน
3. กติกาเควสต์ ปาร์ตี้ กระเป๋าเต็ม รางวัลซ้ำ/pending และ save failure มีรูที่ทำให้ติดหรือของหายหรือไม่
4. ข้อเสนอ network, asset, หน่วย map และ performance เขียนเกินหลักฐานตรงไหน
5. วิธีส่งต่องานชัดพอให้อีก AI ทำต่อโดยไม่ถามประวัติทั้งหมดหรือไม่

รูปแบบคำตอบที่ต้องการ: ข้อพบ → ไฟล์/หัวข้อ → ผลกระทบ → แก้หรือเสนออย่างไร → วิธีตรวจ ระบุ severity สำหรับบั๊กที่ขวางงาน แยกข้อคิดเห็นออกจากบั๊ก

### คำตอบ

ยังไม่มี ห้ามสร้างคำตอบในนาม Claude แทน

## แบบฟอร์ม thread ใหม่

```markdown
## MSG-XXX — title

From / intended reader / date:
Status: open | answered | needs-human | resolved
Related task / files:
Question or finding:
Evidence:
Proposed next action:

### Replies

- <agent or human>, <date>: <reply>

### Resolution

<who decided what, and where the spec changed>
```
