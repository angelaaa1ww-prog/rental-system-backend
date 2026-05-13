const Lease = require("../models/Lease");
const Tenant = require("../models/Tenant");
const House = require("../models/House");
const Payment = require("../models/Payment");

// =============================================
// CREATE LEASE
// POST /api/leases
// =============================================
exports.createLease = async (req, res) => {
  try {
    const { 
      tenantId, 
      houseId, 
      startDate, 
      endDate, 
      isRenewable,
      renewalTerms,
      baseRent,
      securityDeposit,
      petDeposit,
      utilitiesIncluded,
      includedUtilities,
      lateFeePolicy,
      addenda,
      notes,
      specialTerms,
      leaseType,
      documents
    } = req.body;

    // Validate required fields
    if (!tenantId || !houseId || !startDate || !endDate || !baseRent) {
      return res.status(400).json({ 
        message: "Tenant ID, House ID, start date, end date, and base rent are required" 
      });
    }

    // Validate tenant exists and is active
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      return res.status(404).json({ message: "Tenant not found" });
    }
    if (!tenant.active) {
      return res.status(400).json({ message: "Tenant is not active" });
    }

    // Validate house exists
    const house = await House.findById(houseId);
    if (!house) {
      return res.status(404).json({ message: "House not found" });
    }

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ message: "Invalid date format" });
    }
    if (end <= start) {
      return res.status(400).json({ message: "End date must be after start date" });
    }

    // Validate financial terms
    if (typeof baseRent !== 'number' || baseRent < 0) {
      return res.status(400).json({ message: "Base rent must be a non-negative number" });
    }
    if (typeof securityDeposit !== 'number' || securityDeposit < 0) {
      return res.status(400).json({ message: "Security deposit must be a non-negative number" });
    }
    if (typeof petDeposit !== 'number' || petDeposit < 0) {
      return res.status(400).json({ message: "Pet deposit must be a non-negative number" });
    }

    // Validate lease type
    const validLeaseTypes = ["residential", "commercial"];
    if (leaseType && !validLeaseTypes.includes(leaseType)) {
      return res.status(400).json({ message: "Invalid lease type" });
    }

    // Create lease
    const lease = await Lease.create({
      tenant: tenantId,
      house: houseId,
      startDate: start,
      endDate: end,
      isRenewable: !!isRenewable,
      renewalTerms: renewalTerms || {
        noticePeriodDays: 30,
        rentIncreasePercent: 0,
        maxRenewals: null
      },
      baseRent: Number(baseRent),
      securityDeposit: Number(securityDeposit),
      petDeposit: Number(petDeposit),
      utilitiesIncluded: !!utilitiesIncluded,
      includedUtilities: Array.isArray(includedUtilities) 
        ? includedUtilities.filter(util => 
            ["electricity", "water", "gas", "trash", "sewer", "internet", "cable"].includes(util)
          )
        : [],
      lateFeePolicy: lateFeePolicy || {
        gracePeriodDays: 5,
        feeAmount: 0,
        feeType: "flat",
        feePercent: 5
      },
      addenda: Array.isArray(addenda) 
        ? addenda.map(addendum => ({
            title: addendum.title.trim(),
            description: addendum.description.trim(),
            effectiveDate: addendum.effectiveDate ? new Date(addendum.effectiveDate) : new Date(),
            isActive: addendum.isActive !== undefined ? !!addendum.isActive : true
          }))
        : [],
      notes: notes ? notes.trim() : null,
      specialTerms: Array.isArray(specialTerms) 
        ? specialTerms.map(term => String(term).trim()).filter(term => term.length > 0)
        : [],
      leaseType: leaseType || "residential",
      documents: Array.isArray(documents)
        ? documents.map(doc => ({
            type: doc.type || "other",
            title: doc.title ? doc.title.trim() : "Untitled",
            url: doc.url ? doc.url.trim() : null,
            uploadedAt: doc.uploadedAt ? new Date(doc.uploadedAt) : new Date(),
            uploadedBy: doc.uploadedBy || null,
            uploadedByModel: doc.uploadedByModel || 'User'
          }))
        : []
    });

    // Populate references for response
    const populatedLease = await Lease.findById(lease._id)
      .populate('tenant', 'name phone')
      .populate('house', 'houseNumber location apartment bedrooms rent')
      .populate('documents.uploadedBy', 'name')
      .lean();

    res.status(201).json({
      message: "Lease created successfully",
      lease: populatedLease
    });

  } catch (error) {
    console.error("Create lease error:", error);
    res.status(500).json({ 
      message: "Failed to create lease", 
      error: error.message 
    });
  }
};

