import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { StrategyTemplate, StrategyChecklistItem, DisciplineMode } from '../types';
import { db, OperationType, handleFirestoreError } from '../firebase';
import { collection, doc, addDoc, updateDoc, deleteDoc, setDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Trash2, GripVertical, Check, X, Star, ChevronRight, Settings2, AlertCircle, Save, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface StrategyManagementProps {
  userId: string;
  strategies: StrategyTemplate[];
  checklistItems: StrategyChecklistItem[];
}

// Separate component for internal checklist items to prevent entire list re-render on typing
const ChecklistItemRow = React.memo(({ 
  item, 
  onUpdate, 
  onDelete, 
  isDeleting, 
  autoFocus, 
  onEnter, 
  onBackspace 
}: { 
  item: StrategyChecklistItem;
  onUpdate: (id: string, data: Partial<StrategyChecklistItem>) => void;
  onDelete: (id: string) => void;
  isDeleting: boolean;
  autoFocus: boolean;
  onEnter: () => void;
  onBackspace: () => void;
}) => {
  const [text, setText] = useState(item.text);
  const [weight, setWeight] = useState(item.weight);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setText(item.text);
  }, [item.text]);

  useEffect(() => {
    setWeight(item.weight);
  }, [item.weight]);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const handleBlurText = () => {
    const trimmed = text.trim();
    if (trimmed !== item.text && trimmed.length > 0) {
      onUpdate(item.id, { text: trimmed });
    } else {
      setText(item.text); // Revert if empty
    }
  };

  const handleBlurWeight = () => {
    if (weight !== item.weight) {
      onUpdate(item.id, { weight });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onEnter();
    } else if (e.key === 'Backspace' && text === '') {
      onBackspace();
    }
  };

  return (
    <div className="p-3 rounded-xl border bg-background/50 space-y-3 relative group">
      <div className="flex items-start gap-3">
        <GripVertical className="mt-2 h-4 w-4 text-muted-foreground cursor-grab shrink-0" />
        <div className="flex-1 space-y-3 min-w-0">
          <div className="relative">
            <Input 
              ref={inputRef}
              value={text} 
              onChange={e => {
                if (e.target.value.length <= 500) {
                  setText(e.target.value);
                }
              }}
              onBlur={handleBlurText}
              onKeyDown={handleKeyDown}
              className="bg-transparent border-none shadow-none focus-visible:ring-1 p-0 h-auto text-sm font-medium pr-10"
              placeholder="輸入規範內容..."
            />
            <span className={cn(
              "absolute right-0 bottom-0 text-[10px] tabular-nums",
              text.length >= 500 ? "text-destructive font-bold" : "text-muted-foreground"
            )}>
              {text.length}/500
            </span>
          </div>
          
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground whitespace-nowrap">權重:</span>
              <input 
                type="number" 
                min="1" 
                max="100"
                value={weight}
                onChange={e => {
                  const val = parseInt(e.target.value);
                  if (!isNaN(val) && val >= 1 && val <= 100) {
                    setWeight(val);
                  }
                }}
                onBlur={handleBlurWeight}
                className="w-12 bg-muted rounded px-1 py-0.5 text-center font-bold"
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer group/label">
              <input 
                type="checkbox"
                checked={item.required}
                onChange={e => onUpdate(item.id, { required: e.target.checked })}
                className="rounded border-gray-300 text-primary focus:ring-primary h-3.5 w-3.5"
              />
              <span className={cn("transition-colors", item.required ? "text-primary font-bold" : "text-muted-foreground group-hover/label:text-foreground")}>必要項目</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer group/label">
              <input 
                type="checkbox"
                checked={item.active}
                onChange={e => onUpdate(item.id, { active: e.target.checked })}
                className="rounded border-gray-300 text-primary focus:ring-primary h-3.5 w-3.5"
              />
              <span className={cn("transition-colors", item.active ? "text-primary font-bold" : "text-muted-foreground group-hover/label:text-foreground")}>啟用中</span>
            </label>
          </div>
        </div>
        
        <Button 
          variant="ghost" 
          size="icon" 
          className="text-destructive hover:bg-destructive/10 h-8 w-8 shrink-0" 
          onClick={(e) => {
            e.stopPropagation();
            onDelete(item.id);
          }}
          disabled={isDeleting}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
});

