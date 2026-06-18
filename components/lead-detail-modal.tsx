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
  Pin,
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
  Users,
  ClipboardList,
  FileSpreadsheet,
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
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState<string>('');

  // Redesigned central tab controller and contact directory states
  const [activeMainTab, setActiveMainTab] = useState<'overview' | 'contacts' | 'notes' | 'quotes'>('overview');
  const [editingContactIndex, setEditingContactIndex] = useState<number | null>(null);
  const [showContactForm, setShowContactForm] = useState(false);
  const [contactForm, setContactForm] = useState({
    name: '',
    designation: '',
    department: '',
    mobile: '',
    whatsapp: '',
    email: '',
    notes: '',
  });

  // Real-time states for subcollections
  const [notes, setNotes] = useState<Note[]>([]);
  const [followups, setFollowups] = useState<FollowUp[]>([]);
  const [allQuotations, setAllQuotations] = useState<Quotation[]>([]);
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'notes' | 'followups' | 'quotations' | 'contacts'>('notes');
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

  // Contact Directory Actions
  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactForm.name.trim() || !lead) return;

    setSubmitting(true);
    try {
      const existingContacts = lead.contacts || [];
      let updatedContacts = [...existingContacts];

      if (editingContactIndex !== null) {
        // Edit existing contact
        updatedContacts[editingContactIndex] = { ...contactForm };
      } else {
        // Add new contact
        updatedContacts.push({ ...contactForm });
      }

      await onUpdateLead(lead.id, { contacts: updatedContacts });

      // Reset form
      setContactForm({
        name: '',
        designation: '',
        department: '',
        mobile: '',
        whatsapp: '',
        email: '',
        notes: '',
      });
      setEditingContactIndex(null);
      setShowContactForm(false);
      alert(editingContactIndex !== null ? 'Contact updated successfully!' : 'Contact added successfully!');
    } catch (err) {
      console.error('Error saving contact:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditContactClick = (index: number) => {
    if (!lead || !lead.contacts) return;
    const contact = lead.contacts[index];
    setContactForm({ ...contact });
    setEditingContactIndex(index);
    setShowContactForm(true);
  };

  const handleDeleteContact = async (index: number) => {
    if (!lead || !lead.contacts) return;
    if (!confirm('Are you sure you want to delete this contact?')) return;

    try {
      const updatedContacts = lead.contacts.filter((_, i) => i !== index);
      await onUpdateLead(lead.id, { contacts: updatedContacts });
      alert('Contact deleted successfully!');
    } catch (err) {
      console.error('Error deleting contact:', err);
    }
  };

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

  // Compute sorted progress logs with pinned messages prioritizing visual timeline placement
  const sortedNotes = useMemo(() => {
    if (!notes) return [];
    return [...notes].sort((a, b) => {
      const aPinned = a.pinned ? 1 : 0;
      const bPinned = b.pinned ? 1 : 0;
      return bPinned - aPinned; // Pinned (1) comes before unpinned (0)
    });
  }, [notes]);

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
        lastCallDate: new Date().toISOString().split('T')[0],
        status: 'Called Today',
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

  const handleUpdateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNoteId || !editingNoteText.trim() || !lead) return;

    setSubmitting(true);
    try {
      const docRef = doc(db, 'leads', lead.id, 'notes', editingNoteId);
      await updateDoc(docRef, {
        note: editingNoteText.trim(),
        updatedAt: serverTimestamp(),
      });
      setEditingNoteId(null);
      setEditingNoteText('');
    } catch (err) {
      console.error('Error updating note:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!lead || !confirm('Are you sure you want to delete this progressive note?')) return;
    try {
      const docRef = doc(db, 'leads', lead.id, 'notes', noteId);
      await deleteDoc(docRef);
    } catch (err) {
      console.error('Error deleting note:', err);
    }
  };

  const handleTogglePinNote = async (noteId: string, currentPinned?: boolean) => {
    if (!lead) return;
    try {
      const docRef = doc(db, 'leads', lead.id, 'notes', noteId);
      await updateDoc(docRef, {
        pinned: !currentPinned,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Error toggling pin:', err);
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
        
        {/* Modern styled Header */}
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

        {/* Sticky action bar at top of lead detail (Fixed underneath header, always visible without scrolling) */}
        <div className="bg-gray-150 border-b border-gray-200 p-2.5 px-4 flex flex-wrap items-center justify-start gap-2 z-30 shrink-0 sticky top-0" id="sticky-top-lead-actions-bar">
          <button
            onClick={handleCallDial}
            className="flex-1 min-w-[70px] sm:flex-initial py-1.5 px-2.5 bg-[#092E20] hover:bg-[#126c42]/90 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-transform active:scale-95 cursor-pointer"
            title="Call Lead"
          >
            <Phone className="w-3.5 h-3.5 text-[#22C55E] stroke-[2.5px]" />
            <span>Call</span>
          </button>
          
          <button
            onClick={() => handleSendWhatsApp(1)}
            className="flex-1 min-w-[85px] sm:flex-initial py-1.5 px-2.5 bg-[#128C7E] hover:bg-[#075E54] text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-transform active:scale-95 cursor-pointer"
            title="Send WhatsApp Template 1"
          >
            <MessageSquare className="w-3.5 h-3.5 text-white stroke-[2.5px]" />
            <span>WhatsApp</span>
          </button>

          <button
            onClick={() => {
              setActiveSubTab('followups');
              const elem = document.getElementById('subcollection-tabs-row');
              if (elem) elem.scrollIntoView({ behavior: 'smooth' });
            }}
            className="flex-1 min-w-[105px] sm:flex-initial py-1.5 px-2.5 bg-indigo-50 border border-indigo-150 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-transform active:scale-95 cursor-pointer"
            title="Schedule a Follow-up"
          >
            <Calendar className="w-3.5 h-3.5 stroke-[2.5px]" />
            <span>Follow-up</span>
          </button>

          <button
            onClick={() => {
              setActiveSubTab('followups');
              setNewFollowup(prev => ({ ...prev, actionType: 'Reminder' }));
              const elem = document.getElementById('subcollection-tabs-row');
              if (elem) elem.scrollIntoView({ behavior: 'smooth' });
            }}
            className="flex-1 min-w-[95px] sm:flex-initial py-1.5 px-2.5 bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-transform active:scale-95 cursor-pointer"
            title="Set Reminder"
          >
            <Clock className="w-3.5 h-3.5 stroke-[2.5px]" />
            <span>Reminder</span>
          </button>

          <button
            onClick={() => {
              setActiveSubTab('notes');
              const elem = document.getElementById('new-note-textarea');
              if (elem) {
                elem.scrollIntoView({ behavior: 'smooth' });
                elem.focus();
              }
            }}
            className="flex-1 min-w-[70px] sm:flex-initial py-1.5 px-2.5 bg-sky-50 border border-sky-150 text-sky-700 hover:bg-sky-100 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-transform active:scale-95 cursor-pointer"
            title="Write Note"
          >
            <FileText className="w-3.5 h-3.5 stroke-[2.5px]" />
            <span>Note</span>
          </button>

          <button
            onClick={() => setIsEditModalOpen(true)}
            className="flex-1 min-w-[70px] sm:flex-initial py-1.5 px-2.5 bg-emerald-50 border border-emerald-150 text-emerald-800 hover:bg-emerald-100/80 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-transform active:scale-95 cursor-pointer"
            title="Edit Lead Details"
          >
            <Edit2 className="w-3.5 h-3.5 stroke-[2.5px]" />
            <span>Edit</span>
          </button>
        </div>

        {/* Workspace Panels split */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-gray-150">
          
          {/* Left panel (5 columns): Section 1: Company Profile & Outreach */}
          <div className="md:col-span-5 p-4 md:p-6 bg-gray-50/50 space-y-6 overflow-y-auto">
            
            {/* 1. COMPANY PROFILE CARD */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h3 className="font-bold text-[#092E20] text-xs font-display uppercase tracking-wider flex items-center gap-1.5">
                  <span className="p-1 bg-emerald-50 text-[#092E20] rounded-lg text-xs leading-none">🏢</span>
                  <span>Section 1: Company Profile</span>
                </h3>
                <span className="text-[10px] text-gray-400 font-mono">ESTD: {createdDateStr}</span>
              </div>

              <div className="space-y-3 text-xs font-sans">
                {/* Brand & GST Section */}
                <div className="grid grid-cols-2 gap-3 pb-3 border-b border-gray-100/50">
                  <div>
                    <span className="text-[9px] uppercase font-bold text-gray-400 block tracking-wider">Company Brand</span>
                    <p className="font-extrabold text-gray-800 mt-0.5 leading-snug">{lead.companyName || '-'}</p>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-bold text-gray-400 block tracking-wider">GST No.</span>
                    <p className="font-bold text-gray-700 mt-0.5 font-mono select-all bg-gray-50 px-1 py-0.5 rounded border border-gray-150 inline-block text-[11px]">{lead.gstNumber || 'Unregistered'}</p>
                  </div>
                </div>

                {/* Website & Industry Section */}
                <div className="grid grid-cols-2 gap-3 pb-3 border-b border-gray-100/50">
                  <div>
                    <span className="text-[9px] uppercase font-bold text-gray-400 block tracking-wider">Website Domain</span>
                    {lead.website ? (
                      <a href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline flex items-center gap-1 font-medium mt-0.5 truncate max-w-[130px]" title={lead.website}>
                        <Globe className="w-3 h-3 text-emerald-700 shrink-0" />
                        <span>{lead.website}</span>
                      </a>
                    ) : (
                      <p className="text-gray-400 mt-0.5">Not set</p>
                    )}
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-bold text-gray-400 block tracking-wider">Industry Vertical</span>
                    <p className="font-bold text-gray-800 mt-0.5">{lead.industry || '-'}</p>
                  </div>
                </div>

                {/* Geographical Placement */}
                <div className="pb-3 border-b border-gray-100/50">
                  <span className="text-[9px] uppercase font-bold text-gray-400 block tracking-wider">Registered Address</span>
                  <p className="text-gray-650 leading-relaxed mt-0.5 font-medium">{lead.address || 'Address details empty'}</p>
                  {lead.city && (
                    <span className="inline-block mt-1 bg-emerald-50 text-emerald-800 text-[10px] font-bold px-2 py-0.1 border border-emerald-150 rounded">
                      City: {lead.city}{lead.state ? `, ${lead.state}` : ''}
                    </span>
                  )}
                </div>

                {/* Complete CRM Performance Stats (Req 7 & 8) */}
                <div className="bg-emerald-50/15 p-3 rounded-xl border border-[#22C55E]/10 space-y-2">
                  <span className="text-[9px] text-[#092E20] font-black uppercase tracking-wider block">Company Analytics Profile</span>
                  <div className="grid grid-cols-3 gap-1.5 text-center text-xs">
                    <div className="bg-white p-1 rounded-lg border border-gray-100">
                      <span className="font-black text-xs text-[#092E20] font-mono block">{lead.callCount || 0}</span>
                      <span className="text-[8.5px] text-gray-400 block mt-0.5 font-bold">Total Calls</span>
                    </div>
                    <div className="bg-white p-1 rounded-lg border border-gray-100">
                      <span className="font-black text-xs text-indigo-700 font-mono block">{followups.length}</span>
                      <span className="text-[8.5px] text-gray-400 block mt-0.5 font-bold">Follow Ups</span>
                    </div>
                    <div className="bg-white p-1 rounded-lg border border-gray-100">
                      <span className="font-black text-xs text-purple-700 font-mono block">{linkedQuotations.length}</span>
                      <span className="text-[8.5px] text-gray-400 block mt-0.5 font-bold">Quotations</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-[9px] text-gray-400 border-t border-gray-100 pt-2 font-mono">
                    <span>CREATED: {createdDateStr}</span>
                    <span>LAST CALL: {lead.lastCallDate ? new Date(lead.lastCallDate).toLocaleDateString('en-IN') : 'Never'}</span>
                  </div>
                </div>

                {/* Primary Requirement */}
                {lead.requirement && (
                  <div className="bg-gray-50/60 p-3 rounded-lg border border-gray-200">
                    <span className="text-[9px] uppercase font-bold text-gray-400 block tracking-wider">Manufacturing Requirements</span>
                    <p className="text-gray-700 mt-1 whitespace-pre-wrap leading-relaxed max-h-[100px] overflow-y-auto font-mono text-[11px] select-all">{lead.requirement}</p>
                  </div>
                )}
              </div>

              {/* Profiles Action Bars */}
              <div className="grid grid-cols-2 gap-2 pt-3 border-t border-gray-100 select-none">
                <button
                  onClick={() => setIsEditModalOpen(true)}
                  className="py-1.5 px-2 bg-gray-50 border border-gray-200 hover:border-[#092E20] text-gray-600 rounded-xl text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition active:scale-95"
                >
                  <Edit2 className="w-3.5 h-3.5 text-gray-500" />
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
                  className="py-1.5 px-2 bg-red-50/50 border border-red-100 hover:bg-red-500 hover:text-white text-red-500 rounded-xl text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition active:scale-95"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Lead</span>
                </button>
              </div>
            </div>

            {/* DIRECT OUTREACH HUB */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-xs space-y-3.5">
              <span className="text-xs font-bold text-[#092E20] uppercase tracking-wider block">Direct Outreach Hub</span>
              
              <div className="grid grid-cols-2 gap-2">
                {/* Phone Call dialer */}
                <button
                  onClick={handleCallDial}
                  disabled={!lead.phone}
                  className="py-2.5 px-3 bg-[#092E20] text-white hover:bg-[#072418] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 transition"
                >
                  <Phone className="w-4 h-4 text-[#22C55E]" />
                  <span>Dial Call ({lead.callCount || 0})</span>
                </button>

                {/* Email dispatcher */}
                <button
                  onClick={handleSendEmail}
                  disabled={!lead.email}
                  className="py-2.5 px-3 bg-gray-50 hover:bg-gray-100 text-gray-700 hover:text-black rounded-xl text-xs font-bold border border-gray-200 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 transition"
                >
                  <Mail className="w-4 h-4 text-purple-600" />
                  <span>Draft Email</span>
                </button>
              </div>

              {/* Saturday Planning Action Column */}
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
                className="w-full py-2 px-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
              >
                <Calendar className="w-4 h-4" />
                <span>Move to Saturday Follow-up</span>
              </button>

              {/* Company Profile Brochure Share (Catalog Trigger) */}
              <button
                type="button"
                onClick={() => handleSendProfile('WhatsApp')}
                className="w-full py-2 px-3 bg-emerald-650 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold border border-emerald-600 flex items-center justify-center gap-1.5 cursor-pointer select-none"
              >
                <Download className="w-4 h-4" />
                <span>Trigger Mobile Catalog PDF</span>
              </button>

              {/* Outbound Quick WhatsApp pitching template buttons */}
              <div className="bg-gray-50 border border-gray-150 p-3.5 rounded-xl space-y-2">
                <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">Share pitch templates</span>
                <div className="grid grid-cols-1 gap-1.5">
                  <button
                    onClick={() => handleSendWhatsApp(1)}
                    disabled={!lead.whatsapp && !lead.phone}
                    className="w-full text-left p-2 bg-white hover:bg-emerald-50/30 border border-gray-200 hover:border-[#22C55E]/40 rounded-lg text-xs font-bold text-gray-700 hover:text-[#092E20] transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-40"
                  >
                    <MessageSquare className="w-4 h-4 shrink-0 text-[#22C55E]" />
                    <span className="truncate">T1: Intro pitch brochure booklet</span>
                  </button>
                  <button
                    onClick={() => handleSendWhatsApp(2)}
                    disabled={!lead.whatsapp && !lead.phone}
                    className="w-full text-left p-2 bg-white hover:bg-emerald-50/30 border border-gray-200 hover:border-[#22C55E]/40 rounded-lg text-xs font-bold text-gray-700 hover:text-[#092E20] transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-40"
                  >
                    <MessageSquare className="w-4 h-4 shrink-0 text-[#22C55E]" />
                    <span className="truncate">T2: Standard Follow-Up Check</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right panel (7 columns): Multi-Section Mobile CRM Experience */}
          <div className="md:col-span-7 p-4 md:p-6 space-y-8 overflow-y-auto">
            
            {/* 2. CONTACT DIRECTORY */}
            <div id="section-contacts" className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-xs space-y-4">
              <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                <h3 className="font-bold text-[#092E20] text-xs font-display uppercase tracking-wider flex items-center gap-1.5">
                  <span className="p-1 bg-emerald-50 text-[#092E20] rounded-lg text-xs leading-none">👥</span>
                  <span>Section 2: Contact Directory ({(lead.contacts || []).length})</span>
                </h3>
                {!showContactForm && (
                  <button
                    onClick={() => {
                      setEditingContactIndex(null);
                      setContactForm({
                        name: '',
                        designation: '',
                        department: '',
                        mobile: '',
                        whatsapp: '',
                        email: '',
                        notes: '',
                      });
                      setShowContactForm(true);
                    }}
                    className="py-2 px-3 bg-[#092E20] text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                )}
              </div>

              {showContactForm ? (
                /* Contact registration form optimized with clean styling */
                <form onSubmit={handleSaveContact} className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Name *</label>
                      <input
                        type="text"
                        required
                        value={contactForm.name}
                        className="w-full bg-white border border-gray-200 rounded-xl p-2.5 text-xs outline-hidden focus:border-[#092E20]"
                        placeholder="Ramesh Kumar"
                        onChange={(e) => setContactForm(prev => ({ ...prev, name: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Designation</label>
                      <input
                        type="text"
                        value={contactForm.designation}
                        className="w-full bg-white border border-gray-200 rounded-xl p-2.5 text-xs outline-hidden focus:border-[#092E20]"
                        placeholder="Purchase Manager"
                        onChange={(e) => setContactForm(prev => ({ ...prev, designation: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Mobile Phone *</label>
                      <input
                        type="text"
                        value={contactForm.mobile}
                        className="w-full bg-white border border-gray-200 rounded-xl p-2.5 text-xs outline-hidden focus:border-[#092E20]"
                        placeholder="9876543210"
                        onChange={(e) => setContactForm(prev => ({ ...prev, mobile: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">WhatsApp</label>
                      <input
                        type="text"
                        value={contactForm.whatsapp}
                        className="w-full bg-white border border-gray-200 rounded-xl p-2.5 text-xs outline-hidden focus:border-[#092E20]"
                        placeholder="9876543210"
                        onChange={(e) => setContactForm(prev => ({ ...prev, whatsapp: e.target.value }))}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Email</label>
                      <input
                        type="email"
                        value={contactForm.email}
                        className="w-full bg-white border border-gray-200 rounded-xl p-2.5 text-xs outline-hidden focus:border-[#092E20]"
                        placeholder="ramesh@company.com"
                        onChange={(e) => setContactForm(prev => ({ ...prev, email: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 text-xs pt-2 border-t border-gray-200/50">
                    <button
                      type="button"
                      onClick={() => setShowContactForm(false)}
                      className="py-2 px-3 bg-white border border-gray-200 text-gray-600 rounded-xl font-bold cursor-pointer transition active:scale-95"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting || !contactForm.name.trim()}
                      className="py-2 px-4 bg-[#092E20] text-white rounded-xl font-bold cursor-pointer disabled:opacity-40 transition active:scale-95"
                    >
                      Save Representative
                    </button>
                  </div>
                </form>
              ) : (
                /* Card elements with direct contact CTA links (Call, Email, WhatsApp) */
                <div className="space-y-3.5">
                  {(lead.contacts || []).map((c, idx) => (
                    <div key={idx} className="p-4 bg-gray-50/65 rounded-xl border border-gray-150 relative space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-extrabold text-gray-800 text-sm leading-tight">{c.name}</p>
                          <p className="text-[10px] text-gray-400 font-semibold mt-0.5">{c.designation || 'Representative'} {c.department ? `(${c.department})` : ''}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleEditContactClick(idx)}
                            className="p-1.5 border border-gray-200 hover:border-[#092E20] bg-white text-gray-500 rounded-lg"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteContact(idx)}
                            className="p-1.5 border border-gray-200 hover:border-red-200 bg-white text-red-400 hover:text-red-655 rounded-lg"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        {/* CALL button */}
                        {c.mobile ? (
                          <a
                            href={`tel:${c.mobile}`}
                            className="p-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-150 text-[#092E20] rounded-xl text-center font-bold text-[10.5px] cursor-pointer flex items-center justify-center gap-1"
                          >
                            <Phone className="w-3 h-3 text-[#22C55E]" />
                            <span>Call</span>
                          </a>
                        ) : (
                          <span className="p-2 bg-gray-100 text-gray-400 rounded-xl text-center text-[10.5px] opacity-40">No Phone</span>
                        )}

                        {/* WHATSAPP button */}
                        {c.whatsapp || c.mobile ? (
                          <a
                            href={`https://wa.me/91${c.whatsapp || c.mobile}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 bg-green-50 hover:bg-green-100 border border-green-150 text-[#092E20] rounded-xl text-center font-bold text-[10.5px] cursor-pointer flex items-center justify-center gap-1"
                          >
                            <MessageSquare className="w-3 h-3 text-[#22C55E]" />
                            <span>WhatsApp</span>
                          </a>
                        ) : (
                          <span className="p-2 bg-gray-100 text-gray-400 rounded-xl text-center text-[10.5px] opacity-40">No WA</span>
                        )}

                        {/* EMAIL button */}
                        {c.email ? (
                          <a
                            href={`mailto:${c.email}`}
                            className="p-2 bg-purple-50 hover:bg-purple-100 border border-purple-150 text-purple-700 rounded-xl text-center font-bold text-[10.5px] cursor-pointer flex items-center justify-center gap-1"
                          >
                            <Mail className="w-3 h-3 text-purple-600" />
                            <span>Email</span>
                          </a>
                        ) : (
                          <span className="p-2 bg-gray-100 text-gray-400 rounded-xl text-center text-[10.5px] opacity-40">No Email</span>
                        )}
                      </div>
                    </div>
                  ))}
                  {(lead.contacts || []).length === 0 && (
                    <div className="py-8 text-center text-gray-400 text-xs flex flex-col items-center justify-center gap-1">
                      <Users className="w-8 h-8 text-gray-300 stroke-[1.5]" />
                      <p className="font-semibold text-gray-650 text-[11px]">No contact representatives registered</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 3. PROGRESS NOTES TIMELINE */}
            <div id="section-notes" className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-xs space-y-4">
              <div className="border-b border-gray-100 pb-3 flex justify-between items-center">
                <h3 className="font-bold text-[#092E20] text-xs font-display uppercase tracking-wider flex items-center gap-1.5">
                  <span className="p-1 bg-emerald-50 text-[#092E20] rounded-lg text-xs leading-none">📝</span>
                  <span>Section 3: Notes & Progress Timeline ({notes.length})</span>
                </h3>
              </div>

              {/* Note creation / edit Input with optimized mobile form styling */}
              <form onSubmit={editingNoteId ? handleUpdateNote : handleSaveNote} className="flex gap-2">
                <input
                  type="text"
                  required
                  value={editingNoteId ? editingNoteText : newNoteText}
                  onChange={(e) => editingNoteId ? setEditingNoteText(e.target.value) : setNewNoteText(e.target.value)}
                  id="new-note-textarea"
                  placeholder={editingNoteId ? "Edit activity log entry..." : "Type custom progress update note..."}
                  className="flex-1 bg-gray-50 border border-gray-200 focus:border-[#092E20] focus:ring-1 focus:ring-[#092E20] rounded-xl py-2.5 px-3.5 text-xs outline-hidden font-medium"
                />
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 bg-[#092E20] hover:bg-[#072418] text-white rounded-xl transition cursor-pointer disabled:opacity-40 font-bold text-xs shrink-0 flex items-center justify-center"
                >
                  {editingNoteId ? 'Update' : <Send className="w-3.5 h-3.5 text-white" />}
                </button>
                {editingNoteId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingNoteId(null);
                      setEditingNoteText('');
                    }}
                    className="px-3 bg-gray-250 hover:bg-gray-300 text-gray-705 rounded-xl transition text-[11px] font-bold"
                  >
                    Cancel
                  </button>
                )}
              </form>

              {/* Notes List Scrollbox */}
              <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-1">
                {sortedNotes.map(n => (
                  <div key={n.id} className={`p-4 rounded-xl relative border transition-all flex flex-col justify-between ${
                    n.pinned 
                      ? 'bg-amber-50/70 border-amber-200 hover:bg-amber-50' 
                      : 'bg-gray-50/60 border-gray-150 hover:bg-gray-100/30'
                  }`}>
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5">
                        {n.pinned && <Pin className="w-3 h-3 text-amber-600 fill-amber-600 shrink-0" />}
                        <span className="font-bold text-[11px] text-[#092E20] leading-none shrink-0 truncate max-w-[140px]" title={n.user}>{n.user}</span>
                        <span className="text-[9px] text-gray-400 font-semibold font-mono">
                          {n.date} &bull; {n.time} {n.updatedAt && '(edited)'}
                        </span>
                      </div>
                      
                      {/* Note Pin / Edit / Delete Actions */}
                      <div className="flex items-center gap-1 font-semibold text-xs text-gray-400">
                        <button
                          onClick={() => handleTogglePinNote(n.id, !n.pinned)}
                          className={`p-1 rounded cursor-pointer ${n.pinned ? 'text-amber-600 bg-amber-100/50' : 'hover:bg-gray-200'}`}
                          title={n.pinned ? "Remove Pin" : "Pin message to top"}
                        >
                          <Pin className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setEditingNoteId(n.id);
                            setEditingNoteText(n.note);
                          }}
                          className="p-1 hover:bg-gray-200 rounded hover:text-emerald-750"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteNote(n.id)}
                          className="p-1 hover:bg-gray-200 rounded hover:text-red-500"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-gray-700 mt-2 whitespace-pre-wrap leading-relaxed select-text font-medium">{n.note}</p>
                  </div>
                ))}

                {sortedNotes.length === 0 && (
                  <div className="py-8 text-center text-gray-400 text-xs">
                    No timeline notes captured yet. Add notes above to record updates.
                  </div>
                )}
              </div>
            </div>

            {/* 4. ACTIONS, FOLLOW UPS & SCHEDULED REMINDERS */}
            <div id="section-followups" className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-xs space-y-4">
              <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                <h3 className="font-bold text-[#092E20] text-xs font-display uppercase tracking-wider flex items-center gap-1.5">
                  <span className="p-1 bg-emerald-50 text-[#092E20] rounded-lg text-xs leading-none">📅</span>
                  <span>Section 4: Follow Ups & Reminders ({followups.length})</span>
                </h3>
              </div>

              {/* Followup scheduler */}
              <form onSubmit={handleSaveFollowup} className="p-4 bg-gray-50/50 rounded-xl border border-gray-200 space-y-3">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1">Date</label>
                    <input
                      type="date"
                      required
                      value={newFollowup.date}
                      className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs outline-hidden focus:border-[#092E20]"
                      onChange={(e) => setNewFollowup(prev => ({ ...prev, date: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1">Time</label>
                    <input
                      type="time"
                      required
                      value={newFollowup.time}
                      className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs outline-hidden focus:border-[#092E20]"
                      onChange={(e) => setNewFollowup(prev => ({ ...prev, time: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1">Priority</label>
                    <select
                      value={newFollowup.priority}
                      className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs outline-hidden cursor-pointer"
                      onChange={(e) => setNewFollowup(prev => ({ ...prev, priority: e.target.value as any }))}
                    >
                      <option value="Hot">🔥 Hot</option>
                      <option value="Warm">⚡ Warm</option>
                      <option value="Cold">❄️ Cold</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1">Action Type</label>
                    <select
                      value={newFollowup.actionType}
                      className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs outline-hidden cursor-pointer"
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
                  <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1">Task Description / Agenda</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Share metal label price quotation..."
                    className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs outline-hidden focus:border-[#092E20]"
                    value={newFollowup.notes}
                    onChange={(e) => setNewFollowup(prev => ({ ...prev, notes: e.target.value }))}
                  />
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={submitting || !newFollowup.notes.trim()}
                    className="py-1.5 px-4 bg-[#092E20] hover:bg-[#072418] text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-40 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Attach Followup</span>
                  </button>
                </div>
              </form>

              {/* Followups list Display */}
              <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                {followups.map(f => (
                  <div key={f.id} className="p-3 bg-white border border-gray-200/60 rounded-xl shadow-xs text-xs space-y-2 flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-[#092E20] uppercase bg-green-50 px-1.5 py-0.5 rounded text-[9px]">
                          {f.actionType}
                        </span>
                        <span className="text-[10px] text-gray-400 font-semibold">{f.date} &bull; {f.time}</span>
                      </div>
                      <p className="text-gray-700 font-medium leading-relaxed">{f.notes}</p>
                    </div>
                    <span className={`text-[9px] uppercase px-1.5 py-0.5 font-bold rounded-lg ${
                      f.priority === 'Hot' ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {f.priority}
                    </span>
                  </div>
                ))}
                {followups.length === 0 && (
                  <div className="py-8 text-center text-gray-400 text-xs">
                    No scheduled followups or reminders for this buyer.
                  </div>
                )}
              </div>
            </div>

            {/* 5. LINKED BUYER ESTIMATIONS & QUOTATIONS */}
            <div id="section-quotations" className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-xs space-y-4">
              <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                <h3 className="font-bold text-[#092E20] text-xs font-display uppercase tracking-wider flex items-center gap-1.5">
                  <span className="p-1 bg-emerald-50 text-[#092E20] rounded-lg text-xs leading-none">📊</span>
                  <span>Section 5: Linked Quotations ({linkedQuotations.length})</span>
                </h3>
              </div>

              <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-1">
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
                      className="p-3 bg-gray-50/50 hover:bg-gray-50 border border-gray-250 hover:border-emerald-250 hover:border-[#092E20] rounded-xl shadow-xs transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-3 cursor-pointer group"
                      onClick={() => setSelectedQuotation(q)}
                    >
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-xs text-[#092E20] font-mono">
                            {q.quotationNumber || 'VE-QUOTE-DRAFT'}
                          </span>
                          <span className="text-[10px] text-gray-400 font-semibold">{qDate}</span>
                        </div>
                        <p className="text-[11px] text-gray-500 font-medium truncate">
                          Subject: {q.subject || 'Label estimates request'}
                        </p>
                        <div className="flex flex-wrap gap-1 items-center mt-1">
                          {productsToLoad.slice(0, 2).map((item: any, id: number) => (
                            <span key={id} className="text-[9px] bg-white border border-gray-150 text-gray-600 px-1.5 py-0.5 rounded-lg truncate max-w-[150px]">
                              {item.labelName || 'Labels'} ({item.quantity?.toLocaleString('en-IN')} pcs)
                            </span>
                          ))}
                          {productsToLoad.length > 2 && (
                            <span className="text-[9px] bg-gray-100 text-gray-400 px-1 py-0.5 rounded">
                              +{productsToLoad.length - 2} more
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 self-end md:self-center" onClick={(e) => e.stopPropagation()}>
                        <div className="text-right">
                          <span className="text-[8.5px] text-gray-400 block font-bold leading-none">GRAND TOTAL</span>
                          <span className="font-black text-xs text-[#092E20] font-mono block mt-1">
                            Rs. {grandTotalSum.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDownloadQuotationPDF(q)}
                            className="p-1 px-2 border border-blue-200 hover:bg-blue-50 text-blue-600 rounded-lg text-xs font-bold transition"
                            title="Download PDF"
                          >
                            PDF
                          </button>
                          <button
                            onClick={() => handleDeleteQuotation(q.id)}
                            className="p-1 px-2 border border-red-200 hover:bg-red-50 text-red-500 rounded-lg text-xs font-bold transition"
                            title="Delete"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {linkedQuotations.length === 0 && (
                  <div className="py-8 text-center text-gray-400 text-xs">
                    No matching estimates discovered for this company.
                  </div>
                )}
              </div>
            </div>

          </div>   </div>
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
