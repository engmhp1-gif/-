import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  WorkOrder, 
  ColumnDefinition, 
  DropdownOptionsMap,
  Procedure155Status,
  UserPermissions,
  AttachedInspectionFile,
  SHAREPOINT_AUDIT_URL,
  buildSharePointDirectWorkOrderSearchUrl,
  SubOffice
} from '../types';
import { 
  Plus, 
  Search, 
  Filter, 
  X, 
  Check, 
  RotateCcw, 
  Copy, 
  Camera, 
  ShieldCheck, 
  AlertCircle,
  AlertTriangle,
  Edit3,
  FileEdit,
  Trash2,
  Calendar,
  FileSpreadsheet,
  FileDown,
  Download,
  ChevronDown,
  CheckCircle2,
  XCircle,
  MinusCircle,
  ListChecks,
  Maximize2,
  Minimize2,
  Sparkles,
  LayoutList,
  WrapText,
  ZoomIn,
  ZoomOut,
  SlidersHorizontal,
  Undo2,
  Redo2,
  FileText,
  Presentation,
  Printer,
  Image as ImageIcon,
  Loader2,
  Lock,
  RefreshCw,
  Layers,
  CalendarPlus,
  Clock,
  Zap,
  Mail,
  Palette,
  Expand,
  FileCheck2,
  TableProperties,
  Eye,
  Link2,
  ArrowLeftRight,
  FolderOpen,
  Move,
  Upload,
  ExternalLink,
  Pin,
  Gauge,
  Pickaxe,
  Boxes,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  MoveHorizontal,
  BookOpen
} from 'lucide-react';
import { DeleteTableModal } from './DeleteTableModal';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { QualityNotesItemizerModal } from './QualityNotesItemizerModal';
import { CrossTableMatchModal } from './CrossTableMatchModal';
import { FloatingInspectionCard } from './FloatingInspectionCard';
import { OnlineFileViewerModal } from './OnlineFileViewerModal';
import { QualityNotesReportModal } from './QualityNotesReportModal';
import { AuditChecklistModal, renderAuditCategoryIcon } from './AuditChecklistModal';
import {
  TechnicalSupportAuditModal,
  AuditStagesReferenceModal,
  TECHNICAL_SUPPORT_CHECKLIST_ITEMS,
  normalizeSupportChecklistValue,
  extractOrderSupportChecklistMap,
  getEvaluatedSupportChecklistKeys,
  extractColumnSupportChecklistMap,
  getEvaluatedColumnSupportChecklistKeys,
  calculateSupportChecklistStats,
  deriveSyncedAttachmentStatus,
  SupportChecklistFieldKey,
  TechnicalSupportAuditPayload
} from './TechnicalSupportAuditModal';
import { TableActionCards } from './TableActionCards';
import { TableSmartToolbar } from './TableSmartToolbar';
import { ExcelRibbonToolbar } from './ExcelRibbonToolbar';
import { 
  exportToExcel, 
  exportToPptx, 
  exportToCsv,
  exportOrdersDirectToPdf,
  exportOrdersDirectToImage
} from '../services/exportService';
import { realtime } from '../services/realtimeService';
import { soundService } from '../services/soundService';
import { getArabicMonthName, buildCrossTableMatchesMap, MatchedTableOrder, getWorkOrderIdentityKey, isSameWorkOrderIdentity, findDuplicateOrderIdsFast } from '../utils/tableScope';
import { isSessionUnlocked, canUserEditColumn, isColumnUniversallyEditable, getSavedCurrentUser } from '../utils/security';
import { PlatformUser, MonthTable, WorkOrderAuditColumnData } from '../types';
import { ensurePhotosFileColumn } from '../data/initialData';
import {
  AUDIT_CATEGORIES_META,
  AuditCategoryKey,
  calculateCategoryAuditStatus,
  calculateOverallAuditColumnSummary,
  createEmptyAuditColumnData
} from '../data/auditChecklistData';
import { calculateSmartPopoverPosition, getPopoverStyle, CalculatedPopoverPosition } from '../utils/popoverPosition';
import { useUIDesignMode } from '../utils/uiDesignMode';
import { getContractorsForOffice, getConsultantsForOffice } from '../services/contractorService';
import { getEffectiveProcedure155Status, isOrderQualified100InAllThreeAudits } from '../utils/auditTracker';

interface WorkOrdersTableProps {
  orders: WorkOrder[];
  allOrders?: WorkOrder[];
  monthTables?: MonthTable[];
  officeTitle: string;
  columns: ColumnDefinition[];
  dropdownOptions: DropdownOptionsMap;
  currentUser?: PlatformUser | null;
  onEdit: (order: WorkOrder) => void;
  onEditBasicData?: (order: WorkOrder) => void;
  onUpdateOrder?: (order: WorkOrder) => void;
  onDelete: (id: string) => void;
  onDeleteBatch?: (ids: string[]) => void;
  onViewPhotos: (order: WorkOrder) => void;
  onAudit155: (order: WorkOrder) => void;
  onOpenAddModal: () => void;
  onOpenImportModal?: () => void;
  onOpenCompatibleImport?: () => void;
  onOpenColumnManager?: () => void;
  onOpenDropdownManager?: () => void;
  onOpenExportModal?: (customOrders?: WorkOrder[], customTitle?: string, openEmail?: boolean) => void;
  onClearOfficeOrders?: (officeName: string) => Promise<void>;
  onClearAllOrders?: () => Promise<void>;
  onFilteredOrdersChange?: (filteredOrders: WorkOrder[]) => void;
  onOpenDataRecovery?: () => void;
  activeTableName?: string;
  activeYear?: number;
  activeMonth?: number | 'all';
  onOpenYearMonthPicker?: () => void;
  onRequestAuth?: (actionName?: string, onSuccessCallback?: () => void) => void;
  onCheckPermission?: (permKey: keyof UserPermissions, actionTitle: string, callback?: () => void) => boolean;
  isSessionUnlockedState?: boolean;
  presentationMode?: 'docked' | 'overlay';
  onChangePresentationMode?: (mode: 'docked' | 'overlay') => void;
  onCloseTable?: () => void;
  offices?: SubOffice[];
  onOpenNotesReport?: (mode?: 'all' | 'recurring_all' | 'recurring_contractor', contractor?: string) => void;
  highlightedOrderId?: string | null;
  onActiveAuditOrderChange?: (orderId: string | null) => void;
}

