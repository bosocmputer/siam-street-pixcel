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
import { nm, t } from '../i18n/t';
import { FormSprite, ItemIcon, Panel, SkillIcon, SlimeSprite } from './common';

const STAT_DESC: Record<StatKey, string> = {
  str: 'slime.statStr',
  agi: 'slime.statAgi',
  vit: 'slime.statVit',
  int: 'slime.statInt',
};

export function SlimePage() {
  const player = useGame((s) => s.player)!;
  const dispatch = useGame((s) => s.dispatch);
  const toast = useGame((s) => s.toast);
  const d = computeDerived(player, cfg);
  const form = getForm(cfg, player.formId);
  const options = evolutionOptions(player, cfg);
  const next = cfg.forms.filter((f) => f.from === player.formId);
  const nextLevel = next[0]?.minLevel;

  const evolve = async (id: string) => {
    const r = await dispatch({ t: 'evolve', formId: id });
    if (r.ok) toast(t('slime.evolved', { name: nm('forms', id) }), 'good');
  };
  const add = async (stat: StatKey, amount: number) => {
    const r = await dispatch({ t: 'allocate', stat, amount: Math.min(amount, player.statPoints) });
    if (!r.ok) toast(t('toast.notEnough'), 'bad');
  };

  return (
    <div className="page">
      <Panel className="hero">
        <div className="hero-row">
          <SlimeSprite player={player} size={132} />
          <div className="hero-info">
            <h1 className="title-lg">{player.name || t('slime.unnamed')}</h1>
            <p className="muted small">{nm('forms', form.id)}</p>
            <p className="muted">{t('common.level', { n: player.level })}</p>
            {form.element && (
              <span className="chip">
                {t('home.element', { name: nm('elements', form.element) })}
              </span>
            )}
            <p className="muted small">{t('slime.points', { n: player.statPoints })}</p>
          </div>
        </div>
      </Panel>

      {options.length > 0 ? (
        <Panel title={t('slime.evolveReady')} className="evolve">
          <div className="evolve-grid">
            {options.map((f) => (
              <div key={f.id} className="evolve-card">
                <FormSprite id={f.id} size={72} />
                <strong>{nm('forms', f.id)}</strong>
                <span className="muted small">{f.skillId ? nm('skills', f.skillId) : ''}</span>
                <button className="btn primary" onClick={() => evolve(f.id)}>
                  {t('slime.evolveTo')}
                </button>
              </div>
            ))}
          </div>
        </Panel>
      ) : (
        <p className="note">
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
        <ul className="stat-list">
          {STAT_KEYS.map((k) => {
            const bonus = d.stats[k] - player.stats[k];
            return (
              <li key={k} className="stat-row">
                <div className="stat-name">
                  <strong>{nm('stats', k)}</strong>
                  <span className="muted small">{t(STAT_DESC[k])}</span>
                </div>
                <span className="num">
                  {player.stats[k]}
                  {bonus > 0 && <em className="bonus"> +{Math.round(bonus * 10) / 10}</em>}
                </span>
                <div className="stat-btns">
                  <button
                    className="btn small"
                    disabled={player.statPoints < 1}
                    onClick={() => add(k, 1)}
                    aria-label={`${nm('stats', k)} +1`}
                  >
                    +1
                  </button>
                  <button
                    className="btn small"
                    disabled={player.statPoints < 2}
                    onClick={() => add(k, 5)}
                    aria-label={`${nm('stats', k)} +5`}
                  >
                    +5
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
        <h3 className="sub">{t('slime.derived')}</h3>
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

      <Panel title={t('slime.equipment')}>
        <div className="slot-row">
          {(['head', 'weapon', 'skin', 'charm'] as const).map((slot) => {
            const inst = player.items.find((i) => i.uid === player.equipment[slot]);
            return (
              <div key={slot} className="slot">
                {inst ? (
                  <ItemIcon defId={inst.defId} rarity={inst.rarity} size={52} />
                ) : (
                  <div className="slot-empty" />
                )}
                <span className="small">{nm('slots', slot)}</span>
                <span className="muted small">
                  {inst ? nm('items', inst.defId) : t('slime.noItem')}
                </span>
              </div>
            );
          })}
        </div>
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
                  <span>{t('slime.partsFrom', { skill: nm('skills', id) })}</span>
                  <span className="muted small">
                    {getSkill(cfg, id)
                      .tags.map((tg) => nm('tags', tg))
                      .join(' · ')}
                  </span>
                </li>
              ) : null,
            )}
          </ul>
        )}
      </Panel>
    </div>
  );
}
