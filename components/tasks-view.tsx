'use client';

import React, { useState, useMemo } from 'react';
import { CRMTask, Lead } from '@/lib/types';
import { 
  Calendar, 
  AlertTriangle, 
  CheckSquare, 
  Plus, 
  Clock, 
  User, 
  Trash2, 
  Repeat, 
  Tag, 
  Check, 
  Hourglass,
  SlidersHorizontal,
  FolderOpen,
  Edit2
} from 'lucide-react';
import { getTodayDateString, getTomorrowDateString, isDateInCurrentWeek } from '@/lib/date-utils';

// Static utility for overdue calculation
function getDaysOverdue(dueDateStr: string, todayStr: string): number {
  try {
    const today = new Date(todayStr);
    const due = new Date(dueDateStr);
    const diffTime = today.getTime() - due.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  } catch {
    return 0;
  }
}

interface TasksViewProps {
  tasks: CRMTask[];
  leads: Lead[];
  onCreateTask: (taskData: Partial<CRMTask>) => Promise<void>;
  onUpdateTaskStatus: (taskId: string, status: 'Pending' | 'In Progress' | 'Completed', task?: CRMTask) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  onOpenTaskModal: () => void;
  onEditTask: (task: CRMTask) => void;
}

export default function TasksView({
  tasks,
  leads,
  onCreateTask,
  onUpdateTaskStatus,
  onDeleteTask,
  onOpenTaskModal,
  onEditTask,
}: TasksViewProps) {
  // Filters
  const [activeFilter, setActiveFilter] = useState<'today' | 'tomorrow' | 'week' | 'overdue' | 'completed' | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  const todayStr = getTodayDateString();
  const tomorrowStr = getTomorrowDateString();

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      // 1. Time / Tab Filter
      let matchTime = true;
      const daysOverdue = getDaysOverdue(task.dueDate, todayStr);

      if (activeFilter === 'today') {
        matchTime = task.dueDate === todayStr && task.status !== 'Completed';
      } else if (activeFilter === 'tomorrow') {
        matchTime = task.dueDate === tomorrowStr && task.status !== 'Completed';
      } else if (activeFilter === 'week') {
        matchTime = isDateInCurrentWeek(task.dueDate) && task.status !== 'Completed';
      } else if (activeFilter === 'overdue') {
        matchTime = task.dueDate < todayStr && task.status !== 'Completed';
      } else if (activeFilter === 'completed') {
        matchTime = task.status === 'Completed';
      }

      // 2. Category Filter
      const matchCategory = categoryFilter === 'all' || (task.category || 'Other') === categoryFilter;

      // 3. Priority Filter
      const matchPriority = priorityFilter === 'all' || task.priority === priorityFilter;

      return matchTime && matchCategory && matchPriority;
    });
  }, [tasks, activeFilter, categoryFilter, priorityFilter, todayStr, tomorrowStr]);

  const getPriorityBadge = (p: 'Low' | 'Medium' | 'High') => {
    switch (p) {
      case 'High':
        return 'bg-red-50 text-red-700 border-red-150';
      case 'Medium':
        return 'bg-amber-50 text-amber-700 border-amber-150';
      case 'Low':
        return 'bg-[#F4FBF7] text-[#092E20] border-emerald-100';
    }
  };

  const getCategoryIcon = (cat?: string) => {
    switch (cat) {
      case 'Call': return '📞';
      case 'Follow-up': return '🔄';
      case 'Quotation': return '📄';
      case 'Meeting': return '🤝';
      case 'Purchase': return '🛒';
      case 'Payment Collection': return '💰';
      case 'Personal': return '👤';
      default: return '🏷️';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200" id="tasks-module-workspace">
      {/* Page Header */}
      <div className="bg-white p-5 rounded-2xl border border-gray-150 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="p-2.5 rounded-xl bg-green-50 text-[#092E20]">
            <CheckSquare className="w-5 h-5 text-[#22C55E] stroke-[2.5px]" />
          </span>
          <div>
            <h2 className="text-xl font-bold font-display text-gray-800 tracking-tight">Enterprise Task Management</h2>
            <p className="text-xs text-gray-400 mt-0.5 font-medium">Track calls, quotations, meeting schedules, and automated recuring followups.</p>
          </div>
        </div>

        <button
          onClick={onOpenTaskModal}
          className="py-2.5 px-4 bg-[#092E20] hover:bg-[#0F5132] text-white text-xs font-bold font-display uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 select-none shadow-xs hover:shadow-md"
        >
          <Plus className="w-4 h-4 text-[#22C55E] stroke-[3px]" />
          <span>Add Task</span>
        </button>
      </div>

      {/* FILTER & STATS ROW */}
      <div className="bg-white rounded-2xl border border-gray-150 shadow-xs overflow-hidden">
        {/* Tab filters */}
        <div className="flex border-b border-gray-100 overflow-x-auto select-none scrollbar-none bg-gray-50/50">
          {[
            { id: 'all', label: 'All Pending' },
            { id: 'today', label: 'Today' },
            { id: 'tomorrow', label: 'Tomorrow' },
            { id: 'week', label: 'This Week' },
            { id: 'overdue', label: '⚠️ Overdue' },
            { id: 'completed', label: '✅ Completed' },
          ].map(tab => {
            const active = activeFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id as any)}
                className={`py-3 px-5 text-xs font-bold border-b-2 tracking-wide whitespace-nowrap transition-all cursor-pointer select-none ${
                  active 
                    ? 'border-[#22C55E] text-[#092E20] bg-white font-black' 
                    : 'border-transparent text-gray-500 hover:text-gray-750 hover:bg-gray-100/30'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Dropdown filters stripe */}
        <div className="p-4 flex flex-wrap gap-4 items-center bg-white">
          <div className="flex items-center gap-1.5 text-xs text-gray-400 font-bold uppercase tracking-wider mr-2">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Advanced Filters</span>
          </div>

          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="bg-gray-50 border border-gray-200 text-xs font-semibold text-gray-700 rounded-lg py-1.5 px-3 outline-hidden cursor-pointer hover:border-gray-300"
          >
            <option value="all">Category: All</option>
            <option value="Call">📞 Call</option>
            <option value="Follow-up">🔄 Follow-up</option>
            <option value="Quotation">📄 Quotation</option>
            <option value="Meeting">🤝 Meeting</option>
            <option value="Purchase">🛒 Purchase</option>
            <option value="Payment Collection">💰 Payment Collection</option>
            <option value="Personal">👤 Personal</option>
            <option value="Other">🏷️ Other</option>
          </select>

          <select
            value={priorityFilter}
            onChange={e => setPriorityFilter(e.target.value)}
            className="bg-gray-50 border border-gray-200 text-xs font-semibold text-gray-700 rounded-lg py-1.5 px-3 outline-hidden cursor-pointer hover:border-gray-300"
          >
            <option value="all">Urgency: All</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
        </div>
      </div>

      {/* TASK LIST IN CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" id="tasks-grid-workspace">
        {filteredTasks.map(task => {
          const matchedLead = leads.find(l => l.id === task.leadId);
          const daysOverdue = getDaysOverdue(task.dueDate, todayStr);
          const isOverdue = task.dueDate < todayStr && task.status !== 'Completed';

          return (
            <div
              key={task.id}
              className={`bg-white p-5 rounded-2xl border transition-all relative flex flex-col justify-between hover:shadow-md ${
                isOverdue 
                  ? 'border-red-200 bg-red-50/10' 
                  : 'border-gray-200'
              }`}
            >
              <div className="space-y-3.5">
                {/* Header indicators */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs bg-gray-100 py-1 px-2 rounded-lg font-bold border border-gray-150 flex items-center gap-1">
                      <span>{getCategoryIcon(task.category)}</span>
                      <span className="text-gray-600 block">{task.category || 'Other'}</span>
                    </span>

                    {task.recurring && task.recurring !== 'none' && (
                      <span className="text-[10px] bg-indigo-50 border border-indigo-150 text-indigo-700 py-1 px-2 rounded-lg font-black uppercase flex items-center gap-1">
                        <Repeat className="w-3 h-3 animate-spin duration-1000" />
                        <span>Recurring {task.recurring}</span>
                      </span>
                    )}
                  </div>

                  <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase border leading-none ${getPriorityBadge(task.priority)}`}>
                    {task.priority} Priority
                  </span>
                </div>

                {/* Checkbox & Task Title row */}
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => {
                      const nextStatus = task.status === 'Completed' ? 'Pending' : 'Completed';
                      onUpdateTaskStatus(task.id, nextStatus, task);
                    }}
                    className={`shrink-0 w-6 h-6 rounded-md border flex items-center justify-center transition-all cursor-pointer ${
                      task.status === 'Completed'
                        ? 'bg-[#22C55E] border-[#22C55E] text-white shadow-xs'
                        : 'border-gray-300 hover:border-[#22C55E] bg-gray-50'
                    }`}
                    aria-label={task.status === 'Completed' ? "Mark pending" : "Mark completed"}
                  >
                    {task.status === 'Completed' && <Check className="w-4 h-4 stroke-[3px]" />}
                  </button>

                  <div className="min-w-0 flex-1">
                    <h4 className={`font-bold text-sm tracking-tight text-gray-800 break-words leading-snug ${
                      task.status === 'Completed' ? 'line-through text-gray-400' : ''
                    }`}>
                      {task.title}
                    </h4>
                    {task.description && (
                      <p className="text-xs text-gray-500 leading-relaxed font-sans mt-1 max-w-full break-words">
                        {task.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Overdue alert */}
                {isOverdue && (
                  <div className="p-2 bg-red-50 border border-red-150 rounded-lg text-red-700 text-xs font-semibold flex items-center gap-1.5 animate-pulse mt-1">
                    <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                    <span>⚠️ Overdue by {daysOverdue} {daysOverdue === 1 ? 'day' : 'days'}</span>
                  </div>
                )}

                {/* Customer Link tag */}
                {matchedLead && (
                  <div className="p-2.5 bg-gray-50 border border-gray-150 rounded-xl flex items-center justify-between gap-2 mt-2">
                    <div className="min-w-0">
                      <span className="text-[9px] text-gray-400 font-bold uppercase block leading-none">Linked Customer</span>
                      <span className="text-xs font-semibold text-gray-800 truncate block mt-0.5">{matchedLead.companyName}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Lower dynamic status controllers */}
              <div className="mt-5 pt-3.5 border-t border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[10px] text-gray-400 font-bold uppercase">
                  <Calendar className="w-3.5 h-3.5 text-gray-300" />
                  <span>Due: {task.dueDate} {task.dueTime && `@ ${task.dueTime}`}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  {task.status === 'Pending' && (
                    <button
                      onClick={() => onUpdateTaskStatus(task.id, 'In Progress')}
                      className="py-1 px-2.5 text-[10px] bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white rounded-lg border border-blue-200 font-bold transition-all cursor-pointer"
                    >
                      Start Work
                    </button>
                  )}

                  {task.status === 'In Progress' && (
                    <span className="text-[10px] text-blue-700 font-bold uppercase flex items-center gap-1">
                      <Hourglass className="w-3 h-3 animate-spin" />
                      <span>In Progress</span>
                    </span>
                  )}

                  <button
                    onClick={() => onDeleteTask(task.id)}
                    className="p-1.5 text-red-450 hover:text-white bg-red-50 hover:bg-red-500 border border-red-100 rounded-lg transition-all cursor-pointer"
                    title="Delete task log"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => onEditTask(task)}
                    className="p-1.5 text-gray-500 hover:text-white bg-gray-50 hover:bg-gray-500 border border-gray-150 rounded-lg transition-all cursor-pointer"
                    title="Edit task details"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {filteredTasks.length === 0 && (
          <div className="col-span-full py-20 text-center text-gray-400 border-2 border-dashed border-gray-200 rounded-3xl bg-white select-none">
            <CheckSquare className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-bold uppercase tracking-wider text-gray-500">No tasks mapped matching filters</p>
            <p className="text-xs text-gray-400 mt-1">Excellent job! Keep scheduling task checkpoints.</p>
          </div>
        )}
      </div>

      {/* Dedicated Completed Task Section (when not already on the completed tab) */}
      {activeFilter !== 'completed' && tasks.some(t => t.status === 'Completed') && (
        <div className="mt-8 pt-6 border-t border-gray-200" id="completed-tasks-section">
          <div className="flex items-center gap-2 mb-4">
            <CheckSquare className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wider font-display">Completed Tasks</h3>
            <span className="bg-emerald-50 text-emerald-700 text-xs py-0.5 px-2 rounded-full font-bold border border-emerald-100">
              {tasks.filter(t => t.status === 'Completed').length}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 opacity-80">
            {tasks.filter(t => t.status === 'Completed').map(task => {
              return (
                <div key={task.id} className="bg-gray-50/50 p-5 rounded-2xl border border-gray-200 relative flex flex-col justify-between hover:bg-white transition-all">
                  <div className="space-y-3.5">
                    <div className="flex items-center justify-between gap-1 flex-wrap">
                      <span className="text-xs bg-white py-1 px-2 rounded-lg font-bold border border-gray-150 flex items-center gap-1">
                        <span>{getCategoryIcon(task.category)}</span>
                        <span className="text-gray-500">{task.category || 'Other'}</span>
                      </span>
                      <span className="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase text-gray-500 bg-gray-100 border border-gray-200 leading-none">
                        Completed
                      </span>
                    </div>

                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => onUpdateTaskStatus(task.id, 'Pending', task)}
                        className="shrink-0 w-6 h-6 rounded-md border flex items-center justify-center transition-all bg-[#22C55E] border-[#22C55E] text-white shadow-xs cursor-pointer"
                        aria-label="Mark pending"
                      >
                        <Check className="w-4 h-4 stroke-[3px]" />
                      </button>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-sm tracking-tight text-gray-400 break-words line-through leading-snug">
                          {task.title}
                        </h4>
                        {task.description && (
                          <p className="text-xs text-gray-400 leading-relaxed font-sans mt-1 max-w-full break-words line-through">
                            {task.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 pt-3.5 border-t border-gray-150 flex items-center justify-between text-xs text-gray-400">
                    <span className="text-[10px] font-bold text-gray-400">Completed: {task.dueDate}</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => onEditTask(task)}
                        className="p-1.5 text-gray-500 hover:text-white bg-white hover:bg-gray-500 border border-gray-200 rounded-lg transition-all cursor-pointer"
                        title="Edit task details"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => onDeleteTask(task.id)}
                        className="p-1.5 text-red-450 hover:text-white bg-red-50 hover:bg-red-500 border border-red-100 rounded-lg transition-all cursor-pointer"
                        title="Delete task log"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
