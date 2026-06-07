'use client';

import React, { useMemo, useState } from 'react';
import { Lead, Quotation, CRMTask, CRMReminder } from '@/lib/types';
import {
  getTodayDateString,
  getDateOfWeekday,
  isDateInCurrentWeek,
  isDateInCurrentMonth,
  formatReadableDate,
} from '@/lib/date-utils';
import {
  Users,
  Flame,
  Phone,
  MessageSquare,
  FileSpreadsheet,
  Award,
  AlertTriangle,
  ClipboardList,
  CalendarDays,
  Clock,
  ArrowRight,
  CheckCircle,
  Inbox,
  Sparkles,
  BookOpen,
  Filter,
  Bell,
  CheckSquare,
  Check,
  Plus,
} from 'lucide-react';

interface DashboardViewProps {
  leads: Lead[];
  quotations: Quotation[];
  tasks?: CRMTask[];
  reminders?: CRMReminder[];
  onSelectTab: (tab: string) => void;
  onSelectLead: (lead: Lead) => void;
  currentFilterDay: string;
  onFilterDay: (day: string) => void;
  onUpdateTaskStatus?: (taskId: string, status: 'Pending' | 'In Progress' | 'Completed', task?: CRMTask) => Promise<void>;
}

export default function DashboardView({
  leads,
  quotations,
  tasks = [],
  reminders = [],
  onSelectTab,
  onSelectLead,
  currentFilterDay,
  onFilterDay,
  onUpdateTaskStatus,
}: DashboardViewProps) {
  // Current hour greeting
  const greeting = useMemo(() => {
    const hr = new Date().getHours();
    if (hr < 12) return 'GOOD MORNING';
    if (hr < 17) return 'GOOD AFTERNOON';
    return 'GOOD EVENING';
  }, []);

  const todayStr = useMemo(() => getTodayDateString(), []);

  // Drilldown Modal Overlay Type
  const [drilldownType, setDrilldownType] = useState<'tasks' | 'calls' | 'followups' | 'quotations' | 'reminders' | 'overdue' | null>(null);

  // Planning checklist for Saturday
  const [saturdayTasks, setSaturdayTasks] = useState([
    { id: '1', task: 'Perform pipeline review with management', done: false },
    { id: '2', task: 'Follow up on Won Lead delivery schedules', done: false },
    { id: '3', task: 'Audit weekly labels raw material levels', done: false },
    { id: '4', task: 'Draft quotation summaries for next week', done: false },
    { id: '5', task: 'Send bulk WhatsApp follow-ups to old leads', done: false },
  ]);

  const toggleSatTask = (id: string) => {
    setSaturdayTasks(prev =>
      prev.map(t => (t.id === id ? { ...t, done: !t.done } : t))
    );
  };

  // Today specific categories calculations
  const todayTasks = useMemo(() => tasks.filter(t => t.dueDate === todayStr && t.status !== 'Completed'), [tasks, todayStr]);
  const overdueTasks = useMemo(() => tasks.filter(t => t.dueDate < todayStr && t.status !== 'Completed'), [tasks, todayStr]);
  
  const todayCalls = useMemo(() => {
    const leadCalls = leads.filter(l => l.nextAction === 'Call' && l.nextActionDate === todayStr && l.status !== 'Won' && l.status !== 'Lost');
    const taskCalls = tasks.filter(t => t.category === 'Call' && t.dueDate === todayStr && t.status !== 'Completed');
    return { count: leadCalls.length + taskCalls.length, leads: leadCalls, tasks: taskCalls };
  }, [leads, tasks, todayStr]);

  const todayFollowups = useMemo(() => {
    const leadFups = leads.filter(l => (l.nextAction === 'Follow Up' || l.nextAction === 'Meeting') && l.nextActionDate === todayStr && l.status !== 'Won' && l.status !== 'Lost');
    const taskFups = tasks.filter(t => (t.category === 'Follow-up' || t.category === 'Meeting') && t.dueDate === todayStr && t.status !== 'Completed');
    return { count: leadFups.length + taskFups.length, leads: leadFups, tasks: taskFups };
  }, [leads, tasks, todayStr]);

  const todayQuotations = useMemo(() => {
    const leadQuotes = leads.filter(l => l.nextAction === 'Quotation' && l.nextActionDate === todayStr && l.status !== 'Won' && l.status !== 'Lost');
    const taskQuotes = tasks.filter(t => t.category === 'Quotation' && t.dueDate === todayStr && t.status !== 'Completed');
    return { count: leadQuotes.length + taskQuotes.length, leads: leadQuotes, tasks: taskQuotes };
  }, [leads, tasks, todayStr]);

  const todayRemindersList = useMemo(() => reminders.filter(r => r.date === todayStr), [reminders, todayStr]);

  // 1. Calculate General Overview Metrics (unaffected by filters to retain baseline)
  const stats = useMemo(() => {
    const totalLeads = leads.length;
    // Today's leads are assigned today or have next follow-up action date today
    const todayLeads = leads.filter(l => l.assignedDate === todayStr || l.nextActionDate === todayStr).length;

    // Weekday Assignment Counters
    const mondayLeads = leads.filter(l => (l.dayAssignment || 'Monday') === 'Monday').length;
    const tuesdayLeads = leads.filter(l => l.dayAssignment === 'Tuesday').length;
    const wednesdayLeads = leads.filter(l => l.dayAssignment === 'Wednesday').length;
    const thursdayLeads = leads.filter(l => l.dayAssignment === 'Thursday').length;
    const fridayLeads = leads.filter(l => l.dayAssignment === 'Friday').length;
    const saturdayFollowups = leads.filter(l => l.dayAssignment === 'Saturday Follow-up').length;

    // Custom Tasks and Reminders counters
    const pendingTasks = tasks.filter(t => t.status !== 'Completed').length;
    const todayReminders = reminders.filter(r => r.date === todayStr).length;

    return {
      totalLeads,
      todayLeads,
      mondayLeads,
      tuesdayLeads,
      wednesdayLeads,
      thursdayLeads,
      fridayLeads,
      saturdayFollowups,
      pendingTasks,
      todayReminders,
    };
  }, [leads, tasks, reminders, todayStr]);

  // Determine current active filter's exact YYYY-MM-DD
  const filterDateValue = useMemo(() => {
    if (['today', 'this week', 'this month'].includes(currentFilterDay.toLowerCase())) {
      return todayStr;
    }
    return getDateOfWeekday(currentFilterDay);
  }, [currentFilterDay, todayStr]);

  // Filter leads based on the Selected Day / Row
  const filteredLeadTasks = useMemo(() => {
    const filterLower = currentFilterDay.toLowerCase();

    if (filterLower === 'this week') {
      return leads.filter(
        l => l.nextActionDate && isDateInCurrentWeek(l.nextActionDate) && l.status !== 'Won' && l.status !== 'Lost'
      );
    }

    if (filterLower === 'this month') {
      return leads.filter(
        l => l.nextActionDate && isDateInCurrentMonth(l.nextActionDate) && l.status !== 'Won' && l.status !== 'Lost'
      );
    }

    if (filterLower === 'saturday') {
      // Review Day: Find pending follow ups and review-worthy leads (any lead not won/lost or overdue)
      return leads.filter(l => l.status !== 'Won' && l.status !== 'Lost');
    }

    // Default weekday filter
    const targetDate = filterDateValue;
    return leads.filter(
      l => l.nextActionDate === targetDate && l.status !== 'Won' && l.status !== 'Lost'
    );
  }, [leads, currentFilterDay, filterDateValue]);

  // Subdivided filtered lists
  const filteredCalls = useMemo(() => {
    return filteredLeadTasks.filter(l => l.nextAction === 'Call');
  }, [filteredLeadTasks]);

  const filteredFollowUps = useMemo(() => {
    return filteredLeadTasks.filter(l => l.nextAction === 'Follow Up' || l.nextAction === 'Meeting');
  }, [filteredLeadTasks]);

  const filteredQuotations = useMemo(() => {
    return filteredLeadTasks.filter(l => l.nextAction === 'Quotation');
  }, [filteredLeadTasks]);

  // Overdue leads global list
  const globalOverdueLeads = useMemo(() => {
    return leads.filter(
      l => l.nextActionDate && l.nextActionDate < todayStr && l.status !== 'Won' && l.status !== 'Lost'
    );
  }, [leads, todayStr]);

  return (
    <div className="space-y-8" id="dashboard-viewport">
      {/* 0. TODAY'S MASTER WORKFLOW SHEET (GOOD MORNING CENTRAL COMMAND) */}
      <section className="bg-white p-6 rounded-3xl border border-gray-150 shadow-sm space-y-6" id="todays-master-control-panel">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
          <div>
            <h1 className="text-3xl font-black font-display tracking-tight text-[#092E20] uppercase leading-none">
              {greeting}
            </h1>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1.5 leading-none">VAISHNAVI SALES CONTROL CENTER</p>
          </div>
          <span className="text-xs font-mono font-bold bg-green-50 border border-green-150 py-1.5 px-3 rounded-xl text-[#092E20] self-start sm:self-center">
            {new Date().toLocaleDateString('en-IN', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
            })}
          </span>
        </div>

        {/* 6 Large Touch Friendly Buttons */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
          {/* A. Today's Tasks Button */}
          <button
            onClick={() => setDrilldownType('tasks')}
            className="p-4 bg-white hover:bg-[#F4FBF7] rounded-2xl border border-gray-200 hover:border-[#22C55E] flex flex-col items-center justify-center text-center gap-1.5 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer group active:scale-95"
          >
            <span className="p-2 rounded-xl bg-green-50 group-hover:bg-[#22C55E]/10 text-green-600 transition-colors">
              <CheckSquare className="w-5 h-5 text-[#22C55E]" />
            </span>
            <div className="text-center min-w-0">
              <span className="text-xl md:text-2xl font-black font-mono text-gray-800 tracking-tight block">
                {todayTasks.length}
              </span>
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Today&apos;s Tasks</span>
            </div>
          </button>

          {/* B. Today's Calls Button */}
          <button
            onClick={() => setDrilldownType('calls')}
            className="p-4 bg-white hover:bg-blue-50/20 rounded-2xl border border-gray-200 hover:border-blue-300 flex flex-col items-center justify-center text-center gap-1.5 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer group active:scale-95"
          >
            <span className="p-2 rounded-xl bg-blue-50 group-hover:bg-blue-100 text-blue-600 transition-colors">
              <Phone className="w-5 h-5" />
            </span>
            <div className="text-center min-w-0">
              <span className="text-xl md:text-2xl font-black font-mono text-gray-800 tracking-tight block">
                {todayCalls.count}
              </span>
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Today&apos;s Calls</span>
            </div>
          </button>

          {/* C. Today's Follow-ups Button */}
          <button
            onClick={() => setDrilldownType('followups')}
            className="p-4 bg-white hover:bg-amber-50/25 rounded-2xl border border-gray-200 hover:border-amber-300 flex flex-col items-center justify-center text-center gap-1.5 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer group active:scale-95"
          >
            <span className="p-2 rounded-xl bg-amber-50 group-hover:bg-amber-100 text-amber-600 transition-colors">
              <MessageSquare className="w-5 h-5" />
            </span>
            <div className="text-center min-w-0">
              <span className="text-xl md:text-2xl font-black font-mono text-gray-800 tracking-tight block">
                {todayFollowups.count}
              </span>
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Today&apos;s Follow-ups</span>
            </div>
          </button>

          {/* D. Today's Quotations Button */}
          <button
            onClick={() => setDrilldownType('quotations')}
            className="p-4 bg-white hover:bg-purple-50/20 rounded-2xl border border-gray-200 hover:border-purple-300 flex flex-col items-center justify-center text-center gap-1.5 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer group active:scale-95"
          >
            <span className="p-2 rounded-xl bg-purple-50 group-hover:bg-purple-100 text-purple-600 transition-colors">
              <FileSpreadsheet className="w-5 h-5" />
            </span>
            <div className="text-center min-w-0">
              <span className="text-xl md:text-2xl font-black font-mono text-gray-800 tracking-tight block">
                {todayQuotations.count}
              </span>
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Today&apos;s Quotations</span>
            </div>
          </button>

          {/* E. Today's Reminders Button */}
          <button
            onClick={() => setDrilldownType('reminders')}
            className="p-4 bg-white hover:bg-rose-50/20 rounded-2xl border border-gray-200 hover:border-rose-300 flex flex-col items-center justify-center text-center gap-1.5 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer group active:scale-95"
          >
            <span className="p-2 rounded-xl bg-rose-50 group-hover:bg-[#22C55E]/10 text-[#22C55E] transition-colors">
              <Bell className="w-5 h-5" />
            </span>
            <div className="text-center min-w-0">
              <span className="text-xl md:text-2xl font-black font-mono text-gray-800 tracking-tight block">
                {todayRemindersList.length}
              </span>
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Today&apos;s Reminders</span>
            </div>
          </button>

          {/* F. Overdue Tasks Button */}
          <button
            onClick={() => setDrilldownType('overdue')}
            className={`p-4 rounded-2xl border flex flex-col items-center justify-center text-center gap-1.5 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer group active:scale-95 ${
              overdueTasks.length > 0
                ? 'bg-red-50 hover:bg-red-100 border-red-200 hover:border-red-400 text-red-700 font-bold'
                : 'bg-white hover:bg-gray-50 border-gray-200 text-gray-500'
            }`}
          >
            <span className={`p-2 rounded-xl transition-colors ${overdueTasks.length > 0 ? 'bg-red-100 text-red-700' : 'bg-gray-50 text-gray-405'}`}>
              <AlertTriangle className="w-5 h-5" />
            </span>
            <div className="text-center min-w-0">
              <span className={`text-xl md:text-2xl font-black font-mono tracking-tight block ${overdueTasks.length > 0 ? 'text-red-700' : 'text-gray-800'}`}>
                {overdueTasks.length}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider block">Overdue Tasks</span>
            </div>
          </button>
        </div>
      </section>

      {/* DRILLDOWN OVERLAY DRAWERS */}
      {drilldownType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-xs overflow-y-auto" id="drilldown-modal-container">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-gray-150 flex flex-col my-8 animate-in fade-in zoom-in-95 duration-200 max-h-[85vh]">
            
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-gray-50/75 rounded-t-2xl">
              <div className="min-w-0">
                <h3 className="font-bold text-base text-gray-800 tracking-tight capitalize flex items-center gap-1.5">
                  {drilldownType === 'overdue' && <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />}
                  <span>Today&apos;s active {drilldownType === 'overdue' ? 'Overdue Tasks' : drilldownType}</span>
                </h3>
                <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold mt-0.5">Tactical Drilldown Map</p>
              </div>
              <button
                onClick={() => setDrilldownType(null)}
                className="p-1.5 hover:bg-gray-200 text-gray-400 hover:text-gray-600 rounded-lg transition-colors cursor-pointer select-none"
              >
                ✖
              </button>
            </div>

            {/* Content Area */}
            <div className="p-6 space-y-4 overflow-y-auto flex-1 font-sans">
              
              {/* DRILLDOWN LIST FOR TASKS (Today + Overdue) */}
              {(drilldownType === 'tasks' || drilldownType === 'overdue') && (
                <div className="space-y-3">
                  {(drilldownType === 'tasks' ? todayTasks : overdueTasks).map(task => (
                    <div key={task.id} className="p-4 bg-gray-50 border border-gray-200 rounded-xl flex items-start justify-between gap-3 transition-colors hover:bg-gray-100/50">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <button
                          onClick={() => {
                            if (onUpdateTaskStatus) {
                              onUpdateTaskStatus(task.id, 'Completed', task);
                            }
                          }}
                          className="shrink-0 w-5.5 h-5.5 rounded-md border border-gray-300 hover:border-[#22C55E] bg-white flex items-center justify-center cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5 text-[#22C55E] opacity-0 hover:opacity-100 transition-opacity" />
                        </button>
                        <div className="min-w-0 flex-1">
                          <h5 className="font-bold text-xs text-gray-800 tracking-tight break-words">{task.title}</h5>
                          {task.description && <p className="text-[11px] text-gray-500 mt-1 line-clamp-2 break-words leading-relaxed">{task.description}</p>}
                          <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-400 font-semibold uppercase">
                            <span>🕒 {task.dueDate} {task.dueTime ? `@ ${task.dueTime}` : ''}</span>
                            <span className="px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 font-bold tracking-wide border border-amber-100">{task.priority}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {(drilldownType === 'tasks' ? todayTasks : overdueTasks).length === 0 && (
                    <div className="py-12 text-center text-gray-400 text-xs">No pending items found in this section!</div>
                  )}
                </div>
              )}

              {/* DRILLDOWN LIST FOR CALLS */}
              {drilldownType === 'calls' && (
                <div className="space-y-3">
                  {todayCalls.leads.map(lead => (
                    <div
                      key={lead.id}
                      onClick={() => {
                        setDrilldownType(null);
                        onSelectLead(lead);
                      }}
                      className="p-4 bg-blue-50/10 hover:bg-blue-50/30 border border-blue-100 rounded-xl cursor-pointer transition-all flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[9px] bg-blue-50 border border-blue-150 text-blue-700 px-1.5 py-0.2 rounded font-black tracking-wider uppercase">Lead Call</span>
                          <span className="text-[10px] text-gray-400 font-semibold">{lead.city}</span>
                        </div>
                        <h5 className="font-bold text-xs text-gray-850 truncate mt-1">{lead.customerName}</h5>
                        <p className="text-[11px] text-gray-500">{lead.companyName}</p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-blue-400 shrink-0" />
                    </div>
                  ))}

                  {todayCalls.tasks.map(task => (
                    <div key={task.id} className="p-4 bg-gray-50 border border-gray-200 rounded-xl flex items-start gap-3">
                      <button
                        onClick={() => {
                          if (onUpdateTaskStatus) {
                            onUpdateTaskStatus(task.id, 'Completed', task);
                          }
                        }}
                        className="shrink-0 w-5.5 h-5.5 rounded-md border border-gray-300 hover:border-[#22C55E] bg-white flex items-center justify-center cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5 text-[#22C55E] opacity-0 hover:opacity-100 transition-opacity" />
                      </button>
                      <div className="min-w-0 flex-1">
                        <span className="text-[9px] bg-indigo-50 border border-indigo-150 text-indigo-700 px-1.5 py-0.2 rounded font-black tracking-wider uppercase">Task Call</span>
                        <h5 className="font-bold text-xs text-gray-800 break-words mt-1">{task.title}</h5>
                        {task.description && <p className="text-[11px] text-gray-500 mt-1 truncate">{task.description}</p>}
                      </div>
                    </div>
                  ))}

                  {todayCalls.count === 0 && (
                    <div className="py-12 text-center text-gray-400 text-xs">No pending sales calls matched for today!</div>
                  )}
                </div>
              )}

              {/* DRILLDOWN LIST FOR FOLLOWUPS */}
              {drilldownType === 'followups' && (
                <div className="space-y-3">
                  {todayFollowups.leads.map(lead => (
                    <div
                      key={lead.id}
                      onClick={() => {
                        setDrilldownType(null);
                        onSelectLead(lead);
                      }}
                      className="p-4 bg-amber-50/10 hover:bg-amber-50/30 border border-amber-100 rounded-xl cursor-pointer transition-all flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <span className="text-[9px] bg-amber-50 border border-amber-150 text-amber-700 px-1.5 py-0.2 rounded font-black tracking-wider uppercase">Lead Action</span>
                        <h5 className="font-bold text-xs text-gray-850 truncate mt-1">{lead.customerName}</h5>
                        <p className="text-[11px] text-gray-500">{lead.companyName}</p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-amber-400 shrink-0" />
                    </div>
                  ))}

                  {todayFollowups.tasks.map(task => (
                    <div key={task.id} className="p-4 bg-gray-50 border border-gray-200 rounded-xl flex items-start gap-3">
                      <button
                        onClick={() => {
                          if (onUpdateTaskStatus) {
                            onUpdateTaskStatus(task.id, 'Completed', task);
                          }
                        }}
                        className="shrink-0 w-5.5 h-5.5 rounded-md border border-gray-300 hover:border-[#22C55E] bg-white flex items-center justify-center cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5 text-[#22C55E] opacity-0 hover:opacity-100 transition-opacity" />
                      </button>
                      <div className="min-w-0 flex-1">
                        <span className="text-[9px] bg-indigo-50 border border-indigo-150 text-indigo-700 px-1.5 py-0.2 rounded font-black tracking-wider uppercase">Task Action</span>
                        <h5 className="font-bold text-xs text-gray-800 break-words mt-1">{task.title}</h5>
                      </div>
                    </div>
                  ))}

                  {todayFollowups.count === 0 && (
                    <div className="py-12 text-center text-gray-400 text-xs">No pending follow-ups scheduled for today.</div>
                  )}
                </div>
              )}

              {/* DRILLDOWN LIST FOR QUOTATIONS */}
              {drilldownType === 'quotations' && (
                <div className="space-y-3">
                  {todayQuotations.leads.map(lead => (
                    <div
                      key={lead.id}
                      onClick={() => {
                        setDrilldownType(null);
                        onSelectLead(lead);
                      }}
                      className="p-4 bg-purple-50/10 hover:bg-purple-50/30 border border-purple-100 rounded-xl cursor-pointer transition-all flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <span className="text-[9px] bg-purple-50 border border-purple-150 text-purple-700 px-1.5 py-0.2 rounded font-black tracking-wider uppercase">Lead Quote Spec</span>
                        <h5 className="font-bold text-xs text-gray-850 truncate mt-1">{lead.customerName}</h5>
                        <p className="text-[11px] text-gray-500">{lead.companyName}</p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-purple-400 shrink-0" />
                    </div>
                  ))}

                  {todayQuotations.tasks.map(task => (
                    <div key={task.id} className="p-4 bg-gray-50 border border-gray-200 rounded-xl flex items-start gap-3">
                      <button
                        onClick={() => {
                          if (onUpdateTaskStatus) {
                            onUpdateTaskStatus(task.id, 'Completed', task);
                          }
                        }}
                        className="shrink-0 w-5.5 h-5.5 rounded-md border border-gray-300 hover:border-[#22C55E] bg-white flex items-center justify-center cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5 text-[#22C55E] opacity-0 hover:opacity-100 transition-opacity" />
                      </button>
                      <div className="min-w-0 flex-1">
                        <span className="text-[9px] bg-indigo-50 border border-indigo-150 text-indigo-700 px-1.5 py-0.2 rounded font-black tracking-wider uppercase">Task Quote</span>
                        <h5 className="font-bold text-xs text-gray-850 break-words mt-1">{task.title}</h5>
                      </div>
                    </div>
                  ))}

                  {todayQuotations.count === 0 && (
                    <div className="py-12 text-center text-gray-400 text-xs">No pending sheet quotations scheduled.</div>
                  )}
                </div>
              )}

              {/* DRILLDOWN LIST FOR REMINDERS */}
              {drilldownType === 'reminders' && (
                <div className="space-y-3">
                  {todayRemindersList.map(reminder => (
                    <div key={reminder.id} className="p-4 bg-rose-50/15 border border-rose-150 rounded-xl">
                      <span className="text-[9.5px] uppercase tracking-wider font-extrabold text-rose-700">⏰ Alert Notification {reminder.time}</span>
                      <h5 className="font-bold text-xs text-gray-850 mt-1">{reminder.title}</h5>
                      {reminder.notes && <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">{reminder.notes}</p>}
                    </div>
                  ))}
                  {todayRemindersList.length === 0 && (
                    <div className="py-12 text-center text-gray-400 text-xs">No alerts compiled for today. Always schedule reminders at product checkpoints.</div>
                  )}
                </div>
              )}

            </div>

            {/* Footer */}
            <div className="p-4 bg-gray-50 rounded-b-2xl border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setDrilldownType(null)}
                className="py-2.5 px-6 bg-[#092E20] hover:bg-[#0F5132] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer select-none"
              >
                Finished Review
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 1. HERO GREETING BANNER */}
      <div className="relative bg-gradient-to-r from-[#092E20] to-[#0F5132] rounded-2xl p-6 md:p-8 text-white overflow-hidden shadow-lg border border-[#22C55E]/10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_80%_20%,rgba(34,197,94,0.18),rgba(0,0,0,0))]" />
        
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-green-300 text-xs font-semibold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 animate-pulse text-[#22C55E]" />
              Vaishnavi Enterprise CRM &bull; Live Sync
            </span>
            <h1 className="text-3xl md:text-4xl font-bold font-display tracking-tight">
              {greeting}, Owner!
            </h1>
            <p className="text-green-100 text-sm md:text-base max-w-xl">
              Self-Adhesive Labels Sales & Production Hub. Check your active alerts, followups, and schedules below.
            </p>
          </div>
          
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/10 flex flex-col justify-center min-w-[200px]">
            <span className="text-xs text-green-200">System Local Time</span>
            <span className="text-xl font-bold font-mono tracking-tight text-[#22C55E]">
              {new Date().toLocaleDateString('en-IN', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
              })}
            </span>
            <span className="text-xs text-green-300 mt-1 uppercase font-semibold">
              Today: {currentFilterDay.toUpperCase()} Schedule
            </span>
          </div>
        </div>
      </div>

      {/* 2. MAIN METRICS KPI GRID */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4" id="dashboard-statistics-grid">
        <div className="bg-white p-4 rounded-xl shadow-xs border border-gray-155 flex items-center gap-3 transition-all hover:shadow-sm">
          <div className="p-2.5 rounded-lg bg-green-50 text-[#092E20] shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Total Leads</p>
            <h3 className="text-lg font-bold text-gray-800 font-display mt-0.5 leading-none">{stats.totalLeads}</h3>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-xs border border-gray-155 flex items-center gap-3 transition-all hover:shadow-sm">
          <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-600 shrink-0">
            <Flame className="w-5 h-5 animate-pulse" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Today&apos;s Leads</p>
            <h3 className="text-lg font-bold text-gray-800 font-display mt-0.5 leading-none">{stats.todayLeads}</h3>
          </div>
        </div>

        {/* Monday Leads */}
        <div className="bg-white p-4 rounded-xl shadow-xs border border-gray-155 flex items-center gap-3 transition-all hover:shadow-sm">
          <div className="p-2.5 rounded-lg bg-indigo-50 text-indigo-600 shrink-0">
            <CalendarDays className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Monday Leads</p>
            <h3 className="text-lg font-bold text-gray-800 font-display mt-0.5 leading-none">{stats.mondayLeads}</h3>
          </div>
        </div>

        {/* Tuesday Leads */}
        <div className="bg-white p-4 rounded-xl shadow-xs border border-gray-155 flex items-center gap-3 transition-all hover:shadow-sm">
          <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600 shrink-0">
            <CalendarDays className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Tuesday Leads</p>
            <h3 className="text-lg font-bold text-gray-800 font-display mt-0.5 leading-none">{stats.tuesdayLeads}</h3>
          </div>
        </div>

        {/* Wednesday Leads */}
        <div className="bg-white p-4 rounded-xl shadow-xs border border-gray-155 flex items-center gap-3 transition-all hover:shadow-sm">
          <div className="p-2.5 rounded-lg bg-amber-50 text-amber-600 shrink-0">
            <CalendarDays className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Wednesday Leads</p>
            <h3 className="text-lg font-bold text-gray-800 font-display mt-0.5 leading-none">{stats.wednesdayLeads}</h3>
          </div>
        </div>

        {/* Thursday Leads */}
        <div className="bg-white p-4 rounded-xl shadow-xs border border-gray-155 flex items-center gap-3 transition-all hover:shadow-sm">
          <div className="p-2.5 rounded-lg bg-purple-50 text-purple-600 shrink-0">
            <CalendarDays className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Thursday Leads</p>
            <h3 className="text-lg font-bold text-gray-800 font-display mt-0.5 leading-none">{stats.thursdayLeads}</h3>
          </div>
        </div>

        {/* Friday Leads */}
        <div className="bg-white p-4 rounded-xl shadow-xs border border-gray-155 flex items-center gap-3 transition-all hover:shadow-sm">
          <div className="p-2.5 rounded-lg bg-pink-50 text-pink-600 shrink-0">
            <CalendarDays className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Friday Leads</p>
            <h3 className="text-lg font-bold text-gray-800 font-display mt-0.5 leading-none">{stats.fridayLeads}</h3>
          </div>
        </div>

        {/* Saturday Follow-ups */}
        <div className="bg-white p-4 rounded-xl shadow-xs border border-gray-155 flex items-center gap-3 transition-all hover:shadow-sm">
          <div className="p-2.5 rounded-lg bg-orange-50 text-orange-650 shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-orange-700 uppercase tracking-wider block">Saturday Follow-ups</p>
            <h3 className="text-lg font-bold text-gray-800 font-display mt-0.5 leading-none">{stats.saturdayFollowups}</h3>
          </div>
        </div>

        {/* Pending Tasks */}
        <div className="bg-white p-4 rounded-xl shadow-xs border border-gray-155 flex items-center gap-3 transition-all hover:shadow-sm">
          <div className="p-2.5 rounded-lg bg-red-50 text-red-600 shrink-0">
            <ClipboardList className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-red-550 uppercase tracking-wider block">Pending Tasks</p>
            <h3 className="text-lg font-bold text-red-650 font-display mt-0.5 leading-none">{stats.pendingTasks}</h3>
          </div>
        </div>

        {/* Today's Reminders */}
        <div className="bg-white p-4 rounded-xl shadow-xs border border-gray-155 flex items-center gap-3 transition-all hover:shadow-sm">
          <div className="p-2.5 rounded-lg bg-rose-50 text-[#092E20] shrink-0">
            <Bell className="w-5 h-5 text-[#22C55E]" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-rose-600 uppercase tracking-wider block">Today&apos;s Reminders</p>
            <h3 className="text-lg font-bold text-gray-800 font-display mt-0.5 leading-none">{stats.todayReminders}</h3>
          </div>
        </div>
      </section>

      {/* 3. DYNAMIC WORKFLOW SCHEDULE FILTERS */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-[#092E20]" />
            <h2 className="text-lg font-bold text-gray-800 font-display">Sales Activities & Schedule Planner</h2>
          </div>
          <span className="text-xs font-mono text-gray-400">
            Current filter: <strong className="text-[#092E20] uppercase">{currentFilterDay}</strong>
          </span>
        </div>

        {/* Filters Buttons list */}
        <div className="flex flex-wrap gap-2" id="dashboard-tab-filters-row">
          {[
            { id: 'today', label: 'Today Action' },
            { id: 'Monday', label: 'Mon' },
            { id: 'Tuesday', label: 'Tue' },
            { id: 'Wednesday', label: 'Wed' },
            { id: 'Thursday', label: 'Thu' },
            { id: 'Friday', label: 'Fri' },
            { id: 'Saturday', label: 'Review Day (Sat)' },
            { id: 'This Week', label: 'This Week' },
            { id: 'This Month', label: 'This Month' },
          ].map(f => {
            const isActive = currentFilterDay.toLowerCase() === f.id.toLowerCase();
            return (
              <button
                key={f.id}
                onClick={() => onFilterDay(f.id)}
                className={`py-2 px-4 rounded-lg font-medium text-xs transition-colors cursor-pointer select-none ${
                  isActive
                    ? 'bg-[#092E20] text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. WORKFLOW RESULTS: MONDAY-FRIDAY SALES vs SATURDAY PLANNING */}
      {currentFilterDay.toLowerCase() === 'saturday' ? (
        // SATURDAY: REVIEW AND PLANNING DAY VIEW
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" id="saturday-reviewer-workspace">
          {/* Left: Planning Checklist */}
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
              <ClipboardList className="w-5 h-5 text-[#092E20]" />
              <h3 className="font-bold text-gray-800 text-lg">Saturday Review & Planning Tasks</h3>
            </div>
            
            <p className="text-xs text-gray-500 leading-relaxed">
              Saturday is your dedicated planning day. Check your operations, review your weekly logs, and tick off preparation tasks below.
            </p>

            <div className="space-y-3 pt-2">
              {saturdayTasks.map(t => (
                <label
                  key={t.id}
                  className="flex items-start gap-3 p-3 bg-gray-50 hover:bg-green-50/30 rounded-lg cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={t.done}
                    onChange={() => toggleSatTask(t.id)}
                    className="mt-1 w-4.5 h-4.5 text-[#092E20] focus:ring-[#092E20] border-gray-300 rounded cursor-pointer"
                  />
                  <span className={`text-xs ${t.done ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                    {t.task}
                  </span>
                </label>
              ))}
            </div>

            <div className="p-4 bg-green-50 rounded-lg flex items-center justify-between text-xs text-[#092E20]">
              <span>Checklist Progress</span>
              <span className="font-bold">
                {saturdayTasks.filter(t => t.done).length} / {saturdayTasks.length} Done
              </span>
            </div>
          </div>

          {/* Right: Saturday Leads Audit & Review list */}
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-[#0F5132]" />
                <h3 className="font-bold text-gray-800 text-lg">Weekly Pipeline Audit</h3>
              </div>
              <span className="bg-amber-100 text-amber-800 text-[10px] uppercase px-2 py-0.5 rounded-full font-bold">
                {leads.filter(l => l.status !== 'Won' && l.status !== 'Lost').length} Active Leads
              </span>
            </div>

            <p className="text-xs text-gray-500 leading-relaxed">
              Listed below are all currently active leads. Take this time to review client communication and push negotiations.
            </p>

            <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
              {leads
                .filter(l => l.status !== 'Won' && l.status !== 'Lost')
                .slice(0, 5)
                .map(l => (
                  <div
                    key={l.id}
                    onClick={() => onSelectLead(l)}
                    className="p-3 bg-gray-50 hover:bg-gray-100 rounded-lg flex items-center justify-between transition-colors cursor-pointer border border-transparent hover:border-gray-200"
                  >
                    <div>
                      <h4 className="font-bold text-xs text-gray-850 truncate max-w-[170px]">{l.customerName}</h4>
                      <p className="text-[10px] text-gray-500 mt-0.5">{l.companyName} &bull; {l.city}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] bg-green-50 text-[#092E20] px-2 py-0.5 rounded font-medium">
                        {l.status}
                      </span>
                      <p className="text-[9px] text-gray-400 mt-1 uppercase font-semibold">Priority: {l.priority}</p>
                    </div>
                  </div>
                ))}
              {leads.filter(l => l.status !== 'Won' && l.status !== 'Lost').length === 0 && (
                <div className="py-8 text-center text-gray-400 text-xs">
                  <Inbox className="w-8 h-8 mx-auto stroke-1 mb-2" />
                  No active leads found to review.
                </div>
              )}
            </div>

            <button
              onClick={() => onSelectTab('leads')}
              className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-[#092E20] font-bold text-xs rounded-lg mt-2 flex items-center justify-center gap-1 cursor-pointer"
            >
              <span>Explore All Leads</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : (
        // MONDAY - FRIDAY: INTERACTIVE WORKLIST GRIDS
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="weekday-sales-workspace">
          {/* A. TODAY'S SHIFT CALLS */}
          <div className="bg-white p-5 rounded-xl border border-gray-105 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <span className="p-1 rounded bg-blue-50 text-blue-600">
                  <Phone className="w-4 h-4" />
                </span>
                <h3 className="font-bold text-gray-850 text-sm">Target Call Sheet</h3>
              </div>
              <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                {filteredCalls.length} Leads
              </span>
            </div>

            <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
              {filteredCalls.map(l => (
                <div
                  key={l.id}
                  onClick={() => onSelectLead(l)}
                  className="p-3 bg-gray-50 hover:bg-blue-50/15 rounded-lg border border-transparent hover:border-blue-100 transition-all cursor-pointer flex justify-between items-center"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <p className="font-bold text-xs text-gray-800 truncate">{l.customerName}</p>
                    <p className="text-[10px] text-gray-500 truncate">{l.companyName}</p>
                    <div className="flex items-center gap-1.5 text-[9px] text-gray-400">
                      <Clock className="w-3 h-3" />
                      <span>{l.nextActionTime || 'No Time'}</span>
                    </div>
                  </div>
                  <span className={`text-[9px] uppercase px-1.5 py-0.5 rounded font-bold ${
                    l.priority === 'Hot' ? 'bg-red-100 text-red-800' : l.priority === 'Warm' ? 'bg-amber-100 text-amber-800' : 'bg-gray-150 text-gray-700'
                  }`}>
                    {l.priority}
                  </span>
                </div>
              ))}
              {filteredCalls.length === 0 && (
                <div className="py-12 text-center text-gray-400 text-xs">
                  <Inbox className="w-8 h-8 mx-auto stroke-1 mb-2" />
                  No leads scheduled to call today.
                </div>
              )}
            </div>
          </div>

          {/* B. TODAY'S SHIFT FOLLOW UPS */}
          <div className="bg-white p-5 rounded-xl border border-gray-105 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <span className="p-1 rounded bg-amber-50 text-amber-600">
                  <MessageSquare className="w-4 h-4" />
                </span>
                <h3 className="font-bold text-gray-850 text-sm">Key Follow-Ups</h3>
              </div>
              <span className="bg-amber-50 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                {filteredFollowUps.length} Actions
              </span>
            </div>

            <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
              {filteredFollowUps.map(l => (
                <div
                  key={l.id}
                  onClick={() => onSelectLead(l)}
                  className="p-3 bg-gray-50 hover:bg-amber-50/15 rounded-lg border border-transparent hover:border-amber-100 transition-all cursor-pointer flex justify-between items-center"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <p className="font-bold text-xs text-gray-800 truncate">{l.customerName}</p>
                    <p className="text-[10px] text-gray-500 truncate">{l.companyName}</p>
                    <div className="flex items-center gap-1.5 text-[9px] text-gray-400">
                      <CalendarDays className="w-3 h-3" />
                      <span>{formatReadableDate(l.nextActionDate)} {l.nextActionTime}</span>
                    </div>
                  </div>
                  <span className="text-[9px] bg-[#22C55E]/15 text-[#092E20] px-1.5 py-0.5 rounded font-bold font-sans">
                    {l.status}
                  </span>
                </div>
              ))}
              {filteredFollowUps.length === 0 && (
                <div className="py-12 text-center text-gray-400 text-xs">
                  <Inbox className="w-8 h-8 mx-auto stroke-1 mb-2" />
                  No follow-ups due.
                </div>
              )}
            </div>
          </div>

          {/* C. TODAY'S SHIFT QUOTATIONS DUE */}
          <div className="bg-white p-5 rounded-xl border border-gray-105 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <span className="p-1 rounded bg-purple-50 text-purple-600">
                  <FileSpreadsheet className="w-4 h-4" />
                </span>
                <h3 className="font-bold text-gray-850 text-sm">Quotations Due</h3>
              </div>
              <span className="bg-purple-50 text-purple-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                {filteredQuotations.length} Pending
              </span>
            </div>

            <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
              {filteredQuotations.map(l => (
                <div
                  key={l.id}
                  onClick={() => onSelectLead(l)}
                  className="p-3 bg-gray-50 hover:bg-purple-50/15 rounded-lg border border-transparent hover:border-purple-100 transition-all cursor-pointer flex justify-between items-center"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <p className="font-bold text-xs text-gray-800 truncate">{l.customerName}</p>
                    <p className="text-[10px] text-gray-500 truncate">{l.companyName}</p>
                    <div className="flex items-center gap-1 text-[9px] text-purple-600 font-semibold uppercase">
                      <span>Require Quotation</span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectTab('quotations');
                    }}
                    className="p-1.5 bg-purple-50 hover:bg-purple-150 text-purple-700 rounded-lg transition-transform active:scale-90"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {filteredQuotations.length === 0 && (
                <div className="py-12 text-center text-gray-400 text-xs">
                  <Inbox className="w-8 h-8 mx-auto stroke-1 mb-2" />
                  No quotations scheduled.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 5. LIVE NOTIFICATION CENTER & OVERDUE WARNINGS CARD */}
      {globalOverdueLeads.length > 0 && (
        <div className="bg-red-50/40 border border-red-200/50 p-5 rounded-xl flex flex-col md:flex-row gap-4 items-start md:items-center justify-between" id="dashboard-system-alerts">
          <div className="flex gap-3">
            <div className="p-2 rounded bg-red-100 text-red-600 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-red-800">Critical Overdue REMINDER Alert ({globalOverdueLeads.length})</h4>
              <p className="text-xs text-red-700 mt-0.5 leading-relaxed">
                You have {globalOverdueLeads.length} leads with actions scheduled before today which are still pending. Clear overdue calls to keep high response times.
              </p>
            </div>
          </div>
          <button
            onClick={() => onSelectTab('leads')}
            className="text-xs font-bold text-red-800 bg-red-100 hover:bg-red-200 py-2 px-4 rounded-lg self-stretch md:self-auto text-center shrink-0 transition-colors cursor-pointer"
          >
            Resolve Overdue Now
          </button>
        </div>
      )}
    </div>
  );
}
