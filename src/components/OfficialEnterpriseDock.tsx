import React, { useState, useMemo } from 'react';
import {
  Table2,
  BarChart3,
  FolderTree,
  Building2,
  ShieldCheck,
  FileSpreadsheet,
  Award,
  Layers,
  FileText,
  SlidersHorizontal,
  Database,
  Plus,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Calendar,
  TableProperties,
  Users,
  HardHat
} from 'lucide-react';
import { WorkOrder, SubOffice, MonthTable, PlatformUser } from '../types';
import { getArabicMonthName, resolveOrderYearMonth, doesOrderMatchTableView, getDefaultTableId } from '../utils/tableScope';
import { MainViewTab } from './ExecutiveHubBar';

interface OfficialEnterpriseDockProps {
  activeViewTab: MainViewTab;
  onSelectViewTab: (tab: MainViewTab) => void;
  workOrders: WorkOrder[];
  offices: SubOffice[];
  selectedOffice: string;
  onSelectOffice: (office: string) => void;
  activeYear: number;
  activeMonth: number | 'all';
  selectedTableId: string;
  monthTables: MonthTable[];
  onSelectPeriod: (year: number, month: number | 'all', tableId?: string) => void;
  onOpenYearMonthPicker: () => void;
  onOpenAddOrder: () => void;
  onOpenImportExcel: () => void;
  onOpenComprehensiveReports: () => void;
  onOpenWeeklyReport: () => void;
  onOpenOfficeComparison: () => void;
  onOpenContractorComparison: () => void;
  onOpenNotesReport: () => void;
  onOpenColumnManager: () => void;
  onOpenDropdownManager: () => void;
  onOpenDataRecovery: () => void;
  onOpenPermissionsManager: () => void;
  onOpenManageOffices: () => void;
  onOpenManageContractors: () => void;
  currentUser?: PlatformUser | null;
}

type ExplorerTab = 'modules' | 'offices' | 'tables';

