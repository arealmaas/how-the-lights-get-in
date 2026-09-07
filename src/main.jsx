import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import './styles/app.css';
import App from './App.jsx';
import {boot, onHashChange} from './routing.js';
import {bootCloud} from './cloud/auth.js';

createRoot(document.getElementById('app')).render(<App />);
boot();
bootCloud();   // loads the Firebase chunk only when this device has an account, a redirect or an invite
window.addEventListener('hashchange', onHashChange);

if ('serviceWorker' in navigator) {
  registerSW({immediate: true});
}
