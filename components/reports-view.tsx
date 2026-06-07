'use client';

import React, { useMemo, useState } from 'react';
import { Lead, Quotation } from '@/lib/types';
import {
  TrendingUp,
  BarChart,
  Calendar,
  Activity,
  PhoneCall,
  FileText,
  BadgeAlert,
  Download,
  Percent,
} from 'lucide-react';

interface ReportsViewProps {
  leads: Lead[];
  quotations: Quotation[];
}

export default function ReportsView({ leads, quotations }: ReportsViewProps) {
  const [reportPeriod, setReportPeriod] = useState<'daily' | 'weekly' | 'monthly'>('weekly');

  const reportData = useMemo(() => {
    // Basic computations
    const totalLeads = leads.length;
    const newLeads = leads.filter(l => l.status === 'New Lead').length;
    const wonLeads = leads.filter(l => l.status === 'Won').length;
    const lostLeads = leads.filter(l => l.status === 'Lost').length;
    
    // Sum call counts across all leads
    const totalCalls = leads.reduce((acc, curr) => acc + (curr.callCount || 0), 0);
    
    // Quotations count
    const totalQuotesCount = quotations.length;
    const totalQuotesSum = quotations.reduce((acc, curr) => acc + (curr.total || 0), 0);

    // Conversion rate: Won / (Won + Lost)
    const pipelineClosed = wonLeads + lostLeads;
    const conversionRate = pipelineClosed > 0 
      ? Math.round((wonLeads / pipelineClosed) * 100) 
      : 0;

    // Sources distribution for an SVG bar chart
    const sourcesMap: { [key: string]: number } = {};
    leads.forEach(l => {
      const src = l.leadSource || 'Other';
      sourcesMap[src] = (sourcesMap[src] || 0) + 1;
    });

    const sourcesChartData = Object.entries(sourcesMap).map(([src, count]) => ({
      source: src,
      count,
    })).sort((a, b) => b.count - a.count);

    return {
      totalLeads,
      newLeads,
      wonLeads,
      lostLeads,
      totalCalls,
      totalQuotesCount,
      totalQuotesSum,
      conversionRate,
      sourcesChartData,
    };
  }, [leads, quotations]);

  // Export entire application DB snapshot in a clean downloadable JSON file
  const handleExportBackup = () => {
    const backupObj = {
      exportedAt: new Date().toISOString(),
      leads: leads,
      quotations: quotations,
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backupObj, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', dataStr);
    dlAnchor.setAttribute('download', `Vaishnavi_Enterprise_CRM_Backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
  };

  return (
    <div className="space-y-8" id="reports-and-analytics-dashboard">
      
      {/* Upper header controls */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="p-2 bg-green-50 text-[#092E20] rounded-xl">
            <TrendingUp className="w-5 h-5 animate-bounce" />
          </span>
          <div>
            <h2 className="text-xl font-bold text-gray-800 font-display">Conversions & Operations Telemetry</h2>
            <p className="text-xs text-gray-400 mt-0.5">Automated analytics parsed securely from lead pipelines and quotation histories.</p>
          </div>
        </div>

        <div className="flex gap-2 shrink-0">
          <button
            onClick={handleExportBackup}
            className="py-2.5 px-4 bg-[#092E20] hover:bg-[#0F5132] active:bg-black text-white hover:shadow-xs active:scale-95 transition-all text-xs font-bold rounded-xl flex items-center gap-2 cursor-pointer select-none"
          >
            <Download className="w-4 h-4 text-[#22C55E]" />
            <span>Download DB Backup (JSON)</span>
          </button>
        </div>
      </div>

      {/* KPI Reports grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Stat card 1: Conversion index */}
        <div className="bg-white p-6 rounded-xl border border-gray-150 flex flex-col justify-between shadow-xs">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Conversion rate</span>
            <span className="p-1.5 rounded bg-green-50 text-green-700">
              <Percent className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-extrabold text-[#092E20] font-mono">{reportData.conversionRate}%</h3>
            <span className="text-[10px] text-gray-500 font-medium block mt-1">Closed Pipeline Won quotient</span>
          </div>
        </div>

        {/* Stat card 2: Calls log summary */}
        <div className="bg-white p-6 rounded-xl border border-gray-150 flex flex-col justify-between shadow-xs">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Calls Engaged</span>
            <span className="p-1.5 rounded bg-blue-50 text-blue-600">
              <PhoneCall className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-extrabold text-[#092E20] font-mono">{reportData.totalCalls}</h3>
            <span className="text-[10px] text-gray-500 font-medium block mt-1">Outbound tele-calling frequency</span>
          </div>
        </div>

        {/* Stat card 3: Financial valuation sum */}
        <div className="bg-white p-6 rounded-xl border border-gray-150 flex flex-col justify-between shadow-xs">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Quotations Volume</span>
            <span className="p-1.5 rounded bg-purple-50 text-purple-600">
              <FileText className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-extrabold text-[#092E20] font-mono truncate">
              Rs. {reportData.totalQuotesSum.toLocaleString('en-IN')}
            </h3>
            <span className="text-[10px] text-gray-500 font-medium block mt-1">Across {reportData.totalQuotesCount} generated quotes</span>
          </div>
        </div>

        {/* Stat card 4: Pipeline closed ratio */}
        <div className="bg-white p-6 rounded-xl border border-gray-150 flex flex-col justify-between shadow-xs">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Deals Closed</span>
            <span className="p-1.5 rounded bg-emerald-50 text-emerald-600">
              <Activity className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-4 font-mono select-none">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-extrabold text-green-700">{reportData.wonLeads} Won</span>
              <span className="text-xs text-gray-400">/</span>
              <span className="text-base text-red-500">{reportData.lostLeads} Lost</span>
            </div>
            <span className="text-[10px] text-gray-500 font-medium block mt-1">Closed accounts distribution ratio</span>
          </div>
        </div>
      </div>

      {/* CHARTS GRAPH BLOCK */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left: Lead Sources SVG Chart */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs space-y-4">
          <div className="border-b border-gray-100 pb-3 flex items-center justify-between">
            <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
              <BarChart className="w-4 h-4 text-[#092E20]" />
              <span>Volume Distribution by Lead Source</span>
            </h3>
            <span className="text-[10px] text-gray-400 font-semibold uppercase">Real-Time</span>
          </div>

          <div className="space-y-4 pt-2">
            {reportData.sourcesChartData.slice(0, 5).map((d, index) => {
              // Calculate percent of maximum lead source count for fluid scaling
              const maxCount = reportData.sourcesChartData[0]?.count || 1;
              const scaleWidth = `${Math.max((d.count / maxCount) * 100, 5)}%`;
              return (
                <div key={d.source} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-gray-700">{d.source}</span>
                    <span className="text-gray-500">{d.count} Leads ({Math.round((d.count / (reportData.totalLeads || 1)) * 100)}%)</span>
                  </div>
                  <div className="w-full bg-gray-100 h-3 rounded-full overflow-hidden flex">
                    <div
                      style={{ width: scaleWidth }}
                      className={`h-full rounded-full transition-all duration-500 ${
                        index === 0
                          ? 'bg-[#092E20]'
                          : index === 1
                          ? 'bg-[#0F5132]'
                          : index === 2
                          ? 'bg-[#22C55E]'
                          : 'bg-emerald-250'
                      }`}
                    />
                  </div>
                </div>
              );
            })}
            {reportData.sourcesChartData.length === 0 && (
              <div className="py-12 text-center text-gray-400 text-xs">
                No leads present in database to graph source metrics.
              </div>
            )}
          </div>
        </div>

        {/* Right: Conversions funnel graphics */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs space-y-4">
          <div className="border-b border-gray-100 pb-3 flex items-center justify-between">
            <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#0F5132]" />
              <span>Sales Closed Pipeline Split</span>
            </h3>
            <span className="text-[10px] text-gray-400 font-semibold uppercase">Close Factor</span>
          </div>

          <div className="flex flex-col items-center justify-center py-6 space-y-4">
            <span className="text-xs text-gray-400 font-medium">Won vs Lost Closed Deals ratio</span>
            
            {/* Hand-crafted elegant SVG pie/donut simulation gauge segment */}
            <div className="relative w-36 h-36 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                {/* Background circle of gauge */}
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="transparent"
                  stroke="#e5e7eb"
                  strokeWidth="10"
                />
                
                {/* Won circle segment */}
                {reportData.conversionRate > 0 && (
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="transparent"
                    stroke="#22C55E"
                    strokeWidth="10"
                    strokeDasharray={`${reportData.conversionRate * 2.51} 251`}
                  />
                )}
              </svg>
              
              <div className="absolute text-center">
                <span className="text-2xl font-extrabold text-[#092E20] font-mono leading-none">
                  {reportData.conversionRate}%
                </span>
                <span className="text-[8px] text-gray-400 uppercase tracking-wider block mt-1">Won Leads</span>
              </div>
            </div>

            <div className="flex gap-4 text-xs font-bold pt-2">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-[#22C55E] block" />
                <span className="text-gray-700">Won Business ({reportData.wonLeads})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-gray-200 block" />
                <span className="text-gray-700">Lost/Leaked ({reportData.lostLeads})</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
