/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from 'react';
import { useState, useEffect, useMemo, Component, ErrorInfo, ReactNode } from 'react';
import { 
  LayoutDashboard, 
  PlusCircle, 
  ClipboardList, 
  BarChart3, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Calendar,
  Zap,
  Plus,
  Trash2,
  ChevronRight, 
  ChevronLeft,
  Search,
  Download,
  MoreVertical,
  X,
  LogIn,
  LogOut,
  User as UserIcon,
  ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PDCARecord } from './types';
import { saveRecord, subscribeToRecords } from './services/api';
import { auth, googleProvider, signInWithPopup, onAuthStateChanged, User } from './firebase';

// --- Error Boundary ---

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "An unexpected error occurred.";
      try {
        // Check if it's a Firestore JSON error
        const parsed = JSON.parse(this.state.error?.message || "");
        if (parsed.error) errorMessage = `Security Error: ${parsed.error} during ${parsed.operationType}`;
      } catch {
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="min-h-screen bg-navy flex items-center justify-center p-6">
          <div className="glass p-8 rounded-3xl max-w-md w-full text-center">
            <AlertCircle className="mx-auto text-red-bright mb-4" size={48} />
            <h2 className="font-serif text-2xl mb-2">Something went wrong</h2>
            <p className="text-gray-400 text-sm mb-6">{errorMessage}</p>
            <button 
              onClick={() => window.location.reload()}
              className="bg-red-bright hover:bg-red-accent text-white font-bold py-2 px-6 rounded-xl transition-all"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}

// --- Components ---

