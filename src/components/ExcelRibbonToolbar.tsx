import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Copy,
  Scissors,
  ClipboardPaste,
  Paintbrush,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyEnd,
  WrapText,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ArrowDownAZ,
  ArrowUpZA,
  Filter,
  FileSpreadsheet,
  Palette,
  RefreshCw,
  TableProperties,
  Sparkles,
  Check,
  ChevronDown,
  Sigma,
  DollarSign,
  Percent,
  Binary,
  Grid,
  Square,
  Minus,
  Search,
  Type
} from 'lucide-react';
import { WorkOrder } from '../types';
import { calculateSmartPopoverPosition, PopoverCoords } from '../utils/popoverPosition';

export interface ExcelRibbonToolbarProps {
  // Clipboard
  onCopySelected: () => void;
  onCutSelected?: () => void;
  onPasteToSelected?: () => void;
  // Font & Typography
  isBold: boolean;
  onToggleBold: () => void;
  isItalic: boolean;
  onToggleItalic: () => void;
  isUnderline?: boolean;
  onToggleUnderline?: () => void;
  isStrikethrough?: boolean;
  onToggleStrikethrough?: () => void;
  fontSize?: number;
  onSetFontSize?: (size: number) => void;
  fontFamily?: string;
  onSetFontFamily?: (font: string) => void;
  // Colors
  onSetRowColor: (color: string | null) => void;
  onSetTextColor?: (color: string | null) => void;
  // Borders
  borderStyle?: 'all' | 'box' | 'bottom' | 'none';
  onSetBorderStyle?: (style: 'all' | 'box' | 'bottom' | 'none') => void;
  // Alignment
  textAlign: 'center' | 'right' | 'left';
  onSetTextAlign: (align: 'center' | 'right' | 'left') => void;
  verticalAlign?: 'top' | 'middle' | 'bottom';
  onSetVerticalAlign?: (align: 'top' | 'middle' | 'bottom') => void;
  isWrapText: boolean;
  onToggleWrapText: () => void;
  // Number Formatting
  numberFormat?: 'general' | 'number' | 'percent' | 'currency';
  onSetNumberFormat?: (format: 'general' | 'number' | 'percent' | 'currency') => void;
  // Screen & View
  isAutoFitToScreen: boolean;
  onToggleAutoFitToScreen: () => void;
  onAutoFitAll: () => void;
  zoomPercent: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  // Sort & Filter
  onSortAsc: () => void;
  onSortDesc: () => void;
  activeFiltersCount: number;
  onClearFilters: () => void;
  // Formula Bar & AutoSum & Direct Cell Binding
  selectedOrder: WorkOrder | null;
  selectedOrderIdsCount: number;
  totalOrdersCount: number;
  ready155Count: number;
  readyRate: number;
  formulaBarText?: string;
  onFormulaBarChange?: (val: string) => void;
  onApplyFormula?: () => void;
  activeCellLabel?: string | null;
  activeCellValue?: string;
  onCommitActiveCellValue?: (val: string) => void;
  formattingScope?: 'cell' | 'table';
  onSetFormattingScope?: (scope: 'cell' | 'table') => void;
  onResetCellFormatting?: () => void;
  // Direct Export & Sync
  onDirectExportExcel: () => void;
  onManualSync?: () => void;
  isManualSyncing?: boolean;
}

