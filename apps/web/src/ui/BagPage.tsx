import { useState } from 'react';
import {
  ELEMENTS,
  RARITIES,
  capacity,
  defaultConfig as cfg,
  getItemDef,
  scaledBonus,
  itemScale,
  upgradeCost,
  usedSlots,
  type ItemInstance,
  type PlayerState,
  type Rarity,
} from '@slimehood/game-core';
import { useGame } from '../game/store';
import { nm, t } from '../i18n/t';
import { ItemIcon, MaterialIcon, Modal, Panel, RARITY_CLASS } from './common';

export function itemLines(inst: ItemInstance): string[] {
  const def = getItemDef(cfg, inst.defId);
  const b = scaledBonus(inst, cfg);
  const k = itemScale(inst, cfg);
  const r = (n: number) => Math.round(n * 10) / 10;
  const out: string[] = [];
  if (b.atk) out.push(t('bag.bonusAtk', { n: r(b.atk) }));
  if (b.def) out.push(t('bag.bonusDef', { n: r(b.def) }));
  if (b.hp) out.push(t('bag.bonusHp', { n: r(b.hp) }));
  for (const s of ['str', 'agi', 'vit', 'int'] as const) {
    const v = b[s];
    if (v) out.push(t('bag.bonusStat', { stat: nm('stats', s), n: r(v) }));
  }
  for (const e of ELEMENTS) {
    const v = def.resist?.[e];
    if (v) out.push(t('bag.resist', { el: nm('elements', e), n: Math.round(v * k * 100) }));
  }
  const rates: [keyof NonNullable<typeof def.rates>, string][] = [
    ['coin', 'bag.rateCoin'],
    ['exp', 'bag.rateExp'],
    ['drop', 'bag.rateDrop'],
    ['core', 'bag.rateCore'],
    ['crit', 'bag.rateCrit'],
  ];
  for (const [key, label] of rates) {
    const v = def.rates?.[key];
    if (v) out.push(t('bag.rate', { what: t(label), n: Math.round(v * k * 100) }));
  }
  if (def.style) out.push(t(`bag.style${def.style[0]!.toUpperCase()}${def.style.slice(1)}`));
  return out;
}

const SLOT_ORDER = ['weapon', 'head', 'skin', 'charm'] as const;

