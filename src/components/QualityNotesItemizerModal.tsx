import React, { useState, useRef } from 'react';
import { 
  X, 
  Check, 
  Plus, 
  Trash2, 
  Camera, 
  Image as ImageIcon, 
  Upload, 
  AlertCircle, 
  Sparkles, 
  Eye, 
  Clock, 
  FileText,
  Copy,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { WorkOrder, QualityNoteItem, PhotoItem } from '../types';
import { soundService } from '../services/soundService';
import { getSavedCurrentUser } from '../utils/security';

interface QualityNotesItemizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: WorkOrder | null;
  onSave: (updatedOrder: WorkOrder) => void;
  onCheckPermission?: (permKey: string, actionLabel: string) => boolean;
}

const COMMON_PRESET_NOTES = [
  'هبوط في طبقة الأساس ومعلق استكمال فحص الدمك الميكانيكي واختبار المختبر المعتمد.',
  'ملاحظة على نظافة الموقع وإزالة مخلفات الحفر ونواتج الأعمال المدنية.',
  'بانتظار استكمال شهادة اختبار المختبر لطبقة الأساس ونماذج الاستشاري.',
  'عدم استيفاء نماذج إجازة الاستشاري للاستلام النهائي.',
  'نواقص في التوثيق الفوتوغرافي لجميع مراحل التمديد والحفر.',
  'الأعمال مطابقة تماماً للمواصفات الفنية المعتمدة ومستوفية لاشتراطات إجراء 155.'
];

