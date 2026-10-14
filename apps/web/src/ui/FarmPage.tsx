import { useMemo } from 'react';
import {
  defaultConfig as cfg,
  evolutionOptions,
  expToNext,
  farmStatus,
  awakenReady,
  type ClaimReport,
  type PlayerState,
} from '@slimehood/game-core';
import { useGame } from '../game/store';
import { formatDuration, formatNumber, nm, t } from '../i18n/t';
import { FarmCanvas } from './FarmCanvas';
import { Bar, ItemIcon, MaterialIcon, MonsterSprite, Modal, Panel, RARITY_CLASS } from './common';
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
  const rested =
    Math.min(Math.max(0, elapsed - idle.capSeconds), idle.restedMaxSeconds) * idle.restedRate;
  const wait = Math.max(0, idle.minClaimIntervalSeconds - elapsed);
  const need = expToNext(player.level, cfg);
  const tips = tipsFor(player);

  const claim = async () => {
    const r = await dispatch({ t: 'claim' });
    if (!r.ok) toast(r.reason === 'tooSoon' ? t('report.tooSoon') : t('toast.error'), 'bad');
  };

  return (
    <div className="page">
      <div className="statusbar">
        <span className="chip">{t('common.level', { n: player.level })}</span>
        <div className="grow">
          <Bar
            value={player.exp}
            max={need}
            label={`${t('farm.exp')} ${formatNumber(player.exp)}/${formatNumber(need)}`}
            tone="violet"
          />
        </div>
        <span className="chip amber">{t('common.coins', { n: formatNumber(player.coins) })}</span>
      </div>

      <FarmCanvas player={player} />

      <div className="where">
        <span className="chip district">{nm('districts', district.id)}</span>
        <span className="chip">
          {status.stuck ? t('farm.stuck') : t('farm.target', { n: status.farmedStage })}
        </span>
      </div>
      {!status.stuck && status.farmedStage < status.targetStage && (
        <p className="note warn">
          {t('farm.retreat', { to: status.farmedStage, from: status.targetStage })}
        </p>
      )}
      {status.stuck && <HintLine hint={status.hint} />}
      {status.districtCleared ? (
        <p className="note good">{t('farm.cleared')}</p>
      ) : (
        <Bar
          value={status.frontierKills}
          max={status.killsNeeded}
          label={t('farm.progress', {
            kills: formatNumber(status.frontierKills),
            need: formatNumber(status.killsNeeded),
          })}
        />
      )}

      <Panel title={t('farm.farming')}>
        <div className="stored">
          <Bar
            value={stored}
            max={idle.capSeconds}
            tone="amber"
            label={
              stored >= idle.capSeconds
                ? t('farm.full', { hours: idle.capSeconds / 3600 })
                : t('farm.stored', { time: formatDuration(stored) })
            }
          />
          {stored < idle.capSeconds && (
            <p className="muted small">
              {t('farm.fillsIn', { time: formatDuration(idle.capSeconds - stored) })}
            </p>
          )}
          {rested > 0 && (
            <p className="muted small good">{t('farm.rested', { time: formatDuration(rested) })}</p>
          )}
        </div>
        <button className="btn primary big" disabled={wait > 0} onClick={claim}>
          {wait > 0 ? t('farm.wait', { s: Math.ceil(wait) }) : t('farm.claim')}
        </button>
      </Panel>

      <div className="tips">
        {tips.points > 0 && (
          <button className="tip" onClick={() => setPage('slime')}>
            {t('farm.tipPoints', { n: tips.points })}
          </button>
        )}
        {tips.cores > 0 && (
          <button className="tip" onClick={() => setPage('skills')}>
            {t('farm.tipCores', { n: tips.cores })}
          </button>
        )}
        {tips.evolve && (
          <button className="tip hot" onClick={() => setPage('slime')}>
            {t('farm.tipEvolve')}
          </button>
        )}
        {tips.home && (
          <button className="tip hot" onClick={() => setPage('map')}>
            {t('farm.tipHome')}
          </button>
        )}
        {tips.awaken > 0 && (
          <button className="tip hot" onClick={() => setPage('skills')}>
            {t('farm.tipAwaken')}
          </button>
        )}
      </div>
    </div>
  );
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

