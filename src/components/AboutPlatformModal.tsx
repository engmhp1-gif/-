import React, { useState } from 'react';
import {
  Award,
  User,
  Briefcase,
  Building2,
  Mail,
  Phone,
  PhoneCall,
  Copy,
  Check,
  X,
  ShieldCheck,
  ExternalLink,
  Sparkles,
  Zap
} from 'lucide-react';

interface AboutPlatformModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutPlatformModal: React.FC<AboutPlatformModalProps> = ({ isOpen, onClose }) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (text: string, key: string) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const engineerInfo = {
    name: 'المهندس / محمود الشحات',
    role: 'مهندس الجودة والمساندة الفنية',
    department: 'ادارة كهرباء الحدود الشمالية',
    organization: 'حوكمة جودة أعمال الإنشاءات - المساندة الفنية',
    email: '2502331172@se.com.sa',
    username: '2502331172',
    mobile: '+966598760284',
    extension: '47096',
    systemTitle: 'منظومة حوكمة جودة اعمال الانشاءات • إجراء 155'
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 text-right animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-xl w-full overflow-hidden flex flex-col transform transition-all"
        dir="rtl"
      >
        {/* Header with Emerald Gradient */}
        <div className="relative bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 text-white p-6 overflow-hidden border-b border-emerald-800/40">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

