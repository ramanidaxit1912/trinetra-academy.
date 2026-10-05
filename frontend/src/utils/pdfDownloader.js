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

  // Position at (0,0) behind the webpage with z-index: -999999 so user does not see it,
  // but html2canvas sees it at 100% full opacity (NEVER 0.01 opacity, which causes blank page!)
  const container = document.createElement('div');
  container.id = 'pdf-render-temp-container';
  container.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 794px;
    min-width: 794px;
    max-width: 794px;
    background: #ffffff;
    color: #0f172a;
    z-index: -999999;
    opacity: 1;
    visibility: visible;
    pointer-events: none;
    padding: 0;
    margin: 0;
    box-sizing: border-box;
    font-family: 'Hind Vadodara', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;

  // Strip blocking external fonts or scripts that might stall html2canvas
  let sanitizedHtml = htmlContent
    .replace(/<div class="no-print-bar"[\s\S]*?<\/div>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '');

  container.innerHTML = sanitizedHtml;
  document.body.appendChild(container);

  // Wait for images inside container to finish loading before capturing
  const imgs = Array.from(container.querySelectorAll('img'));
  await Promise.all(imgs.map(img => {
    if (img.complete) return Promise.resolve();
    return new Promise(r => { img.onload = r; img.onerror = r; });
  }));

  await new Promise(resolve => setTimeout(resolve, 200));

  try {
    const opt = {
      margin: 0,
      filename: cleanFilename,
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: {
        scale: 1.5,
        useCORS: true,
        allowTaint: true,
        logging: false,
        scrollX: 0,
        scrollY: 0,
        windowWidth: 794,
        width: 794
      },
      jsPDF: {
        unit: 'mm',
        format: 'a4',
        orientation: 'portrait'
      },
      pagebreak: {
        mode: ['css', 'legacy']
      }
    };

    const pdfPromise = html2pdf().set(opt).from(container).save();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('PDF conversion timed out')), 6000)
    );

    await Promise.race([pdfPromise, timeoutPromise]);
    return true;
  } catch (err) {
    console.warn('html2pdf direct save failed or timed out, using instant iframe print fallback:', err);
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

/**
 * Converts an HTML string into a PDF Blob (used for batch ZIP packaging)
 * @param {string} htmlContent - Complete or partial HTML string
 * @returns {Promise<Blob|null>}
 */
export async function generatePdfBlobFromHtml(htmlContent) {
  if (!htmlContent) return null;

  const container = document.createElement('div');
  container.id = 'pdf-render-temp-container-' + Math.random().toString(36).slice(2, 7);
  container.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 794px;
    min-width: 794px;
    max-width: 794px;
    background: #ffffff;
    color: #0f172a;
    z-index: -999999;
    opacity: 1;
    visibility: visible;
    pointer-events: none;
    padding: 0;
    margin: 0;
    box-sizing: border-box;
    font-family: 'Hind Vadodara', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;

  const sanitizedHtml = htmlContent
    .replace(/<div class="no-print-bar"[\s\S]*?<\/div>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '');

  container.innerHTML = sanitizedHtml;
  document.body.appendChild(container);

  // Wait for images to load
  const imgs = Array.from(container.querySelectorAll('img'));
  await Promise.all(imgs.map(img => {
    if (img.complete) return Promise.resolve();
    return new Promise(r => { img.onload = r; img.onerror = r; });
  }));

  await new Promise(resolve => setTimeout(resolve, 200));

  try {
    const opt = {
      margin: 0,
      image: { type: 'jpeg', quality: 0.92 },
      html2canvas: {
        scale: 1.4,
        useCORS: true,
        allowTaint: true,
        logging: false,
        scrollX: 0,
        scrollY: 0,
        windowWidth: 794,
        width: 794
      },
      jsPDF: {
        unit: 'mm',
        format: 'a4',
        orientation: 'portrait'
      },
      pagebreak: {
        mode: ['css', 'legacy']
      }
    };

    const blob = await html2pdf().set(opt).from(container).outputPdf('blob');
    return blob;
  } catch (err) {
    console.warn('generatePdfBlobFromHtml error:', err);
    return null;
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}
