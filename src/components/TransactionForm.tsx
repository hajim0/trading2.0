import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Transaction, Side, Result, Rating, Tag, StrategyTemplate, StrategyChecklistItem, ChecklistSnapshotItem, DisciplineMode } from '../types';
import { TagInput } from './TagInput';
import { Input } from '@/components/ui/input';
import { Button, buttonVariants } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  ImagePlus, X, Calendar as CalendarIcon, RefreshCw, 
  AlertCircle, ShieldCheck, ListChecks, ChevronDown, 
  ChevronUp, Check, Zap, BarChart2, ShieldAlert, Lock, Lock as LockIcon 
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn, safeFormat, getLocalDateString, parseLocalDate } from '@/lib/utils';
import { toast } from 'sonner';

interface TransactionFormProps {
  onSubmit: (data: Partial<Transaction>) => Promise<void>;
  initialData?: Transaction;
  onCancel: () => void;
  allTags: Tag[];
  onAddGlobalTag: (tagName: string) => Promise<Tag>;
  canManageTags?: boolean;
  strategies?: StrategyTemplate[];
  checklistItems?: StrategyChecklistItem[];
  disciplineMode?: DisciplineMode;
}

export const TransactionForm: React.FC<TransactionFormProps> = React.memo(({
  onSubmit,
  initialData,
  onCancel,
  allTags,
  onAddGlobalTag,
  canManageTags = true,
  strategies = [],
  checklistItems = [],
  disciplineMode = 'semi',
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const defaultData: Partial<Transaction> = {
    symbol: '',
    date: getLocalDateString(),
    side: 'Long',
    result: 'Open',
    rating: 'B',
    uValue: 0,
    stopLossReason: '',
    entryReason: '',
    review: '',
    tagIds: [],
    screenshots: [],
    strategyId: '',
    checklistScore: 0,
    passedRequiredCheck: true,
    missingRequiredItems: [],
    checklistSnapshot: [],
  };

  const [formData, setFormData] = useState<Partial<Transaction>>({
    ...defaultData,
    ...initialData
  });

  // Local state for text fields to prevent typing lag
  const [localSymbol, setLocalSymbol] = useState(formData.symbol || '');
  const [localEntryReason, setLocalEntryReason] = useState(formData.entryReason || '');
  const [localStopLossReason, setLocalStopLossReason] = useState(formData.stopLossReason || '');
  const [localReview, setLocalReview] = useState(formData.review || '');

  const handleBlurText = (field: keyof Transaction, localValue: string) => {
    setFormData(prev => ({ ...prev, [field]: localValue }));
  };

  const [isChecklistExpanded, setIsChecklistExpanded] = useState(true);
  const [checkedItemIds, setCheckedItemIds] = useState<Set<string>>(() => {
    if (initialData?.checklistSnapshot) {
      return new Set(initialData.checklistSnapshot.filter(i => i.checked).map(i => i.itemId));
    }
    return new Set();
  });

  // Calculate current strategy metrics
  const currentStrategyItems = useMemo(() => {
    if (!formData.strategyId) return [];
    return checklistItems
      .filter(item => item.templateId === formData.strategyId && item.active)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [formData.strategyId, checklistItems]);

  const metrics = useMemo(() => {
    if (currentStrategyItems.length === 0) return { score: 0, passed: true, missing: [] };

    let totalWeight = 0;
    let checkedWeight = 0;
    const missing: string[] = [];
    let allRequiredChecked = true;

    currentStrategyItems.forEach(item => {
      totalWeight += item.weight;
      const isChecked = checkedItemIds.has(item.id);
      if (isChecked) {
        checkedWeight += item.weight;
      } else if (item.required) {
        allRequiredChecked = false;
        missing.push(item.text);
      }
    });

    const score = totalWeight > 0 ? Math.round((checkedWeight / totalWeight) * 100) : 0;
    
    return { score, passed: allRequiredChecked, missing };
  }, [currentStrategyItems, checkedItemIds]);

  const handleToggleCheck = (itemId: string) => {
    setCheckedItemIds(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.symbol?.trim()) {
      newErrors.symbol = '請輸入幣種 / 商品名稱';
    }
    if (!formData.date) {
      newErrors.date = '請選擇日期';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAddTag = async (tagName: string) => {
    try {
      const newTag = await onAddGlobalTag(tagName);
      setFormData(prev => ({
        ...prev,
        tagIds: [...(prev.tagIds || []), newTag.id]
      }));
    } catch (error) {
      console.error('Failed to add tag:', error);
      toast.error('新增標籤失敗');
    }
  };

  const handleSelectTag = (tagId: string) => {
    if (!formData.tagIds?.includes(tagId)) {
      setFormData(prev => ({
        ...prev,
        tagIds: [...(prev.tagIds || []), tagId]
      }));
    }
  };

  const handleRemoveTag = (tagId: string) => {
    setFormData(prev => ({
      ...prev,
      tagIds: prev.tagIds?.filter(id => id !== tagId)
    }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file: File) => {
      // Basic size check (e.g., 2MB)
      if (file.size > 2 * 1024 * 1024) {
        toast.warning(`圖片 ${file.name} 超過 2MB，可能會導致儲存變慢`);
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((prev) => ({
          ...prev,
          screenshots: [...(prev.screenshots || []), reader.result as string],
        }));
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      screenshots: prev.screenshots?.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (isSubmitting) return;
    
    if (!validate()) {
      toast.error("請填寫必填欄位");
      return;
    }

    // --- Discipline Mode Logic ---
    if (formData.strategyId && currentStrategyItems.length > 0) {
      if (!metrics.passed) {
        if (disciplineMode === 'strict') {
          toast.error(`嚴格模式：您還有 ${metrics.missing.length} 項必要規範未達成，無法儲存交易紀錄。`);
          return;
        }
        
        if (disciplineMode === 'semi' && !showConfirmDialog) {
          setShowConfirmDialog(true);
          return;
        }
        
        // If relaxed, we just proceed but maybe add a warning to the toast
      }
    }

    setIsSubmitting(true);
    setShowConfirmDialog(false);
    const toastId = toast.loading(initialData ? "正在更新交易..." : "正在儲存交易...");

    try {
      // Prepare Snapshot
      const snapshot: ChecklistSnapshotItem[] = currentStrategyItems.map(item => ({
        itemId: item.id,
        text: item.text,
        weight: item.weight,
        required: item.required,
        checked: checkedItemIds.has(item.id),
        sortOrder: item.sortOrder
      }));

      const finalData: Partial<Transaction> = {
        ...formData,
        symbol: localSymbol,
        entryReason: localEntryReason,
        stopLossReason: localStopLossReason,
        review: localReview,
        checklistScore: metrics.score,
        passedRequiredCheck: metrics.passed,
        missingRequiredItems: metrics.missing,
        checklistSnapshot: snapshot,
        modeUsed: disciplineMode,
        forceSubmit: !metrics.passed
      };

      await onSubmit(finalData);
      
      if (!metrics.passed) {
        toast.success("已違規儲存 (強制提交模式)", { id: toastId });
      } else {
        toast.success(initialData ? "交易已更新" : "交易已儲存", { id: toastId });
      }
    } catch (error) {
      console.error("[SAVE] failed", error);
      toast.error("儲存失敗，請檢查網路連線", { id: toastId });
      setIsSubmitting(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-[#22C55E]";
    if (score >= 70) return "text-yellow-500";
    if (score >= 50) return "text-[#EF4444]";
    return "text-[#EF4444]";
  };

  return (
    <Card className="bg-[#1A1A1A] border-[#2A2A2A] max-w-2xl mx-auto shadow-2xl">
      <CardHeader className="border-b border-[#2A2A2A]">
        <CardTitle className="text-lg font-black tracking-tighter uppercase">
          {initialData ? '編輯交易紀錄' : '新增交易紀錄'}
        </CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="p-6 space-y-8">
          {/* Section: Discipline Rules */}
          <div className="space-y-4 p-4 rounded-xl bg-black border border-[#2A2A2A]">
            <div className="space-y-2">
              <Label className="text-[10px] text-[#A0A0A0] uppercase tracking-[0.2em] font-black flex items-center gap-2">
                <ShieldCheck size={14} /> 核心紀律規範 (Rule Template)
              </Label>
              <Select
                value={formData.strategyId || ''}
                onValueChange={(value) => {
                  setFormData({ ...formData, strategyId: value });
                  setCheckedItemIds(new Set()); // Reset checks when switching strategy
                }}
              >
                <SelectTrigger className="bg-black text-white border-[#2A2A2A] focus:ring-0 focus:ring-offset-0 h-11 font-bold">
                  <SelectValue placeholder="選擇適用的紀律規範模板..." />
                </SelectTrigger>
                <SelectContent className="bg-[#1A1A1A] border-[#2A2A2A]">
                  <SelectItem value="">不使用規範模板 (自由交易)</SelectItem>
                  {strategies.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <AnimatePresence>
              {formData.strategyId && currentStrategyItems.length > 0 && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden border border-[#2A2A2A] rounded-lg bg-[#0B0B0B]"
                >
                  <div className="p-3 border-b border-[#2A2A2A] flex items-center justify-between cursor-pointer group" onClick={() => setIsChecklistExpanded(!isChecklistExpanded)}>
                    <div className="flex items-center gap-2">
                      <ListChecks className="text-[#A0A0A0] h-4 w-4" />
                      <span className="text-xs font-black uppercase tracking-widest text-[#A0A0A0]">出手前紀律核對</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className={cn("text-base font-black font-mono", getScoreColor(metrics.score))}>
                        DISCIPLINE: {metrics.score}%
                      </div>
                      {isChecklistExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </div>
                  
                  {isChecklistExpanded && (
                    <div className="p-3 space-y-3">
                      <div className="grid grid-cols-1 gap-2">
                        {currentStrategyItems.map(item => (
                          <div 
                            key={item.id} 
                            className={cn(
                              "flex items-center gap-3 p-3 rounded transition-all cursor-pointer border",
                              checkedItemIds.has(item.id) ? "bg-[#22C55E]/5 border-[#22C55E]/20" : "bg-black border-[#2A2A2A] hover:border-[#3A3A3A]"
                            )}
                            onClick={() => handleToggleCheck(item.id)}
                          >
                            <div className={cn(
                              "w-4 h-4 rounded-sm flex items-center justify-center transition-colors border",
                              checkedItemIds.has(item.id) ? "bg-[#22C55E] border-[#22C55E]" : "border-[#3A3A3A]"
                            )}>
                              {checkedItemIds.has(item.id) && <Check size={12} className="text-black font-black" />}
                            </div>
                            <div className="flex-1">
                              <p className={cn("text-xs font-bold uppercase tracking-tight", !checkedItemIds.has(item.id) && "text-[#A0A0A0]")}>
                                {item.text}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {item.required && <span className="text-[8px] px-1 bg-[#EF4444]/10 text-[#EF4444] rounded font-black uppercase">必達</span>}
                              <span className="text-[10px] font-mono text-[#3A3A3A] font-bold">W{item.weight}</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="mt-2 p-2 bg-black rounded flex flex-wrap gap-x-4 gap-y-1 text-[10px] uppercase tracking-widest font-black">
                         <span className="text-[#3A3A3A]">符合: {checkedItemIds.size} / {currentStrategyItems.length}</span>
                         {!metrics.passed && (
                           <span className="text-[#EF4444] flex items-center gap-1">
                             <AlertCircle size={10} /> 缺失必要項: {metrics.missing.length}
                           </span>
                         )}
                         {metrics.passed && checkedItemIds.size > 0 && (
                           <span className="text-[#22C55E] flex items-center gap-1">
                             <ShieldCheck size={10} /> 紀律檢核通過
                           </span>
                         )}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Section: Symbol & Meta */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-[#3A3A3A] mb-2">
              <Zap size={14} />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">交易資訊</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className={cn(
                "text-[10px] uppercase tracking-widest font-black",
                errors.symbol ? "text-[#EF4444]" : "text-[#A0A0A0]"
              )}>
                幣種 / 商品
              </Label>
              <div className="relative">
                <Input
                  placeholder="BTC, ETH, XAU..."
                  value={localSymbol}
                  maxLength={100}
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase();
                    setLocalSymbol(val);
                    if (errors.symbol) setErrors(prev => ({ ...prev, symbol: '' }));
                  }}
                  onBlur={() => handleBlurText('symbol', localSymbol)}
                  className={cn(
                    "bg-black text-white border-[#2A2A2A] focus:ring-0 focus:border-[#3A3A3A] placeholder:text-[#3A3A3A] h-11 pr-16 font-black uppercase tracking-tighter",
                    errors.symbol && "border-[#EF4444]"
                  )}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[#3A3A3A] font-mono">
                  {localSymbol.length}/100
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label className={cn(
                "text-[10px] uppercase tracking-widest font-black",
                errors.date ? "text-[#EF4444]" : "text-[#A0A0A0]"
              )}>
                交易日期
              </Label>
              <Popover>
                <PopoverTrigger
                  className={cn(
                    buttonVariants({ variant: "outline" }),
                    "w-full justify-start text-left font-bold bg-black text-white border-[#2A2A2A] hover:bg-[#1A1A1A] h-11",
                    !formData.date && "text-[#3A3A3A]",
                    errors.date && "border-[#EF4444] text-[#EF4444]"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4 text-[#3A3A3A]" />
                  {formData.date ? safeFormat(formData.date, "PPP") : <span>選擇日期</span>}
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-[#1A1A1A] border-[#2A2A2A]">
                  <Calendar
                    mode="single"
                  selected={formData.date ? parseLocalDate(formData.date) : undefined}
                  onSelect={(date) => {
                    setFormData({ ...formData, date: date ? getLocalDateString(date) : '' });
                    if (errors.date) setErrors(prev => ({ ...prev, date: '' }));
                  }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] text-[#A0A0A0] uppercase tracking-widest font-black">方向</Label>
              <Select
                value={formData.side || 'Long'}
                onValueChange={(value: Side) => setFormData({ ...formData, side: value })}
              >
                <SelectTrigger className="bg-black text-white border-[#2A2A2A] focus:ring-0 h-11 font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1A1A1A] border-[#2A2A2A]">
                  <SelectItem value="Long">LONG (多)</SelectItem>
                  <SelectItem value="Short">SHORT (空)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] text-[#A0A0A0] uppercase tracking-widest font-black">盈虧結果</Label>
              <Select
                value={formData.result || 'Open'}
                onValueChange={(value: Result) => setFormData({ ...formData, result: value })}
              >
                <SelectTrigger className="bg-black text-white border-[#2A2A2A] focus:ring-0 h-11 font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1A1A1A] border-[#2A2A2A]">
                  <SelectItem value="Profit" className="text-[#22C55E]">PROFIT (+)</SelectItem>
                  <SelectItem value="Loss" className="text-[#EF4444]">LOSS (-)</SelectItem>
                  <SelectItem value="Open">OPEN (進行中)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] text-[#A0A0A0] uppercase tracking-widest font-black">執行評分</Label>
              <Select
                value={formData.rating || 'B'}
                onValueChange={(value: Rating) => setFormData({ ...formData, rating: value })}
              >
                <SelectTrigger className="bg-black text-white border-[#2A2A2A] focus:ring-0 h-11 font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1A1A1A] border-[#2A2A2A]">
                  <SelectItem value="A">Grade A (完美執行)</SelectItem>
                  <SelectItem value="B">Grade B (符合計畫)</SelectItem>
                  <SelectItem value="C">Grade C (情緒交易)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] text-[#A0A0A0] uppercase tracking-widest font-black">u 盈虧金額</Label>
              <Input
                type="number"
                placeholder="0"
                value={formData.uValue}
                onChange={(e) => setFormData({ ...formData, uValue: parseFloat(e.target.value) || 0 })}
                className="bg-black text-white border-[#2A2A2A] font-mono focus:ring-0 placeholder:text-[#3A3A3A] h-11 font-black"
              />
            </div>
          </div>
        </div>

          {/* Section: Signals & Reasons */}
          <div className="space-y-6">
            <div className="flex items-center gap-2 text-[#3A3A3A] mb-2">
              <BarChart2 size={14} />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">技術訊號與復盤</span>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] text-[#A0A0A0] uppercase tracking-widest font-black">
                  標籤 (例如: FVG, MSS, OB)
                </Label>
                <TagInput
                  selectedTagIds={formData.tagIds || []}
                  allTags={allTags}
                  onAddTag={handleAddTag}
                  onSelectTag={handleSelectTag}
                  onRemoveTag={handleRemoveTag}
                  canAddTag={canManageTags}
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label className="text-[10px] text-[#A0A0A0] uppercase tracking-widest font-black">進場邏輯</Label>
                </div>
                <Textarea
                  placeholder="為什麼要在這裡出手..."
                  value={localEntryReason}
                  maxLength={10000}
                  onChange={(e) => setLocalEntryReason(e.target.value)}
                  onBlur={() => handleBlurText('entryReason', localEntryReason)}
                  className="bg-black text-white border-[#2A2A2A] min-h-[100px] focus:ring-0 placeholder:text-[#3A3A3A] font-bold"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] text-[#A0A0A0] uppercase tracking-widest font-black">止損原因</Label>
            <Textarea
              placeholder="止損或減倉計畫..."
              value={localStopLossReason}
              maxLength={10000}
              onChange={(e) => setLocalStopLossReason(e.target.value)}
              onBlur={() => handleBlurText('stopLossReason', localStopLossReason)}
              className="bg-black text-white border-[#2A2A2A] min-h-[100px] focus:ring-0 placeholder:text-[#3A3A3A] font-bold"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] text-[#A0A0A0] uppercase tracking-widest font-black">復盤</Label>
            <Textarea
              placeholder="總結心得..."
              value={localReview}
              maxLength={10000}
              onChange={(e) => setLocalReview(e.target.value)}
              onBlur={() => handleBlurText('review', localReview)}
              className="bg-black text-white border-[#2A2A2A] min-h-[120px] focus:ring-0 placeholder:text-[#3A3A3A] font-bold"
            />
          </div>

          <div className="space-y-4">
            <Label className="text-[10px] text-[#A0A0A0] uppercase tracking-widest font-black">截圖</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {formData.screenshots?.map((src, i) => (
                <div key={`screenshot-${i}`} className="relative group aspect-video rounded border border-[#2A2A2A] overflow-hidden">
                  <img src={src} alt={`Screenshot ${i}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="absolute top-1 right-1 bg-black/80 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              <label className="aspect-video rounded border border-dashed border-[#2A2A2A] flex flex-col items-center justify-center gap-1 cursor-pointer hover:bg-black transition-colors">
                <ImagePlus size={16} className="text-[#3A3A3A]" />
                <span className="text-[8px] text-[#3A3A3A] uppercase font-black">Upload</span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
              </label>
            </div>
          </div>

          <div className="flex gap-3 pt-6 border-t border-[#2A2A2A]">
            <Button 
              type="button"
              variant="outline" 
              className="flex-1 border-[#2A2A2A] h-12 font-black uppercase tracking-widest text-[#A0A0A0]" 
              onClick={onCancel} 
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button 
              type="submit"
              className={cn(
                "flex-1 h-12 font-black uppercase tracking-widest shadow-2xl transition-all",
                (disciplineMode === 'strict' && !metrics.passed && formData.strategyId) 
                  ? "bg-[#1A1A1A] text-[#3A3A3A] cursor-not-allowed" 
                  : "bg-white text-black hover:bg-neutral-200"
              )} 
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : (disciplineMode === 'strict' && !metrics.passed && formData.strategyId) ? 'Locked' : 'Save Record'}
            </Button>
          </div>
        </CardContent>

        {/* Confirmation Dialog for Semi-Strict Mode */}
        <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <DialogContent className="border border-red-500/30 bg-card shadow-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-500">
                <ShieldAlert size={18} />
                紀律警示：尚未完成必要規範
              </DialogTitle>
              <DialogDescription className="text-neutral-400">
                您選擇了「{strategies.find(s => s.id === formData.strategyId)?.name}」模板，但有 <span className="text-red-500 font-bold">{metrics.missing.length}</span> 項必要項未勾選：
              </DialogDescription>
            </DialogHeader>
            
            <div className="py-2 space-y-2">
              {metrics.missing.map((msg, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-neutral-300 bg-red-500/5 p-2 rounded-lg border border-red-500/10">
                  <AlertCircle size={12} className="text-red-500 shrink-0" />
                  <span>{msg}</span>
                </div>
              ))}
            </div>

            <p className="text-[11px] text-neutral-500 leading-relaxed italic border-t border-border pt-3">
              目前的交易紀律分數為 <span className={cn("font-bold", getScoreColor(metrics.score))}>{metrics.score}%</span>。
              頻繁違反必要紀律規範是虧損的主要原因，您確定要忽略這些規範並儲存交易嗎？
            </p>

            <DialogFooter className="gap-2">
              <Button 
                variant="outline" 
                onClick={() => setShowConfirmDialog(false)}
                className="flex-1 bg-transparent border-neutral-800"
              >
                返回補齊
              </Button>
              <Button 
                className="flex-1 bg-red-500 hover:bg-red-600 text-white border-none font-bold"
                onClick={() => handleSubmit()}
                disabled={isSubmitting}
              >
                {isSubmitting ? "儲存中..." : "我確定，我要違規送出"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </form>
    </Card>
  );
});
