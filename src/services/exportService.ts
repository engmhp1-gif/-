import { WorkOrder, ColumnDefinition } from '../types';
import { getAuthHeaders } from '../utils/security';
import { ensurePhotosFileColumn } from '../data/initialData';
import {
  calculateOverallAuditColumnSummary,
  calculateAggregate18ChecklistsCompliance,
  formatOrderAudit18SummaryText,
  AUDIT_CATEGORIES_META
} from '../data/auditChecklistData';
import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import pptxgen from 'pptxgenjs';
import { toPng, toJpeg } from 'html-to-image';
import html2canvas from 'html2canvas';

export interface ExportPdfOptions {
  orientation?: 'landscape' | 'portrait';
  format?: 'a4' | 'a3';
  marginMm?: number;
}

export interface CapturedImageResult {
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * Internal helper that captures an HTML element at its true, unscaled dimensions
 * while temporarily stripping CSS transforms and hiding interactive .no-print UI controls.
 */
export async function captureElementWithDimensions(
  element: HTMLElement,
  format: 'png' | 'jpeg' = 'png'
): Promise<CapturedImageResult> {
  try {
    if (document.fonts) {
      await document.fonts.ready;
    }
  } catch (_) {}

  // Ensure all images inside element are loaded
  const imgs = Array.from(element.querySelectorAll('img'));
  if (imgs.length > 0) {
    await Promise.all(
      imgs.map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise(res => {
          img.onload = img.onerror = () => res(null);
        });
      })
    );
  }

  const isSheet = element.classList.contains('export-page-sheet');
  const prevTransform = element.style.transform;
  const prevWidth = element.style.width;
  const prevMinWidth = element.style.minWidth;
  const prevMaxWidth = element.style.maxWidth;
  const prevMaxHeight = element.style.maxHeight;
  const prevOverflow = element.style.overflow;

  // Temporarily hide .print\:hidden and .no-print elements inside the target
  const hiddenControls = Array.from(
    element.querySelectorAll<HTMLElement>('.print\\:hidden, .no-print')
  );
  const prevDisplays = hiddenControls.map(el => el.style.display);

  try {
    element.style.transform = 'none';
    hiddenControls.forEach(el => {
      el.style.display = 'none';
    });

    if (isSheet) {
      // Detect whether sheet is portrait or landscape
      const currentW = element.offsetWidth || element.clientWidth || 1123;
      const currentH = element.offsetHeight || element.clientHeight || 794;
      const isPortraitSheet =
        currentH > currentW * 1.15 &&
        !element.className.includes('max-w-[1122px]') &&
        prevWidth !== '1123px';
      const targetW = isPortraitSheet ? 794 : 1123;
      const targetH = isPortraitSheet ? 1123 : 794;

      element.style.width = `${targetW}px`;
      element.style.minWidth = `${targetW}px`;
      element.style.maxWidth = `${targetW}px`;
      if (element.scrollHeight <= targetH + 40) {
        element.style.maxHeight = `${targetH}px`;
        element.style.overflow = 'hidden';
      }
    }

    const elWidth = Math.max(320, element.offsetWidth || element.clientWidth || 1123);
    const elHeight = Math.max(
      240,
      isSheet
        ? element.offsetHeight || element.clientHeight || 794
        : Math.max(element.scrollHeight, element.offsetHeight, element.clientHeight, 794)
    );

    const options = {
      quality: 0.98,
      backgroundColor: '#ffffff',
      pixelRatio: 2,
      cacheBust: true,
      skipFonts: false,
      width: elWidth,
      height: elHeight
    };

    try {
      const dataUrl =
        format === 'jpeg'
          ? await toJpeg(element, options)
          : await toPng(element, options);
      return { dataUrl, width: elWidth, height: elHeight };
    } catch (primaryErr) {
      console.warn('html-to-image capture failed, activating enhanced html2canvas fallback...', primaryErr);
      const canvas = await html2canvas(element, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
        allowTaint: true,
        scrollX: 0,
        scrollY: 0,
        width: elWidth,
        height: elHeight,
        windowWidth: elWidth,
        windowHeight: elHeight
      });
      const dataUrl =
        format === 'jpeg'
          ? canvas.toDataURL('image/jpeg', 0.98)
          : canvas.toDataURL('image/png');
      return { dataUrl, width: elWidth, height: elHeight };
    }
  } catch (fallbackErr) {
    console.error('All image capture methods failed:', fallbackErr);
    throw new Error('تعذر التقاط صورة المعاينة للتصدير. يرجى التحقق من محتوى الصفحة.');
  } finally {
    element.style.transform = prevTransform;
    if (isSheet) {
      element.style.width = prevWidth;
      element.style.minWidth = prevMinWidth;
      element.style.maxWidth = prevMaxWidth;
      element.style.maxHeight = prevMaxHeight;
      element.style.overflow = prevOverflow;
    }
    hiddenControls.forEach((el, idx) => {
      el.style.display = prevDisplays[idx];
    });
  }
}

/**
 * Capture an HTML element to an image data URL with automatic fallback.
 */
export async function captureElementToImage(
  element: HTMLElement,
  format: 'png' | 'jpeg' = 'png'
): Promise<string> {
  const res = await captureElementWithDimensions(element, format);
  return res.dataUrl;
}

/**
 * Export element as high-resolution PNG image
 */
export async function exportToImage(
  elementId: string, 
  filename: string = 'تقرير_أوامر_العمل_إجراء_155.png'
) {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error('العنصر المراد تصديره كصورة غير موجود في الصفحة');
  }

  const dataUrl = await captureElementToImage(element, 'png');

  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Helper to place a captured image onto one or more PDF pages with 100% aspect-ratio preservation
 * (never stretching or squashing X/Y independently).
 */
function addCapturedImageToPdf(
  pdf: jsPDF,
  captured: CapturedImageResult,
  pageIndex: number,
  format: 'a4' | 'a3',
  orientation: 'landscape' | 'portrait',
  margin: number
) {
  const isLandscape = orientation === 'landscape';
  const pageWidth = isLandscape ? (format === 'a3' ? 420 : 297) : (format === 'a3' ? 297 : 210);
  const pageHeight = isLandscape ? (format === 'a3' ? 297 : 210) : (format === 'a3' ? 420 : 297);

  const printableWidth = pageWidth - margin * 2;
  const printableHeight = pageHeight - margin * 2;

  if (pageIndex > 0) {
    pdf.addPage(format, orientation);
  }

  const imgW = Math.max(1, captured.width);
  const imgH = Math.max(1, captured.height);

  // Calculate height in mm if scaled to full printableWidth
  const scaledHeightAtFullWidth = (imgH * printableWidth) / imgW;

  // Case 1: Fits on a single page (or within 18% tolerance of a single page) -> Fit proportionally without any distortion
  if (scaledHeightAtFullWidth <= printableHeight * 1.18) {
    const scale = Math.min(printableWidth / imgW, printableHeight / imgH);
    const renderW = imgW * scale;
    const renderH = imgH * scale;
    const offsetX = margin + (printableWidth - renderW) / 2;
    const offsetY = margin + (printableHeight - renderH) / 2;

    pdf.addImage(
      captured.dataUrl,
      'JPEG',
      offsetX,
      offsetY,
      renderW,
      renderH,
      undefined,
      'FAST'
    );
    return;
  }

  // Case 2: Tall multi-page container -> Slice proportionally across pages at full width without squashing
  const safeMargin = Math.max(margin, 6);
  const slicePrintableW = pageWidth - safeMargin * 2;
  const slicePrintableH = pageHeight - safeMargin * 2;
  const totalRenderH = (imgH * slicePrintableW) / imgW;

  let heightLeft = totalRenderH;
  let currentYOffset = safeMargin;

  pdf.addImage(
    captured.dataUrl,
    'JPEG',
    safeMargin,
    currentYOffset,
    slicePrintableW,
    totalRenderH,
    undefined,
    'FAST'
  );
  heightLeft -= slicePrintableH;

  while (heightLeft > 4) {
    currentYOffset = heightLeft - totalRenderH + safeMargin;
    pdf.addPage(format, orientation);
    pdf.addImage(
      captured.dataUrl,
      'JPEG',
      safeMargin,
      currentYOffset,
      slicePrintableW,
      totalRenderH,
      undefined,
      'FAST'
    );
    heightLeft -= slicePrintableH;
  }
}

/**
 * Export one or multiple pages to PDF with exact full-bleed A4 containment and zero distortion.
 */
export async function exportToPdf(
  target: string | HTMLElement | HTMLElement[],
  _orders: WorkOrder[],
  _officeTitle: string = 'جميع المكاتب',
  filename: string = 'تقرير_أوامر_العمل_إجراء_155.pdf',
  options: ExportPdfOptions = {},
  columns?: ColumnDefinition[]
) {
  const orientation = options.orientation || 'landscape';
  const format = options.format || 'a4';
  const margin = options.marginMm ?? 0;

  let elements: HTMLElement[] = [];
  if (Array.isArray(target)) {
    elements = target.filter(Boolean);
  } else if (target instanceof HTMLElement && target.id !== 'root') {
    const sheets = target.querySelectorAll<HTMLElement>('.export-page-sheet');
    if (sheets.length > 0) {
      elements = Array.from(sheets);
    } else if (target.classList.contains('export-page-sheet')) {
      elements = [target];
    } else {
      elements = [target];
    }
  } else if (typeof target === 'string' && target !== '#root' && target !== 'root') {
    const cleanId = target.startsWith('#') ? target.slice(1) : target;
    const singleEl = document.getElementById(cleanId);
    if (singleEl) {
      const sheets = singleEl.querySelectorAll<HTMLElement>('.export-page-sheet');
      if (sheets.length > 0) {
        elements = Array.from(sheets);
      } else {
        elements = [singleEl];
      }
    } else {
      try {
        const queried = document.querySelectorAll<HTMLElement>(target);
        if (queried.length > 0) {
          const innerSheets: HTMLElement[] = [];
          queried.forEach(q => {
            if (q.classList.contains('export-page-sheet')) innerSheets.push(q);
            else q.querySelectorAll<HTMLElement>('.export-page-sheet').forEach(s => innerSheets.push(s));
          });
          elements = innerSheets.length > 0 ? innerSheets : Array.from(queried);
        }
      } catch {}
    }
  }

  let offscreenContainer: HTMLElement | null = null;
  if (elements.length === 0 && _orders && _orders.length > 0) {
    offscreenContainer = createOffscreenExportContainer(_orders, _officeTitle, columns);
    document.body.appendChild(offscreenContainer);
    await new Promise(r => setTimeout(r, 150));
    const sheets = offscreenContainer.querySelectorAll<HTMLElement>('.export-page-sheet');
    elements = sheets.length > 0 ? Array.from(sheets) : [offscreenContainer];
  }

  if (elements.length === 0) {
    if (offscreenContainer && document.body.contains(offscreenContainer)) {
      document.body.removeChild(offscreenContainer);
    }
    throw new Error('لم يتم العثور على صفحات التقرير المراد تصديرها إلى PDF');
  }

  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format,
    compress: true
  });

  try {
    for (let i = 0; i < elements.length; i++) {
      const pageEl = elements[i];
      const captured = await captureElementWithDimensions(pageEl, 'jpeg');
      addCapturedImageToPdf(pdf, captured, i, format, orientation, margin);
    }

    pdf.save(filename);
  } finally {
    if (offscreenContainer && document.body.contains(offscreenContainer)) {
      document.body.removeChild(offscreenContainer);
    }
  }
}

/**
 * Creates an offscreen DOM container with official styled A4 sheets
 * for direct export to PDF or high-resolution images.
 */
