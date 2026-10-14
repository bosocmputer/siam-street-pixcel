import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import type { PlayerState } from '@slimehood/game-core';
import { computeDerived, defaultConfig as cfg, getDistrict } from '@slimehood/game-core';
import { t } from '../i18n/t';
import { hasMonsterArt, monsterCanvas, slimeCanvas, slimeSignature } from '../art';
import { sceneCanvas } from '../art/scene';
import { FARM_H, FARM_W, FarmScene, type FarmView } from '../scenes/FarmScene';

export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function buildView(player: PlayerState): FarmView {
  const district = getDistrict(cfg, player.farm.districtId);
  return {
    slime: slimeCanvas(player),
    slimeKey: `slime:${slimeSignature(player)}`,
    // monsters with real art first: mixing real and placeholder art in one fight looks wrong
    monsters: (district.monsters.some((m) => hasMonsterArt(m.id))
      ? district.monsters.filter((m) => hasMonsterArt(m.id))
      : district.monsters
    ).map((m) => ({ id: m.id, canvas: monsterCanvas(m.id) })),
    element: district.element,
    scene: sceneCanvas(district.element, 130, 110),
    atk: Math.round(computeDerived(player, cfg).atk),
    reducedMotion: prefersReducedMotion(),
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
      backgroundColor: '#14102f',
      banner: false,
      scale: { mode: Phaser.Scale.ENVELOP, autoCenter: Phaser.Scale.CENTER_BOTH },
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
