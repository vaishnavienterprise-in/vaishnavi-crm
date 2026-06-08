'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Lead, Note, FollowUp, LeadStatus, LeadPriority, Quotation, Contact } from '@/lib/types';
import { useAuth } from './firebase-provider';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import LeadFormModal from './lead-form-modal';
import QuotationDetailModal from './quotation-detail-modal';
import { jsPDF } from 'jspdf';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  updateDoc,
  doc,
  where,
  deleteDoc,
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
  Trash2,
  Edit2,
  Globe,
  Briefcase,
  Layers,
  Percent,
  Download,
  Notebook,
} from 'lucide-react';

interface LeadDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: Lead | null;
  onUpdateLead: (leadId: string, updatedData: Partial<Lead>) => Promise<void>;
  onDeleteLead?: (leadId: string) => Promise<void>;
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

export default function LeadDetailModal({ isOpen, onClose, lead, onUpdateLead, onDeleteLead }: LeadDetailModalProps) {
  const { user } = useAuth();
  
  // Edit and Delete states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Real-time states for subcollections
  const [notes, setNotes] = useState<Note[]>([]);
  const [followups, setFollowups] = useState<FollowUp[]>([]);
  const [allQuotations, setAllQuotations] = useState<Quotation[]>([]);
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'notes' | 'followups' | 'quotations'>('notes');
  const [logoBase64, setLogoBase64] = useState<string | null>(null);

  // Preload company logo for flawless catalog invoice download
  useEffect(() => {
    const preloadLogo = async () => {
      try {
        const response = await fetch('/logo.png');
        if (response.ok) {
          const blob = await response.blob();
          const reader = new FileReader();
          reader.onloadend = () => {
            setLogoBase64(reader.result as string);
          };
          reader.readAsDataURL(blob);
        }
      } catch (err) {
        console.error('Failed to pre-load logo image:', err);
      }
    };
    preloadLogo();
  }, []);

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

  // Computed creation date
  const createdDateStr = useMemo(() => {
    if (!lead || !lead.createdAt) return '-';
    try {
      const ca = lead.createdAt as any;
      if (ca && typeof ca.toDate === 'function') {
        return ca.toDate().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      } else if (ca && ca.seconds) {
        return new Date(ca.seconds * 1000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      } else {
        return new Date(ca).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      }
    } catch (e) {
      return '-';
    }
  }, [lead]);

  // Compute filtered quotations linked to this B2B profile
  const linkedQuotations = useMemo(() => {
    if (!lead) return [];
    return allQuotations.filter(q => {
      // 1. Explicit ID mapping
      if (q.leadId && q.leadId === lead.id) return true;
      
      // 2. Company name match
      if (q.companyName && lead.companyName && q.companyName.toLowerCase().trim() === lead.companyName.toLowerCase().trim()) {
        return true;
      }
      
      // 3. Customer name match
      if (q.customerName && lead.customerName && q.customerName.toLowerCase().trim() === lead.customerName.toLowerCase().trim()) {
        return true;
      }

      return false;
    });
  }, [allQuotations, lead]);

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

    // 3. Subscribe to Quotations Collection (user-owned)
    const quotationsRef = collection(db, 'quotations');
    const quotationsQuery = query(quotationsRef, where('ownerId', '==', user?.uid || ''));
    const unsubscribeQuotations = onSnapshot(
      quotationsQuery,
      (snapshot) => {
        const loadedQuotes: Quotation[] = [];
        snapshot.forEach((docSnap) => {
          loadedQuotes.push({ id: docSnap.id, ...docSnap.data() } as Quotation);
        });
        setAllQuotations(loadedQuotes);
      },
      (err) => {
        console.error('Quotations sync snapshot error', err);
      }
    );

    return () => {
      unsubscribeNotes();
      unsubscribeFollowups();
      unsubscribeQuotations();
    };
  }, [lead, isOpen, user?.uid]);

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

  // Download PDF catalog invoice for any quotation
  const handleDownloadQuotationPDF = (q: Quotation) => {
    try {
      const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4',
      });

      const primaryColor = [9, 46, 32];
      const textGray = [80, 80, 80];
      const darkColor = [33, 37, 41];
      const lightBg = [245, 247, 246];

      let currentY = 15;

      // Header company identity
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(20);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text('VAISHNAVI ENTERPRISE', 15, currentY);
      
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(textGray[0], textGray[1], textGray[2]);
      currentY += 5.5;
      doc.text('315, Suncor Plaza, Jashodanagar BRTS, Jashodanagar, Ahmedabad - 380026', 15, currentY);
      
      currentY += 4.5;
      doc.text('GSTIN: 24ESJPS9568G2ZX | Phone: +91 82382 90762 | Email: vaishnavienterprise.print@gmail.com', 15, currentY);

      // Logo rendering
      const logoX = 165;
      const logoY = 9;
      if (logoBase64) {
        doc.addImage(logoBase64, 'PNG', logoX, logoY, 18, 18);
      } else {
        doc.setDrawColor(180, 190, 184);
        doc.setLineWidth(0.4);
        doc.setLineDashPattern([2, 2], 0);
        doc.rect(logoX - 5, logoY + 4, 35, 15, 'S');
        doc.setLineDashPattern([], 0);
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(150, 150, 150);
        doc.text('[ COMPANY LOGO ]', logoX + 12.5, logoY + 13, { align: 'center' });
      }

      currentY += 12;

      // Meta row details
      doc.setDrawColor(230, 235, 232);
      doc.setLineWidth(0.3);
      doc.setFillColor(248, 250, 249);
      doc.rect(15, currentY, 180, 12, 'FD');

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text('QUOTATION', 19, currentY + 8.5);

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
      doc.text(`Quote No: ${q.quotationNumber || 'VE-DRAFT'}`, 105, currentY + 7.5);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(textGray[0], textGray[1], textGray[2]);
      
      const formattedDateStr = q.createdAt 
        ? (typeof q.createdAt.toDate === 'function' ? q.createdAt.toDate().toLocaleDateString('en-IN') : new Date(q.createdAt).toLocaleDateString('en-IN'))
        : new Date().toLocaleDateString('en-IN');
      doc.text(`Date: ${formattedDateStr}`, 190, currentY + 7.5, { align: 'right' });

      currentY += 19;

      // Customer section info
      const sectionY = currentY;
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text('QUOTED TO:', 15, currentY);

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
      currentY += 5;
      doc.text(q.customerName || '-', 15, currentY);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(textGray[0], textGray[1], textGray[2]);
      currentY += 4.5;
      doc.text(q.companyName || '-', 15, currentY);

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text('SUBJECT:', 115, sectionY);

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
      
      const subjLines = doc.splitTextToSize(q.subject || 'Quotation for Premium Self-Adhesive Labels', 75);
      let subjectLineY = sectionY + 5;
      subjLines.forEach((line: string) => {
        doc.text(line, 115, subjectLineY);
        subjectLineY += 4.5;
      });

      currentY = Math.max(currentY + 5, subjectLineY + 5) + 4;

      // Table draw headers
      const renderHeaders = (y: number) => {
        doc.setFillColor(lightBg[0], lightBg[1], lightBg[0]);
        doc.rect(15, y, 180, 8, 'F');
        doc.setDrawColor(210, 215, 212);
        doc.setLineWidth(0.3);
        doc.line(15, y, 195, y);
        doc.line(15, y + 8, 195, y + 8);

        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text('Label Name', 17, y + 5.5);
        doc.text('Material', 72, y + 5.5);
        doc.text('Size', 98, y + 5.5);
        doc.text('Quantity', 133, y + 5.5, { align: 'right' });
        doc.text('Rate / Label', 160, y + 5.5, { align: 'right' });
        doc.text('Amount', 193, y + 5.5, { align: 'right' });
      };

      renderHeaders(currentY);
      currentY += 8;

      let inTableRange = true;
      const spaceValidator = (h: number) => {
        if (currentY + h > 240) {
          doc.addPage();
          currentY = 20;
          if (inTableRange) {
            renderHeaders(currentY);
            currentY += 8;
          }
        }
      };

      // Products rendering
      const productsToLoad = q.products && q.products.length > 0 ? q.products : (
        (q as any).items ? (q as any).items.map((i: any) => ({
          labelName: i.labelName || '',
          materialType: i.material || 'Chromo',
          size: i.size || '-',
          quantity: Number(i.quantity || 0),
          rate: Number(i.rate || 0),
          amount: Number(i.amount || 0)
        })) : [{
          labelName: q.product || 'Premium Custom Labels',
          materialType: 'Chromo',
          size: q.size || '-',
          quantity: Number(q.quantity || 0),
          rate: Number(q.rate || 0),
          amount: q.subtotal || (q.total ? Number((q.total / 1.18).toFixed(2)) : 0)
        }]
      );

      productsToLoad.forEach((item: any) => {
        const descRow = doc.splitTextToSize(item.labelName || '-', 53);
        const materialRow = doc.splitTextToSize(item.materialType || '-', 24);
        const sizeRow = doc.splitTextToSize(item.size || '-', 23);

        const rowLinesCount = Math.max(descRow.length, materialRow.length, sizeRow.length);
        const calcHeight = rowLinesCount * 5 + 4;

        spaceValidator(calcHeight);

        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(60, 60, 60);

        let iterY = currentY + 5.5;
        for (let i = 0; i < rowLinesCount; i++) {
          doc.text(descRow[i] || '', 17, iterY + (i * 4.5));
          doc.text(materialRow[i] || '', 72, iterY + (i * 4.5));
          doc.text(sizeRow[i] || '', 98, iterY + (i * 4.5));
        }

        doc.text(Number(item.quantity || 0).toLocaleString('en-IN'), 133, currentY + 5.5, { align: 'right' });
        doc.text('Rs. ' + Number(item.rate || 0).toFixed(4), 160, currentY + 5.5, { align: 'right' });
        doc.text('Rs. ' + Number(item.amount || 0).toFixed(2), 193, currentY + 5.5, { align: 'right' });

        currentY += calcHeight;
        doc.setDrawColor(230, 235, 232);
        doc.setLineWidth(0.35);
        doc.line(15, currentY, 195, currentY);
      });

      inTableRange = false;
      currentY += 8;

      // Tax & totals
      spaceValidator(35);

      const subTotalSum = q.subtotal || productsToLoad.reduce((sum: number, item: any) => sum + (item.amount || 0), 0);
      const gstPercent = q.gst !== undefined ? q.gst : 18;
      const gstSum = q.grandTotal ? (q.grandTotal - subTotalSum) : ((subTotalSum * gstPercent) / 100);
      const grandTotalSum = q.grandTotal || (subTotalSum + gstSum);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(textGray[0], textGray[1], textGray[2]);

      doc.text('Subtotal:', 125, currentY + 5);
      doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
      doc.text('Rs. ' + subTotalSum.toLocaleString('en-IN', { minimumFractionDigits: 2 }), 193, currentY + 5, { align: 'right' });

      currentY += 6.5;
      doc.setTextColor(textGray[0], textGray[1], textGray[2]);
      doc.text(`GST (${gstPercent}%):`, 125, currentY + 5);
      doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
      doc.text('Rs. ' + gstSum.toLocaleString('en-IN', { minimumFractionDigits: 2 }), 193, currentY + 5, { align: 'right' });

      currentY += 8;
      doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setLineWidth(0.45);
      doc.line(120, currentY, 195, currentY);

      currentY += 5.5;
      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text('TOTAL PRICE (INCL. GST):', 125, currentY);
      doc.text('Rs. ' + grandTotalSum.toLocaleString('en-IN', { minimumFractionDigits: 2 }), 193, currentY, { align: 'right' });

      // Save document file
      doc.save(`${q.quotationNumber || 'VE-QUOTE'}_${q.customerName?.replace(/\s+/g, '_') || 'Estimate'}.pdf`);
    } catch (e) {
      console.error('Failed generating PDF inside lead timeline: ', e);
      alert('Internal PDF compilation error. Please try again.');
    }
  };

  // Delete matching quotation record securely
  const handleDeleteQuotation = async (id: string) => {
    if (!lead) return;
    try {
      await deleteDoc(doc(db, 'quotations', id));
      
      // Auto log progress note
      const notesRef = collection(db, 'leads', lead.id, 'notes');
      await addDoc(notesRef, {
        leadId: lead.id,
        date: new Date().toISOString().split('T')[0],
        time: new Date().toTimeString().slice(0, 5),
        note: `🗑️ Deleted quotation record (Ref: ID ${id.slice(0, 5).toUpperCase()}) from historical logs.`,
        user: user?.displayName || user?.email || 'Authorized CRM User',
        createdAt: serverTimestamp(),
        ownerId: user?.uid,
      });
      alert('Quotation successfully deleted from historical logs.');
    } catch (e) {
      console.error(e);
      alert('Failed to delete quotation record.');
    }
  };

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

              {/* Direct Profile Management Controls */}
              <div className="grid grid-cols-2 gap-2.5 pt-2.5 border-t border-gray-200/50">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(true)}
                  className="py-2 px-3 border border-[#092E20] hover:bg-gray-100 text-[#092E20] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-transform active:scale-95 cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit Profile</span>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (window.confirm('Are you sure you want to delete this lead?')) {
                      if (onDeleteLead) {
                        await onDeleteLead(lead.id);
                        onClose();
                      }
                    }
                  }}
                  className="py-2 px-3 border border-red-500 hover:bg-red-50 text-red-500 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-transform active:scale-95 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Lead</span>
                </button>
              </div>
            </div>

            {/* Structured Specifications Info */}
            <div className="bg-white p-4.5 rounded-xl border border-gray-200 shadow-xs space-y-3">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Lead Profile Specifications</span>
              <div className="space-y-2.5 text-xs">
                {/* Customer and Company */}
                <div className="grid grid-cols-2 gap-2 border-b border-gray-100 pb-2">
                  <div>
                    <span className="text-gray-400 block text-[9.5px] uppercase font-bold">Customer Name</span>
                    <p className="font-semibold text-gray-800">{lead.customerName || '-'}</p>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[9.5px] uppercase font-bold">Company / Brand</span>
                    <p className="font-semibold text-gray-800">{lead.companyName || '-'}</p>
                  </div>
                </div>

                {/* Contact numbers with index mapping */}
                <div className="border-b border-gray-100 pb-2">
                  <span className="text-gray-400 block text-[9.5px] uppercase font-bold mb-1">Registered Phone(s)</span>
                  <div className="space-y-1 font-mono text-gray-700">
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3 h-3 text-[#22C55E]" />
                      <span>{lead.phone || '-'}</span>
                      <span className="text-[8px] bg-green-50 text-[#092E20] px-1 py-0.2 rounded font-sans font-bold">Primary</span>
                    </div>
                    {lead.phones && lead.phones.slice(1).map((ph, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 pl-4.5 text-[11px] text-gray-600">
                        <span>{ph}</span>
                        <span className="text-[8px] bg-gray-100 text-gray-500 px-1 py-0.2 rounded font-sans">Phone {idx + 2}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Email(s) */}
                <div className="border-b border-gray-100 pb-2">
                  <span className="text-gray-404 block text-[9.5px] uppercase font-bold mb-1">Registered Email(s)</span>
                  <div className="space-y-1 text-gray-700">
                    {lead.email ? (
                      <div className="flex items-center gap-1.5">
                        <Mail className="w-3 h-3 text-purple-600" />
                        <span className="truncate select-all">{lead.email}</span>
                        <span className="text-[8px] bg-purple-50 text-purple-700 px-1 py-0.2 rounded font-bold">Primary</span>
                      </div>
                    ) : (
                      <p className="text-gray-400 italic text-[11px]">No email defined</p>
                    )}
                    {lead.emails && lead.emails.slice(1).map((em, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 pl-4.5 text-[11px] text-gray-655 font-semibold">
                        <span className="truncate select-all">{em}</span>
                        <span className="text-[8px] bg-gray-100 text-gray-500 px-1 py-0.2 rounded">Email {idx + 2}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Location mapping */}
                <div className="grid grid-cols-2 gap-2 border-b border-gray-100 pb-2">
                  <div>
                    <span className="text-gray-404 block text-[9.5px] uppercase font-bold">City / State</span>
                    <p className="font-semibold text-gray-800">{lead.city || '-'} ({lead.state || 'IN'})</p>
                  </div>
                  <div>
                    <span className="text-gray-404 block text-[9.5px] uppercase font-bold">Industry Vertical</span>
                    <p className="font-semibold text-gray-800">{lead.industry || '-'}</p>
                  </div>
                </div>

                {/* Additional metadata */}
                <div className="grid grid-cols-2 gap-2 border-b border-gray-100 pb-2">
                  <div>
                    <span className="text-gray-404 block text-[9.5px] uppercase font-bold">Lead Source</span>
                    <p className="font-semibold font-mono text-gray-850 text-[11px]">{lead.leadSource || '-'}</p>
                  </div>
                  <div>
                    <span className="text-gray-404 block text-[9.5px] uppercase font-bold">Created Date</span>
                    <p className="font-semibold text-[#092E20]">{createdDateStr}</p>
                  </div>
                </div>

                {/* Company GST & Website */}
                <div className="grid grid-cols-2 gap-2 border-b border-gray-100 pb-2">
                  <div>
                    <span className="text-gray-404 block text-[9.5px] uppercase font-bold">GST Number</span>
                    <p className="font-semibold font-mono text-gray-800 text-[10.5px]">{lead.gstNumber || 'No GST Registered'}</p>
                  </div>
                  <div>
                    <span className="text-gray-404 block text-[9.5px] uppercase font-bold">Company Website</span>
                    {lead.website ? (
                      <a
                        href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-emerald-700 hover:underline truncate block"
                      >
                        {lead.website}
                      </a>
                    ) : (
                      <p className="font-semibold text-gray-400">-</p>
                    )}
                  </div>
                </div>

                {/* Workspace progress context parameters */}
                <div className="grid grid-cols-2 gap-2 border-b border-gray-100 pb-2">
                  <div>
                    <span className="text-gray-450 block text-[9.5px] uppercase font-bold">Assigned Day</span>
                    <p className="font-semibold text-amber-600 uppercase tracking-wider">{lead.dayAssignment || 'Monday'}</p>
                  </div>
                  <div>
                    <span className="text-gray-405 block text-[9.5px] uppercase font-bold">Last Called</span>
                    <p className="font-semibold text-gray-700">
                      {lead.lastCalledAt ? 'Yes' : 'Never'} ({lead.callCount || 0} times)
                    </p>
                  </div>
                </div>

                {/* Real Lead Notes field in Lead Document */}
                {lead.notes && (
                  <div className="bg-amber-50/50 p-2.5 rounded-lg border border-amber-100/60 mt-2">
                    <span className="text-amber-800 block text-[9px] uppercase font-black tracking-wider">Internal Profile Notes</span>
                    <p className="text-xs text-amber-900 mt-1 leading-relaxed whitespace-pre-wrap">
                      {lead.notes}
                    </p>
                  </div>
                )}

                {lead.requirement && (
                  <div className="border-t border-gray-100 pt-2.5">
                    <span className="text-gray-404 block text-[9.5px] uppercase font-bold">Manufacturing Requirement</span>
                    <p className="text-xs text-gray-700 leading-relaxed font-mono mt-0.5 whitespace-pre-wrap selection:bg-green-100 bg-gray-50/50 p-2 rounded-lg border border-gray-150">
                      {lead.requirement}
                    </p>
                  </div>
                )}
              </div>
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
              <button
                onClick={() => setActiveSubTab('quotations')}
                className={`py-2 px-4 text-xs font-bold border-b-2 cursor-pointer transition-all ${
                  activeSubTab === 'quotations' ? 'border-[#092E20] text-[#092E20]' : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                Quotations ({linkedQuotations.length})
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
            ) : activeSubTab === 'followups' ? (
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
            ) : (
              // QUOTATIONS HISTORICAL TAB
              <div className="flex-1 flex flex-col h-full justify-between gap-4">
                <div className="flex justify-between items-center shrink-0 border-b border-gray-150 pb-2">
                  <span className="text-xs font-bold text-gray-405 uppercase tracking-widest flex items-center gap-1">
                    <Notebook className="w-4 h-4 text-[#22C55E]" />
                    <span>Past Buyer Estimations</span>
                  </span>
                  <span className="text-[10px] bg-[#092E20]/5 text-[#092E20] px-2 py-0.5 rounded-full font-bold">
                    {linkedQuotations.length} quotes total
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2.5 max-h-[42vh] pr-1 mt-1">
                  {linkedQuotations.map(q => {
                    const qDate = q.createdAt
                      ? (typeof q.createdAt.toDate === 'function' ? q.createdAt.toDate().toLocaleDateString('en-IN') : new Date(q.createdAt).toLocaleDateString('en-IN'))
                      : '-';
                    
                    const productsToLoad = q.products && q.products.length > 0 ? q.products : (
                      (q as any).items ? (q as any).items.map((i: any) => ({
                        labelName: i.labelName || '',
                        quantity: Number(i.quantity || 0)
                      })) : [{ labelName: q.product || 'Labels', quantity: q.quantity }]
                    );

                    const subTotalSum = q.subtotal || productsToLoad.reduce((sum: number, item: any) => sum + (Number((item as any).amount) || 0), 0);
                    const grandTotalSum = q.grandTotal || (subTotalSum * 1.18);

                    return (
                      <div 
                        key={q.id} 
                        className="p-3 bg-gray-50/50 hover:bg-gray-50 border border-gray-200/80 hover:border-emerald-250 rounded-xl shadow-xs transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-3 cursor-pointer group"
                        onClick={() => setSelectedQuotation(q)}
                      >
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-xs text-gray-800 font-mono group-hover:text-emerald-700">
                              {q.quotationNumber || 'VE-QUOTE-DRAFT'}
                            </span>
                            <span className="text-[9.5px] text-gray-400 font-semibold">{qDate}</span>
                          </div>
                          <p className="text-[11px] text-gray-500 font-medium truncate">
                            Subject: {q.subject || 'Label estimates request'}
                          </p>
                          <div className="flex flex-wrap gap-1 items-center">
                            {productsToLoad.slice(0, 2).map((item: any, id: number) => (
                              <span key={id} className="text-[8.5px] bg-white border border-gray-200 text-gray-600 px-1.5 py-0.5 rounded truncate max-w-[150px]">
                                {item.labelName || 'Labels'} ({item.quantity?.toLocaleString('en-IN')} pcs)
                              </span>
                            ))}
                            {productsToLoad.length > 2 && (
                              <span className="text-[8.5px] bg-gray-100 text-gray-400 px-1 py-0.5 rounded">
                                +{productsToLoad.length - 2} more
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
                          <div className="text-right">
                            <span className="text-[8.5px] text-gray-400 block font-bold leading-none">GRAND TOTAL</span>
                            <span className="font-bold text-[12px] text-[#092E20] font-mono block mt-1">
                              Rs. {grandTotalSum.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => handleDownloadQuotationPDF(q)}
                              className="p-1 px-2 border border-blue-200 hover:bg-blue-50 text-blue-600 rounded text-xs font-bold transition-all"
                              title="Download professional invoice PDF"
                            >
                              PDF
                            </button>
                            <button
                              onClick={() => handleDeleteQuotation(q.id)}
                              className="p-1 px-2 border border-red-200 hover:bg-red-50 text-red-500 rounded text-xs font-bold transition-all"
                              title="Permanently remove estimate"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {linkedQuotations.length === 0 && (
                    <div className="py-16 text-center text-gray-350 text-xs">
                      No matching historical quotations found for this buyer company.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {isEditModalOpen && (
        <LeadFormModal
          isOpen={true}
          onClose={() => setIsEditModalOpen(false)}
          lead={lead}
          onSave={async (updatedData) => {
            await onUpdateLead(lead.id, updatedData);
            setIsEditModalOpen(false);
          }}
        />
      )}

      {selectedQuotation && (
        <QuotationDetailModal
          isOpen={true}
          onClose={() => setSelectedQuotation(null)}
          quotation={selectedQuotation}
          onDownloadPDF={handleDownloadQuotationPDF}
          onDelete={async (id) => {
            await handleDeleteQuotation(id);
            setSelectedQuotation(null);
          }}
        />
      )}
    </div>
  );
}
