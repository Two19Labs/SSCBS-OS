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
 * High-Contrast Pristine Export Theme Overrides.
 * Covers both Find My Professor and Student Home Dashboard timetables.
 * Ensures crisp white card titles, zero text truncation, rose/emerald badges,
 * and high contrast dark slate backgrounds across all PNG and PDF exports.
 */
const EXPORT_HIGH_CONTRAST_CSS = `
  /* High-Contrast Pristine Export Theme Overrides */
  body, .sscbs-export-root, .page-view-content-wrapper, .spacious-timeline-wrapper, .spacious-weekly-grid-container, .weekly-modal-body {
    background-color: #0f172a !important;
    color: #f8fafc !important;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
  }

  /* Timeline View Left Labels */
  .timeline-row-time {
    color: #cbd5e1 !important;
  }
  .timeline-row-time .period-label {
    color: #818cf8 !important;
    font-weight: 800 !important;
    font-size: 0.725rem !important;
  }
  .timeline-row-time .time-range-label {
    color: #f8fafc !important;
    font-weight: 700 !important;
    font-size: 0.8rem !important;
  }
  .spacious-timeline-row {
    border-left: 2px solid #334155 !important;
  }

  /* Weekly Timetable Table Grid */
  .spacious-weekly-grid-container, .table-responsive {
    background-color: #0f172a !important;
    border: 1px solid #334155 !important;
    border-radius: 12px !important;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4) !important;
  }

  .spacious-weekly-grid, .weekly-timetable-table {
    width: 100% !important;
    border-collapse: collapse !important;
  }

  .spacious-weekly-grid th, .weekly-timetable-table th {
    background-color: #1e293b !important;
    border-bottom: 2px solid #334155 !important;
    border-right: 1px solid #334155 !important;
    color: #f8fafc !important;
    padding: 12px 8px !important;
  }
  
  .weekly-th-period, .th-period-label {
    color: #818cf8 !important;
    font-weight: 800 !important;
    font-size: 0.725rem !important;
    letter-spacing: 0.5px !important;
  }

  .weekly-th-time, .th-time-label {
    color: #94a3b8 !important;
    font-size: 0.65rem !important;
  }

  .spacious-weekly-grid td, .weekly-timetable-table td {
    border-bottom: 1px solid #334155 !important;
    border-right: 1px solid #334155 !important;
    color: #f8fafc !important;
    padding: 10px 8px !important;
    height: auto !important;
    vertical-align: middle !important;
    white-space: normal !important;
  }

  .sticky-day-col, .day-name-cell {
    background-color: #1e293b !important;
    color: #818cf8 !important;
    font-weight: 800 !important;
    font-size: 0.75rem !important;
    text-transform: uppercase !important;
    border-right: 2px solid #334155 !important;
  }

  .today-row .day-name-cell, .today-row-highlight .sticky-day-col {
    color: #f87171 !important;
  }

  .today-badge {
    background-color: #ef4444 !important;
    color: #ffffff !important;
    font-weight: 800 !important;
    font-size: 0.55rem !important;
    padding: 1px 5px !important;
    border-radius: 3px !important;
    margin-top: 2px !important;
    display: inline-block !important;
  }

  /* Occupied Grid Cell Cards (Find My Prof & Home Dashboard) */
  .weekly-grid-cell-spacious.occupied, .weekly-class-cell {
    background-color: rgba(30, 41, 59, 0.4) !important;
  }

  .cell-card-spacious, .grid-cell-card, .timeline-class-card-spacious, .timeline-class-card {
    background-color: #1e293b !important;
    border: 1px solid #334155 !important;
    border-radius: 8px !important;
    padding: 8px 10px !important;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25) !important;
    display: flex !important;
    flex-direction: column !important;
    gap: 4px !important;
  }

  /* Subject Titles */
  .cell-card-subject, .cell-subject, .timeline-subject, .class-card-top h5 {
    color: #ffffff !important;
    font-weight: 800 !important;
    font-size: 0.775rem !important;
    line-height: 1.3 !important;
    white-space: normal !important;
    word-break: normal !important;
    overflow-wrap: break-word !important;
    max-width: none !important;
    text-overflow: clip !important;
    overflow: visible !important;
    margin-bottom: 2px !important;
  }

  .cell-details-row {
    display: flex !important;
    flex-direction: column !important;
    gap: 3px !important;
    margin-top: 4px !important;
  }

  /* Teacher Labels */
  .cell-card-classes, .class-card-subtitle, .timeline-card-meta, .cell-teacher {
    color: #cbd5e1 !important;
    font-size: 0.675rem !important;
    font-weight: 500 !important;
    white-space: nowrap !important;
    word-break: normal !important;
    max-width: none !important;
    text-overflow: clip !important;
    overflow: visible !important;
  }

  .cell-teacher svg {
    stroke: #818cf8 !important;
  }

  /* Room Badges */
  .cell-card-room, .class-card-room-badge, .room-tag {
    color: #34d399 !important;
    background-color: rgba(52, 211, 153, 0.15) !important;
    border: 1px solid rgba(52, 211, 153, 0.3) !important;
    font-weight: 750 !important;
    font-size: 0.625rem !important;
    padding: 1px 6px !important;
    border-radius: 4px !important;
    white-space: nowrap !important;
  }

  .cell-room {
    color: #f87171 !important;
    font-size: 0.65rem !important;
    font-weight: 700 !important;
    display: flex !important;
    align-items: center !important;
    gap: 4px !important;
  }

  .cell-room svg {
    stroke: #f87171 !important;
  }

  .grid-practical-badge {
    background-color: #6366f1 !important;
    color: #ffffff !important;
    font-weight: 800 !important;
    font-size: 0.6rem !important;
    padding: 1px 5px !important;
    border-radius: 3px !important;
  }

  .grid-unsupervised-badge {
    background-color: #f59e0b !important;
    color: #ffffff !important;
    font-weight: 800 !important;
    font-size: 0.6rem !important;
    padding: 1px 5px !important;
    border-radius: 3px !important;
  }

  /* Free & Break Cells */
  .cell-empty-dash {
    color: #475569 !important;
    font-weight: 700 !important;
  }

  .weekly-grid-cell-spacious.free, .weekly-class-cell.free {
    background-color: #0f172a !important;
  }

  .timeline-free-card-spacious, .timeline-free-card, .cell-free-box {
    background-color: rgba(30, 41, 59, 0.6) !important;
    border: 1.5px dashed #334155 !important;
    color: #94a3b8 !important;
  }

  .free-text {
    color: #94a3b8 !important;
    font-size: 0.725rem !important;
    font-weight: 600 !important;
  }

  .timeline-break-card-spacious, .timeline-break-card, .break-box, .break-grid-cell {
    background-color: rgba(245, 158, 11, 0.12) !important;
    border: 1px solid rgba(245, 158, 11, 0.3) !important;
    color: #fef3c7 !important;
  }
`;

