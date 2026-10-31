import React, { useState, useRef, useMemo } from 'react';
import { 
  X, 
  FileSpreadsheet, 
  Download, 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  FileCheck, 
  Layers, 
  Building2, 
  HardHat, 
  Hash, 
  Tag,
  Calendar,
  Sparkles,
  Loader2,
  RefreshCw,
  PlusCircle,
  Table,
  Sliders,
  Check,
  ChevronDown,
  ShieldCheck,
  FileText,
  AlertTriangle,
  ExternalLink,
  FolderOpen
} from 'lucide-react';
import { WorkOrder, MonthTable, ColumnDefinition, DropdownOptionsMap } from '../types';
import { 
  downloadWorkOrderExcelTemplate, 
  parseWorkOrderExcelFile, 
  ParsedImportResult,
  DetectedColumnInfo,
  IMPORTABLE_STANDARD_FIELDS,
  extractOrdersFromRawRows
} from '../services/excelImportService';
import {
  ARABIC_MONTHS,
  getArabicMonthName,
  getDefaultTableId,
  isDefaultTableId,
  isTableInPeriod,
  validateAndDisambiguateTableName,
  findExistingWorkOrderConflicts,
  DuplicateWorkOrderConflict
} from '../utils/tableScope';

export interface ImportExcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (
    orders: Partial<WorkOrder>[],
    options: {
      mode: 'append' | 'merge';
      targetType: 'existing' | 'new_table';
      targetYear?: number;
      targetMonth?: number;
      targetTableId?: string;
      newTableName?: string;
      newTableColor?: string;
      newTableDesc?: string;
      discoveredCustomColumns?: { title: string; field: string }[];
    }
  ) => Promise<boolean | void>;
  monthTables?: MonthTable[];
  selectedTableId?: string;
  activeYear?: number;
  activeMonth?: number | 'all';
  columns?: ColumnDefinition[];
  dropdownOptions?: DropdownOptionsMap;
  allPlatformOrders?: WorkOrder[];
  onNavigateToExistingOrder?: (conflict: DuplicateWorkOrderConflict) => void;
}

const TABLE_COLOR_OPTIONS = [
  { id: 'emerald', label: 'زمردي', bg: 'bg-emerald-600', ring: 'ring-emerald-400' },
  { id: 'blue', label: 'أزرق', bg: 'bg-blue-600', ring: 'ring-blue-400' },
  { id: 'indigo', label: 'نيلي', bg: 'bg-indigo-600', ring: 'ring-indigo-400' },
  { id: 'purple', label: 'بنفسجي', bg: 'bg-purple-600', ring: 'ring-purple-400' },
  { id: 'amber', label: 'عنبري', bg: 'bg-amber-600', ring: 'ring-amber-400' },
  { id: 'rose', label: 'وردي', bg: 'bg-rose-600', ring: 'ring-rose-400' },
  { id: 'cyan', label: 'سماوي', bg: 'bg-cyan-600', ring: 'ring-cyan-400' }
];

