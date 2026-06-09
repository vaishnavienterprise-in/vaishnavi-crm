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
  CalendarDays,
  Clock,
} from 'lucide-react';
import {
  getTodayDateString,
  isDateInCurrentWeek,
  isDateInCurrentMonth,
} from '@/lib/date-utils';

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

  const todayStr = useMemo(() => getTodayDateString(), []);

  // Export entire directory of leads as formatted Excel CSV
  const handleExportDirectoryExcel = () => {
    const csvRows = [
      [
        'Customer Name',
        'Company Name',
        'Status',
        'Priority',
        'Phone',
        'Email',
        'City',
        'State',
        'GST Number',
        'Website',
        'Call Count',
        'Last Call Date',
        'Next Action',
        'Day Assignment',
        'Created Date'
      ]
    ];

    leads.forEach(l => {
      csvRows.push([
        l.customerName || '',
        l.companyName || '',
        l.status || '',
        l.priority || '',
        l.phone || '',
        l.email || '',
        l.city || '',
        l.state || '',
        l.gstNumber || '',
        l.website || '',
        String(l.callCount || 0),
        l.lastCallDate || '',
        l.nextAction || '',
        l.dayAssignment || '',
        l.assignedDate || ''
      ]);
    });

    const csvContent = 'data:text/csv;charset=utf-8,' 
      + csvRows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(',')).join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Vaishnavi_Leads_Directory_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  // Export entire directory of leads as a print-ready clean PDF
  const handleExportDirectoryPDF = () => {
    const printWin = window.open('', '_blank');
    if (!printWin) return alert('Pop-up blocked. Please permit pop-ups on this port.');

    const tableRowsHtml = leads.map(l => `
      <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
        <td style="padding: 10px 6px; font-weight: bold; color: #1e293b;">${l.customerName}</td>
        <td style="padding: 10px 6px; color: #475569;">${l.companyName}</td>
        <td style="padding: 10px 6px; color: #475569;">${l.city || '-'} (${l.state || 'IN'})</td>
        <td style="padding: 10px 6px; font-weight: bold; color: #092E20;">${l.status}</td>
        <td style="padding: 10px 6px; color: #475569;">${l.priority}</td>
        <td style="padding: 10px 6px; font-family: monospace;">${l.phone}</td>
        <td style="padding: 10px 6px; text-align: center;">${l.callCount || 0}</td>
        <td style="padding: 10px 6px; color: #475569;">${l.lastCallDate || 'Never'}</td>
      </tr>
    `).join('');

    printWin.document.write(`
      <html>
        <head>
          <title>Vaishnavi Enterprise - Sales Lead Directory Report</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #334155; margin: 40px; }
            .header-panel { display: flex; justify-content: space-between; border-bottom: 3px solid #092E20; padding-bottom: 15px; margin-bottom: 30px; }
            .logo-title { font-size: 24px; font-weight: 800; color: #092E20; letter-spacing: -0.5px; }
            .logo-sub { font-size: 10px; font-weight: bold; color: #64748b; letter-spacing: 1.5px; text-transform: uppercase; margin-top: 5px; }
            .meta { text-align: right; font-size: 11px; color: #64748b; }
            .meta strong { color: #1e293b; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { background-color: #092E20; color: white; padding: 12px 6px; text-align: left; font-size: 12px; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header-panel">
            <div>
              <div class="logo-title">VAISHNAVI ENTERPRISE</div>
              <div class="logo-sub">Complete Sales Directory & Outbound Dashboard</div>
            </div>
            <div class="meta">
              Date Generated: <strong>\${new Date().toLocaleDateString('en-IN')}</strong><br>
              Total Records: <strong>\${leads.length} Active Leads</strong><br>
              Status: <strong>Official Export</strong>
            </div>
          </div>
          <h3>Consolidated Lead Directory Record</h3>
          <table>
            <thead>
              <tr>
                <th>Customer Name</th>
                <th>Company</th>
                <th>Location</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Contact Phone</th>
                <th style="text-align: center;">Calls</th>
                <th>Last Call Date</th>
              </tr>
            </thead>
            <tbody>
              \${tableRowsHtml}
            </tbody>
          </table>
          <div style="margin-top: 40px; border-top: 1px dashed #cbd5e1; padding-top: 15px; font-size: 11px; text-align: center; color: #94a3b8;">
            Vaishnavi Enterprise CRM &bull; High Reliability Sales Platform Systems
          </div>
          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `);
    printWin.document.close();
  };

  // State to manage single lead selection & actions inside the center
  const [selectedSingleLeadId, setSelectedSingleLeadId] = useState<string>('');

  const activeSingleLeadObj = useMemo(() => {
    return leads.find(l => l.id === selectedSingleLeadId);
  }, [leads, selectedSingleLeadId]);

  // Export Single Lead as formatted Excel CSV
  const handleExportSingleExcel = () => {
    if (!activeSingleLeadObj) return alert('Please select a lead first.');
    const l = activeSingleLeadObj;
    
    let csvString = '';
    csvString += `Customer Name,"\${(l.customerName || '').replace(/"/g, '""')}"\\n`;
    csvString += `Company Name,"\${(l.companyName || '').replace(/"/g, '""')}"\\n`;
    csvString += `Pipeline Status,"\${(l.status || '').replace(/"/g, '""')}"\\n`;
    csvString += `Priority,"\${(l.priority || '').replace(/"/g, '""')}"\\n`;
    csvString += `Phone,"\${(l.phone || '').replace(/"/g, '""')}"\\n`;
    csvString += `Email,"\${(l.email || '').replace(/"/g, '""')}"\\n`;
    csvString += `City,"\${(l.city || '').replace(/"/g, '""')}"\\n`;
    csvString += `GST Number,"\${(l.gstNumber || '').replace(/"/g, '""')}"\\n`;
    csvString += `Website,"\${(l.website || '').replace(/"/g, '""')}"\\n`;
    csvString += `Total Calls Dialed,"\${String(l.callCount || 0)}"\\n`;
    csvString += `Last Dial Date,"\${(l.lastCallDate || '')}"\\n`;
    csvString += `Next Planned Action,"\${(l.nextAction || '')}"\\n`;
    csvString += `Next Date,"\${(l.nextActionDate || '')}"\\n`;

    const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvString);
    const link = document.createElement('a');
    link.setAttribute('href', csvContent);
    link.setAttribute('download', `Vaishnavi_Lead_Card_\${l.customerName.replace(/\\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  // Export Single Lead details to print-ready PDF
  const handleExportSinglePDF = () => {
    if (!activeSingleLeadObj) return alert('Please select a lead first.');
    const l = activeSingleLeadObj;

    const printWin = window.open('', '_blank');
    if (!printWin) return alert('Pop-up blocked. Please permit pop-ups on this port.');

    printWin.document.write(`
      <html>
        <head>
          <title>Lead Dossier - \${l.customerName}</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #334155; margin: 40px; line-height: 1.6; }
            .header-panel { display: flex; justify-content: space-between; border-bottom: 3px solid #092E20; padding-bottom: 15px; margin-bottom: 30px; }
            .logo-title { font-size: 24px; font-weight: 800; color: #092E20; letter-spacing: -0.5px; }
            .logo-sub { font-size: 10px; font-weight: bold; color: #64748b; letter-spacing: 1.5px; text-transform: uppercase; margin-top: 5px; }
            .meta { text-align: right; font-size: 11px; color: #64748b; }
            .meta strong { color: #1e293b; }
            .grid-container { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
            .info-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; }
            .info-card h4 { margin-top: 0; color: #092E20; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; font-size: 14px; }
            .info-row { display: flex; justify-content: space-between; font-size: 11px; padding: 4px 0; border-bottom: 1px solid #f8fafc; }
            .info-row strong { color: #1e293b; }
          </style>
        </head>
        <body>
          <div class="header-panel">
            <div>
              <div class="logo-title">VAISHNAVI ENTERPRISE</div>
              <div class="logo-sub">Client Dossier Report Summary</div>
            </div>
            <div class="meta">
              Date Generated: <strong>\s*\${new Date().toLocaleDateString('en-IN')}</strong><br>
              File Status: <strong>Official Summary Report</strong>
            </div>
          </div>

          <h2 style="color: #092E20; border-bottom: 1.5px solid #092E20; padding-bottom: 4px; margin-bottom: 20px;">Client Dossier: \${l.customerName}</h2>

          <div class="grid-container">
            <div class="info-card">
              <h4>General Company profile</h4>
              <div class="info-row"><span>Customer Name</span><strong>\${l.customerName}</strong></div>
              <div class="info-row"><span>Company Designation</span><strong>\${l.companyName}</strong></div>
              <div class="info-row"><span>Industry Sector</span><strong>\${l.industry || '-'}</strong></div>
              <div class="info-row"><span>Town/City Location</span><strong>\${l.city ? \`\${l.city} (\${l.state || 'IN'})\` : '-'}</strong></div>
              <div class="info-row"><span>Lead Source Route</span><strong>\${l.leadSource}</strong></div>
            </div>

            <div class="info-card">
              <h4>Workflow CRM Meta</h4>
              <div class="info-row"><span>Active Status</span><strong style="color: #092E20;">\${l.status}</strong></div>
              <div class="info-row"><span>Priority Status</span><strong>\${l.priority}</strong></div>
              <div class="info-row"><span>GST Reg Number</span><strong>\${l.gstNumber || '-'}</strong></div>
              <div class="info-row"><span>Call Tally Count</span><strong>\${l.callCount || 0} Dialed</strong></div>
              <div class="info-row"><span>Last Successful Dial</span><strong>\${l.lastCallDate || 'Never'}</strong></div>
            </div>
          </div>

          <div style="margin-top: 40px; border-top: 1px dashed #cbd5e1; padding-top: 15px; font-size: 11px; text-align: center; color: #94a3b8;">
            Vaishnavi Enterprise CRM &bull; High Reliability Sales Platform Systems
          </div>

          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `);
    printWin.document.close();
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

      {/* VAISHNAVI ENTERPRISE CORE EXPORT CENTRIC COMMAND */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6" id="crm-export-command-center">
        <div className="flex items-center gap-2.5 pb-4 border-b border-gray-100">
          <span className="p-2 bg-[#092E20] text-emerald-400 rounded-xl">
            <Download className="w-5 h-5 animate-pulse" />
          </span>
          <div>
            <h3 className="text-base font-bold text-gray-800 tracking-tight leading-none">Unified CRM Export Centric Command</h3>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Configure, sanitize, and download database files immediately</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* A. Bulk Directory Exports */}
          <div className="bg-gray-50/50 p-5 rounded-xl border border-gray-150 space-y-4">
            <div>
              <h4 className="font-bold text-gray-800 text-xs uppercase tracking-wider">Bulk Directory Records</h4>
              <p className="text-[11px] text-gray-400 mt-0.5">Produce summaries listing all lead contacts and states</p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={handleExportDirectoryExcel}
                className="flex-1 py-2.5 px-3 bg-white hover:bg-green-50/20 border border-gray-200 hover:border-green-300 text-gray-700 hover:text-green-800 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 shadow-2xs transition-all active:scale-[0.98] cursor-pointer"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                <span>Export to Excel (CSV)</span>
              </button>
              
              <button
                onClick={handleExportDirectoryPDF}
                className="flex-1 py-2.5 px-3 bg-[#092E20] hover:bg-[#0c402c] text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 shadow-xs transition-all active:scale-[0.98] cursor-pointer"
              >
                <span>Print PDF Summary</span>
              </button>
            </div>
          </div>

          {/* B. Specific Target Lead Exports */}
          <div className="bg-gray-50/50 p-5 rounded-xl border border-gray-150 space-y-4">
            <div>
              <h4 className="font-bold text-gray-800 text-xs uppercase tracking-wider">Target Single Lead Dossier</h4>
              <p className="text-[11px] text-gray-400 mt-0.5">Select a customer profile from active lists to download custom records</p>
            </div>

            <div className="space-y-3 pt-1">
              <select
                value={selectedSingleLeadId}
                onChange={(e) => setSelectedSingleLeadId(e.target.value)}
                className="w-full bg-white border border-gray-250 focus:border-[#092E20] focus:ring-1 focus:ring-[#092E20] rounded-lg py-2 px-3 text-xs outline-hidden cursor-pointer"
              >
                <option value="">-- Choose A Lead Client Profile --</option>
                {leads.map(lead => (
                  <option key={lead.id} value={lead.id}>
                    {lead.customerName} ({lead.companyName})
                  </option>
                ))}
              </select>

              <div className="flex gap-2">
                <button
                  onClick={handleExportSingleExcel}
                  disabled={!selectedSingleLeadId}
                  className="flex-1 py-2 px-3 bg-white hover:bg-amber-50/30 border border-gray-200 hover:border-amber-300 text-gray-600 hover:text-amber-700 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                >
                  <span>Lead CSV Row</span>
                </button>
                
                <button
                  onClick={handleExportSinglePDF}
                  disabled={!selectedSingleLeadId}
                  className="flex-1 py-2 px-3 bg-[#092E20] hover:bg-[#0c402c] text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                >
                  <span>Dossier PDF</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Global Security / Sync note */}
        <div className="flex items-center gap-2 text-[10px] text-gray-400 font-semibold bg-gray-50 p-3 rounded-lg border border-gray-150">
          <span>🛡️</span>
          <span>Data security notice: Exports are processed client-side. No lead information ever exits the secure sandboxed memory scope of Vaishnavi Enterprise servers.</span>
        </div>
      </div>
    </div>
  );
}
