import React from 'react';
import { X, Keyboard, Zap, Search, PlusCircle, FileSpreadsheet, FileDown, Bell, RotateCcw } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcuts = [
    { key: 'Ctrl + K / ⌘ + K', desc: 'فتح لوحة الأوامر السريعة والبحث الذكي الفوري', icon: <Search className="w-4 h-4 text-emerald-500" /> },
    { key: 'Alt + N', desc: 'إضافة أمر عمل جديد فورياً', icon: <PlusCircle className="w-4 h-4 text-blue-500" /> },
    { key: 'Alt + I', desc: 'استيراد أوامر العمل من ملف إكسل', icon: <FileSpreadsheet className="w-4 h-4 text-teal-500" /> },
    { key: 'Alt + E', desc: 'تصدير البيانات المعتمدة (Excel / PDF)', icon: <FileDown className="w-4 h-4 text-purple-500" /> },
    { key: 'Alt + S', desc: 'كتم أو تشغيل التنبيهات الصوتية الحية', icon: <Zap className="w-4 h-4 text-amber-500" /> },
    { key: 'Alt + B', desc: 'فتح مركز الإشعارات الفورية (الخلفية)', icon: <Bell className="w-4 h-4 text-orange-500" /> },
    { key: 'Alt + R', desc: 'المزامنة السحابية المباشرة مع الخادم', icon: <RotateCcw className="w-4 h-4 text-cyan-500" /> },
    { key: '؟ أو /', desc: 'عرض دليل اختصارات لوحة المفاتيح', icon: <Keyboard className="w-4 h-4 text-slate-500" /> },
    { key: 'Escape', desc: 'إغلاق أي نافذة منبثقة أو إلغاء التصفية', icon: <X className="w-4 h-4 text-rose-500" /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150 font-['Cairo',sans-serif]">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden text-right">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-sm text-slate-900">اختصارات لوحة المفاتيح الذكية</h3>
              <p className="text-[11px] text-slate-500">لإنجاز العمل والتدقيق بأقصى سرعة واحترافية</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content list */}
        <div className="p-4 space-y-2 max-h-[65vh] overflow-y-auto">
          {shortcuts.map((s, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/60 hover:border-slate-300 transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1.5 rounded-lg bg-white shadow-2xs shrink-0">
                  {s.icon}
                </div>
                <span className="text-xs font-bold text-slate-800 truncate">{s.desc}</span>
              </div>
              <kbd className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-slate-700 font-mono text-[11px] font-bold shadow-2xs shrink-0">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>يمكنك الضغط على <strong>؟</strong> في أي وقت لعرض هذه القائمة</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 transition-colors"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
