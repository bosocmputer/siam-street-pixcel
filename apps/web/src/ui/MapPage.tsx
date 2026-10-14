import { useState } from 'react';
import {
  completedSets,
  defaultConfig as cfg,
  farmStatus,
  getMonster,
  homeCooldownDays,
} from '@slimehood/game-core';
import { useGame } from '../game/store';
import { nm, t } from '../i18n/t';
import { ELEMENT_COLORS } from '../art/draw';
import { MonsterSprite, Modal, Panel } from './common';
import { useNow } from './hooks';

export function MapPage() {
  const player = useGame((s) => s.player)!;
  const dispatch = useGame((s) => s.dispatch);
  const toast = useGame((s) => s.toast);
  const newGame = useGame((s) => s.newGame);
  const [sure, setSure] = useState(false);
  const sets = new Set(completedSets(player, cfg));
  const farming = player.farm.districtId;
  const noHome = player.homeDistrictId === null;
  const cooldown = homeCooldownDays(player, useNow(), cfg);

  const setHome = async (districtId: string) => {
    const r = await dispatch({ t: 'chooseHome', districtId });
    if (r.ok) toast(t('home.chosen', { name: nm('districts', districtId) }), 'good');
    else if (r.reason === 'cooldown') toast(t('home.cooldownToast', { n: cooldown }), 'bad');
    else toast(t('toast.error'), 'bad');
  };

  const farm = async (districtId: string, stage: number) => {
    const r = await dispatch({ t: 'setFarm', districtId, stage });
    if (r.ok) {
      toast(t('map.farmChanged', { name: nm('districts', districtId), n: stage }), 'good');
      useGame.getState().setPage('farm');
    } else toast(t('toast.error'), 'bad');
  };

  return (
    <div className="page">
      <h1 className="title-lg">{t('map.title')}</h1>
      {noHome && (
        <Panel title={t('home.pickTitle')}>
          <p className="muted small">{t('home.pickSub')}</p>
        </Panel>
      )}
      {cfg.districts.map((d) => {
        const cleared = player.progress[d.id] ?? 0;
        const frontier = Math.min(cleared + 1, d.stageCount);
        const isFarming = farming === d.id;
        // how hard is its first stage for us right now?
        const probe = { ...player, farm: { ...player.farm, districtId: d.id, stage: 1 } };
        const hard = farmStatus(probe, cfg).stuck;
        return (
          <Panel
            key={d.id}
            className="district-panel"
            title={nm('districts', d.id)}
            aside={
              <>
                {player.homeDistrictId === d.id && (
                  <span className="chip hot">{t('map.home')}</span>
                )}
                <span className="chip" style={{ borderColor: ELEMENT_COLORS[d.element].body }}>
                  {nm('elements', d.element)}
                </span>
              </>
            }
          >
            <p className="muted small">{t('map.cleared', { n: cleared, total: d.stageCount })}</p>
            {player.homeDistrictId !== d.id && (
              <button
                className={`btn ${noHome ? 'primary' : ''}`}
                disabled={!noHome && cooldown > 0}
                onClick={() => setHome(d.id)}
              >
                {noHome
                  ? t('home.set')
                  : cooldown > 0
                    ? t('home.cooldown', { n: cooldown })
                    : t('home.change')}
              </button>
            )}
            {sets.has(d.id) && <p className="note good">{t('map.setBonus')}</p>}
            <div className="bestiary">
              {d.monsters.map((m) => {
                const n = player.bestiary[m.id] ?? 0;
                return (
                  <div key={m.id} className={`mon ${n ? '' : 'unseen'}`}>
                    <MonsterSprite id={m.id} size={44} />
                    <span className="small">{n ? nm('monsters', m.id) : t('map.unknown')}</span>
                    <span className="muted small">
                      {n ? t('map.seen', { n }) : getMonster(cfg, m.id).element ? '' : ''}
                    </span>
                  </div>
                );
              })}
            </div>
            {hard && <p className="note warn">{t('map.hard')}</p>}
            <StagePicker
              frontier={frontier}
              current={isFarming ? player.farm.stage : frontier}
              farming={isFarming}
              onFarm={(stage) => farm(d.id, stage)}
            />
          </Panel>
        );
      })}

      <Panel title={t('settings.title')}>
        <p className="muted small">{t('app.offlineNote')}</p>
        <p className="muted small">{t('map.creditOsm')}</p>
        <p className="muted small">{t('settings.creditsText')}</p>
        <button className="btn danger" onClick={() => setSure(true)}>
          {t('settings.newGame')}
        </button>
      </Panel>

      {sure && (
        <Modal title={t('settings.newGame')} onClose={() => setSure(false)}>
          <p>{t('settings.newGameWarn')}</p>
          <div className="row">
            <button className="btn" onClick={() => setSure(false)}>
              {t('common.cancel')}
            </button>
            <button className="btn danger" onClick={() => newGame()}>
              {t('settings.confirm')}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function StagePicker({
  frontier,
  current,
  farming,
  onFarm,
}: {
  frontier: number;
  current: number;
  farming: boolean;
  onFarm: (stage: number) => void;
}) {
  const [stage, setStage] = useState(Math.min(current, frontier));
  return (
    <div className="stage-picker">
      <label>
        <span className="muted small">{t('map.pickStage')}</span>
        <select value={stage} onChange={(e) => setStage(Number(e.target.value))}>
          {Array.from({ length: frontier }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {t('map.stage', { n })}
              {n === frontier ? ` (${t('map.frontier')})` : ''}
            </option>
          ))}
        </select>
      </label>
      <button className={`btn ${farming ? '' : 'primary'}`} onClick={() => onFarm(stage)}>
        {farming ? t('map.farming') : t('map.farmHere')}
      </button>
    </div>
  );
}
