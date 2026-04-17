import React, { useState, useEffect, useMemo } from 'react';
import { Transaction, TradeStats, Tag, UserProfile, Plan, StrategyTemplate, StrategyChecklistItem, DisciplineMode } from './types';
import { auth, googleProvider, signInWithPopup, signOut, db, OperationType, handleFirestoreError } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, collection, onSnapshot, query, orderBy, deleteDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { EquityChart } from './components/EquityChart';
import { StatsOverview } from './components/StatsOverview';
import { TransactionList } from './components/TransactionList';
import { TransactionForm } from './components/TransactionForm';
import { TransactionDetail } from './components/TransactionDetail';
import { ProfitCalendar } from './components/ProfitCalendar';
import { TagAnalysis } from './components/TagAnalysis';
import { TagManagement } from './components/TagManagement';
import { StrategyManagement } from './components/StrategyManagement';
import { FloatingActionButton } from './components/FloatingActionButton';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Plus, LayoutDashboard, History, Settings, LogOut, Menu, X, Moon, Sun, BarChart2, Tags, Wifi, RefreshCw, ShieldAlert, Lock, Zap, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { Toaster } from 'sonner';

type View = 'dashboard' | 'list' | 'add' | 'edit' | 'detail' | 'analysis' | 'tags' | 'settings' | 'strategies';

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
    <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
    <path d="M3.964 10.711c-.18-.54-.282-1.117-.282-1.711 0-.594.102-1.17.282-1.711V4.957H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.043l3.007-2.332z" fill="#FBBC05"/>
    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.957l3.007 2.332C4.672 5.164 6.656 3.58 9 3.58z" fill="#EA4335"/>
  </svg>
);

