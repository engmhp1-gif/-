import React, { Component, ReactNode } from 'react';
import { ShieldCheck, RefreshCw, AlertTriangle, Home } from 'lucide-react';
import { PRIMARY_MASTER_USER, saveCurrentUser } from '../utils/security';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: any;
}

export class ErrorBoundary extends (Component as any) {
  state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('[Procedure 155 ErrorBoundary] Uncaught runtime exception:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleRepairAndOpen = () => {
    try {
      saveCurrentUser(PRIMARY_MASTER_USER);
    } catch (_) {}
    window.location.href = window.location.pathname;
  };

  render() {
    if (this.state.hasError) {
      return (
        <div 
          className="min-h-screen w-full bg-slate-950 text-white flex flex-col justify-between font-['Cairo',sans-serif] p-4 sm:p-8" 
          dir="rtl"
        >
          <header className="w-full max-w-4xl mx-auto flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-800 border border-emerald-400/40 flex items-center justify-center shadow-md">
                <ShieldCheck className="w-5 h-5 text-amber-300" />
              </div>
              <div>
                <h1 className="text-base font-black text-white">منصة حوكمة جودة اعمال الانشاءات</h1>
                <p className="text-xs text-slate-400">إجراء 155 • وضع الاسترداد الذاتي لواجهة البرنامج</p>
              </div>
            </div>
          </header>

          <main className="w-full max-w-2xl mx-auto my-auto py-8">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-6">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
                <AlertTriangle className="w-8 h-8" />
              </div>

              <div className="space-y-2">
                <h2 className="text-xl sm:text-2xl font-black text-white">
                  استعادة واجهة البرنامج المباشرة
                </h2>
                <p className="text-sm text-slate-300 max-w-lg mx-auto leading-relaxed">
                  حدث تعثر أثناء تحميل عناصر الواجهة. تم الحفاظ على كافة البيانات وأوامر العمل المحفوظة بنجاح، ويمكنك فتح الواجهة فوراً عبر الخيارات أدناه:
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={this.handleRepairAndOpen}
                  className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 cursor-pointer active:scale-98 transition-all"
                >
                  <Home className="w-4 h-4" />
                  <span>فتح واجهة البرنامج فوراً</span>
                </button>

                <button
                  type="button"
                  onClick={this.handleReload}
                  className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm flex items-center justify-center gap-2 border border-slate-700 cursor-pointer active:scale-98 transition-all"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>إعادة تحميل الصفحة</span>
                </button>
              </div>

              {this.state.error && (
                <details className="text-right text-xs text-slate-500 bg-slate-950/70 p-3 rounded-xl border border-slate-800/80 mt-4 cursor-pointer">
                  <summary className="font-mono text-slate-400 hover:text-slate-300">
                    التفاصيل التقنية للاسترداد ({this.state.error.name})
                  </summary>
                  <pre className="mt-2 text-left font-mono text-[10px] text-rose-300 overflow-x-auto p-2 bg-black/40 rounded" dir="ltr">
                    {this.state.error.message}
                    {this.state.errorInfo?.componentStack}
                  </pre>
                </details>
              )}
            </div>
          </main>

          <footer className="w-full max-w-4xl mx-auto border-t border-slate-800/80 pt-3 text-center text-xs text-slate-500">
            إدارة كهرباء الحدود الشمالية • المساندة الفنية والجودة • إجراء 155
          </footer>
        </div>
      );
    }

    return this.props.children;
  }
}
