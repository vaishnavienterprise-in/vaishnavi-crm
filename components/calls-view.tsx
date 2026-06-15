'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { Lead, CRMTask, CRMReminder, LeadStatus, LeadPriority, NextActionType, FollowUpActionType } from '@/lib/types';
import { getTodayDateString, formatReadableDate } from '@/lib/date-utils';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { collection, doc, updateDoc, addDoc, serverTimestamp, setDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { useAuth } from './firebase-provider';
import {
  Phone,
  MessageSquare,
  Plus,
  Calendar,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  User,
  Clock,
  ArrowUpRight,
  CheckSquare,
  Check,
  X,
  Send,
  MoreHorizontal,
  ChevronRight,
  ThumbsUp,
  ThumbsDown,
  ArrowRight,
  ClipboardList
} from 'lucide-react';

interface CallsViewProps {
  leads: Lead[];
  tasks?: CRMTask[];
  reminders?: CRMReminder[];
  onSelectLead: (lead: Lead) => void;
  onUpdateLead: (leadId: string, updatedData: Partial<Lead>) => Promise<void>;
  onQuickCall: (lead: Lead) => Promise<void>;
  onSelectTab: (tab: any) => void;
}

interface CallStats {
  callsToday: number;
  callsThisWeek: number;
  callsThisMonth: number;
  lastCallDate: string;
  lastCallWeek: string;
  lastCallMonth: string;
}

export default function CallsView({
  leads,
  tasks = [],
  reminders = [],
  onSelectLead,
  onUpdateLead,
  onQuickCall,
  onSelectTab,
}: CallsViewProps) {
  const { user } = useAuth();
  const [activeQueue, setActiveQueue] = useState<'followups' | 'reminders' | 'overdue' | 'pending'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  
  // After Call Workflow State
  const [activeCallLead, setActiveCallLead] = useState<Lead | null>(null);
  const [showNoteInputCount, setShowNoteInputCount] = useState(false);
  const [newNoteValue, setNewNoteValue] = useState('');
  
  // Set Reminder Form State inside Overlay
  const [showReminderForm, setShowReminderForm] = useState(false);
  const [reminderDate, setReminderDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [reminderTime, setReminderTime] = useState('11:00');
  const [reminderNoteText, setReminderNoteText] = useState('');
  const [reminderPriority, setReminderPriority] = useState<LeadPriority>('Warm');
  const [reminderActionType, setReminderActionType] = useState<FollowUpActionType>('Call');

  // Firestore Saved Stats
  const [stats, setStats] = useState<CallStats>({
    callsToday: 0,
    callsThisWeek: 0,
    callsThisMonth: 0,
    lastCallDate: '',
    lastCallWeek: '',
    lastCallMonth: '',
  });

  const todayStr = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }, []);

  const getWeekNumberString = (d: Date): string => {
    const onejan = new Date(d.getFullYear(), 0, 1);
    const millisecsInDay = 86400000;
    const dayOfYear = ((d.getTime() - onejan.getTime()) / millisecsInDay);
    const weekNum = Math.ceil((dayOfYear + onejan.getDay() + 1) / 7);
    return `${d.getFullYear()}-W${weekNum}`;
  };

  const getMonthString = (d: Date): string => {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };

  // Sync / Listen to Stats in Firestore
  useEffect(() => {
    if (!user) return;
    const statsDocRef = doc(db, 'settings', `call_stats_${user.uid}`);
    const unsub = onSnapshot(statsDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setStats({
          callsToday: data.callsToday || 0,
          callsThisWeek: data.callsThisWeek || 0,
          callsThisMonth: data.callsThisMonth || 0,
          lastCallDate: data.lastCallDate || '',
          lastCallWeek: data.lastCallWeek || '',
          lastCallMonth: data.lastCallMonth || '',
        });
      }
    });

    return () => unsub();
  }, [user]);

  // Handle local counter updates on CALL click
  const handleDialCall = async (lead: Lead) => {
    if (!user) return;
    // 1. Open the dialer immediately for mobile & desktop
    const telNum = lead.phone ? lead.phone.replace(/[^0-9+]/g, '') : '';
    if (telNum) {
      window.open(`tel:${telNum}`, '_self');
    }

    // 2. Open After Call Workflow instantly
    setActiveCallLead(lead);
    setShowNoteInputCount(false);
    setShowReminderForm(false);
    setNewNoteValue('');
    setReminderNoteText('');

    // 3. Trigger Firestore general update (quick call increments lead count and adds note log)
    await onQuickCall(lead);

    // 4. Update Global Call statistics
    const statsDocRef = doc(db, 'settings', `call_stats_${user.uid}`);
    const today = todayStr;
    const thisWeek = getWeekNumberString(new Date());
    const thisMonth = getMonthString(new Date());

    try {
      const snap = await getDoc(statsDocRef);
      let currentToday = 0;
      let currentWeek = 0;
      let currentMonth = 0;

      if (snap.exists()) {
        const data = snap.data();
        currentToday = data.lastCallDate === today ? (data.callsToday || 0) : 0;
        currentWeek = data.lastCallWeek === thisWeek ? (data.callsThisWeek || 0) : 0;
        currentMonth = data.lastCallMonth === thisMonth ? (data.callsThisMonth || 0) : 0;
      }

      await setDoc(statsDocRef, {
        ownerId: user.uid,
        callsToday: currentToday + 1,
        callsThisWeek: currentWeek + 1,
        callsThisMonth: currentMonth + 1,
        lastCallDate: today,
        lastCallWeek: thisWeek,
        lastCallMonth: thisMonth,
      }, { merge: true });
    } catch (e) {
      console.error('Failed to store statistics in settings:', e);
    }
  };

  // Build individual Queues
  // 1. Today's Follow-Ups
  const todaysFollowups = useMemo(() => {
    return leads.filter(l => 
      l.status !== 'Won' && 
      l.status !== 'Lost' && 
      l.nextActionDate === todayStr && 
      (l.nextAction === 'Follow Up' || l.nextAction === 'Meeting')
    );
  }, [leads, todayStr]);

  // 2. Today's Reminders
  const todaysReminders = useMemo(() => {
    return reminders.filter(r => r.date === todayStr);
  }, [reminders, todayStr]);

  // 3. Overdue Follow-Ups
  const overdueFollowups = useMemo(() => {
    return leads.filter(l => 
      l.status !== 'Won' && 
      l.status !== 'Lost' && 
      l.nextActionDate && 
      l.nextActionDate < todayStr
    );
  }, [leads, todayStr]);

  // 4. Pending Calls
  const pendingCalls = useMemo(() => {
    return leads.filter(l => 
      l.status !== 'Won' && 
      l.status !== 'Lost' && 
      (l.status === "Today's Calls" || l.nextAction === 'Call' || l.status === "New Lead")
    );
  }, [leads]);

  // Active Queue List Selection
  const activeList = useMemo(() => {
    let list: any[] = [];
    if (activeQueue === 'followups') list = todaysFollowups;
    else if (activeQueue === 'reminders') list = todaysReminders;
    else if (activeQueue === 'overdue') list = overdueFollowups;
    else list = pendingCalls;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(item => {
        const nameMatch = (item.customerName || item.title || '').toLowerCase().includes(q);
        const compMatch = (item.companyName || item.notes || '').toLowerCase().includes(q);
        const phMatch = (item.phone || '').includes(q);
        
        const matchPhones = item.phones && item.phones.some((ph: string) => ph.toLowerCase().includes(q));
        const matchEmails = item.emails && item.emails.some((em: string) => em.toLowerCase().includes(q));
        const matchContacts = item.contacts && item.contacts.some((c: any) => 
          c.name.toLowerCase().includes(q) || 
          c.email.toLowerCase().includes(q) || 
          c.mobile.toLowerCase().includes(q) || 
          c.whatsapp.toLowerCase().includes(q) ||
          c.designation.toLowerCase().includes(q) ||
          c.department.toLowerCase().includes(q)
        );

        return nameMatch || compMatch || phMatch || matchPhones || matchEmails || matchContacts;
      });
    }

    return list;
  }, [activeQueue, todaysFollowups, todaysReminders, overdueFollowups, pendingCalls, searchQuery]);

  // Get index of the active call lead in active list to trigger "NEXT LEAD"
  const handleNextLeadInQueue = () => {
    if (!activeCallLead) {
      setActiveCallLead(null);
      return;
    }
    const idx = activeList.findIndex(l => l.id === activeCallLead.id);
    if (idx !== -1 && idx < activeList.length - 1) {
      // Set tomorrow's dial
      const nextLead = activeList[idx + 1];
      setActiveCallLead(nextLead);
      setShowNoteInputCount(false);
      setShowReminderForm(false);
      setNewNoteValue('');
      setReminderNoteText('');
    } else {
      // reached end of queue
      setActiveCallLead(null);
      alert('🌟 Beautiful Work! You have completed all leads in this worklist queue!');
    }
  };

  // Quick action workflow triggers
  const handleSaveAfterCallNote = async () => {
    if (!activeCallLead || !newNoteValue.trim() || !user) return;
    try {
      const notesRef = collection(db, 'leads', activeCallLead.id, 'notes');
      await addDoc(notesRef, {
        leadId: activeCallLead.id,
        date: todayStr,
        time: new Date().toTimeString().slice(0, 5),
        note: `✏️ Note: ${newNoteValue.trim()}`,
        user: user.displayName || user.email || 'Authorized CRM User',
        createdAt: serverTimestamp(),
        ownerId: user.uid,
      });
      setNewNoteValue('');
      setShowNoteInputCount(false);
      alert('Note saved successfully!');
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveAfterCallReminder = async () => {
    if (!activeCallLead || !user || !reminderNoteText.trim()) return;
    try {
      const followupsRef = collection(db, 'leads', activeCallLead.id, 'followups');
      await addDoc(followupsRef, {
        leadId: activeCallLead.id,
        date: reminderDate,
        time: reminderTime,
        priority: reminderPriority,
        notes: reminderNoteText.trim(),
        actionType: reminderActionType,
        createdAt: serverTimestamp(),
        ownerId: user.uid,
      });

      // Update lead parameters
      await onUpdateLead(activeCallLead.id, {
        nextAction: (reminderActionType === 'Reminder' ? 'Follow Up' : reminderActionType) as NextActionType,
        nextActionDate: reminderDate,
        nextActionTime: reminderTime,
        priority: reminderPriority,
      });

      setReminderNoteText('');
      setShowReminderForm(false);
      alert('Follow-up reminder set!');
    } catch (e) {
      console.error(e);
    }
  };

  const handleMarkStatus = async (status: LeadStatus) => {
    if (!activeCallLead) return;
    try {
      await onUpdateLead(activeCallLead.id, { status });
      // Add progress note
      const notesRef = collection(db, 'leads', activeCallLead.id, 'notes');
      await addDoc(notesRef, {
        leadId: activeCallLead.id,
        date: todayStr,
        time: new Date().toTimeString().slice(0, 5),
        note: `⚡ Process workflow: Status marked to "${status}".`,
        user: user?.displayName || user?.email || 'Authorized CRM User',
        createdAt: serverTimestamp(),
        ownerId: user?.uid,
      });
      alert(`Customer marked as ${status}!`);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSendWhatsAppQuick = (lead: Lead) => {
    const wa = lead.whatsapp || lead.phone;
    if (!wa) return;
    const cleanWa = wa.replace(/[^0-9+]/g, '');
    const text = encodeURIComponent(`Hello ${lead.customerName || 'Sir/Madam'}, I attempted calling you regarding your label query. Please let us know if we can connect soon. Regards, Vaishnavi Enterprise`);
    window.open(`https://wa.me/${cleanWa}?text=${text}`, '_blank');
  };

  const handleCallBackLaterQuick = async () => {
    if (!activeCallLead || !user) return;
    try {
      // Calculate tomorrow's date string
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      const followupsRef = collection(db, 'leads', activeCallLead.id, 'followups');
      await addDoc(followupsRef, {
        leadId: activeCallLead.id,
        date: tomorrowStr,
        time: '10:30',
        priority: 'Warm',
        notes: '📞 Scheduled auto callback call later attempt.',
        actionType: 'Call',
        createdAt: serverTimestamp(),
        ownerId: user.uid,
      });

      await onUpdateLead(activeCallLead.id, {
        nextAction: 'Call',
        nextActionDate: tomorrowStr,
        nextActionTime: '10:30',
        status: "Today's Calls",
      });

      alert('Callback schedule created for tomorrow at 10:30 AM!');
    } catch (e) {
      console.error(e);
    }
  };

  // Render a single queue lead card
  const renderItemCard = (item: any) => {
    const isReminderCard = item.date !== undefined && item.dueDate === undefined && item.customerName === undefined;
    
    if (isReminderCard) {
      // Reminders list card (since reminders doesn't map full Lead schema)
      return (
        <div key={item.id} className="p-4 bg-white rounded-xl border border-gray-205 shadow-xs flex flex-col justify-between hover:shadow-md transition-all">
          <div className="space-y-1.5 flex-1 select-none">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-[10px] text-gray-400 font-bold uppercase">Outreach Reminder Checkpoint</span>
            </div>
            <h3 className="font-bold text-gray-850 text-sm tracking-tight">{item.title}</h3>
            <p className="text-xs text-gray-500 leading-relaxed font-medium">{item.notes}</p>
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-100 text-[10.5px] text-gray-400 font-semibold font-mono">
              <span>Time: {item.time}</span>
            </div>
          </div>
        </div>
      );
    }

    // Standard Lead Card for Calls queue
    const lastCalledStr = item.lastCallDate || (item.lastCalledAt ? 'Recently' : 'Never');

    return (
      <div key={item.id} className="p-4 bg-white rounded-xl border border-gray-220 shadow-xs hover:border-[#22C55E]/50 transition-all flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div className="space-y-1.5 min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[9px] uppercase px-2 font-black rounded-full border ${
              item.priority === 'Hot' ? 'bg-red-50 border-red-100 text-red-650' : 'bg-gray-100 text-gray-600 border-gray-150'
            }`}>
              {item.priority} Priority
            </span>
            <span className="text-[10.5px] text-gray-400 font-bold uppercase font-mono">
              Count: {item.callCount || 0} calls
            </span>
            <span className="text-[9.5px] bg-emerald-50 text-emerald-800 border border-emerald-100 px-2 rounded-full font-bold">
              {item.status}
            </span>
          </div>

          <h3 className="font-bold text-gray-900 text-base tracking-tight truncate flex items-center gap-1">
            <User className="w-4 h-4 text-gray-400 shrink-0" />
            <span>{item.customerName}</span>
          </h3>

          <p className="text-xs text-gray-550 font-semibold leading-none uppercase truncate tracking-wide">
            {item.companyName}
          </p>

          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-450 font-semibold font-mono pt-1">
            <span className="flex items-center gap-1">
              <Phone className="w-3.5 h-3.5 text-[#22C55E]" />
              <span>{item.phone}</span>
            </span>
            <span className="text-gray-300">|</span>
            <span>Last Call: {lastCalledStr}</span>
          </div>

          {item.requirement && (
            <p className="text-xs text-gray-500 line-clamp-2 italic pt-1 bg-gray-50/50 p-2 border border-gray-100 rounded">
              Requirement: &quot;{item.requirement}&quot;
            </p>
          )}
        </div>

        {/* Action strip with larger touch targets for mobile */}
        <div className="flex items-center gap-2 md:self-center">
          <button
            onClick={() => handleDialCall(item)}
            className="flex-1 py-3 px-4 md:py-2.5 md:px-4 bg-[#092E20] hover:bg-emerald-850 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 active:scale-95 transition-transform cursor-pointer shadow-sm min-h-[44px] md:min-h-0"
            title="Perform Outbound Phone Call"
          >
            <Phone className="w-4.5 h-4.5 text-[#22C55E]" />
            <span>Dial Call</span>
          </button>
          
          <button
            onClick={() => handleSendWhatsAppQuick(item)}
            className="p-3 bg-[#22C55E]/10 hover:bg-[#22C55E]/20 text-[#22C55E] rounded-xl flex items-center justify-center cursor-pointer transition-colors min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0"
            title="Send Quick Followup WhatsApp"
          >
            <MessageSquare className="w-5 h-5" />
          </button>

          <button
            onClick={() => onSelectLead(item)}
            className="p-3 bg-gray-100 hover:bg-gray-250 text-gray-600 rounded-xl flex items-center justify-center cursor-pointer transition-colors min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0"
            title="Inspect Full Lead Spec Details"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6" id="calls-workspace-page">
      {/* Title Header with Metrics summary */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 bg-[#092E20] text-white rounded-2xl border border-[#22C55E]/15 shadow-xl select-none">
        <div className="space-y-1">
          <h2 className="text-xl font-bold font-display tracking-tight flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#22C55E]" />
            <span>EXECUTIVE CALL HUB</span>
          </h2>
          <p className="text-xs text-green-200">
            Rapid outbound dialer and followup scheduler to accelerate B2B label sales conversions.
          </p>
        </div>

        {/* Global Stats Counter */}
        <div className="grid grid-cols-3 gap-2.5 text-center bg-black/20 p-2.5 rounded-xl border border-white/5">
          <div className="px-3 py-1">
            <span className="text-[9px] text-green-300 font-bold block uppercase tracking-wider">Today</span>
            <span className="text-lg font-black font-mono text-white">{stats.callsToday}</span>
          </div>
          <div className="px-3 py-1 border-x border-white/10">
            <span className="text-[9px] text-green-300 font-bold block uppercase tracking-wider">Week</span>
            <span className="text-lg font-black font-mono text-white">{stats.callsThisWeek}</span>
          </div>
          <div className="px-3 py-1">
            <span className="text-[9px] text-green-300 font-bold block uppercase tracking-wider">Month</span>
            <span className="text-lg font-black font-mono text-white">{stats.callsThisMonth}</span>
          </div>
        </div>
      </div>

      {/* Navigation Queue Filters */}
      <div className="p-1 bg-gray-100 border border-gray-200 rounded-xl flex flex-wrap gap-1">
        <button
          onClick={() => { setActiveQueue('pending'); setSearchQuery(''); }}
          className={`flex-1 py-3 px-3 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeQueue === 'pending'
              ? 'bg-white text-[#092E20] shadow-xs border border-gray-200'
              : 'text-gray-600 hover:text-black hover:bg-white/50'
          }`}
        >
          <Phone className="w-3.5 h-3.5" />
          <span>Pending Calls ({pendingCalls.length})</span>
        </button>

        <button
          onClick={() => { setActiveQueue('followups'); setSearchQuery(''); }}
          className={`flex-1 py-3 px-3 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeQueue === 'followups'
              ? 'bg-white text-[#092E20] shadow-xs border border-gray-200'
              : 'text-gray-600 hover:text-black hover:bg-white/50'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Follow-Ups ({todaysFollowups.length})</span>
        </button>

        <button
          onClick={() => { setActiveQueue('overdue'); setSearchQuery(''); }}
          className={`flex-1 py-3 px-3 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeQueue === 'overdue'
              ? 'bg-white text-red-650 shadow-xs border border-red-100'
              : 'text-gray-600 hover:text-red-650 hover:bg-white/50'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Overdue ({overdueFollowups.length})</span>
        </button>

        <button
          onClick={() => { setActiveQueue('reminders'); setSearchQuery(''); }}
          className={`flex-1 py-3 px-3 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeQueue === 'reminders'
              ? 'bg-white text-[#092E20] shadow-xs border border-gray-200'
              : 'text-gray-600 hover:text-black hover:bg-white/50'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Reminders ({todaysReminders.length})</span>
        </button>
      </div>

      {/* Worklist search queue */}
      <div className="relative text-xs">
        <input
          type="text"
          placeholder="Search this queue by customer Name, company, or phone..."
          className="w-full bg-white border border-gray-250 focus:border-[#092E20] focus:ring-1 focus:ring-[#092E20] rounded-xl py-3 px-4 pl-10 outline-hidden font-medium text-xs shadow-xs"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <svg className="absolute top-3.5 left-3.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>

      {/* Main viewport for work lists */}
      <div className="space-y-3">
        {activeList.map(item => renderItemCard(item))}

        {activeList.length === 0 && (
          <div className="p-12 text-center bg-gray-50 border border-dashed border-gray-250 rounded-2xl">
            <ClipboardList className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">No dynamic tasks found in this queue</p>
            <p className="text-xs text-gray-400 mt-1">Excellent! Your executive queue is completely clear for now.</p>
          </div>
        )}
      </div>

      {/* CHANGE 4 - AFTER CALL WORKFLOW OVERLAY */}
      {activeCallLead && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-150 animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            
            {/* Header */}
            <div className="bg-[#092E20] text-white p-5 flex items-center justify-between border-b border-[#22C55E]/10 select-none">
              <div>
                <span className="text-[10px] uppercase font-bold text-green-300 tracking-widest block">After Call Workflow</span>
                <h3 className="font-bold text-lg leading-tight mt-0.5">{activeCallLead.customerName}</h3>
                <p className="text-xs text-green-150 truncate max-w-[320px]">{activeCallLead.companyName}</p>
              </div>
              <button
                onClick={() => setActiveCallLead(null)}
                className="p-1.5 bg-white/10 hover:bg-white/20 active:bg-black rounded-lg transition-colors cursor-pointer text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              
              {/* Direct Dial Deck */}
              <div className="bg-[#092E20]/5 p-4 border border-[#092E20]/10 rounded-xl space-y-2.5">
                <span className="text-[10px] font-black uppercase text-[#092E20] tracking-wider flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Choose Number to Outbound Dial</span>
                </span>
                <div className="grid grid-cols-1 gap-2">
                  {/* Primary option */}
                  <div className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-gray-150 text-xs shadow-3xs">
                    <div className="min-w-0 flex-1 mr-2">
                      <p className="font-bold text-gray-800 truncate">Primary: {activeCallLead.customerName}</p>
                      <p className="text-[10.5px] font-mono text-gray-500">{activeCallLead.phone}</p>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      {activeCallLead.phone && (
                        <a href={`tel:${activeCallLead.phone.replace(/[^0-9+]/g, '')}`} className="p-1 px-2.5 bg-[#092E20] hover:bg-[#0F5132] text-white rounded font-bold text-[11px] flex items-center gap-1 transition-transform active:scale-95">
                          <Phone className="w-3 h-3" />
                          <span>Dial</span>
                        </a>
                      )}
                      {(activeCallLead.whatsapp || activeCallLead.phone) && (
                        <a href={`https://wa.me/${(activeCallLead.whatsapp || activeCallLead.phone).replace(/[^0-9+]/g, '')}?text=${encodeURIComponent('Hello ' + (activeCallLead.customerName || '') + ', tried reaching you regarding your labels request.')}`} target="_blank" rel="noreferrer" className="p-1 bg-green-500 hover:bg-green-400 text-white rounded flex items-center justify-center transition-transform active:scale-95 px-1.5" title="WhatsApp Message">
                          <MessageSquare className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Other Phones array */}
                  {activeCallLead.phones && activeCallLead.phones.slice(1).map((ph: string, idx: number) => (
                    <div key={idx} className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-gray-150 text-xs shadow-3xs">
                      <div className="min-w-0 flex-1 mr-2">
                        <p className="font-bold text-gray-800 truncate">Secondary Phone {idx + 2}</p>
                        <p className="text-[10.5px] font-mono text-gray-500">{ph}</p>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <a href={`tel:${ph.replace(/[^0-9+]/g, '')}`} className="p-1 px-2.5 bg-[#092E20] hover:bg-[#0F5132] text-white rounded font-bold text-[11px] flex items-center gap-1 transition-transform active:scale-95">
                          <Phone className="w-3 h-3" />
                          <span>Dial</span>
                        </a>
                        <a href={`https://wa.me/${ph.replace(/[^0-9+]/g, '')}?text=${encodeURIComponent('Hello, tried reaching you regarding your labels request.')}`} target="_blank" rel="noreferrer" className="p-1 bg-green-500 hover:bg-green-400 text-white rounded flex items-center justify-center transition-transform active:scale-95 px-1.5" title="WhatsApp Message">
                          <MessageSquare className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  ))}

                  {/* Representative Contacts in Directory */}
                  {activeCallLead.contacts && activeCallLead.contacts.map((c: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-gray-150 text-xs shadow-3xs">
                      <div className="min-w-0 flex-1 mr-2">
                        <p className="font-bold text-gray-800 truncate">{c.name}</p>
                        <p className="text-[10.5px] text-gray-400 truncate font-semibold leading-none mb-1">{c.designation || 'Representative'} {c.department ? `(${c.department})` : ''}</p>
                        <div className="flex gap-2 text-[10px] font-mono text-gray-500 flex-wrap">
                          {c.mobile && <span>Ph: {c.mobile}</span>}
                          {c.whatsapp && <span>WA: {c.whatsapp}</span>}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0 self-center">
                        {c.mobile && (
                          <a href={`tel:${c.mobile.replace(/[^0-9+]/g, '')}`} className="p-1 px-2.5 bg-[#092E20] hover:bg-[#0F5132] text-white rounded font-bold text-[11px] flex items-center gap-1 transition-transform active:scale-95" title="Call Mobile">
                            <Phone className="w-3 h-3" />
                            <span>Dial</span>
                          </a>
                        )}
                        {c.whatsapp && (
                          <a href={`https://wa.me/${c.whatsapp.replace(/[^0-9+]/g, '')}?text=${encodeURIComponent('Hello ' + (c.name || '') + ', tried reaching you regarding your labels request.')}`} target="_blank" rel="noreferrer" className="p-1 bg-green-500 hover:bg-green-400 text-white rounded flex items-center justify-center transition-transform active:scale-95 px-1.5" title="WhatsApp Message">
                            <MessageSquare className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Note quick-entry form */}
              {showNoteInputCount ? (
                <div className="bg-gray-50 p-4 border border-gray-200 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#092E20] uppercase">Add Progress Timeline Note</span>
                    <button onClick={() => setShowNoteInputCount(false)} className="text-gray-400 hover:text-gray-600 text-xs font-bold">Cancel</button>
                  </div>
                  <textarea
                    rows={2}
                    className="w-full bg-white border border-gray-220 rounded-xl p-3 text-xs outline-hidden focus:border-[#092E20] font-medium"
                    placeholder="Enter what the customer discussed (e.g. Needs silver chromo labels quote)..."
                    value={newNoteValue}
                    onChange={(e) => setNewNoteValue(e.target.value)}
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleSaveAfterCallNote}
                      disabled={!newNoteValue.trim()}
                      className="py-2 px-3 bg-[#092E20] text-white text-xs font-bold rounded-lg cursor-pointer disabled:opacity-45"
                    >
                      Save Note
                    </button>
                  </div>
                </div>
              ) : showReminderForm ? (
                /* Inline Direct Reminder form */
                <div className="bg-gray-50 p-4 border border-gray-220 rounded-xl space-y-3">
                  <div className="flex items-center justify-between border-b border-gray-200 pb-1.5">
                    <span className="text-xs font-bold text-[#092E20] uppercase">Integrate Next Outreach Followup</span>
                    <button onClick={() => setShowReminderForm(false)} className="text-gray-400 hover:text-gray-600 text-xs font-bold">Cancel</button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="block text-[9.5px] font-bold text-gray-450 uppercase mb-0.5">Follow up Date</label>
                      <input
                        type="date"
                        required
                        value={reminderDate}
                        className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs outline-hidden"
                        onChange={(e) => setReminderDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-[9.5px] font-bold text-gray-450 uppercase mb-0.5">Time Slot</label>
                      <input
                        type="time"
                        required
                        value={reminderTime}
                        className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs outline-hidden"
                        onChange={(e) => setReminderTime(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="block text-[9.5px] font-bold text-gray-400 uppercase mb-0.5">Priority</label>
                      <select
                        value={reminderPriority}
                        className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs outline-hidden cursor-pointer"
                        onChange={(e) => setReminderPriority(e.target.value as any)}
                      >
                        <option value="Hot">Hot</option>
                        <option value="Warm">Warm</option>
                        <option value="Cold">Cold</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[9.5px] font-bold text-gray-400 uppercase mb-0.5">Action Method</label>
                      <select
                        value={reminderActionType}
                        className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs outline-hidden cursor-pointer"
                        onChange={(e) => setReminderActionType(e.target.value as any)}
                      >
                        <option value="Call">Call Back</option>
                        <option value="WhatsApp">Send WhatsApp</option>
                        <option value="Email">Email Details</option>
                        <option value="Meeting">B2B Meeting</option>
                        <option value="Quotation">Process Quotation</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[9.5px] font-bold text-gray-400 uppercase mb-1">Agenda / Checkpoint description</label>
                    <input
                      type="text"
                      className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs outline-hidden"
                      placeholder="e.g. Review updated price worksheets..."
                      value={reminderNoteText}
                      onChange={(e) => setReminderNoteText(e.target.value)}
                    />
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={handleSaveAfterCallReminder}
                      disabled={!reminderNoteText.trim()}
                      className="py-2 px-4 bg-[#092E20] hover:bg-emerald-900 text-white text-xs font-bold rounded-lg cursor-pointer disabled:opacity-45"
                    >
                      Schedule Reminder
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {/* Option 1: Add Note */}
                  <button
                    onClick={() => setShowNoteInputCount(true)}
                    className="p-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-800 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Plus className="w-5 h-5 text-indigo-500" />
                    <span>Add Progress Note</span>
                  </button>

                  {/* Option 2: Set Reminder */}
                  <button
                    onClick={() => setShowReminderForm(true)}
                    className="p-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-800 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Calendar className="w-5 h-5 text-amber-500" />
                    <span>Schedule Follow-Up</span>
                  </button>

                  {/* Option 3: Mark Interested */}
                  <button
                    onClick={() => handleMarkStatus('Negotiation')}
                    className="p-3 bg-green-50 hover:bg-green-100/85 border border-green-200 text-green-900 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <ThumbsUp className="w-5 h-5 text-[#22C55E]" />
                    <span>Mark Interested</span>
                  </button>

                  {/* Option 4: Mark Not Interested */}
                  <button
                    onClick={() => handleMarkStatus('Lost')}
                    className="p-3 bg-red-50 hover:bg-red-100/85 border border-red-200 text-red-900 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <ThumbsDown className="w-5 h-5 text-red-500" />
                    <span>Mark Lost (Uninterested)</span>
                  </button>

                  {/* Option 5: Send Quotation */}
                  <button
                    onClick={() => {
                      setActiveCallLead(null);
                      onSelectTab('quotations');
                    }}
                    className="p-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-800 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <ArrowUpRight className="w-5 h-5 text-blue-500" />
                    <span>Create Send Quote</span>
                  </button>

                  {/* Option 6: Callback later */}
                  <button
                    onClick={handleCallBackLaterQuick}
                    className="p-3 bg-zinc-50 hover:bg-zinc-100 border border-zinc-250 text-zinc-800 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Clock className="w-5 h-5 text-gray-600" />
                    <span>Call Back Later</span>
                  </button>
                </div>
              )}

              {/* NEXT LEAD workflow step */}
              <div className="pt-4 border-t border-gray-150 flex flex-col gap-2">
                <button
                  onClick={handleNextLeadInQueue}
                  className="w-full py-3.5 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl text-sm font-black flex items-center justify-center gap-2 active:scale-95 transition-all shadow-md cursor-pointer"
                >
                  <span>NEXT LEAD</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
                <p className="text-[10px] text-gray-400 text-center font-semibold">
                  Clicking NEXT LEAD automatically advances focus context to the next outstanding client card in this queue list.
                </p>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
