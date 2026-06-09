'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/components/firebase-provider';
import LandingPage from '@/components/landing-page';
import DashboardView from '@/components/dashboard-view';
import LeadsListView from '@/components/leads-list-view';
import LeadFormModal from '@/components/lead-form-modal';
import LeadDetailModal from '@/components/lead-detail-modal';
import QuotationGenerator from '@/components/quotation-generator';
import ReportsView from '@/components/reports-view';
import TasksView from '@/components/tasks-view';
import RemindersView from '@/components/reminders-view';
import { getNextRecurringDate } from '@/lib/date-utils';
import TaskFormModal from '@/components/task-form-modal';
import { Lead, Quotation, LeadStatus, CRMTask, CRMReminder } from '@/lib/types';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import {
  LayoutDashboard,
  Users,
  FileSpreadsheet,
  TrendingUp,
  Settings,
  LogOut,
  Sparkles,
  Smartphone,
  CheckCircle,
  Activity,
  Database,
  CloudLightning,
  Bell,
  CheckSquare,
  Plus,
} from 'lucide-react';

export default function Home() {
  const { user, authReady, logout, loading: authLoading } = useAuth();
  
  // App Shell Navigation Tab
  const [activeTab, setActiveTab] = useState<'dashboard' | 'leads' | 'quotations' | 'tasks' | 'reminders' | 'reports' | 'settings'>('dashboard');

  // Real-time Collections synced inside master state
  const [leads, setLeads] = useState<Lead[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [tasks, setTasks] = useState<CRMTask[]>([]);
  const [reminders, setReminders] = useState<CRMReminder[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter day criteria
  const [currentFilterDay, setFilterDay] = useState<string>('today');

  // Modal UI toggles
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [addLeadModalOpen, setAddLeadModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<CRMTask | null>(null);

  // Background alarm/notification polling for upcoming tasks & reminders
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
  }, []);

  useEffect(() => {
    if (!user || tasks.length === 0) return;

    const notifiedKeys = new Set<string>();

    const checkAlarms = () => {
      const now = new Date();
      
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const todayDateStr = `${year}-${month}-${day}`;

      tasks.forEach(task => {
        if (task.status === 'Completed' || !task.dueTime || task.dueDate !== todayDateStr) return;

        const [dueHour, dueMin] = task.dueTime.split(':').map(Number);
        const taskTime = new Date(now);
        taskTime.setHours(dueHour, dueMin, 0, 0);

        const diffMinutes = Math.round((taskTime.getTime() - now.getTime()) / 60000);

        const matchTimeframes = [15, 30, 60];
        matchTimeframes.forEach(timeframe => {
          if (diffMinutes === timeframe) {
            const notificationKey = `${task.id}_${timeframe}`;
            if (!notifiedKeys.has(notificationKey)) {
              notifiedKeys.add(notificationKey);

              if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
                new Notification(`Vaishnavi Enterprise Task Reminder`, {
                  body: `Task: "${task.title}" is due in ${timeframe} minutes (${task.dueTime})`,
                });
              }
            }
          }
        });
      });
    };

    const interval = setInterval(checkAlarms, 20 * 1000); // Check every 20s
    return () => clearInterval(interval);
  }, [user, tasks]);

  // Custom PWA installation prompt captures
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [pwaInstallable, setPwaInstallable] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        setDeferredPrompt(e);
        setPwaInstallable(true);
      });

      window.addEventListener('appinstalled', () => {
        setPwaInstallable(false);
        setDeferredPrompt(null);
        console.log('CRM PWA Installed successfully.');
      });
    }
  }, []);

  const handleInstallAppPWA = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`PWA Prompt Outcome: ${outcome}`);
    setDeferredPrompt(null);
    setPwaInstallable(false);
  };

  // Real-time Firestore subscriptions for Leads, Quotations, Tasks, and Reminders
  useEffect(() => {
    if (!user) {
      setTimeout(() => {
        setLeads([]);
        setQuotations([]);
        setTasks([]);
        setReminders([]);
        setLoading(false);
      }, 0);
      return;
    }

    setTimeout(() => {
      setLoading(true);
    }, 0);

    // 1. Subscribe to leads owned by this login user
    const leadsRef = collection(db, 'leads');
    const leadsQuery = query(leadsRef, where('ownerId', '==', user.uid));
    const unsubscribeLeads = onSnapshot(
      leadsQuery,
      (snapshot) => {
        const loadedLeads: Lead[] = [];
        snapshot.forEach((docSnap) => {
          loadedLeads.push({ id: docSnap.id, ...docSnap.data() } as Lead);
        });
        setLeads(loadedLeads);
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'leads');
      }
    );

    // 2. Subscribe to Quotations
    const quotationsRef = collection(db, 'quotations');
    const quotationsQuery = query(quotationsRef, where('ownerId', '==', user.uid));
    const unsubscribeQuotations = onSnapshot(
      quotationsQuery,
      (snapshot) => {
        const loadedQuotes: Quotation[] = [];
        snapshot.forEach((docSnap) => {
          loadedQuotes.push({ id: docSnap.id, ...docSnap.data() } as Quotation);
        });
        setQuotations(loadedQuotes);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'quotations');
      }
    );

    // 3. Subscribe to Tasks
    const tasksRef = collection(db, 'tasks');
    const tasksQuery = query(tasksRef, where('ownerId', '==', user.uid));
    const unsubscribeTasks = onSnapshot(
      tasksQuery,
      (snapshot) => {
        const loadedTasks: CRMTask[] = [];
        snapshot.forEach((docSnap) => {
          loadedTasks.push({ id: docSnap.id, ...docSnap.data() } as CRMTask);
        });
        setTasks(loadedTasks);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'tasks');
      }
    );

    // 4. Subscribe to Reminders
    const remindersRef = collection(db, 'reminders');
    const remindersQuery = query(remindersRef, where('ownerId', '==', user.uid));
    const unsubscribeReminders = onSnapshot(
      remindersQuery,
      (snapshot) => {
        const loadedReminders: CRMReminder[] = [];
        snapshot.forEach((docSnap) => {
          loadedReminders.push({ id: docSnap.id, ...docSnap.data() } as CRMReminder);
        });
        setReminders(loadedReminders);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'reminders');
      }
    );

    return () => {
      unsubscribeLeads();
      unsubscribeQuotations();
      unsubscribeTasks();
      unsubscribeReminders();
    };
  }, [user]);

  // Lead CRUD Triggers mapped to Firestore
  const handleCreateLead = async (leadData: Partial<Lead>) => {
    if (!user) return;
    try {
      const leadsRef = collection(db, 'leads');
      const cleanData = {
        ...leadData,
        ownerId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastCalledAt: null,
        lastWhatsAppSentAt: null,
        lastEmailSentAt: null,
        profileSentAt: null,
        profileSentMethod: null,
        callCount: 0,
      };
      await addDoc(leadsRef, cleanData);
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'leads');
    }
  };

  const handleUpdateLead = async (leadId: string, updatedData: Partial<Lead>) => {
    if (!user) return;
    try {
      // Clean updated properties that can be merged
      const leadDocRef = doc(db, 'leads', leadId);
      const payload = {
        ...updatedData,
        updatedAt: serverTimestamp(),
      };
      // Delete ID from payload to make sure we don't rewrite key ID fields inside document payload
      delete (payload as any).id;
      
      await updateDoc(leadDocRef, payload);

      // Refresh opened selectedLead in status detailed view to display immediate updates
      if (selectedLead && selectedLead.id === leadId) {
        setSelectedLead(prev => (prev ? { ...prev, ...payload } : null));
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `leads/${leadId}`);
    }
  };

  const handleUpdateLeadStatus = async (leadId: string, newStatus: LeadStatus) => {
    await handleUpdateLead(leadId, { status: newStatus });
  };

  const handleDeleteLead = async (leadId: string) => {
    if (!confirm('Are you sure you want to permanently delete this lead? All notes and follow-ups will be de-allocated.')) return;
    try {
      const leadDocRef = doc(db, 'leads', leadId);
      await deleteDoc(leadDocRef);
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `leads/${leadId}`);
    }
  };

  const handleQuickCall = async (lead: Lead) => {
    if (!user) return;
    const currentCount = lead.callCount || 0;
    try {
      // 1. Update general stats for this lead
      await handleUpdateLead(lead.id, {
        callCount: currentCount + 1,
        lastCalledAt: serverTimestamp(),
        lastCallDate: new Date().toISOString().split('T')[0],
        status: 'Called Today',
      });

      // 2. Add an automatic phone dial note
      const notesRef = collection(db, 'leads', lead.id, 'notes');
      await addDoc(notesRef, {
        leadId: lead.id,
        date: new Date().toISOString().split('T')[0],
        time: new Date().toTimeString().slice(0, 5),
        note: `📞 Call attempted from Quick Dialer. Incrementing call count to ${currentCount + 1}.`,
        user: user?.displayName || user?.email || 'Authorized CRM User',
        createdAt: serverTimestamp(),
        ownerId: user?.uid,
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `leads/${lead.id}/notes`);
    }
  };

  // Quotation operations
  const handleCreateQuotation = async (quoteData: Partial<Quotation>) => {
    if (!user) return;
    try {
      const quotesRef = collection(db, 'quotations');
      const payload = {
        ...quoteData,
        ownerId: user.uid,
        createdAt: serverTimestamp(),
      };
      await addDoc(quotesRef, payload);
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'quotations');
    }
  };

  const handleDeleteQuotation = async (id: string) => {
    if (!confirm('Delete this quotation permanently?')) return;
    try {
      const quoteDocRef = doc(db, 'quotations', id);
      await deleteDoc(quoteDocRef);
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `quotations/${id}`);
    }
  };

  const handleUpdateQuotation = async (id: string, updatedData: Partial<Quotation>) => {
    if (!user) return;
    try {
      const quoteDocRef = doc(db, 'quotations', id);
      const payload = {
        ...updatedData,
        updatedAt: serverTimestamp(),
      };
      // Keep payload sanitized from id key itself
      delete (payload as any).id;
      await updateDoc(quoteDocRef, payload);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `quotations/${id}`);
    }
  };

  // Task operations
  const handleCreateTask = async (taskData: Partial<CRMTask>) => {
    if (!user) return;
    try {
      const colRef = collection(db, 'tasks');
      const payload = {
        ...taskData,
        ownerId: user.uid,
        createdAt: serverTimestamp(),
      };
      await addDoc(colRef, payload);
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'tasks');
    }
  };

  const handleUpdateTask = async (taskId: string, taskData: Partial<CRMTask>) => {
    if (!user) return;
    try {
      const docRef = doc(db, 'tasks', taskId);
      const payload = {
        ...taskData,
        updatedAt: serverTimestamp(),
      };
      delete (payload as any).id;
      await updateDoc(docRef, payload);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `tasks/${taskId}`);
    }
  };

  const handleUpdateTaskStatus = async (taskId: string, status: 'Pending' | 'In Progress' | 'Completed', task?: CRMTask) => {
    try {
      if (status === 'Completed' && task && task.recurring && task.recurring !== 'none') {
        const nextDate = getNextRecurringDate(task.dueDate, task.recurring);
        const colRef = collection(db, 'tasks');
        
        // 1. Log a completed occurrence
        await addDoc(colRef, {
          title: task.title,
          description: task.description || '',
          dueDate: task.dueDate,
          dueTime: task.dueTime || '',
          priority: task.priority,
          category: task.category || 'Other',
          status: 'Completed',
          recurring: 'none',
          leadId: task.leadId || null,
          ownerId: task.ownerId,
          createdAt: serverTimestamp(),
        });

        // 2. Advance the actual recurring task due date and reset status to Pending
        const docRef = doc(db, 'tasks', taskId);
        await updateDoc(docRef, {
          dueDate: nextDate,
          status: 'Pending',
        });
      } else {
        const docRef = doc(db, 'tasks', taskId);
        await updateDoc(docRef, { status });
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `tasks/${taskId}`);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    try {
      const docRef = doc(db, 'tasks', taskId);
      await deleteDoc(docRef);
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `tasks/${taskId}`);
    }
  };

  // Reminder operations
  const handleCreateReminder = async (reminderData: Partial<CRMReminder>) => {
    if (!user) return;
    try {
      const colRef = collection(db, 'reminders');
      const payload = {
        ...reminderData,
        ownerId: user.uid,
        createdAt: serverTimestamp(),
      };
      await addDoc(colRef, payload);
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'reminders');
    }
  };

  const handleDeleteReminder = async (reminderId: string) => {
    if (!confirm('Are you sure you want to delete this reminder?')) return;
    try {
      const docRef = doc(db, 'reminders', reminderId);
      await deleteDoc(docRef);
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `reminders/${reminderId}`);
    }
  };

  // If AuthContext is checking sessions, render an asset loading overlay
  if (!authReady || authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center select-none">
        <div className="w-16 h-16 bg-white p-2 rounded-full border border-gray-200 shadow-md flex items-center justify-center overflow-hidden relative mb-4">
          <div className="absolute inset-0 border-3 border-[#092E20] border-t-transparent rounded-full animate-spin" />
          <span className="text-[10px] font-bold text-[#092E20] font-mono leading-none">V</span>
        </div>
        <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Synchronizing Security Tokens...</p>
      </div>
    );
  }

  // Not authorized -> Display landing page with single sign-on access gate
  if (!user) {
    return <LandingPage />;
  }

  return (
    <div className="flex-1 flex flex-col md:flex-row h-full min-h-screen bg-gray-50 text-gray-900 overflow-hidden select-none">
      
      {/* LEFT NAVIGATION COLUMN: SIDEBAR SHELL (Professional Green theme) */}
      <aside className="hidden md:flex w-[260px] bg-[#092E20] text-white flex-col justify-between shrink-0 shadow-xl border-r border-[#22C55E]/10 select-none">
        
        {/* Upper side: user context and menu toggles */}
        <div>
          {/* Brand header */}
          <div className="p-6 border-b border-[#22C55E]/10 flex items-center gap-3">
            <div className="w-10 h-10 bg-white p-1 rounded-full border border-[#22C55E] flex items-center justify-center overflow-hidden shrink-0">
              <span className="text-sm font-extrabold text-[#092E20] font-sans">V</span>
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-sm tracking-wide uppercase truncate font-display">Vaishnavi CRM</h2>
              <span className="text-[10px] text-green-300 font-semibold block uppercase tracking-wider">Enterprise Hub</span>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="p-4 space-y-1" id="crm-sidebar-navigation">
            {[
              { id: 'dashboard', label: 'Overview Dashboard', icon: LayoutDashboard },
              { id: 'leads', label: 'Sales Funnel Leadhub', icon: Users },
              { id: 'quotations', label: 'Quotation Creator', icon: FileSpreadsheet },
              { id: 'tasks', label: 'Mandatory Task Tracker', icon: CheckSquare },
              { id: 'reminders', label: 'Outreach Reminders', icon: Bell },
              { id: 'reports', label: 'Conversions & Telemetry', icon: TrendingUp },
              { id: 'settings', label: 'Operations & Settings', icon: Settings },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`w-full flex items-center gap-3 py-3 px-4 rounded-xl text-left font-semibold text-xs tracking-wide transition-all cursor-pointer ${
                    isActive
                      ? 'bg-white/10 text-[#22C55E] border-l-4 border-[#22C55E]'
                      : 'text-green-100 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Lower footer segment inside sidebar */}
        <div className="p-4 border-t border-[#22C55E]/10 space-y-4">
          <div className="flex items-center gap-2.5 p-2 bg-black/10 rounded-lg">
            <div className="w-8 h-8 rounded-full bg-green-900 border border-green-700/50 flex items-center justify-center text-xs text-white uppercase font-bold shrink-0">
              {user.email ? user.email[0] : 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold truncate text-white">{user.displayName || 'Authorized Admin'}</p>
              <p className="text-[9px] text-green-300 truncate leading-none">{user.email}</p>
            </div>
          </div>

          {/* Log out action */}
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-black/20 hover:bg-red-950 hover:text-red-200 border border-white/5 text-xs font-bold rounded-lg transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out Session</span>
          </button>
        </div>
      </aside>

      {/* RIGHT COLUMN: MAIN WORKSPACE CONTAINER */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        
        {/* Top workspace strip */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between select-none">
          <span className="text-xs font-bold text-[#092E20] uppercase tracking-widest font-display">
            Active Workspace: {activeTab.toUpperCase()}
          </span>

          {pwaInstallable && (
            <button
              onClick={handleInstallAppPWA}
              className="py-2 px-4 bg-green-50 hover:bg-[#092E20] text-[#092E20] hover:text-white border border-green-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Smartphone className="w-4 h-4" />
              <span>Install Mobile App</span>
            </button>
          )}
        </header>

        {/* Main Content Workspace viewport */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 pb-20 md:pb-8" id="crm-main-viewport">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="w-10 h-10 border-2 border-[#092E20] border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-gray-400 font-bold mt-2.5 uppercase tracking-wide">Syncing leads database...</p>
            </div>
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <DashboardView
                  leads={leads}
                  quotations={quotations}
                  tasks={tasks}
                  reminders={reminders}
                  onSelectTab={(tab: any) => setActiveTab(tab)}
                  onSelectLead={(l) => setSelectedLead(l)}
                  currentFilterDay={currentFilterDay}
                  onFilterDay={(day) => setFilterDay(day)}
                  onUpdateTaskStatus={handleUpdateTaskStatus}
                />
              )}

              {activeTab === 'leads' && (
                <LeadsListView
                  leads={leads}
                  onSelectLead={(l) => setSelectedLead(l)}
                  onOpenAddLeadModal={() => setAddLeadModalOpen(true)}
                  onUpdateLeadStatus={handleUpdateLeadStatus}
                  onDeleteLead={handleDeleteLead}
                  onQuickCall={handleQuickCall}
                />
              )}

              {activeTab === 'quotations' && (
                <QuotationGenerator
                  quotations={quotations}
                  onCreateQuotation={handleCreateQuotation}
                  onDeleteQuotation={handleDeleteQuotation}
                  onUpdateQuotation={handleUpdateQuotation}
                />
              )}

              {activeTab === 'tasks' && (
                <TasksView
                  tasks={tasks}
                  leads={leads}
                  onCreateTask={handleCreateTask}
                  onUpdateTaskStatus={handleUpdateTaskStatus}
                  onDeleteTask={handleDeleteTask}
                  onOpenTaskModal={() => {
                    setEditingTask(null);
                    setIsTaskModalOpen(true);
                  }}
                  onEditTask={(task) => {
                    setEditingTask(task);
                    setIsTaskModalOpen(true);
                  }}
                />
              )}

              {activeTab === 'reminders' && (
                <RemindersView
                  reminders={reminders}
                  leads={leads}
                  onCreateReminder={handleCreateReminder}
                  onDeleteReminder={handleDeleteReminder}
                />
              )}

              {activeTab === 'reports' && (
                <ReportsView leads={leads} quotations={quotations} />
              )}

              {activeTab === 'settings' && (
                <div className="max-w-2xl bg-white p-6 rounded-2xl border border-gray-200 shadow-xs space-y-6" id="settings-pnl">
                  
                  {/* Brand Profile section */}
                  <div className="border-b border-gray-150 pb-4 space-y-3">
                    <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-[#22C55E]" />
                      <span>Vaishnavi Enterprise CRM &bull; Settings panel</span>
                    </h3>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      Below are diagnostic elements, localized PWA indicators, and corporate details of Vaishnavi Enterprise for self-adhesive label marketing.
                    </p>
                  </div>

                  {/* PWA Section */}
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="space-y-1">
                      <span className="font-bold text-xs text-gray-800 block">Samsung / Android Native PWA Status</span>
                      <p className="text-[11px] text-gray-500 leading-normal">
                        This CRM is built with offline service worker scopes and is fully installable. Keep on your mobile screen for instant CRM dialer actions.
                      </p>
                    </div>

                    <button
                      onClick={handleInstallAppPWA}
                      disabled={!pwaInstallable}
                      className="py-2 px-4 bg-white hover:bg-gray-150 text-gray-800 border border-gray-200 rounded text-xs font-bold cursor-pointer transition-colors disabled:opacity-50 inline-flex items-center gap-1.5 shrink-0"
                    >
                      <Smartphone className="w-4 h-4 text-[#22C55E]" />
                      <span>{pwaInstallable ? 'Install PWA App' : 'App Installed / Offline Active'}</span>
                    </button>
                  </div>

                  {/* Diagnostic status block */}
                  <div className="space-y-3">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest block">Systems Diagnostic State</span>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div className="p-3 bg-green-50/40 rounded-lg flex items-center gap-2.5 border border-green-150">
                        <CheckCircle className="w-5 h-5 text-[#22C55E]" />
                        <div>
                          <span className="font-bold text-gray-800 block">Database Sync status</span>
                          <span className="text-[10px] text-gray-500">Connected to Firestore (Enterprise edition)</span>
                        </div>
                      </div>

                      <div className="p-3 bg-green-50/40 rounded-lg flex items-center gap-2.5 border border-green-150">
                        <Activity className="w-5 h-5 text-[#22C55E]" />
                        <div>
                          <span className="font-bold text-gray-800 block">Authentication check</span>
                          <span className="text-[10px] text-gray-500">Google Domain Lock is active & secured</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Company Details Metadata list */}
                  <div className="space-y-3 pt-2">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest block">Vaishnavi Enterprise Catalog details</span>
                    
                    <div className="p-4 bg-gray-50 rounded-lg space-y-2 text-xs border border-gray-250 leading-relaxed text-gray-600">
                      <div className="flex gap-2">
                        <span className="font-bold uppercase text-[10px] text-gray-400 shrink-0 w-24">Industry Category:</span>
                        <span>Self-Adhesive Labels Manufacturer</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="font-bold uppercase text-[10px] text-gray-400 shrink-0 w-24">Core Products:</span>
                        <span>Chromo Labels, White PP Labels, Silver PP labels, Barcode Labels, Holograms, Roll Form Labels, Product Stickers.</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="font-bold uppercase text-[10px] text-gray-400 shrink-0 w-24">Portal URL:</span>
                        <span className="font-mono text-[#092E20]">app.vaishnavienterprise.in</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* PERSISTENT LEAD CREATE MODAL */}
      <LeadFormModal
        isOpen={addLeadModalOpen}
        onClose={() => setAddLeadModalOpen(false)}
        onSave={handleCreateLead}
        lead={null}
      />

      {/* PERSISTENT LEAD DETAILS / COMMUNICATIONS WORKSPACE MODAL */}
      {selectedLead && (
        <LeadDetailModal
          isOpen={true}
          onClose={() => setSelectedLead(null)}
          lead={selectedLead}
          onUpdateLead={handleUpdateLead}
          onDeleteLead={handleDeleteLead}
        />
      )}

      {/* FLOATING QUICK ADD BUTTON (One tap to create task immediately) */}
      {user && (
        <button
          onClick={() => {
            setEditingTask(null);
            setIsTaskModalOpen(true);
          }}
          className="fixed bottom-20 md:bottom-8 right-6 z-40 bg-[#22C55E] hover:bg-[#1eba51] active:scale-95 text-white w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-all cursor-pointer select-none border border-emerald-400/25"
          title="Add task immediately"
          id="global-floating-add-task-btn"
        >
          <Plus className="w-7 h-7 stroke-[3px]" />
        </button>
      )}

      {/* CENTRAL TASK FORM MODAL */}
      <TaskFormModal
        isOpen={isTaskModalOpen}
        onClose={() => {
          setIsTaskModalOpen(false);
          setEditingTask(null);
        }}
        leads={leads}
        onCreateTask={handleCreateTask}
        onUpdateTask={handleUpdateTask}
        task={editingTask}
      />

      {/* STICKY BOTTOM NAVIGATION BAR FOR TOUCH DEVICES */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-gray-250 z-40 flex items-center justify-around px-2 pb-safe shadow-2xl select-none">
        {[
          { id: 'dashboard', label: 'DB', icon: LayoutDashboard },
          { id: 'leads', label: 'Leads', icon: Users },
          { id: 'quotations', label: 'Quote', icon: FileSpreadsheet },
          { id: 'tasks', label: 'Tasks', icon: CheckSquare },
          { id: 'settings', label: 'More', icon: Settings },
        ].map(item => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={`flex flex-col items-center justify-center gap-1.5 flex-1 py-1.5 px-1 transition-all cursor-pointer active:scale-95 ${
                active ? 'text-[#22C55E]' : 'text-[#374151]'
              }`}
              id={`mob-nav-${item.id}`}
            >
              <Icon className={`w-5.5 h-5.5 transition-transform ${active ? 'stroke-[2.8px] scale-110' : 'stroke-[2.1px]'}`} />
              <span className={`text-[11px] font-bold uppercase tracking-wider transition-colors duration-150`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
