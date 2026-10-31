import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus,
  FileSpreadsheet,
  FileDown,
  Printer,
  Mail,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  TableProperties,
  Link2,
  Search,
  SlidersHorizontal,
  Trash2,
  AlertTriangle,
  RotateCcw,
  Edit3,
  FileText,
  Copy,
  Camera,
  Filter,
  ChevronDown,
  Maximize2,
  Minimize2,
  X,
  Presentation,
  Image as ImageIcon,
  Loader2,
  Lock,
  LayoutList,
  HardHat,
  ZoomIn,
  ZoomOut,
  Expand,
  Pin,
  WrapText,
  Palette,
  CalendarPlus,
  Layers,
  Check
} from 'lucide-react';
import { WorkOrder, PlatformUser } from '../types';
import { calculateSmartPopoverPosition, getPopoverStyle, TriggerRect } from '../utils/popoverPosition';
import { useUIDesignMode } from '../utils/uiDesignMode';

export type SmartQuickFilterMode =
  | 'all'
  | 'ready'
  | 'not_ready'
  | 'with_photos'
  | 'without_photos'
  | 'new_rows'
  | 'duplicate'
  | 'unmodified'
  | 'edited'
  | 'cross_table_match'
  | 'imported';

export type SmartToolbarMenuKey =
  | 'operations'
  | 'governance'
  | 'table_data'
  | 'filter'
  | 'view_display'
  | 'export'
  | 'security'
  | null;

interface TableSmartToolbarProps {
  // Counts & Stats
  totalOrdersCount: number;
  filteredOrdersCount: number;
  ready155Count: number;
  selectedOrderIdsCount: number;
  crossTableMatchesCount: number;
  newRowsCount: number;
  duplicateRowsCount: number;
  unmodifiedRowsCount: number;
  editedRowsCount: number;
  withPhotosCount: number;
  withoutPhotosCount: number;
  importedRowsCount?: number;
  selectedOrder?: WorkOrder | null;
  overallReadyRate: number;
  columnsCount: number;

  // Search & Filter State
  searchText: string;
  onSearchChange: (text: string) => void;
  smartQuickFilter: SmartQuickFilterMode;
  onSelectQuickFilter: (mode: SmartQuickFilterMode) => void;
  activeColumnFiltersCount?: number;
  onClearAllColumnFilters?: () => void;

  // Actions
  onOpenAddModal: () => void;
  onOpenImportModal?: () => void;
  onOpenCompatibleImport?: () => void;
  onOpenEditStatus?: () => void;
  onOpenEditBasicData?: () => void;
  onOpenSmartAudit?: () => void;
  onBulkApprove155?: () => void;
  onOpenColumnManager?: () => void;
  onOpenDropdownManager?: () => void;
  onDeleteSelectedOrders?: () => void;
  onDeleteSingleOrder?: () => void;
  onOpenDeleteTableModal?: () => void;
  onOpenDataRecovery?: () => void;
  onOpenYearMonthPicker?: () => void;

  // Visual Display, Zoom, Containment & Row Coloring
  zoomPercent?: number;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onZoomReset?: () => void;
  onAutoFitAll?: () => void;
  isAutoFitToScreen?: boolean;
  onToggleAutoFitToScreen?: () => void;
  isFullyExpanded?: boolean;
  onToggleFullyExpanded?: () => void;
  isStickyCoreColumns?: boolean;
  onToggleStickyCoreColumns?: () => void;
  isWrapTextEnabled?: boolean;
  onToggleWrapText?: () => void;
  tableDensity?: 'compact' | 'normal' | 'spacious';
  onChangeTableDensity?: (density: 'compact' | 'normal' | 'spacious') => void;
  onSetRowColor?: (color: string | null) => void;
  onClearAllRowColors?: () => void;
  hasCustomRowColors?: boolean;

  // Export
  exportScope: 'all' | 'filtered' | 'selected';
  onSetExportScope: (scope: 'all' | 'filtered' | 'selected') => void;
  onOpenComprehensiveExportModal?: (openEmail?: boolean) => void;
  onDirectExportExcel: () => void;
  onDirectExportPdf: () => void;
  onDirectExportPptx: () => void;
  onDirectExportImage: () => void;
  onDirectExportCsv: () => void;
  onInstantPrint: () => void;
  isExportingPdf?: boolean;
  isExportingImage?: boolean;

  // Presentation Mode & Collapse
  presentationMode: 'docked' | 'overlay';
  onTogglePresentationMode: () => void;
  onCloseTable?: () => void;

  // Notes Report
  onOpenNotesReport?: (mode?: 'all' | 'recurring_all' | 'recurring_contractor', contractor?: string) => void;
  contractorsList?: string[];

  // Auth & Permissions
  currentUser?: PlatformUser | null;
}

