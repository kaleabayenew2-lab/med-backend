const express = require('express');
const router = express.Router();
const db = require('../config/db');

// GET all promotions
router.get('/', async (req, res) => {
  try {
    const { active } = req.query;
    let query = db('promotions');
    
    if (active === 'true') {
      query = query.where({ active: 1 });
    }
    
    const promotions = await query.orderBy('createdAt', 'desc');
    return res.json({
      success: true,
      promotions
    });
  } catch (error) {
    console.error('Error fetching promotions:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch promotions',
      error: error.message
    });
  }
});

// GET single promotion
router.get('/:id', async (req, res) => {
  try {
    const promoId = parseInt(req.params.id, 10);
    const promotion = await db('promotions').where({ id: promoId }).first();
    
    if (!promotion) {
      return res.status(404).json({ success: false, message: 'Promotion not found' });
    }
    
    return res.json({
      success: true,
      promotion
    });
  } catch (error) {
    console.error('Error fetching promotion:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch promotion',
      error: error.message
    });
  }
});

// POST create promotion
router.post('/', async (req, res) => {
  try {
    const { title, subtitle, imageUrl, buttonText, linkUrl, active } = req.body;
    
    if (!title) {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }
    
    const [insertedId] = await db('promotions').insert({
      title,
      subtitle: subtitle || '',
      imageUrl: imageUrl || 'assets/images/logo.png',
      buttonText: buttonText || 'Learn More',
      linkUrl: linkUrl || '',
      active: active !== undefined ? (active ? 1 : 0) : 1,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    const newPromo = await db('promotions').where({ id: insertedId }).first();
    
    return res.status(201).json({
      success: true,
      message: 'Promotion created successfully',
      promotion: newPromo
    });
  } catch (error) {
    console.error('Error creating promotion:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create promotion',
      error: error.message
    });
  }
});

// PUT update promotion
router.put('/:id', async (req, res) => {
  try {
    const promoId = parseInt(req.params.id, 10);
    const { title, subtitle, imageUrl, buttonText, linkUrl, active } = req.body;
    
    const promotion = await db('promotions').where({ id: promoId }).first();
    if (!promotion) {
      return res.status(404).json({ success: false, message: 'Promotion not found' });
    }
    
    const updateData = {
      updatedAt: new Date()
    };
    
    if (title !== undefined) updateData.title = title;
    if (subtitle !== undefined) updateData.subtitle = subtitle;
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
    if (buttonText !== undefined) updateData.buttonText = buttonText;
    if (linkUrl !== undefined) updateData.linkUrl = linkUrl;
    if (active !== undefined) updateData.active = active ? 1 : 0;
    
    await db('promotions').where({ id: promoId }).update(updateData);
    
    const updatedPromo = await db('promotions').where({ id: promoId }).first();
    
    return res.json({
      success: true,
      message: 'Promotion updated successfully',
      promotion: updatedPromo
    });
  } catch (error) {
    console.error('Error updating promotion:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update promotion',
      error: error.message
    });
  }
});

// DELETE delete promotion
router.delete('/:id', async (req, res) => {
  try {
    const promoId = parseInt(req.params.id, 10);
    const promotion = await db('promotions').where({ id: promoId }).first();
    
    if (!promotion) {
      return res.status(404).json({ success: false, message: 'Promotion not found' });
    }
    
    await db('promotions').where({ id: promoId }).delete();
    
    return res.json({
      success: true,
      message: 'Promotion deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting promotion:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete promotion',
      error: error.message
    });
  }
});

module.exports = router;
