import React from 'react';
import { ShieldCheck, Zap, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'motion/react';

interface PaywallProps {
  title: string;
  description: string;
  onUpgrade?: () => void;
}

export const Paywall: React.FC<PaywallProps> = ({ title, description, onUpgrade }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center p-12 text-center space-y-8 bg-card border border-border rounded-3xl shadow-2xl max-w-2xl mx-auto my-12"
    >
      <div className="relative">
        <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center">
          <Lock size={48} className="text-primary" />
        </div>
        <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground p-2 rounded-full shadow-lg">
          <Zap size={20} fill="currentColor" />
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-3xl font-black tracking-tight uppercase">{title}</h2>
        <p className="text-neutral-500 text-lg max-w-md mx-auto">
          {description}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-md">
        <div className="p-4 bg-neutral-900/50 rounded-2xl border border-border flex items-center gap-3 text-left">
          <ShieldCheck className="text-green-500 shrink-0" size={20} />
          <span className="text-sm font-medium">解鎖進階標籤管理</span>
        </div>
        <div className="p-4 bg-neutral-900/50 rounded-2xl border border-border flex items-center gap-3 text-left">
          <Zap className="text-primary shrink-0" size={20} />
          <span className="text-sm font-medium">深度策略勝率分析</span>
        </div>
      </div>

      <Button 
        size="lg" 
        className="w-full max-w-xs h-14 rounded-2xl text-lg font-bold shadow-xl hover:scale-105 transition-transform"
        onClick={onUpgrade}
      >
        立即升級 Pro 會員
      </Button>
      
      <p className="text-xs text-neutral-600">
        升級後即可立即解鎖所有專業交易分析工具
      </p>
    </motion.div>
  );
};
