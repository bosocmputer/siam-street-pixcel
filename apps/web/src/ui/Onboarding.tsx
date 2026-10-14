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
import { LookSprite, MonsterSprite, SlimeSprite } from './common';

type Step = 'egg' | 'create' | 'first';

/** The first minute: hatch -> make your slime -> first monster -> absorb -> go farm. */
export function Onboarding() {
  const [step, setStep] = useState<Step>('egg');
  return (
    <main className="onboard">
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
      <h1 className="title-xl">{t('app.name')}</h1>
      <button
        className={`egg ${phase}`}
        onClick={() => phase === 'idle' && setPhase('cracking')}
        aria-label={t('egg.tap')}
      >
        <span className="egg-shell" />
        <span className="egg-slime" />
      </button>
      <p className="lead">
        {phase === 'idle'
          ? t('egg.tap')
          : phase === 'cracking'
            ? t('egg.cracking')
            : t('egg.hatched')}
      </p>
      <p className="muted">{t('egg.hint')}</p>
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
      <h1 className="title-lg">{t('creator.title')}</h1>
      <p className="lead">{t('creator.sub')}</p>
      <div className="creator-preview">
        <LookSprite look={look} size={160} />
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
          <button type="button" className="btn" onClick={() => setName(randomName())}>
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
      <h1 className="title-lg">{t('first.title')}</h1>
      <p className="lead">{t('first.sub')}</p>
      <div className="duel">
        <SlimeSprite player={player} size={120} />
        {!grew && <MonsterSprite id={monster.id} size={120} />}
      </div>
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
        <>
          <p className="lead good">{t('first.grew', { skill: nm('skills', grew) })}</p>
          <button className="btn primary big" onClick={() => useGame.getState().endIntro()}>
            {t('first.go')}
          </button>
        </>
      )}
    </section>
  );
}
