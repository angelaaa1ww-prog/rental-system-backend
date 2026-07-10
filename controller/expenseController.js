const Expense = require("../models/Expense");
const House = require("../models/House");
const Tenant = require("../models/Tenant");
const Maintenance = require("../models/Maintenance");

// =============================================
// CREATE EXPENSE
// POST /api/expenses
// =============================================
exports.createExpense = async (req, res) => {
  try {
    const { 
      houseId, 
      category, 
      subcategory, 
      description, 
      amount, 
      expenseDate, 
      paymentMethod, 
      reference, 
      isRecurring,
      recurrence,
      relatedMaintenanceId,
      relatedTenantId,
      tags,
      notes,
      attachments,
      recordedById,
      recordedByModel
    } = req.body;

    // Validate required fields
    if (!category || !description || !amount === 0) {
      return res.status(400).json({ 
        message: "Category, description, and amount are required" 
      });
    }

    // Validate category
    const validCategories = [
      "maintenance", 
      "repairs", 
      "utilities", 
      "insurance", 
      "property-tax", 
      "management-fee", 
      "legal", 
      "marketing", 
      "supplies", 
      "travel", 
      "other"
    ];
    if (!validCategories.includes(category)) {
      return res.status(400).json({ message: "Invalid category" });
    }

    // Validate amount
    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ message: "Amount must be a positive number" });
    }

    // Validate house if provided
    if (houseId) {
      const house = await House.findById(houseId);
      if (!house) {
        return res.status(404).json({ message: "House not found" });
      }
    }

    // Validate related maintenance if provided
    if (relatedMaintenanceId) {
      const maintenance = await Maintenance.findById(relatedMaintenanceId);
      if (!maintenance) {
        return res.status(404).json({ message: "Related maintenance not found" });
      }
    }

    // Validate related tenant if provided
    if (relatedTenantId) {
      const tenant = await Tenant.findById(relatedTenantId);
      if (!tenant) {
        return res.status(404).json({ message: "Related tenant not found" });
      }
      if (!tenant.active) {
        return res.status(400).json({ message: "Related tenant is not active" });
      }
    }

    // Validate recurrence if isRecurring is true
    if (isRecurring && recurrence) {
      const validFrequencies = ["daily", "weekly", "monthly", "quarterly", "yearly"];
      if (!recurrence.frequency || !validFrequencies.includes(recurrence.frequency)) {
        return res.status(400).json({ message: "Invalid recurrence frequency" });
      }
      if (!recurrence.interval || recurrence.interval < 1) {
        return res.status(400).json({ message: "Recurrence interval must be at least 1" });
      }
    }

    // Validate recordedBy if provided
    if (recordedById && recordedByModel) {
      const validModels = ['Tenant', 'User'];
      if (!validModels.includes(recordedByModel)) {
        return res.status(400).json({ message: "Invalid recordedBy model" });
      }
      
      const Model = recordedByModel === 'Tenant' ? Tenant : 
                   (require('../models/User') || { findById: () => null }); // User model TBD
      
      if (Model && Model.findById) {
        const recorder = await Model.findById(recordedById);
        if (!recorder) {
          return res.status(404).json({ message: `${recordedByModel} not found` });
        }
      }
    }

    // Create expense
    const expense = await Expense.create({
      house: houseId || null,
      category: category.trim().toLowerCase(),
      subcategory: subcategory ? subcategory.trim() : null,
      description: description.trim(),
      amount: Number(amount),
      expenseDate: expenseDate ? new Date(expenseDate) : new Date(),
      paymentMethod: paymentMethod || "bank-transfer",
      reference: reference ? reference.trim() : null,
      isRecurring: !!isRecurring,
      recurrence: isRecurring && recurrence ? recurrence : null,
      relatedMaintenance: relatedMaintenanceId || null,
      relatedTenant: relatedTenantId || null,
      tags: Array.isArray(tags) 
        ? tags.map(tag => String(tag).trim().toLowerCase()).filter(tag => tag.length > 0)
        : [],
      notes: notes ? notes.trim() : null,
      attachments: Array.isArray(attachments)
        ? attachments.filter(att => att.url && att.url.trim().length > 0)
          .map(att => ({
            url: att.url.trim(),
            description: att.description ? att.description.trim() : null,
            uploadedAt: att.uploadedAt ? new Date(att.uploadedAt) : new Date()
          }))
        : [],
      recordedBy: recordedById || null,
      recordedByModel: recordedByModel || 'User'
    });

    // Populate references for response
    const populatedExpense = await Expense.findById(expense._id)
      .populate('house', 'houseNumber location apartment bedrooms rent')
      .populate('relatedMaintenance', 'title category status')
      .populate('relatedTenant', 'name phone')
      .populate('recordedBy', 'name')
      .lean();

    res.status(201).json({
      message: "Expense created successfully",
      expense: populatedExpense
    });

  } catch (error) {
    console.error("Create expense error:", error);
    res.status(500).json({ 
      message: "Failed to create expense", 
      error: error.message 
    });
  }
};