export const OfficialEnterpriseDock: React.FC<OfficialEnterpriseDockProps> = ({
  activeViewTab,
  onSelectViewTab,
  workOrders,
  offices,
  selectedOffice,
  onSelectOffice,
  activeYear,
  activeMonth,
  selectedTableId,
  monthTables,
  onSelectPeriod,
  onOpenYearMonthPicker,
  onOpenAddOrder,
  onOpenImportExcel,
  onOpenComprehensiveReports,
  onOpenWeeklyReport,
  onOpenOfficeComparison,
  onOpenContractorComparison,
  onOpenNotesReport,
  onOpenColumnManager,
  onOpenDropdownManager,
  onOpenDataRecovery,
  onOpenPermissionsManager,
  onOpenManageOffices,
  onOpenManageContractors
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [explorerTab, setExplorerTab] = useState<ExplorerTab>('modules');

  // Compute live office statistics
  const officeStats = useMemo(() => {
    const map = new Map<string, { total: number; ready: number }>();
    offices.forEach(o => map.set(o.name, { total: 0, ready: 0 }));
    let allTotal = 0;
    let allReady = 0;

    workOrders.forEach(w => {
      allTotal++;
      const isReady = String(w?.procedure155Status || '').includes('مؤهل') || String(w?.procedure155Status || '').includes('تم');
      if (isReady) allReady++;
      const offName = (w.office || '').trim();
      if (offName) {
        const prev = map.get(offName) || { total: 0, ready: 0 };
        prev.total++;
        if (isReady) prev.ready++;
        map.set(offName, prev);
      }
    });

    return { map, allTotal, allReady };
  }, [workOrders, offices]);

  // Available years
  const availableYears = useMemo(() => {
    const yearsSet = new Set<number>([2025, 2026]);
    workOrders.forEach(w => {
      const ym = resolveOrderYearMonth(w);
      if (ym.year) yearsSet.add(ym.year);
    });
    monthTables.forEach(t => {
      if (t.year) yearsSet.add(t.year);
    });
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [workOrders, monthTables]);

  // Tables for active year & month
  const currentScopeTables = useMemo(() => {
    return monthTables.filter(
      t => t.year === activeYear && (activeMonth === 'all' || t.month === activeMonth)
    );
  }, [monthTables, activeYear, activeMonth]);

  if (!isOpen) {
    return (
      <div className="hidden lg:flex fixed right-0 top-24 z-30 select-none">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="group flex items-center gap-1.5 pl-2.5 pr-1.5 py-2.5 rounded-l-xl bg-[#0F2942]/95 hover:bg-[#1E3A5F] text-white shadow-lg border border-r-0 border-[#1E3A5F] transition-all cursor-pointer active:scale-95"
          title="إظهار الشريط الجانبي الرأسي (مستكشف القوائم والوحدات)"
        >
          <Layers className="w-4 h-4 text-[#EAB308] shrink-0" />
          <ChevronLeft className="w-3.5 h-3.5 text-slate-300 group-hover:text-white transition-transform group-hover:-translate-x-0.5" />
        </button>
      </div>
    );
  }

  return (
    <>
      <div
        className="hidden lg:block fixed inset-0 bg-slate-950/20 backdrop-blur-[1px] z-30"
        onClick={() => setIsOpen(false)}
      />
      <aside className="hidden lg:flex fixed right-0 top-14 bottom-0 flex-col w-68 bg-[#F8FAFC] border-l border-[#CBD5E1] shadow-2xl shrink-0 select-none z-40 text-right animate-in slide-in-from-right duration-150">
        {/* Top Dock Title Bar */}
        <div className="px-3.5 py-2.5 bg-[#0F2942] text-white flex items-center justify-between border-b border-[#1E3A5F]">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#EAB308]" />
            <span className="text-xs font-black tracking-wide">مستكشف النظام والملفات</span>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
            title="إخفاء الشريط الجانبي الرأسي"
          >
            <span>إخفاء</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

      {/* 3-Tab Switcher inside Dock */}
      <div className="grid grid-cols-3 bg-[#E2E8F0] p-1 gap-1 border-b border-[#CBD5E1]">
        <button
          type="button"
          onClick={() => setExplorerTab('modules')}
          className={`py-1.5 px-2 rounded text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
            explorerTab === 'modules'
              ? 'bg-white text-[#0F2942] shadow-2xs font-black border border-slate-300/80'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Layers className="w-3 h-3" />
          <span>الوحدات</span>
        </button>

        <button
          type="button"
          onClick={() => setExplorerTab('offices')}
          className={`py-1.5 px-2 rounded text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
            explorerTab === 'offices'
              ? 'bg-white text-[#0F2942] shadow-2xs font-black border border-slate-300/80'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Building2 className="w-3 h-3" />
          <span>المكاتب</span>
        </button>

        <button
          type="button"
          onClick={() => setExplorerTab('tables')}
          className={`py-1.5 px-2 rounded text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
            explorerTab === 'tables'
              ? 'bg-white text-[#0F2942] shadow-2xs font-black border border-slate-300/80'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FolderTree className="w-3 h-3" />
          <span>الجداول</span>
        </button>
      </div>

      {/* Dock Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-4">
        {/* TAB 1: SYSTEM MODULES & OFFICIAL REPORTS */}
        {explorerTab === 'modules' && (
          <>
            {/* Section A: Primary Workspace Views */}
            <div>
              <div className="px-2 pb-1.5 text-[10px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-200 mb-1.5">
                شاشات العمل الرئيسية
              </div>
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => onSelectViewTab('table')}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-md text-xs font-bold transition-all cursor-pointer border ${
                    activeViewTab === 'table'
                      ? 'bg-[#0F2942] text-white border-[#0F2942] shadow-2xs'
                      : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-200/90'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Table2 className={`w-3.5 h-3.5 ${activeViewTab === 'table' ? 'text-[#EAB308]' : 'text-[#0F2942]'}`} />
                    <span>سجل أوامر العمل الميداني</span>
                  </span>
                  <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded ${
                    activeViewTab === 'table' ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-700'
                  }`}>
                    {workOrders.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => onSelectViewTab('kpis')}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-md text-xs font-bold transition-all cursor-pointer border ${
                    activeViewTab === 'kpis'
                      ? 'bg-[#0F2942] text-white border-[#0F2942] shadow-2xs'
                      : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-200/90'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <BarChart3 className={`w-3.5 h-3.5 ${activeViewTab === 'kpis' ? 'text-[#EAB308]' : 'text-emerald-700'}`} />
                    <span>لوحة القياس والمؤشرات</span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => onSelectViewTab('archive')}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-md text-xs font-bold transition-all cursor-pointer border ${
                    activeViewTab === 'archive'
                      ? 'bg-[#0F2942] text-white border-[#0F2942] shadow-2xs'
                      : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-200/90'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Calendar className={`w-3.5 h-3.5 ${activeViewTab === 'archive' ? 'text-[#EAB308]' : 'text-blue-700'}`} />
                    <span>الأرشيف السنوي والشهري</span>
                  </span>
                  <span className="font-mono text-[10px] opacity-80">{activeYear}</span>
                </button>

                <button
                  type="button"
                  onClick={() => onSelectViewTab('offices')}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-md text-xs font-bold transition-all cursor-pointer border ${
                    activeViewTab === 'offices'
                      ? 'bg-[#0F2942] text-white border-[#0F2942] shadow-2xs'
                      : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-200/90'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Building2 className={`w-3.5 h-3.5 ${activeViewTab === 'offices' ? 'text-[#EAB308]' : 'text-amber-700'}`} />
                    <span>دليل المكاتب والمقاولين</span>
                  </span>
                  <span className="font-mono text-[10px] opacity-80">{offices.length}</span>
                </button>

                <button
                  type="button"
                  onClick={() => onSelectViewTab('guide')}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-md text-xs font-bold transition-all cursor-pointer border ${
                    activeViewTab === 'guide'
                      ? 'bg-[#0F2942] text-white border-[#0F2942] shadow-2xs'
                      : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-200/90'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <ShieldCheck className={`w-3.5 h-3.5 ${activeViewTab === 'guide' ? 'text-[#EAB308]' : 'text-slate-700'}`} />
                    <span>لائحة وضوابط إجراء 155</span>
                  </span>
                </button>
              </div>
            </div>

            {/* Section B: Official Executive Reports */}
            <div>
              <div className="px-2 pb-1.5 text-[10px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-200 mb-1.5">
                التقارير الرسمية المعتمدة
              </div>
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={onOpenComprehensiveReports}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md bg-white hover:bg-slate-100 text-slate-800 border border-slate-200/90 text-xs font-bold transition-all cursor-pointer"
                >
                  <BarChart3 className="w-3.5 h-3.5 text-[#0F2942] shrink-0" />
                  <span>مركز التقارير الموحد الشامل</span>
                </button>

                <button
                  type="button"
                  onClick={onOpenWeeklyReport}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md bg-white hover:bg-slate-100 text-slate-800 border border-slate-200/90 text-xs font-bold transition-all cursor-pointer"
                >
                  <Award className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                  <span>التقرير الأسبوعي للمكاتب</span>
                </button>

                <button
                  type="button"
                  onClick={onOpenContractorComparison}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md bg-white hover:bg-slate-100 text-slate-800 border border-slate-200/90 text-xs font-bold transition-all cursor-pointer"
                >
                  <HardHat className="w-3.5 h-3.5 text-indigo-700 shrink-0" />
                  <span>مقارنة إغلاقات المقاولين</span>
                </button>

                <button
                  type="button"
                  onClick={onOpenOfficeComparison}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md bg-white hover:bg-slate-100 text-slate-800 border border-slate-200/90 text-xs font-bold transition-all cursor-pointer"
                >
                  <Building2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                  <span>تقييم ومقارنة المكاتب</span>
                </button>

                <button
                  type="button"
                  onClick={onOpenNotesReport}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md bg-white hover:bg-slate-100 text-slate-800 border border-slate-200/90 text-xs font-bold transition-all cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 text-rose-700 shrink-0" />
                  <span>سجل الملاحظات الفنية والصور</span>
                </button>
              </div>
            </div>

            {/* Section C: System Configuration & Governance */}
            <div>
              <div className="px-2 pb-1.5 text-[10px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-200 mb-1.5">
                إعدادات النظام والحوكمة
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={onOpenColumnManager}
                  className="p-2 rounded-md bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 text-[11px] font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                  <span className="truncate">هيكلة الأعمدة</span>
                </button>

                <button
                  type="button"
                  onClick={onOpenDropdownManager}
                  className="p-2 rounded-md bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 text-[11px] font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <TableProperties className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                  <span className="truncate">القوائم المنسدلة</span>
                </button>

                <button
                  type="button"
                  onClick={onOpenManageOffices}
                  className="p-2 rounded-md bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 text-[11px] font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Building2 className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                  <span className="truncate">إدارة المكاتب</span>
                </button>

                <button
                  type="button"
                  onClick={onOpenManageContractors}
                  className="p-2 rounded-md bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 text-[11px] font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <HardHat className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                  <span className="truncate">توزيع المقاولين</span>
                </button>

                <button
                  type="button"
                  onClick={onOpenDataRecovery}
                  className="p-2 rounded-md bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 text-[11px] font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Database className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                  <span className="truncate">النسخ الاحتياطي</span>
                </button>

                <button
                  type="button"
                  onClick={onOpenPermissionsManager}
                  className="p-2 rounded-md bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 text-[11px] font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Users className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                  <span className="truncate">الصلاحيات</span>
                </button>
              </div>
            </div>
          </>
        )}

        {/* TAB 2: SUB-OFFICES DIRECTORY TREE */}
        {explorerTab === 'offices' && (
          <div className="space-y-1.5">
            <div className="px-2 pb-1.5 text-[10px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-200 flex items-center justify-between">
              <span>تصفية حسب المكتب الفرعي</span>
              <span className="font-mono">{offices.length} مكتب</span>
            </div>

            <button
              type="button"
              onClick={() => {
                onSelectOffice('all');
                onSelectViewTab('table');
              }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-md text-xs font-bold transition-all cursor-pointer border ${
                selectedOffice === 'all'
                  ? 'bg-[#0F2942] text-white border-[#0F2942] shadow-2xs'
                  : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-200'
              }`}
            >
              <span className="flex items-center gap-2">
                <Building2 className={`w-4 h-4 ${selectedOffice === 'all' ? 'text-[#EAB308]' : 'text-[#0F2942]'}`} />
                <span>كافة المكاتب الفرعية</span>
              </span>
              <span className={`font-mono text-[11px] px-1.5 py-0.5 rounded ${
                selectedOffice === 'all' ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-700'
              }`}>
                {officeStats.allTotal}
              </span>
            </button>

            {offices.map(off => {
              const st = officeStats.map.get(off.name) || { total: 0, ready: 0 };
              const rate = st.total > 0 ? Math.round((st.ready / st.total) * 100) : 0;
              const isSelected = selectedOffice === off.name;

              return (
                <button
                  key={off.id}
                  type="button"
                  onClick={() => {
                    onSelectOffice(off.name);
                    onSelectViewTab('table');
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-bold transition-all cursor-pointer border ${
                    isSelected
                      ? 'bg-[#0F2942] text-white border-[#0F2942] shadow-2xs'
                      : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-200/90'
                  }`}
                >
                  <span className="truncate">{off.name}</span>
                  <div className="flex items-center gap-1.5 shrink-0 font-mono text-[10px]">
                    <span className={isSelected ? 'text-emerald-300' : 'text-emerald-700'}>
                      {rate}%
                    </span>
                    <span className={`px-1.5 py-0.5 rounded ${
                      isSelected ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {st.total}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* TAB 3: YEARS, MONTHS & TABLES TREE */}
        {explorerTab === 'tables' && (
          <div className="space-y-3">
            {/* Year Selector */}
            <div>
              <div className="px-1 pb-1.5 text-[10px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-200 mb-1.5">
                السنة المالية
              </div>
              <div className="grid grid-cols-3 gap-1">
                {availableYears.map(yr => (
                  <button
                    key={yr}
                    type="button"
                    onClick={() => onSelectPeriod(yr, activeMonth)}
                    className={`py-1.5 rounded text-xs font-mono font-black border cursor-pointer transition-all ${
                      activeYear === yr
                        ? 'bg-[#0F2942] text-white border-[#0F2942]'
                        : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-200'
                    }`}
                  >
                    {yr}
                  </button>
                ))}
              </div>
            </div>

            {/* Month Selector */}
            <div>
              <div className="px-1 pb-1.5 text-[10px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-200 mb-1.5">
                الشهر
              </div>
              <div className="grid grid-cols-3 gap-1">
                <button
                  type="button"
                  onClick={() => onSelectPeriod(activeYear, 'all')}
                  className={`col-span-3 py-1.5 rounded text-xs font-bold border cursor-pointer transition-all ${
                    activeMonth === 'all'
                      ? 'bg-[#0F2942] text-white border-[#0F2942]'
                      : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-200'
                  }`}
                >
                  كافة شهور {activeYear}
                </button>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => onSelectPeriod(activeYear, m)}
                    className={`py-1 rounded text-[11px] font-bold border cursor-pointer transition-all truncate px-1 ${
                      activeMonth === m
                        ? 'bg-[#0F2942] text-white border-[#0F2942]'
                        : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    {getArabicMonthName(m)}
                  </button>
                ))}
              </div>
            </div>

            {/* Active Period Tables */}
            <div>
              <div className="px-1 pb-1.5 text-[10px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-200 mb-1.5 flex items-center justify-between">
                <span>جداول الفترة المحددة</span>
                <button
                  type="button"
                  onClick={onOpenYearMonthPicker}
                  className="text-[#0F2942] hover:underline font-bold cursor-pointer"
                >
                  + جدول جديد
                </button>
              </div>
              <div className="space-y-1">
                {(() => {
                  const effMonth = activeMonth === 'all' ? new Date().getMonth() + 1 : activeMonth;
                  const defId = getDefaultTableId(activeYear, effMonth);
                  const isDefSelected = selectedTableId === defId;
                  const defCount = workOrders.filter(o =>
                    doesOrderMatchTableView(o, activeYear, activeMonth, defId, currentScopeTables)
                  ).length;

                  return (
                    <button
                      type="button"
                      onClick={() => {
                        onSelectPeriod(activeYear, activeMonth, defId);
                        onSelectViewTab('table');
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-md text-xs font-bold border cursor-pointer transition-all ${
                        isDefSelected
                          ? 'bg-[#0F2942] text-white border-[#0F2942]'
                          : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-200'
                      }`}
                    >
                      <span className="truncate">الجدول الرئيسي المعتمد</span>
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-black/10">
                        {defCount}
                      </span>
                    </button>
                  );
                })()}

                {currentScopeTables.map(tbl => {
                  const isSel = selectedTableId === tbl.id;
                  const cnt = workOrders.filter(o =>
                    doesOrderMatchTableView(o, activeYear, activeMonth, tbl.id, currentScopeTables)
                  ).length;
                  return (
                    <button
                      key={tbl.id}
                      type="button"
                      onClick={() => {
                        onSelectPeriod(tbl.year, tbl.month, tbl.id);
                        onSelectViewTab('table');
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-md text-xs font-bold border cursor-pointer transition-all ${
                        isSel
                          ? 'bg-[#0F2942] text-white border-[#0F2942]'
                          : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-200'
                      }`}
                    >
                      <span className="truncate">{tbl.name}</span>
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-black/10">
                        {cnt}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Dock Quick Actions Footer */}
      <div className="p-2.5 bg-[#F1F5F9] border-t border-[#CBD5E1] space-y-1.5">
        <button
          type="button"
          onClick={onOpenAddOrder}
          className="w-full py-2 px-3 rounded-md bg-[#0F2942] hover:bg-[#1E3A5F] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
        >
          <Plus className="w-3.5 h-3.5 text-[#EAB308]" />
          <span>قيد أمر عمل جديد</span>
        </button>
        <button
          type="button"
          onClick={onOpenImportExcel}
          className="w-full py-1.5 px-3 rounded-md bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
          <span>استيراد سجل Excel</span>
        </button>
      </div>
      </aside>
    </>
  );
};