export const QualityNotesItemizerModal: React.FC<QualityNotesItemizerModalProps> = ({
  isOpen,
  onClose,
  order,
  onSave,
  onCheckPermission
}) => {
  // Initialize items from order.qualityNoteItems or parse from order.qualityNotes / order.executionNotes
  const parseInitialItems = (): QualityNoteItem[] => {
    if (!order) return [];
    if (Array.isArray(order.qualityNoteItems) && order.qualityNoteItems.length > 0) {
      return order.qualityNoteItems.map(item => ({
        ...item,
        id: item.id || `note-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        text: item.text || '',
        photos: Array.isArray(item.photos) ? [...item.photos] : [],
        editHistory: Array.isArray(item.editHistory) ? [...item.editHistory] : []
      }));
    }

    const raw = (order.qualityNotes || order.executionNotes || '').trim();
    if (!raw || raw === '-') {
      return [
        {
          id: `note-${Date.now()}-1`,
          text: '',
          photos: [],
          editHistory: []
        }
      ];
    }

    // Attempt to split bulleted or numbered lines (e.g. 1. note, 2. note or - note)
    const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const parsed: QualityNoteItem[] = [];

    lines.forEach((line, idx) => {
      const cleanText = line.replace(/^\d+[\.\-\)]\s*/, '').replace(/^[\-\•\*]\s*/, '').trim();
      if (cleanText) {
        parsed.push({
          id: `note-${Date.now()}-${idx + 1}`,
          text: cleanText,
          photos: idx === 0 && order.photos && order.photos.length > 0 
            ? order.photos.map(p => p.url).filter(Boolean) 
            : [],
          editHistory: []
        });
      }
    });

    if (parsed.length > 0) return parsed;

    return [
      {
        id: `note-${Date.now()}-1`,
        text: raw,
        photos: order.photos && order.photos.length > 0 ? order.photos.map(p => p.url).filter(Boolean) : [],
        editHistory: []
      }
    ];
  };

  const [items, setItems] = useState<QualityNoteItem[]>(parseInitialItems);
  const [activePhotoPreview, setActivePhotoPreview] = useState<{ url: string; title: string } | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  const handleAddItem = () => {
    const newItem: QualityNoteItem = {
      id: `note-${Date.now()}-${items.length + 1}`,
      text: '',
      photos: [],
      editHistory: []
    };
    setItems(prev => [...prev, newItem]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      setItems([{ id: `note-${Date.now()}-1`, text: '', photos: [], editHistory: [] }]);
      return;
    }
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateItemText = (index: number, text: string) => {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, text } : item));
  };

  // Convert uploaded image file to high-efficiency Base64 Data URL
  const handlePhotoUpload = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file: File) => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        const base64Url = loadEvent.target?.result as string;
        if (base64Url) {
          setItems(prev => prev.map((item, i) => {
            if (i === index) {
              const currentPhotos = item.photos || [];
              return { ...item, photos: [...currentPhotos, base64Url] };
            }
            return item;
          }));
        }
      };
      reader.readAsDataURL(file);
    });

    // Reset input
    if (e.target) e.target.value = '';
  };

  const handleRemovePhoto = (itemIndex: number, photoIndex: number) => {
    setItems(prev => prev.map((item, i) => {
      if (i === itemIndex) {
        const nextPhotos = (item.photos || []).filter((_, pIdx) => pIdx !== photoIndex);
        return { ...item, photos: nextPhotos };
      }
      return item;
    }));
  };

  const handleApplyPreset = (index: number, presetText: string) => {
    handleUpdateItemText(index, presetText);
  };

  const handleCopyNote = (text: string, index: number) => {
    if (!text) return;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
    setCopiedIdx(index);
    setTimeout(() => setCopiedIdx(null), 1800);
  };

  const handleSaveAll = () => {
    // Quality notes and attached photos are part of universal general permission (الصلاحية العامة)
    const filteredItems = items
      .map(item => ({
        ...item,
        text: item.text.trim(),
        photos: item.photos?.filter(Boolean) || []
      }))
      .filter(item => item.text !== '' || item.photos.length > 0);

    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const ampm = hours >= 12 ? 'م' : 'ص';
    hours = hours % 12 || 12;
    const formattedSyncTime = `${yyyy}/${mm}/${dd} ${String(hours).padStart(2, '0')}:${minutes}:${seconds} ${ampm}`;

    // Construct unified textual notes (bulletized if more than one item)
    let generatedNotesText = '';
    if (filteredItems.length === 0) {
      generatedNotesText = '';
    } else if (filteredItems.length === 1) {
      generatedNotesText = filteredItems[0].text;
    } else {
      // Elementize / Number multiple notes: 1. ... \n 2. ...
      generatedNotesText = filteredItems
        .map((item, i) => `${i + 1}. ${item.text}`)
        .join('\n');
    }

    // Merge note photos into order.photos for global gallery sync
    const existingPhotos: PhotoItem[] = Array.isArray(order.photos) ? [...order.photos] : [];
    const existingUrls = new Set(existingPhotos.map(p => p.url));

    filteredItems.forEach((item, itemIdx) => {
      (item.photos || []).forEach((photoUrl, pIdx) => {
        if (!existingUrls.has(photoUrl)) {
          existingPhotos.push({
            id: `photo-note-${Date.now()}-${itemIdx}-${pIdx}`,
            url: photoUrl,
            caption: `ملاحظة ${itemIdx + 1}: ${item.text || 'صورة توضيحية للملاحظة'}`,
            stage: 'فحص الجودة',
            timestamp: now.toISOString().slice(0, 16).replace('T', ' ')
          });
          existingUrls.add(photoUrl);
        }
      });
    });

    const user = getSavedCurrentUser();
    const userEmail = (user?.email || user?.username || '').trim();
    const userName = (user?.displayName || user?.username || 'مستخدم معتمد').trim();

    const updatedOrder: WorkOrder = {
      ...order,
      qualityNoteItems: filteredItems,
      qualityNotes: generatedNotesText,
      executionNotes: generatedNotesText,
      photos: existingPhotos,
      statusSyncTime: formattedSyncTime,
      statusSyncEmail: userEmail,
      statusSyncUser: userName,
      lastUpdatedBy: userEmail || userName,
      isEdited: true,
      lastEditedAt: now.toISOString(),
      updatedAt: now.toISOString()
    };

    onSave(updatedOrder);
    soundService.playActionSound('update');
    onClose();
  };

  if (!isOpen || !order) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 text-right animate-in fade-in duration-150">
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full my-4 overflow-hidden flex flex-col max-h-[92vh]">
          
          {/* Header */}
          <div className="bg-gradient-to-r from-[#002244] via-[#003366] to-[#004080] text-white px-5 py-3.5 flex items-center justify-between border-b-2 border-orange-500 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-orange-500/20 border border-orange-400/50 flex items-center justify-center text-white shadow-xs">
                <AlertCircle className="w-5 h-5 text-orange-300" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <span>توثيق وعنصرة ملاحظات الجودة وسجل التعديلات</span>
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-extrabold select-all">
                    {order.workOrderNumber}
                  </span>
                </h2>
                <p className="text-[11px] text-blue-100 font-medium">
                  {order.office} • المقاول: {order.contractor}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-blue-200 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Banner Description */}
          <div className="bg-slate-50 border-b border-slate-200 px-5 py-2.5 flex items-center justify-between text-xs text-slate-800 shrink-0">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-orange-600 shrink-0" />
              <span>
                <strong>توثيق ملاحظات الجودة:</strong> يتم تسجيل هوية كاتب الملاحظة وبريده الإلكتروني وتوقيت الإنشاء (Asia/Riyadh) وسجل التعديلات تلقائياً من الجلسة المصدقة.
              </span>
            </div>
            <span className="text-[11px] font-black bg-[#003366] text-white px-2.5 py-0.5 rounded-full shrink-0 mr-2">
              {items.length} {items.length === 1 ? 'ملاحظة' : 'ملاحظات'}
            </span>
          </div>

          {/* Scrollable Content Body */}
          <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
            {items.map((item, idx) => (
              <div 
                key={item.id || idx}
                className="bg-white rounded-2xl border-2 border-slate-200 shadow-xs hover:border-[#003366]/50 transition-all p-3.5 sm:p-4 space-y-3"
              >
                {/* Item Header + Verified Author Identity & Timestamp */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-[#003366] text-white flex items-center justify-center font-black text-xs font-mono shadow-xs">
                      {idx + 1}
                    </span>
                    <strong className="text-xs font-black text-slate-900">
                      الملاحظة رقم ({idx + 1})
                    </strong>
                    <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                      ID: {item.id}
                    </span>
                    {item.photos && item.photos.length > 0 && (
                      <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <ImageIcon className="w-3 h-3 text-emerald-700" />
                        <span>{item.photos.length} صور مرفقة</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {item.text && (
                      <button
                        type="button"
                        onClick={() => handleCopyNote(item.text, idx)}
                        className="px-2 py-1 rounded-lg text-[10px] font-bold text-[#003366] hover:bg-blue-50 border border-blue-200 transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" />
                        <span>{copiedIdx === idx ? 'تم النسخ' : 'نسخ'}</span>
                      </button>
                    )}

                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="p-1 rounded-lg text-rose-600 hover:text-white hover:bg-rose-600 border border-rose-200 transition-colors cursor-pointer"
                        title="حذف هذه الملاحظة"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Author & Creation Metadata Bar (Section 8) */}
                {(item.authorEmail || item.authorName || item.author || item.createdAtRiyadh || item.createdAt) && (
                  <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-blue-50/70 border border-blue-200/80 text-[11px]">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-extrabold text-[#003366]">كاتب الملاحظة:</span>
                      <span className="font-bold text-slate-900">{item.authorName || item.author || 'مستخدم معتمد'}</span>
                      {item.authorEmail && (
                        <span className="font-mono text-blue-800 bg-white px-1.5 py-0.5 rounded border border-blue-200">
                          {item.authorEmail}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 font-mono text-slate-600">
                      <Clock className="w-3 h-3 text-orange-600" />
                      <span>الإنشاء: {item.createdAtRiyadh || item.createdAt}</span>
                    </div>
                  </div>
                )}

                {/* Edit History Log (Section 8.2) */}
                {Array.isArray(item.editHistory) && item.editHistory.length > 0 && (
                  <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200 text-[11px] space-y-1">
                    <div className="font-extrabold text-amber-900">
                      سجل التعديلات ({item.editHistory.length}):
                    </div>
                    <div className="max-h-24 overflow-y-auto space-y-1">
                      {item.editHistory.map((eh) => (
                        <div key={eh.id} className="flex flex-wrap items-center justify-between gap-1.5 bg-white px-2 py-1 rounded border border-amber-200/80">
                          <span className="font-bold text-slate-800">
                            عدّلها: {eh.editorName} (<span className="font-mono text-blue-700">{eh.editorEmail}</span>)
                          </span>
                          <span className="font-mono text-slate-500">{eh.editedAtRiyadh}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Text Area */}
                <div>
                  <textarea
                    rows={2}
                    value={item.text}
                    onChange={(e) => handleUpdateItemText(idx, e.target.value)}
                    placeholder={`اكتب هنا تفاصيل الملاحظة رقم (${idx + 1}) بوضوح ودقة...`}
                    className="w-full text-xs sm:text-[13px] font-bold text-slate-900 p-2.5 rounded-xl border border-slate-300 bg-slate-50/50 focus:bg-white focus:outline-hidden focus:border-[#003366] focus:ring-2 focus:ring-[#003366]/20 leading-relaxed placeholder:text-slate-400 placeholder:font-normal"
                  />
                </div>

                {/* Quick Presets for this note */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-500" />
                    <span>نماذج سريعة:</span>
                  </span>
                  {COMMON_PRESET_NOTES.slice(0, 3).map((preset, pIdx) => (
                    <button
                      key={pIdx}
                      type="button"
                      onClick={() => handleApplyPreset(idx, preset)}
                      className="text-[10px] font-medium bg-slate-100 hover:bg-red-100 text-slate-700 hover:text-red-900 border border-slate-200 rounded-lg px-2 py-0.5 transition-colors cursor-pointer truncate max-w-[220px]"
                      title={preset}
                    >
                      {preset}
                    </button>
                  ))}
                </div>

                {/* Photos Attached to this Note */}
                <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200/90 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Camera className="w-3.5 h-3.5 text-blue-600" />
                      <span>الصور التوضيحية للملاحظة ({idx + 1}):</span>
                    </span>

                    {/* Photo Upload Trigger Button */}
                    <div>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        ref={el => { fileInputRefs.current[item.id] = el; }}
                        onChange={(e) => handlePhotoUpload(idx, e)}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRefs.current[item.id]?.click()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-black shadow-xs transition-all cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>إضافة صورة للملاحظة</span>
                      </button>
                    </div>
                  </div>

                  {/* Thumbnail gallery for this specific note */}
                  {item.photos && item.photos.length > 0 ? (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 pt-1">
                      {item.photos.map((photoUrl, pIdx) => (
                        <div 
                          key={pIdx}
                          className="relative group rounded-xl overflow-hidden border-2 border-slate-300 bg-white shadow-2xs aspect-square"
                        >
                          <img 
                            src={photoUrl} 
                            alt={`صورة ملاحظة ${idx + 1} - ${pIdx + 1}`}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform cursor-pointer"
                            onClick={() => setActivePhotoPreview({ 
                              url: photoUrl, 
                              title: `ملاحظة ${idx + 1}: ${item.text || 'صورة توضيحية'}` 
                            })}
                          />

                          {/* Quick Action Overlay */}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setActivePhotoPreview({ 
                                url: photoUrl, 
                                title: `ملاحظة ${idx + 1}: ${item.text || 'صورة توضيحية'}` 
                              })}
                              className="p-1 rounded-md bg-white/90 text-slate-900 hover:bg-white shadow-xs"
                              title="تكبير الصورة"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemovePhoto(idx, pIdx)}
                              className="p-1 rounded-md bg-rose-600 text-white hover:bg-rose-700 shadow-xs"
                              title="حذف هذه الصورة"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <span className="absolute bottom-1 right-1 bg-black/70 text-white text-[9px] font-mono font-bold px-1 rounded">
                            #{pIdx + 1}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div 
                      onClick={() => fileInputRefs.current[item.id]?.click()}
                      className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl p-3 text-center cursor-pointer transition-colors bg-white hover:bg-blue-50/50"
                    >
                      <ImageIcon className="w-5 h-5 text-slate-400 mx-auto mb-1" />
                      <p className="text-[11px] font-bold text-slate-600">
                        لم يتم إرفاق صور لهذه الملاحظة بعد (انقر هنا لرفع صورة من جهازك)
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Button to Add More Notes */}
            <div className="pt-1">
              <button
                type="button"
                onClick={handleAddItem}
                className="w-full py-2.5 px-4 rounded-xl border-2 border-dashed border-red-400 hover:border-red-600 bg-red-50/50 hover:bg-red-100 text-red-900 font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>+ إضافة ملاحظة أخرى لأمر العمل الحالي (عنصرة الملاحظات)</span>
              </button>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="bg-slate-50 px-5 py-3.5 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
            <div className="text-[11px] text-slate-600 font-medium hidden sm:block">
              سيتم حفظ جميع الملاحظات والصور وتوثيقها فوراً في قاعدة البيانات السحابية
            </div>

            <div className="flex items-center gap-2 mr-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                إلغاء
              </button>

              <button
                type="button"
                onClick={handleSaveAll}
                className="inline-flex items-center gap-1.5 px-6 py-2 rounded-xl bg-gradient-to-r from-red-700 to-rose-700 hover:from-red-800 hover:to-rose-800 text-white text-xs sm:text-sm font-black shadow-md transition-all cursor-pointer active:scale-95"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>حفظ الملاحظات والصور ومزامنة السجل</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox / High-Res Image Preview Modal */}
      {activePhotoPreview && (
        <div 
          className="fixed inset-0 z-60 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setActivePhotoPreview(null)}
        >
          <div 
            className="relative max-w-4xl max-h-[90vh] bg-slate-900 rounded-2xl overflow-hidden border border-slate-700 text-right flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3 bg-slate-950 text-white flex items-center justify-between border-b border-slate-800">
              <span className="text-xs font-bold text-amber-300 truncate max-w-[80vw]">
                {activePhotoPreview.title}
              </span>
              <button
                type="button"
                onClick={() => setActivePhotoPreview(null)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-2 flex items-center justify-center bg-black/40 overflow-auto">
              <img
                src={activePhotoPreview.url}
                alt={activePhotoPreview.title}
                className="max-h-[75vh] w-auto max-w-full object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};
