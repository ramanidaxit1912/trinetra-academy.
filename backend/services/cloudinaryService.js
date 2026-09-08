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

module.exports = { uploadToCloudinary, deleteFromCloudinary, isCloudinaryConfigured };
