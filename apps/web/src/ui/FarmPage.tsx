import { useMemo, useState } from 'react';
import {
  defaultConfig as cfg,
  evolutionOptions,
  expToNext,
  farmStatus,
  awakenReady,
  getSkill,
  type ClaimReport,
  type PlayerState,
} from '@slimehood/game-core';
import { useGame, type Page } from '../game/store';
import { faceCanvas } from '../art';
import { formatDuration, formatNumber, nm, t } from '../i18n/t';
import { ctxOf, makeCanvas } from '../art/draw';
import { FarmCanvas } from './FarmCanvas';
import {
  BasketImg,
  CoinImg,
  ItemIcon,
  MaterialIcon,
  Modal,
  MonsterSprite,
  PixelImg,
  RARITY_CLASS,
  SkillIcon,
  SlimeSprite,
} from './common';
import { useNow } from './hooks';

export function tipsFor(player: PlayerState) {
  const cores = Object.values(player.cores).reduce((a, b) => a + b, 0);
  const awaken = Object.keys(player.skills).filter((id) => awakenReady(player, id, cfg)).length;
  return {
    points: player.statPoints,
    cores,
    evolve: evolutionOptions(player, cfg).length > 0,
    awaken,
    home: player.homeDistrictId === null && player.level >= cfg.balance.home.promptLevel,
  };
}

interface Nudge {
  text: string;
  go: Page | 'claim';
  hot?: boolean;
}

/** One suggestion at a time, most useful first. */
function nextNudge(
  player: PlayerState,
  tips: ReturnType<typeof tipsFor>,
  full: boolean,
  stuck: boolean,
): Nudge | null {
  if (full) return { text: t('farm.nudgeFull'), go: 'claim', hot: true };
  if (tips.evolve) return { text: t('farm.nudgeEvolve'), go: 'slime', hot: true };
  if (tips.awaken > 0) return { text: t('farm.nudgeAwaken'), go: 'skills', hot: true };
  if (tips.cores > 0) return { text: t('farm.nudgeCores', { n: tips.cores }), go: 'skills' };
  if (tips.points > 0) return { text: t('farm.nudgePoints', { n: tips.points }), go: 'slime' };
  if (tips.home) return { text: t('farm.nudgeHome'), go: 'map' };
  if (stuck) return { text: t('farm.nudgeStuck'), go: 'slime' };
  void player;
  return null;
}

