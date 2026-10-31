import React from 'react';
import { 
  Table2, 
  BarChart3, 
  CalendarDays, 
  Building2, 
  ShieldCheck, 
  Search, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  SlidersHorizontal, 
  Keyboard, 
  ChevronDown, 
  ChevronUp,
  LayoutGrid,
  Filter,
  Eye,
  Command,
  CalendarPlus,
  Briefcase
} from 'lucide-react';
import { SubOffice, WorkOrder, PlatformUser } from '../types';
import { getArabicMonthName } from '../utils/tableScope';
import { hasUserPermission } from '../utils/security';

export type MainViewTab = 'table' | 'kpis' | 'archive' | 'offices' | 'guide';

interface ExecutiveHubBarProps {
  activeTab: MainViewTab;
  onTabChange: (tab: MainViewTab) => void;
  totalOrdersCount: number;
  ready155Count: number;
  selectedOffice: string;
  onSelectOffice: (office: string) => void;
  offices: SubOffice[];
  kpiFilter: string;
  onSelectKpiFilter: (filter: any) => void;
  isInlineKpiOpen: boolean;
  onToggleInlineKpi: () => void;
  onOpenCommandPalette: () => void;
  onOpenShortcutsModal: () => void;
  onOpenAddOrder: () => void;
  onOpenImportExcel: () => void;
  onOpenExport: () => void;
  onOpenSmartAudit?: () => void;
  onOpenContractorComparison?: () => void;
  activeYear?: number;
  activeMonth?: number | 'all';
  activeTableName?: string;
  onOpenYearMonthPicker?: () => void;
  currentUser?: PlatformUser | null;
}