export const WorkOrdersTable: React.FC<WorkOrdersTableProps> = ({
  orders,
  allOrders,
  monthTables = [],
  officeTitle,
  columns: rawColumns,
  dropdownOptions,
  presentationMode = 'docked',
  onChangePresentationMode,
  onCloseTable,
  currentUser,
  onEdit,
  onEditBasicData,
  onUpdateOrder,
  onDelete,
  onDeleteBatch,
  onViewPhotos,
  onAudit155,
  onOpenAddModal,
  onOpenImportModal,
  onOpenCompatibleImport,
  onOpenColumnManager,
  onOpenDropdownManager,
  onOpenExportModal,
  onClearOfficeOrders,
  onClearAllOrders,
  onFilteredOrdersChange,
  onOpenDataRecovery,
  activeTableName,
  activeYear,
  activeMonth,
  onOpenYearMonthPicker,
  onRequestAuth,
  onCheckPermission,
  isSessionUnlockedState,
  offices = [],
  onOpenNotesReport: externalOpenNotesReport,
  highlightedOrderId,
  onActiveAuditOrderChange
}) => {
  const [uiMode] = useUIDesignMode();
  const isERP = uiMode === 'official_erp';
  const isPro = uiMode === 'global_pro' || isERP;

  // Ensure photosFile column is permanently fixed and merged into all tables on the platform
  const columns = useMemo(() => ensurePhotosFileColumn(rawColumns), [rawColumns]);

  // Direct export loading states
  const [isDirectExportingPdf, setIsDirectExportingPdf] = useState(false);
  const [isDirectExportingImage, setIsDirectExportingImage] = useState(false);

  // Multi-selection state for batch deletion and bulk actions
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());

  // In-app deletion confirmation dialog state (no iframe-blocked window.confirm)
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<{
    type: 'single' | 'batch' | 'selected';
    order?: WorkOrder;
    ids?: string[];
    title: string;
    message: string;
  } | null>(null);

  // Column-specific filter state: Record<columnField, selectedValues[]>
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
  const [openFilterCol, setOpenFilterCol] = useState<string | null>(null);
  const [filterPopupPos, setFilterPopupPos] = useState<CalculatedPopoverPosition | null>(null);
  const [filterSearchQuery, setFilterSearchQuery] = useState<string>('');

  // Column Sorting State
  const [sortConfig, setSortConfig] = useState<{ field: string; direction: 'asc' | 'desc' } | null>(null);

  // Quick Inline Cell Dropdown Editing State (Positioned Fixed Above Table to Never Get Clipped)
  const [openInlineDropdown, setOpenInlineDropdown] = useState<{
    orderId: string;
    field: string;
    colTitle: string;
    displayVal: string;
    options: string[];
    rect: { top: number; bottom: number; left: number; right: number; width: number; height: number };
    openUpward: boolean;
  } | null>(null);

  const [editingQualityNotes, setEditingQualityNotes] = useState<{
    orderId: string;
    text: string;
    rect: { top: number; bottom: number; left: number; right: number; width: number; height: number };
    openUpward: boolean;
  } | null>(null);

  // Quality Notes Itemizer & Multi-Photo Modal State
  const [itemizerModalOrder, setItemizerModalOrder] = useState<WorkOrder | null>(null);

  // Inline text cell editing state (تعديل مباشر وسلس للخلايا النصية للأعضاء المصرح لهم)
  const [editingTextCell, setEditingTextCell] = useState<{
    orderId: string;
    field: string;
    value: string;
  } | null>(null);

  // Selected order for toolbar edit action
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  // Copy feedback state: key = `${orderId}-${field}`
  const [copiedCellKey, setCopiedCellKey] = useState<string | null>(null);

  // Delete Table Modal State (محمي بالرمز 321)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Smart Adaptive Containment: Show All Rows vs Scroll-limited, and Wrap Text
  const [isFullyExpanded, setIsFullyExpanded] = useState<boolean>(false);
  const [isWrapTextEnabled, setIsWrapTextEnabled] = useState<boolean>(true);
  
  // Intelligent Browser Window Auto-Fit State (Default false = extended horizontal scroll with strict min-widths)
  const [isAutoFitToScreen, setIsAutoFitToScreen] = useState<boolean>(false);
  const [zoomPercent, setZoomPercent] = useState<number>(100);

  // Export Menu State & Notification
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isMoreToolsMenuOpen, setIsMoreToolsMenuOpen] = useState(false);
  const [exportNotification, setExportNotification] = useState<string | null>(null);
  const [exportScope, setExportScope] = useState<'filtered' | 'all' | 'selected'>('filtered');
  const [filterOnlyDuplicates, setFilterOnlyDuplicates] = useState<boolean>(false);

  // Presentation mode state: 'docked' (in-page card) or 'overlay' (independent floating card above home page)
  const [internalPresentationMode, setInternalPresentationMode] = useState<'docked' | 'overlay'>(presentationMode || 'docked');
  useEffect(() => {
    if (presentationMode) setInternalPresentationMode(presentationMode);
  }, [presentationMode]);

  useEffect(() => {
    if (!highlightedOrderId) return;
    setColumnFilters({});
    setFilterOnlyDuplicates(false);
    setSelectedOrderId(highlightedOrderId);
    setSelectedOrderIds(new Set([highlightedOrderId]));
    const timer = setTimeout(() => {
      const rowEl = document.getElementById(`wo-row-${highlightedOrderId}`);
      if (rowEl) {
        rowEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        rowEl.classList.add('ring-4', 'ring-amber-500', 'bg-amber-100');
        setTimeout(() => {
          rowEl.classList.remove('ring-4', 'ring-amber-500', 'bg-amber-100');
        }, 2200);
      }
    }, 120);
    return () => clearTimeout(timer);
  }, [highlightedOrderId]);

  // Notes Report Modal State
  const [isNotesReportOpen, setIsNotesReportOpen] = useState(false);
  const [notesReportMode, setNotesReportMode] = useState<'all' | 'recurring_all' | 'recurring_contractor'>('all');
  const [notesReportContractor, setNotesReportContractor] = useState<string>('');

  const handleOpenNotesReport = (mode?: 'all' | 'recurring_all' | 'recurring_contractor', contractor?: string) => {
    if (externalOpenNotesReport) {
      externalOpenNotesReport(mode, contractor);
      return;
    }
    setNotesReportMode(mode || 'all');
    setNotesReportContractor(contractor || '');
    setIsNotesReportOpen(true);
  };

  // Dedicated Online File Viewer Modal State (Direct high-fidelity preview from table cell without download)
  const [viewerModalFile, setViewerModalFile] = useState<AttachedInspectionFile | null>(null);
  const [viewerModalOrder, setViewerModalOrder] = useState<WorkOrder | null>(null);
  const [viewingCrossMatchOrder, setViewingCrossMatchOrder] = useState<WorkOrder | null>(null);

  // Movable Floating Inspection Card State (بطاقة منفصلة يمكن تحريكها في أي مكان لتدقيق ملف الصور و PDF)
  const [floatingInspectionOrder, setFloatingInspectionOrder] = useState<WorkOrder | null>(null);
  const [cellFileInputOrderId, setCellFileInputOrderId] = useState<string | null>(null);
  const cellFileInputRef = useRef<HTMLInputElement>(null);

  // Audit Checklist Modal State for PDC and Construction Audit (القائمة الأساسية الموحدة + مراحل التدقيق للاطلاع)
  const [activeAuditModal, setActiveAuditModal] = useState<{
    order: WorkOrder;
    columnField: 'pdcAudit' | 'constructionAudit';
    columnTitle: string;
    initialCategoryKey?: AuditCategoryKey | null;
    initialFocusField?: SupportChecklistFieldKey | null;
    initialOpenStages?: boolean;
  } | null>(null);

  // Direct Read-Only Audit Stages Reference Modal State (نافذة مراحل التدقيق المنبثقة للاطلاع فقط)
  const [activeStagesReferenceModal, setActiveStagesReferenceModal] = useState<{
    order: WorkOrder;
    columnTitle: string;
  } | null>(null);

  // External Technical Support Audit Checklist Card State (بطاقة نتائج تدقيق المساندة الفنية - أو وضع العرض فقط من بطاقة حالة الإرفاق)
  const [activeSupportAuditModal, setActiveSupportAuditModal] = useState<{
    order: WorkOrder;
    focusField?: SupportChecklistFieldKey | null;
    viewMode?: 'audit' | 'attachment_readonly';
  } | null>(null);

  useEffect(() => {
    if (!onActiveAuditOrderChange) return;
    const activeId =
      activeAuditModal?.order?.id ||
      (activeSupportAuditModal && activeSupportAuditModal.viewMode !== 'attachment_readonly'
        ? activeSupportAuditModal.order?.id
        : null) ||
      null;
    onActiveAuditOrderChange(activeId);
  }, [activeAuditModal, activeSupportAuditModal, onActiveAuditOrderChange]);

  const handleCellFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!cellFileInputOrderId || !e.target.files || e.target.files.length === 0) return;
    const targetOrder = orders.find(o => o.id === cellFileInputOrderId) || allOrders?.find(o => o.id === cellFileInputOrderId);
    if (!targetOrder) return;

    const newFiles: AttachedInspectionFile[] = [];
    let processed = 0;
    const filesToProcess = e.target.files;

    Array.from(filesToProcess).forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        newFiles.push({
          id: `file-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          name: file.name,
          size: file.size,
          type: file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
          dataUrl,
          uploadedAt: new Date().toISOString()
        });
        processed++;
        if (processed === filesToProcess.length) {
          const currentList = targetOrder.photosFile || [];
          const updated: WorkOrder = {
            ...targetOrder,
            photosFile: [...currentList, ...newFiles],
            updatedAt: new Date().toISOString()
          };
          if (onUpdateOrder) {
            onUpdateOrder(updated);
          }
          setExportNotification(`تم استيراد وإرفاق ${newFiles.length} ملف بنجاح في ملف الصور`);
          setTimeout(() => setExportNotification(null), 3000);
          try {
            soundService.playActionSound('create');
          } catch (_) {}
        }
      };
      reader.onerror = () => { processed++; };
      reader.readAsDataURL(file);
    });

    if (cellFileInputRef.current) cellFileInputRef.current.value = '';
    setCellFileInputOrderId(null);
  };

  const contractorsList = useMemo(() => {
    const set = new Set<string>();
    orders.forEach(o => { if (o.contractor?.trim()) set.add(o.contractor.trim()); });
    allOrders?.forEach(o => { if (o.contractor?.trim()) set.add(o.contractor.trim()); });
    offices.forEach(off => { off.contractors?.forEach(c => set.add(c.trim())); });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [orders, allOrders, offices]);

  const handleRenameFileInOrder = (fileId: string, newName: string) => {
    if (!viewerModalOrder) return;
    const currentList = viewerModalOrder.photosFile || [];
    const updatedList = currentList.map(f => f.id === fileId ? { ...f, name: newName } : f);
    const updated: WorkOrder = {
      ...viewerModalOrder,
      photosFile: updatedList,
      updatedAt: new Date().toISOString()
    };
    if (onUpdateOrder) {
      onUpdateOrder(updated);
    }
    setViewerModalOrder(updated);
    if (viewerModalFile && viewerModalFile.id === fileId) {
      setViewerModalFile({ ...viewerModalFile, name: newName });
    }

    // Server-side persistent rename and real-time broadcast
    fetch('/api/files/rename', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: viewerModalOrder.id,
        fileId,
        newName,
        senderId: realtime.getClientId(),
        senderName: currentUser?.displayName || currentUser?.username || 'مستخدم المنظومة'
      })
    }).catch(() => {});

    setExportNotification(`تم تعديل اسم الملف إلى "${newName}" بنجاح`);
    setTimeout(() => setExportNotification(null), 3000);
  };

  // Compute cross-table matches based on (workOrderNumber) AND (workOrderCode) across all tables in the platform
  const crossTableMatchesMap = useMemo(() => {
    return buildCrossTableMatchesMap(allOrders && allOrders.length > 0 ? allOrders : orders, monthTables || []);
  }, [allOrders, orders, monthTables]);

  const crossTableMatchesCount = useMemo(() => {
    return orders.filter(w => crossTableMatchesMap.has(w.id)).length;
  }, [orders, crossTableMatchesMap]);

  // Custom row background color state: orderId -> hex color
  const [customRowColors, setCustomRowColors] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('sec_custom_row_colors');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const handleSetRowColor = (color: string | null) => {
    const targetIds = selectedOrderIds.size > 0 
      ? Array.from(selectedOrderIds) 
      : filteredOrders.map(o => o.id);
    if (targetIds.length === 0) return;

    setCustomRowColors(prev => {
      const next = { ...prev };
      targetIds.forEach(id => {
        if (!color) {
          delete next[id];
        } else {
          next[id] = color;
        }
      });
      try {
        localStorage.setItem('sec_custom_row_colors', JSON.stringify(next));
      } catch (_) {}
      return next;
    });
    setExportNotification(
      color 
        ? `تم تلوين خلفية (${targetIds.length}) صف بنجاح`
        : `تم إلغاء تلوين خلفية (${targetIds.length}) صف`
    );
    setTimeout(() => setExportNotification(null), 3000);
  };

  // Auto-fit rows and columns handler
  const handleAutoFitAll = () => {
    setIsAutoFitToScreen(true);
    setIsWrapTextEnabled(false);
    setTableDensity('compact');
    setZoomPercent(100);
    setExportNotification('تم ضغط واحتواء كافة الصفوف والأعمدة تلقائياً لمنع التكدس وإظهار أكبر عدد من الصفوف');
    setTimeout(() => setExportNotification(null), 3500);
  };

  const [tableDensity, setTableDensity] = useState<'compact' | 'normal' | 'spacious'>('compact');
  // Default unpinned columns as requested by user (اجعل الافتراضي للجداول عدم تثبيت الاعمدة المحددة)
  const [isStickyFirstCol, setIsStickyFirstCol] = useState<boolean>(false);
  const [isStickyCoreColumns, setIsStickyCoreColumns] = useState<boolean>(false);

  // Active Excel text formatting & automatic centering + Direct Cell Binding for ALL Work Order Cells
  const [tableTextAlign, setTableTextAlign] = useState<'center' | 'right' | 'left'>('center');
  const [isTableBold, setIsTableBold] = useState<boolean>(true);
  const [isTableItalic, setIsTableItalic] = useState<boolean>(false);
  const [isTableUnderline, setIsTableUnderline] = useState<boolean>(false);
  const [isTableStrikethrough, setIsTableStrikethrough] = useState<boolean>(false);
  const [tableFontSize, setTableFontSize] = useState<number>(12);
  const [tableFontFamily, setTableFontFamily] = useState<string>('Cairo');
  const [tableVerticalAlign, setTableVerticalAlign] = useState<'top' | 'middle' | 'bottom'>('middle');
  const [tableBorderStyle, setTableBorderStyle] = useState<'all' | 'box' | 'bottom' | 'none'>('all');
  const [tableNumberFormat, setTableNumberFormat] = useState<'general' | 'number' | 'percent' | 'currency'>('general');
  const [tableTextColor, setTableTextColor] = useState<string | null>(null);

  // Active Cell tracking & per-cell custom formatting (مرتبط بجميع خلايا أمر العمل الميداني)
  const [activeCell, setActiveCell] = useState<{ orderId: string; field: string; colTitle: string } | null>(null);
  const [formattingScope, setFormattingScope] = useState<'cell' | 'table'>('table');
  const [internalClipboardText, setInternalClipboardText] = useState<string>('');
  const [customCellStyles, setCustomCellStyles] = useState<Record<string, {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    strikethrough?: boolean;
    fontSize?: number;
    fontFamily?: string;
    textColor?: string | null;
    bgColor?: string | null;
    textAlign?: 'center' | 'right' | 'left';
    verticalAlign?: 'top' | 'middle' | 'bottom';
  }>>(() => {
    try {
      const saved = localStorage.getItem('sec_custom_cell_styles');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const updateCellOrTableStyle = (
    patch: Partial<{
      bold: boolean;
      italic: boolean;
      underline: boolean;
      strikethrough: boolean;
      fontSize: number;
      fontFamily: string;
      textColor: string | null;
      bgColor: string | null;
      textAlign: 'center' | 'right' | 'left';
      verticalAlign: 'top' | 'middle' | 'bottom';
    }>
  ) => {
    if (formattingScope === 'cell' && activeCell) {
      const key = `${activeCell.orderId}:::${activeCell.field}`;
      setCustomCellStyles(prev => {
        const current = prev[key] || {};
        const next = {
          ...prev,
          [key]: { ...current, ...patch }
        };
        try {
          localStorage.setItem('sec_custom_cell_styles', JSON.stringify(next));
        } catch (_) {}
        return next;
      });
      // Also persist on the order's cellStyles object if onUpdateOrder is available
      const targetOrder = orders.find(o => o.id === activeCell.orderId);
      if (targetOrder && onUpdateOrder) {
        const existingCellStyle = targetOrder.cellStyles?.[activeCell.field] || {};
        onUpdateOrder({
          ...targetOrder,
          cellStyles: {
            ...(targetOrder.cellStyles || {}),
            [activeCell.field]: {
              ...existingCellStyle,
              ...(patch.bold !== undefined ? { bold: patch.bold } : {}),
              ...(patch.italic !== undefined ? { italic: patch.italic } : {}),
              ...(patch.underline !== undefined ? { underline: patch.underline } : {}),
              ...(patch.strikethrough !== undefined ? { strikethrough: patch.strikethrough } : {}),
              ...(patch.fontSize !== undefined ? { fontSize: patch.fontSize } : {}),
              ...(patch.fontFamily !== undefined ? { fontFamily: patch.fontFamily } : {}),
              ...(patch.textColor !== undefined ? { textColor: patch.textColor || undefined } : {}),
              ...(patch.bgColor !== undefined ? { bgColor: patch.bgColor || undefined } : {}),
              ...(patch.textAlign !== undefined ? { textAlign: patch.textAlign } : {}),
              ...(patch.verticalAlign !== undefined ? { verticalAlign: patch.verticalAlign } : {})
            }
          }
        });
      }
      return;
    }

    // Apply to table-wide state AND clear conflicting cell overrides so all cells respond immediately
    if (patch.bold !== undefined) setIsTableBold(patch.bold);
    if (patch.italic !== undefined) setIsTableItalic(patch.italic);
    if (patch.underline !== undefined) setIsTableUnderline(patch.underline);
    if (patch.strikethrough !== undefined) setIsTableStrikethrough(patch.strikethrough);
    if (patch.fontSize !== undefined) setTableFontSize(patch.fontSize);
    if (patch.fontFamily !== undefined) setTableFontFamily(patch.fontFamily);
    if (patch.textColor !== undefined) setTableTextColor(patch.textColor);
    if (patch.textAlign !== undefined) setTableTextAlign(patch.textAlign);
    if (patch.verticalAlign !== undefined) setTableVerticalAlign(patch.verticalAlign);
    if (patch.bgColor !== undefined) {
      handleSetRowColor(patch.bgColor);
    }

    // Also update any existing cell overrides for the modified property so all cells stay synchronized
    setCustomCellStyles(prev => {
      const keys = Object.keys(prev);
      if (keys.length === 0) return prev;
      const next = { ...prev };
      keys.forEach(k => {
        next[k] = { ...next[k], ...patch };
      });
      try {
        localStorage.setItem('sec_custom_cell_styles', JSON.stringify(next));
      } catch (_) {}
      return next;
    });
  };

  const getResolvedCellStyle = (order: WorkOrder, field: string) => {
    const key = `${order.id}:::${field}`;
    const localCell = customCellStyles[key];
    const orderCell = order.cellStyles?.[field];
    const merged = { ...(orderCell || {}), ...(localCell || {}) };

    const bold = merged.bold !== undefined ? merged.bold : isTableBold;
    const italic = merged.italic !== undefined ? merged.italic : isTableItalic;
    const underline = merged.underline !== undefined ? merged.underline : isTableUnderline;
    const strikethrough = merged.strikethrough !== undefined ? merged.strikethrough : isTableStrikethrough;
    const fontSize = merged.fontSize || tableFontSize;
    const fontFamily = merged.fontFamily || tableFontFamily;
    const textColor = merged.textColor !== undefined ? merged.textColor : tableTextColor;
    const bgColor = merged.bgColor !== undefined ? merged.bgColor : null;
    const textAlign = merged.textAlign || tableTextAlign;
    const verticalAlign = merged.verticalAlign || tableVerticalAlign;

    const textDecoration = [
      underline ? 'underline' : '',
      strikethrough ? 'line-through' : ''
    ].filter(Boolean).join(' ') || undefined;

    return {
      bold,
      italic,
      underline,
      strikethrough,
      fontSize,
      fontFamily,
      textColor,
      bgColor,
      textAlign,
      verticalAlign,
      textDecoration
    };
  };

  // Smooth Interactive Column Resizing and Double-Click Auto-Fit
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const resizingColRef = useRef<{ colId: string; startX: number; startWidth: number } | null>(null);

  const handleColResizeStart = (colId: string, currentWidth: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizingColRef.current = { colId, startX: e.clientX, startWidth: currentWidth };

    const onMouseMove = (moveEv: MouseEvent) => {
      if (!resizingColRef.current) return;
      // RTL: dragging to left increases width
      const delta = resizingColRef.current.startX - moveEv.clientX;
      const newWidth = Math.max(65, Math.min(850, resizingColRef.current.startWidth + delta));
      setColumnWidths(prev => ({ ...prev, [colId]: newWidth }));
    };

    const onMouseUp = () => {
      resizingColRef.current = null;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleColDoubleClick = (col: ColumnDefinition) => {
    let maxLen = (col.title || '').length;
    for (const o of filteredOrders) {
      const val = String((o as any)[col.field] ?? '');
      if (val.length > maxLen) maxLen = val.length;
    }
    const computedWidth = Math.max(90, Math.min(650, maxLen * 10 + 44));
    setColumnWidths(prev => ({ ...prev, [col.id]: computedWidth }));
    setExportNotification(`تم احتواء عمود (${col.title}) تلقائياً لمطابقة المحتوى (${computedWidth}px)`);
    setTimeout(() => setExportNotification(null), 2500);
  };

  const handleAutoFitAllColumns = () => {
    const nextWidths: Record<string, number> = {};
    columns.forEach(col => {
      let maxLen = (col.title || '').length;
      for (const o of filteredOrders) {
        const val = String((o as any)[col.field] ?? '');
        if (val.length > maxLen) maxLen = val.length;
      }
      nextWidths[col.id] = Math.max(90, Math.min(650, maxLen * 10 + 44));
    });
    setColumnWidths(nextWidths);
    setIsAutoFitToScreen(true);
    setIsWrapTextEnabled(true);
    setExportNotification('تم احتواء كافة الأعمدة والصفوف لمطابقة المحتوى مثل Excel');
    setTimeout(() => setExportNotification(null), 3000);
  };

  const [smartQuickFilter, setSmartQuickFilter] = useState<
    'all' | 'ready' | 'not_ready' | 'with_photos' | 'without_photos' | 'edited' | 'duplicate' | 'new_rows' | 'unmodified' | 'cross_table_match' | 'imported'
  >('all');
  const [isTableDataViewOpen, setIsTableDataViewOpen] = useState<boolean>(false);
  const [tableSearchText, setTableSearchText] = useState<string>('');

  const popoverRef = useRef<HTMLDivElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const moreToolsMenuRef = useRef<HTMLDivElement>(null);
  const tableDataViewRef = useRef<HTMLDivElement>(null);
  const cellDropdownMenuRef = useRef<HTMLDivElement>(null);
  const qualityNotesEditorRef = useRef<HTMLDivElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Active keyboard arrow navigation in all directions
  const handleTableKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const container = tableContainerRef.current;
    if (!container) return;

    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT')) {
      return;
    }

    const scrollStepX = 140;
    const scrollStepY = 70;

    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault();
        container.scrollBy({ left: scrollStepX, behavior: 'smooth' });
        break;
      case 'ArrowLeft':
        e.preventDefault();
        container.scrollBy({ left: -scrollStepX, behavior: 'smooth' });
        break;
      case 'ArrowUp':
        e.preventDefault();
        container.scrollBy({ top: -scrollStepY, behavior: 'smooth' });
        break;
      case 'ArrowDown':
        e.preventDefault();
        container.scrollBy({ top: scrollStepY, behavior: 'smooth' });
        break;
      case 'PageUp':
        e.preventDefault();
        container.scrollBy({ top: -container.clientHeight * 0.8, behavior: 'smooth' });
        break;
      case 'PageDown':
        e.preventDefault();
        container.scrollBy({ top: container.clientHeight * 0.8, behavior: 'smooth' });
        break;
      case 'Home':
        e.preventDefault();
        if (e.ctrlKey) {
          container.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          container.scrollTo({ left: 0, behavior: 'smooth' });
        }
        break;
      case 'End':
        e.preventDefault();
        if (e.ctrlKey) {
          container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
        } else {
          container.scrollTo({ left: container.scrollWidth, behavior: 'smooth' });
        }
        break;
      default:
        break;
    }
  };

  const handlePan = (direction: 'right' | 'left' | 'start' | 'end') => {
    const container = tableContainerRef.current;
    if (!container) return;

    const step = 380;

    if (direction === 'start') {
      // Beginning of table (أقصى اليمين - العمود الأول)
      container.scrollTo({ left: 100000, behavior: 'smooth' });
      setTimeout(() => {
        if (container.scrollLeft < 0) {
          container.scrollTo({ left: 0, behavior: 'smooth' });
        }
      }, 30);
    } else if (direction === 'end') {
      // End of table (أقصى اليسار - الأعمدة الأخيرة)
      container.scrollTo({ left: -100000, behavior: 'smooth' });
      setTimeout(() => {
        if (container.scrollLeft > 0) {
          container.scrollTo({ left: container.scrollWidth, behavior: 'smooth' });
        }
      }, 30);
    } else if (direction === 'right') {
      // Scroll rightwards (تحريك نحو اليمين - العودة للبداية)
      const initial = container.scrollLeft;
      container.scrollBy({ left: step, behavior: 'smooth' });
      setTimeout(() => {
        if (container.scrollLeft === initial) {
          container.scrollBy({ left: -step, behavior: 'smooth' });
        }
      }, 60);
    } else if (direction === 'left') {
      // Scroll leftwards (تحريك نحو اليسار - التقدم للأعمدة التالية)
      const initial = container.scrollLeft;
      container.scrollBy({ left: -step, behavior: 'smooth' });
      setTimeout(() => {
        if (container.scrollLeft === initial) {
          container.scrollBy({ left: step, behavior: 'smooth' });
        }
      }, 60);
    }
  };

  // Close popovers when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (popoverRef.current && !popoverRef.current.contains(target as Node)) {
        setOpenFilterCol(null);
        setFilterPopupPos(null);
      }
      if (exportMenuRef.current && !exportMenuRef.current.contains(target as Node)) {
        setIsExportMenuOpen(false);
      }
      if (moreToolsMenuRef.current && !moreToolsMenuRef.current.contains(target as Node)) {
        setIsMoreToolsMenuOpen(false);
      }
      if (tableDataViewRef.current && !tableDataViewRef.current.contains(target as Node)) {
        setIsTableDataViewOpen(false);
      }
      // Keep cell dropdown open if clicking inside dropdown or on trigger
      if (cellDropdownMenuRef.current && cellDropdownMenuRef.current.contains(target as Node)) {
        return;
      }
      if (target && target.closest && target.closest('[data-inline-dropdown-trigger="true"]')) {
        return;
      }
      setOpenInlineDropdown(null);

      if (qualityNotesEditorRef.current && !qualityNotesEditorRef.current.contains(target as Node)) {
        if (!target.closest || !target.closest('[data-quality-notes-trigger="true"]')) {
          setEditingQualityNotes(null);
        }
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenFilterCol(null);
        setFilterPopupPos(null);
        setOpenInlineDropdown(null);
        setEditingQualityNotes(null);
        setIsExportMenuOpen(false);
        setIsMoreToolsMenuOpen(false);
        setIsTableDataViewOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Dynamically keep floating cell popovers and column filter popover anchored over their triggers on scroll/resize
  useEffect(() => {
    if (!openInlineDropdown && !editingQualityNotes && !openFilterCol) return;

    const handlePositionUpdate = () => {
      if (openInlineDropdown) {
        const triggerEl = document.querySelector(`[data-cell-trigger="${openInlineDropdown.orderId}-${openInlineDropdown.field}"]`);
        if (triggerEl) {
          const rect = triggerEl.getBoundingClientRect();
          if (rect.bottom < -20 || rect.top > window.innerHeight + 20) {
            setOpenInlineDropdown(null);
          } else {
            const spaceBelow = window.innerHeight - rect.bottom;
            const openUpward = spaceBelow < 230 && rect.top > 230;
            setOpenInlineDropdown(prev => prev ? {
              ...prev,
              rect: {
                top: rect.top,
                bottom: rect.bottom,
                left: rect.left,
                right: rect.right,
                width: rect.width,
                height: rect.height
              },
              openUpward
            } : null);
          }
        }
      }

      if (editingQualityNotes) {
        const triggerEl = document.querySelector(`[data-quality-notes-cell-trigger="${editingQualityNotes.orderId}"]`);
        if (triggerEl) {
          const rect = triggerEl.getBoundingClientRect();
          if (rect.bottom < -20 || rect.top > window.innerHeight + 20) {
            setEditingQualityNotes(null);
          } else {
            const spaceBelow = window.innerHeight - rect.bottom;
            const openUpward = spaceBelow < 250 && rect.top > 250;
            setEditingQualityNotes(prev => prev ? {
              ...prev,
              rect: {
                top: rect.top,
                bottom: rect.bottom,
                left: rect.left,
                right: rect.right,
                width: rect.width,
                height: rect.height
              },
              openUpward
            } : null);
          }
        }
      }

      if (openFilterCol) {
        const triggerEl = document.querySelector(`[data-col-filter-trigger="${openFilterCol}"]`);
        if (triggerEl) {
          const rect = triggerEl.getBoundingClientRect();
          if (rect.bottom < -20 || rect.top > window.innerHeight + 20) {
            setOpenFilterCol(null);
            setFilterPopupPos(null);
          } else {
            const pos = calculateSmartPopoverPosition(rect, 400, {
              preferredWidth: 288,
              align: 'end'
            });
            setFilterPopupPos(pos);
          }
        }
      }
    };

    window.addEventListener('scroll', handlePositionUpdate, { passive: true });
    window.addEventListener('resize', handlePositionUpdate);
    const container = tableContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handlePositionUpdate, { passive: true });
    }
    return () => {
      window.removeEventListener('scroll', handlePositionUpdate);
      window.removeEventListener('resize', handlePositionUpdate);
      if (container) {
        container.removeEventListener('scroll', handlePositionUpdate);
      }
    };
  }, [openInlineDropdown?.orderId, openInlineDropdown?.field, editingQualityNotes?.orderId, openFilterCol]);

  // Compute distinct unique values lazily only when a column filter dropdown is open
  const distinctValuesByField = useMemo(() => {
    const map: Record<string, { value: string; count: number }[]> = {};
    if (!openFilterCol) return map;

    const targetCols = columns.filter(c => c.field === openFilterCol);
    targetCols.forEach(col => {
      const counts: Record<string, number> = {};
      for (let i = 0; i < orders.length; i++) {
        const order = orders[i];
        let val = '';
        if (col.field === 'photoCoordination' || col.field === 'photos') {
          val = order.photoCoordination || (order.photos && order.photos.length > 0 ? 'مرفق صورة كملاحظة' : 'لا توجد صور مطلوبة');
        } else if (col.field === 'procedure155') {
          val = getEffectiveProcedure155Status(order);
        } else if (col.field === 'attachmentStatus') {
          const evalKeys = getEvaluatedSupportChecklistKeys(order);
          val = evalKeys.length > 0
            ? String(order.attachmentStatus || '')
            : (order.attachmentStatus && order.attachmentStatus !== 'غير جاهز للارفاق' ? String(order.attachmentStatus) : '');
        } else if (col.field === 'pdcAudit' || col.field === 'constructionAudit') {
          const evalKeys = getEvaluatedColumnSupportChecklistKeys(order, col.field as 'pdcAudit' | 'constructionAudit');
          const rawCol = order[col.field] as WorkOrderAuditColumnData | undefined;
          if (evalKeys.length > 0) {
            const st = calculateSupportChecklistStats(extractColumnSupportChecklistMap(order, col.field as 'pdcAudit' | 'constructionAudit'), evalKeys);
            val = st.isAllApplicableCompleted ? 'مؤهل' : 'غير مؤهل';
          } else if (rawCol?.mainStatus === 'مؤهل' || rawCol?.mainStatus === 'غير مؤهل') {
            val = rawCol.mainStatus;
          } else {
            val = '';
          }
        } else if (col.field === 'procedure155Status') {
          const evalKeys = getEvaluatedSupportChecklistKeys(order);
          if (evalKeys.length > 0) {
            const st = calculateSupportChecklistStats(extractOrderSupportChecklistMap(order), evalKeys);
            val = st.isAllApplicableCompleted && !String(order.procedure155Status || '').includes('غير مؤهل') ? 'مؤهل' : 'غير مؤهل';
          } else {
            const rawS = String(order.procedure155Status || '').trim();
            val = rawS && rawS !== 'قيد التدقيق' && rawS !== 'قيد التدقيق الفني' ? rawS : '';
          }
        } else {
          val = String(order[col.field] ?? '');
        }
        if (!val || val === '-' || val === 'لا توجد ملاحظات' || val === 'لا توجد ملاحظات حالياً') {
          val = '(فارغ)';
        }
        counts[val] = (counts[val] || 0) + 1;
      }

      map[col.field] = Object.entries(counts).map(([value, count]) => ({
        value,
        count
      })).sort((a, b) => b.count - a.count);
    });

    return map;
  }, [orders, columns, openFilterCol]);

  // Fast O(N) duplicate detection matching canonical (workOrderNumber && workOrderCode) identity
  const duplicateOrderIds = useMemo(() => {
    const pool = allOrders && allOrders.length > 0 ? allOrders : orders;
    return findDuplicateOrderIdsFast(orders, pool);
  }, [orders, allOrders]);

  // Total count of rows that have duplicate pair in the dataset
  const totalDuplicateRowsCount = duplicateOrderIds.size;

  // Filter orders according to active column filters + optional duplicate-only toggle + smart quick filter + table search
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      // 1. Duplicate check
      if (filterOnlyDuplicates || smartQuickFilter === 'duplicate') {
        if (!duplicateOrderIds.has(order.id)) return false;
      }

      // 2. Smart Quick Filter Chips & Table Data View Filters
      if (smartQuickFilter === 'new_rows') {
        if (!order.isNew || order.isEdited) return false;
      } else if (smartQuickFilter === 'unmodified') {
        if (order.isEdited) return false;
      } else if (smartQuickFilter === 'edited') {
        if (!order.isEdited) return false;
      } else if (smartQuickFilter === 'ready') {
        const evalKeys = getEvaluatedSupportChecklistKeys(order);
        const s = String(order.procedure155Status || '').trim();
        const eff155 = getEffectiveProcedure155Status(order);
        const isReady =
          isOrderQualified100InAllThreeAudits(order) ||
          (!eff155.includes('غير') && (eff155.includes('مؤهل') || eff155.includes('تم'))) ||
          (evalKeys.length > 0 && !s.includes('غير') && (s.includes('مؤهل') || s.includes('معتمد')));
        if (!isReady) return false;
      } else if (smartQuickFilter === 'not_ready') {
        const evalKeys = getEvaluatedSupportChecklistKeys(order);
        const pdcEval = getEvaluatedColumnSupportChecklistKeys(order, 'pdcAudit');
        const constEval = getEvaluatedColumnSupportChecklistKeys(order, 'constructionAudit');
        const s = String(order.procedure155Status || '').trim();
        const eff155 = getEffectiveProcedure155Status(order);
        const hasAnyEvaluated = evalKeys.length > 0 || pdcEval.length > 0 || constEval.length > 0 || Boolean(s && s !== 'قيد التدقيق') || Boolean(eff155);
        if (!hasAnyEvaluated) return false;
        const isReady =
          isOrderQualified100InAllThreeAudits(order) ||
          (!eff155.includes('غير') && (eff155.includes('مؤهل') || eff155.includes('تم'))) ||
          (evalKeys.length > 0 && !s.includes('غير') && (s.includes('مؤهل') || s.includes('معتمد')));
        if (isReady) return false;
      } else if (smartQuickFilter === 'with_photos') {
        const hasPhotos = (order.photos && order.photos.length > 0) || String(order.photoDocumentation).includes('مكتمل') || String(order.photoCoordination).includes('مرفق');
        if (!hasPhotos) return false;
      } else if (smartQuickFilter === 'without_photos') {
        const hasPhotos = (order.photos && order.photos.length > 0) || String(order.photoDocumentation).includes('مكتمل') || String(order.photoCoordination).includes('مرفق');
        if (hasPhotos) return false;
      } else if (smartQuickFilter === 'cross_table_match') {
        if (!crossTableMatchesMap.has(order.id)) return false;
      } else if (smartQuickFilter === 'imported') {
        if (!order.isImported) return false;
      }

      // 3. Instant Quick Table Search Query (Search across all visible fields including consultant)
      if (tableSearchText.trim()) {
        const query = tableSearchText.trim().toLowerCase();
        const num = (order.workOrderNumber || '').toLowerCase();
        const code = (order.workOrderCode || '').toLowerCase();
        const off = (order.office || '').toLowerCase();
        const cont = (order.contractor || '').toLowerCase();
        const cons = (order.consultant || '').toLowerCase();
        const notes = (order.qualityNotes || order.executionNotes || '').toLowerCase();
        const pStat = (order.procedure155Status || '').toLowerCase();
        const attStat = (order.attachmentStatus || '').toLowerCase();

        const match = num.includes(query) ||
          code.includes(query) ||
          off.includes(query) ||
          cont.includes(query) ||
          cons.includes(query) ||
          notes.includes(query) ||
          pStat.includes(query) ||
          attStat.includes(query);

        if (!match) return false;
      }

      // 4. Column Specific Dropdown Filters
      for (const [field, selectedValues] of Object.entries(columnFilters) as [string, string[]][]) {
        if (!selectedValues || selectedValues.length === 0) continue;
        
        let cellVal = '';
        if (field === 'photoCoordination' || field === 'photos') {
          cellVal = order.photoCoordination || (order.photos && order.photos.length > 0 ? 'مرفق صورة كملاحظة' : 'لا توجد صور مطلوبة');
        } else if (field === 'procedure155') {
          cellVal = getEffectiveProcedure155Status(order);
        } else if (field === 'attachmentStatus') {
          const evalKeys = getEvaluatedSupportChecklistKeys(order);
          cellVal = evalKeys.length > 0
            ? String(order.attachmentStatus || '')
            : (order.attachmentStatus && order.attachmentStatus !== 'غير جاهز للارفاق' ? String(order.attachmentStatus) : '');
        } else if (field === 'pdcAudit' || field === 'constructionAudit') {
          const evalKeys = getEvaluatedColumnSupportChecklistKeys(order, field as 'pdcAudit' | 'constructionAudit');
          const rawCol = order[field] as WorkOrderAuditColumnData | undefined;
          if (evalKeys.length > 0) {
            const st = calculateSupportChecklistStats(extractColumnSupportChecklistMap(order, field as 'pdcAudit' | 'constructionAudit'), evalKeys);
            cellVal = st.isAllApplicableCompleted ? 'مؤهل' : 'غير مؤهل';
          } else if (rawCol?.mainStatus === 'مؤهل' || rawCol?.mainStatus === 'غير مؤهل') {
            cellVal = rawCol.mainStatus;
          } else {
            cellVal = '';
          }
        } else if (field === 'procedure155Status') {
          const evalKeys = getEvaluatedSupportChecklistKeys(order);
          if (evalKeys.length > 0) {
            const st = calculateSupportChecklistStats(extractOrderSupportChecklistMap(order), evalKeys);
            cellVal = st.isAllApplicableCompleted && !String(order.procedure155Status || '').includes('غير مؤهل') ? 'مؤهل' : 'غير مؤهل';
          } else {
            const rawS = String(order.procedure155Status || '').trim();
            cellVal = rawS && rawS !== 'قيد التدقيق' && rawS !== 'قيد التدقيق الفني' ? rawS : '';
          }
        } else {
          cellVal = String(order[field] ?? '');
        }
        if (!cellVal || cellVal === '-' || cellVal === 'لا توجد ملاحظات' || cellVal === 'لا توجد ملاحظات حالياً') {
          cellVal = '(فارغ)';
        }

        if (!selectedValues.includes(cellVal)) {
          return false;
        }
      }
      return true;
    });
  }, [orders, columnFilters, filterOnlyDuplicates, duplicateOrderIds, smartQuickFilter, tableSearchText, crossTableMatchesMap]);

  // Single-pass O(N) aggregate stats for quick filters and summary bar
  const {
    readyOrdersCount,
    notReadyOrdersCount,
    withPhotosCount,
    withoutPhotosCount,
    editedOrdersCount,
    newRowsCount,
    nonEditedRowsCount,
    duplicateRowsCount,
    importedRowsCount
  } = useMemo(() => {
    let ready = 0;
    let notReady = 0;
    let withPhotos = 0;
    let edited = 0;
    let newRows = 0;
    let nonEdited = 0;
    let duplicates = 0;
    let imported = 0;

    for (let i = 0; i < orders.length; i++) {
      const w = orders[i];
      const evalKeys = getEvaluatedSupportChecklistKeys(w);
      const pdcEval = getEvaluatedColumnSupportChecklistKeys(w, 'pdcAudit');
      const constEval = getEvaluatedColumnSupportChecklistKeys(w, 'constructionAudit');
      const s = String(w.procedure155Status || '').trim();
      const eff155 = getEffectiveProcedure155Status(w);
      const hasAnyEvaluated =
        evalKeys.length > 0 ||
        pdcEval.length > 0 ||
        constEval.length > 0 ||
        Boolean(s && s !== 'قيد التدقيق' && s !== 'قيد التدقيق الفني') ||
        Boolean(eff155);

      const isReady =
        isOrderQualified100InAllThreeAudits(w) ||
        (!eff155.includes('غير') && (eff155.includes('مؤهل') || eff155.includes('تم'))) ||
        (evalKeys.length > 0 && !s.includes('غير') && (s.includes('مؤهل') || s.includes('معتمد')));

      if (isReady) {
        ready++;
      } else if (hasAnyEvaluated) {
        notReady++;
      }
      if ((w.photos && w.photos.length > 0) || String(w.photoDocumentation).includes('مكتمل') || String(w.photoCoordination).includes('مرفق')) {
        withPhotos++;
      }
      if (w.isEdited) {
        edited++;
      } else {
        nonEdited++;
        if (w.isNew) newRows++;
      }
      if (duplicateOrderIds.has(w.id)) {
        duplicates++;
      }
      if (w.isImported) {
        imported++;
      }
    }

    return {
      readyOrdersCount: ready,
      notReadyOrdersCount: notReady,
      withPhotosCount: withPhotos,
      withoutPhotosCount: Math.max(0, orders.length - withPhotos),
      editedOrdersCount: edited,
      newRowsCount: newRows,
      nonEditedRowsCount: nonEdited,
      duplicateRowsCount: duplicates,
      importedRowsCount: imported
    };
  }, [orders, duplicateOrderIds]);

  const isTableDataFilterActive = ['new_rows', 'duplicate', 'unmodified', 'edited', 'cross_table_match', 'imported'].includes(smartQuickFilter);

  const activeTableDataFilterLabel = useMemo(() => {
    switch (smartQuickFilter) {
      case 'new_rows': return 'الأسطر المضافة جديدة للجدول';
      case 'duplicate': return 'الأسطر المكررة';
      case 'unmodified': return 'الأسطر الغير معدل عليها';
      case 'edited': return 'الأسطر المعدل عليها';
      case 'cross_table_match': return 'الأسطر المتوافقة مع جداول أخرى (تطابق رقم ورمز أمر العمل)';
      case 'imported': return 'الأسطر المستوردة المتوافقة (بدلالة الأعمدة)';
      default: return '';
    }
  }, [smartQuickFilter]);

  const overallReadyRate = orders.length > 0 ? Math.round((readyOrdersCount / orders.length) * 100) : 0;

  // Bulk action: approve selected orders as 155 ready (or all ready orders in current view if none selected)
  const handleBulkApprove155 = async () => {
    const now = new Date();
    const formatTimestamp = (d: Date = new Date()) => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      let hours = d.getHours();
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const seconds = String(d.getSeconds()).padStart(2, '0');
      const ampm = hours >= 12 ? 'م' : 'ص';
      hours = hours % 12 || 12;
      return `${yyyy}/${mm}/${dd} ${String(hours).padStart(2, '0')}:${minutes}:${seconds} ${ampm}`;
    };
    const formattedSyncTime = formatTimestamp(now);
    const effectiveUser = currentUser || getSavedCurrentUser();
    const activeUserEmail = (effectiveUser?.email || effectiveUser?.username || '').trim();
    const activeUserName = (effectiveUser?.displayName || effectiveUser?.username || 'مستخدم معتمد').trim();

    let targets: WorkOrder[] = [];
    if (selectedOrderIds.size > 0) {
      targets = orders.filter(o => selectedOrderIds.has(o.id));
    } else {
      targets = orders.filter(o => {
        const s = String(o.procedure155Status || '');
        return isOrderQualified100InAllThreeAudits(o) || (s.includes('مؤهل') && !s.includes('غير'));
      });
    }

    if (targets.length === 0) {
      setExportNotification('يرجى تحديد أوامر العمل المراد اعتمادها أولاً');
      setTimeout(() => setExportNotification(null), 3000);
      return;
    }

    for (const target of targets) {
      if (onUpdateOrder) {
        onUpdateOrder({
          ...target,
          procedure155Status: 'مؤهل للاغلاق ( معتمد )',
          procedure155: 'مؤهل لإجراء 155',
          statusSyncTime: formattedSyncTime,
          statusSyncEmail: activeUserEmail,
          statusSyncUser: activeUserName,
          procedureSyncTime: formattedSyncTime,
          procedureSyncEmail: activeUserEmail,
          procedureSyncUser: activeUserName,
          _skipSensitiveConfirm: true,
          _userTouchedFields: [
            'procedure155Status',
            'procedure155',
            'statusSyncTime',
            'statusSyncEmail',
            'statusSyncUser',
            'procedureSyncTime',
            'procedureSyncEmail',
            'procedureSyncUser'
          ]
        } as any);
      }
    }
    setExportNotification(`تم اعتماد (${targets.length}) أمر عمل كـ (مؤهل للاغلاق - معتمد) بنجاح تام`);
    setTimeout(() => setExportNotification(null), 3500);
  };

  // Handle Column Sorting (Click header toggles: asc -> desc -> none)
  const handleSort = (field?: string) => {
    if (!field) return;
    setSortConfig(prev => {
      if (!prev || prev.field !== field) {
        return { field, direction: 'asc' };
      }
      if (prev.direction === 'asc') {
        return { field, direction: 'desc' };
      }
      return null;
    });
  };

  // Sorted orders according to sortConfig
  const sortedOrders = useMemo(() => {
    if (!sortConfig) return filteredOrders;
    const { field, direction } = sortConfig;
    return [...filteredOrders].sort((a, b) => {
      const valA = String(a[field] ?? '');
      const valB = String(b[field] ?? '');
      const cmp = valA.localeCompare(valB, 'ar', { numeric: true, sensitivity: 'base' });
      return direction === 'asc' ? cmp : -cmp;
    });
  }, [filteredOrders, sortConfig]);

  // Synchronize filtered orders back to parent so all modals and sidebars receive the filtered slice
  useEffect(() => {
    if (onFilteredOrdersChange) {
      onFilteredOrdersChange(sortedOrders);
    }
  }, [sortedOrders, onFilteredOrdersChange]);

  // Orders strictly resolved for Export: supports filtered, all, or selected rows
  const ordersToExport = useMemo(() => {
    if (exportScope === 'selected' && selectedOrderIds.size > 0) {
      return orders.filter(o => selectedOrderIds.has(o.id));
    }
    return exportScope === 'filtered' ? sortedOrders : orders;
  }, [exportScope, sortedOrders, orders, selectedOrderIds]);

  const exportTitleText = useMemo(() => {
    if (exportScope === 'selected') {
      return `${officeTitle} - الأوامر المحددة (${selectedOrderIds.size})`;
    }
    if (exportScope === 'filtered' && filteredOrders.length !== orders.length) {
      return `${officeTitle} - أوامر العمل المفلترة (${filteredOrders.length})`;
    }
    return officeTitle;
  }, [exportScope, selectedOrderIds.size, filteredOrders.length, orders.length, officeTitle]);

  // Handle direct inline cell update with instant realtime synchronization
  const handleDirectCellUpdate = async (order: WorkOrder, field: string, newValue: any) => {
    if (!isColumnUniversallyEditable(field)) {
      if (!canUserEditColumn(currentUser, field)) {
        if (onCheckPermission) {
          const permKey = field === 'procedure155' ? 'editProcedure155' : 'inlineTableEdit';
          const colLabel = field === 'procedure155' ? 'حالة اجراء 155' : field;
          onCheckPermission(permKey, `تعديل عمود (${colLabel}) - هذا العمود غير متاح لأي مستخدم إلا بإعطاء صلاحية له`);
        }
        return;
      }
    }

    const now = new Date();
    const formatTimestamp = (d: Date = new Date()) => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      let hours = d.getHours();
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const seconds = String(d.getSeconds()).padStart(2, '0');
      const ampm = hours >= 12 ? 'م' : 'ص';
      hours = hours % 12 || 12;
      return `${yyyy}/${mm}/${dd} ${String(hours).padStart(2, '0')}:${minutes}:${seconds} ${ampm}`;
    };

    const riyadhParts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Riyadh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }).formatToParts(now);
    const rMap: Record<string, string> = {};
    for (const p of riyadhParts) {
      if (p.type !== 'literal') rMap[p.type] = p.value;
    }
    const riyadhDateStr = `${rMap.year || now.getFullYear()}-${rMap.month || '01'}-${rMap.day || '01'}`;
    const rawPeriod = (rMap.dayPeriod || '').toLowerCase();
    const ampmAr = rawPeriod.includes('p') || rawPeriod.includes('م') ? 'م' : 'ص';
    const riyadhTimeStr = `${rMap.hour || '12'}:${rMap.minute || '00'}:${rMap.second || '00'} ${ampmAr}`;
    const formattedSyncTime = `${riyadhDateStr} ${riyadhTimeStr}`;

    const effectiveUser = currentUser || getSavedCurrentUser();
    const activeUserEmail = (effectiveUser?.email || effectiveUser?.username || '').trim();
    const activeUserName = (effectiveUser?.displayName || effectiveUser?.username || 'مستخدم معتمد').trim();

    const updated: WorkOrder = {
      ...order,
      [field]: newValue,
      customFields: {
        ...(order.customFields || {}),
        [field]: newValue
      },
      updatedAt: now.toISOString(),
      lastUpdatedBy: activeUserEmail || activeUserName,
      isEdited: field === 'isNew' ? order.isEdited : true,
      isNew: field === 'isNew' ? Boolean(newValue) : false,
      lastEditedAt: now.toISOString()
    };

    // Auto-elementize and sync note items when qualityNotes is updated directly
    if (field === 'qualityNotes') {
      const textVal = String(newValue || '').trim();
      updated.qualityNotes = textVal;
      updated.executionNotes = textVal;

      const lines = textVal.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      if (lines.length > 1) {
        const existingItems = Array.isArray(order.qualityNoteItems) ? order.qualityNoteItems : [];
        updated.qualityNoteItems = lines.map((line, idx) => {
          const cleanText = line.replace(/^\d+[\.\-\)]\s*/, '').replace(/^[\-\•\*]\s*/, '').trim();
          return {
            id: existingItems[idx]?.id || `note-${Date.now()}-${idx + 1}`,
            text: cleanText || line,
            photos: existingItems[idx]?.photos || (idx === 0 && order.photos ? order.photos.map(p => p.url).filter(Boolean) : [])
          };
        });
      } else if (lines.length === 1) {
        const existingPhotos = order.qualityNoteItems?.[0]?.photos || (order.photos ? order.photos.map(p => p.url).filter(Boolean) : []);
        updated.qualityNoteItems = [{
          id: order.qualityNoteItems?.[0]?.id || `note-${Date.now()}-1`,
          text: lines[0],
          photos: existingPhotos
        }];
      } else {
        updated.qualityNoteItems = [];
      }
    }

    // Strict, independent audit synchronization ONLY for the 3 audit columns:
    // 1. تدقيق PDC (pdcAudit)
    // 2. تدقيق الإنشاءات (constructionAudit)
    // 3. تدقيق المساندة الفنية (procedure155Status)
    const touchedFields: string[] = [field, 'customFields'];
    if (field === 'qualityNotes') {
      touchedFields.push('executionNotes', 'qualityNoteItems');
    }

    if (field === 'pdcAudit' && newValue && typeof newValue === 'object') {
      const existingPdc =
        order.pdcAudit && typeof order.pdcAudit === 'object' ? order.pdcAudit : {};
      const isResetPdc =
        Array.isArray(newValue.evaluatedKeys) &&
        newValue.evaluatedKeys.length === 0 &&
        (!newValue.mainStatus || newValue.mainStatus === 'غير محدد');
      updated.pdcAudit = {
        ...existingPdc,
        ...newValue,
        lastUpdatedAt: isResetPdc ? '' : formattedSyncTime,
        lastUpdatedBy: isResetPdc ? '' : activeUserName,
        auditorUserId: isResetPdc ? '' : effectiveUser?.id || 'user',
        auditorName: isResetPdc ? '' : activeUserName,
        auditorEmail: isResetPdc ? '' : activeUserEmail,
        auditDateRiyadh: isResetPdc ? '' : riyadhDateStr,
        auditTimeRiyadh: isResetPdc ? '' : riyadhTimeStr,
        syncStatus: isResetPdc ? 'بانتظار التدقيق' : 'محفوظ ومزامن'
      };
      updated.statusSyncTime = formattedSyncTime;
      updated.statusSyncDateRiyadh = riyadhDateStr;
      updated.statusSyncTimeRiyadh = riyadhTimeStr;
      updated.statusSyncEmail = activeUserEmail;
      updated.statusSyncUser = activeUserName;
      updated.auditSyncStatus = 'محفوظ ومزامن';
      touchedFields.push(
        'pdcAudit',
        'statusSyncTime',
        'statusSyncDateRiyadh',
        'statusSyncTimeRiyadh',
        'statusSyncEmail',
        'statusSyncUser',
        'auditSyncStatus'
      );
    } else if (field === 'constructionAudit' && newValue && typeof newValue === 'object') {
      const existingConst =
        order.constructionAudit && typeof order.constructionAudit === 'object'
          ? order.constructionAudit
          : {};
      const isResetConst =
        Array.isArray(newValue.evaluatedKeys) &&
        newValue.evaluatedKeys.length === 0 &&
        (!newValue.mainStatus || newValue.mainStatus === 'غير محدد');
      updated.constructionAudit = {
        ...existingConst,
        ...newValue,
        lastUpdatedAt: isResetConst ? '' : formattedSyncTime,
        lastUpdatedBy: isResetConst ? '' : activeUserName,
        auditorUserId: isResetConst ? '' : effectiveUser?.id || 'user',
        auditorName: isResetConst ? '' : activeUserName,
        auditorEmail: isResetConst ? '' : activeUserEmail,
        auditDateRiyadh: isResetConst ? '' : riyadhDateStr,
        auditTimeRiyadh: isResetConst ? '' : riyadhTimeStr,
        syncStatus: isResetConst ? 'بانتظار التدقيق' : 'محفوظ ومزامن'
      };
      updated.statusSyncTime = formattedSyncTime;
      updated.statusSyncDateRiyadh = riyadhDateStr;
      updated.statusSyncTimeRiyadh = riyadhTimeStr;
      updated.statusSyncEmail = activeUserEmail;
      updated.statusSyncUser = activeUserName;
      updated.auditSyncStatus = 'محفوظ ومزامن';
      touchedFields.push(
        'constructionAudit',
        'statusSyncTime',
        'statusSyncDateRiyadh',
        'statusSyncTimeRiyadh',
        'statusSyncEmail',
        'statusSyncUser',
        'auditSyncStatus'
      );
    } else if (field === 'procedure155Status') {
      const isQual = String(newValue).includes('مؤهل') && !String(newValue).includes('غير');
      updated.completionPercentage = isQual ? 100 : 75;
      updated.technicalSupportAudit = {
        ...(order.technicalSupportAudit || {}),
        status: String(newValue || ''),
        auditorUserId: effectiveUser?.id || 'user',
        auditorName: activeUserName,
        auditorEmail: activeUserEmail,
        auditDateRiyadh: riyadhDateStr,
        auditTimeRiyadh: riyadhTimeStr,
        lastUpdatedAt: formattedSyncTime,
        syncStatus: 'محفوظ ومزامن'
      };
      updated.statusSyncTime = formattedSyncTime;
      updated.statusSyncDateRiyadh = riyadhDateStr;
      updated.statusSyncTimeRiyadh = riyadhTimeStr;
      updated.statusSyncEmail = activeUserEmail;
      updated.statusSyncUser = activeUserName;
      updated.auditSyncStatus = 'محفوظ ومزامن';
      touchedFields.push(
        'procedure155Status',
        'completionPercentage',
        'technicalSupportAudit',
        'statusSyncTime',
        'statusSyncDateRiyadh',
        'statusSyncTimeRiyadh',
        'statusSyncEmail',
        'statusSyncUser',
        'auditSyncStatus'
      );
    }

    // When any of the 3 audit columns changes, auto-sync procedure155 if not manually overridden
    if (field === 'pdcAudit' || field === 'constructionAudit' || field === 'procedure155Status') {
      const hasManual155 = Boolean(
        updated.procedureSyncTime || updated.procedureSyncEmail || updated.procedureSyncUser
      );
      if (!hasManual155) {
        updated.procedure155 = isOrderQualified100InAllThreeAudits(updated) ? 'مؤهل لإجراء 155' : '';
        touchedFields.push('procedure155');
      }
    }

    // When procedure155 (حالة اجراء 155) is updated by any user, procedureSyncTime & procedureSyncEmail are stamped
    if (field === 'procedure155') {
      const cleanVal = newValue === '— تفريغ الخلية —' ? '' : String(newValue || '').trim();
      updated.procedure155 = cleanVal;
      if (cleanVal) {
        updated.procedureSyncTime = formattedSyncTime;
        updated.procedureSyncEmail = activeUserEmail;
        updated.procedureSyncUser = activeUserName;
      } else {
        updated.procedureSyncTime = formattedSyncTime;
        updated.procedureSyncEmail = activeUserEmail;
        updated.procedureSyncUser = 'MANUAL_EMPTY';
      }
      touchedFields.push('procedure155', 'procedureSyncTime', 'procedureSyncEmail', 'procedureSyncUser');
    }

    (updated as any)._userTouchedFields = Array.from(new Set(touchedFields));
    (updated as any)._skipSensitiveConfirm = true;
    if (field === 'pdcAudit' || field === 'constructionAudit') {
      (updated as any)._silentToast = true;
      setActiveAuditModal(prev =>
        prev && prev.order.id === updated.id ? { ...prev, order: updated } : prev
      );
    }

    setOpenInlineDropdown(null);
    setEditingQualityNotes(null);

    if (onUpdateOrder) {
      await onUpdateOrder(updated);
    } else {
      await realtime.updateWorkOrder(updated, (updated as any)._userTouchedFields);
    }
  };

  // Save Technical Support Audit Checklist (9 items + main procedure155Status) with instant synchronization
  const handleSaveTechnicalSupportAudit = async (
    order: WorkOrder,
    payload: TechnicalSupportAuditPayload,
    shouldClose = false
  ) => {
    if (!canUserEditColumn(currentUser, 'procedure155Status')) {
      if (onCheckPermission) {
        onCheckPermission('inlineTableEdit', 'تعديل بطاقة تدقيق المساندة الفنية - الحساب غير مصرح له بتعديل هذا العمود');
      }
      return;
    }

    const now = new Date();
    const riyadhParts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Riyadh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }).formatToParts(now);
    const rMap: Record<string, string> = {};
    for (const p of riyadhParts) {
      if (p.type !== 'literal') rMap[p.type] = p.value;
    }
    const riyadhDateStr = `${rMap.year || now.getFullYear()}-${rMap.month || '01'}-${rMap.day || '01'}`;
    const rawPeriod = (rMap.dayPeriod || '').toLowerCase();
    const ampmAr = rawPeriod.includes('p') || rawPeriod.includes('م') ? 'م' : 'ص';
    const riyadhTimeStr = `${rMap.hour || '12'}:${rMap.minute || '00'}:${rMap.second || '00'} ${ampmAr}`;
    const formattedSyncTime = `${riyadhDateStr} ${riyadhTimeStr}`;

    const effectiveUser = currentUser || getSavedCurrentUser();
    const activeUserEmail = (effectiveUser?.email || effectiveUser?.username || '').trim();
    const activeUserName = (effectiveUser?.displayName || effectiveUser?.username || 'مستخدم معتمد').trim();

    const isQual = String(payload.procedure155Status).includes('مؤهل') && !String(payload.procedure155Status).includes('غير');

    const touchedSupportFields = [
      'meterPhotoDocumentation',
      'excavationPhotoDocumentation',
      'equipmentPhotoDocumentation',
      'overheadPhotoDocumentation',
      'photoDocumentation',
      'consultantForms',
      'consultantClearanceForms',
      'form190',
      'form200',
      'inspectionForm',
      'attachmentStatus',
      'procedure155Status',
      'completionPercentage',
      'technicalSupportAudit',
      'statusSyncTime',
      'statusSyncDateRiyadh',
      'statusSyncTimeRiyadh',
      'statusSyncEmail',
      'statusSyncUser',
      'auditSyncStatus'
    ];

    const updated: WorkOrder = {
      ...order,
      meterPhotoDocumentation: payload.meterPhotoDocumentation,
      excavationPhotoDocumentation: payload.excavationPhotoDocumentation,
      equipmentPhotoDocumentation: payload.equipmentPhotoDocumentation,
      overheadPhotoDocumentation: payload.overheadPhotoDocumentation,
      photoDocumentation: payload.photoDocumentation,
      consultantForms: payload.consultantForms,
      consultantClearanceForms: payload.consultantClearanceForms,
      form190: payload.form190,
      form200: payload.form200,
      inspectionForm: payload.inspectionForm,
      attachmentStatus: payload.attachmentStatus,
      procedure155Status: payload.procedure155Status as Procedure155Status,
      completionPercentage: isQual ? 100 : 75,
      technicalSupportAudit: {
        ...(order.technicalSupportAudit || {}),
        status: payload.procedure155Status,
        auditorUserId:
          Array.isArray(payload.evaluatedKeys) && payload.evaluatedKeys.length === 0
            ? ''
            : effectiveUser?.id || 'user',
        auditorName:
          Array.isArray(payload.evaluatedKeys) && payload.evaluatedKeys.length === 0
            ? ''
            : activeUserName,
        auditorEmail:
          Array.isArray(payload.evaluatedKeys) && payload.evaluatedKeys.length === 0
            ? ''
            : activeUserEmail,
        auditDateRiyadh:
          Array.isArray(payload.evaluatedKeys) && payload.evaluatedKeys.length === 0
            ? ''
            : riyadhDateStr,
        auditTimeRiyadh:
          Array.isArray(payload.evaluatedKeys) && payload.evaluatedKeys.length === 0
            ? ''
            : riyadhTimeStr,
        lastUpdatedAt:
          Array.isArray(payload.evaluatedKeys) && payload.evaluatedKeys.length === 0
            ? ''
            : formattedSyncTime,
        syncStatus:
          Array.isArray(payload.evaluatedKeys) && payload.evaluatedKeys.length === 0
            ? 'بانتظار التدقيق'
            : 'محفوظ ومزامن',
        evaluatedKeys: payload.evaluatedKeys || [],
        supportChecklist: payload.supportChecklist || (order.technicalSupportAudit as any)?.supportChecklist || {},
        itemUpdatedAt: payload.itemUpdatedAt || (order.technicalSupportAudit as any)?.itemUpdatedAt || {}
      } as any,
      statusSyncTime: formattedSyncTime,
      statusSyncDateRiyadh: riyadhDateStr,
      statusSyncTimeRiyadh: riyadhTimeStr,
      statusSyncEmail: activeUserEmail,
      statusSyncUser: activeUserName,
      auditSyncStatus: 'محفوظ ومزامن',
      updatedAt: now.toISOString(),
      lastUpdatedBy: activeUserEmail || activeUserName,
      isEdited: true,
      isNew: false,
      lastEditedAt: now.toISOString()
    };

    const hasManual155 = Boolean(
      updated.procedureSyncTime || updated.procedureSyncEmail || updated.procedureSyncUser
    );
    if (!hasManual155) {
      updated.procedure155 = isOrderQualified100InAllThreeAudits(updated) ? 'مؤهل لإجراء 155' : '';
      if (!touchedSupportFields.includes('procedure155')) {
        touchedSupportFields.push('procedure155');
      }
    }

    (updated as any)._userTouchedFields = touchedSupportFields;
    (updated as any)._skipSensitiveConfirm = true;
    (updated as any)._silentToast = !shouldClose;

    setActiveSupportAuditModal(prev => (shouldClose ? null : prev ? { ...prev, order: updated } : null));

    if (onUpdateOrder) {
      await onUpdateOrder(updated);
    } else {
      await realtime.updateWorkOrder(updated, touchedSupportFields);
    }

    if (shouldClose) {
      setExportNotification('تم حفظ واعتماد بطاقة نتائج تدقيق المساندة الفنية بنجاح');
      setTimeout(() => setExportNotification(null), 3000);
      try {
        soundService.playActionSound('update');
      } catch (_) {}
    }
  };

  // Handle Copy to clipboard (Allow copying only, read-only data)
  const handleCopy = (text: string, cellKey: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!text) return;
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
    
    setCopiedCellKey(cellKey);
    setTimeout(() => {
      setCopiedCellKey(null);
    }, 2000);
  };

  const fallbackCopy = (text: string) => {
    const el = document.createElement('textarea');
    el.value = text;
    el.style.position = 'fixed';
    el.style.left = '-9999px';
    document.body.appendChild(el);
    el.select();
    try {
      document.execCommand('copy');
    } catch (err) {
      console.warn('Copy failed:', err);
    }
    document.body.removeChild(el);
  };

  // Filter helpers
  const handleToggleValueFilter = (field: string, value: string) => {
    setColumnFilters(prev => {
      const current = prev[field] || [];
      const exists = current.includes(value);
      const updated = exists ? current.filter(v => v !== value) : [...current, value];
      
      if (updated.length === 0) {
        const next = { ...prev };
        delete next[field];
        return next;
      }
      return { ...prev, [field]: updated };
    });
  };

  const handleClearColumnFilter = (field: string) => {
    setColumnFilters(prev => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleClearAllFilters = () => {
    setColumnFilters({});
  };

  const activeFiltersCount = Object.keys(columnFilters).length;

  // Selected order object: strictly prioritizes the row with the checkmark (selectedOrderIds),
  // then explicitly clicked row, then first visible row.
  const selectedOrder = useMemo(() => {
    // 1. Highest priority: The checked row (الذي تم وضع علامة صح أمامه)
    if (selectedOrderIds.size > 0) {
      if (selectedOrderId && selectedOrderIds.has(selectedOrderId)) {
        const found = orders.find(o => o.id === selectedOrderId);
        if (found) return found;
      }
      const checkedArr = Array.from(selectedOrderIds);
      const lastCheckedId = checkedArr[checkedArr.length - 1];
      const foundLast = orders.find(o => o.id === lastCheckedId);
      if (foundLast) return foundLast;
    }
    // 2. Second priority: explicitly clicked row
    if (selectedOrderId) {
      const found = orders.find(o => o.id === selectedOrderId);
      if (found) return found;
    }
    // 3. Fallback: first visible row
    return filteredOrders.length > 0 ? filteredOrders[0] : null;
  }, [orders, selectedOrderId, selectedOrderIds, filteredOrders]);

  // Navigate directly to the selected row, scroll it into view, highlight it, and open edit modal
  const handleNavigateAndEditOrder = (targetOrder?: WorkOrder | null) => {
    if (onCheckPermission && !onCheckPermission('editWorkOrderStatus', 'تحديث حالة أمر العمل وفحص الجودة')) {
      return;
    }

    const orderToEdit = targetOrder || selectedOrder || (filteredOrders.length > 0 ? filteredOrders[0] : null);
    if (!orderToEdit) {
      onOpenAddModal();
      return;
    }

    // Explicitly place checkmark in front of this row and focus it
    setSelectedOrderIds(new Set([orderToEdit.id]));
    setSelectedOrderId(orderToEdit.id);

    // Scroll smoothly to this row in the table
    const rowEl = document.getElementById(`wo-row-${orderToEdit.id}`);
    if (rowEl) {
      rowEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      rowEl.classList.add('ring-4', 'ring-amber-500', 'bg-amber-200');
      setTimeout(() => {
        rowEl.classList.remove('ring-4', 'ring-amber-500', 'bg-amber-200');
      }, 1500);
    }

    // Trigger edit modal
    onEdit(orderToEdit);
  };

  // Navigate directly to the selected row and open the basic data edit modal (المكتب - المقاول - رقم امر العمل - رمز امر العمل)
  const handleNavigateAndEditBasicData = (targetOrder?: WorkOrder | null) => {
    if (onCheckPermission && !onCheckPermission('editWorkOrderBasic', 'تعديل البيانات الأساسية لأمر العمل')) {
      return;
    }

    const orderToEdit = targetOrder || selectedOrder || (filteredOrders.length > 0 ? filteredOrders[0] : null);
    if (!orderToEdit) {
      onOpenAddModal();
      return;
    }

    setSelectedOrderIds(new Set([orderToEdit.id]));
    setSelectedOrderId(orderToEdit.id);

    const rowEl = document.getElementById(`wo-row-${orderToEdit.id}`);
    if (rowEl) {
      rowEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      rowEl.classList.add('ring-4', 'ring-blue-500', 'bg-blue-100');
      setTimeout(() => {
        rowEl.classList.remove('ring-4', 'ring-blue-500', 'bg-blue-100');
      }, 1500);
    }

    if (onEditBasicData) {
      onEditBasicData(orderToEdit);
    } else {
      onEdit(orderToEdit);
    }
  };

  // Safe handler to open quality notes itemizer modal with strict permission check
  const handleOpenItemizer = (orderToItemize: WorkOrder) => {
    if (!canUserEditColumn(currentUser, 'qualityNotes')) {
      if (onCheckPermission) {
        onCheckPermission('inlineTableEdit', 'تعديل وتفصيل ملاحظات الجودة وإرفاق الصور');
      }
      return;
    }
    setItemizerModalOrder(orderToItemize);
  };

  // Status badge styling helper
  const getStatusBadgeStyle = (val: string) => {
    if (val === 'مكتمل' || val === 'جاهز للارفاق الكامل') {
      return 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold';
    } else if (val === 'غير مكتمل' || val === 'غير جاهز للارفاق') {
      return 'bg-rose-50 text-rose-800 border-rose-300 font-bold';
    } else if (val === 'مكتمل مع ملاحظات' || val.startsWith('جاهز لارفاق')) {
      return 'bg-amber-50 text-amber-800 border-amber-300 font-bold';
    } else if (val === 'ملاحظات') {
      return 'bg-orange-50 text-orange-800 border-orange-300 font-bold';
    } else if (val === 'لاينطبق') {
      return 'bg-slate-100 text-slate-600 border-slate-300 font-semibold';
    }
    return 'bg-slate-100 text-slate-800 border-slate-200';
  };

  // Proportional fluid width percentage for auto-fitting browser window size smoothly (sums to ~100% with seq and actions)
  const getColumnAutoWidthStyle = (field: string): string => {
    if (!isAutoFitToScreen) return 'auto';
    switch (field) {
      case 'office': return '6.5%';
      case 'contractor': return '7.5%';
      case 'consultant': return '7.5%';
      case 'workOrderNumber': return '7.5%';
      case 'workOrderCode': return '6%';
      case 'photosFile': return '7.5%';
      case 'attachmentStatus': return '7.5%';
      case 'qualityNotes': return '10%';
      case 'pdcAudit': return '10.5%';
      case 'constructionAudit': return '10.5%';
      case 'procedure155Status': return '14.5%';
      case 'statusSyncTime': return '6.5%';
      case 'procedure155': return '7%';
      case 'procedureSyncTime': return '6.5%';
      default:
        const remaining = 88;
        return `${(remaining / Math.max(1, columns.length)).toFixed(1)}%`;
    }
  };

  // Helper to determine exact sticky offsets and boundary for core columns (from sequence # up to workOrderNumber ONLY)
  const getStickyColumnProps = (field: string) => {
    if (!isStickyCoreColumns) {
      return { isSticky: false, rightOffset: 0, isBoundary: false, width: undefined, minWidth: undefined };
    }

    // Pin columns strictly from the beginning (#) up to workOrderNumber (رقم أمر العمل) only
    const targetIndex = columns.findIndex(c => c.field === 'workOrderNumber');
    const colIndex = columns.findIndex(c => c.field === field);

    // Only columns from start up to workOrderNumber are pinned
    if (colIndex === -1 || targetIndex === -1 || colIndex > targetIndex) {
      return { isSticky: false, rightOffset: 0, isBoundary: false, width: undefined, minWidth: undefined };
    }

    // Explicit widths in pixels for sticky pinned columns to ensure perfect RTL stacking without gaps
    const colWidths: Record<string, number> = {
      office: 135,
      contractor: 165,
      consultant: 165,
      workOrderNumber: 140
    };

    const seqWidth = 52;
    let rightOffset = seqWidth;

    for (let i = 0; i < colIndex; i++) {
      const f = columns[i].field;
      rightOffset += colWidths[f] || 135;
    }

    const thisWidth = colWidths[field] || 135;
    const isBoundary = colIndex === targetIndex;

    return {
      isSticky: true,
      rightOffset,
      isBoundary,
      width: `${thisWidth}px`,
      minWidth: `${thisWidth}px`
    };
  };

  // Cell content renderer: Inline Quick Dropdown for specified columns, Copy/Edit for other columns, fully bound to Ribbon formatting
  const renderCellContent = (col: ColumnDefinition, order: WorkOrder) => {
    const rawValue = order[col.field] !== undefined && order[col.field] !== null 
      ? order[col.field] 
      : (order.customFields && order.customFields[col.field]);
    const stringValue = rawValue !== undefined && rawValue !== null ? String(rawValue) : '';
    const cellKey = `${order.id}-${col.field}`;
    const isCopied = copiedCellKey === cellKey;
    const isInlineOpen = openInlineDropdown?.orderId === order.id && openInlineDropdown?.field === col.field;
    const isEditingNote = editingQualityNotes?.orderId === order.id;
    const cs = getResolvedCellStyle(order, col.field);
    const cellInlineTextStyle: React.CSSProperties = {
      fontFamily: cs.fontFamily,
      fontSize: `${cs.fontSize}px`,
      fontWeight: cs.bold ? 900 : 500,
      fontStyle: cs.italic ? 'italic' : 'normal',
      textDecoration: cs.textDecoration,
      color: cs.textColor || undefined
    };

    // A0. عمود ملف الصور (قبل عمود توثيق الصور) - استيراد ومعاينة ملفات PDF وصور مباشرة أونلاين وبطاقة متحركة ورابط ملف الشير للبحث المباشر عن أمر العمل
    if (col.field === 'photosFile') {
      const files: AttachedInspectionFile[] = order.photosFile || [];
      const cleanWoNumber = String(order.workOrderNumber || '').trim();
      const directShareSearchUrl = buildSharePointDirectWorkOrderSearchUrl(
        cleanWoNumber,
        order.sharepointFolderUrl || SHAREPOINT_AUDIT_URL
      );

      return (
        <div
          onClick={(e) => e.stopPropagation()}
          className="flex flex-col gap-0.5 w-full text-right p-1 rounded-lg bg-slate-50/90 border border-slate-200 shadow-2xs"
        >
          {/* Compact Single-Row Action Bar: ملف الشير (بحث مباشر عن أمر العمل) + البطاقة + رفع */}
          <div className="flex items-center gap-1 w-full">
            <a
              href={directShareSearchUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                e.stopPropagation();
                if (cleanWoNumber) {
                  try {
                    navigator.clipboard?.writeText(cleanWoNumber);
                  } catch (_) {}
                  setExportNotification(
                    `جارٍ البحث المباشر عن أمر العمل (${cleanWoNumber}) في جميع ملفات الشير والتوجه إليه مباشرة...`
                  );
                  setTimeout(() => setExportNotification(null), 3500);
                }
                if (files.length === 1) {
                  setViewerModalFile(files[0]);
                  setViewerModalOrder(order);
                }
              }}
              className="flex-1 flex items-center justify-between gap-1 px-1.5 py-0.5 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 text-[9.5px] font-black transition-colors cursor-pointer group min-w-0"
              title={
                cleanWoNumber
                  ? `انقر للبحث المباشر عن أمر العمل (${cleanWoNumber}) في جميع الملفات الموجودة في ملف الشير والتوجه إليه مباشرة`
                  : 'فتح ملف الشير (مجلد متابعة جودة الصور في SharePoint)'
              }
            >
              <div className="flex items-center gap-1 truncate">
                <Search className="w-2.5 h-2.5 text-blue-600 shrink-0" />
                <span className="truncate">
                  {cleanWoNumber ? `شير (${cleanWoNumber})` : 'ملف الشير'}
                </span>
              </div>
              <ExternalLink className="w-2.5 h-2.5 opacity-70 shrink-0 text-blue-600" />
            </a>

            <button
              type="button"
              onClick={() => setFloatingInspectionOrder(order)}
              className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9.5px] font-black border transition-all cursor-pointer shrink-0 ${
                files.length > 0
                  ? 'bg-slate-800 hover:bg-slate-700 text-white border-slate-700'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
              }`}
              title="فتح بطاقة تدقيق ملف الصور والمستندات المتحركة"
            >
              <Move className="w-2.5 h-2.5 text-amber-300 shrink-0" />
              <span>{files.length > 0 ? `(${files.length})` : 'بطاقة'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setCellFileInputOrderId(order.id);
                cellFileInputRef.current?.click();
              }}
              className="p-0.5 px-1 rounded-md bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-300 text-[9.5px] font-black cursor-pointer transition-colors shrink-0"
              title="إرفاق ملف PDF أو صورة لهذا الأمر"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>

          {/* Inline compact file pills if files exist */}
          {files.length > 0 && (
            <div className="flex items-center gap-0.5 flex-wrap">
              {files.slice(0, 2).map((file) => {
                const isPdf = Boolean(file.type?.includes('pdf') || file.name?.toLowerCase().endsWith('.pdf'));
                return (
                  <button
                    key={file.id}
                    type="button"
                    onClick={() => {
                      setViewerModalFile(file);
                      setViewerModalOrder(order);
                    }}
                    className={`inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[9px] font-bold border transition-all cursor-pointer max-w-[90px] ${
                      isPdf
                        ? 'bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-200'
                        : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                    }`}
                    title={`معاينة ملف (${file.name})`}
                  >
                    {isPdf ? (
                      <FileText className="w-2.5 h-2.5 text-rose-600 shrink-0" />
                    ) : (
                      <ImageIcon className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                    )}
                    <span className="truncate" dir="ltr">{file.name}</span>
                  </button>
                );
              })}
              {files.length > 2 && (
                <button
                  type="button"
                  onClick={() => setFloatingInspectionOrder(order)}
                  className="text-[8.5px] text-blue-700 font-black px-1 bg-blue-50 rounded border border-blue-200 cursor-pointer"
                >
                  +{files.length - 2}
                </button>
              )}
            </div>
          )}
        </div>
      );
    }

    // دالة مساعدة لأيقونات بنود تدقيق المساندة الفنية وحالة الإرفاق المتزامنة
    const renderSupportAndAttachmentIcon = (iconName: string) => {
      switch (iconName) {
        case 'meter':
          return <Gauge className="w-2.5 h-2.5 shrink-0" />;
        case 'excavation':
          return <Pickaxe className="w-2.5 h-2.5 shrink-0" />;
        case 'equipment':
          return <Boxes className="w-2.5 h-2.5 shrink-0" />;
        case 'overhead':
          return <Zap className="w-2.5 h-2.5 shrink-0" />;
        case 'fileText':
          return <FileText className="w-2.5 h-2.5 shrink-0" />;
        case 'fileCheck':
          return <FileCheck2 className="w-2.5 h-2.5 shrink-0" />;
        case 'spreadsheet':
          return <FileSpreadsheet className="w-2.5 h-2.5 shrink-0" />;
        case 'layers':
          return <Layers className="w-2.5 h-2.5 shrink-0" />;
        case 'shield':
        default:
          return <ShieldCheck className="w-2.5 h-2.5 shrink-0" />;
      }
    };

    // A0-b. عمود تدقيق PDC وعمود تدقيق الإنشاءات: فارغ افتراضياً لحين التعبئة مع تزامن فوري 100% مع الـ Check List
    if (col.field === 'pdcAudit' || col.field === 'constructionAudit') {
      const fieldKey = col.field as 'pdcAudit' | 'constructionAudit';
      const rawAudit = order[fieldKey];
      const auditData: WorkOrderAuditColumnData =
        rawAudit && typeof rawAudit === 'object'
          ? (rawAudit as WorkOrderAuditColumnData)
          : createEmptyAuditColumnData();
      const checklistMap = extractColumnSupportChecklistMap(order, fieldKey);
      const evaluatedKeys = getEvaluatedColumnSupportChecklistKeys(order, fieldKey, checklistMap);
      const evaluatedItems = TECHNICAL_SUPPORT_CHECKLIST_ITEMS.filter(item =>
        evaluatedKeys.includes(item.key)
      );
      const stats = calculateSupportChecklistStats(checklistMap, evaluatedKeys);

      const smartRawStatus =
        evaluatedKeys.length > 0
          ? stats.isAllApplicableCompleted
            ? 'مؤهل'
            : 'غير مؤهل'
          : auditData.mainStatus === 'مؤهل' || auditData.mainStatus === 'غير مؤهل'
          ? auditData.mainStatus
          : '';
      const isQualified = smartRawStatus === 'مؤهل';
      const isNotQualified = smartRawStatus === 'غير مؤهل';
      const hasEvaluatedStatus = isQualified || isNotQualified;
      const displayStatus = isQualified ? 'مؤهل' : isNotQualified ? 'غير مؤهل' : '';

      return (
        <div
          onClick={(e) => {
            e.stopPropagation();
            setActiveAuditModal({
              order,
              columnField: fieldKey,
              columnTitle: col.title,
              initialFocusField: null
            });
          }}
          className={`flex flex-col gap-0.5 px-1.5 py-1 rounded-lg border transition-all cursor-pointer group/audit w-full min-w-[185px] text-right ${
            hasEvaluatedStatus
              ? 'bg-gradient-to-br from-slate-50 via-blue-50/35 to-indigo-50/40 hover:from-blue-50/70 hover:to-indigo-50/70 border-slate-300/90 hover:border-blue-400 shadow-2xs'
              : 'bg-transparent hover:bg-slate-50/80 border-transparent hover:border-slate-300'
          }`}
          title={
            hasEvaluatedStatus
              ? `انقر لفتح بطاقة تدقيق (${col.title}) — الحالة: ${displayStatus}${evaluatedKeys.length > 0 ? ` (${stats.compliancePercentage}%)` : ''}`
              : `انقر لتعبئة وتدقيق (${col.title})`
          }
        >
          {/* السطر الأول المدمج: مراحل التدقيق + Check List + النتيجة فقط عند التعبئة */}
          <div className="flex items-center justify-between gap-1 w-full whitespace-nowrap">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveStagesReferenceModal({
                  order,
                  columnTitle: col.title
                });
              }}
              className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[#003366] hover:bg-[#002244] text-white border-b border-orange-500 text-[9px] font-black shadow-2xs transition-all cursor-pointer shrink-0 ${
                hasEvaluatedStatus ? 'opacity-100' : 'opacity-65 group-hover/audit:opacity-100'
              }`}
              title="مراحل التدقيق (الاطلاع على القوائم الأساسية الـ 18 وبنودها)"
            >
              <BookOpen className="w-2.5 h-2.5 text-amber-300 shrink-0" />
              <span>مراحل التدقيق</span>
            </button>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveAuditModal({
                    order,
                    columnField: fieldKey,
                    columnTitle: col.title,
                    initialFocusField: null
                  });
                }}
                className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-950 text-white text-[9.5px] font-black shadow-2xs transition-all cursor-pointer shrink-0 ${
                  hasEvaluatedStatus ? 'opacity-100' : 'opacity-65 group-hover/audit:opacity-100'
                }`}
                title={`فتح قائمة التدقيق (Check List) لعمود ${col.title}`}
              >
                <ListChecks className="w-2.5 h-2.5 text-amber-300 shrink-0" />
                <span>Check List</span>
              </button>

              {hasEvaluatedStatus && (
                <span
                  className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9.5px] font-black border shadow-2xs shrink-0 ${
                    isQualified
                      ? 'bg-emerald-100 text-emerald-950 border-emerald-400'
                      : 'bg-rose-100 text-rose-950 border-rose-400'
                  }`}
                >
                  {isQualified ? (
                    <CheckCircle2 className="w-2.5 h-2.5 text-emerald-700 shrink-0" />
                  ) : (
                    <XCircle className="w-2.5 h-2.5 text-rose-700 shrink-0" />
                  )}
                  <span>{displayStatus}</span>
                  {evaluatedKeys.length > 0 && (
                    <span className="font-mono text-[8.5px]">({stats.compliancePercentage}%)</span>
                  )}
                </span>
              )}
            </div>
          </div>

          {/* السطر الثاني المدمج: اختصارات البنود المدققة فقط لمنع التكدس */}
          {evaluatedItems.length > 0 && (
            <div className="flex flex-wrap items-center gap-0.5 w-full pt-0.5 border-t border-slate-200/80">
              {evaluatedItems.map((item) => {
                const itemVal = checklistMap[item.key];
                const isCompleted = itemVal === 'مكتمل';
                const isNA = itemVal === 'لا ينطبق';
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveAuditModal({
                        order,
                        columnField: fieldKey,
                        columnTitle: col.title,
                        initialFocusField: item.key
                      });
                    }}
                    className={`inline-flex items-center gap-0.5 px-1 py-0.2 rounded border text-[8.5px] font-black transition-all hover:scale-105 cursor-pointer ${
                      isCompleted
                        ? 'bg-emerald-100 text-emerald-950 border-emerald-400'
                        : isNA
                        ? 'bg-amber-100 text-amber-950 border-amber-400'
                        : 'bg-rose-100 text-rose-950 border-rose-400'
                    }`}
                    title={`${item.title}: ${itemVal}`}
                  >
                    {renderSupportAndAttachmentIcon(item.iconName)}
                    <span>{item.abbrTitle}</span>
                    <span>{isCompleted ? '✓' : isNA ? '−' : '✗'}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    // A0-b2. عمود حالة الارفاق (attachmentStatus): فارغ افتراضياً لحين تعبئته أو تدقيق المساندة الفنية
    if (col.field === 'attachmentStatus') {
      const checklistMap = extractOrderSupportChecklistMap(order);
      const evaluatedKeys = getEvaluatedSupportChecklistKeys(order, checklistMap);
      const evalSet = new Set(evaluatedKeys);
      const readyItems = TECHNICAL_SUPPORT_CHECKLIST_ITEMS.filter(
        (item) => evalSet.has(item.key) && checklistMap[item.key] === 'مكتمل'
      );
      const stats = calculateSupportChecklistStats(checklistMap, evaluatedKeys);
      const isFullReady = evaluatedKeys.length > 0 && stats.isAllApplicableCompleted && readyItems.length > 0;
      const manualAtt = String(order.attachmentStatus || '').trim();
      const hasManualAttachment = Boolean(manualAtt && manualAtt !== 'غير جاهز للارفاق' && evaluatedKeys.length === 0);
      const isCellEmpty = evaluatedKeys.length === 0 && !hasManualAttachment;

      return (
        <div
          onClick={(e) => {
            e.stopPropagation();
            setActiveSupportAuditModal({
              order,
              focusField: null,
              viewMode: 'attachment_readonly'
            });
          }}
          className={`flex flex-col gap-1 px-1.5 py-1 rounded-lg border transition-all w-full min-w-[165px] min-h-[28px] text-right cursor-pointer ${
            readyItems.length > 0 || hasManualAttachment
              ? 'bg-gradient-to-br from-emerald-50/70 via-white to-teal-50/50 border-emerald-300 hover:border-emerald-500 shadow-2xs'
              : isCellEmpty
              ? 'bg-transparent hover:bg-slate-50/70 border-transparent hover:border-slate-300'
              : 'bg-rose-50/50 hover:bg-rose-50 border-rose-200 hover:border-rose-300 shadow-2xs'
          }`}
          title={
            readyItems.length > 0
              ? `الجاهز للإرفاق (${readyItems.length}): ${readyItems.map((i) => i.abbrTitle).join(' ، ')}`
              : hasManualAttachment
              ? `حالة الإرفاق: ${manualAtt}`
              : 'خلية فارغة افتراضياً — تتعبأ تلقائياً عند تدقيق المساندة الفنية'
          }
        >
          {isCellEmpty ? (
            <div className="flex items-center justify-between w-full min-h-[20px]">
              <span className="flex-1" />
            </div>
          ) : readyItems.length === 0 && hasManualAttachment ? (
            <div className="flex items-center justify-between gap-1 whitespace-nowrap">
              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-black border bg-emerald-100 text-emerald-950 border-emerald-400">
                <CheckCircle2 className="w-2.5 h-2.5 shrink-0" />
                <span>{manualAtt}</span>
              </span>
            </div>
          ) : readyItems.length === 0 ? (
            <div className="flex items-center justify-between gap-1 px-1 py-0.5 text-[9.5px] font-black text-rose-800">
              <span className="truncate">غير جاهز للإرفاق</span>
              <Link2 className="w-2.5 h-2.5 text-rose-500 shrink-0" />
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-1 whitespace-nowrap">
                <span
                  className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-black border ${
                    isFullReady
                      ? 'bg-emerald-700 text-white border-emerald-800'
                      : 'bg-emerald-100 text-emerald-950 border-emerald-400'
                  }`}
                >
                  <CheckCircle2 className="w-2.5 h-2.5 shrink-0" />
                  <span>{isFullReady ? 'جاهز للإرفاق الكامل' : 'جاهز للإرفاق'}</span>
                </span>
                <span className="text-[8.5px] font-mono font-black px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-900 border border-emerald-300 shrink-0">
                  {readyItems.length} جاهز
                </span>
              </div>

              <div className="grid grid-cols-2 gap-0.5 w-full pt-0.5 border-t border-emerald-200/70">
                {readyItems.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveSupportAuditModal({
                        order,
                        focusField: item.key,
                        viewMode: 'attachment_readonly'
                      });
                    }}
                    className="inline-flex items-center justify-between gap-0.5 px-1.5 py-0.5 rounded bg-white hover:bg-emerald-50 text-emerald-950 border border-emerald-300 text-[8.5px] font-black transition-all cursor-pointer truncate shadow-2xs"
                    title={`${item.attachmentTitle}: جاهز للإرفاق ✓`}
                  >
                    <span className="inline-flex items-center gap-0.5 truncate">
                      {renderSupportAndAttachmentIcon(item.iconName)}
                      <span className="truncate">{item.abbrTitle}</span>
                    </span>
                    <span className="text-emerald-700 font-black shrink-0">✓</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      );
    }

    // A0-c. عمود تدقيق المساندة الفنية (procedure155Status): فارغ افتراضياً لحين التدقيق الفعلي
    if (col.field === 'procedure155Status') {
      const checklistMap = extractOrderSupportChecklistMap(order);
      const evaluatedKeys = getEvaluatedSupportChecklistKeys(order, checklistMap);
      const evaluatedItems = TECHNICAL_SUPPORT_CHECKLIST_ITEMS.filter(item =>
        evaluatedKeys.includes(item.key)
      );
      const stats = calculateSupportChecklistStats(checklistMap, evaluatedKeys);

      const hasEvaluated155 = evaluatedKeys.length > 0;
      const rawMainStatus = String(order.procedure155Status || '').trim();
      const hasExplicitManualStatus = Boolean(
        rawMainStatus &&
        rawMainStatus !== 'قيد التدقيق' &&
        rawMainStatus !== 'قيد التدقيق الفني'
      );
      const hasAnyStatus155 = hasEvaluated155 || hasExplicitManualStatus;
      const isQualified155 = hasEvaluated155
        ? stats.isAllApplicableCompleted && !rawMainStatus.includes('غير مؤهل')
        : hasExplicitManualStatus && !rawMainStatus.includes('غير') && (rawMainStatus.includes('مؤهل') || rawMainStatus.includes('معتمد'));
      const displayMainStatus = !hasAnyStatus155
        ? ''
        : isQualified155
        ? 'مؤهل'
        : 'غير مؤهل';

      return (
        <div
          onClick={(e) => {
            e.stopPropagation();
            setActiveSupportAuditModal({
              order,
              focusField: null
            });
          }}
          className={`flex flex-col gap-0.5 px-1.5 py-1 rounded-lg border transition-all cursor-pointer group/support w-full min-w-[175px] text-right ${
            hasAnyStatus155
              ? 'bg-gradient-to-br from-slate-50 via-blue-50/35 to-indigo-50/40 hover:from-blue-50/70 hover:to-indigo-50/70 border-slate-300/90 hover:border-blue-400 shadow-2xs'
              : 'bg-transparent hover:bg-slate-50/80 border-transparent hover:border-slate-300'
          }`}
          title={
            hasAnyStatus155
              ? `بطاقة تدقيق المساندة الفنية (Check List) — النتيجة: ${displayMainStatus}${hasEvaluated155 ? ` (${stats.compliancePercentage}%)` : ''}`
              : 'انقر لفتح بطاقة تدقيق المساندة الفنية (Check List)'
          }
        >
          <div className="flex items-center justify-between gap-1 w-full whitespace-nowrap">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveSupportAuditModal({
                  order,
                  focusField: null
                });
              }}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-950 text-white text-[9.5px] font-black shadow-2xs transition-all cursor-pointer shrink-0 ${
                hasAnyStatus155 ? 'opacity-100' : 'opacity-65 group-hover/support:opacity-100'
              }`}
              title="فتح قوائم تدقيق المساندة الفنية (Check List)"
            >
              <ListChecks className="w-2.5 h-2.5 text-amber-300 shrink-0" />
              <span>Check List</span>
            </button>

            {hasAnyStatus155 && (
              <span
                className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[9.5px] font-black border shadow-2xs shrink-0 ${
                  isQualified155
                    ? 'bg-emerald-100 text-emerald-950 border-emerald-400'
                    : 'bg-rose-100 text-rose-950 border-rose-400'
                }`}
              >
                {isQualified155 ? (
                  <CheckCircle2 className="w-2.5 h-2.5 text-emerald-700 shrink-0" />
                ) : (
                  <XCircle className="w-2.5 h-2.5 text-rose-700 shrink-0" />
                )}
                <span>{displayMainStatus}</span>
                {hasEvaluated155 && (
                  <span className="font-mono text-[8.5px]">({stats.compliancePercentage}%)</span>
                )}
              </span>
            )}
          </div>

          {evaluatedItems.length > 0 && (
            <div className="flex flex-wrap items-center gap-0.5 w-full pt-0.5 border-t border-slate-200/80">
              {evaluatedItems.map((item) => {
                const itemVal = checklistMap[item.key];
                const isCompleted = itemVal === 'مكتمل';
                const isNA = itemVal === 'لا ينطبق';
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveSupportAuditModal({
                        order,
                        focusField: item.key
                      });
                    }}
                    className={`inline-flex items-center gap-0.5 px-1 py-0.2 rounded border text-[8.5px] font-black transition-all hover:scale-105 cursor-pointer ${
                      isCompleted
                        ? 'bg-emerald-100 text-emerald-950 border-emerald-400'
                        : isNA
                        ? 'bg-amber-100 text-amber-950 border-amber-400'
                        : 'bg-rose-100 text-rose-950 border-rose-400'
                    }`}
                    title={`${item.title}: ${itemVal} (يتزامن تلقائياً مع ${item.attachmentTitle})`}
                  >
                    {renderSupportAndAttachmentIcon(item.iconName)}
                    <span>{item.abbrTitle}</span>
                    <span>{isCompleted ? '✓' : isNA ? '−' : '✗'}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    // A. Specified Columns for DIRECT INLINE DROPDOWN EDITING:
    // (حالة الارفاق - توثيق الصور - نماذج الاستشاري - نماذج إجازة الاستشاري - نموذج 190 - نموذج 200 - نموذج الفحص - حالة أمر العمل - المقاول - الاستشاري - المكتب)
    const isStatusColumn = [
      'attachmentStatus',
      'photoDocumentation',
      'consultantForms',
      'consultantClearanceForms',
      'form190',
      'form200',
      'inspectionForm',
      'procedure155Status'
    ].includes(col.field);

    const isDropdownColumn = isStatusColumn || ['office', 'contractor', 'consultant'].includes(col.field) || Boolean(col.hasDropdown && !['receiptDate', 'workOrderNumber', 'workOrderCode', 'qualityNotes', 'photos'].includes(col.field));

    if (isDropdownColumn) {
      let options: string[] = [];
      const dKey = col.dropdownKey || col.field;
      if (col.field === 'procedure155') {
        options = [
          'تم الاجراء',
          'مؤهل لإجراء 155',
          'غير مؤهل لإجراء 155',
          'مؤهل للاغلاق ( معتمد )',
          'غير مؤهل للأغلاق',
          'قيد الإجراء',
          '— تفريغ الخلية —'
        ];
      } else if (col.field === 'procedure155Status') {
        options = ['قيد التدقيق', 'مؤهل للاغلاق ( معتمد )', 'غير مؤهل للأغلاق', 'مؤهل للاغلاق', 'غير مؤهل للاغلاق'];
      } else if (col.field === 'attachmentStatus') {
        options = dropdownOptions.attachmentStatus && dropdownOptions.attachmentStatus.length > 0
          ? dropdownOptions.attachmentStatus
          : [
              'جاهز للارفاق الكامل',
              'جاهز لارفاق صور العداد',
              'جاهز لارفاق صور الخفريات',
              'جاهز لارفاق صور المعدات',
              'جاهز لارفاق صور الهوائي',
              'غير جاهز للارفاق'
            ];
      } else if (col.field === 'contractor') {
        const officeConts = getContractorsForOffice(order.office, dropdownOptions.officeContractors, offices);
        options = officeConts && officeConts.length > 0 
          ? officeConts 
          : (dropdownOptions.contractor || ['فصول السنة', 'الوبران', 'الاداء المتوازن', 'القرش', 'بن دلامة']);
      } else if (col.field === 'consultant') {
        const officeCons = getConsultantsForOffice(order.office, dropdownOptions.officeConsultants, offices);
        const standardCons = ['الحامد', 'المحايد', 'الصخرة المشرفة', 'سعود كونسلت'];
        const rawList = officeCons && officeCons.length > 0
          ? officeCons
          : (dropdownOptions.consultant || standardCons);
        options = Array.from(new Set([...standardCons, ...rawList]));
      } else if (col.field === 'office') {
        options = dropdownOptions.office && dropdownOptions.office.length > 0
          ? dropdownOptions.office
          : ['مكتب عرعر', 'مكتب رفحاء', 'مكتب طريف', 'مكتب العويقيلة'];
      } else if (dropdownOptions && Array.isArray(dropdownOptions[dKey]) && dropdownOptions[dKey].length > 0) {
        options = dropdownOptions[dKey];
      } else if (col.field === 'form190' || col.field === 'form200' || col.field === 'inspectionForm') {
        options = ['مكتمل', 'غير مكتمل', 'مكتمل مع ملاحظات', 'ملاحظات', 'لاينطبق'];
      } else {
        options = ['مكتمل', 'غير مكتمل', 'مكتمل مع ملاحظات', 'ملاحظات'];
      }

      const effectiveProc155 = col.field === 'procedure155' ? getEffectiveProcedure155Status(order) : '';
      const displayVal = col.field === 'procedure155'
        ? (effectiveProc155 || stringValue || '(فارغ)')
        : stringValue || (col.field === 'procedure155Status' ? 'قيد التدقيق' : col.field === 'attachmentStatus' ? 'غير جاهز للارفاق' : isStatusColumn ? 'غير مكتمل' : '(فارغ)');
      const isQualified155 = col.field === 'procedure155Status' 
        ? !displayVal.includes('غير') && (displayVal.includes('مؤهل') || displayVal.includes('معتمد') || displayVal.includes('تم'))
        : false;

      const isNonStatusBadge = !isStatusColumn;

      // Resolve creator/data-entry Name + Email to display directly below Consultant name
      const adderEmail = col.field === 'consultant'
        ? (
            order.addedByEmail ||
            order.createdByEmail ||
            (order.statusSyncEmail && order.statusSyncEmail.includes('@') ? order.statusSyncEmail : '') ||
            (order.lastUpdatedBy && order.lastUpdatedBy.includes('@') ? order.lastUpdatedBy : '')
          ).trim()
        : '';
      const rawAdderName = col.field === 'consultant'
        ? (
            order.addedByName ||
            order.inspectorName ||
            (order.lastUpdatedBy && !order.lastUpdatedBy.includes('@') ? order.lastUpdatedBy : '') ||
            (order.statusSyncUser && !order.statusSyncUser.includes('@') ? order.statusSyncUser : '')
          ).trim()
        : '';
      const adderName =
        rawAdderName ||
        (adderEmail.toLowerCase().includes('2502331172') ? 'م. محمود الشحات' : '');

      return (
        <div className="relative flex flex-col gap-1 w-full text-right">
          <button
            type="button"
            data-inline-dropdown-trigger="true"
            data-cell-trigger={`${order.id}-${col.field}`}
            onClick={(e) => {
              e.stopPropagation();
              if (!canUserEditColumn(currentUser, col.field)) {
                if (onCheckPermission) {
                  onCheckPermission('inlineTableEdit', `تعديل عمود (${col.title}) - الحساب غير مصرح له بتعديل هذا العمود`);
                }
                return;
              }

              if (isInlineOpen) {
                setOpenInlineDropdown(null);
                return;
              }
              const rect = e.currentTarget.getBoundingClientRect();
              const spaceBelow = window.innerHeight - rect.bottom;
              const openUpward = spaceBelow < 230 && rect.top > 230;

              setOpenInlineDropdown({
                orderId: order.id,
                field: col.field,
                colTitle: col.title,
                displayVal,
                options,
                rect: {
                  top: rect.top,
                  bottom: rect.bottom,
                  left: rect.left,
                  right: rect.right,
                  width: rect.width,
                  height: rect.height
                },
                openUpward
              });
            }}
            style={cellInlineTextStyle}
            className={`w-full flex items-center justify-between gap-1.5 px-2 py-1 rounded-lg transition-all border shadow-2xs cursor-pointer group ${
              cs.bold ? 'font-black' : 'font-semibold'
            } ${cs.italic ? 'italic' : ''} ${
              isInlineOpen ? 'ring-2 ring-blue-500 scale-[1.02]' : ''
            } ${
              col.field === 'procedure155'
                ? displayVal.includes('مؤهل') || displayVal.includes('معتمد') || displayVal.includes('تم')
                  ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300 ring-1 ring-emerald-400/30'
                  : displayVal.includes('غير') || displayVal.includes('ملاحظات')
                  ? 'bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-300 ring-1 ring-rose-400/30'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-300'
                : col.field === 'procedure155Status'
                ? isQualified155
                  ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300'
                  : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-300'
                : isNonStatusBadge
                  ? 'bg-slate-50 hover:bg-blue-50 text-slate-800 border-slate-300'
                  : getStatusBadgeStyle(displayVal)
            }`}
            title={`انقر لتعديل ${col.title} - تظهر القائمة فوق الجدول مباشرة`}
          >
            <div className={`flex items-center gap-1 flex-1 min-w-0 ${
              cs.textAlign === 'center' ? 'justify-center' : cs.textAlign === 'left' ? 'justify-start' : 'justify-end'
            } ${isWrapTextEnabled ? 'whitespace-normal break-words' : 'truncate'}`}>
              {col.field === 'procedure155Status' && <ShieldCheck className="w-3.5 h-3.5 shrink-0" />}
              <span className={isWrapTextEnabled ? 'break-words whitespace-normal' : 'truncate'} style={{ textDecoration: cs.textDecoration }}>
                {displayVal}
              </span>
            </div>
            <ChevronDown className={`w-3 h-3 opacity-60 group-hover:opacity-100 shrink-0 transition-transform ${isInlineOpen ? 'rotate-180' : ''}`} />
          </button>

          {col.field === 'consultant' && (adderEmail || adderName) && (
            <div
              className="flex items-center justify-center gap-1 px-1.5 py-0.5 rounded bg-blue-50/95 border border-blue-200 text-[9px] font-bold text-blue-950 truncate"
              title={`مدخل البيانات: ${adderName ? `${adderName} — ` : ''}${adderEmail}`}
            >
              {adderName && (
                <span className="truncate text-slate-900 font-black max-w-[85px]">{adderName}</span>
              )}
              {adderEmail && (
                <span className="truncate font-mono text-blue-800 max-w-[95px]" dir="ltr">
                  {adderEmail.split('@')[0]}
                </span>
              )}
            </div>
          )}
        </div>
      );
    }

    // B. Quality Notes: Direct Inline Edit with Elementized Notes & Photos
    if (col.field === 'qualityNotes') {
      const rawNoteItems = order.qualityNoteItems && order.qualityNoteItems.length > 0
        ? order.qualityNoteItems.filter((it) => {
            const t = String(it?.text || '').trim();
            return Boolean(t && t !== '-' && t !== 'لا توجد ملاحظات' && t !== 'لا توجد ملاحظات حالياً' && t !== 'بدون ملاحظات');
          })
        : [];
      const noteItems = rawNoteItems.length > 0 ? rawNoteItems : null;
      const rawText = (stringValue || order.executionNotes || '').trim();
      const notesText =
        rawText === '-' || rawText === 'لا توجد ملاحظات' || rawText === 'لا توجد ملاحظات حالياً' || rawText === 'بدون ملاحظات'
          ? ''
          : rawText;

      const openNotesEditor = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!canUserEditColumn(currentUser, 'qualityNotes')) {
          if (onCheckPermission) {
            onCheckPermission('inlineTableEdit', 'تعديل ملاحظات الجودة');
          }
          return;
        }

        if (isEditingNote) {
          setEditingQualityNotes(null);
          return;
        }
        const triggerEl = (e.currentTarget.closest('[data-quality-notes-trigger="true"]') || e.currentTarget) as HTMLElement;
        const rect = triggerEl.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const openUpward = spaceBelow < 260 && rect.top > 260;

        setEditingQualityNotes({
          orderId: order.id,
          text: notesText,
          rect: {
            top: rect.top,
            bottom: rect.bottom,
            left: rect.left,
            right: rect.right,
            width: rect.width,
            height: rect.height
          },
          openUpward
        });
      };

      if (!notesText && (!noteItems || noteItems.length === 0)) {
        return (
          <div className="relative w-full">
            <button
              type="button"
              data-quality-notes-trigger="true"
              data-cell-trigger={`${order.id}-qualityNotes`}
              onClick={() => handleOpenItemizer(order)}
              className="w-full min-h-[26px] text-right px-2 py-1 rounded-lg border border-transparent hover:border-slate-300 hover:bg-slate-50/70 transition-all cursor-pointer flex items-center justify-between"
              title="انقر لإدخال ملاحظة أو إرفاق صور توضيحية"
            >
              <span className="flex-1" />
            </button>
          </div>
        );
      }

      // If we have elementized note items: compact view showing first 2 notes with +N badge to prevent row crowding
      if (noteItems && noteItems.length > 0) {
        const totalPhotosCount = noteItems.reduce((acc, it) => acc + (it.photos?.length || 0), 0);
        return (
          <div className="relative w-full space-y-1 py-0.5">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[9.5px] font-black bg-red-700 text-white px-1.5 py-0.2 rounded shadow-2xs shrink-0">
                ملاحظات ({noteItems.length})
              </span>
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  type="button"
                  onClick={(e) => handleCopy(noteItems.map((n, i) => `${i + 1}. ${n.text}`).join('\n'), cellKey, e)}
                  className={`px-1 py-0.2 rounded text-[8.5px] font-black transition-all cursor-pointer ${
                    isCopied ? 'bg-emerald-600 text-white' : 'bg-red-100 hover:bg-red-200 text-red-800'
                  }`}
                  title="نسخ كافة الملاحظات"
                >
                  {isCopied ? 'نُسخ' : 'نسخ'}
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenItemizer(order)}
                  className="px-1 py-0.2 rounded bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 text-[8.5px] font-black cursor-pointer flex items-center gap-0.5"
                  title="عنصرة الملاحظات وإرفاق الصور التوضيحية"
                >
                  <Camera className="w-2.5 h-2.5 text-amber-700" />
                  <span>{totalPhotosCount > 0 ? totalPhotosCount : 'صور'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenItemizer(order)}
                  className="p-0.5 rounded bg-red-100 hover:bg-red-200 text-red-800 text-[9px] font-black cursor-pointer"
                  title="تعديل وإضافة ملاحظات"
                >
                  <Edit3 className="w-2.5 h-2.5 text-red-700" />
                </button>
              </div>
            </div>

            {noteItems.slice(0, 2).map((item, idx) => (
              <div
                key={item.id || idx}
                onClick={(e) => handleCopy(item.text, `${cellKey}-${idx}`, e)}
                className="flex items-center justify-between gap-1 rounded-md px-1.5 py-0.5 bg-red-50/90 border border-red-200/90 text-red-800 text-[10px] font-black cursor-pointer hover:bg-red-100/80"
                title={`${ idx + 1 }. ${item.text}${item.authorName || item.authorEmail ? ` — (${item.authorName || item.authorEmail})` : ''}`}
              >
                <span className="truncate flex-1">
                  {idx + 1}. {item.text}
                </span>
                {item.photos && item.photos.length > 0 && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewPhotos(order);
                    }}
                    className="text-[8.5px] font-bold text-amber-800 bg-amber-50 px-1 rounded border border-amber-200 flex items-center gap-0.5 shrink-0"
                  >
                    <Camera className="w-2 h-2 text-amber-600" />
                    <span>{item.photos.length}</span>
                  </span>
                )}
              </div>
            ))}
            {noteItems.length > 2 && (
              <button
                type="button"
                onClick={() => handleOpenItemizer(order)}
                className="w-full text-center text-[9px] font-black text-red-800 bg-red-100/80 hover:bg-red-200/80 py-0.2 rounded border border-red-200 cursor-pointer"
              >
                +{noteItems.length - 2} ملاحظات إضافية (عرض الكل)
              </button>
            )}
          </div>
        );
      }

      // Single note card fallback (compact)
      return (
        <div className="relative w-full">
          <div
            data-quality-notes-trigger="true"
            data-cell-trigger={`${order.id}-qualityNotes`}
            className="w-full rounded-lg px-2 py-1 transition-all shadow-2xs border bg-red-50/90 hover:bg-red-100/90 border-red-200/90 text-red-700"
          >
            <div className="flex items-center justify-between gap-1 mb-0.5">
              <span className="inline-flex items-center gap-0.5 text-[9px] font-black text-red-700 bg-red-100/80 px-1 py-0.2 rounded border border-red-200">
                <AlertCircle className="w-2.5 h-2.5 text-red-600 shrink-0" />
                <span>ملاحظة</span>
              </span>

              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() => handleOpenItemizer(order)}
                  className="px-1 py-0.2 rounded bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 text-[9px] font-black transition-colors cursor-pointer flex items-center gap-0.5"
                  title="إرفاق صورة للملاحظة أو عنصرة الملاحظات"
                >
                  <Camera className="w-2.5 h-2.5 text-amber-700" />
                  <span>{order.photos && order.photos.length > 0 ? order.photos.length : '+صورة'}</span>
                </button>

                <button
                  type="button"
                  onClick={(e) => handleCopy(notesText, cellKey, e)}
                  className={`inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[9px] font-black transition-all cursor-pointer ${
                    isCopied
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white hover:bg-red-100 text-red-700 border border-red-200'
                  }`}
                  title="نسخ نص الملاحظة"
                >
                  {isCopied ? <Check className="w-2.5 h-2.5 text-white" /> : <Copy className="w-2.5 h-2.5" />}
                  <span>{isCopied ? 'نُسخ' : 'نسخ'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenItemizer(order)}
                  className="p-0.5 rounded bg-white hover:bg-red-100 text-red-700 border border-red-200 text-[9px] font-black transition-colors cursor-pointer"
                  title="عنصرة وتعديل الملاحظة والصور"
                >
                  <Edit3 className="w-2.5 h-2.5 text-red-600" />
                </button>
              </div>
            </div>

            <div
              onClick={(e) => handleCopy(notesText, cellKey, e)}
              className="text-[10.5px] font-black text-red-700 select-all truncate max-w-[220px] cursor-pointer hover:text-red-900"
              title={`${notesText} (انقر لنسخ الملاحظة)`}
            >
              {notesText}
            </div>
          </div>
        </div>
      );
    }

    // C1. Audit Sync Column (مزامنة التدقيق: فارغ افتراضياً لحين إجراء تدقيق فعلي لأي من الإدارات الثلاث)
    if (col.field === 'statusSyncTime') {
      const pdcData = order.pdcAudit && typeof order.pdcAudit === 'object' ? order.pdcAudit : ({} as any);
      const pdcEval = getEvaluatedColumnSupportChecklistKeys(order, 'pdcAudit');
      const pdcStats = calculateSupportChecklistStats(extractColumnSupportChecklistMap(order, 'pdcAudit'), pdcEval);
      const pdcStatus =
        pdcEval.length > 0
          ? pdcStats.isAllApplicableCompleted
            ? 'مؤهل'
            : 'غير مؤهل'
          : pdcData.mainStatus === 'مؤهل' || pdcData.mainStatus === 'غير مؤهل'
          ? pdcData.mainStatus
          : '';
      const pdcDate = pdcData.auditDateRiyadh || (pdcData.lastUpdatedAt ? String(pdcData.lastUpdatedAt).split(' ')[0] : '');
      const pdcTime = pdcData.auditTimeRiyadh || (pdcData.lastUpdatedAt ? String(pdcData.lastUpdatedAt).split(' ').slice(1).join(' ') : '');
      const pdcEmail = pdcData.auditorEmail || '';
      const pdcSynced = Boolean(pdcEval.length > 0 || pdcStatus === 'مؤهل' || pdcStatus === 'غير مؤهل');

      const constData = order.constructionAudit && typeof order.constructionAudit === 'object' ? order.constructionAudit : ({} as any);
      const constEval = getEvaluatedColumnSupportChecklistKeys(order, 'constructionAudit');
      const constStats = calculateSupportChecklistStats(extractColumnSupportChecklistMap(order, 'constructionAudit'), constEval);
      const constStatus =
        constEval.length > 0
          ? constStats.isAllApplicableCompleted
            ? 'مؤهل'
            : 'غير مؤهل'
          : constData.mainStatus === 'مؤهل' || constData.mainStatus === 'غير مؤهل'
          ? constData.mainStatus
          : '';
      const constDate = constData.auditDateRiyadh || (constData.lastUpdatedAt ? String(constData.lastUpdatedAt).split(' ')[0] : '');
      const constTime = constData.auditTimeRiyadh || (constData.lastUpdatedAt ? String(constData.lastUpdatedAt).split(' ').slice(1).join(' ') : '');
      const constEmail = constData.auditorEmail || '';
      const constSynced = Boolean(constEval.length > 0 || constStatus === 'مؤهل' || constStatus === 'غير مؤهل');

      const tsData = order.technicalSupportAudit || ({} as any);
      const tsEval = getEvaluatedSupportChecklistKeys(order);
      const tsStats = calculateSupportChecklistStats(extractOrderSupportChecklistMap(order), tsEval);
      const rawTsMain = String(order.procedure155Status || '').trim();
      const tsHasManual = Boolean(rawTsMain && rawTsMain !== 'قيد التدقيق' && rawTsMain !== 'قيد التدقيق الفني');
      const tsStatus =
        tsEval.length > 0
          ? tsStats.isAllApplicableCompleted && !rawTsMain.includes('غير مؤهل')
            ? 'مؤهل'
            : 'غير مؤهل'
          : tsHasManual
          ? !rawTsMain.includes('غير') && (rawTsMain.includes('مؤهل') || rawTsMain.includes('معتمد'))
            ? 'مؤهل'
            : 'غير مؤهل'
          : '';
      const legacyTimeVal = order.statusSyncTime || stringValue || '';
      const legacyDisplayTime = legacyTimeVal.includes('|') ? legacyTimeVal.split('|')[0]?.trim() : legacyTimeVal;
      const legacyEmail = order.statusSyncEmail || (legacyTimeVal.includes('|') ? legacyTimeVal.split('|')[1]?.trim() : '');
      const isLegacyFromOtherAudit =
        (pdcEmail && legacyEmail === pdcEmail && legacyDisplayTime.includes(pdcDate)) ||
        (constEmail && legacyEmail === constEmail && legacyDisplayTime.includes(constDate));
      const tsDate =
        tsData.auditDateRiyadh ||
        (!isLegacyFromOtherAudit && (order.statusSyncDateRiyadh || (legacyDisplayTime ? legacyDisplayTime.split(' ')[0] : ''))) ||
        '';
      const tsTime =
        tsData.auditTimeRiyadh ||
        (!isLegacyFromOtherAudit && (order.statusSyncTimeRiyadh || (legacyDisplayTime ? legacyDisplayTime.split(' ').slice(1).join(' ') : ''))) ||
        '';
      const tsEmail = tsData.auditorEmail || (!isLegacyFromOtherAudit ? legacyEmail : '') || '';
      const tsSynced = Boolean(tsEval.length > 0 || tsStatus === 'مؤهل' || tsStatus === 'غير مؤهل');

      const auditRows = [
        {
          index: 1,
          shortLabel: 'PDC',
          status: pdcStatus,
          synced: pdcSynced,
          date: pdcDate,
          time: pdcTime,
          email: pdcEmail,
          isPositive: pdcStatus === 'مؤهل'
        },
        {
          index: 2,
          shortLabel: 'إنشاءات',
          status: constStatus,
          synced: constSynced,
          date: constDate,
          time: constTime,
          email: constEmail,
          isPositive: constStatus === 'مؤهل'
        },
        {
          index: 3,
          shortLabel: 'مساندة',
          status: tsStatus,
          synced: tsSynced,
          date: tsDate,
          time: tsTime,
          email: tsEmail,
          isPositive: tsStatus === 'مؤهل'
        }
      ].filter((r) => r.synced);

      if (auditRows.length === 0) {
        return <div className="min-h-[26px] w-full" />;
      }

      const activeLinesSummary = auditRows
        .map((r) => `${r.shortLabel}: [${r.status}] | ${r.date || '-'} ${r.time || ''} | ${r.email || ''}`)
        .join('\n');

      return (
        <div
          className="flex flex-col gap-0.5 p-1 rounded-lg border border-[#003366]/25 bg-slate-50/95 shadow-2xs w-full min-w-[195px] max-w-[270px] text-right group/cell"
          title={activeLinesSummary}
        >
          <div className="overflow-x-auto rounded border border-slate-200 bg-white p-0.5 space-y-0.5" style={{ scrollbarWidth: 'thin' }}>
            {auditRows.map((row) => (
              <div
                key={row.index}
                className="flex items-center justify-between gap-1 px-1.5 py-0.5 rounded text-[9px] whitespace-nowrap bg-emerald-50/60 text-slate-900"
              >
                <div className="flex items-center gap-1">
                  <span className="font-black text-[#003366] min-w-[44px] inline-block">
                    {row.shortLabel}:
                  </span>
                  <span
                    className={`px-1 py-0.1 rounded font-black text-[8.5px] ${
                      row.isPositive
                        ? 'bg-emerald-600 text-white'
                        : 'bg-rose-600 text-white'
                    }`}
                  >
                    {row.status}
                  </span>
                </div>

                <div className="flex items-center gap-1 font-mono text-[8.5px]" dir="ltr">
                  {row.date && (
                    <span className="text-slate-700 font-bold">{row.date.slice(5)}</span>
                  )}
                  {row.email && (
                    <span className="text-[#003366] bg-blue-50 px-1 rounded border border-blue-200 truncate max-w-[75px]">
                      {row.email.split('@')[0]}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // C2. Procedure 155 Status (حالة اجراء 155):
    // - يظهر تلقائياً (مؤهل لإجراء 155) إذا كان التدقيق مؤهل 100% في جميع أعمدة التدقيق الثلاثة
    // - قابل للتعديل من قبل أي أحد على حالة الإجراء
    // - ما عدا ذلك فارغ
    if (col.field === 'procedure155') {
      const rawVal = getEffectiveProcedure155Status(order);
      const isEmpty155 = !rawVal;
      const isPositive155 =
        !isEmpty155 &&
        !rawVal.includes('غير') &&
        (rawVal.includes('مؤهل') || rawVal.includes('تم'));
      const canEdit155 = true;
      const customOpts = (dropdownOptions.procedure155 || []).filter(
        (opt) =>
          opt !== 'مؤهل لإجراء 155' &&
          opt !== 'تم اجراء 155' &&
          opt !== 'غير مؤهل لاجراء 155'
      );
      const options = [
        'مؤهل لإجراء 155',
        'تم اجراء 155',
        'غير مؤهل لاجراء 155',
        ...customOpts,
        '— تفريغ الخلية —'
      ];

      return (
        <div className="relative inline-block w-full text-right">
          <button
            type="button"
            data-inline-dropdown-trigger="true"
            data-cell-trigger={`${order.id}-procedure155`}
            onClick={(e) => {
              e.stopPropagation();
              if (isInlineOpen) {
                setOpenInlineDropdown(null);
                return;
              }
              const rect = e.currentTarget.getBoundingClientRect();
              const spaceBelow = window.innerHeight - rect.bottom;
              const openUpward = spaceBelow < 230 && rect.top > 230;

              setOpenInlineDropdown({
                orderId: order.id,
                field: 'procedure155',
                colTitle: 'حالة اجراء 155',
                displayVal: rawVal,
                options,
                rect: {
                  top: rect.top,
                  bottom: rect.bottom,
                  left: rect.left,
                  right: rect.right,
                  width: rect.width,
                  height: rect.height
                },
                openUpward
              });
            }}
            style={{
              fontFamily: cs.fontFamily,
              fontSize: `${cs.fontSize}px`,
              fontWeight: cs.bold ? 900 : 600,
              fontStyle: cs.italic ? 'italic' : 'normal',
              textDecoration: cs.textDecoration
            }}
            className={`w-full min-h-[28px] flex items-center justify-between gap-1.5 px-2 py-1 rounded-lg transition-all border group cursor-pointer ${
              isInlineOpen ? 'ring-2 ring-indigo-500 scale-[1.02]' : ''
            } ${
              isEmpty155
                ? 'bg-transparent hover:bg-slate-100/80 text-slate-500 border-transparent hover:border-slate-300'
                : isPositive155
                ? 'bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white border-emerald-500 ring-1 ring-emerald-400 shadow-2xs'
                : 'bg-rose-600 hover:bg-rose-700 text-white border-rose-500 ring-1 ring-rose-400 shadow-2xs'
            }`}
            title={
              rawVal
                ? `حالة إجراء 155: ${rawVal} (انقر للتعديل)`
                : 'انقر لتحديد أو تعديل حالة إجراء 155 (تظهر تلقائياً "مؤهل لإجراء 155" عند تأهل جميع أعمدة التدقيق بنسبة 100%)'
            }
          >
            {isEmpty155 ? (
              <div className="flex items-center justify-between w-full min-h-[20px]">
                <span className="flex-1" />
                {canEdit155 && (
                  <ChevronDown className={`w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 shrink-0 transition-all ${isInlineOpen ? 'opacity-100 rotate-180' : ''}`} />
                )}
              </div>
            ) : (
              <>
                <div className={`flex items-center gap-1 flex-1 min-w-0 ${
                  cs.textAlign === 'center' ? 'justify-center' : cs.textAlign === 'left' ? 'justify-start' : 'justify-end'
                } ${isWrapTextEnabled ? 'whitespace-normal break-words' : 'truncate'}`}>
                  {isPositive155 ? (
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-200" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-200" />
                  )}
                  <span className={isWrapTextEnabled ? 'break-words whitespace-normal' : 'truncate'} style={{ textDecoration: cs.textDecoration }}>
                    {rawVal}
                  </span>
                </div>
                {canEdit155 && (
                  <ChevronDown className={`w-3 h-3 opacity-70 group-hover:opacity-100 shrink-0 transition-transform ${isInlineOpen ? 'rotate-180' : ''}`} />
                )}
              </>
            )}
          </button>
        </div>
      );
    }

    // C3. Procedure Sync Time (مزامنة الاجراء: فارغ افتراضياً لحين اعتماد أو تعديل إجراء 155)
    if (col.field === 'procedureSyncTime') {
      const pSyncVal = order.procedureSyncTime || stringValue;
      const rawEmail = order.procedureSyncEmail || (pSyncVal && pSyncVal.includes('|') ? pSyncVal.split('|')[1]?.trim() : '');
      const displayTime = pSyncVal && pSyncVal.includes('|') ? pSyncVal.split('|')[0]?.trim() : pSyncVal;
      const hasValue = Boolean(displayTime && displayTime !== '-' && displayTime !== 'قيد المزامنة');

      if (!hasValue) {
        return <div className="min-h-[26px] w-full" />;
      }

      const copyVal = `${displayTime}${rawEmail ? ` | ${rawEmail}` : ''}`.trim();

      return (
        <div 
          onClick={(e) => handleCopy(copyVal, cellKey, e)}
          className="flex flex-col gap-1 group/cell cursor-pointer p-1.5 rounded-lg bg-blue-50/80 hover:bg-blue-100/90 border-2 border-blue-300 text-right transition-all shadow-2xs"
          title={`وقت وتاريخ مزامنة إجراء 155: ${displayTime}\nايميل المستخدم الذي قام بالتحديث: ${rawEmail || 'غير مسجل'}\n(انقر لنسخ كافة البيانات)`}
        >
          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-1 min-w-0">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shrink-0" />
              <Clock className="w-3.5 h-3.5 text-blue-800 shrink-0" />
              <span className="text-[11px] font-black text-blue-950 font-mono tracking-tight select-all">
                {displayTime}
              </span>
            </div>
            <button
              type="button"
              onClick={(e) => handleCopy(copyVal, cellKey, e)}
              className="p-0.5 rounded text-blue-700 hover:bg-blue-200 transition-colors opacity-0 group-hover/cell:opacity-100 shrink-0"
              title="نسخ بيانات التحديث"
            >
              {isCopied ? <Check className="w-3 h-3 text-blue-800" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>
          {rawEmail && (
            <div className="flex items-center gap-1 text-[10px] font-bold text-blue-950 bg-blue-200/60 px-1.5 py-0.5 rounded border border-blue-300/80 font-mono select-all truncate" dir="ltr">
              <Mail className="w-2.5 h-2.5 text-blue-800 shrink-0" />
              <span className="truncate">{rawEmail}</span>
            </div>
          )}
        </div>
      );
    }

    // D. Work Order Number - Click to Copy & Inline Edit for Authorized Users
    if (col.field === 'workOrderNumber') {
      const isDup = duplicateOrderIds.has(order.id);
      const isAllowedToEdit = canUserEditColumn(currentUser, 'workOrderNumber');
      const isEditingThis = editingTextCell?.orderId === order.id && editingTextCell?.field === 'workOrderNumber';

      if (isEditingThis) {
        return (
          <div className="flex items-center gap-1 w-full" onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              value={editingTextCell.value}
              onChange={(e) => setEditingTextCell({ ...editingTextCell, value: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const val = editingTextCell.value.trim();
                  if (val) {
                    handleDirectCellUpdate(order, 'workOrderNumber', val);
                  }
                  setEditingTextCell(null);
                } else if (e.key === 'Escape') {
                  setEditingTextCell(null);
                }
              }}
              className="w-full text-xs font-mono font-bold px-2 py-1 rounded-lg border-2 border-blue-500 bg-white text-slate-900 focus:outline-none shadow-xs"
              autoFocus
            />
            <button
              type="button"
              onClick={() => {
                const val = editingTextCell.value.trim();
                if (val) {
                  handleDirectCellUpdate(order, 'workOrderNumber', val);
                }
                setEditingTextCell(null);
              }}
              className="p-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs shrink-0"
              title="حفظ"
            >
              <Check className="w-3.5 h-3.5 stroke-[3]" />
            </button>
            <button
              type="button"
              onClick={() => setEditingTextCell(null)}
              className="p-1 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 cursor-pointer shrink-0"
              title="إلغاء"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      }

      return (
        <div 
          onClick={(e) => {
            if (isAllowedToEdit) {
              setEditingTextCell({ orderId: order.id, field: 'workOrderNumber', value: stringValue });
            } else {
              handleCopy(stringValue, cellKey, e);
            }
          }}
          className="flex items-center justify-between gap-1.5 group/cell cursor-pointer"
          title={
            isAllowedToEdit
              ? "انقر للتعديل المباشر أو انقر أيقونة النسخ"
              : isDup
              ? `صف مكرر: يتطابق (رقم أمر العمل: ${stringValue}) و (رمز أمر العمل: ${order.workOrderCode}) مع صف آخر في الجدول`
              : "انقر لنسخ رقم أمر العمل"
          }
        >
          <div className={`flex items-center gap-1.5 flex-wrap flex-1 ${
            cs.textAlign === 'center' ? 'justify-center' : cs.textAlign === 'left' ? 'justify-start' : 'justify-end'
          }`}>
            <span
              style={cellInlineTextStyle}
              className={`font-mono px-2 py-0.5 rounded border select-all bg-blue-50 text-blue-800 border-blue-200 shadow-2xs ${cs.bold ? 'font-black' : 'font-semibold'} ${cs.italic ? 'italic' : ''}`}
            >
              {stringValue}
            </span>
            {isDup && (
              <span className="px-1.5 py-0.5 rounded bg-rose-600 text-white font-black text-[10px] flex items-center gap-1 shadow-2xs shrink-0 animate-pulse">
                <AlertTriangle className="w-2.5 h-2.5" />
                <span>مكرر</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {isAllowedToEdit && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingTextCell({ orderId: order.id, field: 'workOrderNumber', value: stringValue });
                }}
                className="p-1 rounded-md text-blue-600 hover:text-blue-800 hover:bg-blue-50 transition-colors opacity-0 group-hover/cell:opacity-100 shrink-0 cursor-pointer"
                title="تعديل رقم أمر العمل مباشرة"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={(e) => handleCopy(stringValue, cellKey, e)}
              className="p-1 rounded-md transition-colors opacity-0 group-hover/cell:opacity-100 shrink-0 text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              title="نسخ رقم أمر العمل"
            >
              {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      );
    }

    // E. Work Order Code (نوع أمر العمل) - Plain Text Cell (No dropdown, no default numbers)
    if (col.field === 'workOrderCode') {
      const isDup = duplicateOrderIds.has(order.id);
      const isAllowedToEdit = canUserEditColumn(currentUser, 'workOrderCode');
      const isEditingThis = editingTextCell?.orderId === order.id && editingTextCell?.field === 'workOrderCode';

      if (isEditingThis) {
        return (
          <div className="flex items-center gap-1 w-full" onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              value={editingTextCell.value}
              onChange={(e) => setEditingTextCell({ ...editingTextCell, value: e.target.value })}
              placeholder="نوع أمر العمل..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const val = editingTextCell.value.trim();
                  handleDirectCellUpdate(order, 'workOrderCode', val);
                  setEditingTextCell(null);
                } else if (e.key === 'Escape') {
                  setEditingTextCell(null);
                }
              }}
              className="w-full text-xs font-bold px-2 py-1 rounded-lg border-2 border-blue-500 bg-white text-slate-900 focus:outline-none shadow-xs"
              autoFocus
            />
            <button
              type="button"
              onClick={() => {
                const val = editingTextCell.value.trim();
                handleDirectCellUpdate(order, 'workOrderCode', val);
                setEditingTextCell(null);
              }}
              className="p-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs shrink-0"
              title="حفظ"
            >
              <Check className="w-3.5 h-3.5 stroke-[3]" />
            </button>
            <button
              type="button"
              onClick={() => setEditingTextCell(null)}
              className="p-1 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 cursor-pointer shrink-0"
              title="إلغاء"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      }

      return (
        <div 
          onClick={(e) => {
            if (isAllowedToEdit) {
              setEditingTextCell({ orderId: order.id, field: 'workOrderCode', value: stringValue });
            } else if (stringValue) {
              handleCopy(stringValue, cellKey, e);
            }
          }}
          className="flex items-center justify-between gap-1 group/cell cursor-pointer min-h-[28px]"
          title={
            isAllowedToEdit
              ? "انقر لإدخال أو تعديل نوع أمر العمل مباشرة"
              : isDup
              ? `صف مكرر: يتطابق (رقم أمر العمل: ${order.workOrderNumber}) و (نوع أمر العمل: ${stringValue}) مع صف آخر في الجدول`
              : stringValue
              ? "انقر لنسخ نوع أمر العمل"
              : ""
          }
        >
          <div className={`flex items-center gap-1.5 flex-wrap flex-1 ${
            cs.textAlign === 'center' ? 'justify-center' : cs.textAlign === 'left' ? 'justify-start' : 'justify-end'
          }`}>
            {stringValue ? (
              <span
                style={cellInlineTextStyle}
                className={`select-all text-slate-900 ${cs.bold ? 'font-black' : 'font-semibold'} ${cs.italic ? 'italic' : ''}`}
              >
                {stringValue}
              </span>
            ) : (
              isAllowedToEdit && (
                <span className="text-[10px] text-slate-400 opacity-0 group-hover/cell:opacity-100 transition-opacity">
                  انقر للإدخال...
                </span>
              )
            )}
            {isDup && (
              <span className="px-1.5 py-0.5 rounded bg-amber-500 text-white font-black text-[9px] shrink-0 shadow-2xs">
                مكرر
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {isAllowedToEdit && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingTextCell({ orderId: order.id, field: 'workOrderCode', value: stringValue });
                }}
                className="p-1 rounded-md text-blue-600 hover:text-blue-800 hover:bg-blue-50 transition-colors opacity-0 group-hover/cell:opacity-100 shrink-0 cursor-pointer"
                title="تعديل نوع أمر العمل مباشرة"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
            )}
            {stringValue && (
              <button
                type="button"
                onClick={(e) => handleCopy(stringValue, cellKey, e)}
                className="p-1 rounded-md transition-colors opacity-0 group-hover/cell:opacity-100 shrink-0 text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                title="نسخ"
              >
                {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
        </div>
      );
    }

    // G. Photos Coordination column
    if (col.field === 'photoCoordination' || col.field === 'photos') {
      const statement = order.photoCoordination || (order.photos && order.photos.length > 0 && order.photos.some(p => p.caption?.includes('ملاحظة')) ? 'مرفق صورة كملاحظة' : 'لا توجد صور مطلوبة');
      const isNotePhoto = Boolean(
        order.photos && 
        order.photos.length > 0 && 
        (
          statement === 'مرفق صورة كملاحظة' || 
          statement.includes('كملاحظة') || 
          order.photos.some(p => p.caption && p.caption.includes('ملاحظة'))
        )
      );

      let badgeStyle = 'bg-slate-100 text-slate-900 border-slate-300 font-bold';
      if (statement.includes('مكتمل') || statement.includes('تم إرفاق')) {
        badgeStyle = 'bg-emerald-50 text-emerald-900 border-emerald-300 font-bold';
      } else if (statement.includes('مرفق صورة كملاحظة') || statement.includes('ملاحظات')) {
        badgeStyle = 'bg-amber-50 text-amber-900 border-amber-300 font-bold';
      } else if (statement.includes('بانتظار')) {
        badgeStyle = 'bg-blue-50 text-blue-900 border-blue-300 font-bold';
      } else if (statement.includes('غير مطابق')) {
        badgeStyle = 'bg-rose-50 text-rose-900 border-rose-300 font-bold';
      }

      return (
        <div 
          onClick={(e) => handleCopy(statement, cellKey, e)}
          className="flex items-center justify-between gap-1.5 group/cell cursor-pointer"
          title="انقر لنسخ البيان"
        >
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border ${badgeStyle}`}>
              {statement}
            </span>

            {isNotePhoto && order.photos && order.photos.length > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onCheckPermission && !onCheckPermission('viewPhotos', 'استعراض الصور والمرفقات')) {
                    return;
                  }
                  onViewPhotos(order);
                }}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 text-[10px] font-black transition-all shadow-2xs group/note"
                title="مرفق صورة كملاحظة - انقر للمعاينة والتكبير"
              >
                {order.photos[0]?.url ? (
                  <img
                    src={order.photos[0].url}
                    alt="صورة كملاحظة"
                    className="w-4 h-4 rounded object-cover border border-amber-400 shrink-0"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <Camera className="w-3 h-3 text-amber-700" />
                )}
                <span>صورة ملاحظة ({order.photos.length})</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={(e) => handleCopy(statement, cellKey, e)}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors opacity-0 group-hover/cell:opacity-100 shrink-0"
            title="نسخ نص البيان"
          >
            {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      );
    }

    // H. General text cell & Custom Columns - Direct Inline Edit for Authorized Users, Copy for Read-Only
    const isAllowedToEdit = canUserEditColumn(currentUser, col.field);
    const isEditingThis = editingTextCell?.orderId === order.id && editingTextCell?.field === col.field;

    if (isEditingThis) {
      return (
        <div className="flex items-center gap-1 w-full" onClick={(e) => e.stopPropagation()}>
          <input
            type="text"
            value={editingTextCell.value}
            onChange={(e) => setEditingTextCell({ ...editingTextCell, value: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const val = editingTextCell.value.trim();
                handleDirectCellUpdate(order, col.field, val);
                setEditingTextCell(null);
              } else if (e.key === 'Escape') {
                setEditingTextCell(null);
              }
            }}
            className="w-full text-xs font-bold px-2 py-1 rounded-lg border-2 border-blue-500 bg-white text-slate-900 focus:outline-none shadow-xs"
            autoFocus
          />
          <button
            type="button"
            onClick={() => {
              const val = editingTextCell.value.trim();
              handleDirectCellUpdate(order, col.field, val);
              setEditingTextCell(null);
            }}
            className="p-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs shrink-0"
            title="حفظ"
          >
            <Check className="w-3.5 h-3.5 stroke-[3]" />
          </button>
          <button
            type="button"
            onClick={() => setEditingTextCell(null)}
            className="p-1 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 cursor-pointer shrink-0"
            title="إلغاء"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      );
    }

    // Dynamic Excel 365 number formatting (General, Number, Percent, Currency)
    let displayString = stringValue;
    if (stringValue && tableNumberFormat !== 'general') {
      const trimmed = stringValue.trim();
      const cleanNumStr = trimmed.replace(/[^0-9.-]/g, '');
      const numVal = parseFloat(cleanNumStr);
      if (!isNaN(numVal) && cleanNumStr.length > 0 && /^[0-9.,\s%ر.سSAR-]+$/.test(trimmed)) {
        if (tableNumberFormat === 'number') {
          displayString = numVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        } else if (tableNumberFormat === 'percent') {
          displayString = `${(numVal <= 1 && numVal > 0 ? numVal * 100 : numVal).toFixed(1)}%`;
        } else if (tableNumberFormat === 'currency') {
          displayString = `${numVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س`;
        }
      }
    }

    return (
      <div 
        onClick={(e) => {
          if (isAllowedToEdit) {
            setEditingTextCell({ orderId: order.id, field: col.field, value: stringValue });
          } else {
            handleCopy(stringValue, cellKey, e);
          }
        }}
        className={`flex items-center ${
          cs.textAlign === 'center' ? 'justify-center text-center' : cs.textAlign === 'left' ? 'justify-start text-left' : 'justify-end text-right'
        } gap-1.5 group/cell cursor-pointer py-0.5 w-full`}
        title={
          isAllowedToEdit
            ? `انقر لتعديل (${col.title}) مباشرة أو انقر أيقونة النسخ`
            : "انقر لنسخ النص كاملاً"
        }
      >
        <span 
          style={cellInlineTextStyle}
          className={`select-all leading-relaxed ${
            cs.textColor ? '' : 'text-slate-900'
          } ${
            cs.bold ? 'font-black' : 'font-semibold'
          } ${cs.italic ? 'italic' : ''} ${cs.underline ? 'underline' : ''} ${cs.strikethrough ? 'line-through' : ''} ${
            cs.textAlign === 'center' ? 'text-center' : cs.textAlign === 'left' ? 'text-left' : 'text-right'
          } ${
            isWrapTextEnabled ? 'break-words whitespace-normal' : 'truncate max-w-[240px] whitespace-nowrap'
          }`} 
          title={displayString}
        >
          {displayString || <span className="text-slate-400 text-xs font-bold italic">(فارغ)</span>}
        </span>
        <div className="flex items-center gap-1 shrink-0 mt-0.5">
          {isAllowedToEdit && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setEditingTextCell({ orderId: order.id, field: col.field, value: stringValue });
              }}
              className="p-1 rounded-md text-blue-600 hover:text-blue-800 hover:bg-blue-50 transition-colors opacity-0 group-hover/cell:opacity-100 shrink-0 cursor-pointer"
              title={`تعديل ${col.title} مباشرة`}
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={(e) => handleCopy(stringValue, cellKey, e)}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors opacity-0 group-hover/cell:opacity-100 shrink-0"
            title="نسخ محتوى الخلية"
          >
            {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    );
  };

  const tableInnerContent = (
    <div className={`${
      isERP
        ? 'bg-white rounded-xl border border-[#CBD5E1] shadow-sm'
        : isPro
        ? 'bg-white rounded-2xl border border-[#002855]/20 shadow-[0_14px_40px_-12px_rgba(0,40,85,0.12)]'
        : 'bg-white rounded-2xl border-2 border-[#002855]/30 shadow-md'
    } flex flex-col flex-1 min-h-0 text-right ${internalPresentationMode === 'overlay' ? 'max-h-[92vh] overflow-y-auto' : 'h-full mb-0'}`}>
      
      {/* Dynamic Corporate Table Header & Live Audit Counters (قوائم التدقيق على أوامر العمل) */}
      <div className="px-3.5 py-2.5 sm:px-5 text-white flex flex-col xl:flex-row xl:items-center xl:justify-between gap-2.5 bg-gradient-to-l from-[#001D40] via-[#002855] to-[#004B8D] border-b-2 border-[#F58220] shadow-sm">
        <div className="min-w-0 flex items-center gap-2.5 flex-wrap">
          <div className="w-8 h-8 rounded-xl bg-[#F58220] text-white flex items-center justify-center shadow-xs shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xs sm:text-sm font-black text-white tracking-tight flex items-center gap-2 flex-wrap">
                <span>قوائم التدقيق على أوامر العمل{officeTitle && officeTitle !== 'جميع المكاتب الفرعية' ? ` • ${officeTitle}` : ''}</span>
              </h2>
              {activeYear && activeMonth && (
                <span className="px-2 py-0.5 rounded-lg text-[10.5px] font-black bg-white/15 text-[#FDB813] border border-white/20">
                  {activeMonth === 'all' ? `كافة شهور ${activeYear}` : `شهر ${getArabicMonthName(activeMonth)} ${activeYear}`}
                </span>
              )}
              {activeTableName && (
                <span className="px-2.5 py-0.5 rounded-lg text-[10.5px] font-black flex items-center gap-1.5 bg-emerald-500/20 text-emerald-200 border border-emerald-400/40">
                  {filteredOrders.some(w => w.isNew && !w.isEdited) && (
                    <span className="px-1.5 py-0.5 rounded-md text-[9.5px] font-black bg-emerald-500 text-white shadow-xs">
                      جديد
                    </span>
                  )}
                  <span>{activeTableName}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Live Dynamic Audit Metrics Strip + Mode Switch on Header Left */}
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
          {/* إجمالي المعروض */}
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/10 border border-white/20 text-[11px] font-black text-white">
            <span className="text-blue-200">الأسطر:</span>
            <span className="font-mono text-[#FDB813] tabular-nums">{filteredOrders.length} / {orders.length}</span>
          </div>

          {/* مؤهل 155 */}
          <button
            type="button"
            onClick={() => setSmartQuickFilter(smartQuickFilter === 'ready155' ? 'all' : 'ready155')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-[11px] font-black transition-all cursor-pointer ${
              smartQuickFilter === 'ready155'
                ? 'bg-emerald-600 text-white border-emerald-300 shadow-xs'
                : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border-emerald-400/35'
            }`}
            title="انقر لتصفية الأوامر المؤهلة والمعتمدة في إجراء 155"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
            <span>مؤهل 155:</span>
            <span className="font-mono tabular-nums">{readyOrdersCount}</span>
            <span className="px-1.5 py-0.2 rounded bg-emerald-950/60 text-emerald-300 font-mono text-[10px]">
              {overallReadyRate}%
            </span>
          </button>

          {/* شارة أعمدة التدقيق الثلاثة باللون الأحمر الغامق */}
          <div
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#7F1D1D] text-white border border-red-400/50 text-[10.5px] font-black shadow-2xs"
            title="أعمدة التدقيق الثلاثة المعتمدة (9. تدقيق PDC • 10. تدقيق الإنشاءات • 11. تدقيق المساندة الفنية) مميزة باللون الأحمر الغامق والكتابة البيضاء"
          >
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <span>أعمدة التدقيق الثلاثة (9 • 10 • 11)</span>
          </div>

          <button
            type="button"
            onClick={() => {
              const nextMode = internalPresentationMode === 'overlay' ? 'docked' : 'overlay';
              setInternalPresentationMode(nextMode);
              if (onChangePresentationMode) onChangePresentationMode(nextMode);
            }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl font-black text-[11px] bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all cursor-pointer active:scale-95"
            title={internalPresentationMode === 'overlay' ? 'تثبيت الجدول في الشاشة الرئيسية' : 'عرض الجدول في بطاقة تظهر مستقلة فوق الصفحة الرئيسية'}
          >
            {internalPresentationMode === 'overlay' ? (
              <>
                <Minimize2 className="w-3.5 h-3.5 text-[#FDB813]" />
                <span>تثبيت بالشاشة</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5 text-[#FDB813]" />
                <span>بطاقة مستقلة</span>
              </>
            )}
          </button>

          {(onCloseTable || internalPresentationMode === 'overlay') && (
            <button
              type="button"
              onClick={() => {
                if (internalPresentationMode === 'overlay') {
                  setInternalPresentationMode('docked');
                  if (onChangePresentationMode) onChangePresentationMode('docked');
                } else if (onCloseTable) {
                  onCloseTable();
                }
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-[11px] border border-rose-400/50 transition-all cursor-pointer active:scale-95 shadow-2xs"
              title={internalPresentationMode === 'overlay' ? 'إغلاق العرض المستقل والعودة للشاشة' : 'إغلاق وطي بطاقة الجدول'}
            >
              <X className="w-3.5 h-3.5" />
              <span>{internalPresentationMode === 'overlay' ? 'إغلاق البطاقة' : 'إغلاق'}</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Unified Intelligent Table Tools in ONE Single Row Above the Table (أدوات الجدول المجمعة في صف واحد احترافي) */}
      <TableSmartToolbar
        totalOrdersCount={orders.length}
        filteredOrdersCount={filteredOrders.length}
        ready155Count={readyOrdersCount}
        selectedOrderIdsCount={selectedOrderIds.size}
        crossTableMatchesCount={crossTableMatchesCount}
        newRowsCount={newRowsCount}
        duplicateRowsCount={totalDuplicateRowsCount}
        unmodifiedRowsCount={nonEditedRowsCount}
        editedRowsCount={editedOrdersCount}
        withPhotosCount={withPhotosCount}
        withoutPhotosCount={withoutPhotosCount}
        importedRowsCount={importedRowsCount}
        selectedOrder={selectedOrder || filteredOrders[0] || orders[0] || null}
        overallReadyRate={overallReadyRate}
        columnsCount={columns.length}
        searchText={tableSearchText}
        onSearchChange={setTableSearchText}
        smartQuickFilter={smartQuickFilter}
        onSelectQuickFilter={(mode) => {
          setSmartQuickFilter(mode);
          if (mode === 'cross_table_match') {
            setExportNotification(`تم تصفية وعرض الأسطر المتوافقة مع جداول أخرى (${crossTableMatchesCount} سطر)`);
          } else if (mode === 'imported') {
            setExportNotification(`تم تصفية وعرض الأسطر المستوردة المتوافقة (${importedRowsCount} سطر)`);
          } else if (mode === 'all') {
            setExportNotification('تم عرض كافة أسطر الجدول');
          }
          setTimeout(() => setExportNotification(null), 3000);
        }}
        activeColumnFiltersCount={activeFiltersCount}
        onClearAllColumnFilters={handleClearAllFilters}
        onOpenAddModal={() => {
          if (onCheckPermission && !onCheckPermission('addWorkOrder', 'إضافة أمر عمل جديد')) return;
          onOpenAddModal();
        }}
        onOpenImportModal={onOpenImportModal ? () => {
          if (onCheckPermission && !onCheckPermission('importExcel', 'استيراد بيانات من Excel')) return;
          onOpenImportModal();
        } : undefined}
        onOpenCompatibleImport={onOpenCompatibleImport ? () => {
          if (onCheckPermission && !onCheckPermission('importExcel', 'استيراد من الجداول المتوافقة بدلالة الأعمدة')) return;
          onOpenCompatibleImport();
        } : undefined}
        onOpenEditStatus={() => {
          const targetOrd = (selectedOrderId ? orders.find(o => o.id === selectedOrderId) : null) || selectedOrder || filteredOrders[0] || orders[0];
          if (targetOrd) handleNavigateAndEditOrder(targetOrd);
        }}
        onOpenEditBasicData={onEditBasicData ? () => {
          const targetOrd = (selectedOrderId ? orders.find(o => o.id === selectedOrderId) : null) || selectedOrder || filteredOrders[0] || orders[0];
          if (targetOrd) onEditBasicData(targetOrd);
        } : undefined}
        onOpenSmartAudit={onAudit155 ? () => {
          const targetOrd = (selectedOrderId ? orders.find(o => o.id === selectedOrderId) : null) || selectedOrder || filteredOrders[0] || orders[0];
          if (targetOrd) onAudit155(targetOrd);
        } : undefined}
        onOpenYearMonthPicker={onOpenYearMonthPicker}

        onBulkApprove155={handleBulkApprove155}
        onOpenColumnManager={onOpenColumnManager ? () => {
          if (onCheckPermission && !onCheckPermission('manageColumns', 'إدارة وتخصيص الأعمدة')) return;
          onOpenColumnManager();
        } : undefined}
        onOpenDropdownManager={onOpenDropdownManager ? () => {
          if (onCheckPermission && !onCheckPermission('manageDropdowns', 'إدارة القوائم المنسدلة')) return;
          onOpenDropdownManager();
        } : undefined}
        onDeleteSelectedOrders={selectedOrderIds.size > 0 ? () => {
          if (onCheckPermission && !onCheckPermission('deleteWorkOrder', 'حذف أوامر العمل المحددة')) return;
          setDeleteConfirmTarget({
            type: 'batch',
            ids: Array.from(selectedOrderIds),
            title: 'حذف الأوامر المحددة',
            message: `هل أنت متأكد من مسح وحذف (${selectedOrderIds.size}) أمر عمل محدد نهائياً من قاعدة البيانات والمنظومة؟`
          });
        } : undefined}
        onDeleteSingleOrder={() => {
          if (onCheckPermission && !onCheckPermission('deleteWorkOrder', 'حذف أمر عمل')) return;
          const targetOrder = selectedOrder || filteredOrders[0] || orders[0];
          if (!targetOrder) return;
          setDeleteConfirmTarget({
            type: 'selected',
            order: targetOrder,
            title: 'حذف أمر العمل',
            message: `هل أنت متأكد من حذف أمر العمل (${targetOrder.workOrderNumber}) نهائياً؟`
          });
        }}
        onOpenDeleteTableModal={() => {
          if (onCheckPermission && !onCheckPermission('deleteMonthTable', 'حذف ومسح بيانات الجدول')) return;
          setIsDeleteModalOpen(true);
        }}
        onOpenDataRecovery={onOpenDataRecovery ? () => {
          if (onCheckPermission && !onCheckPermission('restoreDeleted', 'مركز الأمان واستعادة النسخ الاحتياطية')) return;
          onOpenDataRecovery();
        } : undefined}
        exportScope={exportScope}
        onSetExportScope={setExportScope}
        onOpenComprehensiveExportModal={(openEmail) => {
          if (onCheckPermission && !onCheckPermission('exportTable', 'تصدير الجدول والتقارير')) return;
          if (onOpenExportModal) {
            onOpenExportModal(ordersToExport, exportTitleText, openEmail);
          }
        }}
        onDirectExportExcel={() => {
          exportToExcel(
            ordersToExport,
            exportTitleText,
            `سجل_أوامر_العمل_${exportTitleText.replace(/\s+/g, '_')}_${Date.now()}.xlsx`,
            columns
          );
          setExportNotification(`تم تصدير (${ordersToExport.length}) صف فورياً إلى Excel (RTL)`);
          setTimeout(() => setExportNotification(null), 3500);
        }}
        onDirectExportPdf={async () => {
          setIsDirectExportingPdf(true);
          setExportNotification(`جارٍ تجهيز ملف PDF المعتمد لـ (${ordersToExport.length}) صف...`);
          try {
            await exportOrdersDirectToPdf(ordersToExport, exportTitleText, undefined, columns);
            setExportNotification(`تم تصدير (${ordersToExport.length}) صف فورياً إلى PDF معتمد`);
          } catch (err: any) {
            setExportNotification(err?.message || 'حدث خطأ أثناء تصدير ملف PDF');
          } finally {
            setIsDirectExportingPdf(false);
            setTimeout(() => setExportNotification(null), 3500);
          }
        }}
        onDirectExportPptx={() => {
          exportToPptx(
            ordersToExport,
            exportTitleText,
            `عرض_أوامر_العمل_${exportTitleText.replace(/\s+/g, '_')}_${Date.now()}.pptx`,
            columns
          );
          setExportNotification(`تم تصدير (${ordersToExport.length}) صف فورياً إلى عرض PowerPoint`);
          setTimeout(() => setExportNotification(null), 3500);
        }}
        onDirectExportImage={async () => {
          setIsDirectExportingImage(true);
          setExportNotification(`جارٍ التقاط صورة عالية الدقة لـ (${ordersToExport.length}) صف...`);
          try {
            await exportOrdersDirectToImage(ordersToExport, exportTitleText, undefined, columns);
            setExportNotification(`تم تصدير (${ordersToExport.length}) صف كصورة عالية الدقة بنجاح`);
          } catch (err: any) {
            setExportNotification(err?.message || 'حدث خطأ أثناء تصدير الصورة');
          } finally {
            setIsDirectExportingImage(false);
            setTimeout(() => setExportNotification(null), 3500);
          }
        }}
        onDirectExportCsv={() => {
          exportToCsv(
            ordersToExport,
            exportTitleText,
            `سجل_أوامر_العمل_${exportTitleText.replace(/\s+/g, '_')}_${Date.now()}.csv`,
            columns
          );
          setExportNotification(`تم تصدير (${ordersToExport.length}) صف فورياً إلى ملف CSV`);
          setTimeout(() => setExportNotification(null), 3500);
        }}
        onInstantPrint={() => {
          if (onOpenExportModal) {
            onOpenExportModal(ordersToExport, exportTitleText);
            setTimeout(() => window.print(), 600);
          } else {
            window.print();
          }
        }}
        isExportingPdf={isDirectExportingPdf}
        isExportingImage={isDirectExportingImage}
        presentationMode={internalPresentationMode}
        onTogglePresentationMode={() => {
          const next = internalPresentationMode === 'overlay' ? 'docked' : 'overlay';
          setInternalPresentationMode(next);
          if (onChangePresentationMode) onChangePresentationMode(next);
        }}
        onCloseTable={() => {
          if (internalPresentationMode === 'overlay') {
            setInternalPresentationMode('docked');
            if (onChangePresentationMode) onChangePresentationMode('docked');
          } else if (onCloseTable) {
            onCloseTable();
          }
        }}
        onOpenNotesReport={handleOpenNotesReport}
        contractorsList={contractorsList}
        currentUser={currentUser}
        zoomPercent={zoomPercent}
        onZoomIn={() => setZoomPercent(prev => Math.min(140, prev + 10))}
        onZoomOut={() => setZoomPercent(prev => Math.max(70, prev - 10))}
        onZoomReset={() => setZoomPercent(100)}
        onAutoFitAll={handleAutoFitAll}
        isAutoFitToScreen={isAutoFitToScreen}
        onToggleAutoFitToScreen={() => setIsAutoFitToScreen(prev => !prev)}
        isFullyExpanded={isFullyExpanded}
        onToggleFullyExpanded={() => setIsFullyExpanded(prev => !prev)}
        isStickyCoreColumns={isStickyCoreColumns}
        onToggleStickyCoreColumns={() => setIsStickyCoreColumns(prev => !prev)}
        isWrapTextEnabled={isWrapTextEnabled}
        onToggleWrapText={() => setIsWrapTextEnabled(prev => !prev)}
        tableDensity={tableDensity}
        onChangeTableDensity={setTableDensity}
        onSetRowColor={handleSetRowColor}
        onClearAllRowColors={() => {
          if (selectedOrderIds.size > 0) {
            handleSetRowColor(null);
          } else {
            setCustomRowColors({});
            try { localStorage.removeItem('sec_custom_row_colors'); } catch (_) {}
            setExportNotification('تم مسح كافة ألوان خلفيات الصفوف');
            setTimeout(() => setExportNotification(null), 3000);
          }
        }}
        hasCustomRowColors={Object.keys(customRowColors).length > 0}
      />

      {/* Export Notification Feedback Banner */}
      {exportNotification && (
        <div className="bg-emerald-500 text-white px-4 py-2 text-xs font-bold flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{exportNotification}</span>
          </div>
          <button
            type="button"
            onClick={() => setExportNotification(null)}
            className="p-1 hover:bg-emerald-600 rounded text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Active Table Data View Banner (عرض بيانات الجدول المصفاة) */}
      {isTableDataFilterActive && (
        <div className={`px-4 py-2 border-b flex flex-wrap items-center justify-between gap-2 text-xs font-bold transition-all animate-in fade-in ${
          smartQuickFilter === 'new_rows'
            ? 'bg-emerald-50 border-emerald-250 text-emerald-900'
            : smartQuickFilter === 'duplicate'
            ? 'bg-blue-50 border-blue-250 text-blue-900'
            : smartQuickFilter === 'unmodified'
            ? 'bg-teal-50 border-teal-250 text-teal-900'
            : smartQuickFilter === 'imported'
            ? 'bg-cyan-50 border-cyan-250 text-cyan-900'
            : 'bg-rose-50 border-rose-250 text-rose-900'
        }`}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1.5 text-slate-800 font-black">
              <TableProperties className="w-4 h-4 text-slate-600" />
              <span>عرض بيانات الجدول:</span>
            </span>
            <span className="px-2.5 py-1 rounded-xl bg-white/80 border border-slate-200 text-slate-800 flex items-center gap-1.5 shadow-2xs">
              {smartQuickFilter === 'new_rows' && <Sparkles className="w-3.5 h-3.5 text-emerald-600" />}
              {smartQuickFilter === 'duplicate' && <Copy className="w-3.5 h-3.5 text-blue-600" />}
              {smartQuickFilter === 'unmodified' && <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />}
              {smartQuickFilter === 'imported' && <Sparkles className="w-3.5 h-3.5 text-cyan-600" />}
              {smartQuickFilter === 'edited' && <Edit3 className="w-3.5 h-3.5 text-rose-600" />}
              <span className="font-black text-slate-900">{activeTableDataFilterLabel}</span>
              <span className="font-mono text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded text-[11px] border border-slate-200">
                {filteredOrders.length} من أصل {orders.length} سطر
              </span>
            </span>
          </div>

          {/* Mini Icons Quick Switcher directly inside active banner */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setSmartQuickFilter('new_rows')}
              className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                smartQuickFilter === 'new_rows'
                  ? 'bg-emerald-600 text-white font-black shadow-2xs'
                  : 'bg-white/70 hover:bg-white text-emerald-800 border border-emerald-200'
              }`}
              title="عرض الاسطر المضافة جديده للجدول"
            >
              <Sparkles className="w-3 h-3 text-emerald-600" />
              <span>جديدة ({newRowsCount})</span>
            </button>

            {importedRowsCount > 0 && (
              <button
                type="button"
                onClick={() => setSmartQuickFilter('imported')}
                className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                  smartQuickFilter === 'imported'
                    ? 'bg-cyan-600 text-white font-black shadow-2xs'
                    : 'bg-white/70 hover:bg-white text-cyan-800 border border-cyan-200'
                }`}
                title="عرض الاسطر المستوردة المتوافقة"
              >
                <Sparkles className="w-3 h-3 text-cyan-600" />
                <span>مستوردة ({importedRowsCount})</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setSmartQuickFilter('duplicate')}
              className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                smartQuickFilter === 'duplicate'
                  ? 'bg-blue-600 text-white font-black shadow-2xs'
                  : 'bg-white/70 hover:bg-white text-blue-800 border border-blue-200'
              }`}
              title="عرض الاسطر المكررة"
            >
              <Copy className="w-3 h-3 text-blue-600" />
              <span>مكررة ({totalDuplicateRowsCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setSmartQuickFilter('unmodified')}
              className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                smartQuickFilter === 'unmodified'
                  ? 'bg-teal-600 text-white font-black shadow-2xs'
                  : 'bg-white/70 hover:bg-white text-teal-800 border border-teal-200'
              }`}
              title="عرض الاسطر الغير معدل عليها"
            >
              <ShieldCheck className="w-3 h-3 text-teal-600" />
              <span>غير معدلة ({nonEditedRowsCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setSmartQuickFilter('edited')}
              className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                smartQuickFilter === 'edited'
                  ? 'bg-rose-700 text-white font-black shadow-2xs'
                  : 'bg-white/70 hover:bg-white text-rose-800 border border-rose-200'
              }`}
              title="عرض الاسطر المعدل عليها"
            >
              <Edit3 className="w-3 h-3 text-rose-600" />
              <span>معدلة ({editedOrdersCount})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSmartQuickFilter('all');
                setExportNotification('تم إلغاء التصفية وعرض كافة أسطر الجدول');
                setTimeout(() => setExportNotification(null), 3000);
              }}
              className="mr-2 px-2.5 py-1 rounded-lg bg-white/90 hover:bg-white text-slate-700 border border-slate-200 text-[11px] font-black flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
              title="إلغاء التصفية وعرض كامل أسطر الجدول"
            >
              <RotateCcw className="w-3 h-3" />
              <span>عرض الكل</span>
            </button>
          </div>
        </div>
      )}

      {/* Active Filters Notification Bar */}
      {activeFiltersCount > 0 && (
        <div className="bg-amber-50/80 border-b border-amber-200 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-amber-900 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-amber-600" />
              <span>فلاتر الأعمدة النشطة ({activeFiltersCount}):</span>
            </span>
            {(Object.entries(columnFilters) as [string, string[]][]).map(([field, vals]) => {
              const colDef = columns.find(c => c.field === field);
              return (
                <span 
                  key={field}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-amber-300 text-amber-900 text-xs shadow-2xs font-medium"
                >
                  <strong>{colDef?.title || field}:</strong>
                  <span>{vals.join(' أو ')}</span>
                  <button
                    type="button"
                    onClick={() => handleClearColumnFilter(field)}
                    className="p-0.5 hover:bg-amber-100 rounded-full text-amber-700"
                    title="إلغاء فلتر هذا العمود"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              );
            })}
          </div>

          <button
            type="button"
            onClick={handleClearAllFilters}
            className="inline-flex items-center gap-1 text-xs font-bold text-amber-800 hover:text-amber-950 underline"
          >
            <RotateCcw className="w-3 h-3" />
            <span>إلغاء كافة الفلاتر</span>
          </button>
        </div>
      )}

      {/* 3. Comprehensive Active Excel 365 Ribbon Toolbar Directly Connected to All Field Work Order Cells */}
      {(() => {
        const activeCellOrder = activeCell ? orders.find(o => o.id === activeCell.orderId) || null : null;
        const activeCellStyle = activeCell && activeCellOrder ? getResolvedCellStyle(activeCellOrder, activeCell.field) : null;
        const activeCellRawVal = activeCell && activeCellOrder
          ? activeCell.field === 'pdcAudit'
            ? (activeCellOrder.pdcAudit?.mainStatus || 'غير محدد')
            : activeCell.field === 'constructionAudit'
            ? (activeCellOrder.constructionAudit?.mainStatus || 'غير محدد')
            : String((activeCellOrder as any)[activeCell.field] ?? activeCellOrder.customFields?.[activeCell.field] ?? '')
          : undefined;

        const effectiveBold = activeCellStyle ? activeCellStyle.bold : isTableBold;
        const effectiveItalic = activeCellStyle ? activeCellStyle.italic : isTableItalic;
        const effectiveUnderline = activeCellStyle ? activeCellStyle.underline : isTableUnderline;
        const effectiveStrikethrough = activeCellStyle ? activeCellStyle.strikethrough : isTableStrikethrough;
        const effectiveFontSize = activeCellStyle ? activeCellStyle.fontSize : tableFontSize;
        const effectiveFontFamily = activeCellStyle ? activeCellStyle.fontFamily : tableFontFamily;
        const effectiveTextAlign = activeCellStyle ? activeCellStyle.textAlign : tableTextAlign;
        const effectiveVerticalAlign = activeCellStyle ? activeCellStyle.verticalAlign : tableVerticalAlign;

        return (
          <ExcelRibbonToolbar
            isBold={effectiveBold}
            onToggleBold={() => updateCellOrTableStyle({ bold: !effectiveBold })}
            isItalic={effectiveItalic}
            onToggleItalic={() => updateCellOrTableStyle({ italic: !effectiveItalic })}
            isUnderline={effectiveUnderline}
            onToggleUnderline={() => updateCellOrTableStyle({ underline: !effectiveUnderline })}
            isStrikethrough={effectiveStrikethrough}
            onToggleStrikethrough={() => updateCellOrTableStyle({ strikethrough: !effectiveStrikethrough })}
            fontSize={effectiveFontSize}
            onSetFontSize={(sz) => updateCellOrTableStyle({ fontSize: sz })}
            fontFamily={effectiveFontFamily}
            onSetFontFamily={(ff) => updateCellOrTableStyle({ fontFamily: ff })}
            borderStyle={tableBorderStyle}
            onSetBorderStyle={setTableBorderStyle}
            textAlign={effectiveTextAlign}
            onSetTextAlign={(al) => updateCellOrTableStyle({ textAlign: al })}
            verticalAlign={effectiveVerticalAlign}
            onSetVerticalAlign={(val) => updateCellOrTableStyle({ verticalAlign: val })}
            numberFormat={tableNumberFormat}
            onSetNumberFormat={setTableNumberFormat}
            isWrapText={isWrapTextEnabled}
            onToggleWrapText={() => setIsWrapTextEnabled(prev => !prev)}
            isAutoFitToScreen={isAutoFitToScreen}
            onToggleAutoFitToScreen={() => setIsAutoFitToScreen(prev => !prev)}
            onAutoFitAll={handleAutoFitAllColumns}
            zoomPercent={zoomPercent}
            onZoomIn={() => setZoomPercent(prev => Math.min(140, prev + 10))}
            onZoomOut={() => setZoomPercent(prev => Math.max(70, prev - 10))}
            onResetZoom={() => setZoomPercent(100)}
            onSortAsc={() => {
              const colField = activeCell?.field || columns[0]?.field || 'workOrderNumber';
              setSortConfig({ field: colField, direction: 'asc' });
            }}
            onSortDesc={() => {
              const colField = activeCell?.field || columns[0]?.field || 'workOrderNumber';
              setSortConfig({ field: colField, direction: 'desc' });
            }}
            activeFiltersCount={activeFiltersCount}
            onClearFilters={handleClearAllFilters}
            onDirectExportExcel={() => {
              exportToExcel(
                ordersToExport,
                exportTitleText,
                `سجل_أوامر_العمل_${exportTitleText.replace(/\s+/g, '_')}_${Date.now()}.xlsx`,
                columns
              );
              setExportNotification(`تم تصدير (${ordersToExport.length}) صف فورياً إلى Excel (RTL)`);
              setTimeout(() => setExportNotification(null), 3500);
            }}
            selectedOrder={activeCellOrder || selectedOrder || filteredOrders[0] || null}
            selectedOrderIdsCount={selectedOrderIds.size}
            totalOrdersCount={orders.length}
            ready155Count={readyOrdersCount}
            readyRate={overallReadyRate}
            activeCellLabel={activeCell && activeCellOrder ? `${activeCell.colTitle} • أمر (${activeCellOrder.workOrderNumber})` : null}
            activeCellValue={activeCellRawVal}
            formattingScope={formattingScope}
            onSetFormattingScope={setFormattingScope}
            onResetCellFormatting={() => {
              if (formattingScope === 'cell' && activeCell) {
                const key = `${activeCell.orderId}:::${activeCell.field}`;
                setCustomCellStyles(prev => {
                  const next = { ...prev };
                  delete next[key];
                  try {
                    localStorage.setItem('sec_custom_cell_styles', JSON.stringify(next));
                  } catch (_) {}
                  return next;
                });
                setExportNotification(`تمت إعادة ضبط تنسيق خلية (${activeCell.colTitle}) للوضع الافتراضي`);
              } else {
                setIsTableBold(true);
                setIsTableItalic(false);
                setIsTableUnderline(false);
                setIsTableStrikethrough(false);
                setTableFontSize(12);
                setTableFontFamily('Cairo');
                setTableTextAlign('center');
                setTableVerticalAlign('middle');
                setTableTextColor(null);
                setCustomCellStyles({});
                try {
                  localStorage.removeItem('sec_custom_cell_styles');
                } catch (_) {}
                setExportNotification('تمت إعادة ضبط تنسيق جميع خلايا الجدول للوضع الافتراضي');
              }
              setTimeout(() => setExportNotification(null), 3000);
            }}
            onCommitActiveCellValue={async (newVal) => {
              if (activeCell && activeCellOrder) {
                if (activeCell.field === 'pdcAudit' || activeCell.field === 'constructionAudit') {
                  const currentAudit = (activeCellOrder[activeCell.field] as WorkOrderAuditColumnData) || createEmptyAuditColumnData();
                  await handleDirectCellUpdate(activeCellOrder, activeCell.field, {
                    ...currentAudit,
                    mainStatus: (newVal === 'مؤهل' || newVal === 'غير مؤهل' || newVal === 'غير محدد') ? newVal : currentAudit.mainStatus
                  });
                } else {
                  await handleDirectCellUpdate(activeCellOrder, activeCell.field, newVal.trim());
                }
                setExportNotification(`تم تحديث قيمة خلية (${activeCell.colTitle}) لأمر العمل (${activeCellOrder.workOrderNumber}) مباشرة`);
                setTimeout(() => setExportNotification(null), 3000);
              } else {
                setExportNotification('انقر على أي خلية في الجدول أولاً لتحرير قيمتها مباشرة من شريط الأدوات');
                setTimeout(() => setExportNotification(null), 3000);
              }
            }}
            onSetRowColor={(color) => updateCellOrTableStyle({ bgColor: color })}
            onSetTextColor={(color) => updateCellOrTableStyle({ textColor: color })}
            onCopySelected={() => {
              if (activeCell && activeCellOrder && activeCellRawVal !== undefined) {
                setInternalClipboardText(activeCellRawVal);
                handleCopy(activeCellRawVal, `${activeCell.orderId}-${activeCell.field}`);
                setExportNotification(`تم نسخ محتوى خلية (${activeCell.colTitle}): "${activeCellRawVal}" للحافظة`);
                setTimeout(() => setExportNotification(null), 3000);
                return;
              }
              const target = selectedOrder || filteredOrders[0] || orders[0];
              if (target) {
                const rowData = columns.map(c => `${c.title}: ${(target as any)[c.field] ?? ''}`).join(' | ');
                setInternalClipboardText(rowData);
                handleCopy(rowData, `row-${target.id}`);
                setExportNotification(`تم نسخ بيانات أمر العمل (${target.workOrderNumber}) للحافظة`);
                setTimeout(() => setExportNotification(null), 3000);
              }
            }}
            onCutSelected={async () => {
              if (activeCell && activeCellOrder && activeCellRawVal !== undefined) {
                setInternalClipboardText(activeCellRawVal);
                handleCopy(activeCellRawVal, `${activeCell.orderId}-${activeCell.field}`);
                if (!['pdcAudit', 'constructionAudit', 'photosFile', 'statusSyncTime', 'procedureSyncTime'].includes(activeCell.field)) {
                  await handleDirectCellUpdate(activeCellOrder, activeCell.field, '');
                }
                setExportNotification(`تم قص محتوى خلية (${activeCell.colTitle}) وحفظه في الحافظة`);
                setTimeout(() => setExportNotification(null), 3000);
                return;
              }
              const target = selectedOrder || filteredOrders[0] || orders[0];
              if (target) {
                const rowData = columns.map(c => `${c.title}: ${(target as any)[c.field] ?? ''}`).join(' | ');
                setInternalClipboardText(rowData);
                handleCopy(rowData, `row-${target.id}`);
                setExportNotification(`تم قص بيانات أمر العمل (${target.workOrderNumber}) وحفظها في الحافظة`);
                setTimeout(() => setExportNotification(null), 3000);
              }
            }}
            onPasteToSelected={async () => {
              const applyPaste = async (textToPaste: string) => {
                const cleanText = textToPaste.trim();
                if (!cleanText) {
                  setExportNotification('الحافظة فارغة');
                  setTimeout(() => setExportNotification(null), 3000);
                  return;
                }
                if (activeCell && activeCellOrder) {
                  await handleDirectCellUpdate(activeCellOrder, activeCell.field, cleanText);
                  setExportNotification(`تم لصق "${cleanText}" مباشرة في خلية (${activeCell.colTitle}) لأمر العمل (${activeCellOrder.workOrderNumber})`);
                  setTimeout(() => setExportNotification(null), 3000);
                } else {
                  setExportNotification('يرجى النقر على الخلية المراد اللصق بداخلها أولاً ثم الضغط على زر (لصق)');
                  setTimeout(() => setExportNotification(null), 3000);
                }
              };

              if (navigator.clipboard && navigator.clipboard.readText) {
                navigator.clipboard.readText().then(text => {
                  applyPaste(text || internalClipboardText);
                }).catch(() => {
                  if (internalClipboardText) {
                    applyPaste(internalClipboardText);
                  } else {
                    setExportNotification('انقر على الخلية المطلوبة واستخدم النسخ/اللصق المباشر');
                    setTimeout(() => setExportNotification(null), 3000);
                  }
                });
              } else if (internalClipboardText) {
                await applyPaste(internalClipboardText);
              } else {
                setExportNotification('انقر على الخلية المطلوبة واستخدم النسخ/اللصق المباشر');
                setTimeout(() => setExportNotification(null), 3000);
              }
            }}
            onManualSync={() => {
              setExportNotification('تمت مزامنة بيانات وتنسيقات جميع خلايا الجدول والصفوف بنجاح');
              setTimeout(() => setExportNotification(null), 3000);
            }}
          />
        );
      })()}

      {/* Dynamic Side Floating Scroll Controls over Table Outer Wrapper */}
      <div className="relative w-full flex-1 min-h-0 flex flex-col group/table-outer overflow-hidden">
        {/* Floating Dynamic Scroll Controls - Right Side (تحريك لليمين وبداية الجدول) */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 z-40 flex flex-col items-center gap-1.5 p-1 rounded-2xl bg-[#002855]/90 backdrop-blur-md border border-blue-400/40 shadow-2xl transition-all opacity-85 hover:opacity-100 hover:scale-105 shadow-blue-950/40">
          <button
            type="button"
            onClick={() => handlePan('right')}
            className="p-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-all cursor-pointer active:scale-95 shadow-md"
            title="تحريك الجدول لليمين"
            aria-label="تحريك لليمين"
          >
            <ChevronRight className="w-4 h-4 text-[#FDB813] stroke-[3]" />
          </button>
          <button
            type="button"
            onClick={() => handlePan('start')}
            className="p-1.5 rounded-lg hover:bg-blue-900/80 text-blue-200 hover:text-white transition-all cursor-pointer"
            title="الانتقال إلى بداية الجدول (أقصى اليمين)"
            aria-label="بداية الجدول"
          >
            <ChevronsRight className="w-3.5 h-3.5 text-[#FDB813]" />
          </button>
        </div>

        {/* Floating Dynamic Scroll Controls - Left Side (تحريك لليسار ونهاية الجدول) */}
        <div className="absolute left-2 top-1/2 -translate-y-1/2 z-40 flex flex-col items-center gap-1.5 p-1 rounded-2xl bg-[#002855]/90 backdrop-blur-md border border-blue-400/40 shadow-2xl transition-all opacity-85 hover:opacity-100 hover:scale-105 shadow-blue-950/40">
          <button
            type="button"
            onClick={() => handlePan('left')}
            className="p-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-all cursor-pointer active:scale-95 shadow-md"
            title="تحريك الجدول لليسار"
            aria-label="تحريك لليسار"
          >
            <ChevronLeft className="w-4 h-4 text-[#FDB813] stroke-[3]" />
          </button>
          <button
            type="button"
            onClick={() => handlePan('end')}
            className="p-1.5 rounded-lg hover:bg-blue-900/80 text-blue-200 hover:text-white transition-all cursor-pointer"
            title="الانتقال إلى نهاية الجدول (أقصى اليسار)"
            aria-label="نهاية الجدول"
          >
            <ChevronsLeft className="w-3.5 h-3.5 text-[#FDB813]" />
          </button>
        </div>

        {/* Interactive Table Container with Keyboard Navigation & Visible Horizontal Scrollbar */}
        <div 
          ref={tableContainerRef}
          tabIndex={0}
          onKeyDown={handleTableKeyDown}
          className="w-full flex-1 min-h-0 relative border-b border-slate-300 shadow-2xs table-scroll-container transition-all duration-200 overflow-x-auto overflow-y-auto focus:outline-none focus:ring-1 focus:ring-blue-500/25"
          style={{ 
            scrollbarWidth: 'thin', 
            scrollbarColor: '#2563eb #f1f5f9',
            zoom: zoomPercent !== 100 ? `${zoomPercent}%` : undefined,
            fontFamily: tableFontFamily
          }}
        >
        <table className={`w-full text-right border-separate border-spacing-0 sec-bold-table border ${
          tableBorderStyle === 'none' ? 'border-transparent' : tableBorderStyle === 'box' ? 'border-2 border-[#002855]' : 'border-slate-300'
        } shadow-xs transition-all tabular-nums ${
          isAutoFitToScreen ? 'table-fixed auto-fit-table' : 'table-auto min-w-max'
        }`}
        style={{ fontSize: `${tableFontSize}px`, color: tableTextColor || undefined }}
        >
          
          {/* Strictly Sticky Corporate Header with Filter Controls for Every Column */}
          <thead className="bg-[#002855] border-b-2 border-[#F58220] text-white sticky top-0 z-30 shadow-sm select-none">
            <tr className="bg-[#002855]">
              {/* Row Sequence Column with Select All Checkbox */}
              <th 
                className={`sticky top-0 py-2.5 px-2 text-center font-black text-white text-xs shadow-xs border-b-2 border-[#F58220] border-r border-blue-800/70 bg-[#001D40] ${
                  (isStickyCoreColumns || isStickyFirstCol) ? 'sticky right-0 z-40 shadow-[3px_0_8px_rgba(0,0,0,0.22)]' : 'z-30'
                }`}
                style={{
                  top: 0,
                  right: (isStickyCoreColumns || isStickyFirstCol) ? 0 : undefined,
                  width: isStickyCoreColumns ? '52px' : (isAutoFitToScreen ? '3.5%' : undefined),
                  minWidth: isStickyCoreColumns ? '52px' : (isAutoFitToScreen ? '38px' : '75px')
                }}
              >
                <div className="flex items-center justify-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={filteredOrders.length > 0 && selectedOrderIds.size === filteredOrders.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedOrderIds(new Set(filteredOrders.map(o => o.id)));
                      } else {
                        setSelectedOrderIds(new Set());
                      }
                    }}
                    className="w-4 h-4 rounded cursor-pointer text-[#F58220] focus:ring-amber-400 accent-[#F58220]"
                    title="تحديد أو إلغاء تحديد كافة الصفوف"
                  />
                  <span className="text-[#FDB813] font-mono">#</span>
                </div>
              </th>

              {/* Dynamic Columns Headers with Individual Filter Popovers */}
              {columns.filter(col => Boolean(col && col.id && col.field)).map((col) => {
                const isFiltered = !!columnFilters[col.field]?.length;
                const isFilterOpen = openFilterCol === col.id;
                const selectedVals = columnFilters[col.field] || [];
                const stickyInfo = getStickyColumnProps(col.field);
                const isAuditColumnHeader =
                  col.field === 'pdcAudit' ||
                  col.field === 'constructionAudit' ||
                  col.field === 'procedure155Status';

                return (
                  <th 
                    key={col.id} 
                    className={`sticky top-0 py-2.5 px-2 sm:px-2.5 font-black whitespace-nowrap text-white relative text-xs tracking-wide shadow-xs text-center select-none ${
                      isAuditColumnHeader
                        ? '!bg-[#7F1D1D] !text-white border-b-2 border-[#FDB813] border-r border-red-900 shadow-inner'
                        : `border-b-2 border-[#F58220] border-r border-blue-800/70 ${
                            stickyInfo.isSticky ? 'bg-[#001D40] text-white' : 'bg-[#002855] text-white'
                          }`
                    } ${
                      stickyInfo.isBoundary ? 'border-l-2 border-[#F58220] shadow-[-3px_0_10px_rgba(0,0,0,0.22)]' : ''
                    } ${
                      isFilterOpen ? 'z-50 overflow-visible' : stickyInfo.isSticky ? 'z-40' : 'z-30'
                    }`}
                    style={{ 
                      top: 0,
                      backgroundColor: isAuditColumnHeader ? '#7F1D1D' : undefined,
                      color: '#FFFFFF',
                      right: stickyInfo.isSticky ? `${stickyInfo.rightOffset}px` : undefined,
                      width: columnWidths[col.id] ? `${columnWidths[col.id]}px` : (stickyInfo.isSticky ? stickyInfo.width : (isAutoFitToScreen ? getColumnAutoWidthStyle(col.field) : (col.width || undefined))),
                      minWidth: columnWidths[col.id] ? `${columnWidths[col.id]}px` : (stickyInfo.isSticky ? stickyInfo.minWidth : (col.minWidth || '120px'))
                    }}
                  >
                    {/* Drag Separator: Smooth column resizing & double-click auto-fit like Microsoft Excel */}
                    <div 
                      onMouseDown={(e) => {
                        const curWidth = columnWidths[col.id] || (parseInt(col.width || '150', 10) || 150);
                        handleColResizeStart(col.id, curWidth, e);
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        handleColDoubleClick(col);
                      }}
                      className="absolute left-0 top-0 bottom-0 w-3 cursor-col-resize hover:bg-amber-400/50 active:bg-amber-500 z-30 transition-colors select-none group/resize flex items-center justify-center"
                      title="اسحب لتعديل عرض العمود بسلاسة أو انقر نقرتين مزدوجتين للاحتواء التلقائي مثل Excel"
                    >
                      <div className={`w-0.5 h-full ${isAuditColumnHeader ? 'bg-red-900/90' : 'bg-blue-800/80'} group-hover/resize:bg-[#FDB813]`} />
                    </div>

                    <div className={`flex items-center ${tableTextAlign === 'center' ? 'justify-center' : tableTextAlign === 'left' ? 'justify-start' : 'justify-end'} gap-1.5 w-full`}>
                      <button
                        type="button"
                        onClick={() => handleSort(col.field)}
                        className="flex items-center gap-1 font-black !text-white hover:text-[#FDB813] cursor-pointer truncate transition-colors drop-shadow-2xs"
                        title={`انقر لترتيب عمود (${col.title}) تصاعدياً / تنازلياً`}
                      >
                        <span className="truncate !text-white font-black">{col.title}</span>
                        {Boolean(sortConfig && col.field && sortConfig.field === col.field) && (
                          <span className="text-[#FDB813] font-black text-[11px] shrink-0">
                            {sortConfig?.direction === 'asc' ? ' ▲' : ' ▼'}
                          </span>
                        )}
                      </button>

                      {/* Filter Button for This Column */}
                      <div className="relative">
                        <button
                          type="button"
                          data-col-filter-trigger={col.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onCheckPermission && !onCheckPermission('searchAndFilter', `فلترة بيانات عمود (${col.title})`)) {
                              return;
                            }
                            if (isFilterOpen) {
                              setOpenFilterCol(null);
                              setFilterPopupPos(null);
                            } else {
                              const rect = e.currentTarget.getBoundingClientRect();
                              const pos = calculateSmartPopoverPosition(rect, 400, {
                                preferredWidth: 288,
                                align: 'end'
                              });
                              setFilterPopupPos(pos);
                              setOpenFilterCol(col.id);
                              setFilterSearchQuery('');
                            }
                          }}
                          className={`p-1 rounded-md transition-all flex items-center gap-0.5 cursor-pointer ${
                            isFiltered 
                              ? 'bg-[#F58220] text-white font-black shadow-2xs ring-1 ring-amber-300' 
                              : isAuditColumnHeader
                              ? 'text-white/90 hover:text-white hover:bg-white/20'
                              : 'text-blue-200 hover:text-white hover:bg-white/15'
                          }`}
                          title={`فلترة بيانات عمود (${col.title})`}
                        >
                          <Filter className="w-3 h-3" />
                          {isFiltered && (
                            <span className="text-[10px] px-1 font-bold">
                              {selectedVals.length}
                            </span>
                          )}
                        </button>
                      </div>
                    </div>
                  </th>
                );
              })}

              {/* Actions Column Header */}
              <th 
                className="sticky top-0 z-30 py-2.5 px-2 text-center font-black text-white text-xs shadow-xs border-b-2 border-[#F58220] border-r border-l border-blue-800/70 bg-[#001D40]"
                style={{
                  top: 0,
                  width: isAutoFitToScreen ? '8.5%' : undefined,
                  minWidth: isAutoFitToScreen ? '75px' : '130px'
                }}
              >
                الإجراءات
              </th>
            </tr>
          </thead>

          {/* Table Body (Distinct zebra rows, clearly outlined column/row borders, bold text) */}
          <tbody className="bg-white">
            {sortedOrders.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 2} className="py-12 text-center text-slate-500 border-2 border-slate-400">
                  <div className="max-w-sm mx-auto space-y-2">
                    <AlertCircle className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="font-bold text-slate-800 text-sm">
                      {activeFiltersCount > 0 
                        ? 'لا توجد نتائج تطابق الفلاتر المحددة حالياً'
                        : 'لا توجد أوامر عمل مدرجة في هذا الجدول حالياً'
                      }
                    </p>
                    <p className="text-xs text-slate-500 font-medium">
                      {activeFiltersCount > 0 
                        ? 'يمكنك إلغاء الفلاتر لمشاهدة كافة الصفوف'
                        : 'اضغط على زر "إضافة أمر عمل" أو من القائمة الجانبية لإضافة أمر عمل جديد'
                      }
                    </p>
                    {activeFiltersCount > 0 ? (
                      <button
                        type="button"
                        onClick={handleClearAllFilters}
                        className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-bold hover:bg-amber-700 transition-colors cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>إلغاء كافة الفلاتر</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={onOpenAddModal}
                        className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>إضافة أمر العمل الآن</span>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              sortedOrders.map((wo, index) => {
                const isSelected = selectedOrderId === wo.id;
                const isChecked = selectedOrderIds.has(wo.id);

                // Automatic Focus in Light Green on the row currently being worked on inside the table
                const isWorkingRow =
                  isSelected ||
                  activeCell?.orderId === wo.id ||
                  openInlineDropdown?.orderId === wo.id ||
                  editingQualityNotes?.orderId === wo.id ||
                  editingTextCell?.orderId === wo.id ||
                  activeAuditModal?.order.id === wo.id ||
                  activeSupportAuditModal?.order.id === wo.id ||
                  floatingInspectionOrder?.id === wo.id ||
                  itemizerModalOrder?.id === wo.id;

                // Duplicate check based on canonical workOrderNumber AND workOrderCode identity
                const isDuplicate = duplicateOrderIds.has(wo.id);
                const isEdited = Boolean(wo.isEdited);
                const isNew = Boolean(wo.isNew && !wo.isEdited);

                // Cross-table match check based on (workOrderNumber) AND (workOrderCode) across all tables
                const crossMatches = crossTableMatchesMap.get(wo.id) || [];
                const hasCrossTableMatch = crossMatches.length > 0;

                const customBg = customRowColors[wo.id];

                // Row background: ONLY Light Green Focus when working on the row, or clean white/zebra
                const rowBgClass = isWorkingRow
                  ? 'bg-emerald-100/95 hover:bg-emerald-100 ring-2 ring-inset ring-emerald-500 font-bold'
                  : isChecked
                  ? 'bg-emerald-50/90 ring-2 ring-inset ring-emerald-400 font-bold'
                  : customBg
                  ? 'hover:brightness-95 font-bold'
                  : index % 2 === 0
                  ? 'bg-white hover:bg-blue-50/50'
                  : 'bg-slate-50/85 hover:bg-blue-50/50';

                return (
                  <tr 
                    id={`wo-row-${wo.id}`}
                    key={`${wo.id || 'order'}-${index}`} 
                    onClick={() => {
                      setSelectedOrderId(wo.id);
                      setSelectedOrderIds(new Set([wo.id]));
                    }}
                    onDoubleClick={() => handleNavigateAndEditOrder(wo)}
                    style={!isWorkingRow && customBg ? { backgroundColor: customBg } : undefined}
                    className={`transition-colors cursor-pointer border-b border-slate-200 ${rowBgClass}`}
                  >
                    {/* Sequence # & Checkbox Column: ONLY column that keeps status colors & badges */}
                    <td 
                      style={{ 
                        width: isStickyCoreColumns ? '52px' : (isAutoFitToScreen ? '3.5%' : undefined),
                        minWidth: isStickyCoreColumns ? '52px' : undefined,
                        right: (isStickyCoreColumns || isStickyFirstCol) ? 0 : undefined,
                        backgroundColor: customBg ? customBg : undefined
                      }}
                      className={`${
                        tableDensity === 'compact' ? 'py-1 px-1 text-xs' : tableDensity === 'spacious' ? 'py-3 px-2 text-sm' : 'py-2 px-1.5 text-xs'
                      } ${
                        tableVerticalAlign === 'top' ? 'align-top' : tableVerticalAlign === 'bottom' ? 'align-bottom' : 'align-middle'
                      } ${
                        tableBorderStyle === 'none' ? 'border-none' : tableBorderStyle === 'bottom' ? 'border-b border-r-0 border-l-0' : 'border-b border-r border-l border-slate-300'
                      } text-center font-mono tabular-nums font-black ${
                        (isStickyCoreColumns || isStickyFirstCol) ? 'sticky right-0 z-20 shadow-[3px_0_8px_rgba(0,0,0,0.08)]' : ''
                      } ${
                        isDuplicate
                          ? (customBg ? '' : 'bg-blue-200/95') + ' text-blue-950 border-blue-400'
                          : hasCrossTableMatch
                          ? (customBg ? '' : 'bg-[#7c2d12]') + ' text-white border-orange-400'
                          : isNew
                          ? (customBg ? '' : 'bg-emerald-100') + ' text-emerald-950 border-emerald-400'
                          : isEdited
                          ? (customBg ? '' : 'bg-amber-100/95') + ' text-amber-950 border-amber-400'
                          : isWorkingRow
                          ? 'bg-emerald-200/95 text-emerald-950 border-emerald-500'
                          : (customBg ? '' : 'bg-slate-100/90') + ' text-slate-900 border-slate-300'
                      }`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex flex-col items-center justify-center gap-1">
                        <div className="flex items-center justify-center gap-1">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const willCheck = e.target.checked;
                              setSelectedOrderIds(prev => {
                                const next = new Set(prev);
                                if (willCheck) {
                                  next.add(wo.id);
                                } else {
                                  next.delete(wo.id);
                                }
                                return next;
                              });
                              if (willCheck) {
                                setSelectedOrderId(wo.id);
                              } else {
                                const remaining = Array.from(selectedOrderIds).filter(id => id !== wo.id);
                                setSelectedOrderId(remaining.length > 0 ? remaining[remaining.length - 1] : null);
                              }
                            }}
                            className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-400 cursor-pointer accent-emerald-600"
                            title="تحديد الصف (وضع علامة صح لمزامنة التعديل التلقائي والحذف)"
                          />
                          <span className={hasCrossTableMatch ? 'text-amber-300 font-black' : 'font-black'}>{index + 1}</span>
                        </div>
                        {isDuplicate && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-blue-600 text-white shadow-xs animate-pulse" title="أمر عمل مكرر: يتطابق رقم ورمز أمر العمل مع صف آخر">
                            مكرر
                          </span>
                        )}
                        {hasCrossTableMatch && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setViewingCrossMatchOrder(wo);
                            }}
                            className="px-1.5 py-0.5 rounded text-[9.5px] font-black bg-gradient-to-r from-orange-600 to-amber-700 hover:from-orange-500 hover:to-amber-600 text-white shadow-xs flex items-center gap-1 shrink-0 animate-pulse cursor-pointer border border-orange-300/40"
                            title={`متوافق مع جدول آخر (${crossMatches.map(m => m.tableName).join(' • ')}) - انقر لاستعراض واستقطاب البيانات والمزامنة`}
                          >
                            <Link2 className="w-2.5 h-2.5 text-white" />
                            <span>متوافق مع جدول آخر</span>
                          </button>
                        )}
                        {isNew && !isDuplicate && !hasCrossTableMatch && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-emerald-600 text-white shadow-xs flex items-center gap-0.5 animate-pulse" title="سطر جديد مضاف للجدول">
                            <Sparkles className="w-2.5 h-2.5 text-white" />
                            <span>جديد</span>
                          </span>
                        )}
                        {isEdited && !isDuplicate && !hasCrossTableMatch && (
                          <span 
                            className="px-1.5 py-0.5 rounded text-[9.5px] font-black bg-amber-400 text-slate-950 shadow-xs flex items-center gap-0.5 shrink-0" 
                            title={`تم التعديل على هذا السطر${wo.lastEditedAt ? ` (${new Date(wo.lastEditedAt).toLocaleTimeString('ar-SA')})` : ''}`}
                          >
                            <Sparkles className="w-2.5 h-2.5 text-slate-950" />
                            <span>مُعدّل</span>
                          </span>
                        )}
                        {wo.isImported && !isEdited && (
                          <span 
                            className="px-1.5 py-0.5 rounded text-[9px] font-black bg-gradient-to-r from-teal-600 to-cyan-600 text-white shadow-xs flex items-center gap-0.5 shrink-0 border border-cyan-300/40" 
                            title={`بيانات مستوردة متوافقة${wo.importedFromTableName ? ` من: ${wo.importedFromTableName}` : ''}${wo.importedFields ? ` (${wo.importedFields.length} حقل)` : ''}`}
                          >
                            <Sparkles className="w-2.5 h-2.5 text-amber-300" />
                            <span>مستورد</span>
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Dynamic Columns for each row: clean white/zebra or Light Green Focus when working on the row */}
                    {columns.filter(col => Boolean(col && col.id && col.field)).map(col => {
                      const cs = getResolvedCellStyle(wo, col.field);
                      const isThisCellActive = activeCell?.orderId === wo.id && activeCell?.field === col.field;
                      const isCellImported = Boolean(wo.isImported && wo.importedFields && wo.importedFields.includes(col.field));
                      const cellBg = cs.bgColor
                        ? cs.bgColor
                        : isWorkingRow
                        ? '#d1fae5'
                        : customBg
                        ? customBg
                        : undefined;
                      const stickyInfo = getStickyColumnProps(col.field);
                      const defaultRowBg = isWorkingRow
                        ? '#d1fae5'
                        : isChecked
                        ? '#ecfdf5'
                        : index % 2 === 0
                        ? '#ffffff'
                        : '#f8fafc';

                      return (
                      <td 
                        key={col.id}
                        onMouseDownCapture={() => {
                          setActiveCell({ orderId: wo.id, field: col.field, colTitle: col.title });
                          setSelectedOrderId(wo.id);
                        }}
                        style={{
                          width: columnWidths[col.id] ? `${columnWidths[col.id]}px` : (stickyInfo.isSticky ? stickyInfo.width : (isAutoFitToScreen ? getColumnAutoWidthStyle(col.field) : (col.width || undefined))),
                          minWidth: columnWidths[col.id] ? `${columnWidths[col.id]}px` : (stickyInfo.isSticky ? stickyInfo.minWidth : (col.minWidth || '120px')),
                          right: stickyInfo.isSticky ? `${stickyInfo.rightOffset}px` : undefined,
                          backgroundColor: cellBg || (stickyInfo.isSticky ? defaultRowBg : undefined),
                          fontFamily: cs.fontFamily,
                          fontSize: `${cs.fontSize}px`,
                          fontWeight: cs.bold ? 900 : 500,
                          fontStyle: cs.italic ? 'italic' : 'normal',
                          textDecoration: cs.textDecoration,
                          color: cs.textColor || undefined
                        }}
                        className={`${
                          tableDensity === 'compact' ? 'py-0.5 px-1 text-[11px]' : tableDensity === 'spacious' ? 'py-2.5 px-2 text-xs' : 'py-1.5 px-1.5 text-xs'
                        } ${
                          cs.verticalAlign === 'top' ? 'align-top' : cs.verticalAlign === 'bottom' ? 'align-bottom' : 'align-middle'
                        } ${
                          tableBorderStyle === 'none' ? 'border-none' : tableBorderStyle === 'bottom' ? 'border-b border-r-0' : 'border-b border-r'
                        } ${
                          cs.textAlign === 'center' ? 'text-center' : cs.textAlign === 'left' ? 'text-left' : 'text-right'
                        } ${
                          stickyInfo.isSticky ? 'sticky z-20' : ''
                        } ${
                          stickyInfo.isBoundary ? 'border-l-2 border-[#004B8D]/60 shadow-[-4px_0_10px_rgba(0,0,0,0.12)]' : ''
                        } ${
                          isThisCellActive ? 'ring-2 ring-inset ring-emerald-600 z-10' : ''
                        } ${
                          isWorkingRow
                            ? 'bg-emerald-100/90 text-slate-900 font-bold border-emerald-400'
                            : 'text-slate-900 font-bold border-slate-300/90'
                        } transition-colors overflow-hidden relative group/td tabular-nums ${
                          isWrapTextEnabled ? 'whitespace-normal break-words' : 'whitespace-nowrap truncate'
                        }`}
                      >
                        {isCellImported && (
                          <span 
                            className="absolute top-0.5 left-0.5 w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-xs ring-1 ring-white" 
                            title="خلية مستوردة متوافقة بدلالة العمود"
                          />
                        )}
                        {renderCellContent(col, wo)}
                      </td>
                    );
                    })}

                    {/* Actions Column (تعديل كامل، استقطاب وربط، تعديل أساسي، حذف، صور) */}
                    <td 
                      style={{ width: isAutoFitToScreen ? '9%' : undefined }}
                      className={`${
                        tableDensity === 'compact' ? 'py-1 px-1' : tableDensity === 'spacious' ? 'py-3 px-2' : 'py-1.5 px-1.5'
                      } ${
                        tableVerticalAlign === 'top' ? 'align-top' : tableVerticalAlign === 'bottom' ? 'align-bottom' : 'align-middle'
                      } ${
                        tableBorderStyle === 'none' ? 'border-none' : tableBorderStyle === 'bottom' ? 'border-b border-r-0 border-l-0' : 'border-b border-r border-l'
                      } text-center whitespace-nowrap ${
                        isWorkingRow
                          ? 'bg-emerald-100/90 border-emerald-400 font-bold'
                          : 'bg-white/95 border-slate-300/90'
                      }`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-center gap-1">
                        {/* 1. الزر الرئيسي لتعديل أمر العمل - يعمل بشكل كامل وفوري ومتزامن */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            handleNavigateAndEditOrder(wo);
                          }}
                          className="px-2 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-black text-xs transition-all cursor-pointer shadow-xs flex items-center gap-1 shrink-0 active:scale-95"
                          title="تعديل أمر العمل (تعديل كامل وشامل لكافة البيانات والنماذج)"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>تعديل</span>
                        </button>

                        {/* زر استعراض واستقطاب البيانات والمزامنة مع الجداول المتوافقة */}
                        {hasCrossTableMatch && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setViewingCrossMatchOrder(wo);
                            }}
                            className="px-2 py-1 rounded-lg bg-gradient-to-r from-orange-600 to-amber-700 hover:from-orange-500 hover:to-amber-600 text-white font-black text-xs transition-all cursor-pointer shadow-xs flex items-center gap-1 shrink-0 active:scale-95"
                            title={`استعراض واستقطاب البيانات والصور من الجدول المتوافق (${crossMatches.map(m => m.tableName).join(' • ')})`}
                          >
                            <Link2 className="w-3.5 h-3.5" />
                            <span>استقطاب وربط</span>
                          </button>
                        )}

                        {/* زر العمل على السطر الجديد لإزالة التمييز الأخضر */}
                        {isNew && (
                          <button
                            type="button"
                            onClick={async (e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              if (onCheckPermission && !onCheckPermission('editWorkOrderStatus', 'تحديث سطر العمل')) {
                                return;
                              }
                              await handleDirectCellUpdate(wo, 'isNew', false);
                            }}
                            className="px-1.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-[10px] font-black cursor-pointer shadow-xs flex items-center gap-0.5 shrink-0"
                            title="تم العمل على هذا السطر (إزالة اللون الأخضر)"
                          >
                            <Check className="w-3 h-3 stroke-[3]" />
                            <span>تم العمل</span>
                          </button>
                        )}

                        {/* 2. تعديل سريع للبيانات الأساسية */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            handleNavigateAndEditBasicData(wo);
                          }}
                          className="p-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white transition-colors cursor-pointer shadow-2xs"
                          title="تعديل سريع للبيانات الأساسية (المكتب - المقاول - رقم أمر العمل - رمز أمر العمل)"
                        >
                          <FileEdit className="w-3.5 h-3.5" />
                        </button>

                        {/* 3. حذف أمر العمل */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            if (onCheckPermission && !onCheckPermission('deleteWorkOrder', 'حذف أمر العمل')) {
                              return;
                            }
                            if (!isSessionUnlocked()) {
                              if (onRequestAuth) onRequestAuth('حذف أمر العمل');
                              return;
                            }
                            setDeleteConfirmTarget({
                              type: 'single',
                              order: wo,
                              title: 'حذف أمر العمل',
                              message: `هل أنت متأكد من مسح وحذف أمر العمل (${wo.workOrderNumber}) للمقاول (${wo.contractor}) نهائياً من النظام وقاعدة البيانات؟`
                            });
                          }}
                          className="p-1 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white transition-colors cursor-pointer shadow-2xs"
                          title="حذف هذا الأمر نهائياً"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>

                        {/* 4. استعراض الصور */}
                        {wo.photos && wo.photos.length > 0 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              if (onCheckPermission && !onCheckPermission('viewPhotos', 'استعراض الصور والمرفقات')) {
                                return;
                              }
                              onViewPhotos(wo);
                            }}
                            className="p-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white transition-colors cursor-pointer shadow-2xs"
                            title={`استعراض الصور الميدانية (${wo.photos.length})`}
                          >
                            <Camera className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      </div>

      {/* Floating Column Filter Popover: Rendered into document.body via Portal to Never Get Clipped */}
      {openFilterCol && filterPopupPos && typeof document !== 'undefined' && createPortal(
        (() => {
          const activeCol = columns.find(c => c.id === openFilterCol);
          if (!activeCol) return null;
          const distinctItems = distinctValuesByField[activeCol.field] || [];
          const selectedVals = columnFilters[activeCol.field] || [];
          const isThreeAuditFilterCol =
            activeCol.field === 'pdcAudit' ||
            activeCol.field === 'constructionAudit' ||
            activeCol.field === 'procedure155Status';

          return (
            <div 
              ref={popoverRef}
              style={getPopoverStyle(filterPopupPos)}
              className={`bg-white rounded-2xl shadow-2xl border-2 ${
                isThreeAuditFilterCol ? 'border-[#7F1D1D] ring-4 ring-[#7F1D1D]/20' : 'border-[#002855] ring-4 ring-[#002855]/20'
              } text-slate-900 overflow-hidden z-[999999] text-right animate-in fade-in zoom-in-95 duration-150 flex flex-col font-['Cairo',sans-serif]`}
              dir="rtl"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={`flex items-center justify-between px-3.5 py-2.5 border-b-2 border-[#F58220] text-white ${
                isThreeAuditFilterCol
                  ? 'bg-[#7F1D1D]'
                  : 'bg-gradient-to-l from-[#001D40] via-[#002855] to-[#004B8D]'
              }`}>
                <span className="text-xs font-black text-white flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-[#FDB813]" />
                  <span>فلترة عمود: {activeCol.title}</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setOpenFilterCol(null);
                    setFilterPopupPos(null);
                  }}
                  className="p-1 text-white/80 hover:text-white hover:bg-white/15 rounded-lg cursor-pointer transition-colors"
                  title="إغلاق الفلتر"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3.5 flex flex-col flex-1 overflow-hidden">
                {/* Search inside distinct values */}
                <div className="relative mb-2">
                  <input
                    type="text"
                    placeholder="بحث سريع في قيم هذا العمود..."
                    value={filterSearchQuery}
                    onChange={(e) => setFilterSearchQuery(e.target.value)}
                    className="w-full text-xs py-1.5 pr-7 pl-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden focus:border-[#004B8D] focus:ring-2 focus:ring-[#004B8D]/20 font-bold text-[#002855]"
                  />
                  <Search className="w-3.5 h-3.5 text-[#004B8D] absolute right-2 top-1/2 -translate-y-1/2" />
                </div>

                {/* Select All / Deselect All */}
                <div className="flex items-center justify-between text-[11px] mb-2 px-1 text-slate-500 font-bold">
                  <button
                    type="button"
                    onClick={() => {
                      const allVals = distinctItems.map(i => i.value);
                      setColumnFilters(prev => ({ ...prev, [activeCol.field]: allVals }));
                    }}
                    className="text-[#004B8D] hover:text-[#F58220] hover:underline cursor-pointer font-black"
                  >
                    تحديد الكل ({distinctItems.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => handleClearColumnFilter(activeCol.field)}
                    className="text-rose-600 hover:text-rose-800 hover:underline cursor-pointer font-bold"
                  >
                    إلغاء التحديد
                  </button>
                </div>

                {/* Distinct Values Checkbox List */}
                <div className="max-h-56 overflow-y-auto space-y-1 my-1 pr-0.5 scrollbar-thin">
                  {distinctItems
                    .filter(item => item.value.toLowerCase().includes(filterSearchQuery.toLowerCase()))
                    .map((item, i) => {
                      const isChecked = selectedVals.includes(item.value);
                      return (
                        <label 
                          key={i}
                          className={`flex items-center justify-between p-1.5 rounded-xl cursor-pointer text-xs font-bold transition-colors ${
                            isChecked ? 'bg-blue-50/90 border border-[#004B8D]/30 text-[#002855]' : 'hover:bg-slate-100 text-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleValueFilter(activeCol.field, item.value)}
                              className="rounded border-slate-300 text-[#002855] focus:ring-[#004B8D] w-3.5 h-3.5 accent-[#002855]"
                            />
                            <span className="truncate">{item.value}</span>
                          </div>
                          <span className="text-[10px] text-[#002855] font-mono px-1.5 py-0.5 font-black bg-[#002855]/10 rounded-md">
                            {item.count}
                          </span>
                        </label>
                      );
                    })}
                </div>

                <div className="pt-2.5 mt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={() => handleClearColumnFilter(activeCol.field)}
                    className="text-slate-600 hover:text-rose-700 text-[11px] font-black cursor-pointer"
                  >
                    إعادة تعيين
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOpenFilterCol(null);
                      setFilterPopupPos(null);
                    }}
                    className={`px-4 py-1.5 text-white rounded-xl text-xs font-black cursor-pointer shadow-xs transition-all ${
                      isThreeAuditFilterCol
                        ? 'bg-[#7F1D1D] hover:bg-red-900'
                        : 'bg-gradient-to-r from-[#002855] to-[#004B8D] hover:from-[#001D40] hover:to-[#002855]'
                    }`}
                  >
                    تطبيق الفلتر
                  </button>
                </div>
              </div>
            </div>
          );
        })(),
        document.body
      )}

      {/* Floating Fixed Inline Cell Dropdown: Rendered into document.body with Fixed Coordinates so it Appears OVER the Table and NEVER Gets Clipped */}
      {openInlineDropdown && typeof document !== 'undefined' && createPortal(
        (() => {
          const targetOrder = orders.find(o => o.id === openInlineDropdown.orderId);
          if (!targetOrder) return null;

          const rect = openInlineDropdown.rect;
          const estimatedHeight = Math.min(360, openInlineDropdown.options.length * 40 + 64);
          const pos = calculateSmartPopoverPosition(rect, estimatedHeight, {
            preferredWidth: Math.max(220, Math.min(310, rect.width)),
            align: 'end'
          });
          const isThreeAuditInlineField =
            openInlineDropdown.field === 'pdcAudit' ||
            openInlineDropdown.field === 'constructionAudit' ||
            openInlineDropdown.field === 'procedure155Status';

          return (
            <div 
              ref={cellDropdownMenuRef}
              style={getPopoverStyle(pos)}
              className={`bg-white rounded-2xl shadow-2xl border-2 ${
                isThreeAuditInlineField ? 'border-[#7F1D1D] ring-4 ring-[#7F1D1D]/25' : 'border-[#002855] ring-4 ring-[#002855]/20'
              } z-[999999] animate-in fade-in zoom-in-95 duration-100 text-right overflow-hidden flex flex-col font-['Cairo',sans-serif]`}
              dir="rtl"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={`px-3.5 py-2.5 text-[11px] font-black text-white border-b-2 border-[#F58220] flex items-center justify-between gap-2 shrink-0 ${
                isThreeAuditInlineField
                  ? 'bg-[#7F1D1D]'
                  : 'bg-gradient-to-l from-[#001D40] via-[#002855] to-[#004B8D]'
              }`}>
                <span className="flex items-center gap-1.5 truncate">
                  <Check className="w-3.5 h-3.5 text-[#FDB813] shrink-0" />
                  <span>اختيار: {openInlineDropdown.colTitle}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setOpenInlineDropdown(null)}
                  className="p-1 text-white/80 hover:text-white hover:bg-white/15 rounded-lg cursor-pointer transition-colors"
                  title="إغلاق"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="max-h-64 overflow-y-auto py-1.5 px-1.5 space-y-0.5 scrollbar-thin">
                {openInlineDropdown.options.map((opt) => {
                  const isSelected = openInlineDropdown.displayVal === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onMouseDown={(e) => {
                        e.stopPropagation();
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDirectCellUpdate(targetOrder, openInlineDropdown.field, opt);
                      }}
                      className={`w-full px-3 py-2 rounded-xl text-xs font-black text-right flex items-center justify-between gap-2 transition-all cursor-pointer ${
                        isSelected 
                          ? isThreeAuditInlineField
                            ? 'bg-[#7F1D1D] text-white shadow-xs'
                            : 'bg-gradient-to-r from-[#002855] to-[#004B8D] text-white shadow-xs' 
                          : 'text-[#002855] hover:bg-blue-50/90 hover:text-[#F58220]'
                      }`}
                    >
                      <span className="truncate">{opt}</span>
                      {isSelected && <Check className="w-4 h-4 text-[#FDB813] shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })(),
        document.body
      )}

      {/* Floating Fixed Quality Notes Editor: Rendered into document.body to Never Get Clipped */}
      {editingQualityNotes && typeof document !== 'undefined' && createPortal(
        (() => {
          const targetOrder = orders.find(o => o.id === editingQualityNotes.orderId);
          if (!targetOrder) return null;

          const pos = calculateSmartPopoverPosition(editingQualityNotes.rect, 260, {
            preferredWidth: 350,
            align: 'end'
          });

          return (
            <div 
              ref={qualityNotesEditorRef}
              style={getPopoverStyle(pos)}
              className="bg-white rounded-2xl shadow-2xl border-2 border-[#002855] overflow-hidden z-[999999] text-right animate-in fade-in zoom-in-95 duration-100 ring-4 ring-[#002855]/20 font-['Cairo',sans-serif]"
              dir="rtl"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-3.5 py-2.5 border-b-2 border-[#F58220] bg-gradient-to-l from-[#001D40] via-[#002855] to-[#004B8D] text-white">
                <span className="text-xs font-black text-white flex items-center gap-1.5">
                  <Edit3 className="w-3.5 h-3.5 text-[#FDB813]" />
                  <span>تعديل ملاحظات الجودة ({targetOrder.workOrderNumber})</span>
                </span>
                <button
                  type="button"
                  onClick={() => setEditingQualityNotes(null)}
                  className="p-1 text-white/80 hover:text-white hover:bg-white/15 rounded-lg cursor-pointer transition-colors"
                  title="إغلاق"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="p-3.5">
                <textarea
                  value={editingQualityNotes.text}
                  onChange={(e) => setEditingQualityNotes({ ...editingQualityNotes, text: e.target.value })}
                  rows={4}
                  placeholder="اكتب ملاحظات الجودة هنا..."
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:border-[#004B8D] focus:ring-2 focus:ring-[#004B8D]/20 font-bold text-[#002855] leading-relaxed"
                  autoFocus
                />

                {/* Quick shortcut to full note itemizer with photo attachments */}
                <div className="flex items-center justify-between gap-1.5 mt-2 p-2 rounded-xl bg-amber-50 border border-[#F58220]/40">
                  <div className="flex items-center gap-1.5 text-[10px] font-black text-[#002855]">
                    <Camera className="w-3.5 h-3.5 text-[#F58220] shrink-0" />
                    <span>عنصرة الملاحظات وإرفاق صور توضيحية (+ صور)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingQualityNotes(null);
                      setItemizerModalOrder(targetOrder);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-[#F58220] hover:bg-[#e06f10] text-white text-[10px] font-black cursor-pointer shadow-xs shrink-0 flex items-center gap-1"
                    title="فتح نافذة عنصرة الملاحظات مع إمكانية إرفاق صورة أو أكثر لكل ملاحظة"
                  >
                    <span>عنصرة وصور</span>
                  </button>
                </div>

                <div className="flex items-center justify-between gap-2 mt-2.5 pt-2.5 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setEditingQualityNotes(null)}
                    className="px-3 py-1.5 text-xs font-black text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl cursor-pointer transition-colors"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleDirectCellUpdate(targetOrder, 'qualityNotes', editingQualityNotes.text.trim());
                      setEditingQualityNotes(null);
                    }}
                    className="px-4 py-1.5 bg-gradient-to-r from-[#002855] to-[#004B8D] hover:from-[#001D40] hover:to-[#002855] text-white text-xs font-black rounded-xl shadow-xs cursor-pointer transition-all flex items-center gap-1.5 border border-[#F58220]/50"
                  >
                    <Check className="w-3.5 h-3.5 text-[#FDB813]" />
                    <span>حفظ وتزامن فوري</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })(),
        document.body
      )}



      {/* Floating Multi-Selection Action Dock (قاعدة الإجراءات الجماعية السريعة) */}
      {selectedOrderIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-gradient-to-r from-[#001D40] via-[#002855] to-[#001D40] text-white px-4 sm:px-6 py-3 rounded-2xl shadow-2xl border-2 border-[#F58220] backdrop-blur-md flex flex-wrap items-center justify-center gap-2 sm:gap-3 animate-in fade-in slide-in-from-bottom-5 duration-200 ring-4 ring-[#002855]/40">
          <div className="flex items-center gap-2 pl-3 border-l border-white/15 shrink-0">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FDB813] animate-pulse" />
            <span className="text-xs font-black text-blue-100">
              تم تحديد <strong className="text-slate-950 font-mono text-sm px-2 py-0.5 rounded-lg bg-[#FDB813] font-black">{selectedOrderIds.size}</strong> أمر عمل
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleBulkApprove155}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-xs transition-all cursor-pointer active:scale-95"
              title="اعتماد كافة الأوامر المحددة كـ (مؤهل للاغلاق - معتمد)"
            >
              <Check className="w-3.5 h-3.5 stroke-[3]" />
              <span>اعتماد كجاهز 155 للمحدد</span>
            </button>

            {onOpenExportModal && (
              <button
                type="button"
                onClick={() => {
                  const selectedList = orders.filter(o => selectedOrderIds.has(o.id));
                  onOpenExportModal(selectedList, `${officeTitle} - الأوامر المحددة (${selectedList.length})`, false);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white text-xs font-black shadow-xs transition-all cursor-pointer active:scale-95"
                title="معاينة وتخصيص التقرير الشامل وطباعته أو تصديره للمحدد لكافة الصيغ"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>معاينة وتصدير شامل ({selectedOrderIds.size})</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                const selectedList = orders.filter(o => selectedOrderIds.has(o.id));
                exportToExcel(selectedList, `${officeTitle} - الأوامر المحددة (${selectedList.length})`, `أوامر_محددة_${Date.now()}.xlsx`, columns);
                setExportNotification(`تم تصدير (${selectedList.length}) صف محدد فورياً إلى Excel المعتمد (RTL)`);
                setTimeout(() => setExportNotification(null), 3500);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold transition-all cursor-pointer border border-slate-700"
              title="تصدير المحدد فورياً إلى Excel بنفس التنسيق المعتمد"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Excel</span>
            </button>

            <button
              type="button"
              disabled={isDirectExportingPdf}
              onClick={async () => {
                const selectedList = orders.filter(o => selectedOrderIds.has(o.id));
                setIsDirectExportingPdf(true);
                setExportNotification(`جارٍ تجهيز ملف PDF المعتمد لـ (${selectedList.length}) صف محدد...`);
                try {
                  await exportOrdersDirectToPdf(selectedList, `${officeTitle} - الأوامر المحددة (${selectedList.length})`, undefined, columns);
                  setExportNotification(`تم تصدير (${selectedList.length}) صف محدد إلى PDF معتمد`);
                } catch (err: any) {
                  setExportNotification(err?.message || 'حدث خطأ أثناء تصدير PDF');
                } finally {
                  setIsDirectExportingPdf(false);
                  setTimeout(() => setExportNotification(null), 3500);
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold transition-all cursor-pointer border border-slate-700 disabled:opacity-50"
              title="تصدير المحدد فورياً إلى PDF معتمد"
            >
              <FileText className="w-3.5 h-3.5 text-rose-400" />
              <span>PDF</span>
            </button>

            {/* In-Dock Quick Color Palette */}
            <div className="flex items-center gap-1 bg-slate-900/90 px-2 py-1 rounded-xl border border-slate-700">
              <Palette className="w-3.5 h-3.5 text-amber-300 ml-0.5" />
              {[
                { name: 'أصفر', color: '#fef08a', bgClass: 'bg-yellow-200 hover:bg-yellow-300' },
                { name: 'أخضر', color: '#bbf7d0', bgClass: 'bg-emerald-200 hover:bg-emerald-300' },
                { name: 'أزرق', color: '#bae6fd', bgClass: 'bg-sky-200 hover:bg-sky-300' },
                { name: 'بنفسجي', color: '#e9d5ff', bgClass: 'bg-purple-200 hover:bg-purple-300' },
                { name: 'وردي', color: '#fecdd3', bgClass: 'bg-rose-200 hover:bg-rose-300' },
                { name: 'برتقالي', color: '#fed7aa', bgClass: 'bg-amber-200 hover:bg-amber-300' },
              ].map(swatch => (
                <button
                  key={swatch.color}
                  type="button"
                  onClick={() => handleSetRowColor(swatch.color)}
                  className={`w-4 h-4 rounded-full border border-slate-500 ${swatch.bgClass} cursor-pointer transition-transform hover:scale-125`}
                  title={`تلوين المحدد باللون ${swatch.name}`}
                />
              ))}
              <button
                type="button"
                onClick={() => handleSetRowColor(null)}
                className="text-[9px] text-slate-400 hover:text-white px-1 py-0.5 rounded cursor-pointer"
                title="إلغاء تلوين المحدد"
              >
                إلغاء
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setDeleteConfirmTarget({
                  type: 'batch',
                  ids: Array.from(selectedOrderIds),
                  title: 'حذف الأوامر المحددة',
                  message: `هل أنت متأكد من حذف (${selectedOrderIds.size}) أمر عمل محدد نهائياً من النظام؟`
                });
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>حذف المحدد</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedOrderIds(new Set())}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer mr-1"
              title="إلغاء التحديد"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}


      {/* Delete Table Protected Modal */}
      {isDeleteModalOpen && (
        <DeleteTableModal
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          officeTitle={officeTitle}
          currentOrdersCount={filteredOrders.length}
          totalOrdersCount={orders.length}
          onClearOfficeOrders={async (office) => {
            if (onClearOfficeOrders) {
              await onClearOfficeOrders(office);
            } else {
              await realtime.clearWorkOrders(office);
            }
          }}
          onClearAllOrders={async () => {
            if (onClearAllOrders) {
              await onClearAllOrders();
            } else {
              await realtime.clearWorkOrders();
            }
          }}
        />
      )}

      {/* Reusable In-App Confirmation Modal for Row & Batch Deletions */}
      {deleteConfirmTarget && (
        <ConfirmDeleteModal
          isOpen={!!deleteConfirmTarget}
          title={deleteConfirmTarget.title}
          message={deleteConfirmTarget.message}
          confirmText="نعم، حذف نهائي"
          cancelText="إلغاء الأمر"
          onConfirm={() => {
            if (!deleteConfirmTarget) return;
            if (deleteConfirmTarget.type === 'batch' && deleteConfirmTarget.ids) {
              if (onDeleteBatch) {
                onDeleteBatch(deleteConfirmTarget.ids);
              } else {
                deleteConfirmTarget.ids.forEach(id => onDelete(id));
              }
              setSelectedOrderIds(new Set());
            } else if ((deleteConfirmTarget.type === 'single' || deleteConfirmTarget.type === 'selected') && deleteConfirmTarget.order) {
              onDelete(deleteConfirmTarget.order.id);
              setSelectedOrderIds(prev => {
                const next = new Set(prev);
                next.delete(deleteConfirmTarget.order!.id);
                return next;
              });
              if (selectedOrderId === deleteConfirmTarget.order.id) {
                setSelectedOrderId(null);
              }
            }
            setDeleteConfirmTarget(null);
          }}
          onClose={() => setDeleteConfirmTarget(null)}
        />
      )}

      {/* Quality Notes Itemizer & Multi-Photo Attachment Modal */}
      {itemizerModalOrder && (
        <QualityNotesItemizerModal
          isOpen={!!itemizerModalOrder}
          onClose={() => setItemizerModalOrder(null)}
          order={itemizerModalOrder}
          onSave={(updatedOrder) => {
            if (onUpdateOrder) {
              onUpdateOrder(updatedOrder);
            } else {
              handleDirectCellUpdate(updatedOrder, 'qualityNotes', updatedOrder.qualityNotes || '');
            }
            setItemizerModalOrder(null);
          }}
          onCheckPermission={onCheckPermission}
        />
      )}

      {/* Cross-Table Match Inspection, Sync & Data Pulling Modal */}
      {viewingCrossMatchOrder && (
        <CrossTableMatchModal
          isOpen={Boolean(viewingCrossMatchOrder)}
          currentOrder={viewingCrossMatchOrder}
          matchedOrders={crossTableMatchesMap.get(viewingCrossMatchOrder.id) || []}
          onClose={() => setViewingCrossMatchOrder(null)}
          onApplyData={(updatedOrder) => {
            if (onUpdateOrder) {
              onUpdateOrder(updatedOrder);
            }
          }}
          currentUser={currentUser}
        />
      )}

      {/* Hidden input for direct cell file upload */}
      <input
        ref={cellFileInputRef}
        type="file"
        multiple
        accept="application/pdf,image/*"
        onChange={handleCellFileInputChange}
        className="hidden"
      />

      {/* Floating Inspection Card: Movable independent card for PDF and Photos audit */}
      {floatingInspectionOrder && (
        <FloatingInspectionCard
          isOpen={!!floatingInspectionOrder}
          order={floatingInspectionOrder}
          onClose={() => setFloatingInspectionOrder(null)}
          onUpdateOrder={(updated) => {
            if (onUpdateOrder) {
              onUpdateOrder(updated);
            }
            setFloatingInspectionOrder(updated);
          }}
          onNotification={(msg) => {
            setExportNotification(msg);
            setTimeout(() => setExportNotification(null), 3500);
          }}
        />
      )}

      {/* Online File Viewer Modal: Direct full interactive preview of PDF/Images without download */}
      {viewerModalFile && (
        <OnlineFileViewerModal
          isOpen={!!viewerModalFile}
          file={viewerModalFile}
          orderId={viewerModalOrder?.id}
          orderNumber={viewerModalOrder?.workOrderNumber}
          orderCode={viewerModalOrder?.workOrderCode}
          officeName={viewerModalOrder?.office}
          contractorName={viewerModalOrder?.contractor}
          onClose={() => {
            setViewerModalFile(null);
            setViewerModalOrder(null);
          }}
          onRename={handleRenameFileInOrder}
        />
      )}

      {/* Quality Notes Report Modal (تقرير الملاحظات والملاحظات المتكررة مع الصور المرفقة والتصدير الموحد) */}
      {isNotesReportOpen && (
        <QualityNotesReportModal
          isOpen={isNotesReportOpen}
          onClose={() => setIsNotesReportOpen(false)}
          orders={allOrders && allOrders.length > 0 ? allOrders : orders}
          offices={offices}
          initialMode={notesReportMode}
          initialContractor={notesReportContractor}
          activePeriodLabel={activeTableName || officeTitle}
          currentUser={currentUser}
        />
      )}

      {/* Audit Checklist Modal for PDC Audit & Construction Audit (القائمة الأساسية الموحدة + مراحل التدقيق للاطلاع مع تزامن فوري) */}
      {activeAuditModal && (
        <AuditChecklistModal
          isOpen={Boolean(activeAuditModal)}
          order={orders.find(o => o.id === activeAuditModal.order.id) || activeAuditModal.order}
          columnField={activeAuditModal.columnField}
          columnTitle={activeAuditModal.columnTitle}
          initialCategoryKey={activeAuditModal.initialCategoryKey}
          initialFocusField={activeAuditModal.initialFocusField}
          initialOpenStages={activeAuditModal.initialOpenStages}
          onClose={() => setActiveAuditModal(null)}
          canEdit={canUserEditColumn(currentUser, activeAuditModal.columnField)}
          onSave={async (updatedAuditData, shouldClose = false) => {
            const currentOrder = orders.find(o => o.id === activeAuditModal.order.id) || activeAuditModal.order;
            const { columnField, columnTitle } = activeAuditModal;
            await handleDirectCellUpdate(currentOrder, columnField, updatedAuditData);
            if (shouldClose) {
              setExportNotification(`تم حفظ وتحديث بيانات (${columnTitle}) بنجاح`);
              setTimeout(() => setExportNotification(null), 3000);
              try {
                soundService.playActionSound('update');
              } catch (_) {}
              setActiveAuditModal(null);
            }
          }}
        />
      )}

      {/* نافذة مراحل التدقيق المنبثقة للاطلاع فقط (عند الضغط على أيقونة مراحل التدقيق في الركن العلوي لبطاقة التدقيق) */}
      {activeStagesReferenceModal && (
        <AuditStagesReferenceModal
          isOpen={Boolean(activeStagesReferenceModal)}
          onClose={() => setActiveStagesReferenceModal(null)}
          order={orders.find(o => o.id === activeStagesReferenceModal.order.id) || activeStagesReferenceModal.order}
          columnTitle={activeStagesReferenceModal.columnTitle}
        />
      )}

      {/* External Technical Support Audit Checklist Card Modal (بطاقة نتائج تدقيق المساندة الفنية أو وضع العرض فقط لبطاقة حالة الإرفاق) */}
      {activeSupportAuditModal && (
        <TechnicalSupportAuditModal
          isOpen={Boolean(activeSupportAuditModal)}
          order={orders.find(o => o.id === activeSupportAuditModal.order.id) || activeSupportAuditModal.order}
          initialFocusField={activeSupportAuditModal.focusField}
          viewMode={activeSupportAuditModal.viewMode || 'audit'}
          canEdit={canUserEditColumn(currentUser, 'procedure155Status')}
          onClose={() => setActiveSupportAuditModal(null)}
          onSave={async (payload, shouldClose) => {
            const currentOrder = orders.find(o => o.id === activeSupportAuditModal.order.id) || activeSupportAuditModal.order;
            await handleSaveTechnicalSupportAudit(currentOrder, payload, shouldClose);
          }}
        />
      )}
    </div>
  );

  if (internalPresentationMode === 'overlay') {
    return (
      <div
        className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md p-2 sm:p-4 flex flex-col justify-center items-center overflow-y-auto animate-in fade-in duration-200"
        onClick={() => {
          setInternalPresentationMode('docked');
          if (onChangePresentationMode) onChangePresentationMode('docked');
        }}
      >
        <div
          className="w-full max-w-[98vw] max-h-[96vh] flex flex-col shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {tableInnerContent}
        </div>
      </div>
    );
  }

  return tableInnerContent;
};
