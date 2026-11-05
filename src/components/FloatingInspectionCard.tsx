import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  WorkOrder, 
  AttachedInspectionFile, 
  SHAREPOINT_AUDIT_URL, 
  buildSharePointDirectWorkOrderSearchUrl,
  FILE_DELETE_SECRET_PIN 
} from '../types';
import { 
  X, 
  Move, 
  Maximize2, 
  Minimize2, 
  Upload, 
  FileText, 
  Image as ImageIcon, 
  Trash2, 
  Download, 
  ExternalLink, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  RotateCcw, 
  ShieldAlert, 
  Lock, 
  CheckCircle2, 
  AlertCircle, 
  Copy, 
  Check, 
  FolderGit2, 
  FolderOpen,
  Eye,
  EyeOff,
  FileCheck2,
  RefreshCw,
  Edit3,
  Printer
} from 'lucide-react';
import { soundService } from '../services/soundService';
import { OnlineFileViewerModal } from './OnlineFileViewerModal';

// Convert base64 dataUrl to Blob URL for fast native in-browser PDF preview without download
function base64ToPdfBlobUrl(dataUrl: string): string {
  if (!dataUrl) return '';
  if (dataUrl.startsWith('blob:')) return dataUrl;
  try {
    const parts = dataUrl.split(',');
    if (parts.length < 2) return dataUrl;
    const mimeMatch = parts[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'application/pdf';
    const b64Data = parts[1];
    const byteCharacters = atob(b64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mime || 'application/pdf' });
    return URL.createObjectURL(blob);
  } catch (err) {
    return dataUrl;
  }
}

interface FloatingInspectionCardProps {
  order: WorkOrder;
  isOpen: boolean;
  onClose: () => void;
  onUpdateOrder: (updatedOrder: WorkOrder) => void;
  onNotification?: (msg: string, type: 'create' | 'update' | 'delete' | 'success' | 'warning' | 'error' | 'sync') => void;
}

