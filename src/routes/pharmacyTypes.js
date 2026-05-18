const express = require('express');
const router = express.Router();
const PharmacyType = require('../models/pharmacyType');

// Get all pharmacy types
router.get('/', async (req, res) => {
  try {
    const types = await PharmacyType.findAll();
    res.json(types);
  } catch (error) {
    console.error('Error fetching pharmacy types:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get pharmacy type by ID
router.get('/:id', async (req, res) => {
  try {
    const type = await PharmacyType.findById(req.params.id);
    if (!type) {
      return res.status(404).json({ error: 'Pharmacy type not found' });
    }
    res.json(type);
  } catch (error) {
    console.error('Error fetching pharmacy type:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;