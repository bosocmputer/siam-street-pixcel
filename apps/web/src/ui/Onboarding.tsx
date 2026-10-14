import { useEffect, useState } from 'react';
import {
  defaultConfig as cfg,
  getMonster,
  getSkill,
  STARTING_FARM_DISTRICT,
  type SlimeLook,
} from '@slimehood/game-core';
import { useGame } from '../game/store';
import { nm, t } from '../i18n/t';
import { LOOK_COLORS } from '../art/draw';
import { dataUrl } from '../art';
import { sceneCanvas } from '../art/scene';
import { LookSprite, MonsterSprite, SlimeSprite } from './common';

type Step = 'egg' | 'create' | 'first';

/** The first minute: hatch -> make your slime -> first monster -> absorb -> go farm. */
export function Onboarding() {
  const [step, setStep] = useState<Step>('egg');
  return (
    <main className="onboard">
      <img
        className="onboard-bg px"
        src={dataUrl(sceneCanvas('earth', 130, 281, 3))}
        alt=""
        aria-hidden="true"
      />
      <div className="onboard-glow" aria-hidden="true" />
      {step === 'egg' && <Egg onDone={() => setStep('create')} />}
      {step === 'create' && (
        <Creator
          onDone={async (profile) => {
            await useGame.getState().createPlayer(profile);
            setStep('first');
          }}
        />
      )}
      {step === 'first' && <FirstMonster />}
    </main>
  );
}

function Egg({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<'idle' | 'cracking' | 'hatched'>('idle');
  useEffect(() => {
    if (phase === 'cracking') {
      const id = setTimeout(() => setPhase('hatched'), 900);
      return () => clearTimeout(id);
    }
    if (phase === 'hatched') {
      const id = setTimeout(onDone, 900);
      return () => clearTimeout(id);
    }
  }, [phase, onDone]);
  return (
    <section className="onboard-card">
      <div style={{ paddingTop: 36 }}>
        <p className="brand">{t('app.brand')}</p>
        <h1 className="title-xl">{t('app.name')}</h1>
      </div>
      <div className="spacer" />
      <button
        className={`egg ${phase}`}
        onClick={() => phase === 'idle' && setPhase('cracking')}
        aria-label={t('egg.tap')}
      >
        <svg viewBox="0 0 80 100" shapeRendering="crispEdges" aria-hidden="true">
          <ellipse cx="40" cy="96" rx="30" ry="5" fill="rgba(0,0,0,.35)" />
          <path
            d="M40 4 C14 4 6 44 6 64 C6 84 22 94 40 94 C58 94 74 84 74 64 C74 44 66 4 40 4Z"
            fill="#0b0a1c"
          />
          <path
            d="M40 8 C18 8 10 46 10 64 C10 82 24 90 40 90 C56 90 70 82 70 64 C70 46 62 8 40 8Z"
            fill="#f2ead8"
          />
          <path
            d="M40 8 C18 8 10 46 10 64 C10 70 12 74 14 76 C30 56 58 80 66 74 C69 70 70 66 70 64 C70 46 62 8 40 8Z"
            fill="#e6dcc4"
          />
          <circle cx="30" cy="62" r="4" fill="#8fe8c0" />
          <circle cx="52" cy="50" r="3" fill="#8fe8c0" />
          <circle cx="46" cy="72" r="5" fill="#8fe8c0" />
          {phase !== 'idle' && (
            <path
              d="M16 40 L30 46 L40 38 L52 48 L64 40"
              stroke="#0b0a1c"
              strokeWidth="3"
              fill="none"
            />
          )}
        </svg>
      </button>
      <i className="sparkle" style={{ left: '22%', top: '46%' }} />
      <i className="sparkle" style={{ right: '20%', top: '52%', animationDelay: '0.6s' }} />
      <i className="sparkle" style={{ right: '30%', top: '40%', animationDelay: '1.1s' }} />
      <div className="spacer" />
      <p className="title-lg pulse" style={{ textShadow: '3px 3px 0 #000' }}>
        {phase === 'idle'
          ? t('egg.tap')
          : phase === 'cracking'
            ? t('egg.cracking')
            : t('egg.hatched')}
      </p>
      <p className="muted small">{t('egg.hint')}</p>
      <div style={{ height: 36 }} />
    </section>
  );
}

const NAME_COUNT = 10;
const randomName = () => nm('names', `n${Math.floor(Math.random() * NAME_COUNT)}`);

function Creator({ onDone }: { onDone: (p: { name: string; look: SlimeLook }) => void }) {
  const [name, setName] = useState(randomName);
  const [color, setColor] = useState(cfg.looks.colors[0] ?? 'mint');
  const [eyes, setEyes] = useState(0);
  const [busy, setBusy] = useState(false);
  const look = { color, eyes };
  return (
    <section className="onboard-card">
      <h1 className="title-lg" style={{ paddingTop: 20, textShadow: '3px 3px 0 #000' }}>
        {t('creator.title')}
      </h1>
      <p className="muted small" style={{ marginTop: -8, textAlign: 'center' }}>
        {t('creator.sub')}
      </p>
      <div className="creator-preview">
        <span className="pedestal" aria-hidden="true" />
        <LookSprite look={look} size={240} />
        <span className="creator-name">{name.trim() || t('slime.unnamed')}</span>
      </div>
      <label className="field">
        <span className="small muted">{t('creator.name')}</span>
        <div className="field-row">
          <input
            className="input"
            value={name}
            maxLength={cfg.looks.nameMaxLength}
            placeholder={t('creator.namePlaceholder')}
            onChange={(e) => setName(e.target.value)}
          />
          <button type="button" className="btn small" onClick={() => setName(randomName())}>
            {t('creator.random')}
          </button>
        </div>
      </label>
      <div className="field">
        <span className="small muted">{t('creator.color')}</span>
        <div className="swatches" role="radiogroup" aria-label={t('creator.color')}>
          {cfg.looks.colors.map((id) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={color === id}
              aria-label={nm('looks', id)}
              className={`swatch ${color === id ? 'sel' : ''}`}
              style={{ background: LOOK_COLORS[id]?.body }}
              onClick={() => setColor(id)}
            />
          ))}
        </div>
      </div>
      <div className="field">
        <span className="small muted">{t('creator.eyes')}</span>
        <div className="eye-grid" role="radiogroup" aria-label={t('creator.eyes')}>
          {Array.from({ length: cfg.looks.eyes }, (_, i) => (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={eyes === i}
              aria-label={nm('looks', `eyes${i}`)}
              className={`eye-card ${eyes === i ? 'sel' : ''}`}
              onClick={() => setEyes(i)}
            >
              <LookSprite look={{ color, eyes: i }} size={56} />
            </button>
          ))}
        </div>
      </div>
      <div className="spacer" />
      <button
        className="btn primary big"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          onDone({ name: name.trim(), look });
        }}
      >
        {t('creator.done')}
      </button>
    </section>
  );
}

