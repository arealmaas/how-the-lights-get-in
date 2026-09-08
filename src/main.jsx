import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import './styles/app.css';
import App from './App.jsx';
import {boot, onHashChange} from './routing.js';
import {bootCloud} from './cloud/auth.js';
import {hydrateCrewCache} from './cloud/crew.js';

hydrateCrewCache();   // the cached crew paints before the SDK loads, so a cold offline start still has one
createRoot(document.getElementById('app')).render(<App />);
bootCloud();   // loads the Firebase chunk only when this device has an account, a redirect or an invite
boot();        // after bootCloud, so a device that already has an account fails quietly rather than technically
window.addEventListener('hashchange', onHashChange);

if ('serviceWorker' in navigator) {
  registerSW({immediate: true});
}
