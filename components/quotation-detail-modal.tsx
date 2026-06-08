'use client';

import React, { useMemo } from 'react';
import { Quotation, QuotationProduct } from '@/lib/types';
import {
  X,
  FileText,
  Download,
  Edit,
  Trash2,
  Briefcase,
  Layers,
  Percent,
  MessageSquare,
  Building2,
  Calendar,
  IndianRupee,
} from 'lucide-react';

interface QuotationDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  quotation: Quotation | null;
  onDownloadPDF?: (q: Quotation) => void;
  onEdit?: (q: Quotation) => void;
  onDelete?: (id: string) => Promise<void>;
}

const formatCurrency = (val: number, decimals: number = 2) => {
  return 'Rs. ' + Number(val).toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

const getProductsForQuotation = (q: Quotation): QuotationProduct[] => {
  if (q.products && q.products.length > 0) {
    return q.products;
  }
  
  // Backwards compatibility for previous custom `items` format
  if ((q as any).items && (q as any).items.length > 0) {
    return (q as any).items.map((it: any) => ({
      labelName: it.labelName || '',
      materialType: it.material || 'Chromo',
      size: it.size || '-',
      quantity: Number(it.quantity || 0),
      rate: Number(it.rate || 0),
      amount: Number(it.amount || 0)
    }));
  }
  
  // Legacy fallback
  return [
    {
      labelName: q.product || 'Premium Custom Labels',
      materialType: 'Chromo',
      size: q.size || '-',
      quantity: Number(q.quantity || 0),
      rate: Number(q.rate || 0),
      amount: q.subtotal || (q.total ? Number((q.total / (1 + (q.gst || 18) / 100)).toFixed(2)) : 0)
    }
  ];
};

export default function QuotationDetailModal({
  isOpen,
  onClose,
  quotation,
  onDownloadPDF,
  onEdit,
  onDelete,
}: QuotationDetailModalProps) {
  
  const products = useMemo(() => {
    if (!quotation) return [];
    return getProductsForQuotation(quotation);
  }, [quotation]);

  const formattedDate = useMemo(() => {
    if (!quotation || !quotation.createdAt) return '-';
    try {
      const qca = quotation.createdAt as any;
      if (qca && typeof qca.toDate === 'function') {
        return qca.toDate().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      } else if (qca && qca.seconds) {
        return new Date(qca.seconds * 1000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      } else {
        return new Date(qca).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      }
    } catch (e) {
      return '-';
    }
  }, [quotation]);

  const subTotal = useMemo(() => {
    if (!quotation) return 0;
    if (quotation.subtotal) return quotation.subtotal;
    return products.reduce((sum, item) => sum + (item.amount || 0), 0);
  }, [quotation, products]);

  const gstAmount = useMemo(() => {
    if (!quotation) return 0;
    const ratePercent = quotation.gst !== undefined ? quotation.gst : 18;
    return Number(((subTotal * ratePercent) / 100).toFixed(2));
  }, [subTotal, quotation]);

  const grandTotal = useMemo(() => {
    if (!quotation) return 0;
    if (quotation.grandTotal) return quotation.grandTotal;
    if (quotation.total) return quotation.total;
    return Number((subTotal + gstAmount).toFixed(2));
  }, [subTotal, gstAmount, quotation]);

  if (!isOpen || !quotation) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100 flex flex-col max-h-[90vh]" id="quotation-detail-card">
        
        {/* Header banner */}
        <div className="bg-[#092E20] text-white p-5 flex items-center justify-between border-b border-[#22C55E]/10 select-none">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-white/10 rounded-xl text-[#22C55E]">
              <FileText className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-bold font-display text-base tracking-tight">
                Quotation Detail: {quotation.quotationNumber || `VE-DRAFT`}
              </h3>
              <p className="text-xs text-green-200 mt-0.5">
                Saved on {formattedDate}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 px-3 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content body split */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Quick interactive action bar */}
          <div className="bg-gray-50 p-4 border border-gray-200 rounded-xl flex items-center justify-between gap-4 flex-wrap">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">Estimated Client Value</span>
              <p className="text-lg font-bold font-mono text-emerald-800">{formatCurrency(grandTotal, 2)}</p>
            </div>

            <div className="flex items-center gap-2">
              {onDownloadPDF && (
                <button
                  onClick={() => onDownloadPDF(quotation)}
                  className="py-2 px-4 bg-emerald-900 hover:bg-emerald-950 text-white hover:shadow-xs transition-all text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-4 h-4 text-[#22C55E] stroke-[2.5px]" />
                  <span>Download PDF Corporate</span>
                </button>
              )}
              
              {onEdit && (
                <button
                  onClick={() => {
                    onEdit(quotation);
                    onClose();
                  }}
                  className="py-2 px-3 border border-gray-250 hover:bg-gray-100 text-gray-700 transition-all text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer"
                >
                  <Edit className="w-4 h-4 text-amber-600" />
                  <span>Edit Quotation</span>
                </button>
              )}

              {onDelete && (
                <button
                  onClick={async () => {
                    if (window.confirm('Are you sure you want to permanently delete this quotation blueprint?')) {
                      await onDelete(quotation.id);
                      onClose();
                    }
                  }}
                  className="py-2 px-3 border border-red-200 text-red-650 hover:bg-red-50 hover:text-red-700 transition-all text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete</span>
                </button>
              )}
            </div>
          </div>

          {/* Client profile summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-1">
            <div className="space-y-3.5">
              <span className="text-[10px] font-extrabold text-[#092E20] uppercase tracking-wider block border-b border-gray-100 pb-1">Client Contact Details</span>
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-gray-400" />
                  <div>
                    <span className="text-[9px] text-gray-405 block font-bold leading-none uppercase">Company Name</span>
                    <span className="font-bold text-gray-800">{quotation.companyName || '-'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-[#22C55E]" />
                  <div>
                    <span className="text-[9px] text-gray-405 block font-bold leading-none uppercase">Primary Decision Maker</span>
                    <span className="font-semibold text-gray-700">{quotation.customerName || '-'}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3.5">
              <span className="text-[10px] font-extrabold text-[#092E20] uppercase tracking-wider block border-b border-gray-100 pb-1">Proposal Information</span>
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <div>
                    <span className="text-[9px] text-gray-450 block font-bold leading-none uppercase">Quotation Date</span>
                    <span className="font-medium text-gray-700">{formattedDate}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-indigo-500" />
                  <div>
                    <span className="text-[9px] text-gray-450 block font-bold leading-none uppercase">Proposal Subject / Notes</span>
                    <span className="font-medium text-gray-700">{quotation.subject || 'Sales Pitch Material'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Products Table Display */}
          <div className="space-y-2">
            <span className="text-[10px] font-extrabold text-[#092E20] uppercase tracking-wider block border-b border-gray-100 pb-1">Manufacturing Specifications</span>
            <div className="border border-gray-200 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50 text-gray-600 font-bold border-b border-gray-200">
                    <th className="p-3">Label Product / Material</th>
                    <th className="p-3">Dimensions / Core Size</th>
                    <th className="p-3 text-right">Order Quantity</th>
                    <th className="p-3 text-right">Rate / Piece</th>
                    <th className="p-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {products.map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                      <td className="p-3">
                        <p className="font-bold text-gray-800">{item.labelName || 'Premium Labels'}</p>
                        <p className="text-[10px] text-[#092E20] font-semibold bg-green-50 px-1 py-0.2 rounded inline-block mt-0.5">{item.materialType || 'Chromo'}</p>
                      </td>
                      <td className="p-3 font-mono text-gray-600">
                        {item.size || '-'}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-gray-700">
                        {Number(item.quantity || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="p-3 text-right font-mono text-gray-600">
                        {formatCurrency(item.rate, 4)}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-800">
                        {formatCurrency(item.amount, 2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals summary segment */}
              <div className="bg-gray-50/70 p-4 border-t border-gray-200 text-xs flex flex-col items-end space-y-2">
                <div className="flex justify-between w-64 text-gray-500 font-medium">
                  <span>Subtotal Amount:</span>
                  <span className="font-mono text-gray-700 font-bold">{formatCurrency(subTotal)}</span>
                </div>
                <div className="flex justify-between w-64 text-gray-500 font-medium">
                  <span>GST Taxes ({quotation.gst !== undefined ? quotation.gst : 18}%):</span>
                  <span className="font-mono text-gray-700 font-bold">{formatCurrency(gstAmount)}</span>
                </div>
                <div className="flex justify-between w-64 border-t border-gray-200 pt-2 text-[#092E20] font-bold text-sm">
                  <span>GRAND ESTIMATE VALUE:</span>
                  <span className="font-mono text-emerald-800 text-base">{formatCurrency(grandTotal)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Remarks block */}
          {quotation.remarks && (
            <div className="bg-green-50/30 p-4 border border-green-200/55 rounded-xl space-y-1">
              <span className="text-[10px] font-black text-[#092E20] uppercase tracking-wider block">Production Terms & Internal Remarks</span>
              <p className="text-xs text-[#092E20] leading-relaxed whitespace-pre-wrap">{quotation.remarks}</p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
