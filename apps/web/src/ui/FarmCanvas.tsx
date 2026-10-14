import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import type { PlayerState } from '@slimehood/game-core';
import { defaultConfig as cfg, getDistrict } from '@slimehood/game-core';
import { t } from '../i18n/t';
import { monsterCanvas, slimeCanvas, slimeSignature } from '../art';
import { FARM_H, FARM_W, FarmScene, type FarmView } from '../scenes/FarmScene';

export function buildView(player: PlayerState): FarmView {
  const district = getDistrict(cfg, player.farm.districtId);
  return {
    slime: slimeCanvas(player),
    slimeKey: `slime:${slimeSignature(player)}`,
    monsters: district.monsters.map((m) => ({ id: m.id, canvas: monsterCanvas(m.id) })),
    element: district.element,
  };
}

export function FarmCanvas({ player }: { player: PlayerState }) {
  const host = useRef<HTMLDivElement>(null);
  const game = useRef<Phaser.Game | null>(null);
  const scene = useRef(new FarmScene());

  useEffect(() => {
    if (!host.current) return;
    const s = scene.current;
    const g = new Phaser.Game({
      type: Phaser.CANVAS,
      parent: host.current,
      width: FARM_W,
      height: FARM_H,
      pixelArt: true,
      backgroundColor: '#10201d',
      banner: false,
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      scene: s,
    });
    game.current = g;
    return () => {
      g.destroy(true);
      game.current = null;
    };
  }, []);

  const sig = `${slimeSignature(player)}|${player.farm.districtId}`;
  useEffect(() => {
    scene.current.applyView(buildView(player));
  }, [sig]);

  return <div ref={host} className="farm-canvas" role="img" aria-label={t('a11y.fight')} />;
}
