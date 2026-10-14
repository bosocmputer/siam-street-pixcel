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
import { MonsterSprite, Modal, Panel } from './common';
import { useNow } from './hooks';

// A sketch of the town, not the real one (the real shapes come from OpenStreetMap in M3).
const PINS: Record<string, { x: number; y: number }> = {
  wiang: { x: 172, y: 150 },
  nimman: { x: 66, y: 100 },
  ping: { x: 262, y: 270 },
  thapae: { x: 270, y: 80 },
};
const GEM: Record<string, string> = {
  earth: 'var(--earth)',
  water: 'var(--sky)',
  fire: 'var(--fire)',
  wind: 'var(--wind)',
};

function MapSketch() {
  return (
    <svg
      viewBox="0 0 382 300"
      preserveAspectRatio="xMidYMid slice"
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      <rect width="382" height="300" fill="#22304a" />
      {Array.from({ length: 26 }, (_, i) => (
        <rect key={i} x={(i * 53) % 370} y={(i * 37) % 290} width="4" height="4" fill="#2a3a58" />
      ))}
      <path
        d="M300 0 C280 60 330 110 300 170 S270 270 310 300 L340 300 C310 270 330 200 336 170 S320 60 336 0Z"
        fill="#3f78b8"
      />
      <path
        d="M312 0 C296 60 344 110 316 170 S288 270 322 300"
        stroke="#8cc8f5"
        strokeWidth="3"
        fill="none"
        strokeDasharray="6 8"
      />
      <rect x="110" y="60" width="140" height="140" fill="#3a8a64" opacity=".25" />
      <rect x="110" y="60" width="140" height="140" fill="none" stroke="#6bc8d8" strokeWidth="8" />
      <rect x="110" y="60" width="140" height="140" fill="none" stroke="#2c6a94" strokeWidth="3" />
      <path
        d="M0 170H110M250 130H300M180 0V60M180 200V300M40 300L150 200"
        stroke="#6b5a86"
        strokeWidth="7"
        fill="none"
      />
      <path
        d="M0 170H110M250 130H300M180 0V60M180 200V300M40 300L150 200"
        stroke="#8a78a8"
        strokeWidth="3"
        fill="none"
      />
      <rect x="40" y="30" width="70" height="70" fill="#4a3a6a" opacity=".5" />
      <rect x="205" y="110" width="40" height="40" fill="#5a3a30" opacity=".6" />
    </svg>
  );
}

