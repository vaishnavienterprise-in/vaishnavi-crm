'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Lead, Note, FollowUp, LeadStatus, LeadPriority } from '@/lib/types';
import { useAuth } from './firebase-provider';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  updateDoc,
  doc,
} from 'firebase/firestore';
import {
  X,
  Phone,
  MessageSquare,
  Mail,
  FileText,
  Clock,
  Plus,
  Send,
  Calendar,
  AlertCircle,
  Hash,
  Activity,
  HeartHandshake,
} from 'lucide-react';

interface LeadDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: Lead | null;
  onUpdateLead: (leadId: string, updatedData: Partial<Lead>) => Promise<void>;
}

// Templates configuration
const WHATSAPP_TEMPLATE_1 = (customerName: string) =>
  `Hello ${customerName || 'Sir/Madam'},

Thank you for contacting Vaishnavi Enterprise.

We manufacture premium self-adhesive labels including barcode labels, hologram labels, chromo labels and PP labels.

Please share your requirements and quantity so we can provide the best quotation.

Regards,
Vaishnavi Enterprise`;

const WHATSAPP_TEMPLATE_2 = (customerName: string) =>
  `Hello ${customerName || 'Sir/Madam'},

Just following up regarding your label requirement.

Please let us know if you need any assistance or quotation.

Regards,
Vaishnavi Enterprise`;

const PROFILE_PDF_URL = 'https://vaishnavienterprise.in/company-profile.pdf';