function createOffscreenExportContainer(
  orders: WorkOrder[],
  officeTitle: string = 'الجدول المفلتر',
  columns?: ColumnDefinition[]
): HTMLElement {
  const container = document.createElement('div');
  container.id = 'direct-export-offscreen-stage';
  container.style.position = 'fixed';
  container.style.top = '0';
  container.style.left = '0';
  container.style.width = '1123px';
  container.style.zIndex = '-99999';
  container.style.opacity = '0.001';
  container.style.pointerEvents = 'none';
  container.style.backgroundColor = '#ffffff';
  container.setAttribute('dir', 'rtl');

  const defaultCols: { title: string; field: string; width: string }[] = [
    { title: 'المكتب', field: 'office', width: '6%' },
    { title: 'المقاول', field: 'contractor', width: '7.5%' },
    { title: 'الاستشاري', field: 'consultant', width: '7.5%' },
    { title: 'رقم امر العمل', field: 'workOrderNumber', width: '7%' },
    { title: 'نوع امر العمل', field: 'workOrderCode', width: '5%' },
    { title: 'ملف الصور', field: 'photosFile', width: '6%' },
    { title: 'حالة الارفاق', field: 'attachmentStatus', width: '6.5%' },
    { title: 'الملاحظات', field: 'qualityNotes', width: '12%' },
    { title: 'تدقيق PDC', field: 'pdcAudit', width: '7%' },
    { title: 'تدقيق الانشاءات', field: 'constructionAudit', width: '7%' },
    { title: 'تدقيق المساندة الفنية', field: 'procedure155Status', width: '7.5%' },
    { title: 'مزامنة التدقيق', field: 'statusSyncTime', width: '7%' },
    { title: 'حالة إجراء 155', field: 'procedure155', width: '7%' },
    { title: 'مزامنة إجراء 155', field: 'procedureSyncTime', width: '6.5%' }
  ];

  const canonicalCols = ensurePhotosFileColumn(columns);
  const colsToRender = canonicalCols.map(c => ({
    title: c.title,
    field: c.field,
    width: defaultCols.find(d => d.field === c.field)?.width || '7%'
  }));

  // Adaptive Height-Budget Pagination Chunking:
  // Dynamically calculates each row's vertical weight according to note length so NO rows or notes ever get clipped or cut off!
  const chunks: WorkOrder[][] = [];
  if (orders.length === 0) {
    chunks.push([]);
  } else {
    let currentChunk: WorkOrder[] = [];
    let currentWeight = 0;
    let isFirstPage = true;

    for (let i = 0; i < orders.length; i++) {
      const wo = orders[i];
      const cleanNote = (wo.qualityNotes || wo.executionNotes || '').trim();
      const noteLen = cleanNote.length;
      // Budget weight: normal row = 1.0, medium note = 1.3, long note = 1.6
      const rowWeight = noteLen > 90 ? 1.6 : noteLen > 45 ? 1.3 : 1.0;
      const pageCapacityBudget = isFirstPage ? 5.8 : 8.2;

      if (currentWeight + rowWeight > pageCapacityBudget && currentChunk.length >= 3) {
        chunks.push(currentChunk);
        currentChunk = [wo];
        currentWeight = rowWeight;
        isFirstPage = false;
      } else {
        currentChunk.push(wo);
        currentWeight += rowWeight;
      }
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }
  }

  const totalPages = Math.max(1, chunks.length);
  const evaluatedOrders = orders.filter(w => {
    const s = String(w.procedure155Status || '').trim();
    return s !== '' && s !== 'قيد التدقيق' && s !== 'غير محدد' && s !== '-';
  });
  const readyCount = evaluatedOrders.filter(w => {
    const s = String(w.procedure155Status || '');
    return s.includes('مؤهل') && !s.includes('غير');
  }).length;
  const notReadyCount = evaluatedOrders.filter(w => {
    const s = String(w.procedure155Status || '');
    return s.includes('غير') || (!s.includes('مؤهل') && !s.includes('معتمد') && !s.includes('تم'));
  }).length;
  const complianceRate = evaluatedOrders.length > 0 ? Math.round((readyCount / evaluatedOrders.length) * 100) : 0;
  const agg18 = calculateAggregate18ChecklistsCompliance(orders);
  const actualComplianceRate = agg18.actualComplianceRate;
  const todayStr = new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(new Date());

  let cachedCustomRowColors: Record<string, string> = {};
  try {
    if (typeof window !== 'undefined') {
      const savedColors = localStorage.getItem('sec_custom_row_colors');
      if (savedColors) {
        cachedCustomRowColors = JSON.parse(savedColors) || {};
      }
    }
  } catch (_) {}

  chunks.forEach((chunk, pageIndex) => {
    const isFirstPage = pageIndex === 0;
    const targetSlots = isFirstPage ? Math.max(chunk.length, 5) : Math.max(chunk.length, 7);

    const sheet = document.createElement('div');
    sheet.className = 'export-page-sheet';
    sheet.style.width = '1123px';
    sheet.style.minWidth = '1123px';
    sheet.style.maxWidth = '1123px';
    sheet.style.height = '794px';
    sheet.style.minHeight = '794px';
    sheet.style.maxHeight = '794px';
    sheet.style.padding = '18px 24px';
    sheet.style.boxSizing = 'border-box';
    sheet.style.backgroundColor = '#ffffff';
    sheet.style.color = '#0f172a';
    sheet.style.fontFamily = "'Cairo', 'Segoe UI', Tahoma, sans-serif";
    sheet.style.display = 'flex';
    sheet.style.flexDirection = 'column';
    sheet.style.justifyContent = 'space-between';
    sheet.style.overflow = 'hidden';

    const conciseTableName = (officeTitle || 'سجل أوامر العمل')
      .replace(/تقرير شامل/g, '')
      .replace(/وجميع المكاتب الفرعية/g, '')
      .replace(/جميع المكاتب الفرعية/g, '')
      .trim() || 'سجل أوامر العمل';

    // 1. Header Block - Unified Corporate Navy & Amber Standard
    let headerHtml = `
      <div style="width: 100%; border-bottom: 2.5px solid #F58220; padding-bottom: 8px; margin-bottom: 8px;">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px; background: linear-gradient(90deg, #004B8D 0%, #002855 100%); color: #ffffff; padding: 8px 14px; border-radius: 8px;">
          <div style="text-align: right; line-height: 1.35;">
            <div style="font-size: 13px; font-weight: 900; color: #FDB813;">حوكمة جودة أعمال الإنشاءات</div>
            <div style="font-size: 11.5px; font-weight: 700; color: #ffffff;">منظومة إدارة كهرباء الحدود الشمالية</div>
            <div style="font-size: 10.5px; font-weight: 600; color: #bfdbfe;">المساندة الفنية • إجراء 155</div>
          </div>
          <div style="text-align: center; font-size: 13.5px; font-weight: 900; color: #002855; padding: 4px 16px; background: #FDB813; border-radius: 6px; border: 1px solid #F58220;">
            ${conciseTableName}
          </div>
          <div style="text-align: left; font-size: 11.5px; font-weight: 700; color: #e2e8f0; font-family: monospace;">
            التاريخ: ${todayStr}
          </div>
        </div>
    `;

    // Add KPI Block on Page 1
    if (isFirstPage) {
      headerHtml += `
        <div style="text-align: center; font-size: 11px; font-weight: 900; color: #0f172a; margin-top: 6px; margin-bottom: 3px;">
          ( مؤشرات الأداء وملخص امتثال القوائم الـ 18 - 197 بند فحص )
        </div>
        <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; text-align: center;">
          <div style="padding: 5px; border-radius: 8px; background: #f8fafc; border: 1px solid #e2e8f0;">
            <span style="font-size: 9.5px; color: #64748b; font-weight: 700; display: block;">أوامر العمل</span>
            <strong style="font-size: 13px; font-weight: 900; color: #0f172a; font-family: monospace;">${orders.length}</strong>
          </div>
          <div style="padding: 5px; border-radius: 8px; background: #ecfdf5; border: 1px solid #a7f3d0;">
            <span style="font-size: 9.5px; color: #065f46; font-weight: 700; display: block;">مؤهل للاغلاق (155)</span>
            <strong style="font-size: 13px; font-weight: 900; color: #047857; font-family: monospace;">${readyCount} (${complianceRate}%)</strong>
          </div>
          <div style="padding: 5px; border-radius: 8px; background: #fff1f2; border: 1px solid #fecdd3;">
            <span style="font-size: 9.5px; color: #9f1239; font-weight: 700; display: block;">غير مؤهل للأغلاق</span>
            <strong style="font-size: 13px; font-weight: 900; color: #be123c; font-family: monospace;">${notReadyCount}</strong>
          </div>
          <div style="padding: 5px; border-radius: 8px; background: #f0fdfa; border: 1px solid #99f6e4;">
            <span style="font-size: 9.5px; color: #115e59; font-weight: 700; display: block;">امتثال القوائم الـ 18 (PDC / الإنشاءات)</span>
            <strong style="font-size: 12px; font-weight: 900; color: #0f766e; font-family: monospace;">PDC: ${agg18.pdcComplianceRate}% | إنشاءات: ${agg18.constComplianceRate}%</strong>
          </div>
          <div style="padding: 5px; border-radius: 8px; background: #eff6ff; border: 1px solid #bfdbfe;">
            <span style="font-size: 9.5px; color: #1e40af; font-weight: 700; display: block;">نسبة المطابقة الفعلية الشاملة</span>
            <strong style="font-size: 13.5px; font-weight: 900; color: #1d4ed8; font-family: monospace;">${actualComplianceRate}%</strong>
          </div>
        </div>
      `;
    }
    headerHtml += `</div>`;

    // 2. Table Block
    let rowsHtml = '';
    if (chunk.length === 0) {
      rowsHtml = `
        <tr>
          <td colspan="${colsToRender.length + 1}" style="padding: 24px; text-align: center; color: #64748b; font-weight: 700; font-size: 12px;">
            لا توجد أوامر عمل مفلترة في هذا السجل
          </td>
        </tr>
      `;
    } else {
      let previousCapacitySum = 0;
      for (let p = 0; p < pageIndex; p++) {
        previousCapacitySum += chunks[p].length;
      }

      chunk.forEach((wo, rowIdx) => {
        const globalIdx = previousCapacitySum + rowIdx + 1;
        const isEdited = Boolean(wo.isEdited);
        const customRowColor = cachedCustomRowColors[wo.id];

        const rowBg = isEdited ? '#ffe4e6' : customRowColor || (rowIdx % 2 === 0 ? '#ffffff' : '#f8fafc');
        const numColor = isEdited ? '#991b1b' : '#1e3a8a';

        let cellsHtml = `
          <td style="padding: 5px; text-align: center; font-family: monospace; font-weight: 800; font-size: 10px; border-left: 1px solid #cbd5e1; background: ${isEdited ? '#fecdd3' : '#f1f5f9'}; color: ${isEdited ? '#991b1b' : '#0f172a'};">
            ${globalIdx}${isEdited ? ' (معدل)' : ''}
          </td>
        `;

        colsToRender.forEach((col, cIdx) => {
          const rawVal = (wo as any)[col.field];
          const val = rawVal !== undefined && rawVal !== null ? String(rawVal) : '';
          const borderStyle = cIdx < colsToRender.length - 1 ? 'border-left: 1px solid #cbd5e1;' : '';

          let cellContent = '';
          if (
            col.field === 'attachmentStatus' ||
            col.field === 'photoDocumentation' ||
            col.field === 'consultantForms' ||
            col.field === 'consultantClearanceForms' ||
            col.field === 'form190' ||
            col.field === 'form200' ||
            col.field === 'inspectionForm'
          ) {
            const displayVal = val.trim();
            if (!displayVal) {
              cellContent = `<span style="display: block; width: 100%; min-height: 16px;"></span>`;
            } else {
              let bBg = '#f1f5f9';
              let bColor = '#334155';
              let bBorder = '#cbd5e1';

              if (displayVal === 'مكتمل' || displayVal === 'جاهز للارفاق الكامل') {
                bBg = '#d1fae5'; bColor = '#065f46'; bBorder = '#6ee7b7';
              } else if (displayVal.includes('غير')) {
                bBg = '#fee2e2'; bColor = '#991b1b'; bBorder = '#fca5a5';
              } else if (displayVal.includes('ملاحظات') || displayVal.startsWith('جاهز لارفاق')) {
                bBg = '#fef3c7'; bColor = '#92400e'; bBorder = '#fcd34d';
              } else if (displayVal === 'لاينطبق') {
                bBg = '#f1f5f9'; bColor = '#64748b'; bBorder = '#cbd5e1';
              }

              cellContent = `
                <span style="display: block; width: 100%; text-align: center; padding: 2px 4px; border-radius: 4px; font-size: 9.5px; font-weight: bold; background: ${bBg}; color: ${bColor}; border: 1px solid ${bBorder}; box-sizing: border-box;">
                  ${displayVal}
                </span>
              `;
            }
          } else if (col.field === 'procedure155Status') {
            const displayVal = val.trim() === 'قيد التدقيق' || val.trim() === 'غير محدد' ? '' : val.trim();
            if (!displayVal) {
              cellContent = `<span style="display: block; width: 100%; min-height: 16px;"></span>`;
            } else {
              const isQualified = displayVal.includes('مؤهل') && !displayVal.includes('غير');
              cellContent = `
                <div style="text-align: center; line-height: 1.25;">
                  <span style="display: block; width: 100%; text-align: center; padding: 2.5px 4px; border-radius: 4px; font-size: 9.5px; font-weight: 800; background: ${isQualified ? '#047857' : '#be123c'}; color: #ffffff; box-sizing: border-box;">
                    ${displayVal}
                  </span>
                </div>
              `;
            }
          } else if (col.field === 'procedure155') {
            const displayVal = val.trim();
            if (!displayVal) {
              cellContent = `<span style="display: block; width: 100%; min-height: 16px;"></span>`;
            } else {
              const isQual = displayVal.includes('مؤهل') && !displayVal.includes('غير');
              cellContent = `
                <span style="display: block; width: 100%; text-align: center; padding: 2.5px 4px; border-radius: 4px; font-size: 9.5px; font-weight: 800; background: ${isQual ? '#047857' : displayVal.includes('غير') ? '#be123c' : '#1d4ed8'}; color: #ffffff; box-sizing: border-box;">
                  ${displayVal}
                </span>
              `;
            }
          } else if (col.field === 'statusSyncTime' || col.field === 'procedureSyncTime') {
            const isStatus = col.field === 'statusSyncTime';
            const rawEmail = isStatus
              ? (wo.statusSyncEmail || (val && val.includes('|') ? val.split('|')[1]?.trim() : ''))
              : (wo.procedureSyncEmail || (val && val.includes('|') ? val.split('|')[1]?.trim() : ''));
            const displayTime = val && val.includes('|') ? val.split('|')[0]?.trim() : val.trim();
            if (!displayTime) {
              cellContent = `<span style="display: block; width: 100%; min-height: 16px;"></span>`;
            } else {
              const emailColor = isStatus ? '#047857' : '#1d4ed8';
              const emailBg = isStatus ? '#ecfdf5' : '#eff6ff';
              const emailBorder = isStatus ? '#a7f3d0' : '#bfdbfe';
              cellContent = `
                <div style="font-family: monospace; font-size: 8px; font-weight: 800; color: #0f172a; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 1.5px; padding: 1px 0;">
                  <span style="display: block; font-weight: 900; color: #1e293b;">${displayTime}</span>
                  ${rawEmail ? `<span style="display: block; font-size: 7px; font-weight: 700; color: ${emailColor}; background: ${emailBg}; border: 1px solid ${emailBorder}; border-radius: 3px; padding: 0.5px 3px; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" dir="ltr">${rawEmail}</span>` : ''}
                </div>
              `;
            }
          } else if (col.field === 'workOrderNumber') {
            cellContent = `
              <span style="font-family: monospace; font-weight: 800; color: ${numColor}; font-size: 10px; display: block; text-align: center;">
                ${val || '-'}
              </span>
            `;
          } else if (col.field === 'workOrderCode') {
            cellContent = `
              <span style="font-family: monospace; font-weight: 800; color: #1e293b; font-size: 9.5px; display: block; text-align: center;">
                ${val || '-'}
              </span>
            `;
          } else if (col.field === 'photosFile') {
            const files = Array.isArray((wo as any).photosFile) ? (wo as any).photosFile : [];
            const pdfCount = files.filter((f: any) => f.type?.includes('pdf') || f.name?.toLowerCase().endsWith('.pdf')).length;
            const imgCount = files.length - pdfCount;
            cellContent = `
              <div style="font-size: 8px; text-align: center; color: #064e3b; font-weight: 800;">
                <span style="display: inline-block; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 4px; padding: 2px 4px;">
                  📁 ${files.length > 0 ? `${pdfCount > 0 ? `${pdfCount} PDF ` : ''}${imgCount > 0 ? `${imgCount} صور` : ''}` : 'SharePoint'}
                </span>
              </div>
            `;
          } else if (col.field === 'qualityNotes') {
            const clean = (val || (wo as any).executionNotes || '').trim();
            const noteItems = Array.isArray((wo as any).qualityNoteItems) && (wo as any).qualityNoteItems.length > 0
              ? (wo as any).qualityNoteItems
              : null;

            if (noteItems && noteItems.length > 1) {
              const itemsHtml = noteItems.map((item: any, nIdx: number) => `
                <div style="background-color: #fff1f2; border: 1px solid #fecdd3; border-radius: 4px; padding: 2px 4px; margin-bottom: 2px; text-align: right;">
                  <div style="display: flex; align-items: center; justify-content: space-between; font-size: 7.5px; font-weight: 900; color: #991b1b; margin-bottom: 1px;">
                    <span style="background: #fee2e2; padding: 0.5px 3px; border-radius: 2px;">ملاحظة ${nIdx + 1}</span>
                    ${item.photos && item.photos.length > 0 ? `<span style="color: #92400e;">📷 ${item.photos.length} صورة</span>` : ''}
                  </div>
                  <div style="font-size: 8px; color: #b91c1c; font-weight: 800; word-break: break-word; overflow-wrap: anywhere; line-height: 1.25;">${item.text}</div>
                </div>
              `).join('');
              cellContent = `<div style="max-height: 140px; overflow: hidden;">${itemsHtml}</div>`;
            } else if (clean && clean !== '-' && clean !== 'لا توجد ملاحظات حالياً' && clean !== 'لا توجد ملاحظات') {
              const isLongNote = clean.length > 70;
              const singlePhotos = noteItems?.[0]?.photos || [];
              cellContent = `
                <div style="background-color: #fff1f2; border: 1px solid #fecdd3; border-radius: 6px; padding: 4px 6px; color: #b91c1c; font-weight: 800; text-align: right; word-break: break-word; overflow-wrap: anywhere; line-height: 1.35;">
                  <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 2px;">
                    <span style="font-size: 8px; font-weight: 900; color: #991b1b; display: inline-block; background: #fee2e2; padding: 1px 4px; border-radius: 3px;">ملاحظة</span>
                    ${singlePhotos.length > 0 ? `<span style="font-size: 7.5px; color: #92400e; font-weight: 800;">📷 ${singlePhotos.length} صورة</span>` : ''}
                  </div>
                  <div style="font-size: ${isLongNote ? '8.5px' : '9.5px'}; color: #b91c1c; font-weight: 800; word-break: break-word; overflow-wrap: anywhere; white-space: normal;">${clean}</div>
                </div>
              `;
            } else {
              cellContent = `<span style="display: block; width: 100%; min-height: 16px;"></span>`;
            }
          } else if (col.field === 'pdcAudit' || col.field === 'constructionAudit') {
            const rawAudit = (wo as any)[col.field];
            const overall = typeof rawAudit === 'object' && rawAudit !== null ? calculateOverallAuditColumnSummary(rawAudit) : null;
            const evalKeys = typeof rawAudit === 'object' && rawAudit !== null && Array.isArray(rawAudit.evaluatedKeys) ? rawAudit.evaluatedKeys : [];
            const evaluatedCats = overall ? (overall.compliantCategories + overall.nonCompliantCategories + overall.naCategories) : 0;
            const main =
              overall && evaluatedCats > 0
                ? overall.derivedMainStatus
                : rawAudit?.mainStatus && rawAudit.mainStatus !== 'غير محدد' && rawAudit.mainStatus !== 'قيد التدقيق'
                ? rawAudit.mainStatus
                : typeof rawAudit === 'string' && (rawAudit === 'مؤهل' || rawAudit === 'غير مؤهل')
                ? rawAudit
                : '';

            if (!main && evalKeys.length === 0 && evaluatedCats === 0) {
              cellContent = `<span style="display: block; width: 100%; min-height: 16px;"></span>`;
            } else {
              cellContent = `
                <div style="font-size: 8px; text-align: center; line-height: 1.25;">
                  <span style="display: inline-block; padding: 1px 4px; border-radius: 3px; font-weight: 900; background: ${main === 'مؤهل' ? '#ecfdf5; color: #065f46; border: 1px solid #a7f3d0;' : main === 'غير مؤهل' ? '#fff1f2; color: #9f1239; border: 1px solid #fecdd3;' : '#f1f5f9; color: #475569;'}">
                    ${main}
                  </span>
                  ${
                    evaluatedCats > 0 && overall
                      ? `<div style="font-size: 7px; color: #334155; font-weight: 800; margin-top: 2px;">
                          ${overall.averageCompliance}% (${evaluatedCats}/18 قائمة: م${overall.compliantCategories}•غ${overall.nonCompliantCategories})
                        </div>`
                      : ''
                  }
                </div>
              `;
            }
          } else {
            cellContent = `
              <span style="font-size: 9.5px; font-weight: 800; color: #0f172a; display: block; text-align: ${col.field === 'contractor' || col.field === 'consultant' ? 'right' : 'center'}; word-break: break-word;">
                ${val || '-'}
              </span>
            `;
          }

          cellsHtml += `
            <td style="padding: 4px 6px; vertical-align: middle; ${borderStyle}">
              ${cellContent}
            </td>
          `;
        });

        rowsHtml += `
          <tr style="background: ${rowBg}; height: ${100 / targetSlots}%;">
            ${cellsHtml}
          </tr>
        `;
      });

      // Filler rows to maintain full page height
      const fillerCount = Math.max(0, targetSlots - chunk.length);
      for (let f = 0; f < fillerCount; f++) {
        const isEven = (chunk.length + f) % 2 === 0;
        let fillerCells = `
          <td style="padding: 4px; text-align: center; color: #cbd5e1; font-family: monospace; font-size: 9px; border-left: 1px solid #e2e8f0; background: #f8fafc;">
            -
          </td>
        `;
        colsToRender.forEach((_, cIdx) => {
          const borderStyle = cIdx < colsToRender.length - 1 ? 'border-left: 1px solid #e2e8f0;' : '';
          fillerCells += `
            <td style="padding: 4px; text-align: center; color: #cbd5e1; font-size: 9px; ${borderStyle}">
              -
            </td>
          `;
        });
        rowsHtml += `
          <tr style="background: ${isEven ? '#ffffff' : '#f8fafc'}; height: ${100 / targetSlots}%;">
            ${fillerCells}
          </tr>
        `;
      }
    }

    const tableHtml = `
      <div style="width: 100%; flex: 1; display: flex; flex-direction: column; min-height: 0; margin: 4px 0; border: 2px solid #002855; border-radius: 8px; overflow: hidden; box-sizing: border-box;">
        <table style="width: 100%; height: 100%; table-layout: fixed; border-collapse: collapse; text-align: right; box-sizing: border-box;">
          <thead style="background: #002855; color: #ffffff;">
            <tr style="border-bottom: 2.5px solid #F58220;">
              <th style="padding: 5px; text-align: center; border-left: 1px solid #1e3a8a; width: 3.5%; font-family: monospace; font-size: 10px; font-weight: 900; color: #FDB813;">#</th>
              ${colsToRender.map((c, i) => `
                <th style="padding: 5px 6px; font-size: 10px; font-weight: 900; text-align: ${c.field === 'contractor' ? 'right' : 'center'}; width: ${c.width}; ${i < colsToRender.length - 1 ? 'border-left: 1px solid #1e3a8a;' : ''}">
                  ${c.title}
                </th>
              `).join('')}
            </tr>
          </thead>
          <tbody style="background: #ffffff;">
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    `;

    // 3. Footer Block - Unified Standard: Page number ONLY
    const footerHtml = `
      <div style="width: 100%; margin-top: auto; padding-top: 6px; border-top: 1.5px solid #cbd5e1; text-align: center;">
        <span style="font-size: 11px; font-weight: 800; color: #334155; font-family: monospace;">
          رقم الصفحة: ${pageIndex + 1}
        </span>
      </div>
    `;

    sheet.innerHTML = headerHtml + tableHtml + footerHtml;
    container.appendChild(sheet);
  });

  return container;
}

