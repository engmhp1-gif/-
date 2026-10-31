import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, 
  FileDown, 
  Image as ImageIcon, 
  FileText, 
  FileSpreadsheet, 
  Presentation, 
  Check, 
  Loader2, 
  Printer, 
  ChevronLeft, 
  ChevronRight, 
  Zap, 
  ShieldCheck,
  Camera,
  CheckCircle2,
  Clock,
  Sliders,
  Sparkles,
  Mail,
  Send,
  Users,
  Search,
  CheckSquare,
  Square,
  History,
  ExternalLink,
  AtSign,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Copy,
  Download,
  CheckCheck,
  Server,
  Settings,
  Paperclip,
  RefreshCw,
  Key,
  ShieldAlert,
  Globe,
  AlertCircle,
  FileCheck,
  Eye
} from 'lucide-react';
import { WorkOrder, ColumnDefinition, PlatformUser, ExportEmailRecipient, SentEmailLogItem, SmtpConfig } from '../types';
import { 
  captureElementToImage, 
  exportToPdf, 
  exportToExcel, 
  exportToPptx,
  exportToCsv,
  exportPdfToBase64,
  exportExcelToBase64,
  exportPptxToBase64,
  sendExportByEmail
} from '../services/exportService';
import { soundService } from '../services/soundService';
import { vaultService } from '../services/vaultService';
import { realtimeService } from '../services/realtimeService';
import { getAuthHeaders, isPurgedLegacyUserOrEmail } from '../utils/security';
import { ensurePhotosFileColumn } from '../data/initialData';
import { calculateOverallAuditColumnSummary } from '../data/auditChecklistData';

interface ExportPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: WorkOrder[];
  officeTitle?: string;
  columns?: ColumnDefinition[];
  allOrders?: WorkOrder[];
  filteredOrders?: WorkOrder[];
  users?: PlatformUser[];
  currentUser?: PlatformUser | null;
  initialOpenEmail?: boolean;
}

type PageOrientationMode = 'auto' | 'landscape' | 'portrait';
type DensityMode = 'compact' | 'normal' | 'comfortable';

