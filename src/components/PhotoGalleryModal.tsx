import React, { useState } from 'react';
import { X, Camera, Calendar, Tag, Trash2, Plus, Download, ZoomIn } from 'lucide-react';
import { WorkOrder, PhotoItem } from '../types';

interface PhotoGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: WorkOrder | null;
  onUpdatePhotos: (orderId: string, photos: PhotoItem[]) => void;
  initialPhotoUrl?: string;
}

export const PhotoGalleryModal: React.FC<PhotoGalleryModalProps> = ({
  isOpen,
  onClose,
  order,
  onUpdatePhotos,
  initialPhotoUrl
}) => {
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoItem | null>(null);
  const [newCaption, setNewCaption] = useState('');
  const [newStage, setNewStage] = useState<'قبل البدء' | 'أثناء التنفيذ' | 'بعد الانتهاء' | 'فحص الجودة'>('أثناء التنفيذ');
  const [photoIdPendingDelete, setPhotoIdPendingDelete] = useState<string | null>(null);

  // Aggregate all photos from order.photos and note items
  const allPhotos: PhotoItem[] = React.useMemo(() => {
    if (!order) return [];
    const list: PhotoItem[] = Array.isArray(order.photos) ? [...order.photos] : [];
    const seenUrls = new Set<string>(list.map(p => p.url));

    if (Array.isArray(order.qualityNoteItems)) {
      order.qualityNoteItems.forEach((item, idx) => {
        if (Array.isArray(item.photos)) {
          item.photos.forEach((url, pIdx) => {
            if (url && !seenUrls.has(url)) {
              seenUrls.add(url);
              list.push({
                id: `note-photo-${item.id || idx}-${pIdx}`,
                url,
                caption: item.text ? `ملاحظة: ${item.text}` : `صورة الملاحظة رقم (${idx + 1})`,
                stage: 'فحص الجودة',
                timestamp: order.updatedAt || new Date().toISOString().replace('T', ' ').substring(0, 16)
              });
            }
          });
        }
      });
    }
    return list;
  }, [order]);

  React.useEffect(() => {
    if (initialPhotoUrl && allPhotos.length > 0) {
      const match = allPhotos.find(p => p.url === initialPhotoUrl);
      if (match) setSelectedPhoto(match);
    }
  }, [initialPhotoUrl, allPhotos]);

  if (!isOpen || !order) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result) {
        const newPhoto: PhotoItem = {
          id: `p-${Date.now()}`,
          url: reader.result as string,
          caption: newCaption.trim() || file.name,
          stage: newStage,
          timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16)
        };
        const updated = [...(order.photos || []), newPhoto];
        onUpdatePhotos(order.id, updated);
        setNewCaption('');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDeletePhoto = (photoId: string) => {
    setPhotoIdPendingDelete(photoId);
  };

  const confirmDeletePhoto = () => {
    if (!photoIdPendingDelete) return;
    const updated = (order.photos || []).filter(p => p.id !== photoIdPendingDelete);
    onUpdatePhotos(order.id, updated);
    if (selectedPhoto?.id === photoIdPendingDelete) {
      setSelectedPhoto(null);
    }
    setPhotoIdPendingDelete(null);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full my-6 overflow-hidden flex flex-col text-right">
        
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold">
                  سجل توثيق الصور الميدانية
                </h2>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-blue-900 text-blue-200">
                  {order.workOrderNumber}
                </span>
              </div>
              <p className="text-xs text-slate-300">
                توثيق مراحل التنفيذ كاملة بدقة عالية كشرط أساسي لإتمام إجراء 155
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(85vh-140px)] space-y-5">
          {photoIdPendingDelete && (
            <div className="p-4 rounded-xl bg-rose-50 border-2 border-rose-300 flex flex-wrap items-center justify-between gap-3 animate-in fade-in">
              <div className="text-xs text-rose-900">
                <p className="font-black text-rose-800 text-sm">
                  هذا الإجراء نهائي ولا يمكن التراجع عنه بعد التنفيذ.
                </p>
                <p className="font-semibold mt-0.5">
                  هل أنت متأكد من حذف الصورة الميدانية المحددة نهائياً من السجل؟
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={confirmDeletePhoto}
                  className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-black cursor-pointer"
                >
                  تأكيد حذف المرفق نهائياً
                </button>
                <button
                  type="button"
                  onClick={() => setPhotoIdPendingDelete(null)}
                  className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs font-bold cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </div>
          )}

          {/* Add New Photo Strip */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <h4 className="text-xs font-bold text-slate-800 mb-2">إرفاق صورة توثيق ميدانية جديدة</h4>
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer transition-colors shadow-2xs">
                <Plus className="w-3.5 h-3.5" />
                <span>رفع صورة من الجهاز</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              <select
                value={newStage}
                onChange={(e: any) => setNewStage(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs text-slate-800"
              >
                <option value="قبل البدء">مرحلة: قبل البدء</option>
                <option value="أثناء التنفيذ">مرحلة: أثناء التنفيذ</option>
                <option value="فحص الجودة">مرحلة: فحص الجودة</option>
                <option value="بعد الانتهاء">مرحلة: بعد الانتهاء</option>
              </select>

              <input
                type="text"
                placeholder="بيان تفصيلي لما توثقه الصورة..."
                value={newCaption}
                onChange={(e) => setNewCaption(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs flex-1 min-w-[200px]"
              />
            </div>
          </div>

          {/* Large Photo Preview if selected */}
          {selectedPhoto && (
            <div className="p-4 rounded-xl bg-slate-900 text-white space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2 py-0.5 rounded bg-blue-600 text-white font-medium">
                    {selectedPhoto.stage}
                  </span>
                  <span className="text-slate-400">{selectedPhoto.timestamp}</span>
                </div>
                <button
                  onClick={() => setSelectedPhoto(null)}
                  className="text-slate-400 hover:text-white text-xs"
                >
                  إغلاق التكبير
                </button>
              </div>
              <div className="max-h-96 overflow-hidden rounded-lg flex items-center justify-center bg-black/40">
                <img
                  src={selectedPhoto.url}
                  alt={selectedPhoto.caption}
                  className="max-h-96 w-auto object-contain rounded-lg"
                />
              </div>
              <p className="text-xs text-slate-200 text-center font-medium">
                {selectedPhoto.caption}
              </p>
            </div>
          )}

          {/* Photo Grid */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900">
                الصور المرفقة والميدانية والملاحظات ({allPhotos.length})
              </h3>
              <span className="text-xs text-slate-500">
                اضغط على أي صورة لتكبيرها وفحص تفاصيلها الميدانية
              </span>
            </div>

            {allPhotos.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-xl">
                <Camera className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-500">لا توجد صور توثيق أو صور ملاحظات مرفقة لأمر العمل هذا بعد</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {allPhotos.map((p) => (
                  <div
                    key={p.id}
                    className="group rounded-xl border border-slate-200 overflow-hidden bg-white shadow-2xs hover:shadow-md transition-all flex flex-col"
                  >
                    <div 
                      className="relative h-44 cursor-pointer overflow-hidden bg-slate-100"
                      onClick={() => setSelectedPhoto(p)}
                    >
                      <img
                        src={p.url}
                        alt={p.caption}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-slate-900/20 group-hover:bg-slate-900/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <ZoomIn className="w-6 h-6 text-white drop-shadow-md" />
                      </div>
                      <span className="absolute top-2 right-2 bg-slate-900/80 backdrop-blur-xs text-white text-[10px] px-2 py-0.5 rounded-full font-medium">
                        {p.stage}
                      </span>
                    </div>

                    <div className="p-3 flex-1 flex flex-col justify-between">
                      <p className="text-xs font-semibold text-slate-800 line-clamp-2 mb-2">
                        {p.caption || 'صورة توثيق'}
                      </p>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-2 border-t border-slate-100">
                        <span>{p.timestamp}</span>
                        {order.photos?.some(op => op.id === p.id) && (
                          <button
                            onClick={() => handleDeletePhoto(p.id)}
                            className="text-rose-600 hover:text-rose-700 p-1 hover:bg-rose-50 rounded"
                            title="حذف الصورة"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold transition-colors"
          >
            إغلاق نافذة الصور
          </button>
        </div>

      </div>
    </div>
  );
};
