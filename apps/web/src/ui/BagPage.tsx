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

const RARITY_TEXT: Record<Rarity, string> = {
  common: 'muted',
  good: 'good',
  rare: 'rare',
  legend: 'amber',
};

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

  const [tab, setTab] = useState<'items' | 'mats' | 'sets'>('items');
  const [selUid, setSelUid] = useState<string | null>(null);
  const sel = items.find((i) => i.uid === selUid) ?? items[0] ?? null;

  return (
    <div className="page">
      <h1
        className="title-lg"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}
      >
        {t('nav.bag')}
        <span className="muted small num">
          {t('bag.capacity', { used: usedSlots(player), max: capacity(player, cfg) })}
        </span>
      </h1>
      <div className="seg" role="tablist">
        {(
          [
            ['items', t('bag.items')],
            ['mats', t('bag.materials')],
            ['sets', t('bag.presets')],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? 'on' : ''}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'items' && (
        <>
          {items.length === 0 ? (
            <p className="muted" style={{ padding: '8px 12px' }}>
              {t('bag.noItems')}
            </p>
          ) : (
            <div className="grid4">
              {items.map((it) => (
                <button
                  key={it.uid}
                  className={`tile ${RARITY_CLASS[it.rarity]} ${sel?.uid === it.uid ? 'sel' : ''}`}
                  onClick={() => setSelUid(it.uid)}
                  aria-label={nm('items', it.defId)}
                >
                  <ItemIcon defId={it.defId} rarity={it.rarity} size={48} bare />
                  {equipped.has(it.uid) && <span className="eq">{t('bag.equipped')}</span>}
                </button>
              ))}
            </div>
          )}
          {sel &&
            (() => {
              const def = getItemDef(cfg, sel.defId);
              const on = equipped.has(sel.uid);
              const maxed = sel.upgrade >= cfg.balance.items.upgradeMax;
              const cost = upgradeCost(sel, cfg);
              return (
                <section className={`panel detail ${RARITY_CLASS[sel.rarity]}`}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div className={`slot ${RARITY_CLASS[sel.rarity]}`} style={{ margin: 6 }}>
                      <ItemIcon defId={sel.defId} rarity={sel.rarity} size={44} bare />
                    </div>
                    <div className="grow">
                      <strong
                        style={{ fontFamily: 'var(--font-hd)', fontWeight: 500, fontSize: 17 }}
                      >
                        {nm('items', sel.defId)}{' '}
                        {sel.upgrade > 0 && <em className="bonus">+{sel.upgrade}</em>}
                      </strong>
                      <span className="small">
                        <span className={RARITY_TEXT[sel.rarity]}>
                          {nm('rarities', sel.rarity)}
                        </span>{' '}
                        · {nm('slots', def.slot)}
                        {on ? ` · ${t('bag.equipped')}` : ''}
                      </span>
                    </div>
                  </div>
                  <p className="small">{itemLines(sel).join(' · ')}</p>
                  {!maxed && (
                    <p className="muted small">
                      {t('bag.need')} {cost.coins} {t('common.coins', { n: '' }).trim()} ·{' '}
                      {nm('materials', 'jelly')} {cost.jelly} · {nm('materials', cost.material.id)}{' '}
                      {cost.material.qty}
                    </p>
                  )}
                  <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                    {on ? (
                      <button
                        className="btn"
                        style={{ flex: 1 }}
                        onClick={() =>
                          act(
                            { t: 'unequip', slot: def.slot },
                            t('bag.unequipDone', { name: nm('items', sel.defId) }),
                          )
                        }
                      >
                        {t('bag.unequip')}
                      </button>
                    ) : (
                      <button
                        className="btn primary"
                        style={{ flex: 2 }}
                        onClick={() =>
                          act(
                            { t: 'equipItem', uid: sel.uid },
                            t('bag.equipDone', { name: nm('items', sel.defId) }),
                          )
                        }
                      >
                        {t('bag.equip')}
                      </button>
                    )}
                    <button
                      className="btn"
                      style={{ flex: 1 }}
                      disabled={maxed}
                      onClick={() => act({ t: 'upgrade', uid: sel.uid }, t('bag.upgraded'))}
                    >
                      {maxed ? t('bag.maxed') : t('bag.upgrade', { n: sel.upgrade + 1 })}
                    </button>
                    {!on && (
                      <button className="btn danger" onClick={() => setConfirm(sel)}>
                        {t('bag.salvage')}
                      </button>
                    )}
                  </div>
                </section>
              );
            })()}
          <label className="auto-row" style={{ padding: '0 12px' }}>
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
            <button
              className="btn danger"
              style={{ margin: '0 12px' }}
              onClick={() => setBulk(true)}
            >
              {t('bag.bulk', { n: spare.length })}
            </button>
          )}
        </>
      )}

      {tab === 'sets' && (
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
                  className="btn small"
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
      )}

      {tab === 'mats' && (
        <Panel title={t('bag.materials')}>
          <ul className="mat-list">
            {['jelly', ...cfg.districts.map((d) => d.material)].map((id) => (
              <li key={id} className="mat">
                <MaterialIcon id={id} size={36} />
                <span className="grow">{nm('materials', id)}</span>
                <span className="num">{player.materials[id] ?? 0}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

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
