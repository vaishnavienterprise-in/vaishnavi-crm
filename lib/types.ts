export type LeadStatus =
  | 'New Lead'
  | 'Contacted'
  | 'Quotation Sent'
  | 'Follow Up'
  | 'Negotiation'
  | 'Won'
  | 'Lost';

export type LeadPriority = 'Hot' | 'Warm' | 'Cold';

export type NextActionType =
  | 'Call'
  | 'WhatsApp'
  | 'Email'
  | 'Quotation'
  | 'Follow Up'
  | 'Meeting';

export type FollowUpActionType =
  | 'Call'
  | 'WhatsApp'
  | 'Email'
  | 'Meeting'
  | 'Quotation'
  | 'Reminder';

export interface Contact {
  name: string;
  designation: string;
  department: string;
  mobile: string;
  whatsapp: string;
  email: string;
  notes: string;
}

export interface Lead {
  id: string;
  customerName: string;
  companyName: string;
  phone: string;
  phones?: string[];
  whatsapp: string;
  email: string;
  emails?: string[];
  contacts?: Contact[];
  gstNumber?: string;
  website?: string;
  city: string;
  state: string;
  industry: string;
  requirement: string;
  leadSource: string;
  status: LeadStatus;
  priority: LeadPriority;
  assignedDate: string; // YYYY-MM-DD
  dayAssignment: string; // Monday, Tuesday, Wednesday, Thursday, Friday, Saturday Follow-up
  createdAt: any; // Firestore Timestamp
  updatedAt: any; // Firestore Timestamp
  lastCalledAt: any | null;
  lastWhatsAppSentAt: any | null;
  lastEmailSentAt: any | null;
  profileSentAt: any | null;
  profileSentMethod: 'WhatsApp' | 'Email' | null;
  nextAction: NextActionType;
  nextActionDate: string; // YYYY-MM-DD
  nextActionTime: string; // HH:MM
  ownerId: string;
  callCount?: number;
  notes?: string;
}

export interface CRMTask {
  id: string;
  title: string;
  description: string;
  dueDate: string; // YYYY-MM-DD
  dueTime?: string; // HH:MM
  priority: 'Low' | 'Medium' | 'High';
  status: 'Pending' | 'In Progress' | 'Completed';
  category?: 'Call' | 'Follow-up' | 'Quotation' | 'Meeting' | 'Purchase' | 'Payment Collection' | 'Personal' | 'Other';
  recurring?: 'none' | 'daily' | 'weekly' | 'monthly';
  leadId?: string; // Optional linked lead
  createdAt: any; // Firestore Timestamp
  ownerId: string;
}

export interface CRMReminder {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  leadId?: string; // Optional linked lead
  notes: string;
  createdAt: any; // Firestore Timestamp
  ownerId: string;
}

export interface FollowUp {
  id: string;
  leadId: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  priority: LeadPriority;
  notes: string;
  actionType: FollowUpActionType;
  createdAt: any; // Firestore Timestamp
  ownerId: string;
}

export interface Note {
  id: string;
  leadId: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  note: string;
  user: string;
  createdAt: any; // Firestore Timestamp
  ownerId: string;
}

export interface CallLog {
  id: string;
  leadId: string;
  date: any; // Firestore Timestamp
  notes: string;
  ownerId: string;
}

export interface WhatsAppLog {
  id: string;
  leadId: string;
  date: any; // Firestore Timestamp
  template: string;
  ownerId: string;
}

export interface QuotationItem {
  labelName: string;
  material: string;
  size: string;
  quantity: number;
  rate: number;
  amount: number;
}

export interface QuotationProduct {
  labelName: string;
  materialType: string;
  size: string;
  quantity: number;
  rate: number;
  amount: number;
}

export interface Quotation {
  id: string;
  leadId?: string;
  customerName: string;
  companyName: string;
  product: string;
  size: string;
  quantity: number;
  rate: number;
  gst: number; // percentage, e.g. 18
  total: number;
  remarks: string;
  createdAt: any; // Firestore Timestamp
  ownerId: string;
  items?: QuotationItem[];
  bankDetails?: string;
  hsnCode?: string;
  customerAddress?: string;
  deliveryAddress?: string;
  discountPct?: number;
  freightCharges?: number;
  quotationNumber?: string;
  subject?: string;
  products?: QuotationProduct[];
  subtotal?: number;
  grandTotal?: number;
}
