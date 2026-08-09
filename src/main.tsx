import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './ui/App';
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root')!);
const params = new URLSearchParams(window.location.search);

// Dev-only tool routes; the dynamic imports are dead code in prod builds.
if (import.meta.env.DEV && params.has('review')) {
  void import('./ui/dev/ReviewMode').then(({ ReviewMode }) => root.render(<ReviewMode />));
} else if (import.meta.env.DEV && params.has('logos')) {
  void import('./ui/dev/LogoGallery').then(({ LogoGallery }) => root.render(<LogoGallery />));
} else {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

// Offline shell (production only — the SW would fight Vite's dev server).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js');
  });
}
