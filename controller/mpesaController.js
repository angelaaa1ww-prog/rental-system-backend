const mongoose = require("mongoose");
const Transaction = require("../models/Transaction");
const Tenant = require("../models/Tenant");
const Payment = require("../models/Payment");
const House = require("../models/House");
const mpesa = require("../utils/mpesa");

const accepted = (res, desc = "Accepted") =>
  res.json({ ResultCode: 0, ResultDesc: desc });

const rejected = (res, code, desc) =>
  res.json({ ResultCode: code, ResultDesc: desc });

const currentMonth = () => new Date().toISOString().slice(0, 7);

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const compactRef = (value) =>
  String(value || "")
    .trim()
    .replace(/[\s_-]/g, "")
    .toLowerCase();

const phoneVariants = (phone) => {
  const variants = new Set();
  const raw = String(phone || "").trim();
  if (!raw) return [];

  variants.add(raw);
  variants.add(raw.replace(/[^\d+]/g, ""));

  try {
    const normalized = mpesa.normalizePhone(raw);
    variants.add(normalized);
    variants.add(`+${normalized}`);
    variants.add(`0${normalized.slice(3)}`);
  } catch {
    // Keep raw variants only when Safaricom sends an unexpected value.
  }

  return [...variants].filter(Boolean);
};

const findTenantForPayment = async ({ billRefNumber, msisdn }) => {
  const ref = String(billRefNumber || "").trim();

  if (ref) {
    if (mongoose.Types.ObjectId.isValid(ref)) {
      const tenantById = await Tenant.findOne({ _id: ref, active: true }).populate("house");
      if (tenantById) return { tenant: tenantById, matchType: "tenant_id" };
    }

    const tenantByIdNumber = await Tenant.findOne({
      active: true,
      idNumber: new RegExp(`^${escapeRegex(ref)}$`, "i"),
    }).populate("house");
    if (tenantByIdNumber) return { tenant: tenantByIdNumber, matchType: "tenant_id_number" };

    const exactHouses = await House.find({
      houseNumber: new RegExp(`^${escapeRegex(ref)}$`, "i"),
    });
    const occupiedExactHouses = exactHouses.filter((house) => house.status === "occupied");
    if (occupiedExactHouses.length === 1) {
      const houseByNumber = occupiedExactHouses[0];
      const tenantByHouse = await Tenant.findOne({
        active: true,
        house: houseByNumber._id,
      }).populate("house");
      if (tenantByHouse) return { tenant: tenantByHouse, matchType: "house_number" };
    }

    const normalizedRef = compactRef(ref);
    const occupiedHouses = await House.find({ status: "occupied" }).limit(1000);
    const matchedHouse = occupiedHouses.find((house) => {
      const options = [
        house.houseNumber,
        `${house.apartment}${house.houseNumber}`,
        `${house.houseNumber}${house.apartment}`,
      ].map(compactRef);
      return options.includes(normalizedRef);
    });

    if (matchedHouse) {
      const tenantByHouse = await Tenant.findOne({
        active: true,
        house: matchedHouse._id,
      }).populate("house");
      if (tenantByHouse) return { tenant: tenantByHouse, matchType: "apartment_house_number" };
    }
  }

  const variants = phoneVariants(msisdn);
  if (variants.length) {
    const tenantByPhone = await Tenant.findOne({
      active: true,
      phone: { $in: variants },
    }).populate("house");
    if (tenantByPhone) return { tenant: tenantByPhone, matchType: "phone" };

    const tenants = await Tenant.find({ active: true }).populate("house");
    const tenantByNormalizedPhone = tenants.find((tenant) =>
      phoneVariants(tenant.phone).some((variant) => variants.includes(variant))
    );
    if (tenantByNormalizedPhone) {
      return { tenant: tenantByNormalizedPhone, matchType: "normalized_phone" };
    }
  }

  return { tenant: null, matchType: null };
};