export const ExcelRibbonToolbar: React.FC<ExcelRibbonToolbarProps> = ({
  onCopySelected,
  onCutSelected,
  onPasteToSelected,
  isBold,
  onToggleBold,
  isItalic,
  onToggleItalic,
  isUnderline = false,
  onToggleUnderline,
  isStrikethrough = false,
  onToggleStrikethrough,
  fontSize = 12,
  onSetFontSize,
  fontFamily = 'Cairo',
  onSetFontFamily,
  onSetRowColor,
  onSetTextColor,
  borderStyle = 'all',
  onSetBorderStyle,
  textAlign,
  onSetTextAlign,
  verticalAlign = 'middle',
  onSetVerticalAlign,
  isWrapText,
  onToggleWrapText,
  numberFormat = 'general',
  onSetNumberFormat,
  isAutoFitToScreen,
  onToggleAutoFitToScreen,
  onAutoFitAll,
  zoomPercent,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onSortAsc,
  onSortDesc,
  activeFiltersCount,
  onClearFilters,
  selectedOrder,
  selectedOrderIdsCount,
  totalOrdersCount,
  ready155Count,
  readyRate,
  formulaBarText,
  onFormulaBarChange,
  onApplyFormula,
  activeCellLabel,
  activeCellValue,
  onCommitActiveCellValue,
  formattingScope = 'table',
  onSetFormattingScope,
  onResetCellFormatting,
  onDirectExportExcel,
  onManualSync,
  isManualSyncing = false
}) => {
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [isTextColorPickerOpen, setIsTextColorPickerOpen] = useState(false);
  const [isBordersMenuOpen, setIsBordersMenuOpen] = useState(false);
  const [isAutoSumMenuOpen, setIsAutoSumMenuOpen] = useState(false);
  const [internalFormulaVal, setInternalFormulaVal] = useState('');

  // Dropdown portal coordinates
  const [bordersCoords, setBordersCoords] = useState<PopoverCoords | null>(null);
  const [colorCoords, setColorCoords] = useState<PopoverCoords | null>(null);
  const [textColorCoords, setTextColorCoords] = useState<PopoverCoords | null>(null);
  const [autoSumCoords, setAutoSumCoords] = useState<PopoverCoords | null>(null);

  // Trigger button refs
  const bordersBtnRef = useRef<HTMLButtonElement>(null);
  const colorBtnRef = useRef<HTMLButtonElement>(null);
  const textColorBtnRef = useRef<HTMLButtonElement>(null);
  const autoSumBtnRef = useRef<HTMLButtonElement>(null);

  // Portal dropdown container refs
  const bordersMenuDropdownRef = useRef<HTMLDivElement>(null);
  const colorPickerDropdownRef = useRef<HTMLDivElement>(null);
  const textColorDropdownRef = useRef<HTMLDivElement>(null);
  const autoSumDropdownRef = useRef<HTMLDivElement>(null);

  // Sync internal formula value with active cell, selected order, or prop
  useEffect(() => {
    if (activeCellValue !== undefined) {
      setInternalFormulaVal(activeCellValue);
    } else if (formulaBarText !== undefined) {
      setInternalFormulaVal(formulaBarText);
    } else if (selectedOrder) {
      setInternalFormulaVal(`أمر عمل: ${selectedOrder.workOrderNumber || ''} | المكتب: ${selectedOrder.office || ''} | المقاول: ${selectedOrder.contractor || ''} | الاستشاري: ${selectedOrder.consultant || ''} | 155: ${selectedOrder.procedure155Status || ''}`);
    } else {
      setInternalFormulaVal(`=SUM(أوامر_العمل: ${totalOrdersCount} | جاهز: ${ready155Count} | نسبة: ${readyRate}%)`);
    }
  }, [activeCellValue, formulaBarText, selectedOrder, totalOrdersCount, ready155Count, readyRate]);

  // Recalculate open dropdown position on scroll or resize
  const updateDropdownPositions = () => {
    if (isBordersMenuOpen && bordersBtnRef.current) {
      const rect = bordersBtnRef.current.getBoundingClientRect();
      setBordersCoords(calculateSmartPopoverPosition(rect, 220, { preferredWidth: 200, align: 'end' }));
    }
    if (isColorPickerOpen && colorBtnRef.current) {
      const rect = colorBtnRef.current.getBoundingClientRect();
      setColorCoords(calculateSmartPopoverPosition(rect, 230, { preferredWidth: 200, align: 'end' }));
    }
    if (isTextColorPickerOpen && textColorBtnRef.current) {
      const rect = textColorBtnRef.current.getBoundingClientRect();
      setTextColorCoords(calculateSmartPopoverPosition(rect, 260, { preferredWidth: 180, align: 'end' }));
    }
    if (isAutoSumMenuOpen && autoSumBtnRef.current) {
      const rect = autoSumBtnRef.current.getBoundingClientRect();
      setAutoSumCoords(calculateSmartPopoverPosition(rect, 220, { preferredWidth: 230, align: 'end' }));
    }
  };

  useEffect(() => {
    updateDropdownPositions();
  }, [isBordersMenuOpen, isColorPickerOpen, isTextColorPickerOpen, isAutoSumMenuOpen]);

  useEffect(() => {
    const handleScrollOrResize = () => {
      updateDropdownPositions();
    };

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      // Borders
      if (
        bordersBtnRef.current && !bordersBtnRef.current.contains(target) &&
        bordersMenuDropdownRef.current && !bordersMenuDropdownRef.current.contains(target)
      ) {
        setIsBordersMenuOpen(false);
      }
      // Fill Color
      if (
        colorBtnRef.current && !colorBtnRef.current.contains(target) &&
        colorPickerDropdownRef.current && !colorPickerDropdownRef.current.contains(target)
      ) {
        setIsColorPickerOpen(false);
      }
      // Text Color
      if (
        textColorBtnRef.current && !textColorBtnRef.current.contains(target) &&
        textColorDropdownRef.current && !textColorDropdownRef.current.contains(target)
      ) {
        setIsTextColorPickerOpen(false);
      }
      // AutoSum
      if (
        autoSumBtnRef.current && !autoSumBtnRef.current.contains(target) &&
        autoSumDropdownRef.current && !autoSumDropdownRef.current.contains(target)
      ) {
        setIsAutoSumMenuOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsBordersMenuOpen(false);
        setIsColorPickerOpen(false);
        setIsTextColorPickerOpen(false);
        setIsAutoSumMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isBordersMenuOpen, isColorPickerOpen, isTextColorPickerOpen, isAutoSumMenuOpen]);

  const handleToggleBorders = () => {
    if (!isBordersMenuOpen && bordersBtnRef.current) {
      const rect = bordersBtnRef.current.getBoundingClientRect();
      setBordersCoords(calculateSmartPopoverPosition(rect, 220, { preferredWidth: 200, align: 'end' }));
      setIsColorPickerOpen(false);
      setIsTextColorPickerOpen(false);
      setIsAutoSumMenuOpen(false);
      setIsBordersMenuOpen(true);
    } else {
      setIsBordersMenuOpen(false);
    }
  };

  const handleToggleColorPicker = () => {
    if (!isColorPickerOpen && colorBtnRef.current) {
      const rect = colorBtnRef.current.getBoundingClientRect();
      setColorCoords(calculateSmartPopoverPosition(rect, 230, { preferredWidth: 200, align: 'end' }));
      setIsBordersMenuOpen(false);
      setIsTextColorPickerOpen(false);
      setIsAutoSumMenuOpen(false);
      setIsColorPickerOpen(true);
    } else {
      setIsColorPickerOpen(false);
    }
  };

  const handleToggleTextColorPicker = () => {
    if (!isTextColorPickerOpen && textColorBtnRef.current) {
      const rect = textColorBtnRef.current.getBoundingClientRect();
      setTextColorCoords(calculateSmartPopoverPosition(rect, 260, { preferredWidth: 180, align: 'end' }));
      setIsBordersMenuOpen(false);
      setIsColorPickerOpen(false);
      setIsAutoSumMenuOpen(false);
      setIsTextColorPickerOpen(true);
    } else {
      setIsTextColorPickerOpen(false);
    }
  };

  const handleToggleAutoSum = () => {
    if (!isAutoSumMenuOpen && autoSumBtnRef.current) {
      const rect = autoSumBtnRef.current.getBoundingClientRect();
      setAutoSumCoords(calculateSmartPopoverPosition(rect, 220, { preferredWidth: 230, align: 'end' }));
      setIsBordersMenuOpen(false);
      setIsColorPickerOpen(false);
      setIsTextColorPickerOpen(false);
      setIsAutoSumMenuOpen(true);
    } else {
      setIsAutoSumMenuOpen(false);
    }
  };

  const excelFillColors = [
    { name: 'أصفر كلاسيكي', hex: '#fef08a', border: '#facc15' },
    { name: 'أخضر معتمد', hex: '#bbf7d0', border: '#4ade80' },
    { name: 'أزرق سماوي', hex: '#bfdbfe', border: '#60a5fa' },
    { name: 'وردي تنبيه', hex: '#fecdd3', border: '#fb7185' },
    { name: 'برتقالي متابعة', hex: '#fed7aa', border: '#fb923c' },
    { name: 'بنفسجي تدقيق', hex: '#e9d5ff', border: '#c084fc' },
    { name: 'رمادي محايد', hex: '#e2e8f0', border: '#94a3b8' },
    { name: 'أبيض ناصع', hex: '#ffffff', border: '#cbd5e1' }
  ];

  const excelTextColors = [
    { name: 'افتراضي أسود', hex: '#0f172a' },
    { name: 'أزرق غامق', hex: '#1e3a8a' },
    { name: 'أخضر غامق', hex: '#14532d' },
    { name: 'أحمر داكن', hex: '#991b1b' },
    { name: 'برتقالي داكن', hex: '#9a3412' },
    { name: 'بنفسجي داكن', hex: '#581c87' }
  ];

  const fontSizes = [9, 10, 11, 12, 13, 14, 16];
  const fontFamilies = [
    { label: 'Cairo (افتراضي)', value: 'Cairo' },
    { label: 'Arial', value: 'Arial' },
    { label: 'Tahoma', value: 'Tahoma' },
    { label: 'Segoe UI', value: 'Segoe UI' }
  ];

  return (
    <div className="erp-office-ribbon w-full bg-white text-slate-800 border-y border-slate-200/90 shadow-2xs font-['Cairo',sans-serif] select-none text-xs transition-colors">
      
      {/* 1. Main Excel 365 Ribbon Toolbar Row */}
      <div className="px-2 py-1.5 flex items-center justify-between gap-1.5 overflow-x-auto scrollbar-none flex-nowrap">
        
        {/* Left Hand: Ribbon Groups */}
        <div className="flex items-center gap-1.5 flex-nowrap shrink-0">
          
          {/* GROUP 1: Clipboard (الحافظة) */}
          <div className="flex items-center gap-1 bg-slate-50/90 px-1.5 py-1 rounded-xl border border-slate-200/90 shadow-2xs shrink-0">
            <span className="text-[10px] text-slate-500 font-bold ml-1 hidden sm:inline">الحافظة:</span>
            
            <button
              type="button"
              onClick={onCopySelected}
              className="p-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 font-bold cursor-pointer active:scale-95 transition-all flex items-center gap-1 border border-slate-200/90"
              title="نسخ محتوى الصف أو الخلية المحددة (Ctrl+C)"
            >
              <Copy className="w-3.5 h-3.5 text-slate-600" />
              <span className="hidden md:inline text-[11px]">نسخ</span>
            </button>

            {onCutSelected && (
              <button
                type="button"
                onClick={onCutSelected}
                className="p-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 font-bold cursor-pointer active:scale-95 transition-all flex items-center gap-1 border border-slate-200/90"
                title="قص محتوى الخلية (Ctrl+X)"
              >
                <Scissors className="w-3.5 h-3.5 text-slate-600" />
                <span className="hidden md:inline text-[11px]">قص</span>
              </button>
            )}

            {onPasteToSelected && (
              <button
                type="button"
                onClick={onPasteToSelected}
                className="p-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 font-bold cursor-pointer active:scale-95 transition-all flex items-center gap-1 border border-slate-200/90"
                title="لصق البيانات في الخلية (Ctrl+V)"
              >
                <ClipboardPaste className="w-3.5 h-3.5 text-slate-600" />
                <span className="hidden md:inline text-[11px]">لصق</span>
              </button>
            )}
          </div>

          {/* GROUP 2: Font & Typography Suite (الخط والنمط الكامل) */}
          <div className="flex items-center gap-1 bg-slate-50/90 px-1.5 py-1 rounded-xl border border-slate-200/90 shadow-2xs shrink-0">
            <span className="text-[10px] text-slate-500 font-bold ml-1 hidden sm:inline">الخط:</span>
            
            {/* Font Family Selector */}
            {onSetFontFamily && (
              <select
                value={fontFamily}
                onChange={(e) => onSetFontFamily(e.target.value)}
                className="h-7 px-1.5 rounded-lg bg-white border border-slate-200 text-[11px] font-bold text-slate-800 cursor-pointer focus:outline-hidden focus:ring-1 focus:ring-slate-400"
                title="نوع الخط"
              >
                {fontFamilies.map(f => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            )}

            {/* Font Size Selector */}
            {onSetFontSize && (
              <div className="flex items-center gap-0.5">
                <select
                  value={fontSize}
                  onChange={(e) => onSetFontSize(Number(e.target.value))}
                  className="h-7 px-1 rounded-lg bg-white border border-slate-200 text-[11px] font-bold text-slate-800 cursor-pointer focus:outline-hidden"
                  title="حجم الخط"
                >
                  {fontSizes.map(sz => (
                    <option key={sz} value={sz}>{sz}px</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => onSetFontSize(Math.min(18, fontSize + 1))}
                  className="w-6 h-7 rounded-md bg-white hover:bg-slate-100 text-slate-700 font-bold text-[10px] flex items-center justify-center border border-slate-200 cursor-pointer"
                  title="تكبير الخط (Increase Font Size)"
                >
                  A+
                </button>
                <button
                  type="button"
                  onClick={() => onSetFontSize(Math.max(9, fontSize - 1))}
                  className="w-6 h-7 rounded-md bg-white hover:bg-slate-100 text-slate-700 font-bold text-[10px] flex items-center justify-center border border-slate-200 cursor-pointer"
                  title="تصغير الخط (Decrease Font Size)"
                >
                  A-
                </button>
              </div>
            )}

            <div className="h-4 w-px bg-slate-200 mx-0.5" />

            {/* Bold B */}
            <button
              type="button"
              onClick={onToggleBold}
              className={`w-7 h-7 rounded-lg font-black text-xs flex items-center justify-center cursor-pointer transition-all ${
                isBold 
                  ? 'bg-slate-800 text-white shadow-2xs font-black' 
                  : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
              }`}
              title="خط عريض (Bold - Ctrl+B)"
            >
              <Bold className="w-3.5 h-3.5" />
            </button>

            {/* Italic I */}
            <button
              type="button"
              onClick={onToggleItalic}
              className={`w-7 h-7 rounded-lg font-black text-xs flex items-center justify-center cursor-pointer transition-all ${
                isItalic 
                  ? 'bg-slate-800 text-white shadow-2xs font-black' 
                  : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
              }`}
              title="خط مائل (Italic - Ctrl+I)"
            >
              <Italic className="w-3.5 h-3.5" />
            </button>

            {/* Underline U */}
            {onToggleUnderline && (
              <button
                type="button"
                onClick={onToggleUnderline}
                className={`w-7 h-7 rounded-lg font-black text-xs flex items-center justify-center cursor-pointer transition-all ${
                  isUnderline 
                    ? 'bg-slate-800 text-white shadow-2xs font-black' 
                    : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                }`}
                title="تسطير أسفل النص (Underline - Ctrl+U)"
              >
                <Underline className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Strikethrough S */}
            {onToggleStrikethrough && (
              <button
                type="button"
                onClick={onToggleStrikethrough}
                className={`w-7 h-7 rounded-lg font-black text-xs flex items-center justify-center cursor-pointer transition-all ${
                  isStrikethrough 
                    ? 'bg-slate-800 text-white shadow-2xs font-black' 
                    : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                }`}
                title="يتوسطه خط (Strikethrough)"
              >
                <Strikethrough className="w-3.5 h-3.5" />
              </button>
            )}

            <div className="h-4 w-px bg-slate-200 mx-0.5" />

            {/* Borders Menu Dropdown Trigger (الحدود) */}
            <div className="relative">
              <button
                ref={bordersBtnRef}
                type="button"
                onClick={handleToggleBorders}
                className={`h-7 px-1.5 rounded-lg border font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-all ${
                  isBordersMenuOpen
                    ? 'bg-slate-800 text-white border-slate-800 shadow-2xs'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
                title="حدود خلايا الجدول (Borders)"
              >
                <Grid className="w-3.5 h-3.5 text-slate-600" />
                <ChevronDown className="w-2.5 h-2.5 text-slate-400" />
              </button>
            </div>

            {/* Fill Color Picker Trigger (لون التعبئة) */}
            <div className="relative">
              <button
                ref={colorBtnRef}
                type="button"
                onClick={handleToggleColorPicker}
                className={`h-7 px-1.5 rounded-lg border text-slate-800 font-bold cursor-pointer transition-all flex items-center gap-1 ${
                  isColorPickerOpen
                    ? 'bg-slate-200 border-slate-400 shadow-2xs'
                    : 'bg-white hover:bg-slate-100 border-slate-200'
                }`}
                title="تلوين خلفية الصفوف المحددة (Fill Color)"
              >
                <Palette className="w-3.5 h-3.5 text-amber-600" />
                <ChevronDown className="w-2.5 h-2.5 text-slate-400" />
              </button>
            </div>

            {/* Font Text Color Picker Trigger (لون الخط) */}
            {onSetTextColor && (
              <div className="relative">
                <button
                  ref={textColorBtnRef}
                  type="button"
                  onClick={handleToggleTextColorPicker}
                  className={`h-7 px-1.5 rounded-lg border text-slate-800 font-bold cursor-pointer transition-all flex items-center gap-1 ${
                    isTextColorPickerOpen
                      ? 'bg-slate-200 border-slate-400 shadow-2xs'
                      : 'bg-white hover:bg-slate-100 border-slate-200'
                  }`}
                  title="لون الخط (Font Color)"
                >
                  <Type className="w-3.5 h-3.5 text-rose-600 font-bold" />
                  <ChevronDown className="w-2.5 h-2.5 text-slate-400" />
                </button>
              </div>
            )}
          </div>

          {/* GROUP 3: Alignment (Vertical & Horizontal - Centered by default) */}
          <div className="flex items-center gap-1 bg-slate-50/90 px-1.5 py-1 rounded-xl border border-slate-200/90 shadow-2xs shrink-0">
            <span className="text-[10px] text-slate-500 font-bold ml-1 hidden sm:inline">المحاذاة:</span>
            
            {/* Horizontal Alignment */}
            <button
              type="button"
              onClick={() => onSetTextAlign('right')}
              className={`w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-all ${
                textAlign === 'right' 
                  ? 'bg-slate-800 text-white shadow-2xs font-bold' 
                  : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
              }`}
              title="محاذاة لليمين"
            >
              <AlignRight className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => onSetTextAlign('center')}
              className={`w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-all ${
                textAlign === 'center' 
                  ? 'bg-slate-800 text-white shadow-2xs font-bold' 
                  : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
              }`}
              title="توسيط النص داخل الأعمدة (افتراضي)"
            >
              <AlignCenter className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => onSetTextAlign('left')}
              className={`w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-all ${
                textAlign === 'left' 
                  ? 'bg-slate-800 text-white shadow-2xs font-bold' 
                  : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
              }`}
              title="محاذاة لليسار"
            >
              <AlignLeft className="w-3.5 h-3.5" />
            </button>

            <div className="h-4 w-px bg-slate-200 mx-0.5" />

            {/* Vertical Alignment (Top / Middle / Bottom) */}
            {onSetVerticalAlign && (
              <>
                <button
                  type="button"
                  onClick={() => onSetVerticalAlign('top')}
                  className={`w-6 h-7 rounded-md flex items-center justify-center cursor-pointer ${
                    verticalAlign === 'top' ? 'bg-slate-800 text-white' : 'hover:bg-slate-100 text-slate-600'
                  }`}
                  title="محاذاة عمودية للأعلى (Top Align)"
                >
                  <AlignVerticalJustifyStart className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => onSetVerticalAlign('middle')}
                  className={`w-6 h-7 rounded-md flex items-center justify-center cursor-pointer ${
                    verticalAlign === 'middle' ? 'bg-slate-800 text-white' : 'hover:bg-slate-100 text-slate-600'
                  }`}
                  title="محاذاة عمودية للمنتصف (Middle Align)"
                >
                  <AlignVerticalJustifyCenter className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => onSetVerticalAlign('bottom')}
                  className={`w-6 h-7 rounded-md flex items-center justify-center cursor-pointer ${
                    verticalAlign === 'bottom' ? 'bg-slate-800 text-white' : 'hover:bg-slate-100 text-slate-600'
                  }`}
                  title="محاذاة عمودية للأسفل (Bottom Align)"
                >
                  <AlignVerticalJustifyEnd className="w-3 h-3" />
                </button>
              </>
            )}

            <div className="h-4 w-px bg-slate-200 mx-0.5" />

            {/* Wrap Text (التفاف النص) */}
            <button
              type="button"
              onClick={onToggleWrapText}
              className={`h-7 px-2 rounded-lg font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-all ${
                isWrapText 
                  ? 'bg-slate-800 text-white shadow-2xs font-bold' 
                  : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
              }`}
              title="التفاف النص تلقائياً داخل الخلية (Wrap Text)"
            >
              <WrapText className="w-3.5 h-3.5 text-slate-600" />
              <span className="hidden xl:inline">التفاف</span>
            </button>
          </div>

          {/* GROUP 4: Number & Data Format (الأرقام والنسب) */}
          {onSetNumberFormat && (
            <div className="flex items-center gap-1 bg-slate-50/90 px-1.5 py-1 rounded-xl border border-slate-200/90 shadow-2xs shrink-0">
              <span className="text-[10px] text-slate-500 font-bold ml-1 hidden sm:inline">التنسيق:</span>
              <select
                value={numberFormat}
                onChange={(e) => onSetNumberFormat(e.target.value as any)}
                className="h-7 px-1.5 rounded-lg bg-white border border-slate-200 text-[11px] font-bold text-slate-800 cursor-pointer focus:outline-hidden"
                title="تنسيق خلايا الأرقام والنسب"
              >
                <option value="general">عام (General)</option>
                <option value="number">رقم (123.00)</option>
                <option value="percent">نسبة مئوية (%)</option>
                <option value="currency">عملة (ر.س SAR)</option>
              </select>
            </div>
          )}

          {/* GROUP 5: AutoSum & Calculations (دوال الحساب التلقائي Σ) */}
          <div className="relative shrink-0">
            <button
              ref={autoSumBtnRef}
              type="button"
              onClick={handleToggleAutoSum}
              className={`h-8 px-2.5 rounded-xl font-bold border shadow-2xs flex items-center gap-1 cursor-pointer transition-all ${
                isAutoSumMenuOpen
                  ? 'bg-slate-800 text-white border-slate-800 shadow-2xs'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
              }`}
              title="الدوال والحسابات التلقائية (AutoSum)"
            >
              <Sigma className="w-4 h-4 text-slate-700 font-bold" />
              <span className="hidden md:inline text-[11px]">حساب تلقائي</span>
              <ChevronDown className="w-2.5 h-2.5 text-slate-400" />
            </button>
          </div>

          {/* GROUP 6: Sorting & Data Manipulation */}
          <div className="flex items-center gap-1 bg-slate-50/90 px-1.5 py-1 rounded-xl border border-slate-200/90 shadow-2xs shrink-0">
            <button
              type="button"
              onClick={onSortAsc}
              className="h-7 px-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-all border border-slate-200"
              title="فرز تصاعدي (أ - ي)"
            >
              <ArrowDownAZ className="w-3.5 h-3.5 text-slate-600" />
              <span className="hidden xl:inline">تصاعدي</span>
            </button>

            <button
              type="button"
              onClick={onSortDesc}
              className="h-7 px-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-all border border-slate-200"
              title="فرز تنازلي (ي - أ)"
            >
              <ArrowUpZA className="w-3.5 h-3.5 text-slate-600" />
              <span className="hidden xl:inline">تنازلي</span>
            </button>

            {activeFiltersCount > 0 && (
              <button
                type="button"
                onClick={onClearFilters}
                className="h-7 px-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-all"
                title="إلغاء كافة فلاتر الأعمدة النشطة"
              >
                <RotateCcw className="w-3 h-3" />
                <span>إلغاء الفلاتر ({activeFiltersCount})</span>
              </button>
            )}
          </div>

          {/* GROUP 7: Screen & View (احتواء الشاشة + احتواء الأعمدة + التقريب) */}
          <div className="flex items-center gap-1 bg-slate-50/90 px-1.5 py-1 rounded-xl border border-slate-200/90 shadow-2xs shrink-0">
            
            {/* FIT TO SCREEN ICON & BUTTON */}
            <button
              type="button"
              onClick={onToggleAutoFitToScreen}
              className={`h-7 px-2.5 rounded-lg font-bold text-[11px] flex items-center gap-1.5 cursor-pointer transition-all border ${
                isAutoFitToScreen
                  ? 'bg-slate-800 text-white border-slate-800 shadow-2xs'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
              }`}
              title="احتواء الشاشة: ملاءمة كامل الجدول والأعمدة تلقائياً داخل عرض شاشة المتصفح دون تمرير أفقي"
            >
              <Maximize2 className={`w-3.5 h-3.5 ${isAutoFitToScreen ? 'text-white' : 'text-slate-600'}`} />
              <span className="font-bold">احتواء الشاشة</span>
            </button>

            {/* Auto-Fit Columns (احتواء الأعمدة) */}
            <button
              type="button"
              onClick={onAutoFitAll}
              className="h-7 px-2 rounded-lg bg-white hover:bg-slate-100 text-slate-700 font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-all border border-slate-200"
              title="احتواء تلقائي لكافة أعمدة الجدول حسب حجم محتواها"
            >
              <TableProperties className="w-3.5 h-3.5 text-slate-600" />
              <span className="hidden xl:inline">احتواء الأعمدة</span>
            </button>

            <div className="h-4 w-px bg-slate-200 mx-0.5" />

            {/* Zoom Controls */}
            <button
              type="button"
              onClick={onZoomIn}
              className="w-6 h-7 rounded-md bg-white hover:bg-slate-100 text-slate-700 font-bold flex items-center justify-center cursor-pointer border border-slate-200"
              title="تكبير الجدول (+10%)"
            >
              <ZoomIn className="w-3 h-3 text-slate-600" />
            </button>

            <span 
              onClick={onResetZoom}
              className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-white text-slate-700 border border-slate-200 cursor-pointer"
              title="اضغط لإعادة ضبط التقريب على 100%"
            >
              {zoomPercent}%
            </span>

            <button
              type="button"
              onClick={onZoomOut}
              className="w-6 h-7 rounded-md bg-white hover:bg-slate-100 text-slate-700 font-bold flex items-center justify-center cursor-pointer border border-slate-200"
              title="تصغير الجدول (-10%)"
            >
              <ZoomOut className="w-3 h-3 text-slate-600" />
            </button>
          </div>

        </div>

        {/* Right Hand: Instant Excel Export & Cloud Sync */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onDirectExportExcel}
            className="h-8 px-3 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs flex items-center gap-1.5 shadow-2xs border border-slate-700 cursor-pointer active:scale-95 transition-all"
            title="تصدير فوري كملف Excel XLSX معتمد بتنسيق RTL كامل"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>تصدير إكسل</span>
          </button>

          {onManualSync && (
            <button
              type="button"
              disabled={isManualSyncing}
              onClick={onManualSync}
              className="h-8 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-slate-200 font-bold text-xs flex items-center gap-1 shadow-2xs border border-slate-700 cursor-pointer active:scale-95 transition-all disabled:opacity-50"
              title="مزامنة فورية وتحديث وحفظ مع الخادم"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isManualSyncing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">مزامنة</span>
            </button>
          )}
        </div>

      </div>

      {/* 2. Floating Dropdown Portals Rendered at Root (Document Body) Above All Tables & Elements */}
      {isBordersMenuOpen && bordersCoords && createPortal(
        <div
          ref={bordersMenuDropdownRef}
          dir="rtl"
          className="fixed z-[999999] bg-white border-2 border-emerald-400 rounded-2xl p-2 shadow-2xl animate-in fade-in zoom-in-95 duration-100 text-right select-none font-['Cairo',sans-serif]"
          style={{
            top: bordersCoords.top !== undefined ? `${bordersCoords.top}px` : 'auto',
            bottom: bordersCoords.bottom !== undefined ? `${bordersCoords.bottom}px` : 'auto',
            left: `${bordersCoords.left}px`,
            width: `${bordersCoords.width}px`,
            maxHeight: `${bordersCoords.maxHeight}px`,
            overflowY: 'auto'
          }}
        >
          <div className="text-[11px] font-black text-emerald-900 pb-1 mb-1 border-b border-emerald-100 flex items-center gap-1.5">
            <Grid className="w-3.5 h-3.5 text-emerald-600" />
            <span>نمط حدود الخلايا:</span>
          </div>
          <button
            type="button"
            onClick={() => {
              if (onSetBorderStyle) onSetBorderStyle('all');
              setIsBordersMenuOpen(false);
            }}
            className={`w-full px-2.5 py-1.5 text-right rounded-xl text-xs font-bold flex items-center justify-between cursor-pointer transition-colors ${
              borderStyle === 'all' ? 'bg-emerald-100 text-emerald-900 font-black' : 'hover:bg-slate-50 text-slate-700'
            }`}
          >
            <span className="flex items-center gap-2"><Grid className="w-3.5 h-3.5" /> كافة الحدود (افتراضي)</span>
            {borderStyle === 'all' && <Check className="w-4 h-4 text-emerald-600" />}
          </button>
          <button
            type="button"
            onClick={() => {
              if (onSetBorderStyle) onSetBorderStyle('box');
              setIsBordersMenuOpen(false);
            }}
            className={`w-full px-2.5 py-1.5 text-right rounded-xl text-xs font-bold flex items-center justify-between cursor-pointer transition-colors ${
              borderStyle === 'box' ? 'bg-emerald-100 text-emerald-900 font-black' : 'hover:bg-slate-50 text-slate-700'
            }`}
          >
            <span className="flex items-center gap-2"><Square className="w-3.5 h-3.5" /> إطار خارجي عريض</span>
            {borderStyle === 'box' && <Check className="w-4 h-4 text-emerald-600" />}
          </button>
          <button
            type="button"
            onClick={() => {
              if (onSetBorderStyle) onSetBorderStyle('bottom');
              setIsBordersMenuOpen(false);
            }}
            className={`w-full px-2.5 py-1.5 text-right rounded-xl text-xs font-bold flex items-center justify-between cursor-pointer transition-colors ${
              borderStyle === 'bottom' ? 'bg-emerald-100 text-emerald-900 font-black' : 'hover:bg-slate-50 text-slate-700'
            }`}
          >
            <span className="flex items-center gap-2"><Minus className="w-3.5 h-3.5" /> حد سفلي فقط</span>
            {borderStyle === 'bottom' && <Check className="w-4 h-4 text-emerald-600" />}
          </button>
          <button
            type="button"
            onClick={() => {
              if (onSetBorderStyle) onSetBorderStyle('none');
              setIsBordersMenuOpen(false);
            }}
            className={`w-full px-2.5 py-1.5 text-right rounded-xl text-xs font-bold flex items-center justify-between cursor-pointer transition-colors ${
              borderStyle === 'none' ? 'bg-emerald-100 text-emerald-900 font-black' : 'hover:bg-slate-50 text-slate-700'
            }`}
          >
            <span>بلا حدود داخلية</span>
            {borderStyle === 'none' && <Check className="w-4 h-4 text-emerald-600" />}
          </button>
        </div>,
        document.body
      )}

      {isColorPickerOpen && colorCoords && createPortal(
        <div
          ref={colorPickerDropdownRef}
          dir="rtl"
          className="fixed z-[999999] bg-white border-2 border-emerald-400 rounded-2xl p-2.5 shadow-2xl animate-in fade-in zoom-in-95 duration-100 text-right select-none font-['Cairo',sans-serif]"
          style={{
            top: colorCoords.top !== undefined ? `${colorCoords.top}px` : 'auto',
            bottom: colorCoords.bottom !== undefined ? `${colorCoords.bottom}px` : 'auto',
            left: `${colorCoords.left}px`,
            width: `${colorCoords.width}px`,
            maxHeight: `${colorCoords.maxHeight}px`,
            overflowY: 'auto'
          }}
        >
          <div className="text-[11px] font-black text-emerald-900 pb-1.5 mb-2 border-b border-emerald-100 flex items-center gap-1.5">
            <Palette className="w-3.5 h-3.5 text-amber-500" />
            <span>لون خلفية الصفوف:</span>
          </div>
          <div className="grid grid-cols-4 gap-1.5 mb-2.5">
            {excelFillColors.map(c => (
              <button
                key={c.hex}
                type="button"
                onClick={() => {
                  onSetRowColor(c.hex);
                  setIsColorPickerOpen(false);
                }}
                className="w-8 h-8 rounded-xl border-2 shadow-2xs hover:scale-110 cursor-pointer transition-transform"
                style={{ backgroundColor: c.hex, borderColor: c.border }}
                title={c.name}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              onSetRowColor(null);
              setIsColorPickerOpen(false);
            }}
            className="w-full py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-50 rounded-xl border border-rose-200 cursor-pointer transition-colors"
          >
            إزالة التلوين
          </button>
        </div>,
        document.body
      )}

      {isTextColorPickerOpen && textColorCoords && createPortal(
        <div
          ref={textColorDropdownRef}
          dir="rtl"
          className="fixed z-[999999] bg-white border-2 border-emerald-400 rounded-2xl p-2.5 shadow-2xl animate-in fade-in zoom-in-95 duration-100 text-right select-none font-['Cairo',sans-serif]"
          style={{
            top: textColorCoords.top !== undefined ? `${textColorCoords.top}px` : 'auto',
            bottom: textColorCoords.bottom !== undefined ? `${textColorCoords.bottom}px` : 'auto',
            left: `${textColorCoords.left}px`,
            width: `${textColorCoords.width}px`,
            maxHeight: `${textColorCoords.maxHeight}px`,
            overflowY: 'auto'
          }}
        >
          <div className="text-[11px] font-black text-emerald-900 pb-1.5 mb-2 border-b border-emerald-100 flex items-center gap-1.5">
            <Type className="w-3.5 h-3.5 text-red-600" />
            <span>لون الخط:</span>
          </div>
          <div className="space-y-1">
            {excelTextColors.map(tc => (
              <button
                key={tc.hex}
                type="button"
                onClick={() => {
                  if (onSetTextColor) onSetTextColor(tc.hex);
                  setIsTextColorPickerOpen(false);
                }}
                className="w-full px-2.5 py-1.5 rounded-xl text-right text-xs font-bold hover:bg-slate-100 flex items-center justify-between cursor-pointer transition-colors"
              >
                <span style={{ color: tc.hex }}>{tc.name}</span>
                <span className="w-3.5 h-3.5 rounded-full border border-slate-300 shadow-2xs" style={{ backgroundColor: tc.hex }} />
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}

      {isAutoSumMenuOpen && autoSumCoords && createPortal(
        <div
          ref={autoSumDropdownRef}
          dir="rtl"
          className="fixed z-[999999] bg-white border-2 border-emerald-400 rounded-2xl p-3 shadow-2xl animate-in fade-in zoom-in-95 duration-100 text-right select-none font-['Cairo',sans-serif]"
          style={{
            top: autoSumCoords.top !== undefined ? `${autoSumCoords.top}px` : 'auto',
            bottom: autoSumCoords.bottom !== undefined ? `${autoSumCoords.bottom}px` : 'auto',
            left: `${autoSumCoords.left}px`,
            width: `${autoSumCoords.width}px`,
            maxHeight: `${autoSumCoords.maxHeight}px`,
            overflowY: 'auto'
          }}
        >
          <div className="text-[11px] font-black text-emerald-900 pb-1.5 mb-2 border-b border-emerald-100 flex items-center gap-1.5">
            <Sigma className="w-4 h-4 text-emerald-700" />
            <span>إحصائيات وحسابات الجدول الحالية:</span>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="px-2.5 py-1.5 rounded-xl bg-slate-50 flex items-center justify-between font-bold border border-slate-100">
              <span>مجموع أوامر العمل:</span>
              <span className="font-mono text-emerald-700 font-black">{totalOrdersCount}</span>
            </div>
            <div className="px-2.5 py-1.5 rounded-xl bg-slate-50 flex items-center justify-between font-bold border border-slate-100">
              <span>المؤهلة والمعتمدة 155:</span>
              <span className="font-mono text-blue-700 font-black">{ready155Count}</span>
            </div>
            <div className="px-2.5 py-1.5 rounded-xl bg-slate-50 flex items-center justify-between font-bold border border-slate-100">
              <span>نسبة الإنجاز الإجمالية:</span>
              <span className="font-mono text-emerald-700 font-black">{readyRate}%</span>
            </div>
            <div className="px-2.5 py-1.5 rounded-xl bg-slate-50 flex items-center justify-between font-bold border border-slate-100">
              <span>الصفوف المحددة حالياً:</span>
              <span className="font-mono text-purple-700 font-black">{selectedOrderIdsCount}</span>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
};
