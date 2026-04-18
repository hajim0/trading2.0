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
import { COLORS } from '../constants';

interface TransactionListProps {
  transactions: Transaction[];
  allTags: Tag[];
  onView: (t: Transaction) => void;
  onEdit: (t: Transaction) => void;
  onDelete: (id: string) => void;
}

interface TransactionItemProps {
  t: Transaction;
  tagMap: Map<string, string>;
  onView: (t: Transaction) => void;
  onEdit: (t: Transaction) => void;
  onDelete: (id: string) => void;
}

const TransactionItem = React.memo(({ t, tagMap, onView, onEdit, onDelete }: TransactionItemProps) => {
  const getResultBadge = (result: Result) => {
    switch (result) {
      case 'Profit': return <span className="text-[#22C55E] font-bold">+</span>;
      case 'Loss': return <span className="text-[#EF4444] font-bold">-</span>;
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
    <Card 
      className="bg-[#1A1A1A] border-[#2A2A2A] hover:border-[#3A3A3A] transition-all cursor-pointer group"
      onClick={() => onView(t)}
    >
      <div className="p-4 grid grid-cols-[1fr_90px_40px] md:grid-cols-[1fr_80px_80px_100px_40px_40px] items-center gap-4">
        {/* 1. Left Info Section */}
        <div className="flex items-stretch gap-4 min-w-0">
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
        <div className="hidden md:flex flex-col items-center">
          <span className="text-[10px] text-[#3A3A3A] uppercase tracking-widest mb-1 font-bold">方向</span>
          <span className={cn(
            "text-xs font-black tracking-tighter",
            t.side === 'Long' ? 'text-[#22C55E]' : 'text-[#EF4444]'
          )}>
            {t.side === 'Long' ? 'LONG' : 'SHORT'}
          </span>
        </div>

        {/* 3. Rating */}
        <div className="hidden md:flex flex-col items-center">
          <span className="text-[10px] text-[#3A3A3A] uppercase tracking-widest mb-1 font-bold">評分</span>
          <div className={cn(
            "text-xs font-mono border px-2 py-0.5 rounded",
            getRatingColor(t.rating)
          )}>
            {t.rating}
          </div>
        </div>

        {/* 4. Result & Value */}
        <div className="flex flex-col items-end">
          <span className="text-[10px] text-[#3A3A3A] uppercase tracking-widest mb-1 font-bold">盈虧</span>
          <div className="flex items-center gap-1">
            {getResultBadge(t.result)}
            <span className={cn(
              "text-sm font-mono font-black",
              t.result === 'Profit' ? 'text-[#22C55E]' : t.result === 'Loss' ? 'text-[#EF4444]' : 'text-white'
            )}>
              {Math.abs(t.uValue).toLocaleString()}u
            </span>
          </div>
        </div>

        {/* 5. Screenshot */}
        <div className="hidden md:flex items-center justify-center">
          {t.screenshots && t.screenshots.length > 0 ? (
            <div className="w-8 h-8 rounded border border-[#2A2A2A] overflow-hidden bg-black/20">
              <img src={t.screenshots[0]} className="w-full h-full object-cover opacity-50" referrerPolicy="no-referrer" loading="lazy" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded border border-dashed border-[#2A2A2A]" />
          )}
        </div>

        {/* 6. Menu */}
        <div className="flex items-center justify-end">
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

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={16} />
          <Input
            placeholder="搜尋幣種..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-[#1A1A1A] border-[#2A2A2A]"
          />
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <button 
            onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
            className="px-3 py-2 border border-[#2A2A2A] rounded-md hover:bg-[#2A2A2A] transition-colors flex items-center gap-2 text-xs font-bold uppercase tracking-wider"
          >
            <ArrowUpDown size={14} className="text-[#A0A0A0]" />
            排序
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {filtered.map((t) => (
          <TransactionItem
            key={t.id}
            t={t}
            tagMap={tagMap}
            onView={onView}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
        {filtered.length === 0 && (
          <div className="py-20 text-center border border-dashed border-[#2A2A2A] rounded-xl">
            <span className="text-[#A0A0A0] text-sm">尚無交易紀錄</span>
          </div>
        )}
      </div>
    </div>
  );
});