export const ExecutiveHubBar: React.FC<ExecutiveHubBarProps> = ({
  activeTab,
  onTabChange,
  totalOrdersCount,
  ready155Count,
  selectedOffice,
  onSelectOffice,
  offices,
  kpiFilter,
  onSelectKpiFilter,
  isInlineKpiOpen,
  onToggleInlineKpi,
  onOpenCommandPalette,
  onOpenShortcutsModal,
  onOpenAddOrder,
  onOpenImportExcel,
  onOpenExport,
  onOpenSmartAudit,
  onOpenContractorComparison,
  activeYear = new Date().getFullYear(),
  activeMonth = 'all',
  activeTableName,
  onOpenYearMonthPicker,
  currentUser
}) => {
  const notReadyCount = Math.max(0, totalOrdersCount - ready155Count);
  const completionRate = totalOrdersCount > 0 
    ? Math.round((ready155Count / totalOrdersCount) * 100) 
    : 0;

  const allTabs = [
    {
      id: 'table' as MainViewTab,
      label: 'جدول أوامر العمل الميداني',
      badge: `${totalOrdersCount}`,
      icon: <Table2 className="w-4 h-4" />,
      allowed: true
    },
    {
      id: 'kpis' as MainViewTab,
      label: 'لوحة مؤشرات الأداء (KPIs)',
      badge: `${completionRate}%`,
      icon: <BarChart3 className="w-4 h-4" />,
      allowed: hasUserPermission(currentUser, 'viewKpiDashboard')
    },
    {
      id: 'archive' as MainViewTab,
      label: 'الأرشيف والتقارير الشهرية',
      icon: <CalendarDays className="w-4 h-4" />,
      allowed: hasUserPermission(currentUser, 'viewArchive')
    },
    {
      id: 'offices' as MainViewTab,
      label: 'المكاتب والمقاولين المعتمدين',
      badge: `${offices.length}`,
      icon: <Building2 className="w-4 h-4" />,
      allowed: hasUserPermission(currentUser, 'manageOffices') || hasUserPermission(currentUser, 'manageContractors') || hasUserPermission(currentUser, 'viewOfficeComparison')
    },
    {
      id: 'guide' as MainViewTab,
      label: 'دليل وضوابط إجراء 155',
      icon: <ShieldCheck className="w-4 h-4" />,
      allowed: true
    }
  ];

  const tabs = allTabs.filter(t => t.allowed);

  return (
    <div className="w-full space-y-2.5 mb-4 select-none font-['Cairo',sans-serif]">
      {/* 1. Main Navigation Segmented Control */}
      <div className="bg-white rounded-2xl p-1.5 shadow-xs border border-slate-200/90 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2 overflow-x-auto">
        
        {/* Tabs Group */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-0.5">
          {tabs.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-sm ring-1 ring-slate-900'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                }`}
              >
                <span className={isActive ? 'text-emerald-400' : 'text-slate-500'}>
                  {tab.icon}
                </span>
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-100 text-slate-600 border border-slate-200'
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Global Productivity Tools on the Left (RTL left = screen left) */}
        <div className="flex items-center gap-1.5 shrink-0 self-end md:self-auto border-t md:border-t-0 pt-1.5 md:pt-0 border-slate-100 flex-wrap">
          
          {/* NEW: Prominent Icon Button to Select Year & Month for Inserting & Viewing Tables */}
          {onOpenYearMonthPicker && (hasUserPermission(currentUser, 'manageMonthTables') || hasUserPermission(currentUser, 'viewArchive')) && (
            <button
              type="button"
              onClick={onOpenYearMonthPicker}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-700 hover:from-indigo-500 hover:to-blue-600 text-white border border-indigo-400/50 transition-all cursor-pointer shadow-xs group ring-1 ring-indigo-400/30"
              title="أيقونة تحديد السنة والشهر لإدراج وعرض الجداول المستقلة بدون أي لبس أو تداخل"
            >
              <CalendarPlus className="w-3.5 h-3.5 text-amber-300 group-hover:scale-110 transition-transform" />
              <span>تحديد السنة والشهر</span>
              <span className="px-1.5 py-0.2 bg-white/20 text-white rounded font-mono text-[10px] font-black">
                {activeMonth === 'all' ? `${activeYear}/الكل` : `${getArabicMonthName(activeMonth)} ${activeYear}`}
              </span>
            </button>
          )}

          {/* Contractor Closure Comparison & Periodic Reports Button */}
          {onOpenContractorComparison && hasUserPermission(currentUser, 'viewContractorClosureReport') && (
            <button
              type="button"
              onClick={onOpenContractorComparison}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 border border-amber-400/50 transition-all cursor-pointer shadow-2xs group"
              title="مقارنة المقاولين في المكاتب بنسبة إنجاز الإغلاقات وتصدير تقرير أسبوعي أو شهري أو ربع سنوي أو نصف سنوي أو سنوي"
            >
              <Briefcase className="w-3.5 h-3.5 text-slate-950 group-hover:scale-110 transition-transform" />
              <span>تقارير إغلاقات المقاولين</span>
            </button>
          )}

          {/* Smart Audit Inspector Button */}
          {onOpenSmartAudit && hasUserPermission(currentUser, 'smartAudit') && (
            <button
              type="button"
              onClick={onOpenSmartAudit}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white border border-emerald-400/40 transition-all cursor-pointer shadow-2xs group"
              title="فحص الجودة الذكي الشامل ومطابقة إجراء 155"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300 group-hover:rotate-12 transition-transform" />
              <span>فحص الامتثال</span>
              <span className="hidden sm:inline-block px-1.5 py-0.2 bg-white/20 text-white rounded font-mono text-[9px] font-bold">
                155
              </span>
            </button>
          )}

          {/* Quick Command Palette Button (Ctrl + K) */}
          {onOpenCommandPalette && hasUserPermission(currentUser, 'searchAndFilter') && (
            <button
              type="button"
              onClick={onOpenCommandPalette}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 transition-all cursor-pointer shadow-2xs group"
              title="فتح لوحة الأوامر السريعة والبحث الذكي (Ctrl + K)"
            >
              <Command className="w-3.5 h-3.5 text-emerald-600 group-hover:rotate-12 transition-transform" />
              <span className="hidden sm:inline">لوحة الأوامر</span>
              <kbd className="hidden lg:inline-block px-1.5 py-0.2 bg-white text-emerald-900 rounded font-mono text-[9px] border border-emerald-300 font-bold">
                Ctrl+K
              </kbd>
            </button>
          )}

          {/* Keyboard Shortcuts Cheatsheet */}
          <button
            type="button"
            onClick={onOpenShortcutsModal}
            className="p-1.5 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer border border-transparent hover:border-slate-200"
            title="دليل اختصارات لوحة المفاتيح (؟)"
          >
            <Keyboard className="w-4 h-4" />
          </button>

        </div>
      </div>

      {/* 2. Compact Executive Stats Ribbon (Visible on Table Tab to prevent clutter!) */}
      {activeTab === 'table' && (
        <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-emerald-950 text-white rounded-2xl p-2.5 sm:px-4 sm:py-2.5 shadow-sm border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          
          {/* Metrics summary pills */}
          <div className="flex items-center gap-3 sm:gap-5 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-medium">إجمالي الأوامر:</span>
              <span className="font-mono font-black text-white text-sm bg-white/10 px-2 py-0.5 rounded-lg border border-white/10">
                {totalOrdersCount}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span className="text-emerald-300 font-medium">مؤهل للإغلاق:</span>
              <span className="font-mono font-black text-emerald-400">
                {ready155Count} ({completionRate}%)
              </span>
            </div>

            {notReadyCount > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                <span className="text-amber-300 font-medium">غير مؤهل:</span>
                <span className="font-mono font-black text-amber-400">
                  {notReadyCount}
                </span>
              </div>
            )}

            {/* Selected Office Badge */}
            <div className="flex items-center gap-1 text-[11px] text-slate-300 bg-white/10 px-2 py-0.5 rounded-lg border border-white/10">
              <Building2 className="w-3 h-3 text-emerald-400" />
              <span>{selectedOffice === 'all' ? 'جميع المكاتب الفرعية' : selectedOffice}</span>
            </div>

            {/* Active Year & Month & Table Badge */}
            {onOpenYearMonthPicker && (
              <button
                type="button"
                onClick={onOpenYearMonthPicker}
                className="flex items-center gap-1.5 text-[11px] text-indigo-200 hover:text-white bg-indigo-500/20 hover:bg-indigo-500/35 px-2.5 py-0.5 rounded-lg border border-indigo-400/40 cursor-pointer transition-colors"
                title="انقر لتغيير السنة والشهر أو إدراج جدول جديد"
              >
                <CalendarPlus className="w-3 h-3 text-amber-300" />
                <span>
                  {activeMonth === 'all' ? `عام ${activeYear}` : `شهر ${getArabicMonthName(activeMonth)} ${activeYear}`}
                </span>
                {activeTableName && (
                  <>
                    <span className="opacity-50">•</span>
                    <span className="font-black text-amber-300">{activeTableName}</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Quick Filter Buttons & Expand KPI Option */}
          <div className="flex items-center gap-2 mr-auto">
            {/* Filter Toggle */}
            {hasUserPermission(currentUser, 'searchAndFilter') && (
              <div className="flex items-center bg-black/30 rounded-xl p-0.5 border border-white/10">
                <button
                  type="button"
                  onClick={() => onSelectKpiFilter('all')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                    kpiFilter === 'all'
                      ? 'bg-white text-slate-950 shadow-xs'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  الكل ({totalOrdersCount})
                </button>
                <button
                  type="button"
                  onClick={() => onSelectKpiFilter('ready')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    kpiFilter === 'ready'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-emerald-300 hover:text-white'
                  }`}
                >
                  <CheckCircle2 className="w-3 h-3" />
                  <span>مؤهل ({ready155Count})</span>
                </button>
                <button
                  type="button"
                  onClick={() => onSelectKpiFilter('not_ready')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    kpiFilter === 'not_ready'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'text-rose-300 hover:text-white'
                  }`}
                >
                  <AlertTriangle className="w-3 h-3" />
                  <span>نواقص ({notReadyCount})</span>
                </button>
              </div>
            )}

            {/* Toggle Full Inline KPI View (Optional expansion without page navigation) */}
            {hasUserPermission(currentUser, 'viewKpiDashboard') && (
              <button
                type="button"
                onClick={onToggleInlineKpi}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                  isInlineKpiOpen
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40 shadow-xs'
                    : 'bg-white/10 text-slate-300 border-white/10 hover:bg-white/15'
                }`}
                title="إظهار أو طي لوحة المؤشرات والرسوم البيانية أعلى الجدول"
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">
                  {isInlineKpiOpen ? 'طي لوحة المؤشرات' : 'لوحة المؤشرات المفصلة'}
                </span>
                {isInlineKpiOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
