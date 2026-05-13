const Maintenance = require("../models/Maintenance");
const House = require("../models/House");
const Tenant = require("../models/Tenant");

// =============================================
// CREATE MAINTENANCE REQUEST
// POST /api/maintenance
// =============================================
exports.createMaintenanceRequest = async (req, res) => {
  try {
    const { houseId, title, description, category, priority, reportedById } = req.body;

    // Validate required fields
    if (!houseId || !title || !description || !category) {
      return res.status(400).json({ 
        message: "House ID, title, description, and category are required" 
      });
    }

    // Validate house exists
    const house = await House.findById(houseId);
    if (!house) {
      return res.status(404).json({ message: "House not found" });
    }

    // Validate reportedBy tenant exists (if provided)
    if (reportedById) {
      const tenant = await Tenant.findById(reportedById);
      if (!tenant) {
        return res.status(404).json({ message: "Reporting tenant not found" });
      }
      if (!tenant.active) {
        return res.status(400).json({ message: "Reporting tenant is not active" });
      }
    }

    // Validate category
    const validCategories = ["plumbing", "electrical", "hvac", "appliance", "structural", "pest", "other"];
    if (!validCategories.includes(category)) {
      return res.status(400).json({ message: "Invalid category" });
    }

    // Validate priority
    const validPriorities = ["low", "medium", "high", "emergency"];
    if (priority && !validPriorities.includes(priority)) {
      return res.status(400).json({ message: "Invalid priority" });
    }

    // Create maintenance request
    const maintenance = await Maintenance.create({
      house: houseId,
      reportedBy: reportedById || null,
      title: title.trim(),
      description: description.trim(),
      category: category,
      priority: priority || "medium",
      status: "reported"
    });

    // Populate house and tenant data for response
    const populatedMaintenance = await Maintenance.findById(maintenance._id)
      .populate('house', 'houseNumber location apartment bedrooms rent')
      .populate('reportedBy', 'name phone');

    res.status(201).json({
      message: "Maintenance request created successfully",
      maintenance: populatedMaintenance
    });

  } catch (error) {
    console.error("Create maintenance request error:", error);
    res.status(500).json({ 
      message: "Failed to create maintenance request", 
      error: error.message 
    });
  }
};

// =============================================
// GET ALL MAINTENANCE REQUESTS (with filtering)
// GET /api/maintenance
// =============================================
exports.getAllMaintenance = async (req, res) => {
  try {
    const { 
      status, 
      priority, 
      category, 
      houseId, 
      reportedById,
      page = 1, 
      limit = 20,
      sortBy = "reportedDate",
      sortOrder = "desc"
    } = req.query;

    // Build filter object
    const filter = {};
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (category) filter.category = category;
    if (houseId) filter.house = houseId;
    if (reportedById) filter.reportedBy = reportedById;

    // Validate sort fields
    const validSortFields = ["reportedDate", "acknowledgedDate", "completedDate", "priority", "status"];
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
    const [maintenances, totalCount] = await Promise.all([
      Maintenance.find(filter)
        .populate('house', 'houseNumber location apartment bedrooms rent')
        .populate('reportedBy', 'name phone')
        .sort({ [sortBy]: sortOrder === "desc" ? -1 : 1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Maintenance.countDocuments(filter)
    ]);

    res.json({
      maintenances,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalCount / limitNum),
        totalItems: totalCount
      }
    });

  } catch (error) {
    console.error("Get maintenance requests error:", error);
    res.status(500).json({ 
      message: "Failed to fetch maintenance requests", 
      error: error.message 
    });
  }
};

// =============================================
// GET SINGLE MAINTENANCE REQUEST
// GET /api/maintenance/:id
// =============================================
exports.getMaintenanceById = async (req, res) => {
  try {
    const { id } = req.params;

    const maintenance = await Maintenance.findById(id)
      .populate('house', 'houseNumber location apartment bedrooms rent status tenant')
      .populate('reportedBy', 'name phone')
      .populate('assignedTo', 'name email')
      .lean();

    if (!maintenance) {
      return res.status(404).json({ message: "Maintenance request not found" });
    }

    res.json({ maintenance });

  } catch (error) {
    console.error("Get maintenance by ID error:", error);
    res.status(500).json({ 
      message: "Failed to fetch maintenance request", 
      error: error.message 
    });
  }
};