export function BagPage() {
  const player = useGame((s) => s.player)!;
  const dispatch = useGame((s) => s.dispatch);
  const toast = useGame((s) => s.toast);
  const [confirm, setConfirm] = useState<ItemInstance | null>(null);
  const [bulk, setBulk] = useState(false);
  const equipped = new Set(Object.values(player.equipment));
  const items = [...player.items].sort(
    (a, b) =>
      SLOT_ORDER.indexOf(getItemDef(cfg, a.defId).slot) -
        SLOT_ORDER.indexOf(getItemDef(cfg, b.defId).slot) ||
      RARITIES.indexOf(b.rarity) - RARITIES.indexOf(a.rarity) ||
      b.upgrade - a.upgrade,
  );

  const spare = items.filter((i) => !equipped.has(i.uid) && RARITIES.indexOf(i.rarity) <= 1);

  const act = async (a: Parameters<typeof dispatch>[0], ok: string) => {
    const r = await dispatch(a);
    if (r.ok) toast(ok, 'good');
    else if (r.reason === 'noCoins') toast(t('bag.noCoins'), 'bad');
    else if (r.reason === 'noJelly') toast(t('bag.noJelly'), 'bad');
    else if (r.reason === 'noMaterial') toast(t('bag.noMaterial'), 'bad');
    else toast(t('toast.error'), 'bad');
  };

  return (
    <div className="page">
      <Panel
        title={t('bag.items')}
        aside={
          <span className="muted small">
            {t('bag.capacity', { used: usedSlots(player), max: capacity(player, cfg) })}
          </span>
        }
      >
        <label className="auto-row">
          <span>{t('bag.autoSalvage')}</span>
          <select
            value={player.autoSalvageBelow ?? ''}
            onChange={(e) =>
              dispatch({ t: 'autoSalvage', below: (e.target.value || null) as Rarity | null })
            }
          >
            <option value="">{t('bag.autoOff')}</option>
            {RARITIES.slice(1).map((r) => (
              <option key={r} value={r}>
                {t('bag.autoBelow', { rarity: nm('rarities', r) })}
              </option>
            ))}
          </select>
        </label>
        {spare.length > 0 && (
          <button className="btn danger" onClick={() => setBulk(true)}>
            {t('bag.bulk', { n: spare.length })}
          </button>
        )}
        {items.length === 0 ? (
          <p className="muted">{t('bag.noItems')}</p>
        ) : (
          <ul className="item-list">
            {items.map((it) => {
              const def = getItemDef(cfg, it.defId);
              const on = equipped.has(it.uid);
              const maxed = it.upgrade >= cfg.balance.items.upgradeMax;
              const cost = upgradeCost(it, cfg);
              return (
                <li
                  key={it.uid}
                  className={`item-card ${RARITY_CLASS[it.rarity]} ${on ? 'on' : ''}`}
                >
                  <ItemIcon defId={it.defId} rarity={it.rarity} size={56} />
                  <div className="grow">
                    <strong>
                      {nm('items', it.defId)}{' '}
                      {it.upgrade > 0 && <em className="bonus">+{it.upgrade}</em>}
                    </strong>
                    <span className="muted small">
                      {nm('rarities', it.rarity)} · {nm('slots', def.slot)}
                      {on ? ` · ${t('bag.equipped')}` : ''}
                    </span>
                    <span className="small">{itemLines(it).join(' · ')}</span>
                    {!maxed && (
                      <span className="muted small">
                        {t('bag.need')} {cost.coins} {t('common.coins', { n: '' }).trim()} ·{' '}
                        {nm('materials', 'jelly')} {cost.jelly} ·{' '}
                        {nm('materials', cost.material.id)} {cost.material.qty}
                      </span>
                    )}
                  </div>
                  <div className="item-btns">
                    {on ? (
                      <button
                        className="btn small"
                        onClick={() => act({ t: 'unequip', slot: def.slot }, t('bag.unequip'))}
                      >
                        {t('bag.unequip')}
                      </button>
                    ) : (
                      <button
                        className="btn small primary"
                        onClick={() => act({ t: 'equipItem', uid: it.uid }, t('bag.equip'))}
                      >
                        {t('bag.equip')}
                      </button>
                    )}
                    <button
                      className="btn small"
                      disabled={maxed}
                      onClick={() => act({ t: 'upgrade', uid: it.uid }, t('bag.upgraded'))}
                    >
                      {maxed ? t('bag.maxed') : t('bag.upgrade', { n: it.upgrade + 1 })}
                    </button>
                    {!on && (
                      <button className="btn small danger" onClick={() => setConfirm(it)}>
                        {t('bag.salvage')}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel title={t('bag.presets')}>
        <ul className="preset-list">
          {player.presets.map((p, i) => (
            <li key={i} className="preset-row">
              <strong>{t('bag.presetName', { n: i + 1 })}</strong>
              <span className="muted small grow">
                {p ? presetSummary(player, i) : t('bag.presetEmpty')}
              </span>
              <button
                className="btn small"
                onClick={() =>
                  act({ t: 'savePreset', index: i }, t('bag.presetSaved', { n: i + 1 }))
                }
              >
                {t('bag.presetSave')}
              </button>
              <button
                className="btn small primary"
                disabled={!p}
                onClick={() =>
                  act({ t: 'applyPreset', index: i }, t('bag.presetApplied', { n: i + 1 }))
                }
              >
                {t('bag.presetUse')}
              </button>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title={t('bag.materials')}>
        <ul className="mat-list">
          {['jelly', ...cfg.districts.map((d) => d.material)].map((id) => (
            <li key={id} className="mat">
              <MaterialIcon id={id} size={36} />
              <span>{nm('materials', id)}</span>
              <span className="num">{player.materials[id] ?? 0}</span>
            </li>
          ))}
        </ul>
      </Panel>

      {bulk && (
        <Modal title={t('bag.bulk', { n: spare.length })} onClose={() => setBulk(false)}>
          <p className="muted">{t('bag.bulkNote')}</p>
          <div className="row">
            <button className="btn" onClick={() => setBulk(false)}>
              {t('common.cancel')}
            </button>
            <button
              className="btn danger"
              onClick={async () => {
                const r = await dispatch({ t: 'salvage', uids: spare.map((i) => i.uid) });
                if (r.ok)
                  toast(t('bag.salvaged', r.info as { jelly: number; coins: number }), 'good');
                else toast(t('toast.error'), 'bad');
                setBulk(false);
              }}
            >
              {t('bag.salvage')}
            </button>
          </div>
        </Modal>
      )}

      {confirm && (
        <Modal title={t('bag.salvage')} onClose={() => setConfirm(null)}>
          <p>
            {nm('items', confirm.defId)} ({nm('rarities', confirm.rarity)})
          </p>
          <div className="row">
            <button className="btn" onClick={() => setConfirm(null)}>
              {t('common.cancel')}
            </button>
            <button
              className="btn danger"
              onClick={async () => {
                const r = await dispatch({ t: 'salvage', uids: [confirm.uid] });
                if (r.ok) {
                  const info = r.info as { jelly: number; coins: number };
                  toast(t('bag.salvaged', info), 'good');
                } else toast(t('toast.error'), 'bad');
                setConfirm(null);
              }}
            >
              {t('bag.salvage')}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function presetSummary(player: PlayerState, i: number): string {
  const p = player.presets[i];
  if (!p) return '';
  const skills = [...p.activeSkills, ...p.passiveSkills].filter(Boolean).length;
  const gear = Object.keys(p.equipment).length;
  return t('bag.presetSummary', { s: skills, g: gear });
}
