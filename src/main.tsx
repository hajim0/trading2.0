import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';
import { toast } from 'sonner';

// Register service worker
registerSW({ 
  immediate: false,
  onNeedRefresh() {
    toast('有新版本可用', {
      description: '建議立即更新以獲取最新功能與安全性修正。',
      action: {
        label: '立即更新',
        onClick: () => location.reload()
      },
      duration: Infinity,
    });
  },
  onOfflineReady() {
    toast.success('已就緒，可以離線使用', {
      description: '您的交易紀錄將在網路恢復後自動同步。'
    });
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
