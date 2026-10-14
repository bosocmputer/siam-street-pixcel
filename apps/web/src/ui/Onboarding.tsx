import { useEffect, useState } from 'react';
import { defaultConfig as cfg, getMonster, getSkill } from '@slimehood/game-core';
import { useGame } from '../game/store';
import { nm, t } from '../i18n/t';
import { ELEMENT_COLORS } from '../art/draw';
import { MonsterSprite, SlimeSprite } from './common';

type Step = 'egg' | 'home' | 'first';

/** The first minute: hatch -> choose "ย่านเรา" -> first monster -> absorb -> go farm. */
export function Onboarding() {
  const [step, setStep] = useState<Step>('egg');
  const [home, setHome] = useState<string | null>(null);
  return (
    <main className="onboard">
      {step === 'egg' && <Egg onDone={() => setStep('home')} />}
      {step === 'home' && (
        <PickHome
          onPick={async (id) => {
            setHome(id);
            await useGame.getState().createPlayer(id);
            setStep('first');
          }}
        />
      )}
      {step === 'first' && home && <FirstMonster home={home} />}
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

function PickHome({ onPick }: { onPick: (id: string) => void }) {
  const [sel, setSel] = useState<string | null>(null);
  return (
    <section className="onboard-card">
      <h1 className="title-lg">{t('home.title')}</h1>
      <p className="lead">{t('home.sub')}</p>
      <div className="district-grid">
        {cfg.districts.map((d) => (
          <button
            key={d.id}
            className={`district-card ${sel === d.id ? 'sel' : ''}`}
            style={{ ['--accent' as string]: ELEMENT_COLORS[d.element].body }}
            onClick={() => setSel(d.id)}
            aria-pressed={sel === d.id}
          >
            <span className="district-name">{nm('districts', d.id)}</span>
            <span className="district-el">
              {t('home.element', { name: nm('elements', d.element) })}
            </span>
          </button>
        ))}
      </div>
      <button className="btn primary big" disabled={!sel} onClick={() => sel && onPick(sel)}>
        {t('home.pick')}
      </button>
    </section>
  );
}

function FirstMonster({ home }: { home: string }) {
  const player = useGame((s) => s.player);
  const dispatch = useGame((s) => s.dispatch);
  const [grew, setGrew] = useState<string | null>(null);
  const monster = getMonster(
    cfg,
    cfg.districts.find((d) => d.id === home)?.monsters[0]?.id ?? 'brick_imp',
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
