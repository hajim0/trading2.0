import React, { useState } from 'react';
import { Transaction, Tag } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, Calendar, TrendingUp, TrendingDown, Star, DollarSign, ArrowLeft, Maximize2, Trash2, Sparkles, Loader2, ShieldCheck, Check, ShieldAlert } from 'lucide-react';
import { cn, safeFormat } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface TransactionDetailProps {
  transaction: Transaction;
  allTags: Tag[];
  onClose: () => void;
  onEdit: (t: Transaction) => void;
  onDelete: (id: string) => void;
}

import { auth } from '../firebase';

// --- Helper Components ---
const InfoItem = ({ label, value, icon: Icon, color }: any) => (
  <div className="space-y-1">
    <div className="flex items-center gap-1.5 text-[#3A3A3A]">
      <Icon size={12} />
      <span className="text-[10px] uppercase tracking-widest font-black">{label}</span>
    </div>
    <div className={cn("text-sm font-black tracking-tighter", color)}>{value}</div>
  </div>
);

const ActivityIcon = ({ size, className }: any) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
  </svg>
);

export const TransactionDetail: React.FC<TransactionDetailProps> = ({
  transaction,
  allTags,
  onClose,
  onEdit,
  onDelete,
}) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-[#22C55E]";
    if (score >= 70) return "text-yellow-500";
    if (score >= 50) return "text-[#EF4444]";
    return "text-[#EF4444]";
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onClose} className="text-[#A0A0A0] hover:text-white gap-2">
          <ArrowLeft size={16} /> 返回列表
        </Button>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => onDelete(transaction.id)} 
            className="border-[#EF4444]/30 text-[#EF4444] hover:bg-[#EF4444]/10"
          >
            <Trash2 size={16} className="mr-2" /> 刪除紀錄
          </Button>
          <Button variant="outline" size="sm" onClick={() => onEdit(transaction)} className="border-[#2A2A2A]">
            編輯紀錄
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2 bg-[#1A1A1A] border-[#2A2A2A]">
          <CardHeader className="border-b border-[#2A2A2A] flex flex-row items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-2xl font-black tracking-tighter uppercase">{transaction.symbol}</CardTitle>
              <div className="flex items-center gap-2 text-[#A0A0A0] text-xs font-mono">
                <Calendar size={12} />
                {safeFormat(transaction.date, 'yyyy年MM月dd日')}
              </div>
            </div>
            <div className={cn(
              "px-4 py-2 rounded-lg border font-mono text-lg font-black tracking-tighter",
              transaction.result === 'Profit' ? 'text-[#22C55E] border-[#22C55E]/20 bg-[#22C55E]/5' :
              transaction.result === 'Loss' ? 'text-[#EF4444] border-[#EF4444]/20 bg-[#EF4444]/5' :
              'text-[#A0A0A0] border-[#2A2A2A] bg-black'
            )}>
              {transaction.result === 'Profit' ? '+' : transaction.result === 'Loss' ? '-' : ''}
              {Math.abs(transaction.uValue).toLocaleString()} u
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-8">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
              <InfoItem 
                label="方向" 
                value={transaction.side === 'Long' ? '多 (LONG)' : '空 (SHORT)'} 
                icon={transaction.side === 'Long' ? TrendingUp : TrendingDown}
                color={transaction.side === 'Long' ? 'text-[#22C55E]' : 'text-[#EF4444]'}
              />
              <InfoItem 
                label="評分" 
                value={`等級 ${transaction.rating}`} 
                icon={Star}
                color="text-white"
              />
                <InfoItem 
                  label="狀態" 
                  value={transaction.result === 'Profit' ? '盈利' : transaction.result === 'Loss' ? '虧損' : '進行中'} 
                  icon={ActivityIcon}
                  color={transaction.result === 'Profit' ? 'text-[#22C55E]' : transaction.result === 'Loss' ? 'text-[#EF4444]' : 'text-[#A0A0A0]'}
                />
              <InfoItem 
                label="數值" 
                value={`${transaction.uValue} u`} 
                icon={DollarSign}
                color="text-white font-mono"
              />
            </div>

            <div className="space-y-6">
              {transaction.checklistScore !== undefined && transaction.checklistSnapshot && transaction.checklistSnapshot.length > 0 && (
                <section className="space-y-4 p-4 rounded-xl bg-primary/10 border border-[#2A2A2A]">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[10px] uppercase tracking-[0.2em] text-primary font-extrabold flex items-center gap-2">
                      <ShieldCheck size={14} /> 出手前紀律核對
                    </h3>
                    <div className="flex items-center gap-4">
                      {transaction.forceSubmit && (
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-red-500 text-[9px] font-black uppercase">
                          <ShieldAlert size={10} /> 違規強制提交
                        </div>
                      )}
                      <div className={cn("text-lg font-black font-mono", getScoreColor(transaction.checklistScore))}>
                        {transaction.checklistScore}%
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {transaction.checklistSnapshot.map((item, idx) => (
                      <div key={`snapshot-${idx}`} className="flex items-center gap-2 text-xs">
                        <div className={cn(
                          "w-4 h-4 rounded flex items-center justify-center",
                          item.checked ? "bg-primary text-white" : "border border-neutral-300 text-transparent"
                        )}>
                          <Check size={10} strokeWidth={4} />
                        </div>
                        <span className={cn(item.checked ? "text-foreground font-medium" : "text-neutral-400")}>
                          {item.text}
                          {item.required && <span className="ml-1 text-[8px] text-red-500 opacity-70">(必)</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {transaction.tagIds && transaction.tagIds.length > 0 && (
                <section className="space-y-2">
                  <h3 className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-bold">市場特徵與技術訊號 (Signals)</h3>
                  <div className="flex flex-wrap gap-2">
                    {transaction.tagIds.map((id, idx) => {
                      const tag = allTags.find(t => t.id === id);
                      if (!tag) return null;
                      return (
                        <span key={`${transaction.id}-${id}-${idx}`} className="px-3 py-1 bg-neutral-100 dark:bg-neutral-800 text-xs rounded-full border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400">
                          {tag.name}
                        </span>
                      );
                    })}
                  </div>
                </section>
              )}

              <section className="space-y-2">
                <h3 className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-bold">進場理由</h3>
                <p className="text-sm text-black leading-relaxed bg-white p-4 rounded-lg border border-neutral-200">
                  {transaction.entryReason || '未填寫'}
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-bold">止損計畫 / 原因</h3>
                <p className="text-sm text-black leading-relaxed bg-white p-4 rounded-lg border border-neutral-200">
                  {transaction.stopLossReason || '未填寫'}
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-bold">復盤總結</h3>
                <p className="text-sm text-black leading-relaxed bg-white p-4 rounded-lg border border-neutral-200">
                  {transaction.review || '未填寫'}
                </p>
              </section>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="bg-card border-border">
            <CardHeader className="p-4 border-b border-border">
              <CardTitle className="text-xs uppercase tracking-widest text-neutral-500">交易截圖</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {transaction.screenshots.length > 0 ? (
                <div className="grid grid-cols-1 gap-4">
                  {transaction.screenshots.map((src, i) => (
                    <div key={`screenshot-${i}`} className="relative group rounded-lg overflow-hidden border border-neutral-800 cursor-zoom-in" onClick={() => setSelectedImage(src)}>
                      <img src={src} alt={`Screenshot ${i}`} className="w-full h-auto" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Maximize2 size={24} className="text-white" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-10 text-center text-neutral-600 text-xs uppercase tracking-tighter">
                  無截圖
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4 md:p-10"
            onClick={() => setSelectedImage(null)}
          >
            <button className="absolute top-6 right-6 text-white/50 hover:text-white">
              <X size={32} />
            </button>
            <motion.img
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              src={selectedImage}
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