export const TableSmartToolbar: React.FC<TableSmartToolbarProps> = ({
  totalOrdersCount,
  filteredOrdersCount,
  ready155Count,
  selectedOrderIdsCount,
  crossTableMatchesCount,
  newRowsCount,
  duplicateRowsCount,
  unmodifiedRowsCount,
  editedRowsCount,
  withPhotosCount,
  withoutPhotosCount,
  importedRowsCount = 0,
  selectedOrder,
  overallReadyRate,
  columnsCount,
  searchText,
  onSearchChange,
  smartQuickFilter,
  onSelectQuickFilter,
  activeColumnFiltersCount = 0,
  onClearAllColumnFilters,
  onOpenAddModal,
  onOpenImportModal,
  onOpenCompatibleImport,
  onOpenEditStatus,
  onOpenEditBasicData,
  onOpenSmartAudit,
  onBulkApprove155,
  onOpenColumnManager,
  onOpenDropdownManager,
  onDeleteSelectedOrders,
  onDeleteSingleOrder,
  onOpenDeleteTableModal,
  onOpenDataRecovery,
  onOpenYearMonthPicker,
  zoomPercent = 100,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onAutoFitAll,
  isAutoFitToScreen = false,
  onToggleAutoFitToScreen,
  isFullyExpanded = false,
  onToggleFullyExpanded,
  isStickyCoreColumns = true,
  onToggleStickyCoreColumns,
  isWrapTextEnabled = true,
  onToggleWrapText,
  tableDensity = 'normal',
  onChangeTableDensity,
  onSetRowColor,
  onClearAllRowColors,
  hasCustomRowColors = false,
  exportScope,
  onSetExportScope,
  onOpenComprehensiveExportModal,
  onDirectExportExcel,
  onDirectExportPdf,
  onDirectExportPptx,
  onDirectExportImage,
  onDirectExportCsv,
  onInstantPrint,
  isExportingPdf,
  isExportingImage,
  presentationMode,
  onTogglePresentationMode,
  onCloseTable,
  onOpenNotesReport,
  contractorsList
}) => {
  const [uiMode] = useUIDesignMode();
  const isERP = uiMode === 'official_erp';
  const [activeMenu, setActiveMenu] = useState<SmartToolbarMenuKey>(null);
  const [menuAnchorRect, setMenuAnchorRect] = useState<TriggerRect | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const popoverMenuRef = useRef<HTMLDivElement>(null);

  // Close menus on click outside or Escape, and keep anchor coordinates synced on scroll/resize
  useEffect(() => {
    if (!activeMenu) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (popoverMenuRef.current && popoverMenuRef.current.contains(target)) {
        return;
      }
      if (containerRef.current && containerRef.current.contains(target)) {
        return;
      }
      setActiveMenu(null);
      setMenuAnchorRect(null);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveMenu(null);
        setMenuAnchorRect(null);
      }
    };

    const updateAnchorCoordinates = () => {
      const trigger = containerRef.current?.querySelector(`[data-menu-trigger="${activeMenu}"]`);
      if (trigger) {
        const rect = trigger.getBoundingClientRect();
        setMenuAnchorRect({
          top: rect.top,
          bottom: rect.bottom,
          left: rect.left,
          right: rect.right,
          width: rect.width,
          height: rect.height
        });
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', updateAnchorCoordinates, { passive: true });
    window.addEventListener('resize', updateAnchorCoordinates);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', updateAnchorCoordinates);
      window.removeEventListener('resize', updateAnchorCoordinates);
    };
  }, [activeMenu]);

  const toggleMenu = (menu: Exclude<SmartToolbarMenuKey, null>, e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeMenu === menu) {
      setActiveMenu(null);
      setMenuAnchorRect(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      setMenuAnchorRect({
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
        width: rect.width,
        height: rect.height
      });
      setActiveMenu(menu);
    }
  };

  const getFilterLabel = () => {
    switch (smartQuickFilter) {
      case 'ready':
        return 'جاهز 155';
      case 'not_ready':
        return 'نواقص';
      case 'with_photos':
        return 'بصور';
      case 'without_photos':
        return 'بدون صور';
      case 'new_rows':
        return 'مضافة جديدة';
      case 'duplicate':
        return 'مكررة';
      case 'unmodified':
        return 'غير معدلة';
      case 'edited':
        return 'معدلة';
      case 'cross_table_match':
        return 'متطابقة الجداول';
      case 'imported':
        return 'مستوردة';
      default:
        return activeColumnFiltersCount > 0 ? `فلاتر (${activeColumnFiltersCount})` : 'الفلترة والتصفية';
    }
  };

  const isDataViewFilterActive =
    smartQuickFilter === 'new_rows' ||
    smartQuickFilter === 'duplicate' ||
    smartQuickFilter === 'unmodified' ||
    smartQuickFilter === 'edited' ||
    smartQuickFilter === 'imported' ||
    smartQuickFilter === 'cross_table_match';

  return (
    <div
      ref={containerRef}
      className="relative w-full border-b px-2.5 py-2 sm:px-4 select-none font-['Cairo',sans-serif] bg-slate-50 border-slate-200 text-slate-800"
    >
      {/* =========================================================================
          SINGLE UNIFIED WORLD-CLASS COMMAND BAR ROW (كل الأيقونات مجمعة في سطر واحد متكامل)
          ========================================================================= */}
      <div className="flex items-center justify-between gap-1.5 sm:gap-2 overflow-x-auto scrollbar-none flex-nowrap text-xs">
        
        {/* RIGHT / START CLUSTER: Instant Search + Grouped Command Hubs */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          
          {/* 0. البحث الفوري المباشر (Instant Search Input) */}
          <div className="relative w-36 sm:w-44 md:w-52 shrink-0">
            <input
              type="text"
              value={searchText}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="بحث فوري بالجدول..."
              className="w-full pl-6 pr-7 py-1.5 text-xs h-8.5 font-bold transition-all focus:outline-none rounded-xl bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-2xs"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            {searchText && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                title="مسح البحث"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className={`h-6 w-px shrink-0 ${isERP ? 'bg-slate-300' : 'bg-slate-800'}`} />

          {/* 1. أيقونة الإدخال والعمليات (Operations, Import & Edit Hub) */}
          <div className="flex items-center gap-1 p-0.5 shrink-0 bg-white rounded-xl border border-slate-300 shadow-2xs">
            {/* زر سريع لإضافة أمر بنقرة واحدة */}
            <button
              type="button"
              onClick={onOpenAddModal}
              className="h-7.5 px-2.5 font-black text-xs flex items-center gap-1 cursor-pointer transition-all rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-2xs active:scale-95"
              title="إضافة أمر عمل جديد فوراً"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إضافة</span>
            </button>

            {/* القائمة المنسدلة الشاملة للإدخال والاستيراد والتعديل */}
            <button
              type="button"
              data-menu-trigger="operations"
              onClick={(e) => toggleMenu('operations', e)}
              className={`h-7.5 px-2.5 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer border ${
                activeMenu === 'operations'
                  ? 'rounded-lg bg-blue-100 text-blue-900 border-blue-400 font-black'
                  : 'rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
              }`}
              title="قائمة الإدخال، استيراد Excel، استيراد المتوافق، وتعديل أوامر العمل"
            >
              <Layers className="w-3.5 h-3.5 text-blue-700" />
              <span>الإدخال والعمليات</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${activeMenu === 'operations' ? 'rotate-180' : 'text-slate-400'}`} />
            </button>
          </div>

          {/* 2. أيقونة حوكمة وتدقيق 155 والملاحظات */}
          <button
            type="button"
            data-menu-trigger="governance"
            onClick={(e) => toggleMenu('governance', e)}
            className={`h-8.5 px-3 text-xs flex items-center gap-1.5 transition-all cursor-pointer border rounded-xl shrink-0 ${
              activeMenu === 'governance'
                ? 'bg-emerald-600 text-white border-emerald-700 font-black shadow-2xs'
                : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-300 font-bold shadow-2xs'
            }`}
            title="اعتماد مؤهل 155، وتقارير الملاحظات والملاحظات المتكررة"
          >
            <ShieldCheck className={`w-4 h-4 shrink-0 ${activeMenu === 'governance' ? 'text-amber-200' : 'text-emerald-700'}`} />
            <span>حوكمة وتدقيق 155</span>
            <span className={`font-mono text-[10px] px-1.5 py-0.2 rounded ${
              activeMenu === 'governance'
                ? 'bg-emerald-700 text-white font-black'
                : 'bg-emerald-50 text-emerald-800 border border-emerald-250 font-black'
            }`}>
              {overallReadyRate}%
            </span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${activeMenu === 'governance' ? 'rotate-180' : 'text-slate-400'}`} />
          </button>

          {/* 3. أيقونة بيانات وتطابق الجداول */}
          <button
            type="button"
            data-menu-trigger="table_data"
            onClick={(e) => toggleMenu('table_data', e)}
            className={`h-8.5 px-3 text-xs flex items-center gap-1.5 transition-all cursor-pointer border rounded-xl shrink-0 ${
              activeMenu === 'table_data' || isDataViewFilterActive
                ? 'bg-blue-600 text-white border-blue-700 font-black shadow-2xs'
                : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-300 font-bold shadow-2xs'
            }`}
            title="تطابق الجداول المتقاطعة وحالات أسطر الجدول (جديدة، مستوردة، مكررة، معدلة، غير معدلة)"
          >
            <TableProperties className={`w-4 h-4 shrink-0 ${activeMenu === 'table_data' || isDataViewFilterActive ? 'text-amber-200' : 'text-blue-700'}`} />
            <span>بيانات وتطابق الجداول</span>
            {crossTableMatchesCount > 0 && (
              <span className={`font-mono text-[10px] px-1.5 py-0.2 rounded ${
                activeMenu === 'table_data'
                  ? 'bg-blue-700 text-white font-black'
                  : 'bg-amber-50 text-amber-900 border border-amber-300 font-black'
              }`}>
                {crossTableMatchesCount}
              </span>
            )}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${activeMenu === 'table_data' ? 'rotate-180' : 'text-slate-400'}`} />
          </button>

          {/* 4. أيقونة الفلترة والتصفية الذكية */}
          <button
            type="button"
            data-menu-trigger="filter"
            onClick={(e) => toggleMenu('filter', e)}
            className={`h-8.5 px-3 text-xs flex items-center gap-1.5 transition-all cursor-pointer border rounded-xl shrink-0 ${
              activeMenu === 'filter' || smartQuickFilter !== 'all' || activeColumnFiltersCount > 0
                ? 'bg-indigo-600 text-white border-indigo-700 font-black shadow-2xs'
                : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-300 font-bold shadow-2xs'
            }`}
            title="التصفية السريعة للأوامر وفلاتر الأعمدة النشطة"
          >
            <Filter className={`w-3.5 h-3.5 shrink-0 ${activeMenu === 'filter' || smartQuickFilter !== 'all' || activeColumnFiltersCount > 0 ? 'text-amber-200' : 'text-indigo-700'}`} />
            <span>{getFilterLabel()}</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${activeMenu === 'filter' ? 'rotate-180' : 'text-slate-400'}`} />
          </button>
        </div>

        {/* LEFT / END CLUSTER: Display & Columns + Export & Share + Security & Table Management */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          
          {/* 5. أيقونة العرض المرئي والأعمدة وتلوين الصفوف */}
          <button
            type="button"
            data-menu-trigger="view_display"
            onClick={(e) => toggleMenu('view_display', e)}
            className={`h-8.5 px-3 text-xs flex items-center gap-1.5 transition-all cursor-pointer border rounded-xl shrink-0 ${
              activeMenu === 'view_display'
                ? 'bg-slate-800 text-white border-slate-900 font-black shadow-2xs'
                : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-300 font-bold shadow-2xs'
            }`}
            title="إدارة الأعمدة والقوائم، خيارات العرض المرئي، التكبير والتصغير، تثبيت الأعمدة، وتلوين الصفوف"
          >
            <SlidersHorizontal className={`w-3.5 h-3.5 shrink-0 ${activeMenu === 'view_display' ? 'text-amber-200' : 'text-slate-700'}`} />
            <span>العرض والأعمدة</span>
            <span className={`font-mono text-[10px] px-1.5 py-0.2 rounded ${
              activeMenu === 'view_display'
                ? 'bg-slate-700 text-white font-black'
                : 'bg-slate-100 text-slate-700 border border-slate-300 font-black'
            }`}>
              {columnsCount}
            </span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${activeMenu === 'view_display' ? 'rotate-180' : 'text-slate-400'}`} />
          </button>

          {/* 6. أيقونة التصدير والمشاركة والطباعة */}
          <button
            type="button"
            data-menu-trigger="export"
            onClick={(e) => toggleMenu('export', e)}
            className={`h-8.5 px-3 text-xs flex items-center gap-1.5 transition-all cursor-pointer border rounded-xl shrink-0 ${
              activeMenu === 'export'
                ? 'bg-slate-800 text-white border-slate-900 font-black shadow-2xs'
                : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-300 font-bold shadow-2xs'
            }`}
            title="تصدير شامل (Excel, PDF, PowerPoint, صور, CSV)، طباعة فورية، أو مشاركة بالإيميل"
          >
            <FileDown className={`w-4 h-4 shrink-0 ${activeMenu === 'export' ? 'text-amber-200' : 'text-slate-700'}`} />
            <span>التصدير والمشاركة</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${activeMenu === 'export' ? 'rotate-180 text-white' : 'text-slate-400'}`} />
          </button>

          {/* 7. أيقونة إدارة الجدول والأمان السحابي */}
          <button
            type="button"
            data-menu-trigger="security"
            onClick={(e) => toggleMenu('security', e)}
            className={`h-8.5 px-3 text-xs flex items-center gap-1.5 transition-all cursor-pointer border rounded-xl shrink-0 ${
              selectedOrderIdsCount > 0
                ? 'bg-rose-700 text-white border-rose-800 font-black shadow-2xs'
                : activeMenu === 'security'
                ? 'bg-slate-800 text-white border-slate-900 font-black shadow-2xs'
                : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-300 font-bold shadow-2xs'
            }`}
            title="الأمان السحابي، تحديد السنة والشهر، وضع عرض البطاقة، وإدارة الحذف"
          >
            <ShieldCheck className={`w-4 h-4 shrink-0 ${selectedOrderIdsCount > 0 ? 'text-white' : activeMenu === 'security' ? 'text-amber-200' : 'text-slate-700'}`} />
            <span>الأمان وإدارة الجدول</span>
            {selectedOrderIdsCount > 0 && (
              <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-black/30 text-white font-black">
                {selectedOrderIdsCount} محدد
              </span>
            )}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${activeMenu === 'security' ? 'rotate-180' : 'text-slate-400'}`} />
          </button>

        </div>
      </div>

      {/* =========================================================================
          SMART FLOATING POPUP MENUS PORTAL (فوق الصفحة دائماً بدون أي اختفاء أو قص):
          Rendered directly into document.body with fixed viewport containment
          ========================================================================= */}
      {activeMenu && menuAnchorRect && typeof document !== 'undefined' && createPortal(
        (() => {
          let estimatedH = 320;
          let preferredW = 310;
          if (activeMenu === 'operations') {
            estimatedH = 340;
            preferredW = 310;
          } else if (activeMenu === 'governance') {
            estimatedH = 440;
            preferredW = 330;
          } else if (activeMenu === 'table_data') {
            estimatedH = 380;
            preferredW = 310;
          } else if (activeMenu === 'filter') {
            estimatedH = 370;
            preferredW = 300;
          } else if (activeMenu === 'view_display') {
            estimatedH = 490;
            preferredW = 350;
          } else if (activeMenu === 'export') {
            estimatedH = 390;
            preferredW = 340;
          } else if (activeMenu === 'security') {
            estimatedH = 350;
            preferredW = 310;
          }

          const pos = calculateSmartPopoverPosition(menuAnchorRect, estimatedH, {
            preferredWidth: preferredW,
            maxHeight: 540,
            align: 'end'
          });

          return (
            <div
              ref={popoverMenuRef}
              style={getPopoverStyle(pos)}
              className="bg-slate-900/98 backdrop-blur-xl border-2 border-slate-700 rounded-2xl shadow-2xl p-3 z-[999999] text-right space-y-2 animate-in fade-in zoom-in-95 duration-150 ring-4 ring-black/40 overflow-y-auto font-['Cairo',sans-serif]"
              dir="rtl"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              {/* -----------------------------------------------------------------
                  MENU 1: الإدخال والعمليات والتعديل (OPERATIONS & IMPORT & EDIT)
                  ----------------------------------------------------------------- */}
              {activeMenu === 'operations' && (
                <>
                  <div className="flex items-center justify-between pb-2 mb-1 border-b border-slate-800">
                    <span className="text-xs font-black text-cyan-300 flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-cyan-400" />
                      <span>الإدخال والاستيراد والعمليات</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveMenu(null)}
                      className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* إضافة أمر عمل جديد */}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveMenu(null);
                      onOpenAddModal();
                    }}
                    className="w-full px-3 py-2.5 rounded-xl text-xs font-black text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 flex items-center justify-between cursor-pointer transition-all shadow-xs"
                  >
                    <div className="flex items-center gap-2">
                      <Plus className="w-4 h-4 text-white" />
                      <span>إضافة أمر عمل جديد</span>
                    </div>
                    <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-mono">صف جديد</span>
                  </button>

                  {/* استيراد من ملف Excel */}
                  {onOpenImportModal && (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveMenu(null);
                        onOpenImportModal();
                      }}
                      className="w-full px-3 py-2 rounded-xl text-xs font-bold text-slate-100 bg-slate-800 hover:bg-emerald-600 hover:text-white flex items-center justify-between cursor-pointer transition-colors border border-slate-700"
                    >
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                        <span>استيراد أوامر العمل من ملف Excel</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">.xlsx</span>
                    </button>
                  )}

                  {/* قسم تعديل أمر العمل المحدد */}
                  <div className="pt-2 mt-1 border-t border-slate-800 space-y-1.5">
                    <div className="px-2.5 py-1.5 bg-slate-800/90 rounded-xl text-[11px] text-slate-300 flex items-center justify-between">
                      <span className="font-bold text-amber-300">أمر العمل النشط للتعديل:</span>
                      {selectedOrder ? (
                        <span className="font-mono font-black text-white bg-blue-600/40 px-2 py-0.5 rounded border border-blue-400/30">
                          #{selectedOrder.workOrderNumber}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[10px]">تلقائي (أول صف)</span>
                      )}
                    </div>

                    {onOpenEditStatus && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveMenu(null);
                          onOpenEditStatus();
                        }}
                        className="w-full px-3 py-2 rounded-xl text-xs font-bold text-slate-200 bg-slate-800/70 hover:bg-blue-600 hover:text-white flex items-center gap-2 cursor-pointer transition-colors"
                      >
                        <Edit3 className="w-4 h-4 text-blue-400" />
                        <span>تعديل حالة الأمر وملاحظات 155</span>
                      </button>
                    )}

                    {onOpenEditBasicData && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveMenu(null);
                          onOpenEditBasicData();
                        }}
                        className="w-full px-3 py-2 rounded-xl text-xs font-bold text-slate-200 bg-slate-800/70 hover:bg-indigo-600 hover:text-white flex items-center gap-2 cursor-pointer transition-colors"
                      >
                        <FileText className="w-4 h-4 text-indigo-400" />
                        <span>تعديل البيانات الأساسية للأمر</span>
                      </button>
                    )}
                  </div>
                </>
              )}

              {/* -----------------------------------------------------------------
                  MENU 2: حوكمة وتدقيق 155 وتقارير الملاحظات (GOVERNANCE & NOTES)
                  ----------------------------------------------------------------- */}
              {activeMenu === 'governance' && (
                <>
                  <div className="flex items-center justify-between pb-2 mb-1 border-b border-slate-800">
                    <span className="text-xs font-black text-emerald-300 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span>حوكمة 155 وتقارير الملاحظات</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveMenu(null)}
                      className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>



                  {/* اعتماد جماعي لمؤهل 155 */}
                  {onBulkApprove155 && (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveMenu(null);
                        onBulkApprove155();
                      }}
                      className="w-full px-3 py-2 rounded-xl text-xs font-bold text-emerald-200 bg-emerald-950/60 hover:bg-emerald-600 hover:text-white flex items-center justify-between cursor-pointer transition-colors border border-emerald-500/30"
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>اعتماد جماعي لكافة الأوامر المؤهلة 155</span>
                      </div>
                      <span className="font-mono text-[10px] bg-black/40 px-1.5 py-0.5 rounded text-emerald-300">
                        {ready155Count} أمر
                      </span>
                    </button>
                  )}

                  {/* قسم تقارير الملاحظات والملاحظات المتكررة */}
                  {onOpenNotesReport && (
                    <div className="pt-2 mt-1 border-t border-slate-800 space-y-1.5">
                      <div className="text-[11px] font-black text-amber-300 flex items-center gap-1.5 px-1">
                        <FileText className="w-3.5 h-3.5 text-amber-400" />
                        <span>تقارير ملاحظات الجودة والتكرار بالصور:</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setActiveMenu(null);
                          onOpenNotesReport('all');
                        }}
                        className="w-full px-3 py-2 rounded-xl text-xs font-bold text-slate-200 bg-slate-800/80 hover:bg-amber-600 hover:text-white flex items-center justify-between cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-amber-400" />
                          <span>تقرير جميع الملاحظات الشامل</span>
                        </div>
                        <span className="text-[10px] bg-black/40 px-1.5 py-0.5 rounded text-amber-300">كاملة بالصور</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setActiveMenu(null);
                          onOpenNotesReport('recurring_all');
                        }}
                        className="w-full px-3 py-2 rounded-xl text-xs font-bold text-slate-200 bg-slate-800/80 hover:bg-rose-600 hover:text-white flex items-center justify-between cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <RotateCcw className="w-4 h-4 text-rose-400" />
                          <span>الملاحظات المتكررة (على الجميع)</span>
                        </div>
                        <span className="text-[10px] bg-rose-950 text-rose-200 px-1.5 py-0.5 rounded border border-rose-500/30">تحليل عام</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setActiveMenu(null);
                          onOpenNotesReport('recurring_contractor');
                        }}
                        className="w-full px-3 py-2 rounded-xl text-xs font-bold text-slate-200 bg-slate-800/80 hover:bg-blue-600 hover:text-white flex items-center justify-between cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <HardHat className="w-4 h-4 text-blue-400" />
                          <span>الملاحظات المتكررة حسب المقاول...</span>
                        </div>
                        <span className="text-[10px] text-blue-300">تخصيص</span>
                      </button>

                      {contractorsList && contractorsList.length > 0 && (
                        <div className="max-h-32 overflow-y-auto space-y-0.5 pr-1 pt-1 border-t border-slate-800/80">
                          {contractorsList.slice(0, 8).map((contractorName) => (
                            <button
                              key={contractorName}
                              type="button"
                              onClick={() => {
                                setActiveMenu(null);
                                onOpenNotesReport('recurring_contractor', contractorName);
                              }}
                              className="w-full px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-slate-300 hover:bg-slate-800 hover:text-blue-300 flex items-center justify-between cursor-pointer transition-colors"
                            >
                              <span className="truncate">{contractorName}</span>
                              <span className="text-[9px] text-slate-500">عرض المتكررة</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* -----------------------------------------------------------------
                  MENU 3: بيانات وتطابق الجداول (TABLE DATA & CROSS-TABLE MATCHES)
                  ----------------------------------------------------------------- */}
              {activeMenu === 'table_data' && (
                <>
                  <div className="flex items-center justify-between pb-2 mb-1 border-b border-slate-800">
                    <span className="text-xs font-black text-amber-300 flex items-center gap-1.5">
                      <TableProperties className="w-4 h-4 text-amber-400" />
                      <span>بيانات وتطابق الجداول</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectQuickFilter('all');
                        setActiveMenu(null);
                      }}
                      className="text-[10px] font-bold text-cyan-300 hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>عرض الكل ({totalOrdersCount})</span>
                    </button>
                  </div>

                  {/* تطابق الجداول المتقاطعة */}
                  <button
                    type="button"
                    onClick={() => {
                      const next = smartQuickFilter === 'cross_table_match' ? 'all' : 'cross_table_match';
                      onSelectQuickFilter(next);
                      setActiveMenu(null);
                    }}
                    className={`w-full px-3 py-2.5 rounded-xl text-xs font-black flex items-center justify-between cursor-pointer transition-all border ${
                      smartQuickFilter === 'cross_table_match'
                        ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white border-amber-300 shadow-md'
                        : 'bg-orange-950/60 hover:bg-orange-700 text-orange-100 border-orange-500/40'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Link2 className="w-4 h-4 text-amber-300" />
                      <span>تطابق وربط الجداول المتقاطعة</span>
                    </div>
                    <span className="font-mono text-[10px] bg-black/40 px-2 py-0.5 rounded text-amber-200">
                      {crossTableMatchesCount} متطابق
                    </span>
                  </button>

                  <div className="pt-1.5 border-t border-slate-800 space-y-1">
                    <div className="px-1 text-[10px] font-black text-slate-400">
                      تصفية حسب حالة السجل في الجدول:
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        onSelectQuickFilter('new_rows');
                        setActiveMenu(null);
                      }}
                      className={`w-full px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between cursor-pointer transition-colors ${
                        smartQuickFilter === 'new_rows' ? 'bg-emerald-600 text-white' : 'text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                        <span>الأسطر المضافة جديدة</span>
                      </div>
                      <span className="font-mono text-[10px] bg-black/40 px-1.5 py-0.5 rounded text-emerald-300">{newRowsCount}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onSelectQuickFilter('imported');
                        setActiveMenu(null);
                      }}
                      className={`w-full px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between cursor-pointer transition-colors ${
                        smartQuickFilter === 'imported' ? 'bg-cyan-600 text-white' : 'text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                        <span>الأسطر المستوردة المتوافقة</span>
                      </div>
                      <span className="font-mono text-[10px] bg-black/40 px-1.5 py-0.5 rounded text-cyan-300">{importedRowsCount}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onSelectQuickFilter('duplicate');
                        setActiveMenu(null);
                      }}
                      className={`w-full px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between cursor-pointer transition-colors ${
                        smartQuickFilter === 'duplicate' ? 'bg-blue-600 text-white' : 'text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Copy className="w-3.5 h-3.5 text-blue-400" />
                        <span>الأسطر المكررة</span>
                      </div>
                      <span className="font-mono text-[10px] bg-black/40 px-1.5 py-0.5 rounded text-blue-300">{duplicateRowsCount}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onSelectQuickFilter('edited');
                        setActiveMenu(null);
                      }}
                      className={`w-full px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between cursor-pointer transition-colors ${
                        smartQuickFilter === 'edited' ? 'bg-rose-600 text-white' : 'text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Edit3 className="w-3.5 h-3.5 text-rose-400" />
                        <span>الأسطر المعدل عليها</span>
                      </div>
                      <span className="font-mono text-[10px] bg-black/40 px-1.5 py-0.5 rounded text-rose-300">{editedRowsCount}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onSelectQuickFilter('unmodified');
                        setActiveMenu(null);
                      }}
                      className={`w-full px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between cursor-pointer transition-colors ${
                        smartQuickFilter === 'unmodified' ? 'bg-teal-600 text-white' : 'text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
                        <span>الأسطر غير المعدل عليها</span>
                      </div>
                      <span className="font-mono text-[10px] bg-black/40 px-1.5 py-0.5 rounded text-teal-300">{unmodifiedRowsCount}</span>
                    </button>
                  </div>
                </>
              )}

              {/* -----------------------------------------------------------------
                  MENU 4: الفلترة والتصفية الذكية (SMART FILTERS)
                  ----------------------------------------------------------------- */}
              {activeMenu === 'filter' && (
                <>
                  <div className="flex items-center justify-between pb-2 mb-1 border-b border-slate-800">
                    <span className="text-xs font-black text-cyan-300 flex items-center gap-1.5">
                      <Filter className="w-4 h-4 text-cyan-400" />
                      <span>الفلترة والتصفية الفورية</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveMenu(null)}
                      className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {activeColumnFiltersCount > 0 && onClearAllColumnFilters && (
                    <button
                      type="button"
                      onClick={() => {
                        onClearAllColumnFilters();
                        setActiveMenu(null);
                      }}
                      className="w-full px-3 py-2 rounded-xl text-xs font-black bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-400/40 flex items-center justify-between cursor-pointer transition-colors mb-1"
                    >
                      <div className="flex items-center gap-1.5">
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>إلغاء فلاتر الأعمدة النشطة ({activeColumnFiltersCount})</span>
                      </div>
                      <span className="text-[10px] font-bold">إعادة ضبط</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      onSelectQuickFilter('all');
                      setActiveMenu(null);
                    }}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between cursor-pointer transition-colors ${
                      smartQuickFilter === 'all' ? 'bg-blue-600 text-white font-black' : 'text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    <span>عرض كافة الأوامر (الكل)</span>
                    <span className="font-mono text-[10px] bg-black/30 px-1.5 py-0.5 rounded">{totalOrdersCount}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onSelectQuickFilter('ready');
                      setActiveMenu(null);
                    }}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between cursor-pointer transition-colors ${
                      smartQuickFilter === 'ready' ? 'bg-emerald-600 text-white font-black' : 'text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>جاهز للاستلام 155</span>
                    </span>
                    <span className="font-mono text-[10px] bg-black/30 px-1.5 py-0.5 rounded">{ready155Count}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onSelectQuickFilter('not_ready');
                      setActiveMenu(null);
                    }}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between cursor-pointer transition-colors ${
                      smartQuickFilter === 'not_ready' ? 'bg-rose-600 text-white font-black' : 'text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                      <span>نواقص وملاحظات</span>
                    </span>
                    <span className="font-mono text-[10px] bg-black/30 px-1.5 py-0.5 rounded">{totalOrdersCount - ready155Count}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onSelectQuickFilter('with_photos');
                      setActiveMenu(null);
                    }}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between cursor-pointer transition-colors ${
                      smartQuickFilter === 'with_photos' ? 'bg-cyan-600 text-white font-black' : 'text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Camera className="w-3.5 h-3.5 text-cyan-400" />
                      <span>أوامر بمرفق صور</span>
                    </span>
                    <span className="font-mono text-[10px] bg-black/30 px-1.5 py-0.5 rounded">{withPhotosCount}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onSelectQuickFilter('without_photos');
                      setActiveMenu(null);
                    }}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between cursor-pointer transition-colors ${
                      smartQuickFilter === 'without_photos' ? 'bg-amber-600 text-white font-black' : 'text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    <span>أوامر بدون صور</span>
                    <span className="font-mono text-[10px] bg-black/30 px-1.5 py-0.5 rounded">{withoutPhotosCount}</span>
                  </button>
                </>
              )}

              {/* -----------------------------------------------------------------
                  MENU 5: العرض المرئي والأعمدة وتلوين الصفوف (VIEW, COLUMNS & COLORS)
                  ----------------------------------------------------------------- */}
              {activeMenu === 'view_display' && (
                <>
                  <div className="flex items-center justify-between pb-2 mb-1 border-b border-slate-800">
                    <span className="text-xs font-black text-purple-300 flex items-center gap-1.5">
                      <SlidersHorizontal className="w-4 h-4 text-purple-400" />
                      <span>هيكلة الأعمدة وخيارات العرض المرئي</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveMenu(null)}
                      className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* 1. إدارة الأعمدة والقوائم */}
                  <div className="grid grid-cols-2 gap-1.5">
                    {onOpenColumnManager && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveMenu(null);
                          onOpenColumnManager();
                        }}
                        className="px-2.5 py-2 rounded-xl bg-purple-950/70 hover:bg-purple-600 text-purple-200 hover:text-white border border-purple-500/40 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5 text-purple-300" />
                        <span>الأعمدة ({columnsCount})</span>
                      </button>
                    )}

                    {onOpenDropdownManager && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveMenu(null);
                          onOpenDropdownManager();
                        }}
                        className="px-2.5 py-2 rounded-xl bg-indigo-950/70 hover:bg-indigo-600 text-indigo-200 hover:text-white border border-indigo-500/40 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <LayoutList className="w-3.5 h-3.5 text-indigo-300" />
                        <span>إدارة القوائم</span>
                      </button>
                    )}
                  </div>

                  {/* 2. احتواء تلقائي وتكبير/تصغير (Zoom) */}
                  <div className="pt-2 border-t border-slate-800 space-y-2">
                    {onAutoFitAll && (
                      <button
                        type="button"
                        onClick={() => {
                          onAutoFitAll();
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white text-xs font-black flex items-center justify-between cursor-pointer shadow-xs transition-all"
                      >
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                          <span>احتواء تلقائي شامل للأعمدة والصفوف</span>
                        </div>
                        <span className="text-[10px] bg-black/25 px-1.5 py-0.5 rounded">فوري</span>
                      </button>
                    )}

                    {/* Zoom Bar */}
                    <div className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-slate-800/90 border border-slate-700">
                      <span className="text-xs font-bold text-slate-300">حجم عرض الجدول (Zoom):</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={onZoomOut}
                          className="p-1 rounded-lg bg-slate-900 hover:bg-slate-700 text-slate-200 cursor-pointer"
                          title="تصغير"
                        >
                          <ZoomOut className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={onZoomReset}
                          className="px-2 py-0.5 rounded-md bg-slate-950 text-amber-300 font-mono text-xs font-black cursor-pointer"
                          title="إعادة ضبط إلى 100%"
                        >
                          {zoomPercent}%
                        </button>
                        <button
                          type="button"
                          onClick={onZoomIn}
                          className="p-1 rounded-lg bg-slate-900 hover:bg-slate-700 text-slate-200 cursor-pointer"
                          title="تكبير"
                        >
                          <ZoomIn className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Visual Toggles 2x2 Grid */}
                    <div className="grid grid-cols-2 gap-1.5">
                      {onToggleStickyCoreColumns && (
                        <button
                          type="button"
                          onClick={onToggleStickyCoreColumns}
                          className={`px-2.5 py-2 rounded-xl text-[11px] font-bold flex items-center justify-between cursor-pointer border transition-colors ${
                            isStickyCoreColumns
                              ? 'bg-amber-600/30 text-amber-200 border-amber-400/50'
                              : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                          }`}
                        >
                          <span className="flex items-center gap-1 truncate">
                            <Pin className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                            <span className="truncate">تثبيت الأعمدة</span>
                          </span>
                          {isStickyCoreColumns && <Check className="w-3 h-3 text-amber-300 shrink-0" />}
                        </button>
                      )}

                      {onToggleAutoFitToScreen && (
                        <button
                          type="button"
                          onClick={onToggleAutoFitToScreen}
                          className={`px-2.5 py-2 rounded-xl text-[11px] font-bold flex items-center justify-between cursor-pointer border transition-colors ${
                            isAutoFitToScreen
                              ? 'bg-purple-600/30 text-purple-200 border-purple-400/50'
                              : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                          }`}
                        >
                          <span className="flex items-center gap-1 truncate">
                            <Expand className="w-3.5 h-3.5 text-purple-300 shrink-0" />
                            <span className="truncate">{isAutoFitToScreen ? 'احتواء الشاشة' : 'عرض ممتد'}</span>
                          </span>
                        </button>
                      )}

                      {onToggleFullyExpanded && (
                        <button
                          type="button"
                          onClick={onToggleFullyExpanded}
                          className={`px-2.5 py-2 rounded-xl text-[11px] font-bold flex items-center justify-between cursor-pointer border transition-colors ${
                            isFullyExpanded
                              ? 'bg-blue-600/30 text-blue-200 border-blue-400/50'
                              : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                          }`}
                        >
                          <span className="flex items-center gap-1 truncate">
                            {isFullyExpanded ? <Minimize2 className="w-3.5 h-3.5 text-blue-300 shrink-0" /> : <Maximize2 className="w-3.5 h-3.5 text-blue-300 shrink-0" />}
                            <span className="truncate">{isFullyExpanded ? 'احتواء رأسي' : 'ارتفاع محدد'}</span>
                          </span>
                        </button>
                      )}

                      {onToggleWrapText && (
                        <button
                          type="button"
                          onClick={onToggleWrapText}
                          className={`px-2.5 py-2 rounded-xl text-[11px] font-bold flex items-center justify-between cursor-pointer border transition-colors ${
                            isWrapTextEnabled
                              ? 'bg-emerald-600/30 text-emerald-200 border-emerald-400/50'
                              : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                          }`}
                        >
                          <span className="flex items-center gap-1 truncate">
                            <WrapText className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                            <span className="truncate">{isWrapTextEnabled ? 'التفاف النصوص' : 'سطر واحد'}</span>
                          </span>
                        </button>
                      )}
                    </div>

                    {/* Row Density Selector */}
                    {onChangeTableDensity && (
                      <div className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-slate-800/90 border border-slate-700">
                        <span className="text-xs font-bold text-slate-300">كثافة الصفوف:</span>
                        <div className="flex items-center gap-1">
                          {(['compact', 'normal', 'spacious'] as const).map((d) => (
                            <button
                              key={d}
                              type="button"
                              onClick={() => onChangeTableDensity(d)}
                              className={`px-2 py-0.5 rounded-lg text-[10px] font-bold cursor-pointer transition-colors ${
                                tableDensity === d ? 'bg-blue-600 text-white font-black' : 'text-slate-400 hover:text-white'
                              }`}
                            >
                              {d === 'compact' ? 'مضغوط' : d === 'normal' ? 'افتراضي' : 'رحب'}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 3. تلوين خلفية الصفوف المحددة */}
                  {onSetRowColor && (
                    <div className="pt-2 border-t border-slate-800">
                      <div className="flex items-center justify-between mb-1.5 px-1">
                        <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                          <Palette className="w-3.5 h-3.5 text-amber-300" />
                          <span>تلوين خلفية الصفوف:</span>
                        </span>
                        <span className="text-[10px] font-mono font-bold text-amber-300">
                          {selectedOrderIdsCount > 0 ? `${selectedOrderIdsCount} صف محدد` : 'حدد صفوفاً أولاً'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-1.5 bg-slate-800/80 p-2 rounded-xl border border-slate-700">
                        <div className="flex items-center gap-1.5">
                          {[
                            { name: 'أصفر', color: '#fef08a', bgClass: 'bg-yellow-200 hover:bg-yellow-300' },
                            { name: 'أخضر', color: '#bbf7d0', bgClass: 'bg-emerald-200 hover:bg-emerald-300' },
                            { name: 'أزرق', color: '#bae6fd', bgClass: 'bg-sky-200 hover:bg-sky-300' },
                            { name: 'بنفسجي', color: '#e9d5ff', bgClass: 'bg-purple-200 hover:bg-purple-300' },
                            { name: 'وردي', color: '#fecdd3', bgClass: 'bg-rose-200 hover:bg-rose-300' },
                            { name: 'برتقالي', color: '#fed7aa', bgClass: 'bg-amber-200 hover:bg-amber-300' }
                          ].map((swatch) => (
                            <button
                              key={swatch.color}
                              type="button"
                              disabled={selectedOrderIdsCount === 0}
                              onClick={() => onSetRowColor(swatch.color)}
                              className={`w-6 h-6 rounded-full border border-slate-500 ${swatch.bgClass} cursor-pointer transition-transform hover:scale-110 disabled:opacity-30 disabled:cursor-not-allowed`}
                              title={selectedOrderIdsCount > 0 ? `تلوين الصفوف المحددة باللون ${swatch.name}` : 'حدد صفوفاً أولاً'}
                            />
                          ))}
                        </div>

                        <button
                          type="button"
                          disabled={selectedOrderIdsCount === 0 && !hasCustomRowColors}
                          onClick={() => {
                            if (selectedOrderIdsCount > 0) {
                              onSetRowColor(null);
                            } else if (onClearAllRowColors) {
                              onClearAllRowColors();
                            }
                          }}
                          className="px-2 py-1 rounded-lg text-[10px] font-bold text-slate-300 hover:text-white hover:bg-rose-600/80 border border-slate-600 cursor-pointer disabled:opacity-30"
                        >
                          إلغاء اللون
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* -----------------------------------------------------------------
                  MENU 6: التصدير والمشاركة والطباعة (EXPORT, PRINT & SHARE)
                  ----------------------------------------------------------------- */}
              {activeMenu === 'export' && (
                <>
                  <div className="flex items-center justify-between pb-2 mb-1 border-b border-slate-800">
                    <span className="text-xs font-black text-amber-300 flex items-center gap-1.5">
                      <FileDown className="w-4 h-4 text-amber-400" />
                      <span>التصدير والمشاركة والطباعة</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveMenu(null)}
                      className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Export Scope Selector */}
                  <div className="p-2 bg-slate-800 rounded-xl mb-1 flex items-center justify-between text-[11px]">
                    <span className="text-slate-300 font-bold">نطاق التصدير:</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onSetExportScope('filtered')}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold cursor-pointer ${
                          exportScope === 'filtered' ? 'bg-amber-600 text-white font-black' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        المفلتر ({filteredOrdersCount})
                      </button>
                      <button
                        type="button"
                        onClick={() => onSetExportScope('all')}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold cursor-pointer ${
                          exportScope === 'all' ? 'bg-amber-600 text-white font-black' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        الكل ({totalOrdersCount})
                      </button>
                      {selectedOrderIdsCount > 0 && (
                        <button
                          type="button"
                          onClick={() => onSetExportScope('selected')}
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-bold cursor-pointer ${
                            exportScope === 'selected' ? 'bg-amber-600 text-white font-black' : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          المحدد ({selectedOrderIdsCount})
                        </button>
                      )}
                    </div>
                  </div>

                  {onOpenComprehensiveExportModal && (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveMenu(null);
                        onOpenComprehensiveExportModal(false);
                      }}
                      className="w-full px-3 py-2.5 rounded-xl text-xs font-black text-emerald-950 bg-gradient-to-r from-emerald-100 to-teal-100 hover:from-emerald-200 hover:to-teal-200 flex items-center justify-between cursor-pointer transition-all border border-emerald-300"
                    >
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-emerald-700" />
                        <span>معاينة وتخصيص التقرير الشامل</span>
                      </div>
                      <span className="text-[10px] bg-emerald-700 text-white px-1.5 py-0.5 rounded">تفاعلي</span>
                    </button>
                  )}

                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveMenu(null);
                        onDirectExportExcel();
                      }}
                      className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-emerald-600 hover:text-white text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Excel (.xlsx)</span>
                    </button>

                    <button
                      type="button"
                      disabled={isExportingPdf}
                      onClick={() => {
                        setActiveMenu(null);
                        onDirectExportPdf();
                      }}
                      className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-rose-600 hover:text-white text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      {isExportingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5 text-rose-400" />}
                      <span>PDF معتمد</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setActiveMenu(null);
                        onDirectExportPptx();
                      }}
                      className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-amber-600 hover:text-white text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Presentation className="w-3.5 h-3.5 text-amber-400" />
                      <span>PowerPoint</span>
                    </button>

                    <button
                      type="button"
                      disabled={isExportingImage}
                      onClick={() => {
                        setActiveMenu(null);
                        onDirectExportImage();
                      }}
                      className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-purple-600 hover:text-white text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      {isExportingImage ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5 text-purple-400" />}
                      <span>صورة عالية الدقة</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setActiveMenu(null);
                        onDirectExportCsv();
                      }}
                      className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-cyan-600 hover:text-white text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <FileDown className="w-3.5 h-3.5 text-cyan-400" />
                      <span>ملف بيانات CSV</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setActiveMenu(null);
                        onInstantPrint();
                      }}
                      className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Printer className="w-3.5 h-3.5 text-slate-300" />
                      <span>طباعة فورية</span>
                    </button>
                  </div>

                  {onOpenComprehensiveExportModal && (
                    <div className="pt-1 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveMenu(null);
                          onOpenComprehensiveExportModal(true);
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-blue-600/30 hover:bg-blue-600 text-blue-200 hover:text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer border border-blue-500/40 transition-colors"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        <span>إرسال التقرير عبر البريد الإلكتروني</span>
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* -----------------------------------------------------------------
                  MENU 7: الأمان وإدارة الجدول والفترة (SECURITY & TABLE MANAGEMENT)
                  ----------------------------------------------------------------- */}
              {activeMenu === 'security' && (
                <>
                  <div className="flex items-center justify-between pb-2 mb-1 border-b border-slate-800">
                    <span className="text-xs font-black text-emerald-300 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span>الأمان السحابي وإدارة الجدول</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveMenu(null)}
                      className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {onOpenDataRecovery && (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveMenu(null);
                        onOpenDataRecovery();
                      }}
                      className="w-full px-3 py-2.5 rounded-xl text-xs font-black text-white bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 flex items-center justify-between cursor-pointer transition-all shadow-xs"
                    >
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-200" />
                        <span>مركز الأمان والنسخ الاحتياطية</span>
                      </div>
                      <span className="text-[10px] bg-black/25 px-1.5 py-0.5 rounded">سحابي</span>
                    </button>
                  )}

                  {onOpenYearMonthPicker && (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveMenu(null);
                        onOpenYearMonthPicker();
                      }}
                      className="w-full px-3 py-2 rounded-xl text-xs font-bold text-slate-100 bg-slate-800 hover:bg-indigo-600 hover:text-white flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <CalendarPlus className="w-4 h-4 text-amber-300" />
                      <span>تحديد السنة والشهر / الانتقال بين الجداول</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setActiveMenu(null);
                      onTogglePresentationMode();
                    }}
                    className="w-full px-3 py-2 rounded-xl text-xs font-bold text-slate-200 bg-slate-800 hover:bg-amber-600 hover:text-white flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    {presentationMode === 'overlay' ? (
                      <>
                        <Minimize2 className="w-4 h-4 text-amber-300" />
                        <span>تثبيت الجدول في الشاشة الرئيسية</span>
                      </>
                    ) : (
                      <>
                        <Maximize2 className="w-4 h-4 text-amber-300" />
                        <span>عرض الجدول كبطاقة مستقلة فوق الصفحة</span>
                      </>
                    )}
                  </button>

                  <div className="pt-2 mt-1 border-t border-slate-800 space-y-1.5">
                    {selectedOrderIdsCount > 0 && onDeleteSelectedOrders && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveMenu(null);
                          onDeleteSelectedOrders();
                        }}
                        className="w-full px-3 py-2 rounded-xl text-xs font-black text-white bg-rose-600 hover:bg-rose-500 flex items-center justify-between cursor-pointer transition-colors shadow-xs"
                      >
                        <div className="flex items-center gap-2">
                          <Trash2 className="w-4 h-4" />
                          <span>حذف الأوامر المحددة</span>
                        </div>
                        <span className="font-mono text-[10px] bg-black/30 px-1.5 py-0.5 rounded font-bold">
                          {selectedOrderIdsCount}
                        </span>
                      </button>
                    )}

                    {onDeleteSingleOrder && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveMenu(null);
                          onDeleteSingleOrder();
                        }}
                        className="w-full px-3 py-2 rounded-xl text-xs font-bold text-slate-200 hover:bg-rose-950/80 hover:text-rose-200 flex items-center gap-2 cursor-pointer transition-colors"
                      >
                        <Trash2 className="w-4 h-4 text-rose-400" />
                        <span>حذف أمر العمل المحدد حالياً</span>
                      </button>
                    )}

                    {onOpenDeleteTableModal && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveMenu(null);
                          onOpenDeleteTableModal();
                        }}
                        className="w-full px-3 py-2 rounded-xl text-xs font-bold text-rose-300 hover:bg-rose-950 hover:text-white flex items-center gap-2 cursor-pointer transition-colors"
                      >
                        <Lock className="w-4 h-4 text-rose-400" />
                        <span>حذف أو تفريغ الجدول بالكامل (محمي)</span>
                      </button>
                    )}

                    {onCloseTable && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveMenu(null);
                          onCloseTable();
                        }}
                        className="w-full px-3 py-2 rounded-xl text-xs font-bold text-slate-300 hover:bg-slate-800 hover:text-white flex items-center gap-2 cursor-pointer transition-colors border-t border-slate-800/80"
                      >
                        <X className="w-4 h-4 text-slate-400" />
                        <span>طي وإخفاء بطاقة الجدول</span>
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })(),
        document.body
      )}
    </div>
  );
};
