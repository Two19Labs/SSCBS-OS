import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

/**
 * Sanitizes filenames for safe browser download.
 */
const sanitizeFileName = (name) => {
  return (name || 'SSCBS_Schedule')
    .replace(/[^a-zA-Z0-9_\-\s]/g, '')
    .trim()
    .replace(/\s+/g, '_');
};

/**
 * Clean non-destructive CSS rules that unclip scroll wrappers and reset sticky positioning
 * while preserving 100% of the active page's computed colors, backgrounds, text styles, and theme.
 */
const EXPORT_PRESERVE_THEME_CSS = `
  /* Unclip table scroll containers */
  .spacious-weekly-grid-container, .table-responsive, .page-view-content-wrapper, .spacious-timeline-wrapper, .weekly-modal-body {
    overflow: visible !important;
    overflow-x: visible !important;
    overflow-y: visible !important;
    max-width: none !important;
    max-height: none !important;
    height: auto !important;
  }

  /* Force table full width and unclipped layout */
  .spacious-weekly-grid, .weekly-timetable-table {
    width: 100% !important;
    border-collapse: collapse !important;
    table-layout: fixed !important;
  }

  .spacious-weekly-grid th, .weekly-timetable-table th,
  .spacious-weekly-grid td, .weekly-timetable-table td {
    height: auto !important;
  }

  /* Reset sticky positioning during capture so sticky headers don't freeze or overlap */
  .sticky-corner-cell, .day-name-cell, .sticky-day-col, .corner-sticky {
    position: static !important;
    box-shadow: none !important;
  }

  /* Typography Normalization: Clean word wrapping without letter-by-letter vertical breaking */
  .cell-card-subject, .cell-subject, .timeline-subject, .class-card-top h5 {
    white-space: normal !important;
    word-break: normal !important;
    overflow-wrap: break-word !important;
  }

  .cell-card-classes, .class-card-subtitle, .timeline-card-meta, .cell-teacher, .cell-room, .cell-card-room, .class-card-room-badge, .room-tag {
    white-space: nowrap !important;
    word-break: normal !important;
  }
`;

/**
 * Gets the computed background color of an element or its nearest non-transparent ancestor.
 */
const getEffectiveBackgroundColor = (el) => {
  let curr = el;
  while (curr && curr !== document.documentElement) {
    const bg = window.getComputedStyle(curr).backgroundColor;
    if (bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') {
      return bg;
    }
    curr = curr.parentElement;
  }
  return '#ffffff'; // Fallback
};

/**
 * Captures a DOM element with 100% full un-clipped scroll width,
 * preserving exact computed theme colors from the live DOM screen.
 * 
 * @param {HTMLElement} element - Target DOM node to capture.
 * @returns {Promise<HTMLCanvasElement>} Rendered canvas element.
 */
