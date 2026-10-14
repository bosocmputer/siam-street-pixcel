import { useState } from 'react';
import {
  ELEMENTS,
  STAT_KEYS,
  computeDerived,
  defaultConfig as cfg,
  evolutionOptions,
  getForm,
  getSkill,
  type StatKey,
} from '@slimehood/game-core';
import { useGame } from '../game/store';
import { dataUrl } from '../art';
import { sceneCanvas } from '../art/scene';
import { nm, t } from '../i18n/t';
import { FormSprite, ItemIcon, Modal, Panel, SkillIcon, SlimeSprite, StatImg } from './common';
import { ShareModal } from './ShareModal';

const STAT_DESC: Record<StatKey, string> = {
  str: 'slime.statStr',
  agi: 'slime.statAgi',
  vit: 'slime.statVit',
  int: 'slime.statInt',
};

const SLOTS = [
  { slot: 'head', cls: { left: 8, top: 36 } },
  { slot: 'skin', cls: { left: 8, top: 148 } },
  { slot: 'weapon', cls: { right: 8, top: 36 } },
  { slot: 'charm', cls: { right: 8, top: 148 } },
] as const;

export function SlimePage() {
  const player = useGame((s) => s.player)!;
  const dispatch = useGame((s) => s.dispatch);
  const toast = useGame((s) => s.toast);
  const setPage = useGame((s) => s.setPage);
  const [choose, setChoose] = useState(false);
  const [share, setShare] = useState(false);
  const d = computeDerived(player, cfg);
  const form = getForm(cfg, player.formId);
  const options = evolutionOptions(player, cfg);
  const next = cfg.forms.filter((f) => f.from === player.formId);
  const nextLevel = next[0]?.minLevel;
  const element = cfg.districts.find((x) => x.id === player.farm.districtId)?.element ?? 'earth';

  const add = async (stat: StatKey, amount: number) => {
    const r = await dispatch({ t: 'allocate', stat, amount: Math.min(amount, player.statPoints) });
    if (!r.ok) toast(t('toast.notEnough'), 'bad');
  };

  return (
    <div className="page">
      <div className="hero-stage">
        <img className="bg px" src={dataUrl(sceneCanvas(element, 130, 97, 11))} alt="" />
        <div className="glow" />
        <div className="hero-slime">
          <SlimeSprite player={player} size={240} />
        </div>
        {SLOTS.map(({ slot, cls }) => {
          const inst = player.items.find((i) => i.uid === player.equipment[slot]);
          return (
            <div key={slot} className="hero-slot" style={cls}>
              <button
                className={`slot ${inst ? `r-${inst.rarity}` : 'empty'}`}
                onClick={() => setPage('bag')}
                aria-label={`${nm('slots', slot)}: ${inst ? nm('items', inst.defId) : t('slime.noItem')}`}
              >
                {inst && <ItemIcon defId={inst.defId} rarity={inst.rarity} size={44} bare />}
                <span className="lb">{nm('slots', slot)}</span>
              </button>
            </div>
          );
        })}
      </div>

      <div className="hero-info">
        <div>
          <h1 className="title-lg">{player.name || t('slime.unnamed')}</h1>
          <p className="muted small">
            {nm('forms', form.id)}
            {form.element
              ? ` · ${t('home.element', { name: nm('elements', form.element) })}`
              : ''}{' '}
            · {t('common.level', { n: player.level })}
          </p>
        </div>
        <span style={{ display: 'flex', alignItems: 'center' }}>
          {player.statPoints > 0 && (
            <span className="chip hot">{t('slime.points', { n: player.statPoints })}</span>
          )}
          <button className="btn small" onClick={() => setShare(true)}>
            {t('slime.shareBtn')}
          </button>
        </span>
      </div>

      {options.length > 0 ? (
        <button className="nudge" onClick={() => setChoose(true)}>
          <SlimeSprite player={player} size={32} />
          <span>{t('slime.evolveBanner')}</span>
          <b>{t('slime.evolveGo')}</b>
        </button>
      ) : (
        <p className="muted small" style={{ padding: '0 12px' }}>
          {nextLevel ? t('slime.evolveAt', { level: nextLevel }) : t('slime.maxForm')}
        </p>
      )}

      <Panel
        title={t('slime.stats')}
        aside={
          <button className="btn small" onClick={() => dispatch({ t: 'resetStats' })}>
            {t('slime.reset')}
          </button>
        }
      >
        <ul>
          {STAT_KEYS.map((k) => {
            const bonus = d.stats[k] - player.stats[k];
            const pct = Math.min(100, (player.stats[k] / Math.max(10, player.level * 2)) * 100);
            return (
              <li key={k} className="stat">
                <StatImg stat={k} />
                <b>{nm('stats', k)}</b>
                <div>
                  <div className="bar">
                    <div className="bar-fill amber" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="d">
                    <span className="num">{player.stats[k]}</span>
                    {bonus > 0 && <em className="bonus"> +{Math.round(bonus * 10) / 10}</em>} ·{' '}
                    {t(STAT_DESC[k])}
                  </div>
                </div>
                <button
                  className="plus"
                  disabled={player.statPoints < 1}
                  onClick={() => add(k, 1)}
                  aria-label={`${nm('stats', k)} +1`}
                >
                  +
                </button>
              </li>
            );
          })}
        </ul>
        {player.statPoints >= 5 && (
          <div className="row" style={{ marginTop: 0 }}>
            {STAT_KEYS.map((k) => (
              <button
                key={k}
                className="btn small"
                onClick={() => add(k, 5)}
                aria-label={`${nm('stats', k)} +5`}
              >
                {nm('stats', k)} +5
              </button>
            ))}
          </div>
        )}
        <ul className="derived">
          <li>
            {t('slime.hp')} <span className="num">{Math.round(d.hp)}</span>
          </li>
          <li>
            {t('slime.atk')} <span className="num">{Math.round(d.atk)}</span>
          </li>
          <li>
            {t('slime.def')} <span className="num">{Math.round(d.def)}</span>
          </li>
          <li>
            {t('slime.speed')} <span className="num">{d.atkSpeed.toFixed(2)}</span>
          </li>
          <li>
            {t('slime.crit')} <span className="num">{Math.round(d.crit * 100)}%</span>
          </li>
          {ELEMENTS.filter((e) => d.resist[e] > 0).map((e) => (
            <li key={e}>
              {t('bag.resist', { el: nm('elements', e), n: Math.round(d.resist[e] * 100) })}
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title={t('slime.growth')}>
        {player.activeSkills.every((s) => !s) ? (
          <p className="muted">{t('slime.noGrowth')}</p>
        ) : (
          <ul className="growth">
            {player.activeSkills.map((id) =>
              id ? (
                <li key={id}>
                  <SkillIcon id={id} size={36} />
                  <span className="grow">
                    {t('slime.partsFrom', { skill: nm('skills', id) })}
                    <span className="muted small">
                      {getSkill(cfg, id)
                        .tags.map((tg) => nm('tags', tg))
                        .join(' · ')}
                    </span>
                  </span>
                </li>
              ) : null,
            )}
          </ul>
        )}
      </Panel>

      {choose && (
        <EvolveSheet
          onClose={() => setChoose(false)}
          options={options.map((f) => f.id)}
          color={player.look.color}
          onPick={async (id) => {
            const r = await dispatch({ t: 'evolve', formId: id });
            if (r.ok) toast(t('slime.evolved', { name: nm('forms', id) }), 'good');
            setChoose(false);
          }}
        />
      )}
      {share && <ShareModal onClose={() => setShare(false)} />}
    </div>
  );
}

function EvolveSheet({
  options,
  color,
  onPick,
  onClose,
}: {
  options: string[];
  color: string;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const [sel, setSel] = useState(options[0] ?? '');
  const forms = options.map((id) => getForm(cfg, id));
  // the level where the slime can evolve again after the form it is about to choose
  const nextLevel = cfg.forms.find((f) => f.from === sel)?.minLevel;
  return (
    <Modal title={t('slime.chooseTitle')} onClose={onClose}>
      <p className="muted" style={{ textAlign: 'center' }}>
        {t('slime.chooseSub')}
      </p>
      <div className="evolve-grid">
        {forms.map((f) => (
          <button
            key={f.id}
            className={`evc ${sel === f.id ? 'sel' : ''}`}
            onClick={() => setSel(f.id)}
            aria-pressed={sel === f.id}
            style={{ border: 0, color: 'inherit', cursor: 'pointer' }}
          >
            <FormSprite id={f.id} size={144} color={color} />
            <strong style={{ fontFamily: 'var(--font-hd)', fontWeight: 500, fontSize: 17 }}>
              {nm('forms', f.id)}
            </strong>
            {f.element && (
              <span className="chip">{t('home.element', { name: nm('elements', f.element) })}</span>
            )}
            {f.skillId && <span className="muted">{nm('skills', f.skillId)}</span>}
          </button>
        ))}
      </div>
      <p className="muted small" style={{ textAlign: 'center' }}>
        {nextLevel ? t('slime.evolveNote', { level: nextLevel }) : t('slime.evolveNoteLast')}
      </p>
      <button className="btn primary big" onClick={() => onPick(sel)}>
        {t('slime.pickThis')}
      </button>
    </Modal>
  );
}