export default function LeadDetailModal({ isOpen, onClose, lead, onUpdateLead }: LeadDetailModalProps) {
  const { user } = useAuth();
  
  // Real-time states for subcollections
  const [notes, setNotes] = useState<Note[]>([]);
  const [followups, setFollowups] = useState<FollowUp[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<'notes' | 'followups' | 'history'>('notes');

  // New item forms
  const [newNoteText, setNewNoteText] = useState('');
  const [newFollowup, setNewFollowup] = useState({
    date: new Date().toISOString().split('T')[0],
    time: '12:00',
    priority: 'Warm' as LeadPriority,
    notes: '',
    actionType: 'Call' as any,
  });

  const [submitting, setSubmitting] = useState(false);

  // Sync subcollections in real-time when lead ID changes
  useEffect(() => {
    if (!lead || !isOpen) return;

    // 1. Subscribe to Notes subcollection
    const notesRef = collection(db, 'leads', lead.id, 'notes');
    const notesQuery = query(notesRef, orderBy('createdAt', 'desc'));
    const unsubscribeNotes = onSnapshot(
      notesQuery,
      (snapshot) => {
        const loadedNotes: Note[] = [];
        snapshot.forEach((docSnap) => {
          loadedNotes.push({ id: docSnap.id, ...docSnap.data() } as Note);
        });
        setNotes(loadedNotes);
      },
      (err) => {
        console.error('Notes snapshot error', err);
      }
    );

    // 2. Subscribe to Followups subcollection
    const followupsRef = collection(db, 'leads', lead.id, 'followups');
    const followupsQuery = query(followupsRef, orderBy('createdAt', 'desc'));
    const unsubscribeFollowups = onSnapshot(
      followupsQuery,
      (snapshot) => {
        const loadedFollowups: FollowUp[] = [];
        snapshot.forEach((docSnap) => {
          loadedFollowups.push({ id: docSnap.id, ...docSnap.data() } as FollowUp);
        });
        setFollowups(loadedFollowups);
      },
      (err) => {
        console.error('Followups snapshot error', err);
      }
    );

    return () => {
      unsubscribeNotes();
      unsubscribeFollowups();
    };
  }, [lead, isOpen]);

  // Format phone number to clean string for dial / wa.me link
  const cleanPhone = useMemo(() => {
    if (!lead) return '';
    return lead.phone ? lead.phone.replace(/[^0-9+]/g, '') : '';
  }, [lead]);

  const cleanWhatsapp = useMemo(() => {
    if (!lead) return '';
    const wa = lead.whatsapp || lead.phone;
    return wa ? wa.replace(/[^0-9+]/g, '') : '';
  }, [lead]);

  if (!isOpen || !lead) return null;

  // Calling Widget: triggers dialer & logs calling count and notes in Firestore
  const handleCallDial = async () => {
    if (!lead.phone) return;
    
    // Open dialer
    window.open(`tel:${cleanPhone}`, '_blank');

    // Persist log call count locally in lead
    const currentCount = lead.callCount || 0;
    try {
      await onUpdateLead(lead.id, {
        callCount: currentCount + 1,
        lastCalledAt: serverTimestamp(),
      });

      // Add a note automatically logging the call action
      const notesRef = collection(db, 'leads', lead.id, 'notes');
      await addDoc(notesRef, {
        leadId: lead.id,
        date: new Date().toISOString().split('T')[0],
        time: new Date().toTimeString().slice(0, 5),
        note: `📞 Call attempted. Incrementing call count to ${currentCount + 1}.`,
        user: user?.displayName || user?.email || 'Authorized CRM User',
        createdAt: serverTimestamp(),
        ownerId: user?.uid,
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `leads/${lead.id}`);
    }
  };

  // WhatsApp Widget with templates
  const handleSendWhatsApp = async (templateId: 1 | 2) => {
    const waNumber = cleanWhatsapp;
    if (!waNumber) return;

    let textToSend = templateId === 1 
      ? WHATSAPP_TEMPLATE_1(lead.customerName) 
      : WHATSAPP_TEMPLATE_2(lead.customerName);

    // Open WhatsApp Web Link
    window.open(`https://wa.me/${waNumber}?text=${encodeURIComponent(textToSend)}`, '_blank');

    // Update lead metadata
    try {
      await onUpdateLead(lead.id, {
        lastWhatsAppSentAt: serverTimestamp(),
      });

      // Log to notes
      const notesRef = collection(db, 'leads', lead.id, 'notes');
      await addDoc(notesRef, {
        leadId: lead.id,
        date: new Date().toISOString().split('T')[0],
        time: new Date().toTimeString().slice(0, 5),
        note: `💬 Outbound WhatsApp sent (Template ${templateId}).`,
        user: user?.displayName || user?.email || 'Authorized CRM User',
        createdAt: serverTimestamp(),
        ownerId: user?.uid,
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `leads/${lead.id}`);
    }
  };

  // One-click corporate email template
  const handleSendEmail = async () => {
    if (!lead.email) return;

    const subject = encodeURIComponent('Label Manufacturing Inquiry - Vaishnavi Enterprise');
    const body = encodeURIComponent(`Dear ${lead.customerName || 'Sir/Madam'},

Thank you for your adhesive label requirement.

We have received your request and are compiling pricing worksheets for your requirement: "${lead.requirement}".

Please feel free to reply with size charts, roll form factors, or quantities.

Regards,
Sales Desk [Vaishnavi Enterprise]
+91 98765 43210`);

    window.open(`mailto:${lead.email}?subject=${subject}&body=${body}`, '_blank');

    try {
      await onUpdateLead(lead.id, {
        lastEmailSentAt: serverTimestamp(),
      });

      const notesRef = collection(db, 'leads', lead.id, 'notes');
      await addDoc(notesRef, {
        leadId: lead.id,
        date: new Date().toISOString().split('T')[0],
        time: new Date().toTimeString().slice(0, 5),
        note: `✉️ Outbound corporate email initialized.`,
        user: user?.displayName || user?.email || 'Authorized CRM User',
        createdAt: serverTimestamp(),
        ownerId: user?.uid,
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `leads/${lead.id}`);
    }
  };

  // Send Company Profile PDF (WhatsApp / Email logger)
  const handleSendProfile = async (method: 'WhatsApp' | 'Email') => {
    if (method === 'WhatsApp') {
      const waNumber = cleanWhatsapp;
      if (!waNumber) return;
      const text = `Hello ${lead.customerName || 'Sir/Madam'}, Please find attached the corporate business profile of Vaishnavi Enterprise labels & solutions:\n\n${PROFILE_PDF_URL}`;
      window.open(`https://wa.me/${waNumber}?text=${encodeURIComponent(text)}`, '_blank');
    } else {
      if (!lead.email) return;
      const subject = encodeURIComponent('Vaishnavi Enterprise - Corporate Profile Brochure');
      const body = encodeURIComponent(`Dear ${lead.customerName || 'Sir/Madam'},\n\nWe would love to share our manufacturing profile with your procurement cell. Please find our pdf link sheet below:\n\n${PROFILE_PDF_URL}\n\nRegards,\nVaishnavi Enterprise`);
      window.open(`mailto:${lead.email}?subject=${subject}&body=${body}`, '_blank');
    }

    try {
      await onUpdateLead(lead.id, {
        profileSentAt: serverTimestamp(),
        profileSentMethod: method,
      });

      const notesRef = collection(db, 'leads', lead.id, 'notes');
      await addDoc(notesRef, {
        leadId: lead.id,
        date: new Date().toISOString().split('T')[0],
        time: new Date().toTimeString().slice(0, 5),
        note: `📁 Shared Company Profile catalog via ${method}.`,
        user: user?.displayName || user?.email || 'Authorized CRM User',
        createdAt: serverTimestamp(),
        ownerId: user?.uid,
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `leads/${lead.id}`);
    }
  };

  // Save regular text note
  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim()) return;

    setSubmitting(true);
    try {
      const notesRef = collection(db, 'leads', lead.id, 'notes');
      await addDoc(notesRef, {
        leadId: lead.id,
        date: new Date().toISOString().split('T')[0],
        time: new Date().toTimeString().slice(0, 5),
        note: newNoteText.trim(),
        user: user?.displayName || user?.email || 'Authorized CRM User',
        createdAt: serverTimestamp(),
        ownerId: user?.uid,
      });
      setNewNoteText('');
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  // Save followup schedule reminder
  const handleSaveFollowup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const followupsRef = collection(db, 'leads', lead.id, 'followups');
      await addDoc(followupsRef, {
        ...newFollowup,
        leadId: lead.id,
        createdAt: serverTimestamp(),
        ownerId: user?.uid,
      });

      // Also set lead's Next Action automatic fields to build worklists
      await onUpdateLead(lead.id, {
        nextAction: newFollowup.actionType,
        nextActionDate: newFollowup.date,
        nextActionTime: newFollowup.time,
        priority: newFollowup.priority, // update lead priority as well
      });

      setNewFollowup({
        date: new Date().toISOString().split('T')[0],
        time: '12:00',
        priority: 'Warm',
        notes: '',
        actionType: 'Call',
      });
      
      // Auto toggle to notes
      setActiveSubTab('notes');
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-[#092E20] text-white p-5 flex items-center justify-between border-b border-[#22C55E]/10 select-none">
          <div>
            <h3 className="font-bold font-display text-lg tracking-tight truncate max-w-[400px]">
              {lead.customerName}
            </h3>
            <p className="text-xs text-green-200 mt-1 uppercase tracking-wider font-semibold">
              {lead.companyName} &bull; {lead.city || 'India'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 px-3 bg-white/10 hover:bg-white/20 active:bg-black text-white rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Workspace Panels split */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-gray-150">
          
          {/* Left panel (6 columns): CRM Lead Card & Direct Actions */}
          <div className="md:col-span-5 p-6 bg-gray-50/50 space-y-6">
            
            {/* Status overview */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[10px] text-gray-400 uppercase font-bold">Pipeline Status</span>
                <p className="text-sm font-bold text-[#092E20] mt-0.5">{lead.status}</p>
              </div>
              <span className={`text-[10px] uppercase font-bold py-1 px-2 rounded-full border ${
                lead.priority === 'Hot' ? 'bg-red-100 border-red-200 text-red-800' : 'bg-gray-100 text-gray-700 border-gray-200'
              }`}>
                Priority: {lead.priority}
              </span>
            </div>

            {/* Direct Interaction Center */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Outbound Interaction Center</h4>
              
              <div className="grid grid-cols-2 gap-2">
                {/* One click dialer */}
                <button
                  onClick={handleCallDial}
                  disabled={!lead.phone}
                  className="py-3 px-4 bg-[#092E20] hover:bg-[#0F5132] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-transform active:scale-95 cursor-pointer disabled:opacity-40"
                >
                  <Phone className="w-4 h-4 text-[#22C55E]" />
                  <span>Dial Call ({lead.callCount || 0})</span>
                </button>

                {/* Email template */}
                <button
                  onClick={handleSendEmail}
                  disabled={!lead.email}
                  className="py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 hover:text-black rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-transform active:scale-95 cursor-pointer disabled:opacity-40"
                >
                  <Mail className="w-4 h-4 text-purple-600" />
                  <span>Draft Email</span>
                </button>
              </div>

              {/* Move to Saturday Follow-up Action */}
              <button
                onClick={async () => {
                  try {
                    await onUpdateLead(lead.id, { dayAssignment: 'Saturday Follow-up' });
                    // Add automatic progress note log
                    const notesRef = collection(db, 'leads', lead.id, 'notes');
                    await addDoc(notesRef, {
                      leadId: lead.id,
                      date: new Date().toISOString().split('T')[0],
                      time: new Date().toTimeString().slice(0, 5),
                      note: '📅 Moved lead to "Saturday Follow-ups" list for weekend sales planning.',
                      user: user?.displayName || user?.email || 'Authorized CRM User',
                      createdAt: serverTimestamp(),
                      ownerId: user?.uid,
                    });
                    alert('Lead successfully moved to Saturday Follow-ups!');
                  } catch (e) {
                    console.error('Error shifting day to Saturday followups', e);
                  }
                }}
                className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-transform active:scale-95 cursor-pointer shadow-xs"
              >
                <Calendar className="w-4 h-4 text-white" />
                <span>Move to Saturday Follow-up</span>
              </button>

              {/* Dynamic template whatsapp senders */}
              <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase block">Outbound WhatsApp Templates</span>
                <div className="grid grid-cols-1 gap-2">
                  <button
                    onClick={() => handleSendWhatsApp(1)}
                    disabled={!lead.whatsapp && !lead.phone}
                    className="w-full text-left p-2.5 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg text-xs font-semibold text-[#092E20] transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-40"
                  >
                    <MessageSquare className="w-4 h-4 shrink-0 text-[#22C55E]" />
                    <span className="truncate">T1: Introduction Pitch Brochure</span>
                  </button>
                  <button
                    onClick={() => handleSendWhatsApp(2)}
                    disabled={!lead.whatsapp && !lead.phone}
                    className="w-full text-left p-2.5 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg text-xs font-semibold text-[#092E20] transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-40"
                  >
                    <MessageSquare className="w-4 h-4 shrink-0 text-[#22C55E]" />
                    <span className="truncate">T2: Standard Follow-Up Check</span>
                  </button>
                </div>
              </div>

              {/* Company Profile PDF Brochure Share */}
              <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase block">Send Catalog / Company Profile</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleSendProfile('WhatsApp')}
                    className="p-2 bg-gray-100 hover:bg-green-100 border border-gray-200 font-bold text-[10px] text-gray-700 rounded-lg cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-[#22C55E]" />
                    <span>via WhatsApp</span>
                  </button>
                  <button
                    onClick={() => handleSendProfile('Email')}
                    className="p-2 bg-gray-100 hover:bg-purple-100 border border-gray-200 font-bold text-[10px] text-gray-700 rounded-lg cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Mail className="w-3.5 h-3.5 text-purple-600" />
                    <span>via Email</span>
                  </button>
                </div>
                {lead.profileSentAt && (
                  <span className="text-[9px] text-gray-400 block mt-1 font-mono">
                    Sent method: {lead.profileSentMethod} on {lead.profileSentAt.seconds ? new Date(lead.profileSentAt.seconds * 1000).toLocaleDateString('en-IN') : String(lead.profileSentAt)}
                  </span>
                )}
              </div>
            </div>

            {/* Structured Specifications Info */}
            <div className="bg-white p-4.5 rounded-xl border border-gray-200 shadow-xs space-y-3">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Lead Specifications</span>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-gray-400 block text-[10px]">City / State</span>
                  <p className="font-semibold text-gray-800">{lead.city || '-'} ({lead.state || 'IN'})</p>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px]">Industry Vertical</span>
                  <p className="font-semibold text-gray-800">{lead.industry || '-'}</p>
                </div>
                <div>
                  <span className="text-gray-405 block text-[10px]">Registered Source</span>
                  <p className="font-mono font-semibold text-gray-800">{lead.leadSource || '-'}</p>
                </div>
                <div>
                  <span className="text-gray-405 block text-[10px]">Assigned Date</span>
                  <p className="font-semibold text-[#092E20]">{lead.assignedDate || '-'}</p>
                </div>
                <div>
                  <span className="text-gray-405 block text-[10px]">Assigned Day</span>
                  <p className="font-semibold text-amber-600 uppercase tracking-wider">{lead.dayAssignment || 'Monday'}</p>
                </div>
                <div>
                  <span className="text-gray-450 block text-[10px]">Status</span>
                  <p className="font-semibold text-green-700">{lead.status || '-'}</p>
                </div>
              </div>

              {lead.requirement && (
                <div className="border-t border-gray-100 pt-2.5">
                  <span className="text-gray-404 block text-[10px]">Manufacturing Requirement</span>
                  <p className="text-xs text-gray-700 leading-relaxed font-mono mt-0.5 whitespace-pre-wrap selection:bg-green-100">
                    {lead.requirement}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right panel (7 columns): Subcollections timeline notes, reminders */}
          <div className="md:col-span-7 p-6 flex flex-col h-full min-h-[400px]">
            
            {/* Nav tabs inside workspace */}
            <div className="flex border-b border-gray-250 mb-4 select-none">
              <button
                onClick={() => setActiveSubTab('notes')}
                className={`py-2 px-4 text-xs font-bold border-b-2 cursor-pointer transition-all ${
                  activeSubTab === 'notes' ? 'border-[#092E20] text-[#092E20]' : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                Progress Timeline ({notes.length})
              </button>
              <button
                onClick={() => setActiveSubTab('followups')}
                className={`py-2 px-4 text-xs font-bold border-b-2 cursor-pointer transition-all ${
                  activeSubTab === 'followups' ? 'border-[#092E20] text-[#092E20]' : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                Reminders & Follow Ups ({followups.length})
              </button>
            </div>

            {/* Active Sub Tab contents */}
            {activeSubTab === 'notes' ? (
              // PROGRESS TIMELINE TAB
              <div className="flex-1 flex flex-col h-full justify-between gap-4">
                
                {/* Note creation Input */}
                <form onSubmit={handleSaveNote} className="flex gap-2 shrink-0">
                  <input
                    type="text"
                    value={newNoteText}
                    onChange={(e) => setNewNoteText(e.target.value)}
                    placeholder="Enter activity log or comment text..."
                    className="flex-1 bg-gray-50 border border-gray-200 focus:border-[#092E20] focus:ring-1 focus:ring-[#092E20] rounded-xl py-2 px-3.5 text-xs outline-hidden"
                  />
                  <button
                    type="submit"
                    disabled={submitting || !newNoteText.trim()}
                    className="p-2.5 bg-[#092E20] hover:bg-[#0F5132] text-white rounded-xl transition-all cursor-pointer disabled:opacity-40"
                  >
                    <Send className="w-4 h-4 text-white" />
                  </button>
                </form>

                {/* Timeline display */}
                <div className="flex-1 overflow-y-auto space-y-4 max-h-[35vh] pr-1">
                  {notes.map(n => (
                    <div key={n.id} className="p-3 bg-gray-50 rounded-xl relative border border-gray-150">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-[10px] text-[#092E20]">{n.user}</span>
                        <div className="flex items-center gap-1 text-[10px] text-gray-400">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{n.date} &bull; {n.time}</span>
                        </div>
                      </div>
                      <p className="text-xs text-gray-700 mt-1.5 leading-relaxed whitespace-pre-wrap">{n.note}</p>
                    </div>
                  ))}
                  {notes.length === 0 && (
                    <div className="py-12 text-center text-gray-350 text-xs">
                      No progressive timeline logs captured. Add notes above to track deal updates.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              // REMINDERS & FOLLOW UPS SUBCOLLECTION
              <div className="flex-1 flex flex-col h-full justify-between gap-4">
                
                {/* Followup scheduler */}
                <form onSubmit={handleSaveFollowup} className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3 shrink-0">
                  <div className="flex items-center gap-1 pb-1.5 border-b border-gray-200">
                    <Calendar className="w-4 h-4 text-[#092E20]" />
                    <span className="text-xs font-bold text-gray-700">Schedule Outbound Follow-Up Reminder</span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-0.5">Date</label>
                      <input
                        type="date"
                        required
                        value={newFollowup.date}
                        className="w-full bg-white border border-gray-200 rounded p-1.5 text-xs outline-hidden"
                        onChange={(e) => setNewFollowup(prev => ({ ...prev, date: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-0.5">Time</label>
                      <input
                        type="time"
                        required
                        value={newFollowup.time}
                        className="w-full bg-white border border-gray-200 rounded p-1.5 text-xs outline-hidden"
                        onChange={(e) => setNewFollowup(prev => ({ ...prev, time: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-0.5">Priority</label>
                      <select
                        value={newFollowup.priority}
                        className="w-full bg-white border border-gray-200 rounded p-1.5 text-xs outline-hidden cursor-pointer"
                        onChange={(e) => setNewFollowup(prev => ({ ...prev, priority: e.target.value as any }))}
                      >
                        <option value="Hot">Hot</option>
                        <option value="Warm">Warm</option>
                        <option value="Cold">Cold</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-0.5">Action</label>
                      <select
                        value={newFollowup.actionType}
                        className="w-full bg-white border border-gray-200 rounded p-1.5 text-xs outline-hidden cursor-pointer"
                        onChange={(e) => setNewFollowup(prev => ({ ...prev, actionType: e.target.value as any }))}
                      >
                        <option value="Call">Call</option>
                        <option value="WhatsApp">WhatsApp</option>
                        <option value="Email">Email</option>
                        <option value="Meeting">Meeting</option>
                        <option value="Quotation">Quotation</option>
                        <option value="Reminder">Reminder</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <input
                      type="text"
                      required
                      placeholder="Enter description agenda (e.g., Send updated silver PP label quote)..."
                      className="w-full bg-white border border-gray-200 rounded p-2 text-xs outline-hidden"
                      value={newFollowup.notes}
                      onChange={(e) => setNewFollowup(prev => ({ ...prev, notes: e.target.value }))}
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={submitting || !newFollowup.notes.trim()}
                      className="py-1.5 px-4 bg-[#092E20] hover:bg-[#0F5132] text-white rounded text-xs font-bold cursor-pointer select-none disabled:opacity-40 flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5 text-[#22C55E]" />
                      <span>Attach Schedule</span>
                    </button>
                  </div>
                </form>

                {/* Followups List */}
                <div className="flex-1 overflow-y-auto space-y-3 max-h-[25vh] pr-1">
                  {followups.map(f => (
                    <div key={f.id} className="p-3 bg-white border border-gray-200/60 rounded-xl shadow-xs text-xs space-y-2 flex justify-between items-start">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-[#092E20] uppercase bg-green-50 px-1.5 py-0.5 rounded text-[9.5px]">
                            {f.actionType}
                          </span>
                          <span className="text-[10px] text-gray-400 font-semibold">{f.date} &bull; {f.time}</span>
                        </div>
                        <p className="text-gray-700 leading-relaxed">{f.notes}</p>
                      </div>
                      <span className={`text-[9px] uppercase px-1.5 font-bold rounded ${
                        f.priority === 'Hot' ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {f.priority}
                      </span>
                    </div>
                  ))}
                  {followups.length === 0 && (
                    <div className="py-12 text-center text-gray-350 text-xs">
                      No automated reminder checkpoints scheduled. Set reminders above.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
