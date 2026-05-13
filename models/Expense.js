const mongoose = require("mongoose");

// =============================================
// EXPENSE MODEL
// Tracks property-related expenses
// =============================================

const expenseSchema = new mongoose.Schema(
  {
    // Which property/house this expense is for (optional for general expenses)
    house: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "House",
      default: null
    },

    // Expense category
    category: {
      type: String,
      enum: [
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
      ],
      required: true
    },

    // Expense subcategory (more specific)
    subcategory: {
      type: String,
      trim: true
    },

    // Description/purpose of expense
    description: {
      type: String,
      required: true,
      trim: true
    },

    // Amount spent
    amount: {
      type: Number,
      required: true,
      min: 0.01
    },

    // Date expense was incurred
    expenseDate: {
      type: Date,
      required: true,
      default: Date.now
    },

    // Date expense was paid/recorded
    recordedDate: {
      type: Date,
      default: Date.now
    },

    // Payment method used
    paymentMethod: {
      type: String,
      enum: ["cash", "check", "bank-transfer", "credit-card", "other"],
      default: "bank-transfer"
    },

    // Reference/receipt number
    reference: {
      type: String,
      trim: true
    },

    // Whether this is a recurring expense
    isRecurring: {
      type: Boolean,
      default: false
    },

    // Recurrence pattern (if recurring)
    recurrence: {
      frequency: {
        type: String,
        enum: ["daily", "weekly", "monthly", "quarterly", "yearly"],
        default: "monthly"
      },
      interval: {
        type: Number,
        default: 1
      },
      endDate: {
        type: Date,
        default: null
      }
    },

    // Related maintenance request (if applicable)
    relatedMaintenance: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Maintenance",
      default: null
    },

    // Related tenant (if applicable, e.g., damage charges)
    relatedTenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      default: null
    },

    // Tags for easier searching/filtering
    tags: [{
      type: String,
      trim: true,
      lowercase: true
    }],

    // Notes/additional information
    notes: {
      type: String,
      trim: true
    },

    // Attachments (store URLs to receipts, invoices, etc.)
    attachments: [{
      url: String,
      description: String,
      uploadedAt: {
        type: Date,
        default: Date.now
      }
    }],

    // Who recorded this expense (could be staff or system)
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'recordedByModel'
    },
    recordedByModel: {
      type: String,
      enum: ['Tenant', 'User'],
      default: 'User'
    }

  },
  { timestamps: true }
);

// Indexes for faster queries and reporting
expenseSchema.index({ house: 1, expenseDate: -1 });
expenseSchema.index({ category: 1, expenseDate: -1 });
expenseSchema.index({ expenseDate: -1 });
expenseSchema.index({ recordedBy: 1 });
expenseSchema.index({ tags: 1 });
expenseSchema.index({ isRecurring: 1, "recurrence.frequency": 1 });

// Virtual for year-month grouping (useful for reports)
expenseSchema.virtual('yearMonth').get(function() {
  const date = this.expenseDate || new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
});

module.exports = mongoose.model("Expense", expenseSchema);