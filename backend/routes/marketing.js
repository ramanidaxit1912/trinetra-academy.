const express = require('express');
const { PrismaClient } = require('@prisma/client');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();
const prisma = new PrismaClient();

// Ensure posters directory exists inside uploads
const posterDir = path.join(__dirname, '..', 'uploads', 'posters');
if (!fs.existsSync(posterDir)) {
  fs.mkdirSync(posterDir, { recursive: true });
}

// Multer config for posters & banners
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, posterDir),
  filename: (req, file, cb) => {
    const cleanOriginal = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const uniqueName = `poster_${Date.now()}_${cleanOriginal}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB max
});

// Seed default initial marketing items if database is empty
async function seedDefaultMarketingItems() {
  try {
    const count = await prisma.marketingItem.count();
    if (count > 0) return;

    const defaultItems = [
      // ── HERO CAROUSEL POSTERS ──
      {
        category: 'CAROUSEL',
        title: 'TET-2 ગણિત સ્પેશિયલ (ધોરણ ૬-૮)',
        subtitle: 'Chapter-wise MCQ ટેસ્ટ સિરીઝ + પ્રેક્ટીસ PDF',
        description: 'નવા પાઠ્યપુસ્તક મુજબ સંપૂર્ણ તૈયારી અને ઓનલાઈન મોક ટેસ્ટ',
        imageUrl: '/images/poster_maths.png',
        price: '₹149',
        oldPrice: '₹299',
        badge: 'BEST SELLER',
        tagColor: '#2563eb',
        linkUrl: '/exam',
        buttonText: '🚀 ટેસ્ટ આપો / વિગતો',
        waMessage: 'મને TET-2 ગણિત ટેસ્ટ સિરીઝ ₹149 માટે માહિતી આપો.',
        orderIndex: 0,
        isActive: true,
      },
      {
        category: 'CAROUSEL',
        title: 'TET-2 વિજ્ઞાન & ટેકનોલોજી (ધોરણ ૬-૮)',
        subtitle: 'કૂતૂહલ અને નવા પાઠ્યપુસ્તક આધારિત ટેસ્ટ',
        description: 'ચેપ્ટર વાઈઝ ઓનલાઈન MCQ ટેસ્ટ + ફુલ PDF મટીરીયલ',
        imageUrl: '/images/poster_science.png',
        price: '₹149',
        oldPrice: '₹299',
        badge: '50% OFF',
        tagColor: '#059669',
        linkUrl: '/exam',
        buttonText: '🚀 ટેસ્ટ આપો / વિગતો',
        waMessage: 'મને TET-2 વિજ્ઞાન ટેસ્ટ સિરીઝ ₹149 માટે માહિતી આપો.',
        orderIndex: 1,
        isActive: true,
      },
      {
        category: 'CAROUSEL',
        title: 'TET-2 સામાજિક વિજ્ઞાન (ધોરણ ૬-૮)',
        subtitle: 'સમાજ શોધયાત્રા અને વિગતવાર પ્રશ્નોત્તરી',
        description: 'ભારત અને વિશ્વ ભૂગોળ, ઇતિહાસ અને નાગરિક શાસ્ત્ર સંપૂર્ણ',
        imageUrl: '/images/poster_social.png',
        price: '₹149',
        oldPrice: '₹299',
        badge: 'POPULAR',
        tagColor: '#7c3aed',
        linkUrl: '/exam',
        buttonText: '🚀 ટેસ્ટ આપો / વિગતો',
        waMessage: 'મને TET-2 સામાજિક વિજ્ઞાન ટેસ્ટ સિરીઝ ₹149 માટે માહિતી આપો.',
        orderIndex: 2,
        isActive: true,
      },
      {
        category: 'CAROUSEL',
        title: 'ગુજરાતી વર્ણનાત્મક & વ્યાકરણ PDF',
        subtitle: 'સંપૂર્ણ વ્યાકરણ, નિબંધ અને સંદર્ભ સાહિત્ય',
        description: 'તમામ લેક્ચર PDF, વ્યાકરણ નિયમો અને ફુલ મોક ટેસ્ટ',
        imageUrl: '/images/poster_gujarati.png',
        price: '₹99',
        oldPrice: '₹199',
        badge: 'SUPER SAVER',
        tagColor: '#d97706',
        linkUrl: '/materials',
        buttonText: '📚 PDF મટીરીયલ જુઓ',
        waMessage: 'મને ગુજરાતી વર્ણનાત્મક PDF મટીરીયલ ₹99 માટે માહિતી આપો.',
        orderIndex: 3,
        isActive: true,
      },

      // ── DHAMAKA OFFERS ──
      {
        category: 'DHAMAKA_OFFER',
        title: 'ગુજરાતી વર્ણનાત્મક PDF પેકેજ',
        subtitle: 'ALL Lecture PDF + વ્યાકરણ + Mock Test',
        description: 'ALL Lecture PDF, Grammar PDF, Reference + Full Mock Test PDF',
        imageUrl: '/images/poster_gujarati.png',
        price: '₹99',
        oldPrice: '₹199',
        badge: '🔥 SUPER SAVER',
        tagColor: '#d97706',
        couponCode: 'GUJ99',
        linkUrl: 'https://wa.me/918200405300?text=I%20want%20Gujarati%20Varnanatmak%20Material%20PDF%20Rs.99%20with%20Coupon%20GUJ99',
        buttonText: '💬 WhatsApp કરો',
        waMessage: 'મને ગુજરાતી વર્ણનાત્મક PDF ₹99 વાળી ધમાકા ઓફર [કૂપન: GUJ99] સાથે લેવી છે.',
        orderIndex: 0,
        isActive: true,
      },
      {
        category: 'DHAMAKA_OFFER',
        title: 'TET-2 SPECIAL (ગણિત/વિજ્ઞાન/સામાજિક)',
        subtitle: 'ધોરણ ૬, ૭, ૮ Chapter-wise MCQ + PDF',
        description: 'ધોરણ ૬, ૭, ૮ Chapter-wise MCQ Test + PDF (નવા Textbook મુજબ)',
        imageUrl: '/images/poster_maths.png',
        price: '₹149',
        oldPrice: '₹299',
        badge: '💥 50% DISCOUNT',
        tagColor: '#2563eb',
        couponCode: 'TET50',
        linkUrl: 'https://wa.me/918200405300?text=I%20want%20TET-2%20Special%20Test%20Series%20Rs.149%20with%20Coupon%20TET50',
        buttonText: '💬 WhatsApp કરો',
        waMessage: 'મને TET-2 સ્પેશિયલ ₹149 વાળી ધમાકા ઓફર [કૂપન: TET50] સાથે લેવી છે.',
        orderIndex: 1,
        isActive: true,
      }
    ];

    for (const item of defaultItems) {
      await prisma.marketingItem.create({ data: item });
    }
    console.log('✅ Seeded default marketing banners and dhamaka offers.');
  } catch (err) {
    console.warn('⚠️ Seeding marketing items skipped:', err.message);
  }
}

// Run initial seed on load
seedDefaultMarketingItems();

// ─── GET /api/marketing ──────────────────────────────────────
// Fetch all marketing items with optional filter (?category=CAROUSEL / ?category=DHAMAKA_OFFER / ?target=home / ?target=pdf / ?all=true)
router.get('/', async (req, res) => {
  try {
    const { category, all, target } = req.query;
    const where = {};
    
    // Only return active items for public home page unless all=true (for teacher dashboard)
    if (all !== 'true') {
      where.isActive = true;
      if (target === 'home') {
        where.showInHome = true;
      }
      if (target === 'pdf') {
        where.showInPdf = true;
      }
    }
    if (category) {
      where.category = category;
    }

    const items = await prisma.marketingItem.findMany({
      where,
      orderBy: [{ orderIndex: 'asc' }, { id: 'desc' }]
    });

    res.json({
      success: true,
      data: items,
      total: items.length
    });
  } catch (err) {
    console.error('Error fetching marketing items:', err);
    res.status(500).json({ error: 'પોસ્ટર્સ લોડ કરવામાં ક્ષતિ.' });
  }
});

// ─── POST /api/marketing ─────────────────────────────────────
// Create new marketing poster or dhamaka offer
router.post('/', upload.single('posterFile'), async (req, res) => {
  try {
    const {
      category = 'CAROUSEL',
      title,
      subtitle,
      description,
      imageUrl,
      price,
      oldPrice,
      badge,
      tagColor,
      couponCode,
      linkUrl,
      buttonText,
      waMessage,
      isActive = 'true',
      showInHome = 'true',
      showInPdf = 'true',
      orderIndex = 0
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'પોસ્ટર / ઑફરનું શીર્ષક (Title) જરૂરી છે.' });
    }

    let finalImageUrl = imageUrl || '';
    if (req.file) {
      finalImageUrl = `/uploads/posters/${req.file.filename}`;
    }

    const newItem = await prisma.marketingItem.create({
      data: {
        category: category.toUpperCase(),
        title: title.trim(),
        subtitle: subtitle ? subtitle.trim() : null,
        description: description ? description.trim() : null,
        imageUrl: finalImageUrl || null,
        price: price ? price.trim() : null,
        oldPrice: oldPrice ? oldPrice.trim() : null,
        badge: badge ? badge.trim() : null,
        tagColor: tagColor || '#f59e0b',
        couponCode: couponCode ? couponCode.trim().toUpperCase() : null,
        linkUrl: linkUrl ? linkUrl.trim() : null,
        buttonText: buttonText ? buttonText.trim() : '💬 WhatsApp કરો',
        waMessage: waMessage ? waMessage.trim() : null,
        isActive: isActive === 'true' || isActive === true,
        showInHome: showInHome === 'true' || showInHome === true,
        showInPdf: showInPdf === 'true' || showInPdf === true,
        orderIndex: Number(orderIndex) || 0
      }
    });

    res.json({
      success: true,
      message: '✅ પોસ્ટર / ઑફર સફળતાપૂર્વક ઉમેરાઈ ગયું!',
      data: newItem
    });
  } catch (err) {
    console.error('Error creating marketing item:', err);
    res.status(500).json({ error: 'પોસ્ટર સેવ કરવામાં ક્ષતિ: ' + err.message });
  }
});

// ─── PUT /api/marketing/:id ──────────────────────────────────
// Update an existing marketing poster or offer
router.put('/:id', upload.single('posterFile'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await prisma.marketingItem.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'પોસ્ટર મળ્યું નથી.' });
    }

    const {
      category,
      title,
      subtitle,
      description,
      imageUrl,
      price,
      oldPrice,
      badge,
      tagColor,
      couponCode,
      linkUrl,
      buttonText,
      waMessage,
      isActive,
      showInHome,
      showInPdf,
      orderIndex
    } = req.body;

    let finalImageUrl = existing.imageUrl;
    if (req.file) {
      finalImageUrl = `/uploads/posters/${req.file.filename}`;
    } else if (imageUrl !== undefined) {
      finalImageUrl = imageUrl;
    }

    const updated = await prisma.marketingItem.update({
      where: { id },
      data: {
        category: category !== undefined ? category.toUpperCase() : existing.category,
        title: title !== undefined ? title.trim() : existing.title,
        subtitle: subtitle !== undefined ? subtitle.trim() : existing.subtitle,
        description: description !== undefined ? description.trim() : existing.description,
        imageUrl: finalImageUrl,
        price: price !== undefined ? price.trim() : existing.price,
        oldPrice: oldPrice !== undefined ? oldPrice.trim() : existing.oldPrice,
        badge: badge !== undefined ? badge.trim() : existing.badge,
        tagColor: tagColor !== undefined ? tagColor : existing.tagColor,
        couponCode: couponCode !== undefined ? (couponCode ? couponCode.trim().toUpperCase() : null) : existing.couponCode,
        linkUrl: linkUrl !== undefined ? linkUrl.trim() : existing.linkUrl,
        buttonText: buttonText !== undefined ? buttonText.trim() : existing.buttonText,
        waMessage: waMessage !== undefined ? waMessage.trim() : existing.waMessage,
        isActive: isActive !== undefined ? (isActive === 'true' || isActive === true) : existing.isActive,
        showInHome: showInHome !== undefined ? (showInHome === 'true' || showInHome === true) : existing.showInHome,
        showInPdf: showInPdf !== undefined ? (showInPdf === 'true' || showInPdf === true) : existing.showInPdf,
        orderIndex: orderIndex !== undefined ? Number(orderIndex) : existing.orderIndex
      }
    });

    res.json({
      success: true,
      message: '✅ પોસ્ટર / ઑફર અપડેટ થઈ ગયું!',
      data: updated
    });
  } catch (err) {
    console.error('Error updating marketing item:', err);
    res.status(500).json({ error: 'પોસ્ટર અપડેટ કરવામાં ક્ષતિ: ' + err.message });
  }
});

// ─── DELETE /api/marketing/:id ───────────────────────────────
// Delete marketing poster
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await prisma.marketingItem.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'પોસ્ટર મળ્યું નથી.' });
    }

    // Optionally delete uploaded image file if exists in uploads/posters
    if (existing.imageUrl && existing.imageUrl.startsWith('/uploads/posters/')) {
      const filePath = path.join(__dirname, '..', existing.imageUrl);
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch (e) {}
      }
    }

    await prisma.marketingItem.delete({ where: { id } });

    res.json({
      success: true,
      message: '🗑️ પોસ્ટર સફળતાપૂર્વક ડિલીટ થયું.'
    });
  } catch (err) {
    console.error('Error deleting marketing item:', err);
    res.status(500).json({ error: 'પોસ્ટર ડિલીટ કરવામાં ક્ષતિ.' });
  }
});

module.exports = router;
