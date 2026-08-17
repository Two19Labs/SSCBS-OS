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
 * High-contrast CSS overrides injected into cloned capture documents.
 * Ensures pristine contrast, dark slate cards, crisp white text, and rich emerald badges
 * regardless of current browser theme or variable inheritance.
 */
const EXPORT_HIGH_CONTRAST_CSS = `
  /* High-Contrast Export Theme Overrides */
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

  /* Occupied Class Cards (Timeline & Grid) */
  .timeline-class-card-spacious, .cell-card-spacious, .grid-cell-card, .timeline-class-card {
    background-color: #1e293b !important;
    border: 1px solid #334155 !important;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3) !important;
    color: #ffffff !important;
  }
  .timeline-class-card-spacious h5, .class-card-top h5, .cell-card-subject, .timeline-subject {
    color: #ffffff !important;
    font-weight: 800 !important;
    font-size: 0.9rem !important;
  }
  .class-card-subtitle, .cell-card-classes, .timeline-card-meta, .cell-card-meta-row {
    color: #cbd5e1 !important;
  }
  .class-card-room-badge, .cell-card-room, .room-tag {
    color: #34d399 !important;
    background-color: rgba(52, 211, 153, 0.15) !important;
    border: 1px solid rgba(52, 211, 153, 0.3) !important;
    font-weight: 700 !important;
  }

  /* Free Period Cards */
  .timeline-free-card-spacious, .timeline-free-card, .cell-free-box {
    background-color: rgba(30, 41, 59, 0.6) !important;
    border: 1.5px dashed #334155 !important;
    color: #94a3b8 !important;
  }
  .timeline-free-card-spacious h5, .timeline-free-card h5, .free-text {
    color: #94a3b8 !important;
  }
  .timeline-free-card-spacious p, .timeline-free-card p {
    color: #64748b !important;
  }

  /* Infinity Hour / Break Cards */
  .timeline-break-card-spacious, .timeline-break-card, .break-box {
    background-color: rgba(245, 158, 11, 0.12) !important;
    border: 1px solid rgba(245, 158, 11, 0.3) !important;
    color: #fef3c7 !important;
  }
  .timeline-break-card-spacious h5, .timeline-break-card h5 {
    color: #fbbf24 !important;
  }
  .timeline-break-card-spacious p, .timeline-break-card p {
    color: #fde68a !important;
  }

  /* Weekly Timetable Table Grid */
  .spacious-weekly-grid-container, .table-responsive {
    background-color: #0f172a !important;
    border: 1px solid #334155 !important;
    border-radius: 12px !important;
  }
  .spacious-weekly-grid th, .weekly-timetable-table th {
    background-color: #1e293b !important;
    border-bottom: 2px solid #334155 !important;
    border-right: 1px solid #334155 !important;
    color: #cbd5e1 !important;
  }
  .weekly-th-period, .th-period-label {
    color: #818cf8 !important;
    font-weight: 800 !important;
  }
  .weekly-th-time, .th-time-label {
    color: #94a3b8 !important;
  }
  .spacious-weekly-grid td, .weekly-timetable-table td {
    border-bottom: 1px solid #334155 !important;
    border-right: 1px solid #334155 !important;
    color: #f8fafc !important;
  }
  .sticky-day-col, .day-name-cell {
    background-color: #1e293b !important;
    color: #818cf8 !important;
    font-weight: 800 !important;
  }

  /* Room Finder Grid Cards */
  .room-card {
    background-color: #1e293b !important;
    border: 1px solid #334155 !important;
  }
  .room-card.vacant {
    background-color: rgba(16, 185, 129, 0.1) !important;
    border: 1px solid rgba(16, 185, 129, 0.3) !important;
  }
  .room-card.occupied {
    background-color: rgba(239, 68, 68, 0.1) !important;
    border: 1px solid rgba(239, 68, 68, 0.3) !important;
  }
  .room-name {
    color: #ffffff !important;
  }
  .room-floor-tag {
    color: #94a3b8 !important;
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
  const captureWidth = Math.max(scrollW, 1240);

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
 * Exports a schedule or timetable element as a high-resolution unclipped PNG image,
 * auto-cropped to the exact height of the schedule.
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
 * Exports a schedule or timetable element as a clean, landscape-fitted A4 PDF document,
 * perfectly proportioned to the schedule bounds.
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
