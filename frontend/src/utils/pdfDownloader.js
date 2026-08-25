import html2pdf from 'html2pdf.js';

/**
 * Downloads an HTML string directly as a PDF file to the user's device
 * @param {string} htmlContent - Complete or partial HTML string
 * @param {string} filename - Target PDF file name (e.g. 'Trinetra_Scorecard.pdf')
 * @returns {Promise<boolean>}
 */
export async function downloadHtmlAsPdf(htmlContent, filename = 'document.pdf') {
  if (!htmlContent) return false;
  
  const cleanFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;

  // Create temporary container positioned at top-left but invisible to user
  const container = document.createElement('div');
  container.id = 'pdf-render-temp-container';
  container.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    width: 794px;
    min-width: 794px;
    max-width: 794px;
    background: #ffffff;
    color: #0f172a;
    z-index: -9999;
    opacity: 0.01;
    pointer-events: none;
    padding: 10px;
    margin: 0;
    box-sizing: border-box;
    font-family: 'Hind Vadodara', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;

  // Extract body content and strip blocking cross-origin CSS imports/links that cause html2canvas to hang
  let sanitizedHtml = htmlContent
    .replace(/<div class="no-print-bar"[\s\S]*?<\/div>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/@import\s+url\([^)]+\);?/gi, '')
    .replace(/<link[^>]*rel=["']stylesheet["'][^>]*>/gi, '');

  container.innerHTML = sanitizedHtml;
  document.body.appendChild(container);

  // Short delay for DOM layout calculation
  await new Promise(resolve => setTimeout(resolve, 150));

  try {
    const opt = {
      margin: [6, 6, 6, 6],
      filename: cleanFilename,
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: {
        scale: 1.5,
        useCORS: false,
        allowTaint: false,
        logging: false,
        scrollX: 0,
        scrollY: 0,
        windowWidth: 794
      },
      jsPDF: {
        unit: 'mm',
        format: 'a4',
        orientation: 'portrait'
      },
      pagebreak: {
        mode: ['avoid-all', 'css', 'legacy']
      }
    };

    // Race html2pdf with a 3.5-second timeout to prevent any hanging
    const pdfPromise = html2pdf().set(opt).from(container).save();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('PDF conversion timed out')), 3500)
    );

    await Promise.race([pdfPromise, timeoutPromise]);
    return true;
  } catch (err) {
    console.warn('html2pdf direct save failed or timed out, using instant iframe print fallback:', err);
    // Fallback: Invisible iframe print so current page NEVER redirects
    try {
      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
      const blobUrl = URL.createObjectURL(blob);
      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;opacity:0;';
      iframe.src = blobUrl;
      document.body.appendChild(iframe);

      iframe.onload = () => {
        try {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        } catch (e) {
          console.warn('iframe print error:', e);
        }
        setTimeout(() => {
          if (document.body.contains(iframe)) document.body.removeChild(iframe);
          URL.revokeObjectURL(blobUrl);
        }, 30000);
      };
    } catch (fallbackErr) {
      console.error('Fallback print also failed:', fallbackErr);
    }
    return false;
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}

