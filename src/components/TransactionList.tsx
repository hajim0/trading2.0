import React, { useState, useMemo } from 'react';
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
import { Search, Filter, ArrowUpDown, MoreVertical, Eye, Edit2, Trash2 } from 'lucide-react';
import { cn, safeFormat, parseLocalDate } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface TransactionListProps {
  transactions: Transaction[];
  allTags: Tag[];
  onView: (t: Transaction) => void;
  onEdit: (t: Transaction) => void;
  onDelete: (id: string) => void;
}

export const TransactionList: React.FC<TransactionListProps> = React.memo(({
  transactions,
  allTags,
  onView,
  onEdit,
  onDelete,
}) => {
  const [search, setSearch] = useState('');
  const [filterResult, setFilterResult] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'uValue'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Create a tag map for O(1) lookup
  const tagMap = useMemo(() => {
    const map = new Map<string, string>();
    allTags.forEach(tag => map.set(tag.id, tag.name));
    return map;
  }, [allTags]);

  const filtered = useMemo(() => {
    console.log('[Perf] transaction list filtered/sorted');
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

  const getResultBadge = (result: Result) => {
    switch (result) {
      case 'Profit': return <span className="text-green-500 font-bold">+</span>;
      case 'Loss': return <span className="text-red-500 font-bold">-</span>;
      default: return <span className="text-neutral-500">.</span>;
    }
  };

  const getRatingColor = (rating: Rating) => {
    switch (rating) {
      case 'A': return 'text-white border-white';
      case 'B': return 'text-neutral-400 border-neutral-400';
      case 'C': return 'text-neutral-600 border-neutral-600';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={16} />
          <Input
            placeholder="搜尋幣種..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-card border-border"
          />
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <Select value={filterResult} onValueChange={setFilterResult}>
            <SelectTrigger className="w-full md:w-32 bg-card border-border">
              <Filter className="mr-2 h-4 w-4 text-neutral-500" />
              <SelectValue placeholder="盈虧" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="all">全部狀態</SelectItem>
              <SelectItem value="Profit">盈利</SelectItem>
              <SelectItem value="Loss">虧損</SelectItem>
              <SelectItem value="Open">進行中</SelectItem>
            </SelectContent>
          </Select>
          <button 
            onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
            className="p-2 border border-neutral-800 rounded-md hover:bg-neutral-900 transition-colors"
          >
            <ArrowUpDown size={16} className="text-neutral-500" />
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {filtered.map((t) => (
          <Card 
            key={t.id} 
            className="bg-card border-border hover:border-neutral-400 dark:hover:border-neutral-700 transition-all cursor-pointer group"
            onClick={() => onView(t)}
          >
            <div className="p-4 grid grid-cols-[1fr_90px_40px] md:grid-cols-[1fr_80px_80px_100px_40px_40px] items-center gap-4">
              {/* 1. Left Info Section (Vertical Line + Content Container) */}
              <div className="flex items-stretch gap-4 min-w-0">
                {/* Layer 1: Vertical Line */}
                <div className={cn(
                  "w-1 rounded-full",
                  t.side === 'Long' ? 'bg-blue-500' : 'bg-orange-500'
                )} />

                {/* Content Container */}
                <div className="flex flex-col justify-between py-0.5 min-w-0 flex-1">
                  {/* Layer 2: Symbol & Date */}
                  <div className="flex flex-col mb-1.5">
                    <span className="text-lg font-black tracking-tighter uppercase leading-tight truncate">{t.symbol}</span>
                    <span className="text-[10px] text-neutral-500 uppercase font-mono">
                      {safeFormat(t.date, 'yyyy.MM.dd')}
                    </span>
                  </div>

                  {/* Layer 3: Tags Area (Fixed min-height to prevent layout shifts) */}
                  <div className="flex flex-wrap gap-1 min-h-[22px] items-center">
                {t.tagIds && t.tagIds.length > 0 ? (
                  t.tagIds.map((id, idx) => {
                    const tagName = tagMap.get(id);
                    if (!tagName) return null;
                    return (
                      <span key={`${t.id}-${id}-${idx}`} className="text-[8px] px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-500 rounded border border-neutral-200 dark:border-neutral-700 whitespace-nowrap">
                        {tagName}
                      </span>
                    );
                  })
                ) : (
                      <div className="h-1" /> /* Minimal placeholder that still respects min-h of parent */
                    )}
                  </div>
                </div>
              </div>

              {/* 2. Side (Desktop only) */}
              <div className="hidden md:flex flex-col items-center">
                <span className="text-[10px] text-neutral-600 uppercase tracking-widest mb-1">方向</span>
                <span className={cn(
                  "text-xs font-medium",
                  t.side === 'Long' ? 'text-blue-400' : 'text-orange-400'
                )}>
                  {t.side === 'Long' ? 'LONG' : 'SHORT'}
                </span>
              </div>

              {/* 3. Rating (Desktop only) */}
              <div className="hidden md:flex flex-col items-center">
                <span className="text-[10px] text-neutral-600 uppercase tracking-widest mb-1">評分</span>
                <div className={cn(
                  "text-xs font-mono border px-2 py-0.5 rounded",
                  getRatingColor(t.rating)
                )}>
                  {t.rating}
                </div>
              </div>

              {/* 4. Result & Value */}
              <div className="flex flex-col items-end">
                <span className="text-[10px] text-neutral-600 uppercase tracking-widest mb-1">盈虧</span>
                <div className="flex items-center gap-1">
                  {getResultBadge(t.result)}
                  <span className={cn(
                    "text-sm font-mono font-bold",
                    t.result === 'Profit' ? 'text-green-500' : t.result === 'Loss' ? 'text-red-500' : 'text-white'
                  )}>
                    {Math.abs(t.uValue).toLocaleString()}u
                  </span>
                </div>
              </div>

              {/* 5. Screenshot (Desktop only) */}
              <div className="hidden md:flex items-center justify-center">
                {t.screenshots.length > 0 ? (
                  <div className="w-8 h-8 rounded border border-neutral-800 overflow-hidden">
                    <img src={t.screenshots[0]} className="w-full h-full object-cover opacity-50" referrerPolicy="no-referrer" />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded border border-dashed border-neutral-800" />
                )}
              </div>

              {/* 6. Menu */}
              <div className="flex items-center justify-end">
                <DropdownMenu>
                  <DropdownMenuTrigger 
                    className="p-1 hover:bg-neutral-900 rounded transition-colors text-neutral-500"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical size={16} />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-card border-border">
                    <DropdownMenuItem 
                      onClick={(e) => {
                        e.stopPropagation();
                        onView(t);
                      }} 
                      className="gap-2"
                    >
                      <Eye size={14} /> 詳情
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(t);
                      }} 
                      className="gap-2"
                    >
                      <Edit2 size={14} /> 編輯
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(t.id);
                      }} 
                      className="gap-2 text-red-500 focus:text-red-500"
                    >
                      <Trash2 size={14} /> 刪除
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </Card>
        ))}
        {filtered.length === 0 && (
          <div className="py-20 text-center border border-dashed border-neutral-800 rounded-xl">
            <span className="text-neutral-500 text-sm">尚無交易紀錄</span>
          </div>
        )}
      </div>
    </div>
  );
});
