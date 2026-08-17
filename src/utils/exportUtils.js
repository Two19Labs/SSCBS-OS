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
 * Captures a DOM element cleanly using html2canvas with full scroll expansion & CSS variable inheritance.
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

  // Perform canvas capture with html2canvas inside native DOM context
  const canvas = await html2canvas(element, {
    scale: 2, // 2x DPI for ultra-crisp text
    useCORS: true,
    allowTaint: true,
    backgroundColor: bgColor,
    logging: false,
    windowWidth: Math.max(element.scrollWidth, 1280),
    onclone: (clonedDoc, clonedElement) => {
      // Force element to expand fully in cloned virtual document so no horizontal scrollbars cut off content
      clonedElement.style.overflow = 'visible';
      clonedElement.style.maxHeight = 'none';
      clonedElement.style.height = 'auto';
      clonedElement.style.width = '100%';
      clonedElement.style.maxWidth = 'none';

      // Expand all nested scroll containers (tables, grid wrappers, timeline lists)
      const scrollables = clonedElement.querySelectorAll('.table-responsive, .spacious-weekly-grid-container, .weekly-list-timeline, .weekly-list-view');
      scrollables.forEach(s => {
        s.style.overflow = 'visible';
        s.style.maxHeight = 'none';
        s.style.height = 'auto';
        s.style.width = '100%';
      });

      // Expand table grids to full unclipped width
      const tables = clonedElement.querySelectorAll('table, .spacious-weekly-grid, .weekly-timetable-table');
      tables.forEach(t => {
        t.style.width = '100%';
        t.style.minWidth = '1150px';
        t.style.tableLayout = 'fixed';
      });

      // Hide debuggers or non-exportable buttons if present inside clone
      const nonExportables = clonedElement.querySelectorAll('.prof-page-debugger, .btn-toggle-debugger-page');
      nonExportables.forEach(el => el.remove());
    }
  });

  return canvas;
};

/**
 * Exports a schedule or timetable element as a high-resolution PNG image.
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
 * Exports a schedule or timetable element as a crisp, formatted PDF document.
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

    const imgWidth = canvas.width;
    const imgHeight = canvas.height;

    // Determine orientation based on aspect ratio
    const isLandscape = imgWidth >= imgHeight;
    const pdf = new jsPDF({
      orientation: isLandscape ? 'landscape' : 'portrait',
      unit: 'px',
      format: [imgWidth, imgHeight]
    });

    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);

    const cleanName = sanitizeFileName(fileName || `${title}_SSCBS_Schedule`);
    pdf.save(`${cleanName}.pdf`);

    return true;
  } catch (err) {
    console.error('Failed to export schedule PDF:', err);
    throw err;
  }
};