// =============================================
// UPDATE MAINTENANCE REQUEST
// PUT /api/maintenance/:id
// =============================================
exports.updateMaintenanceRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Find maintenance request
    const maintenance = await Maintenance.findById(id);
    if (!maintenance) {
      return res.status(404).json({ message: "Maintenance request not found" });
    }

    // Validate fields being updated
    if (updateData.category) {
      const validCategories = ["plumbing", "electrical", "hvac", "appliance", "structural", "pest", "other"];
      if (!validCategories.includes(updateData.category)) {
        return res.status(400).json({ message: "Invalid category" });
      }
    }

    if (updateData.priority) {
      const validPriorities = ["low", "medium", "high", "emergency"];
      if (!validPriorities.includes(updateData.priority)) {
        return res.status(400).json({ message: "Invalid priority" });
      }
    }

    if (updateData.status) {
      const validStatuses = ["reported", "acknowledged", "in-progress", "completed", "cancelled"];
      if (!validStatuses.includes(updateData.status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      
      // Set timestamps based on status changes
      if (updateData.status === "acknowledged" && !maintenance.acknowledgedDate) {
        updateData.acknowledgedDate = new Date();
      }
      if (updateData.status === "completed" && !maintenance.completedDate) {
        updateData.completedDate = new Date();
      }
    }

    // If assigning to someone, validate they exist (if we had a User model)
    // For now, we'll just allow any ObjectId for assignedTo

    // Update the maintenance request
    Object.assign(maintenance, updateData);
    await maintenance.save();

    // Populate for response
    const updatedMaintenance = await Maintenance.findById(id)
      .populate('house', 'houseNumber location apartment bedrooms rent')
      .populate('reportedBy', 'name phone')
      .populate('assignedTo', 'name email')
      .lean();

    res.json({
      message: "Maintenance request updated successfully",
      maintenance: updatedMaintenance
    });

  } catch (error) {
    console.error("Update maintenance request error:", error);
    res.status(500).json({ 
      message: "Failed to update maintenance request", 
      error: error.message 
    });
  }
};

// =============================================
// DELETE MAINTENANCE REQUEST
// DELETE /api/maintenance/:id
// =============================================
exports.deleteMaintenanceRequest = async (req, res) => {
  try {
    const { id } = req.params;

    const maintenance = await Maintenance.findByIdAndDelete(id);
    if (!maintenance) {
      return res.status(404).json({ message: "Maintenance request not found" });
    }

    res.json({ message: "Maintenance request deleted successfully" });

  } catch (error) {
    console.error("Delete maintenance request error:", error);
    res.status(500).json({ 
      message: "Failed to delete maintenance request", 
      error: error.message 
    });
  }
};

// =============================================
// ADD NOTE TO MAINTENANCE REQUEST
// POST /api/maintenance/:id/notes
// =============================================
exports.addMaintenanceNote = async (req, res) => {
  try {
    const { id } = req.params;
    const { type, content, createdById, createdByModel } = req.body;

    // Validate maintenance exists
    const maintenance = await Maintenance.findById(id);
    if (!maintenance) {
      return res.status(404).json({ message: "Maintenance request not found" });
    }

    // Validate note type
    const validTypes = ["status-update", "work-log", "parts-used", "general"];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ message: "Invalid note type" });
    }

    // Validate createdByModel
    const validModels = ['Tenant', 'User'];
    if (!validModels.includes(createdByModel)) {
      return res.status(400).json({ message: "Invalid creator model" });
    }

    // Validate creator exists (if provided)
    if (createdById) {
      const Model = createdByModel === 'Tenant' ? Tenant : require('../models/User'); // User model TBD
      if (Model) {
        const creator = await Model.findById(createdById);
        if (!creator) {
          return res.status(404).json({ message: `${createdByModel} not found` });
        }
      }
    }

    // Add note
    maintenance.notes.push({
      type,
      content: content.trim(),
      createdBy: createdById || null,
      createdByModel: createdByModel || 'Tenant',
      createdAt: new Date()
    });

    await maintenance.save();

    // Get the newly added note
    const newNote = maintenance.notes[maintenance.notes.length - 1];

    res.status(201).json({
      message: "Note added successfully",
      note: newNote
    });

  } catch (error) {
    console.error("Add maintenance note error:", error);
    res.status(500).json({ 
      message: "Failed to add note", 
      error: error.message 
    });
  }
};

// =============================================
// GET MAINTENANCE STATISTICS
// GET /api/maintenance/stats
// =============================================
exports.getMaintenanceStats = async (req, res) => {
  try {
    const [total, byStatus, byPriority, byCategory, recent] = await Promise.all([
      Maintenance.countDocuments(),
      Maintenance.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } }
      ]),
      Maintenance.aggregate([
        { $group: { _id: "$priority", count: { $sum: 1 } } }
      ]),
      Maintenance.aggregate([
        { $group: { _id: "$category", count: { $sum: 1 } } }
      ]),
      Maintenance.find({})
        .sort({ reportedDate: -1 })
        .limit(5)
        .populate('house', 'houseNumber')
        .populate('reportedBy', 'name')
        .lean()
    ]);

    // Format aggregation results
    const statusCounts = {};
    byStatus.forEach(item => { statusCounts[item._id] = item.count; });
    
    const priorityCounts = {};
    byPriority.forEach(item => { priorityCounts[item._id] = item.count; });
    
    const categoryCounts = {};
    byCategory.forEach(item => { categoryCounts[item._id] = item.count; });

    res.json({
      total,
      byStatus: statusCounts,
      byPriority: priorityCounts,
      byCategory: categoryCounts,
      recent
    });

  } catch (error) {
    console.error("Get maintenance stats error:", error);
    res.status(500).json({ 
      message: "Failed to fetch maintenance statistics", 
      error: error.message 
    });
  }
};

module.exports = exports;