const SidebarItem = ({ icon: Icon, label, active, onClick, count }: any) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-5 py-3 text-sm transition-all border-l-4 ${
      active 
        ? 'bg-red-accent/10 text-white border-red-bright' 
        : 'text-gray-400 border-transparent hover:text-white hover:bg-white/5'
    }`}
  >
    <Icon size={18} className={active ? 'text-red-bright' : ''} />
    <span className="flex-1 text-left">{label}</span>
    {count !== undefined && (
      <span className="text-[10px] font-mono bg-white/10 px-2 py-0.5 rounded-full border border-white/10">
        {count}
      </span>
    )}
  </button>
);

const MetricCard = ({ label, value, colorClass }: any) => (
  <div className="glass p-5 rounded-2xl flex flex-col gap-1">
    <div className={`font-serif text-3xl ${colorClass}`}>{value}</div>
    <div className="text-xs text-gray-400 font-medium uppercase tracking-wider">{label}</div>
  </div>
);

const PhaseBadge = ({ phase }: { phase: 'Trigger' | 'Plan' | 'Do' | 'Check' | 'Act' }) => {
  const styles = {
    Trigger: 'bg-red-accent/20 text-red-bright border-red-accent/30',
    Plan: 'bg-blue-900/30 text-blue-400 border-blue-800/50',
    Do: 'bg-teal-accent/20 text-teal-bright border-teal-accent/40',
    Check: 'bg-amber-accent/20 text-amber-bright border-amber-accent/40',
    Act: 'bg-purple-accent/20 text-purple-bright border-purple-accent/40',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${styles[phase]}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {phase}
    </span>
  );
};

// --- Main App ---

function PDCAFrameWorkApp() {
  const [activePage, setActivePage] = useState<'dashboard' | 'new-pdca' | 'records' | 'analytics'>('dashboard');
  const [records, setRecords] = useState<PDCARecord[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<PDCARecord | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Open' | 'Closed'>('All');
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [hasShownWelcome, setHasShownWelcome] = useState(false);

  // Form State
  const [formData, setFormData] = useState<Partial<PDCARecord>>({
    fishbone: '',
    status: 'Open',
    correctiveActions: [],
    monitorPeriod: '',
    monitorStartTime: '',
    monitorEndTime: '',
    piecesChecked: '',
    defectsAfter: '',
    dhuAfter: null,
    targetMet: '',
    supervisorReview: '',
    verifyNotes: '',
    lessons: '',
    closedBy: '',
    rollout: '',
    rolloutLines: '',
    boardUpdated: '',
    briefing: '',
    finalSOP: '',
    feedWeekly: ''
  });

  const addCorrectiveAction = () => {
    setFormData(prev => ({
      ...prev,
      correctiveActions: [
        ...(prev.correctiveActions || []),
        {
          id: Math.random().toString(36).substr(2, 9),
          action: '',
          responsible: '',
          deadlineDate: '',
          deadlineTime: '',
          successMetric: '',
          fixDone: '',
          pilotLine: '',
          fixBy: '',
          fixTime: '',
          retrained: '',
          sopUpdated: '',
          trial: ''
        }
      ]
    }));
  };

  const updateCorrectiveAction = (id: string, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      correctiveActions: (prev.correctiveActions || []).map(ca => 
        ca.id === id ? { ...ca, [field]: value } : ca
      )
    }));
  };

  const removeCorrectiveAction = (id: string) => {
    setFormData(prev => ({
      ...prev,
      correctiveActions: (prev.correctiveActions || []).filter(ca => ca.id !== id)
    }));
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser && !user && !hasShownWelcome) {
        setShowWelcomeModal(true);
        setHasShownWelcome(true);
      }
      setUser(currentUser);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, [user, hasShownWelcome]);

  useEffect(() => {
    if (isAuthReady && user) {
      const unsubscribe = subscribeToRecords(user.uid, (data) => {
        setRecords(data);
      });
      return () => unsubscribe();
    }
  }, [isAuthReady, user]);

  useEffect(() => {
    let interval: any;
    if (isTimerRunning && formData.createdAt) {
      // Initial sync
      const syncTime = () => {
        const start = new Date(formData.createdAt!).getTime();
        const now = new Date().getTime();
        setTimerSeconds(Math.floor((now - start) / 1000));
      };
      syncTime();
      
      interval = setInterval(() => {
        setTimerSeconds(s => s + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, formData.createdAt]);

  useEffect(() => {
    if (formData.monitorStartTime && formData.monitorEndTime) {
      const [h1, m1] = formData.monitorStartTime.split(':').map(Number);
      const [h2, m2] = formData.monitorEndTime.split(':').map(Number);
      
      let diffMinutes = (h2 * 60 + m2) - (h1 * 60 + m1);
      if (diffMinutes < 0) diffMinutes += 24 * 60; // Handle overnight
      
      const hours = Math.floor(diffMinutes / 60);
      const mins = diffMinutes % 60;
      
      const durationStr = `${hours}h ${mins}m`;
      const periodStr = `${formData.monitorStartTime} – ${formData.monitorEndTime} (${durationStr})`;
      
      if (formData.monitorPeriod !== periodStr) {
        setFormData(prev => ({ ...prev, monitorPeriod: periodStr }));
      }
    }
  }, [formData.monitorStartTime, formData.monitorEndTime, formData.monitorPeriod]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleLogout = () => auth.signOut();

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
  };

  const startNewPDCA = () => {
    if (!user) return;
    const newId = `PDCA-${(records.length + 1).toString().padStart(3, '0')}-${Date.now().toString().slice(-4)}`;
    const newRecord: PDCARecord = {
      id: newId,
      date: new Date().toISOString().split('T')[0],
      time: new Date().toTimeString().slice(0, 5),
      status: 'Open',
      fishbone: '',
      authorUid: user.uid,
      createdAt: new Date().toISOString(),
      currentStep: 0,
      responseTime: 0,
      detectedBy: '',
      line: '',
      defect: '',
      piecesAffected: '',
      containment: '',
      whatDefect: '',
      operation: '',
      startedWhen: '',
      dhuBefore: null,
      piecesInspected: '',
      why1: '',
      why2: '',
      why3: '',
      why4: '',
      why5: '',
      correctiveActions: [{
        id: Math.random().toString(36).substr(2, 9),
        action: '',
        responsible: '',
        deadlineDate: '',
        deadlineTime: '',
        successMetric: '',
        fixDone: '',
        pilotLine: '',
        fixBy: '',
        fixTime: '',
        retrained: '',
        sopUpdated: '',
        trial: ''
      }],
      targetDHU: null,
      monitorPeriod: '',
      monitorStartTime: '',
      monitorEndTime: '',
      piecesChecked: '',
      defectsAfter: '',
      dhuAfter: null,
      targetMet: '',
      supervisorReview: '',
      verifyNotes: '',
      rollout: '',
      rolloutLines: '',
      boardUpdated: '',
      briefing: '',
      finalSOP: '',
      closedBy: '',
      lessons: '',
      feedWeekly: ''
    };
    setFormData(newRecord);
    setCurrentStep(0);
    setTimerSeconds(0);
    setIsTimerRunning(true);
    setActivePage('new-pdca');
    
    // Save initial record to Firestore
    saveRecord(newRecord).catch(err => console.error("Initial save failed:", err));
  };

  const [errorModal, setErrorModal] = useState<{ isOpen: boolean; title: string; fields: string[] }>({ isOpen: false, title: '', fields: [] });

  const validateStep = (step: number): { isValid: boolean; missingFields: string[] } => {
    const errors: string[] = [];
    const isNotEmpty = (val: any) => val !== undefined && val !== null && val !== '';
    
    if (step === 0) {
      if (!isNotEmpty(formData.date)) errors.push("Date");
      if (!isNotEmpty(formData.time)) errors.push("Time Detected");
      if (!isNotEmpty(formData.detectedBy)) errors.push("Detected By");
      if (!isNotEmpty(formData.line)) errors.push("Line / Machine #");
      if (!isNotEmpty(formData.defect)) errors.push("Defect Description");
    }
    if (step === 1) {
      if (!isNotEmpty(formData.whatDefect)) errors.push("Detailed Defect Description");
      if (!isNotEmpty(formData.operation)) errors.push("Operation / Process");
      if (!isNotEmpty(formData.piecesInspected)) errors.push("Pieces Inspected");
      if (!isNotEmpty(formData.dhuBefore)) errors.push("DHU Before Fix (%)");
      if (!isNotEmpty(formData.targetDHU)) errors.push("Target DHU (%)");
    }
    if (step === 2) {
      if (!isNotEmpty(formData.why1)) errors.push("Root Cause: WHY 1");
      if (!isNotEmpty(formData.fishbone)) errors.push("Fishbone Category");
    }
    if (step === 3) {
      if (!formData.correctiveActions || formData.correctiveActions.length === 0) {
        errors.push("At least one Corrective Action");
      } else {
        formData.correctiveActions.forEach((ca, idx) => {
          if (!isNotEmpty(ca.action)) errors.push(`Action ${idx + 1}: Plan`);
          if (!isNotEmpty(ca.responsible)) errors.push(`Action ${idx + 1}: Responsible`);
          if (!isNotEmpty(ca.deadlineDate)) errors.push(`Action ${idx + 1}: Target Date`);
        });
      }
    }
    if (step === 4) {
      if (!formData.correctiveActions || formData.correctiveActions.length === 0) {
        errors.push("At least one Corrective Action");
      } else {
        formData.correctiveActions.forEach((ca, idx) => {
          if (!isNotEmpty(ca.fixDone)) errors.push(`Action ${idx + 1}: Fix Implemented`);
          if (!isNotEmpty(ca.pilotLine)) errors.push(`Action ${idx + 1}: Line No`);
          if (!isNotEmpty(ca.fixBy)) errors.push(`Action ${idx + 1}: Completed By`);
          if (!isNotEmpty(ca.fixTime)) errors.push(`Action ${idx + 1}: Completion Time`);
          if (!isNotEmpty(ca.retrained)) errors.push(`Action ${idx + 1}: Operator Re-trained`);
          if (!isNotEmpty(ca.sopUpdated)) errors.push(`Action ${idx + 1}: SOP Updated`);
          if (!isNotEmpty(ca.trial)) errors.push(`Action ${idx + 1}: Trial Pieces`);
        });
      }
    }
    if (step === 5) {
      if (!isNotEmpty(formData.dhuAfter)) errors.push("DHU After Fix (%)");
      if (!isNotEmpty(formData.targetMet)) errors.push("Target Met?");
    }
    if (step === 6) {
      if (!isNotEmpty(formData.closedBy)) errors.push("Closed By (Name)");
      if (!isNotEmpty(formData.briefing)) errors.push("Morning Briefing Done?");
      if (!isNotEmpty(formData.finalSOP)) errors.push("SOP/Manual Updated?");
    }
    
    return { isValid: errors.length === 0, missingFields: errors };
  };

  const goToStep = async (step: number) => {
    // Only validate if moving forward
    if (step > currentStep) {
      const { isValid, missingFields } = validateStep(currentStep);
      if (!isValid) {
        setErrorModal({
          isOpen: true,
          title: "Missing Required Fields",
          fields: missingFields
        });
        return;
      }
    }

    setCurrentStep(step);
    if (user && formData.id) {
      const progressRecord: PDCARecord = {
        ...formData as PDCARecord,
        responseTime: timerSeconds,
        status: 'Open',
        currentStep: step,
        authorUid: user.uid
      };
      try {
        await saveRecord(progressRecord);
      } catch (error) {
        console.error("Failed to save progress:", error);
      }
    }
  };

  const resumePDCA = (record: PDCARecord) => {
    setFormData(record);
    setCurrentStep(record.currentStep || 0);
    setTimerSeconds(record.responseTime || 0);
    setIsTimerRunning(record.status === 'Open');
    setActivePage('new-pdca');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { id, value, type } = e.target;
    const finalValue = type === 'number' ? (value === '' ? null : parseFloat(value)) : value;
    setFormData(prev => ({ ...prev, [id]: finalValue }));
  };

  const handleSave = async () => {
    if (!user) return;
    
    const { isValid, missingFields } = validateStep(6);
    if (!isValid) {
      setErrorModal({
        isOpen: true,
        title: "Missing Required Fields",
        fields: missingFields
      });
      return;
    }

    setIsTimerRunning(false);
    const now = new Date().toISOString();
    const createdAt = formData.createdAt || now;
    const durationSeconds = Math.floor((new Date(now).getTime() - new Date(createdAt).getTime()) / 1000);

    const finalRecord: PDCARecord = {
      ...formData as PDCARecord,
      responseTime: durationSeconds,
      status: 'Closed',
      currentStep: 6,
      createdAt: createdAt,
      closedAt: now,
      authorUid: user.uid
    };

    try {
      await saveRecord(finalRecord);
      setActivePage('records');
      setFormData({
        fishbone: '',
        status: 'Open',
        correctiveActions: [],
        monitorPeriod: '',
        monitorStartTime: '',
        monitorEndTime: '',
        piecesChecked: '',
        defectsAfter: '',
        dhuAfter: null,
        targetMet: '',
        supervisorReview: '',
        verifyNotes: '',
        lessons: '',
        closedBy: '',
        rollout: '',
        rolloutLines: '',
        boardUpdated: '',
        briefing: '',
        finalSOP: '',
        feedWeekly: ''
      });
    } catch (error) {
      console.error(error);
    }
  };

  const sortedRecords = useMemo(() => {
    return [...records].sort((a, b) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateB - dateA;
    });
  }, [records]);

  const filteredRecords = useMemo(() => {
    return sortedRecords.filter(r => {
      const matchesSearch = !searchQuery || 
        [r.defect, r.line, r.fishbone].some(f => f?.toLowerCase().includes(searchQuery.toLowerCase())) ||
        r.correctiveActions?.some(ca => 
          ca.action.toLowerCase().includes(searchQuery.toLowerCase()) || 
          ca.responsible.toLowerCase().includes(searchQuery.toLowerCase())
        );
      const matchesStatus = statusFilter === 'All' || r.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [sortedRecords, searchQuery, statusFilter]);

  const stats = useMemo(() => {
    const total = records.length;
    const closed = records.filter(r => r.status === 'Closed').length;
    
    // Calculate closed this week
    const now = new Date();
    const day = now.getDay();
    // Get Monday of current week
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const startOfWeek = new Date(now.setDate(diff));
    startOfWeek.setHours(0, 0, 0, 0);
    
    const closedThisWeek = records.filter(r => {
      if (r.status !== 'Closed' || !r.createdAt) return false;
      const createdDate = new Date(r.createdAt);
      return createdDate >= startOfWeek;
    }).length;

    const currentOpen = records.filter(r => r.status === 'Open').length;
    
    const recordsWithDHU = records.filter(r => r.dhuBefore !== null && r.dhuAfter !== null);
    const avgImp = recordsWithDHU.length > 0
      ? recordsWithDHU.reduce((acc, r) => acc + ((r.dhuBefore || 0) - (r.dhuAfter || 0)), 0) / recordsWithDHU.length
      : 0;

    const closedRecords = records.filter(r => r.status === 'Closed');
    const avgResponseTime = closedRecords.length > 0
      ? closedRecords.reduce((acc, r) => acc + (r.responseTime || 0), 0) / closedRecords.length
      : 0;
    
    return { 
      total, 
      closed, 
      open: currentOpen, 
      closedThisWeek, 
      avgImp: avgImp.toFixed(1),
      avgResponseTime: formatTime(Math.floor(avgResponseTime))
    };
  }, [records, activePage, formData.defect]);

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-navy flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-red-bright border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-navy flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass p-12 rounded-[40px] max-w-md w-full text-center relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-red-bright shadow-[0_0_20px_rgba(232,83,74,0.5)]" />
          <div className="mb-8 flex justify-center">
            <div className="w-16 h-16 rounded-2xl bg-red-accent/20 flex items-center justify-center text-red-bright">
              <LayoutDashboard size={32} />
            </div>
          </div>
          <h1 className="font-serif text-4xl mb-4 tracking-tight">PDCAFrameWork</h1>
          <p className="text-gray-400 text-sm mb-10 leading-relaxed">
            PDCA Intelligence System for Garment Manufacturing. 
            Sign in to access the quality command centre.
          </p>
          <button 
            onClick={handleLogin}
            className="w-full bg-white text-navy font-bold py-4 px-8 rounded-2xl flex items-center justify-center gap-3 hover:bg-gray-100 transition-all shadow-xl"
          >
            <LogIn size={20} />
            Sign in with Google
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Error Modal */}
      {errorModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            onClick={() => setErrorModal({ ...errorModal, isOpen: false })}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm" 
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="relative w-full max-w-md glass p-8 rounded-3xl border border-red-bright/20 shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-red-bright/10 border border-red-bright/20 flex items-center justify-center text-red-bright">
                <AlertCircle size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">{errorModal.title}</h3>
                <p className="text-xs text-gray-500 uppercase tracking-widest font-bold">Validation Error</p>
              </div>
            </div>
            
            <div className="space-y-3 mb-8 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
              <p className="text-sm text-gray-400 mb-4">The following fields are required before you can proceed:</p>
              {errorModal.fields.map((field, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-bright mt-1.5 shrink-0" />
                  <span className="text-sm text-gray-200 font-medium">{field}</span>
                </div>
              ))}
            </div>

            <button 
              onClick={() => setErrorModal({ ...errorModal, isOpen: false })}
              className="w-full bg-red-bright hover:bg-red-accent text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-red-bright/20"
            >
              Got it, I'll fix it
            </button>
          </motion.div>
        </div>
      )}

      {/* Welcome Modal */}
      <AnimatePresence>
        {showWelcomeModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setShowWelcomeModal(false)}
              className="absolute inset-0 bg-black/90 backdrop-blur-md" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              className="relative w-full max-w-lg glass p-10 rounded-[2.5rem] border border-white/10 shadow-[0_30px_100px_rgba(0,0,0,0.8)] overflow-hidden"
            >
              <div className="absolute -top-24 -right-24 w-64 h-64 bg-red-bright/10 rounded-full blur-3xl" />
              <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl" />
              
              <div className="relative z-10 text-center">
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-red-bright to-red-accent flex items-center justify-center text-white mx-auto mb-8 shadow-xl shadow-red-bright/20 rotate-3">
                  <Zap size={40} />
                </div>
                
                <h2 className="font-serif text-4xl mb-4 tracking-tight">Welcome to PDCAFrameWork</h2>
                <p className="text-gray-400 text-lg mb-10 leading-relaxed">
                  Ready to solve some problems? This platform is designed to help you execute structured PDCA cycles with precision.
                </p>
                
                <div className="flex flex-col gap-4">
                  <button 
                    onClick={() => {
                      setShowWelcomeModal(false);
                      startNewPDCA();
                    }}
                    className="w-full bg-white text-navy font-bold py-5 rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl flex items-center justify-center gap-3"
                  >
                    <PlusCircle size={20} />
                    Start New PDCA Cycle
                  </button>
                  <button 
                    onClick={() => setShowWelcomeModal(false)}
                    className="w-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white font-bold py-5 rounded-2xl transition-all"
                  >
                    Go to Dashboard
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 bg-navy-light border-r border-white/10 flex flex-col">
        <div className="p-6 flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-red-bright shadow-[0_0_12px_rgba(232,83,74,0.8)] animate-pulse" />
          <h1 className="font-serif text-xl tracking-tight">PDCAFrameWork</h1>
        </div>

        <nav className="flex-1 py-4 overflow-y-auto">
          <div className="px-5 mb-2 text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">Navigation</div>
          <SidebarItem 
            icon={LayoutDashboard} 
            label="Dashboard" 
            active={activePage === 'dashboard'} 
            onClick={() => setActivePage('dashboard')} 
          />
          <SidebarItem 
            icon={PlusCircle} 
            label="PDCA Cycle" 
            active={activePage === 'new-pdca'} 
            onClick={startNewPDCA} 
            count={records.filter(r => r.status === 'Open').length || undefined}
          />
          <SidebarItem 
            icon={ClipboardList} 
            label="PDCA Records" 
            active={activePage === 'records'} 
            onClick={() => setActivePage('records')} 
            count={records.length}
          />
          <SidebarItem 
            icon={BarChart3} 
            label="Analytics" 
            active={activePage === 'analytics'} 
            onClick={() => setActivePage('analytics')} 
          />

          <div className="px-5 mt-8 mb-2 text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">Quick Defects</div>
          {['Untrimmed Thread', 'Stitch Skipping', 'Seam Puckering', 'Fabric Shading'].map(d => (
            <button 
              key={d}
              onClick={() => { startNewPDCA(); setFormData(prev => ({ ...prev, defect: d })); }}
              className="w-full text-left px-5 py-2 text-xs text-gray-400 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-purple-bright/50" />
              {d}
            </button>
          ))}
        </nav>

        <div className="p-5 border-t border-white/10 bg-black/20">
          <div className="flex items-center gap-3 mb-4">
            <img src={user.photoURL || ''} alt="" className="w-8 h-8 rounded-full border border-white/10" />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold truncate">{user.displayName}</div>
              <div className="text-[10px] text-gray-500 truncate">{user.email}</div>
            </div>
            <button onClick={handleLogout} className="text-gray-500 hover:text-red-bright transition-colors">
              <LogOut size={14} />
            </button>
          </div>
          <div className="flex justify-between text-[10px] text-gray-500 mb-1">
            <span>OPEN ISSUES</span>
            <span className="font-mono text-white">{stats.open}</span>
          </div>
          <div className="flex justify-between text-[10px] text-gray-500">
            <span>CLOSED THIS WEEK</span>
            <span className="font-mono text-white">{stats.closedThisWeek}</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-navy relative">
        <div className="p-8 max-w-6xl mx-auto">
          
          {/* Dashboard Page */}
          {activePage === 'dashboard' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div className="mb-8">
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Command Centre</div>
                <h2 className="font-serif text-4xl tracking-tight mb-2">Quality Intelligence</h2>
                <p className="text-gray-400 text-sm">Real-time PDCA tracking and DHU improvement analytics.</p>
              </div>

              <div className="grid grid-cols-5 gap-4 mb-10">
                <MetricCard label="Total Issues" value={stats.total} />
                <MetricCard label="Open / In Progress" value={stats.open} colorClass="text-red-bright" />
                <MetricCard label="Resolved" value={stats.closed} colorClass="text-teal-bright" />
                <MetricCard label="Avg DHU Imp." value={stats.avgImp + '%'} colorClass="text-amber-bright" />
                <MetricCard label="Avg Response" value={stats.avgResponseTime} colorClass="text-blue-400" />
              </div>

              <div className="flex items-center gap-4 mb-6">
                <div className="h-px flex-1 bg-white/10" />
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">Recent Activity</div>
                <div className="h-px flex-1 bg-white/10" />
              </div>

              <div className="glass rounded-2xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                      <th className="px-6 py-4">Ref#</th>
                      <th className="px-6 py-4">Defect</th>
                      <th className="px-6 py-4">Line</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Imp.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {sortedRecords.slice(0, 5).map(r => (
                      <tr key={r.id} className="hover:bg-white/5 transition-colors cursor-pointer" onClick={() => { r.status === 'Open' ? resumePDCA(r) : setSelectedRecord(r); }}>
                        <td className="px-6 py-4 font-mono text-xs text-gray-400">{r.id}</td>
                        <td className="px-6 py-4 text-sm font-medium">{r.defect}</td>
                        <td className="px-6 py-4 text-xs text-gray-400">{r.line}</td>
                        <td className="px-6 py-4">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${r.status === 'Closed' ? 'bg-teal-bright/10 text-teal-bright' : 'bg-red-bright/10 text-red-bright'}`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-mono text-xs text-teal-bright">
                          {r.dhuBefore && r.dhuAfter ? `-${(r.dhuBefore - r.dhuAfter).toFixed(1)}%` : '—'}
                        </td>
                      </tr>
                    ))}
                    {records.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-gray-500 text-sm italic">
                          No issues logged yet. Start a new PDCA to begin.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {/* New PDCA Page */}
          {activePage === 'new-pdca' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="flex justify-between items-end mb-8">
                <div>
                  <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">PDCA Workflow</div>
                  <h2 className="font-serif text-4xl tracking-tight">PDCA Cycle</h2>
                </div>
                <div className="flex items-center gap-6">
                  <button 
                    onClick={() => { goToStep(currentStep); setActivePage('dashboard'); }}
                    className="bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-colors text-gray-400 hover:text-white"
                  >
                    Save & Exit
                  </button>
                  <div className="text-right">
                    <div className={`font-mono text-3xl ${timerSeconds > 900 ? 'text-red-bright' : 'text-white'}`}>
                      {formatTime(timerSeconds)}
                    </div>
                    <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Response Clock</div>
                  </div>
                </div>
              </div>

              {/* Stepper */}
              <div className="flex items-center justify-between mb-12 relative">
                <div className="absolute top-4 left-0 right-0 h-0.5 bg-white/10 -z-10" />
                {[
                  { label: 'Trigger', icon: AlertCircle },
                  { label: 'P1: Define', icon: ClipboardList },
                  { label: 'P2: Root Cause', icon: Search },
                  { label: 'P3: Plan Fix', icon: Zap },
                  { label: 'Do', icon: CheckCircle2 },
                  { label: 'Check', icon: BarChart3 },
                  { label: 'Act', icon: CheckCircle2 }
                ].map((s, i) => (
                  <div key={s.label} className="flex flex-col items-center gap-2">
                    <button 
                      onClick={() => i <= currentStep && goToStep(i)}
                      className={`w-9 h-9 rounded-full flex items-center justify-center transition-all border-2 ${
                        i < currentStep ? 'bg-teal-bright border-teal-bright text-white' :
                        i === currentStep ? 'bg-red-bright border-red-bright text-white shadow-[0_0_15px_rgba(232,83,74,0.4)]' :
                        'bg-navy-light border-white/10 text-gray-500'
                      }`}
                    >
                      {s.label.startsWith('P') && s.label.includes(':') ? (
                        <span className="text-xs font-bold">{s.label.split(':')[0]}</span>
                      ) : (
                        <s.icon size={16} />
                      )}
                    </button>
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${i === currentStep ? 'text-white' : 'text-gray-500'}`}>
                      {s.label}
                    </span>
                  </div>
                ))}
              </div>

              {/* Step Panels */}
              <div className="space-y-6">
                {currentStep === 0 && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                    <PhaseBadge phase="Trigger" />
                    <div className="glass p-8 rounded-2xl relative overflow-hidden">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-bright" />
                      <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-6 flex items-center gap-2">
                        <span className="w-1 h-4 bg-red-bright rounded-full" />
                        TRIGGER INFORMATION
                      </h3>
                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                            Date <span className="text-red-bright">*</span>
                          </label>
                          <div className="relative">
                            <input id="date" type="date" value={formData.date} onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white/30 appearance-none" />
                            <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={16} />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                            Time Detected <span className="text-red-bright">*</span>
                          </label>
                          <div className="relative">
                            <input id="time" type="time" value={formData.time} onChange={handleInputChange} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white/30" />
                            <Clock className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={16} />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                            Detected By (Name / Role) <span className="text-red-bright">*</span>
                          </label>
                          <input id="detectedBy" type="text" value={formData.detectedBy} onChange={handleInputChange} placeholder="e.g. Inline QC Checker — Rahim" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white/30 italic" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                            Line / Machine # <span className="text-red-bright">*</span>
                          </label>
                          <input id="line" type="text" value={formData.line} onChange={handleInputChange} placeholder="e.g. Line 5 / Machine #7" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white/30 italic" />
                        </div>
                        <div className="space-y-2 col-span-2">
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                            Defect Description <span className="text-red-bright">*</span>
                          </label>
                          <input id="defect" type="text" value={formData.defect} onChange={handleInputChange} placeholder="Untrimmed Thread" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white/30" />
                        </div>
                        <div className="space-y-2 col-span-2">
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Pieces Affected (Estimate)</label>
                          <input id="piecesAffected" type="text" value={formData.piecesAffected} onChange={handleInputChange} placeholder="e.g. ~30 out of 80 inspected" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white/30 italic" />
                        </div>
                      </div>
                      <div className="mt-6 flex items-center gap-2 text-[10px] text-gray-500 italic">
                        <Zap size={12} className="text-red-bright/60" />
                        All fields marked <span className="text-red-bright">*</span> are required before proceeding. Time is critical.
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <button onClick={() => goToStep(1)} className="bg-red-bright hover:bg-red-accent text-white font-bold py-3 px-8 rounded-xl transition-all flex items-center gap-2">
                        Next: Define <ChevronRight size={18} />
                      </button>
                    </div>
                  </motion.div>
                )}

                {currentStep === 1 && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                    <PhaseBadge phase="Plan" />
                    <div className="glass p-8 rounded-2xl relative overflow-hidden">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500" />
                      <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-6 flex items-center gap-2">
                        <span className="w-1 h-4 bg-blue-500 rounded-full" />
                        P1: DEFINE PROBLEM
                      </h3>
                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2 col-span-2">
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                            Detailed Defect Description <span className="text-red-bright">*</span>
                          </label>
                          <textarea id="whatDefect" value={formData.whatDefect} onChange={handleInputChange} placeholder="Describe the specific quality issue in detail..." className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white/30 h-24" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                            Operation / Process <span className="text-red-bright">*</span>
                          </label>
                          <input id="operation" type="text" value={formData.operation} onChange={handleInputChange} placeholder="e.g. Side Seam Stitching" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white/30" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                            Pieces Inspected <span className="text-red-bright">*</span>
                          </label>
                          <input id="piecesInspected" type="text" value={formData.piecesInspected} onChange={handleInputChange} placeholder="e.g. 100 pieces" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white/30" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                            DHU Before Fix (%) <span className="text-red-bright">*</span>
                          </label>
                          <input id="dhuBefore" type="number" value={formData.dhuBefore || ''} onChange={handleInputChange} placeholder="e.g. 15" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white/30" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                            Target DHU (%) <span className="text-red-bright">*</span>
                          </label>
                          <input id="targetDHU" type="number" value={formData.targetDHU || ''} onChange={handleInputChange} placeholder="e.g. 2" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white/30" />
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <button onClick={() => goToStep(0)} className="text-gray-400 hover:text-white flex items-center gap-2">
                        <ChevronLeft size={18} /> Back
                      </button>
                      <button onClick={() => goToStep(2)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-xl transition-all flex items-center gap-2">
                        Next: Root Cause <ChevronRight size={18} />
                      </button>
                    </div>
                  </motion.div>
                )}

                {currentStep === 2 && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                    <PhaseBadge phase="Plan" />
                    <div className="glass p-8 rounded-2xl relative overflow-hidden">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500" />
                      <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-6 flex items-center gap-2">
                        <span className="w-1 h-4 bg-blue-500 rounded-full" />
                        P2: ROOT CAUSE ANALYSIS
                      </h3>
                      <div className="space-y-4">
                        {[1, 2, 3, 4, 5].map(num => (
                          <div key={num} className="flex gap-4 items-start">
                            <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex flex-col items-center justify-center text-[9px] font-bold text-blue-400 shrink-0 mt-1 leading-tight">
                              <span>WHY</span>
                              <span>{num}</span>
                              {num === 1 && <span className="text-red-bright">*</span>}
                            </div>
                            <input 
                              id={`why${num}`} 
                              type="text" 
                              value={(formData as any)[`why${num}`] || ''} 
                              onChange={handleInputChange} 
                              placeholder={`Level ${num} analysis...`}
                              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white/30" 
                            />
                          </div>
                        ))}
                        <div className="pt-4 border-t border-white/5 mt-4">
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 block flex items-center gap-1">
                            Fishbone Category <span className="text-red-bright">*</span>
                          </label>
                          <div className="grid grid-cols-3 gap-3">
                            {['Man', 'Machine', 'Method', 'Material', 'Environment', 'Measurement'].map(cat => (
                              <button
                                key={cat}
                                onClick={() => setFormData(prev => ({ ...prev, fishbone: cat }))}
                                className={`px-4 py-2 rounded-xl text-xs font-medium border transition-all ${
                                  formData.fishbone === cat 
                                    ? 'bg-blue-500/20 border-blue-500 text-blue-400' 
                                    : 'bg-white/5 border-white/10 text-gray-500 hover:border-white/20'
                                }`}
                              >
                                {cat}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <button onClick={() => goToStep(1)} className="text-gray-400 hover:text-white flex items-center gap-2">
                        <ChevronLeft size={18} /> Back
                      </button>
                      <button onClick={() => goToStep(3)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-xl transition-all flex items-center gap-2">
                        Next: Plan Fix <ChevronRight size={18} />
                      </button>
                    </div>
                  </motion.div>
                )}

                {currentStep === 3 && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                    <PhaseBadge phase="Plan" />
                    <div className="glass p-8 rounded-2xl relative overflow-hidden">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500" />
                      <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-6 flex items-center gap-2">
                        <span className="w-1 h-4 bg-blue-500 rounded-full" />
                        P3: PLAN FIX
                      </h3>
                      <div className="space-y-8">
                        {formData.correctiveActions?.map((ca, index) => (
                          <div key={ca.id} className="space-y-6 p-6 border border-white/5 rounded-2xl relative bg-white/5">
                            {formData.correctiveActions!.length > 1 && (
                              <button 
                                onClick={() => removeCorrectiveAction(ca.id)}
                                className="absolute top-4 right-4 text-gray-500 hover:text-red-bright transition-colors"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                            <div className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                              <div className="w-4 h-4 rounded-full bg-blue-500 text-navy flex items-center justify-center text-[8px]">{index + 1}</div>
                              Action Item
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                                Corrective Action Plan <span className="text-red-bright">*</span>
                              </label>
                              <textarea 
                                value={ca.action} 
                                onChange={(e) => updateCorrectiveAction(ca.id, 'action', e.target.value)} 
                                placeholder="What specific steps will be taken?" 
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white/30 h-24" 
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-6">
                              <div className="space-y-2">
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                                  Responsible Person <span className="text-red-bright">*</span>
                                </label>
                                <input 
                                  type="text" 
                                  value={ca.responsible} 
                                  onChange={(e) => updateCorrectiveAction(ca.id, 'responsible', e.target.value)} 
                                  placeholder="Name of owner" 
                                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white/30" 
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                                    Target Date <span className="text-red-bright">*</span>
                                  </label>
                                  <input 
                                    type="date" 
                                    value={ca.deadlineDate} 
                                    onChange={(e) => updateCorrectiveAction(ca.id, 'deadlineDate', e.target.value)} 
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white/30" 
                                  />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Target Time</label>
                                  <input 
                                    type="time" 
                                    value={ca.deadlineTime} 
                                    onChange={(e) => updateCorrectiveAction(ca.id, 'deadlineTime', e.target.value)} 
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white/30" 
                                  />
                                </div>
                              </div>
                              <div className="space-y-2 col-span-2">
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Success Metric</label>
                                <input 
                                  type="text" 
                                  value={ca.successMetric} 
                                  onChange={(e) => updateCorrectiveAction(ca.id, 'successMetric', e.target.value)} 
                                  placeholder="e.g. Zero defects in next 500 pieces" 
                                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white/30" 
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                        <button 
                          onClick={addCorrectiveAction}
                          className="w-full py-4 border-2 border-dashed border-white/10 rounded-2xl text-gray-500 hover:text-white hover:border-white/20 transition-all flex items-center justify-center gap-2 text-sm font-bold"
                        >
                          <Plus size={16} /> Add Another Corrective Action
                        </button>
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <button onClick={() => goToStep(2)} className="text-gray-400 hover:text-white flex items-center gap-2">
                        <ChevronLeft size={18} /> Back
                      </button>
                      <button onClick={() => goToStep(4)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-xl transition-all flex items-center gap-2">
                        Next: Implement <ChevronRight size={18} />
                      </button>
                    </div>
                  </motion.div>
                )}

                {currentStep === 4 && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                    <PhaseBadge phase="Do" />
                    <div className="space-y-6">
                      {formData.correctiveActions?.map((ca, index) => (
                        <div key={ca.id} className="glass p-8 rounded-2xl relative overflow-hidden">
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-teal-bright" />
                          <div className="flex justify-between items-center mb-6">
                            <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400">Implementation: Action {index + 1}</h3>
                            <div className="text-[10px] font-mono text-teal-bright bg-teal-bright/10 px-2 py-1 rounded border border-teal-bright/20">
                              {ca.action.substring(0, 40)}{ca.action.length > 40 ? '...' : ''}
                            </div>
                          </div>
                          <div className="space-y-6">
                            <div className="space-y-2">
                              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">Fix Implemented — Describe What Was Done <span className="text-red-bright">*</span></label>
                              <textarea 
                                value={ca.fixDone || ''} 
                                onChange={(e) => updateCorrectiveAction(ca.id, 'fixDone', e.target.value)} 
                                placeholder="Describe specifically what was done for this action item..." 
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white/30 h-24" 
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-6">
                              <div className="space-y-2">
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">Line No <span className="text-red-bright">*</span></label>
                                <input 
                                  type="text" 
                                  value={ca.pilotLine || ''} 
                                  onChange={(e) => updateCorrectiveAction(ca.id, 'pilotLine', e.target.value)} 
                                  placeholder="e.g. Line 2"
                                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white/30" 
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">Completed By (Name) <span className="text-red-bright">*</span></label>
                                <input 
                                  type="text" 
                                  value={ca.fixBy || ''} 
                                  onChange={(e) => updateCorrectiveAction(ca.id, 'fixBy', e.target.value)} 
                                  placeholder="e.g. Mechanic Hasan"
                                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white/30" 
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">Completion Time <span className="text-red-bright">*</span></label>
                                <div className="relative">
                                  <input 
                                    type="time" 
                                    value={ca.fixTime || ''} 
                                    onChange={(e) => updateCorrectiveAction(ca.id, 'fixTime', e.target.value)} 
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white/30" 
                                  />
                                  <Clock className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={16} />
                                </div>
                              </div>
                              <div className="space-y-2">
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">Operator Re-trained? <span className="text-red-bright">*</span></label>
                                <div className="relative">
                                  <select 
                                    value={ca.retrained || ''} 
                                    onChange={(e) => updateCorrectiveAction(ca.id, 'retrained', e.target.value)} 
                                    className="w-full bg-navy-light border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white/30 appearance-none pr-10"
                                  >
                                    <option value="" className="bg-navy text-white">— Select —</option>
                                    <option value="Yes" className="bg-navy text-white">Yes</option>
                                    <option value="No" className="bg-navy text-white">No</option>
                                  </select>
                                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={16} />
                                </div>
                              </div>
                              <div className="space-y-2">
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">SOP / Work Aid Updated? <span className="text-red-bright">*</span></label>
                                <div className="relative">
                                  <select 
                                    value={ca.sopUpdated || ''} 
                                    onChange={(e) => updateCorrectiveAction(ca.id, 'sopUpdated', e.target.value)} 
                                    className="w-full bg-navy-light border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white/30 appearance-none pr-10"
                                  >
                                    <option value="" className="bg-navy text-white">— Select —</option>
                                    <option value="Yes" className="bg-navy text-white">Yes</option>
                                    <option value="No" className="bg-navy text-white">No</option>
                                  </select>
                                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={16} />
                                </div>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">Trial Pieces Before Restart <span className="text-red-bright">*</span></label>
                              <input 
                                type="text" 
                                value={ca.trial || ''} 
                                onChange={(e) => updateCorrectiveAction(ca.id, 'trial', e.target.value)} 
                                placeholder="e.g. 10 trial pieces run — all passed"
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white/30" 
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between">
                      <button onClick={() => goToStep(3)} className="text-gray-400 hover:text-white flex items-center gap-2">
                        <ChevronLeft size={18} /> Back
                      </button>
                      <button onClick={() => goToStep(5)} className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 px-8 rounded-xl transition-all flex items-center gap-2">
                        Next: Verify <ChevronRight size={18} />
                      </button>
                    </div>
                  </motion.div>
                )}

                {currentStep === 5 && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                    <PhaseBadge phase="Check" />
                    <div className="glass p-8 rounded-2xl relative overflow-hidden">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-bright" />
                      <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-6">Result Verification</h3>
                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2 col-span-2">
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Monitoring Period</label>
                          <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-1">
                              <span className="text-[9px] text-gray-500 uppercase">Start Time</span>
                              <input 
                                id="monitorStartTime" 
                                type="time" 
                                value={formData.monitorStartTime || ''} 
                                onChange={handleInputChange} 
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white/30" 
                              />
                            </div>
                            <div className="space-y-1">
                              <span className="text-[9px] text-gray-500 uppercase">End Time</span>
                              <input 
                                id="monitorEndTime" 
                                type="time" 
                                value={formData.monitorEndTime || ''} 
                                onChange={handleInputChange} 
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white/30" 
                              />
                            </div>
                            <div className="space-y-1">
                              <span className="text-[9px] text-gray-500 uppercase">Calculated Period</span>
                              <input 
                                id="monitorPeriod" 
                                type="text" 
                                value={formData.monitorPeriod || ''} 
                                readOnly
                                placeholder="Auto-calculated"
                                className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-sm text-gray-400 cursor-not-allowed" 
                              />
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Pieces Checked After Fix</label>
                          <input 
                            id="piecesChecked" 
                            type="text" 
                            value={formData.piecesChecked || ''} 
                            onChange={handleInputChange} 
                            placeholder="e.g. 100"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white/30" 
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Defects Found After Fix</label>
                          <input 
                            id="defectsAfter" 
                            type="text" 
                            value={formData.defectsAfter || ''} 
                            onChange={handleInputChange} 
                            placeholder="e.g. 0"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white/30" 
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">DHU After Fix (%) <span className="text-red-500">*</span></label>
                          <input 
                            id="dhuAfter" 
                            type="number" 
                            value={formData.dhuAfter || ''} 
                            onChange={handleInputChange} 
                            placeholder="e.g. 3.8"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white/30" 
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                            Target Met? <span className="text-red-bright">*</span>
                          </label>
                          <div className="relative">
                            <select 
                              id="targetMet" 
                              value={formData.targetMet} 
                              onChange={handleInputChange} 
                              className="w-full bg-navy-light border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white/30 appearance-none pr-10"
                            >
                              <option value="" className="bg-navy text-white">— Select —</option>
                              <option value="Yes" className="bg-navy text-white">Yes</option>
                              <option value="No" className="bg-navy text-white">No</option>
                            </select>
                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={16} />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Reviewed With Supervisor?</label>
                          <div className="relative">
                            <select 
                              id="supervisorReview" 
                              value={formData.supervisorReview} 
                              onChange={handleInputChange} 
                              className="w-full bg-navy-light border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white/30 appearance-none pr-10"
                            >
                              <option value="" className="bg-navy text-white">— Select —</option>
                              <option value="Yes" className="bg-navy text-white">Yes</option>
                              <option value="No" className="bg-navy text-white">No</option>
                            </select>
                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={16} />
                          </div>
                        </div>
                        <div className="space-y-2 col-span-2">
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Decision & Notes</label>
                          <textarea 
                            id="verifyNotes" 
                            value={formData.verifyNotes} 
                            onChange={handleInputChange} 
                            placeholder="e.g. Defect rate dropped from 22% to 3.8%. Target of 5% met. Proceeding to standardize."
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white/30 h-24" 
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <button onClick={() => goToStep(4)} className="text-gray-400 hover:text-white flex items-center gap-2">
                        <ChevronLeft size={18} /> Back
                      </button>
                      <button onClick={() => goToStep(6)} className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 px-8 rounded-xl transition-all flex items-center gap-2">
                        Next: Standardize <ChevronRight size={18} />
                      </button>
                    </div>
                  </motion.div>
                )}

                {currentStep === 6 && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                    <PhaseBadge phase="Act" />
                    <div className="glass p-8 rounded-2xl relative overflow-hidden">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-purple-bright" />
                      <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-6">Standardization & Record</h3>
                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Fix Rolled Out to Other Lines?</label>
                          <div className="relative">
                            <select 
                              id="rollout" 
                              value={formData.rollout} 
                              onChange={handleInputChange} 
                              className="w-full bg-navy-light border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white/30 appearance-none pr-10"
                            >
                              <option value="" className="bg-navy text-white">— Select —</option>
                              <option value="Yes" className="bg-navy text-white">Yes</option>
                              <option value="No" className="bg-navy text-white">No</option>
                              <option value="Not Applicable" className="bg-navy text-white">Not Applicable</option>
                            </select>
                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={16} />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Which Lines?</label>
                          <input 
                            id="rolloutLines" 
                            type="text" 
                            value={formData.rolloutLines || ''} 
                            onChange={handleInputChange} 
                            placeholder="e.g. Lines 1, 3, 5"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white/30" 
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Quality Alert Board Updated?</label>
                          <div className="relative">
                            <select 
                              id="boardUpdated" 
                              value={formData.boardUpdated} 
                              onChange={handleInputChange} 
                              className="w-full bg-navy-light border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white/30 appearance-none pr-10"
                            >
                              <option value="" className="bg-navy text-white">— Select —</option>
                              <option value="Yes" className="bg-navy text-white">Yes</option>
                              <option value="No" className="bg-navy text-white">No</option>
                              <option value="Not Applicable" className="bg-navy text-white">Not Applicable</option>
                            </select>
                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={16} />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                            Morning Briefing Done? <span className="text-red-bright">*</span>
                          </label>
                          <div className="relative">
                            <select 
                              id="briefing" 
                              value={formData.briefing} 
                              onChange={handleInputChange} 
                              className="w-full bg-navy-light border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white/30 appearance-none pr-10"
                            >
                              <option value="" className="bg-navy text-white">— Select —</option>
                              <option value="Yes" className="bg-navy text-white">Yes</option>
                              <option value="No" className="bg-navy text-white">No</option>
                              <option value="Scheduled for tomorrow" className="bg-navy text-white">Scheduled for tomorrow</option>
                              <option value="Not Applicable" className="bg-navy text-white">Not Applicable</option>
                            </select>
                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={16} />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                            SOP/Manual Updated? <span className="text-red-bright">*</span>
                          </label>
                          <div className="relative">
                            <select 
                              id="finalSOP" 
                              value={formData.finalSOP} 
                              onChange={handleInputChange} 
                              className="w-full bg-navy-light border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white/30 appearance-none pr-10"
                            >
                              <option value="" className="bg-navy text-white">— Select —</option>
                              <option value="Yes" className="bg-navy text-white">Yes</option>
                              <option value="No" className="bg-navy text-white">No</option>
                              <option value="Not Applicable" className="bg-navy text-white">Not Applicable</option>
                            </select>
                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={16} />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                            Closed By (Name) <span className="text-red-bright">*</span>
                          </label>
                          <input 
                            id="closedBy" 
                            type="text" 
                            value={formData.closedBy || ''} 
                            onChange={handleInputChange} 
                            placeholder="e.g. QC Manager — Mr. Rahman"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white/30" 
                          />
                        </div>
                        <div className="space-y-2 col-span-2">
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Lessons Learned</label>
                          <textarea 
                            id="lessons" 
                            value={formData.lessons} 
                            onChange={handleInputChange} 
                            placeholder="e.g. Need a visual trim standard at all workstations. Add thread trim check to new operator onboarding. Consider auto-trim attachment for bartack machines."
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white/30 h-24" 
                          />
                        </div>
                        <div className="space-y-2 col-span-2">
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Feed Into Weekly PDCA Review?</label>
                          <div className="relative">
                            <select 
                              id="feedWeekly" 
                              value={formData.feedWeekly} 
                              onChange={handleInputChange} 
                              className="w-full bg-navy-light border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white/30 appearance-none pr-10"
                            >
                              <option value="" className="bg-navy text-white">— Select —</option>
                              <option value="Yes" className="bg-navy text-white">Yes</option>
                              <option value="No" className="bg-navy text-white">No</option>
                              <option value="Not Applicable" className="bg-navy text-white">Not Applicable</option>
                            </select>
                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={16} />
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <button onClick={() => goToStep(5)} className="text-gray-400 hover:text-white flex items-center gap-2">
                        <ChevronLeft size={18} /> Back
                      </button>
                      <button onClick={handleSave} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-12 rounded-xl transition-all shadow-[0_0_20px_rgba(96,85,204,0.3)]">
                        Complete & Save PDCA
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}

          {/* Records Page */}
          {activePage === 'records' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="mb-8">
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">History</div>
                <h2 className="font-serif text-4xl tracking-tight mb-2">PDCA Register</h2>
                <p className="text-gray-400 text-sm">Full audit trail of all quality interventions.</p>
              </div>

              <div className="flex gap-4 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                  <input 
                    type="text" 
                    placeholder="Search by defect, line, or owner..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-white/30"
                  />
                </div>
                <div className="relative">
                  <select 
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="bg-navy-light border border-white/10 rounded-xl pl-4 pr-10 py-2.5 text-sm focus:outline-none focus:border-white/30 appearance-none"
                  >
                    <option value="All" className="bg-navy text-white">All Status</option>
                    <option value="Open" className="bg-navy text-white">Open</option>
                    <option value="Closed" className="bg-navy text-white">Closed</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={14} />
                </div>
                <button className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm hover:bg-white/10 transition-colors flex items-center gap-2">
                  <Download size={16} /> Export
                </button>
              </div>

              <div className="glass rounded-2xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                      <th className="px-6 py-4">ID</th>
                      <th className="px-6 py-4">Date</th>
                      <th className="px-6 py-4">Defect</th>
                      <th className="px-6 py-4">Line</th>
                      <th className="px-6 py-4">Category</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Response Time</th>
                      <th className="px-6 py-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredRecords.map(r => {
                      const currentResponseTime = r.status === 'Closed' 
                        ? r.responseTime 
                        : Math.floor((new Date().getTime() - new Date(r.createdAt).getTime()) / 1000);
                      
                      return (
                        <tr key={r.id} className="hover:bg-white/5 transition-colors">
                          <td className="px-6 py-4 font-mono text-xs text-gray-400">{r.id}</td>
                          <td className="px-6 py-4 text-xs text-gray-400">{r.date}</td>
                          <td className="px-6 py-4 text-sm font-medium">{r.defect}</td>
                          <td className="px-6 py-4 text-xs text-gray-400">{r.line}</td>
                          <td className="px-6 py-4">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-bright/10 text-purple-bright">
                              {r.fishbone || '—'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${r.status === 'Closed' ? 'bg-teal-bright/10 text-teal-bright' : 'bg-red-bright/10 text-red-bright'}`}>
                              {r.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-mono text-xs text-gray-400">
                            {formatTime(currentResponseTime)}
                          </td>
                          <td className="px-6 py-4 text-right">
                            {r.status === 'Open' ? (
                              <button onClick={() => resumePDCA(r)} className="text-amber-bright hover:text-white transition-colors text-xs font-bold uppercase tracking-widest">
                                Resume
                              </button>
                            ) : (
                              <button onClick={() => setSelectedRecord(r)} className="text-gray-500 hover:text-white transition-colors">
                                <MoreVertical size={16} />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {/* Analytics Page */}
          {activePage === 'analytics' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="mb-8">
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Insights</div>
                <h2 className="font-serif text-4xl tracking-tight mb-2">Quality Analytics</h2>
                <p className="text-gray-400 text-sm">Root cause distribution and systemic pattern analysis.</p>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-10">
                <div className="glass p-8 rounded-2xl">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-6">Root Cause Distribution</h3>
                  <div className="space-y-4">
                    {['Man', 'Machine', 'Method', 'Material'].map(cat => {
                      const count = records.filter(r => r.fishbone === cat).length;
                      const pct = records.length > 0 ? (count / records.length) * 100 : 0;
                      return (
                        <div key={cat} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-400">{cat}</span>
                            <span className="font-mono">{count}</span>
                          </div>
                          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }} 
                              animate={{ width: `${pct}%` }} 
                              className="h-full bg-blue-500"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="glass p-8 rounded-2xl">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-6">DHU Improvement Trend</h3>
                  <div className="h-48 flex items-end gap-2">
                    {records.slice(-10).map((r, i) => {
                      const imp = (r.dhuBefore || 0) - (r.dhuAfter || 0);
                      const height = Math.max(10, Math.min(100, imp * 5));
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-2">
                          <div className="text-[8px] font-mono text-teal-bright">{imp > 0 ? `-${imp}%` : '0'}</div>
                          <motion.div 
                            initial={{ height: 0 }} 
                            animate={{ height: `${height}%` }} 
                            className="w-full bg-teal-bright/40 border-t border-teal-bright rounded-t-sm"
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-4 text-[10px] text-center text-gray-500 uppercase tracking-widest">Last 10 Interventions</div>
                </div>
              </div>
            </motion.div>
          )}

        </div>
      </main>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedRecord && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setSelectedRecord(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-2xl bg-navy-light border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
            >
              <div className="p-8">
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">{selectedRecord.id}</div>
                    <h3 className="font-serif text-3xl">{selectedRecord.defect}</h3>
                  </div>
                  <button onClick={() => setSelectedRecord(null)} className="text-gray-500 hover:text-white transition-colors">
                    <X size={24} />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-8 mb-8">
                  <div>
                    <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Context</div>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Date/Time</span>
                        <span>{selectedRecord.date} {selectedRecord.time}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Line</span>
                        <span>{selectedRecord.line}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Fishbone Category</span>
                        <span className="text-purple-bright font-bold">{selectedRecord.fishbone || '—'}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Response Time</span>
                        <span className="font-mono">
                          {formatTime(
                            selectedRecord.status === 'Closed' 
                              ? selectedRecord.responseTime 
                              : Math.floor((new Date().getTime() - new Date(selectedRecord.createdAt).getTime()) / 1000)
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Performance</div>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">DHU Before</span>
                        <span className="font-mono text-red-bright">{selectedRecord.dhuBefore}%</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">DHU After</span>
                        <span className="font-mono text-teal-bright">{selectedRecord.dhuAfter}%</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Improvement</span>
                        <span className="font-mono text-teal-bright">
                          {selectedRecord.dhuBefore && selectedRecord.dhuAfter ? `-${(selectedRecord.dhuBefore - selectedRecord.dhuAfter).toFixed(1)}%` : '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  {selectedRecord.correctiveActions && selectedRecord.correctiveActions.length > 0 && (
                    <div className="glass p-5 rounded-2xl">
                      <div className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-4">Corrective Actions</div>
                      <div className="space-y-4">
                        {selectedRecord.correctiveActions.map((ca, idx) => (
                          <div key={ca.id} className="p-4 bg-white/5 rounded-xl border border-white/5 space-y-4">
                            <div>
                              <div className="flex justify-between items-start mb-2">
                                <div className="text-[10px] font-bold text-blue-400 uppercase">Action {idx + 1} (Plan)</div>
                                <div className="text-[10px] font-mono text-blue-400">{ca.deadlineDate} {ca.deadlineTime}</div>
                              </div>
                              <p className="text-sm text-gray-300 mb-3">{ca.action}</p>
                              <div className="grid grid-cols-2 gap-4 text-[10px]">
                                <div>
                                  <span className="text-gray-500 uppercase block">Responsible</span>
                                  <span className="text-white">{ca.responsible}</span>
                                </div>
                                <div>
                                  <span className="text-gray-500 uppercase block">Success Metric</span>
                                  <span className="text-white">{ca.successMetric}</span>
                                </div>
                              </div>
                            </div>

                            {ca.fixDone && (
                              <div className="pt-4 border-t border-white/10">
                                <div className="text-[10px] font-bold text-teal-bright uppercase mb-2">Implementation (Do)</div>
                                <p className="text-sm text-gray-300 mb-3">{ca.fixDone}</p>
                                <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-[10px]">
                                  <div>
                                    <span className="text-gray-500 uppercase block">Completed By</span>
                                    <span className="text-white">{ca.fixBy} ({ca.fixTime})</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-500 uppercase block">Line No</span>
                                    <span className="text-white">{ca.pilotLine}</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-500 uppercase block">Retrained / SOP</span>
                                    <span className="text-white">{ca.retrained} / {ca.sopUpdated}</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-500 uppercase block">Trial Pieces</span>
                                    <span className="text-white">{ca.trial}</span>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="glass p-5 rounded-2xl">
                    <div className="text-[10px] font-bold text-amber-bright uppercase tracking-widest mb-4">Verification Results (Check)</div>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4 text-[10px]">
                        <div>
                          <span className="text-gray-500 uppercase block">Monitoring Period</span>
                          <span className="text-white">{selectedRecord.monitorPeriod || '—'}</span>
                        </div>
                        <div>
                          <span className="text-gray-500 uppercase block">Pieces Checked</span>
                          <span className="text-white">{selectedRecord.piecesChecked || '—'}</span>
                        </div>
                        <div>
                          <span className="text-gray-500 uppercase block">Defects Found</span>
                          <span className="text-white">{selectedRecord.defectsAfter || '—'}</span>
                        </div>
                        <div>
                          <span className="text-gray-500 uppercase block">DHU After Fix</span>
                          <span className="text-white font-bold text-amber-bright">{selectedRecord.dhuAfter}%</span>
                        </div>
                        <div>
                          <span className="text-gray-500 uppercase block">Target Met?</span>
                          <span className={`font-bold ${selectedRecord.targetMet === 'Yes' ? 'text-teal-bright' : 'text-red-bright'}`}>
                            {selectedRecord.targetMet || '—'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500 uppercase block">Supervisor Review</span>
                          <span className="text-white">{selectedRecord.supervisorReview || '—'}</span>
                        </div>
                      </div>
                      <div className="pt-2 border-t border-white/10">
                        <span className="text-[10px] text-gray-500 uppercase block mb-1">Decision & Notes</span>
                        <p className="text-sm text-gray-300">{selectedRecord.verifyNotes || '—'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="glass p-5 rounded-2xl">
                    <div className="text-[10px] font-bold text-purple-bright uppercase tracking-widest mb-4">Standardization & Record (Act)</div>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-[10px]">
                        <div>
                          <span className="text-gray-500 uppercase block">Rollout to Other Lines</span>
                          <span className="text-white">{selectedRecord.rollout || '—'}</span>
                        </div>
                        <div>
                          <span className="text-gray-500 uppercase block">Lines Rolled Out</span>
                          <span className="text-white">{selectedRecord.rolloutLines || '—'}</span>
                        </div>
                        <div>
                          <span className="text-gray-500 uppercase block">Quality Board Updated</span>
                          <span className="text-white">{selectedRecord.boardUpdated || '—'}</span>
                        </div>
                        <div>
                          <span className="text-gray-500 uppercase block">Morning Briefing</span>
                          <span className="text-white">{selectedRecord.briefing || '—'}</span>
                        </div>
                        <div>
                          <span className="text-gray-500 uppercase block">SOP/Manual Updated</span>
                          <span className="text-white">{selectedRecord.finalSOP || '—'}</span>
                        </div>
                        <div>
                          <span className="text-gray-500 uppercase block">Weekly PDCA Review</span>
                          <span className="text-white">{selectedRecord.feedWeekly || '—'}</span>
                        </div>
                        <div>
                          <span className="text-gray-500 uppercase block">Closed By</span>
                          <span className="text-white font-bold">{selectedRecord.closedBy || '—'}</span>
                        </div>
                      </div>
                      <div className="pt-2 border-t border-white/10">
                        <span className="text-[10px] text-gray-500 uppercase block mb-1">Lessons Learned</span>
                        <p className="text-sm text-gray-300 leading-relaxed">{selectedRecord.lessons || '—'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="glass p-5 rounded-2xl">
                    <div className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-4">Root Cause Analysis (5 Whys)</div>
                    <div className="space-y-3">
                      {[1, 2, 3, 4, 5].map(num => {
                        const why = (selectedRecord as any)[`why${num}`];
                        if (!why) return null;
                        return (
                          <div key={num} className="flex gap-4 items-start">
                            <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex flex-col items-center justify-center text-[9px] font-bold text-blue-400/60 shrink-0 mt-1 leading-tight">
                              <span>WHY</span>
                              <span>{num}</span>
                            </div>
                            <p className="text-sm text-gray-300 pt-3">{why}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="glass p-5 rounded-2xl">
                    <div className="text-[10px] font-bold text-teal-bright uppercase tracking-widest mb-2">Lessons Learned</div>
                    <p className="text-sm leading-relaxed text-gray-300">{selectedRecord.lessons}</p>
                  </div>
                </div>
              </div>
              <div className="p-6 bg-black/20 flex justify-end">
                <button onClick={() => setSelectedRecord(null)} className="bg-white/5 hover:bg-white/10 border border-white/10 px-6 py-2 rounded-xl text-sm transition-colors">
                  Close Detail
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <PDCAFrameWorkApp />
    </ErrorBoundary>
  );
}
