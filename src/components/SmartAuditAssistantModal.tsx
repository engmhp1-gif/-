import React, { useState, useMemo } from 'react';
import { 
  WorkOrder, 
  SubOffice, 
  Procedure155Status 
} from '../types';
import { 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  Camera, 
  FileText, 
  Building2, 
  Sparkles, 
  X, 
  Zap, 
  ArrowRight, 
  Filter, 
  FileSpreadsheet, 
  TrendingUp, 
  Check, 
  AlertCircle,
  HelpCircle,
  Clock,
  Layers,
  Bot,
  Copy,
  CheckCheck,
  Loader2
} from 'lucide-react';
import { exportToExcel } from '../services/exportService';

interface SmartAuditAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  workOrders: WorkOrder[];
  offices?: SubOffice[];
  onBatchUpdateStatus?: (orderIds: string[], status: Procedure155Status) => Promise<void>;
  onFilterDeficienciesOnly?: () => void;
  onSelectOrderToEdit?: (order: WorkOrder) => void;
}

interface OrderAuditReport {
  order: WorkOrder;
  isReady: boolean;
  score: number; // 0 - 100
  criticalIssues: string[];
  warnings: string[];
}

export const SmartAuditAssistantModal: React.FC<SmartAuditAssistantModalProps> = ({
  isOpen,
  onClose,
  workOrders,
  offices,
  onBatchUpdateStatus,
  onFilterDeficienciesOnly,
  onSelectOrderToEdit
}) => {
  const [activeFilterTab, setActiveFilterTab] = useState<'all' | 'ready' | 'critical' | 'warnings'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isBatchApplying, setIsBatchApplying] = useState(false);
  const [appliedBatchSuccess, setAppliedBatchSuccess] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [showAiModal, setShowAiModal] = useState(false);
  const [copiedAiReport, setCopiedAiReport] = useState(false);

  // Compute detailed rule-based audit for each work order
  const auditReports = useMemo<OrderAuditReport[]>(() => {
    return workOrders.map(order => {
      const critical: string[] = [];
      const warnings: string[] = [];
      let score = 100;

      // 1. Check contractor and office assignment
      if (!order.office || order.office.trim() === '') {
        critical.push('المكتب الفرعي غير محدد');
        score -= 20;
      }
      if (!order.contractor || order.contractor.trim() === '') {
        critical.push('اسم المقاول المنفذ غير محدد');
        score -= 20;
      }

      // 2. Check Photo Documentation (إلزامي لإجراء 155)
      const photoDoc = String(order.photoDocumentation || '').trim();
      const hasActualPhotos = Array.isArray(order.photos) && order.photos.length > 0;
      if (photoDoc.includes('غير') || (!hasActualPhotos && photoDoc === 'غير مكتمل')) {
        critical.push('التوثيق الفوتوغرافي الميداني غير مكتمل');
        score -= 30;
      } else if (!hasActualPhotos && (!photoDoc || photoDoc === '(فارغ)')) {
        warnings.push('لم يتم إرفاق صور ميدانية توثيقية');
        score -= 15;
      }

      // 3. Check Form 190, 200, Inspection Form
      const f190 = String(order.form190 || '').trim();
      const f200 = String(order.form200 || '').trim();
      const insp = String(order.inspectionForm || '').trim();

      if (f190 === 'غير مكتمل') {
        critical.push('نموذج 190 غير مكتمل');
        score -= 15;
      }
      if (f200 === 'غير مكتمل') {
        critical.push('نموذج 200 غير مكتمل');
        score -= 15;
      }
      if (insp === 'غير مكتمل') {
        critical.push('نموذج الفحص والتدقيق غير مكتمل');
        score -= 15;
      }

      // 4. Check Quality Notes
      const notes = (order.qualityNotes || order.executionNotes || '').trim();
      if (notes.length > 0) {
        warnings.push(`توجد ملاحظات جودة مسجلة: "${notes.slice(0, 45)}${notes.length > 45 ? '...' : ''}"`);
        score -= 10;
      }

      // 5. Check consultant clearance
      const clearance = String(order.consultantClearanceForms || '').trim();
      if (clearance === 'غير مكتمل') {
        warnings.push('نماذج إجازة الاستشاري معلقة');
        score -= 10;
      }

      score = Math.max(0, Math.min(100, score));
      const isReady = critical.length === 0;

      return {
        order,
        isReady,
        score,
        criticalIssues: critical,
        warnings
      };
    });
  }, [workOrders]);

  // Aggregate stats
  const total = auditReports.length;
  const readyOrders = useMemo(() => auditReports.filter(r => r.isReady), [auditReports]);
  const criticalOrders = useMemo(() => auditReports.filter(r => r.criticalIssues.length > 0), [auditReports]);
  const warningOrders = useMemo(() => auditReports.filter(r => r.isReady && r.warnings.length > 0), [auditReports]);

  // Candidates for one-click approval: Orders that meet all criteria but aren't yet marked 'مؤهل للاغلاق ( معتمد )'
  const approvalCandidates = useMemo(() => {
    return readyOrders
      .filter(r => {
        const s = String(r.order.procedure155Status || '');
        return !s.includes('مؤهل') && !s.includes('معتمد') && !s.includes('تم');
      })
      .map(r => r.order.id);
  }, [readyOrders]);

  const complianceRate = total > 0 ? Math.round((readyOrders.length / total) * 100) : 100;

  // Filtered reports for the drilldown table
  const displayedReports = useMemo(() => {
    return auditReports.filter(r => {
      if (activeFilterTab === 'ready' && !r.isReady) return false;
      if (activeFilterTab === 'critical' && r.criticalIssues.length === 0) return false;
      if (activeFilterTab === 'warnings' && (r.warnings.length === 0 || !r.isReady)) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const num = (r.order.workOrderNumber || '').toLowerCase();
        const code = (r.order.workOrderCode || '').toLowerCase();
        const off = (r.order.office || '').toLowerCase();
        const cont = (r.order.contractor || '').toLowerCase();
        return num.includes(q) || code.includes(q) || off.includes(q) || cont.includes(q);
      }
      return true;
    });
  }, [auditReports, activeFilterTab, searchQuery]);

  // One-click batch approval
  const handleBatchApprove = async () => {
    if (!onBatchUpdateStatus || approvalCandidates.length === 0) return;
    setIsBatchApplying(true);
    try {
      await onBatchUpdateStatus(approvalCandidates, 'مؤهل للاغلاق ( معتمد )');
      setAppliedBatchSuccess(true);
      setTimeout(() => setAppliedBatchSuccess(false), 3000);
    } finally {
      setIsBatchApplying(false);
    }
  };

  // Export audit summary
  const handleExportAuditReport = () => {
    const exportData = auditReports.map(r => ({
      ...r.order,
      auditScore: `${r.score}%`,
      auditReadiness: r.isReady ? 'مستوفٍ وجاهز للإغلاق 155' : 'غير مستوفٍ لنواقص',
      auditCriticalIssues: r.criticalIssues.join(' | ') || 'لا يوجد',
      auditWarnings: r.warnings.join(' | ') || 'لا يوجد'
    }));

    exportToExcel(
      exportData,
      'تقرير التدقيق الذكي وفحص الامتثال لإجراء 155',
      `تقرير_التدقيق_الذكي_155_${Date.now()}.xlsx`
    );
  };

  const handleFetchAiRecommendations = async () => {
    setIsAiLoading(true);
    setShowAiModal(true);
    try {
      const topDeficiencies = criticalOrders.slice(0, 15).map(r => ({
        workOrderNumber: r.order.workOrderNumber,
        office: r.order.office,
        contractor: r.order.contractor,
        criticalIssues: r.criticalIssues,
        warnings: r.warnings
      }));

      const res = await fetch('/api/smart-audit/ai-recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary: {
            total,
            readyCount: readyOrders.length,
            criticalCount: criticalOrders.length,
            warningCount: warningOrders.length,
            complianceRate
          },
          deficiencies: topDeficiencies
        })
      });
      const data = await res.json();
      if (data && data.recommendations) {
        setAiReport(data.recommendations);
      } else {
        setAiReport('تعذر استخراج التوصيات في الوقت الحالي. يرجى إعادة المحاولة.');
      }
    } catch (e: any) {
      setAiReport('حدث خطأ في الاتصال بخادم التحليل الذكي: ' + (e?.message || 'خطأ غير معروف'));
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleCopyAiReport = () => {
    if (!aiReport) return;
    navigator.clipboard.writeText(aiReport);
    setCopiedAiReport(true);
    setTimeout(() => setCopiedAiReport(false), 2500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-xs font-['Cairo',sans-serif] animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden text-right animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-400/30 flex items-center justify-center shadow-xs">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black tracking-tight text-white">
                  الفاحص الذكي الشامل لجودة وامتثال أوامر العمل
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-black bg-emerald-500/30 text-emerald-300 border border-emerald-400/40">
                  إجراء 155
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                فحص فوري وتحليلي لمطابقة التوثيق الميداني والنماذج والصور قبل التوقيع النهائي
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer border border-white/10"
            title="إغلاق النافذة"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Top Intelligence Metrics Ribbon */}
        <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 shrink-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            
            {/* Metric 1: Compliance Rate */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs text-right">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">معدل الامتثال العام</span>
                <TrendingUp className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900 font-mono">{complianceRate}%</span>
                <span className={`text-[11px] font-bold ${complianceRate >= 70 ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {complianceRate >= 70 ? 'جاهزية عالية' : 'نواقص قيد الإكمال'}
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${complianceRate >= 70 ? 'bg-emerald-600' : 'bg-amber-600'}`}
                  style={{ width: `${complianceRate}%` }}
                />
              </div>
            </div>

            {/* Metric 2: Ready Orders */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs text-right">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">مستوفية وجاهزة 155</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-emerald-700 font-mono">{readyOrders.length}</span>
                <span className="text-xs text-slate-400 font-bold">من أصل {total}</span>
              </div>
              <span className="inline-block mt-2 text-[10px] text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                كاملة المتطلبات الفنية
              </span>
            </div>

            {/* Metric 3: Critical Deficiencies */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs text-right">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">نواقص حرجة تمنع الإغلاق</span>
                <AlertCircle className="w-4 h-4 text-rose-600" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-rose-700 font-mono">{criticalOrders.length}</span>
                <span className="text-xs text-rose-600 font-bold">أمر بحاجة لإجراء</span>
              </div>
              <span className="inline-block mt-2 text-[10px] text-rose-800 font-bold bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                صور أو نماذج غير مكتملة
              </span>
            </div>

            {/* Metric 4: Warnings & Notes */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs text-right">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">ملاحظات فنية مسجلة</span>
                <AlertTriangle className="w-4 h-4 text-amber-600" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-amber-700 font-mono">{warningOrders.length}</span>
                <span className="text-xs text-amber-600 font-bold">تتطلب المراجعة</span>
              </div>
              <span className="inline-block mt-2 text-[10px] text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                ملاحظات جودة مفتوحة
              </span>
            </div>

          </div>

          {/* Quick Smart Action Bar */}
          <div className="mt-3.5 pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Batch Approve Candidate Button */}
              {approvalCandidates.length > 0 && onBatchUpdateStatus && (
                <button
                  type="button"
                  onClick={handleBatchApprove}
                  disabled={isBatchApplying}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-xs transition-all cursor-pointer disabled:opacity-50"
                  title="ترقية جميع الأوامر المستوفية إلى (مؤهل للاغلاق - معتمد) بنقرة واحدة"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>اعتماد الأوامر المستوفية فورياً ({approvalCandidates.length})</span>
                  {isBatchApplying && <span className="animate-spin text-xs">⏳</span>}
                </button>
              )}

              {appliedBatchSuccess && (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-100 px-3 py-1.5 rounded-xl border border-emerald-300 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                  تم اعتماد وترحيل الحالات السحابية بنجاح!
                </span>
              )}

              {/* Filter Table in Background */}
              {onFilterDeficienciesOnly && criticalOrders.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    onFilterDeficienciesOnly();
                    onClose();
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 text-xs font-bold transition-all cursor-pointer"
                  title="إغلاق وتطبيق الفلتر في الجدول الرئيسي لعرض النواقص فقط"
                >
                  <Filter className="w-3.5 h-3.5 text-rose-600" />
                  <span>تصفية الجدول الرئيسي على النواقص ({criticalOrders.length})</span>
                </button>
              )}
            </div>

            {/* AI Recommendations Button */}
            <div className="flex items-center gap-2 mr-auto">
              <button
                type="button"
                onClick={handleFetchAiRecommendations}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-purple-700 via-indigo-700 to-blue-700 hover:from-purple-600 hover:to-blue-600 text-white text-xs font-black shadow-xs transition-all cursor-pointer group"
                title="توليد توصيات استشارية واستراتيجية متقدمة لإغلاق الأوامر"
              >
                <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                <span>التحليل الاستشاري المتقدم (Audit Analysis)</span>
              </button>

              {/* Export Audit Report Button */}
              <button
                type="button"
                onClick={handleExportAuditReport}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                title="تصدير نتائج الفحص والتدقيق كملف إكسل تفصيلي"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>تصدير تقرير الفحص (Excel)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Drilldown Toolbar: Tabs & Search */}
        <div className="px-5 py-3 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveFilterTab('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeFilterTab === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              كافة الأوامر ({total})
            </button>

            <button
              type="button"
              onClick={() => setActiveFilterTab('critical')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                activeFilterTab === 'critical'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-rose-700 hover:bg-rose-100'
              }`}
            >
              <AlertCircle className="w-3 h-3" />
              <span>نواقص حرجة ({criticalOrders.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveFilterTab('warnings')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                activeFilterTab === 'warnings'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-amber-800 hover:bg-amber-100'
              }`}
            >
              <AlertTriangle className="w-3 h-3" />
              <span>ملاحظات ({warningOrders.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveFilterTab('ready')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                activeFilterTab === 'ready'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-emerald-800 hover:bg-emerald-100'
              }`}
            >
              <CheckCircle2 className="w-3 h-3" />
              <span>مستوفية ({readyOrders.length})</span>
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث برقم أمر العمل أو المقاول..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-300 text-xs bg-slate-50 focus:bg-white focus:border-blue-500 focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Drilldown List Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2.5 bg-slate-50/60">
          {displayedReports.length === 0 ? (
            <div className="py-16 text-center text-slate-500">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-2 opacity-80" />
              <div className="font-bold text-slate-800">لا توجد سجلات مطابقة لهذا الفرز</div>
              <div className="text-xs text-slate-500 mt-1">كافة الأوامر المحددة مستوفية للشروط المطلوبة</div>
            </div>
          ) : (
            displayedReports.map(rep => {
              const { order, isReady, score, criticalIssues, warnings } = rep;
              return (
                <div 
                  key={order.id}
                  className={`bg-white rounded-2xl p-4 border transition-all shadow-2xs hover:shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-right ${
                    !isReady
                      ? 'border-rose-200 hover:border-rose-300'
                      : warnings.length > 0
                      ? 'border-amber-200 hover:border-amber-300'
                      : 'border-emerald-200 hover:border-emerald-300'
                  }`}
                >
                  {/* Left (RTL Right): Core Info */}
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-sm text-slate-900 font-mono">
                        #{order.workOrderNumber || '(بدون رقم)'}
                      </span>
                      {order.workOrderCode && (
                        <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                          {order.workOrderCode}
                        </span>
                      )}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isReady
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-rose-100 text-rose-800 border border-rose-300'
                      }`}>
                        {isReady ? 'مستوفٍ لمعايير 155' : 'نواقص غير مكتملة'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-600 flex-wrap">
                      <span className="font-semibold text-slate-700 flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        {order.office || 'مكتب غير محدد'}
                      </span>
                      <span>•</span>
                      <span>المقاول: <strong className="text-slate-800">{order.contractor || 'غير محدد'}</strong></span>
                      {order.receiptDate && (
                        <>
                          <span>•</span>
                          <span className="font-mono text-slate-500">{order.receiptDate}</span>
                        </>
                      )}
                    </div>

                    {/* Deficiencies Checklist */}
                    {(criticalIssues.length > 0 || warnings.length > 0) && (
                      <div className="pt-2 flex flex-wrap gap-1.5">
                        {criticalIssues.map((crit, idx) => (
                          <span 
                            key={`c-${idx}`}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200"
                          >
                            <AlertCircle className="w-3 h-3 text-rose-600 shrink-0" />
                            <span>{crit}</span>
                          </span>
                        ))}
                        {warnings.map((warn, idx) => (
                          <span 
                            key={`w-${idx}`}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200"
                          >
                            <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                            <span>{warn}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Right (RTL Left): Score & Action */}
                  <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                    <div className="text-center px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="text-[10px] text-slate-500 font-bold">درجة الامتثال</div>
                      <div className={`text-base font-black font-mono ${
                        score >= 80 ? 'text-emerald-700' : score >= 50 ? 'text-amber-700' : 'text-rose-700'
                      }`}>
                        {score}%
                      </div>
                    </div>

                    {onSelectOrderToEdit && (
                      <button
                        type="button"
                        onClick={() => {
                          onSelectOrderToEdit(order);
                          onClose();
                        }}
                        className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all cursor-pointer shadow-2xs whitespace-nowrap"
                      >
                        معالجة وتعديل
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 bg-white border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-700">حوكمة جودة أعمال الإنشاءات</span>
            <span>•</span>
            <span>نظام التدقيق الرقمي الميداني 155</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold transition-colors cursor-pointer"
          >
            إغلاق
          </button>
        </div>

        {/* AI Recommendations Dialog Overlay */}
        {showAiModal && (
          <div className="absolute inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden text-right animate-in zoom-in-95">
              
              {/* Header */}
              <div className="px-5 py-4 bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-950 text-white flex items-center justify-between border-b border-purple-800 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 animate-pulse" />
                  </div>
                  <div>
                    <h4 className="font-black text-sm text-white">التقرير الاستشاري والتدقيق المتقدم</h4>
                    <p className="text-[11px] text-purple-200">تحليل فني استراتيجي لتأهيل الأوامر لإجراء 155</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAiModal(false)}
                  className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 overflow-y-auto flex-1 font-['Cairo',sans-serif] leading-relaxed text-slate-800 text-xs sm:text-sm">
                {isAiLoading ? (
                  <div className="py-16 flex flex-col items-center justify-center gap-3 text-purple-700">
                    <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
                    <span className="font-bold text-xs text-slate-600">جاري صياغة التوصيات الذكية وفحص النواقص الحرجة...</span>
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap font-sans bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                    {aiReport}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-5 py-3 bg-slate-100 border-t border-slate-200 flex items-center justify-between shrink-0">
                <button
                  type="button"
                  onClick={handleCopyAiReport}
                  disabled={isAiLoading || !aiReport}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-bold transition-all shadow-2xs disabled:opacity-50 cursor-pointer"
                >
                  {copiedAiReport ? <CheckCheck className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                  <span>{copiedAiReport ? 'تم النسخ بنجاح' : 'نسخ التقرير'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowAiModal(false)}
                  className="px-4 py-1.5 rounded-lg bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs transition-colors cursor-pointer"
                >
                  حسناً، تم الاطلاع
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
};
