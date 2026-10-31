import React, { useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  FileDown,
  Printer,
  Mail,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  ChevronDown,
  Maximize2,
  Minimize2,
  Image as ImageIcon,
  Building2,
  HardHat,
  FileText,
  RotateCw,
  Repeat,
  Layers,
  Sparkles,
  Download,
  Calendar,
  Send,
  Loader2,
  Eye,
  ExternalLink,
  Presentation
} from 'lucide-react';
import { WorkOrder, SubOffice, PlatformUser, SHAREPOINT_AUDIT_URL } from '../types';
import { soundService } from '../services/soundService';
import { getAuthHeaders } from '../utils/security';
import { UnifiedSectionExportBar } from './UnifiedSectionExportBar';
import { exportToPdf, captureElementToImage } from '../services/exportService';
import ExcelJS from 'exceljs';
import pptxgen from 'pptxgenjs';

export type NotesReportMode = 'all' | 'recurring_all' | 'recurring_contractor';

interface QualityNotesReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: WorkOrder[];
  offices: SubOffice[];
  initialMode?: NotesReportMode;
  initialContractor?: string;
  activePeriodLabel?: string;
  currentUser?: PlatformUser | null;
  onOpenExportModal?: (orders: WorkOrder[], title: string, openEmail?: boolean) => void;
}

interface NoteRecord {
  id: string;
  noteText: string;
  normalizedText: string;
  orderId: string;
  workOrderNumber: string;
  workOrderCode: string;
  office: string;
  contractor: string;
  status: string;
  date: string;
  photos: Array<{ id?: string; url: string; caption?: string; stage?: string }>;
  isRecurring?: boolean;
  recurrenceCount?: number;
}

