import React, { useMemo } from 'react';
import { Transaction } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { cn, getLocalDateString } from '@/lib/utils';

interface ProfitCalendarProps {
  transactions: Transaction[];
}

export const ProfitCalendar: React.FC<ProfitCalendarProps> = React.memo(({ transactions }) => {
  // Group transactions by date and calculate daily profit/loss
  const dailyStats = useMemo(() => {
    console.log('[Perf] daily stats recalculated for calendar');
    return transactions.reduce((acc, t) => {
      const dateStr = t.date.split('T')[0];
      if (!acc[dateStr]) {
        acc[dateStr] = 0;
      }
      const val = t.result === 'Loss' ? -Math.abs(t.uValue) : Math.abs(t.uValue);
      acc[dateStr] += val;
      return acc;
    }, {} as Record<string, number>);
  }, [transactions]);

  return (
    <Card className="bg-card border-border overflow-hidden">
      <CardHeader className="border-b border-border py-4">
        <CardTitle className="text-xs uppercase tracking-[0.2em] text-neutral-500 font-bold">
          盈虧日曆 (Profit & Loss Calendar)
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 flex justify-center">
        <Calendar
          mode="single"
          className="p-0"
          modifiers={{
            profit: (date) => {
              const dateStr = getLocalDateString(date);
              return dailyStats[dateStr] > 0;
            },
            loss: (date) => {
              const dateStr = getLocalDateString(date);
              return dailyStats[dateStr] < 0;
            }
          }}
          modifiersClassNames={{
            profit: "bg-green-500/20 text-green-500 font-bold rounded-md",
            loss: "bg-red-500/20 text-red-500 font-bold rounded-md"
          }}
          components={{
            DayButton: ({ day, modifiers, ...props }: any) => {
              const dateStr = getLocalDateString(day.date);
              const profit = dailyStats[dateStr];
              
              return (
                <div className="relative group/day-cell w-full h-full flex items-center justify-center p-0.5">
                  <button
                    {...props}
                    className={cn(
                      "w-10 h-10 rounded-md text-xs transition-colors flex flex-col items-center justify-between py-1 relative",
                      modifiers.profit && "bg-green-500/10 text-green-600 dark:text-green-400 font-bold border border-green-500/40",
                      modifiers.loss && "bg-red-500/10 text-red-600 dark:text-red-400 font-bold border border-red-500/40",
                      !modifiers.profit && !modifiers.loss && "hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    )}
                  >
                    <span className="text-[10px] opacity-50 self-start px-1">{day.date.getDate()}</span>
                    <div className="flex-1 flex items-center justify-center w-full">
                      {profit !== undefined && (
                        <span className={cn(
                          "text-[9px] font-mono leading-none",
                          profit > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                        )}>
                          {profit > 0 ? '+' : ''}{Math.round(profit)}
                        </span>
                      )}
                    </div>
                  </button>
                </div>
              );
            }
          }}
        />
      </CardContent>
      <div className="px-6 pb-4 flex gap-4 text-[10px] uppercase tracking-widest text-neutral-500">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-green-500/30" /> 盈利日
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-red-500/30" /> 虧損日
        </div>
      </div>
    </Card>
  );
});