export function MapPage() {
  const player = useGame((s) => s.player)!;
  const dispatch = useGame((s) => s.dispatch);
  const toast = useGame((s) => s.toast);
  const newGame = useGame((s) => s.newGame);
  const [sure, setSure] = useState(false);
  const [selId, setSelId] = useState(player.farm.districtId);
  const sets = new Set(completedSets(player, cfg));
  const farming = player.farm.districtId;
  const noHome = player.homeDistrictId === null;
  const cooldown = homeCooldownDays(player, useNow(), cfg);
  const sel = cfg.districts.find((d) => d.id === selId) ?? cfg.districts[0]!;
  const cleared = player.progress[sel.id] ?? 0;
  const frontier = Math.min(cleared + 1, sel.stageCount);
  const isFarming = farming === sel.id;
  const [stage, setStage] = useState<number | null>(null);
  const chosen = Math.min(stage ?? (isFarming ? player.farm.stage : frontier), frontier);

  const hardOf = (id: string) => {
    const probe = { ...player, farm: { ...player.farm, districtId: id, stage: 1 } };
    return farmStatus(probe, cfg).stuck;
  };

  const farm = async (districtId: string, st: number) => {
    const r = await dispatch({ t: 'setFarm', districtId, stage: st });
    if (r.ok) {
      toast(t('map.farmChanged', { name: nm('districts', districtId), n: st }), 'good');
      useGame.getState().setPage('farm');
    } else toast(t('toast.error'), 'bad');
  };

  const setHome = async (districtId: string) => {
    const r = await dispatch({ t: 'chooseHome', districtId });
    if (r.ok) toast(t('home.chosen', { name: nm('districts', districtId) }), 'good');
    else if (r.reason === 'cooldown') toast(t('home.cooldownToast', { n: cooldown }), 'bad');
    else toast(t('toast.error'), 'bad');
  };

  return (
    <div className="page">
      <h1 className="title-lg">{t('map.title')}</h1>
      {noHome && (
        <Panel title={t('home.pickTitle')}>
          <p className="muted small">{t('home.pickSub')}</p>
        </Panel>
      )}

      <div className="mapwrap">
        <MapSketch />
        {cfg.districts.map((d) => {
          const p = PINS[d.id] ?? { x: 190, y: 150 };
          const hard = hardOf(d.id);
          return (
            <button
              key={d.id}
              className={`pin ${selId === d.id ? 'sel' : ''}`}
              style={{ left: `${(p.x / 382) * 100}%`, top: `${(p.y / 300) * 100}%` }}
              onClick={() => {
                setSelId(d.id);
                setStage(null);
              }}
              aria-pressed={selId === d.id}
            >
              <span className="lbl">{nm('districts', d.id)}</span>
              <span className="gem" style={{ background: GEM[d.element] }} />
              <span className="chip" style={{ fontSize: 12 }}>
                {farming === d.id ? t('map.here') : hard ? t('map.tough') : t('map.ok')}
              </span>
            </button>
          );
        })}
        <span className="chip" style={{ position: 'absolute', left: 4, bottom: 4, fontSize: 12 }}>
          {t('map.sketch')}
        </span>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h2 style={{ fontSize: 20 }}>{nm('districts', sel.id)}</h2>
          <div className="panel-aside">
            {player.homeDistrictId === sel.id && <span className="chip hot">{t('map.home')}</span>}
            <span className="chip" style={{ color: GEM[sel.element] }}>
              {nm('elements', sel.element)}
            </span>
          </div>
        </div>
        <p className="muted small">{t('map.cleared', { n: cleared, total: sel.stageCount })}</p>
        {sets.has(sel.id) && <p className="note good">{t('map.setBonus')}</p>}
        {hardOf(sel.id) && !isFarming && <p className="note warn">{t('map.hard')}</p>}
        <div className="stg" role="group" aria-label={t('map.pickStage')}>
          {Array.from(
            { length: Math.min(frontier, 12) },
            (_, i) => frontier - Math.min(frontier, 12) + 1 + i,
          ).map((n) => (
            <button
              key={n}
              className={n <= cleared ? 'done' : ''}
              style={
                n === chosen ? { outline: '3px solid var(--amber)', outlineOffset: 2 } : undefined
              }
              onClick={() => setStage(n)}
              aria-label={t('map.stage', { n })}
              aria-pressed={n === chosen}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="bestiary">
          {sel.monsters.map((m) => {
            const n = player.bestiary[m.id] ?? 0;
            return (
              <div key={m.id} className={`mon ${n ? '' : 'unseen'}`}>
                <MonsterSprite id={m.id} size={48} />
                <span className="small">{n ? nm('monsters', m.id) : t('map.unknown')}</span>
                <span className="muted small">
                  {n ? t('map.seen', { n }) : getMonster(cfg, m.id).element ? '' : ''}
                </span>
              </div>
            );
          })}
        </div>
        <button
          className={`btn ${isFarming && player.farm.stage === chosen ? '' : 'primary'}`}
          onClick={() => farm(sel.id, chosen)}
          disabled={isFarming && player.farm.stage === chosen}
        >
          {isFarming && player.farm.stage === chosen
            ? t('map.farming')
            : `${t('map.farmHere')} · ${t('map.stage', { n: chosen })}`}
        </button>
        {player.homeDistrictId !== sel.id && (
          <button
            className="btn small"
            disabled={!noHome && cooldown > 0}
            onClick={() => setHome(sel.id)}
          >
            {noHome
              ? t('home.set')
              : cooldown > 0
                ? t('home.cooldown', { n: cooldown })
                : t('home.change')}
          </button>
        )}
      </section>

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
