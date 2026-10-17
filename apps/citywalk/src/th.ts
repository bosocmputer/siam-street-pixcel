// Every Thai string the walker sees, in one place.
export const TH = {
  title: 'เดินเมืองเก่าเชียงใหม่',
  intro: 'แผนที่ทดสอบ: ในคูเมืองและรอบนอก ย่อจากข้อมูลจริง ลองเดินแล้วดูว่าจำได้ไหม',
  howDesktop:
    'คอม: W A S D หรือปุ่มลูกศรเพื่อเดิน · ลากเมาส์เพื่อหมุนกล้อง · 1 2 3 เปลี่ยนการเดิน · คลิกสไลม์หรือกด Tab เพื่อเล็ง · Q กระสุนไฟ · E กระสุนน้ำ',
  howTouch:
    'มือถือ: ลากวงกลมมุมซ้ายล่าง (หรือที่ไหนก็ได้ครึ่งซ้ายของจอ) เพื่อเดิน · ลากครึ่งขวาเพื่อหมุนกล้อง · แตะสไลม์เพื่อเล็ง แล้วกดปุ่มไฟหรือน้ำ',
  start: 'เริ่มเดิน',
  resume: 'เดินต่อจากเดิม',
  restart: 'เริ่มใหม่ที่ประตูท่าแพ',
  stickHint: 'ลากเพื่อเดิน',
  loading: 'กำลังโหลดแผนที่…',
  loadingStep: (done: number, total: number) => `กำลังโหลดแผนที่… ${done}/${total}`,
  loadFailed: 'โหลดแผนที่ไม่สำเร็จ ลองรีเฟรชหน้านี้',
  modes: { walk: 'เดิน', run: 'วิ่ง', bike: 'มอไซค์' },
  scale: 'ขนาดเมือง',
  labels: 'ป้ายชื่อ',
  haze: 'หมอก',
  on: 'เปิด',
  off: 'ปิด',
  near: (name: string, m: number) => `${name} · ${m} ม.`,
  arrived: (name: string) => `ถึงแล้ว: ${name}`,
  lap: (min: number) => `รอบคูเมืองด้วยความเร็วนี้ ≈ ${min} นาที`,
  credit: '© OpenStreetMap contributors',
  skills: { fire: 'กระสุนไฟ', water: 'กระสุนน้ำ' },
  melted: 'ละลาย!',
} as const;