          <div className="relative flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white flex items-center justify-center shadow-lg shadow-emerald-900/40 border border-emerald-400/40 shrink-0">
                <Award className="w-6 h-6 text-amber-300" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-black tracking-wider uppercase bg-amber-400/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-400/30">
                    بطاقة التوثيق والاعتماد
                  </span>
                  <span className="text-[11px] font-bold text-emerald-300/80">
                    Quality Hub 155
                  </span>
                </div>
                <h2 className="text-lg sm:text-xl font-black text-white mt-1">
                  حول المنصة وفريق الإعداد
                </h2>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
              title="إغلاق النافذة"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <p className="relative text-xs text-emerald-200/90 font-medium mt-3 leading-relaxed">
            منظومة رقمية ذكية متقدمة لتدقيق وضبط جودة أعمال الإنشاءات واستلام أوامر العمل قبل إجراء 155
          </p>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          
          {/* Main Engineer Hero Card */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/50 p-5 border-2 border-emerald-500/30 shadow-sm">
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/30 shrink-0 border border-emerald-400">
                <User className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-black bg-emerald-700 text-white px-2 py-0.5 rounded-md shadow-2xs">
                    فكرة وإعداد وتصميم
                  </span>
                  <span className="text-[10px] font-bold text-slate-500">
                    رؤية هندسية مبتكرة
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 mt-1">
                  {engineerInfo.name}
                </h3>
                <p className="text-xs font-bold text-emerald-800 mt-0.5 flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>{engineerInfo.role}</span>
                </p>
                <p className="text-xs font-semibold text-slate-600 mt-0.5 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span>{engineerInfo.department}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Interactive Info Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            
            {/* Card 1: Email */}
            <div className="rounded-2xl p-3.5 bg-slate-50 hover:bg-blue-50/60 border border-slate-200 hover:border-blue-300 transition-all group">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2 text-xs font-black text-slate-800">
                  <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                    <Mail className="w-3.5 h-3.5" />
                  </div>
                  <span>البريد الإلكتروني الرسمي</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(engineerInfo.email, 'email')}
                  className="p-1 rounded-md text-slate-400 hover:text-blue-700 hover:bg-blue-100/60 transition-colors cursor-pointer"
                  title="نسخ البريد الإلكتروني"
                >
                  {copiedKey === 'email' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <a
                href={`mailto:${engineerInfo.email}`}
                className="text-xs font-black text-blue-900 hover:text-blue-700 font-mono tracking-tight break-all block transition-colors"
                dir="ltr"
              >
                {engineerInfo.email}
              </a>
              <span className="text-[10px] text-slate-500 font-medium block mt-1">
                {copiedKey === 'email' ? '✓ تم النسخ إلى الحافظة' : 'انقر لإرسال رسالة مباشرة'}
              </span>
            </div>

            {/* Card 2: Mobile & WhatsApp */}
            <div className="rounded-2xl p-3.5 bg-slate-50 hover:bg-emerald-50/60 border border-slate-200 hover:border-emerald-300 transition-all group">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2 text-xs font-black text-slate-800">
                  <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <Phone className="w-3.5 h-3.5" />
                  </div>
                  <span>رقم الجوال</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(engineerInfo.mobile, 'mobile')}
                  className="p-1 rounded-md text-slate-400 hover:text-emerald-700 hover:bg-emerald-100/60 transition-colors cursor-pointer"
                  title="نسخ رقم الجوال"
                >
                  {copiedKey === 'mobile' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <a
                href={`tel:${engineerInfo.mobile}`}
                className="text-xs font-black text-emerald-900 hover:text-emerald-700 font-mono tracking-wider block transition-colors"
                dir="ltr"
              >
                {engineerInfo.mobile}
              </a>
              <span className="text-[10px] text-slate-500 font-medium block mt-1">
                {copiedKey === 'mobile' ? '✓ تم النسخ إلى الحافظة' : 'اتصال مباشر / واتساب'}
              </span>
            </div>

            {/* Card 3: Telephone Extension */}
            <div className="rounded-2xl p-3.5 bg-slate-50 hover:bg-amber-50/60 border border-slate-200 hover:border-amber-300 transition-all group">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2 text-xs font-black text-slate-800">
                  <div className="w-6 h-6 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
                    <PhoneCall className="w-3.5 h-3.5" />
                  </div>
                  <span>التحويلة الداخلية</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(engineerInfo.extension, 'ext')}
                  className="p-1 rounded-md text-slate-400 hover:text-amber-700 hover:bg-amber-100/60 transition-colors cursor-pointer"
                  title="نسخ التحويلة"
                >
                  {copiedKey === 'ext' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <div className="text-sm font-black text-amber-950 font-mono tracking-widest">
                {engineerInfo.extension}
              </div>
              <span className="text-[10px] text-slate-500 font-medium block mt-1">
                {copiedKey === 'ext' ? '✓ تم النسخ' : 'شبكة الهاتف الداخلي'}
              </span>
            </div>

            {/* Card 4: Organization & Department */}
            <div className="rounded-2xl p-3.5 bg-slate-50 hover:bg-purple-50/60 border border-slate-200 hover:border-purple-300 transition-all group">
              <div className="flex items-center gap-2 text-xs font-black text-slate-800 mb-1.5">
                <div className="w-6 h-6 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                </div>
                <span>الجهة المشرفة</span>
              </div>
              <div className="text-xs font-black text-purple-950 leading-tight">
                {engineerInfo.organization}
              </div>
              <span className="text-[10px] text-slate-500 font-medium block mt-1">
                {engineerInfo.department}
              </span>
            </div>

          </div>

          {/* Interactive Feature Notes Badge Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-950 text-white border border-slate-800 shadow-inner space-y-2">
            <div className="flex items-center gap-2 text-amber-300 text-xs font-black">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>أهداف وميزات المنظومة</span>
            </div>
            <ul className="text-[11px] text-slate-300 space-y-1.5 font-medium leading-relaxed pr-2 list-disc list-inside">
              <li>حوكمة وتدقيق استلام أوامر العمل الميدانية قبل الترحيل لإجراء 155.</li>
              <li>مقارنة نسب إنجاز المكاتب والمقاولين وإصدار التقارير الأسبوعية والشهرية الذكية.</li>
              <li>مزامنة سحابية لحظية 24/7 مع حماية مشددة من فقدان البيانات نهائياً.</li>
            </ul>
          </div>

          {/* وثيقة التعديلات المعتمدة - تاسعاً: منع التراجع عن الإجراءات (No Undo Policy) */}
          <div className="p-4 rounded-2xl bg-rose-50/60 border-2 border-rose-200 space-y-3 text-right">
            <div className="flex items-center justify-between gap-2 border-b border-rose-200 pb-2">
              <div className="flex items-center gap-2 text-rose-900 text-xs sm:text-sm font-black">
                <ShieldCheck className="w-4 h-4 text-rose-600 shrink-0" />
                <span>تاسعاً: منع التراجع عن الإجراءات (No Undo Policy)</span>
              </div>
              <span className="px-2 py-0.5 rounded bg-rose-700 text-white text-[10px] font-black">
                وثيقة التعديلات المعتمدة
              </span>
            </div>

            <p className="text-[11px] text-slate-700 font-bold leading-relaxed">
              <strong>الهدف:</strong> ضمان سلامة واعتمادية البيانات ومنع إلغاء أي إجراء تم تنفيذه داخل المنصة بعد حفظه واعتماده، مع الحفاظ الكامل على المزامنة الفورية بين جميع المستخدمين والشاشات.
            </p>

            <div className="space-y-2 text-[11px] text-slate-800">
              <div className="p-2.5 rounded-xl bg-white border border-rose-100">
                <div className="font-black text-rose-900 mb-1">1. منع التراجع نهائياً:</div>
                <p className="text-slate-600 leading-relaxed">
                  منع التراجع (Undo) عن أي إجراء يتم داخل المنصة، بما يشمل: إدخال وتعديل وحذف البيانات، عمليات التدقيق، تغيير حالات البنود وأوامر العمل، رفع وحذف المرفقات، اعتماد التدقيق أو إلغاء الاعتماد، تحديث قوائم التحقق (Checklists)، والتعديلات الجماعية.
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-white border border-rose-100">
                <div className="font-black text-rose-900 mb-1">2. إلغاء وظائف التراجع والاسترجاع:</div>
                <p className="text-slate-600 leading-relaxed">
                  إزالة وتعطيل أزرار Undo، واختصارات لوحة المفاتيح (Ctrl + Z / Ctrl + Y)، وأي إمكانية للعودة إلى الحالة السابقة للسجل من واجهة المستخدم.
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-white border border-rose-100">
                <div className="font-black text-rose-900 mb-1">3. اعتماد مبدأ السجل غير القابل للتراجع (Final Action):</div>
                <p className="text-slate-600 leading-relaxed">
                  بعد تنفيذ أي عملية وحفظها تعتبر نهائية (Final Action)، وأي تعديل لاحق يتم تسجيله كإجراء جديد مستقل مع الاحتفاظ بكامل السجل التاريخي للتغييرات (Audit Trail).
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-white border border-rose-100">
                <div className="font-black text-rose-900 mb-1">4. سجل تدقيق كامل (Audit Trail):</div>
                <p className="text-slate-600 leading-relaxed">
                  تسجيل جميع العمليات تلقائياً مع حفظ: اسم المستخدم، التاريخ والوقت، نوع العملية، القيمة السابقة، القيمة الجديدة، الجهاز أو الجلسة المستخدمة، ورقم أمر العمل المرتبط، مع إمكانية الاستعراض فقط حسب الصلاحيات.
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-white border border-rose-100">
                <div className="font-black text-rose-900 mb-1">5. الحفاظ على المزامنة الفورية و6. آلية الحماية من الأخطاء:</div>
                <p className="text-slate-600 leading-relaxed">
                  تتم المزامنة الفورية لحظياً بين جميع المستخدمين والشاشات، وقبل تنفيذ العمليات الحساسة فقط (حذف سجل، حذف مرفق، اعتماد نهائي، إلغاء حالة معتمدة) تظهر رسالة تأكيد تنص على: <strong className="text-rose-700">«هذا الإجراء نهائي ولا يمكن التراجع عنه بعد التنفيذ.»</strong>
                </p>
              </div>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <div className="text-[10px] text-slate-500 font-semibold flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>نظام موثق • جميع الحقوق محفوظة لمنظومة حوكمة جودة أعمال الإنشاءات</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs transition-colors cursor-pointer shadow-sm"
          >
            إغلاق
          </button>
        </div>

      </div>
    </div>
  );
};
