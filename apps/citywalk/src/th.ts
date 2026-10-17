// Every Thai string the walker sees, in one place.
export const TH = {
  title: 'เดินเมืองเก่าเชียงใหม่',
  intro: 'แผนที่ทดสอบ: ในคูเมืองและรอบนอก ย่อจากข้อมูลจริง ลองเดินแล้วดูว่าจำได้ไหม',
  howDesktop: 'คอม: W A S D หรือปุ่มลูกศรเพื่อเดิน · ลากเมาส์เพื่อหมุนกล้อง · 1 2 3 เปลี่ยนการเดิน',
  howTouch:
    'มือถือ: ลากวงกลมมุมซ้ายล่าง (หรือที่ไหนก็ได้ครึ่งซ้ายของจอ) เพื่อเดิน · ลากครึ่งขวาเพื่อหมุนกล้อง',
  start: 'เริ่มเดิน',
  stickHint: 'ลากเพื่อเดิน',
  loading: 'กำลังโหลดแผนที่…',
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
  probe: (frames: number, f: string, r: string, x: number, z: number, err: string) =>
    `ทดสอบ · เฟรม ${frames} · นิ้ว ${f}, ${r} · ตำแหน่ง ${x}, ${z}${err ? ` · ${err}` : ''}`,
} as const;
