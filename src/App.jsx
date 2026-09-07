// src/App.jsx — the shell: masthead, toolbar, banner, now & next, the list or grid by view, footer, sheet.
import Masthead from './ui/Masthead.jsx';
import Toolbar from './ui/Toolbar.jsx';
import Banner from './ui/Banner.jsx';
import NowNext from './ui/NowNext.jsx';
import EventList from './ui/EventList.jsx';
import EventGrid from './ui/EventGrid.jsx';
import Footer from './ui/Footer.jsx';
import Sheet from './ui/Sheet.jsx';
import {usePlanner} from './store/planner.js';
import {useFiltered} from './ui/useFiltered.js';

export default function App(){
  const view = usePlanner(s => s.view);
  const {list, clashes} = useFiltered();

  return (
    <>
      <Masthead />
      <Toolbar clashes={clashes} shown={list.length} />
      <Banner />
      <NowNext />
      <main id="main">
        {view === 'grid' ? <EventGrid list={list} clashes={clashes} /> : <EventList list={list} clashes={clashes} />}
      </main>
      <Footer />
      <Sheet />
    </>
  );
}
