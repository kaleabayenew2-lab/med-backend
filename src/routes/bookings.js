const express = require('express');
const router = express.Router();
const Booking = require('../models/booking');
const axios = require('axios');

// Create a new booking
router.post('/', async (req, res) => {
  try {
    const {
      facilityId,
      facilityName,
      facilityType,
      patientName,
      patientAge,
      patientPhone,
      userEmail,
      purpose,
      appointmentDate,
      appointmentTime,
      status,
      paymentStatus,
      paymentMethod,
      amount
    } = req.body;

    // Validate inputs
    if (!facilityId || !facilityName || !facilityType || !patientName || !patientAge || !patientPhone || !purpose || !appointmentDate || !appointmentTime) {
      return res.status(400).json({
        success: false,
        message: 'Missing required booking fields'
      });
    }

    const booking = await Booking.create({
      facilityId: parseInt(facilityId, 10),
      facilityName,
      facilityType,
      patientName,
      patientAge: parseInt(patientAge, 10),
      patientPhone,
      userEmail,
      purpose,
      appointmentDate,
      appointmentTime,
      status: status || 'confirmed',
      paymentStatus: paymentStatus || 'unpaid',
      paymentMethod: paymentMethod || null,
      amount: amount ? parseFloat(amount) : 250.0
    });

    // If it is a Book & Pay transaction (paymentStatus is pending or paymentMethod is Chapa)
    if (paymentStatus === 'pending' || paymentMethod === 'Chapa') {
      // 1. Clean and parse phone number to exact 10-digit format (09xxxxxxx or 07xxxxxxx) required by Chapa
      let cleanPhone = patientPhone.replace(/\D/g, '');
      if (cleanPhone.startsWith('251')) {
        cleanPhone = '0' + cleanPhone.substring(3);
      }
      if (cleanPhone.length === 9 && (cleanPhone.startsWith('9') || cleanPhone.startsWith('7'))) {
        cleanPhone = '0' + cleanPhone;
      }
      if (cleanPhone.length !== 10 || (!cleanPhone.startsWith('09') && !cleanPhone.startsWith('07'))) {
        cleanPhone = '0912345678'; // solid fallback
      }

      // 2. Parse patient first/last names
      const nameParts = patientName.trim().split(/\s+/);
      const firstName = nameParts[0] || 'Patient';
      const lastName = nameParts.slice(1).join(' ') || 'User';

      const chapaAmount = amount ? parseFloat(amount).toString() : '250';
      const protocol = req.protocol;
      const host = req.get('host');
      const callbackUrl = `${protocol}://${host}/api/bookings/callback/${booking.id}`;
      const returnUrl = `${protocol}://${host}/api/bookings/callback/${booking.id}?status=success`;

      // 3. Formulate raw Chapa payload
      const chapaPayload = {
        amount: chapaAmount,
        currency: 'ETB',
        email: userEmail || 'patient@gmail.com',
        first_name: firstName,
        last_name: lastName,
        phone_number: cleanPhone,
        tx_ref: `tx-booking-${booking.id}-${Date.now()}`,
        callback_url: callbackUrl,
        return_url: returnUrl,
        'customization[title]': `Appointment at ${facilityName}`,
        'customization[description]': `Medical consultation booking for ${patientName}`,
        'meta[hide_receipt]': 'true'
      };

      try {
        console.log('Initializing Chapa payment with payload:', chapaPayload);
        const chapaSecretKey = process.env.CHAPA_SECRET_KEY || 'CHASECK_TEST-f1c2b3d4e5f6g7h8i9j0';
        
        const response = await axios.post(
          'https://api.chapa.co/v1/transaction/initialize',
          chapaPayload,
          {
            headers: {
              Authorization: `Bearer ${chapaSecretKey}`,
              'Content-Type': 'application/json'
            },
            timeout: 5000 // 5 seconds timeout
          }
        );

        if (response.data && response.data.status === 'success' && response.data.data && response.data.data.checkout_url) {
          return res.status(201).json({
            success: true,
            message: 'Booking created. Proceed to payment.',
            booking,
            checkoutUrl: response.data.data.checkout_url
          });
        }
      } catch (chapaError) {
        console.warn('Chapa live API call failed or timed out. Falling back to high-fidelity local payment simulator.', chapaError.message);
      }

      // Fallback: Generate local interactive simulation URL
      const simulatedCheckoutUrl = `${protocol}://${host}/api/bookings/simulate/${booking.id}`;
      return res.status(201).json({
        success: true,
        message: 'Booking created. Proceed to payment (Simulator Mode).',
        booking,
        checkoutUrl: simulatedCheckoutUrl
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      booking
    });
  } catch (error) {
    console.error('Error creating booking:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create booking',
      error: error.message
    });
  }
});