const upsertTransaction = async (body, overrides = {}) => {
  const transID = overrides.transID || body.TransID || body.MpesaReceiptNumber;
  if (!transID) return null;

  const data = {
    transactionType: overrides.transactionType || body.TransactionType,
    transID,
    transTime: overrides.transTime || body.TransTime,
    transAmount: Number(overrides.transAmount ?? body.TransAmount) || 0,
    businessShortCode: body.BusinessShortCode,
    billRefNumber: body.BillRefNumber,
    invoiceNumber: body.InvoiceNumber,
    orgAccountBalance: body.OrgAccountBalance,
    thirdPartyTransID: body.ThirdPartyTransID,
    msisdn: String(overrides.msisdn || body.MSISDN || ""),
    firstName: body.FirstName,
    middleName: body.MiddleName,
    lastName: body.LastName,
    raw: body,
  };

  let transaction = await Transaction.findOne({ transID });
  if (transaction) {
    Object.assign(transaction, data);
  } else {
    transaction = new Transaction(data);
  }

  await transaction.save();
  return transaction;
};

const linkConfirmedPayment = async ({ body, tenant, matchType, transaction }) => {
  const transID = body.TransID;
  const amount = Number(body.TransAmount);
  const msisdn = String(body.MSISDN || "");
  const billRefNumber = String(body.BillRefNumber || "").trim() || null;

  const existingPayment = await Payment.findOne({
    $or: [{ reference: transID }, { mpesaReceipt: transID }],
  });

  if (existingPayment) {
    if (transaction) {
      transaction.payment = existingPayment._id;
      transaction.tenant = existingPayment.tenant;
      transaction.status = "duplicate";
      transaction.matchType = matchType || transaction.matchType;
      await transaction.save();
    }
    return { payment: existingPayment, duplicate: true };
  }

  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  let payment = await Payment.findOne({
    tenant: tenant._id,
    amount,
    status: "pending",
    paymentMethod: "mpesa",
    createdAt: { $gte: tenMinutesAgo },
  }).sort({ createdAt: -1 });

  if (payment) {
    payment.status = "confirmed";
    payment.mpesaReceipt = transID;
    payment.mpesaPhone = msisdn || null;
    payment.billRefNumber = billRefNumber;
    payment.mpesaRawCallback = body;
    payment.note = `M-Pesa payment confirmed. Receipt: ${transID}`;
  } else {
    payment = await Payment.create({
      tenant: tenant._id,
      amount,
      reference: transID,
      status: "confirmed",
      month: currentMonth(),
      paymentMethod: "mpesa",
      mpesaReceipt: transID,
      mpesaPhone: msisdn || null,
      billRefNumber,
      mpesaRawCallback: body,
      note: `C2B PayBill payment via M-Pesa. Account: ${billRefNumber || "none"}`,
    });
  }

  if (!payment.month) payment.month = currentMonth();
  await payment.save();

  if (transaction) {
    transaction.payment = payment._id;
    transaction.tenant = tenant._id;
    transaction.status = "linked";
    transaction.matchType = matchType;
    await transaction.save();
  }

  return { payment, duplicate: false };
};

const extractStkMetadata = (callback) => {
  const items = callback?.CallbackMetadata?.Item || [];
  return items.reduce((acc, item) => {
    acc[item.Name] = item.Value;
    return acc;
  }, {});
};

exports.validatePayment = async (req, res) => {
  try {
    const amount = Number(req.body.TransAmount);
    if (!amount || amount <= 0) {
      return rejected(res, "C2B00013", "Invalid amount");
    }

    const strictValidation =
      String(process.env.MPESA_C2B_STRICT_VALIDATION || "").toLowerCase() === "true";

    if (strictValidation) {
      const { tenant } = await findTenantForPayment({
        billRefNumber: req.body.BillRefNumber,
        msisdn: req.body.MSISDN,
      });

      if (!tenant) {
        return rejected(res, "C2B00012", "Invalid account number");
      }
    }

    return accepted(res, "Accepted");
  } catch (error) {
    console.error("M-Pesa validation error:", error);
    return rejected(res, "C2B00016", "Unable to validate transaction");
  }
};

