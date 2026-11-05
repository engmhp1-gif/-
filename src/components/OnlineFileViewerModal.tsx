import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  Download, 
  ExternalLink, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  FileText, 
  Image as ImageIcon,
  Printer,
  Edit3,
  Check,
  FolderOpen,
  Copy
} from 'lucide-react';
import { AttachedInspectionFile, SHAREPOINT_AUDIT_URL, buildSharePointDirectWorkOrderSearchUrl } from '../types';
import { soundService } from '../services/soundService';

interface OnlineFileViewerModalProps {
  isOpen: boolean;
  file: AttachedInspectionFile | null;
  orderId?: string;
  orderNumber?: string;
  orderCode?: string;
  officeName?: string;
  contractorName?: string;
  onClose: () => void;
  onRename?: (fileId: string, newName: string) => void;
}

// Convert base64 dataUrl to Blob URL for native high-performance PDF/image preview
function createCleanBlobUrl(dataUrl: string, fallbackType: string): string {
  if (!dataUrl) return '';
  if (dataUrl.startsWith('blob:')) return dataUrl;
  try {
    const parts = dataUrl.split(',');
    if (parts.length < 2) return dataUrl;
    const mimeMatch = parts[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : fallbackType;
    const b64Data = parts[1];
    const byteCharacters = atob(b64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mime || fallbackType });
    return URL.createObjectURL(blob);
  } catch (err) {
    return dataUrl;
  }
}

