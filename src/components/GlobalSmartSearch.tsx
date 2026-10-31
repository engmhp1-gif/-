import React, { useState, useMemo, useRef, useEffect } from 'react';
import { WorkOrder } from '../types';
import { 
  Search, 
  X, 
  Sparkles, 
  FileDown, 
  FileSpreadsheet, 
  ArrowUpRight, 
  Building2, 
  Tag, 
  Hash, 
  Calendar,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { exportToExcel } from '../services/exportService';

interface GlobalSmartSearchProps {
  orders: WorkOrder[];
  onSelectOrder: (order: WorkOrder) => void;
  onOpenExportModal?: (customOrders: WorkOrder[], title: string) => void;
}

export const GlobalSmartSearch: React.FC<GlobalSmartSearchProps> = ({
  orders,
  onSelectOrder,
  onOpenExportModal
}) => {
  const [query, setQuery] = useState('');
  const [isResultsOpen, setIsResultsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close results card when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsResultsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Instant Smart Search across all fields starting from 1st character / digit
  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    return orders.filter(order => {
      const matchNumber = (order.workOrderNumber || '').toLowerCase().includes(q);
      const matchCode = (order.workOrderCode || '').toLowerCase().includes(q);
      const matchOffice = (order.office || '').toLowerCase().includes(q);
      const matchContractor = (order.contractor || '').toLowerCase().includes(q);
      const matchConsultantEntity = (order.consultant || '').toLowerCase().includes(q);
      const matchDate = (order.receiptDate || order.createdAt || '').toLowerCase().includes(q);
      const matchExecStatus = (order.executionStatus || '').toLowerCase().includes(q);
      const match155Status = (order.procedure155Status || '').toLowerCase().includes(q);
      const matchQualityNotes = (order.qualityNotes || order.executionNotes || '').toLowerCase().includes(q);
      const matchPhotoDoc = (order.photoDocumentation || '').toLowerCase().includes(q);
      const matchConsultant = (order.consultantForms || '').toLowerCase().includes(q);
      const matchConsultantClearance = (order.consultantClearanceForms || '').toLowerCase().includes(q);
      const matchForm190 = (order.form190 || '').toLowerCase().includes(q);
      const matchForm200 = (order.form200 || '').toLowerCase().includes(q);
      const matchInspection = (order.inspectionForm || '').toLowerCase().includes(q);

      return (
        matchNumber ||
        matchCode ||
        matchOffice ||
        matchContractor ||
        matchConsultantEntity ||
        matchDate ||
        matchExecStatus ||
        match155Status ||
        matchQualityNotes ||
        matchPhotoDoc ||
        matchConsultant ||
        matchConsultantClearance ||
        matchForm190 ||
        matchForm200 ||
        matchInspection
      );
    });
  }, [query, orders]);

  // Results Breakdown Stats
  const resultsStats = useMemo(() => {
    let qualified = 0;
    let unqualified = 0;
    const officeCounts: Record<string, number> = {};

    searchResults.forEach(o => {
      const s = String(o.procedure155Status || '');
      if (s.includes('مؤهل') && !s.includes('غير')) qualified++;
      else unqualified++;

      const off = o.office || 'غير محدد';
      officeCounts[off] = (officeCounts[off] || 0) + 1;
    });

    return { qualified, unqualified, officeCounts };
  }, [searchResults]);

  const handleExportSearchResultsExcel = () => {
    if (searchResults.length === 0) return;
    exportToExcel(
      searchResults,
      `نتائج البحث (${query})`,
      `نتائج_بحث_أوامر_العمل_${query.replace(/\s+/g, '_')}_${Date.now()}.xlsx`
    );
  };

  const handleExportSearchResultsComprehensive = () => {
    if (searchResults.length === 0 || !onOpenExportModal) return;
    onOpenExportModal(
      searchResults,
      `تقرير نتائج البحث الذكي: "${query}"`
    );
  };

  const highlightMatch = (text: string) => {
    if (!query.trim()) return text;
    const parts = text.split(new RegExp(`(${query.trim()})`, 'gi'));
    return (
      <span>
        {parts.map((part, i) => 
          part.toLowerCase() === query.trim().toLowerCase() ? (
            <mark key={i} className="bg-amber-300 text-slate-950 font-black px-0.5 rounded">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </span>
    );
  };

  return (
    <div ref={containerRef} className="relative w-full mb-6 z-40 text-right">
      {/* Prominent Search Input Box */}
      <div className="relative flex items-center">
        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
          <Search className={`w-5 h-5 transition-colors ${query ? 'text-blue-600' : 'text-slate-400'}`} />
        </div>

        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsResultsOpen(true);
          }}
          onFocus={() => {
            if (query.trim()) setIsResultsOpen(true);
          }}
          placeholder="محرك البحث الذكي: ابحث برقم أمر العمل، نوع أمر العمل، المكتب، المقاول، الاستشاري، تاريخ الاستلام، الملاحظات..."
          className="w-full py-3.5 pr-12 pl-24 bg-white rounded-2xl border-2 border-slate-200 hover:border-blue-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15 shadow-sm text-sm sm:text-base font-semibold text-slate-900 transition-all placeholder:text-slate-400"
        />

        {/* Clear & Status Indicator */}
        <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setIsResultsOpen(false);
              }}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              title="مسح البحث"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          <div className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>بحث فوري</span>
          </div>
        </div>
      </div>

      {/* Floating Results Popover Card inside page bounds */}
      {isResultsOpen && query.trim().length > 0 && (
        <div className="absolute top-full mt-2 left-0 right-0 max-h-[75vh] bg-white rounded-2xl shadow-2xl border-2 border-blue-500/40 overflow-hidden flex flex-col z-50 animate-in fade-in zoom-in-95 duration-150">
          
          {/* Header of results card */}
          <div className="p-4 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <h3 className="font-bold text-sm sm:text-base">
                  نتائج البحث الذكي: <span className="text-amber-300">"{query}"</span>
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-600/40 text-blue-200 border border-blue-500/40">
                  {searchResults.length} أمر عمل متطابق
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                البحث يشمل كافة الأعمدة والبيانات • انقر على أي أمر عمل للانتقال المباشر وتحديده
              </p>
            </div>

            {/* Quick Export actions from Search Results Card */}
            {searchResults.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleExportSearchResultsExcel}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                  title="تصدير نتائج البحث إلى Excel فوري"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Excel فوري</span>
                </button>

                {onOpenExportModal && (
                  <button
                    type="button"
                    onClick={handleExportSearchResultsComprehensive}
                    className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                    title="تصدير تقرير متكامل للنتائج (PDF / صور / PPTX)"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    <span>تقرير النتائج الشامل</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setIsResultsOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Quick Stats Bar in Results Card */}
          {searchResults.length > 0 && (
            <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center justify-between gap-2 text-xs flex-wrap">
              <div className="flex items-center gap-4">
                <span className="text-emerald-700 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>مؤهل للاغلاق ( معتمد ): {resultsStats.qualified}</span>
                </span>
                <span className="text-rose-700 font-bold flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>غير مؤهل للأغلاق: {resultsStats.unqualified}</span>
                </span>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {Object.entries(resultsStats.officeCounts).slice(0, 4).map(([off, count]) => (
                  <span key={off} className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 font-medium text-[11px]">
                    {off}: <strong>{count}</strong>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Results List */}
          <div className="p-3 overflow-y-auto space-y-2 flex-1 max-h-[50vh]">
            {searchResults.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs">
                لا توجد أوامر عمل مطابقة لعبارة البحث <strong className="text-slate-600">"{query}"</strong>. تأكد من صحة الإدخال.
              </div>
            ) : (
              searchResults.map(order => {
                const isQual = String(order.procedure155Status || '').includes('مؤهل') && !String(order.procedure155Status || '').includes('غير');

                return (
                  <div
                    key={order.id}
                    onClick={() => {
                      onSelectOrder(order);
                      setIsResultsOpen(false);
                    }}
                    className="p-3 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 cursor-pointer transition-all flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-right"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-black text-blue-700 text-xs sm:text-sm bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          {highlightMatch(order.workOrderNumber || '')}
                        </span>
                        <span className="font-mono font-bold text-slate-800 text-xs bg-slate-100 px-2 py-0.5 rounded">
                          {highlightMatch(order.workOrderCode || '')}
                        </span>
                        {order.receiptDate && (
                          <span className="text-[11px] text-slate-600 flex items-center gap-1 font-medium bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            <span>استلام: {highlightMatch(order.receiptDate)}</span>
                          </span>
                        )}
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          isQual ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-rose-100 text-rose-800 border border-rose-300'
                        }`}>
                          {order.procedure155Status || 'غير مؤهل للاغلاق'}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-600 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-slate-400" />
                          <span>{highlightMatch(order.office || '')}</span>
                        </span>
                        <span>•</span>
                        <span>المقاول: <strong>{highlightMatch(order.contractor || '')}</strong></span>
                        {order.consultant && (
                          <>
                            <span>•</span>
                            <span>الاستشاري: <strong>{highlightMatch(order.consultant)}</strong></span>
                          </>
                        )}
                        {order.qualityNotes && (
                          <>
                            <span>•</span>
                            <span className="text-slate-700 italic max-w-md truncate">
                              ملاحظات: {highlightMatch(order.qualityNotes)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 text-xs text-blue-600 font-bold shrink-0">
                      <span>عرض وتحديد بالجدول</span>
                      <ArrowUpRight className="w-4 h-4" />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer of Card */}
          <div className="p-3 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">
              يتم البحث والتحديث بشكل فوري ومتزامن
            </span>
            <button
              type="button"
              onClick={() => setIsResultsOpen(false)}
              className="px-4 py-1.5 rounded-lg bg-slate-800 text-white font-bold text-xs"
            >
              إغلاق
            </button>
          </div>

        </div>
      )}
    </div>
  );
};