exports.confirmPayment = async (req, res) => {
  try {
    const body = req.body || {};

    if (!body.TransID) {
      return accepted(res, "Ignored callback without transaction id");
    }
    if (!Number(body.TransAmount) || Number(body.TransAmount) <= 0) {
      return accepted(res, "Ignored callback with invalid amount");
    }

    const transaction = await upsertTransaction(body);
    const { tenant, matchType } = await findTenantForPayment({
      billRefNumber: body.BillRefNumber,
      msisdn: body.MSISDN,
    });

    if (!tenant) {
      if (transaction) {
        transaction.status = "unmatched";
        transaction.matchType = null;
        await transaction.save();
      }
      return accepted(res, "Received. Payment is unmatched.");
    }

    await linkConfirmedPayment({ body, tenant, matchType, transaction });
    return accepted(res, "Received Successfully");
  } catch (error) {
    console.error("M-Pesa confirmation error:", error);
    return res.status(500).json({
      ResultCode: 1,
      ResultDesc: "Error processing transaction",
    });
  }
};

exports.registerC2BUrls = async (req, res) => {
  try {
    const result = await mpesa.registerC2BUrls();
    return res.json({
      message: "C2B callback URLs registered with Daraja",
      ...result,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to register C2B callback URLs",
      error: error.response?.data || error.message,
    });
  }
};

exports.simulateC2BPayment = async (req, res) => {
  try {
    const { amount, phone, billRefNumber, commandId } = req.body;
    const result = await mpesa.simulateC2BPayment({
      amount,
      phone: phone || process.env.MPESA_TEST_MSISDN || "254708374149",
      billRefNumber,
      commandId,
    });

    return res.json({
      message: "C2B sandbox simulation sent",
      ...result,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to simulate C2B payment",
      error: error.response?.data || error.message,
    });
  }
};

exports.initiateStkPush = async (req, res) => {
  try {
    const { tenantId, amount } = req.body;

    if (!tenantId) {
      return res.status(400).json({ message: "Tenant ID is required" });
    }

    const tenant = await Tenant.findById(tenantId).populate("house");
    if (!tenant) {
      return res.status(404).json({ message: "Tenant not found" });
    }
    if (!tenant.phone) {
      return res.status(400).json({ message: "Tenant has no phone number" });
    }

    let chargeAmount = Number(amount);
    if (!chargeAmount || chargeAmount <= 0) {
      if (!tenant.house || !tenant.house.rent) {
        return res.status(400).json({
          message: "Tenant has no house assigned or house rent is not set",
        });
      }
      chargeAmount = Number(tenant.house.rent);
    }

    const result = await mpesa.stkPush({
      phone: tenant.phone,
      amount: chargeAmount,
      accountRef: tenant.house?.houseNumber || tenant._id,
      description: "Rent Payment",
    });

    if (!result || !result.CheckoutRequestID) {
      return res.status(500).json({
        message: "Failed to initiate M-Pesa payment",
        details: result,
      });
    }

    const checkoutRequestID = result.CheckoutRequestID;
    await Payment.create({
      tenant: tenant._id,
      amount: chargeAmount,
      reference: checkoutRequestID,
      checkoutRequestID,
      status: "pending",
      paymentMethod: "mpesa",
      month: currentMonth(),
      billRefNumber: tenant.house?.houseNumber || null,
      note: `STK push initiated. CheckoutRequestID: ${checkoutRequestID}`,
      mpesaRawCallback: result,
    });

    return res.json({
      success: true,
      checkoutRequestID,
      checkoutRequestId: checkoutRequestID,
      message: "M-Pesa prompt sent to tenant's phone",
    });
  } catch (error) {
    console.error("M-Pesa STK push error:", error.response?.data || error.message);
    return res.status(500).json({
      message: "Failed to initiate M-Pesa payment",
      error: error.response?.data || error.message,
    });
  }
};