// =============================================
// GET ALL LEASES (with filtering and pagination)
// GET /api/leases
// =============================================
exports.getAllLeases = async (req, res) => {
  try {
    const { 
      tenantId, 
      houseId, 
      status, 
      leaseType,
      page = 1, 
      limit = 20,
      sortBy = "createdDate",
      sortOrder = "desc"
    } = req.query;

    // Build filter object
    const filter = {};
    if (tenantId) filter.tenant = tenantId;
    if (houseId) filter.house = houseId;
    if (status) filter.status = status;
    if (leaseType) filter.leaseType = leaseType;

    // Validate sort fields
    const validSortFields = ["createdDate", "startDate", "endDate", "status", "baseRent"];
    if (!validSortFields.includes(sortBy)) {
      return res.status(400).json({ message: "Invalid sort field" });
    }

    // Validate sort order
    if (!["asc", "desc"].includes(sortOrder)) {
      return res.status(400).json({ message: "Invalid sort order" });
    }

    // Parse pagination
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Execute query with population
    const [leases, totalCount] = await Promise.all([
      Lease.find(filter)
        .populate('tenant', 'name phone')
        .populate('house', 'houseNumber location apartment bedrooms rent')
        .sort({ [sortBy]: sortOrder === "desc" ? -1 : 1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Lease.countDocuments(filter)
    ]);

    res.json({
      leases,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalCount / limitNum),
        totalItems: totalCount
      }
    });

  } catch (error) {
    console.error("Get leases error:", error);
    res.status(500).json({ 
      message: "Failed to fetch leases", 
      error: error.message 
    });
  }
};

// =============================================
// GET SINGLE LEASE
// GET /api/leases/:id
// =============================================
exports.getLeaseById = async (req, res) => {
  try {
    const { id } = req.params;

    const lease = await Lease.findById(id)
      .populate('tenant', 'name phone idNumber')
      .populate('house', 'houseNumber location apartment bedrooms rent status tenant')
      .populate('documents.uploadedBy', 'name')
      .lean();

    if (!lease) {
      return res.status(404).json({ message: "Lease not found" });
    }

    // Add virtual fields
    const leaseObj = lease.toObject ? lease.toObject() : lease;
    leaseObj.daysUntilExpiry = lease.daysUntilExpiry;
    leaseObj.isExpired = lease.isExpired;
    leaseObj.isActive = lease.isActive;

    res.json({ lease: leaseObj });

  } catch (error) {
    console.error("Get lease by ID error:", error);
    res.status(500).json({ 
      message: "Failed to fetch lease", 
      error: error.message 
    });
  }
};