// =============================================
// GET ALL EXPENSES (with filtering and pagination)
// GET /api/expenses
// =============================================
exports.getAllExpenses = async (req, res) => {
  try {
    const { 
      houseId, 
      category, 
      startDate, 
      endDate, 
      paymentMethod,
      isRecurring,
      tags,
      page = 1, 
      limit = 50,
      sortBy = "expenseDate",
      sortOrder = "desc"
    } = req.query;

    // Build filter object
    const filter = {};
    if (houseId) filter.house = houseId;
    if (category) filter.category = category.toLowerCase();
    if (startDate || endDate) {
      filter.expenseDate = {};
      if (startDate) filter.expenseDate.$gte = new Date(startDate);
      if (endDate) filter.expenseDate.$lte = new Date(endDate);
    }
    if (paymentMethod) filter.paymentMethod = paymentMethod;
    if (isRecurring !== undefined) filter.isRecurring = isRecurring === 'true';
    if (tags && Array.isArray(tags)) {
      filter.tags = { $in: tags.map(tag => String(tag).trim().toLowerCase()) };
    }

    // Validate sort fields
    const validSortFields = ["expenseDate", "recordedDate", "amount", "category"];
    if (!validSortFields.includes(sortBy)) {
      return res.status(400).json({ message: "Invalid sort field" });
    }

    // Validate sort order
    if (!["asc", "desc"].includes(sortOrder)) {
      return res.status(400).json({ message: "Invalid sort order" });
    }

    // Parse pagination
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(200, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Execute query with population
    const [expenses, totalCount] = await Promise.all([
      Expense.find(filter)
        .populate('house', 'houseNumber location apartment bedrooms rent')
        .populate('relatedMaintenance', 'title category')
        .populate('relatedTenant', 'name phone')
        .populate('recordedBy', 'name')
        .sort({ [sortBy]: sortOrder === "desc" ? -1 : 1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Expense.countDocuments(filter)
    ]);

    res.json({
      expenses,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalCount / limitNum),
        totalItems: totalCount
      }
    });

  } catch (error) {
    console.error("Get expenses error:", error);
    res.status(500).json({ 
      message: "Failed to fetch expenses", 
      error: error.message 
    });
  }
};

// =============================================
// GET SINGLE EXPENSE
// GET /api/expenses/:id
// =============================================
exports.getExpenseById = async (req, res) => {
  try {
    const { id } = req.params;

    const expense = await Expense.findById(id)
      .populate('house', 'houseNumber location apartment bedrooms rent')
      .populate('relatedMaintenance', 'title category status')
      .populate('relatedTenant', 'name phone')
      .populate('recordedBy', 'name')
      .lean();

    if (!expense) {
      return res.status(404).json({ message: "Expense not found" });
    }

    // Add virtual fields
    const expenseObj = expense.toObject ? expense.toObject() : expense;
    expenseObj.yearMonth = expense.yearMonth;

    res.json({ expense: expenseObj });

  } catch (error) {
    console.error("Get expense by ID error:", error);
    res.status(500).json({ 
      message: "Failed to fetch expense", 
      error: error.message 
    });
  }
};

// =============================================
// UPDATE EXPENSE
// PUT /api/expenses/:id
// =============================================
exports.updateExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Find expense
    const expense = await Expense.findById(id);
    if (!expense) {
      return res.status(404).json({ message: "Expense not found" });
    }

    // Validate category if being updated
    if (updateData.category) {
      const validCategories = [
        "maintenance", 
        "repairs", 
        "utilities", 
        "insurance", 
        "property-tax", 
        "management-fee", 
        "legal", 
        "marketing", 
        "supplies", 
        "travel", 
        "other"
      ];
      if (!validCategories.includes(updateData.category)) {
        return res.status(400).json({ message: "Invalid category" });
      }
    }

    // Validate amount if being updated
    if (updateData.amount !== undefined && 
        (typeof updateData.amount !== 'number' || updateData.amount <= 0)) {
      return res.status(400).json({ message: "Amount must be a positive number" });
    }

    // Validate house if being updated
    if (updateData.house) {
      const house = await House.findById(updateData.house);
      if (!house) {
        return res.status(404).json({ message: "House not found" });
      }
    }

    // Validate related maintenance if being updated
    if (updateData.relatedMaintenance) {
      const maintenance = await Maintenance.findById(updateData.relatedMaintenance);
      if (!maintenance) {
        return res.status(404).json({ message: "Related maintenance not found" });
      }
    }

    // Validate related tenant if being updated
    if (updateData.relatedTenant) {
      const tenant = await Tenant.findById(updateData.relatedTenant);
      if (!tenant) {
        return res.status(404).json({ message: "Related tenant not found" });
      }
      if (!tenant.active) {
        return res.status(400).json({ message: "Related tenant is not active" });
      }
    }

    // Validate recurrence if being updated
    if (updateData.isRecurring !== undefined && updateData.recurrence) {
      const validFrequencies = ["daily", "weekly", "monthly", "quarterly", "yearly"];
      if (!updateData.recurrence.frequency || !validFrequencies.includes(updateData.recurrence.frequency)) {
        return res.status(400).json({ message: "Invalid recurrence frequency" });
      }
      if (!updateData.recurrence.interval || updateData.recurrence.interval < 1) {
        return res.status(400).json({ message: "Recurrence interval must be at least 1" });
      }
    }

    // Validate recordedBy if being updated
    if (updateData.recordedById && updateData.recordedByModel) {
      const validModels = ['Tenant', 'User'];
      if (!validModels.includes(updateData.recordedByModel)) {
        return res.status(400).json({ message: "Invalid recordedBy model" });
      }
      
      const Model = updateData.recordedByModel === 'Tenant' ? Tenant : 
                   (require('../models/User') || { findById: () => null });
      
      if (Model && Model.findById) {
        const recorder = await Model.findById(updateData.recordedById);
        if (!recorder) {
          return res.status(404).json({ message: `${updateData.recordedByModel} not found` });
        }
      }
    }

    // Update expense fields
    const allowedUpdates = [
      'house', 'category', 'subcategory', 'description', 'amount', 'expenseDate',
      'paymentMethod', 'reference', 'isRecurring', 'recurrence', 'relatedMaintenance',
      'relatedTenant', 'tags', 'notes', 'attachments', 'recordedById', 'recordedByModel'
    ];
    
    allowedUpdates.forEach(field => {
      if (updateData[field] !== undefined) {
        expense[field] = field.endsWith('Id') || field === 'recordedByModel' 
          ? updateData[field] 
          : updateData[field];
      }
    });

    await expense.save();

    // Populate for response
    const updatedExpense = await Expense.findById(id)
      .populate('house', 'houseNumber location apartment bedrooms rent')
      .populate('relatedMaintenance', 'title category')
      .populate('relatedTenant', 'name phone')
      .populate('recordedBy', 'name')
      .lean();

    // Add virtual fields
    const expenseObj = updatedExpense.toObject ? updatedExpense.toObject() : updatedExpense;
    expenseObj.yearMonth = updatedExpense.yearMonth;

    res.json({
      message: "Expense updated successfully",
      expense: expenseObj
    });

  } catch (error) {
    console.error("Update expense error:", error);
    res.status(500).json({ 
      message: "Failed to update expense", 
      error: error.message 
    });
  }
};

