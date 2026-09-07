import {createRoot} from 'react-dom/client';
import './styles/app.css';
import App from './App.jsx';
import {boot, onHashChange} from './routing.js';

createRoot(document.getElementById('app')).render(<App />);
boot();
window.addEventListener('hashchange', onHashChange);