export function StrategyManagement({ userId, strategies, checklistItems }: StrategyManagementProps) {
  const [editingTemplate, setEditingTemplate] = useState<StrategyTemplate | null>(null);
  
  // Local state for template info to prevent typing lag
  const [localName, setLocalName] = useState('');
  const [localDesc, setLocalDesc] = useState('');

  const [isAdding, setIsAdding] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateDesc, setNewTemplateDesc] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [optimisticFavorites, setOptimisticFavorites] = useState<Record<string, boolean>>({});
  const [lastAddedItemId, setLastAddedItemId] = useState<string | null>(null);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Sync optimistic favorites when strategies change
  useEffect(() => {
    setOptimisticFavorites({});
  }, [strategies]);

  // Sync editing template if it's updated in props
  useEffect(() => {
    if (editingTemplate) {
      const upToDate = strategies.find(s => s.id === editingTemplate.id);
      if (upToDate) {
        setEditingTemplate(upToDate);
        setLocalName(upToDate.name);
        setLocalDesc(upToDate.description || '');
      }
    } else {
      setLocalName('');
      setLocalDesc('');
    }
  }, [strategies, editingTemplate?.id]);

  const handleBlurTemplateInfo = () => {
    if (!editingTemplate) return;
    const updates: Partial<StrategyTemplate> = {};
    let changed = false;

    if (localName.trim() !== editingTemplate.name && localName.trim().length > 0) {
      updates.name = localName.trim();
      changed = true;
    }
    if (localDesc.trim() !== (editingTemplate.description || '')) {
      updates.description = localDesc.trim();
      changed = true;
    }

    if (changed) {
      handleUpdateTemplateInfo(updates);
    } else {
      setLocalName(editingTemplate.name);
      setLocalDesc(editingTemplate.description || '');
    }
  };

  const currentItems = useMemo(() => {
    if (!editingTemplate) return [];
    return checklistItems
      .filter(item => item.templateId === editingTemplate.id)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [editingTemplate, checklistItems]);

  const handleAddTemplate = async () => {
    const trimmedName = newTemplateName.trim();
    if (!trimmedName || isProcessing) return;
    setIsProcessing(true);
    const templateId = Math.random().toString(36).substr(2, 9);
    const templatePath = `users/${userId}/strategies/${templateId}`;
    try {
      const templateRef = doc(db, 'users', userId, 'strategies', templateId);
      await setDoc(templateRef, {
        id: templateId,
        userId,
        name: trimmedName,
        description: newTemplateDesc.trim(),
        isFavorite: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      toast.success('策略模板已建立');
      setNewTemplateName('');
      setNewTemplateDesc('');
      setIsAdding(false);
    } catch (err) {
      toast.error('建立失敗');
      handleFirestoreError(err, OperationType.WRITE, templatePath);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleFavorite = useCallback(async (template: StrategyTemplate) => {
    const newStatus = !template.isFavorite;
    const templatePath = `users/${userId}/strategies/${template.id}`;

    setOptimisticFavorites(prev => ({ ...prev, [template.id]: newStatus }));
    
    try {
      await updateDoc(doc(db, 'users', userId, 'strategies', template.id), {
        isFavorite: newStatus,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      setOptimisticFavorites(prev => {
        const next = { ...prev };
        delete next[template.id];
        return next;
      });
      toast.error('更新收藏失敗');
      handleFirestoreError(err, OperationType.WRITE, templatePath);
    }
  }, [userId]);

  const handleDeleteTemplate = async (id: string) => {
    if (isProcessing) return;
    setIsProcessing(true);
    const templatePath = `users/${userId}/strategies/${id}`;
    try {
      const templateItems = checklistItems.filter(item => item.templateId === id);
      const batch = writeBatch(db);
      
      // Delete all checklist items first
      templateItems.forEach(item => {
        batch.delete(doc(db, 'users', userId, 'strategies', id, 'items', item.id));
      });
      
      // Then delete the template itself
      batch.delete(doc(db, 'users', userId, 'strategies', id));
      
      await batch.commit();
      
      if (editingTemplate?.id === id) setEditingTemplate(null);
      setConfirmDeleteId(null);
      toast.success('已刪除模板');
    } catch (err) {
      toast.error('刪除失敗');
      handleFirestoreError(err, OperationType.DELETE, templatePath);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddItem = async () => {
    if (!editingTemplate || isProcessing) return;
    setIsProcessing(true);
    const itemsPath = `users/${userId}/strategies/${editingTemplate.id}/items`;
    try {
      const newItemRef = await addDoc(collection(db, 'users', userId, 'strategies', editingTemplate.id, 'items'), {
        templateId: editingTemplate.id,
        text: '',
        weight: 1,
        required: false,
        sortOrder: currentItems.length,
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setLastAddedItemId(newItemRef.id);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, itemsPath);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateItem = useCallback(async (itemId: string, data: Partial<StrategyChecklistItem>) => {
    if (!editingTemplate) return;
    const itemPath = `users/${userId}/strategies/${editingTemplate.id}/items/${itemId}`;
    try {
      await updateDoc(doc(db, 'users', userId, 'strategies', editingTemplate.id, 'items', itemId), {
        ...data,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, itemPath);
    }
  }, [userId, editingTemplate?.id]);

  const handleDeleteItem = useCallback(async (itemId: string) => {
    if (!editingTemplate) return;
    const itemPath = `users/${userId}/strategies/${editingTemplate.id}/items/${itemId}`;
    try {
      await deleteDoc(doc(db, 'users', userId, 'strategies', editingTemplate.id, 'items', itemId));
      toast.success('已刪除規範項');
    } catch (err) {
      toast.error('移除失敗');
      handleFirestoreError(err, OperationType.DELETE, itemPath);
    }
  }, [userId, editingTemplate?.id]);

  const handleUpdateTemplateInfo = async (data: Partial<StrategyTemplate>) => {
    if (!editingTemplate) return;
    try {
      await updateDoc(doc(db, 'users', userId, 'strategies', editingTemplate.id), {
        ...data,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${userId}/strategies/${editingTemplate.id}`);
    }
  };

  return (
    <div className="space-y-6 pb-20 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">紀律規範模板</h2>
          <p className="text-muted-foreground text-sm">建立自訂交易規範與出手前確認清單 (Checklist)</p>
        </div>
        {!editingTemplate && (
          <Button onClick={() => setIsAdding(true)} className="rounded-full shadow-lg h-10">
            <Plus className="mr-2 h-4 w-4" /> 新增規範
          </Button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {isAdding && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="mb-6"
          >
            <Card className="border-primary/20 bg-primary/5 shadow-inner">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">建立新交易規範</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <Label className="text-xs">規範模板名稱</Label>
                      <span className={cn("text-[10px]", newTemplateName.length >= 100 ? "text-destructive" : "text-muted-foreground")}>
                        {newTemplateName.length}/100
                      </span>
                    </div>
                    <Input 
                      placeholder="例如: 紐約盤出手規範" 
                      value={newTemplateName} 
                      maxLength={100}
                      onChange={e => setNewTemplateName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <Label className="text-xs">說明 (選填)</Label>
                      <span className={cn("text-[10px]", newTemplateDesc.length >= 500 ? "text-destructive" : "text-muted-foreground")}>
                        {newTemplateDesc.length}/500
                      </span>
                    </div>
                    <Input 
                      placeholder="核心守則..." 
                      value={newTemplateDesc} 
                      maxLength={500}
                      onChange={e => setNewTemplateDesc(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex gap-2 justify-end pt-2">
                  <Button variant="ghost" size="sm" onClick={() => setIsAdding(false)} disabled={isProcessing}>取消</Button>
                  <Button size="sm" onClick={handleAddTemplate} disabled={isProcessing || !newTemplateName.trim()}>
                    {isProcessing ? '建立中...' : '確認建立'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {editingTemplate ? (
          <motion.div
            key={`editing-${editingTemplate.id}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <Button variant="ghost" size="sm" onClick={() => setEditingTemplate(null)} className="hover:bg-muted font-medium">
                <ChevronRight className="rotate-180 mr-1 h-4 w-4" /> 返回列表
              </Button>
            </div>

            <Card className="border border-border/50 shadow-xl bg-card/50 backdrop-blur-sm overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between bg-muted/30 pb-4 border-b">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Input 
                      value={localName}
                      onChange={e => {
                        if (e.target.value.length <= 100) {
                          setLocalName(e.target.value);
                        }
                      }}
                      onBlur={handleBlurTemplateInfo}
                      className="bg-transparent border-none shadow-none focus-visible:ring-1 text-xl font-bold p-0 h-auto w-auto min-w-[100px]"
                    />
                    <span className="text-[10px] text-muted-foreground mt-1">{localName.length}/100</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input 
                      value={localDesc}
                      placeholder="點擊輸入說明..."
                      onChange={e => {
                        if (e.target.value.length <= 500) {
                          setLocalDesc(e.target.value);
                        }
                      }}
                      onBlur={handleBlurTemplateInfo}
                      className="bg-transparent border-none shadow-none focus-visible:ring-1 text-sm text-muted-foreground p-0 h-auto"
                    />
                    <span className="text-[10px] text-muted-foreground">{localDesc.length}/500</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className={cn(
                      "rounded-full transition-all duration-300",
                      (optimisticFavorites[editingTemplate.id] ?? editingTemplate.isFavorite) 
                        ? "bg-yellow-400/10 border-yellow-400 text-yellow-600 shadow-yellow-100" 
                        : "text-muted-foreground"
                    )} 
                    onClick={() => handleToggleFavorite(editingTemplate)}
                  >
                    <Star className={cn("h-4 w-4", (optimisticFavorites[editingTemplate.id] ?? editingTemplate.isFavorite) && "fill-current")} />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                <div className="flex items-center justify-between pb-2">
                  <h3 className="font-semibold flex items-center gap-2 text-primary">
                    <Settings2 className="h-4 w-4" /> 規範清單項目
                  </h3>
                  <Button size="sm" variant="outline" onClick={handleAddItem} disabled={isProcessing} className="rounded-full">
                    <Plus className="mr-1 h-3 w-3" /> 新增項目
                  </Button>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {currentItems.length === 0 && (
                    <div className="text-center py-16 text-muted-foreground bg-muted/10 rounded-2xl border-2 border-dashed border-border/50">
                      <div className="bg-background w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm">
                        <Plus className="h-6 w-6 text-muted-foreground/50" />
                      </div>
                      <p className="text-sm">目前尚無項目，開始新增你的交易紀律</p>
                    </div>
                  )}
                  {currentItems.map((item) => (
                    <ChecklistItemRow 
                      key={item.id} 
                      item={item}
                      userId={userId}
                      onUpdate={handleUpdateItem}
                      onDelete={handleDeleteItem}
                      isDeleting={isProcessing}
                      autoFocus={item.id === lastAddedItemId}
                      onEnter={handleAddItem}
                      onBackspace={() => {
                        if (item.text === '') handleDeleteItem(item.id);
                      }}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            {strategies.length === 0 && !isAdding && (
              <div className="col-span-full py-24 text-center border-2 border-dashed rounded-[32px] bg-muted/5 flex flex-col items-center justify-center space-y-4">
                <div className="h-16 w-16 bg-background rounded-2xl shadow-sm flex items-center justify-center">
                  <Settings2 className="h-8 w-8 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-lg font-medium">尚未建立任何策略模板</p>
                  <p className="text-muted-foreground text-sm">建立好的規範可以在新增交易時選用</p>
                </div>
                <Button variant="outline" onClick={() => setIsAdding(true)} className="rounded-full px-8">
                  建立第一個模板
                </Button>
              </div>
            )}
            {strategies.map(strategy => (
              <Card key={strategy.id} 
                onClick={() => setEditingTemplate(strategy)}
                className="group cursor-pointer hover:border-primary/50 transition-all duration-300 border border-border/40 shadow-sm hover:shadow-xl bg-card hover:bg-accent/5 overflow-hidden"
              >
                <CardHeader className="pb-3 flex flex-row items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg group-hover:text-primary transition-colors">{strategy.name}</CardTitle>
                      {(optimisticFavorites[strategy.id] ?? strategy.isFavorite) && (
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.4)]" />
                      )}
                    </div>
                    <CardDescription className="line-clamp-2 text-xs leading-relaxed">
                      {strategy.description || '自訂出手規範，打造紀律交易系統'}
                    </CardDescription>
                  </div>
                  <div className="h-10 w-10 flex items-center justify-center rounded-full bg-muted/30 group-hover:bg-primary/10 group-hover:text-primary transition-colors shrink-0">
                    <ChevronRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </CardHeader>
                <CardContent className="pt-2 flex justify-between items-center text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                  <span className="flex items-center gap-1.5 bg-muted/50 px-2 py-1 rounded-md">
                    <Check className="h-3 w-3" />
                    {checklistItems.filter(i => i.templateId === strategy.id).length} CHECK ITEMS
                  </span>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-full md:opacity-0 md:group-hover:opacity-100 transition-opacity" 
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDeleteId(strategy.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={!!confirmDeleteId} onOpenChange={(open) => !open && setConfirmDeleteId(null)}>
        <DialogContent className="max-w-xs sm:max-w-md">
          <DialogHeader>
            <DialogTitle>確認刪除模板？</DialogTitle>
            <DialogDescription>
              將永久移除此交易規範模板及其所有細項，此動作無法復原。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2 pt-4">
            <Button variant="ghost" onClick={() => setConfirmDeleteId(null)} disabled={isProcessing}>
              取消
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => confirmDeleteId && handleDeleteTemplate(confirmDeleteId)}
              disabled={isProcessing}
            >
              {isProcessing ? '刪除中...' : '確認刪除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
