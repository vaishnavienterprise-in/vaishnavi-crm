'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Quotation, QuotationProduct } from '@/lib/types';
import { jsPDF } from 'jspdf';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import QuotationDetailModal from './quotation-detail-modal';
import {
  FileText,
  Plus,
  TrendingUp,
  Download,
  Trash2,
  Check,
  FileBadge,
  Edit2,
} from 'lucide-react';

const formatCurrency = (val: number, decimals: number = 2) => {
  return 'Rs. ' + Number(val).toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

const getProductsForQuotation = (q: Partial<Quotation> | Quotation): QuotationProduct[] => {
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
  
  // Custom fallback for legacy single product format
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

interface QuotationGeneratorProps {
  quotations: Quotation[];
  onCreateQuotation: (quoteData: Partial<Quotation>) => Promise<void>;
  onDeleteQuotation: (id: string) => Promise<void>;
  onUpdateQuotation?: (id: string, updatedData: Partial<Quotation>) => Promise<void>;
}

export default function QuotationGenerator({
  quotations,
  onCreateQuotation,
  onDeleteQuotation,
  onUpdateQuotation,
}: QuotationGeneratorProps) {
  const [editingQuotationId, setEditingQuotationId] = useState<string | null>(null);
  const [selectedQuotationForView, setSelectedQuotationForView] = useState<Quotation | null>(null);
  const [formData, setFormData] = useState<Partial<Quotation>>({
    customerName: '',
    companyName: '',
    subject: 'Quotation for Premium Self-Adhesive Labels',
    gst: 18,
    remarks: 'Waterproof adhesive, core size 3 inches, standard winding.',
    products: [
      {
        labelName: '',
        materialType: 'Chromo',
        size: '100mm x 50mm',
        quantity: 10000,
        rate: 0.45,
        amount: 4500,
      }
    ],
  });

  const [saving, setSaving] = useState(false);
  const [errorMess, setErrorMess] = useState<string | null>(null);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);

  useEffect(() => {
    // Elegant base64 preloader for maximum reliability in PDF generation
    const preloadLogo = async () => {
      try {
        const response = await fetch('/logo.png');
        if (!response.ok) {
          throw new Error('Could not fetch logo image');
        }
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
          setLogoBase64(reader.result as string);
        };
        reader.readAsDataURL(blob);
      } catch (err) {
        console.error('Failed to pre-load logo image:', err);
      }
    };
    preloadLogo();
  }, []);

  // Computed totals for products list
  const subTotal = useMemo(() => {
    const products = formData.products || [];
    return products.reduce((sum, item) => sum + (item.amount || 0), 0);
  }, [formData.products]);

  const gstAmount = useMemo(() => {
    const ratePercent = formData.gst || 0;
    return Number(((subTotal * ratePercent) / 100).toFixed(2));
  }, [subTotal, formData.gst]);

  const grandTotal = useMemo(() => {
    return Number((subTotal + gstAmount).toFixed(2));
  }, [subTotal, gstAmount]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const numericFields = ['gst'];
    setFormData(prev => ({
      ...prev,
      [name]: numericFields.includes(name) ? Number(value) : value,
    }));
  };

  const handleAddItem = () => {
    setFormData(prev => ({
      ...prev,
      products: [
        ...(prev.products || []),
        {
          labelName: '',
          materialType: 'Chromo',
          size: '100mm x 50mm',
          quantity: 10000,
          rate: 0.45,
          amount: 4500,
        },
      ],
    }));
  };

  const handleDeleteItem = (index: number) => {
    setFormData(prev => {
      const products = [...(prev.products || [])];
      if (products.length > 1) {
        products.splice(index, 1);
      }
      return { ...prev, products };
    });
  };

  const handleItemChange = (index: number, field: keyof QuotationProduct, value: any) => {
    setFormData(prev => {
      const products = [...(prev.products || [])];
      const updatedItem = { ...products[index], [field]: value };
      
      // Dynamic computation of item amount based on rate and quantity
      if (field === 'quantity' || field === 'rate') {
        const qty = field === 'quantity' ? Number(value) : (updatedItem.quantity || 0);
        const rate = field === 'rate' ? Number(value) : (updatedItem.rate || 0);
        updatedItem.amount = Number((qty * rate).toFixed(2));
      }
      
      products[index] = updatedItem;
      return { ...prev, products };
    });
  };

  // Safe fetch function for incrementing sequential Invoice Index
  const getNextQuotationNumber = async () => {
    try {
      const counterDocRef = doc(db, 'settings', 'quotation_counter');
      const counterDocSnap = await getDoc(counterDocRef);
      
      let nextNumber = 1;
      if (counterDocSnap.exists()) {
        const data = counterDocSnap.data();
        nextNumber = (data.lastNumber || 0) + 1;
      } else {
        // Safe cold-start scan from existing lists in props
        if (quotations && quotations.length > 0) {
          const maxNum = quotations.reduce((max, cur) => {
            const numStr = cur.quotationNumber?.replace('VE-', '') || '';
            const parsed = parseInt(numStr, 10);
            return !isNaN(parsed) && parsed > max ? parsed : max;
          }, 0);
          nextNumber = Math.max(nextNumber, maxNum + 1);
        }
      }
      return nextNumber;
    } catch (e) {
      console.error("Error reading counter, running backup max scanner: ", e);
      if (quotations && quotations.length > 0) {
        const maxNum = quotations.reduce((max, cur) => {
          const numStr = cur.quotationNumber?.replace('VE-', '') || '';
          const parsed = parseInt(numStr, 10);
          return !isNaN(parsed) && parsed > max ? parsed : max;
        }, 0);
        return maxNum + 1;
      }
      return Math.floor(1000 + Math.random() * 9000); // safe generic fallback sequence
    }
  };

  const handleGeneratePDF = (q: Partial<Quotation> | Quotation) => {
    try {
      const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4',
      });

      // Professional Emerald/Forest Brand Palette
      const primaryColor = [9, 46, 32];     // Dark Emerald
      const textGray = [80, 80, 80];        // Muted Slate Body Label
      const darkColor = [33, 37, 41];       // Strong Neutral Text
      const lightBg = [245, 247, 246];      // Pale Green/Gray Table header block

      let currentY = 15;

      // 1. --- COMPANY HEADER ---
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
      doc.text(
        'GSTIN: 24ESJPS9568G2ZX | Phone: +91 82382 90762 | Email: vaishnavienterprise.print@gmail.com',
        15,
        currentY
      );

      // Logo top right
      const logoX = 165;
      const logoY = 9;
      if (logoBase64) {
        doc.addImage(logoBase64, 'PNG', logoX, logoY, 18, 18);
      } else {
        // Logo Placeholder top right (Dotted vector design per branding goals)
        doc.setDrawColor(180, 190, 184);
        doc.setLineWidth(0.4);
        doc.setLineDashPattern([2, 2], 0);
        doc.rect(logoX - 5, logoY + 4, 35, 15, 'S');
        doc.setLineDashPattern([], 0); // Reset
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(150, 150, 150);
        doc.text('[ COMPANY LOGO ]', logoX + 12.5, logoY + 13, { align: 'center' });
      }

      currentY += 12;

      // Header Meta Info strip (Quotation Invoice Number, Date)
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
      
      const formattedDate = q.createdAt 
        ? (typeof q.createdAt.toDate === 'function' ? q.createdAt.toDate().toLocaleDateString('en-IN') : new Date(q.createdAt).toLocaleDateString('en-IN'))
        : new Date().toLocaleDateString('en-IN');
      doc.text(`Date: ${formattedDate}`, 190, currentY + 7.5, { align: 'right' });

      currentY += 19;

      // 2. --- CUSTOMER DETAILS AND SUBJECT (2 col layout) ---
      const profileStartY = currentY;

      // Left Column: Client metadata
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

      // Right Column: Subject details
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text('SUBJECT:', 115, profileStartY);

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
      
      const subjectLines = doc.splitTextToSize(q.subject || 'Quotation for Premium Self-Adhesive Labels', 75);
      let subjectY = profileStartY + 5;
      subjectLines.forEach((line: string) => {
        doc.text(line, 115, subjectY);
        subjectY += 4.5;
      });

      currentY = Math.max(currentY + 5, subjectY + 5);
      currentY += 4; // safe padding

      // Table Header Painter Helper
      const drawTableHeaders = (y: number) => {
        doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
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

      // 3. --- QUOTATION TABLE AREA ---
      let inTable = true;
      const ensureSpace = (requiredHeight: number) => {
        if (currentY + requiredHeight > 240) {
          doc.addPage();
          currentY = 20;
          if (inTable) {
            drawTableHeaders(currentY);
            currentY += 8;
          }
        }
      };

      // Draw table header
      drawTableHeaders(currentY);
      currentY += 8;

      // Extract products list to render with fallbacks for older quotations
      const productsToRender = getProductsForQuotation(q);

      productsToRender.forEach((item) => {
        const descLines = doc.splitTextToSize(item.labelName || '-', 53);
        const materialLines = doc.splitTextToSize(item.materialType || '-', 24);
        const sizeLines = doc.splitTextToSize(item.size || '-', 23);

        const maxLines = Math.max(descLines.length, materialLines.length, sizeLines.length);
        const rowHeight = maxLines * 5 + 4; // row height with healthy padding

        ensureSpace(rowHeight);

        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(60, 60, 60);

        let lineY = currentY + 5.5;
        for (let i = 0; i < maxLines; i++) {
          const lName = descLines[i] || '';
          const mName = materialLines[i] || '';
          const sName = sizeLines[i] || '';
          
          doc.text(lName, 17, lineY + (i * 4.5));
          doc.text(mName, 72, lineY + (i * 4.5));
          doc.text(sName, 98, lineY + (i * 4.5));
        }

        const formattedQty = item.quantity ? item.quantity.toLocaleString('en-IN') : '0';
        doc.text(formattedQty, 133, currentY + 5.5, { align: 'right' });
        
        // Precise rate formatting per specifications (e.g. Rs. 0.4500)
        doc.text(formatCurrency(item.rate, 4), 160, currentY + 5.5, { align: 'right' });
        doc.text(formatCurrency(item.amount, 2), 193, currentY + 5.5, { align: 'right' });

        currentY += rowHeight;
        doc.setDrawColor(230, 235, 232);
        doc.setLineWidth(0.35);
        doc.line(15, currentY, 195, currentY);
      });

      inTable = false; // end tables
      currentY += 8;

      // 4. --- TAX SUMMARY / BILL TOTALS ---
      ensureSpace(35);

      const summaryYStart = currentY;

      const subTotalVal = q.subtotal || productsToRender.reduce((sum, item) => sum + (item.amount || 0), 0);
      const gstPercentVal = q.gst !== undefined ? q.gst : 18;
      const gstVal = q.grandTotal ? (q.grandTotal - subTotalVal) : ((subTotalVal * gstPercentVal) / 100);
      const grandTotalVal = q.grandTotal || (subTotalVal + gstVal);

      // We align the totals to the right elegantly since bank details are removed
      const rightLabelX = 125;
      const rightValueX = 193;

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(textGray[0], textGray[1], textGray[2]);

      // Subtotal ex GST line
      doc.text('Subtotal:', rightLabelX, currentY + 5);
      doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
      doc.text(formatCurrency(subTotalVal, 2), rightValueX, currentY + 5, { align: 'right' });

      // GST taxes line
      currentY += 6.5;
      doc.setTextColor(textGray[0], textGray[1], textGray[2]);
      doc.text(`GST (${gstPercentVal}%):`, rightLabelX, currentY + 5);
      doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
      doc.text(formatCurrency(gstVal, 2), rightValueX, currentY + 5, { align: 'right' });

      // Divider line
      currentY += 9;
      doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setLineWidth(0.4);
      doc.line(rightLabelX, currentY, 195, currentY);

      // Grand Inclusive Total
      currentY += 6.5;
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text('Grand Total:', rightLabelX, currentY);
      doc.text(formatCurrency(grandTotalVal, 2), rightValueX, currentY, { align: 'right' });

      currentY = Math.max(summaryYStart + 28, currentY) + 10;

      // 5. --- TERMS & CONDITIONS SECTION ---
      ensureSpace(45);

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text('OFFICIAL TERMS & CONDITIONS:', 15, currentY);
      currentY += 5;

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(110, 110, 110);
      const standardTerms = [
        '1. GST Extra as applicable.',
        '2. Payment Terms: 50% Advance with Purchase Order and 50% Against Delivery.',
        '3. Delivery: 7-10 working days after artwork approval and advance payment.',
        '4. Freight Charges Extra if applicable.',
        '5. Quotation Validity: 15 Days from date of issue.',
        '6. Material once approved cannot be returned or cancelled.',
        '7. Any change in artwork, size, quantity or material may affect pricing.'
      ];
      standardTerms.forEach(term => {
        doc.text(term, 15, currentY);
        currentY += 4.2;
      });

      // Special customer remarks printed beneath, dynamic wrap applied to prevent overlaps
      if (q.remarks) {
        const remarkLines = doc.splitTextToSize(q.remarks, 180);
        const remarksHeight = 8 + remarkLines.length * 4;
        ensureSpace(remarksHeight);

        currentY += 3;
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(80, 80, 80);
        doc.text('SPECIAL MATERIAL BRIEFING NOTES:', 15, currentY);
        currentY += 4.5;
        
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(110, 110, 110);
        remarkLines.forEach((line: string) => {
          doc.text(line, 15, currentY);
          currentY += 4;
        });
      }

      // 6. --- CO STAMPS AND SIGNATURES ---
      ensureSpace(38);
      currentY += 12;

      // Left: Company Rubber Stamp Box
      doc.setDrawColor(9, 46, 32); // Dark Emerald Brand Color for Stamp border
      doc.setLineWidth(0.4);
      doc.setLineDashPattern([1, 1], 0); // Neat dotted stamp outline
      doc.rect(15, currentY + 1, 46, 22, 'S');
      doc.setLineDashPattern([], 0); // Reset
      
      if (logoBase64) {
        // Place the beautiful stamp logo inside the box
        doc.addImage(logoBase64, 'PNG', 16, currentY + 3, 18, 18);
        
        // Add stamp texts on the right of the logo inside the stamp box
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(9, 46, 32); // Brand color stamp ink
        doc.text('VAISHNAVI', 36, currentY + 7);
        doc.text('ENTERPRISE', 36, currentY + 10.2);
        
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(5.5);
        doc.setTextColor(80, 80, 80);
        doc.text('STAMP & SEAL', 36, currentY + 14.5);
        
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(6);
        doc.setTextColor(9, 46, 32);
        doc.text('AHMEDABAD', 36, currentY + 18.5);
      } else {
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(150, 150, 150);
        doc.text('[ COMPANY STAMP / SEAL ]', 35, currentY + 10, { align: 'center' });
      }

      // Right: Signature line
      const sigX = 135;
      doc.setDrawColor(200, 205, 202);
      doc.setLineWidth(0.4);
      doc.line(sigX, currentY + 12, 195, currentY + 12);

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text('Authorized Signatory', sigX, currentY + 17);
      
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(textGray[0], textGray[1], textGray[2]);
      doc.text('Vaishnavi Enterprise Sales Unit', sigX, currentY + 21);

      // 7. --- ABSOLUTE FOOTER (Fixed at the bottom of the final page only) ---
      const footerY = 278;
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(0, footerY, 210, 19, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text('This is an official computer-generated quotation with integrated cloud backup logs.', 105, footerY + 6.5, { align: 'center' });
      doc.text('Thank you for choosing Vaishnavi Enterprise for self-adhesive labels and brand packaging solutions.', 105, footerY + 11.5, { align: 'center' });

      doc.save(`Quotation_${q.quotationNumber || 'VE-DRAFT'}_${q.companyName ? q.companyName.replace(/\s+/g, '_') : 'Draft'}.pdf`);
    } catch (err) {
      console.error('PDF compiling error: ', err);
    }
  };

  const handleEditQuotation = (q: Quotation) => {
    setFormData({
      customerName: q.customerName,
      companyName: q.companyName,
      subject: q.subject || 'Quotation for Premium Self-Adhesive Labels',
      gst: q.gst || 18,
      remarks: q.remarks || 'Waterproof adhesive, core size 3 inches, standard winding.',
      products: getProductsForQuotation(q),
    });
    setEditingQuotationId(q.id);
    
    // Smooth scroll to formulation view
    const formulationSection = document.getElementById('quotations-billing-center');
    if (formulationSection) {
      formulationSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customerName || !formData.companyName) {
      setErrorMess('Client and company names are required.');
      return;
    }
    const products = formData.products || [];
    if (products.length === 0 || products.some(p => !p.labelName)) {
      setErrorMess('Please provide at least one product label name.');
      return;
    }

    setSaving(true);
    setErrorMess(null);
    try {
      const firstProduct = products[0];
      const totalQty = products.reduce((acc, p) => acc + (p.quantity || 0), 0);
      let fullQuote: Partial<Quotation>;

      if (editingQuotationId) {
        const existingQuote = quotations.find(q => q.id === editingQuotationId);
        const quoteNoStr = existingQuote?.quotationNumber || 'VE-UPD';

        fullQuote = {
          ...formData,
          id: editingQuotationId,
          quotationNumber: quoteNoStr,
          products: products,
          subtotal: subTotal,
          gst: formData.gst || 18,
          grandTotal: grandTotal,
          
          product: firstProduct.labelName,
          size: firstProduct.size || '-',
          quantity: totalQty,
          rate: firstProduct.rate || 0,
          total: grandTotal,
        };

        if (onUpdateQuotation) {
          await onUpdateQuotation(editingQuotationId, fullQuote);
        }
        setEditingQuotationId(null);
      } else {
        // 1. Get the next dynamic quotation number sequential counter
        const nextNum = await getNextQuotationNumber();
        const quoteNoStr = `VE-${String(nextNum).padStart(4, '0')}`;

        fullQuote = {
          ...formData,
          quotationNumber: quoteNoStr,
          products: products,
          subtotal: subTotal,
          gst: formData.gst || 18,
          grandTotal: grandTotal,
          
          product: firstProduct.labelName,
          size: firstProduct.size || '-',
          quantity: totalQty,
          rate: firstProduct.rate || 0,
          total: grandTotal,
        };

        await onCreateQuotation(fullQuote);
        
        // Update settings quotation_counter back in Firestore
        try {
          const counterDocRef = doc(db, 'settings', 'quotation_counter');
          await setDoc(counterDocRef, { lastNumber: nextNum });
        } catch (countErr) {
          console.error("Non-blocking setting write error:", countErr);
        }
      }

      // Auto trigger immediate browser download
      handleGeneratePDF(fullQuote);

      // Reset fields but keep core defaults
      setFormData(prev => ({
        ...prev,
        customerName: '',
        companyName: '',
        subject: 'Quotation for Premium Self-Adhesive Labels',
        products: [
          {
            labelName: '',
            materialType: 'Chromo',
            size: '100mm x 50mm',
            quantity: 10000,
            rate: 0.45,
            amount: 4500,
          }
        ],
      }));
    } catch (err: any) {
      console.error(err);
      setErrorMess(err?.message || 'Failed to persist quotation.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8" id="quotations-billing-center">
      
      {/* LEFT: Quotation Formulation (5 columns) */}
      <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-gray-200 shadow-xs space-y-6">
        <div className="flex items-center gap-2 pb-3 border-b border-gray-150">
          <span className="p-1.5 rounded-lg bg-green-50 text-[#092E20]">
            <FileBadge className="w-5 h-5" />
          </span>
          <h2 className="text-lg font-bold text-gray-800 font-display">
            {editingQuotationId ? 'Edit Saved Quotation' : 'New Premium Quotation'}
          </h2>
        </div>

        {editingQuotationId && (
          <div className="p-3 bg-amber-50 text-amber-900 text-xs rounded-lg border border-amber-200 flex items-center justify-between select-none animate-fade-in">
            <div className="flex flex-col gap-0.5">
              <span className="font-bold">Editing Mode Active</span>
              <span className="text-[10px] font-mono font-medium">
                No: {quotations.find(qt => qt.id === editingQuotationId)?.quotationNumber || 'VE-UPD'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingQuotationId(null);
                setFormData({
                  customerName: '',
                  companyName: '',
                  subject: 'Quotation for Premium Self-Adhesive Labels',
                  gst: 18,
                  remarks: 'Waterproof adhesive, core size 3 inches, standard winding.',
                  products: [
                    {
                      labelName: '',
                      materialType: 'Chromo',
                      size: '100mm x 50mm',
                      quantity: 10000,
                      rate: 0.45,
                      amount: 4500,
                    }
                  ],
                });
              }}
              className="py-1 px-2.5 bg-amber-200/60 hover:bg-amber-250 active:bg-amber-300 rounded font-bold text-[10px] text-amber-950 transition-colors cursor-pointer"
            >
              Discard Edit
            </button>
          </div>
        )}

        {errorMess && (
          <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-150 animate-pulse">
            {errorMess}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-gray-500 uppercase">Customer Contact Name *</label>
            <input
              type="text"
              name="customerName"
              required
              value={formData.customerName || ''}
              onChange={handleChange}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs outline-hidden focus:border-[#22C55E] focus:bg-white transition-all text-gray-850 font-medium"
              placeholder="e.g. Sunil Mehta"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-gray-500 uppercase">Company Name *</label>
            <input
              type="text"
              name="companyName"
              required
              value={formData.companyName || ''}
              onChange={handleChange}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs outline-hidden focus:border-[#22C55E] focus:bg-white transition-all text-gray-850 font-medium"
              placeholder="e.g. Mehta Foods Industries"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-gray-500 uppercase">Subject / Purpose Statement *</label>
            <input
              type="text"
              name="subject"
              required
              value={formData.subject || ''}
              onChange={handleChange}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs outline-hidden focus:border-[#22C55E] focus:bg-white transition-all text-gray-850 font-medium"
              placeholder="e.g. Quotation for Premium Self-Adhesive Labels"
            />
          </div>

          {/* DYNAMIC PRODUCTS ROW MANAGER */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-gray-150 pb-2">
              <span className="text-[10px] font-bold text-gray-500 uppercase">Product Label Items *</span>
              <button
                type="button"
                onClick={handleAddItem}
                className="text-[11px] font-bold text-[#092E20] hover:text-white flex items-center gap-1 bg-green-50 hover:bg-[#092E20] px-3 py-1.5 rounded-lg transition-all cursor-pointer border border-[#22C55E]/20"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Product</span>
              </button>
            </div>

            <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
              {(formData.products || []).map((item, index) => (
                <div key={index} className="p-3 bg-gray-50/50 rounded-xl border border-gray-200 relative space-y-3 shadow-2xs hover:border-[#22C55E]/30 transition-all">
                  <div className="flex items-center justify-between">
                    <span className="text-[10.5px] font-bold text-[#092E20]">Product Row #{index + 1}</span>
                    {(formData.products?.length || 0) > 1 && (
                      <button
                        type="button"
                        onClick={() => handleDeleteItem(index)}
                        className="text-red-500 hover:text-white p-1 rounded-lg hover:bg-red-500 transition-colors cursor-pointer"
                        title="Delete this row"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Primary Row: Label Name + Material Selection */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="block text-[9px] font-bold text-gray-400 uppercase">Label Name</label>
                      <input
                        type="text"
                        required
                        value={item.labelName || ''}
                        onChange={(e) => handleItemChange(index, 'labelName', e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs outline-hidden focus:border-[#22C55E] transition-all text-gray-800"
                        placeholder="e.g. Ponca Ghee Labels"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[9px] font-bold text-gray-400 uppercase">Material Type</label>
                      <select
                        value={item.materialType || 'Chromo'}
                        onChange={(e) => handleItemChange(index, 'materialType', e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-lg p-1.5 text-xs outline-hidden cursor-pointer focus:border-[#22C55E] transition-colors text-gray-700"
                      >
                        <option value="Chromo">Chromo</option>
                        <option value="White PP">White PP</option>
                        <option value="Silver PP">Silver PP</option>
                        <option value="Hologram">Hologram</option>
                        <option value="Barcode Label">Barcode Label</option>
                        <option value="Roll Form">Roll Form</option>
                        <option value="Transparent">Transparent</option>
                      </select>
                    </div>
                  </div>

                  {/* Operational Row: Size, Quantity, Rate, Amount */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="space-y-1">
                      <label className="block text-[9px] font-bold text-gray-400 uppercase">Size</label>
                      <input
                        type="text"
                        required
                        value={item.size || ''}
                        onChange={(e) => handleItemChange(index, 'size', e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs outline-hidden font-mono text-gray-750"
                        placeholder="100mm x 50mm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[9px] font-bold text-gray-400 uppercase">Quantity</label>
                      <input
                        type="number"
                        required
                        min={0}
                        value={item.quantity || 0}
                        onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs outline-hidden font-mono text-gray-750"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[9px] font-bold text-gray-400 uppercase">Rate/Label</label>
                      <input
                        type="number"
                        required
                        step="0.0001"
                        min={0}
                        value={item.rate || 0}
                        onChange={(e) => handleItemChange(index, 'rate', e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs outline-hidden font-mono text-gray-750"
                      />
                    </div>
                    <div className="space-y-1 col-span-2 sm:col-span-1">
                      <label className="block text-[9px] font-bold text-gray-400 uppercase">Amount</label>
                      <div className="w-full bg-gray-100 border border-transparent rounded-lg p-2 text-xs font-mono text-emerald-800 font-bold truncate">
                        {formatCurrency(item.amount || 0, 2)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-gray-400 uppercase">GST Rate (%)</label>
              <select
                name="gst"
                value={formData.gst || 18}
                onChange={handleChange}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs outline-hidden cursor-pointer font-mono font-bold text-gray-750"
              >
                <option value={0}>0% (Exempt)</option>
                <option value={5}>5%</option>
                <option value={12}>12%</option>
                <option value={18}>18% (Standard)</option>
                <option value={28}>28%</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-gray-400 uppercase">Remarks notes</label>
              <textarea
                name="remarks"
                value={formData.remarks || ''}
                onChange={handleChange}
                rows={1}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs outline-hidden resize-none leading-relaxed text-gray-600 focus:bg-white focus:border-[#22C55E]"
              />
            </div>
          </div>

          {/* Inline Arithmetic computation summary */}
          <div className="p-4 bg-gray-50 rounded-xl space-y-2 text-xs border border-gray-150">
            <div className="flex justify-between">
              <span className="text-gray-500 font-medium">Subtotal (Ex. Taxes)</span>
              <span className="font-mono text-gray-800 font-bold">{formatCurrency(subTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 font-medium">GST / Taxes ({formData.gst || 18}%)</span>
              <span className="font-mono text-gray-800 font-bold">{formatCurrency(gstAmount)}</span>
            </div>
            <div className="border-t border-gray-200 pt-2 flex justify-between font-bold text-sm text-[#092E20]">
              <span>GRAND PRICE TOTAL:</span>
              <span className="font-mono text-emerald-800 text-base">{formatCurrency(grandTotal)}</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 bg-[#092E20] hover:bg-[#0F5132] active:bg-black text-white hover:shadow-md transition-all rounded-xl font-bold font-display uppercase tracking-wider text-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-45 select-none"
            id="btn-trigger-pdf-save"
          >
            {saving ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Check className="w-4 h-4 text-[#22C55E] stroke-[3px]" />
                <span>{editingQuotationId ? 'Save & Update Quotation PDF' : 'Save & Generate Invoice PDF'}</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* RIGHT: Quotation Audit history (7 columns) */}
      <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-gray-200 shadow-xs flex flex-col justify-between">
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-150">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-green-50 text-[#092E20]">
                <FileText className="w-5 h-5" />
              </span>
              <h2 className="text-lg font-bold text-gray-800 font-display">Completed Quotations History</h2>
            </div>
            <span className="text-xs bg-gray-100 text-[#092E20] font-bold px-2.5 py-0.5 rounded-full font-mono border border-gray-200 shadow-2xs">
              {quotations.length} Active Records
            </span>
          </div>

          <p className="text-xs text-gray-500 leading-relaxed">
            All generated PDF quotations are permanently backed up in Firestore in real-time. You can trigger immediate workspace PDF downloads for clients of any listed quotation.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-100/80 text-gray-600 font-bold border-b border-gray-200">
                  <th className="p-3 rounded-l-lg">Quotation ID / Client Name</th>
                  <th className="p-3">Products Breakdown</th>
                  <th className="p-3">Price Total</th>
                  <th className="p-3 text-center rounded-r-lg">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-sans">
                {quotations.map(q => {
                  const products = getProductsForQuotation(q);

                  return (
                    <tr 
                      key={q.id || ''} 
                      className="hover:bg-gray-50/70 transition-colors cursor-pointer group"
                      onClick={() => setSelectedQuotationForView(q)}
                    >
                      <td className="p-3">
                        <div className="space-y-1">
                          <div className="inline-block bg-green-50 group-hover:bg-[#22C55E]/10 text-[#092E20] group-hover:text-emerald-700 font-mono font-bold text-[10px] px-1.5 py-0.5 rounded border border-green-200">
                            {q.quotationNumber || `VE-${q.id?.slice(0, 4).toUpperCase()}`}
                          </div>
                          <div>
                            <p className="font-bold text-gray-800 transition-colors group-hover:text-emerald-800">{q.customerName}</p>
                            <p className="text-[10px] text-gray-400 font-semibold">{q.companyName}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        {products && products.length > 0 ? (
                          <div className="space-y-1">
                            <p className="font-semibold text-gray-700 text-[11px] leading-tight">
                              {products[0].labelName || 'Labels'} {products.length > 1 ? `(+${products.length - 1} more)` : ''}
                            </p>
                            <p className="text-[10px] text-gray-400 font-mono">
                              Total Qty: {products.reduce((sum, item) => sum + (item.quantity || 0), 0).toLocaleString('en-IN')}
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <p className="font-semibold text-gray-700">{q.product || 'Premium Custom Labels'}</p>
                            <p className="text-[10px] text-gray-400 font-mono text-xs">
                              Qty: {q.quantity?.toLocaleString('en-IN')} / Spec: {q.size}
                            </p>
                          </div>
                        )}
                      </td>
                      <td className="p-3 font-mono font-bold text-emerald-800">
                        {formatCurrency(q.grandTotal || q.total || 0, 2)}
                      </td>
                      <td className="p-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleGeneratePDF(q); }}
                            className="p-1.5 bg-green-50 text-[#092E20] hover:bg-[#092E20] hover:text-white rounded-lg border border-[#22C55E]/15 transition-all cursor-pointer shadow-3xs"
                            title="Download PDF Invoice"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleEditQuotation(q); }}
                            className="p-1.5 bg-amber-55 text-amber-800 hover:bg-amber-600 hover:text-white rounded-lg border border-amber-200/40 transition-all cursor-pointer shadow-3xs"
                            title="Edit Quotation"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); onDeleteQuotation(q.id); }}
                            className="p-1.5 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded-lg transition-all cursor-pointer border border-red-200/10 shadow-3xs"
                            title="Delete historical log"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {quotations.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-10 text-center text-gray-400">
                      No quotations exist in database history. Select leads to write and save quotes.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        
        {/* Help indicators */}
        <div className="mt-8 p-4 bg-green-50/20 rounded-xl flex gap-3 text-xs text-[#092E20] border border-green-100">
          <TrendingUp className="w-5 h-5 shrink-0 text-[#22C55E] self-start" />
          <p className="leading-relaxed">
            All prices are automatically formatted and rounded conforming to standard Indian GST regulatory invoices. Multi-product estimates allow you to quote for unlimited items within one single combined client proposal.
          </p>
        </div>
      </div>

      {selectedQuotationForView && (
        <QuotationDetailModal
          isOpen={true}
          onClose={() => setSelectedQuotationForView(null)}
          quotation={selectedQuotationForView}
          onEdit={(q) => {
            // Trigger edit by setting and letting the state load
            handleEditQuotation(q);
            setSelectedQuotationForView(null);
          }}
          onDelete={async (id) => {
            await onDeleteQuotation(id);
            setSelectedQuotationForView(null);
          }}
        />
      )}
    </div>
  );
}