export function FarmPage() {
  const player = useGame((s) => s.player)!;
  const dispatch = useGame((s) => s.dispatch);
  const setPage = useGame((s) => s.setPage);
  const toast = useGame((s) => s.toast);
  const now = useNow();
  const status = useMemo(() => farmStatus(player, cfg), [player]);
  const district = cfg.districts.find((d) => d.id === player.farm.districtId)!;
  const idle = cfg.balance.idle;

  const elapsed = Math.max(0, now - player.lastClaimAt);
  const stored = Math.min(elapsed, idle.capSeconds);
  const full = stored >= idle.capSeconds;
  const rested =
    Math.min(Math.max(0, elapsed - idle.capSeconds), idle.restedMaxSeconds) * idle.restedRate;
  const wait = Math.max(0, idle.minClaimIntervalSeconds - elapsed);
  const need = expToNext(player.level, cfg);
  const tips = tipsFor(player);
  const nudge = nextNudge(player, tips, full, status.stuck);
  const home = player.homeDistrictId
    ? cfg.districts.find((d) => d.id === player.homeDistrictId)
    : undefined;

  const claim = async () => {
    const r = await dispatch({ t: 'claim' });
    if (!r.ok) toast(r.reason === 'tooSoon' ? t('report.tooSoon') : t('toast.error'), 'bad');
  };

  // stage window: five stages of the current row, with a chest at the end (milestone every 5)
  const cleared = player.progress[district.id] ?? 0;
  const base = Math.floor((Math.max(1, status.targetStage) - 1) / 5) * 5 + 1;
  const pct = status.killsNeeded > 0 ? (status.frontierKills / status.killsNeeded) * 100 : 0;
  const activeSkills = player.activeSkills;

  return (
    <div className="page" style={{ padding: 0 }}>
      <div className="sb">
        <div className="who">
          <PixelImg canvas={faceCanvas(player)} size={42} alt="" />
          <div className="who-t">
            <b>{player.name || t('slime.unnamed')}</b>
            <span>{t('common.level', { n: player.level })}</span>
          </div>
        </div>
        <div className="xp">
          <div
            className="bar"
            role="progressbar"
            aria-valuenow={Math.round(player.exp)}
            aria-valuemax={Math.round(need)}
            aria-valuemin={0}
            aria-label={t('common.level', { n: player.level })}
          >
            <div
              className="bar-fill amber"
              style={{ width: `${Math.min(100, (player.exp / need) * 100)}%` }}
            />
          </div>
          <span className="num">
            {formatNumber(player.exp)} / {formatNumber(need)}
          </span>
        </div>
        <div className="cur">
          <CoinImg />
          {formatNumber(player.coins)}
        </div>
      </div>

      <button className="rankbar" onClick={() => setPage('map')}>
        <span className="rk-d">
          <i
            className="flag"
            style={{ background: districtColor(home?.element ?? district.element) }}
          />
          {nm('districts', home?.id ?? district.id)}
        </span>
        <span className={`rk-b ${home ? '' : 'hot'}`}>
          {home ? t('farm.rankSoon') : t('farm.pickHome')}
        </span>
      </button>

      <div className="stage">
        <FarmCanvas player={player} />
        <span className="zone chip hot">
          {nm('districts', district.id)} · {t('farm.zone', { n: status.farmedStage })}
        </span>
        <span className="zone-r chip">{t('farm.auto')}</span>
      </div>

      <div className="trk">
        <div className="sks" aria-hidden="true">
          {activeSkills.map((id, i) => {
            const def = id && (player.skills[id]?.level ?? 0) > 0 ? getSkill(cfg, id) : null;
            return (
              <div key={i} className={`sk ${def ? 'on' : 'empty'}`}>
                {def && id && <SkillIcon id={id} size={32} />}
                {def && (
                  <div className="cd" style={{ ['--cd' as string]: `${def.cooldown ?? 5}s` }} />
                )}
              </div>
            );
          })}
        </div>
        <div className="track">
          <div className="top">
            <b>
              {status.stuck ? t('farm.stuckStage', { n: status.targetStage }) : t('farm.nextStage')}
            </b>
            {!status.districtCleared && !status.stuck && (
              <span className="num muted">
                {formatNumber(status.frontierKills)} / {formatNumber(status.killsNeeded)}
              </span>
            )}
          </div>
          <div className="pips" role="img" aria-label={t('farm.zone', { n: status.targetStage })}>
            {[0, 1, 2, 3].map((k) => {
              const stage = base + k;
              const isNow = stage === status.targetStage;
              return (
                <span
                  key={k}
                  className={`pip ${stage <= cleared ? 'done' : ''} ${isNow ? 'now' : ''}`}
                  style={isNow ? { ['--p' as string]: `${pct}%` } : undefined}
                />
              );
            })}
            <PixelImg canvas={milestoneIcon()} size={22} alt="" />
          </div>
        </div>
      </div>

      {status.stuck && <HintLine hint={status.hint} />}
      {!status.stuck && status.farmedStage < status.targetStage && (
        <p className="note warn">
          {t('farm.retreat', { to: status.farmedStage, from: status.targetStage })}
        </p>
      )}
      {status.districtCleared && <p className="note good">{t('farm.cleared')}</p>}

      <section className="panel idle">
        <div className="basket-wrap">
          <BasketImg fill={full ? 3 : 2} size={64} />
          {stored > idle.capSeconds * 0.3 && wait <= 0 && (
            <span className="steam" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
          )}
        </div>
        <div>
          <h3>
            {wait > 0 && elapsed < 60
              ? t('farm.basketCool')
              : full
                ? t('farm.basketFull')
                : t('farm.basket')}
          </h3>
          <div className="sub-t">
            {wait > 0
              ? t('farm.basketCoolSub', { s: Math.ceil(wait) })
              : full
                ? t('farm.over')
                : `${t('farm.basketStored', { time: formatDuration(stored) })} · ${t('farm.basketFillsIn', { time: formatDuration(idle.capSeconds - stored) })}`}
          </div>
          {rested > 0 && (
            <div className="sub-t good">{t('farm.rested', { time: formatDuration(rested) })}</div>
          )}
        </div>
        <button
          className={`btn primary ${wait > 0 ? '' : 'pulse'}`}
          disabled={wait > 0}
          onClick={claim}
        >
          {wait > 0 ? t('farm.wait', { s: Math.ceil(wait) }) : t('farm.claim')}
        </button>
      </section>

      {nudge && (
        <button
          className="nudge"
          onClick={() => (nudge.go === 'claim' ? claim() : setPage(nudge.go))}
        >
          <span>{nudge.text}</span>
          <b>{nudge.go === 'claim' ? t('farm.claim') : t('farm.go')}</b>
        </button>
      )}
    </div>
  );
}