export function ReportDialog({ report, onClose }: { report: ClaimReport; onClose: () => void }) {
  const player = useGame((s) => s.player);
  const away = report.elapsedSeconds;
  const itemCount = report.items.length;
  const coresTotal = Object.values(report.cores).reduce((a, b) => a + b, 0);
  const empty = report.kills === 0 && report.exp === 0 && itemCount === 0;
  return (
    <Modal
      title={away >= 3600 ? t('report.titleLong') : t('report.titleShort')}
      onClose={onClose}
      wide
    >
      <div className="report">
        <p className="muted">{t('report.away', { time: formatDuration(away) })}</p>
        {empty ? (
          <>
            <p className="note warn">{t('report.nothing')}</p>
            <HintLine hint={report.hint} />
          </>
        ) : (
          <ul className="report-list">
            <li>{t('report.kills', { n: formatNumber(report.kills) })}</li>
            <li className="good">{t('report.exp', { n: formatNumber(report.exp) })}</li>
            <li className="amber">{t('report.coins', { n: formatNumber(report.coins) })}</li>
            {report.levelsGained > 0 && (
              <li className="hot">{t('report.levelUp', { n: report.levelsGained })}</li>
            )}
            {report.stagesCleared.length > 0 && (
              <li>
                {t('report.stages', {
                  list:
                    report.stagesCleared.length > 6
                      ? `${report.stagesCleared[0]}–${report.stagesCleared[report.stagesCleared.length - 1]}`
                      : report.stagesCleared.join(', '),
                })}
              </li>
            )}
            {report.restedSeconds > 0 && (
              <li className="muted">
                {t('report.rested', { time: formatDuration(report.restedSeconds) })}
              </li>
            )}
          </ul>
        )}
        {report.golden.count > 0 && (
          <p className="note hot">{t('report.golden', { n: report.golden.count })}</p>
        )}
        {report.milestones.map((m) => (
          <p key={m.stage} className="note good">
            {m.final ? t('report.milestoneFinal') : t('report.milestone', { n: m.stage })}
          </p>
        ))}
        {coresTotal > 0 && (
          <div className="chips">
            <span className="chips-title">{t('report.cores')}</span>
            {Object.entries(report.cores).map(([id, n]) => (
              <span key={id} className="chip with-img">
                <MonsterSprite id={id} size={28} /> ×{n}
              </span>
            ))}
          </div>
        )}
        {Object.keys(report.materials).length > 0 && (
          <div className="chips">
            <span className="chips-title">{t('report.materials')}</span>
            {Object.entries(report.materials).map(([id, n]) => (
              <span key={id} className="chip with-img">
                <MaterialIcon id={id} size={24} /> ×{n}
              </span>
            ))}
          </div>
        )}
        {itemCount > 0 && (
          <div className="chips">
            <span className="chips-title">{t('report.items')}</span>
            {report.items.map((it) => (
              <span key={it.uid} className={`chip with-img ${RARITY_CLASS[it.rarity]}`}>
                <ItemIcon defId={it.defId} rarity={it.rarity} size={28} /> {nm('items', it.defId)}
              </span>
            ))}
          </div>
        )}
        {report.salvaged.count > 0 && (
          <p className="muted small">
            {t('report.salvaged', { n: report.salvaged.count, jelly: report.salvaged.jelly })}
          </p>
        )}
        {!empty && report.hint && <HintLine hint={report.hint} />}
        {player && player.statPoints > 0 && (
          <p className="muted small">{t('farm.tipPoints', { n: player.statPoints })}</p>
        )}
      </div>
      <button className="btn primary big" onClick={onClose}>
        {t('common.ok')}
      </button>
    </Modal>
  );
}