// GET Callback endpoint from Chapa payment gateway
router.get('/callback/:id', async (req, res) => {
  try {
    const bookingId = parseInt(req.params.id, 10);
    const status = req.query.status || 'success';
    const isSuccess = status === 'success';
    
    console.log(`Chapa callback received for booking ${bookingId} with status: ${status}`);

    if (isSuccess) {
      await Booking.updatePaymentStatus(bookingId, 'paid');
    }

    // Return premium confirmation dashboard html
    return res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${isSuccess ? 'Payment Completed - Chapa Secure' : 'Payment Cancelled - Chapa Secure'}</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap" rel="stylesheet">
          <style>
            body {
              font-family: 'Outfit', -apple-system, sans-serif;
              background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              margin: 0;
              padding: 20px;
              color: #1f2937;
            }
            .card {
              background: white;
              padding: 40px 30px;
              border-radius: 20px;
              box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
              max-width: 420px;
              width: 100%;
              text-align: center;
            }
            .status-badge {
              width: 72px;
              height: 72px;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              margin: 0 auto 24px;
              font-size: 32px;
              font-weight: bold;
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
            }
            .badge-success {
              background-color: #ecfdf5;
              color: #059669;
            }
            .badge-fail {
              background-color: #fef2f2;
              color: #dc2626;
            }
            h1 {
              font-size: 24px;
              font-weight: 700;
              margin-bottom: 8px;
              color: #111827;
            }
            p {
              font-size: 15px;
              color: #6b7280;
              line-height: 1.6;
              margin-bottom: 32px;
            }
            .details {
              background-color: #f9fafb;
              border-radius: 12px;
              padding: 16px;
              margin-bottom: 32px;
              text-align: left;
              border: 1px solid #f3f4f6;
            }
            .row {
              display: flex;
              justify-content: space-between;
              font-size: 13px;
              padding: 6px 0;
            }
            .row-label {
              color: #9ca3af;
            }
            .row-val {
              font-weight: 600;
              color: #374151;
            }
            .btn {
              color: white;
              padding: 14px 28px;
              border-radius: 12px;
              text-decoration: none;
              font-weight: 600;
              font-size: 14px;
              display: block;
              transition: all 0.2s ease;
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            }
            .btn-success {
              background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            }
            .btn-fail {
              background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
            }
            .btn:hover {
              transform: translateY(-1px);
              box-shadow: 0 6px 16px rgba(0, 0, 0, 0.15);
            }
            .helper-text {
              font-size: 12px;
              color: #9ca3af;
              margin-top: 14px;
              margin-bottom: 0;
              line-height: 1.4;
            }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="status-badge ${isSuccess ? 'badge-success' : 'badge-fail'}">
              ${isSuccess ? '✓' : '✕'}
            </div>
            <h1>${isSuccess ? 'Payment Successful!' : 'Payment Cancelled'}</h1>
            <p>
              ${isSuccess 
                ? 'Your booking has been secured and confirmed. You can now return to the application.' 
                : 'Your transaction was cancelled. The appointment remains reserved but unpaid. Please complete it in your bookings panel.'
              }
            </p>
            
            <div class="details">
              <div class="row">
                <span class="row-label">Booking ID</span>
                <span class="row-val">#${bookingId}</span>
              </div>
              <div class="row">
                <span class="row-label">Payment Gateway</span>
                <span class="row-val">Chapa Secure</span>
              </div>
              <div class="row">
                <span class="row-label">Transaction Status</span>
                <span class="row-val" style="color: ${isSuccess ? '#059669' : '#dc2626'};">
                  ${isSuccess ? 'CONFIRMED' : 'CANCELLED/PENDING'}
                </span>
              </div>
            </div>
            
            <a href="medicalapp://callback" class="btn ${isSuccess ? 'btn-success' : 'btn-fail'}">
              Return to Application
            </a>
            <p class="helper-text">
              Alternatively, you can tap the <strong>Done</strong> or <strong>Close</strong> button on the top-left navigation bar to return instantly.
            </p>
          </div>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Error handling Chapa callback:', error);
    return res.status(500).send('Error processing payment callback');
  }
});