export const OnlineFileViewerModal: React.FC<OnlineFileViewerModalProps> = ({
  isOpen,
  file,
  orderId,
  orderNumber,
  orderCode,
  officeName,
  contractorName,
  onClose,
  onRename
}) => {
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [isEditingName, setIsEditingName] = useState<boolean>(false);
  const [editedName, setEditedName] = useState<string>('');
  const [isCopied, setIsCopied] = useState<boolean>(false);

  const isPdf = Boolean(
    file && (file.type?.includes('pdf') || file.name?.toLowerCase().endsWith('.pdf'))
  );

  const blobUrl = useMemo(() => {
    if (!file || !file.dataUrl) return '';
    return createCleanBlobUrl(file.dataUrl, isPdf ? 'application/pdf' : 'image/jpeg');
  }, [file?.id, file?.dataUrl, isPdf]);

  const serverStreamUrl = useMemo(() => {
    if (!file?.id) return '';
    return orderId 
      ? `/api/files/preview/${orderId}/${file.id}` 
      : `/api/files/preview/${file.id}`;
  }, [orderId, file?.id]);

  if (!isOpen || !file) return null;

  const handleStartRename = () => {
    setEditedName(file.name);
    setIsEditingName(true);
  };

  const handleSaveRename = () => {
    const trimmed = editedName.trim();
    if (trimmed && onRename && trimmed !== file.name) {
      onRename(file.id, trimmed);
    }
    setIsEditingName(false);
  };

  const handleOpenInNewWindow = () => {
    // Prefer server streaming URL with proper headers for PDF compatibility, fallback to blobUrl
    const targetUrl = serverStreamUrl || blobUrl || file.dataUrl;
    if (!targetUrl) return;

    try {
      const a = document.createElement('a');
      a.href = targetUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        try { document.body.removeChild(a); } catch (_) {}
      }, 100);
    } catch (_) {
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleDownloadFile = () => {
    const dlUrl = serverStreamUrl ? `${serverStreamUrl}?download=true` : (blobUrl || file.dataUrl);
    const a = document.createElement('a');
    a.href = dlUrl;
    a.download = file.name || (isPdf ? 'document.pdf' : 'image.jpg');
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      try { document.body.removeChild(a); } catch (_) {}
    }, 100);
  };

  const handlePrint = () => {
    try {
      soundService.playActionSound('update');
    } catch (_) {}
    if (isPdf) {
      handleOpenInNewWindow();
    } else {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html dir="rtl">
          <head>
            <title>طباعة: ${file.name}</title>
            <style>
              body { margin: 0; padding: 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: sans-serif; }
              img { max-width: 100%; max-height: 90vh; object-fit: contain; }
              .meta { margin-bottom: 15px; font-size: 14px; color: #333; text-align: center; }
            </style>
          </head>
          <body>
            <div class="meta">
              <strong>${file.name}</strong> • أمر عمل: ${orderNumber || '-'} • المكتب: ${officeName || '-'} • المقاول: ${contractorName || '-'}
            </div>
            <img src="${blobUrl || file.dataUrl}" onload="window.print(); window.close();" />
          </body>
          </html>
        `);
        printWindow.document.close();
      }
    }
  };

  const handleCopyOrderNumber = () => {
    if (orderNumber) {
      navigator.clipboard.writeText(orderNumber);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  return createPortal(
    <div 
      className="fixed inset-0 z-[100000] bg-black/90 backdrop-blur-md flex flex-col font-['Cairo',sans-serif] select-none animate-in fade-in duration-200"
      dir="rtl"
    >
      {/* Top Professional Toolbar */}
      <div className="h-14 px-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-3 text-white shrink-0 shadow-lg">
        {/* Left Info: File Type Icon, Name with Rename Ability */}
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
            isPdf 
              ? 'bg-rose-950/80 border-rose-500/40 text-rose-400' 
              : 'bg-blue-950/80 border-blue-500/40 text-blue-400'
          }`}>
            {isPdf ? <FileText className="w-5 h-5" /> : <ImageIcon className="w-5 h-5" />}
          </div>

          <div className="min-w-0 text-right">
            {isEditingName ? (
              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                <input
                  type="text"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveRename();
                    if (e.key === 'Escape') setIsEditingName(false);
                  }}
                  autoFocus
                  className="px-2 py-0.5 rounded-lg bg-slate-800 text-white border border-emerald-500 text-xs font-bold outline-none ring-1 ring-emerald-400/50"
                />
                <button
                  type="button"
                  onClick={handleSaveRename}
                  className="p-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                  title="حفظ الاسم الجديد"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingName(false)}
                  className="p-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 cursor-pointer"
                  title="إلغاء"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-white truncate max-w-[280px] sm:max-w-[400px]">
                  {file.name}
                </span>
                {onRename && (
                  <button
                    type="button"
                    onClick={handleStartRename}
                    className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-amber-300 transition-colors cursor-pointer"
                    title="تعديل اسم الملف (إعادة التسمية)"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                )}
                <span className="text-[10px] text-slate-400 font-mono">
                  ({Math.round(file.size / 1024)} KB)
                </span>
              </div>
            )}

            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-medium truncate mt-0.5">
              {orderNumber && (
                <button
                  type="button"
                  onClick={handleCopyOrderNumber}
                  className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-mono font-bold cursor-pointer"
                  title="نسخ رقم أمر العمل"
                >
                  <span>أمر عمل: {orderNumber}</span>
                  {isCopied ? <Check className="w-2.5 h-2.5 text-emerald-300" /> : <Copy className="w-2.5 h-2.5 opacity-70" />}
                </button>
              )}
              {orderCode && <span>• الرمز: <strong className="text-blue-300">{orderCode}</strong></span>}
              {officeName && <span>• {officeName}</span>}
              {contractorName && <span>• {contractorName}</span>}
            </div>
          </div>
        </div>

        {/* Action Controls Toolbar */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Zoom & Rotation Controls for Images */}
          {!isPdf && (
            <div className="hidden sm:flex items-center gap-1 bg-slate-800/80 p-0.5 rounded-xl border border-slate-700">
              <button
                type="button"
                onClick={() => setZoom(prev => Math.min(prev + 0.25, 4))}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 cursor-pointer"
                title="تكبير"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setZoom(prev => Math.max(prev - 0.25, 0.5))}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 cursor-pointer"
                title="تصغير"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setRotation(prev => (prev + 90) % 360)}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 cursor-pointer"
                title="تدوير 90°"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => { setZoom(1); setRotation(0); }}
                className="px-2 py-0.5 text-[10px] font-mono font-bold text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg cursor-pointer"
                title="إعادة ضبط الحجم"
              >
                100%
              </button>
            </div>
          )}

          {/* Open in New Window (Fully compatible with external/browser PDF readers) */}
          <button
            type="button"
            onClick={handleOpenInNewWindow}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black border border-blue-400/50 shadow-xs cursor-pointer transition-all active:scale-95"
            title="فتح المستند في نافذة / علامة تبويب جديدة كمعاينة كاملة متوافقة مع كافة قارئات وبرامج PDF"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span className="hidden md:inline">فتح في نافذة مستقلة</span>
          </button>

          {/* SharePoint folder link with direct orderNumber search */}
          <a
            href={buildSharePointDirectWorkOrderSearchUrl(orderNumber, SHAREPOINT_AUDIT_URL)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              if (orderNumber) {
                try { navigator.clipboard?.writeText(orderNumber); } catch (_) {}
              }
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-blue-300 text-xs font-bold border border-slate-700 cursor-pointer"
            title={
              orderNumber
                ? `البحث المباشر عن أمر العمل (${orderNumber}) في جميع ملفات الشير والتوجه إليه مباشرة`
                : 'فتح مجلد متابعة جودة الصور قبل الارفاق على SharePoint'
            }
          >
            <FolderOpen className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden lg:inline">{orderNumber ? `ملف الشير (${orderNumber})` : 'ملف الشير'}</span>
          </a>

          {/* Print button */}
          <button
            type="button"
            onClick={handlePrint}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 cursor-pointer"
            title="طباعة المستند"
          >
            <Printer className="w-4 h-4" />
          </button>

          {/* Download Original File */}
          <a
            href={file.dataUrl}
            download={file.name}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 cursor-pointer"
            title="تحميل نسخة من الملف"
          >
            <Download className="w-4 h-4" />
          </a>

          {/* Close Modal */}
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-rose-950/80 hover:bg-rose-900 text-rose-300 hover:text-white border border-rose-800/60 cursor-pointer transition-colors"
            title="إغلاق المعاينة"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Full-Viewport Preview Body */}
      <div className="flex-1 w-full h-[calc(100vh-56px)] bg-slate-950 overflow-hidden relative flex items-center justify-center p-2 sm:p-4">
        {isPdf ? (
          <div className="w-full h-full bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl relative flex flex-col">
            <div className="bg-slate-850 px-4 py-2 text-xs text-slate-300 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800">
              <span className="flex items-center gap-1.5 font-bold text-amber-300">
                <FileText className="w-4 h-4 text-rose-400" />
                <span>معاينة مستند PDF أونلاين — متوافق مع كافة برامج وقارئات PDF</span>
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={blobUrl || file.dataUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
                  title="فتح المستند في نافذة كاملة بقارئ المتصفح المعتمد"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>فتح أونلاين في علامة تبويب</span>
                </a>
                <a
                  href={blobUrl || file.dataUrl}
                  download={file.name}
                  className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
                  title="تحميل الملف لفتحه في Adobe Acrobat أو برامج PDF بالجهاز"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>تحميل لفتحه في برامج PDF</span>
                </a>
              </div>
            </div>
            <div className="flex-1 w-full h-full relative bg-slate-950 flex flex-col">
              <object
                data={`${serverStreamUrl || blobUrl || file.dataUrl}#toolbar=1&navpanes=1&scrollbar=1&view=FitH`}
                type="application/pdf"
                className="w-full h-full border-0 bg-white"
                title={file.name}
              >
                <iframe
                  src={`${serverStreamUrl || blobUrl || file.dataUrl}#toolbar=1&navpanes=1&scrollbar=1&view=FitH`}
                  title={file.name}
                  className="w-full h-full border-0 bg-white"
                >
                  <div className="p-8 text-center text-white bg-slate-900 rounded-2xl m-6 flex flex-col items-center justify-center gap-4 border border-slate-700">
                    <FileText className="w-16 h-16 text-rose-400" />
                    <div>
                      <h4 className="text-base font-bold text-white mb-1">معاينة مستند PDF: {file.name}</h4>
                      <p className="text-xs text-slate-400">انقر لفتح المستند مباشرة في المتصفح أو تحميله لبرامج PDF المعتمدة</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={handleOpenInNewWindow}
                        className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md cursor-pointer"
                      >
                        <ExternalLink className="w-4 h-4" />
                        <span>فتح أونلاين في علامة تبويب</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleDownloadFile}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md cursor-pointer"
                      >
                        <Download className="w-4 h-4" />
                        <span>تحميل لبرامج PDF بالجهاز</span>
                      </button>
                    </div>
                  </div>
                </iframe>
              </object>
            </div>
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center overflow-auto p-4">
            <img
              src={blobUrl || file.dataUrl}
              alt={file.name}
              style={{
                transform: `scale(${zoom}) rotate(${rotation}deg)`,
                transition: 'transform 0.15s ease-out',
                maxHeight: '92vh',
                maxWidth: '94vw',
                objectFit: 'contain'
              }}
              className="rounded-xl shadow-2xl border border-slate-800 select-none bg-slate-900"
            />
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
