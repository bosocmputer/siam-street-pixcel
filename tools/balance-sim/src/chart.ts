export interface Series {
  id: string;
  label: string;
  color: string;
  points: { day: number; value: number }[];
}

export interface ChartSpec {
  title: string;
  yLabel: string;
  series: Series[];
  yMax?: number;
  marks?: { day: number; label: string }[];
}

const W = 720;
const H = 300;
const M = { l: 48, r: 16, t: 16, b: 36 };

function niceMax(v: number): number {
  const steps = [10, 20, 30, 40, 50, 60, 80, 100, 120, 150, 200];
  return steps.find((s) => s >= v) ?? Math.ceil(v / 50) * 50;
}

function svgChart(spec: ChartSpec, days: number): string {
  const yMax =
    spec.yMax ?? niceMax(Math.max(...spec.series.flatMap((s) => s.points.map((p) => p.value)), 1));
  const x = (d: number) => M.l + (d / days) * (W - M.l - M.r);
  const y = (v: number) => H - M.b - (v / yMax) * (H - M.t - M.b);
  const grid: string[] = [];
  for (let i = 0; i <= 4; i++) {
    const v = (yMax / 4) * i;
    grid.push(
      `<line x1="${M.l}" x2="${W - M.r}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${M.l - 6}" y="${y(v) + 4}" class="tick" text-anchor="end">${Math.round(v)}</text>`,
    );
  }
  for (let d = 0; d <= days; d += 5) {
    grid.push(
      `<text x="${x(d)}" y="${H - M.b + 16}" class="tick" text-anchor="middle">${d}</text>`,
    );
  }
  const lines = spec.series
    .map((s) => {
      const pts = s.points.map((p) => `${x(p.day).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
      const last = s.points[s.points.length - 1];
      const end = last
        ? `<circle cx="${x(last.day)}" cy="${y(last.value)}" r="3.5" fill="${s.color}"/>`
        : '';
      return `<polyline points="${pts}" fill="none" stroke="${s.color}" stroke-width="2.2" stroke-linejoin="round"/>${end}`;
    })
    .join('');
  const marks = (spec.marks ?? [])
    .map(
      (m) =>
        `<line x1="${x(m.day)}" x2="${x(m.day)}" y1="${M.t}" y2="${H - M.b}" class="mark"/><text x="${x(m.day) + 4}" y="${M.t + 12}" class="marklabel">${m.label}</text>`,
    )
    .join('');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${spec.title}">${grid.join('')}${marks}${lines}<text x="${M.l}" y="12" class="ylabel">${spec.yLabel}</text><text x="${W - M.r}" y="${H - 4}" class="ylabel" text-anchor="end">วัน</text></svg>`;
}

export function renderReport(opts: {
  generatedOn: string;
  days: number;
  charts: ChartSpec[];
  targets: [string, string, boolean][];
  milestones: { label: string; rows: { profile: string; text: string }[] }[];
  lineRows: {
    label: string;
    level14: number;
    level30: number;
    cleared30: number;
    form: string;
    level60Day: string;
  }[];
  notes: string[];
}): string {
  const legend = (c: ChartSpec) =>
    c.series
      .map((s) => `<span class="key"><i style="background:${s.color}"></i>${s.label}</span>`)
      .join('');
  const targetRows = opts.targets
    .map(
      ([t, v, ok]) =>
        `<tr><td class="${ok ? 'ok' : 'miss'}">${ok ? 'ผ่าน' : 'ไม่ผ่าน'}</td><td>${t}</td><td>${v}</td></tr>`,
    )
    .join('');
  const msRows = opts.milestones
    .map(
      (m) =>
        `<tr><th scope="row">${m.label}</th>${m.rows.map((r) => `<td>${r.text}</td>`).join('')}</tr>`,
    )
    .join('');
  const lineTable = opts.lineRows
    .map(
      (r) =>
        `<tr><th scope="row">${r.label}</th><td>L${r.level14}</td><td>L${r.level30}</td><td>${r.cleared30}/120</td><td>${r.level60Day}</td><td>${r.form}</td></tr>`,
    )
    .join('');
  const profiles = opts.milestones[0]?.rows.map((r) => `<th>${r.profile}</th>`).join('') ?? '';
  return `<!doctype html>
<html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>กราฟความก้าวหน้า 30 วัน</title>
<style>
:root{--bg:#f6f7f4;--fg:#1d2a22;--muted:#5d6b62;--card:#fff;--line:#dde3dc;--ok:#1b7a3d;--miss:#b3261e;--c1:#1b7a3d;--c2:#c26a00;--c3:#6b4fbb}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#0f1a14;--fg:#e6ece7;--muted:#9bab9f;--card:#17261d;--line:#2a3d31;--ok:#5fd08a;--miss:#ff8a80;--c1:#5fd08a;--c2:#ffb454;--c3:#b9a2ff}}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.55 "Kanit","Sarabun",system-ui,sans-serif;padding:24px max(16px,env(safe-area-inset-left))}
main{max-width:820px;margin:0 auto}h1{font-size:1.5rem;margin:0 0 4px}h2{font-size:1.1rem;margin:28px 0 8px}
.sub{color:var(--muted);margin:0 0 20px}section{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px 16px;margin:12px 0}
svg{width:100%;height:auto;display:block}.grid{stroke:var(--line);stroke-width:1}.tick,.ylabel,.marklabel{fill:var(--muted);font-size:11px}.mark{stroke:var(--muted);stroke-dasharray:3 3}
.key{display:inline-flex;align-items:center;gap:6px;margin-right:14px;font-size:13px}.key i{width:14px;height:3px;border-radius:2px;display:inline-block}
table{border-collapse:collapse;width:100%;font-size:14px}td,th{padding:6px 8px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}.ok{color:var(--ok);font-weight:600;white-space:nowrap}.miss{color:var(--miss);font-weight:600;white-space:nowrap}
.scroll{overflow-x:auto}ul{margin:6px 0 0;padding-left:20px}li{margin:3px 0}
</style></head><body><main>
<h1>กราฟความก้าวหน้า 30 วัน</h1>
<p class="sub">ผลจำลองผู้เล่น 3 แบบ สร้างเมื่อ ${opts.generatedOn} · ตัวเลขเป็นค่าเริ่มต้นสำหรับทดสอบ ไม่ใช่ข้อมูลผู้เล่นจริง</p>
<h2>ผลเทียบเป้าหมายใน development_plan</h2>
<section class="scroll"><table><tbody>${targetRows}</tbody></table></section>
${opts.charts.map((c) => `<h2>${c.title}</h2><section><div>${legend(c)}</div>${svgChart(c, opts.days)}</section>`).join('\n')}
<h2>จุดสำคัญของแต่ละแบบผู้เล่น</h2>
<section class="scroll"><table><thead><tr><th></th>${profiles}</tr></thead><tbody>${msRows}</tbody></table></section>
<h2>เทียบสายธาตุ (ผู้เล่นปกติ เลือกสายตามย่านเรา)</h2>
<section class="scroll"><table><thead><tr><th>ย่านเรา</th><th>เวลวันที่ 14</th><th>เวลวันที่ 30</th><th>ด่านวันที่ 30</th><th>ถึงเวล 60</th><th>ร่างตอนวันที่ 30</th></tr></thead><tbody>${lineTable}</tbody></table></section>
<h2>ข้อสังเกต</h2><section><ul>${opts.notes.map((n) => `<li>${n}</li>`).join('')}</ul></section>
</main></body></html>`;
}
