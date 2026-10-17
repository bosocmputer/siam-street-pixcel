// Check a character .glb from the modelling AI against the rig, and print what to fix in Thai.
//
//   pnpm --filter @newgame/rpg-core check-model path/to/Character_Base.glb

import { readFileSync } from 'node:fs';
import { checkRig, glbFacts } from '../src/index';

const file = process.argv[2];
if (!file) {
  console.error('usage: check-model <file.glb>');
  process.exit(2);
}
const facts = glbFacts(new Uint8Array(readFileSync(file)));
console.log(`ไฟล์ ${file}`);
console.log(
  `สูง ${facts.maxY.toFixed(3)} ม. · ต่ำสุด y ${facts.minY.toFixed(3)} · ${facts.triangles} สามเหลี่ยม · ` +
    `${facts.materials} วัสดุ · ${Math.round(facts.fileKB)} KB · ${facts.nodes.length} โหนด`,
);
const issues = checkRig(facts);
if (issues.length === 0) {
  console.log('ผ่านทุกข้อ ✓');
} else {
  console.log(`ต้องแก้ ${issues.length} ข้อ (ส่งรายการนี้ให้ Gemini ได้เลย):`);
  for (const i of issues) console.log(`- ${i.th}`);
  process.exitCode = 1;
}
