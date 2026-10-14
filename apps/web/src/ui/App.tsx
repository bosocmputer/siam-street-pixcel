import { useEffect } from 'react';
import { useGame, type Page } from '../game/store';
import { loadArtOverrides } from '../art';
import { t } from '../i18n/t';
import { BagPage } from './BagPage';
import { FarmPage, ReportDialog, tipsFor } from './FarmPage';
import { MapPage } from './MapPage';
import { Onboarding } from './Onboarding';
import { SkillsPage } from './SkillsPage';
import { SlimePage } from './SlimePage';

const TABS: { id: Page; icon: string }[] = [
  { id: 'farm', icon: '⚔' },
  { id: 'slime', icon: '●' },
  { id: 'skills', icon: '✦' },
  { id: 'bag', icon: '▣' },
  { id: 'map', icon: '⌖' },
];

export function App() {
  const ready = useGame((s) => s.ready);
  const player = useGame((s) => s.player);
  const intro = useGame((s) => s.intro);
  const page = useGame((s) => s.page);
  const report = useGame((s) => s.report);
  const toasts = useGame((s) => s.toasts);

  useEffect(() => {
    void (async () => {
      await loadArtOverrides();
      await useGame.getState().boot();
    })();
  }, []);

  if (!ready) return <div className="boot">{t('app.loading')}</div>;
  if (!player || intro) return <Onboarding />;

  const tips = tipsFor(player);
  const dot: Partial<Record<Page, boolean>> = {
    slime: tips.points > 0 || tips.evolve,
    skills: tips.cores > 0 || tips.awaken > 0,
  };

  return (
    <div className="shell">
      <main className="content">
        {page === 'farm' && <FarmPage />}
        {page === 'slime' && <SlimePage />}
        {page === 'skills' && <SkillsPage />}
        {page === 'bag' && <BagPage />}
        {page === 'map' && <MapPage />}
      </main>
      <nav className="tabbar" aria-label={t('a11y.menu')}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`tab ${page === tab.id ? 'active' : ''}`}
            onClick={() => useGame.getState().setPage(tab.id)}
            aria-current={page === tab.id ? 'page' : undefined}
          >
            <span className="tab-icon" aria-hidden="true">
              {tab.icon}
            </span>
            <span>{t(`nav.${tab.id}`)}</span>
            {dot[tab.id] && <i className="dot" aria-label={t('a11y.todo')} />}
          </button>
        ))}
      </nav>
      <div className="toasts" aria-live="polite">
        {toasts.map((x) => (
          <div key={x.id} className={`toast ${x.tone}`}>
            {x.text}
          </div>
        ))}
      </div>
      {report && <ReportDialog report={report} onClose={() => useGame.getState().closeReport()} />}
    </div>
  );
}