export const FloatingInspectionCard: React.FC<FloatingInspectionCardProps> = ({
  order,
  isOpen,
  onClose,
  onUpdateOrder,
  onNotification
}) => {
  // Dragging and window positioning state
  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    if (typeof window !== 'undefined') {
      const w = Math.min(window.innerWidth - 40, 780);
      const h = Math.min(window.innerHeight - 80, 680);
      return {
        x: Math.max(20, Math.floor((window.innerWidth - w) / 2)),
        y: Math.max(30, Math.floor((window.innerHeight - h) / 4))
      };
    }
    return { x: 80, y: 80 };
  });

  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ startX: number; startY: number; posX: number; posY: number }>({
    startX: 0,
    startY: 0,
    posX: 0,
    posY: 0
  });

  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  // Active selected file index
  const files: AttachedInspectionFile[] = order.photosFile || [];
  const [selectedFileIndex, setSelectedFileIndex] = useState<number>(0);

  // Image transformation tools
  const [imageZoom, setImageZoom] = useState<number>(1);
  const [imageRotation, setImageRotation] = useState<number>(0);

  // Delete protection with hidden PIN
  const [fileToDelete, setFileToDelete] = useState<AttachedInspectionFile | null>(null);
  const [deletePinInput, setDeletePinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [showPinPassword, setShowPinPassword] = useState<boolean>(false);
  const [isCopiedOrderNumber, setIsCopiedOrderNumber] = useState(false);

  // File rename state
  const [editingFileNameId, setEditingFileNameId] = useState<string | null>(null);
  const [editedFileNameInput, setEditedFileNameInput] = useState<string>('');
  const [isOnlineViewerOpen, setIsOnlineViewerOpen] = useState<boolean>(false);

  // File upload input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentFile = files[selectedFileIndex] || null;
  const isCurrentPdf = Boolean(
    currentFile && (currentFile.type?.includes('pdf') || currentFile.name?.toLowerCase().endsWith('.pdf'))
  );

  // Native Blob URL for direct full-screen, in-browser PDF preview without download
  const pdfBlobUrl = useMemo(() => {
    if (!currentFile || !isCurrentPdf) return null;
    return base64ToPdfBlobUrl(currentFile.dataUrl);
  }, [currentFile?.id, currentFile?.dataUrl, isCurrentPdf]);

  // Reset zoom and rotation when switching file
  useEffect(() => {
    setImageZoom(1);
    setImageRotation(0);
  }, [selectedFileIndex]);

  // Adjust selected index if files list changes
  useEffect(() => {
    if (selectedFileIndex >= files.length && files.length > 0) {
      setSelectedFileIndex(files.length - 1);
    }
  }, [files.length, selectedFileIndex]);

  // Pointer drag event handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only drag from header, ignore buttons or interactive items
    if ((e.target as HTMLElement).closest('button, a, input, select')) return;
    if (isMaximized) return;

    setIsDragging(true);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      posX: position.x,
      posY: position.y
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || isMaximized) return;
    const deltaX = e.clientX - dragStartRef.current.startX;
    const deltaY = e.clientY - dragStartRef.current.startY;

    const newX = Math.max(10, Math.min(window.innerWidth - 300, dragStartRef.current.posX + deltaX));
    const newY = Math.max(10, Math.min(window.innerHeight - 100, dragStartRef.current.posY + deltaY));

    setPosition({ x: newX, y: newY });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      setIsDragging(false);
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch (_) {}
    }
  };

  // Upload/Import Files (PDFs or Images)
  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    const newFiles: AttachedInspectionFile[] = [];
    let processed = 0;
    const totalToProcess = selectedFiles.length;

    Array.from(selectedFiles).forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        newFiles.push({
          id: `file-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          name: file.name,
          size: file.size,
          type: file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
          dataUrl,
          uploadedAt: new Date().toISOString()
        });

        processed += 1;
        if (processed === totalToProcess) {
          const currentList = order.photosFile || [];
          const updatedList = [...currentList, ...newFiles];
          const updatedOrder: WorkOrder = {
            ...order,
            photosFile: updatedList,
            updatedAt: new Date().toISOString()
          };
          onUpdateOrder(updatedOrder);
          setSelectedFileIndex(currentList.length);
          try {
            soundService.playActionSound('create');
          } catch (_) {}
          if (onNotification) {
            onNotification(`تم استيراد وإرفاق ${newFiles.length} ملف بنجاح في ملف الصور`, 'success');
          }
        }
      };

      reader.onerror = () => {
        processed += 1;
      };

      reader.readAsDataURL(file);
    });

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Trigger file delete protection
  const requestDeleteFile = (file: AttachedInspectionFile) => {
    setFileToDelete(file);
    setDeletePinInput('');
    setPinError(null);
  };

  // Confirm delete with PIN 321
  const handleConfirmDelete = () => {
    if (!fileToDelete) return;
    if (deletePinInput.trim() !== FILE_DELETE_SECRET_PIN) {
      setPinError('الرقم السري غير صحيح! يرجى إدخال الرقم السري الصحيح لحذف المرفق.');
      try {
        soundService.playActionSound('delete');
      } catch (_) {}
      return;
    }

    // Valid PIN: perform delete
    const currentList = order.photosFile || [];
    const updatedList = currentList.filter(f => f.id !== fileToDelete.id);
    const updatedOrder: WorkOrder = {
      ...order,
      photosFile: updatedList,
      updatedAt: new Date().toISOString()
    };
    onUpdateOrder(updatedOrder);
    setFileToDelete(null);
    setDeletePinInput('');
    setPinError(null);

    try {
      soundService.playActionSound('delete');
    } catch (_) {}
    if (onNotification) {
      onNotification(`تم حذف الملف (${fileToDelete.name}) بنجاح بعد التحقق من الرقم السري`, 'delete');
    }
  };

  const copyOrderNumber = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (order.workOrderNumber) {
      navigator.clipboard.writeText(order.workOrderNumber);
      setIsCopiedOrderNumber(true);
      setTimeout(() => setIsCopiedOrderNumber(false), 2000);
    }
  };

  const handleStartRename = (file: AttachedInspectionFile) => {
    setEditingFileNameId(file.id);
    setEditedFileNameInput(file.name);
  };

  const handleRenameFile = (fileId: string, newName?: string) => {
    const trimmed = (newName !== undefined ? newName : editedFileNameInput).trim();
    if (!trimmed) {
      setEditingFileNameId(null);
      return;
    }
    const currentList = order.photosFile || [];
    const updatedList = currentList.map(f => f.id === fileId ? { ...f, name: trimmed } : f);
    const updatedOrder: WorkOrder = {
      ...order,
      photosFile: updatedList,
      updatedAt: new Date().toISOString()
    };
    onUpdateOrder(updatedOrder);
    setEditingFileNameId(null);
    try {
      soundService.playActionSound('update');
    } catch (_) {}
    if (onNotification) {
      onNotification(`تم تغيير اسم الملف بنجاح إلى (${trimmed})`, 'update');
    }
  };

  if (!isOpen) return null;

  const cardContent = (
    <div
      style={
        isMaximized
          ? { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999 }
          : {
              position: 'fixed',
              left: `${position.x}px`,
              top: `${position.y}px`,
              width: 'min(94vw, 840px)',
              height: isMinimized ? 'auto' : 'min(90vh, 720px)',
              zIndex: 99999
            }
      }
      className={`flex flex-col bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl shadow-2xl text-white font-['Cairo',sans-serif] overflow-hidden transition-shadow select-none ${
        isDragging ? 'ring-2 ring-emerald-500 shadow-emerald-500/20' : ''
      }`}
    >
      {/* 1. Header Bar & Move Handle (يمكن تحريك البطاقة بحرية في أي مكان على الشاشة) */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className={`px-4 py-3 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border-b border-slate-800 flex items-center justify-between gap-3 ${
          isMaximized ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'
        }`}
        title="اسحب من هنا لتحريك البطاقة في أي مكان على الشاشة أثناء التدقيق"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0">
            <Move className="w-4 h-4" />
          </div>

          <div className="min-w-0 text-right">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-black text-white">بطاقة تدقيق ملف الصور والمستندات</span>
              <button
                type="button"
                onClick={copyOrderNumber}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 text-[11px] font-mono font-bold hover:bg-emerald-900/80 transition-colors cursor-pointer"
                title="نسخ رقم أمر العمل"
              >
                <span>{order.workOrderNumber || 'بدون رقم'}</span>
                {isCopiedOrderNumber ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-emerald-300" />}
              </button>
              {order.workOrderCode && (
                <span className="px-2 py-0.5 rounded-lg bg-blue-950/80 text-blue-300 border border-blue-500/40 text-[11px] font-bold">
                  {order.workOrderCode}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[10px] text-slate-300 font-medium truncate mt-0.5">
              <span>{order.office || 'المكتب'}</span>
              <span>•</span>
              <span>{order.contractor || 'المقاول'}</span>
              <span>•</span>
              <span className="text-emerald-400 font-bold">{files.length} مرفق</span>
            </div>
          </div>
        </div>

        {/* Window controls */}
        <div className="flex items-center gap-1 shrink-0" onPointerDown={(e) => e.stopPropagation()}>
          {/* External SharePoint link button with direct workOrderNumber search */}
          <a
            href={buildSharePointDirectWorkOrderSearchUrl(order.workOrderNumber, order.sharepointFolderUrl || SHAREPOINT_AUDIT_URL)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              if (order.workOrderNumber) {
                try { navigator.clipboard?.writeText(order.workOrderNumber); } catch (_) {}
              }
            }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-blue-600/90 hover:bg-blue-600 text-white text-xs font-black border border-blue-400/50 shadow-xs transition-all cursor-pointer"
            title={
              order.workOrderNumber
                ? `البحث المباشر عن أمر العمل (${order.workOrderNumber}) في جميع ملفات الشير والتوجه إليه مباشرة`
                : 'فتح ملف الشير الموحد على SharePoint'
            }
          >
            <FolderOpen className="w-3.5 h-3.5 text-blue-200" />
            <span className="hidden sm:inline">
              {order.workOrderNumber ? `ملف الشير (${order.workOrderNumber})` : 'ملف الشير'}
            </span>
          </a>

          {/* Minimize / Expand Toggle */}
          <button
            type="button"
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title={isMinimized ? 'استعادة الحجم' : 'تصغير البطاقة'}
          >
            {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
          </button>

          {/* Maximize Toggle */}
          <button
            type="button"
            onClick={() => {
              setIsMaximized(!isMaximized);
              setIsMinimized(false);
            }}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title={isMaximized ? 'حجم نافذة عادية' : 'تكبير لكامل الشاشة'}
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900 text-rose-300 hover:text-white transition-colors cursor-pointer border border-rose-800/40"
            title="إغلاق البطاقة"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. Main Content Area (Shown when not minimized) */}
      {!isMinimized && (
        <div className="flex-1 flex flex-col min-h-0 bg-slate-950/60 overflow-hidden">
          {/* Top Quick Bar: SharePoint Notice + Upload Trigger */}
          <div className="px-4 py-2 bg-slate-900/90 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
            {/* Fixed SharePoint link info */}
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span className="text-[11px] text-slate-300 truncate">
                الرابط المعتمد للملفات: <strong className="text-blue-300">متابعة جودة الصور في SharePoint</strong>
              </span>
              <a
                href={buildSharePointDirectWorkOrderSearchUrl(order.workOrderNumber, order.sharepointFolderUrl || SHAREPOINT_AUDIT_URL)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  if (order.workOrderNumber) {
                    try { navigator.clipboard?.writeText(order.workOrderNumber); } catch (_) {}
                  }
                }}
                className="text-[10px] text-blue-400 hover:text-blue-300 underline inline-flex items-center gap-0.5 shrink-0"
              >
                <span>{order.workOrderNumber ? `بحث مباشر عن (${order.workOrderNumber}) في ملف الشير` : 'فتح المجلد'}</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>

            {/* Upload Button */}
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="application/pdf,image/*"
                onChange={handleFilesSelected}
                className="hidden"
                id="floating-card-file-input"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white text-xs font-black shadow-xs cursor-pointer transition-all active:scale-95"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>+ استيراد ملفات / PDF / صور</span>
              </button>
            </div>
          </div>

          {/* File Viewer Body: Split into Left Preview & Right Thumbnails */}
          <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
            {/* Left: Interactive Preview Canvas */}
            <div className="flex-1 flex flex-col min-h-0 bg-slate-950 relative border-b md:border-b-0 md:border-l border-slate-800">
              {currentFile ? (
                <>
                  {/* File toolbar */}
                  <div className="px-3 py-1.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      {isCurrentPdf ? (
                        <FileText className="w-4 h-4 text-red-400 shrink-0" />
                      ) : (
                        <ImageIcon className="w-4 h-4 text-blue-400 shrink-0" />
                      )}
                      
                      {editingFileNameId === currentFile.id ? (
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            value={editedFileNameInput}
                            onChange={(e) => setEditedFileNameInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleRenameFile(currentFile.id);
                              if (e.key === 'Escape') setEditingFileNameId(null);
                            }}
                            autoFocus
                            className="px-2 py-0.5 rounded bg-slate-800 text-white border border-emerald-500 text-xs font-bold outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleRenameFile(currentFile.id)}
                            className="p-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                            title="حفظ الاسم"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingFileNameId(null)}
                            className="p-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 cursor-pointer"
                            title="إلغاء"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-bold text-white text-xs truncate max-w-[180px] sm:max-w-[280px]">
                            {currentFile.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleStartRename(currentFile)}
                            className="p-0.5 rounded hover:bg-slate-800 text-slate-400 hover:text-amber-300 transition-colors cursor-pointer"
                            title="تعديل اسم الملف (إعادة التسمية)"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                          <span className="text-[10px] text-slate-400 font-mono">
                            ({Math.round(currentFile.size / 1024)} KB)
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Preview action buttons */}
                    <div className="flex items-center gap-1">
                      {/* Online Fullscreen Preview Modal Trigger */}
                      <button
                        type="button"
                        onClick={() => setIsOnlineViewerOpen(true)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-[11px] font-black cursor-pointer shadow-xs transition-all active:scale-95"
                        title="معاينة كاملة متوافقة مع كافة البرامج وقارئات PDF والمتصفحات"
                      >
                        <Eye className="w-3.5 h-3.5 text-blue-200" />
                        <span>معاينة كاملة أونلاين</span>
                      </button>

                      {!isCurrentPdf && (
                        <>
                          <button
                            type="button"
                            onClick={() => setImageZoom(prev => Math.min(prev + 0.25, 4))}
                            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                            title="تكبير الصورة"
                          >
                            <ZoomIn className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setImageZoom(prev => Math.max(prev - 0.25, 0.5))}
                            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                            title="تصغير الصورة"
                          >
                            <ZoomOut className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setImageRotation(prev => (prev + 90) % 360)}
                            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                            title="تدوير 90 درجة"
                          >
                            <RotateCw className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}

                      {isCurrentPdf && (
                        <button
                          type="button"
                          onClick={() => {
                            if (pdfBlobUrl || currentFile.dataUrl) {
                              window.open(pdfBlobUrl || currentFile.dataUrl, '_blank');
                            }
                          }}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold cursor-pointer transition-colors"
                          title="فتح في نافذة مستقلة"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span className="hidden sm:inline">نافذة جديدة</span>
                        </button>
                      )}

                      {/* Download File */}
                      <a
                        href={currentFile.dataUrl}
                        download={currentFile.name}
                        className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
                        title="تحميل نسخة من الملف للجهاز"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>

                      {/* Protected Delete with Hidden Secret PIN */}
                      <button
                        type="button"
                        onClick={() => requestDeleteFile(currentFile)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-950/80 hover:bg-rose-900 text-rose-300 hover:text-rose-100 text-[11px] font-bold border border-rose-800/40 cursor-pointer transition-colors"
                        title="حذف الملف (محمي برقم سري)"
                      >
                        <Lock className="w-3 h-3 text-amber-400" />
                        <Trash2 className="w-3 h-3" />
                        <span>حذف</span>
                      </button>
                    </div>
                  </div>

                  {/* Main Viewer Display */}
                  <div className="flex-1 overflow-auto flex items-center justify-center p-3 relative bg-slate-950/80">
                    {isCurrentPdf ? (
                      <div className="w-full h-full flex flex-col items-center justify-center relative bg-slate-900 rounded-lg overflow-hidden border border-slate-800">
                        <object
                          data={pdfBlobUrl || currentFile.dataUrl}
                          type="application/pdf"
                          className="w-full h-full rounded-lg border-0 bg-white"
                        >
                          <iframe
                            src={pdfBlobUrl || currentFile.dataUrl}
                            title={currentFile.name}
                            className="w-full h-full rounded-lg border-0 bg-white"
                          />
                        </object>
                      </div>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center overflow-auto p-2">
                        <img
                          src={currentFile.dataUrl}
                          alt={currentFile.name}
                          style={{
                            transform: `scale(${imageZoom}) rotate(${imageRotation}deg)`,
                            transition: 'transform 0.15s ease-out',
                            maxHeight: '100%',
                            maxWidth: '100%',
                            objectFit: 'contain'
                          }}
                          className="rounded-lg shadow-lg select-none"
                        />
                      </div>
                    )}
                  </div>
                </>
              ) : (
                /* Empty state when no files exist */
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 text-slate-500 flex items-center justify-center mb-3">
                    <ImageIcon className="w-8 h-8" />
                  </div>
                  <h4 className="text-sm font-black text-slate-200">لا توجد ملفات مرفوعة لأمر العمل حالياً</h4>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm">
                    يمكنك استيراد أي ملفات PDF أو صور ميدانية لتسهيل عملية تدقيق أمر العمل ومطابقته مع اشتراطات إجراء 155.
                  </p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 text-white text-xs font-black shadow-md cursor-pointer transition-all active:scale-95"
                  >
                    <Upload className="w-4 h-4" />
                    <span>استيراد ملفات الآن</span>
                  </button>
                </div>
              )}
            </div>

            {/* Right: Files Sidebar Thumbnails & Upload Dropzone */}
            <div className="w-full md:w-64 bg-slate-900/90 flex flex-col min-h-0 border-t md:border-t-0 border-slate-800">
              <div className="px-3 py-2 bg-slate-800/80 border-b border-slate-700/80 flex items-center justify-between">
                <span className="text-xs font-black text-slate-200">
                  قائمة المرفقات ({files.length})
                </span>
                <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30 flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5 text-amber-400" />
                  <span>محمي برقم سري</span>
                </span>
              </div>

              {/* Scrollable list of files */}
              <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                {files.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400 italic">
                    لا توجد مرفقات
                  </div>
                ) : (
                  files.map((file, idx) => {
                    const isSelected = idx === selectedFileIndex;
                    const isPdf = file.type.includes('pdf') || file.name.toLowerCase().endsWith('.pdf');
                    return (
                      <div
                        key={file.id || idx}
                        onClick={() => setSelectedFileIndex(idx)}
                        className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 text-right ${
                          isSelected
                            ? 'bg-gradient-to-r from-indigo-950 to-blue-950 border-indigo-500 text-white ring-1 ring-indigo-400'
                            : 'bg-slate-800/60 hover:bg-slate-800 border-slate-700/60 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {isPdf ? (
                            <div className="w-8 h-8 rounded-lg bg-red-950/80 border border-red-500/40 text-red-400 flex items-center justify-center shrink-0">
                              <FileText className="w-4 h-4" />
                            </div>
                          ) : (
                            <div className="w-8 h-8 rounded-lg overflow-hidden border border-slate-700 shrink-0 bg-black">
                              <img src={file.dataUrl} alt={file.name} className="w-full h-full object-cover" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="text-xs font-bold truncate max-w-[120px]">{file.name}</div>
                            <div className="text-[9px] text-slate-400 font-mono">
                              {isPdf ? 'مستند PDF' : 'صورة'} • {Math.round(file.size / 1024)} KB
                            </div>
                          </div>
                        </div>

                        {/* Action buttons for item: Rename & Protected Delete */}
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartRename(file);
                            }}
                            className="p-1 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-slate-700/60 transition-colors cursor-pointer"
                            title="تعديل اسم الملف (إعادة التسمية)"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              requestDeleteFile(file);
                            }}
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/60 transition-colors cursor-pointer"
                            title="حذف الملف (محمي برقم سري)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Upload Dropzone Footer */}
              <div className="p-2 border-t border-slate-800 bg-slate-950/80">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-2 px-3 rounded-xl border border-dashed border-slate-700 hover:border-emerald-500/80 bg-slate-900/60 hover:bg-emerald-950/30 text-slate-300 hover:text-emerald-300 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>+ إضافة ملفات جديدة</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. PIN Delete Protection Modal Overlay (Protected with Authorization PIN) */}
      {fileToDelete && (
        <div className="absolute inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-rose-500/60 rounded-2xl p-5 max-w-sm w-full text-right shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-black text-white">حذف مرفق محمي برقم سري</h4>
                <p className="text-[11px] text-slate-400">الملفات المرفوعة محمية لمنع الحذف غير المصرح به</p>
              </div>
            </div>

            <div className="bg-rose-950/80 rounded-xl p-2.5 border border-rose-500/60 text-xs mb-3 flex items-center gap-2 text-rose-200 font-black">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>هذا الإجراء نهائي ولا يمكن التراجع عنه بعد التنفيذ.</span>
            </div>

            <div className="bg-slate-950/80 rounded-xl p-2.5 border border-slate-800 text-xs mb-3 space-y-1">
              <div className="text-slate-300 truncate">
                الملف المراد حذفه: <strong className="text-white">{fileToDelete.name}</strong>
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                الحجم: {Math.round(fileToDelete.size / 1024)} KB
              </div>
            </div>

            <div className="space-y-2 mb-4">
              <label className="block text-xs font-black text-slate-300">
                أدخل الرقم السري المصرح به للمتابعة:
              </label>
              <div className="relative flex items-center">
                <input
                  type={showPinPassword ? 'text' : 'password'}
                  value={deletePinInput}
                  onChange={(e) => {
                    setDeletePinInput(e.target.value);
                    setPinError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleConfirmDelete();
                  }}
                  placeholder="••••••"
                  className="w-full px-10 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-center text-base tracking-widest focus:outline-none focus:ring-2 focus:ring-rose-500"
                  autoFocus
                />
                <Lock className="w-4 h-4 text-slate-500 absolute right-3 pointer-events-none" />
                <button
                  type="button"
                  onClick={() => setShowPinPassword(!showPinPassword)}
                  className="p-1.5 text-slate-400 hover:text-white absolute left-2 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                  title={showPinPassword ? 'إخفاء الرقم السري' : 'إظهار الرقم السري'}
                >
                  {showPinPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {pinError && (
                <div className="text-[11px] text-rose-400 font-bold bg-rose-950/60 p-2 rounded-lg border border-rose-800/40 flex items-center gap-1.5 animate-in shake">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{pinError}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs shadow-md cursor-pointer transition-all active:scale-95"
              >
                تأكيد الحذف
              </button>
              <button
                type="button"
                onClick={() => {
                  setFileToDelete(null);
                  setDeletePinInput('');
                  setPinError(null);
                  setShowPinPassword(false);
                }}
                className="py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer transition-colors"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(cardContent, document.body);
  }

  return cardContent;
};