// Interactive local Sandbox simulator replica of Chapa Payment Checkout
router.get('/simulate/:id', async (req, res) => {
  try {
    const bookingId = parseInt(req.params.id, 10);
    const booking = await Booking.findById(bookingId);
    
    if (!booking) {
      return res.status(404).send('Booking not found');
    }

    return res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Chapa Checkout Simulator</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
          <style>
            body {
              font-family: 'Outfit', sans-serif;
              background-color: #f4f6f8;
              margin: 0;
              padding: 0;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              color: #2b3a4a;
            }
            .container {
              background-color: #ffffff;
              width: 100%;
              max-width: 440px;
              border-radius: 16px;
              box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
              overflow: hidden;
              display: flex;
              flex-direction: column;
            }
            .header {
              background: linear-gradient(135deg, #009688 0%, #00796b 100%);
              color: #ffffff;
              padding: 30px 24px;
              text-align: center;
              position: relative;
            }
            .header h2 {
              margin: 0;
              font-size: 20px;
              font-weight: 700;
              letter-spacing: 0.5px;
            }
            .header p {
              margin: 8px 0 0 0;
              font-size: 13px;
              opacity: 0.9;
            }
            .chapa-brand {
              display: inline-block;
              background-color: rgba(255, 255, 255, 0.15);
              padding: 4px 10px;
              border-radius: 4px;
              font-size: 11px;
              font-weight: 600;
              margin-top: 12px;
              text-transform: uppercase;
              letter-spacing: 1px;
            }
            .billing-box {
              background-color: #e0f2f1;
              margin: 24px;
              padding: 16px 20px;
              border-radius: 10px;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            .billing-label {
              font-weight: 500;
              font-size: 14px;
              color: #00796b;
            }
            .billing-amount {
              font-size: 22px;
              font-weight: 700;
              color: #004d40;
            }
            .info-section {
              padding: 0 24px 24px 24px;
              flex-grow: 1;
            }
            .info-row {
              display: flex;
              justify-content: space-between;
              padding: 10px 0;
              border-bottom: 1px solid #f0f2f5;
              font-size: 14px;
            }
            .info-label {
              color: #78909c;
            }
            .info-val {
              font-weight: 600;
              color: #37474f;
            }
            .actions {
              padding: 0 24px 30px 24px;
              display: flex;
              flex-direction: column;
              gap: 12px;
            }
            .btn {
              padding: 14px;
              border: none;
              border-radius: 8px;
              font-size: 14px;
              font-weight: 600;
              cursor: pointer;
              transition: all 0.2s ease;
              text-align: center;
              text-decoration: none;
            }
            .btn-success {
              background-color: #009688;
              color: #ffffff;
              box-shadow: 0 4px 10px rgba(0, 150, 136, 0.2);
            }
            .btn-success:hover {
              background-color: #00897b;
              transform: translateY(-1px);
            }
            .btn-fail {
              background-color: #eceff1;
              color: #546e7a;
            }
            .btn-fail:hover {
              background-color: #cfd8dc;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>Secure Sandbox checkout</h2>
              <p>Chapa Payment Gateway Mockup</p>
              <span class="chapa-brand">Chapa Integrated</span>
            </div>
            
            <div class="billing-box">
              <span class="billing-label">Total Charge</span>
              <span class="billing-amount">${booking.amount} ETB</span>
            </div>
            
            <div class="info-section">
              <div class="info-row">
                <span class="info-label">Medical Facility</span>
                <span class="info-val">${booking.facilityName}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Patient Name</span>
                <span class="info-val">${booking.patientName}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Purpose of Visit</span>
                <span class="info-val">${booking.purpose}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Appointment Time</span>
                <span class="info-val">${booking.appointmentDate} @ ${booking.appointmentTime}</span>
              </div>
            </div>
            
            <div class="actions">
              <a href="/api/bookings/callback/${booking.id}?status=success" class="btn btn-success">
                Simulate Successful Payment
              </a>
              <a href="/api/bookings/callback/${booking.id}?status=failed" class="btn btn-fail">
                Simulate Cancelled/Failed Payment
              </a>
            </div>
          </div>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Error serving simulator:', error);
    return res.status(500).send('Error serving simulator page');
  }
});

// Get bookings (support filtering by userEmail)
router.get('/', async (req, res) => {
  try {
    const { email, facilityId } = req.query;
    let bookings;

    if (email) {
      bookings = await Booking.findByEmail(email);
    } else if (facilityId) {
      bookings = await Booking.findByFacilityId(parseInt(facilityId, 10));
    } else {
      bookings = await Booking.findAll();
    }

    return res.json({
      success: true,
      bookings
    });
  } catch (error) {
    console.error('Error fetching bookings:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch bookings',
      error: error.message
    });
  }
});

// PUT Update booking status
router.put('/:id/status', async (req, res) => {
  try {
    const bookingId = parseInt(req.params.id, 10);
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, message: 'Status is required' });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const db = require('../config/db');
    await db('bookings').where({ id: bookingId }).update({
      status: status.toLowerCase(),
      updatedAt: new Date()
    });

    const updatedBooking = await Booking.findById(bookingId);
    return res.json({
      success: true,
      message: `Booking status updated to ${status}`,
      booking: updatedBooking
    });
  } catch (error) {
    console.error('Error updating booking status:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update booking status',
      error: error.message
    });
  }
});

module.exports = router;
