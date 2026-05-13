const mongoose = require("mongoose");

// =============================================
// MAINTENANCE MODEL
// Tracks maintenance requests and work orders
// =============================================

const maintenanceSchema = new mongoose.Schema(
  {
    // Which house this maintenance request is for
    house: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "House",
      required: true,
    },

    // Which tenant reported this (optional, for anonymous reports)
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      default: null
    },

    // Title/summary of the issue
    title: {
      type: String,
      required: true,
      trim: true
    },

    // Detailed description
    description: {
      type: String,
      required: true,
      trim: true
    },

    // Category of maintenance
    category: {
      type: String,
      enum: ["plumbing", "electrical", "hvac", "appliance", "structural", "pest", "other"],
      required: true
    },

    // Priority level
    priority: {
      type: String,
      enum: ["low", "medium", "high", "emergency"],
      default: "medium"
    },

    // Current status
    status: {
      type: String,
      enum: ["reported", "acknowledged", "in-progress", "completed", "cancelled"],
      default: "reported"
    },

    // Assigned to (staff/vendor)
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Assuming we might have a User model for staff later
      default: null
    },

    // Dates
    reportedDate: {
      type: Date,
      default: Date.now
    },
    acknowledgedDate: {
      type: Date,
      default: null
    },
    completedDate: {
      type: Date,
      default: null
    },

    // Cost tracking
    estimatedCost: {
      type: Number,
      default: 0
    },
    actualCost: {
      type: Number,
      default: 0
    },

    // Notes and updates
    notes: [{
      type: {
        type: String,
        enum: ["status-update", "work-log", "parts-used", "general"],
        default: "general"
      },
      content: String,
      createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: 'notes.createdByModel'
      },
      createdByModel: {
        type: String,
        enum: ['Tenant', 'User'],
        default: 'Tenant'
      },
      createdAt: {
        type: Date,
        default: Date.now
      }
    }],

    // Photos/uploads (store URLs)
    photos: [{
      url: String,
      caption: String,
      uploadedAt: {
        type: Date,
        default: Date.now
      }
    }],

    // Whether tenant needs to be present
    tenantPresenceRequired: {
      type: Boolean,
      default: false
    },

    // Access instructions
    accessInstructions: {
      type: String,
      trim: true,
      default: ""
    }

  },
  { timestamps: true }
);

// Indexes for faster queries
maintenanceSchema.index({ house: 1, status: 1 });
maintenanceSchema.index({ reportedBy: 1 });
maintenanceSchema.index({ status: 1, priority: -1 });
maintenanceSchema.index({ reportedDate: -1 });

module.exports = mongoose.model("Maintenance", maintenanceSchema);