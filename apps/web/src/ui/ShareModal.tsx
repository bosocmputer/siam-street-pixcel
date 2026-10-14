import { useEffect, useState } from 'react';
import { defaultConfig as cfg, getForm } from '@slimehood/game-core';
import { useGame } from '../game/store';
import { slimeCanvas } from '../art';
import { ctxOf, makeCanvas } from '../art/draw';
import { sceneCanvas } from '../art/scene';
import { nm, t } from '../i18n/t';
import { Modal } from './common';

const W = 540;
const H = 960;
const S = 6; // one art pixel = 6 card pixels

/** The share card is drawn right here from the saved game; nothing is sent anywhere. */
function drawCard(): HTMLCanvasElement {
  const player = useGame.getState().player!;
  const form = getForm(cfg, player.formId);
  const district =
    cfg.districts.find((d) => d.id === (player.homeDistrictId ?? player.farm.districtId)) ??
    cfg.districts[0]!;
  const c = makeCanvas(W, H);
  const g = ctxOf(c);
  g.drawImage(sceneCanvas(district.element, 135, 240, 13), 0, 0, W, H);
  const grad = g.createLinearGradient(0, H * 0.45, 0, H);
  grad.addColorStop(0, 'rgba(11,10,28,0)');
  grad.addColorStop(1, 'rgba(11,10,28,0.94)');
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  g.textAlign = 'center';
  g.fillStyle = '#ffb84d';
  g.font = '700 26px "Pixelify Sans", monospace';
  g.fillText(t('app.brand').split('').join(' '), W / 2, 64);
  // the slime, standing on the street (feet at row 33 of its 48x48 canvas)
  const size = 48 * S;
  g.drawImage(slimeCanvas(player), W / 2 - size / 2, 520 - (33 / 48) * size, size, size);
  g.fillStyle = '#f6f0e4';
  g.font = '500 64px Mitr, Sarabun, sans-serif';
  g.fillText(player.name || t('slime.unnamed'), W / 2, 690);
  g.fillStyle = '#e8e2f6';
  g.font = '500 30px Sarabun, sans-serif';
  g.fillText(
    [
      nm('forms', form.id),
      form.element ? t('home.element', { name: nm('elements', form.element) }) : '',
      t('common.level', { n: player.level }),
    ]
      .filter(Boolean)
      .join(' · '),
    W / 2,
    742,
  );
  const cleared = Object.values(player.progress).reduce((a, b) => a + b, 0);
  const seen = Object.keys(player.bestiary).length;
  const chips: [string, boolean][] = [];
  if (player.homeDistrictId) chips.push([nm('districts', player.homeDistrictId), true]);
  chips.push([t('share.stages', { n: cleared }), false]);
  chips.push([t('share.mons', { have: seen, total: cfg.monsters.length }), false]);
  g.font = '700 26px Sarabun, sans-serif';
  const widths = chips.map(([txt]) => g.measureText(txt).width + 36);
  let x = W / 2 - (widths.reduce((a, b) => a + b, 0) + (chips.length - 1) * 12) / 2;
  chips.forEach(([txt, hot], i) => {
    const w = widths[i]!;
    g.fillStyle = hot ? '#ffb84d' : '#1b1838';
    g.fillRect(x, 780, w, 46);
    g.strokeStyle = hot ? '#5a3000' : '#4a4280';
    g.lineWidth = 4;
    g.strokeRect(x, 780, w, 46);
    g.fillStyle = hot ? '#2b1700' : '#f6f0e4';
    g.fillText(txt, x + w / 2, 812);
    x += w + 12;
  });
  g.fillStyle = '#aaa4c9';
  g.font = '500 24px Sarabun, sans-serif';
  g.fillText(t('app.name'), W / 2, 902);
  return c;
}

export function ShareModal({ onClose }: { onClose: () => void }) {
  const toast = useGame((s) => s.toast);
  const [url, setUrl] = useState('');
  const [card, setCard] = useState<HTMLCanvasElement | null>(null);

  useEffect(() => {
    // wait for the fonts so the name is drawn in the game's font
    let alive = true;
    void (async () => {
      try {
        await document.fonts?.ready;
      } catch {
        /* fall back to system fonts */
      }
      if (!alive) return;
      const c = drawCard();
      setCard(c);
      setUrl(c.toDataURL('image/png'));
    })();
    return () => {
      alive = false;
    };
  }, []);

  const blob = (): Promise<Blob | null> =>
    new Promise((resolve) => (card ? card.toBlob((b) => resolve(b), 'image/png') : resolve(null)));

  const save = async () => {
    const b = await blob();
    if (!b) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = 'slime-card.png';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast(t('share.saved'), 'good');
  };

  const share = async () => {
    const b = await blob();
    const player = useGame.getState().player!;
    if (!b) return;
    const file = new File([b], 'slime-card.png', { type: 'image/png' });
    const data = {
      files: [file],
      text: t('share.text', { name: player.name || t('slime.unnamed'), level: player.level }),
    };
    try {
      if (navigator.canShare?.(data)) {
        await navigator.share(data);
        toast(t('share.shared'), 'good');
      } else {
        await save();
      }
    } catch (e) {
      // closing the share sheet is not an error
      if ((e as DOMException).name !== 'AbortError') toast(t('share.failed'), 'bad');
    }
  };

  return (
    <Modal title={t('share.title')} onClose={onClose}>
      <div className="scard-wrap">
        {url ? <img className="scard-img" src={url} alt={t('share.title')} /> : null}
      </div>
      <button
        className="btn primary"
        style={{ width: 'calc(100% - 8px)' }}
        onClick={share}
        disabled={!card}
      >
        {t('share.share')}
      </button>
      <div style={{ display: 'flex' }}>
        <button className="btn" style={{ flex: 1 }} onClick={save} disabled={!card}>
          {t('share.save')}
        </button>
        <button className="btn" style={{ flex: 1 }} onClick={onClose}>
          {t('share.close')}
        </button>
      </div>
      <p className="muted small" style={{ textAlign: 'center' }}>
        {t('share.note')}
      </p>
    </Modal>
  );
}
