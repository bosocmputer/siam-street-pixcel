import { useState } from 'react';
import {
  awakenOptions,
  awakenReady,
  computeDerived,
  coresNeeded,
  defaultConfig as cfg,
  getMonster,
  getSkill,
  type PlayerState,
  type SkillDef,
} from '@slimehood/game-core';
import { useGame } from '../game/store';
import { awakenName, nm, t } from '../i18n/t';
import { Bar, Modal, MonsterSprite, Panel, SkillIcon } from './common';

function tagNames(def: SkillDef): string {
  return def.tags.map((tg) => nm('tags', tg)).join(' · ');
}

function comboLines(player: PlayerState): string[] {
  const counts = new Map<string, number>();
  const d = computeDerived(player, cfg);
  for (const s of [...d.actives, ...d.passives]) {
    for (const tag of new Set(s.extraTag ? [...s.def.tags, s.extraTag] : s.def.tags))
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  const lines: string[] = [];
  for (const [tag, n] of counts) {
    const tiers = cfg.combos[tag];
    if (!tiers) continue;
    let best: string | null = null;
    for (const need of Object.keys(tiers))
      if (n >= Number(need) && (best === null || Number(need) > Number(best))) best = need;
    if (!best) continue;
    const m = tiers[best]!;
    const bits: string[] = [];
    if (m.dmgMult) bits.push(t('skills.bonusDmg', { n: Math.round((m.dmgMult - 1) * 100) }));
    if (m.critAdd) bits.push(t('skills.bonusCrit', { n: Math.round(m.critAdd * 100) }));
    if (m.speedMult) bits.push(t('skills.bonusSpeed', { n: Math.round((m.speedMult - 1) * 100) }));
    if (m.defMult) bits.push(t('skills.bonusDef', { n: Math.round((m.defMult - 1) * 100) }));
    if (m.slow) bits.push(t('skills.bonusSlow', { n: Math.round(m.slow * 100) }));
    if (m.lifesteal) bits.push(t('skills.bonusLifesteal', { n: Math.round(m.lifesteal * 100) }));
    if (m.dotMult) bits.push(t('skills.bonusDot', { n: Math.round(m.dotMult * 100) }));
    lines.push(
      t('skills.comboTier', {
        tag: nm('tags', tag),
        n: Math.min(n, Number(best)),
        bonus: bits.join(', '),
      }),
    );
  }
  return lines;
}

export function SkillsPage() {
  const player = useGame((s) => s.player)!;
  const dispatch = useGame((s) => s.dispatch);
  const toast = useGame((s) => s.toast);
  const [pick, setPick] = useState<{ kind: 'active' | 'passive'; index: number } | null>(null);
  const [awaken, setAwaken] = useState<string | null>(null);

  const owned = Object.entries(player.skills).filter(([, v]) => v.level >= 1);
  const coreList = Object.entries(player.cores).filter(([, n]) => n > 0);
  const max = cfg.balance.skills.maxLevel;
  const combos = comboLines(player);

  const absorb = async (monsterId: string, count: number | 'all') => {
    const r = await dispatch({ t: 'absorb', monsterId, count });
    if (r.ok) {
      const info = r.info as {
        skillId: string;
        unlocked: boolean;
        level: number;
        awakenReady: boolean;
      };
      toast(
        t('skills.absorbed', {
          skill: nm('skills', info.skillId),
          what: info.unlocked ? t('skills.unlocked') : t('skills.leveled', { n: info.level }),
        }),
        'good',
      );
      if (info.awakenReady) toast(t('farm.nudgeAwaken'), 'info');
    } else toast(t('toast.error'), 'bad');
  };

  const slotBtn = (kind: 'active' | 'passive', index: number, id: string | null) => (
    <button
      key={`${kind}${index}`}
      className={`slot ${id ? 'filled' : 'empty'}`}
      style={kind === 'active' ? { width: 56, height: 56 } : { width: 46, height: 46 }}
      onClick={() => setPick({ kind, index })}
      aria-label={`${kind === 'active' ? t('skills.active') : t('skills.passive')} ${t('skills.slot', { n: index + 1 })}`}
    >
      {id && <SkillIcon id={id} size={kind === 'active' ? 40 : 32} />}
      <span className="lb">{id ? nm('skills', id) : t('skills.empty')}</span>
    </button>
  );
  const firstCore = coreList[0];
  const district = cfg.districts.find((d) => d.id === player.farm.districtId) ?? cfg.districts[0]!;
  const seenHere = district.monsters.filter((m) => (player.bestiary[m.id] ?? 0) > 0).length;
  const lockedCount = Math.max(0, district.monsters.length - owned.length);

  return (
    <div className="page">
      <h1 className="title-lg">{t('nav.skills')}</h1>

      <Panel title={t('skills.active')}>
        <div className="slot-row compact">
          {player.activeSkills.map((id, i) => slotBtn('active', i, id))}
          <span
            style={{ width: 2, height: 46, background: 'var(--edge)', margin: '0 6px' }}
            aria-hidden="true"
          />
          {player.passiveSkills.map((id, i) => slotBtn('passive', i, id))}
        </div>
        <p className="muted small" style={{ textAlign: 'center', marginTop: -14 }}>
          {t('skills.slotHint')}
        </p>
      </Panel>

      {firstCore && (
        <section className="panel core-banner">
          <div className="core-count">
            <MonsterSprite id={firstCore[0]} size={48} />
            <span className="n">{coreList.reduce((a, [, n]) => a + n, 0)}</span>
          </div>
          <div className="grow">
            <strong style={{ fontFamily: 'var(--font-hd)', fontWeight: 500 }}>
              {t('skills.coreBanner', {
                name: nm('skills', getMonster(cfg, firstCore[0]).skillId),
              })}
            </strong>
            <span className="muted small">{t('skills.coreMore')}</span>
          </div>
          <button className="btn primary" onClick={() => absorb(firstCore[0], 'all')}>
            {t('skills.absorb')}
          </button>
        </section>
      )}
      {coreList.slice(1).map(([id, n]) => (
        <section key={id} className="panel core-banner">
          <MonsterSprite id={id} size={44} />
          <div className="grow">
            <strong>{nm('skills', getMonster(cfg, id).skillId)}</strong>
            <span className="muted small">
              {t('skills.from', { name: nm('monsters', id) })} ×{n}
            </span>
          </div>
          <button className="btn" onClick={() => absorb(id, 'all')}>
            {t('skills.absorb')}
          </button>
        </section>
      ))}

      {combos.length > 0 && (
        <Panel title={t('skills.combos')}>
          <ul>
            {combos.map((l) => (
              <li key={l} className="good small" style={{ padding: '2px 0' }}>
                {l}
              </li>
            ))}
          </ul>
        </Panel>
      )}
      {combos.length === 0 && owned.length > 0 && (
        <p className="muted small" style={{ padding: '0 12px' }}>
          {t('skills.noCombo')}
        </p>
      )}

      <Panel title={t('skills.owned')}>
        <ul className="skill-list">
          {owned.map(([id, v]) => {
            const def = getSkill(cfg, id);
            const atMax = v.level >= max;
            const ready = awakenReady(player, id, cfg);
            return (
              <li key={id} className="skill-row">
                <SkillIcon id={id} size={48} />
                <div className="grow">
                  <strong>{nm('skills', id)}</strong>
                  <span className="muted small">
                    {def.kind === 'active' ? t('skills.kindActive') : t('skills.kindPassive')} ·{' '}
                    {tagNames(def)}
                    {def.cooldown ? ` · ${t('skills.cooldown', { n: def.cooldown })}` : ''}
                  </span>
                  <Bar
                    value={atMax ? (v.awakened ? 1 : v.progress) : v.progress}
                    max={
                      atMax
                        ? v.awakened
                          ? 1
                          : cfg.balance.skills.awakenCores
                        : coresNeeded(v.level, cfg)
                    }
                    tone={atMax ? 'violet' : 'mint'}
                    label={
                      atMax
                        ? v.awakened
                          ? `${t('skills.awakened')}: ${awakenName(v.awakened)}`
                          : t('skills.gauge', {
                              have: v.progress,
                              need: cfg.balance.skills.awakenCores,
                            })
                        : `${t('skills.level', { n: v.level, max })} · ${t('skills.levelProgress', { have: v.progress, need: coresNeeded(v.level, cfg) })}`
                    }
                  />
                </div>
                {ready && (
                  <button className="btn primary" onClick={() => setAwaken(id)}>
                    {t('skills.awaken')}
                  </button>
                )}
              </li>
            );
          })}
          {Array.from({ length: Math.min(lockedCount, 2) }, (_, i) => (
            <li key={`lock${i}`} className="skill-row" style={{ opacity: 0.55 }}>
              <div className="slot" style={{ margin: 0, width: 48, height: 48 }} aria-hidden="true">
                <span className="num" style={{ color: 'var(--edge)' }}>
                  ?
                </span>
              </div>
              <div className="grow">
                <strong>???</strong>
                <span className="muted small">{t('skills.locked')}</span>
              </div>
            </li>
          ))}
        </ul>
      </Panel>

      <section className="panel core-banner">
        <MonsterSprite id={district.monsters[0]?.id ?? 'brick_imp'} size={44} />
        <div className="grow">
          <strong>
            {t('skills.hintTitle', {
              name: nm('districts', district.id),
              n: district.monsters.length,
            })}
          </strong>
          <span className="muted small">
            {t('skills.hintBody')} ({seenHere}/{district.monsters.length})
          </span>
        </div>
      </section>

      {pick && (
        <Modal
          title={pick.kind === 'active' ? t('skills.active') : t('skills.passive')}
          onClose={() => setPick(null)}
        >
          <ul className="skill-list">
            {owned
              .filter(([id]) => getSkill(cfg, id).kind === pick.kind)
              .map(([id, v]) => (
                <li key={id}>
                  <button
                    className="skill-pick"
                    onClick={async () => {
                      const r = await dispatch({
                        t: 'equipSkill',
                        kind: pick.kind,
                        index: pick.index,
                        skillId: id,
                      });
                      if (!r.ok) toast(t('toast.error'), 'bad');
                      setPick(null);
                    }}
                  >
                    <SkillIcon id={id} size={40} />
                    <span className="grow">
                      <strong>{nm('skills', id)}</strong>
                      <span className="muted small"> {t('skills.level', { n: v.level, max })}</span>
                    </span>
                  </button>
                </li>
              ))}
          </ul>
          <div className="row">
            <button
              className="btn"
              onClick={async () => {
                await dispatch({
                  t: 'equipSkill',
                  kind: pick.kind,
                  index: pick.index,
                  skillId: null,
                });
                setPick(null);
              }}
            >
              {t('skills.remove')}
            </button>
            <button className="btn" onClick={() => setPick(null)}>
              {t('common.close')}
            </button>
          </div>
        </Modal>
      )}

      {awaken && (
        <Modal
          title={t('skills.awakenTitle', { skill: nm('skills', awaken) })}
          onClose={() => setAwaken(null)}
          wide
        >
          <p className="muted">{t('skills.awakenSub')}</p>
          <ul className="awaken-list">
            {awakenOptions(getSkill(cfg, awaken), cfg).map((choice) => (
              <li key={choice}>
                <button
                  className="btn block"
                  onClick={async () => {
                    const r = await dispatch({ t: 'awaken', skillId: awaken, choice });
                    if (r.ok) toast(`${nm('skills', awaken)}: ${awakenName(choice)}`, 'good');
                    else toast(t('toast.error'), 'bad');
                    setAwaken(null);
                  }}
                >
                  <strong>{awakenName(choice)}</strong>
                  <span className="muted small">{awakenDesc(choice)}</span>
                </button>
              </li>
            ))}
          </ul>
        </Modal>
      )}
    </div>
  );
}

function awakenDesc(choice: string): string {
  const s = cfg.balance.skills;
  if (choice === 'power')
    return t('skills.descPower', { n: Math.round((s.awakenPowerMult - 1) * 100) });
  if (choice === 'swift')
    return t('skills.descSwift', { n: Math.round((1 - s.awakenCooldownMult) * 100) });
  if (choice === 'boost')
    return t('skills.descBoost', { n: Math.round((s.awakenPassiveMult - 1) * 100) });
  return t('skills.descTag', { tag: nm('tags', choice.slice(4)) });
}
