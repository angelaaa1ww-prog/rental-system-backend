const Transaction = require("../models/Transaction");
const Tenant = require("../models/Tenant");
const Payment = require("../models/Payment");
const House = require("../models/House");
const daraja = require("../daraja.js");

// =============================================
// VALIDATION URL (C2B)
// =============================================
exports.validatePayment = async (req, res) => {
  console.log("M-PESA VALIDATION:");
  console.log(req.body);

  // In a real app, you might check if the MSISDN or BillRefNumber exists
  res.json({
    ResultCode: 0,
    ResultDesc: "Accepted"
  });
};

// =============================================
// CONFIRMATION URL (C2B)
// =============================================
exports.confirmPayment = async (req, res) => {
  try {
    console.log("M-PESA CONFIRMATION:");
    console.log(req.body);

    const {
      TransID,
      TransAmount,
      MSISDN,
      BillRefNumber,
      FirstName,
      LastName
    } = req.body;

    // 1. Save the raw transaction
    const transaction = new Transaction({
      transactionType: req.body.TransactionType,
      transID: TransID,
      transTime: req.body.TransTime,
      transAmount: Number(TransAmount),
      businessShortCode: req.body.BusinessShortCode,
      billRefNumber: BillRefNumber,
      msisdn: MSISDN,
      firstName: FirstName,
      lastName: LastName
    });
    await transaction.save();

    // 2. Try to find the tenant
    // Priority 1: Exact match on BillRefNumber (House Number)
    // Priority 2: Match on Phone Number (MSISDN)
    let tenant = await Tenant.findOne({ active: true }).populate('house');
    
    // Search by house number (BillRefNumber)
    const houseMatch = await House.findOne({ houseNumber: new RegExp(`^${BillRefNumber}$`, 'i') });
    if (houseMatch) {
      tenant = await Tenant.findOne({ house: houseMatch._id, active: true }).populate('house');
    }

    // If no house match, try phone number
    if (!tenant) {
      const cleanPhone = MSISDN.replace('254', '0'); // convert 254... to 0...
      tenant = await Tenant.findOne({ 
        $or: [{ phone: MSISDN }, { phone: cleanPhone }],
        active: true 
      }).populate('house');
    }

    if (tenant) {
      console.log(`✅ Linking payment ${TransID} to tenant ${tenant.name}`);

      // 3. Create a Payment record (for confirmed payments via C2B)
      await Payment.create({
        tenant: tenant._id,
        amount: Number(TransAmount),
        reference: TransID,
        status: 'confirmed',
        month: new Date().toISOString().slice(0, 7),
        paymentMethod: 'mpesa',
        note: `C2B Payment via M-Pesa. Ref: ${BillRefNumber}`
      });

      // 4. Also update any pending STK push payment that matches this tenant, amount, and recent time
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      const pendingPayment = await Payment.findOne({
        tenant: tenant._id,
        amount: Number(TransAmount),
        status: 'pending',
        paymentMethod: 'mpesa',
        createdAt: { $gte: tenMinutesAgo }
      }).sort({ createdAt: -1 }); // get the most recent pending

      if (pendingPayment) {
        pendingPayment.status = 'confirmed';
        pendingPayment.mpesaReceipt = TransID;
        pendingPayment.note = `STK push confirmed. M-Pesa Receipt: ${TransID}`;
        await pendingPayment.save();
        console.log(`🔄 Updated pending payment ${pendingPayment._id} to confirmed`);
      }

    } else {
      console.warn(`⚠️ Could not find tenant for payment ${TransID} (Phone: ${MSISDN}, Ref: ${BillRefNumber})`);
    }

    res.json({
      ResultCode: 0,
      ResultDesc: "Received Successfully"
    });

  } catch (error) {
    console.error("🔥 M-PESA Confirmation Error:", error);
    res.status(500).json({
      message: "Error processing transaction",
      error: error.message
    });
  }
};

// =============================================
// INITIATE STK PUSH
// POST /api/mpesa/pay
// =============================================
exports.initiateStkPush = async (req, res) => {
  try {
    const { tenantId, amount } = req.body;

    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required' });
    }

    // Find tenant
    const tenant = await Tenant.findById(tenantId).populate('house');
    if (!tenant) {
      return res.status(404).json({ message: 'Tenant not found' });
    }
    if (!tenant.phone) {
      return res.status(400).json({ message: 'Tenant has no phone number' });
    }

    // Determine amount to charge
    let chargeAmount;
    if (amount && !isNaN(amount) && Number(amount) > 0) {
      chargeAmount = Number(amount);
    } else {
      // Use house rent if available
      if (!tenant.house || !tenant.house.rent) {
        return res.status(400).json({ message: 'Tenant has no house assigned or house rent not set' });
      }
      chargeAmount = Number(tenant.house.rent);
    }

    // Format phone number to +254XXXXXXXXX
    let phone = tenant.phone.trim();
    if (phone.startsWith('0')) {
      phone = '+254' + phone.substring(1);
    } else if (phone.startsWith('254')) {
      phone = '+' + phone;
    } else if (!phone.startsWith('+254')) {
      phone = '+254' + phone;
    }

    // Initiate STK push via Daraja
    const result = await daraja.stkPush(phone, chargeAmount);

    if (!result || !result.CheckoutRequestID) {
      console.error('Daraja STK push failed:', result);
      return res.status(500).json({ message: 'Failed to initiate M-Pesa payment' });
    }

    const checkoutRequestID = result.CheckoutRequestID;

    // Create pending payment record
    const pendingPayment = await Payment.create({
      tenant: tenant._id,
      amount: chargeAmount,
      reference: checkoutRequestID,
      status: 'pending',
      paymentMethod: 'mpesa',
      month: new Date().toISOString().slice(0, 7),
      note: `STK push initiated. CheckoutRequestID: ${checkoutRequestID}`
    });

    console.log(`📱 STK push initiated for tenant ${tenant.name}, CheckoutRequestID: ${checkoutRequestID}`);

    res.json({
      success: true,
      checkoutRequestID,
      message: 'M-Pesa prompt sent to tenant\'s phone'
    });

  } catch (error) {
    console.error('🔥 M-PESA Initiate STK Push Error:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

// =============================================
// CHECK STK PUSH STATUS
// GET /api/mpesa/status/:checkoutRequestID
// =============================================
exports.checkStkStatus = async (req, res) => {
  try {
    const { checkoutRequestID } = req.params;

    if (!checkoutRequestID) {
      return res.status(400).json({ message: 'CheckoutRequestID is required' });
    }

    // Find payment by reference
    const payment = await Payment.findOne({ reference: checkoutRequestID })
      .populate('tenant')
      .populate('house');

    if (!payment) {
      return res.status(404).json({ message: 'Payment request not found' });
    }

    // Return current status
    res.json({
      status: payment.status,
      amount: payment.amount,
      tenant: payment.tenant ? {
        name: payment.tenant.name,
        phone: payment.tenant.phone
      } : null,
      house: payment.house ? payment.house.houseNumber : null,
      mpesaReceipt: payment.mpesaReceipt,
      note: payment.note,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt
    });

  } catch (error) {
    console.error('🔥 M-PESA Check Status Error:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

module.exports = exports;