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
 * Captures a DOM element with 100% full un-clipped scroll width & height.
 * Forces horizontal expansion of all timetable columns (Periods I-VII & Saturday)
 * and strips sticky positioning overlays so no content gets cropped.
 * 
 * @param {HTMLElement} element - Target DOM node to capture.
 * @param {string} [theme] - 'dark' or 'light'.
 * @returns {Promise<HTMLCanvasElement>} Rendered canvas element.
 */
export const captureScheduleCanvas = async (element, theme = 'dark') => {
  if (!element) {
    throw new Error('Target element for schedule capture was not found.');
  }

  // Determine computed background color or default to SSCBS OS dark theme backdrop
  const computedStyle = window.getComputedStyle(element);
  const bgColor = computedStyle.backgroundColor !== 'rgba(0, 0, 0, 0)' && computedStyle.backgroundColor !== 'transparent'
    ? computedStyle.backgroundColor
    : (theme === 'light' ? '#ffffff' : '#0b0f19');

  // Find all internal scroll containers and calculate full unclipped scroll dimensions
  const scrollContainers = element.querySelectorAll('.spacious-weekly-grid-container, .weekly-timetable-table, .table-responsive, .spacious-weekly-grid, table, .room-grid');
  let maxScrollWidth = element.scrollWidth;
  let maxScrollHeight = element.scrollHeight;

  scrollContainers.forEach(sc => {
    if (sc.scrollWidth > maxScrollWidth) maxScrollWidth = sc.scrollWidth;
    if (sc.scrollHeight > maxScrollHeight) maxScrollHeight = sc.scrollHeight;
  });

  // Ensure full width capture so all 7 period columns fit comfortably without truncation (min 1450px)
  const captureWidth = Math.max(maxScrollWidth, 1450);
  const captureHeight = Math.max(maxScrollHeight + 40, 750);

  // Perform canvas capture using html2canvas with explicit full width/height bounds
  const canvas = await html2canvas(element, {
    scale: 2, // 2x DPI for high-resolution text sharpness
    useCORS: true,
    allowTaint: true,
    backgroundColor: bgColor,
    logging: false,
    width: captureWidth,
    height: captureHeight,
    windowWidth: captureWidth + 200,
    windowHeight: captureHeight + 200,
    onclone: (clonedDoc, clonedElement) => {
      // Force top cloned wrapper to expand to full capture dimensions
      clonedElement.style.width = captureWidth + 'px';
      clonedElement.style.maxWidth = 'none';
      clonedElement.style.overflow = 'visible';
      clonedElement.style.height = 'auto';

      // Unclip all overflow wrappers in cloned document
      const allChildren = clonedElement.querySelectorAll('*');
      allChildren.forEach(node => {
        const s = window.getComputedStyle(node);
        if (s.overflowX === 'auto' || s.overflowX === 'scroll' || s.overflowY === 'auto' || s.overflowY === 'scroll' || s.overflow === 'hidden') {
          node.style.overflow = 'visible';
          node.style.overflowX = 'visible';
          node.style.overflowY = 'visible';
          node.style.maxHeight = 'none';
        }

        // Expand tables to full capture width
        if (node.tagName === 'TABLE' || node.classList.contains('spacious-weekly-grid') || node.classList.contains('weekly-timetable-table')) {
          node.style.width = '100%';
          node.style.minWidth = (captureWidth - 40) + 'px';
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
