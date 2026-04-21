import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Transaction, Result, Rating, Side, Tag } from '../types';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Filter, ArrowUpDown, MoreVertical, Eye, Edit2, Trash2, CheckCircle2, Circle } from 'lucide-react';
import { cn, safeFormat, parseLocalDate, formatPnL, getPnLColor } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'motion/react';
import { COLORS } from '../constants';
import { logger } from '../lib/logger';

interface TransactionListProps {
  transactions: Transaction[];
  allTags: Tag[];
  onView: (t: Transaction) => void;
  onEdit: (t: Transaction) => void;
  onDelete: (id: string) => void;
  onBulkDelete?: (ids: string[]) => void;
}

interface TransactionItemProps {
  t: Transaction;
  tagMap: Map<string, string>;
  onView: (t: Transaction) => void;
  onEdit: (t: Transaction) => void;
  onDelete: (id: string) => void;
  isMultiSelectMode: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
  onEnterMultiSelect: (id: string) => void;
}

const TransactionItem = React.memo(({ 
  t, 
  tagMap, 
  onView, 
  onEdit, 
  onDelete, 
  isMultiSelectMode,
  isSelected, 
  onToggleSelect,
  onEnterMultiSelect
}: TransactionItemProps) => {
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const handleTouchStart = useCallback(() => {
    if (isMultiSelectMode) return;
    timerRef.current = setTimeout(() => {
      onEnterMultiSelect(t.id);
    }, 500);
  }, [isMultiSelectMode, onEnterMultiSelect, t.id]);

  const handleTouchEnd = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleContextMenu = (e: React.MouseEvent) => {
    if (!isMultiSelectMode) {
      e.preventDefault();
      onEnterMultiSelect(t.id);
    }
  };

  const getResultBadge = (result: Result) => {
    switch (result) {
      case 'Profit': return <span className="text-[#22C55E] font-bold">+</span>;
      case 'Loss': return <span className="text-[#EF4444] font-bold">-</span>;
      default: return <span className="text-neutral-500">.</span>;
    }
  };

  const getRatingColor = (rating: Rating) => {
    switch (rating) {
      case 'S': return 'text-[#22C55E] border-[#22C55E]';
      case 'A': return 'text-[#3B82F6] border-[#3B82F6]';
      case 'B': return 'text-[#EAB308] border-[#EAB308]';
      case 'C': return 'text-[#EF4444] border-[#EF4444]';
      default: return 'text-neutral-500 border-neutral-800';
    }
  };

  return (
    <Card 
      className={cn(
        "bg-[#1A1A1A] border-[#2A2A2A] hover:border-[#3A3A3A] transition-all cursor-pointer group relative overflow-hidden",
        isSelected && "border-blue-500 bg-blue-500/10 shadow-[0_0_15px_rgba(59,130,246,0.2)]"
      )}
      onClick={() => isMultiSelectMode ? onToggleSelect?.(t.id) : onView(t)}
      onContextMenu={handleContextMenu}
      onMouseDown={handleTouchStart}
      onMouseUp={handleTouchEnd}
      onMouseLeave={handleTouchEnd}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className={cn(
        "p-4 grid items-center gap-2 md:gap-4 transition-all duration-300",
        isMultiSelectMode 
          ? "grid-cols-[30px_100px_1fr_90px_40px] md:grid-cols-[40px_1fr_80px_80px_120px_40px_40px]" 
          : "grid-cols-[100px_1fr_90px_40px] md:grid-cols-[1fr_80px_80px_120px_40px_40px]"
      )}>
        {/* Selection Checkbox */}
        <AnimatePresence>
          {isMultiSelectMode && (
            <motion.div 
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 'auto', opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="flex items-center justify-center p-1 overflow-hidden"
              onClick={(e) => {
                e.stopPropagation();
                onToggleSelect?.(t.id);
              }}
            >
              <Checkbox 
                checked={isSelected} 
                onCheckedChange={() => onToggleSelect?.(t.id)}
                className="border-neutral-700 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* 1. Left Info Section */}
        <div className="flex items-stretch gap-4 min-w-0 order-2 md:order-1">
          <div className={cn(
            "w-1 rounded-full shrink-0",
            t.result === 'Profit' ? 'bg-[#22C55E]' : t.result === 'Loss' ? 'bg-[#EF4444]' : 'bg-[#3A3A3A]'
          )} />

          <div className="flex flex-col justify-between py-0.5 min-w-0 flex-1">
            <div className="flex flex-col mb-1.5">
              <span className="text-lg font-black tracking-tighter uppercase leading-tight truncate">{t.symbol}</span>
              <span className="text-[10px] text-[#A0A0A0] uppercase font-mono">
                {safeFormat(t.date, 'yyyy.MM.dd')}
              </span>
            </div>

            <div className="flex flex-wrap gap-1 min-h-[22px] items-center">
              {t.tagIds?.map((id, idx) => {
                const tagName = tagMap.get(id);
                if (!tagName) return null;
                return (
                  <span key={`${t.id}-${id}-${idx}`} className="text-[8px] px-1.5 py-0.5 bg-[#2A2A2A] text-[#A0A0A0] rounded border border-[#3A3A3A] whitespace-nowrap">
                    {tagName}
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        {/* 2. Side */}
        <div className="hidden md:flex flex-col items-center md:order-2">
          <span className="text-[10px] text-[#3A3A3A] uppercase tracking-widest mb-1 font-bold">方向</span>
          <span className={cn(
            "text-xs font-black tracking-tighter",
            t.side === 'Long' ? 'text-[#22C55E]' : 'text-[#EF4444]'
          )}>
            {t.side === 'Long' ? 'LONG' : 'SHORT'}
          </span>
        </div>

        {/* 3. Rating */}
        <div className="hidden md:flex flex-col items-center md:order-3">
          <span className="text-[10px] text-[#3A3A3A] uppercase tracking-widest mb-1 font-bold">評分</span>
          <div className={cn(
            "text-xs font-mono border px-2 py-0.5 rounded",
            getRatingColor(t.rating)
          )}>
            {t.rating}
          </div>
        </div>

        {/* 4. Result & Value */}
        <div className="flex flex-col items-start md:items-end order-1 md:order-4">
          <span className="text-[10px] text-[#3A3A3A] uppercase tracking-widest mb-1 font-bold">盈虧</span>
          <div className={cn(
            "text-sm font-mono font-black tabular-nums",
            getPnLColor(t.uValue)
          )}>
            {formatPnL(t.uValue)}
          </div>
        </div>

        {/* 5. Screenshot */}
        <div className="hidden md:flex items-center justify-center md:order-5">
          {t.screenshots && t.screenshots.length > 0 ? (
            <div className="w-8 h-8 rounded border border-[#2A2A2A] overflow-hidden bg-black/20">
              <img src={t.screenshots[0]} alt="Trade Screenshot" className="w-full h-full object-cover opacity-50" referrerPolicy="no-referrer" loading="lazy" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded border border-dashed border-[#2A2A2A]" />
          )}
        </div>

        {/* 6. Menu */}
        <div className="flex items-center justify-end md:order-6">
          <DropdownMenu>
            <DropdownMenuTrigger 
              className="p-1 hover:bg-[#2A2A2A] rounded transition-colors text-[#3A3A3A]"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical size={16} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-[#1A1A1A] border-[#2A2A2A]">
              <DropdownMenuItem 
                onClick={(e) => {
                  e.stopPropagation();
                  onView(t);
                }} 
                className="gap-2 text-white"
              >
                <Eye size={14} /> 詳情
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(t);
                }} 
                className="gap-2 text-white"
              >
                <Edit2 size={14} /> 編輯
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(t.id);
                }} 
                className="gap-2 text-[#EF4444] focus:text-[#EF4444]"
              >
                <Trash2 size={14} /> 刪除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </Card>
  );
});

export const TransactionList: React.FC<TransactionListProps> = React.memo(({
  transactions,
  allTags,
  onView,
  onEdit,
  onDelete,
  onBulkDelete,
}) => {
  const [search, setSearch] = useState('');
  const [filterResult, setFilterResult] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'uValue'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);

  // Click outside to clear selection
  useEffect(() => {
    if (!isMultiSelectMode) return;

    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // If the click is not on a card or anything inside the selection mode UI, exit mode
      if (!target.closest('.transaction-card') && !target.closest('.selection-toolbar')) {
        setIsMultiSelectMode(false);
        setSelectedIds(new Set());
      }
    };

    // Use a delay to prevent immediate closing when entering the mode
    const timeout = setTimeout(() => {
      document.addEventListener('click', handleGlobalClick);
    }, 100);

    return () => {
      clearTimeout(timeout);
      document.removeEventListener('click', handleGlobalClick);
    };
  }, [isMultiSelectMode]);

  // Create a tag map for O(1) lookup
  const tagMap = useMemo(() => {
    const map = new Map<string, string>();
    allTags.forEach(tag => map.set(tag.id, tag.name));
    return map;
  }, [allTags]);

  const filtered = useMemo(() => {
    logger.log('[Perf] transaction list filtered/sorted');
    return transactions
      .filter((t) => {
        const matchesSearch = t.symbol.toLowerCase().includes(search.toLowerCase());
        const matchesResult = filterResult === 'all' || t.result === filterResult;
        return matchesSearch && matchesResult;
      })
      .sort((a, b) => {
        const valA = sortBy === 'date' ? parseLocalDate(a.date).getTime() : a.uValue;
        const valB = sortBy === 'date' ? parseLocalDate(b.date).getTime() : b.uValue;
        return sortOrder === 'desc' ? valB - valA : valA - valB;
      });
  }, [transactions, search, filterResult, sortBy, sortOrder]);

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      
      // If we deselect everything, maybe we stay in mode? 
      // Requirement says "點擊空白處或按取消" clears it, so deselecting all manually stays in mode.
      return next;
    });
  }, []);

  const handleEnterMultiSelect = useCallback((id: string) => {
    setIsMultiSelectMode(true);
    setSelectedIds(new Set([id]));
  }, []);

  const handleExitMultiSelect = useCallback(() => {
    setIsMultiSelectMode(false);
    setSelectedIds(new Set());
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(t => t.id)));
    }
  }, [filtered, selectedIds.size]);

  const handleBulkDeleteAction = () => {
    if (onBulkDelete && selectedIds.size > 0) {
      onBulkDelete(Array.from(selectedIds));
      handleExitMultiSelect();
    }
  };

  return (
    <div className="space-y-4">
      <AnimatePresence mode="wait">
        {!isMultiSelectMode ? (
          <motion.div 
            key="normal-toolbar"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="flex flex-col md:flex-row gap-4 items-center justify-between"
          >
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={16} />
              <Input
                placeholder="搜尋幣種..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 bg-[#1A1A1A] border-[#2A2A2A]"
              />
            </div>
            <div className="flex gap-2 w-full md:w-auto items-center justify-end">
              <button 
                onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                className="px-3 py-2 border border-[#2A2A2A] rounded-md hover:bg-[#2A2A2A] transition-colors flex items-center gap-2 text-xs font-bold uppercase tracking-wider h-9"
              >
                <ArrowUpDown size={14} className="text-[#A0A0A0]" />
                排序
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="selection-toolbar"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="selection-toolbar flex items-center justify-between bg-[#1A1A1A] border border-blue-500/50 p-3 rounded-lg shadow-[0_0_15px_rgba(59,130,246,0.1)]"
          >
            <div className="flex items-center gap-4">
              <div className="flex items-center bg-[#2A2A2A] rounded-md px-3 h-9">
                <Checkbox 
                  checked={selectedIds.size === filtered.length && filtered.length > 0} 
                  onCheckedChange={handleSelectAll}
                  className="border-neutral-700 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 mr-2"
                />
                <span className="text-xs font-bold text-white">全選</span>
              </div>
              <span className="text-sm font-bold text-blue-400">
                已選 {selectedIds.size} 筆
              </span>
            </div>
            
            <div className="flex gap-2">
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={handleBulkDeleteAction}
                disabled={selectedIds.size === 0}
                className="h-9 px-4 font-bold bg-[#EF4444] hover:bg-[#EF4444]/80 text-white disabled:opacity-50"
              >
                <Trash2 size={14} className="mr-2" />
                刪除
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleExitMultiSelect}
                className="h-9 px-3 text-neutral-400 hover:text-white"
              >
                取消
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {filtered.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 1 }}
              exit={{ opacity: 0, x: -20 }}
              className="transaction-card"
            >
              <TransactionItem
                t={t}
                tagMap={tagMap}
                onView={onView}
                onEdit={onEdit}
                onDelete={onDelete}
                isMultiSelectMode={isMultiSelectMode}
                isSelected={selectedIds.has(t.id)}
                onToggleSelect={handleToggleSelect}
                onEnterMultiSelect={handleEnterMultiSelect}
              />
            </motion.div>
          ))}
        </AnimatePresence>
        {filtered.length === 0 && (
          <div className="py-20 text-center border border-dashed border-[#2A2A2A] rounded-xl">
            <span className="text-[#A0A0A0] text-sm">尚無交易紀錄</span>
          </div>
        )}
      </div>
    </div>
  );
});

