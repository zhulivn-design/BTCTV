import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ToastProvider } from './components/Toast.tsx';

if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const reasonStr = String(event.reason?.message || event.reason || '');
    if (reasonStr.includes('WebSocket') || reasonStr.includes('vite')) {
      event.preventDefault();
      event.stopPropagation();
    }
  });

  window.addEventListener(
    'error',
    (event) => {
      const msg = String(event.message || '');
      if (msg.includes('WebSocket') || msg.includes('[vite]')) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
    true
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>,
);

