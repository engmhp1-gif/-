import React, { useState, useMemo, useRef } from 'react';
import {
  X,
  Link2,
  Sparkles,
  ArrowLeftRight,
  FileSpreadsheet,
  Layers,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ChevronDown,
  Upload,
  Clipboard,
  Check,
  RefreshCw,
  Search,
  Eye,
  SlidersHorizontal,
  TableProperties
} from 'lucide-react';
import { WorkOrder, MonthTable, ColumnDefinition, DropdownOptionsMap } from '../types';
import {
  autoMapSemanticColumns,
  SemanticMapping,
  normalizeColumnText
} from '../utils/semanticColumnMatcher';
import { parseWorkOrderExcelFile } from '../services/excelImportService';
import { getArabicMonthName, resolveOrderScope, isDefaultTableId } from '../utils/tableScope';

export interface CompatibleImportResultOptions {
  mode: 'merge_matching' | 'append_all' | 'merge_and_append';
  overwriteExistingData: boolean;
  sourceTableId: string;
  sourceTableName: string;
  distinctHighlight: boolean;
  highlightColor: string;
  importedFieldKeys: string[];
}

interface CompatibleTableImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTableId: string;
  currentTableName: string;
  currentOrders: WorkOrder[];
  allPlatformOrders: WorkOrder[];
  monthTables: MonthTable[];
  columns: ColumnDefinition[];
  dropdownOptions?: DropdownOptionsMap;
  onExecuteImport: (
    importedOrders: WorkOrder[],
    options: CompatibleImportResultOptions
  ) => Promise<boolean | void>;
}

