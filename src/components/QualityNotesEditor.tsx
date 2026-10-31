import React, { useState } from 'react';
import { 
  Plus, 
  Trash2, 
  Camera, 
  Image as ImageIcon, 
  X, 
  Check, 
  ZoomIn, 
  AlertCircle, 
  FileText,
  ListOrdered,
  Sparkles,
  Upload
} from 'lucide-react';
import { QualityNoteItem, WorkOrder } from '../types';

interface QualityNotesEditorProps {
  order?: WorkOrder | null;
  initialNotes?: string;
  initialItems?: QualityNoteItem[];
  onChange?: (items: QualityNoteItem[], textSummary: string) => void;
  onSave?: (items: QualityNoteItem[], textSummary: string) => void;
  onClose?: () => void;
  isStandaloneModal?: boolean;
}

/**
 * Helper to parse a freeform or numbered text string into structured QualityNoteItem elements
 */
export function parseNotesStringToItems(text: string, existingPhotos: string[] = []): QualityNoteItem[] {
  if (!text || !text.trim()) {
    return [];
  }

  const rawLines = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  // If text contains numbered items (e.g., "1. ...", "1- ...", "- ...", "* ...")
  const numberedRegex = /^(\d+[\.\-\)]|\-|\*|•)\s*(.+)$/;
  const detectedItems: string[] = [];
  let currentItem = '';

  for (const line of rawLines) {
    const match = line.match(numberedRegex);
    if (match) {
      if (currentItem.trim()) {
        detectedItems.push(currentItem.trim());
      }
      currentItem = match[2];
    } else {
      if (currentItem) {
        currentItem += ' ' + line;
      } else {
        currentItem = line;
      }
    }
  }
  if (currentItem.trim()) {
    detectedItems.push(currentItem.trim());
  }

  if (detectedItems.length === 0 && text.trim()) {
    detectedItems.push(text.trim());
  }

  return detectedItems.map((noteText, idx) => ({
    id: `note-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
    text: noteText,
    photos: idx === 0 && existingPhotos.length > 0 ? [...existingPhotos] : [],
    createdAt: new Date().toISOString()
  }));
}

/**
 * Helper to convert structured QualityNoteItem elements to a clean numbered string summary
 */
export function formatItemsToNotesString(items: QualityNoteItem[]): string {
  const activeItems = items.filter(it => it.text && it.text.trim());
  if (activeItems.length === 0) return '';
  if (activeItems.length === 1) return activeItems[0].text.trim();
  return activeItems.map((it, idx) => `${idx + 1}. ${it.text.trim()}`).join('\n');
}

export const QualityNotesEditor: React.FC<QualityNotesEditorProps> = ({
  order,
  initialNotes = '',
  initialItems,
  onChange,
  onSave,
  onClose,
  isStandaloneModal = false
}) => {
  // Initialize items from initialItems or parse initialNotes
  const [items, setItems] = useState<QualityNoteItem[]>(() => {
    if (initialItems && initialItems.length > 0) {
      return initialItems;
    }
    if (order?.qualityNoteItems && order.qualityNoteItems.length > 0) {
      return order.qualityNoteItems;
    }
    const fallbackText = initialNotes || order?.qualityNotes || order?.executionNotes || '';
    const notePhotos = (order?.photos || [])
      .filter(p => p.caption?.includes('ملاحظة') || p.stage === 'فحص الجودة')
      .map(p => p.url);

    const parsed = parseNotesStringToItems(fallbackText, notePhotos);
    if (parsed.length > 0) return parsed;

    // Start with 1 empty note ready for user input
    return [{
      id: `note-${Date.now()}-1`,
      text: '',
      photos: [],
      createdAt: new Date().toISOString()
    }];
  });

  // Photo viewer modal state
  const [previewPhoto, setPreviewPhoto] = useState<{ url: string; noteIndex: number; title: string } | null>(null);

  // Sync upward when items change
  const updateItems = (newItems: QualityNoteItem[]) => {
    setItems(newItems);
    const summary = formatItemsToNotesString(newItems);
    if (onChange) {
      onChange(newItems, summary);
    }
  };

  const handleAddNote = () => {
    const newItems: QualityNoteItem[] = [
      ...items,
      {
        id: `note-${Date.now()}-${items.length + 1}`,
        text: '',
        photos: [],
        createdAt: new Date().toISOString()
      }
    ];
    updateItems(newItems);
  };

  const handleRemoveNote = (index: number) => {
    if (items.length <= 1) {
      // Keep at least one empty note
      updateItems([{
        id: `note-${Date.now()}-1`,
        text: '',
        photos: [],
        createdAt: new Date().toISOString()
      }]);
      return;
    }
    const newItems = items.filter((_, idx) => idx !== index);
    updateItems(newItems);
  };

  const handleTextChange = (index: number, text: string) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], text };
    updateItems(newItems);
  };

  const handlePhotoUpload = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          const currentPhotos = newItemsRefCurrent[index].photos || [];
          const updatedPhotos = [...currentPhotos, reader.result];
          const newItems = [...newItemsRefCurrent];
          newItems[index] = { ...newItems[index], photos: updatedPhotos };
          updateItems(newItems);
        }
      };
      reader.readAsDataURL(file);
    });

    // Reset input
    e.target.value = '';
  };

  // Keep a ref to latest items for async reader callbacks
  const newItemsRefCurrent = items;

  const handleRemovePhoto = (noteIndex: number, photoIndex: number) => {
    const newItems = [...items];
    const currentPhotos = [...(newItems[noteIndex].photos || [])];
    currentPhotos.splice(photoIndex, 1);
    newItems[noteIndex] = { ...newItems[noteIndex], photos: currentPhotos };
    updateItems(newItems);
    if (previewPhoto?.url === items[noteIndex]?.photos?.[photoIndex]) {
      setPreviewPhoto(null);
    }
  };

  const handleSaveAndSubmit = () => {
    const validItems = items.filter(it => (it.text && it.text.trim()) || (it.photos && it.photos.length > 0));
    const summary = formatItemsToNotesString(validItems);
    if (onSave) {
      onSave(validItems, summary);
    }
    if (onClose) {
      onClose();
    }
  };

  const totalPhotosCount = items.reduce((sum, item) => sum + (item.photos?.length || 0), 0);
  const totalNotesCount = items.filter(it => it.text && it.text.trim()).length;

  const content = (
    <div className="space-y-4 text-right" dir="rtl">
      {/* Elementization Status Banner */}
      <div className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-l from-red-50 via-rose-50/70 to-amber-50 border border-red-200">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-red-600 text-white flex items-center justify-center shadow-xs">
            <ListOrdered className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-red-950">
                عنصرة الملاحظات مع الصور التوضيحية
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-300">
                {items.length > 1 ? `${items.length} ملاحظات معنصرة` : 'ملاحظة واحدة'}
              </span>
              {totalPhotosCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                  <Camera className="w-3 h-3 text-amber-700" />
                  <span>{totalPhotosCount} صور مرفقة</span>
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-600 mt-0.5 font-medium">
              عند تعدد الملاحظات يتم عنصرتها تلقائياً وترقيمها مع إمكانية إرفاق صورة توضيحية أو أكثر لكل ملاحظة
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleAddNote}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black shadow-xs transition-all cursor-pointer active:scale-95 shrink-0"
          title="إضافة ملاحظة جديدة لامر العمل"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>إضافة ملاحظة</span>
        </button>
      </div>

      {/* Note Items List (Elementized with Individual Photos & Text) */}
      <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1 pl-1 scrollbar-thin">
        {items.map((item, index) => {
          const noteNumber = index + 1;
          const hasPhotos = item.photos && item.photos.length > 0;

          return (
            <div
              key={item.id || index}
              className="p-3.5 rounded-2xl bg-white border-2 border-red-200 hover:border-red-400 transition-all shadow-xs space-y-3 relative group"
            >
              {/* Item Header: Number Badge, Photos Count, Actions */}
              <div className="flex items-center justify-between pb-2 border-b border-red-100">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-red-700 text-white text-xs font-black flex items-center justify-center font-mono shadow-2xs">
                    {noteNumber}
                  </span>
                  <span className="text-xs font-black text-red-900">
                    ملاحظة رقم {noteNumber}
                  </span>
                  {hasPhotos && (
                    <span className="text-[10.5px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 flex items-center gap-1">
                      <Camera className="w-3 h-3 text-amber-600" />
                      <span>{item.photos!.length} صور توضيحية</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  {/* Photo Upload Trigger Button for this specific note */}
                  <label 
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold cursor-pointer transition-colors shadow-2xs"
                    title={`إضافة صورة توضيحية توضح ملاحظة ${noteNumber}`}
                  >
                    <Upload className="w-3.5 h-3.5 text-amber-700" />
                    <span>إرفاق صورة للملاحظة</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => handlePhotoUpload(index, e)}
                      className="hidden"
                    />
                  </label>

                  {/* Delete note button */}
                  <button
                    type="button"
                    onClick={() => handleRemoveNote(index)}
                    className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                    title={`حذف ملاحظة ${noteNumber}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Note Textarea */}
              <div>
                <textarea
                  value={item.text}
                  onChange={(e) => handleTextChange(index, e.target.value)}
                  placeholder={`اكتب تفاصيل الملاحظة الفنية رقم ${noteNumber} هنا (مثال: بحاجة إلى إعادة تركيب الوصلة، تعديل الحفر، إلخ)...`}
                  rows={2}
                  className="w-full text-xs font-medium text-slate-900 bg-red-50/30 p-2.5 rounded-xl border border-red-200 focus:outline-hidden focus:border-red-500 focus:ring-2 focus:ring-red-500/20 leading-relaxed placeholder:text-slate-400"
                />
              </div>

              {/* Photos Gallery for this note */}
              {hasPhotos && (
                <div className="pt-2 border-t border-slate-100">
                  <div className="text-[11px] font-bold text-slate-600 mb-1.5 flex items-center gap-1">
                    <ImageIcon className="w-3.5 h-3.5 text-amber-600" />
                    <span>الصور المرفقة التي توضح هذه الملاحظة ({item.photos!.length}):</span>
                  </div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    {item.photos!.map((photoUrl, pIdx) => (
                      <div
                        key={pIdx}
                        className="relative group/ph rounded-xl overflow-hidden border-2 border-amber-300 bg-slate-900 shadow-xs shrink-0 w-20 h-20"
                      >
                        <img
                          src={photoUrl}
                          alt={`ملاحظة ${noteNumber} صورة ${pIdx + 1}`}
                          className="w-full h-full object-cover transition-transform group-hover/ph:scale-105 cursor-pointer"
                          onClick={() => setPreviewPhoto({
                            url: photoUrl,
                            noteIndex: index,
                            title: `صورة توضيحية لملاحظة ${noteNumber} (صورة ${pIdx + 1})`
                          })}
                        />

                        {/* Hover Overlay with Zoom and Delete */}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/ph:opacity-100 transition-opacity flex items-center justify-center gap-1.5 p-1">
                          <button
                            type="button"
                            onClick={() => setPreviewPhoto({
                              url: photoUrl,
                              noteIndex: index,
                              title: `صورة توضيحية لملاحظة ${noteNumber} (صورة ${pIdx + 1})`
                            })}
                            className="p-1 rounded-md bg-white/80 hover:bg-white text-slate-900 cursor-pointer shadow-xs"
                            title="تكبير الصورة"
                          >
                            <ZoomIn className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemovePhoto(index, pIdx)}
                            className="p-1 rounded-md bg-rose-600 hover:bg-rose-700 text-white cursor-pointer shadow-xs"
                            title="حذف هذه الصورة"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <span className="absolute bottom-1 right-1 text-[9px] font-mono font-bold bg-black/70 text-white px-1 rounded">
                          {pIdx + 1}
                        </span>
                      </div>
                    ))}

                    {/* Add More Photos Box */}
                    <label 
                      className="w-20 h-20 rounded-xl border-2 border-dashed border-amber-300 hover:border-amber-500 hover:bg-amber-50/50 flex flex-col items-center justify-center gap-1 text-amber-800 cursor-pointer transition-colors shrink-0"
                      title="إضافة صورة أخرى لهذه الملاحظة"
                    >
                      <Plus className="w-4 h-4" />
                      <span className="text-[10px] font-bold">صورة أخرى</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) => handlePhotoUpload(index, e)}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Action Strip: Add Another Note Button */}
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={handleAddNote}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold border border-slate-300 transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4 text-red-600" />
          <span>+ إضافة ملاحظة إضافية لأمر العمل (عنصرة جديدة)</span>
        </button>

        <span className="text-[11px] font-bold text-slate-500">
          إجمالي: {totalNotesCount} ملاحظات مسجلة
        </span>
      </div>

      {/* Save & Cancel Footer Buttons (if onSave provided) */}
      {onSave && (
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
            >
              إلغاء
            </button>
          )}
          <button
            type="button"
            onClick={handleSaveAndSubmit}
            className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-xs font-black shadow-md transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            <span>حفظ الملاحظات والصور المعنصرة</span>
          </button>
        </div>
      )}

      {/* High-Resolution Photo Lightbox Preview Modal */}
      {previewPhoto && (
        <div 
          className="fixed inset-0 z-[9999999] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 text-right animate-in fade-in duration-150"
          onClick={() => setPreviewPhoto(null)}
        >
          <div 
            className="bg-slate-900 border border-slate-700 rounded-2xl max-w-3xl w-full overflow-hidden shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3 bg-slate-950 text-white flex items-center justify-between border-b border-slate-800">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-2">
                <Camera className="w-4 h-4 text-amber-400" />
                <span>{previewPhoto.title}</span>
              </span>
              <button
                type="button"
                onClick={() => setPreviewPhoto(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 flex items-center justify-center bg-black/50 max-h-[75vh] overflow-hidden">
              <img
                src={previewPhoto.url}
                alt={previewPhoto.title}
                className="max-h-[70vh] w-auto max-w-full object-contain rounded-lg shadow-lg"
              />
            </div>
            <div className="p-3 bg-slate-950 flex items-center justify-between text-xs text-slate-400">
              <span>صورة توضيحية مرتبطة بعنصر الملاحظة الفنية</span>
              <button
                type="button"
                onClick={() => setPreviewPhoto(null)}
                className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (isStandaloneModal) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full my-6 overflow-hidden flex flex-col text-right">
          <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-600 flex items-center justify-center text-white shadow-xs">
                <ListOrdered className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black">
                  إدارة وعنصرة ملاحظات الجودة والصور
                </h3>
                <p className="text-xs text-slate-300">
                  {order ? `أمر العمل: ${order.workOrderNumber} (${order.office} - ${order.contractor})` : 'إرفاق ملاحظات متعددة مع صور توضيحية'}
                </p>
              </div>
            </div>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
          <div className="p-6">
            {content}
          </div>
        </div>
      </div>
    );
  }

  return content;
};