export default function App() {
  // --- Auth & Profile State ---
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSwitching, setIsSwitching] = useState(false);

  // --- App State ---
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [disciplineMode, setDisciplineMode] = useState<DisciplineMode>('semi');
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [strategies, setStrategies] = useState<StrategyTemplate[]>([]);
  const [checklistItems, setChecklistItems] = useState<StrategyChecklistItem[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [initialCapital, setInitialCapital] = useState<number>(10000);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('theme') as 'dark' | 'light') || 'dark';
  });
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isInIframe, setIsInIframe] = useState(false);

  // --- Refs for cleanup ---
  const unsubscribes = React.useRef<(() => void)[]>([]);
  const itemUnsubscribes = React.useRef<Record<string, () => void>>({});

  const cleanupListeners = () => {
    if (unsubscribes.current.length > 0) {
      console.log(`[Perf] old listeners cleaned: ${unsubscribes.current.length}`);
      unsubscribes.current.forEach(unsub => unsub());
      unsubscribes.current = [];
    }
    (Object.values(itemUnsubscribes.current) as (() => void)[]).forEach(unsub => unsub());
    itemUnsubscribes.current = {};
  };

  const resetAppState = () => {
    console.log('[Auth] Resetting app state for new user');
    setTransactions([]);
    setTags([]);
    setUserProfile(null);
    setSelectedTransaction(null);
    setCurrentView('dashboard');
    setInitialCapital(10000);
  };

  const effectiveUserId = user?.uid || null;
  const isPro = true; 
  const canUseTagManagement = true;
  const canUseTagAnalytics = true;

  // --- Effects ---
  useEffect(() => {
    setIsInIframe(window.self !== window.top);
  }, []);
  // Load user profile and initial capital
  useEffect(() => {
    if (userProfile?.initialCapital !== undefined) {
      setInitialCapital(userProfile.initialCapital);
    }
  }, [userProfile]);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Detect iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    // Check if already installed
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
    setIsStandalone(standalone);
    
    if (standalone) {
      setIsInstallable(false);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstallable(false);
    }
    setDeferredPrompt(null);
  };

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      console.log('[Auth] current uid:', u?.uid || 'Logged out');
      
      // 1. Always cleanup old listeners and reset state first
      cleanupListeners();
      resetAppState();

      if (!u) {
        setUser(null);
        setIsAuthLoading(false);
        setIsSwitching(false);
        return;
      }

      setUser(u);
      
      try {
        // 2. Fetch or create user profile
        console.log('[Profile] checking /users/' + u.uid);
        const profileRef = doc(db, 'users', u.uid);
        let profileSnap = await getDoc(profileRef);
        
        if (!profileSnap.exists()) {
          console.log('[Profile] creating /users/' + u.uid);
          const profileData = {
            uid: u.uid,
            email: u.email || '',
            displayName: u.displayName || '',
            photoURL: u.photoURL || '',
            plan: 'free',
            disciplineMode: 'semi',
            initialCapital: 10000,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };
          try {
            await setDoc(profileRef, profileData);
            console.log('[Profile] create success');
            // Re-fetch to get server-side timestamps
            profileSnap = await getDoc(profileRef);
          } catch (err) {
            console.error('[Profile] create failed:', err);
            setAuthError('無法建立使用者設定檔，請檢查權限。');
            setIsAuthLoading(false);
            return;
          }
        }

        const data = profileSnap.data() as UserProfile;
        console.log('[Perf] cache loaded: user profile');
        console.log('[Profile] ready for:', u.uid);
        
        // 3. Setup real-time sync for User Profile
        const unsubProfile = onSnapshot(profileRef, (doc) => {
          if (doc.exists()) {
            const updatedData = doc.data() as UserProfile;
            setUserProfile(updatedData);
            if (updatedData.initialCapital !== undefined) {
              setInitialCapital(updatedData.initialCapital);
            }
            if (updatedData.disciplineMode) {
              setDisciplineMode(updatedData.disciplineMode);
            }
          }
        });
        unsubscribes.current.push(unsubProfile);

        // 4. Setup real-time sync for trades
        console.log('[Perf] trades listener started');
        const tradesPath = `users/${u.uid}/trades`;
        console.log('[Trades] Loading path:', tradesPath);
        const tradesQuery = query(
          collection(db, 'users', u.uid, 'trades'),
          orderBy('date', 'desc')
        );
        const unsubTrades = onSnapshot(tradesQuery, (snap) => {
          const tradesData = snap.docs.map(doc => ({
            ...doc.data(),
            id: doc.id
          })) as Transaction[];
          console.log(`[Trades] Received ${tradesData.length} records for:`, u.uid);
          setTransactions(tradesData);
        }, (err) => {
          console.error('[Trades] Load failed:', err);
          handleFirestoreError(err, OperationType.LIST, tradesPath);
        });
        unsubscribes.current.push(unsubTrades);

        // 4. Setup real-time sync for tags
        console.log('[Perf] tags listener started');
        const tagsPath = `users/${u.uid}/tags`;
        console.log('[Tags] Loading path:', tagsPath);
        const tagsQuery = query(collection(db, 'users', u.uid, 'tags'));
        const unsubTags = onSnapshot(tagsQuery, (snap) => {
          const tagsData = snap.docs.map(doc => ({
            ...doc.data(),
            id: doc.id
          })) as Tag[];
          console.log(`[Tags] Received ${tagsData.length} records for:`, u.uid);
          setTags(tagsData);
        }, (err) => {
          console.error('[Tags] Load failed:', err);
          handleFirestoreError(err, OperationType.LIST, tagsPath);
        });
        unsubscribes.current.push(unsubTags);

        // 5. Setup real-time sync for strategies
        console.log('[Perf] strategies listener started');
        const strategiesPath = `users/${u.uid}/strategies`;
        const strategiesQuery = query(collection(db, 'users', u.uid, 'strategies'), orderBy('createdAt', 'desc'));
        const unsubStrategies = onSnapshot(strategiesQuery, (snap) => {
          const strategiesData = snap.docs.map(doc => ({
            ...doc.data(),
            id: doc.id
          })) as StrategyTemplate[];
          console.log(`[Strategies] Received ${strategiesData.length} records for:`, u.uid);
          setStrategies(strategiesData);

          // Manage nested item listeners to avoid accumulation
          const currentStrategyIds = new Set(strategiesData.map(s => s.id));
          
          // Clean up items state for removed strategies
          setChecklistItems(prev => prev.filter(item => currentStrategyIds.has(item.templateId)));
          
          // Cleanup listeners for removed strategies
          Object.keys(itemUnsubscribes.current).forEach(id => {
            if (!currentStrategyIds.has(id)) {
              itemUnsubscribes.current[id]();
              delete itemUnsubscribes.current[id];
            }
          });

          // Setup listeners for new strategies
          strategiesData.forEach(strategy => {
            if (!itemUnsubscribes.current[strategy.id]) {
              const itemsPath = `users/${u.uid}/strategies/${strategy.id}/items`;
              const itemsQuery = query(collection(db, 'users', u.uid, 'strategies', strategy.id, 'items'), orderBy('sortOrder', 'asc'));
              const unsubItems = onSnapshot(itemsQuery, (itemSnap) => {
                const itemsData = itemSnap.docs.map(iDoc => ({ ...iDoc.data(), id: iDoc.id })) as StrategyChecklistItem[];
                setChecklistItems(prev => {
                  const otherItems = prev.filter(item => item.templateId !== strategy.id);
                  return [...otherItems, ...itemsData];
                });
              }, (err) => {
                console.error(`[Items] Load failed for ${strategy.id}:`, err);
                handleFirestoreError(err, OperationType.LIST, itemsPath);
              });
              itemUnsubscribes.current[strategy.id] = unsubItems;
            }
          });
        }, (err) => {
          console.error('[Strategies] Load failed:', err);
          handleFirestoreError(err, OperationType.LIST, strategiesPath);
        });
        unsubscribes.current.push(unsubStrategies);

      } catch (error) {
        console.error('[Auth] Error during initialization:', error);
        setAuthError('系統初始化失敗，請重新整理頁面。');
      } finally {
        setIsAuthLoading(false);
        setIsSwitching(false);
      }
    });

    return () => {
      unsubAuth();
      cleanupListeners();
    };
  }, []);

  useEffect(() => {
    // SyncAll is no longer needed as we use onSnapshot
  }, [isOnline, user]);

  const stats = useMemo<TradeStats>(() => {
    console.log('[Perf] trades recalculated');
    // Only include closed trades for stats calculation
    const closedTrades = transactions.filter(t => t.result !== 'Open');
    const totalTrades = closedTrades.length;
    const profitCount = closedTrades.filter(t => t.result === 'Profit').length;
    const lossCount = closedTrades.filter(t => t.result === 'Loss').length;
    const totalU = closedTrades.reduce((acc, t) => {
      return acc + (t.result === 'Loss' ? -Math.abs(t.uValue) : Math.abs(t.uValue));
    }, 0);
    const winRate = totalTrades > 0 ? profitCount / (profitCount + lossCount || 1) : 0;

    // Calculate Max Drawdown and Consecutive streaks using sorted closed trades
    const sortedTx = [...closedTrades].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    let currentEquity = initialCapital;
    let peakEquity = initialCapital;
    let maxDDPercent = 0;
    
    let currentWins = 0;
    let maxWins = 0;
    let currentLosses = 0;
    let maxLosses = 0;
    
    let activeStreak = 0;
    let activeStreakType: 'Profit' | 'Loss' | 'None' = 'None';

    sortedTx.forEach(t => {
      const val = t.result === 'Loss' ? -Math.abs(t.uValue) : Math.abs(t.uValue);
      currentEquity += val;
      
      // Max Drawdown (Percentage based)
      if (currentEquity > peakEquity) {
        peakEquity = currentEquity;
      }
      
      const ddAmount = peakEquity - currentEquity;
      const ddPercent = peakEquity > 0 ? (ddAmount / peakEquity) * 100 : 0;
      
      if (ddPercent > maxDDPercent) {
        maxDDPercent = ddPercent;
      }

      // Consecutive Streaks
      if (t.result === 'Profit') {
        currentWins++;
        currentLosses = 0;
        if (currentWins > maxWins) maxWins = currentWins;
        activeStreak = currentWins;
        activeStreakType = 'Profit';
      } else if (t.result === 'Loss') {
        currentLosses++;
        currentWins = 0;
        if (currentLosses > maxLosses) maxLosses = currentLosses;
        activeStreak = currentLosses;
        activeStreakType = 'Loss';
      }
    });

    const profitTrades = closedTrades.filter(t => t.result === 'Profit');
    const lossTrades = closedTrades.filter(t => t.result === 'Loss');
    
    const avgProfit = profitTrades.length > 0 
      ? profitTrades.reduce((acc, t) => acc + Math.abs(t.uValue), 0) / profitTrades.length 
      : 0;
    const avgLoss = lossTrades.length > 0 
      ? lossTrades.reduce((acc, t) => acc + Math.abs(t.uValue), 0) / lossTrades.length 
      : 0;
    const plRatio = avgLoss > 0 ? avgProfit / avgLoss : 0;

    return { 
      totalTrades, 
      profitCount, 
      lossCount, 
      winRate, 
      totalU,
      maxDrawdown: maxDDPercent,
      maxConsecutiveWins: maxWins,
      maxConsecutiveLosses: maxLosses,
      initialCapital,
      currentStreak: activeStreak,
      currentStreakType: activeStreakType,
      averageProfit: avgProfit,
      averageLoss: avgLoss,
      profitLossRatio: plRatio
    };
  }, [transactions, initialCapital]);

  const handleAddGlobalTag = async (name: string): Promise<Tag> => {
    if (!effectiveUserId) {
      console.error('[Tag Write] Failed: User not logged in');
      throw new Error('User not logged in');
    }
    
    const normalized = name.trim();
    const existing = tags.find(t => t.name.toLowerCase() === normalized.toLowerCase());
    if (existing) return existing;

    const tagId = Math.random().toString(36).substr(2, 9);
    const tagPath = `users/${effectiveUserId}/tags/${tagId}`;
    console.log('[Tag Write]', tagPath);
    
    try {
      const tagRef = doc(db, 'users', effectiveUserId, 'tags', tagId);
      const tagData = {
        id: tagId,
        userId: effectiveUserId,
        name: normalized,
        createdAt: serverTimestamp(),
      };
      await setDoc(tagRef, tagData);
      console.log('[Tag Write] Success:', tagId);
      
      return {
        id: tagId,
        userId: effectiveUserId,
        name: normalized,
        createdAt: new Date().toISOString(),
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${effectiveUserId}/tags/${tagId}`);
      throw error;
    }
  };

  const handleRenameTag = async (id: string, newName: string) => {
    if (!effectiveUserId || !canUseTagManagement) return;
    try {
      const tagRef = doc(db, 'users', effectiveUserId, 'tags', id);
      await updateDoc(tagRef, { name: newName });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${effectiveUserId}/tags/${id}`);
    }
  };

  const handleDeleteTag = async (id: string) => {
    if (!effectiveUserId || !canUseTagManagement) return;
    try {
      const tagRef = doc(db, 'users', effectiveUserId, 'tags', id);
      await deleteDoc(tagRef);

      // Remove tag from all transactions
      const affected = transactions.filter(tx => tx.tagIds?.includes(id));
      for (const tx of affected) {
        const txRef = doc(db, 'users', effectiveUserId, 'trades', tx.id);
        await updateDoc(txRef, {
          tagIds: tx.tagIds.filter(tid => tid !== id),
          updatedAt: serverTimestamp()
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${effectiveUserId}/tags/${id}`);
    }
  };

  const handleAdd = async (data: Partial<Transaction>) => {
    if (!effectiveUserId) {
      console.error('[Trade Write] Failed: User not logged in');
      return;
    }
    const tradeId = Math.random().toString(36).substr(2, 9);
    const tradePath = `users/${effectiveUserId}/trades/${tradeId}`;
    console.log('[Trade Write]', tradePath);

    const newTx = {
      ...data,
      id: tradeId,
      userId: effectiveUserId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    
    try {
      const txRef = doc(db, 'users', effectiveUserId, 'trades', tradeId);
      await setDoc(txRef, newTx);
      console.log('[Trade Write] Success:', tradeId);
      setCurrentView('dashboard');
    } catch (error) {
      console.error('[Firestore Error]', error);
      handleFirestoreError(error, OperationType.WRITE, tradePath);
      throw error;
    }
  };

  const handleUpdate = async (data: Partial<Transaction>) => {
    if (!effectiveUserId || !data.id) return;
    try {
      const txRef = doc(db, 'users', effectiveUserId, 'trades', data.id);
      // Sanitize data: remove fields that shouldn't be updated or might cause type issues
      const { id, userId, createdAt, syncStatus, ...updateData } = data;
      await updateDoc(txRef, {
        ...updateData,
        updatedAt: serverTimestamp()
      });
      setCurrentView('dashboard');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${effectiveUserId}/trades/${data.id}`);
      throw error;
    }
  };

  const handleDelete = async (id: string) => {
    if (!effectiveUserId) return;
    try {
      const txRef = doc(db, 'users', effectiveUserId, 'trades', id);
      await deleteDoc(txRef);
      if (selectedTransaction?.id === id) {
        setSelectedTransaction(null);
        setCurrentView('dashboard');
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${effectiveUserId}/trades/${id}`);
    }
  };

  const handleLogin = async () => {
    setIsAuthLoading(true);
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      if (error.code !== 'auth/cancelled-popup-request' && error.code !== 'auth/popup-closed-by-user') {
        console.error('Login failed:', error);
        setAuthError(error.message || '登入失敗，請稍後再試');
      }
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleSwitchAccount = async () => {
    console.log('[Perf] account switched, cleanup done');
    setIsSwitching(true);
    try {
      await signOut(auth);
      // Clear local UI state immediately to prevent flicker
      setUser(null);
      setSelectedTransaction(null);
      setCurrentView('dashboard');
      
      // Trigger new login with account selector (forced by provider config)
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      if (error.code !== 'auth/cancelled-popup-request' && error.code !== 'auth/popup-closed-by-user') {
        console.error('Switch account failed:', error);
      }
    } finally {
      setIsSwitching(false);
    }
  };

  const handleLogout = async () => {
    try {
      if (user) {
        await signOut(auth);
      }
      setUser(null);
      setUserProfile(null);
      setSelectedTransaction(null);
      setCurrentView('dashboard');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const updateDisciplineMode = async (mode: DisciplineMode) => {
    if (!effectiveUserId) return;
    try {
      setDisciplineMode(mode);
      const profileRef = doc(db, 'users', effectiveUserId);
      await updateDoc(profileRef, {
        disciplineMode: mode,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Failed to update discipline mode:', error);
    }
  };
  
  // --- Swipe Gesture Logic ---
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && isSidebarOpen) {
      // Swipe left to close
      setIsSidebarOpen(false);
    } else if (isRightSwipe && !isSidebarOpen) {
      // Swipe right (anywhere) to open
      setIsSidebarOpen(true);
    }
  };

  const NavItem = ({ icon: Icon, label, view, active, locked }: any) => (
    <button
      onClick={() => {
        setCurrentView(view);
        setIsSidebarOpen(false);
      }}
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-lg transition-all w-full text-left relative group",
        active 
          ? "bg-white text-black font-medium shadow-[0_0_20px_rgba(255,255,255,0.1)]" 
          : "text-neutral-500 hover:text-white hover:bg-neutral-900"
      )}
    >
      <Icon size={18} />
      <span className="text-sm tracking-tight flex-1">{label}</span>
      {locked && (
        <Lock size={14} className="text-neutral-600 group-hover:text-primary transition-colors" />
      )}
    </button>
  );

  return (
    <div 
      className="min-h-screen bg-background text-foreground flex flex-col md:flex-row font-sans transition-colors duration-300"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <Toaster position="top-center" richColors />
      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between p-4 border-b border-border sticky top-0 bg-background z-40">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-white rounded-md flex items-center justify-center">
            <div className="w-4 h-4 border-2 border-black rotate-45" />
          </div>
          <span className="font-bold tracking-tighter text-lg uppercase">Elite Trader</span>
        </div>
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2">
          {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </header>

      {/* Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-background border-r border-border p-6 flex flex-col gap-8 transition-transform duration-300 overflow-y-auto custom-scrollbar",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-foreground rounded-xl flex items-center justify-center shadow-[0_0_30px_rgba(0,0,0,0.1)] dark:shadow-[0_0_30px_rgba(255,255,255,0.2)]">
            <div className="w-5 h-5 border-[3px] border-background rotate-45" />
          </div>
          <div className="flex flex-col">
            <span className="font-black tracking-tighter text-xl leading-none uppercase">Elite</span>
            <span className="text-[10px] text-neutral-500 tracking-[0.3em] font-bold uppercase">Journal</span>
          </div>
        </div>

        <nav className="space-y-1">
          <NavItem icon={LayoutDashboard} label="總覽面板" view="dashboard" active={currentView === 'dashboard'} />
          <NavItem icon={History} label="交易歷史" view="list" active={currentView === 'list'} />
          <NavItem icon={BarChart2} label="標籤分析" view="analysis" active={currentView === 'analysis'} locked={!canUseTagAnalytics} />
          <NavItem icon={ShieldAlert} label="紀律規範" view="strategies" active={currentView === 'strategies'} />
          <NavItem icon={Tags} label="標籤管理" view="tags" active={currentView === 'tags'} locked={!canUseTagManagement} />
          <NavItem icon={Settings} label="系統設定" view="settings" active={currentView === 'settings'} />
          
          <div className="py-2" />
          
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="flex items-center gap-3 px-4 py-3 rounded-lg transition-all w-full text-left text-neutral-500 hover:text-white hover:bg-neutral-900"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            <span className="text-sm tracking-tight">{theme === 'dark' ? '淺色模式' : '深色模式'}</span>
          </button>

          {effectiveUserId && (
            <>
              <button
                onClick={() => {
                  setCurrentView('add');
                  setIsSidebarOpen(false);
                }}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg transition-all w-full text-left",
                  currentView === 'add'
                    ? "bg-white text-black font-medium"
                    : "text-neutral-500 hover:text-white hover:bg-neutral-900"
                )}
              >
                <Plus size={18} />
                <span className="text-sm tracking-tight">新增紀錄</span>
              </button>
              
              <button 
                onClick={handleLogout}
                className="flex items-center gap-3 px-4 py-3 rounded-lg transition-all w-full text-left text-neutral-500 hover:text-red-400 hover:bg-neutral-900"
              >
                <LogOut size={18} />
                <span className="text-sm tracking-tight">登出系統</span>
              </button>
            </>
          )}
        </nav>

        <div className="mt-auto pt-6 border-t border-border space-y-4">
          {user && (
            <div className="flex flex-col gap-3">
              <div className="px-4 py-3 bg-neutral-900/50 rounded-xl border border-border flex items-center gap-3">
                <img src={user.photoURL || ''} className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />
                <div className="flex flex-col min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold truncate">{user.displayName}</span>
                  </div>
                  <span className="text-[10px] text-neutral-500 truncate">{user.email}</span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={handleSwitchAccount}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors border border-border"
                >
                  <RefreshCw size={12} />
                  切換帳戶
                </button>
                <button 
                  onClick={handleLogout}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-neutral-900 hover:bg-red-950/30 text-neutral-400 hover:text-red-400 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors border border-border"
                >
                  <LogOut size={12} />
                  登出
                </button>
              </div>
            </div>
          )}
          {!effectiveUserId && (
            <Button 
              className="w-full bg-white text-black hover:bg-neutral-200 gap-3 h-12 rounded-2xl shadow-lg border border-neutral-200 font-bold"
              onClick={handleLogin}
            >
              <GoogleIcon />
              <span>Google 登入</span>
            </Button>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 md:ml-64 p-4 md:p-8 lg:p-12 min-h-screen relative">
        {isSwitching && (
          <div className="absolute inset-0 z-50 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
            <p className="text-sm font-medium animate-pulse">正在切換帳戶...</p>
          </div>
        )}
        
        <div className="max-w-5xl mx-auto">
          {isAuthLoading ? (
            <div className="h-full flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            </div>
          ) : !effectiveUserId ? (
            <div className="h-[80vh] flex flex-col items-center justify-center text-center space-y-6">
              <div className="w-20 h-20 bg-foreground rounded-2xl flex items-center justify-center shadow-2xl">
                <div className="w-10 h-10 border-[4px] border-background rotate-45" />
              </div>
              <div className="space-y-2">
                <h1 className="text-4xl font-black tracking-tighter uppercase">Elite Journal</h1>
                <p className="text-neutral-500 max-w-xs">專業交易員的雲端日誌系統。支援 Google 登入、雲端同步與離線使用。</p>
              </div>
              <div className="flex flex-col gap-3 w-full max-w-xs">
                {authError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 text-left">
                    <ShieldAlert className="text-red-400 shrink-0" size={16} />
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-red-400">登入發生錯誤</p>
                      <p className="text-[10px] text-red-400/80 leading-relaxed">{authError}</p>
                    </div>
                  </div>
                )}
                <Button 
                  size="lg"
                  className="bg-white text-black hover:bg-neutral-200 gap-3 h-14 px-8 rounded-2xl font-bold text-lg shadow-xl border border-neutral-200"
                  onClick={handleLogin}
                >
                  <GoogleIcon />
                  使用 Google 帳號登入
                </Button>
              </div>
              <div className="flex items-center gap-2 text-xs text-neutral-600">
                <Wifi size={12} />
                <span>支援離線模式，網路恢復後自動同步</span>
              </div>
            </div>
          ) : (
            <AnimatePresence mode="wait">
            {currentView === 'dashboard' && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-4">
                      <h1 className="text-3xl font-bold tracking-tight">交易總覽</h1>
                    </div>
                    <p className="text-neutral-500 text-sm">歡迎回來，這是您目前的資產走勢與統計。</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="bg-black text-white border-white hover:bg-neutral-800 text-xs h-8">近 7 天</Button>
                    <Button variant="outline" size="sm" className="bg-black text-white border-white hover:bg-neutral-800 text-xs h-8">近 30 天</Button>
                    <Button variant="outline" size="sm" className="bg-black text-white border-white hover:bg-neutral-800 text-xs h-8">全部</Button>
                  </div>
                </div>

                <StatsOverview stats={stats} />
                
                {transactions.length === 0 ? (
                  <div className="py-20 flex flex-col items-center justify-center text-center space-y-6 border border-dashed border-neutral-800 rounded-3xl bg-card/30">
                    <div className="w-16 h-16 bg-neutral-900 rounded-2xl flex items-center justify-center">
                      <Plus size={32} className="text-neutral-500" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-xl font-bold">尚無交易紀錄</h3>
                      <p className="text-neutral-500 max-w-xs mx-auto text-sm">
                        開始記錄您的第一筆交易，建立屬於您的專業交易日誌。
                      </p>
                    </div>
                    <Button 
                      onClick={() => setCurrentView('add')}
                      className="bg-white text-black hover:bg-neutral-200 gap-2 h-11 px-6 rounded-xl font-bold"
                    >
                      <Plus size={18} />
                      新增第一筆交易
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                      <div className="lg:col-span-2 space-y-4">
                        <div className="flex items-center justify-between">
                          <h2 className="text-[10px] uppercase tracking-[0.3em] text-neutral-500 font-bold">資產走勢圖 (Equity Curve)</h2>
                          <div className="flex items-center gap-4 text-[10px] font-mono text-neutral-500 uppercase">
                            <div className="flex items-center gap-1.5">
                              <div className="w-2 h-2 rounded-full bg-green-500" /> 盈利區
                            </div>
                            <div className="flex items-center gap-1.5">
                              <div className="w-2 h-2 rounded-full bg-red-500" /> 虧損區
                            </div>
                          </div>
                        </div>
                        <EquityChart transactions={transactions} />
                      </div>
                      <div className="space-y-4">
                        <ProfitCalendar transactions={transactions} />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h2 className="text-[10px] uppercase tracking-[0.3em] text-neutral-500 font-bold">近期交易紀錄</h2>
                        <Button variant="link" onClick={() => setCurrentView('list')} className="text-neutral-500 text-xs h-auto p-0">查看全部</Button>
                      </div>
                      <TransactionList 
                        transactions={transactions.slice(0, 5)} 
                        allTags={tags}
                        onView={(t) => { setSelectedTransaction(t); setCurrentView('detail'); }}
                        onEdit={(t) => { setSelectedTransaction(t); setCurrentView('edit'); }}
                        onDelete={handleDelete}
                      />
                    </div>
                  </>
                )}
              </motion.div>
            )}

            {currentView === 'list' && (
              <motion.div
                key="list"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="space-y-1">
                  <h1 className="text-3xl font-bold tracking-tight">交易歷史</h1>
                  <p className="text-neutral-500 text-sm">管理與篩選您所有的歷史交易紀錄。</p>
                </div>
                <TransactionList 
                  transactions={transactions} 
                  allTags={tags}
                  onView={(t) => { setSelectedTransaction(t); setCurrentView('detail'); }}
                  onEdit={(t) => { setSelectedTransaction(t); setCurrentView('edit'); }}
                  onDelete={handleDelete}
                />
              </motion.div>
            )}

            {currentView === 'add' && (
              <motion.div
                key="add"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <TransactionForm 
                  allTags={tags}
                  onAddGlobalTag={handleAddGlobalTag}
                  onSubmit={handleAdd} 
                  onCancel={() => setCurrentView('dashboard')} 
                  canManageTags={canUseTagManagement}
                  strategies={strategies}
                  checklistItems={checklistItems}
                />
              </motion.div>
            )}

            {currentView === 'edit' && selectedTransaction && (
              <motion.div
                key="edit"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <TransactionForm 
                  initialData={selectedTransaction}
                  allTags={tags}
                  onAddGlobalTag={handleAddGlobalTag}
                  onSubmit={handleUpdate} 
                  onCancel={() => setCurrentView('dashboard')} 
                  canManageTags={canUseTagManagement}
                  strategies={strategies}
                  checklistItems={checklistItems}
                />
              </motion.div>
            )}

            {currentView === 'settings' && (
              <motion.div
                key="settings"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <div className="space-y-1">
                  <h1 className="text-3xl font-bold tracking-tight">系統設定</h1>
                  <p className="text-neutral-500 text-sm">調整您的交易日誌偏好設定。</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-6 rounded-xl border border-border bg-card space-y-4">
                    <div className="flex flex-col gap-1">
                      <h3 className="font-bold">初始資金設定</h3>
                      <p className="text-xs text-neutral-500">設定您的帳戶起始金額，用於計算回撤百分比。</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-neutral-500 uppercase tracking-wider">初始金額 (u)</Label>
                      <Input 
                        type="number"
                        value={initialCapital}
                        onChange={async (e) => {
                          const val = Number(e.target.value);
                          setInitialCapital(val);
                          if (effectiveUserId) {
                            try {
                              const profileRef = doc(db, 'users', effectiveUserId);
                              await updateDoc(profileRef, {
                                initialCapital: val,
                                updatedAt: serverTimestamp()
                              });
                            } catch (error) {
                              console.error('Failed to update initial capital:', error);
                            }
                          }
                        }}
                        className="bg-background border-border font-mono"
                      />
                    </div>
                  </div>

                  <div className="p-6 rounded-xl border border-neutral-800 bg-card space-y-4">
                    <div className="flex flex-col gap-1">
                      <h3 className="font-bold">介面主題</h3>
                      <p className="text-xs text-neutral-500">選擇您偏好的視覺風格。</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setTheme('dark')}
                        className={cn(
                          "flex-1 py-4 rounded-lg border transition-all flex flex-col items-center gap-2",
                          theme === 'dark' 
                            ? "bg-white text-black border-white" 
                            : "bg-black text-white border-neutral-800 hover:border-neutral-600"
                        )}
                      >
                        <div className="w-8 h-8 rounded-full bg-black border border-white/20" />
                        <span className="text-xs font-bold uppercase tracking-widest">深色模式</span>
                      </button>
                      <button
                        onClick={() => setTheme('light')}
                        className={cn(
                          "flex-1 py-4 rounded-lg border transition-all flex flex-col items-center gap-2",
                          theme === 'light' 
                            ? "bg-black text-white border-black" 
                            : "bg-white text-black border-neutral-200 hover:border-neutral-400"
                        )}
                      >
                        <div className="w-8 h-8 rounded-full bg-white border border-black/10" />
                        <span className="text-xs font-bold uppercase tracking-widest">淺色模式</span>
                      </button>
                    </div>
                  </div>

                  <div className="p-6 rounded-xl border border-border bg-card space-y-4">
                    <div className="flex flex-col gap-1">
                      <h3 className="font-bold flex items-center gap-2">
                        <ShieldAlert size={18} className="text-primary" />
                        交易規範強制模式 (Discipline Mode)
                      </h3>
                      <p className="text-xs text-neutral-500">決定在違反核心規範時，系統該如何引導您的交易紀錄。</p>
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                      <button 
                        onClick={() => updateDisciplineMode('relaxed')}
                        className={cn(
                          "flex flex-col items-start gap-1 p-4 rounded-xl border transition-all text-left",
                          disciplineMode === 'relaxed' ? "bg-primary/5 border-primary" : "bg-neutral-900/50 border-neutral-800 hover:border-neutral-700"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span className={cn("text-xs font-black uppercase tracking-widest", disciplineMode === 'relaxed' ? "text-primary" : "text-neutral-400")}>寬鬆模式 (Relaxed)</span>
                        </div>
                        <p className="text-[10px] text-neutral-500">不阻擋任何儲存，僅在畫面顯示規範達成分數與提示。</p>
                      </button>

                      <button 
                        onClick={() => updateDisciplineMode('semi')}
                        className={cn(
                          "flex flex-col items-start gap-1 p-4 rounded-xl border transition-all text-left",
                          disciplineMode === 'semi' ? "bg-primary/5 border-primary" : "bg-neutral-900/50 border-neutral-800 hover:border-neutral-700"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span className={cn("text-xs font-black uppercase tracking-widest", disciplineMode === 'semi' ? "text-primary" : "text-neutral-400")}>半強制模式 (Semi-Strict)</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/20 text-primary font-bold">預設推薦</span>
                        </div>
                        <p className="text-[10px] text-neutral-500">缺少「必要項」時會跳出二次確認視窗，提醒您是否真的要違規交易。</p>
                      </button>

                      <button 
                        onClick={() => updateDisciplineMode('strict')}
                        className={cn(
                          "flex flex-col items-start gap-1 p-4 rounded-xl border transition-all text-left",
                          disciplineMode === 'strict' ? "bg-primary/5 border-primary" : "bg-neutral-900/50 border-neutral-800 hover:border-neutral-700"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span className={cn("text-xs font-black uppercase tracking-widest", disciplineMode === 'strict' ? "text-primary" : "text-neutral-400")}>嚴格模式 (Strict)</span>
                          <Lock size={12} className={disciplineMode === 'strict' ? "text-primary" : "text-neutral-500"} />
                        </div>
                        <p className="text-[10px] text-neutral-500">必須補齊所有「必要項」才允許儲存。強制執行交易紀律，告別情緒單。</p>
                      </button>
                    </div>
                  </div>

                  <div className="p-6 rounded-xl border border-border bg-card space-y-4 text-center">
                    <h3 className="font-bold flex items-center justify-center gap-2 mb-2">
                      <Download size={18} className="text-primary" />
                      安裝應用程式
                    </h3>
                      <p className="text-xs text-neutral-500">將 Trading Journey 新增至您的主螢幕，享受原生 App 體驗。</p>
                    </div>

                    {isStandalone ? (
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-500">
                        <ShieldAlert size={16} />
                        <span className="text-xs font-bold">已安裝並以 App 模式運行</span>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {isInIframe ? (
                          <div className="space-y-3">
                            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center gap-2">
                              <ShieldAlert size={14} />
                              <span className="text-[11px] font-bold">偵測到預覽環境，請開啟獨立分頁安裝</span>
                            </div>
                            <Button 
                              onClick={() => window.open(window.location.href, '_blank')}
                              className="w-full bg-white text-black hover:bg-neutral-200 gap-2 h-11 rounded-xl font-bold"
                            >
                              <RefreshCw size={16} />
                              開啟獨立分頁
                            </Button>
                          </div>
                        ) : isInstallable ? (
                          <Button 
                            onClick={handleInstallClick}
                            className="w-full bg-white text-black hover:bg-neutral-200 gap-2 h-11 rounded-xl font-bold animate-pulse shadow-[0_0_20px_rgba(255,255,255,0.2)]"
                          >
                            <Download size={16} />
                            立即安裝到主螢幕
                          </Button>
                        ) : (
                          <div className="p-4 rounded-xl bg-neutral-900/50 border border-neutral-800 space-y-3">
                            <div className="flex items-center gap-2 text-neutral-400">
                              <ShieldAlert size={14} />
                              <span className="text-xs font-bold">請手動新增至主畫面</span>
                            </div>
                            
                            {isIOS ? (
                              <div className="space-y-3">
                                <p className="text-[11px] text-neutral-400 leading-relaxed">
                                  iOS Safari 不支援自動安裝，請點擊下方按鈕查看引導：
                                </p>
                                <div className="p-3 bg-white/5 rounded-lg border border-white/10 space-y-2">
                                  <div className="flex items-center gap-2 text-[11px] text-white">
                                    <div className="w-5 h-5 rounded bg-blue-500 flex items-center justify-center text-[10px]">1</div>
                                    <span>點擊瀏覽器底部的 <span className="text-blue-400 font-bold">「分享」</span> 按鈕</span>
                                  </div>
                                  <div className="flex items-center gap-2 text-[11px] text-white">
                                    <div className="w-5 h-5 rounded bg-blue-500 flex items-center justify-center text-[10px]">2</div>
                                    <span>找到並選擇 <span className="text-white font-bold">「加入主畫面」</span></span>
                                  </div>
                                  <div className="flex items-center gap-2 text-[11px] text-white">
                                    <div className="w-5 h-5 rounded bg-blue-500 flex items-center justify-center text-[10px]">3</div>
                                    <span>點擊右上角的 <span className="text-blue-400 font-bold">「新增」</span></span>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <p className="text-[11px] text-neutral-400 leading-relaxed">
                                  請點擊瀏覽器選單並選擇 <span className="text-white font-bold">「安裝應用程式」</span>。
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                </div>
              </motion.div>
            )}

            {currentView === 'detail' && selectedTransaction && (
              <motion.div
                key="detail"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <TransactionDetail 
                  transaction={selectedTransaction}
                  allTags={tags}
                  onClose={() => setCurrentView('dashboard')}
                  onEdit={(t) => { setSelectedTransaction(t); setCurrentView('edit'); }}
                  onDelete={handleDelete}
                />
              </motion.div>
            )}

            {currentView === 'analysis' && (
              <motion.div
                key="analysis"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <TagAnalysis transactions={transactions} allTags={tags} />
              </motion.div>
            )}

            {currentView === 'strategies' && (
              <motion.div
                key="strategies"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <StrategyManagement 
                  userId={effectiveUserId!} 
                  strategies={strategies} 
                  checklistItems={checklistItems} 
                />
              </motion.div>
            )}

            {currentView === 'tags' && (
              <motion.div
                key="tags"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <TagManagement 
                  tags={tags}
                  onRenameTag={handleRenameTag}
                  onDeleteTag={handleDeleteTag}
                  onAddTag={handleAddGlobalTag}
                />
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </main>
      {/* Floating Action Button */}
      {effectiveUserId && currentView !== 'add' && currentView !== 'edit' && (
        <FloatingActionButton 
          onClick={() => setCurrentView('add')} 
          onQuickRecord={() => setCurrentView('add')}
          onImport={() => {}} // Placeholder for now
        />
      )}
    </div>
  );
}