/**
 * Direct instant export of filtered or custom work orders to a high-quality PDF file.
 * Automatically renders offscreen A4 sheets, captures them with full Arabic RTL fidelity,
 * and triggers immediate browser download just like Excel export.
 */
export async function exportOrdersDirectToPdf(
  orders: WorkOrder[],
  officeTitle: string = 'الجدول المفلتر',
  filename?: string,
  columns?: ColumnDefinition[]
): Promise<void> {
  const container = createOffscreenExportContainer(orders, officeTitle, columns);
  document.body.appendChild(container);

  try {
    // Wait brief tick for font rendering and complete layout computation
    await new Promise(resolve => setTimeout(resolve, 180));

    const sheets = Array.from(container.querySelectorAll<HTMLElement>('.export-page-sheet'));
    if (sheets.length === 0) {
      throw new Error('تعذر تجهيز صفحات التقرير لتصدير PDF');
    }

    const targetFilename = filename || `سجل_أوامر_العمل_المفلترة_${officeTitle.replace(/\s+/g, '_')}_${Date.now()}.pdf`;

    await exportToPdf(
      sheets,
      orders,
      officeTitle,
      targetFilename,
      {
        orientation: 'landscape',
        format: 'a4',
        marginMm: 0
      }
    );
  } finally {
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  }
}

