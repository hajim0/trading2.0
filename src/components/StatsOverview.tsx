import React, { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { TradeStats } from '../types';
import { TrendingUp, TrendingDown, Activity, Target, ShieldAlert, Flame, Scale, Rocket, Banknote } from 'lucide-react';
import { motion } from 'motion/react';

interface StatsOverviewProps {
  stats: TradeStats;
}

const StreakIcon = ({ type, count }: { type: 'Profit' | 'Loss' | 'None', count: number }) => {
  if (type === 'None' || count === 0) return null;

  const level = Math.min(Math.floor((count - 1) / 3) + 1, 3); // 1, 2, or 3
  
  if (type === 'Profit') {
    return (
      <div className="relative flex flex-col items-center justify-center ml-2 h-8">
        <motion.div
          animate={{ 
            y: [0, -1, 0],
          }}
          transition={{ 
            duration: 3, // Constant slow speed
            repeat: Infinity, 
            ease: "easeInOut" 
          }}
          className="z-10"
        >
          <Rocket size={16 + level * 2} className="text-orange-500 -rotate-45" />
        </motion.div>
        <motion.div
          className="w-1.5 bg-gradient-to-b from-orange-400 to-transparent rounded-full blur-[1px] -mt-1"
          animate={{ 
            height: [4, 10 + level * 6, 4],
            opacity: [0.6, 1, 0.6],
            scaleX: [1, 1.3, 1]
          }}
          transition={{ 
            duration: 0.8, // Constant slow speed
            repeat: Infinity, 
            ease: "linear" 
          }}
          style={{ transformOrigin: 'top center' }}
        />
      </div>
    );
  }

  return (
    <div className="relative flex items-center justify-center ml-2">
      <motion.div
        className="relative"
        animate={{ 
          y: [0, -4, 0],
          rotate: [0, 5, 0, -5, 0]
        }}
        transition={{ 
          duration: 3, // Constant slow speed
          repeat: Infinity, 
          ease: "easeInOut" 
        }}
      >
        <Banknote size={16 + level * 2} className="text-green-600/80" />
        {/* Left Wing */}
        <motion.div
          className="absolute -left-2 top-0"
          animate={{ rotateY: [0, 60, 0] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }} // Constant slow speed
          style={{ transformOrigin: 'right' }}
        >
          <div 
            className="bg-neutral-300 dark:bg-neutral-700 rounded-full opacity-40" 
            style={{ width: 8 + level * 2, height: 6 + level * 2, borderRadius: '100% 0 0 100%' }} 
          />
        </motion.div>
        {/* Right Wing */}
        <motion.div
          className="absolute -right-2 top-0"
          animate={{ rotateY: [0, -60, 0] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }} // Constant slow speed
          style={{ transformOrigin: 'left' }}
        >
          <div 
            className="bg-neutral-300 dark:bg-neutral-700 rounded-full opacity-40" 
            style={{ width: 8 + level * 2, height: 6 + level * 2, borderRadius: '0 100% 100% 0' }} 
          />
        </motion.div>
      </motion.div>
    </div>
  );
};

export const StatsOverview: React.FC<StatsOverviewProps> = React.memo(({ stats }) => {
  const items = useMemo(() => {
    console.log('[Perf] stats overview items recalculated');
    return [
      {
        label: '累積盈虧',
        value: `${stats.totalU > 0 ? '+' : ''}${stats.totalU.toLocaleString()} u`,
        icon: Activity,
        color: stats.totalU >= 0 ? 'text-green-500' : 'text-red-500',
      },
      {
        label: '勝率',
        value: `${(stats.winRate * 100).toFixed(1)}%`,
        icon: Target,
        color: 'text-white',
      },
      {
        label: '盈虧比',
        value: stats.profitLossRatio.toFixed(2),
        icon: Scale,
        color: stats.profitLossRatio >= 2 ? 'text-green-400' : stats.profitLossRatio >= 1 ? 'text-white' : 'text-red-400',
      },
      {
        label: '最大回撤',
        value: `${stats.maxDrawdown.toFixed(2)}%`,
        icon: ShieldAlert,
        color: 'text-orange-500',
      },
      {
        label: stats.currentStreakType === 'Loss' ? '當前連敗' : '當前連勝',
        value: (
          <div className="flex items-center w-full">
            <span>{stats.currentStreak} 次</span>
            <div className="flex-1 flex justify-center pr-6">
              <StreakIcon type={stats.currentStreakType} count={stats.currentStreak} />
            </div>
          </div>
        ),
        icon: stats.currentStreakType === 'Loss' ? TrendingDown : Flame,
        color: stats.currentStreakType === 'Loss' ? 'text-red-500' : 'text-green-500',
      },
    ];
  }, [stats]);

  console.log('[Perf] heavy component rendered: StatsOverview');

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {items.map((item, i) => (
        <Card key={`stat-${i}-${item.label}`} className="bg-card border-border relative overflow-hidden">
          <CardContent className="p-4 flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium">
                {item.label}
              </span>
              <item.icon size={14} className="text-neutral-600" />
            </div>
            <div className={`text-xl font-mono font-bold ${item.color}`}>
              {item.value}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
});