export const captureScheduleCanvas = async (element) => {
  if (!element) {
    throw new Error('Target element for schedule capture was not found.');
  }

  // Find inner table or grid to calculate true unclipped scroll width
  const innerTable = element.querySelector('table, .spacious-weekly-grid, .weekly-timetable-table, .spacious-timeline-list');
  let scrollW = element.scrollWidth;
  if (innerTable && innerTable.scrollWidth > scrollW) {
    scrollW = innerTable.scrollWidth;
  }
  const captureWidth = Math.max(scrollW, 1350);

  // Measure active element computed background color (preserves exact light/dark mode theme!)
  const computedBg = getEffectiveBackgroundColor(element);

  const canvas = await html2canvas(element, {
    scale: 2, // 2x DPI for ultra-sharp text
    useCORS: true,
    allowTaint: true,
    backgroundColor: computedBg,
    logging: false,
    width: captureWidth,
    windowWidth: captureWidth + 100,
    onclone: (clonedDoc, clonedElement) => {
      // Inject non-destructive layout unclipping stylesheet
      const styleEl = clonedDoc.createElement('style');
      styleEl.textContent = EXPORT_PRESERVE_THEME_CSS;
      clonedDoc.head.appendChild(styleEl);

      // Force top cloned wrapper to expand to full capture width while hugging exact content height
      clonedElement.style.position = 'relative';
      clonedElement.style.left = '0';
      clonedElement.style.top = '0';
      clonedElement.style.visibility = 'visible';
      clonedElement.style.opacity = '1';
      clonedElement.style.display = 'block';
      clonedElement.style.width = captureWidth + 'px';
      clonedElement.style.maxWidth = 'none';
      clonedElement.style.overflow = 'visible';
      clonedElement.style.height = 'auto';
      clonedElement.style.minHeight = '0';
      clonedElement.style.backgroundColor = computedBg;
      clonedElement.style.padding = '16px';
      clonedElement.style.margin = '0';
      clonedElement.style.boxSizing = 'border-box';

      // Unclip all overflow wrappers in cloned document
      const allChildren = clonedElement.querySelectorAll('*');
      allChildren.forEach(node => {
        const s = window.getComputedStyle(node);
        if (s.overflowX === 'auto' || s.overflowX === 'scroll' || s.overflowY === 'auto' || s.overflowY === 'scroll' || s.overflow === 'hidden') {
          node.style.overflow = 'visible';
          node.style.overflowX = 'visible';
          node.style.overflowY = 'visible';
          node.style.maxHeight = 'none';
          node.style.height = 'auto';
        }

        // Expand tables to full capture width
        if (node.tagName === 'TABLE' || node.classList.contains('spacious-weekly-grid') || node.classList.contains('weekly-timetable-table')) {
          node.style.width = '100%';
          node.style.minWidth = (captureWidth - 32) + 'px';
          node.style.tableLayout = 'fixed';
        }

        // Reset sticky positioning so sticky headers/day columns don't freeze or overlap when expanded
        if (node.classList.contains('sticky-day-col') || node.classList.contains('corner-sticky') || node.classList.contains('sticky-corner-cell') || node.classList.contains('day-name-cell')) {
          node.style.position = 'static';
          node.style.boxShadow = 'none';
        }
      });

      // Remove non-exportable buttons or timewarp debugger panels inside clone
      const nonExportables = clonedElement.querySelectorAll('.prof-page-debugger, .btn-toggle-debugger-page');
      nonExportables.forEach(el => el.remove());
    }
  });

  return canvas;
};

/**
 * Exports a schedule or timetable element as a high-resolution unclipped PNG image.
 */
export const exportScheduleAsImage = async ({
  element,
  title = 'Schedule',
  fileName
}) => {
  try {
    const canvas = await captureScheduleCanvas(element);
    const dataUrl = canvas.toDataURL('image/png', 1.0);

    const cleanName = sanitizeFileName(fileName || `${title}_SSCBS_Schedule`);
    const downloadLink = document.createElement('a');
    downloadLink.download = `${cleanName}.png`;
    downloadLink.href = dataUrl;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);

    return true;
  } catch (err) {
    console.error('Failed to export schedule image:', err);
    throw err;
  }
};

/**
 * Exports a schedule or timetable element as a clean, landscape-fitted A4 PDF document.
 */
export const exportScheduleAsPDF = async ({
  element,
  title = 'Schedule',
  fileName
}) => {
  try {
    const canvas = await captureScheduleCanvas(element);
    const imgData = canvas.toDataURL('image/png', 1.0);

    // Standard A4 landscape dimensions in mm (297mm x 210mm)
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = pdf.internal.pageSize.getWidth(); // 297 mm
    const pageHeight = pdf.internal.pageSize.getHeight(); // 210 mm
    const margin = 8; // 8mm margins

    const maxPdfWidth = pageWidth - (margin * 2);
    const maxPdfHeight = pageHeight - (margin * 2);

    const imgRatio = canvas.width / canvas.height;
    let renderWidth = maxPdfWidth;
    let renderHeight = maxPdfWidth / imgRatio;

    if (renderHeight > maxPdfHeight) {
      renderHeight = maxPdfHeight;
      renderWidth = maxPdfHeight * imgRatio;
    }

    const xOffset = (pageWidth - renderWidth) / 2;
    const yOffset = (pageHeight - renderHeight) / 2;

    pdf.addImage(imgData, 'PNG', xOffset, yOffset, renderWidth, renderHeight);

    const cleanName = sanitizeFileName(fileName || `${title}_SSCBS_Schedule`);
    pdf.save(`${cleanName}.pdf`);

    return true;
  } catch (err) {
    console.error('Failed to export schedule PDF:', err);
    throw err;
  }
};