/**
 * Direct instant export of filtered work orders to high-resolution PNG image.
 */
export async function exportOrdersDirectToImage(
  orders: WorkOrder[],
  officeTitle: string = 'الجدول المفلتر',
  filename?: string,
  columns?: ColumnDefinition[]
): Promise<void> {
  const container = createOffscreenExportContainer(orders, officeTitle, columns);
  document.body.appendChild(container);

  try {
    await new Promise(resolve => setTimeout(resolve, 180));

    const sheet = container.querySelector<HTMLElement>('.export-page-sheet');
    if (!sheet) {
      throw new Error('تعذر تجهيز صفحة التقرير لتصدير الصورة');
    }

    const targetFilename = filename || `صورة_أوامر_العمل_المفلترة_${officeTitle.replace(/\s+/g, '_')}_${Date.now()}.png`;
    const dataUrl = await captureElementToImage(sheet, 'png');

    const link = document.createElement('a');
    link.download = targetFilename;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } finally {
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  }
}

/**
 * Helper to download an ExcelJS workbook buffer in browser
 */
async function downloadExcelWorkbook(workbook: ExcelJS.Workbook, filename: string) {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Standard cell borders for Excel tables
 */
const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
};

const HEADER_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'medium', color: { argb: 'FF002855' } },
  left: { style: 'thin', color: { argb: 'FF1E3A8A' } },
  bottom: { style: 'medium', color: { argb: 'FFF58220' } },
  right: { style: 'thin', color: { argb: 'FF1E3A8A' } }
};

/**
 * Export Work Orders to a pristine, professionally formatted Excel workbook
 * with native RTL direction, visible gridlines, executive KPI cards,
 * interactive AutoFilter, red card notes, bold clear typography,
 * highlighted edited rows, auto-sizing, and frozen headers.
 */
/**
 * Helper to convert 1-based column index to Excel column letters (A, B, ... Z, AA, AB)
 */
