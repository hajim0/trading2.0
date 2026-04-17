import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, isValid } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number) {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toLocaleString()} u`;
}

/**
 * 將 yyyy-MM-dd 字串或 Date 物件轉為本地顯示字串
 * 解決 timezone 偏移導致選 A 電變 B 電的問題
 */
export function safeFormat(date: string | Date | undefined | null, formatStr: string, fallback: string = '--'): string {
  if (!date) return fallback;
  
  let d: Date;
  if (typeof date === 'string') {
    // 如果是 yyyy-MM-dd 格式，手動解析，避免 new Date('yyyy-MM-dd') 被當成 UTC 0 點而偏移
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const [year, month, day] = date.split('-').map(Number);
      d = new Date(year, month - 1, day);
    } else {
      d = new Date(date);
    }
  } else {
    d = date;
  }

  if (!isValid(d)) return fallback;
  return format(d, formatStr);
}

/**
 * 取得今天本地日期的 yyyy-MM-dd 字串 (強制使用 Asia/Taipei 時區)
 */
export function getLocalDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

/**
 * 專為時區不偏移設計的日期解析
 */
export function parseLocalDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function formatDate(date: string | Date) {
  if (!date) return '--';
  const formatted = safeFormat(date, 'yyyy.MM.dd');
  return formatted === '--' ? '--' : formatted;
}