// =============================================
// UPDATE LEASE
// PUT /api/leases/:id
// =============================================
exports.updateLease = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Find lease
    const lease = await Lease.findById(id);
    if (!lease) {
      return res.status(404).json({ message: "Lease not found" });
    }

    // Prevent updates to certain fields if lease is active/expired/terminated
    const immutableWhenActive = ['tenant', 'house', 'startDate'];
    if (lease.status === 'active' || lease.status === 'expired' || lease.status === 'terminated') {
      const invalidUpdates = immutableWhenActive.filter(field => updateData[field] !== undefined);
      if (invalidUpdates.length > 0) {
        return res.status(400).json({ 
          message: `Cannot update ${invalidUpdates.join(', ')} for active/expired/terminated lease` 
        });
      }
    }

    // Validate dates if being updated
    if (updateData.startDate || updateData.endDate) {
      const startDate = updateData.startDate ? new Date(updateData.startDate) : lease.startDate;
      const endDate = updateData.endDate ? new Date(updateData.endDate) : lease.endDate;
      
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({ message: "Invalid date format" });
      }
      if (endDate <= startDate) {
        return res.status(400).json({ message: "End date must be after start date" });
      }
    }

    // Validate financial terms if being updated
    if (updateData.baseRent !== undefined && 
        (typeof updateData.baseRent !== 'number' || updateData.baseRent < 0)) {
      return res.status(400).json({ message: "Base rent must be a non-negative number" });
    }
    if (updateData.securityDeposit !== undefined && 
        (typeof updateData.securityDeposit !== 'number' || updateData.securityDeposit < 0)) {
      return res.status(400).json({ message: "Security deposit must be a non-negative number" });
    }
    if (updateData.petDeposit !== undefined && 
        (typeof updateData.petDeposit !== 'number' || updateData.petDeposit < 0)) {
      return res.status(400).json({ message: "Pet deposit must be a non-negative number" });
    }

    // Validate lease type if being updated
    if (updateData.leaseType) {
      const validLeaseTypes = ["residential", "commercial"];
      if (!validLeaseTypes.includes(updateData.leaseType)) {
        return res.status(400).json({ message: "Invalid lease type" });
    }
    }

    // Validate renewal terms if being updated
    if (updateData.renewalTerms) {
      const rt = updateData.renewalTerms;
      if (rt.noticePeriodDays !== undefined && 
          (typeof rt.noticePeriodDays !== 'number' || rt.noticePeriodDays < 0)) {
        return res.status(400).json({ message: "Notice period must be a non-negative number" });
      }
      if (rt.rentIncreasePercent !== undefined && 
          (typeof rt.rentIncreasePercent !== 'number' || rt.rentIncreasePercent < 0)) {
        return res.status(400).json({ message: "Rent increase percent must be a non-negative number" });
      }
      if (rt.maxRenewals !== undefined && 
          (typeof rt.maxRenewals !== 'number' || rt.maxRenewals < -1)) { // -1 means unlimited
        return res.status(400).json({ message: "Max renewals must be -1 (unlimited) or non-negative" });
      }
    }

    // Validate late fee policy if being updated
    if (updateData.lateFeePolicy) {
      const lfp = updateData.lateFeePolicy;
      if (lfp.gracePeriodDays !== undefined && 
          (typeof lfp.gracePeriodDays !== 'number' || lfp.gracePeriodDays < 0)) {
        return res.status(400).json({ message: "Grace period must be a non-negative number" });
      }
      if (lfp.feeAmount !== undefined && 
          (typeof lfp.feeAmount !== 'number' || lfp.feeAmount < 0)) {
        return res.status(400).json({ message: "Fee amount must be a non-negative number" });
      }
      if (lfp.feeType !== undefined && 
          !["flat", "percent"].includes(lfp.feeType)) {
        return res.status(400).json({ message: "Invalid fee type" });
      }
      if (lfp.feePercent !== undefined && 
          (typeof lfp.feePercent !== 'number' || lfp.feePercent < 0)) {
        return res.status(400).json({ message: "Fee percent must be a non-negative number" });
      }
    }

    // Validate addenda if being updated
    if (Array.isArray(updateData.addenda)) {
      for (const addendum of updateData.addenda) {
        if (!addendum.title || !addendum.title.trim()) {
          return res.status(400).json({ message: "Addendum title is required" });
        }
        if (!addendum.description || !addendum.description.trim()) {
          return res.status(400).json({ message: "Addendum description is required" });
        }
        if (addendum.effectiveDate && isNaN(new Date(addendum.effectiveDate).getTime())) {
          return res.status(400).json({ message: "Invalid effective date for addendum" });
        }
      }
    }

    // Update lease fields
    const allowedUpdates = [
      'tenant', 'house', 'startDate', 'endDate', 'isRenewable', 'renewalTerms',
      'baseRent', 'securityDeposit', 'petDeposit', 'utilitiesIncluded', 'includedUtilities',
      'lateFeePolicy', 'addenda', 'notes', 'specialTerms', 'leaseType', 'documents',
      'status', 'signedDate', 'terminatedDate', 'signedByTenant', 'signedByOwner',
      'signatures.tenant', 'signatures.owner'
    ];
    
    // Handle nested updates specially
    allowedUpdates.forEach(field => {
      if (updateData[field] !== undefined) {
        if (field.includes('.')) {
          // Handle nested objects like signatures.tenant
          const [topLevel, nestedField] = field.split('.');
          if (!lease[topLevel]) lease[topLevel] = {};
          lease[topLevel][nestedField] = updateData[field];
        } else {
          lease[field] = updateData[field];
        }
      }
    });

    await lease.save();

    // Populate for response
    const updatedLease = await Lease.findById(id)
      .populate('tenant', 'name phone')
      .populate('house', 'houseNumber location apartment bedrooms rent')
      .populate('documents.uploadedBy', 'name')
      .lean();

    // Add virtual fields
    const leaseObj = updatedLease.toObject ? updatedLease.toObject() : updatedLease;
    leaseObj.daysUntilExpiry = updatedLease.daysUntilExpiry;
    leaseObj.isExpired = updatedLease.isExpired;
    leaseObj.isActive = updatedLease.isActive;

    res.json({
      message: "Lease updated successfully",
      lease: leaseObj
    });

  } catch (error) {
    console.error("Update lease error:", error);
    res.status(500).json({ 
      message: "Failed to update lease", 
      error: error.message 
    });
  }
};

