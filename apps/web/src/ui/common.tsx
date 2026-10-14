import type { ReactNode } from 'react';
import type { Rarity } from '@slimehood/game-core';
import { dataUrl, formCanvas, itemIcon, materialIcon, monsterCanvas, skillIcon } from '../art';
import { lookCanvas, slimeCanvas } from '../art';
import type { PlayerState } from '@slimehood/game-core';
import { nm, t } from '../i18n/t';

export function PixelImg({
  canvas,
  size,
  alt,
}: {
  canvas: HTMLCanvasElement;
  size: number;
  alt: string;
}) {
  return (
    <img
      className="px"
      src={dataUrl(canvas)}
      width={size}
      height={size}
      alt={alt}
      draggable={false}
    />
  );
}

export const SlimeSprite = ({ player, size = 96 }: { player: PlayerState; size?: number }) => (
  <PixelImg canvas={slimeCanvas(player)} size={size} alt={t('a11y.slime')} />
);
export const LookSprite = ({
  look,
  size = 96,
}: {
  look: { color: string; eyes: number };
  size?: number;
}) => <PixelImg canvas={lookCanvas(look)} size={size} alt={t('a11y.slime')} />;
export const FormSprite = ({ id, size = 64 }: { id: string; size?: number }) => (
  <PixelImg canvas={formCanvas(id)} size={size} alt={nm('forms', id)} />
);
export const MonsterSprite = ({ id, size = 48 }: { id: string; size?: number }) => (
  <PixelImg canvas={monsterCanvas(id)} size={size} alt={nm('monsters', id)} />
);
export const ItemIcon = ({
  defId,
  rarity,
  size = 44,
}: {
  defId: string;
  rarity: Rarity;
  size?: number;
}) => <PixelImg canvas={itemIcon(defId, rarity)} size={size} alt={nm('items', defId)} />;
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
  tone?: 'mint' | 'amber' | 'violet';
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
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div
      className="modal-back"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div className={`modal ${wide ? 'wide' : ''}`} onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">{title}</h2>
        {children}
      </div>
    </div>
  );
}

export const RARITY_CLASS: Record<Rarity, string> = {
  common: 'r-common',
  good: 'r-good',
  rare: 'r-rare',
  legend: 'r-legend',
};