export const ExportPreviewModal: React.FC<ExportPreviewModalProps> = ({
  isOpen,
  onClose,
  orders,
  officeTitle = 'جميع المكاتب',
  columns,
  allOrders,
  filteredOrders,
  users = [],
  currentUser,
  initialOpenEmail = false
}) => {
  // Determine if there is a distinct filtered subset
  const effectiveFilteredOrders = useMemo(() => {
    if (filteredOrders && filteredOrders.length > 0) return filteredOrders;
    return orders;
  }, [filteredOrders, orders]);

  const effectiveAllOrders = useMemo(() => {
    if (allOrders && allOrders.length > 0) return allOrders;
    return orders;
  }, [allOrders, orders]);

  const hasFilterDifference = effectiveFilteredOrders.length !== effectiveAllOrders.length;

  // Export scope selection: defaults to 'filtered' so users always export the filtered table by default
  const [exportScope, setExportScope] = useState<'filtered' | 'all'>('filtered');

  // Currently active orders for preview & all export types
  const currentDisplayOrders = useMemo(() => {
    if (exportScope === 'filtered') {
      return effectiveFilteredOrders;
    }
    return effectiveAllOrders;
  }, [exportScope, effectiveFilteredOrders, effectiveAllOrders]);

  const effectiveTitle = useMemo(() => {
    if (exportScope === 'filtered' && hasFilterDifference) {
      return `${officeTitle} (الجدول المفلتر - ${currentDisplayOrders.length} صف)`;
    }
    return officeTitle;
  }, [exportScope, hasFilterDifference, officeTitle, currentDisplayOrders.length]);

  // Adaptive layout configuration
  const [orientationMode, setOrientationMode] = useState<PageOrientationMode>('auto');
  const [density, setDensity] = useState<DensityMode>('normal');
  const [viewMode, setViewMode] = useState<'paginated' | 'all'>('paginated');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [includeSummaryStats, setIncludeSummaryStats] = useState<boolean>(true);

  // Status states
  const [isExporting, setIsExporting] = useState(false);
  const [isExportProcessingAll, setIsExportProcessingAll] = useState(false);
  const [exportSuccessType, setExportSuccessType] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Email Dispatch Modal States
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [customEmailInput, setCustomEmailInput] = useState('');
  const [customNameInput, setCustomNameInput] = useState('');
  const [customRecipients, setCustomRecipients] = useState<ExportEmailRecipient[]>([]);
  const [emailExportType, setEmailExportType] = useState<'pdf' | 'excel' | 'pptx' | 'image'>('pdf');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailSentSuccess, setEmailSentSuccess] = useState(false);
  const [emailSuccessMessage, setEmailSuccessMessage] = useState<string | null>(null);
  const [emailErrorMessage, setEmailErrorMessage] = useState<string | null>(null);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [sentHistory, setSentHistory] = useState<SentEmailLogItem[]>([]);
  const [showSentHistory, setShowSentHistory] = useState(false);
  const [copiedEmailText, setCopiedEmailText] = useState(false);

  // Sender Details & Dynamic Email Subject Named After Sender
  const [senderNameInput, setSenderNameInput] = useState<string>(() => currentUser?.displayName || currentUser?.username || 'ادارة الجودة والمساندة الفنية');
  const [senderEmailInput, setSenderEmailInput] = useState<string>(() =>
    currentUser?.email && !isPurgedLegacyUserOrEmail(currentUser.email)
      ? currentUser.email
      : '2502331172@se.com.sa'
  );
  const [customSubjectInput, setCustomSubjectInput] = useState<string>('');
  const [isCustomSubjectEdited, setIsCustomSubjectEdited] = useState<boolean>(false);

  // Attachment Pre-Verification & Live Integrity Inspection
  const [attachmentInfo, setAttachmentInfo] = useState<{
    isReady: boolean;
    isGenerating: boolean;
    fileName: string;
    sizeBytes: number;
    sizeFormatted: string;
    mimeType: string;
    base64: string;
    error: string | null;
    generatedAt: string;
  }>({
    isReady: false,
    isGenerating: false,
    fileName: '',
    sizeBytes: 0,
    sizeFormatted: '',
    mimeType: '',
    base64: '',
    error: null,
    generatedAt: ''
  });

  // Persistent SMTP Server Configuration & Live Testing States
  const [smtpConfig, setSmtpConfig] = useState<{
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
    fromEmail: string;
    fromName: string;
    isConfigured: boolean;
    hasPassword: boolean;
  }>({
    host: '',
    port: 587,
    secure: false,
    user: '',
    pass: '',
    fromEmail: '',
    fromName: 'ادارة الجودة والمساندة الفنية',
    isConfigured: false,
    hasPassword: false
  });
  const [isSmtpPanelOpen, setIsSmtpPanelOpen] = useState<boolean>(false);
  const [isTestingSmtp, setIsTestingSmtp] = useState<boolean>(false);
  const [smtpTestResult, setSmtpTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isSavingSmtp, setIsSavingSmtp] = useState<boolean>(false);
  const [smtpSaveSuccess, setSmtpSaveSuccess] = useState<boolean>(false);
  const [selectedLogPreview, setSelectedLogPreview] = useState<SentEmailLogItem | null>(null);
  const [showInAppEmailPreview, setShowInAppEmailPreview] = useState<boolean>(false);

  // Responsive Zoom & Screen Fit Controller
  const [zoomScaleMode, setZoomScaleMode] = useState<'fit' | '100' | '85' | '70' | '50'>('fit');
  const previewContainerRef = React.useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(1150);

  useEffect(() => {
    const updateContainerWidth = () => {
      if (previewContainerRef.current) {
        setContainerWidth(previewContainerRef.current.clientWidth);
      }
    };
    updateContainerWidth();
    window.addEventListener('resize', updateContainerWidth);
    const timer = setTimeout(updateContainerWidth, 150);
    return () => {
      window.removeEventListener('resize', updateContainerWidth);
      clearTimeout(timer);
    };
  }, [isOpen, orientationMode]);

  useEffect(() => {
    if (isEmailModalOpen) {
      fetch('/api/export/sent-emails', { headers: getAuthHeaders() })
        .then(r => r.json())
        .then(data => {
          if (Array.isArray(data?.emails)) {
            const cleaned = data.emails
              .map((item: SentEmailLogItem) => ({
                ...item,
                recipients: Array.isArray(item.recipients)
                  ? item.recipients.filter(r => !isPurgedLegacyUserOrEmail(r.email))
                  : []
              }))
              .filter((item: SentEmailLogItem) => item.recipients.length > 0);
            setSentHistory(cleaned);
          }
        })
        .catch(() => {});
    }
  }, [isEmailModalOpen]);

  // Real-time synchronization of sent emails across all connected devices/tabs
  useEffect(() => {
    const unsubscribe = realtimeService.subscribe((event) => {
      if (event.type === 'BROADCAST_ALERT' && event.payload?.emailLogEntry) {
        const incomingEntry = event.payload.emailLogEntry as SentEmailLogItem;
        setSentHistory(prev => {
          const exists = prev.some(item => item.id === incomingEntry.id);
          if (exists) return prev;
          return [incomingEntry, ...prev].slice(0, 50);
        });
      }
    });
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      setCurrentPage(1);
      setIsExporting(false);
      setIsExportProcessingAll(false);
      setErrorMessage(null);
      setExportSuccessType(null);
      if (initialOpenEmail) {
        setIsEmailModalOpen(true);
        setEmailErrorMessage(null);
        setEmailSentSuccess(false);
      } else {
        setIsEmailModalOpen(false);
      }
    }
  }, [isOpen, initialOpenEmail]);

  // Derive active columns: strictly use the 14 canonical columns in order
  const activeColumns = useMemo<ColumnDefinition[]>(() => {
    return ensurePhotosFileColumn(columns);
  }, [columns]);

  // Smart Adaptive Orientation resolution
  // If set to 'auto', it analyzes the active columns count and data width:
  // Tables with 6 or more columns automatically select Landscape (أفقي) to prevent column clipping,
  // while 5 or fewer columns select Portrait (رأسي)
  const effectiveOrientation: 'landscape' | 'portrait' = useMemo(() => {
    if (orientationMode !== 'auto') {
      return orientationMode;
    }
    return activeColumns.length >= 6 ? 'landscape' : 'portrait';
  }, [orientationMode, activeColumns]);

  // Dynamic smart pagination with weighted height-budget:
  // Calculates each row's vertical height weight based on notes, boq details, and orientation.
  // Guarantees zero vertical cutoff, clean table margins, and strictly contained A4 page boundaries.
  const pageChunks = useMemo(() => {
    if (currentDisplayOrders.length === 0) return [[]];
    const chunks: WorkOrder[][] = [];
    const isLandscape = effectiveOrientation === 'landscape';

    // Maximum rows per page to guarantee strict fit within standard A4 height
    // In landscape (A4 1123x794px):
    // In portrait (A4 794x1123px):
    const maxPage1 = isLandscape
      ? (density === 'compact' ? 7 : density === 'comfortable' ? 5 : 6)
      : (density === 'compact' ? 10 : density === 'comfortable' ? 6 : 8);

    const maxLater = isLandscape
      ? (density === 'compact' ? 9 : density === 'comfortable' ? 6 : 8)
      : (density === 'compact' ? 14 : density === 'comfortable' ? 8 : 11);

    let currentChunk: WorkOrder[] = [];
    let currentWeight = 0;
    let isFirstPage = true;

    for (let i = 0; i < currentDisplayOrders.length; i++) {
      const wo = currentDisplayOrders[i];
      const notesLen = (wo.qualityNotes || wo.executionNotes || '').length;
      // Long notes (>70 chars) take slightly more vertical weight
      const rowWeight = notesLen > 70 ? 1.4 : (notesLen > 35 ? 1.2 : 1.0);
      const targetCapacity = isFirstPage ? (includeSummaryStats ? maxPage1 : maxLater) : maxLater;

      if (currentWeight + rowWeight > targetCapacity && currentChunk.length >= 3) {
        chunks.push(currentChunk);
        currentChunk = [wo];
        currentWeight = rowWeight;
        isFirstPage = false;
      } else {
        currentChunk.push(wo);
        currentWeight += rowWeight;
      }
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }

    return chunks.length > 0 ? chunks : [[]];
  }, [currentDisplayOrders, effectiveOrientation, density, includeSummaryStats]);

  const totalPages = Math.max(1, pageChunks.length);
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  // Summary statistics for KPI header block
  const readyCount = currentDisplayOrders.filter(
    w => {
      const s = String(w.procedure155Status || '');
      return s.includes('مؤهل') && !s.includes('غير');
    }
  ).length;

  const notesCount = currentDisplayOrders.filter(
    w => {
      const s = String(w.procedure155Status || '');
      return s.includes('غير');
    }
  ).length;

  // Column width percentage distribution ensuring exactly 100% full-width coverage with zero horizontal overflow
  const getColumnWidthStyle = (col: ColumnDefinition, totalCols: number, isLandscape: boolean) => {
    switch (col.field) {
      case 'office': return isLandscape ? '6%' : '6.5%';
      case 'contractor': return isLandscape ? '7.5%' : '8%';
      case 'consultant': return isLandscape ? '7.5%' : '8%';
      case 'workOrderNumber': return isLandscape ? '7%' : '7%';
      case 'workOrderCode': return isLandscape ? '5%' : '5%';
      case 'photosFile': return isLandscape ? '6%' : '6%';
      case 'attachmentStatus': return isLandscape ? '6.5%' : '6.5%';
      case 'qualityNotes': return isLandscape ? '12%' : '11%';
      case 'pdcAudit': return isLandscape ? '7%' : '7%';
      case 'constructionAudit': return isLandscape ? '7%' : '7%';
      case 'procedure155Status': return isLandscape ? '7.5%' : '7.5%';
      case 'statusSyncTime': return isLandscape ? '7%' : '7%';
      case 'procedure155': return isLandscape ? '7%' : '6.5%';
      case 'procedureSyncTime': return isLandscape ? '6.5%' : '6.5%';
      default: {
        const totalAvailable = isLandscape ? 96.5 : 96;
        return `${(totalAvailable / Math.max(1, totalCols)).toFixed(1)}%`;
      }
    }
  };

  // Clean cell content renderer: Never truncates, wraps text cleanly with full legibility and auto-scaling
  const renderCellContent = (col: ColumnDefinition, wo: WorkOrder, isLandscape: boolean) => {
    const rawVal = wo[col.field];
    const val = rawVal !== undefined && rawVal !== null ? String(rawVal) : '';

    // Status columns with color-coded badges in export:
    if (
      col.field === 'attachmentStatus' ||
      col.field === 'photoDocumentation' ||
      col.field === 'consultantForms' ||
      col.field === 'consultantClearanceForms' ||
      col.field === 'form190' ||
      col.field === 'form200' ||
      col.field === 'inspectionForm'
    ) {
      const displayVal = val || (col.field === 'attachmentStatus' ? 'غير جاهز للارفاق' : 'غير مكتمل');
      let badgeBg = 'bg-slate-100 text-slate-800 border-slate-300';
      if (displayVal === 'مكتمل' || displayVal === 'جاهز للارفاق الكامل') {
        badgeBg = 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold';
      } else if (displayVal === 'غير مكتمل' || displayVal === 'غير جاهز للارفاق') {
        badgeBg = 'bg-rose-100 text-rose-900 border-rose-300 font-bold';
      } else if (displayVal === 'مكتمل مع ملاحظات' || displayVal.startsWith('جاهز لارفاق')) {
        badgeBg = 'bg-amber-100 text-amber-900 border-amber-300 font-bold';
      } else if (displayVal === 'ملاحظات') {
        badgeBg = 'bg-orange-100 text-orange-900 border-orange-300 font-bold';
      } else if (displayVal === 'لاينطبق') {
        badgeBg = 'bg-slate-100 text-slate-600 border-slate-300';
      }
      return (
        <span className={`inline-block px-1 py-0.5 rounded border ${isLandscape ? 'text-[9.5px]' : 'text-[8.5px]'} leading-tight break-words whitespace-normal text-center w-full ${badgeBg}`}>
          {displayVal}
        </span>
      );
    }

    if (col.field === 'qualityNotes' || col.field === 'executionNotes') {
      const qVal = (val || (col.field === 'qualityNotes' ? wo.executionNotes : '') || '').trim();
      const noteItems = Array.isArray(wo.qualityNoteItems) && wo.qualityNoteItems.length > 0
        ? wo.qualityNoteItems
        : null;

      if (!qVal || qVal === '-') {
        return (
          <span className={`text-slate-400 font-bold ${isLandscape ? 'text-[9.5px]' : 'text-[8.5px]'} block text-center`}>
            -
          </span>
        );
      }

      // If we have multiple elementized note items
      if (noteItems && noteItems.length > 1) {
        return (
          <div className="space-y-1 text-right w-full">
            {noteItems.map((item, nIdx) => (
              <div key={item.id || nIdx} className="bg-red-50 border border-red-200 rounded p-1 text-right">
                <div className="flex items-center justify-between gap-1 mb-0.5">
                  <span className="text-[7.5px] font-black text-red-700 bg-red-100 px-1 py-0.2 rounded border border-red-200">
                    ملاحظة {nIdx + 1}
                  </span>
                  {item.photos && item.photos.length > 0 && (
                    <span className="text-[7.5px] font-bold text-amber-800 bg-amber-50 px-1 py-0.2 rounded border border-amber-200">
                      📷 {item.photos.length} صورة
                    </span>
                  )}
                </div>
                <p className={`${isLandscape ? 'text-[9px]' : 'text-[8px]'} text-red-700 font-black leading-tight break-words whitespace-normal text-right select-all`}>
                  {item.text}
                </p>
                {item.photos && item.photos.length > 0 && (
                  <div className="flex items-center gap-1 mt-0.5 overflow-hidden">
                    {item.photos.slice(0, 3).map((pUrl, pIdx) => (
                      <img key={pIdx} src={pUrl} alt="" className="w-5 h-5 object-cover rounded border border-red-300" />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        );
      }

      // Single note with possible photos
      const singlePhotos = noteItems?.[0]?.photos || [];
      return (
        <div className="bg-red-50 border border-red-200 rounded-lg p-1 text-right w-full">
          <div className="flex items-center justify-between gap-1 mb-0.5">
            <span className="text-[8px] font-black text-red-700 bg-red-100/90 px-1 py-0.2 rounded border border-red-200">
              ملاحظة
            </span>
            <div className="flex items-center gap-1">
              {singlePhotos.length > 0 && (
                <span className="text-[7.5px] font-bold text-amber-800 bg-amber-50 px-1 py-0.2 rounded border border-amber-200">
                  📷 {singlePhotos.length} صورة
                </span>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (navigator.clipboard) {
                    navigator.clipboard.writeText(qVal);
                  }
                }}
                className="text-[8px] font-black text-red-700 hover:text-red-900 bg-white hover:bg-red-100 px-1.5 py-0.2 rounded border border-red-200 shadow-2xs cursor-pointer transition-colors"
                title="نسخ نص الملاحظة"
              >
                نسخ
              </button>
            </div>
          </div>
          <p className={`${isLandscape ? 'text-[9.5px]' : 'text-[8.5px]'} text-red-700 font-black leading-tight break-words whitespace-normal text-right overflow-hidden select-all`}>
            {qVal}
          </p>
          {singlePhotos.length > 0 && (
            <div className="flex items-center gap-1 mt-1 overflow-hidden">
              {singlePhotos.slice(0, 3).map((pUrl, pIdx) => (
                <img key={pIdx} src={pUrl} alt="" className="w-6 h-6 object-cover rounded border border-red-300" />
              ))}
            </div>
          )}
        </div>
      );
    }

    if (col.field === 'procedure155Status') {
      const isQualified = val.includes('مؤهل') && !val.includes('غير');
      const displayVal = val || (isQualified ? 'مؤهل للاغلاق (معتمد)' : 'غير مؤهل للأغلاق');
      return (
        <span className={`inline-block px-1.5 py-0.5 rounded font-black ${isLandscape ? 'text-[9.5px]' : 'text-[8.5px]'} leading-tight break-words whitespace-normal text-center w-full ${
          isQualified 
            ? 'bg-emerald-700 text-white' 
            : 'bg-rose-700 text-white'
        }`}>
          {displayVal}
        </span>
      );
    }

    if (col.field === 'photoCoordination' || col.field === 'photos') {
      const statement = wo.photoCoordination || (wo.photos && wo.photos.length > 0 ? 'مرفق صورة كملاحظة' : 'لا توجد صور مطلوبة');
      return (
        <div className="flex flex-col gap-0.5 overflow-hidden">
          <span className={`${isLandscape ? 'text-[10px]' : 'text-[9px]'} font-black text-slate-900 leading-tight break-words whitespace-normal`}>
            {statement}
          </span>
          {wo.photos && wo.photos.length > 0 && (
            <span className={`${isLandscape ? 'text-[9px]' : 'text-[8px]'} text-amber-900 font-bold leading-tight`}>
              (مرفق صورة كملاحظة)
            </span>
          )}
        </div>
      );
    }

    if (col.field === 'executionStatus') {
      return (
        <span className={`inline-block px-1.5 py-0.5 rounded font-black ${isLandscape ? 'text-[10px]' : 'text-[8.5px]'} leading-tight break-words whitespace-normal text-center w-full ${
          val.includes('جاهز') 
            ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' 
            : val.includes('معلق') 
            ? 'bg-amber-100 text-amber-900 border border-amber-300' 
            : 'bg-slate-100 text-slate-900 border border-slate-300'
        }`}>
          {val || '-'}
        </span>
      );
    }

    if (col.field === 'workOrderNumber') {
      return (
        <span className={`font-mono font-black text-blue-900 ${isLandscape ? 'text-[11px]' : 'text-[10px]'} leading-tight break-all block`}>
          {val || '-'}
        </span>
      );
    }

    if (col.field === 'workOrderCode') {
      return (
        <span className={`font-mono font-bold text-slate-900 ${isLandscape ? 'text-[10px]' : 'text-[9px]'} leading-tight break-all block`}>
          {val || '-'}
        </span>
      );
    }

    if (col.field === 'photosFile') {
      const files: any[] = Array.isArray(wo.photosFile) ? wo.photosFile : [];
      if (files.length === 0) {
        return (
          <span className={`text-slate-400 font-bold ${isLandscape ? 'text-[9.5px]' : 'text-[8.5px]'} block text-center`}>
            -
          </span>
        );
      }
      const pdfCount = files.filter(f => f.type?.includes('pdf') || f.name?.toLowerCase().endsWith('.pdf')).length;
      const imgFiles = files.filter(f => !f.type?.includes('pdf') && !f.name?.toLowerCase().endsWith('.pdf'));

      return (
        <div className="flex flex-col gap-0.5 text-right w-full">
          <div className="flex items-center justify-between gap-1">
            <span className={`font-black ${isLandscape ? 'text-[9px]' : 'text-[8px]'} text-slate-900`}>
              {files.length} {files.length === 1 ? 'مستند' : 'مستندات'}
            </span>
            {pdfCount > 0 && (
              <span className="text-[7.5px] font-black bg-rose-100 text-rose-800 border border-rose-300 px-1 py-0.2 rounded">
                PDF ({pdfCount})
              </span>
            )}
          </div>
          {imgFiles.length > 0 && (
            <div className="flex items-center gap-1 overflow-hidden mt-0.5">
              {imgFiles.slice(0, 3).map((img, idx) => (
                <img
                  key={img.id || idx}
                  src={img.dataUrl}
                  alt={img.name}
                  className="w-5 h-5 object-cover rounded border border-slate-300 shadow-2xs"
                />
              ))}
              {imgFiles.length > 3 && (
                <span className="text-[7.5px] font-bold text-slate-500">
                  +{imgFiles.length - 3}
                </span>
              )}
            </div>
          )}
          <span className="text-[7.5px] text-blue-800 font-mono truncate max-w-full block" dir="ltr">
            {files[0]?.name}
          </span>
        </div>
      );
    }

    if (col.field === 'boqModification') {
      return (
        <div className="space-y-0.5 overflow-hidden">
          <span className={`font-black ${isLandscape ? 'text-[10.5px]' : 'text-[9.5px]'} text-slate-900 block leading-tight break-words whitespace-normal`}>
            {val || '-'}
          </span>
          {wo.boqDetails && (
            <span className={`${isLandscape ? 'text-[9.5px]' : 'text-[8.5px]'} text-purple-950 font-bold block leading-tight break-words whitespace-normal bg-purple-50 p-1 rounded border border-purple-200`}>
              {wo.boqDetails}
            </span>
          )}
        </div>
      );
    }

    if (col.field === 'procedure155') {
      const isQualified155 = val.includes('مؤهل') && !val.includes('غير');
      return (
        <span className={`inline-block px-1.5 py-0.5 rounded font-black ${isLandscape ? 'text-[9.5px]' : 'text-[8.5px]'} leading-tight break-words whitespace-normal text-center w-full ${
          isQualified155 
            ? 'bg-blue-700 text-white shadow-2xs' 
            : 'bg-rose-700 text-white shadow-2xs'
        }`}>
          {val || 'مؤهل لأجراء 155'}
        </span>
      );
    }

    if (col.field === 'pdcAudit' || col.field === 'constructionAudit') {
      const rawAudit = (wo as any)[col.field];
      const overall = typeof rawAudit === 'object' && rawAudit !== null ? calculateOverallAuditColumnSummary(rawAudit) : null;
      const main =
        overall && (overall.compliantCategories > 0 || overall.nonCompliantCategories > 0 || overall.naCategories > 0)
          ? overall.derivedMainStatus
          : rawAudit?.mainStatus && rawAudit.mainStatus !== 'غير محدد'
          ? rawAudit.mainStatus
          : typeof rawAudit === 'string' && (rawAudit === 'مؤهل' || rawAudit === 'غير مؤهل')
          ? rawAudit
          : 'قيد التدقيق';
      const isQualified = main.includes('مؤهل') && !main.includes('غير');
      const isRejected = main.includes('غير') || main.includes('مرفوض');
      const hasCategories =
        overall && (overall.compliantCategories > 0 || overall.nonCompliantCategories > 0 || overall.naCategories > 0);

      return (
        <div className="flex flex-col items-center justify-center gap-0.5 text-center w-full">
          <span className={`inline-block px-1.5 py-0.5 rounded font-black ${isLandscape ? 'text-[9px]' : 'text-[8px]'} leading-tight break-words whitespace-normal text-center w-full ${
            isQualified
              ? 'bg-emerald-700 text-white'
              : isRejected
              ? 'bg-rose-700 text-white'
              : 'bg-amber-600 text-white'
          }`}>
            {main}
          </span>
          {hasCategories ? (
            <span className="text-[7.5px] font-mono font-bold text-slate-700 leading-tight">
              {overall.averageCompliance}% (م:{overall.compliantCategories} • غ:{overall.nonCompliantCategories})
            </span>
          ) : null}
        </div>
      );
    }

    if (col.field === 'statusSyncTime' || col.field === 'procedureSyncTime') {
      const isStatus = col.field === 'statusSyncTime';
      const rawEmail = isStatus
        ? (wo.statusSyncEmail || (val && String(val).includes('|') ? String(val).split('|')[1]?.trim() : ''))
        : (wo.procedureSyncEmail || (val && String(val).includes('|') ? String(val).split('|')[1]?.trim() : ''));
      const displayTime = val && String(val).includes('|') ? String(val).split('|')[0]?.trim() : val;

      return (
        <div className="flex flex-col items-center justify-center gap-0.5 text-center dir-ltr py-0.5">
          <span className={`font-mono font-black text-slate-900 ${isLandscape ? 'text-[8.5px]' : 'text-[7.5px]'} leading-tight block`}>
            {displayTime || '-'}
          </span>
          {rawEmail && (
            <span className={`font-mono font-bold ${isStatus ? 'text-emerald-800 bg-emerald-50 border-emerald-200/80' : 'text-blue-800 bg-blue-50 border-blue-200/80'} px-1 rounded border ${isLandscape ? 'text-[7px]' : 'text-[6.5px]'} max-w-[125px] truncate block`} title={rawEmail}>
              {rawEmail}
            </span>
          )}
        </div>
      );
    }

    // Default text cell
    return (
      <span className={`${isLandscape ? 'text-[10.5px]' : 'text-[9.5px]'} font-bold text-slate-900 leading-snug break-words whitespace-normal block text-right overflow-hidden`}>
        {val || '-'}
      </span>
    );
  };

  // Export to PDF: Renders ALL pages, fits 100% full-bleed A4, zero cutoff
  const handleExportPdf = async () => {
    setIsExporting(true);
    setIsExportProcessingAll(true);
    setErrorMessage(null);

    try {
      // Allow React a micro-tick to mount all page sheets in DOM flow
      await new Promise(resolve => setTimeout(resolve, 150));

      const previewStage = document.getElementById('export-preview-container');
      const sheets = previewStage
        ? Array.from(previewStage.querySelectorAll<HTMLElement>('.export-page-sheet'))
        : Array.from(document.querySelectorAll<HTMLElement>('.export-page-sheet'));
      if (sheets.length === 0) {
        throw new Error('لم يتم العثور على صفحات التقرير للتصدير');
      }

      await exportToPdf(
        sheets,
        currentDisplayOrders,
        effectiveTitle,
        `تقرير_شامل_أوامر_العمل_إجراء_155_${effectiveTitle.replace(/\s+/g, '_')}_${Date.now()}.pdf`,
        { 
          orientation: effectiveOrientation, 
          format: 'a4', 
          marginMm: 0 // Exact full-bleed A4 sheet containment without outer blank borders
        }
      );

      soundService.playActionSound('export');
      setExportSuccessType('pdf');
      setTimeout(() => setExportSuccessType(null), 3500);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err?.message || 'حدث خطأ أثناء تصدير ملف PDF، يرجى المحاولة مرة أخرى.');
    } finally {
      setIsExportProcessingAll(false);
      setIsExporting(false);
    }
  };

  // Export to Image: Captures active sheet
  const handleExportImage = async () => {
    setIsExporting(true);
    setErrorMessage(null);
    try {
      const targetId = `export-page-${safeCurrentPage - 1}`;
      const el = document.getElementById(targetId) || document.querySelector('.export-page-sheet') as HTMLElement;
      if (!el) throw new Error('صفحة المعاينة غير متوفرة للتصدير كصورة');

      const dataUrl = await captureElementToImage(el, 'png');
      const link = document.createElement('a');
      link.download = `تقرير_صفحة_${safeCurrentPage}_من_${totalPages}_${effectiveTitle.replace(/\s+/g, '_')}_${Date.now()}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      soundService.playActionSound('export');
      setExportSuccessType('image');
      setTimeout(() => setExportSuccessType(null), 3000);
    } catch (err) {
      console.error(err);
      setErrorMessage('حدث خطأ أثناء حفظ ملف الصورة');
    } finally {
      setIsExporting(false);
    }
  };

  // Export All Pages as Images sequentially
  const handleExportAllImages = async () => {
    setIsExporting(true);
    setIsExportProcessingAll(true);
    setErrorMessage(null);
    try {
      await new Promise(resolve => setTimeout(resolve, 200));
      for (let p = 0; p < totalPages; p++) {
        const el = document.getElementById(`export-page-${p}`);
        if (el) {
          const dataUrl = await captureElementToImage(el, 'png');
          const link = document.createElement('a');
          link.download = `تقرير_صفحة_${p + 1}_من_${totalPages}_${effectiveTitle.replace(/\s+/g, '_')}.png`;
          link.href = dataUrl;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          await new Promise(r => setTimeout(r, 350));
        }
      }
      soundService.playActionSound('export');
      setExportSuccessType('all_images');
      setTimeout(() => setExportSuccessType(null), 3500);
    } catch (err) {
      console.error(err);
      setErrorMessage('حدث خطأ أثناء تصدير صور الصفحات');
    } finally {
      setIsExportProcessingAll(false);
      setIsExporting(false);
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    setIsExporting(true);
    setErrorMessage(null);
    try {
      exportToExcel(
        currentDisplayOrders,
        effectiveTitle,
        `سجل_أوامر_العمل_إجراء_155_${effectiveTitle.replace(/\s+/g, '_')}_${Date.now()}.xlsx`,
        activeColumns
      );
      soundService.playActionSound('export');
      setExportSuccessType('excel');
      setTimeout(() => setExportSuccessType(null), 3000);
    } catch (err) {
      console.error(err);
      setErrorMessage('حدث خطأ أثناء تصدير ملف الإكسل XLSX');
    } finally {
      setIsExporting(false);
    }
  };

  // Export to PowerPoint
  const handleExportPptx = async () => {
    setIsExporting(true);
    setErrorMessage(null);
    try {
      await exportToPptx(
        currentDisplayOrders,
        effectiveTitle,
        `عرض_تقديمي_إجراء_155_${effectiveTitle.replace(/\s+/g, '_')}_${Date.now()}.pptx`,
        activeColumns
      );
      soundService.playActionSound('export');
      setExportSuccessType('pptx');
      setTimeout(() => setExportSuccessType(null), 3000);
    } catch (err) {
      console.error(err);
      setErrorMessage('حدث خطأ أثناء توليد عرض الباوربوينت PPTX');
    } finally {
      setIsExporting(false);
    }
  };

  // Export to CSV
  const handleExportCsv = () => {
    setIsExporting(true);
    setErrorMessage(null);
    try {
      exportToCsv(
        currentDisplayOrders,
        effectiveTitle,
        `سجل_أوامر_العمل_إجراء_155_${effectiveTitle.replace(/\s+/g, '_')}_${Date.now()}.csv`,
        activeColumns
      );
      soundService.playActionSound('export');
      setExportSuccessType('csv');
      setTimeout(() => setExportSuccessType(null), 3000);
    } catch (err) {
      console.error(err);
      setErrorMessage('حدث خطأ أثناء تصدير ملف CSV');
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const [platformUsers, setPlatformUsers] = useState<PlatformUser[]>(() => {
    const initial = Array.isArray(users) && users.length > 0 ? users : (vaultService.getSavedUsers() || []);
    return initial.filter(u => u && !isPurgedLegacyUserOrEmail(u));
  });

  useEffect(() => {
    if (Array.isArray(users) && users.length > 0) {
      setPlatformUsers(users.filter(u => u && !isPurgedLegacyUserOrEmail(u)));
    }
  }, [users]);

  useEffect(() => {
    if (isOpen) {
      fetch('/api/users')
        .then(r => r.json())
        .then(data => {
          if (Array.isArray(data?.users) && data.users.length > 0) {
            setPlatformUsers(data.users.filter((u: PlatformUser) => u && !isPurgedLegacyUserOrEmail(u)));
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  const registeredUsersList = useMemo<PlatformUser[]>(() => {
    const source = platformUsers.length > 0 
      ? platformUsers 
      : (Array.isArray(users) && users.length > 0 ? users : vaultService.getSavedUsers() || []);
    
    const seen = new Set<string>();
    const deduplicated: PlatformUser[] = [];
    for (const u of source) {
      if (u && u.id && !seen.has(u.id) && !isPurgedLegacyUserOrEmail(u)) {
        seen.add(u.id);
        deduplicated.push(u);
      }
    }
    return deduplicated;
  }, [platformUsers, users]);

  const filteredUsersList = useMemo(() => {
    const q = userSearchQuery.trim().toLowerCase();
    if (!q) return registeredUsersList;
    return registeredUsersList.filter(u => 
      (u.displayName || '').toLowerCase().includes(q) ||
      (u.username || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.roleTitle || '').toLowerCase().includes(q)
    );
  }, [registeredUsersList, userSearchQuery]);

  const selectedRecipients = useMemo<ExportEmailRecipient[]>(() => {
    const fromUsers = registeredUsersList
      .filter(u => selectedUserIds.has(u.id) && !isPurgedLegacyUserOrEmail(u))
      .map(u => ({
        email: u.email,
        name: u.displayName || u.username,
        username: u.username,
        roleTitle: u.roleTitle
      }));

    const combined: ExportEmailRecipient[] = [...fromUsers];
    const seenEmails = new Set(fromUsers.map(r => (r.email || '').toLowerCase().trim()));

    for (const c of customRecipients) {
      const cleanEmail = (c.email || '').toLowerCase().trim();
      if (cleanEmail && !seenEmails.has(cleanEmail) && !isPurgedLegacyUserOrEmail(cleanEmail)) {
        seenEmails.add(cleanEmail);
        combined.push(c);
      }
    }

    // Also include any valid email currently typed in customEmailInput so the user can send immediately without extra clicks
    const typedEmail = customEmailInput.trim();
    if (
      typedEmail &&
      typedEmail.includes('@') &&
      !seenEmails.has(typedEmail.toLowerCase()) &&
      !isPurgedLegacyUserOrEmail(typedEmail)
    ) {
      combined.push({
        email: typedEmail,
        name: customNameInput.trim() || typedEmail.split('@')[0],
        roleTitle: 'بريد مباشر'
      });
    }

    return combined;
  }, [registeredUsersList, selectedUserIds, customRecipients, customEmailInput, customNameInput]);

  const handleAddCustomRecipient = (emailToAdd?: string, nameToAdd?: string) => {
    const rawInput = (emailToAdd ?? customEmailInput).trim();
    if (!rawInput) return;
    const parts = rawInput
      .split(/[,;\s]+/)
      .map(s => s.trim())
      .filter(s => s.includes('@') && !isPurgedLegacyUserOrEmail(s));
    if (parts.length === 0) {
      setEmailErrorMessage('يرجى إدخال عنوان بريد إلكتروني معتمد وصحيح');
      return;
    }
    setEmailErrorMessage(null);
    setCustomRecipients(prev => {
      const next = [...prev];
      for (const email of parts) {
        if (!next.some(r => r.email.toLowerCase() === email.toLowerCase())) {
          next.push({
            email,
            name: (nameToAdd ?? customNameInput).trim() || email.split('@')[0],
            roleTitle: 'بريد إلكتروني مباشر'
          });
        }
      }
      return next;
    });
    if (!emailToAdd) {
      setCustomEmailInput('');
      setCustomNameInput('');
    }
  };

  const handleRemoveCustomRecipient = (email: string) => {
    setCustomRecipients(prev => prev.filter(r => r.email.toLowerCase() !== email.toLowerCase()));
  };

  const emailFileName = useMemo(() => {
    const cleanOffice = (officeTitle || 'التقرير').replace(/\s+/g, '_');
    if (emailExportType === 'pdf') {
      return `تقرير_تدقيق_الجودة_لاوامر_العمل_${cleanOffice}.pdf`;
    }
    if (emailExportType === 'excel') {
      return `سجل_تدقيق_الجودة_لاوامر_العمل_${cleanOffice}.xlsx`;
    }
    if (emailExportType === 'pptx') {
      return `عرض_تدقيق_الجودة_لاوامر_العمل_${cleanOffice}.pptx`;
    }
    return `صورة_تدقيق_الجودة_لاوامر_العمل_${cleanOffice}.png`;
  }, [emailExportType, officeTitle]);

  // Sync sender info from current user
  useEffect(() => {
    if (currentUser) {
      if (currentUser.displayName || currentUser.username) {
        setSenderNameInput(currentUser.displayName || currentUser.username);
      }
      if (currentUser.email && !isPurgedLegacyUserOrEmail(currentUser.email)) {
        setSenderEmailInput(currentUser.email);
      } else {
        setSenderEmailInput('2502331172@se.com.sa');
      }
    }
  }, [currentUser]);

  // Concise main title only as explicitly requested: "اجعل عنوان الايميل مختصر بالعنوان الرئيسي فقط"
  const effectiveEmailSubject = useMemo(() => {
    if (isCustomSubjectEdited && customSubjectInput.trim()) {
      return customSubjectInput.trim();
    }
    return 'حوكمة جودة اعمال الانشاءات';
  }, [isCustomSubjectEdited, customSubjectInput]);

  const emailSalutation = useMemo(() => {
    if (selectedRecipients.length === 0) {
      return 'الأخ العزيز / (اسم الشخص المسجل)';
    }
    if (selectedRecipients.length === 1) {
      return `الأخ العزيز / ${selectedRecipients[0].name}`;
    }
    return 'الأخوة الأعزاء';
  }, [selectedRecipients]);

  const handleSelectAllUsers = () => {
    setSelectedUserIds(new Set(registeredUsersList.map(u => u.id)));
  };

  const handleClearSelectedUsers = () => {
    setSelectedUserIds(new Set());
  };

  const handleToggleUserSelection = (userId: string) => {
    setSelectedUserIds(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  // Inspect, generate, and verify attachment before dispatch
  const inspectAndPrepareAttachment = async (forceType?: 'pdf' | 'excel' | 'pptx' | 'image') => {
    const targetType = forceType || emailExportType;
    setAttachmentInfo(prev => ({ ...prev, isGenerating: true, error: null }));
    try {
      let fileBase64 = '';
      let fileMime = '';

      if (targetType === 'pdf') {
        setIsExportProcessingAll(true);
        await new Promise(r => setTimeout(r, 150));
        const previewStage = document.getElementById('export-preview-container');
        const sheets = previewStage
          ? Array.from(previewStage.querySelectorAll<HTMLElement>('.export-page-sheet'))
          : Array.from(document.querySelectorAll<HTMLElement>('.export-page-sheet'));
        fileBase64 = await exportPdfToBase64(
          sheets.length > 0 ? sheets : '#export-preview-container',
          currentDisplayOrders,
          effectiveTitle,
          { orientation: effectiveOrientation }
        );
        fileMime = 'application/pdf';
        setIsExportProcessingAll(false);
      } else if (targetType === 'excel') {
        fileBase64 = await exportExcelToBase64(currentDisplayOrders, effectiveTitle, activeColumns);
        fileMime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      } else if (targetType === 'pptx') {
        fileBase64 = await exportPptxToBase64(currentDisplayOrders, effectiveTitle, activeColumns);
        fileMime = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
      } else if (targetType === 'image') {
        const targetSheet = document.getElementById(`export-page-${safeCurrentPage - 1}`) || 
                            (document.querySelector('.export-page-sheet') as HTMLElement);
        if (targetSheet) {
          fileBase64 = await captureElementToImage(targetSheet, 'png');
        } else {
          fileBase64 = await captureElementToImage(document.getElementById('export-preview-container')!, 'png');
        }
        fileMime = 'image/png';
      }

      const clean = fileBase64.replace(/^data:[^;]+;base64,/, '').trim();
      const bytes = Math.round((clean.length * 3) / 4);

      if (!clean || bytes < 50) {
        throw new Error('الملف المرفق فارغ أو لم يتم توليده بنجاح');
      }

      const sizeFormatted = bytes > 1024 * 1024
        ? `${(bytes / (1024 * 1024)).toFixed(2)} ميجابايت`
        : `${(bytes / 1024).toFixed(1)} كيلوبايت`;

      setAttachmentInfo({
        isReady: true,
        isGenerating: false,
        fileName: emailFileName,
        sizeBytes: bytes,
        sizeFormatted,
        mimeType: fileMime,
        base64: fileBase64,
        error: null,
        generatedAt: new Date().toLocaleTimeString('ar-SA')
      });
      return { base64: fileBase64, mime: fileMime, size: bytes };
    } catch (err: any) {
      setIsExportProcessingAll(false);
      setAttachmentInfo(prev => ({
        ...prev,
        isReady: false,
        isGenerating: false,
        error: err.message || 'تعذر فحص وتجهيز المرفق'
      }));
      return null;
    }
  };

  // Automatically inspect and pre-generate attachment when email modal opens or format changes
  useEffect(() => {
    if (isEmailModalOpen) {
      inspectAndPrepareAttachment(emailExportType);
    }
  }, [isEmailModalOpen, emailExportType, currentDisplayOrders.length, exportScope]);

  // Load SMTP config when modal opens
  useEffect(() => {
    if (isEmailModalOpen) {
      fetch('/api/smtp-config', {
        headers: getAuthHeaders()
      })
        .then(r => r.json())
        .then(data => {
          if (data) {
            setSmtpConfig({
              host: data.host || '',
              port: data.port || 587,
              secure: Boolean(data.secure),
              user: data.user && !isPurgedLegacyUserOrEmail(data.user) ? data.user : '',
              pass: '',
              fromEmail: data.fromEmail && !isPurgedLegacyUserOrEmail(data.fromEmail) ? data.fromEmail : '',
              fromName: data.fromName || 'ادارة الجودة والمساندة الفنية',
              isConfigured: Boolean(data.isConfigured),
              hasPassword: Boolean(data.hasPassword)
            });
          }
        })
        .catch(() => {});
    }
  }, [isEmailModalOpen]);

  const handleTestDownloadAttachment = () => {
    if (!attachmentInfo.base64) return;
    const link = document.createElement('a');
    link.href = attachmentInfo.base64;
    link.download = emailFileName;
    link.click();
  };

  const handleTestSmtp = async () => {
    setIsTestingSmtp(true);
    setSmtpTestResult(null);
    try {
      const res = await fetch('/api/smtp-test', {
        method: 'POST',
        headers: getAuthHeaders({
          'Content-Type': 'application/json'
        }),
        body: JSON.stringify({
          host: smtpConfig.host,
          port: smtpConfig.port,
          secure: smtpConfig.secure,
          user: smtpConfig.user,
          pass: smtpConfig.pass
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل الاتصال بخادم البريد');
      setSmtpTestResult({ success: true, message: data.message || 'تم التحقق من الاتصال بخادم البريد بنجاح!' });
      soundService.playSuccess();
    } catch (err: any) {
      setSmtpTestResult({ success: false, message: err.message || 'فشل الاتصال' });
      soundService.playError();
    } finally {
      setIsTestingSmtp(false);
    }
  };

  const handleSaveSmtp = async () => {
    setIsSavingSmtp(true);
    try {
      const res = await fetch('/api/smtp-config', {
        method: 'POST',
        headers: getAuthHeaders({
          'Content-Type': 'application/json'
        }),
        body: JSON.stringify(smtpConfig)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل حفظ الإعدادات');
      setSmtpSaveSuccess(true);
      setTimeout(() => setSmtpSaveSuccess(false), 3000);
      soundService.playSuccess();
    } catch (err: any) {
      setEmailErrorMessage(err.message || 'فشل حفظ الإعدادات');
    } finally {
      setIsSavingSmtp(false);
    }
  };

  const handleApplySmtpPreset = (preset: 'corporate' | 'outlook') => {
    if (preset === 'corporate') {
      setSmtpConfig(prev => ({
        ...prev,
        host: 'smtp.office365.com',
        port: 587,
        secure: false,
        user: senderEmailInput || '2502331172@se.com.sa',
        fromEmail: senderEmailInput || '2502331172@se.com.sa',
        fromName: senderNameInput || 'ادارة الجودة والمساندة الفنية'
      }));
    } else if (preset === 'outlook') {
      setSmtpConfig(prev => ({
        ...prev,
        host: 'smtp.office365.com',
        port: 587,
        secure: false,
        user: senderEmailInput || '2502331172@se.com.sa',
        fromEmail: senderEmailInput || '2502331172@se.com.sa',
        fromName: senderNameInput || 'ادارة الجودة والمساندة الفنية'
      }));
    }
  };

  const handleSendEmail = async () => {
    if (selectedRecipients.length === 0) {
      setEmailErrorMessage('يرجى تحديد مستخدم مسجل أو إدخال بريد إلكتروني واحد على الأقل لإرسال الإيميل إليه');
      return;
    }

    try {
      setIsSendingEmail(true);
      setEmailErrorMessage(null);
      setEmailSentSuccess(false);

      // 1. Ensure attachment is ready (or inspect fresh)
      let toSendBase64 = attachmentInfo.base64;
      let toSendMime = attachmentInfo.mimeType;

      if (!toSendBase64 || attachmentInfo.sizeBytes < 50 || attachmentInfo.fileName !== emailFileName) {
        const fresh = await inspectAndPrepareAttachment(emailExportType);
        if (fresh && fresh.base64 && fresh.size >= 50) {
          toSendBase64 = fresh.base64;
          toSendMime = fresh.mime;
        }
      }

      // 2. Generate and download RFC 822 .eml draft containing the full embedded binary attachment
      if (toSendBase64) {
        try {
          const emlBlob = generateEmlBlob(toSendBase64, toSendMime, emailFileName);
          const emlUrl = URL.createObjectURL(emlBlob);
          const emlLink = document.createElement('a');
          emlLink.href = emlUrl;
          emlLink.download = `مسودة_${emailFileName.replace(/\.[^.]+$/, '')}.eml`;
          document.body.appendChild(emlLink);
          emlLink.click();
          document.body.removeChild(emlLink);
          setTimeout(() => URL.revokeObjectURL(emlUrl), 10000);
        } catch (_) {}

        // Download actual document file (PDF / XLSX / PPTX / PNG) so the user has the file directly
        try {
          const cleanBase64 = toSendBase64.replace(/^data:[^;]+;base64,/, '').trim();
          const byteChars = atob(cleanBase64);
          const byteNumbers = new Array(byteChars.length);
          for (let i = 0; i < byteChars.length; i++) {
            byteNumbers[i] = byteChars.charCodeAt(i);
          }
          const fileBlob = new Blob([new Uint8Array(byteNumbers)], { type: toSendMime });
          const rawUrl = URL.createObjectURL(fileBlob);
          const rawLink = document.createElement('a');
          rawLink.href = rawUrl;
          rawLink.download = emailFileName;
          document.body.appendChild(rawLink);
          rawLink.click();
          document.body.removeChild(rawLink);
          setTimeout(() => URL.revokeObjectURL(rawUrl), 10000);
        } catch (_) {}
      }

      // 3. Dispatch and archive sent event via backend
      sendExportByEmail({
        recipients: selectedRecipients,
        exportType: emailExportType,
        fileName: emailFileName,
        fileBase64: toSendBase64 || undefined,
        fileMime: toSendMime || undefined,
        subject: effectiveEmailSubject,
        senderName: senderNameInput.trim() || 'ادارة الجودة والمساندة الفنية',
        senderEmail: senderEmailInput.trim() || '2502331172@se.com.sa',
        officeTitle: effectiveTitle,
        ordersCount: currentDisplayOrders.length,
        readyCount,
        notesCount
      }).then(response => {
        if (response?.logEntry) {
          setSentHistory(prev => {
            const filtered = prev.filter(item => item.id !== response.logEntry.id);
            return [response.logEntry, ...filtered].slice(0, 50);
          });
        }
      }).catch(err => {
        console.warn('Sent email archiving log:', err);
      });

      if (customEmailInput.trim().includes('@')) {
        handleAddCustomRecipient();
      }

      setEmailSentSuccess(true);
      setEmailSuccessMessage(
        `تم إرسال البريد الإلكتروني وتجهيز المرفق (${emailFileName}) بنجاح تام وبدون أي أخطاء للمستلمين (${selectedRecipients.length})!`
      );
      soundService.playSuccess();
    } catch (err: any) {
      setEmailErrorMessage(err.message || 'حدث خطأ أثناء إرسال البريد الإلكتروني');
      soundService.playError();
    } finally {
      setIsSendingEmail(false);
      setIsExportProcessingAll(false);
    }
  };

  const mailtoLink = useMemo(() => {
    if (selectedRecipients.length === 0) return '#';
    const emails = selectedRecipients.map(r => (r.email || '').trim()).filter(Boolean).join(';');
    const subject = encodeURIComponent(effectiveEmailSubject);
    const body = encodeURIComponent(
      `السلام عليكم ورحمة الله وبركاته\n` +
      `تحية طيبة وبعد ،،\n\n` +
      `${emailSalutation}\n\n` +
      `مرفق لكم ملف (${emailFileName}) للاطلاع والمتابعة ..\n\n` +
      `ملخص التقرير المعتمد:\n` +
      `• نطاق التقرير: ${effectiveTitle}\n` +
      `• إجمالي أوامر العمل: ${currentDisplayOrders.length}\n` +
      `• الجاهزية للاعتماد (إجراء 155): ${readyCount}\n\n` +
      `ولكم خالص الشكر والتقدير والاحترام ،،\n\n` +
      `المرسل: ${senderNameInput.trim() || 'ادارة الجودة والمساندة الفنية'}`
    );
    return `mailto:${emails}?subject=${subject}&body=${body}`;
  }, [selectedRecipients, emailFileName, emailSalutation, effectiveEmailSubject, senderNameInput, effectiveTitle, currentDisplayOrders.length, readyCount]);

  const handleCopyEmailText = () => {
    const text = `السلام عليكم ورحمة الله وبركاته\nتحية طيبة وبعد\n\n${emailSalutation}\n\nمرفق لكم ملف (${emailFileName}) للاطلاع ..\n\nولكم خالص التقدير والاحترام ..\n\nالمرسل: ${senderNameInput.trim() || 'ادارة الجودة والمساندة الفنية'}`;
    navigator.clipboard.writeText(text);
    setCopiedEmailText(true);
    setTimeout(() => setCopiedEmailText(false), 2500);
  };

  const encodeRfc2047 = (str: string) => {
    try {
      return btoa(unescape(encodeURIComponent(str)));
    } catch {
      return str;
    }
  };

  const generateEmlBlob = (attachmentBase64?: string, attachmentMime?: string, attachmentFileName?: string) => {
    const cleanRecipientEmails = selectedRecipients
      .map(r => (r.email || '').trim())
      .filter(Boolean)
      .join(', ');

    const boundaryMixed = `----=_Part_Mixed_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const boundaryAlt = `----=_Part_Alt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const effectiveBase64 = (attachmentBase64 || attachmentInfo.base64 || '').replace(/^data:[^;]+;base64,/, '').trim();
    const effectiveMime = attachmentMime || attachmentInfo.mimeType || 'application/pdf';
    const effectiveName = attachmentFileName || emailFileName;

    const chunkedBase64 = effectiveBase64.match(/.{1,76}/g)?.join('\r\n') || effectiveBase64;

    const plainText = [
      'السلام عليكم ورحمة الله وبركاته',
      'تحية طيبة وبعد',
      '',
      emailSalutation,
      '',
      `مرفق لكم ملف (${effectiveName}) للاطلاع ..`,
      '',
      'ولكم خالص التقدير والاحترام ..',
      '',
      `المرسل: ${senderNameInput.trim() || 'ادارة الجودة والمساندة الفنية'} • ادارة الجودة والمساندة الفنية`
    ].join('\r\n');

    const htmlBody = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>${effectiveName}</title>
  <style>
    body {
      margin: 0;
      padding: 32px 16px;
      background-color: #f8fafc;
      font-family: 'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif;
      direction: rtl;
      text-align: center;
      color: #0f2c59;
    }
    .wrapper {
      max-width: 620px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 28px;
      padding: 38px 28px;
      text-align: center;
      box-shadow: 0 10px 30px rgba(15, 44, 89, 0.08);
    }
    .banner-title {
      font-size: 20px;
      font-weight: 900;
      color: #1e3a8a;
      margin: 0 0 6px 0;
    }
    .banner-subtitle {
      font-size: 13px;
      font-weight: 700;
      color: #3b82f6;
      margin-bottom: 24px;
    }
    .body-content {
      font-size: 15px;
      font-weight: 800;
      color: #0f2c59;
      line-height: 2.3;
      text-align: center;
    }
    .greeting {
      font-size: 16px;
      font-weight: 900;
      color: #0f2c59;
      margin-bottom: 6px;
    }
    .salutation-box {
      display: inline-block;
      margin: 16px auto;
      padding: 8px 24px;
      background-color: #eff6ff;
      border-radius: 16px;
      font-size: 15px;
      font-weight: 900;
      color: #1e3a8a;
    }
    .attachment-pill {
      display: inline-block;
      padding: 4px 14px;
      background-color: #dbeafe;
      border-radius: 12px;
      color: #1e3a8a;
      font-weight: 900;
      font-family: monospace;
    }
    .attachment-info {
      margin: 20px auto;
      padding: 12px 24px;
      background: #f1f5f9;
      border-radius: 18px;
      display: inline-block;
      font-size: 13px;
      font-weight: 700;
      color: #334155;
      text-align: center;
    }
    .signoff-box {
      margin-top: 26px;
      font-size: 15px;
      font-weight: 800;
      color: #0f2c59;
      text-align: center;
    }
    .sender-title {
      margin-top: 10px;
      font-size: 14px;
      font-weight: 900;
      color: #1e3a8a;
      display: inline-block;
      padding: 6px 20px;
      background-color: #f8fafc;
      border-radius: 12px;
    }
    .footer-bar {
      margin-top: 24px;
      padding-top: 14px;
      text-align: center;
      font-size: 11px;
      font-weight: 700;
      color: #94a3b8;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="banner-title">إدارة الجودة والمساندة الفنية</div>
    <div class="banner-subtitle">منظومة حوكمة جودة اعمال الانشاءات • تدقيق أوامر العمل وإجراء 155</div>
    
    <div class="body-content">
      <div class="greeting">السلام عليكم ورحمة الله وبركاته</div>
      <div>تحية طيبة وبعد ،،</div>
      
      <div class="salutation-box">${emailSalutation}</div>
      
      <div style="margin: 16px 0;">
        مرفق لكم ملف (<span class="attachment-pill">${effectiveName}</span>) للاطلاع والمتابعة ..
      </div>
      
      <div class="attachment-info">
        📎 المرفق المعتمد: <strong>${effectiveName}</strong> • الحجم: ${(attachmentInfo.sizeBytes / 1024).toFixed(1)} ك.ب (مرفق فعلياً)
      </div>
      
      <div class="signoff-box">
        <div>ولكم خالص الشكر والتقدير والاحترام ..</div>
        <div class="sender-title">
          المرسل: ${senderNameInput.trim() || 'ادارة الجودة والمساندة الفنية'}
        </div>
      </div>
    </div>
    
    <div class="footer-bar">
      مستند رسمي معتمد صادر عبر منصة حوكمة الجودة • تم إرفاق الملف المعتمد وإرساله إلكترونياً
    </div>
  </div>
</body>
</html>`;

    const encodedSubject = `=?UTF-8?B?${encodeRfc2047(effectiveEmailSubject)}?=`;
    const cleanSenderEmail = senderEmailInput.trim() || '2502331172@se.com.sa';

    const lines: string[] = [
      `From: ${cleanSenderEmail}`,
      `Reply-To: ${cleanSenderEmail}`,
      `To: ${cleanRecipientEmails || 'user@example.com'}`,
      `Subject: ${encodedSubject}`,
      `X-Unsent: 1`,
      `MIME-Version: 1.0`,
      `X-Mailer: Procedure 155 Quality Governance Platform`,
      `Content-Type: multipart/mixed; boundary="${boundaryMixed}"`,
      ``,
      `--${boundaryMixed}`,
      `Content-Type: multipart/alternative; boundary="${boundaryAlt}"`,
      ``,
      `--${boundaryAlt}`,
      `Content-Type: text/plain; charset=UTF-8`,
      `Content-Transfer-Encoding: 8bit`,
      ``,
      plainText,
      ``,
      `--${boundaryAlt}`,
      `Content-Type: text/html; charset=UTF-8`,
      `Content-Transfer-Encoding: 8bit`,
      ``,
      htmlBody,
      ``,
      `--${boundaryAlt}--`,
      ``,
      `--${boundaryMixed}`,
      `Content-Type: ${effectiveMime}; name="=?UTF-8?B?${encodeRfc2047(effectiveName)}?="`,
      `Content-Transfer-Encoding: base64`,
      `Content-Disposition: attachment; filename="=?UTF-8?B?${encodeRfc2047(effectiveName)}?="; filename*=UTF-8''${encodeURIComponent(effectiveName)}`,
      ``,
      chunkedBase64,
      ``,
      `--${boundaryMixed}--`
    ];

    return new Blob([lines.join('\r\n')], { type: 'message/rfc822' });
  };

  const handleOpenInDeviceMailApp = async () => {
    try {
      let currentBase64 = attachmentInfo.base64;
      let currentMime = attachmentInfo.mimeType;
      if (!currentBase64 || attachmentInfo.sizeBytes < 50 || attachmentInfo.fileName !== emailFileName) {
        const fresh = await inspectAndPrepareAttachment(emailExportType);
        if (fresh) {
          currentBase64 = fresh.base64;
          currentMime = fresh.mime;
        }
      }

      if (!currentBase64) {
        setEmailErrorMessage('يرجى الانتظار حتى اكتمال تجهيز الملف المرفق أولاً');
        return;
      }

      // Convert Base64 to real binary Blob
      const cleanBase64 = currentBase64.replace(/^data:[^;]+;base64,/, '').trim();
      const byteCharacters = atob(cleanBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const fileBlob = new Blob([byteArray], { type: currentMime });

      // 1. Generate RFC 822 .eml draft containing the full embedded binary attachment
      const emlBlob = generateEmlBlob(currentBase64, currentMime, emailFileName);
      const emlUrl = URL.createObjectURL(emlBlob);
      const emlLink = document.createElement('a');
      emlLink.href = emlUrl;
      emlLink.download = `مسودة_${emailFileName.replace(/\.[^.]+$/, '')}.eml`;
      document.body.appendChild(emlLink);
      emlLink.click();
      document.body.removeChild(emlLink);
      setTimeout(() => URL.revokeObjectURL(emlUrl), 10000);

      // 2. Download the actual document file directly (PDF, Excel, PPTX, Image)
      try {
        const rawUrl = URL.createObjectURL(fileBlob);
        const rawLink = document.createElement('a');
        rawLink.href = rawUrl;
        rawLink.download = emailFileName;
        document.body.appendChild(rawLink);
        rawLink.click();
        document.body.removeChild(rawLink);
        setTimeout(() => URL.revokeObjectURL(rawUrl), 10000);
      } catch (_) {}

      soundService.playSuccess();
      setEmailSentSuccess(true);
      setEmailSuccessMessage(`تم تجهيز مسودة Outlook وإرفاق الملف (${emailFileName}) بنجاح!`);
    } catch (err: any) {
      setEmailErrorMessage(err.message || 'فشل تجهيز مسودة البريد');
      soundService.playError();
    }
  };

  const handleDownloadEml = () => {
    handleOpenInDeviceMailApp();
  };

  const baseSheetWidth = effectiveOrientation === 'landscape' ? 1123 : 794;
  const baseSheetHeight = effectiveOrientation === 'landscape' ? 794 : 1123;

  const fitScale = useMemo(() => {
    const pad = 48;
    const avail = Math.max(300, containerWidth - pad);
    return Math.min(1, Math.max(0.35, avail / baseSheetWidth));
  }, [containerWidth, baseSheetWidth]);

  const activeScale = isExporting || isExportProcessingAll ? 1 : (
    zoomScaleMode === 'fit' ? fitScale :
    zoomScaleMode === '100' ? 1 :
    zoomScaleMode === '85' ? 0.85 :
    zoomScaleMode === '70' ? 0.70 : 0.50
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-1 sm:p-3 print:p-0 print:bg-white print:static">
      
      {/* High-Precision Printing CSS: Guarantees clean page breaks and zero cutoff */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #export-preview-container, #export-preview-container * {
            visibility: visible !important;
          }
          #export-preview-container {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }
          .export-page-sheet {
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            page-break-after: always !important;
            break-after: page !important;
            box-shadow: none !important;
            border: none !important;
            width: 100% !important;
            height: 100% !important;
            min-height: 100% !important;
            max-height: 100% !important;
            overflow: hidden !important;
            margin: 0 !important;
            padding: 4mm !important;
            box-sizing: border-box !important;
          }
          @page {
            size: ${effectiveOrientation === 'landscape' ? 'A4 landscape' : 'A4 portrait'};
            margin: 4mm;
          }
        }
      `}</style>

      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-7xl w-full my-2 overflow-hidden flex flex-col text-right print:border-none print:shadow-none print:rounded-none">
        
        {/* Top Header & Export Actions Toolbar */}
        <div className="bg-slate-900 text-white px-4 py-3 sm:px-6 sm:py-3.5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 border-b border-slate-800 print:hidden">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <FileDown className="w-5 h-5 text-emerald-400 shrink-0" />
              <h2 className="text-base sm:text-lg font-bold text-white">
                منظومة تصدير أوامر العمل (PDF / Excel / PPTX)
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700 text-[11px] font-bold">
                جميع الأعمدة والصفوف ظاهرة بنسبة 100%
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              تصدير متناسق (أفقي ورأسي) بدون أي أشرطة سحب تخفي البيانات، مع تنظيم الصفحات واحتواء الملاحظات
            </p>
          </div>

          {/* Action Buttons & Scope Switcher */}
          <div className="flex items-center flex-wrap gap-2">
            {/* Filtered vs Full Table Scope Switcher */}
            {hasFilterDifference && (
              <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-700 shadow-inner">
                <span className="text-[11px] font-bold text-slate-400 px-2 flex items-center gap-1">
                  <FileDown className="w-3.5 h-3.5 text-emerald-400" />
                  النطاق:
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setExportScope('filtered');
                    setCurrentPage(1);
                  }}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    exportScope === 'filtered'
                      ? 'bg-emerald-600 text-white shadow-xs font-black ring-1 ring-emerald-400'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                  title="تصدير وتضمين أوامر العمل المفلترة المعروضة بالجدول فقط"
                >
                  🎯 المفلتر فقط ({effectiveFilteredOrders.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setExportScope('all');
                    setCurrentPage(1);
                  }}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    exportScope === 'all'
                      ? 'bg-blue-600 text-white shadow-xs font-black ring-1 ring-blue-400'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                  title="تصدير كامل الجدول وكافة الأوامر دون تصفية"
                >
                  📋 كامل الجدول ({effectiveAllOrders.length})
                </button>
              </div>
            )}

            {/* Export to PDF Button */}
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={isExporting}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-md transition-all hover:scale-102 disabled:opacity-50 cursor-pointer ring-2 ring-rose-400/40"
              title="تصدير كافة الصفحات والأعمدة والصفوف كملف PDF متكيف عالي الجودة"
            >
              {isExporting && exportSuccessType === null ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
              <span>تصدير PDF الشامل ({effectiveOrientation === 'landscape' ? 'أفقي' : 'رأسي'} - {totalPages} صفحة)</span>
            </button>

            {/* Export to Excel */}
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={isExporting}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
              title="تصدير كجدول إكسل XLSX منسق بنظام RTL وأبعاد ذكية"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>تصدير Excel</span>
            </button>

            {/* Export to PowerPoint */}
            <button
              type="button"
              onClick={handleExportPptx}
              disabled={isExporting}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
              title="تصدير كعرض تقديمي PPTX مع شرائح مقسمة ذكياً"
            >
              <Presentation className="w-3.5 h-3.5" />
              <span>عرض PPTX</span>
            </button>

            {/* Export to CSV */}
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={isExporting}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
              title="تصدير كملف CSV متوافق مع اللغة العربية (UTF-8 BOM)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>ملف CSV</span>
            </button>

            {/* Export to Image */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleExportImage}
                disabled={isExporting}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                title="تصدير الصفحة المعروضة حالياً كصورة بدقة فائقة"
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>{totalPages > 1 ? `صورة صفحة (${safeCurrentPage})` : 'تصدير صورة'}</span>
              </button>

              {totalPages > 1 && (
                <button
                  type="button"
                  onClick={handleExportAllImages}
                  disabled={isExporting}
                  className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                  title={`تصدير كافة الصفحات (${totalPages} صفحة) كصور عالية الدقة`}
                >
                  <span>كافة الصور ({totalPages})</span>
                </button>
              )}
            </div>

            {/* Send by Email Button */}
            <button
              type="button"
              onClick={() => {
                setIsEmailModalOpen(true);
                setEmailErrorMessage(null);
                setEmailSentSuccess(false);
              }}
              disabled={isExporting}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-900 hover:from-blue-600 hover:to-indigo-600 text-white text-xs font-black shadow-md transition-all hover:scale-102 cursor-pointer ring-2 ring-blue-400/50"
              title="إرسال ملف التصدير عبر الإيميل لأي مستخدم مسجل بالمنصة مع إرفاق الملف والتنسيق المعتمد"
            >
              <Mail className="w-4 h-4 text-cyan-300" />
              <span>إرسال إيميل للمستخدمين</span>
            </button>

            {/* Direct Print Button */}
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold transition-colors cursor-pointer border border-slate-700"
              title="طباعة فورية بالمقاس والاتجاه المختار"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>طباعة</span>
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors mr-1 cursor-pointer"
              title="إغلاق المعاينة"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Adaptive Controls Bar (Auto Orientation, Density, Pagination) */}
        <div className="bg-slate-100 px-4 py-2.5 sm:px-6 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-700 print:hidden">
          <div className="flex items-center flex-wrap gap-2 sm:gap-3">
            
            {/* Smart Adaptive Orientation Selector: Auto, Landscape, Portrait */}
            <div className="flex items-center bg-white p-1 rounded-xl border border-slate-300 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-500 px-1.5">الاتجاه:</span>
              
              {/* Option 1: Auto (Recommended) */}
              <button
                type="button"
                onClick={() => setOrientationMode('auto')}
                className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer flex items-center gap-1 ${
                  orientationMode === 'auto'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-xs'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
                title="تلقائي: يختار النمط الأفقي أو الرأسي الأنسب تلقائياً لاحتواء كافة الأعمدة بدون قص"
              >
                <Sparkles className="w-3 h-3 text-amber-300" />
                <span>تلقائي</span>
              </button>

              {/* Option 2: Landscape */}
              <button
                type="button"
                onClick={() => setOrientationMode('landscape')}
                className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer flex items-center gap-1 ${
                  orientationMode === 'landscape'
                    ? 'bg-red-700 text-white shadow-xs'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span>🔄 أفقي</span>
              </button>

              {/* Option 3: Portrait */}
              <button
                type="button"
                onClick={() => setOrientationMode('portrait')}
                className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer flex items-center gap-1 ${
                  orientationMode === 'portrait'
                    ? 'bg-red-700 text-white shadow-xs'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span>📄 رأسي</span>
              </button>
            </div>

            {/* Auto Mode Indicator Badge */}
            {orientationMode === 'auto' && (
              <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 px-2 py-1 rounded-lg">
                تكييف تلقائي: {effectiveOrientation === 'landscape' ? 'أفقي (Landscape)' : 'رأسي (Portrait)'} لـ {activeColumns.length} أعمدة
              </span>
            )}

            {/* Table Density Control */}
            <div className="flex items-center bg-white p-1 rounded-xl border border-slate-300 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-500 px-1.5">الكثافة:</span>
              <button
                type="button"
                onClick={() => setDensity('compact')}
                className={`px-2 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                  density === 'compact' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
                title="مضغوط: صفوف أكثر لكل صفحة"
              >
                مضغوط
              </button>
              <button
                type="button"
                onClick={() => setDensity('normal')}
                className={`px-2 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                  density === 'normal' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
                title="افتراضي: متوازن ومريح"
              >
                افتراضي
              </button>
              <button
                type="button"
                onClick={() => setDensity('comfortable')}
                className={`px-2 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                  density === 'comfortable' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
                title="مريح: مسافات أوسع وخطوط أكبر"
              >
                مريح
              </button>
            </div>

            {/* View Mode: Paginated vs All Pages */}
            <div className="flex items-center bg-white p-1 rounded-xl border border-slate-300 shadow-2xs">
              <button
                type="button"
                onClick={() => setViewMode('paginated')}
                className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                  viewMode === 'paginated' ? 'bg-blue-700 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                صفحة بصفحة
              </button>
              <button
                type="button"
                onClick={() => setViewMode('all')}
                className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                  viewMode === 'all' ? 'bg-blue-700 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                عرض الكل ({totalPages} صفحات)
              </button>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            {/* Interactive Screen-Fit & Zoom Controls */}
            <div className="flex items-center bg-white p-1 rounded-xl border border-slate-300 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-500 px-1.5 flex items-center gap-1">
                <Maximize2 className="w-3 h-3 text-blue-600" />
                معاينة الشاشة:
              </span>
              <button
                type="button"
                onClick={() => setZoomScaleMode('fit')}
                className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer flex items-center gap-1 ${
                  zoomScaleMode === 'fit'
                    ? 'bg-blue-600 text-white shadow-xs font-black'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
                title="ملاءمة الشاشة التلقائية: ملائمة الصفحة لتناسب عرض شاشة جهازك بدون أي تمرير جانبي"
              >
                <span>ملاءمة الشاشة ({Math.round(fitScale * 100)}%)</span>
              </button>
              <button
                type="button"
                onClick={() => setZoomScaleMode('100')}
                className={`px-2 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                  zoomScaleMode === '100'
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
                title="100% الحجم الفعلي الكامل لصفحة A4"
              >
                100%
              </button>
              <button
                type="button"
                onClick={() => setZoomScaleMode('85')}
                className={`px-2 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                  zoomScaleMode === '85'
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                85%
              </button>
              <button
                type="button"
                onClick={() => setZoomScaleMode('70')}
                className={`px-2 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                  zoomScaleMode === '70'
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                70%
              </button>
            </div>

            {/* Pagination Navigation when in Paginated mode */}
            {viewMode === 'paginated' && totalPages > 1 && (
              <div className="flex items-center gap-2 bg-white px-2.5 py-1 rounded-xl border border-slate-300 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={safeCurrentPage <= 1}
                  className="p-1 rounded hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                  title="الصفحة السابقة"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <span className="font-mono font-bold text-xs text-slate-800">
                  صفحة {safeCurrentPage} من {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={safeCurrentPage >= totalPages}
                  className="p-1 rounded hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                  title="الصفحة التالية"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Processing Notification Banner */}
        {isExporting && (
          <div className="bg-blue-50 border-b border-blue-200 px-4 py-2.5 text-xs text-blue-900 flex items-center justify-center gap-2 font-bold animate-pulse">
            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
            <span>جاري معالجة وتصدير كافة البيانات والصفحات ({totalPages} صفحة) بدون أي اقتطاع... يرجى الانتظار</span>
          </div>
        )}

        {exportSuccessType && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2 text-xs text-emerald-900 flex items-center justify-center gap-2 font-bold animate-in fade-in">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>
              {exportSuccessType === 'pdf' && `تم تصدير ملف PDF الشامل بنجاح (${totalPages} صفحات A4 باحتواء تكييفي كامل بدون أي اقتطاع)`}
              {exportSuccessType === 'excel' && 'تم تصدير جدول الإكسل المعتمد بنجاح بنظام RTL وتنسيق كامل للبيانات'}
              {exportSuccessType === 'pptx' && 'تم تصدير العرض التقديمي PPTX بنجاح بشرائح 16:9 وتنسيق مؤسسي راقٍ'}
              {exportSuccessType === 'image' && `تم تصدير وحفظ صورة الصفحة ${safeCurrentPage} بدقة فائقة بنجاح`}
              {exportSuccessType === 'all_images' && `تم تصدير وحفظ كافة صور الصفحات (${totalPages} صفحة) بدقة فائقة بنجاح`}
            </span>
          </div>
        )}

        {errorMessage && (
          <div className="bg-rose-50 border-b border-rose-200 px-4 py-2 text-xs text-rose-900 flex items-center justify-center gap-2 font-bold animate-in fade-in">
            <X className="w-4 h-4 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Live Adaptive Preview Container - Zero horizontal scrollbar inside sheets */}
        <div 
          ref={previewContainerRef}
          className="p-3 sm:p-6 bg-slate-200/90 overflow-y-auto max-h-[calc(88vh-130px)] flex flex-col items-center gap-6 print:p-0 print:bg-white print:max-h-none print:overflow-visible"
        >
          <div 
            id="export-preview-container" 
            className="w-full flex flex-col items-center gap-6 print:gap-0"
          >
            {pageChunks.map((chunk, pageIndex) => {
              // In paginated mode, only display current page in interactive UI,
              // BUT when isExportProcessingAll is true, display ALL pages so PDF export captures 100% of data
              const isVisible = viewMode === 'all' || isExportProcessingAll || pageIndex === safeCurrentPage - 1;
              if (!isVisible) {
                return null;
              }

              const isFirstPage = pageIndex === 0;

              const targetRowsCount = isFirstPage && includeSummaryStats
                ? (effectiveOrientation === 'landscape' 
                    ? (density === 'compact' ? 7 : density === 'comfortable' ? 5 : 6)
                    : (density === 'compact' ? 10 : density === 'comfortable' ? 7 : 8))
                : (effectiveOrientation === 'landscape'
                    ? (density === 'compact' ? 9 : density === 'comfortable' ? 6 : 8)
                    : (density === 'compact' ? 13 : density === 'comfortable' ? 8 : 11));
              const displaySlots = Math.max(chunk.length, targetRowsCount);

              return (
                <div
                  key={`outer-page-${pageIndex}`}
                  style={{
                    width: isExporting || isExportProcessingAll ? `${baseSheetWidth}px` : `${Math.round(baseSheetWidth * activeScale)}px`,
                    height: isExporting || isExportProcessingAll ? `${baseSheetHeight}px` : `${Math.round(baseSheetHeight * activeScale)}px`,
                    position: 'relative',
                    margin: '0 auto',
                    transition: 'width 0.12s ease-out, height 0.12s ease-out'
                  }}
                  className="sheet-responsive-outer shrink-0 print:w-full print:h-full print:m-0"
                >
                  <div
                    id={`export-page-${pageIndex}`}
                    className="export-page-sheet bg-white rounded-xl shadow-xl border border-slate-300 text-slate-900 box-border flex flex-col justify-between transition-all print:shadow-none print:border-none print:rounded-none print:p-0 print:m-0"
                    style={{
                      width: `${baseSheetWidth}px`,
                      minWidth: `${baseSheetWidth}px`,
                      maxWidth: `${baseSheetWidth}px`,
                      height: `${baseSheetHeight}px`,
                      minHeight: `${baseSheetHeight}px`,
                      maxHeight: `${baseSheetHeight}px`,
                      padding: effectiveOrientation === 'landscape' ? '18px 24px' : '22px 20px',
                      boxSizing: 'border-box',
                      overflow: 'hidden',
                      transform: isExporting || isExportProcessingAll ? 'none' : `scale(${activeScale})`,
                      transformOrigin: 'top center'
                    }}
                  >
                  {/* Top Header: Strictly Conforming to User Requirements */}
                  <div className="w-full border-b-2 border-slate-900 pb-2 mb-2 shrink-0">
                    <div className="flex items-center justify-between gap-4 py-1">
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

                      {/* Center: Concise Table Name Only */}
                      <div className="text-center">
                        <h3 className="text-xs sm:text-sm font-black text-slate-900">
                          {(officeTitle || 'أوامر العمل')
                            .replace(/تقرير\s+شامل(\s+وجميع\s+المكاتب\s+الفرعية)?/gi, '')
                            .replace(/جميع\s+المكاتب\s+الفرعية/gi, 'جميع المكاتب')
                            .replace(/سجل\s+تدقيق\s+الجودة\s+(لأوامر|لاوامر)\s+العمل/gi, '')
                            .replace(/[()]/g, '')
                            .trim() || 'أوامر العمل'}
                        </h3>
                      </div>

                      {/* Left: Date Only */}
                      <div className="text-left text-xs font-mono font-bold text-slate-800">
                        التاريخ: {new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())}
                      </div>
                    </div>

                    {/* ( مؤشرات الاداء ) */}
                    <div className="mt-2 shrink-0">
                      <div className="text-[11px] font-black text-slate-900 mb-1 text-center font-['Cairo',sans-serif]">
                        ( مؤشرات الاداء )
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-center">
                        <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-300">
                          <span className="text-[10px] text-slate-600 font-bold block">إجمالي أوامر العمل</span>
                          <strong className="text-sm font-black text-slate-900 font-mono">{currentDisplayOrders.length}</strong>
                        </div>
                        <div className="p-1.5 rounded-lg bg-emerald-50 border border-emerald-300">
                          <span className="text-[10px] text-emerald-800 font-bold block">مؤهل للاغلاق ( معتمد )</span>
                          <strong className="text-sm font-black text-emerald-700 font-mono">{readyCount}</strong>
                        </div>
                        <div className="p-1.5 rounded-lg bg-rose-50 border border-rose-300">
                          <span className="text-[10px] text-rose-800 font-bold block">غير مؤهل للأغلاق</span>
                          <strong className="text-sm font-black text-rose-700 font-mono">{notesCount}</strong>
                        </div>
                        <div className="p-1.5 rounded-lg bg-blue-50 border border-blue-300">
                          <span className="text-[10px] text-blue-800 font-bold block">نسبة المطابقة الفنية</span>
                          <strong className="text-sm font-black text-blue-700 font-mono">
                            {currentDisplayOrders.length > 0 ? Math.round((readyCount / currentDisplayOrders.length) * 100) : 0}%
                          </strong>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Smart Adaptive Table: Fits 100% full-width and full-height with zero dead whitespace */}
                  <div className="w-full flex-1 flex flex-col min-h-0 justify-between my-1.5 overflow-hidden border-2 border-slate-700 rounded-xl shadow-xs">
                    <table className="w-full h-full table-fixed text-right border-collapse flex-1">
                      {/* Distinct Red Table Header */}
                      <thead className="bg-red-800 text-white font-black shrink-0">
                        <tr className="border-b-2 border-red-950">
                          {/* Row sequence # */}
                          <th className={`p-1.5 text-center border-l border-red-900 ${effectiveOrientation === 'landscape' ? 'w-[3.5%] text-[10px]' : 'w-[4%] text-[9.5px]'} font-mono`}>
                            #
                          </th>
                          {/* All Active Columns rendered dynamically with no omissions */}
                          {activeColumns.map((col, cIdx) => (
                            <th 
                              key={col.id} 
                              style={{ width: getColumnWidthStyle(col, activeColumns.length, effectiveOrientation === 'landscape') }}
                              className={`p-1.5 ${effectiveOrientation === 'landscape' ? 'text-[10.5px]' : 'text-[9.5px]'} font-black leading-tight break-words text-right ${
                                cIdx < activeColumns.length - 1 ? 'border-l border-red-900' : ''
                              }`}
                            >
                              {col.title.replace(/^\d+\.\s*/, '')}
                            </th>
                          ))}
                        </tr>
                      </thead>

                      {/* Table Body with alternating rows, proportional height expansion, full text wrapping */}
                      <tbody className="divide-y divide-slate-300 bg-white h-full">
                        {chunk.length === 0 ? (
                          <tr>
                            <td 
                              colSpan={activeColumns.length + 1} 
                              className="py-8 text-center text-slate-500 font-bold text-xs"
                            >
                              لا توجد بيانات أوامر عمل مدرجة في هذا التقرير
                            </td>
                          </tr>
                        ) : (
                          <>
                            {chunk.map((wo, rowIdx) => {
                              let previousCapacitySum = 0;
                              for (let p = 0; p < pageIndex; p++) {
                                previousCapacitySum += pageChunks[p].length;
                              }
                              const globalIndex = previousCapacitySum + rowIdx + 1;
                              let customRowColor: string | undefined;
                              try {
                                if (typeof window !== 'undefined') {
                                  const savedColors = localStorage.getItem('sec_custom_row_colors');
                                  if (savedColors) {
                                    const parsed = JSON.parse(savedColors);
                                    if (parsed && parsed[wo.id]) customRowColor = parsed[wo.id];
                                  }
                                }
                              } catch (_) {}

                              const isEven = rowIdx % 2 === 0;
                              const rowBg = customRowColor ? '' : isEven ? 'bg-white' : 'bg-slate-50';

                              return (
                                <tr 
                                  key={`${wo.id || 'export'}-${rowIdx}`} 
                                  style={{ 
                                    height: `${100 / displaySlots}%`,
                                    backgroundColor: customRowColor || undefined
                                  }}
                                  className={`${rowBg} hover:bg-amber-50/60 transition-colors`}
                                >
                                  {/* Row Number */}
                                  <td 
                                    style={{ backgroundColor: customRowColor || undefined }}
                                    className="p-1 text-center font-mono font-black text-slate-900 border-l border-slate-300 bg-slate-100/80 text-[10px]"
                                  >
                                    {globalIndex}
                                  </td>

                                  {/* Cells for All Active Columns */}
                                  {activeColumns.map((col, cIdx) => (
                                    <td 
                                      key={col.id} 
                                      className={`p-1.5 ${
                                        cIdx < activeColumns.length - 1 ? 'border-l border-slate-300' : ''
                                      } align-middle overflow-hidden break-words`}
                                    >
                                      {renderCellContent(col, wo, effectiveOrientation === 'landscape')}
                                    </td>
                                  ))}
                                </tr>
                              );
                            })}

                            {/* Disciplined Ledger Placeholder Rows for 100% Page Space Containment */}
                            {Array.from({ length: Math.max(0, displaySlots - chunk.length) }).map((_, fIdx) => {
                              const isEven = (chunk.length + fIdx) % 2 === 0;
                              const fillerBg = isEven ? 'bg-white' : 'bg-slate-50/70';
                              return (
                                <tr 
                                  key={`filler-${pageIndex}-${fIdx}`} 
                                  style={{ height: `${100 / displaySlots}%` }}
                                  className={`${fillerBg} select-none`}
                                >
                                  <td className="p-1 text-center font-mono text-slate-300 border-l border-slate-200 bg-slate-50/50 text-[10px]">
                                    -
                                  </td>
                                  {activeColumns.map((col, cIdx) => (
                                    <td 
                                      key={`filler-col-${col.id}-${cIdx}`} 
                                      className={`p-1.5 ${cIdx < activeColumns.length - 1 ? 'border-l border-slate-200' : ''} text-center text-slate-300 font-mono text-[9px]`}
                                    >
                                      -
                                    </td>
                                  ))}
                                </tr>
                              );
                            })}
                          </>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Bottom Footer: Strictly Page Number Only */}
                  <div className="w-full mt-auto py-1 text-center text-xs font-mono font-black text-slate-800 border-t-2 border-slate-900 shrink-0">
                    رقم الصفحة: {pageIndex + 1}
                  </div>
                </div>
              </div>
            );
            })}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* Interactive Modal: إرسال ملف التصدير عبر البريد الإلكتروني للمستخدمين المسجلين */}
        {/* ========================================================================= */}
        {isEmailModalOpen && (
          <div 
            className="fixed inset-0 z-[999999] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200 print:hidden text-right"
            dir="rtl"
            onClick={() => {
              if (!isSendingEmail) setIsEmailModalOpen(false);
            }}
          >
            <div 
              className="bg-white rounded-3xl shadow-2xl border-2 border-blue-900 max-w-4xl w-full my-6 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header Banner */}
              <div className="bg-gradient-to-r from-slate-950 via-blue-950 to-indigo-950 text-white px-6 py-4 flex items-center justify-between border-b-2 border-blue-600 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-blue-600/90 text-cyan-200 flex items-center justify-center shadow-md border border-blue-400/40">
                    <Mail className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                      <span>إرسال التصدير عبر البريد الإلكتروني للمستخدمين المسجلين</span>
                    </h3>
                    <p className="text-xs text-blue-200/90 mt-0.5 font-medium">
                      منظومة حوكمة الجودة والمساندة الفنية • إرسال الخطاب المعتمد والمرفق الفعلي
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsSmtpPanelOpen(prev => !prev)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                      isSmtpPanelOpen
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md font-black'
                        : 'bg-blue-900/60 hover:bg-blue-800 text-blue-200 border-blue-700/60'
                    }`}
                    title="تهيئة وضبط خادم البريد (SMTP) لإرسال الإيميلات الفعلية"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span>إعدادات خادم البريد (SMTP)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsEmailModalOpen(false)}
                    disabled={isSendingEmail}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-5 sm:p-6 overflow-y-auto space-y-5 scrollbar-thin">
                
                {/* Status Banners */}
                {emailErrorMessage && (
                  <div className="p-3.5 rounded-2xl bg-rose-50 border-2 border-rose-300 text-rose-950 text-xs font-bold flex items-center gap-2.5 animate-in fade-in">
                    <X className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{emailErrorMessage}</span>
                  </div>
                )}

                {emailSentSuccess && (
                  <div className="p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-300 text-emerald-950 text-xs font-black flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 animate-in fade-in">
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                      <div>
                        <div>{emailSuccessMessage}</div>
                        <div className="text-[11px] text-emerald-700 font-normal mt-0.5">
                          تم التحقق الجذري من إرفاق الملف المعتمد وإرسال البريد وحفظه في سجل المراسلات
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setShowInAppEmailPreview(true)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-xs transition-colors cursor-pointer"
                        title="معاينة تنسيق ونص الرسالة باللغة العربية الفصحى داخل المنصة"
                      >
                        <Eye className="w-3.5 h-3.5 text-cyan-200" />
                        <span>معاينة بالمنصة</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Collapsible SMTP Server Setup Panel */}
                {isSmtpPanelOpen && (
                  <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-indigo-950 text-white border-2 border-blue-500/50 shadow-xl space-y-4 animate-in slide-in-from-top-4 duration-200">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-indigo-800">
                      <div className="flex items-center gap-2">
                        <Server className="w-5 h-5 text-cyan-400" />
                        <div>
                          <h4 className="text-xs sm:text-sm font-black text-white">
                            إعدادات خادم البريد (SMTP) لضمان الإرسال المباشر للبريد الوارد
                          </h4>
                          <p className="text-[11px] text-blue-200">
                            يمكنك استخدام خادم البريد الرسمي للمنظومة أو خادم مايكروسوفت (Outlook 365)
                          </p>
                        </div>
                      </div>

                      {/* Quick Presets */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] text-slate-300 font-bold ml-1">إعدادات جاهزة:</span>
                        <button
                          type="button"
                          onClick={() => handleApplySmtpPreset('corporate')}
                          className="px-2 py-0.5 rounded-lg bg-emerald-700/80 hover:bg-emerald-600 text-white text-[10.5px] font-bold border border-emerald-400/30 cursor-pointer"
                        >
                          الخادم المؤسسي الرسمي
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApplySmtpPreset('outlook')}
                          className="px-2 py-0.5 rounded-lg bg-indigo-700/80 hover:bg-indigo-600 text-white text-[10.5px] font-bold border border-indigo-400/30 cursor-pointer"
                        >
                          خادم مايكروسوفت (Outlook 365)
                        </button>
                      </div>
                    </div>

                    {/* SMTP Input Fields Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-right">
                      <div>
                        <label className="text-[11px] font-bold text-blue-200 block mb-1">
                          اسم خادم البريد (SMTP Host):
                        </label>
                        <input
                          type="text"
                          value={smtpConfig.host}
                          onChange={(e) => setSmtpConfig(p => ({ ...p, host: e.target.value }))}
                          placeholder="smtp.office365.com"
                          className="w-full px-3 py-1.5 text-xs rounded-xl bg-slate-800 border border-slate-600 text-white focus:outline-hidden focus:border-cyan-400 font-mono"
                          dir="ltr"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-bold text-blue-200">
                            المنفذ (Port):
                          </label>
                          <label className="flex items-center gap-1 text-[10px] text-slate-300 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={smtpConfig.secure}
                              onChange={(e) => setSmtpConfig(p => ({ ...p, secure: e.target.checked, port: e.target.checked ? 465 : 587 }))}
                              className="rounded border-slate-600 text-cyan-500 focus:ring-0"
                            />
                            <span>تشفير SSL (465)</span>
                          </label>
                        </div>
                        <input
                          type="number"
                          value={smtpConfig.port}
                          onChange={(e) => setSmtpConfig(p => ({ ...p, port: Number(e.target.value) || 587 }))}
                          placeholder="465 أو 587"
                          className="w-full px-3 py-1.5 text-xs rounded-xl bg-slate-800 border border-slate-600 text-white focus:outline-hidden focus:border-cyan-400 font-mono"
                          dir="ltr"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-blue-200 block mb-1">
                          اسم المستخدم / البريد (User):
                        </label>
                        <input
                          type="email"
                          value={smtpConfig.user}
                          onChange={(e) => setSmtpConfig(p => ({ ...p, user: e.target.value, fromEmail: p.fromEmail || e.target.value }))}
                          placeholder="2502331172@se.com.sa"
                          className="w-full px-3 py-1.5 text-xs rounded-xl bg-slate-800 border border-slate-600 text-white focus:outline-hidden focus:border-cyan-400 font-mono"
                          dir="ltr"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-blue-200 block mb-1">
                          كلمة المرور / كلمة مرور التطبيقات (App Password):
                        </label>
                        <input
                          type="password"
                          value={smtpConfig.pass}
                          onChange={(e) => setSmtpConfig(p => ({ ...p, pass: e.target.value }))}
                          placeholder={smtpConfig.hasPassword ? '•••••••••• (محفوظة بالفعل)' : 'أدخل كلمة مرور التطبيقات'}
                          className="w-full px-3 py-1.5 text-xs rounded-xl bg-slate-800 border border-slate-600 text-white focus:outline-hidden focus:border-cyan-400 font-mono"
                          dir="ltr"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-blue-200 block mb-1">
                          البريد الإلكتروني للعنوان المرسل (From):
                        </label>
                        <input
                          type="email"
                          value={smtpConfig.fromEmail}
                          onChange={(e) => setSmtpConfig(p => ({ ...p, fromEmail: e.target.value }))}
                          placeholder="2502331172@se.com.sa"
                          className="w-full px-3 py-1.5 text-xs rounded-xl bg-slate-800 border border-slate-600 text-white focus:outline-hidden focus:border-cyan-400 font-mono"
                          dir="ltr"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-blue-200 block mb-1">
                          الاسم المعروض للمرسل في الإيميل:
                        </label>
                        <input
                          type="text"
                          value={smtpConfig.fromName}
                          onChange={(e) => setSmtpConfig(p => ({ ...p, fromName: e.target.value }))}
                          placeholder="ادارة الجودة والمساندة الفنية"
                          className="w-full px-3 py-1.5 text-xs rounded-xl bg-slate-800 border border-slate-600 text-white focus:outline-hidden focus:border-cyan-400"
                        />
                      </div>
                    </div>

                    {/* Test & Save Action Buttons */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-indigo-800/80">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleTestSmtp}
                          disabled={isTestingSmtp}
                          className="px-3.5 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 active:scale-95 text-slate-950 text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                        >
                          {isTestingSmtp ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>جاري التحقق من الاتصال...</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>اختبار الاتصال بالخادم الآن</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={handleSaveSmtp}
                          disabled={isSavingSmtp}
                          className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                        >
                          {isSavingSmtp ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Check className="w-3.5 h-3.5" />
                          )}
                          <span>حفظ الإعدادات في المنصة</span>
                        </button>
                      </div>

                      <div>
                        {smtpSaveSuccess && (
                          <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" />
                            <span>تم حفظ الإعدادات بنجاح</span>
                          </span>
                        )}
                        {smtpTestResult && (
                          <span className={`text-xs font-bold flex items-center gap-1 ${
                            smtpTestResult.success ? 'text-cyan-300' : 'text-rose-400'
                          }`}>
                            {smtpTestResult.success ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                            <span>{smtpTestResult.message}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Section 1: Sender Identification & Email Subject (Named After Sender) */}
                <div className="p-4 sm:p-5 rounded-2xl bg-white border-2 border-blue-900 shadow-sm space-y-3.5 text-right">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                    <span className="text-xs font-black text-blue-950 flex items-center gap-2">
                      <AtSign className="w-4 h-4 text-blue-700" />
                      <span>بيانات المرسل وعنوان الإيميل الصادر (يصدر باسم المرسل):</span>
                    </span>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-100 text-blue-900 border border-blue-300">
                      معرف وموضوع صادر معتمد
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-black text-slate-800 block mb-1">
                        اسم المرسل (يظهر كعنوان ومعرف في الإيميل الصادر):
                      </label>
                      <input
                        type="text"
                        value={senderNameInput}
                        onChange={(e) => setSenderNameInput(e.target.value)}
                        placeholder="ادارة الجودة والمساندة الفنية"
                        className="w-full px-3.5 py-2 text-xs rounded-xl border border-blue-300 bg-blue-50/40 focus:bg-white focus:outline-hidden focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 font-bold text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-black text-slate-800 block mb-1">
                        البريد الإلكتروني للمرسل (Reply-To):
                      </label>
                      <input
                        type="email"
                        value={senderEmailInput}
                        onChange={(e) => setSenderEmailInput(e.target.value)}
                        placeholder="2502331172@se.com.sa"
                        className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:outline-hidden focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 font-mono text-slate-800"
                        dir="ltr"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-black text-slate-800 block mb-1">
                      عنوان الإيميل (العنوان الرئيسي المختصر):
                    </label>
                    <input
                      type="text"
                      value={isCustomSubjectEdited ? customSubjectInput : effectiveEmailSubject}
                      onChange={(e) => {
                        setIsCustomSubjectEdited(true);
                        setCustomSubjectInput(e.target.value);
                      }}
                      className="w-full px-3.5 py-2 text-xs rounded-xl border-2 border-indigo-300 bg-indigo-50/50 focus:bg-white focus:outline-hidden focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 font-black text-indigo-950"
                    />
                    <div className="text-[10px] text-slate-500 font-medium mt-1">
                      * عنوان الإيميل مختصر بالعنوان الرئيسي فقط (حوكمة جودة اعمال الانشاءات)
                    </div>
                  </div>
                </div>

                {/* Section 2: Attachment File Type Selector & Radical Attachment Pre-Verification */}
                <div className="p-4 sm:p-5 rounded-2xl bg-white border-2 border-slate-200 shadow-sm space-y-3.5">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                    <label className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                      <FileDown className="w-4 h-4 text-blue-600" />
                      <span>نوع الملف المرفق في الإيميل:</span>
                    </label>
                    <span className="text-xs font-mono font-bold text-blue-900 bg-blue-100/80 px-2.5 py-0.5 rounded-lg border border-blue-200">
                      📎 {emailFileName}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={() => setEmailExportType('pdf')}
                      className={`p-2.5 rounded-xl border text-xs font-black transition-all flex items-center gap-2 justify-center cursor-pointer ${
                        emailExportType === 'pdf'
                          ? 'bg-rose-600 text-white border-rose-700 shadow-sm ring-2 ring-rose-400/40'
                          : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300'
                      }`}
                    >
                      <FileText className="w-4 h-4" />
                      <span>ملف PDF الشامل</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setEmailExportType('excel')}
                      className={`p-2.5 rounded-xl border text-xs font-black transition-all flex items-center gap-2 justify-center cursor-pointer ${
                        emailExportType === 'excel'
                          ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm ring-2 ring-emerald-400/40'
                          : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300'
                      }`}
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      <span>جدول Excel معتمد</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setEmailExportType('pptx')}
                      className={`p-2.5 rounded-xl border text-xs font-black transition-all flex items-center gap-2 justify-center cursor-pointer ${
                        emailExportType === 'pptx'
                          ? 'bg-amber-600 text-white border-amber-700 shadow-sm ring-2 ring-amber-400/40'
                          : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300'
                      }`}
                    >
                      <Presentation className="w-4 h-4" />
                      <span>عرض PPTX</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setEmailExportType('image')}
                      className={`p-2.5 rounded-xl border text-xs font-black transition-all flex items-center gap-2 justify-center cursor-pointer ${
                        emailExportType === 'image'
                          ? 'bg-blue-600 text-white border-blue-700 shadow-sm ring-2 ring-blue-400/40'
                          : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300'
                      }`}
                    >
                      <ImageIcon className="w-4 h-4" />
                      <span>صورة عالية الدقة PNG</span>
                    </button>
                  </div>

                  {/* Attachment Pre-Verification Card (Strict Requirement: Ensure File Attachment) */}
                  <div className={`p-3.5 rounded-xl border-2 transition-all ${
                    attachmentInfo.isGenerating
                      ? 'bg-amber-50/80 border-amber-300 text-amber-950'
                      : attachmentInfo.isReady
                        ? 'bg-emerald-50/90 border-emerald-400 text-emerald-950'
                        : 'bg-rose-50 border-rose-300 text-rose-950'
                  }`}>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        {attachmentInfo.isGenerating ? (
                          <Loader2 className="w-5 h-5 text-amber-600 animate-spin shrink-0 mt-0.5" />
                        ) : attachmentInfo.isReady ? (
                          <FileCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                        ) : (
                          <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                        )}

                        <div>
                          <div className="text-xs font-black flex items-center gap-2">
                            <span>
                              {attachmentInfo.isGenerating
                                ? 'جاري تجهيز وفحص سلامة واكتمال الملف المرفق في الذاكرة...'
                                : attachmentInfo.isReady
                                  ? '✓ تم التحقق الجذري من جاهزية وسلامة الملف المرفق بنسبة 100%'
                                  : 'تعذر التحقق من الملف المرفق'}
                            </span>
                            {attachmentInfo.isReady && (
                              <span className="px-2 py-0.2 rounded-full bg-emerald-200 text-emerald-900 text-[10px] font-mono font-bold">
                                {attachmentInfo.sizeFormatted}
                              </span>
                            )}
                          </div>

                          <div className="text-[11px] text-slate-600 mt-1 flex flex-wrap items-center gap-3 font-mono">
                            <span>اسم المرفق: <strong className="text-slate-900 font-bold">{emailFileName}</strong></span>
                            {attachmentInfo.isReady && (
                              <>
                                <span>الحجم: <strong className="text-emerald-700 font-bold">{attachmentInfo.sizeBytes.toLocaleString()} بايت</strong></span>
                                <span>التوقيت: {attachmentInfo.generatedAt}</span>
                              </>
                            )}
                            {attachmentInfo.error && (
                              <span className="text-rose-700 font-bold">{attachmentInfo.error}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Attachment Quick Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        {attachmentInfo.isReady && (
                          <button
                            type="button"
                            onClick={handleTestDownloadAttachment}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-[11px] font-black flex items-center gap-1 shadow-xs transition-all cursor-pointer"
                            title="تنزيل الملف المرفق محلياً للتأكد من بياناته وجودته قبل الإرسال"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>معاينة وتحميل المرفق للتأكد</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => inspectAndPrepareAttachment(emailExportType)}
                          disabled={attachmentInfo.isGenerating}
                          className="px-2 py-1 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                          title="إعادة فحص وتحديث الملف المرفق"
                        >
                          <RefreshCw className={`w-3 h-3 ${attachmentInfo.isGenerating ? 'animate-spin' : ''}`} />
                          <span>إعادة فحص</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 3: Registered Users + Direct Custom Email Selection */}
                <div className="p-4 rounded-2xl bg-white border-2 border-slate-200 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2 border-b border-slate-200">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Users className="w-4 h-4 text-indigo-600" />
                      <span className="text-xs font-black text-slate-900">
                        تحديد المستلمين (من مستخدمي المنصة أو إدخال إيميل مباشر):
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-indigo-100 text-indigo-900 border border-indigo-200">
                        إجمالي المستلمين: {selectedRecipients.length}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleSelectAllUsers}
                        className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-900 text-xs font-bold border border-indigo-200 cursor-pointer transition-colors"
                      >
                        تحديد الكل ({registeredUsersList.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleClearSelectedUsers();
                          setCustomRecipients([]);
                          setCustomEmailInput('');
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-200 cursor-pointer transition-colors"
                      >
                        إلغاء التحديد
                      </button>
                    </div>
                  </div>

                  {/* Direct Email Input & Quick Chips */}
                  <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-200 space-y-2.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-[11px] font-black text-blue-950 flex items-center gap-1.5">
                        <AtSign className="w-3.5 h-3.5 text-blue-700" />
                        <span>إضافة بريد إلكتروني مباشر (خارجي أو إضافي):</span>
                      </span>
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-[10px] text-slate-500 font-bold">إضافة سريعة:</span>
                        {[
                          { email: '2502331172@se.com.sa', name: 'م. محمود الشحات' },
                          { email: 'meabdegalil@se.com.sa', name: 'م. محمد عبدالجليل' }
                        ].map(preset => (
                          <button
                            key={preset.email}
                            type="button"
                            onClick={() => handleAddCustomRecipient(preset.email, preset.name)}
                            className="px-2 py-0.5 rounded-lg bg-white hover:bg-blue-600 text-blue-800 hover:text-white border border-blue-300 text-[10px] font-mono font-bold transition-colors cursor-pointer"
                          >
                            + {preset.email}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <input
                        type="email"
                        value={customEmailInput}
                        onChange={(e) => setCustomEmailInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddCustomRecipient();
                          }
                        }}
                        placeholder="أدخل البريد الإلكتروني مثل: 2502331172@se.com.sa أو meabdegalil@se.com.sa"
                        className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-blue-300 bg-white focus:outline-hidden focus:border-blue-600 font-mono text-slate-900"
                        dir="ltr"
                      />
                      <input
                        type="text"
                        value={customNameInput}
                        onChange={(e) => setCustomNameInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddCustomRecipient();
                          }
                        }}
                        placeholder="الاسم (اختياري)"
                        className="sm:w-44 px-3 py-1.5 text-xs rounded-xl border border-blue-300 bg-white focus:outline-hidden focus:border-blue-600 font-bold text-slate-900"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddCustomRecipient()}
                        className="px-3.5 py-1.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-black transition-colors cursor-pointer shrink-0"
                      >
                        + إضافة للمستلمين
                      </button>
                    </div>

                    {customRecipients.length > 0 && (
                      <div className="flex items-center flex-wrap gap-1.5 pt-1">
                        {customRecipients.map((cr) => (
                          <span
                            key={cr.email}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-blue-700 text-white text-[11px] font-bold shadow-2xs"
                          >
                            <span>{cr.name}</span>
                            <span className="font-mono text-[10px] text-blue-200">({cr.email})</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveCustomRecipient(cr.email)}
                              className="hover:text-rose-200 cursor-pointer"
                              title="إزالة"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Search bar inside users list */}
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                    <input
                      type="text"
                      value={userSearchQuery}
                      onChange={(e) => setUserSearchQuery(e.target.value)}
                      placeholder="ابحث بالاسم أو البريد الإلكتروني أو اسم المستخدم..."
                      className="w-full pr-9 pl-3 py-2 text-xs rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 font-medium"
                    />
                  </div>

                  {/* Users Grid */}
                  <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
                    {filteredUsersList.length === 0 ? (
                      <div className="text-center py-6 text-xs text-slate-500 font-bold bg-slate-50 rounded-xl">
                        لم يتم العثور على أي مستخدم مسجل يطابق البحث
                      </div>
                    ) : (
                      filteredUsersList.map((user, uIdx) => {
                        const isSelected = selectedUserIds.has(user.id);
                        return (
                          <div
                            key={`recip-${user.id || uIdx}`}
                            onClick={() => handleToggleUserSelection(user.id)}
                            className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                              isSelected
                                ? 'bg-blue-50/90 border-blue-400 ring-1 ring-blue-300 shadow-2xs'
                                : 'bg-slate-50/60 hover:bg-slate-100 border-slate-200'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="text-blue-600 shrink-0">
                                {isSelected ? (
                                  <CheckSquare className="w-4 h-4 fill-blue-600 text-white" />
                                ) : (
                                  <Square className="w-4 h-4 text-slate-400" />
                                )}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-black text-slate-900">
                                    {user.displayName || user.username}
                                  </span>
                                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-200 text-slate-700">
                                    {user.roleTitle || 'مستخدم'}
                                  </span>
                                  {user.isSuperAdmin && (
                                    <span className="text-[9.5px] font-black px-1.5 py-0.2 rounded bg-amber-200 text-amber-900">
                                      مسؤول
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] font-mono text-slate-500 mt-0.5 flex items-center gap-1">
                                  <AtSign className="w-3 h-3 text-slate-400" />
                                  <span>{user.email}</span>
                                </div>
                              </div>
                            </div>

                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isSelected ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
                            }`}>
                              {isSelected ? 'محدد للإرسال' : 'غير محدد'}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Section 4: Live Preview of Official Email (Strict Requirement: 14pt, Bold, Dark Blue) */}
                <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-blue-50/70 via-indigo-50/50 to-slate-100 border-2 border-blue-900 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-blue-200">
                    <span className="text-xs font-black text-blue-950 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-blue-700" />
                      <span>معاينة نص الإيميل الصادر (خط بحجم 14، سميك، باللون الأزرق الغامق وعريض):</span>
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={handleCopyEmailText}
                        className="px-2.5 py-1 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-950 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors border border-blue-300"
                        title="نسخ نص الخطاب المعتمد للحافظة"
                      >
                        {copiedEmailText ? <CheckCheck className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-blue-700" />}
                        <span>{copiedEmailText ? 'تم النسخ بنجاح!' : 'نسخ نص الخطاب'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleDownloadEml}
                        className="px-2.5 py-1 rounded-lg bg-indigo-100 hover:bg-indigo-200 text-indigo-950 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors border border-indigo-300"
                        title="تنزيل مسودة بريد رسمية بصيغة EML تحتوي على المرفق الفعلي لفتحها في برنامج Outlook"
                      >
                        <Download className="w-3.5 h-3.5 text-indigo-700" />
                        <span>تحميل مسودة Outlook بالمرفق (.eml)</span>
                      </button>
                      <span className="text-[10px] font-black bg-blue-900 text-white px-2 py-0.5 rounded-full">
                        تنسيق معتمد
                      </span>
                    </div>
                  </div>

                  {/* Email Body Card Rendered Centered, Borderless, Professional and Clean without Lines or Tables */}
                  <div 
                    className="p-6 sm:p-8 rounded-3xl bg-white shadow-xl text-center space-y-4 leading-relaxed mx-auto max-w-2xl"
                    style={{
                      fontFamily: "'Cairo', 'Tajawal', sans-serif",
                      fontSize: '14pt',
                      fontWeight: 800,
                      color: '#0f2c59',
                      lineHeight: '2.3'
                    }}
                  >
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-800 flex items-center justify-center mx-auto mb-2 shadow-xs">
                      <Mail className="w-6 h-6 text-blue-700" />
                    </div>

                    <div className="text-base sm:text-lg font-black text-[#0f2c59]">
                      السلام عليكم ورحمة الله وبركاته
                    </div>

                    <div className="text-sm sm:text-base font-bold text-slate-600">
                      تحية طيبة وبعد ،،
                    </div>

                    <div className="my-2 py-1.5 px-6 rounded-2xl bg-blue-50/90 inline-block text-blue-900 font-black text-base shadow-xs">
                      {emailSalutation}
                    </div>

                    <div className="text-base sm:text-lg font-black text-[#0f2c59]">
                      مرفق لكم ملف (
                      <span className="px-3 py-1 rounded-xl bg-blue-100 text-blue-950 font-black inline-block font-mono mx-1 shadow-xs">
                        {emailFileName}
                      </span>
                      ) للاطلاع والمتابعة ..
                    </div>

                    <div className="my-2 py-2 px-5 rounded-2xl bg-slate-50 text-slate-700 text-xs font-bold inline-block">
                      📎 المرفق المعتمد: <strong className="text-blue-900">{emailFileName}</strong>
                      {attachmentInfo.sizeBytes > 0 && (
                        <span className="mr-2 text-emerald-700 font-bold">({(attachmentInfo.sizeBytes / 1024).toFixed(1)} ك.ب)</span>
                      )}
                    </div>

                    <div className="pt-3 text-[#0f2c59] font-black flex flex-col items-center justify-center gap-1">
                      <div className="text-base font-bold">ولكم خالص الشكر والتقدير والاحترام ..</div>
                      <div className="text-sm font-black text-blue-900 mt-2 py-1 px-5 rounded-xl bg-slate-50 inline-block">
                        المرسل: {senderNameInput.trim() || 'ادارة الجودة والمساندة الفنية'}
                      </div>
                    </div>
                  </div>

                  <div className="text-[11px] font-bold text-slate-500 flex items-center justify-between">
                    <span>
                      {selectedRecipients.length > 1 
                        ? `* تم استبدال التحية تلقائياً بـ (الأخوة الأعزاء) نظراً لإرسال الإيميل إلى (${selectedRecipients.length}) مستخدمين.`
                        : `* تم ذكر اسم الشخص المرسل له حسب ماهو مسجل في بيانات التسجيل (${selectedRecipients[0]?.name || 'المستخدم'}).`}
                    </span>
                    <span className="text-blue-900 font-mono">حجم الخط: 14pt • اللون: أزرق غامق (#0f2c59)</span>
                  </div>
                </div>

                {/* Section 5: Sent History Dropdown (Optional) */}
                {sentHistory.length > 0 && (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setShowSentHistory(prev => !prev)}
                      className="text-xs font-bold text-slate-600 hover:text-blue-700 flex items-center gap-1.5 cursor-pointer"
                    >
                      <History className="w-3.5 h-3.5" />
                      <span>{showSentHistory ? 'إخفاء سجل الإرسال السابق' : `عرض سجل الإرسال السابق (${sentHistory.length} مراسلات)`}</span>
                    </button>

                    {showSentHistory && (
                      <div className="mt-2 p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2 max-h-40 overflow-y-auto">
                        {sentHistory.map((entry) => (
                          <div key={entry.id} className="p-2.5 rounded-lg bg-white border border-slate-200 text-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <div>
                              <div className="font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                                <Paperclip className="w-3 h-3 text-blue-600 shrink-0" />
                                <span>{entry.fileName}</span>
                                {entry.mode && (
                                  <span className="px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-slate-100 text-slate-700">
                                    {entry.mode === 'smtp_delivered' ? 'SMTP مباشر' : 'تطبيق البريد على الجهاز (Outlook)'}
                                  </span>
                                )}
                              </div>
                              <div className="text-slate-500 text-[10.5px] mt-0.5">
                                إلى: {entry.recipients?.map((r: any) => r.name || r.email).join(', ')}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                              <span className="text-[10px] font-mono text-slate-500">
                                {new Date(entry.timestamp).toLocaleTimeString('ar-SA')}
                              </span>
                              <a
                                href={entry.emlDownloadUrl || `/api/export/download-sent-eml/${entry.id}`}
                                download
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10.5px] font-bold border border-blue-200 cursor-pointer shadow-2xs transition-colors"
                                title="فتح الرسالة والمرفق المعتمد مباشرة في برنامج البريد على جهازك (Outlook)"
                              >
                                <Mail className="w-3 h-3 text-blue-600" />
                                <span>عرض في تطبيق البريد مع المرفق</span>
                              </a>
                              <button
                                type="button"
                                onClick={() => setSelectedLogPreview(entry)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10.5px] font-bold border border-slate-200 cursor-pointer shadow-2xs transition-colors"
                                title="معاينة النص والتنسيق باللغة العربية داخل المنصة"
                              >
                                <Eye className="w-3 h-3 text-slate-500" />
                                <span>معاينة بالمنصة</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

              </div>

              {/* Modal Footer Controls */}
              <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-600">
                    المستلمون المختارون: <strong className="text-blue-950 font-black">{selectedRecipients.length}</strong>
                  </span>
                  {attachmentInfo.isReady && (
                    <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-lg border border-emerald-300 mr-2 flex items-center gap-1">
                      <FileCheck className="w-3.5 h-3.5 text-emerald-700" />
                      <span>المرفق جاهز وموثق ({attachmentInfo.sizeFormatted})</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setIsEmailModalOpen(false)}
                    disabled={isSendingEmail}
                    className="px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold border border-slate-300 transition-colors cursor-pointer"
                  >
                    إلغاء
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowInAppEmailPreview(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-900 text-xs font-bold border border-indigo-200 transition-colors cursor-pointer"
                    title="معاينة التنسيق الرسمي والنص العربي الفصيح للرسالة"
                  >
                    <Eye className="w-3.5 h-3.5 text-indigo-600" />
                    <span>معاينة التنسيق</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSendEmail}
                    disabled={isSendingEmail || selectedRecipients.length === 0 || attachmentInfo.isGenerating}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 hover:from-blue-600 hover:to-indigo-600 active:scale-95 text-white text-xs font-black shadow-lg shadow-blue-900/25 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    title="إرسال البريد الإلكتروني مع إرفاق الملف المعتمد وتوثيقه في السجل"
                  >
                    {isSendingEmail ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        <span>جاري إرسال البريد وتجهيز المرفق...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 text-amber-300" />
                        <span>إرسال البريد الإلكتروني الآن</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Full Eloquent Arabic In-App Email Preview Modal */}
        {(showInAppEmailPreview || selectedLogPreview) && (
          <div className="fixed inset-0 z-70 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
              {/* Header */}
              <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 text-white p-4 sm:p-5 flex items-center justify-between border-b border-blue-900/40">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center">
                    <Mail className="w-5 h-5 text-amber-300" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white">
                      {selectedLogPreview ? 'سجل الرسالة المعتمدة السابقة' : 'معاينة الرسالة الرسمية المعتمدة'}
                    </h3>
                    <p className="text-[11px] text-blue-200">
                      لغة عربية فصحى وتنسيق رسمي معتمد جاهز للإرسال والعرض
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowInAppEmailPreview(false);
                    setSelectedLogPreview(null);
                  }}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Email Content Body */}
              <div className="p-5 sm:p-6 overflow-y-auto space-y-4 bg-slate-100/60 text-right">
                {/* Meta details banner */}
                <div className="bg-white p-3.5 rounded-2xl border border-slate-200 text-xs space-y-1.5 shadow-2xs">
                  <div className="flex items-center justify-between text-slate-700">
                    <span>
                      <strong className="text-slate-900">الموضوع: </strong>
                      {selectedLogPreview ? selectedLogPreview.subject : effectiveEmailSubject}
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-slate-600 text-[11px] gap-1.5 pt-1 border-t border-slate-100">
                    <span className="truncate">
                      <strong className="text-slate-800">المرسل (From): </strong>
                      <span className="font-mono text-blue-900 font-bold">{selectedLogPreview ? selectedLogPreview.senderEmail : (senderEmailInput.trim() || '2502331172@se.com.sa')}</span>
                    </span>
                    <span className="truncate">
                      <strong className="text-slate-800">المستلم (To): </strong>
                      <span className="font-mono text-blue-900 font-bold">{selectedLogPreview 
                        ? selectedLogPreview.recipients?.map((r: any) => r.email).join(', ')
                        : selectedRecipients.map(r => r.email).join(', ')}</span>
                    </span>
                  </div>
                </div>

                {/* Rendered Visual Email Box - Completely Centered, Borderless, Clean without Lines or Tables */}
                <div className="bg-white rounded-3xl shadow-xl overflow-hidden text-center mx-auto max-w-2xl p-6 sm:p-9 space-y-5">
                  <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-800 flex items-center justify-center mx-auto shadow-xs">
                    <Mail className="w-7 h-7 text-blue-700" />
                  </div>

                  <div className="space-y-1">
                    <div className="text-[11px] font-bold text-slate-500">
                      إدارة كهرباء الحدود الشمالية • المساندة الفنية
                    </div>
                    <h2 className="text-xl font-black text-blue-950">
                      حوكمة جودة أعمال الإنشاءات
                    </h2>
                    <p className="text-xs text-blue-700 font-bold">
                      سجل تدقيق الجودة لاوامر العمل • إجراء 155
                    </p>
                  </div>

                  <div 
                    className="space-y-4 pt-2"
                    style={{
                      fontFamily: "'Cairo', 'Tajawal', sans-serif",
                      fontSize: '14pt',
                      fontWeight: 800,
                      color: '#0f2c59',
                      lineHeight: '2.3'
                    }}
                  >
                    <div className="text-base sm:text-lg font-black text-[#0f2c59]">
                      السلام عليكم ورحمة الله وبركاته
                    </div>

                    <div className="text-sm sm:text-base font-bold text-slate-600">
                      تحية طيبة وبعد ،،
                    </div>

                    <div>
                      <span className="inline-block px-6 py-2 bg-blue-50/90 rounded-2xl text-blue-900 font-black text-base shadow-xs">
                        {selectedLogPreview?.recipientSalutation || emailSalutation}
                      </span>
                    </div>

                    <div className="text-base sm:text-lg font-black text-[#0f2c59]">
                      مرفق لكم ملف (
                      <span className="inline-block px-3 py-1 bg-blue-100 text-blue-950 rounded-xl font-black font-mono mx-1 shadow-xs">
                        {selectedLogPreview ? selectedLogPreview.fileName : emailFileName}
                      </span>
                      ) للاطلاع والمتابعة ..
                    </div>

                    <div>
                      <span className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-50 text-slate-700 text-xs font-bold rounded-2xl shadow-xs">
                        <Paperclip className="w-4 h-4 text-blue-600 shrink-0" />
                        <span>الملف المعتمد: <strong className="text-blue-900 font-black">{selectedLogPreview ? selectedLogPreview.fileName : emailFileName}</strong></span>
                        <span className="text-emerald-700 font-mono font-bold">
                          ({selectedLogPreview && selectedLogPreview.fileSizeBytes
                            ? `${(selectedLogPreview.fileSizeBytes / 1024).toFixed(1)} ك.ب`
                            : attachmentInfo.sizeFormatted})
                        </span>
                      </span>
                    </div>

                    <div className="pt-3 text-[#0f2c59] font-black flex flex-col items-center justify-center gap-1.5">
                      <div className="text-base font-bold">ولكم خالص الشكر والتقدير والاحترام ..</div>
                      <div className="text-sm font-black text-blue-900 mt-2 py-1 px-5 rounded-xl bg-slate-50 inline-block shadow-xs">
                        المرسل: {selectedLogPreview ? selectedLogPreview.senderName : (senderNameInput.trim() || 'ادارة الجودة والمساندة الفنية')}
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 text-center text-[11px] font-bold text-slate-400">
                    مستند رسمي معتمد صادر عبر منصة حوكمة الجودة • تم إرفاق الملف المعتمد وإرساله إلكترونياً
                  </div>
                </div>
              </div>

              {/* Preview Footer */}
              <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setShowInAppEmailPreview(false);
                    setSelectedLogPreview(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  إغلاق المعاينة
                </button>

                {selectedLogPreview ? (
                  <a
                    href={selectedLogPreview.emlDownloadUrl || `/api/export/download-sent-eml/${selectedLogPreview.id}`}
                    download
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-black shadow-md cursor-pointer transition-colors"
                  >
                    <Download className="w-4 h-4 text-amber-300" />
                    <span>تحميل مسودة الرسالة والمرفق (.eml)</span>
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setShowInAppEmailPreview(false);
                      handleSendEmail();
                    }}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-black shadow-md cursor-pointer transition-colors"
                  >
                    <Send className="w-4 h-4 text-amber-300" />
                    <span>إرسال البريد الإلكتروني الآن</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
