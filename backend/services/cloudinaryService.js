/**
 * Cloudinary Service — Permanent Cloud Image Storage
 * Replaces local /uploads/ which gets wiped on Render restart
 */
const cloudinary = require('cloudinary').v2;
const { Readable } = require('stream');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

async function uploadToCloudinary(buffer, folder = 'trinetra/posters', filename = '') {
  return new Promise((resolve, reject) => {
    const safeName = (filename || 'img').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40);
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image', quality: 'auto', fetch_format: 'auto' },
      (error, result) => {
        if (error) return reject(error);
        resolve({ url: result.secure_url, public_id: result.public_id });
      }
    );
    const s = new Readable();
    s.push(buffer);
    s.push(null);
    s.pipe(uploadStream);
  });
}

async function uploadPdfToCloudinary(buffer, filename = 'document.pdf', customPublicId = null) {
  return new Promise((resolve, reject) => {
    const safeName = (filename || 'doc').replace(/\.pdf$/i, '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50);
    // Deterministic public_id prevents duplicate uploads when user clicks repeatedly (0% extra storage!)
    const public_id = customPublicId ? String(customPublicId).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50) : `${safeName}`;
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'trinetra/scorecards',
        resource_type: 'auto',
        public_id,
        overwrite: true,
        invalidate: true
      },
      (error, result) => {
        if (error) {
          console.error('❌ [Cloudinary PDF Upload Error]:', error);
          return reject(error);
        }
        console.log('✅ [Cloudinary PDF Uploaded]:', result.secure_url);
        resolve({ url: result.secure_url, public_id: result.public_id });
      }
    );
    const s = new Readable();
    s.push(buffer);
    s.push(null);
    s.pipe(uploadStream);
  });
}

/**
 * Auto-cleanup: Delete scorecards older than maxDays (default 45 days)
 * Keeps Cloudinary storage permanently under ~500 MB (98% free forever!)
 */
async function cleanupOldCloudinaryPdfs(maxDays = 45) {
  if (!isCloudinaryConfigured()) return;
  try {
    const cutoffDate = new Date(Date.now() - maxDays * 24 * 60 * 60 * 1000).toISOString();
    if (cloudinary.search) {
      const searchRes = await cloudinary.search
        .expression(`folder:trinetra/scorecards AND created_at<${cutoffDate}`)
        .max_results(100)
        .execute();
      if (searchRes && Array.isArray(searchRes.resources) && searchRes.resources.length > 0) {
        const publicIds = searchRes.resources.map(r => r.public_id);
        await cloudinary.api.delete_resources(publicIds);
        console.log(`🧹 [Cloudinary Auto-Clean] Deleted ${publicIds.length} old scorecard PDFs (> ${maxDays} days).`);
      }
    }
  } catch (err) {
    console.warn('⚠️ [Cloudinary Auto-Clean Note]:', err.message);
  }
}

async function deleteFromCloudinary(urlOrPublicId) {
  try {
    let publicId = urlOrPublicId;
    if (urlOrPublicId && urlOrPublicId.includes('cloudinary.com')) {
      const match = urlOrPublicId.match(/\/upload\/(?:v\d+\/)?(.+?)(\.\w+)?$/);
      if (match) publicId = match[1];
    }
    if (publicId) await cloudinary.uploader.destroy(publicId);
  } catch (e) { console.warn('[Cloudinary] Delete warning:', e.message); }
}

function isCloudinaryConfigured() {
  return !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
}

module.exports = { 
  uploadToCloudinary, 
  uploadPdfToCloudinary, 
  cleanupOldCloudinaryPdfs,
  deleteFromCloudinary, 
  isCloudinaryConfigured 
};
