// src/App.jsx — the shell: masthead, toolbar, banner, now & next, the list or grid by view, footer, sheet.
import {useEffect} from 'react';
import Masthead from './ui/Masthead.jsx';
import Toolbar from './ui/Toolbar.jsx';
import Banner from './ui/Banner.jsx';
import NowNext from './ui/NowNext.jsx';
import EventList from './ui/EventList.jsx';
import EventGrid from './ui/EventGrid.jsx';
import Footer from './ui/Footer.jsx';
import Sheet from './ui/Sheet.jsx';
import {usePlanner} from './store/planner.js';
import {useSheet} from './store/sheet.js';
import {useFiltered} from './ui/useFiltered.js';

// Preview channels only: firebase-hosting-pull-request.yml builds with VITE_PREVIEW="PR #12", and this
// says so in the corner so a preview is never mistaken for the live site. The robots tag is added from
// here rather than sitting in index.html because index.html is the live page too. In a live build
// import.meta.env.VITE_PREVIEW is undefined, the ribbon and the tag are both absent, and the CSS for
// .previewtag is a single unused rule.
function PreviewTag(){
  const preview = import.meta.env.VITE_PREVIEW;
  useEffect(() => {
    if (!preview) return undefined;
    const meta = document.createElement('meta');
    meta.setAttribute('name', 'robots');
    meta.setAttribute('content', 'noindex');
    document.head.appendChild(meta);
    return () => meta.remove();
  }, [preview]);
  if (!preview) return null;
  return <div className="previewtag" role="note">Preview build · {preview} · not the live site</div>;
}

export default function App(){
  const view = usePlanner(s => s.view);
  const sheetOpen = useSheet(s => s.stack.length > 0);
  const {list, clashes} = useFiltered();

  return (
    <>
      <a className="skip-link" href="#main">Skip to programme</a>
      <Masthead />
      <Toolbar clashes={clashes} shown={list.length} />
      {!sheetOpen && <Banner />}
      <NowNext />
      <main id="main" tabIndex={-1} aria-label="Festival programme">
        {view === 'grid' ? <EventGrid list={list} clashes={clashes} /> : <EventList list={list} clashes={clashes} />}
      </main>
      <Footer />
      <Sheet />
      <PreviewTag />
    </>
  );
}
