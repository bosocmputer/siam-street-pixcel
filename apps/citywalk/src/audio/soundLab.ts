import { SKILLS, SOUNDS, seeded, sound as soundSpec } from '@newgame/rpg-core';
import { TH } from '../th';
import { el } from '../ui/dom';
import { spectrogram } from './analyze';
import type { Sound } from './engine';
import { SOUND_GROUPS } from './groups';
import { renderSound } from './synth';

// A page for listening to every sound in the game, on its own, from the left, the middle or the
// right, with a picture of each one. It is how the creator judges the sounds by ear.

/** colour of a spectrogram cell, 0 (quiet) to 1 (loud) */
function heat(v: number): string {
  const stops: [number, number, number][] = [
    [13, 21, 32],
    [32, 60, 120],
    [30, 160, 190],
    [250, 220, 80],
    [255, 255, 255],
  ];
  const x = Math.max(0, Math.min(1, v)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  const f = x - i;
  const a = stops[i]!,
    b = stops[i + 1]!;
  return `rgb(${a.map((c, k) => Math.round(c + (b[k]! - c) * f)).join(',')})`;
}

function paint(canvas: HTMLCanvasElement, grid: number[][]): void {
  const cols = grid.length,
    rows = grid[0]!.length;
  canvas.width = cols * 2;
  canvas.height = rows * 2;
  const g = canvas.getContext('2d')!;
  for (let c = 0; c < cols; c++)
    for (let r = 0; r < rows; r++) {
      g.fillStyle = heat(grid[c]![r]!);
      g.fillRect(c * 2, (rows - 1 - r) * 2, 2, 2);
    }
}

/** how far the shot flies in the sequence played on this page, metres */
const SEQUENCE_REACH = 10;

/**
 * Play one skill's sounds one after another with the game's own timing (gathering as long as the
 * skill's charge, flying as long as the shot takes over 10 metres, then the hit on a slime), so it
 * can be judged the way it is heard in play rather than sound by sound.
 */
function playSequence(sound: Sound, element: string, pan: number): void {
  const spec = Object.values(SKILLS).find((s) => s.element === element);
  if (!spec) return;
  const fly = SEQUENCE_REACH / spec.speed;
  const later = (seconds: number, f: () => void) => window.setTimeout(f, seconds * 1000);
  sound.play(`${element}.gather`, { fit: spec.charge, pan });
  later(spec.charge, () => {
    sound.play(`${element}.release`, { pan });
    const roar = `${element}.flight` in SOUNDS ? sound.hold(`${element}.flight`, { pan }) : null;
    later(fly, () => {
      roar?.stop();
      sound.play(`${element}.impact`, { pan });
      sound.play('slime.hurt', { pan });
    });
  });
}

/**
 * Show the listening page over everything. `unlock` starts the sound maker (it is called inside a
 * tap); `onMute` is told when the player changes the on/off switch here, so the game's own button
 * can follow. Returns a function that closes the page.
 */
export function openLab(
  sound: Sound,
  hooks: { unlock: () => void; onClose: () => void; onChange: () => void },
): () => void {
  const page = el('div', 'lab');
  const top = el('div', 'lab-top');
  const back = el('button', 'lab-back', TH.lab.back);
  back.type = 'button';
  top.append(el('h2', '', TH.lab.title), back);
  const help = el('p', 'lab-help', TH.lab.help);

  const controls = el('div', 'lab-controls');
  const volume = document.createElement('input');
  volume.type = 'range';
  volume.min = '0';
  volume.max = '1';
  volume.step = '0.05';
  volume.value = String(sound.volume);
  volume.setAttribute('aria-label', TH.lab.volume);
  const volumeRow = el('label', '');
  volumeRow.append(el('span', '', TH.lab.volume), volume);
  const mute = el('button', 'lab-mute', TH.sound);
  mute.type = 'button';
  const where = el('div', 'lab-seg');
  let pan = 0;
  const choices: [string, number][] = [
    [TH.lab.left, -0.85],
    [TH.lab.middle, 0],
    [TH.lab.right, 0.85],
  ];
  const buttons = choices.map(([label, value]) => {
    const b = el('button', '', label);
    b.type = 'button';
    b.addEventListener('click', () => {
      pan = value;
      mark();
    });
    where.append(b);
    return { b, value };
  });
  const whereRow = el('div', 'lab-row');
  whereRow.append(el('span', '', TH.lab.where), where, mute);
  const note = el('div', 'lab-note');
  controls.append(volumeRow, whereRow, note);
  const mark = () => {
    for (const { b, value } of buttons) b.setAttribute('aria-pressed', String(value === pan));
    mute.setAttribute('aria-pressed', String(!sound.muted));
    mute.textContent = `${TH.sound} ${sound.muted ? TH.off : TH.on}`;
    note.textContent = sound.muted ? TH.lab.muted : '';
  };
  mark();

  volume.addEventListener('input', () => {
    sound.setVolume(Number(volume.value));
    hooks.onChange();
  });
  mute.addEventListener('click', () => {
    hooks.unlock();
    sound.setMuted(!sound.muted);
    mark();
    hooks.onChange();
  });

  page.append(top, help, controls);
  const canvases = new Map<string, HTMLCanvasElement>();
  for (const group of SOUND_GROUPS) {
    page.append(el('h3', '', TH.soundGroups[group.key] ?? group.key));
    if (Object.values(SKILLS).some((s) => s.element === group.key)) {
      const all = el('button', 'lab-play lab-seq', TH.lab.sequence);
      all.type = 'button';
      all.addEventListener('click', () => {
        hooks.unlock();
        playSequence(sound, group.key, pan);
      });
      page.append(all);
    }
    for (const id of group.ids) {
      const spec = soundSpec(id);
      const row = el('div', 'lab-item');
      const play = el('button', 'lab-play');
      play.type = 'button';
      const label = el('span', '', TH.sounds[id] ?? id);
      label.append(el('small', '', `${id} · ${TH.lab.seconds(spec.length)}`));
      play.append(label);
      play.addEventListener('click', () => {
        hooks.unlock();
        sound.play(id, { pan });
      });
      const canvas = el('canvas', 'lab-spec');
      canvases.set(id, canvas);
      row.append(play, canvas);
      page.append(row);
    }
  }
  document.body.append(page);

  // draw the pictures one by one so the page is usable straight away
  let closed = false;
  void (async () => {
    if (typeof OfflineAudioContext === 'undefined') {
      note.textContent = TH.lab.none;
      return;
    }
    for (const id of Object.keys(SOUNDS)) {
      if (closed) return;
      try {
        const buf = await renderSound(soundSpec(id), {}, seeded(1));
        const canvas = canvases.get(id);
        if (canvas) paint(canvas, spectrogram(buf.getChannelData(0), buf.sampleRate));
      } catch {
        // a picture that fails is only a missing picture
      }
      await new Promise((r) => setTimeout(r, 0));
    }
  })();

  const close = () => {
    closed = true;
    page.remove();
    hooks.onClose();
  };
  back.addEventListener('click', close);
  return close;
}
