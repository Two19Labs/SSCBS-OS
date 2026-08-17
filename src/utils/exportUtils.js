import { toPng } from 'html-to-image';

/**
 * Formats a Date object into a readable string for schedule export footers.
 */
const getFormattedTimestamp = () => {
  const now = new Date();
  return now.toLocaleString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
};

/**
 * Sanitizes file names for safe download.
 */
const sanitizeFileName = (name) => {
  return name
    .replace(/[^a-zA-Z0-9_\-\s]/g, '')
    .trim()
    .replace(/\s+/g, '_');
};

/**
 * Exports a timetable or schedule container DOM element as a crisp, un-clipped PNG image.
 * 
 * @param {Object} options
 * @param {HTMLElement} options.element - The DOM element to render and export.
 * @param {string} options.title - Primary title for the exported schedule (e.g., "Dr. Anamika Agarwal").
 * @param {string} options.subtitle - Secondary descriptor (e.g., "Faculty Weekly Timetable").
 * @param {string} [options.fileName] - Custom name for the exported PNG file.
 * @param {string} [options.badgeText] - Additional pill badge text (e.g., "B.Sc CS • Semester IV").
 * @param {string} [options.theme] - Preferred background theme ('light' or 'dark' or 'auto').
 * @returns {Promise<boolean>} True if export succeeded.
 */
export const exportScheduleAsImage = async ({
  element,
  title = 'Schedule',
  subtitle = 'SSCBS Timetable',
  fileName,
  badgeText = 'Official Timetable',
  theme = 'dark'
}) => {
  if (!element) {
    throw new Error('Target element for export was not found.');
  }

  // Create an offscreen wrapper container to build a clean printable layout
  const wrapper = document.createElement('div');
  wrapper.className = `sscbs-export-wrapper ${theme === 'light' ? 'theme-light' : 'theme-dark'}`;
  
  // Apply offscreen layout styling
  Object.assign(wrapper.style, {
    position: 'fixed',
    left: '-9999px',
    top: '0',
    width: '1240px', // Standard wide desktop width to ensure table fits completely without horizontal scroll
    maxWidth: 'none',
    zIndex: '-9999',
    background: theme === 'light' ? '#ffffff' : '#0b0f19',
    color: theme === 'light' ? '#0f172a' : '#f8fafc',
    padding: '32px',
    boxSizing: 'border-box',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
  });

  // Inject export custom header
  const headerHtml = `
    <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid ${theme === 'light' ? '#e2e8f0' : '#1e293b'}; padding-bottom: 20px; margin-bottom: 24px;">
      <div style="display: flex; align-items: center; gap: 16px;">
        <div style="width: 44px; height: 44px; border-radius: 12px; background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%); display: flex; align-items: center; justify-content: center; color: #ffffff; font-weight: 800; font-size: 20px; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);">
          OS
        </div>
        <div>
          <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.2px; color: ${theme === 'light' ? '#6366f1' : '#818cf8'}; margin-bottom: 2px;">
            Shaheed Sukhdev College of Business Studies • DU
          </div>
          <h1 style="font-size: 22px; font-weight: 800; margin: 0; color: ${theme === 'light' ? '#0f172a' : '#ffffff'}; letter-spacing: -0.5px;">
            ${title}
          </h1>
          <div style="font-size: 13px; color: ${theme === 'light' ? '#64748b' : '#94a3b8'}; margin-top: 2px;">
            ${subtitle}
          </div>
        </div>
      </div>

      <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 6px;">
        <span style="display: inline-flex; align-items: center; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; background: ${theme === 'light' ? '#e0e7ff' : 'rgba(99, 102, 241, 0.2)'}; color: ${theme === 'light' ? '#4338ca' : '#a5b4fc'}; border: 1px solid ${theme === 'light' ? '#c7d2fe' : 'rgba(99, 102, 241, 0.4)'};">
          ${badgeText}
        </span>
        <span style="font-size: 11px; color: ${theme === 'light' ? '#94a3b8' : '#64748b'};">
          Generated ${getFormattedTimestamp()}
        </span>
      </div>
    </div>
  `;

  // Clone the schedule content node
  const clone = element.cloneNode(true);

  // Force clone to expand fully without any scrollbars or max-height restrictions
  clone.style.width = '100%';
  clone.style.maxWidth = 'none';
  clone.style.overflow = 'visible';
  clone.style.maxHeight = 'none';
  clone.style.margin = '0';
  clone.style.boxSizing = 'border-box';

  // Make internal scroll containers visible
  const scrollContainers = clone.querySelectorAll('.table-responsive, .spacious-weekly-grid-container, .weekly-list-timeline');
  scrollContainers.forEach(container => {
    container.style.overflow = 'visible';
    container.style.maxHeight = 'none';
    container.style.width = '100%';
  });

  // Make tables expand naturally
  const tables = clone.querySelectorAll('table');
  tables.forEach(table => {
    table.style.width = '100%';
    table.style.minWidth = '1150px';
    table.style.tableLayout = 'fixed';
  });

  // Remove debugging or extra timewarp controls if present in the clone
  const debuggers = clone.querySelectorAll('.prof-page-debugger, .btn-toggle-debugger-page, button:not(.badge)');
  debuggers.forEach(el => el.remove());

  // Inject export custom footer
  const footerHtml = `
    <div style="margin-top: 24px; pt-16px; border-top: 1px solid ${theme === 'light' ? '#e2e8f0' : '#1e293b'}; padding-top: 16px; display: flex; align-items: center; justify-content: space-between; font-size: 11px; color: ${theme === 'light' ? '#94a3b8' : '#64748b'};">
      <div>
        ⚡ <strong>SSCBS OS</strong> • Shaheed Sukhdev College of Business Studies (University of Delhi)
      </div>
      <div>
        Live Timetable Sync • sscbs-os.vercel.app
      </div>
    </div>
  `;

  wrapper.innerHTML = headerHtml;
  wrapper.appendChild(clone);
  const footerNode = document.createElement('div');
  footerNode.innerHTML = footerHtml;
  wrapper.appendChild(footerNode);

  document.body.appendChild(wrapper);

  try {
    // Generate high-resolution PNG using html-to-image
    const dataUrl = await toPng(wrapper, {
      pixelRatio: 2, // High resolution crisp text rendering
      cacheBust: true,
      backgroundColor: theme === 'light' ? '#ffffff' : '#0b0f19'
    });

    // Clean up offscreen node
    document.body.removeChild(wrapper);

    // Trigger file download
    const cleanName = sanitizeFileName(fileName || `${title}_SSCBS_Schedule`);
    const downloadLink = document.createElement('a');
    downloadLink.download = `${cleanName}.png`;
    downloadLink.href = dataUrl;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);

    return true;
  } catch (err) {
    if (document.body.contains(wrapper)) {
      document.body.removeChild(wrapper);
    }
    console.error('Failed to export schedule image:', err);
    throw err;
  }
};
