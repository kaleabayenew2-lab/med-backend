const express = require('express');
const router = express.Router();
const HospitalType = require('../models/hospitalType');

// Get all hospital types
router.get('/', async (req, res) => {
  try {
    const types = await HospitalType.findAll();
    res.json(types);
  } catch (error) {
    console.error('Error fetching hospital types:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get hospital type by ID
router.get('/:id', async (req, res) => {
  try {
    const type = await HospitalType.findById(req.params.id);
    if (!type) {
      return res.status(404).json({ error: 'Hospital type not found' });
    }
    res.json(type);
  } catch (error) {
    console.error('Error fetching hospital type:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;