function districtColor(el: string): string {
  return (
    { earth: 'var(--earth)', water: 'var(--sky)', fire: 'var(--fire)', wind: 'var(--wind)' }[el] ??
    'var(--edge)'
  );
}

let ms: HTMLCanvasElement | null = null;
/** A little chest for "a reward waits at the end of this row of stages". */
function milestoneIcon(): HTMLCanvasElement {
  if (ms) return ms;
  const c = makeCanvas(24);
  const g = ctxOf(c);
  g.fillStyle = '#0b0a1c';
  g.fillRect(3, 8, 18, 13);
  g.fillStyle = '#b86f10';
  g.fillRect(4, 9, 16, 11);
  g.fillStyle = '#ffd98a';
  g.fillRect(4, 9, 16, 3);
  g.fillStyle = '#0b0a1c';
  g.fillRect(11, 12, 2, 5);
  ms = c;
  return c;
}

export function HintLine({ hint }: { hint: ReturnType<typeof farmStatus>['hint'] }) {
  if (!hint) return null;
  const text =
    hint.reason === 'element'
      ? t('report.hintElement', {
          monster: nm('elements', hint.monsterElement),
          suggest: hint.suggestElement ? nm('elements', hint.suggestElement) : '',
        })
      : hint.reason === 'defense'
        ? t('report.hintDefense')
        : t('report.hintDamage');
  return <p className="note warn">{text}</p>;
}