/**
 * Captures a DOM element with 100% full un-clipped scroll width,
 * dynamically auto-trimming canvas height so there is ZERO extra empty space.
 * 
 * @param {HTMLElement} element - Target DOM node to capture.
 * @param {string} [theme] - 'dark' or 'light'.
 * @returns {Promise<HTMLCanvasElement>} Rendered canvas element.
 */
export const captureScheduleCanvas = async (element, theme = 'dark') => {
  if (!element) {
    throw new Error('Target element for schedule capture was not found.');
  }

  // Find inner table or main content grid to determine true unclipped scroll width
  const innerTable = element.querySelector('table, .spacious-weekly-grid, .weekly-timetable-table, .spacious-timeline-list, .room-grid');
  
  let scrollW = element.scrollWidth;
  if (innerTable && innerTable.scrollWidth > scrollW) {
    scrollW = innerTable.scrollWidth;
  }
  const captureWidth = Math.max(scrollW, 1400);

  // Perform canvas capture with html2canvas (height auto-trimmed to exact element height)
  const canvas = await html2canvas(element, {
    scale: 2, // 2x DPI for ultra-sharp text
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#0f172a',
    logging: false,
    width: captureWidth, // Explicit full width so all 7 period columns render
    windowWidth: captureWidth + 100,
    onclone: (clonedDoc, clonedElement) => {
      // Inject high-contrast export stylesheet
      const styleEl = clonedDoc.createElement('style');
      styleEl.textContent = EXPORT_HIGH_CONTRAST_CSS;
      clonedDoc.head.appendChild(styleEl);

      // Force top cloned wrapper to expand to full capture width while hugging exact content height
      clonedElement.style.width = captureWidth + 'px';
      clonedElement.style.maxWidth = 'none';
      clonedElement.style.overflow = 'visible';
      clonedElement.style.height = 'auto';
      clonedElement.style.minHeight = '0';
      clonedElement.style.backgroundColor = '#0f172a';
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
  fileName,
  theme = 'dark'
}) => {
  try {
    const canvas = await captureScheduleCanvas(element, theme);
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
  fileName,
  theme = 'dark'
}) => {
  try {
    const canvas = await captureScheduleCanvas(element, theme);
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
