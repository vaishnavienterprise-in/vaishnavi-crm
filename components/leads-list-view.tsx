'use client';

import React, { useState, useMemo } from 'react';
import { Lead, LeadStatus, LeadPriority } from '@/lib/types';
import {
  Search,
  Filter,
  Grid,
  Kanban,
  Plus,
  Phone,
  Mail,
  MapPin,
  Flame,
  ArrowRight,
  ArrowLeft,
  ChevronDown,
  Trash2,
  ExternalLink,
} from 'lucide-react';

interface LeadsListViewProps {
  leads: Lead[];
  onSelectLead: (lead: Lead) => void;
  onOpenAddLeadModal: () => void;
  onUpdateLeadStatus: (leadId: string, newStatus: LeadStatus) => Promise<void>;
  onDeleteLead: (leadId: string) => Promise<void>;
  onQuickCall?: (lead: Lead) => Promise<void>;
}

const PIPELINE_STAGES: LeadStatus[] = [
  'New Lead',
  'Contacted',
  'Quotation Sent',
  'Follow Up',
  'Negotiation',
  'Won',
  'Lost',
];

export default function LeadsListView({
  leads,
  onSelectLead,
  onOpenAddLeadModal,
  onUpdateLeadStatus,
  onDeleteLead,
  onQuickCall,
}: LeadsListViewProps) {
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDayTab, setSelectedDayTab] = useState<string>('All');
  
  // Advanced filters
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterSource, setFilterSource] = useState<string>('all');

  // Search and Advanced Filters Calculation
  const filteredLeads = useMemo(() => {
    return leads.filter(l => {
      // 0. Day assignment tab filter
      if (selectedDayTab !== 'All') {
        const leadDay = l.dayAssignment || 'Monday';
        if (leadDay !== selectedDayTab) {
          return false;
        }
      }

      // 1. Search Query
      const q = searchQuery.toLowerCase();
      const matchSearch =
        !q ||
        l.customerName.toLowerCase().includes(q) ||
        l.companyName.toLowerCase().includes(q) ||
        l.phone.toLowerCase().includes(q) ||
        l.email.toLowerCase().includes(q) ||
        l.city.toLowerCase().includes(q) ||
        l.industry.toLowerCase().includes(q) ||
        l.requirement?.toLowerCase().includes(q);

      // 2. Status match
      const matchStatus = filterStatus === 'all' || l.status === filterStatus;

      // 3. Priority match
      const matchPriority = filterPriority === 'all' || l.priority === filterPriority;

      // 4. Source match
      const matchSource = filterSource === 'all' || l.leadSource === filterSource;

      return matchSearch && matchStatus && matchPriority && matchSource;
    });
  }, [leads, searchQuery, selectedDayTab, filterStatus, filterPriority, filterSource]);

  const handleMoveStage = async (e: React.MouseEvent, leadId: string, currentStatus: LeadStatus, direction: 'forward' | 'backward') => {
    e.stopPropagation();
    const currentIndex = PIPELINE_STAGES.indexOf(currentStatus);
    let targetIndex = currentIndex;
    
    if (direction === 'forward' && currentIndex < PIPELINE_STAGES.length - 1) {
      targetIndex++;
    } else if (direction === 'backward' && currentIndex > 0) {
      targetIndex--;
    }

    if (targetIndex !== currentIndex) {
      await onUpdateLeadStatus(leadId, PIPELINE_STAGES[targetIndex]);
    }
  };

  const handleQuickCallDial = (e: React.MouseEvent, lead: Lead) => {
    e.stopPropagation();
    if (!lead.phone) return;
    const cleanNum = lead.phone.replace(/[^0-9+]/g, '');
    window.open(`tel:${cleanNum}`, '_blank');
    if (onQuickCall) {
      onQuickCall(lead);
    }
  };

  const getPriorityColor = (p: LeadPriority) => {
    switch (p) {
      case 'Hot':
        return 'bg-red-50 text-red-700 border-red-100';
      case 'Warm':
        return 'bg-amber-50 text-amber-700 border-amber-100';
      case 'Cold':
        return 'bg-blue-50 text-blue-700 border-blue-100';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-100';
    }
  };

  // Group leads for Kanban Board Columns
  const leadsByStage = useMemo(() => {
    const stages: { [key in LeadStatus]: Lead[] } = {
      'New Lead': [],
      "Today's Calls": [],
      'Called Today': [],
      'Follow-up Pending': [],
      'Quotation Sent': [],
      'Won': [],
      'Lost': [],
      'Contacted': [],
      'Follow Up': [],
      'Negotiation': [],
    };
    filteredLeads.forEach(lead => {
      if (stages[lead.status]) {
        stages[lead.status].push(lead);
      }
    });
    return stages;
  }, [filteredLeads]);

  return (
    <div className="space-y-6" id="leads-manager-view">
      {/* Search and Filters Strip */}
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <span className="p-2 rounded-xl bg-green-50 text-[#092E20]">
              <Filter className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-xl font-bold font-display text-gray-800">Sales Leadhub & Funnel CRM</h2>
              <p className="text-xs text-gray-400 mt-0.5">Filter, monitor pipelines and trigger outbound followups instantly.</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full md:w-auto shrink-0">
            {/* View selectors */}
            <div className="bg-gray-100 p-1.5 rounded-xl flex items-center gap-1.5 border border-gray-200">
              <button
                onClick={() => setViewMode('board')}
                className={`p-2 rounded-lg transition-colors cursor-pointer ${
                  viewMode === 'board' ? 'bg-[#092E20] text-white' : 'text-gray-500 hover:bg-gray-200'
                }`}
                title="Funnel Pipeline Board"
                id="btn-view-board"
              >
                <Kanban className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg transition-colors cursor-pointer ${
                  viewMode === 'list' ? 'bg-[#092E20] text-white' : 'text-gray-500 hover:bg-gray-200'
                }`}
                title="Details Data Sheet"
                id="btn-view-list"
              >
                <Grid className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={onOpenAddLeadModal}
              className="py-3 px-5 bg-[#092E20] hover:bg-[#0F5132] active:bg-black text-white hover:shadow-md active:scale-95 text-xs font-bold font-display uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center gap-2 select-none"
              id="btn-register-lead"
            >
              <Plus className="w-4 h-4 text-[#22C55E] stroke-[3px]" />
              <span>Register Lead</span>
            </button>
          </div>
        </div>

        {/* Weekday Assignment Filter Tabs */}
        <div className="border-t border-gray-100 pt-4 pb-1">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-2 px-0.5">Filter Leads by Day Allocation</span>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scroll-smooth">
            {[
              { label: 'All Leads', value: 'All' },
              { label: 'Monday', value: 'Monday' },
              { label: 'Tuesday', value: 'Tuesday' },
              { label: 'Wednesday', value: 'Wednesday' },
              { label: 'Thursday', value: 'Thursday' },
              { label: 'Friday', value: 'Friday' },
              { label: 'Saturday Follow-ups', value: 'Saturday Follow-up' },
            ].map(tab => {
              const active = selectedDayTab === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setSelectedDayTab(tab.value)}
                  className={`px-3.5 py-2 text-xs font-bold rounded-lg whitespace-nowrap transition-all border cursor-pointer select-none ${
                    active
                      ? 'bg-[#092E20] text-white border-[#092E20] shadow-sm'
                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                  }`}
                  id={`tab-${tab.value.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Filters Matrix */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-gray-100">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search by customer, phone, city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 focus:border-[#092E20] focus:ring-1 focus:ring-[#092E20] rounded-lg py-2.5 pl-9 pr-3 text-xs outline-hidden"
              id="leads-search-input"
            />
          </div>

          <div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 focus:border-[#092E20] focus:ring-1 focus:ring-[#092E20] rounded-lg py-2.5 px-3 text-xs outline-hidden cursor-pointer"
            >
              <option value="all">Pipeline Stage: All</option>
              {PIPELINE_STAGES.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 focus:border-[#092E20] focus:ring-1 focus:ring-[#092E20] rounded-lg py-2.5 px-3 text-xs outline-hidden cursor-pointer"
            >
              <option value="all">Priority: All</option>
              <option value="Hot">Hot (Urgent Call)</option>
              <option value="Warm">Warm (Within 2 Days)</option>
              <option value="Cold">Cold</option>
            </select>
          </div>

          <div>
            <select
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 focus:border-[#092E20] focus:ring-1 focus:ring-[#092E20] rounded-lg py-2.5 px-3 text-xs outline-hidden cursor-pointer"
            >
              <option value="all">Lead Source: All</option>
              {['Google', 'Website', 'WhatsApp', 'IndiaMART', 'TradeIndia', 'Referral', 'Existing Customer', 'Direct Call'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Mobile Card-Based List View (No horizontal scrolling, highly optimized for touch devices) */}
      <div className="md:hidden space-y-4" id="mobile-leads-cards-container">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Filtered Leads ({filteredLeads.length})</span>
          <span className="text-[10px] text-gray-400 font-bold">Tap to open files</span>
        </div>
        <div className="grid grid-cols-1 gap-3">
          {filteredLeads.map(l => (
            <div
              key={l.id}
              onClick={() => onSelectLead(l)}
              className="bg-white p-4 rounded-2xl border border-gray-150 hover:border-[#092E20] shadow-xs active:scale-[0.99] transition-all cursor-pointer flex flex-col justify-between space-y-3 relative"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1 min-w-0 flex-1">
                  <h4 className="font-bold text-sm tracking-tight text-gray-800 break-words leading-snug">
                    {l.customerName}
                  </h4>
                  <p className="text-xs text-gray-500 font-semibold truncate leading-none">
                    {l.companyName}
                  </p>
                  {l.city && (
                    <p className="text-[10.5px] text-gray-400 font-medium flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3.5 h-3.5 text-gray-300" />
                      <span>{l.city} {l.state ? `, ${l.state}` : ''}</span>
                    </p>
                  )}
                </div>
                
                {/* Quick Call Button */}
                {l.phone && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleQuickCallDial(e, l);
                    }}
                    className="p-1.5 text-emerald-600 hover:text-white bg-emerald-50 hover:bg-emerald-600 border border-emerald-100 rounded-lg transition-all active:scale-95 cursor-pointer shrink-0 flex items-center justify-center mr-1"
                    title="Quick Call Dialer"
                    id={`btn-quick-call-mobile-${l.id}`}
                  >
                    <Phone className="w-3.5 h-3.5 stroke-[2.5px] animate-pulse" />
                  </button>
                )}

                {/* Delete button inline on card corner */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm('Are you sure you want to delete this lead historical record?')) {
                      onDeleteLead(l.id);
                    }
                  }}
                  className="p-1.5 text-red-500 hover:text-white bg-red-50 hover:bg-red-500 border border-red-105 rounded-lg transition-colors cursor-pointer shrink-0"
                  title="Remove lead"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Tags Section */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${getPriorityColor(l.priority)}`}>
                  Priority: {l.priority}
                </span>
                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-green-50 border border-green-150 text-[#092E20]">
                  Status: {l.status}
                </span>
                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-gray-50 border border-gray-250 text-gray-500">
                  Day: {l.dayAssignment || 'Monday'}
                </span>
                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-blue-50 border border-blue-250 text-blue-800">
                  Source: {l.leadSource}
                </span>
              </div>

              {/* Call Stats Section */}
              <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400 gap-2">
                <div className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-gray-300" />
                  <span>Calls: <strong className="text-gray-700 font-bold">{l.callCount || 0}</strong></span>
                </div>
                <div>
                  <span>Last Call: <strong className="text-gray-700 font-bold">{l.lastCallDate || 'Never'}</strong></span>
                </div>
              </div>
            </div>
          ))}
          {filteredLeads.length === 0 && (
            <div className="py-12 text-center text-gray-400 text-sm border-2 border-dashed border-gray-150 rounded-2xl bg-white select-none">
              No matching leads found for active criteria.
            </div>
          )}
        </div>
      </div>

      {/* Desktop Board/List View Toggle (Hidden on Mobile) */}
      <div className="hidden md:block">
        {viewMode === 'board' ? (
          /* KANBAN BOARD FUNNEL VIEW */
          <div className="overflow-x-auto pb-4 gap-4 flex items-start select-none" id="kanban-funnel-pipeline">
            {PIPELINE_STAGES.map(stage => {
              const stageLeads = leadsByStage[stage] || [];
              return (
                <div
                  key={stage}
                  className="w-[280px] shrink-0 bg-gray-100 rounded-2xl p-4 border border-gray-200"
                >
                  {/* Stage title */}
                  <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-200">
                    <h3 className="font-bold text-xs text-gray-700 tracking-wide">{stage}</h3>
                    <span className="bg-white/80 border border-gray-200 text-gray-500 font-bold px-2 py-0.5 rounded-full text-[10px]">
                      {stageLeads.length}
                    </span>
                  </div>

                  {/* Cards List */}
                  <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                    {stageLeads.map(l => (
                      <div
                        key={l.id}
                        onClick={() => onSelectLead(l)}
                        className="bg-white p-4 rounded-xl shadow-xs border border-gray-200/60 hover:shadow-md transition-shadow cursor-pointer space-y-3 relative group"
                      >
                        {/* Customer & Company names */}
                        <div className="space-y-0.5 min-w-0">
                          <h4 className="font-bold text-xs text-gray-800 tracking-tight leading-snug hover:text-[#092E20] truncate">
                            {l.customerName}
                          </h4>
                          <p className="text-[10px] text-gray-500 font-semibold truncate">{l.companyName}</p>
                        </div>

                        {/* Info lines */}
                        <div className="space-y-1 text-[10px] text-gray-400 font-medium">
                          {l.city && (
                            <div className="flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-gray-300" />
                              <span className="truncate">{l.city} ({l.state || 'IN'})</span>
                            </div>
                          )}
                          <span className="inline-block px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded text-[9px] font-semibold mt-0.5">
                            {l.leadSource}
                          </span>
                        </div>

                        {/* Lower Strip */}
                        <div className="flex items-center justify-between border-t border-gray-100 pt-3">
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold border ${getPriorityColor(l.priority)}`}>
                            {l.priority}
                          </span>

                          {/* Shift buttons for ease of touch pipeline move in columns */}
                          <div className="flex items-center gap-1.5">
                            {l.phone && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleQuickCallDial(e, l);
                                }}
                                className="p-1 rounded-sm bg-emerald-50 hover:bg-emerald-600 text-emerald-600 hover:text-white border border-emerald-100 active:scale-90 transition-all cursor-pointer flex items-center justify-center mr-0.5"
                                title="Quick Call Dialer"
                                id={`btn-quick-call-kanban-${l.id}`}
                              >
                                <Phone className="w-3 h-3 stroke-[2.5px]" />
                              </button>
                            )}
                            <button
                              onClick={(e) => handleMoveStage(e, l.id, l.status, 'backward')}
                              className="p-1 rounded-sm bg-gray-50 hover:bg-gray-100 text-gray-500 active:scale-90 transition-transform cursor-pointer"
                              title="Move back"
                            >
                              <ArrowLeft className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => handleMoveStage(e, l.id, l.status, 'forward')}
                              className="p-1 rounded-sm bg-gray-50 hover:bg-gray-100 text-gray-500 active:scale-90 transition-transform cursor-pointer"
                              title="Move next"
                            >
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {stageLeads.length === 0 && (
                      <div className="py-12 text-center text-gray-300 text-xs border border-dashed border-gray-300 rounded-xl">
                        Empty Segment
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* DATAGRID LIST VIEW */
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs" id="leads-datagrid-container">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-[#092E20] text-white">
                  <tr>
                    <th className="p-4 uppercase tracking-wider font-bold">Client / Company</th>
                    <th className="p-4 uppercase tracking-wider font-bold">Location</th>
                    <th className="p-4 uppercase tracking-wider font-bold">Industry</th>
                    <th className="p-4 uppercase tracking-wider font-bold">Source</th>
                    <th className="p-4 uppercase tracking-wider font-bold">Pipeline Stage</th>
                    <th className="p-4 uppercase tracking-wider font-bold">Priority</th>
                    <th className="p-4 uppercase tracking-wider font-bold">Next Action</th>
                    <th className="p-4 uppercase tracking-wider font-bold text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-150">
                  {filteredLeads.map(l => (
                    <tr
                      key={l.id}
                      onClick={() => onSelectLead(l)}
                      className="hover:bg-green-50/10 cursor-pointer transition-colors"
                    >
                      <td className="p-4">
                        <div className="space-y-0.5">
                          <p className="font-bold text-gray-800 text-sm">{l.customerName}</p>
                          <p className="text-gray-400 leading-snug">{l.companyName}</p>
                        </div>
                      </td>
                      <td className="p-4">
                        <p className="font-semibold text-gray-700">{l.city || '-'}</p>
                        <p className="text-gray-400">{l.state || '-'}</p>
                      </td>
                      <td className="p-4 font-medium text-gray-650">{l.industry || '-'}</td>
                      <td className="p-4 font-mono text-[10px] text-gray-400">{l.leadSource}</td>
                      <td className="p-4">
                        <span className="inline-block px-2.5 py-1 text-[10px] font-bold rounded-full bg-green-50 text-[#092E20] border border-green-150">
                          {l.status}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`inline-block px-2.5 py-1 text-[10px] font-bold rounded border ${getPriorityColor(l.priority)}`}>
                          {l.priority}
                        </span>
                      </td>
                      <td className="p-4">
                        <p className="font-bold text-gray-700">{l.nextAction}</p>
                        <p className="text-[10px] text-gray-400 font-mono">{l.nextActionDate}</p>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
                          {l.phone && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleQuickCallDial(e, l);
                              }}
                              className="p-1.5 text-emerald-600 hover:text-white bg-emerald-50 hover:bg-emerald-600 border border-emerald-105 rounded transition-colors cursor-pointer"
                              title="Quick Call Dialer"
                              id={`btn-quick-call-table-${l.id}`}
                            >
                              <Phone className="w-3.5 h-3.5 stroke-[2.2px]" />
                            </button>
                          )}
                          <button
                            onClick={() => onSelectLead(l)}
                            className="p-1.5 text-gray-500 hover:text-[#092E20] bg-gray-100 hover:bg-gray-200 transition-colors rounded cursor-pointer animate-pulse"
                            title="Open Details file"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onDeleteLead(l.id)}
                            className="p-1.5 text-red-500 hover:text-white bg-red-50 hover:bg-red-500 rounded transition-colors cursor-pointer"
                            title="Delete history"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredLeads.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-12 text-center text-gray-400 text-sm">
                        No matching leads found matching filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
