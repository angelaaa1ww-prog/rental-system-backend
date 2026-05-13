const express = require("express");
const router = express.Router();

const {
    createExpense,
    getAllExpenses,
    getExpenseById,
    updateExpense,
    deleteExpense,
    getExpenseSummary
} = require("../controller/expenseController");

// =============================================
// EXPENSE ROUTES
// =============================================

// Create expense
router.post("/", createExpense);

// Get all expenses (with filtering and pagination)
router.get("/", getAllExpenses);

// Get expense summary/statistics
router.get("/summary", getExpenseSummary);

// Get single expense
router.get("/:id", getExpenseById);

// Update expense
router.put("/:id", updateExpense);

// Delete expense
router.delete("/:id", deleteExpense);

module.exports = router;