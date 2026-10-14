import type { ReactNode } from 'react';
import type { Rarity } from '@slimehood/game-core';
import {
  basketCanvas,
  dataUrl,
  formCanvas,
  itemIcon,
  materialIcon,
  monsterCanvas,
  skillIcon,
} from '../art';
import { coinIcon, heartIcon, statIcon, tabIcon, type TabName } from '../art/ui';
import { lookCanvas, slimeCanvas } from '../art';
import type { PlayerState } from '@slimehood/game-core';
import { nm, t } from '../i18n/t';

/**
 * A sprite canvas. The 48x48 sprite sheets leave a lot of empty room around the art, so small icons use
 * `zoom` to show only the middle part at a larger scale (zoom 2 = the middle 24x24 pixels).
 */
export function PixelImg({
  canvas,
  size,
  alt,
  zoom = 1,
}: {
  canvas: HTMLCanvasElement;
  size: number;
  alt: string;
  zoom?: number;
}) {
  const img = (
    <img
      className="px"
      src={dataUrl(canvas)}
      width={size * zoom}
      height={size * zoom}
      alt={alt}
      draggable={false}
      style={
        zoom > 1
          ? { marginLeft: -(size * (zoom - 1)) / 2, marginTop: -(size * (zoom - 1)) / 2 }
          : undefined
      }
    />
  );
  if (zoom <= 1) return img;
  return (
    <span className="crop" style={{ width: size, height: size }}>
      {img}
    </span>
  );
}

const smallZoom = (size: number) => (size <= 80 ? 2 : 1);

export const SlimeSprite = ({ player, size = 96 }: { player: PlayerState; size?: number }) => (
  <PixelImg canvas={slimeCanvas(player)} size={size} alt={t('a11y.slime')} zoom={smallZoom(size)} />
);
export const LookSprite = ({
  look,
  size = 96,
}: {
  look: { color: string; eyes: number };
  size?: number;
}) => (
  <PixelImg canvas={lookCanvas(look)} size={size} alt={t('a11y.slime')} zoom={smallZoom(size)} />
);
export const FormSprite = ({
  id,
  size = 64,
  color,
}: {
  id: string;
  size?: number;
  /** the player's body colour, so the preview matches their slime */
  color?: string;
}) => (
  <PixelImg
    canvas={formCanvas(id, color)}
    size={size}
    alt={nm('forms', id)}
    zoom={size <= 80 ? 2 : 1}
  />
);
export const MonsterSprite = ({ id, size = 48 }: { id: string; size?: number }) => (
  <PixelImg
    canvas={monsterCanvas(id)}
    size={size}
    alt={nm('monsters', id)}
    zoom={smallZoom(size)}
  />
);
export const ItemIcon = ({
  defId,
  rarity,
  size = 44,
  bare = false,
}: {
  defId: string;
  rarity: Rarity;
  size?: number;
  /** no frame of its own: the slot or tile around it already shows the rarity */
  bare?: boolean;
}) => <PixelImg canvas={itemIcon(defId, rarity, !bare)} size={size} alt={nm('items', defId)} />;
export const SkillIcon = ({ id, size = 44 }: { id: string; size?: number }) => (
  <PixelImg canvas={skillIcon(id)} size={size} alt={nm('skills', id)} />
);
export const MaterialIcon = ({ id, size = 32 }: { id: string; size?: number }) => (
  <PixelImg canvas={materialIcon(id)} size={size} alt={nm('materials', id)} />
);

export function Panel({
  title,
  children,
  aside,
  className = '',
}: {
  title?: string;
  children: ReactNode;
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      {(title || aside) && (
        <header className="panel-head">
          {title && <h2>{title}</h2>}
          {aside && <div className="panel-aside">{aside}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function Bar({
  value,
  max,
  label,
  tone = 'mint',
}: {
  value: number;
  max: number;
  label?: string;
  tone?: 'mint' | 'amber' | 'violet' | 'red';
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div
      className="bar"
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={Math.round(max)}
      aria-label={label}
    >
      <div className={`bar-fill ${tone}`} style={{ width: `${pct}%` }} />
      {label && <span className="bar-label">{label}</span>}
    </div>
  );
}

export function Modal({
  title,
  children,
  onClose,
  wide,
  centered,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  centered?: boolean;
}) {
  void wide;
  return (
    <div
      className={`modal-back ${centered ? 'center' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div className={`modal ${centered ? 'centered' : ''}`} onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">{title}</h2>
        {children}
      </div>
    </div>
  );
}

export const TabImg = ({ name, on }: { name: TabName; on: boolean }) => (
  <PixelImg canvas={tabIcon(name, on)} size={30} alt="" />
);
export const CoinImg = ({ size = 18 }: { size?: number }) => (
  <PixelImg canvas={coinIcon()} size={size} alt="" />
);
export const HeartImg = ({ size = 24 }: { size?: number }) => (
  <PixelImg canvas={heartIcon()} size={size} alt="" />
);
export const StatImg = ({
  stat,
  size = 28,
}: {
  stat: 'str' | 'agi' | 'vit' | 'int';
  size?: number;
}) => <PixelImg canvas={statIcon(stat)} size={size} alt="" />;
export const BasketImg = ({ fill = 0, size = 76 }: { fill?: number; size?: number }) => (
  <PixelImg canvas={basketCanvas(fill)} size={size} alt="" />
);

export const RARITY_CLASS: Record<Rarity, string> = {
  common: 'r-common',
  good: 'r-good',
  rare: 'r-rare',
  legend: 'r-legend',
};