// =============================================
// DELETE EXPENSE
// DELETE /api/expenses/:id
// =============================================
exports.deleteExpense = async (req, res) => {
  try {
    const { id } = req.params;

    const expense = await Expense.findByIdAndDelete(id);
    if (!expense) {
      return res.status(404).json({ message: "Expense not found" });
    }

    res.json({ message: "Expense deleted successfully" });

  } catch (error) {
    console.error("Delete expense error:", error);
    res.status(500).json({ 
      message: "Failed to delete expense", 
      error: error.message 
    });
  }
};

// =============================================
// GET EXPENSE SUMMARY / STATISTICS
// GET /api/expenses/summary
// =============================================
exports.getExpenseSummary = async (req, res) => {
  try {
    const { 
      houseId, 
      startDate, 
      endDate, 
      category,
      groupBy // month, category, paymentMethod
    } = req.query;

    // Build match stage for aggregation
    const matchStage = {};
    if (houseId) matchStage.house = mongoose.Types.ObjectId(houseId);
    if (startDate || endDate) {
      matchStage.expenseDate = {};
      if (startDate) matchStage.expenseDate.$gte = new Date(startDate);
      if (endDate) matchStage.expenseDate.$lte = new Date(endDate);
    }
    if (category) matchStage.category = category.toLowerCase();

    // Determine group stage
    let groupStage = { _id: null };
    if (groupBy === "month") {
      groupStage._id = { 
        year: { $year: "$expenseDate" },
        month: { $month: "$expenseDate" }
      };
    } else if (groupBy === "category") {
      groupStage._id = "$category";
    } else if (groupBy === "paymentMethod") {
      groupStage._id = "$paymentMethod";
    } else if (groupBy === "house") {
      groupStage._id = "$house";
    }

    // Build aggregation pipeline
    const pipeline = [
      { $match: matchStage },
      {
        $group: {
          ...groupStage,
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 },
          averageAmount: { $avg: "$amount" }
        }
      },
      { $sort: { "_id": 1 } }
    ];

    // Execute aggregation
    const results = await Expense.aggregate(pipeline);

    // Also get overall totals
    const [totalAmount, totalCount, categoryBreakdown, monthlyTrend] = await Promise.all([
      Expense.aggregate([
        { $match: matchStage },
        { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } }
      ]),
      Expense.countDocuments(matchStage),
      Expense.aggregate([
        { $match: matchStage },
        { $group: { _id: "$category", total: { $sum: "$amount" }, count: { $sum: 1 } } },
        { $sort: { total: -1 } }
      ]),
      Expense.aggregate([
        { $match: matchStage },
        { 
          $group: {
            _id: { 
              year: { $year: "$expenseDate" },
              month: { $month: "$expenseDate" }
            },
            total: { $sum: "$amount" }
          }
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } }
      ])
    ]);

    res.json({
      summary: {
        totalAmount: totalAmount[0]?.total || 0,
        totalCount: totalCount || 0
      },
      byGroup: results,
      byCategory: categoryBreakdown,
      monthlyTrend: monthlyTrend
    });

  } catch (error) {
    console.error("Get expense summary error:", error);
    res.status(500).json({ 
      message: "Failed to fetch expense summary", 
      error: error.message 
    });
  }
};

module.exports = exports;