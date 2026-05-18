const express = require('express');
const router = express.Router();
const facilityStatusController = require('../controllers/facilityStatusController');

router.post('/', facilityStatusController.addFavoriteStatus);
router.post('/remove', facilityStatusController.removeFavoriteStatus);
router.get('/user/:userId', facilityStatusController.getFavoritesByUser);
router.get('/user-by-email', facilityStatusController.getFavoritesByUserEmail);
router.get('/facility/:facilityId', facilityStatusController.getFavoritesByFacility);

module.exports = router;