function getExcelColName(colIdx1Based: number): string {
  let name = '';
  let n = colIdx1Based;
  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

interface ExportColDef {
  key: string;
  title: string;
  width: number;
}

const DEFAULT_EXPORT_COLS: ExportColDef[] = [
  { key: 'office', title: 'المكتب', width: 18 },
  { key: 'contractor', title: 'المقاول', width: 24 },
  { key: 'consultant', title: 'الاستشاري', width: 24 },
  { key: 'workOrderNumber', title: 'رقم امر العمل', width: 20 },
  { key: 'workOrderCode', title: 'نوع امر العمل', width: 16 },
  { key: 'photosFile', title: 'ملف الصور', width: 20 },
  { key: 'attachmentStatus', title: 'حالة الارفاق', width: 20 },
  { key: 'qualityNotes', title: 'الملاحظات', width: 42 },
  { key: 'pdcAudit', title: 'تدقيق PDC', width: 26 },
  { key: 'constructionAudit', title: 'تدقيق الانشاءات', width: 26 },
  { key: 'procedure155Status', title: 'تدقيق المساندة الفنية', width: 24 },
  { key: 'statusSyncTime', title: 'مزامنة التدقيق', width: 22 },
  { key: 'procedure155', title: 'حالة إجراء 155', width: 22 },
  { key: 'procedureSyncTime', title: 'مزامنة إجراء 155', width: 22 }
];

/**
 * Export Work Orders to a pristine, professionally formatted Excel workbook
 * with native RTL direction, visible gridlines, executive KPI cards,
 * interactive AutoFilter, red card notes, bold clear typography,
 * highlighted edited rows, dynamic custom columns, and frozen headers.
 */
export function buildExcelWorkbook(
  orders: WorkOrder[],
  officeTitle: string = 'جميع المكاتب',
  columns?: ColumnDefinition[]
): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'حوكمة جودة أعمال الإنشاءات - المساندة الفنية';
  workbook.lastModifiedBy = 'حوكمة جودة أعمال الإنشاءات - المساندة الفنية';
  workbook.created = new Date();
  workbook.modified = new Date();

  const safeSheetName = officeTitle.replace(/[*?:/\\\[\]]/g, '').trim().substring(0, 30) || 'أوامر العمل';
  const worksheet = workbook.addWorksheet(safeSheetName, {
    views: [
      {
        rightToLeft: true,
        showGridLines: true,
        state: 'frozen',
        ySplit: 8 // Freeze rows above table header so executive cards & headers stay pinned while scrolling
      }
    ]
  });

  // Build active export columns strictly from the 14 canonical columns
  const canonicalCols = ensurePhotosFileColumn(columns);
  const activeCols: ExportColDef[] = canonicalCols.map(c => {
    const def = DEFAULT_EXPORT_COLS.find(d => d.key === c.field);
    return {
      key: c.field,
      title: c.title,
      width: def?.width || 20
    };
  });

  const totalCols = activeCols.length + 1; // +1 for sequence column 'م'
  const lastColLetter = getExcelColName(totalCols);

  // Calculate statistics & 18-checklists compliance summary (counting only filled/evaluated rows)
  const totalCount = orders.length;
  const evaluatedOrders = orders.filter(w => {
    const s = String(w.procedure155Status || '').trim();
    return s !== '' && s !== 'قيد التدقيق' && s !== 'غير محدد' && s !== '-';
  });
  const readyCount = evaluatedOrders.filter(w => {
    const s = String(w.procedure155Status || '');
    return s.includes('مؤهل') && !s.includes('غير');
  }).length;
  const pendingCount = evaluatedOrders.filter(w => {
    const s = String(w.procedure155Status || '');
    return s.includes('غير') || (!s.includes('مؤهل') && !s.includes('معتمد') && !s.includes('تم'));
  }).length;
  const readyRate = evaluatedOrders.length > 0 ? Math.round((readyCount / evaluatedOrders.length) * 100) : 0;
  const editedCount = orders.filter(w => w.isEdited).length;
  const agg18 = calculateAggregate18ChecklistsCompliance(orders);

  const BORDER_CARD_HEADER: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FF94A3B8' } },
    left: { style: 'thin', color: { argb: 'FF94A3B8' } },
    bottom: { style: 'thin', color: { argb: 'FF94A3B8' } },
    right: { style: 'thin', color: { argb: 'FF94A3B8' } }
  };

  // Row 1: Master Corporate Header Banner (Corporate Navy #002855)
  const titleRow1 = worksheet.addRow(['حوكمة جودة أعمال الإنشاءات • إدارة كهرباء الحدود الشمالية • المساندة الفنية']);
  worksheet.mergeCells(`A1:${lastColLetter}1`);
  titleRow1.height = 38;
  const cellA1 = worksheet.getCell('A1');
  cellA1.font = { name: 'Cairo', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  cellA1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF002855' } };
  cellA1.alignment = { vertical: 'middle', horizontal: 'center' };

  // Row 2: Subtitle
  const titleRow2 = worksheet.addRow([
    `سجل تدقيق الجودة لاوامر العمل ( تقرير شامل + ملخص القوائم الـ 18 ) | نطاق التقرير: ${officeTitle} | نسبة المطابقة الفعلية: ${agg18.actualComplianceRate}% | تاريخ الإصدار: ${new Date().toLocaleDateString('ar-SA')}`
  ]);
  worksheet.mergeCells(`A2:${lastColLetter}2`);
  titleRow2.height = 26;
  const cellA2 = worksheet.getCell('A2');
  cellA2.font = { name: 'Cairo', size: 10, bold: true, color: { argb: 'FFFDB813' } };
  cellA2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF004B8D' } };
  cellA2.alignment = { vertical: 'middle', horizontal: 'center' };

  // Row 3: Spacer row
  const spacerRow1 = worksheet.addRow([]);
  spacerRow1.height = 6;

  // Rows 4 & 5: Interactive Executive KPI Metric Cards
  const cardWidth = Math.max(2, Math.floor(totalCols / 5));
  const cardSpans = [
    { start: 1, end: cardWidth },
    { start: cardWidth + 1, end: cardWidth * 2 },
    { start: cardWidth * 2 + 1, end: cardWidth * 3 },
    { start: cardWidth * 3 + 1, end: cardWidth * 4 },
    { start: cardWidth * 4 + 1, end: totalCols }
  ];

  const cardTopRowValues = new Array(totalCols).fill('');
  cardTopRowValues[cardSpans[0].start - 1] = '📦 إجمالي أوامر العمل';
  cardTopRowValues[cardSpans[1].start - 1] = '✅ مؤهل للاغلاق 155 (معتمد)';
  cardTopRowValues[cardSpans[2].start - 1] = '⚠️ معلق وبحاجة لملاحظات';
  cardTopRowValues[cardSpans[3].start - 1] = '🛡️ امتثال القوائم الـ 18 (197 بند)';
  cardTopRowValues[cardSpans[4].start - 1] = '⚡ نسبة المطابقة الفعلية الشاملة';

  const cardHeadersRow = worksheet.addRow(cardTopRowValues);
  cardHeadersRow.height = 20;

  cardSpans.forEach(s => {
    worksheet.mergeCells(4, s.start, 4, s.end);
  });

  const styleCardTop = (colIdx: number, bgColor: string) => {
    const c = worksheet.getCell(4, colIdx);
    c.font = { name: 'Cairo', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
    c.alignment = { vertical: 'middle', horizontal: 'center' };
    c.border = BORDER_CARD_HEADER;
  };
  styleCardTop(cardSpans[0].start, 'FF1E3A8A'); // Blue
  styleCardTop(cardSpans[1].start, 'FF065F46'); // Emerald
  styleCardTop(cardSpans[2].start, 'FF991B1B'); // Red
  styleCardTop(cardSpans[3].start, 'FF0F766E'); // Teal
  styleCardTop(cardSpans[4].start, 'FF3730A3'); // Indigo

  const cardValRowValues = new Array(totalCols).fill('');
  cardValRowValues[cardSpans[0].start - 1] = `${totalCount} أمر عمل (${editedCount} معدل)`;
  cardValRowValues[cardSpans[1].start - 1] = `${readyCount} أمر (${readyRate}%)`;
  cardValRowValues[cardSpans[2].start - 1] = `${pendingCount} أمر (${100 - readyRate}%)`;
  cardValRowValues[cardSpans[3].start - 1] = `PDC: ${agg18.pdcComplianceRate}% | الإنشاءات: ${agg18.constComplianceRate}%`;
  cardValRowValues[cardSpans[4].start - 1] = `${agg18.actualComplianceRate}% مطابقة فعلية`;

  const cardValuesRow = worksheet.addRow(cardValRowValues);
  cardValuesRow.height = 28;

  cardSpans.forEach(s => {
    worksheet.mergeCells(5, s.start, 5, s.end);
  });

  const styleCardValue = (colIdx: number, bgColor: string, textColor: string) => {
    const c = worksheet.getCell(5, colIdx);
    c.font = { name: 'Cairo', size: 12.5, bold: true, color: { argb: textColor } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
    c.alignment = { vertical: 'middle', horizontal: 'center' };
    c.border = BORDER_CARD_HEADER;
  };
  styleCardValue(cardSpans[0].start, 'FFEFF6FF', 'FF1E40AF'); // Ice Blue
  styleCardValue(cardSpans[1].start, 'FFECFDF5', 'FF047857'); // Soft Green
  styleCardValue(cardSpans[2].start, 'FFFFF1F2', 'FFBE123C'); // Soft Red
  styleCardValue(cardSpans[3].start, 'FFEEF2FF', 'FF4338CA'); // Soft Indigo
  styleCardValue(cardSpans[4].start, 'FFFFF1F2', 'FF9F1239'); // Soft Pink

  // Row 6: Spacer row
  const spacerRow2 = worksheet.addRow([]);
  spacerRow2.height = 6;

  // Row 7: Interactive Tip / Guide Bar
  const guideRow = worksheet.addRow([
    '🎯 تفاعلية إكسل المتقدمة: استخدم أسهم التصفية (AutoFilter) في رؤوس الأعمدة لفرز وتصفية البيانات فورياً • الملاحظات مميزة ببطاقة حمراء • كافة البيانات والخطوط واضحة وعريضة للطباعة والتدقيق'
  ]);
  worksheet.mergeCells(`A7:${lastColLetter}7`);
  guideRow.height = 22;
  const cellA7 = worksheet.getCell('A7');
  cellA7.font = { name: 'Cairo', size: 9, bold: true, color: { argb: 'FF334155' } };
  cellA7.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  cellA7.alignment = { vertical: 'middle', horizontal: 'center' };
  cellA7.border = THIN_BORDER;

  // Row 8: Table Headers
  const headers = ['م', ...activeCols.map(c => c.title)];
  const headerRow = worksheet.addRow(headers);
  headerRow.height = 34;

  headerRow.eachCell((cell) => {
    cell.font = { name: 'Cairo', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF002855' } }; // Corporate Navy
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = HEADER_BORDER;
  });

  const headerRowIndex = 8;
  const startDataRow = 9;

  // Card Borders
  const RED_NOTE_BORDER: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FFF43F5E' } },
    bottom: { style: 'thin', color: { argb: 'FFF43F5E' } },
    left: { style: 'thin', color: { argb: 'FFF43F5E' } },
    right: { style: 'thin', color: { argb: 'FFF43F5E' } }
  };

  const BLUE_WO_BORDER: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FF93C5FD' } },
    bottom: { style: 'thin', color: { argb: 'FF93C5FD' } },
    left: { style: 'thin', color: { argb: 'FF93C5FD' } },
    right: { style: 'thin', color: { argb: 'FF93C5FD' } }
  };

  // Data Rows
  orders.forEach((wo, idx) => {
    const isEven = idx % 2 === 0;
    const isEdited = Boolean(wo.isEdited);
    const notesVal = wo.qualityNotes || wo.executionNotes || '-';

    const rowData: (string | number)[] = [idx + 1];
    activeCols.forEach(col => {
      let val = (wo as any)[col.key];
      const fieldsFromAttachmentToEnd = new Set([
        'attachmentStatus',
        'photoDocumentation',
        'consultantForms',
        'consultantClearanceForms',
        'form190',
        'form200',
        'inspectionForm',
        'qualityNotes',
        'pdcAudit',
        'constructionAudit',
        'procedure155Status',
        'statusSyncTime',
        'procedure155',
        'procedureSyncTime'
      ]);

      if (val === undefined || val === null || val === '') {
        if (wo.customFields && (wo.customFields as any)[col.key] !== undefined) {
          val = (wo.customFields as any)[col.key];
        } else if (col.key === 'photosFile') {
          const files = Array.isArray((wo as any).photosFile) ? (wo as any).photosFile : [];
          val = files.length > 0 ? `${files.length} مرفق (SharePoint)` : 'SharePoint';
        } else if (col.key === 'receiptDate') {
          val = wo.createdAt ? String(wo.createdAt).slice(0, 10) : '-';
        } else if (fieldsFromAttachmentToEnd.has(col.key)) {
          val = '';
        } else {
          val = '-';
        }
      }

      if (col.key === 'procedure155Status' && (val === 'قيد التدقيق' || val === 'غير محدد')) {
        val = '';
      }
      if (col.key === 'qualityNotes' && (val === 'لا توجد ملاحظات حالياً' || val === 'لا توجد ملاحظات' || val === '-')) {
        val = '';
      }

      if (col.key === 'statusSyncTime' || col.key === 'procedureSyncTime') {
        const isStatus = col.key === 'statusSyncTime';
        const rawEmail = isStatus
          ? (wo.statusSyncEmail || (val && String(val).includes('|') ? String(val).split('|')[1]?.trim() : ''))
          : (wo.procedureSyncEmail || (val && String(val).includes('|') ? String(val).split('|')[1]?.trim() : ''));
        const displayTime = val && String(val).includes('|') ? String(val).split('|')[0]?.trim() : val;
        if (rawEmail && displayTime && displayTime !== '-') {
          val = `${displayTime}\n${rawEmail}`;
        }
      }

      if (col.key === 'pdcAudit' || col.key === 'constructionAudit') {
        const rawAudit = (wo as any)[col.key];
        val = formatOrderAudit18SummaryText(rawAudit).compactBadgeText;
      }

      rowData.push(String(val));
    });

    const row = worksheet.addRow(rowData);
    const noteCharLen = String(notesVal || '').length;
    row.height = noteCharLen > 90 ? 54 : noteCharLen > 40 ? 38 : 26;

    let customRowHex: string | undefined;
    try {
      if (typeof window !== 'undefined' && (workbook as any)._cachedColorsMap === undefined) {
        const rawColors = localStorage.getItem('sec_custom_row_colors');
        (workbook as any)._cachedColorsMap = rawColors ? JSON.parse(rawColors) : {};
      }
      const parsed = (workbook as any)._cachedColorsMap;
      if (parsed && parsed[wo.id]) {
        const clean = String(parsed[wo.id]).replace('#', '').toUpperCase();
        if (clean.length === 6) customRowHex = 'FF' + clean;
      }
    } catch (_) {}

    row.eachCell((cell, colNumber) => {
      cell.border = THIN_BORDER;

      let fontColor = 'FF0F172A';
      let fontBold = true;
      let bgColor = isEven ? 'FFFFFFFF' : 'FFF8FAFC';

      if (customRowHex && !isEdited) {
        bgColor = customRowHex;
      }

      if (isEdited) {
        bgColor = isEven ? 'FFFFF1F2' : 'FFFFE4E6';
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFF43F5E' } },
          bottom: { style: 'thin', color: { argb: 'FFF43F5E' } },
          left: { style: 'thin', color: { argb: 'FFF43F5E' } },
          right: { style: 'thin', color: { argb: 'FFF43F5E' } }
        };
      }

      if (colNumber === 1) { // Sequence #
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        fontBold = true;
        if (isEdited) {
          bgColor = 'FFFFE4E6';
          fontColor = 'FF991B1B';
        } else {
          bgColor = 'FFF1F5F9';
          fontColor = 'FF334155';
        }
      } else {
        const colDef = activeCols[colNumber - 2];
        const val = String(cell.value || '');

        if (colDef.key === 'workOrderNumber') {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          fontBold = true;
          if (isEdited) {
            fontColor = 'FF991B1B';
            bgColor = 'FFFFE4E6';
          } else {
            fontColor = 'FF1D4ED8';
            bgColor = 'FFEFF6FF';
            cell.border = BLUE_WO_BORDER;
          }
        } else if (colDef.key === 'office') {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          fontBold = true;
          fontColor = 'FF0F172A';
        } else if (colDef.key === 'contractor') {
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
          fontBold = true;
          fontColor = 'FF0F172A';
        } else if (
          colDef.key === 'attachmentStatus' ||
          colDef.key === 'photoDocumentation' ||
          colDef.key === 'consultantForms' ||
          colDef.key === 'consultantClearanceForms' ||
          colDef.key === 'form190' ||
          colDef.key === 'form200' ||
          colDef.key === 'inspectionForm'
        ) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          fontBold = true;
          if ((val.includes('مكتمل') && !val.includes('ملاحظات') && !val.includes('غير')) || val === 'جاهز للارفاق الكامل') {
            bgColor = 'FFD1FAE5';
            fontColor = 'FF065F46';
          } else if (val.includes('غير مكتمل') || val === 'غير جاهز للارفاق' || val.includes('غير جاهز')) {
            bgColor = 'FFFEE2E2';
            fontColor = 'FF991B1B';
          } else if (val.includes('ملاحظات') || val.startsWith('جاهز لارفاق')) {
            bgColor = 'FFFEF3C7';
            fontColor = 'FF92400E';
          } else if (val === 'لاينطبق') {
            bgColor = 'FFF1F5F9';
            fontColor = 'FF64748B';
          }
        } else if (colDef.key === 'qualityNotes' || colDef.key === 'executionNotes') {
          cell.alignment = { vertical: 'middle', horizontal: 'right', wrapText: true };
          fontBold = true;
          bgColor = 'FFFFF1F2'; // Distinct soft red card fill
          fontColor = 'FFBE123C'; // Bold dark red text
          cell.border = RED_NOTE_BORDER;
        } else if (colDef.key === 'procedure155Status') {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          fontBold = true;
          const isQual = val.includes('مؤهل') && !val.includes('غير');
          if (isQual) {
            bgColor = 'FFD1FAE5';
            fontColor = 'FF065F46';
          } else {
            bgColor = 'FFFEE2E2';
            fontColor = 'FF991B1B';
          }
        } else if (colDef.key === 'procedure155') {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          fontBold = true;
          if (val.includes('مؤهل') || val.includes('استلام')) {
            bgColor = 'FFD1FAE5';
            fontColor = 'FF065F46';
          } else if (val.includes('غير')) {
            bgColor = 'FFFEE2E2';
            fontColor = 'FF991B1B';
          } else {
            bgColor = 'FFEFF6FF';
            fontColor = 'FF1E40AF';
          }
        } else if (
          colDef.key === 'statusSyncTime' ||
          colDef.key === 'procedureSyncTime' ||
          colDef.key === 'receiptDate' ||
          colDef.key === 'workOrderCode'
        ) {
          cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
          fontBold = true;
          bgColor = 'FFF8FAFC';
          fontColor = 'FF1E293B';
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          fontBold = true;
        }
      }

      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
      cell.font = { name: 'Cairo', size: 10, bold: fontBold, color: { argb: fontColor } };
    });
  });

  const lastDataRow = startDataRow + Math.max(0, orders.length - 1);

  // Enable Interactive Native AutoFilter across all headers
  if (orders.length > 0) {
    worksheet.autoFilter = {
      from: { row: headerRowIndex, column: 1 },
      to: { row: lastDataRow, column: totalCols }
    };
  }

  // Summary Row at the bottom of the table
  const summaryRowValues = new Array(totalCols).fill('');
  summaryRowValues[0] = 'الإجمالي';
  summaryRowValues[1] = `${totalCount} أمر عمل`;
  if (totalCols >= 4) {
    summaryRowValues[totalCols - 1] = `${readyCount} مؤهل (${readyRate}%)`;
  }

  const summaryRow = worksheet.addRow(summaryRowValues);
  summaryRow.height = 28;

  summaryRow.eachCell((cell) => {
    cell.font = { name: 'Cairo', size: 10.5, bold: true, color: { argb: 'FF0F172A' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF475569' } },
      bottom: { style: 'double', color: { argb: 'FF475569' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
    };
  });

  // Append Official Footer Row
  worksheet.addRow([]);
  const footerRow = worksheet.addRow([
    `حوكمة جودة أعمال الإنشاءات • مستند رقمي رسمي معتمد آلياً بنظام إجراء 155`
  ]);
  const footRowNum = worksheet.rowCount;
  worksheet.mergeCells(`A${footRowNum}:${lastColLetter}${footRowNum}`);
  footerRow.height = 26;
  const cellFoot = worksheet.getCell(`A${footRowNum}`);
  cellFoot.font = { name: 'Cairo', size: 9.5, bold: true, color: { argb: 'FF94A3B8' } };
  cellFoot.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B132B' } };
  cellFoot.alignment = { vertical: 'middle', horizontal: 'center' };

  // Set column widths
  worksheet.getColumn(1).width = 7; // Sequence
  activeCols.forEach((col, idx) => {
    worksheet.getColumn(idx + 2).width = col.width;
  });

  // A4 Landscape Print & View Page Setup
  worksheet.pageSetup = {
    orientation: 'landscape',
    paperSize: 9, // A4
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: {
      left: 0.3,
      right: 0.3,
      top: 0.4,
      bottom: 0.4,
      header: 0.2,
      footer: 0.2
    }
  };

  // Add dedicated second worksheet: ملخص امتثال القوائم الـ 18
  const summarySheet = workbook.addWorksheet('ملخص امتثال القوائم الـ 18', {
    views: [{ rightToLeft: true, state: 'frozen', ySplit: 4 }]
  });

  const sTitle1 = summarySheet.addRow(['ملخص الامتثال التفصيلي للقوائم الـ 18 المعتمدة (197 بند فحص فني) • تدقيق الـ PDC وتدقيق الإنشاءات']);
  summarySheet.mergeCells('A1:K1');
  sTitle1.height = 34;
  const sCellA1 = summarySheet.getCell('A1');
  sCellA1.font = { name: 'Cairo', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
  sCellA1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF002855' } };
  sCellA1.alignment = { vertical: 'middle', horizontal: 'center' };

  const sTitle2 = summarySheet.addRow([
    `نطاق التقرير: ${officeTitle} | إجمالي أوامر العمل: ${totalCount} | امتثال القوائم الـ 18 (PDC): ${agg18.pdcComplianceRate}% | امتثال القوائم الـ 18 (الإنشاءات): ${agg18.constComplianceRate}% | نسبة المطابقة الفعلية الشاملة: ${agg18.actualComplianceRate}%`
  ]);
  summarySheet.mergeCells('A2:K2');
  sTitle2.height = 24;
  const sCellA2 = summarySheet.getCell('A2');
  sCellA2.font = { name: 'Cairo', size: 10, bold: true, color: { argb: 'FFFDB813' } };
  sCellA2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF004B8D' } };
  sCellA2.alignment = { vertical: 'middle', horizontal: 'center' };

  summarySheet.addRow([]);

  const sHeader = summarySheet.addRow([
    'م',
    'اسم قائمة الفحص المعتمدة (18 قائمة)',
    'عدد بنود القائمة',
    'PDC - أوامر مقيمة',
    'PDC - ممتثل',
    'PDC - غير ممتثل',
    'PDC - نسبة الامتثال %',
    'الإنشاءات - أوامر مقيمة',
    'الإنشاءات - ممتثل',
    'الإنشاءات - غير ممتثل',
    'الإنشاءات - نسبة الامتثال %'
  ]);
  sHeader.height = 30;
  sHeader.eachCell(c => {
    c.font = { name: 'Cairo', size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF002855' } };
    c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    c.border = HEADER_BORDER;
  });

  agg18.categoriesBreakdown.forEach((catStat, idx) => {
    const r = summarySheet.addRow([
      idx + 1,
      catStat.title,
      `${catStat.itemCount} بند`,
      catStat.pdcEvaluatedOrders,
      catStat.pdcCompliantOrders,
      catStat.pdcNonCompliantOrders,
      `${catStat.pdcComplianceRate}%`,
      catStat.constEvaluatedOrders,
      catStat.constCompliantOrders,
      catStat.constNonCompliantOrders,
      `${catStat.constComplianceRate}%`
    ]);
    r.height = 24;
    r.eachCell((c, colNum) => {
      c.border = THIN_BORDER;
      c.font = { name: 'Cairo', size: 10, bold: true, color: { argb: 'FF0F172A' } };
      c.alignment = { vertical: 'middle', horizontal: colNum === 2 ? 'right' : 'center' };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: idx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC' } };
    });
  });

  const totalItems18 = AUDIT_CATEGORIES_META.reduce((acc, c) => acc + c.items.length, 0);
  const sFooter = summarySheet.addRow([
    'الإجمالي',
    `إجمالي القوائم المعتمدة: ${AUDIT_CATEGORIES_META.length} قائمة فحص`,
    `${totalItems18} بند`,
    agg18.pdcEvaluatedOrders,
    agg18.pdcQualifiedOrders,
    agg18.pdcNonQualifiedOrders,
    `${agg18.pdcComplianceRate}%`,
    agg18.constEvaluatedOrders,
    agg18.constQualifiedOrders,
    agg18.constNonQualifiedOrders,
    `${agg18.constComplianceRate}%`
  ]);
  sFooter.height = 28;
  sFooter.eachCell(c => {
    c.font = { name: 'Cairo', size: 10.5, bold: true, color: { argb: 'FF0F172A' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    c.alignment = { vertical: 'middle', horizontal: 'center' };
    c.border = HEADER_BORDER;
  });

  const sWidths = [8, 32, 16, 18, 16, 16, 20, 18, 16, 16, 20];
  sWidths.forEach((w, i) => {
    summarySheet.getColumn(i + 1).width = w;
  });

  return workbook;
}

export async function exportToExcel(
  orders: WorkOrder[],
  officeTitle: string = 'جميع المكاتب',
  filename: string = 'سجل_أوامر_العمل_إجراء_155.xlsx',
  columns?: ColumnDefinition[]
) {
  const workbook = buildExcelWorkbook(orders, officeTitle, columns);
  await downloadExcelWorkbook(workbook, filename);
}

export async function exportExcelToBase64(
  orders: WorkOrder[],
  officeTitle: string = 'جميع المكاتب',
  columns?: ColumnDefinition[]
): Promise<string> {
  const workbook = buildExcelWorkbook(orders, officeTitle, columns);
  const buffer = await workbook.xlsx.writeBuffer();
  return arrayBufferToBase64(buffer as ArrayBuffer);
}

export interface WeeklyReportExcelParams {
  reportCode: string;
  periodText: string;
  officeScope: string;
  totalAudited: number;
  readyCount: number;
  readyRate: number;
  pendingCount: number;
  pendingRate: number;
  photoCount: number;
  photoRate: number;
  boqCount: number;
  boqRate: number;
  topOffice?: {
    name: string;
    rate: number;
    score: number;
  } | null;
  officeAchievements: {
    rank: number;
    officeName: string;
    code: string;
    total: number;
    ready: number;
    pending: number;
    completionRate: number;
    photosRate: number;
    boqCount: number;
    score: number;
    evaluation: string;
  }[];
  customNotes?: string;
}

/**
 * Export Weekly Report to beautifully formatted Excel file with RTL support,
 * clear gridlines, executive KPI cards, bold typography, and office rankings.
 */
export async function exportWeeklyReportToExcel(
  params: WeeklyReportExcelParams,
  filename: string = `التقرير_الأسبوعي_${params.reportCode}.xlsx`
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'حوكمة جودة أعمال الإنشاءات - المساندة الفنية';
  workbook.lastModifiedBy = 'حوكمة جودة أعمال الإنشاءات - المساندة الفنية';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('التقرير الأسبوعي', {
    views: [
      {
        rightToLeft: true,
        showGridLines: true,
        state: 'frozen',
        ySplit: 13
      }
    ]
  });

  // Title 1
  worksheet.addRow(['حوكمة جودة أعمال الإنشاءات • إدارة كهرباء الحدود الشمالية • المساندة الفنية']);
  worksheet.mergeCells('A1:K1');
  const c1 = worksheet.getCell('A1');
  c1.font = { name: 'Cairo', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  c1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF002855' } };
  c1.alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.getRow(1).height = 36;

  // Title 2
  worksheet.addRow(['التقرير الأسبوعي التنفيذي لإنجازات المكاتب الفرعية وضبط الجودة الفنية (إجراء 155)']);
  worksheet.mergeCells('A2:K2');
  const c2 = worksheet.getCell('A2');
  c2.font = { name: 'Cairo', size: 11, bold: true, color: { argb: 'FFFDB813' } };
  c2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF004B8D' } };
  c2.alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.getRow(2).height = 26;

  // Title 3
  worksheet.addRow([
    `كود التقرير: ${params.reportCode} | الفترة: ${params.periodText} | نطاق المكاتب: ${params.officeScope} | تاريخ الإصدار: ${new Date().toLocaleDateString('ar-SA')}`
  ]);
  worksheet.mergeCells('A3:K3');
  const c3 = worksheet.getCell('A3');
  c3.font = { name: 'Cairo', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
  c3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A192F' } };
  c3.alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.getRow(3).height = 22;

  // Section 1: KPI
  worksheet.addRow([]);
  const sec1 = worksheet.addRow(['أولاً: الملخص التنفيذي ومؤشرات الأداء القيادية (KPI)']);
  worksheet.mergeCells(`A5:D5`);
  sec1.font = { name: 'Cairo', size: 11, bold: true, color: { argb: 'FF002855' } };

  const kpiHeaders = worksheet.addRow(['المؤشر القيادي', 'القيمة الإجمالية', 'النسبة المئوية', 'الحالة التشغيلية']);
  kpiHeaders.height = 26;
  kpiHeaders.eachCell((c) => {
    c.font = { name: 'Cairo', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF002855' } };
    c.border = HEADER_BORDER;
    c.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  const kpiData = [
    ['إجمالي أوامر العمل المدققة', params.totalAudited, '100%', 'فحص ميداني شامل'],
    ['المؤهل والمعتمد لإجراء 155', params.readyCount, `${params.readyRate}%`, 'مستوفٍ للاشتراطات الفنية'],
    ['المعلق للنواقص والملاحظات', params.pendingCount, `${params.pendingRate}%`, 'بانتظار معالجة المقاولين'],
    ['نسبة الإرفاق وملفات الصور الميدانية', params.photoCount, `${params.photoRate}%`, 'مرفقات الصور (SharePoint)'],
    ['أوامر العمل المحتوية على ملاحظات جودة', params.boqCount, `${params.boqRate}%`, 'متابعة استيفاء ملاحظات الجودة']
  ];

  kpiData.forEach(row => {
    const r = worksheet.addRow(row);
    r.height = 24;
    r.eachCell(c => {
      c.border = THIN_BORDER;
      c.font = { name: 'Cairo', size: 10, bold: true, color: { argb: 'FF0F172A' } };
      c.alignment = { vertical: 'middle', horizontal: 'center' };
    });
  });

  // Section 2: Office rankings
  worksheet.addRow([]);
  const sec2 = worksheet.addRow(['ثانياً: جدول تصنيف ومقارنة أداء المكاتب الفرعية']);
  sec2.font = { name: 'Cairo', size: 11, bold: true, color: { argb: 'FF002855' } };

  const officeTableHeaders = [
    'الترتيب',
    'المكتب الفرعي',
    'رمز المكتب',
    'إجمالي الأوامر',
    'مؤهل 155',
    'نواقص/معلق',
    'نسبة الإنجاز',
    'الإرفاق والصور',
    'ملاحظات الجودة',
    'تقييم الجودة',
    'التقييم الإداري'
  ];

  const offHeadersRow = worksheet.addRow(officeTableHeaders);
  offHeadersRow.height = 28;
  offHeadersRow.eachCell(c => {
    c.font = { name: 'Cairo', size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF002855' } };
    c.border = HEADER_BORDER;
    c.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  const rankingsStartRow = worksheet.rowCount;

  params.officeAchievements.forEach(o => {
    const r = worksheet.addRow([
      o.rank,
      o.officeName,
      o.code,
      o.total,
      o.ready,
      o.pending,
      `${o.completionRate}%`,
      `${o.photosRate}%`,
      `${o.boqCount} أمر`,
      `${o.score}/100`,
      o.evaluation
    ]);
    r.height = 24;
    r.eachCell((c, colIdx) => {
      c.border = THIN_BORDER;
      c.font = { name: 'Cairo', size: 10, bold: true, color: { argb: 'FF0F172A' } };
      c.alignment = { vertical: 'middle', horizontal: 'center' };

      if (colIdx === 2) {
        c.alignment = { vertical: 'middle', horizontal: 'right' };
      } else if (colIdx === 5) {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
        c.font = { name: 'Cairo', size: 10, bold: true, color: { argb: 'FF065F46' } };
      } else if (colIdx === 6) {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
        c.font = { name: 'Cairo', size: 10, bold: true, color: { argb: 'FF991B1B' } };
      }
    });
  });

  // Enable AutoFilter on the office achievements table
  if (params.officeAchievements.length > 0) {
    worksheet.autoFilter = {
      from: { row: rankingsStartRow - 1, column: 1 },
      to: { row: worksheet.rowCount, column: officeTableHeaders.length }
    };
  }

  // Footer Row
  worksheet.addRow([]);
  const footerRow = worksheet.addRow([
    `حوكمة جودة أعمال الإنشاءات • التقرير الأسبوعي الرسمي لإجراء 155`
  ]);
  const footRowNum = worksheet.rowCount;
  worksheet.mergeCells(`A${footRowNum}:K${footRowNum}`);
  footerRow.height = 24;
  const cellFoot = worksheet.getCell(`A${footRowNum}`);
  cellFoot.font = { name: 'Cairo', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
  cellFoot.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B132B' } };
  cellFoot.alignment = { vertical: 'middle', horizontal: 'center' };

  // Column widths
  [8, 24, 14, 16, 16, 16, 16, 16, 16, 16, 20].forEach((w, i) => {
    worksheet.getColumn(i + 1).width = w;
  });

  // A4 Landscape Print & View Page Setup
  worksheet.pageSetup = {
    orientation: 'landscape',
    paperSize: 9,
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: {
      left: 0.3,
      right: 0.3,
      top: 0.4,
      bottom: 0.4,
      header: 0.2,
      footer: 0.2
    }
  };

  await downloadExcelWorkbook(workbook, filename);
}

/**
 * Export to PowerPoint presentation with 16:9 widescreen slides,
 * dynamic content-aware page-filling (no rigid arbitrary row limit),
 * adaptive row heights and typography that expand to fill the available page space,
 * and complete 12-column coverage.
 */
export function buildPptxPresentation(
  orders: WorkOrder[],
  officeTitle: string = 'جميع المكاتب',
  columns?: ColumnDefinition[]
): pptxgen {
  const pptx = new pptxgen();
  
  // Modern 16:9 widescreen layout: 13.333 inches width x 7.500 inches height
  pptx.layout = 'LAYOUT_WIDE';
  pptx.rtlMode = true;

  // Slide 1: Prestigious Executive Cover Slide
  const coverSlide = pptx.addSlide();
  coverSlide.background = { color: '002855' }; // Deep corporate navy

  // Accent Line at Top
  coverSlide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 13.33,
    h: 0.12,
    fill: { color: 'F58220' }
  });

  // Main Header Block
  coverSlide.addText('إدارة كهرباء الحدود الشمالية • المساندة الفنية', {
    x: 0.8,
    y: 0.55,
    w: 11.73,
    h: 0.35,
    fontSize: 14,
    color: 'BFDBFE',
    align: 'center'
  });

  coverSlide.addText('حوكمة جودة أعمال الإنشاءات • منظومة إجراء 155', {
    x: 0.8,
    y: 0.95,
    w: 11.73,
    h: 0.75,
    fontSize: 28,
    color: 'FDB813',
    bold: true,
    align: 'center'
  });

  coverSlide.addText('منظومة التدقيق الميداني والامتثال الفني لأوامر العمل • إجراء 155', {
    x: 0.8,
    y: 1.80,
    w: 11.73,
    h: 0.6,
    fontSize: 20,
    color: 'FFFFFF',
    bold: true,
    align: 'center'
  });

  coverSlide.addText(`ادارة الجودة والمساندة الفنية | نطاق التقرير: ${officeTitle}`, {
    x: 0.8,
    y: 2.50,
    w: 11.73,
    h: 0.4,
    fontSize: 13.5,
    color: '38BDF8',
    align: 'center'
  });

  // KPI Summary Cards on Slide 1
  const readyCount = orders.filter(w => {
    const s = String(w.procedure155Status || '');
    return s.includes('مؤهل') && !s.includes('غير');
  }).length;
  const notReadyCount = orders.length - readyCount;
  const qualityRate = orders.length > 0 ? Math.round((readyCount / orders.length) * 100) : 0;

  coverSlide.addTable([
    [
      { text: `إجمالي أوامر العمل\n${orders.length} أمر عمل`, options: { fill: { color: '1E293B' }, color: 'FFFFFF', fontSize: 13, bold: true, align: 'center' as const } },
      { text: `مؤهلة لإجراء 155 (معتمد)\n${readyCount} أمر عمل`, options: { fill: { color: '065F46' }, color: 'FFFFFF', fontSize: 13, bold: true, align: 'center' as const } },
      { text: `غير مؤهلة لإجراء 155\n${notReadyCount} أمر عمل`, options: { fill: { color: '991B1B' }, color: 'FFFFFF', fontSize: 13, bold: true, align: 'center' as const } },
      { text: `مؤشر الامتثال والجودة\n${qualityRate}% مطابقة`, options: { fill: { color: '1E3A8A' }, color: 'FFFFFF', fontSize: 13, bold: true, align: 'center' as const } }
    ]
  ], {
    x: 1.0,
    y: 3.25,
    w: 11.33,
    colW: [2.83, 2.83, 2.83, 2.83],
    margin: 0.12
  });

  // Executive Badge Strip
  coverSlide.addText(`نظام التدقيق الرقمي الموحد • وثيقة رقمية معتمدة آلياً بدون توقيع يدوي • كود المطابقة: QC-155-${Date.now().toString().slice(-6)}`, {
    x: 0.8,
    y: 5.15,
    w: 11.73,
    h: 0.4,
    fontSize: 11.5,
    color: 'CBD5E1',
    align: 'center'
  });

  // Footer / Attributions
  coverSlide.addText(`تاريخ التصدير: ${new Date().toLocaleDateString('ar-SA')} | حوكمة جودة أعمال الإنشاءات - منظومة إجراء 155`, {
    x: 0.8,
    y: 6.6,
    w: 11.73,
    h: 0.45,
    fontSize: 11,
    color: '94A3B8',
    align: 'center'
  });

  // -------------------------------------------------------------------------
  // Adaptive Dynamic Page-Fitting Algorithm:
  // Dynamically calculates row weights according to content density and notes length,
  // filling each slide harmoniously and scaling row height & font sizes to the available slide bounds!
  // -------------------------------------------------------------------------
  const chunks: WorkOrder[][] = [];
  if (orders.length === 0) {
    chunks.push([]);
  } else {
    let currentChunk: WorkOrder[] = [];
    let currentWeight = 0;
    // Target capacity weight per slide (allows 9 to 12 rows of normal/medium content)
    const targetSlideWeight = 11.0;

    for (let i = 0; i < orders.length; i++) {
      const wo = orders[i];
      const notesClean = (wo.qualityNotes || wo.executionNotes || '').trim();
      const noteLen = notesClean.length;
      
      // Dynamic content vertical weight
      let rowWeight = 1.0;
      if (noteLen > 110) {
        rowWeight = 1.6;
      } else if (noteLen > 55) {
        rowWeight = 1.3;
      } else if (noteLen > 25) {
        rowWeight = 1.15;
      }

      if (currentWeight + rowWeight > targetSlideWeight && currentChunk.length >= 5) {
        chunks.push(currentChunk);
        currentChunk = [wo];
        currentWeight = rowWeight;
      } else {
        currentChunk.push(wo);
        currentWeight += rowWeight;
      }
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }
  }

  const totalSlides = Math.max(1, chunks.length);

  // Exact 15 columns (# + 14 canonical columns) summing to 12.50 inches (centered on 13.33" slide with 0.415" margins)
  const colW15 = [0.35, 0.75, 0.95, 0.95, 0.85, 0.65, 0.70, 0.80, 1.35, 0.85, 0.85, 0.95, 0.85, 0.85, 0.80];

  let cumulativeRowIndex = 0;

  for (let cIdx = 0; cIdx < chunks.length; cIdx++) {
    const chunk = chunks[cIdx];
    const slideNum = cIdx + 1;
    const rowCount = chunk.length;

    const slide = pptx.addSlide();
    slide.background = { color: 'F8FAFC' };

    // Slide Top Header Bar
    slide.addText(`حوكمة جودة أعمال الإنشاءات • سجل تدقيق أوامر العمل وإجراء 155 - ${officeTitle}`, {
      x: 0.415,
      y: 0.22,
      w: 8.5,
      h: 0.38,
      fontSize: 12.5,
      bold: true,
      color: '0F172A',
      align: 'right'
    });

    slide.addText(`شريحة ${slideNum} من ${totalSlides} | ${new Date().toLocaleDateString('ar-SA')}`, {
      x: 8.9,
      y: 0.22,
      w: 4.0,
      h: 0.38,
      fontSize: 10.5,
      bold: true,
      color: '64748B',
      align: 'left'
    });

    // Amber accent bar
    slide.addShape(pptx.ShapeType.rect, {
      x: 0.415,
      y: 0.63,
      w: 12.50,
      h: 0.03,
      fill: { color: 'F58220' }
    });

    // Dynamic Vertical Sizing Budget:
    // Available height: from y = 0.68 to y = 7.05 => 6.37 inches
    const maxTableHeight = 6.35;
    const headerHeight = 0.40;
    const availableDataHeight = maxTableHeight - headerHeight; // 5.95 inches

    const rawRowHeight = rowCount > 0 ? availableDataHeight / rowCount : 0.50;
    const clampedRowHeight = Math.min(0.85, Math.max(0.38, rawRowHeight));
    const calculatedTableHeight = headerHeight + (clampedRowHeight * rowCount);
    
    // Vertically center the table smoothly within the available space
    const startY = 0.68 + Math.max(0, (maxTableHeight - calculatedTableHeight) / 2);

    // Dynamic Font & Margin Scaling based on row height
    let dynamicFontSize = 7.8;
    let dynamicHeaderFontSize = 8.5;
    let dynamicNotesFontSize = 7.5;
    let dynamicCellMargin = 0.05;

    if (rowCount <= 6) {
      dynamicFontSize = 8.8;
      dynamicHeaderFontSize = 9.2;
      dynamicNotesFontSize = 8.5;
      dynamicCellMargin = 0.08;
    } else if (rowCount <= 9) {
      dynamicFontSize = 8.2;
      dynamicHeaderFontSize = 8.8;
      dynamicNotesFontSize = 7.8;
      dynamicCellMargin = 0.06;
    }

    // Exact 14 canonical Arabic table headers (+ # sequence column) with Corporate Navy (#002855)
    const tableHeader = [
      { text: '#', options: { bold: true, fill: { color: '002855' }, color: 'FDB813', align: 'center' as const, fontSize: dynamicHeaderFontSize } },
      { text: 'المكتب', options: { bold: true, fill: { color: '002855' }, color: 'FFFFFF', align: 'center' as const, fontSize: dynamicHeaderFontSize } },
      { text: 'المقاول', options: { bold: true, fill: { color: '002855' }, color: 'FFFFFF', align: 'center' as const, fontSize: dynamicHeaderFontSize } },
      { text: 'الاستشاري', options: { bold: true, fill: { color: '002855' }, color: 'FFFFFF', align: 'center' as const, fontSize: dynamicHeaderFontSize } },
      { text: 'رقم امر العمل', options: { bold: true, fill: { color: '002855' }, color: 'FFFFFF', align: 'center' as const, fontSize: dynamicHeaderFontSize } },
      { text: 'نوع امر العمل', options: { bold: true, fill: { color: '002855' }, color: 'FFFFFF', align: 'center' as const, fontSize: dynamicHeaderFontSize } },
      { text: 'ملف الصور', options: { bold: true, fill: { color: '002855' }, color: 'FFFFFF', align: 'center' as const, fontSize: dynamicHeaderFontSize } },
      { text: 'حالة الارفاق', options: { bold: true, fill: { color: '002855' }, color: 'FFFFFF', align: 'center' as const, fontSize: dynamicHeaderFontSize } },
      { text: 'الملاحظات', options: { bold: true, fill: { color: '002855' }, color: 'FFFFFF', align: 'center' as const, fontSize: dynamicHeaderFontSize } },
      { text: 'تدقيق PDC', options: { bold: true, fill: { color: '002855' }, color: 'FFFFFF', align: 'center' as const, fontSize: dynamicHeaderFontSize } },
      { text: 'تدقيق الانشاءات', options: { bold: true, fill: { color: '002855' }, color: 'FFFFFF', align: 'center' as const, fontSize: dynamicHeaderFontSize } },
      { text: 'تدقيق المساندة الفنية', options: { bold: true, fill: { color: '002855' }, color: 'FFFFFF', align: 'center' as const, fontSize: dynamicHeaderFontSize } },
      { text: 'مزامنة التدقيق', options: { bold: true, fill: { color: '002855' }, color: 'FFFFFF', align: 'center' as const, fontSize: dynamicHeaderFontSize } },
      { text: 'حالة إجراء 155', options: { bold: true, fill: { color: '002855' }, color: 'FFFFFF', align: 'center' as const, fontSize: dynamicHeaderFontSize } },
      { text: 'مزامنة إجراء 155', options: { bold: true, fill: { color: '002855' }, color: 'FFFFFF', align: 'center' as const, fontSize: dynamicHeaderFontSize } }
    ];

    const tableRows = chunk.map((wo, idx) => {
      const globalIdx = cumulativeRowIndex + idx + 1;
      const isEven = idx % 2 === 0;
      const isEdited = Boolean(wo.isEdited);
      const bgColor = isEdited ? 'FEE2E2' : isEven ? 'FFFFFF' : 'F8FAFC';
      const textColor = isEdited ? '991B1B' : '0F172A';
      
      const cleanNote = (wo.qualityNotes || wo.executionNotes || '').trim();
      const hasNote = cleanNote !== '-' && cleanNote !== '' && cleanNote !== 'لا توجد ملاحظات حالياً' && cleanNote !== 'لا توجد ملاحظات';

      const files = Array.isArray((wo as any).photosFile) ? (wo as any).photosFile : [];
      const photosLabel = files.length > 0 ? `${files.length} مرفق` : 'SharePoint';
      const attachStatus = (wo.attachmentStatus || '').trim();
      const isAttachComplete = attachStatus === 'مكتمل' || attachStatus === 'جاهز للارفاق الكامل';

      const pdcMain = formatOrderAudit18SummaryText((wo as any).pdcAudit).mainStatus;
      const isPdcQual = pdcMain.includes('مؤهل') && !pdcMain.includes('غير');

      const constMain = formatOrderAudit18SummaryText((wo as any).constructionAudit).mainStatus;
      const isConstQual = constMain.includes('مؤهل') && !constMain.includes('غير');

      const rawStatusVal = String(wo.procedure155Status || '').trim();
      const statusVal = rawStatusVal === 'قيد التدقيق' || rawStatusVal === 'غير محدد' ? '' : rawStatusVal;
      const is155Qualified = statusVal.includes('مؤهل') && !statusVal.includes('غير');

      const procVal = String(wo.procedure155 || '').trim();
      const isProcQual = procVal.includes('مؤهل') && !procVal.includes('غير');

      const statusSyncVal = wo.statusSyncTime ? String(wo.statusSyncTime).split('|')[0]?.trim() : '';
      const procSyncVal = wo.procedureSyncTime ? String(wo.procedureSyncTime).split('|')[0]?.trim() : '';

      return [
        { text: isEdited ? `${globalIdx} (مُعدّل)` : String(globalIdx), options: { fill: { color: bgColor }, color: isEdited ? '991B1B' : '475569', fontSize: dynamicFontSize, align: 'center' as const, bold: true } },
        { text: wo.office || '-', options: { fill: { color: bgColor }, color: textColor, fontSize: dynamicFontSize, align: 'center' as const, bold: true } },
        { text: wo.contractor || '-', options: { fill: { color: bgColor }, color: textColor, fontSize: dynamicFontSize, align: 'right' as const } },
        { text: wo.consultant || '-', options: { fill: { color: bgColor }, color: textColor, fontSize: dynamicFontSize, align: 'right' as const } },
        { text: wo.workOrderNumber || '-', options: { fill: { color: bgColor }, color: isEdited ? '991B1B' : '1E40AF', fontSize: dynamicFontSize, align: 'center' as const, bold: true } },
        { text: wo.workOrderCode || '-', options: { fill: { color: bgColor }, color: textColor, fontSize: dynamicFontSize, align: 'center' as const } },
        { text: photosLabel, options: { fill: { color: bgColor }, color: '065F46', fontSize: dynamicFontSize, align: 'center' as const, bold: true } },
        { text: attachStatus, options: { fill: { color: !attachStatus ? bgColor : isAttachComplete ? 'D1FAE5' : 'FEE2E2' }, color: !attachStatus ? textColor : isAttachComplete ? '065F46' : '991B1B', fontSize: dynamicFontSize, bold: true, align: 'center' as const } },
        { text: hasNote ? cleanNote : '', options: { fill: { color: hasNote ? 'FFF1F2' : bgColor }, color: hasNote ? 'B91C1C' : '64748B', fontSize: dynamicNotesFontSize, align: 'right' as const, bold: hasNote } },
        { text: pdcMain, options: { fill: { color: !pdcMain ? bgColor : isPdcQual ? 'D1FAE5' : 'FEF3C7' }, color: !pdcMain ? textColor : isPdcQual ? '065F46' : '92400E', fontSize: dynamicFontSize, bold: true, align: 'center' as const } },
        { text: constMain, options: { fill: { color: !constMain ? bgColor : isConstQual ? 'D1FAE5' : 'FEF3C7' }, color: !constMain ? textColor : isConstQual ? '065F46' : '92400E', fontSize: dynamicFontSize, bold: true, align: 'center' as const } },
        { text: statusVal, options: { fill: { color: !statusVal ? bgColor : is155Qualified ? 'D1FAE5' : 'FEE2E2' }, color: !statusVal ? textColor : is155Qualified ? '065F46' : '991B1B', fontSize: dynamicFontSize, bold: true, align: 'center' as const } },
        { text: statusSyncVal, options: { fill: { color: bgColor }, color: '334155', fontSize: dynamicFontSize * 0.9, align: 'center' as const } },
        { text: procVal, options: { fill: { color: !procVal ? bgColor : isProcQual ? 'DBEAFE' : 'FEE2E2' }, color: !procVal ? textColor : isProcQual ? '1E40AF' : '991B1B', fontSize: dynamicFontSize, bold: true, align: 'center' as const } },
        { text: procSyncVal, options: { fill: { color: bgColor }, color: '334155', fontSize: dynamicFontSize * 0.9, align: 'center' as const } }
      ];
    });

    cumulativeRowIndex += chunk.length;

    // Render Table strictly contained within wide bounds
    slide.addTable([tableHeader, ...tableRows], {
      x: 0.415,
      y: startY,
      w: 12.50,
      colW: colW15,
      margin: dynamicCellMargin,
      rowH: [headerHeight, ...Array(chunk.length).fill(clampedRowHeight)]
    });

    // Slide Footer Bar
    slide.addText(`حوكمة جودة أعمال الإنشاءات • مستند رقمي رسمي معتمد آلياً بنظام إجراء 155 دون الحاجة إلى توقيع يدوي`, {
      x: 0.415,
      y: 7.10,
      w: 12.50,
      h: 0.30,
      fontSize: 9.5,
      color: '64748B',
      align: 'center'
    });
  }

  return pptx;
}

export async function exportToPptx(
  orders: WorkOrder[],
  officeTitle: string = 'جميع المكاتب',
  filename: string = 'عرض_تدقيق_155.pptx',
  columns?: ColumnDefinition[]
) {
  const pptx = buildPptxPresentation(orders, officeTitle, columns);
  await pptx.writeFile({ fileName: filename });
}

export async function exportPptxToBase64(
  orders: WorkOrder[],
  officeTitle: string = 'جميع المكاتب',
  columns?: ColumnDefinition[]
): Promise<string> {
  const pptx = buildPptxPresentation(orders, officeTitle, columns);
  const result = await pptx.write({ outputType: 'base64' });
  return typeof result === 'string' ? result : '';
}

/**
 * Export Work Orders to a standard CSV file with UTF-8 BOM for perfect Arabic display in Excel.
 */
export function exportToCsv(
  orders: WorkOrder[],
  officeTitle: string = 'جميع المكاتب',
  filename: string = 'سجل_أوامر_العمل_إجراء_155.csv',
  columns?: ColumnDefinition[]
) {
  const canonicalCols = ensurePhotosFileColumn(columns);
  const activeCols: ExportColDef[] = canonicalCols.map(c => ({
    key: c.field,
    title: c.title,
    width: 20
  }));

  const headers = ['م', ...activeCols.map(c => c.title)];

  const escapeCsv = (val: any) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = orders.map((wo, idx) => {
    const rowVals: any[] = [idx + 1];
    activeCols.forEach(col => {
      let val = (wo as any)[col.key];
      if (col.key === 'photosFile') {
        const files = Array.isArray((wo as any).photosFile) ? (wo as any).photosFile : [];
        val = files.length > 0 ? `${files.length} مرفق (SharePoint)` : 'SharePoint';
      } else if (col.key === 'pdcAudit' || col.key === 'constructionAudit') {
        const rawAudit = (wo as any)[col.key];
        val = formatOrderAudit18SummaryText(rawAudit).compactBadgeText;
      } else if (val === undefined || val === null || val === '') {
        if (wo.customFields && (wo.customFields as any)[col.key] !== undefined) {
          val = (wo.customFields as any)[col.key];
        } else {
          val = '';
        }
      }
      if (col.key === 'procedure155Status' && (val === 'قيد التدقيق' || val === 'غير محدد')) {
        val = '';
      }
      rowVals.push(val);
    });
    return rowVals;
  });

  const agg18 = calculateAggregate18ChecklistsCompliance(orders);
  const summaryRows: any[][] = [
    [],
    ['ملخص الامتثال للقوائم الـ 18 ونسبة المطابقة الفعلية', `نطاق التقرير: ${officeTitle}`, `إجمالي الأوامر: ${orders.length}`, `نسبة المطابقة الفعلية الشاملة: ${agg18.actualComplianceRate}%`, `امتثال القوائم الـ 18 (PDC): ${agg18.pdcComplianceRate}%`, `امتثال القوائم الـ 18 (الإنشاءات): ${agg18.constComplianceRate}%`, `جاهزية 155: ${agg18.ready155Rate}%`],
    ['رقم القائمة', 'اسم القائمة (18 قائمة)', 'عدد البنود (197 بند)', 'PDC مقيم', 'PDC ممتثل', 'PDC نسبة الامتثال', 'الإنشاءات مقيم', 'الإنشاءات ممتثل', 'الإنشاءات نسبة الامتثال'],
    ...agg18.categoriesBreakdown.map((c, idx) => [
      idx + 1,
      c.title,
      `${c.itemCount} بند`,
      c.pdcEvaluatedOrders,
      c.pdcCompliantOrders,
      `${c.pdcComplianceRate}%`,
      c.constEvaluatedOrders,
      c.constCompliantOrders,
      `${c.constComplianceRate}%`
    ])
  ];

  const csvContent = '\uFEFF' + [
    headers.map(escapeCsv).join(','),
    ...rows.map(row => row.map(escapeCsv).join(',')),
    ...summaryRows.map(row => row.map(escapeCsv).join(','))
  ].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Convert ArrayBuffer to base64 string
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Generate PDF as base64 string
 */
export async function exportPdfToBase64(
  target: string | HTMLElement | HTMLElement[],
  orders: WorkOrder[] = [],
  officeTitle: string = 'جميع المكاتب',
  options: ExportPdfOptions = {},
  columns?: ColumnDefinition[]
): Promise<string> {
  const orientation = options.orientation || 'landscape';
  const format = options.format || 'a4';
  const margin = options.marginMm ?? 0;

  let elements: HTMLElement[] = [];
  if (Array.isArray(target)) {
    elements = target.filter(Boolean);
  } else if (target instanceof HTMLElement && target.id !== 'root') {
    const sheets = target.querySelectorAll<HTMLElement>('.export-page-sheet');
    elements = sheets.length > 0 ? Array.from(sheets) : [target];
  } else if (typeof target === 'string' && target !== '#root' && target !== 'root') {
    const cleanId = target.startsWith('#') ? target.slice(1) : target;
    const singleEl = document.getElementById(cleanId);
    if (singleEl) {
      const sheets = singleEl.querySelectorAll<HTMLElement>('.export-page-sheet');
      elements = sheets.length > 0 ? Array.from(sheets) : [singleEl];
    }
  }

  let offscreenContainer: HTMLElement | null = null;
  if (elements.length === 0 && orders && orders.length > 0) {
    offscreenContainer = createOffscreenExportContainer(orders, officeTitle, columns);
    document.body.appendChild(offscreenContainer);
    await new Promise(r => setTimeout(r, 150));
    const sheets = offscreenContainer.querySelectorAll<HTMLElement>('.export-page-sheet');
    elements = sheets.length > 0 ? Array.from(sheets) : [offscreenContainer];
  }

  if (elements.length === 0) {
    if (offscreenContainer && document.body.contains(offscreenContainer)) {
      document.body.removeChild(offscreenContainer);
    }
    throw new Error('لم يتم العثور على صفحات التقرير لتجهيز ملف PDF');
  }

  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format,
    compress: true
  });

  try {
    for (let i = 0; i < elements.length; i++) {
      const pageEl = elements[i];
      const captured = await captureElementWithDimensions(pageEl, 'jpeg');
      addCapturedImageToPdf(pdf, captured, i, format, orientation, margin);
    }
    return pdf.output('datauristring');
  } finally {
    if (offscreenContainer && document.body.contains(offscreenContainer)) {
      document.body.removeChild(offscreenContainer);
    }
  }
}

/**
 * Dispatch exported file by email via server API (with full session + fallback auth headers)
 */
export async function sendExportByEmail(request: {
  recipients: { email: string; name: string; username?: string; roleTitle?: string }[];
  exportType: 'pdf' | 'excel' | 'pptx' | 'image' | 'csv';
  fileName: string;
  fileBase64?: string;
  fileMime?: string;
  subject?: string;
  customMessage?: string;
  senderName?: string;
  senderEmail?: string;
  officeTitle?: string;
  ordersCount?: number;
  readyCount?: number;
  notesCount?: number;
}) {
  const res = await fetch('/api/export/send-email', {
    method: 'POST',
    headers: getAuthHeaders({
      'Content-Type': 'application/json'
    }),
    body: JSON.stringify(request)
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'فشل إرسال البريد الإلكتروني');
  }
  return data;
}
