import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  FileSpreadsheet,
  FileText,
  Presentation,
  Image as ImageIcon,
  Printer,
  Mail,
  ChevronDown,
  Loader2,
  Eye,
  Download,
  CheckCircle2
} from 'lucide-react';
import { WorkOrder, ColumnDefinition } from '../types';
import {
  exportToExcel,
  exportToPdf,
  exportToPptx,
  exportToCsv,
  captureElementToImage,
  exportOrdersDirectToPdf,
  exportOrdersDirectToImage
} from '../services/exportService';
import { soundService } from '../services/soundService';
import { calculateSmartPopoverPosition, PopoverCoords } from '../utils/popoverPosition';

interface UnifiedSectionExportBarProps {
  orders: WorkOrder[];
  sectionTitle: string;
  captureSelector?: string;
  columns?: ColumnDefinition[];
  onOpenExportModal?: (orders: WorkOrder[], title: string, openEmail?: boolean) => void;
  variant?: 'dark' | 'light' | 'compact';
  className?: string;
}

export const UnifiedSectionExportBar: React.FC<UnifiedSectionExportBarProps> = ({
  orders,
  sectionTitle,
  captureSelector,
  columns,
  onOpenExportModal,
  variant = 'dark',
  className = ''
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [dropdownCoords, setDropdownCoords] = useState<PopoverCoords | null>(null);
  const [exportingType, setExportingType] = useState<string | null>(null);
  const [lastExported, setLastExported] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const safeTitle = (sectionTitle || 'تقرير_المنصة').trim();
  const cleanFilePrefix = `إجراء155_${safeTitle.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}`;

  const updateCoords = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setDropdownCoords(calculateSmartPopoverPosition(rect, 380, { preferredWidth: 310, maxHeight: 440 }));
  };

  useEffect(() => {
    if (!isDropdownOpen) return;
    updateCoords();
    const handleOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        setIsDropdownOpen(false);
      }
    };
    const handleScrollOrResize = () => updateCoords();
    document.addEventListener('mousedown', handleOutside);
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [isDropdownOpen]);

  const markSuccess = (typeLabel: string) => {
    soundService.playActionSound('export');
    setLastExported(typeLabel);
    setTimeout(() => setLastExported(null), 2800);
  };

  const handleExcel = () => {
    setIsDropdownOpen(false);
    setExportingType('excel');
    try {
      exportToExcel(orders, safeTitle, `${cleanFilePrefix}.xlsx`, columns);
      markSuccess('Excel');
    } catch (err) {
      console.error('Excel export failed:', err);
    } finally {
      setExportingType(null);
    }
  };

  const handleCsv = () => {
    setIsDropdownOpen(false);
    setExportingType('csv');
    try {
      exportToCsv(orders, safeTitle, `${cleanFilePrefix}.csv`, columns);
      markSuccess('CSV');
    } catch (err) {
      console.error('CSV export failed:', err);
    } finally {
      setExportingType(null);
    }
  };

  const handlePptx = async () => {
    setIsDropdownOpen(false);
    setExportingType('pptx');
    try {
      await exportToPptx(orders, safeTitle, `${cleanFilePrefix}.pptx`, columns);
      markSuccess('PPTX');
    } catch (err) {
      console.error('PPTX export failed:', err);
    } finally {
      setExportingType(null);
    }
  };

  const handlePdf = async () => {
    setIsDropdownOpen(false);
    setExportingType('pdf');
    try {
      const targetEl = captureSelector
        ? (document.querySelector(captureSelector) as HTMLElement | null)
        : null;
      if (targetEl) {
        await exportToPdf(
          targetEl,
          orders,
          safeTitle,
          `${cleanFilePrefix}.pdf`,
          { orientation: 'landscape', format: 'a4', marginMm: 0 },
          columns
        );
      } else {
        await exportOrdersDirectToPdf(orders, safeTitle, `${cleanFilePrefix}.pdf`, columns);
      }
      markSuccess('PDF');
    } catch (err) {
      console.error('PDF export failed:', err);
    } finally {
      setExportingType(null);
    }
  };

  const handleImage = async () => {
    setIsDropdownOpen(false);
    setExportingType('image');
    try {
      const targetEl = captureSelector
        ? (document.querySelector(captureSelector) as HTMLElement | null)
        : null;
      if (targetEl) {
        const innerSheet = targetEl.classList.contains('export-page-sheet')
          ? targetEl
          : (targetEl.querySelector<HTMLElement>('.export-page-sheet') || targetEl);
        const dataUrl = await captureElementToImage(innerSheet, 'png');
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `${cleanFilePrefix}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        markSuccess('PNG');
      } else {
        await exportOrdersDirectToImage(orders, safeTitle, `${cleanFilePrefix}.png`, columns);
        markSuccess('PNG');
      }
    } catch (err) {
      console.error('Image export failed:', err);
    } finally {
      setExportingType(null);
    }
  };

  const handlePrint = () => {
    setIsDropdownOpen(false);
    window.print();
  };

  const handlePreviewModal = () => {
    setIsDropdownOpen(false);
    if (onOpenExportModal) {
      onOpenExportModal(orders, safeTitle, false);
    } else {
      handlePdf();
    }
  };

  const handleEmailExport = () => {
    setIsDropdownOpen(false);
    if (onOpenExportModal) {
      onOpenExportModal(orders, safeTitle, true);
    }
  };

  const isLight = variant === 'light';

  return (
    <div className={`inline-flex items-center gap-1.5 flex-wrap print:hidden ${className}`} dir="rtl">
      {/* Quick Direct Excel Button */}
      <button
        type="button"
        onClick={handleExcel}
        disabled={Boolean(exportingType)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400/50 shadow-xs transition-all cursor-pointer active:scale-95 disabled:opacity-50 whitespace-nowrap"
        title={`تصدير ${safeTitle} إلى ملف Excel منسق`}
      >
        {exportingType === 'excel' ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-100" />
        )}
        <span>Excel</span>
      </button>

      {/* Quick Direct PDF Button */}
      <button
        type="button"
        onClick={handlePdf}
        disabled={Boolean(exportingType)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-500 text-white border border-rose-400/50 shadow-xs transition-all cursor-pointer active:scale-95 disabled:opacity-50 whitespace-nowrap"
        title={`تصدير ${safeTitle} إلى ملف PDF رسمي`}
      >
        {exportingType === 'pdf' ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <FileText className="w-3.5 h-3.5 text-rose-100" />
        )}
        <span>PDF</span>
      </button>

      {/* Quick Email Export Button */}
      {onOpenExportModal && (
        <button
          type="button"
          onClick={handleEmailExport}
          disabled={Boolean(exportingType)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-black bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white border border-blue-400/50 shadow-xs transition-all cursor-pointer active:scale-95 disabled:opacity-50 whitespace-nowrap"
          title={`إرسال ${safeTitle} عبر البريد الإلكتروني مع المرفق`}
        >
          <Mail className="w-3.5 h-3.5 text-amber-300" />
          <span>تصدير بالإيميل</span>
        </button>
      )}

      {/* Comprehensive Export & Preview Hub Dropdown Button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsDropdownOpen(prev => !prev)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-black border transition-all cursor-pointer active:scale-95 whitespace-nowrap ${
          isDropdownOpen
            ? 'bg-amber-500 text-slate-950 border-amber-300 shadow-md ring-2 ring-amber-400/40'
            : isLight
            ? 'bg-slate-900 hover:bg-slate-800 text-white border-slate-700 shadow-xs'
            : 'bg-slate-800/90 hover:bg-slate-700 text-amber-300 border-amber-500/40 shadow-xs'
        }`}
        title="خيارات التصدير الشامل والطباعة والمعاينة (مماثل لجدول أوامر العمل)"
      >
        <Download className="w-3.5 h-3.5" />
        <span>خيارات التصدير</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
      </button>

      {lastExported && (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[10px] font-black animate-in fade-in">
          <CheckCircle2 className="w-3 h-3" />
          <span>تم تصدير {lastExported}</span>
        </span>
      )}

      {/* Portal-rendered Dropdown Menu Above All Page Elements */}
      {isDropdownOpen &&
        dropdownCoords &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={dropdownRef}
            dir="rtl"
            style={{
              position: 'fixed',
              top: `${dropdownCoords.top}px`,
              left: `${dropdownCoords.left}px`,
              width: '305px',
              maxHeight: `${dropdownCoords.maxHeight}px`,
              zIndex: 999999
            }}
            className="bg-slate-900/98 backdrop-blur-2xl border-2 border-slate-700 rounded-2xl shadow-[0_24px_60px_rgba(0,0,0,0.85)] overflow-y-auto p-2 text-right font-['Cairo',sans-serif] animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="px-3 py-2 border-b border-slate-800 mb-1.5 flex items-center justify-between">
              <div>
                <div className="text-xs font-black text-white">منظومة التصدير الموحدة</div>
                <div className="text-[10px] text-slate-400 font-bold truncate max-w-[190px]">{safeTitle}</div>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono font-black">
                {orders.length} أمر
              </span>
            </div>

            <div className="space-y-1">
              {onOpenExportModal && (
                <button
                  type="button"
                  onClick={handlePreviewModal}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-indigo-600/30 to-blue-600/20 hover:from-indigo-600 hover:to-blue-600 text-indigo-200 hover:text-white border border-indigo-500/30 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-cyan-300" />
                    <span>معاينة وتصدير شامل (نمط الجدول)</span>
                  </div>
                  <span className="text-[10px] font-mono bg-black/30 px-1.5 py-0.5 rounded">A4/A3</span>
                </button>
              )}

              {onOpenExportModal && (
                <button
                  type="button"
                  onClick={handleEmailExport}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-blue-600/30 to-cyan-600/20 hover:from-blue-600 hover:to-cyan-600 text-blue-200 hover:text-white border border-blue-500/30 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-amber-300" />
                    <span>إرسال التقرير بالإيميل مع المرفق</span>
                  </div>
                  <span className="text-[10px] font-mono bg-black/30 px-1.5 py-0.5 rounded">فوري</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleExcel}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-bold text-slate-200 hover:bg-emerald-600/25 hover:text-emerald-200 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  <span>تصدير جدول Excel معتمد (.xlsx)</span>
                </div>
                <span className="text-[10px] font-mono text-emerald-400 font-bold">XLSX</span>
              </button>

              <button
                type="button"
                onClick={handlePdf}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-bold text-slate-200 hover:bg-rose-600/25 hover:text-rose-200 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-rose-400" />
                  <span>تصدير مستند PDF رسمي (.pdf)</span>
                </div>
                <span className="text-[10px] font-mono text-rose-400 font-bold">PDF</span>
              </button>

              <button
                type="button"
                onClick={handlePptx}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-bold text-slate-200 hover:bg-amber-600/25 hover:text-amber-200 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Presentation className="w-4 h-4 text-amber-400" />
                  <span>تصدير عرض تقديمي (.pptx)</span>
                </div>
                <span className="text-[10px] font-mono text-amber-400 font-bold">PPTX</span>
              </button>

              <button
                type="button"
                onClick={handleCsv}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-bold text-slate-200 hover:bg-teal-600/25 hover:text-teal-200 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-teal-400" />
                  <span>تصدير ملف بيانات (.csv)</span>
                </div>
                <span className="text-[10px] font-mono text-teal-400 font-bold">CSV</span>
              </button>

              <button
                type="button"
                onClick={handleImage}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-bold text-slate-200 hover:bg-sky-600/25 hover:text-sky-200 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-sky-400" />
                  <span>تصدير صورة عالية الدقة (.png)</span>
                </div>
                <span className="text-[10px] font-mono text-sky-400 font-bold">PNG</span>
              </button>

              <button
                type="button"
                onClick={handlePrint}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-bold text-slate-200 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer border-t border-slate-800 mt-1 pt-2"
              >
                <div className="flex items-center gap-2">
                  <Printer className="w-4 h-4 text-slate-400" />
                  <span>طباعة مباشرة</span>
                </div>
                <span className="text-[10px] font-mono text-slate-400">Print</span>
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
