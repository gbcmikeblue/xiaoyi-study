import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';
import { primeSpeech } from './lib/speech';
import { preloadAudioMap } from './lib/audioMap';

// 浏览器里已有地址栏与工具栏，安全区改由 CSS 按环境收窄
const isNative = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } })
  .Capacitor?.isNativePlatform?.();
if (!isNative) {
  document.documentElement.classList.add('is-web');
}

primeSpeech();
preloadAudioMap();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