export const CompatibleTableImportModal: React.FC<CompatibleTableImportModalProps> = ({
  isOpen,
  onClose,
  currentTableId,
  currentTableName,
  currentOrders,
  allPlatformOrders,
  monthTables,
  columns,
  dropdownOptions,
  onExecuteImport
}) => {
  const [sourceType, setSourceType] = useState<'platform_table' | 'external_file'>('platform_table');
  const [selectedSourceTableId, setSelectedSourceTableId] = useState<string>('');
  const [searchTableQuery, setSearchTableQuery] = useState('');
  const [importMode, setImportMode] = useState<'merge_and_append' | 'merge_matching' | 'append_all'>('merge_and_append');
  const [overwriteExistingData, setOverwriteExistingData] = useState(false);
  const [distinctHighlight, setDistinctHighlight] = useState(true);
  const [highlightColor, setHighlightColor] = useState('#f0fdf4'); // soft emerald tint
  const [isProcessing, setIsProcessing] = useState(false);
  const [customFile, setCustomFile] = useState<File | null>(null);
  const [fileParsedRows, setFileParsedRows] = useState<any[]>([]);
  const [fileHeaders, setFileHeaders] = useState<{ key: string; header: string; sampleValue?: any }[]>([]);
  const [columnMappings, setColumnMappings] = useState<SemanticMapping[]>([]);
  const [isParsingFile, setIsParsingFile] = useState(false);
  const [step, setStep] = useState<'select_source' | 'configure_mapping'>('select_source');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Group all platform orders by their resolved table
  const platformTablesList = useMemo(() => {
    // Collect all unique table scopes from monthTables and orders
    const tableMap = new Map<string, { id: string; name: string; year: number; month: number | 'all'; orders: WorkOrder[]; color?: string }>();

    // 1. Registered MonthTables
    monthTables.forEach(t => {
      tableMap.set(t.id, {
        id: t.id,
        name: t.name,
        year: t.year,
        month: t.month,
        orders: [],
        color: t.color
      });
    });

    // 2. Distribute all orders into their table buckets
    allPlatformOrders.forEach(o => {
      const scope = resolveOrderScope(o, monthTables);
      if (!tableMap.has(scope.tableId)) {
        tableMap.set(scope.tableId, {
          id: scope.tableId,
          name: scope.tableName,
          year: scope.year,
          month: scope.month,
          orders: [o],
          color: scope.tableColor
        });
      } else {
        tableMap.get(scope.tableId)!.orders.push(o);
      }
    });

    // Exclude the current active table itself from source list
    const list = Array.from(tableMap.values()).filter(t => t.id !== currentTableId && t.orders.length > 0);

    // Compute compatibility count for each candidate table
    const currentWonCodes = new Set(
      currentOrders.map(o => `${(o.workOrderNumber || '').trim().toLowerCase()}:::${(o.workOrderCode || '').trim().toLowerCase()}`).filter(k => k !== ':::')
    );
    const currentWons = new Set(
      currentOrders.map(o => (o.workOrderNumber || '').trim().toLowerCase()).filter(Boolean)
    );

    return list.map(t => {
      const exactMatches = t.orders.filter(o => {
        const k = `${(o.workOrderNumber || '').trim().toLowerCase()}:::${(o.workOrderCode || '').trim().toLowerCase()}`;
        return k !== ':::' && currentWonCodes.has(k);
      }).length;

      const wonMatches = t.orders.filter(o => {
        const won = (o.workOrderNumber || '').trim().toLowerCase();
        return won && currentWons.has(won);
      }).length;

      return {
        ...t,
        exactMatches,
        wonMatches,
        compatibilityScore: exactMatches * 2 + wonMatches
      };
    }).sort((a, b) => b.compatibilityScore - a.compatibilityScore);
  }, [allPlatformOrders, currentOrders, currentTableId, monthTables]);

  // Set default selected source table
  React.useEffect(() => {
    if (platformTablesList.length > 0 && !selectedSourceTableId) {
      setSelectedSourceTableId(platformTablesList[0].id);
    }
  }, [platformTablesList, selectedSourceTableId]);

  // Current selected source table object
  const selectedSourceTable = useMemo(() => {
    return platformTablesList.find(t => t.id === selectedSourceTableId);
  }, [platformTablesList, selectedSourceTableId]);

  // When source changes, automatically compute semantic column mappings
  const initializeMappingsForTable = (tableId: string) => {
    const tbl = platformTablesList.find(t => t.id === tableId);
    if (!tbl || tbl.orders.length === 0) return;

    // Extract headers from source orders
    const sample = tbl.orders[0];
    const sourceKeys = Object.keys(sample).filter(k => !['id', 'tableId', 'tableYear', 'tableMonth', 'tableName', 'createdAt', 'updatedAt'].includes(k));

    const sourceHeaders = sourceKeys.map(key => {
      // Find matching column title if known
      const matchedCol = columns.find(c => c.field === key);
      const title = matchedCol ? matchedCol.title : key;
      const sampleVal = tbl.orders.find(o => o[key])?.[key];
      return {
        key,
        header: title,
        sampleValue: sampleVal
      };
    });

    const mapped = autoMapSemanticColumns(sourceHeaders, columns);
    setColumnMappings(mapped);
  };

  const handleSelectTable = (tableId: string) => {
    setSelectedSourceTableId(tableId);
    initializeMappingsForTable(tableId);
  };

  // Handle file upload parsing for external file mode
  const handleFileUpload = async (file: File) => {
    setCustomFile(file);
    setIsParsingFile(true);
    try {
      const res = await parseWorkOrderExcelFile(file, columns);
      if (res && res.orders && res.orders.length > 0) {
        setFileParsedRows(res.orders);
        const headers = res.allDetectedColumns.map(c => ({
          key: c.matchedField || c.headerName,
          header: c.headerName,
          sampleValue: c.sampleValue
        }));
        setFileHeaders(headers);
        const mapped = autoMapSemanticColumns(headers, columns);
        setColumnMappings(mapped);
      }
    } catch (err) {
      console.error('File parsing failed:', err);
    } finally {
      setIsParsingFile(false);
    }
  };

  const handleMappingChange = (targetField: string, newSourceKey: string) => {
    setColumnMappings(prev =>
      prev.map(m => {
        if (m.targetField !== targetField) return m;
        if (!newSourceKey) {
          return {
            ...m,
            sourceKey: '',
            sourceHeader: '(غير معين)',
            confidence: 0,
            matchReason: 'تم إلغاء التعيين يدوياً',
            enabled: false
          };
        }
        return {
          ...m,
          sourceKey: newSourceKey,
          sourceHeader: newSourceKey,
          confidence: 100,
          matchReason: 'تعيين يدوي من المستخدم',
          enabled: true
        };
      })
    );
  };

  const handleToggleColumnEnable = (targetField: string) => {
    setColumnMappings(prev =>
      prev.map(m => (m.targetField === targetField ? { ...m, enabled: !m.enabled } : m))
    );
  };

  // Execute Compatible Import
  const handleProceedImport = async () => {
    setIsProcessing(true);
    try {
      let rawSourceOrders: WorkOrder[] = [];
      let sourceName = '';

      if (sourceType === 'platform_table') {
        if (!selectedSourceTable) return;
        rawSourceOrders = selectedSourceTable.orders;
        sourceName = selectedSourceTable.name;
      } else {
        rawSourceOrders = fileParsedRows as WorkOrder[];
        sourceName = customFile?.name || 'ملف خارجي';
      }

      if (rawSourceOrders.length === 0) return;

      // Map each source order into destination schema using enabled semantic mappings
      const enabledMappings = columnMappings.filter(m => m.enabled && m.sourceKey);
      const importedFieldKeys = enabledMappings.map(m => m.targetField);

      // Current orders map by (workOrderNumber:::workOrderCode) and workOrderNumber
      const currentOrdersByCode = new Map<string, WorkOrder>();
      const currentOrdersByWon = new Map<string, WorkOrder>();

      currentOrders.forEach(o => {
        const num = (o.workOrderNumber || '').trim().toLowerCase();
        const code = (o.workOrderCode || '').trim().toLowerCase();
        if (num && code) currentOrdersByCode.set(`${num}:::${code}`, o);
        if (num) currentOrdersByWon.set(num, o);
      });

      const updatedOrCreatedList: WorkOrder[] = [];

      for (const src of rawSourceOrders) {
        // Extract mapped values
        const mappedData: Record<string, any> = {};
        for (const map of enabledMappings) {
          const val = src[map.sourceKey];
          if (val !== undefined && val !== null && val !== '') {
            mappedData[map.targetField] = val;
          }
        }

        const srcWon = (src.workOrderNumber || mappedData.workOrderNumber || '').trim();
        const srcCode = (src.workOrderCode || mappedData.workOrderCode || '').trim();
        const fullKey = `${srcWon.toLowerCase()}:::${srcCode.toLowerCase()}`;

        // Find match in current table
        const matchedCurrent = (fullKey && currentOrdersByCode.get(fullKey)) || (srcWon && currentOrdersByWon.get(srcWon.toLowerCase()));

        if (matchedCurrent) {
          if (importMode === 'append_all') {
            // Treat as fresh duplicate row in append mode
            const newOrder: WorkOrder = {
              ...matchedCurrent,
              ...mappedData,
              id: `wo-imp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              tableId: currentTableId,
              isNew: true,
              isImported: true,
              importedFromTableId: sourceType === 'platform_table' ? selectedSourceTableId : 'external_file',
              importedFromTableName: sourceName,
              importedAt: new Date().toISOString(),
              importedFields: importedFieldKeys,
              rowBgColor: distinctHighlight ? highlightColor : undefined,
              updatedAt: new Date().toISOString()
            };
            updatedOrCreatedList.push(newOrder);
          } else {
            // Merge into matchedCurrent
            const mergedOrder: WorkOrder = {
              ...matchedCurrent,
              id: matchedCurrent.id,
              tableId: currentTableId,
              isImported: true,
              importedFromTableId: sourceType === 'platform_table' ? selectedSourceTableId : 'external_file',
              importedFromTableName: sourceName,
              importedAt: new Date().toISOString(),
              importedFields: Array.from(new Set([...(matchedCurrent.importedFields || []), ...importedFieldKeys])),
              rowBgColor: distinctHighlight ? highlightColor : matchedCurrent.rowBgColor,
              updatedAt: new Date().toISOString()
            };

            // Apply fields according to overwrite flag
            for (const [key, val] of Object.entries(mappedData)) {
              if (overwriteExistingData || (matchedCurrent as any)[key] === undefined || (matchedCurrent as any)[key] === '' || (matchedCurrent as any)[key] === null) {
                (mergedOrder as any)[key] = val;
              }
            }

            // Copy photos if available
            if (Array.isArray(src.photos) && src.photos.length > 0) {
              const curPhotos = Array.isArray(matchedCurrent.photos) ? [...matchedCurrent.photos] : [];
              const pIds = new Set(curPhotos.map(p => p.id || p.url));
              src.photos.forEach(p => {
                if (p && !pIds.has(p.id || p.url)) curPhotos.push(p);
              });
              mergedOrder.photos = curPhotos;
            }

            updatedOrCreatedList.push(mergedOrder);
          }
        } else {
          // No match in current table
          if (importMode === 'merge_matching') {
            // Skip non-matched rows in pure merge mode
            continue;
          }

          // Create brand new row in current table
          const newOrder: WorkOrder = {
            id: `wo-imp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            tableId: currentTableId,
            office: mappedData.office || src.office || 'مكتب عرعر',
            contractor: mappedData.contractor || src.contractor || 'غير محدد',
            workOrderNumber: srcWon || `WO-${Date.now()}`,
            workOrderCode: srcCode || '',
            executionStatus: mappedData.executionStatus || src.executionStatus || 'قيد التدقيق',
            procedure155Status: mappedData.procedure155Status || src.procedure155Status || 'مؤهل للاغلاق ( معتمد )',
            isNew: true,
            isImported: true,
            importedFromTableId: sourceType === 'platform_table' ? selectedSourceTableId : 'external_file',
            importedFromTableName: sourceName,
            importedAt: new Date().toISOString(),
            importedFields: importedFieldKeys,
            rowBgColor: distinctHighlight ? highlightColor : undefined,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            ...mappedData
          };

          if (Array.isArray(src.photos) && src.photos.length > 0) {
            newOrder.photos = [...src.photos];
          }

          updatedOrCreatedList.push(newOrder);
        }
      }

      const result = await onExecuteImport(updatedOrCreatedList, {
        mode: importMode,
        overwriteExistingData,
        sourceTableId: sourceType === 'platform_table' ? selectedSourceTableId : 'external_file',
        sourceTableName: sourceName,
        distinctHighlight,
        highlightColor,
        importedFieldKeys
      });

      if (result !== false) {
        onClose();
      }
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border-2 border-indigo-600 overflow-hidden flex flex-col max-h-[92vh] text-right font-['Cairo',sans-serif]"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-6 bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-900 text-white flex items-center justify-between border-b border-indigo-500/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-500 text-white flex items-center justify-center font-bold shadow-lg ring-2 ring-indigo-400/50 shrink-0">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-1.5">
                  <span>استيراد البيانات من الجداول المتوافقة</span>
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-indigo-500 text-white shadow-xs">
                  بدلالة الأعمدة الدلالية
                </span>
              </div>
              <p className="text-xs text-indigo-200 mt-0.5">
                استيراد تلقائي وذكي للخلايا في أعمدتها المتوافقة مع تمييز لوني وبصري فوري لسهولة تمييزها
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
            title="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Steps Navigation Bar */}
        <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-700 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-slate-500">الجدول المستهدف الحالي:</span>
            <span className="px-2.5 py-0.5 rounded-lg bg-indigo-100 text-indigo-900 font-black border border-indigo-200">
              {currentTableName} ({currentOrders.length} صف)
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setStep('select_source')}
              className={`px-3 py-1 rounded-xl cursor-pointer transition-all ${
                step === 'select_source'
                  ? 'bg-indigo-600 text-white shadow-xs font-black'
                  : 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-300'
              }`}
            >
              1. اختيار الجدول المصدر
            </button>
            <span>←</span>
            <button
              type="button"
              onClick={() => {
                if (selectedSourceTableId) {
                  initializeMappingsForTable(selectedSourceTableId);
                }
                setStep('configure_mapping');
              }}
              className={`px-3 py-1 rounded-xl cursor-pointer transition-all ${
                step === 'configure_mapping'
                  ? 'bg-indigo-600 text-white shadow-xs font-black'
                  : 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-300'
              }`}
            >
              2. مطابقة الأعمدة الدلالية والخيارات
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {step === 'select_source' && (
            <div className="space-y-4">
              {/* Source Mode Toggle: Platform Tables vs External File */}
              <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setSourceType('platform_table')}
                  className={`py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    sourceType === 'platform_table'
                      ? 'bg-white text-indigo-900 shadow-sm border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Layers className="w-4 h-4 text-indigo-600" />
                  <span>من جداول المنظومة المتاحة ({platformTablesList.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSourceType('external_file')}
                  className={`py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    sourceType === 'external_file'
                      ? 'bg-white text-indigo-900 shadow-sm border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>استيراد من ملف خارجي (Excel / CSV)</span>
                </button>
              </div>

              {sourceType === 'platform_table' ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-black text-slate-800">
                      اختر الجدول المتوافق الذي تود استيراد البيانات منه:
                    </span>
                    <div className="relative w-48">
                      <input
                        type="text"
                        value={searchTableQuery}
                        onChange={(e) => setSearchTableQuery(e.target.value)}
                        placeholder="بحث في الجداول..."
                        className="w-full text-xs py-1 pr-6 pl-2 bg-slate-50 border border-slate-200 rounded-lg"
                      />
                      <Search className="w-3 h-3 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2" />
                    </div>
                  </div>

                  {platformTablesList.length === 0 ? (
                    <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-500 space-y-2">
                      <Layers className="w-8 h-8 text-slate-300 mx-auto" />
                      <p className="font-bold text-sm">لا توجد جداول أخرى بها بيانات في المنظومة حالياً.</p>
                      <p className="text-xs text-slate-400">يمكنك استخدام خيار الاستيراد من ملف Excel خارجي أعلاه.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto p-1">
                      {platformTablesList
                        .filter(t => t.name.toLowerCase().includes(searchTableQuery.toLowerCase()))
                        .map(table => {
                          const isSelected = selectedSourceTableId === table.id;
                          return (
                            <div
                              key={table.id}
                              onClick={() => handleSelectTable(table.id)}
                              className={`p-3 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between text-right ${
                                isSelected
                                  ? 'bg-indigo-50/90 border-indigo-600 ring-2 ring-indigo-400/40 shadow-sm'
                                  : 'bg-white border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                                    <h4 className="text-xs font-black text-slate-900">{table.name}</h4>
                                  </div>
                                  <p className="text-[11px] text-slate-500">
                                    الفترة: {table.month === 'all' ? 'كافة الشهور' : getArabicMonthName(table.month)} {table.year}
                                  </p>
                                </div>
                                <span className="font-mono text-xs font-black px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 border border-indigo-200">
                                  {table.orders.length} أمر
                                </span>
                              </div>

                              {/* Compatibility indicator */}
                              <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-600">
                                <span className="flex items-center gap-1">
                                  <Link2 className="w-3 h-3 text-orange-500" />
                                  <span>تطابق رقم ورمز العمل: <strong className="text-orange-600 font-bold">{table.exactMatches}</strong></span>
                                </span>
                                {isSelected && (
                                  <span className="px-1.5 py-0.2 rounded bg-indigo-600 text-white font-bold flex items-center gap-0.5">
                                    <Check className="w-2.5 h-2.5" />
                                    <span>محدد</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              ) : (
                /* External File Upload View */
                <div className="space-y-3">
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="p-8 border-2 border-dashed border-indigo-300 hover:border-indigo-500 rounded-2xl bg-indigo-50/40 hover:bg-indigo-50 text-center cursor-pointer transition-all space-y-2"
                  >
                    <Upload className="w-10 h-10 text-indigo-600 mx-auto" />
                    <h4 className="text-sm font-bold text-slate-800">
                      {customFile ? customFile.name : 'اسحب وأفلت ملف Excel أو CSV أو JSON هنا أو انقر للاختيار'}
                    </h4>
                    <p className="text-xs text-slate-500">
                      يدعم التنسيقات .xlsx, .xls, .csv, .json - سيتم التعرف تلقائياً على الأعمدة الدلالية
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls,.csv,.json,application/json,text/plain,application/octet-stream,*/*"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleFileUpload(e.target.files[0]);
                        }
                      }}
                    />
                  </div>

                  {fileParsedRows.length > 0 && (
                    <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>تم التعرف على ({fileParsedRows.length}) سطر و ({fileHeaders.length}) عمود من الملف</span>
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Next Step Button */}
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    if (sourceType === 'platform_table' && selectedSourceTableId) {
                      initializeMappingsForTable(selectedSourceTableId);
                    }
                    setStep('configure_mapping');
                  }}
                  disabled={sourceType === 'platform_table' ? !selectedSourceTableId : fileParsedRows.length === 0}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black text-xs shadow-md cursor-pointer flex items-center gap-2"
                >
                  <span>متابعة إلى مطابقة الأعمدة الدلالية</span>
                  <span>←</span>
                </button>
              </div>
            </div>
          )}

          {step === 'configure_mapping' && (
            <div className="space-y-5">
              {/* Top Banner explaining Semantic Matching */}
              <div className="p-3 bg-gradient-to-r from-indigo-50 to-cyan-50 rounded-2xl border border-indigo-200 text-indigo-950 flex items-start gap-2.5 text-xs">
                <Sparkles className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-black text-indigo-900">محرك المطابقة الدلالية الذكي للأعمدة</h4>
                  <p className="text-slate-600 mt-0.5 leading-relaxed">
                    تم التعرف تلقائياً على الأعمدة الدلالية المتوافقة (رقم أمر العمل، الرمز، المكتب، المقاول، نماذج الاستشاري، توثيق الصور، نموذج 190، نموذج 200، نموذج الفحص، ملاحظات الجودة، حالة 155). يمكنك تخصيص التعيين أو تعطيل أي عمود لا ترغب باستيراد خلاياه.
                  </p>
                </div>
              </div>

              {/* Column Mappings Grid */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <TableProperties className="w-4 h-4 text-indigo-600" />
                    <span>مطابقة الأعمدة الدلالية والخلايا المستهدفة:</span>
                  </h4>
                  <span className="text-[11px] text-slate-500 font-bold">
                    الأعمدة المحددة للاستيراد: {columnMappings.filter(m => m.enabled && m.sourceKey).length} من {columnMappings.length}
                  </span>
                </div>

                <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-2xl divide-y divide-slate-100 bg-white">
                  {columnMappings.map(mapping => {
                    const isEnabled = mapping.enabled && Boolean(mapping.sourceKey);
                    return (
                      <div
                        key={mapping.targetField}
                        className={`p-2.5 flex items-center justify-between gap-3 text-xs transition-colors ${
                          isEnabled ? 'bg-white hover:bg-slate-50' : 'bg-slate-50/70 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-[180px]">
                          <input
                            type="checkbox"
                            checked={mapping.enabled}
                            onChange={() => handleToggleColumnEnable(mapping.targetField)}
                            className="w-4 h-4 rounded text-indigo-600 accent-indigo-600 cursor-pointer"
                          />
                          <div>
                            <span className="font-black text-slate-900">{mapping.targetTitle}</span>
                            <span className="text-[10px] text-slate-400 font-mono block">({mapping.targetField})</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 text-slate-400">
                          <ArrowLeftRight className="w-3.5 h-3.5" />
                        </div>

                        <div className="flex-1 min-w-[200px]">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                              {mapping.sourceHeader || mapping.sourceKey || '(غير معين)'}
                            </span>
                            {mapping.confidence > 0 && (
                              <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md ${
                                mapping.confidence >= 90
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}>
                                {mapping.confidence}% {mapping.matchReason}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Import Execution Mode Configuration */}
              <div className="space-y-3 pt-2 border-t border-slate-200">
                <h4 className="text-xs font-black text-slate-800">طريقة الاستيراد والتطبيق بالجدول:</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <label
                    onClick={() => setImportMode('merge_and_append')}
                    className={`p-3 rounded-2xl border-2 cursor-pointer flex flex-col justify-between text-right transition-all ${
                      importMode === 'merge_and_append'
                        ? 'bg-indigo-50 border-indigo-600 ring-2 ring-indigo-400/30'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-black text-xs text-indigo-950">دمج وإضافة (شامل موصى به)</span>
                        <input
                          type="radio"
                          name="impMode"
                          checked={importMode === 'merge_and_append'}
                          onChange={() => setImportMode('merge_and_append')}
                          className="accent-indigo-600"
                        />
                      </div>
                      <p className="text-[11px] text-slate-500 leading-normal">
                        يحدث خلايا الأوامر المتطابقة برقم ورمز العمل، ويضيف الأوامر الجديدة كصفوف مستقلة.
                      </p>
                    </div>
                  </label>

                  <label
                    onClick={() => setImportMode('merge_matching')}
                    className={`p-3 rounded-2xl border-2 cursor-pointer flex flex-col justify-between text-right transition-all ${
                      importMode === 'merge_matching'
                        ? 'bg-indigo-50 border-indigo-600 ring-2 ring-indigo-400/30'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-black text-xs text-indigo-950">دمج وتحديث المتطابق فقط</span>
                        <input
                          type="radio"
                          name="impMode"
                          checked={importMode === 'merge_matching'}
                          onChange={() => setImportMode('merge_matching')}
                          className="accent-indigo-600"
                        />
                      </div>
                      <p className="text-[11px] text-slate-500 leading-normal">
                        يحدث بيانات وخلايا الصفوف الموجودة فقط دون إنشاء صفوف جديدة.
                      </p>
                    </div>
                  </label>

                  <label
                    onClick={() => setImportMode('append_all')}
                    className={`p-3 rounded-2xl border-2 cursor-pointer flex flex-col justify-between text-right transition-all ${
                      importMode === 'append_all'
                        ? 'bg-indigo-50 border-indigo-600 ring-2 ring-indigo-400/30'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-black text-xs text-indigo-950">إضافة كافة السجلات كصفوف جديدة</span>
                        <input
                          type="radio"
                          name="impMode"
                          checked={importMode === 'append_all'}
                          onChange={() => setImportMode('append_all')}
                          className="accent-indigo-600"
                        />
                      </div>
                      <p className="text-[11px] text-slate-500 leading-normal">
                        يدرج كافة البيانات كصفوف إضافية مباشرة داخل الجدول الحالي.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Distinct Visual Highlight Configuration (المطلب الأساسي: وتكون مميزة لسهولة تمييزها عن غيرها) */}
              <div className="p-3.5 bg-amber-50/80 rounded-2xl border-2 border-amber-300/80 space-y-2 text-right">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-600" />
                    <span className="text-xs font-black text-amber-950">
                      التمييز البصري الذكي للبيانات والصفوف المستوردة:
                    </span>
                  </div>
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-amber-900">
                    <input
                      type="checkbox"
                      checked={distinctHighlight}
                      onChange={(e) => setDistinctHighlight(e.target.checked)}
                      className="w-4 h-4 rounded text-amber-600 accent-amber-600 cursor-pointer"
                    />
                    <span>تفعيل شارة ولون التمييز</span>
                  </label>
                </div>
                <p className="text-[11px] text-amber-900/90 leading-relaxed">
                  عند تفعيل هذا الخيار، سيتم تمييز الصفوف المستوردة بشارة واضحة <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-amber-300 font-bold text-indigo-900">✨ مستورد متوافق</span> مع توضيح اسم الجدول المستورد منه، وتمييز الخلايا المستوردة لتسهيل التعرف عليها وتصفيتها بضغطة زر واحدة.
                </p>

                {distinctHighlight && (
                  <div className="flex items-center gap-2 pt-1 border-t border-amber-200/60">
                    <span className="text-[11px] font-bold text-amber-900">لون خلفية التمييز:</span>
                    <div className="flex items-center gap-1.5">
                      {[
                        { color: '#f0fdf4', label: 'أخضر هادئ', ring: 'bg-emerald-100 border-emerald-400' },
                        { color: '#eff6ff', label: 'سماوي هادئ', ring: 'bg-blue-100 border-blue-400' },
                        { color: '#faf5ff', label: 'بنفسجي هادئ', ring: 'bg-purple-100 border-purple-400' },
                        { color: '#fffbeb', label: 'عنبري هادئ', ring: 'bg-amber-100 border-amber-400' },
                      ].map(swatch => (
                        <button
                          key={swatch.color}
                          type="button"
                          onClick={() => setHighlightColor(swatch.color)}
                          className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold cursor-pointer transition-all ${swatch.ring} ${
                            highlightColor === swatch.color ? 'ring-2 ring-indigo-600 font-black scale-105' : 'opacity-70'
                          }`}
                        >
                          {swatch.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Overwrite empty only toggle */}
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <span>تحديث الخلايا الفارغة فقط وعدم استبدال الخلايا المملوءة مسبقاً:</span>
                <input
                  type="checkbox"
                  checked={!overwriteExistingData}
                  onChange={(e) => setOverwriteExistingData(!e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 accent-indigo-600 cursor-pointer"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setStep('select_source')}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  ← رجوع لاختيار المصدر
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    إلغاء
                  </button>

                  <button
                    type="button"
                    onClick={handleProceedImport}
                    disabled={isProcessing || columnMappings.filter(m => m.enabled && m.sourceKey).length === 0}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-700 hover:to-cyan-700 text-white font-black text-xs shadow-lg cursor-pointer flex items-center gap-2 disabled:opacity-50 active:scale-95 transition-all"
                  >
                    {isProcessing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>جارٍ الاستيراد والمطابقة...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>تنفيذ استيراد المتوافق الآن</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