export const ImportExcelModal: React.FC<ImportExcelModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
  monthTables = [],
  selectedTableId = 'default',
  activeYear = new Date().getFullYear(),
  activeMonth = 'all',
  columns = [],
  dropdownOptions,
  allPlatformOrders = [],
  onNavigateToExistingOrder
}) => {
  const initialNumericMonth = typeof activeMonth === 'number' && activeMonth >= 1 && activeMonth <= 12
    ? activeMonth
    : (new Date().getMonth() + 1);

  const [file, setFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
  const [parseResult, setParseResult] = useState<ParsedImportResult | null>(null);
  const [columnMappings, setColumnMappings] = useState<DetectedColumnInfo[]>([]);
  const [showMappingManager, setShowMappingManager] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Target Year & Month Configuration (guarantees zero cross-month or cross-table overlap)
  const [targetYear, setTargetYear] = useState<number>(activeYear);
  const [targetMonth, setTargetMonth] = useState<number>(initialNumericMonth);

  // Target Destination Configuration
  const [targetType, setTargetType] = useState<'existing' | 'new_table'>('existing');
  const [selectedDestinationTableId, setSelectedDestinationTableId] = useState<string>(
    selectedTableId && selectedTableId !== 'all' ? selectedTableId : getDefaultTableId(activeYear, initialNumericMonth)
  );
  const [importMode, setImportMode] = useState<'append' | 'merge'>('append');

  // New Table Setup Form
  const [newTableName, setNewTableName] = useState('');
  const [newTableColor, setNewTableColor] = useState('emerald');
  const [newTableDesc, setNewTableDesc] = useState('');

  React.useEffect(() => {
    if (isOpen) {
      const m = typeof activeMonth === 'number' && activeMonth >= 1 && activeMonth <= 12
        ? activeMonth
        : (new Date().getMonth() + 1);
      setTargetYear(activeYear);
      setTargetMonth(m);
      if (selectedTableId && selectedTableId !== 'all' && !isDefaultTableId(selectedTableId)) {
        const matched = monthTables.find(t => t.id === selectedTableId);
        if (matched) {
          setTargetYear(Number(matched.year) || activeYear);
          if (matched.month !== 'all') setTargetMonth(Number(matched.month));
          setSelectedDestinationTableId(matched.id);
          return;
        }
      }
      setSelectedDestinationTableId(getDefaultTableId(activeYear, m));
    }
  }, [isOpen, activeYear, activeMonth, selectedTableId, monthTables]);

  // Active period tables strictly scoped to (targetYear, targetMonth)
  const currentMonthTables = useMemo(() => {
    return monthTables.filter(t => isTableInPeriod(t, targetYear, targetMonth));
  }, [monthTables, targetYear, targetMonth]);

  // Keep selectedDestinationTableId valid when targetYear or targetMonth changes
  React.useEffect(() => {
    const defId = getDefaultTableId(targetYear, targetMonth);
    if (isDefaultTableId(selectedDestinationTableId)) {
      setSelectedDestinationTableId(defId);
    } else {
      const existsInTarget = currentMonthTables.some(t => t.id === selectedDestinationTableId);
      if (!existsInTarget) {
        setSelectedDestinationTableId(defId);
      }
    }
  }, [targetYear, targetMonth, currentMonthTables]);

  const availableYears = useMemo(() => {
    const s = new Set<number>([2024, 2025, 2026, 2027, 2028]);
    s.add(activeYear);
    s.add(targetYear);
    monthTables.forEach(t => {
      if (t.year >= 2000 && t.year <= 2100) s.add(Number(t.year));
    });
    return Array.from(s).sort((a, b) => a - b);
  }, [activeYear, targetYear, monthTables]);

  const handleReset = () => {
    setFile(null);
    setParseResult(null);
    setColumnMappings([]);
    setShowMappingManager(false);
    setIsParsing(false);
    setIsImporting(false);
    setTargetType('existing');
    setImportMode('append');
    setNewTableName('');
    setNewTableDesc('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleRemapColumn = (colIndex: number, newMatchedField: string) => {
    if (!parseResult || !parseResult.rawRows || parseResult.headerRowIndex === undefined) return;
    const std = IMPORTABLE_STANDARD_FIELDS.find(f => f.field === newMatchedField);
    const updated = columnMappings.map(col => {
      if (col.colIndex === colIndex) {
        return {
          ...col,
          matchedField: newMatchedField,
          fieldTitle: std ? std.title : (newMatchedField === '_skip_' ? 'تجاهل العمود' : col.headerName),
          isCustom: !std && newMatchedField !== '_skip_'
        };
      }
      return col;
    });
    setColumnMappings(updated);

    const { validOrders, skippedCount } = extractOrdersFromRawRows(
      parseResult.rawRows,
      parseResult.headerRowIndex + 1,
      updated.map(m => ({ colIndex: m.colIndex, matchedField: m.matchedField }))
    );

    setParseResult(prev => {
      if (!prev) return null;
      return {
        ...prev,
        orders: validOrders,
        validRows: validOrders.length,
        skippedRows: skippedCount,
        allDetectedColumns: updated
      };
    });
  };

  const handleFileProcess = async (selectedFile: File) => {
    setFile(selectedFile);
    setIsParsing(true);

    // Auto-generate suggested table name based on file name + month/year
    const cleanBaseName = selectedFile.name.replace(/\.[^/.]+$/, '').replace(/[_\\-]/g, ' ').trim();
    if (!newTableName) {
      setNewTableName(`جدول ${cleanBaseName.slice(0, 25)} (${getArabicMonthName(targetMonth)})`);
    }

    try {
      const result = await parseWorkOrderExcelFile(selectedFile, columns);
      setParseResult(result);
      setColumnMappings(result.allDetectedColumns);
    } catch (err) {
      console.error('Failed to parse excel file:', err);
    } finally {
      setIsParsing(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileProcess(e.target.files[0]);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleDownloadTemplate = async () => {
    setIsDownloadingTemplate(true);
    try {
      await downloadWorkOrderExcelTemplate(columns, dropdownOptions);
    } catch (err) {
      console.error('Failed to download template:', err);
    } finally {
      setIsDownloadingTemplate(false);
    }
  };

  const handleExecuteImport = async () => {
    if (!parseResult || parseResult.orders.length === 0) return;
    setIsImporting(true);

    try {
      let finalNewName = newTableName.trim() || `جدول استيراد ${getArabicMonthName(targetMonth)} ${targetYear}`;
      if (targetType === 'new_table') {
        const check = validateAndDisambiguateTableName(finalNewName, targetYear, targetMonth, monthTables);
        finalNewName = check.isDuplicate ? check.suggestedName : finalNewName;
      }

      const result = await onImportSuccess(parseResult.orders, {
        mode: importMode,
        targetType,
        targetYear,
        targetMonth,
        targetTableId: targetType === 'existing' ? selectedDestinationTableId : undefined,
        newTableName: targetType === 'new_table' ? finalNewName : undefined,
        newTableColor: targetType === 'new_table' ? newTableColor : undefined,
        newTableDesc: targetType === 'new_table' ? newTableDesc.trim() : undefined,
        discoveredCustomColumns: parseResult.discoveredNewColumns
      });
      if (result !== false) {
        handleClose();
      }
    } catch (err) {
      console.error('Import failed:', err);
    } finally {
      setIsImporting(false);
    }
  };

  // Extract all columns to show in preview
  const previewColumns = columnMappings.length > 0 ? columnMappings : (parseResult?.allDetectedColumns || []);

  // Detect any work orders in the uploaded file that already exist anywhere in the platform
  const duplicateCheckResult = useMemo(() => {
    if (!parseResult || !parseResult.orders || parseResult.orders.length === 0) {
      return { conflicts: [] as DuplicateWorkOrderConflict[], acceptedOrders: [] as Partial<WorkOrder>[] };
    }
    return findExistingWorkOrderConflicts(parseResult.orders, allPlatformOrders, monthTables);
  }, [parseResult, allPlatformOrders, monthTables]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 text-right font-['Cairo',sans-serif]">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-4xl w-full my-6 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 flex items-center justify-center shadow-inner shrink-0">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-xl font-black text-white">
                  استيراد وتدقيق بيانات أوامر العمل من Excel
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  شامل وتكييفي 100%
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                استيراد ذكي يشمل كافة أعمدة الجدول (من المكتب وحتى حالة أمر العمل) بدون فقدان أي بيانات
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={handleClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
            title="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 space-y-5 max-h-[78vh] overflow-y-auto">

          {/* 1. Download Master Template Section */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-100/60 border border-emerald-200/90 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 font-black text-emerald-950 text-sm sm:text-base">
                <Sparkles className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>تحميل النموذج المعتمد المنسق (فارغ للتعبئة الفورية)</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900 font-bold">
                  خطوط طولية وعرضية واضحة
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">
                ملف Excel مبرمج بأعلى درجات التنسيق والأناقة، يحتوي على خطوط شبكية طولية وعرضية واضحة ومحددة، ويشمل <strong>كافة أعمدة الجدول (من المكتب وحتى حالة أمر العمل)</strong> وهو فارغ تماماً بدون أي بيانات تجريبية ليتم تعبئته أو لصق البيانات فيه فوراً بكل سهولة وأمان، مع قوائم منسدلة لتسهيل الإدخال.
              </p>
            </div>
            <button
              type="button"
              disabled={isDownloadingTemplate}
              onClick={handleDownloadTemplate}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-black text-xs shadow-md border border-emerald-400/30 transition-all cursor-pointer shrink-0 disabled:opacity-50"
              title="تنزيل نموذج إكسل فارغ بجميع الأعمدة والخطوط الواضحة"
            >
              {isDownloadingTemplate ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جاري إنشاء النموذج المنسق...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>تحميل النموذج الفارغ المعتمد (.xlsx)</span>
                </>
              )}
            </button>
          </div>

          {/* 1.5. Target Year & Month Selector (تحديد السنة والشهر الذي سيتم إدراج الجدول فيه دون أي تداخل) */}
          <div className="p-4 rounded-2xl bg-gradient-to-l from-indigo-950 via-slate-900 to-emerald-950 text-white border border-indigo-500/40 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/40 text-amber-300 flex items-center justify-center shrink-0">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs sm:text-sm font-black text-white">
                    تحديد السنة والشهر المستهدف لإدراج بيانات الجدول:
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/40">
                    عزل تام ومنع التداخل
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  سيتم ربط كافة الأوامر المستوردة حصرياً بشهر <strong>{getArabicMonthName(targetMonth)} {targetYear}</strong> دون أي تداخل مع الجداول أو الشهور الأخرى
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <div className="flex items-center gap-1.5 bg-white/10 px-2.5 py-1.5 rounded-xl border border-white/15">
                <span className="text-[11px] text-indigo-200 font-bold">السنة:</span>
                <select
                  value={targetYear}
                  onChange={(e) => setTargetYear(Number(e.target.value))}
                  className="bg-slate-900 text-white font-mono font-black text-xs px-2 py-1 rounded-lg border border-indigo-400/40 focus:outline-hidden cursor-pointer"
                >
                  {availableYears.map(y => (
                    <option key={y} value={y}>{y} م</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5 bg-white/10 px-2.5 py-1.5 rounded-xl border border-white/15">
                <span className="text-[11px] text-emerald-200 font-bold">الشهر:</span>
                <select
                  value={targetMonth}
                  onChange={(e) => setTargetMonth(Number(e.target.value))}
                  className="bg-slate-900 text-white font-black text-xs px-2 py-1 rounded-lg border border-emerald-400/40 focus:outline-hidden cursor-pointer"
                >
                  {ARABIC_MONTHS.map(m => (
                    <option key={m.num} value={m.num}>
                      شهر {m.num} - {m.name} ({targetYear})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 2. Drag & Drop File Upload Area */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-3xl p-6 sm:p-8 text-center cursor-pointer transition-all duration-200 ${
              dragActive 
                ? 'border-emerald-500 bg-emerald-50/70 scale-101 shadow-inner' 
                : file
                ? 'border-emerald-400 bg-emerald-50/30'
                : 'border-slate-300 hover:border-emerald-400 hover:bg-slate-50/70'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx, .xls, .csv, .json, application/json, text/plain, application/octet-stream, */*"
              onChange={handleFileInputChange}
              className="hidden"
            />

            <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center mb-3 shadow-inner">
              <Upload className="w-8 h-8" />
            </div>

            {file ? (
              <div className="space-y-1.5">
                <p className="font-black text-sm sm:text-base text-emerald-950 flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>{file.name}</span>
                </p>
                <p className="text-xs text-slate-500">
                  الحجم: {(file.size / 1024).toFixed(1)} كيلوبايت • انقر أو اسحب لاختيار ملف آخر
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                <p className="font-bold text-sm text-slate-800">
                  اسحب وأفلت ملف الإكسل أو JSON هنا، أو <span className="text-emerald-700 underline font-black">استعرض من جهازك</span>
                </p>
                <p className="text-xs text-slate-400">
                  يدعم صيغ XLSX و XLS و CSV و JSON (من الجوال أو الكمبيوتر) • يتم قراءة ومطابقة أي عمود متوفر في الملف تلقائياً
                </p>
              </div>
            )}
          </div>

          {/* 3. Loading Indicator */}
          {isParsing && (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center gap-3 text-xs font-bold text-slate-700">
              <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
              <span>جاري الفحص الذكي للبيانات واستخراج كافة الأعمدة والصفوف...</span>
            </div>
          )}

          {/* 4. Parsing Success & Smart Adaptive Configuration */}
          {parseResult && !isParsing && (
            <div className="space-y-4">

              {/* Status Banner */}
              <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-bold ${
                parseResult.success 
                  ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950' 
                  : 'bg-rose-50 border-rose-300 text-rose-950'
              }`}>
                <div className="flex items-center gap-2.5">
                  {parseResult.success ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                  )}
                  <div>
                    <div className="text-sm font-black">
                      {parseResult.success 
                        ? `تم فحص الملف بنجاح! تم استخراج (${parseResult.validRows}) أمر عمل جاهزة للاستيراد`
                        : 'فشل استخراج البيانات من الملف'}
                    </div>
                    <div className="text-[11px] font-normal text-slate-600 mt-0.5">
                      تم اكتشاف ومطابقة ({parseResult.allDetectedColumns.filter(c => c.hasData).length}) عمود يحتوي على بيانات بالملف
                    </div>
                  </div>
                </div>
                {parseResult.skippedRows > 0 && (
                  <span className="text-[11px] text-amber-800 bg-amber-100 px-2.5 py-1 rounded-lg font-bold shrink-0 self-start sm:self-auto">
                    تم تخطي ({parseResult.skippedRows}) أسطر فارغة
                  </span>
                )}
              </div>

              {/* Duplicate Work Orders Rejection Banner (if any orders in file already exist in platform) */}
              {duplicateCheckResult.conflicts.length > 0 && (
                <div className="p-4 rounded-2xl border-2 border-rose-300 bg-rose-50/95 space-y-3 shadow-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-rose-950">
                      <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                      <div>
                        <h4 className="text-xs sm:text-sm font-black">
                          تنبيه: تم رصد ({duplicateCheckResult.conflicts.length}) أمر عمل مسجل مسبقاً في المنصة وسيتم رفض إضافتها!
                        </h4>
                        <p className="text-[11px] text-rose-800 font-bold mt-0.5">
                          الأوامر الجديدة القابلة للاستيراد الفعلي: ({duplicateCheckResult.acceptedOrders.length}) أمر عمل فقط • يمكنك الانتقال الفوري لأي أمر عمل موجود بالضغط على الأيقونة أمامه
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                    {duplicateCheckResult.conflicts.map((conf, idx) => (
                      <div
                        key={`${conf.existingOrder.id}-${idx}`}
                        className="p-2.5 rounded-xl bg-white border border-rose-200 flex flex-wrap items-center justify-between gap-2 text-xs shadow-2xs"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-900 font-mono font-black">
                            رقم: {conf.workOrderNumber}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-900 font-mono font-black border border-indigo-200">
                            النوع: {conf.workOrderCode}
                          </span>
                          <span className="text-slate-700 font-bold flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-blue-600" />
                            <span>السنة: <strong>{conf.year}</strong> • الشهر: <strong>{conf.monthName}</strong></span>
                          </span>
                          <span className="text-amber-900 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 font-bold flex items-center gap-1">
                            <FolderOpen className="w-3.5 h-3.5 text-amber-700" />
                            <span>{conf.sectionName} — {conf.tableName}</span>
                          </span>
                        </div>

                        {onNavigateToExistingOrder && (
                          <button
                            type="button"
                            onClick={() => onNavigateToExistingOrder(conf)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black shadow-xs transition-all cursor-pointer shrink-0"
                            title="انتقل فوراً إلى الجدول الموجود به أمر العمل وافتحه"
                          >
                            <ExternalLink className="w-3.5 h-3.5 text-amber-300" />
                            <span>الانتقال للجدول وفتح أمر العمل</span>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Smart Adaptive Destination Selector */}
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 font-black text-slate-900 text-sm">
                    <Sliders className="w-4 h-4 text-emerald-600" />
                    <span>وجهة الاستيراد داخل شهر ({getArabicMonthName(targetMonth)} {targetYear}):</span>
                  </div>
                  <span className="text-[11px] font-bold text-indigo-800 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200">
                    النطاق المحدد: شهر {targetMonth} ({getArabicMonthName(targetMonth)}) • {targetYear}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  
                  {/* Destination Option 1: Existing Table */}
                  <div 
                    onClick={() => setTargetType('existing')}
                    className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                      targetType === 'existing'
                        ? 'border-emerald-600 bg-white shadow-sm ring-2 ring-emerald-500/20'
                        : 'border-slate-200 bg-slate-100/60 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          targetType === 'existing' ? 'border-emerald-600' : 'border-slate-400'
                        }`}>
                          {targetType === 'existing' && <div className="w-2 h-2 rounded-full bg-emerald-600" />}
                        </div>
                        <span className="font-black text-xs text-slate-900">إضافة لجدول موجود في ({getArabicMonthName(targetMonth)} {targetYear})</span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                        تحديث أو إلحاق
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-500 leading-normal mb-3">
                      إدراج أوامر العمل المستخرجة داخل أحد الجداول المستقلة التابعة لشهر {getArabicMonthName(targetMonth)} {targetYear} فقط
                    </p>

                    {targetType === 'existing' && (
                      <div className="space-y-2.5 pt-2 border-t border-slate-100">
                        <div>
                          <label className="text-[11px] font-bold text-slate-700 block mb-1">
                            اختر الجدول الهدف في شهر ({getArabicMonthName(targetMonth)} {targetYear}):
                          </label>
                          <select
                            value={selectedDestinationTableId}
                            onChange={(e) => setSelectedDestinationTableId(e.target.value)}
                            className="w-full px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                          >
                            <option value={getDefaultTableId(targetYear, targetMonth)}>
                              📋 الجدول الرئيسي ({getArabicMonthName(targetMonth)} {targetYear})
                            </option>
                            {currentMonthTables.map((t, idx) => (
                              <option key={t.id} value={t.id}>
                                📑 #{idx + 2} {t.name} ({getArabicMonthName(t.month)} {t.year})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-700 block mb-1">
                            نمط الإدراج:
                          </label>
                          <div className="grid grid-cols-2 gap-1.5">
                            <button
                              type="button"
                              onClick={() => setImportMode('append')}
                              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                                importMode === 'append'
                                  ? 'bg-emerald-600 text-white shadow-2xs'
                                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                              }`}
                            >
                              ➕ إلحاق كصفوف جديدة
                            </button>
                            <button
                              type="button"
                              onClick={() => setImportMode('merge')}
                              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                                importMode === 'merge'
                                  ? 'bg-blue-600 text-white shadow-2xs'
                                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                              }`}
                              title="تحديث الأوامر المطابقة برقم أمر العمل وتعبئة الحقول الناقصة"
                            >
                              🔄 دمج وتحديث ذكي
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Destination Option 2: Brand New Month Table */}
                  <div 
                    onClick={() => setTargetType('new_table')}
                    className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                      targetType === 'new_table'
                        ? 'border-emerald-600 bg-white shadow-sm ring-2 ring-emerald-500/20'
                        : 'border-slate-200 bg-slate-100/60 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          targetType === 'new_table' ? 'border-emerald-600' : 'border-slate-400'
                        }`}>
                          {targetType === 'new_table' && <div className="w-2 h-2 rounded-full bg-emerald-600" />}
                        </div>
                        <span className="font-black text-xs text-slate-900">إنشاء جدول مستقل جديد</span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        مستقل للشهر
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-500 leading-normal mb-3">
                      توليد جدول جديد مخصص لهذا الشهر ووضع كافة البيانات المستوردة فيه بشكل مستقل
                    </p>

                    {targetType === 'new_table' && (
                      <div className="space-y-2.5 pt-2 border-t border-slate-100">
                        <div>
                          <label className="text-[11px] font-bold text-slate-700 block mb-1">
                            اسم الجدول الجديد:
                          </label>
                          <input
                            type="text"
                            value={newTableName}
                            onChange={(e) => setNewTableName(e.target.value)}
                            placeholder="مثال: جدول أوامر الطوارئ"
                            className="w-full px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-700 block mb-1">
                            لون الجدول:
                          </label>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {TABLE_COLOR_OPTIONS.map(c => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => setNewTableColor(c.id)}
                                className={`w-6 h-6 rounded-full ${c.bg} transition-all cursor-pointer flex items-center justify-center ${
                                  newTableColor === c.id ? `ring-2 ${c.ring} scale-110 shadow-xs` : 'opacity-70 hover:opacity-100'
                                }`}
                              >
                                {newTableColor === c.id && <Check className="w-3.5 h-3.5 text-white" />}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                </div>
              </div>

              {/* 5. Smart Column Adaptation & Interactive Adjustment */}
              <div className="space-y-3 bg-gradient-to-br from-emerald-50/70 via-slate-50 to-teal-50/50 p-4 rounded-2xl border border-emerald-200/80 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-black text-slate-800">
                          توافق ومطابقة الأعمدة ({previewColumns.filter(c => c.hasData && c.matchedField !== '_skip_').length} عمود مطابق)
                        </h4>
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-300">
                          تلقائي فائق الدقة
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 font-medium mt-0.5">
                        تمت مطابقة حقول الملف وفقاً لمحتواها وعناوينها بدقة لمنع أي خطأ
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowMappingManager(prev => !prev)}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white hover:bg-slate-100 border border-emerald-300 text-emerald-800 transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs shrink-0"
                  >
                    <Sliders className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{showMappingManager ? 'إخفاء لوحة الضبط' : 'تعديل توافق الأعمدة يدوياً'}</span>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showMappingManager ? 'rotate-180' : ''}`} />
                  </button>
                </div>

                {/* Badges preview (when manager is collapsed) */}
                {!showMappingManager && (
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 bg-white/90 rounded-xl border border-slate-200">
                    {previewColumns.map((col, idx) => (
                      <span 
                        key={idx}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                          col.matchedField === '_skip_'
                            ? 'bg-slate-100 text-slate-400 border-slate-200 line-through'
                            : col.isCustom
                              ? 'bg-purple-100 text-purple-900 border-purple-300'
                              : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                        }`}
                        title={col.sampleValue ? `العمود في الملف: ${col.headerName}\nعينة بيانات: ${col.sampleValue}` : `العمود: ${col.headerName}`}
                      >
                        <span>{col.fieldTitle}</span>
                        {col.headerName && col.headerName !== col.fieldTitle && (
                          <span className="text-[10px] text-slate-500 font-normal">({col.headerName})</span>
                        )}
                        {col.hasData && col.matchedField !== '_skip_' && (
                          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-black ${
                            col.isCustom ? 'bg-purple-200 text-purple-950' : 'bg-emerald-200 text-emerald-950'
                          }`}>
                            {col.count}
                          </span>
                        )}
                        {col.isCustom && (
                          <span className="text-[9px] bg-purple-600 text-white px-1 py-0.2 rounded font-bold">
                            مخصص
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                )}

                {/* Expandable Interactive Mapping Manager */}
                {showMappingManager && (
                  <div className="mt-2 space-y-2 max-h-72 overflow-y-auto p-2 bg-white rounded-xl border border-emerald-200 shadow-inner">
                    <p className="text-[11px] text-slate-500 mb-2 font-medium">
                      يمكنك إعادة تعيين أي عمود من أعمدة ملف Excel للحقل المطابق له في النظام وسيتم تحديث البيانات المستخرجة فوراً:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {previewColumns.map((col) => (
                        <div key={col.colIndex} className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 flex flex-col gap-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-800 truncate" title={col.headerName}>
                              عمود الملف: <span className="text-emerald-700 font-black">{col.headerName || `عمود #${col.colIndex + 1}`}</span>
                            </span>
                            {col.sampleValue && (
                              <span className="text-[10px] text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200 truncate max-w-[120px]" title={col.sampleValue}>
                                مثال: {col.sampleValue}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <label className="text-[11px] font-bold text-slate-600 shrink-0">يطابق حقل:</label>
                            <select
                              value={col.matchedField}
                              onChange={(e) => handleRemapColumn(col.colIndex, e.target.value)}
                              className="w-full text-xs font-bold py-1 px-2 rounded-lg border border-slate-300 bg-white text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                            >
                              {IMPORTABLE_STANDARD_FIELDS.map(f => (
                                <option key={f.field} value={f.field}>
                                  {f.title}
                                </option>
                              ))}
                              {col.isCustom && !IMPORTABLE_STANDARD_FIELDS.some(f => f.field === col.matchedField) && (
                                <option value={col.matchedField}>
                                  🌟 حقل مخصص: {col.fieldTitle}
                                </option>
                              )}
                            </select>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {parseResult.discoveredNewColumns.length > 0 && (
                  <p className="text-[11px] text-purple-800 bg-purple-50 p-2 rounded-xl border border-purple-200 font-bold flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                    <span>تم اكتشاف ({parseResult.discoveredNewColumns.length}) أعمدة مخصصة جديدة وسيتم إدراجها بالجدول تلقائياً دون فقد أي بيانات!</span>
                  </p>
                )}
              </div>

              {/* 6. Comprehensive Interactive Preview Table */}
              {parseResult.orders.length > 0 && (
                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                  <div className="bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-800 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-emerald-600" />
                      <span>معاينة البيانات المستخرجة (أول {Math.min(6, parseResult.orders.length)} صفوف مع كافة الأعمدة):</span>
                    </span>
                    <span className="font-mono text-emerald-900 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300 font-black">
                      {parseResult.orders.length} أمر عمل متاح
                    </span>
                  </div>
                  
                  <div className="overflow-x-auto max-h-64">
                    <table className="w-full text-xs text-right border-collapse border border-slate-300">
                      <thead className="bg-slate-900 text-white border-b-2 border-slate-800 sticky top-0 font-bold select-none text-[11px]">
                        <tr>
                          <th className="py-2.5 px-3 text-center border border-slate-700 w-12 bg-slate-900">#</th>
                          {previewColumns.filter(c => c.hasData).map((col, cIdx) => (
                            <th key={cIdx} className="py-2.5 px-3 border border-slate-700 whitespace-nowrap bg-slate-900 text-slate-100">
                              {col.fieldTitle}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white font-bold">
                        {parseResult.orders.slice(0, 8).map((ord, rIdx) => (
                          <tr key={rIdx} className={rIdx % 2 === 1 ? 'bg-slate-50 hover:bg-emerald-50/60 transition-colors' : 'bg-white hover:bg-emerald-50/60 transition-colors'}>
                            <td className="py-2 px-3 text-slate-800 font-mono font-black text-center border border-slate-300 bg-slate-100">
                              {rIdx + 1}
                            </td>
                            {previewColumns.filter(c => c.hasData).map((col, cIdx) => {
                              const val = (ord as any)[col.matchedField] ?? (ord.customFields && (ord.customFields as any)[col.matchedField]);
                              return (
                                <td 
                                  key={cIdx} 
                                  className="py-2 px-3 border border-slate-300 whitespace-nowrap text-slate-900 text-xs"
                                >
                                  {val || <span className="text-slate-300 font-normal italic">-</span>}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {parseResult.orders.length > 8 && (
                    <div className="bg-slate-50 px-3 py-2 text-center text-[11px] text-slate-600 font-medium border-t border-slate-200">
                      يوجد {parseResult.orders.length - 8} أمر عمل إضافي سيتم استيرادها وحفظها بالكامل في المنظومة
                    </div>
                  )}
                </div>
              )}

              {/* Error messages if any */}
              {parseResult.errors.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    <span>ملاحظات فحص الملف:</span>
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-700">
                    {parseResult.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-6 border-t border-slate-100 flex items-center justify-between gap-3 bg-slate-50">
          <button
            type="button"
            onClick={handleClose}
            className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200 border border-slate-200 transition-colors cursor-pointer"
          >
            إلغاء
          </button>

          <button
            type="button"
            disabled={!parseResult || parseResult.orders.length === 0 || isImporting}
            onClick={handleExecuteImport}
            className={`inline-flex items-center gap-2 px-7 py-3 rounded-2xl font-black text-xs shadow-lg transition-all cursor-pointer ${
              !parseResult || parseResult.orders.length === 0 || isImporting
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-600 text-white active:scale-98'
            }`}
          >
            {isImporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>جاري الاستيراد التكييفي والمزامنة الفورية...</span>
              </>
            ) : (
              <>
                <FileCheck className="w-4 h-4" />
                <span>
                  تأكيد الاستيراد التكييفي ({parseResult?.orders.length || 0} أمر عمل)
                  {targetType === 'new_table' ? ' كجدول جديد' : ''}
                </span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
