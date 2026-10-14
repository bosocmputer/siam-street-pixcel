import Phaser from 'phaser';
import { W, H } from './config';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { FightScene } from './scenes/FightScene';
import { ResultScene } from './scenes/ResultScene';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: W,
  height: H,
  backgroundColor: '#0e1a14',
  pixelArt: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [BootScene, TitleScene, FightScene, ResultScene],
});

// Exposed for browser-driven smoke tests.
(window as unknown as { __game: Phaser.Game }).__game = game;