function FirstMonster() {
  const player = useGame((s) => s.player);
  const dispatch = useGame((s) => s.dispatch);
  const [grew, setGrew] = useState<string | null>(null);
  const monster = getMonster(
    cfg,
    cfg.districts.find((d) => d.id === STARTING_FARM_DISTRICT)?.monsters[0]?.id ?? 'brick_imp',
  );
  if (!player) return null;
  const skill = getSkill(cfg, monster.skillId);
  return (
    <section className="onboard-card">
      <div style={{ paddingTop: 36, textAlign: 'center' }}>
        <h1 className="title-xl" style={{ fontSize: grew ? 38 : 30 }}>
          {grew ? t('first.grewTitle') : t('first.title')}
        </h1>
        <p className="lead" style={{ marginTop: 6 }}>
          {grew ? t('first.grew', { skill: nm('skills', grew) }) : t('first.sub')}
        </p>
      </div>
      <div className="spacer" />
      <div className="duel" style={{ height: 300 }}>
        <SlimeSprite player={player} size={240} />
        {!grew && <MonsterSprite id={monster.id} size={240} />}
      </div>
      <div className="spacer" />
      {!grew ? (
        <button
          className="btn primary big pulse"
          onClick={async () => {
            const r = await dispatch({ t: 'absorb', monsterId: monster.id, count: 'all' });
            if (r.ok) {
              // equip the new skill straight away so the growth part shows up
              await dispatch({ t: 'equipSkill', kind: skill.kind, index: 0, skillId: skill.id });
              setGrew(skill.id);
            }
          }}
        >
          {t('first.absorb')}
        </button>
      ) : (
        <button className="btn primary big pulse" onClick={() => useGame.getState().endIntro()}>
          {t('first.go')}
        </button>
      )}
      <div style={{ height: 24 }} />
    </section>
  );
}
