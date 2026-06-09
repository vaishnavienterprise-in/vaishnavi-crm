/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import React, { useState, useEffect } from 'react';
import { CRMTask, Lead } from '@/lib/types';
import { X, Calendar, Clock, AlertTriangle, Layers, Repeat, CheckCircle } from 'lucide-react';
import { getTodayDateString } from '@/lib/date-utils';

interface TaskFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  leads: Lead[];
  onCreateTask: (taskData: Partial<CRMTask>) => Promise<void>;
  onUpdateTask?: (taskId: string, taskData: Partial<CRMTask>) => Promise<void>;
  task?: CRMTask | null;
}

export default function TaskFormModal({
  isOpen,
  onClose,
  leads,
  onCreateTask,
  onUpdateTask,
  task = null,
}: TaskFormModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const todayStr = getTodayDateString();
  const [dueDate, setDueDate] = useState(todayStr);
  const [dueTime, setDueTime] = useState('09:00');
  const [priority, setPriority] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [category, setCategory] = useState<'Call' | 'Follow-up' | 'Quotation' | 'Meeting' | 'Purchase' | 'Payment Collection' | 'Personal' | 'Other'>('Call');
  const [recurring, setRecurring] = useState<'none' | 'daily' | 'weekly' | 'monthly'>('none');
  const [leadId, setLeadId] = useState('');
  const [saving, setSaving] = useState(false);

  // Reset fields when opening or switching tasks
  useEffect(() => {
    if (isOpen) {
      if (task) {
        setTitle(task.title || '');
        setDescription(task.description || '');
        setDueDate(task.dueDate || getTodayDateString());
        setDueTime(task.dueTime || '09:00');
        setPriority(task.priority || 'Medium');
        setCategory(task.category || 'Call');
        setRecurring(task.recurring || 'none');
        setLeadId(task.leadId || '');
      } else {
        setTitle('');
        setDescription('');
        setDueDate(getTodayDateString());
        setDueTime('09:00');
        setPriority('Medium');
        setCategory('Call');
        setRecurring('none');
        setLeadId('');
      }
    }
  }, [isOpen, task]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !dueDate) {
      alert('Task Title and Due Date are required.');
      return;
    }

    setSaving(true);
    try {
      const taskData: Partial<CRMTask> = {
        title: title.trim(),
        description: description.trim(),
        dueDate,
        priority,
        category,
        recurring,
      };

      if (dueTime) {
        taskData.dueTime = dueTime;
      }
      if (leadId) {
        taskData.leadId = leadId;
      }

      if (task && onUpdateTask) {
        await onUpdateTask(task.id, taskData);
      } else {
        await onCreateTask({
          ...taskData,
          status: 'Pending',
        });
      }
      onClose();
    } catch (err) {
      console.error('Error saving task:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-xs overflow-y-auto" id="task-create-modal-overlay">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-gray-150 flex flex-col my-8 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-gray-50/75 rounded-t-2xl">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-green-50 text-[#092E20] rounded-xl self-center">
              <CheckCircle className="w-5 h-5 text-[#22C55E]" />
            </span>
            <div>
              <h3 className="font-bold text-base text-gray-800 tracking-tight">{task ? 'Edit CRM Task' : 'Create Mandatory Task'}</h3>
              <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold mt-0.5">VAISHNAVI ENTERPRISE WORKFLOW</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-150 text-gray-400 hover:text-gray-600 rounded-lg transition-all"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 flex-1 overflow-y-auto">
          {/* Title */}
          <div>
            <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-1">Task Title <span className="text-red-500">*</span></label>
            <input
              type="text"
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Call ABC Pharma / Send samples"
              className="w-full bg-gray-50 border border-gray-250 focus:border-[#22C55E] focus:ring-1 focus:ring-[#22C55E] rounded-xl py-2.5 px-3 text-xs outline-hidden font-medium"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-1">Task Description / Details</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              placeholder="Provide context, rate discussion limits, label sizes, quantity lists..."
              className="w-full bg-gray-50 border border-gray-250 focus:border-[#22C55E] focus:ring-1 focus:ring-[#22C55E] rounded-xl py-2.5 px-3 text-xs outline-hidden resize-none font-sans leading-relaxed"
            />
          </div>

          {/* Date & Time Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                <span>Due Date <span className="text-red-500">*</span></span>
              </label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full bg-gray-50 border border-gray-250 focus:border-[#22C55E] focus:ring-1 focus:ring-[#22C55E] rounded-xl py-2.5 px-3 text-xs outline-hidden font-medium cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-gray-400" />
                <span>Due Time</span>
              </label>
              <input
                type="time"
                value={dueTime}
                onChange={e => setDueTime(e.target.value)}
                className="w-full bg-gray-50 border border-gray-250 focus:border-[#22C55E] focus:ring-1 focus:ring-[#22C55E] rounded-xl py-2.5 px-3 text-xs outline-hidden font-medium cursor-pointer"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Category */}
            <div>
              <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-gray-400" />
                <span>Task Category</span>
              </label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value as any)}
                className="w-full bg-gray-50 border border-gray-250 focus:border-[#22C55E] focus:ring-1 focus:ring-[#22C55E] rounded-xl py-2.5 px-3 text-xs outline-hidden font-medium cursor-pointer"
              >
                <option value="Call">📞 Call</option>
                <option value="Follow-up">🔄 Follow-up</option>
                <option value="Quotation">📄 Quotation</option>
                <option value="Meeting">🤝 Meeting</option>
                <option value="Purchase">🛒 Purchase</option>
                <option value="Payment Collection">💰 Payment Collection</option>
                <option value="Personal">👤 Personal</option>
                <option value="Other">🏷️ Other</option>
              </select>
            </div>

            {/* Recurring Option */}
            <div>
              <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Repeat className="w-3.5 h-3.5 text-gray-400" />
                <span>Recurring Task</span>
              </label>
              <select
                value={recurring}
                onChange={e => setRecurring(e.target.value as any)}
                className="w-full bg-gray-50 border border-gray-250 focus:border-[#22C55E] focus:ring-1 focus:ring-[#22C55E] rounded-xl py-2.5 px-3 text-xs outline-hidden font-medium cursor-pointer"
              >
                <option value="none">One-time Task</option>
                <option value="daily">🔁 Daily</option>
                <option value="weekly">🔁 Weekly</option>
                <option value="monthly">🔁 Monthly</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Priority */}
            <div>
              <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-gray-400" />
                <span>Urgency Priority</span>
              </label>
              <div className="flex gap-1.5 mt-0.5">
                {(['Low', 'Medium', 'High'] as const).map(p => {
                  const active = priority === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPriority(p)}
                      className={`flex-1 py-1 px-2.5 rounded-lg border text-center text-xs font-semibold cursor-pointer transition-all ${
                        active
                          ? p === 'High'
                            ? 'bg-red-50 text-red-650 border-red-250 ring-1 ring-red-200'
                            : p === 'Medium'
                            ? 'bg-amber-50 text-amber-700 border-amber-250 ring-1 ring-amber-200'
                            : 'bg-green-50 text-green-800 border-green-250 ring-1 ring-green-200'
                          : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Linked Sales Lead */}
            <div>
              <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-1">Link to Lead (Optional)</label>
              <select
                value={leadId}
                onChange={e => setLeadId(e.target.value)}
                className="w-full bg-gray-50 border border-gray-250 focus:border-[#22C55E] focus:ring-1 focus:ring-[#22C55E] rounded-xl py-2.5 px-3 text-xs outline-hidden font-medium cursor-pointer"
              >
                <option value="">No Direct Link</option>
                {leads.map(l => (
                   <option key={l.id} value={l.id}>
                    {l.companyName} ({l.customerName})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Buttons Footer */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-4 text-xs font-semibold text-gray-500 bg-gray-100 hover:bg-gray-150 rounded-xl cursor-pointer select-none"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="py-2.5 px-6 text-xs font-bold text-white bg-[#092E20] hover:bg-[#0F5132] rounded-xl cursor-pointer disabled:opacity-50 select-none shadow-sm hover:shadow-md transition-all flex items-center justify-center"
            >
              {saving ? 'Saving...' : task ? 'Update Task Record' : 'Save Task Record'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
