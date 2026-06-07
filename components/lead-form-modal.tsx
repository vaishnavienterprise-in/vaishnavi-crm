'use client';

import React, { useEffect, useState } from 'react';
import { Lead, LeadStatus, LeadPriority, NextActionType } from '@/lib/types';
import { getTodayDateString } from '@/lib/date-utils';
import { X, Check } from 'lucide-react';

interface LeadFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (leadData: Partial<Lead>) => Promise<void>;
  lead?: Lead | null;
}

const BRAND_PRODUCTS = [
  'Chromo Labels',
  'White PP Labels',
  'Silver PP Labels',
  'Barcode Labels',
  'Hologram Labels',
  'Roll Form Labels',
  'Product Labels',
  'Packaging Labels',
];

const LEAD_SOURCES = [
  'Google',
  'Website',
  'WhatsApp',
  'IndiaMART',
  'TradeIndia',
  'Referral',
  'Existing Customer',
  'Direct Call',
  'Exhibition',
  'Other',
];

export default function LeadFormModal({ isOpen, onClose, onSave, lead }: LeadFormModalProps) {
  const [formData, setFormData] = useState<Partial<Lead>>({
    customerName: '',
    companyName: '',
    phone: '',
    whatsapp: '',
    email: '',
    city: '',
    state: '',
    industry: '',
    requirement: '',
    leadSource: 'IndiaMART',
    status: 'New Lead',
    priority: 'Warm',
    assignedDate: getTodayDateString(),
    dayAssignment: 'Monday',
    nextAction: 'Call',
    nextActionDate: getTodayDateString(),
    nextActionTime: '10:00',
  });

  const [saving, setSaving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    setTimeout(() => {
      if (lead) {
        setFormData({
          ...lead,
          dayAssignment: lead.dayAssignment || 'Monday',
        });
      } else {
        setFormData({
          customerName: '',
          companyName: '',
          phone: '',
          whatsapp: '',
          email: '',
          city: '',
          state: '',
          industry: '',
          requirement: '',
          leadSource: 'IndiaMART',
          status: 'New Lead',
          priority: 'Warm',
          assignedDate: getTodayDateString(),
          dayAssignment: 'Monday',
          nextAction: 'Call',
          nextActionDate: getTodayDateString(),
          nextActionTime: '10:00',
        });
      }
    }, 0);
  }, [lead, isOpen]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleProductSelect = (product: string) => {
    const divider = formData.requirement ? ', ' : '';
    if (formData.requirement?.includes(product)) return; // already added

    setFormData(prev => ({
      ...prev,
      requirement: (prev.requirement || '') + divider + product,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customerName || !formData.companyName) {
      setValidationError('Customer Name and Company Name are strictly required.');
      return;
    }
    setSaving(true);
    setValidationError(null);
    try {
      await onSave(formData);
      onClose();
    } catch (err: any) {
      console.error(err);
      setValidationError(err?.message || 'Failed to save lead information. Please review firestore rules.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-[#092E20] text-white p-5 flex items-center justify-between border-b border-[#22C55E]/10">
          <div>
            <h3 className="font-bold font-display text-lg tracking-tight">
              {lead ? 'Modify Sales Lead Profile' : 'Register New Label Lead'}
            </h3>
            <p className="text-xs text-green-200 mt-1 uppercase tracking-wider font-semibold">
              {lead ? `Lead ID: ${lead.id}` : 'Vaishnavi Enterprise CRM pipeline'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 px-3 bg-white/10 hover:bg-white/20 active:bg-black text-white rounded-lg transition-colors cursor-pointer select-none"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {validationError && (
            <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-red-600 rounded-full shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Section A: Company & Domain Details */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-1">
              Company & Requirement Profile
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-650 uppercase mb-1">Customer Name *</label>
                <input
                  type="text"
                  name="customerName"
                  required
                  value={formData.customerName || ''}
                  onChange={handleChange}
                  className="w-full bg-gray-50 border border-gray-200 focus:border-[#092E20] focus:ring-1 focus:ring-[#092E20] rounded-lg py-2 px-3 text-xs outline-hidden"
                  placeholder="e.g. Rajesh Kumar"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-650 uppercase mb-1">Company / Brand Name *</label>
                <input
                  type="text"
                  name="companyName"
                  required
                  value={formData.companyName || ''}
                  onChange={handleChange}
                  className="w-full bg-gray-50 border border-gray-200 focus:border-[#092E20] focus:ring-1 focus:ring-[#092E20] rounded-lg py-2 px-3 text-xs outline-hidden"
                  placeholder="e.g. ABC Pharma Pvt Ltd"
                />
              </div>
            </div>

            {/* Quick Product Tagging */}
            <div>
              <label className="block text-xs font-bold text-gray-650 uppercase mb-1.5">Quick-Tag Label Product</label>
              <div className="flex flex-wrap gap-1.5">
                {BRAND_PRODUCTS.map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handleProductSelect(p)}
                    className="py-1 px-2.5 bg-green-50 text-[#092E20] border border-green-100 hover:bg-green-100/40 text-[10px] font-semibold rounded transition-colors cursor-pointer"
                  >
                    + {p}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-650 uppercase mb-1">Lead Requirement Description</label>
              <textarea
                name="requirement"
                value={formData.requirement || ''}
                onChange={handleChange}
                rows={2}
                className="w-full bg-gray-50 border border-gray-200 focus:border-[#092E20] focus:ring-1 focus:ring-[#092E20] rounded-lg py-2 px-3 text-xs outline-hidden resize-none"
                placeholder="Details of roll dimensions, sheet format, colors, adhesive glue spec or sticker quantities..."
              />
            </div>
          </div>

          {/* Section B: Contact Channels */}
          <div className="space-y-4 pt-1">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-1">
              Contact Channels
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-650 uppercase mb-1">Phone Number</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone || ''}
                  onChange={handleChange}
                  className="w-full bg-gray-50 border border-gray-200 focus:border-[#092E20] focus:ring-1 focus:ring-[#092E20] rounded-lg py-2 px-3 text-xs outline-hidden"
                  placeholder="e.g. +91 98765 43210"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-650 uppercase mb-1">WhatsApp Mobile</label>
                <input
                  type="tel"
                  name="whatsapp"
                  value={formData.whatsapp || ''}
                  onChange={handleChange}
                  className="w-full bg-gray-50 border border-gray-200 focus:border-[#092E20] focus:ring-1 focus:ring-[#092E20] rounded-lg py-2 px-3 text-xs outline-hidden"
                  placeholder="e.g. +91 98765 43210 (For templates)"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-650 uppercase mb-1">Email Address</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email || ''}
                  onChange={handleChange}
                  className="w-full bg-gray-50 border border-gray-200 focus:border-[#092E20] focus:ring-1 focus:ring-[#092E20] rounded-lg py-2 px-3 text-xs outline-hidden"
                  placeholder="e.g. procurement@abcpharma.com"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-gray-650 uppercase mb-1">City</label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city || ''}
                    onChange={handleChange}
                    className="w-full bg-gray-50 border border-gray-200 focus:border-[#092E20] focus:ring-1 focus:ring-[#092E20] rounded-lg py-2 px-3 text-xs outline-hidden"
                    placeholder="Mumbai"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-650 uppercase mb-1">State</label>
                  <input
                    type="text"
                    name="state"
                    value={formData.state || ''}
                    onChange={handleChange}
                    className="w-full bg-gray-50 border border-gray-200 focus:border-[#092E20] focus:ring-1 focus:ring-[#092E20] rounded-lg py-2 px-3 text-xs outline-hidden"
                    placeholder="Maharashtra"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section C: Sales Management & Pipelines */}
          <div className="space-y-4 pt-1">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-1">
              Sales Workflow Metadata
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-650 uppercase mb-1">Lead Source</label>
                <select
                  name="leadSource"
                  value={formData.leadSource || 'IndiaMART'}
                  onChange={handleChange}
                  className="w-full bg-gray-50 border border-gray-200 focus:border-[#092E20] focus:ring-1 focus:ring-[#092E20] rounded-lg py-2 px-3 text-xs outline-hidden cursor-pointer"
                >
                  {LEAD_SOURCES.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-650 uppercase mb-1">Lead Status *</label>
                <select
                  name="status"
                  value={formData.status || 'New Lead'}
                  onChange={handleChange}
                  className="w-full bg-gray-50 border border-gray-200 focus:border-[#092E20] focus:ring-1 focus:ring-[#092E20] rounded-lg py-2 px-3 text-xs outline-hidden cursor-pointer"
                >
                  {['New Lead', 'Contacted', 'Quotation Sent', 'Follow Up', 'Negotiation', 'Won', 'Lost'].map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-650 uppercase mb-1">Priority (Urgency) *</label>
                <select
                  name="priority"
                  value={formData.priority || 'Warm'}
                  onChange={handleChange}
                  className="w-full bg-gray-50 border border-gray-200 focus:border-[#092E20] focus:ring-1 focus:ring-[#092E20] rounded-lg py-2 px-3 text-xs outline-hidden cursor-pointer"
                >
                  {['Hot', 'Warm', 'Cold'].map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-650 uppercase mb-1">Lead Day Assignment *</label>
                <select
                  name="dayAssignment"
                  required
                  value={formData.dayAssignment || 'Monday'}
                  onChange={handleChange}
                  className="w-full bg-gray-50 border border-gray-200 focus:border-[#092E20] focus:ring-1 focus:ring-[#092E20] rounded-lg py-2 px-3 text-xs outline-hidden cursor-pointer font-semibold text-[#092E20]"
                >
                  {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                  {formData.dayAssignment === 'Saturday Follow-up' && (
                    <option value="Saturday Follow-up">Saturday Follow-up</option>
                  )}
                </select>
              </div>
            </div>
          </div>

          {/* Section D: Next Scheduled Action and Reminded Alerts */}
          <div className="space-y-4 pt-1">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-1">
              Next Action Reminder & Targets
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-green-50/20 p-4 border border-green-100/50 rounded-xl">
              <div>
                <label className="block text-xs font-bold text-gray-650 uppercase mb-1 text-[#092E20]">Next Action Type</label>
                <select
                  name="nextAction"
                  value={formData.nextAction || 'Call'}
                  onChange={handleChange}
                  className="w-full bg-white border border-gray-200 focus:border-[#092E20] focus:ring-1 focus:ring-[#092E20] rounded-lg py-2 px-3 text-xs outline-hidden cursor-pointer"
                >
                  {['Call', 'WhatsApp', 'Email', 'Quotation', 'Follow Up', 'Meeting'].map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-650 uppercase mb-1 text-[#092E20]">Scheduled Date</label>
                <input
                  type="date"
                  name="nextActionDate"
                  value={formData.nextActionDate || ''}
                  onChange={handleChange}
                  className="w-full bg-white border border-gray-200 focus:border-[#092E20] focus:ring-1 focus:ring-[#092E20] rounded-lg py-2 px-3 text-xs outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-650 uppercase mb-1 text-[#092E20]">Scheduled Time</label>
                <input
                  type="time"
                  name="nextActionTime"
                  value={formData.nextActionTime || ''}
                  onChange={handleChange}
                  className="w-full bg-white border border-gray-200 focus:border-[#092E20] focus:ring-1 focus:ring-[#092E20] rounded-lg py-2 px-3 text-xs outline-hidden"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-650 uppercase mb-1">Industry Vertical</label>
                <input
                  type="text"
                  name="industry"
                  value={formData.industry || ''}
                  onChange={handleChange}
                  className="w-full bg-gray-50 border border-gray-200 focus:border-[#092E20] focus:ring-1 focus:ring-[#092E20] rounded-lg py-2 px-3 text-xs outline-hidden"
                  placeholder="e.g. FMCG, Pharma, Logistics, Cosmetics"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-650 uppercase mb-1">Assigned / Allocation Date</label>
                <input
                  type="date"
                  name="assignedDate"
                  value={formData.assignedDate || ''}
                  onChange={handleChange}
                  className="w-full bg-gray-50 border border-gray-200 focus:border-[#092E20] focus:ring-1 focus:ring-[#092E20] rounded-lg py-2 px-3 text-xs outline-hidden"
                />
              </div>
            </div>
          </div>
        </form>

        {/* Footer actions */}
        <div className="bg-gray-50 border-t border-gray-150 px-6 py-4 flex justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-4 bg-gray-200 hover:bg-gray-300 active:bg-black text-gray-700 hover:text-gray-900 rounded-xl text-xs font-bold transition-all cursor-pointer select-none"
          >
            Cancel
          </button>
          
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="py-2.5 px-5 bg-[#092E20] hover:bg-[#0F5132] active:bg-black text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-md cursor-pointer select-none disabled:opacity-55"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Check className="w-4 h-4 text-[#22C55E]" />
                <span>Save Lead Record</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