/** Opening the auto loot: the best things first, the rest as short lines. Then, if it happened, the level-up. */
export function ReportDialog({ report, onClose }: { report: ClaimReport; onClose: () => void }) {
  const player = useGame((s) => s.player);
  const setPage = useGame((s) => s.setPage);
  const [levelStep, setLevelStep] = useState(false);
  const away = report.elapsedSeconds;
  const itemCount = report.items.length;
  const coresTotal = Object.values(report.cores).reduce((a, b) => a + b, 0);
  const empty = report.kills === 0 && report.exp === 0 && itemCount === 0;

  if (levelStep && player) {
    return (
      <Modal title={t('report.levelTitle')} centered onClose={onClose}>
        <div className="big-num">
          {player.level - report.levelsGained} <span className="muted">▸</span>{' '}
          <span className="amber">{player.level}</span>
        </div>
        <SlimeSprite player={player} size={144} />
        <div className="chip hot">
          {t('report.levelPoints', { n: report.levelsGained * cfg.balance.statPointsPerLevel })}
        </div>
        <button
          className="btn primary big"
          onClick={() => {
            setPage('slime');
            onClose();
          }}
        >
          {t('report.levelGo')}
        </button>
        <button className="btn small" onClick={onClose}>
          {t('report.later')}
        </button>
      </Modal>
    );
  }

  // the best finds get big tiles, in order of how exciting they are
  const tiles: { key: string; node: JSX.Element; label: string; cls: string; gold?: boolean }[] =
    [];
  if (report.golden.count > 0)
    tiles.push({
      key: 'gold',
      gold: true,
      cls: 'r-legend',
      label: t('report.goldenTitle'),
      node: <MonsterSprite id={goldenMonsterId(player)} size={64} />,
    });
  const bestItems = [...report.items].sort(
    (a, b) => RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity),
  );
  for (const it of bestItems.slice(0, 3 - tiles.length))
    tiles.push({
      key: it.uid,
      cls: RARITY_CLASS[it.rarity],
      label: nm('items', it.defId),
      node: <ItemIcon defId={it.defId} rarity={it.rarity} size={64} bare />,
    });
  const coreEntries = Object.entries(report.cores);
  if (tiles.length < 3 && coreEntries[0])
    tiles.push({
      key: `core-${coreEntries[0][0]}`,
      cls: 'r-common',
      label: t('report.coreLine', {
        name: nm('monsters', coreEntries[0][0]),
        n: coreEntries[0][1],
      }),
      node: <MonsterSprite id={coreEntries[0][0]} size={64} />,
    });
  const extraItems = bestItems.slice(3 - (tiles.length - (report.golden.count > 0 ? 1 : 0)));

  return (
    <Modal
      title={away >= 3600 ? t('report.basketTitle') : t('report.titleShort')}
      onClose={onClose}
    >
      <div className="greet">
        {player && <SlimeSprite player={player} size={96} />}
        <div className="bubble">{t('report.hello')}</div>
      </div>
      <p className="muted small" style={{ textAlign: 'center' }}>
        {t('report.away', { time: formatDuration(away) })}
      </p>
      {empty ? (
        <>
          <p className="note warn">{t('report.nothing')}</p>
          <HintLine hint={report.hint} />
        </>
      ) : (
        <>
          {tiles.length > 0 && (
            <div className="loot">
              {tiles.map((x, i) => (
                <div
                  key={x.key}
                  className={`lootc ${x.gold ? 'gold' : ''}`}
                  style={{ ['--i' as string]: i }}
                >
                  <div className={`tile ${x.cls}`}>{x.node}</div>
                  <span>{x.label}</span>
                </div>
              ))}
            </div>
          )}
          <div className="line">
            <span>{t('report.kills', { n: formatNumber(report.kills) })}</span>
            <b>+{formatNumber(report.exp)}</b>
          </div>
          <div className="line">
            <span>{t('common.coins', { n: '' }).trim()}</span>
            <b>+{formatNumber(report.coins)}</b>
          </div>
          {report.stagesCleared.length > 0 && (
            <div className="line">
              <span>{t('report.stagesRow')}</span>
              <b>
                {Math.min(...report.stagesCleared)}–{Math.max(...report.stagesCleared)}
              </b>
            </div>
          )}
          {report.milestones.map((m) => (
            <p key={m.stage} className="note good">
              {m.final ? t('report.milestoneFinal') : t('report.milestone', { n: m.stage })}
            </p>
          ))}
          {(coresTotal > 0 ||
            Object.keys(report.materials).length > 0 ||
            extraItems.length > 0) && (
            <div className="chips">
              {coreEntries.map(([id, n]) => (
                <span key={id} className="chip with-img">
                  <MonsterSprite id={id} size={28} /> ×{n}
                </span>
              ))}
              {Object.entries(report.materials).map(([id, n]) => (
                <span key={id} className="chip with-img">
                  <MaterialIcon id={id} size={24} /> ×{n}
                </span>
              ))}
              {extraItems.map((it) => (
                <span key={it.uid} className="chip with-img">
                  <ItemIcon defId={it.defId} rarity={it.rarity} size={28} /> {nm('items', it.defId)}
                </span>
              ))}
            </div>
          )}
          {report.salvaged.count > 0 && (
            <div className="line faint">
              <span>
                {t('report.faint', { n: report.salvaged.count, jelly: report.salvaged.jelly })}
              </span>
            </div>
          )}
          {report.restedSeconds > 0 && (
            <p className="muted small">
              {t('report.rested', { time: formatDuration(report.restedSeconds) })}
            </p>
          )}
          {report.hint && <HintLine hint={report.hint} />}
        </>
      )}
      <button
        className="btn primary"
        style={{ width: 'calc(100% - 8px)' }}
        onClick={() => (report.levelsGained > 0 && player ? setLevelStep(true) : onClose())}
      >
        {t('report.collect')}
      </button>
    </Modal>
  );
}

const RARITY_ORDER = ['common', 'good', 'rare', 'legend'];

function goldenMonsterId(player: PlayerState | null): string {
  const d =
    cfg.districts.find((x) => x.id === (player?.farm.districtId ?? 'wiang')) ?? cfg.districts[0]!;
  return d.monsters[0]?.id ?? 'brick_imp';
}
