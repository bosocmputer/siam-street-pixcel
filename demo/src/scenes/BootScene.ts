import Phaser from 'phaser';
import { makeMissingTextures } from '../textures';

interface Manifest {
  images?: Record<string, string>;
}

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    this.load.json('manifest', 'assets/manifest.json');
    this.load.once('filecomplete-json-manifest', () => {
      const m = this.cache.json.get('manifest') as Manifest | undefined;
      for (const [key, path] of Object.entries(m?.images ?? {})) {
        this.load.image(key, `assets/${path}`);
      }
    });
  }

  create(): void {
    makeMissingTextures(this);
    this.scene.start('Title');
  }
}
