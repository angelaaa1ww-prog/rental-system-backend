const express = require('express');
const router = express.Router();
const Payment = require('../models/Payment');
const Tenant = require('../models/Tenant');
const sendSMS = require('../utils/sms');

// =====================
// MPESA CALLBACK WEBHOOK
// =====================
// Safaricom sends the STK push result here
router.post('/callback', async (req, res) => {
  console.log('--- MPESA CALLBACK RECEIVED ---');
  
  // Safaricom sends data in req.body.Body.stkCallback
  const callbackData = req.body?.Body?.stkCallback;
  const tenantId = req.query.tenantId; // We passed this in the callback URL

  if (!callbackData) {
    console.log('Invalid callback payload');
    return res.status(400).json({ message: 'Invalid payload' });
  }

  const { ResultCode, ResultDesc, CallbackMetadata } = callbackData;
  console.log(`ResultCode: ${ResultCode} - ${ResultDesc}`);

  // Safaricom expects a quick response so they don't retry the webhook
  res.json({ ResultCode: 0, ResultDesc: "Accepted" });

  // ResultCode 0 means the payment was successful
  if (ResultCode === 0 && CallbackMetadata) {
    try {
      // Extract data from CallbackMetadata array
      let amount = 0;
      let mpesaReceiptNumber = '';
      let phoneNumber = '';

      CallbackMetadata.Item.forEach(item => {
        if (item.Name === 'Amount') amount = item.Value;
        if (item.Name === 'MpesaReceiptNumber') mpesaReceiptNumber = item.Value;
        if (item.Name === 'PhoneNumber') phoneNumber = item.Value;
      });

      console.log(`Payment successful: KES ${amount} by ${phoneNumber}. Receipt: ${mpesaReceiptNumber}`);

      let tenant = null;

      // 1. Try to find the tenant by the passed tenantId
      if (tenantId) {
        tenant = await Tenant.findById(tenantId).populate('house');
      }

      // 2. Fallback: find tenant by phone number
      if (!tenant) {
        // Formats like 254712345678 to 0712345678
        const localPhone = '0' + String(phoneNumber).substring(3);
        tenant = await Tenant.findOne({ phone: localPhone }).populate('house');
      }

      if (!tenant) {
        console.error('Tenant not found for this payment. Cannot update balance.');
        // We could create an "Unassigned Payment" here if we had that model, but for now just log it.
        return;
      }

      // Create Payment record
      const payment = new Payment({
        tenant: tenant._id,
        amount: amount,
        paymentMethod: 'mpesa',
        mpesaReceipt: mpesaReceiptNumber,
        reference: mpesaReceiptNumber, // Also use it as the general reference
        status: 'confirmed',
        note: `Automated STK Push payment from ${phoneNumber}`
      });

      await payment.save();
      console.log('✅ Payment saved to database automatically.');

      // Send confirmation SMS automatically
      const houseNumber = tenant.house ? tenant.house.houseNumber : 'your house';
      const smsMsg = `Dear ${tenant.name}, we have received your rent payment of KES ${amount} for ${houseNumber}. Receipt: ${mpesaReceiptNumber}. Thank you! - GIFTED HANDS VENTURES`;
      
      await sendSMS(tenant.phone, smsMsg).catch(err => {
        console.error('Failed to send MPESA confirmation SMS:', err.message);
      });

    } catch (err) {
      console.error('Error processing successful MPESA callback:', err);
    }
  } else {
    // Payment failed or was cancelled by user
    console.log(`Payment failed or cancelled by user. Reason: ${ResultDesc}`);
  }
});

module.exports = router;