// =============================================
// DELETE LEASE
// DELETE /api/leases/:id
// =============================================
exports.deleteLease = async (req, res) => {
  try {
    const { id } = req.params;

    // Only allow deletion of draft or cancelled leases
    const lease = await Lease.findById(id);
    if (!lease) {
      return res.status(404).json({ message: "Lease not found" });
    }

    if (lease.status !== 'draft' && lease.status !== 'cancelled') {
      return res.status(400).json({ 
        message: "Can only delete draft or cancelled leases" 
      });
    }

    await Lease.findByIdAndDelete(id);

    res.json({ message: "Lease deleted successfully" });

  } catch (error) {
    console.error("Delete lease error:", error);
    res.status(500).json({ 
      message: "Failed to delete lease", 
      error: error.message 
    });
  }
};

// =============================================
// SIGN LEASE
// PUT /api/leases/:id/sign
// =============================================
exports.signLease = async (req, res) => {
  try {
    const { id } = req.params;
    const { party, signatureUrl } = req.body; // party: 'tenant' or 'owner'

    // Validate inputs
    if (!party || !['tenant', 'owner'].includes(party)) {
      return res.status(400).json({ message: "Party must be 'tenant' or 'owner'" });
    }
    if (!signatureUrl || !signatureUrl.trim()) {
      return res.status(400).json({ message: "Signature URL is required" });
    }

    // Find lease
    const lease = await Lease.findById(id);
    if (!lease) {
      return res.status(404).json({ message: "Lease not found" });
    }

    // Check if lease can be signed
    if (lease.status !== 'pending-signature' && lease.status !== 'draft') {
      return res.status(400).json({ 
        message: "Lease must be in draft or pending-signature status to sign" 
      });
    }

    // Update signature
    const update = {};
    update[`signatures.${party}.url`] = signatureUrl.trim();
    update[`signatures.${party}.date`] = new Date();
    update[`signedBy${party.charAt(0).toUpperCase() + party.slice(1)}`] = true;

    // Check if both parties have signed
    const tenantSigned = lease.signedByTenant || (party === 'tenant' && !!signatureUrl);
    const ownerSigned = lease.signedByOwner || (party === 'owner' && !!signatureUrl);
    
    if (tenantSigned && ownerSigned) {
      update.status = 'active';
      update.signedDate = new Date();
    } else if (party === 'tenant' && lease.signedByOwner) {
      // Tenant signed after owner
      update.status = 'active';
      update.signedDate = new Date();
    } else if (party === 'owner' && lease.signedByTenant) {
      // Owner signed after tenant
      update.status = 'active';
      update.signedDate = new Date();
    }

    await Lease.findByIdAndUpdate(id, update, { new: true });

    // Get updated lease for response
    const updatedLease = await Lease.findById(id)
      .populate('tenant', 'name phone')
      .populate('house', 'houseNumber location apartment bedrooms rent')
      .lean();

    // Add virtual fields
    const leaseObj = updatedLease.toObject ? updatedLease.toObject() : updatedLease;
    leaseObj.daysUntilExpiry = updatedLease.daysUntilExpiry;
    leaseObj.isExpired = updatedLease.isExpired;
    leaseObj.isActive = updatedLease.isActive;

    res.json({
      message: `${party.charAt(0).toUpperCase() + party.slice(1)} has signed the lease`,
      lease: leaseObj
    });

  } catch (error) {
    console.error("Sign lease error:", error);
    res.status(500).json({ 
      message: "Failed to sign lease", 
      error: error.message 
    });
  }
};