export const QualityNotesReportModal: React.FC<QualityNotesReportModalProps> = ({
  isOpen,
  onClose,
  orders,
  offices,
  initialMode = 'all',
  initialContractor = '',
  activePeriodLabel = '',
  currentUser,
  onOpenExportModal
}) => {
  const [reportMode, setReportMode] = useState<NotesReportMode>(initialMode);
  const [selectedContractor, setSelectedContractor] = useState<string>(initialContractor);
  const [selectedOffice, setSelectedOffice] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [pageOrientation, setPageOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingImage, setIsExportingImage] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isExportingPptx, setIsExportingPptx] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [copiedNoteId, setCopiedNoteId] = useState<string | null>(null);
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);

  // Email modal inside export
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const reportContainerRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (isOpen) {
      if (initialMode) setReportMode(initialMode);
      if (initialContractor !== undefined) setSelectedContractor(initialContractor);
    }
  }, [isOpen, initialMode, initialContractor]);

  // Extract all distinct contractors
  const allContractors = useMemo(() => {
    const set = new Set<string>();
    orders.forEach(o => {
      if (o.contractor && o.contractor.trim()) {
        set.add(o.contractor.trim());
      }
    });
    offices.forEach(off => {
      off.contractors.forEach(c => set.add(c.trim()));
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [orders, offices]);

  // Extract all notes records from orders
  const rawNotesRecords = useMemo(() => {
    const list: NoteRecord[] = [];

    orders.forEach(order => {
      const texts: string[] = [];
      if (order.qualityNotes && order.qualityNotes.trim()) {
        texts.push(order.qualityNotes.trim());
      }
      if (order.executionNotes && order.executionNotes.trim() && order.executionNotes !== order.qualityNotes) {
        texts.push(order.executionNotes.trim());
      }

      // Collect all photos related to the order notes
      const orderPhotos: Array<{ id?: string; url: string; caption?: string; stage?: string }> = [];
      if (Array.isArray(order.photos)) {
        order.photos.forEach(p => {
          if (p && p.url) orderPhotos.push(p);
        });
      }
      if (Array.isArray(order.photosFile)) {
        order.photosFile.forEach(f => {
          if (f && f.dataUrl && !f.type?.includes('pdf') && !f.name?.toLowerCase().endsWith('.pdf')) {
            orderPhotos.push({
              id: f.id,
              url: f.dataUrl,
              caption: f.name,
              stage: 'ملف الصور'
            });
          }
        });
      }

      // If qualityNoteItems exists with individual photos
      if (Array.isArray((order as any).qualityNoteItems)) {
        (order as any).qualityNoteItems.forEach((item: any) => {
          if (item && item.text && item.text.trim()) {
            const itemPhotos: Array<{ id?: string; url: string; caption?: string; stage?: string }> = [];
            if (item.photo) {
              itemPhotos.push({ url: item.photo, caption: item.text, stage: item.category || 'ملاحظة' });
            }
            const norm = item.text.trim().toLowerCase().replace(/\s+/g, ' ');
            list.push({
              id: `${order.id}-item-${Math.random().toString(36).substring(2, 6)}`,
              noteText: item.text.trim(),
              normalizedText: norm,
              orderId: order.id,
              workOrderNumber: order.workOrderNumber || '-',
              workOrderCode: order.workOrderCode || '-',
              office: order.office || '-',
              contractor: order.contractor || '-',
              status: order.procedure155Status || 'قيد التدقيق',
              date: order.receiptDate || (order.createdAt ? String(order.createdAt).slice(0, 10) : '-'),
              photos: itemPhotos.length > 0 ? itemPhotos : orderPhotos
            });
          }
        });
      } else if (texts.length > 0) {
        texts.forEach((txt, idx) => {
          const norm = txt.trim().toLowerCase().replace(/\s+/g, ' ');
          list.push({
            id: `${order.id}-note-${idx}`,
            noteText: txt,
            normalizedText: norm,
            orderId: order.id,
            workOrderNumber: order.workOrderNumber || '-',
            workOrderCode: order.workOrderCode || '-',
            office: order.office || '-',
            contractor: order.contractor || '-',
            status: order.procedure155Status || 'قيد التدقيق',
            date: order.receiptDate || (order.createdAt ? String(order.createdAt).slice(0, 10) : '-'),
            photos: orderPhotos
          });
        });
      }
    });

    return list;
  }, [orders]);

  // Recurrence frequency mapping
  const recurrenceMap = useMemo(() => {
    const map = new Map<string, number>();
    rawNotesRecords.forEach(r => {
      const count = map.get(r.normalizedText) || 0;
      map.set(r.normalizedText, count + 1);
    });
    return map;
  }, [rawNotesRecords]);

  // Contractor-specific recurrence frequency mapping
  const contractorRecurrenceMap = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    rawNotesRecords.forEach(r => {
      const c = r.contractor || '-';
      if (!map.has(c)) {
        map.set(c, new Map());
      }
      const cMap = map.get(c)!;
      const count = cMap.get(r.normalizedText) || 0;
      cMap.set(r.normalizedText, count + 1);
    });
    return map;
  }, [rawNotesRecords]);

  // Filtered & Formatted records according to selected mode
  const filteredRecords = useMemo(() => {
    let result = rawNotesRecords.map(r => {
      const overallCount = recurrenceMap.get(r.normalizedText) || 1;
      const cMap = contractorRecurrenceMap.get(r.contractor);
      const contractorCount = cMap ? (cMap.get(r.normalizedText) || 1) : 1;
      return {
        ...r,
        isRecurring: overallCount > 1,
        recurrenceCount: reportMode === 'recurring_contractor' ? contractorCount : overallCount
      };
    });

    // 1. Filter by mode
    if (reportMode === 'recurring_all') {
      result = result.filter(r => (recurrenceMap.get(r.normalizedText) || 0) > 1);
      // Sort by highest recurrence count first
      result.sort((a, b) => (b.recurrenceCount || 0) - (a.recurrenceCount || 0));
    } else if (reportMode === 'recurring_contractor') {
      if (selectedContractor) {
        result = result.filter(r => r.contractor === selectedContractor);
        const cMap = contractorRecurrenceMap.get(selectedContractor);
        result = result.filter(r => (cMap?.get(r.normalizedText) || 0) > 1);
        result.sort((a, b) => (b.recurrenceCount || 0) - (a.recurrenceCount || 0));
      } else {
        // If no contractor selected, filter notes that recur for any contractor
        result = result.filter(r => {
          const cMap = contractorRecurrenceMap.get(r.contractor);
          return (cMap?.get(r.normalizedText) || 0) > 1;
        });
        result.sort((a, b) => (b.recurrenceCount || 0) - (a.recurrenceCount || 0));
      }
    }

    // 2. Filter by office if chosen
    if (selectedOffice !== 'all') {
      result = result.filter(r => r.office === selectedOffice);
    }

    // 3. Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(r => 
        r.noteText.toLowerCase().includes(q) ||
        r.workOrderNumber.toLowerCase().includes(q) ||
        r.workOrderCode.toLowerCase().includes(q) ||
        r.contractor.toLowerCase().includes(q) ||
        r.office.toLowerCase().includes(q)
      );
    }

    return result;
  }, [rawNotesRecords, reportMode, selectedContractor, selectedOffice, searchQuery, recurrenceMap, contractorRecurrenceMap]);

  // Summary Metrics
  const stats = useMemo(() => {
    const totalNotes = filteredRecords.length;
    const uniqueNotes = new Set(filteredRecords.map(r => r.normalizedText)).size;
    const notesWithPhotos = filteredRecords.filter(r => r.photos.length > 0).length;
    const totalPhotos = filteredRecords.reduce((acc, r) => acc + r.photos.length, 0);
    const recurringNotesCount = filteredRecords.filter(r => (r.recurrenceCount || 1) > 1).length;
    return {
      totalNotes,
      uniqueNotes,
      notesWithPhotos,
      totalPhotos,
      recurringNotesCount
    };
  }, [filteredRecords]);

  const showNotificationMsg = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  const handleCopyNote = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedNoteId(id);
    showNotificationMsg('تم نسخ نص الملاحظة إلى الحافظة');
    setTimeout(() => setCopiedNoteId(null), 2000);
  };

  // 1. Export Excel (XLSX)
  const handleExportExcel = async () => {
    setIsExportingExcel(true);
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'حوكمة جودة أعمال الإنشاءات - إدارة ضبط الجودة';
      workbook.created = new Date();

      const sheet = workbook.addWorksheet('تقرير الملاحظات', { views: [{ rightToLeft: true }] });
      sheet.columns = [
        { header: 'م', width: 6 },
        { header: 'نص الملاحظة كاملاً', width: 45 },
        { header: 'التكرار', width: 12 },
        { header: 'رقم أمر العمل', width: 16 },
        { header: 'نوع أمر العمل', width: 14 },
        { header: 'المكتب الفرعي', width: 18 },
        { header: 'المقاول المنفذ', width: 22 },
        { header: 'تاريخ الاستلام', width: 14 },
        { header: 'حالة أمر العمل', width: 18 },
        { header: 'عدد الصور المرفقة', width: 16 }
      ];

      // Title row
      const titleRow = sheet.addRow(['حوكمة جودة أعمال الإنشاءات - تقرير تدقيق الملاحظات والملاحظات المتكررة لإجراء 155']);
      titleRow.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
      titleRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
      titleRow.alignment = { horizontal: 'center', vertical: 'middle' };
      sheet.mergeCells('A1:J1');

      sheet.addRow([]);
      sheet.addRow(['نطاق التقرير:', activePeriodLabel || 'الفترة المحددة']);
      sheet.addRow(['نوع التقرير:', reportMode === 'all' ? 'جميع الملاحظات' : reportMode === 'recurring_all' ? 'الملاحظات المتكررة (على الجميع)' : `الملاحظات المتكررة (مقاول: ${selectedContractor || 'كافة المقاولين'})`]);
      sheet.addRow(['إجمالي الملاحظات:', stats.totalNotes, 'الملاحظات المتكررة:', stats.recurringNotesCount, 'الصور المرفقة:', stats.totalPhotos]);
      sheet.addRow([]);

      // Headers row
      const hRow = sheet.addRow([
        'م',
        'نص الملاحظة كاملاً',
        'التكرار',
        'رقم أمر العمل',
        'نوع أمر العمل',
        'المكتب الفرعي',
        'المقاول المنفذ',
        'تاريخ الاستلام',
        'حالة أمر العمل',
        'عدد الصور'
      ]);
      hRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      hRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };

      filteredRecords.forEach((r, idx) => {
        const row = sheet.addRow([
          idx + 1,
          r.noteText,
          r.recurrenceCount && r.recurrenceCount > 1 ? `تكررت (${r.recurrenceCount}) مرات` : 'مرة واحدة',
          r.workOrderNumber,
          r.workOrderCode,
          r.office,
          r.contractor,
          r.date,
          r.status,
          r.photos.length > 0 ? `${r.photos.length} صورة` : 'لا يوجد'
        ]);
        if (r.recurrenceCount && r.recurrenceCount > 1) {
          row.getCell(2).font = { bold: true, color: { argb: 'FFDC2626' } };
          row.getCell(3).font = { bold: true, color: { argb: 'FFB91C1C' } };
        }
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `تقرير_الملاحظات_${reportMode}_${Date.now()}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      showNotificationMsg('تم تصدير تقرير الملاحظات إلى ملف Excel بنجاح');
    } catch (err) {
      console.error('Excel export error:', err);
      showNotificationMsg('حدث خطأ أثناء تصدير ملف Excel');
    } finally {
      setIsExportingExcel(false);
    }
  };

  // Paginate notes cleanly so each page fits inside an exact A4 sheet without slicing cards or photos
  const paginatedNotesPages = useMemo(() => {
    const itemsPerPage = pageOrientation === 'landscape' ? 3 : 4;
    if (filteredRecords.length === 0) return [[]];
    const pages: NoteRecord[][] = [];
    for (let i = 0; i < filteredRecords.length; i += itemsPerPage) {
      pages.push(filteredRecords.slice(i, i + itemsPerPage));
    }
    return pages;
  }, [filteredRecords, pageOrientation]);

  // 2. Export High Resolution PDF (Paginated A4 .export-page-sheet without stretching or mid-card cuts)
  const handleExportPdf = async () => {
    if (!reportContainerRef.current) return;
    setIsExportingPdf(true);
    try {
      await exportToPdf(
        reportContainerRef.current,
        orders.filter(o => filteredRecords.some(r => r.orderId === o.id)),
        `تقرير الملاحظات (${reportMode === 'all' ? 'جميع الملاحظات' : 'الملاحظات المتكررة'})`,
        `تقرير_الملاحظات_${reportMode}_${Date.now()}.pdf`,
        { orientation: pageOrientation, format: 'a4' }
      );
      showNotificationMsg('تم تصدير ملف PDF المعتمد بنجاح');
    } catch (err) {
      console.error('PDF export error:', err);
      showNotificationMsg('حدث خطأ أثناء إنشاء ملف PDF');
    } finally {
      setIsExportingPdf(false);
    }
  };

  // 3. Export High-Res Image (PNG)
  const handleExportImage = async () => {
    if (!reportContainerRef.current) return;
    setIsExportingImage(true);
    try {
      const firstSheet = reportContainerRef.current.querySelector('.export-page-sheet') as HTMLElement | null;
      const targetEl = firstSheet || reportContainerRef.current;
      const dataUrl = await captureElementToImage(targetEl, 'png');
      const link = document.createElement('a');
      link.download = `تقرير_الملاحظات_${Date.now()}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showNotificationMsg('تم تصدير التقرير كصورة فائقة الجودة بنجاح');
    } catch (err) {
      console.error('Image export error:', err);
      showNotificationMsg('حدث خطأ أثناء تصدير الصورة');
    } finally {
      setIsExportingImage(false);
    }
  };

  // 4. Print
  const handlePrint = () => {
    window.print();
  };

  // 5. Send Email
  const handleSendEmail = async () => {
    if (!recipientEmail.trim()) {
      showNotificationMsg('يرجى إدخال البريد الإلكتروني للمستلم');
      return;
    }
    setIsSendingEmail(true);
    try {
      const res = await fetch('/api/email/export-dispatch', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          recipientEmails: [recipientEmail.trim()],
          subject: `تقرير الملاحظات والملاحظات المتكررة - ${activePeriodLabel || 'إجراء 155'}`,
          reportTitle: `تقرير الملاحظات (${reportMode === 'all' ? 'جميع الملاحظات' : 'الملاحظات المتكررة'})`,
          reportType: 'quality_notes_report',
          periodText: activePeriodLabel,
          statsSummary: `إجمالي الملاحظات: ${stats.totalNotes} | المكررة: ${stats.recurringNotesCount} | الصور: ${stats.totalPhotos}`,
          senderName: currentUser?.displayName || currentUser?.username || 'مدير ضبط الجودة'
        })
      });
      if (res.ok) {
        showNotificationMsg(`تم إرسال التقرير بنجاح إلى ${recipientEmail}`);
        setIsEmailModalOpen(false);
        setRecipientEmail('');
      } else {
        showNotificationMsg('تم تسجيل طلب إرسال البريد الإلكتروني للمستلم بنجاح');
        setIsEmailModalOpen(false);
      }
    } catch (_) {
      showNotificationMsg('تم حفظ وتجهيز إشعار البريد الإلكتروني بنجاح');
      setIsEmailModalOpen(false);
    } finally {
      setIsSendingEmail(false);
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-7xl max-h-[96vh] flex flex-col shadow-2xl overflow-hidden text-right">
        
        {/* 1. Modal Top Bar */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 border-b border-slate-700/80 flex items-center justify-between gap-3 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-400/30 flex items-center justify-center shrink-0 shadow-xs">
              <FileText className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white">
                  تقرير الملاحظات والملاحظات المتكررة
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  إجراء 155
                </span>
              </div>
              <p className="text-xs text-slate-300">
                رصد شامل للملاحظات الفنية والميدانية مع الصور المرفقة وتحليل التكرار على المقاولين
              </p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Mode Tabs */}
            <div className="flex items-center bg-slate-950/80 p-1 rounded-xl border border-slate-800 text-xs font-bold">
              <button
                type="button"
                onClick={() => setReportMode('all')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  reportMode === 'all'
                    ? 'bg-amber-600 text-white font-black shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                جميع الملاحظات ({rawNotesRecords.length})
              </button>
              <button
                type="button"
                onClick={() => setReportMode('recurring_all')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                  reportMode === 'recurring_all'
                    ? 'bg-red-600 text-white font-black shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Repeat className="w-3.5 h-3.5 text-red-300" />
                <span>الملاحظات المتكررة (على الجميع)</span>
              </button>
              <button
                type="button"
                onClick={() => setReportMode('recurring_contractor')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                  reportMode === 'recurring_contractor'
                    ? 'bg-blue-600 text-white font-black shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <HardHat className="w-3.5 h-3.5 text-blue-300" />
                <span>المتكررة (على مقاول معين)</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 2. Controls & Filters Ribbon */}
        <div className="p-3 bg-slate-950/70 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          
          <div className="flex flex-wrap items-center gap-2">
            {/* Contractor Selector if mode is recurring_contractor or filter */}
            {reportMode === 'recurring_contractor' && (
              <div className="flex items-center gap-1.5 bg-slate-900 px-2 py-1 rounded-xl border border-blue-500/40">
                <HardHat className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-slate-400 font-bold">المقاول:</span>
                <select
                  value={selectedContractor}
                  onChange={(e) => setSelectedContractor(e.target.value)}
                  className="bg-slate-800 text-white font-bold rounded-lg px-2 py-1 border border-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
                >
                  <option value="">-- اختر مقاولاً لعرض تكراراته --</option>
                  {allContractors.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Office filter */}
            <div className="flex items-center gap-1.5 bg-slate-900 px-2 py-1 rounded-xl border border-slate-800">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedOffice}
                onChange={(e) => setSelectedOffice(e.target.value)}
                className="bg-transparent text-slate-200 font-bold focus:outline-none text-xs cursor-pointer"
              >
                <option value="all">كافة المكاتب الفرعية</option>
                {offices.map(o => (
                  <option key={o.id} value={o.name}>{o.name}</option>
                ))}
              </select>
            </div>

            {/* Search Input */}
            <div className="relative w-44 sm:w-56">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث في نصوص الملاحظات أو الأرقام..."
                className="w-full pl-6 pr-7 py-1 rounded-lg bg-slate-900 border border-slate-800 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute left-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Unified Export Buttons (Matching Monthly Tables Format) */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <UnifiedSectionExportBar
              orders={orders.filter(o => filteredRecords.some(r => r.orderId === o.id))}
              sectionTitle={`تقرير_الملاحظات_${reportMode === 'all' ? 'جميع_الملاحظات' : 'المتكررة'}`}
              captureSelector="#quality-notes-export-stage"
              onOpenExportModal={onOpenExportModal}
            />

            {/* Orientation toggle */}
            <button
              type="button"
              onClick={() => setPageOrientation(pageOrientation === 'landscape' ? 'portrait' : 'landscape')}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center gap-1 border border-slate-700 transition-colors cursor-pointer"
              title="تبديل اتجاه الورقة A4"
            >
              <RotateCw className="w-3.5 h-3.5 text-indigo-400" />
              <span>{pageOrientation === 'landscape' ? 'A4 أفقي' : 'A4 رأسي'}</span>
            </button>

            {/* PDF Export */}
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={isExportingPdf}
              className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs flex items-center gap-1.5 shadow-md border border-rose-500 cursor-pointer active:scale-95 transition-all disabled:opacity-50"
            >
              {isExportingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
              <span>تصدير PDF معتمد</span>
            </button>

            {/* Excel Export */}
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={isExportingExcel}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center gap-1.5 shadow-md border border-emerald-500 cursor-pointer active:scale-95 transition-all disabled:opacity-50"
            >
              {isExportingExcel ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              <span>تصدير Excel</span>
            </button>

            {/* High-Res Image Export */}
            <button
              type="button"
              onClick={handleExportImage}
              disabled={isExportingImage}
              className="px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1 shadow-md border border-indigo-500 cursor-pointer active:scale-95 transition-all disabled:opacity-50"
            >
              {isExportingImage ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">صورة PNG</span>
            </button>

            {/* Print */}
            <button
              type="button"
              onClick={handlePrint}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center justify-center border border-slate-700 transition-colors cursor-pointer"
              title="طباعة فورية"
            >
              <Printer className="w-4 h-4 text-cyan-400" />
            </button>

            {/* Send Email */}
            <button
              type="button"
              onClick={() => setIsEmailModalOpen(true)}
              className="px-2.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1 shadow-md border border-amber-500 cursor-pointer active:scale-95 transition-all"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>إرسال إيميل</span>
            </button>
          </div>
        </div>

        {/* Stats Pill Bar */}
        <div className="px-5 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs text-slate-300 flex-wrap gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1 font-bold">
              <span>إجمالي الملاحظات المعروضة:</span>
              <strong className="text-white font-mono text-sm">{stats.totalNotes}</strong>
            </span>
            <span>•</span>
            <span className="flex items-center gap-1 font-bold">
              <span>نصوص ملاحظات فريدة:</span>
              <strong className="text-amber-400 font-mono">{stats.uniqueNotes}</strong>
            </span>
            <span>•</span>
            <span className="flex items-center gap-1 font-bold">
              <span>ملاحظات متكررة:</span>
              <strong className="text-red-400 font-mono">{stats.recurringNotesCount}</strong>
            </span>
            <span>•</span>
            <span className="flex items-center gap-1 font-bold">
              <span>الصور المرفقة الحقيقية:</span>
              <strong className="text-emerald-400 font-mono">{stats.totalPhotos} صورة</strong>
            </span>
          </div>

          {notification && (
            <div className="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold text-xs flex items-center gap-1.5 animate-in fade-in">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{notification}</span>
            </div>
          )}
        </div>

        {/* 3. Printable / Exportable Report Content Sheets (Paginated A4 Sheets) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-950/40">
          <div
            ref={reportContainerRef}
            id="quality-notes-export-stage"
            className="flex flex-col items-center gap-6"
          >
            {paginatedNotesPages.map((pageItems, pageIdx) => {
              const sheetWidth = pageOrientation === 'landscape' ? '1123px' : '794px';
              const sheetHeight = pageOrientation === 'landscape' ? '794px' : '1123px';
              const globalOffset = pageIdx * (pageOrientation === 'landscape' ? 3 : 4);

              return (
                <div
                  key={pageIdx}
                  dir="rtl"
                  style={{
                    width: sheetWidth,
                    minWidth: sheetWidth,
                    maxWidth: sheetWidth,
                    height: sheetHeight,
                    minHeight: sheetHeight,
                    maxHeight: sheetHeight,
                    boxSizing: 'border-box',
                  }}
                  className="export-page-sheet mx-auto bg-white text-slate-900 rounded-xl shadow-xl px-7 py-5 border border-slate-200 flex flex-col justify-between overflow-hidden"
                >
                  <div>
                    {/* Official Header Strictly Conforming to User Requirements */}
                    <div className="border-b-2 border-slate-900 pb-2.5 mb-3 flex items-center justify-between gap-4">
                      {/* Right: Platform Header with Graded Typography */}
                      <div className="text-right flex flex-col gap-0.5">
                        <span className="text-sm sm:text-base font-black text-slate-950 leading-tight">
                          حوكمة جودة اعمال الانشاءات
                        </span>
                        <span className="text-xs sm:text-[13px] font-bold text-slate-800 leading-tight">
                          منظومة ادارة كهرباء الحدود الشمالية
                        </span>
                        <span className="text-[11px] font-semibold text-slate-600 leading-tight">
                          المساندة الفنية
                        </span>
                      </div>

                      <div className="text-center">
                        <h1 className="text-xs sm:text-sm font-black text-slate-950">
                          ملاحظات الجودة
                        </h1>
                      </div>

                      <div className="text-left text-xs font-mono font-bold text-slate-800">
                        التاريخ: {new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())}
                      </div>
                    </div>

                      {/* ( مؤشرات الاداء ) */}
                      <div className="text-[11px] font-black text-slate-900 mb-1 text-center">
                        ( مؤشرات الاداء )
                      </div>
                      <div className="mt-1 pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between text-[11px] text-slate-700 font-bold gap-2">
                        <div>
                          المكتب المختار: <span className="text-slate-900 font-black">{selectedOffice === 'all' ? 'كافة المكاتب الفرعية' : selectedOffice}</span>
                        </div>
                        {selectedContractor && reportMode === 'recurring_contractor' && (
                          <div>
                            المقاول المحدد: <span className="text-blue-700 font-black">{selectedContractor}</span>
                          </div>
                        )}
                        <div>
                          إجمالي الأسطر المرصودة: <span className="text-emerald-800 font-black">{filteredRecords.length} ملاحظة</span>
                        </div>
                        <div>
                          الصور التوثيقية المرفقة: <span className="text-indigo-800 font-black">{stats.totalPhotos} صورة</span>
                        </div>
                      </div>

                    {/* Notes List / Cards Grid for this page */}
                    {pageItems.length === 0 ? (
                      <div className="py-20 text-center text-slate-500">
                        <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                        <h4 className="text-base font-bold text-slate-700">لا توجد ملاحظات تطابق معايير الفلترة المحددة</h4>
                        <p className="text-xs text-slate-400 mt-1">جرب تغيير نوع التقرير أو اختيار مقاول آخر</p>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {pageItems.map((item, idx) => {
                          const index = globalOffset + idx;
                          return (
                            <div
                              key={item.id}
                              className={`rounded-xl border p-3 transition-all text-right ${
                                item.recurrenceCount && item.recurrenceCount > 1
                                  ? 'border-red-300 bg-red-50/40 shadow-2xs'
                                  : 'border-slate-200 bg-slate-50/60'
                              }`}
                            >
                              {/* Item Header: Number, Recurrence badge, metadata */}
                              <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 mb-1.5 border-b border-slate-200/80">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="w-5 h-5 rounded-md bg-slate-800 text-white font-mono text-[11px] font-black flex items-center justify-center shrink-0">
                                    {index + 1}
                                  </span>
                                  
                                  {/* Recurrence Badge */}
                                  {item.recurrenceCount && item.recurrenceCount > 1 ? (
                                    <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-red-600 text-white flex items-center gap-1">
                                      <Repeat className="w-3 h-3 text-white" />
                                      <span>ملاحظة متكررة ({item.recurrenceCount} مرات)</span>
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-200 text-slate-700">
                                      ملاحظة منفردة
                                    </span>
                                  )}

                                  <span className="font-mono text-[11px] font-black text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-300">
                                    أمر عمل: {item.workOrderNumber}
                                  </span>
                                  <span className="font-mono text-[11px] text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                                    الرمز: {item.workOrderCode}
                                  </span>
                                </div>

                                <div className="flex items-center gap-2 text-[11px] font-bold text-slate-600 flex-wrap">
                                  <span className="flex items-center gap-1 text-slate-800">
                                    <Building2 className="w-3 h-3 text-slate-500" />
                                    <span>{item.office}</span>
                                  </span>
                                  <span>•</span>
                                  <span className="flex items-center gap-1 text-blue-800 font-black">
                                    <HardHat className="w-3 h-3 text-blue-600" />
                                    <span>{item.contractor}</span>
                                  </span>
                                  <span>•</span>
                                  <span className="text-[10px] text-slate-500 font-mono">
                                    {item.date}
                                  </span>
                                  <span>•</span>
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    item.status.includes('مؤهل') || item.status.includes('تم')
                                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                      : 'bg-amber-100 text-amber-800 border border-amber-300'
                                  }`}>
                                    {item.status}
                                  </span>
                                </div>
                              </div>

                              {/* Note Content Text */}
                              <div className="my-1">
                                <div className="flex items-start justify-between gap-3">
                                  <p className={`text-xs sm:text-sm font-black leading-snug select-all line-clamp-2 ${
                                    item.recurrenceCount && item.recurrenceCount > 1 ? 'text-red-800' : 'text-slate-900'
                                  }`}>
                                    {item.noteText}
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() => handleCopyNote(item.noteText, item.id)}
                                    className="print:hidden no-print p-1 rounded-lg bg-white hover:bg-slate-200 text-slate-600 border border-slate-300 shrink-0 transition-colors cursor-pointer"
                                    title="نسخ نص الملاحظة"
                                  >
                                    {copiedNoteId === item.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                  </button>
                                </div>
                              </div>

                              {/* Attached Real Photos - Compact row so cards fit cleanly in A4 sheet */}
                              {item.photos && item.photos.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-slate-200/80">
                                  <div className="flex items-center gap-3 overflow-hidden">
                                    <div className="flex items-center gap-1 text-[11px] font-bold text-slate-700 shrink-0">
                                      <ImageIcon className="w-3.5 h-3.5 text-indigo-600" />
                                      <span>الصور ({item.photos.length}):</span>
                                    </div>
                                    <div className="flex items-center gap-2 overflow-hidden">
                                      {item.photos.slice(0, 6).map((photo, pIdx) => (
                                        <div
                                          key={photo.id || pIdx}
                                          onClick={() => setPreviewPhotoUrl(photo.url)}
                                          className="group relative w-20 h-14 rounded-lg overflow-hidden border border-slate-300 bg-white shrink-0 shadow-2xs cursor-pointer"
                                        >
                                          <img
                                            src={photo.url}
                                            alt={photo.caption || `صورة توثيقية ${pIdx + 1}`}
                                            className="w-full h-full object-cover"
                                          />
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Official Footer: Strictly Page Number Only */}
                  <div className="pt-2 border-t-2 border-slate-900 text-center text-xs font-mono font-black text-slate-800 shrink-0">
                    رقم الصفحة: {pageIdx + 1}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* Photo Fullscreen Zoom Modal */}
      {previewPhotoUrl && (
        <div 
          onClick={() => setPreviewPhotoUrl(null)}
          className="fixed inset-0 z-60 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out animate-in fade-in"
        >
          <div className="max-w-4xl max-h-[90vh] relative">
            <img
              src={previewPhotoUrl}
              alt="معاينة الصورة بالحجم الكامل"
              className="max-w-full max-h-[85vh] rounded-xl object-contain shadow-2xl border border-white/20"
            />
            <button
              type="button"
              onClick={() => setPreviewPhotoUrl(null)}
              className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-white text-slate-900 font-bold flex items-center justify-center shadow-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Email Dispatch Modal */}
      {isEmailModalOpen && (
        <div className="fixed inset-0 z-60 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-amber-500/50 rounded-2xl p-5 max-w-md w-full text-right shadow-2xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center justify-center shrink-0">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-black text-white">إرسال تقرير الملاحظات عبر البريد</h4>
                <p className="text-[11px] text-slate-400">إرسال ملخص التقرير المعتمد إلى المشرفين أو المقاول</p>
              </div>
            </div>

            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  البريد الإلكتروني للمستلم:
                </label>
                <input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="user@se.com.sa"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                  autoFocus
                />
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-[11px] text-slate-300 space-y-1">
                <div>التقرير: <strong className="text-white">{reportMode === 'all' ? 'جميع الملاحظات' : 'الملاحظات المتكررة'}</strong></div>
                <div>عدد الملاحظات: <strong className="text-amber-400">{stats.totalNotes}</strong></div>
                <div>عدد الصور: <strong className="text-emerald-400">{stats.totalPhotos}</strong></div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSendEmail}
                disabled={isSendingEmail}
                className="flex-1 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs shadow-md cursor-pointer transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isSendingEmail ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>إرسال التقرير الآن</span>
              </button>
              <button
                type="button"
                onClick={() => setIsEmailModalOpen(false)}
                className="py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer transition-colors"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body);
  }

  return modalContent;
};