exports.handleStkCallback = async (req, res) => {
  try {
    const callback = req.body?.Body?.stkCallback || req.body?.stkCallback || req.body || {};
    const checkoutRequestID = callback.CheckoutRequestID;

    if (!checkoutRequestID) {
      return accepted(res, "Ignored callback without CheckoutRequestID");
    }

    const resultCode = Number(callback.ResultCode);
    const metadata = extractStkMetadata(callback);
    const receipt = metadata.MpesaReceiptNumber;
    const amount = Number(metadata.Amount) || 0;
    const phone = metadata.PhoneNumber ? String(metadata.PhoneNumber) : "";

    let payment = await Payment.findOne({
      $or: [{ reference: checkoutRequestID }, { checkoutRequestID }],
    });

    if (resultCode !== 0) {
      if (payment) {
        payment.status = "failed";
        payment.note = callback.ResultDesc || "STK push failed or was cancelled";
        payment.mpesaRawCallback = req.body;
        await payment.save();
      }
      return accepted(res, "STK callback received");
    }

    if (receipt) {
      const duplicate = await Payment.findOne({ mpesaReceipt: receipt });
      if (duplicate && (!payment || String(duplicate._id) !== String(payment._id))) {
        return accepted(res, "Duplicate STK callback received");
      }
    }

    let tenant = payment ? await Tenant.findById(payment.tenant).populate("house") : null;
    if (!tenant) {
      const match = await findTenantForPayment({ msisdn: phone });
      tenant = match.tenant;
    }

    if (!payment && tenant) {
      payment = await Payment.create({
        tenant: tenant._id,
        amount,
        reference: checkoutRequestID,
        checkoutRequestID,
        status: "pending",
        paymentMethod: "mpesa",
        month: currentMonth(),
      });
    }

    if (payment) {
      payment.status = "confirmed";
      payment.amount = amount || payment.amount;
      payment.mpesaReceipt = receipt || payment.mpesaReceipt;
      payment.mpesaPhone = phone || payment.mpesaPhone;
      payment.mpesaRawCallback = req.body;
      payment.note = `STK push confirmed. M-Pesa receipt: ${receipt || "unknown"}`;
      if (!payment.month) payment.month = currentMonth();
      await payment.save();
    }

    const transaction = await upsertTransaction(
      {
        TransID: receipt || checkoutRequestID,
        TransAmount: amount,
        MSISDN: phone,
        BillRefNumber: payment?.billRefNumber,
      },
      {
        transactionType: "STK_PUSH",
        transID: receipt || checkoutRequestID,
        transAmount: amount,
        msisdn: phone,
      }
    );

    if (transaction) {
      transaction.payment = payment?._id || null;
      transaction.tenant = tenant?._id || payment?.tenant || null;
      transaction.status = payment ? "linked" : "unmatched";
      transaction.matchType = payment ? "checkout_request" : null;
      await transaction.save();
    }

    return accepted(res, "STK callback received");
  } catch (error) {
    console.error("M-Pesa STK callback error:", error);
    return res.status(500).json({
      ResultCode: 1,
      ResultDesc: "Error processing STK callback",
    });
  }
};

exports.checkStkStatus = async (req, res) => {
  try {
    const { checkoutRequestID } = req.params;

    if (!checkoutRequestID) {
      return res.status(400).json({ message: "CheckoutRequestID is required" });
    }

    const payment = await Payment.findOne({
      $or: [{ reference: checkoutRequestID }, { checkoutRequestID }],
    }).populate({
      path: "tenant",
      populate: { path: "house" },
    });

    if (!payment) {
      return res.status(404).json({ message: "Payment request not found" });
    }

    return res.json({
      status: payment.status,
      amount: payment.amount,
      tenant: payment.tenant
        ? {
            name: payment.tenant.name,
            phone: payment.tenant.phone,
          }
        : null,
      house: payment.tenant?.house?.houseNumber || null,
      mpesaReceipt: payment.mpesaReceipt,
      note: payment.note,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    });
  } catch (error) {
    console.error("M-Pesa status error:", error);
    return res.status(500).json({
      message: "Failed to check M-Pesa payment status",
      error: error.message,
    });
  }
};

module.exports = exports;
