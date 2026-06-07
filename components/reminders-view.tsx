'use client';

import React, { useState } from 'react';
import { CRMReminder, Lead } from '@/lib/types';
import { getTodayDateString } from '@/lib/date-utils';
import { Bell, Clock, Calendar, AlertCircle, Plus, Info, Check, Trash2, Link2 } from 'lucide-react';

interface RemindersViewProps {
  reminders: CRMReminder[];
  leads: Lead[];
  onCreateReminder: (reminderData: Partial<CRMReminder>) => Promise<void>;
  onDeleteReminder: (reminderId: string) => Promise<void>;
}

export default function RemindersView({
  reminders,
  leads,
  onCreateReminder,
  onDeleteReminder,
}: RemindersViewProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(getTodayDateString());
  const [time, setTime] = useState('10:00');
  const [notes, setNotes] = useState('');
  const [leadId, setLeadId] = useState('');
  const [saving, setSaving] = useState(false);

  const today = getTodayDateString();

  // Categorize reminders
  const listOverdue = reminders.filter(r => r.date < today).sort((a,b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  const listToday = reminders.filter(r => r.date === today).sort((a,b) => a.time.localeCompare(b.time));
  const listUpcoming = reminders.filter(r => r.date > today).sort((a,b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !date || !time) {
      alert('Title, Date and Time are strictly mandatory.');
      return;
    }
    setSaving(true);
    try {
      await onCreateReminder({
        title,
        date,
        time,
        notes,
        leadId: leadId || undefined,
      });
      setTitle('');
      setDate(getTodayDateString());
      setTime('10:00');
      setNotes('');
      setLeadId('');
      setShowAddForm(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const ReminderCard = ({ element }: { element: CRMReminder }) => {
    const linkedLead = leads.find(l => l.id === element.leadId);
    return (
      <div className="bg-white p-4.5 rounded-xl border border-gray-150 shadow-xs flex items-start justify-between gap-4">
        <div className="space-y-2 min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-mono text-[10px] bg-green-50 text-[#092E20] border border-green-150 font-bold py-0.5 px-2 rounded-full inline-flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              <span>{element.date}</span>
            </span>
            <span className="font-mono text-[10px] bg-gray-100 text-gray-700 border border-gray-200 font-bold py-0.5 px-2 rounded-full inline-flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>{element.time}</span>
            </span>
          </div>

          <div className="space-y-0.5">
            <h4 className="font-bold text-xs text-gray-800 leading-snug break-words">{element.title}</h4>
            {element.notes && (
              <p className="text-[11px] text-gray-500 font-medium font-sans italic mt-1 leading-normal break-words bg-gray-50/50 p-2 rounded-lg border border-dashed border-gray-200">
                &ldquo;{element.notes}&rdquo;
              </p>
            )}
          </div>

          {linkedLead && (
            <div className="inline-flex items-center gap-1 text-[10px] font-bold text-[#092E20]">
              <Link2 className="w-3.5 h-3.5 text-[#22C55E]" />
              <span className="truncate">Bound Lead: {linkedLead.companyName}</span>
            </div>
          )}
        </div>

        <button
          onClick={() => onDeleteReminder(element.id)}
          className="p-1.5 text-gray-400 hover:text-red-600 bg-gray-50 hover:bg-red-50 rounded-lg group transition-colors cursor-pointer select-none"
          title="Dismiss reminder notification"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-6" id="reminders-workspace">
      {/* Header section */}
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="p-2 rounded-xl bg-orange-50 text-orange-600">
            <Bell className="w-5 h-5" />
          </span>
          <div>
            <h2 className="text-xl font-bold font-display text-gray-800">Outreach Reminders</h2>
            <p className="text-xs text-gray-400 mt-0.5">Track critical lead callbacks, sample submissions, and follow-ups timeline.</p>
          </div>
        </div>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="py-2.5 px-4 bg-[#092E20] hover:bg-[#0F5132] text-white text-xs font-bold font-display uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 select-none"
        >
          <Plus className="w-4 h-4 text-[#22C55E] stroke-[3px]" />
          <span>{showAddForm ? 'Close panel' : 'Add Reminder'}</span>
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
          <h3 className="font-bold text-xs text-gray-400 uppercase tracking-widest border-b pb-1.5 mb-2">Configure Reminder Alert</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-650 uppercase mb-1">Reminder Title *</label>
              <input
                type="text"
                required
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Call Amit regarding hologram prototype approve sheet"
                className="w-full bg-gray-50 border border-gray-200 focus:border-[#092E20] focus:ring-1 focus:ring-[#092E20] rounded-lg py-2 px-3 text-xs outline-hidden"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-gray-650 uppercase mb-1">Date *</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 focus:border-[#092E20] focus:ring-1 focus:ring-[#092E20] rounded-lg py-2 px-3 text-xs outline-hidden"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-650 uppercase mb-1">Time *</label>
                <input
                  type="time"
                  required
                  value={time}
                  onChange={e => setTime(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 focus:border-[#092E20] focus:ring-1 focus:ring-[#092E20] rounded-lg py-2 px-3 text-xs outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-650 uppercase mb-1">Bind to Sales Lead (Optional)</label>
              <select
                value={leadId}
                onChange={e => setLeadId(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 focus:border-[#092E20] focus:ring-1 focus:ring-[#092E20] rounded-lg py-2 px-3 text-xs outline-hidden cursor-pointer"
              >
                <option value="">-- No Direct Link --</option>
                {leads.map(l => (
                  <option key={l.id} value={l.id}>
                    {l.companyName} ({l.customerName})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[#092E20] text-xs font-bold uppercase mb-1">Discussion Brief / Notes</label>
              <input
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Remarks, callback phone, labels spec numbers..."
                className="w-full bg-gray-50 border border-gray-200 focus:border-[#092E20] focus:ring-1 focus:ring-[#092E20] rounded-lg py-2 px-3 text-xs outline-hidden"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="py-2 px-4 text-xs font-semibold bg-gray-100 hover:bg-gray-200 rounded-lg cursor-pointer"
            >
              Discard
            </button>
            <button
              type="submit"
              disabled={saving}
              className="py-2 px-5 text-xs font-bold text-white bg-[#092E20] hover:bg-[#0F5132] rounded-lg cursor-pointer disabled:opacity-50"
            >
              {saving ? 'Creating...' : 'Trigger Reminder Alert'}
            </button>
          </div>
        </form>
      )}

      {/* Structured Status Categorization lists */}
      <div className="space-y-6">
        
        {/* OVERDUE ALERTS SECTION */}
        {listOverdue.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-red-600 rounded-full animate-ping shrink-0" />
              <h3 className="font-bold text-xs text-red-650 uppercase tracking-widest leading-none">⚠️ OVERDUE REMINDERS ({listOverdue.length})</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 border-2 border-dashed border-red-100 p-4 rounded-2xl bg-red-50/20">
              {listOverdue.map(r => (
                <ReminderCard key={r.id} element={r} />
              ))}
            </div>
          </div>
        )}

        {/* TODAY'S TARGET ALERTS */}
        <div className="space-y-3">
          <h3 className="font-bold text-xs text-[#092E20] uppercase tracking-widest">⚡ Today&apos;s Outreach Reminders</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {listToday.map(r => (
              <ReminderCard key={r.id} element={r} />
            ))}
            {listToday.length === 0 && (
              <div className="col-span-full py-8 text-center text-gray-400 bg-white border border-gray-200 rounded-2xl text-xs font-medium uppercase tracking-wider">
                🎉 No active callbacks scheduled for today.
              </div>
            )}
          </div>
        </div>

        {/* UPCOMING REMINDERS */}
        <div className="space-y-3">
          <h3 className="font-bold text-xs text-gray-400 uppercase tracking-widest">📅 Upcoming Call Schedule</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {listUpcoming.map(r => (
              <ReminderCard key={r.id} element={r} />
            ))}
            {listUpcoming.length === 0 && (
              <div className="col-span-full py-8 text-center text-gray-400 bg-white border border-gray-250 rounded-2xl text-xs font-medium uppercase tracking-wider">
                No future outreach events. Maintain schedules to grow sales pipeline.
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
