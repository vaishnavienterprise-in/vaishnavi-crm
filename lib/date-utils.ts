/**
 * Central date and schedule helper modules for Vaishnavi Enterprise Sales CRM
 */

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function getTodayDateString(): string {
  // Returns local date string in YYYY-MM-DD format
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getTomorrowDateString(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getNextRecurringDate(dateStr: string, recurring: 'daily' | 'weekly' | 'monthly'): string {
  try {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const year = Number(parts[0]);
    const month = Number(parts[1]);
    const day = Number(parts[2]);
    const d = new Date(year, month - 1, day);
    if (recurring === 'daily') {
      d.setDate(d.getDate() + 1);
    } else if (recurring === 'weekly') {
      d.setDate(d.getDate() + 7);
    } else if (recurring === 'monthly') {
      d.setMonth(d.getMonth() + 1);
    }
    const ny = d.getFullYear();
    const nm = String(d.getMonth() + 1).padStart(2, '0');
    const nd = String(d.getDate()).padStart(2, '0');
    return `${ny}-${nm}-${nd}`;
  } catch (e) {
    return dateStr;
  }
}

export function getDateOfWeekday(dayName: string): string {
  const daysMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const targetLower = dayName.toLowerCase();
  const targetIndex = daysMap.indexOf(targetLower);
  
  if (targetIndex === -1) {
    return getTodayDateString();
  }

  const today = new Date();
  const todayIndex = today.getDay(); // 0 is Sunday, 1 is Monday ...
  
  const diff = targetIndex - todayIndex;
  const targetDate = new Date(today);
  targetDate.setDate(today.getDate() + diff);

  const year = targetDate.getFullYear();
  const month = String(targetDate.getMonth() + 1).padStart(2, '0');
  const day = String(targetDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isDateInCurrentWeek(dateStr: string): boolean {
  if (!dateStr) return false;
  try {
    const checkDate = new Date(dateStr);
    const today = new Date();
    
    // Start of week (Sunday)
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - today.getDay());
    sunday.setHours(0, 0, 0, 0);

    // End of week (Saturday)
    const saturday = new Date(sunday);
    saturday.setDate(sunday.getDate() + 6);
    saturday.setHours(23, 59, 59, 999);

    return checkDate >= sunday && checkDate <= saturday;
  } catch (e) {
    return false;
  }
}

export function isDateInCurrentMonth(dateStr: string): boolean {
  if (!dateStr) return false;
  try {
    const checkDate = new Date(dateStr);
    const today = new Date();
    return (
      checkDate.getFullYear() === today.getFullYear() &&
      checkDate.getMonth() === today.getMonth()
    );
  } catch (e) {
    return false;
  }
}

export function formatReadableDate(dateStr: string): string {
  if (!dateStr) return '-';
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      return date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    }
    return dateStr;
  } catch (e) {
    return dateStr;
  }
}

export function formatFirestoreTimestamp(timestamp: any): string {
  if (!timestamp) return '-';
  try {
    // If it is a firestore timestamp with seconds
    if (timestamp.seconds) {
      const date = new Date(timestamp.seconds * 1000);
      return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    const d = new Date(timestamp);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    return String(timestamp);
  } catch (e) {
    return '-';
  }
}