// =============================================
// RENEW LEASE
// POST /api/leases/:id/renew
// =============================================
exports.renewLease = async (req, res) => {
  try {
    const { id } = req.params;
    const { newEndDate, rentIncreasePercent, notes } = req.body;

    // Find lease
    const lease = await Lease.findById(id)
      .populate('tenant', 'name')
      .populate('house', 'houseNumber')
      .lean();

    if (!lease) {
      return res.status(404).json({ message: "Lease not found" });
    }

    // Check if lease can be renewed
    if (lease.status !== 'active') {
      return res.status(400).json({ 
        message: "Only active leases can be renewed" 
      });
    }

    if (!lease.isRenewable) {
      return res.status(400).json({ 
        message: "This lease is not renewable" 
      });
    }

    // Check renewal limits
    // This would require tracking renewal count, which we'd add to the model
    // For now, we'll skip this validation

    // Calculate new dates
    const currentEnd = new Date(lease.endDate);
    const newEnd = newDate ? new Date(newEndDate) : null;
    
    // If no new end date provided, extend by same duration
    let finalEndDate;
    if (newEnd && !isNaN(newEnd.getTime())) {
      finalEndDate = newEnd;
    } else {
      // Extend by same duration as original lease
      const originalDuration = lease.endDate - lease.startDate;
      finalEndDate = new Date(lease.endDate.getTime() + originalDuration);
    }

    // Calculate new rent
    const increasePercent = rentIncreasePercent !== undefined 
      ? Math.max(0, rentIncreasePercent) 
      : (lease.renewalTerms?.rentIncreasePercent || 0);
    
    const newBaseRent = lease.baseRent * (1 + increasePercent / 100);

    // Create new lease
    const renewedLease = await Lease.create({
      tenant: lease.tenant._id,
      house: lease.house._id,
      startDate: new Date(lease.endDate.getTime() + 1), // Start day after previous ends
      endDate: finalEndDate,
      isRenewable: lease.isRenewable,
      renewalTerms: lease.renewalTerms,
      baseRent: newBaseRent,
      securityDeposit: lease.securityDeposit,
      petDeposit: lease.petDeposit,
      utilitiesIncluded: lease.utilitiesIncluded,
      includedUtilities: lease.includedUtilities,
      lateFeePolicy: lease.lateFeePolicy,
      addenda: lease.addenda, // Carry forward existing addenda
      notes: notes ? `${lease.notes || ''}\n\nRenewal notes: ${notes}` : lease.notes,
      specialTerms: lease.specialTerms,
      leaseType: lease.leaseType,
      documents: [] // New lease needs new documents
    });

    // Update old lease to show it's been renewed
    await Lease.findByIdAndUpdate(id, {
      status: 'expired', // Or maybe 'renewed' status?
      notes: `${lease.notes || ''}\n\nLease renewed on ${new Date().toISOString().split('T')[0]}. New lease ID: ${renewedLease._id}`
    });

    // Populate renewed lease for response
    const populatedRenewedLease = await Lease.findById(renewedLease._id)
      .populate('tenant', 'name phone')
      .populate('house', 'houseNumber location apartment bedrooms rent')
      .lean();

    res.status(201).json({
      message: "Lease renewed successfully",
      oldLeaseId: id,
      newLease: populatedRenewedLease
    });

  } catch (error) {
    console.error("Renew lease error:", error);
    res.status(500).json({ 
      message: "Failed to renew lease", 
      error: error.message 
    });
  }
};

// =============================================
// GET LEASE STATISTICS
// GET /api/leases/stats
// =============================================
exports.getLeaseStats = async (req, res) => {
  try {
    const [total, byStatus, byType, expiringSoon, recent] = await Promise.all([
      Lease.countDocuments(),
      Lease.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } }
      ]),
      Lease.aggregate([
        { $group: { _id: "$leaseType", count: { $sum: 1 } } }
      ]),
      Lease.find({
        status: 'active',
        endDate: { 
          $gte: new Date(),
          $lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // Next 30 days
        }
      })
        .populate('tenant', 'name')
        .populate('house', 'houseNumber')
        .sort({ endDate: 1 })
        .limit(10)
        .lean(),
      Lease.find({})
        .sort({ createdDate: -1 })
        .limit(5)
        .populate('tenant', 'name')
        .populate('house', 'houseNumber')
        .lean()
    ]);

    // Format aggregation results
    const statusCounts = {};
    byStatus.forEach(item => { statusCounts[item._id] = item.count; });
    
    const typeCounts = {};
    byType.forEach(item => { typeCounts[item._id] = item.count; });

    res.json({
      total,
      byStatus: statusCounts,
      byType: typeCounts,
      expiringSoon,
      recent
    });

  } catch (error) {
    console.error("Get lease stats error:", error);
    res.status(500).json({ 
      message: "Failed to fetch lease statistics", 
      error: error.message 
    });
  }
};

module.exports = exports;