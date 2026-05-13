const mongoose = require("mongoose");

// =============================================
// LEASE MODEL
// Tracks rental agreements between tenants and properties
// =============================================

const leaseSchema = new mongoose.Schema(
  {
    // Which tenant is party to this lease
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true
    },

    // Which house/unit is being leased
    house: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "House",
      required: true
    },

    // Lease terms
    startDate: {
      type: Date,
      required: true
    },

    endDate: {
      type: Date,
      required: true
    },

    // Whether lease is renewable/auto-renew
    isRenewable: {
      type: Boolean,
      default: true
    },

    // Auto-renewal terms (if applicable)
    renewalTerms: {
      noticePeriodDays: {
        type: Number,
        default: 30 // days notice required for non-renewal
      },
      rentIncreasePercent: {
        type: Number,
        default: 0 // percentage increase at renewal
      },
      maxRenewals: {
        type: Number,
        default: null // null means unlimited
      }
    },

    // Financial terms
    baseRent: {
      type: Number,
      required: true,
      min: 0
    },

    securityDeposit: {
      type: Number,
      default: 0
    },

    petDeposit: {
      type: Number,
      default: 0
    },

    // Whether utilities are included
    utilitiesIncluded: {
      type: Boolean,
      default: false
    },

    // Specific utilities included (if any)
    includedUtilities: [{
      type: String,
      enum: ["electricity", "water", "gas", "trash", "sewer", "internet", "cable"],
      default: []
    }],

    // Late fee policy
    lateFeePolicy: {
      gracePeriodDays: {
        type: Number,
        default: 5
      },
      feeAmount: {
        type: Number,
        default: 0
      },
      feeType: {
        type: String,
        enum: ["flat", "percent"],
        default: "flat"
      },
      feePercent: {
        type: Number,
        default: 5 // percent of rent
      }
    },

    // Lease addenda/amendments
    addenda: [{
      title: {
        type: String,
        required: true
      },
      description: {
        type: String,
        required: true
      },
      effectiveDate: {
        type: Date,
        required: true
      },
      isActive: {
        type: Boolean,
        default: true
      }
    }],

    // Lease status
    status: {
      type: String,
      enum: ["draft", "pending-signature", "active", "expired", "terminated", "cancelled"],
      default: "draft"
    },

    // Dates for tracking lifecycle
    createdDate: {
      type: Date,
      default: Date.now
    },
    signedDate: {
      type: Date,
      default: null
    },
    terminatedDate: {
      type: Date,
      default: null
    },

    // Parties who signed/approved
    signedByTenant: {
      type: Boolean,
      default: false
    },
    signedByOwner: {
      type: Boolean,
      default: false
    },

    // Digital signatures/signature data (store as URLs or encrypted data)
    signatures: {
      tenant: {
        url: String, // URL to signed document or encrypted signature data
        date: Date
      },
      owner: {
        url: String,
        date: Date
      }
    },

    // Notes and special terms
    notes: {
      type: String,
      trim: true
    },

    specialTerms: [{
      type: String,
      trim: true
    }],

    // Document storage (URLs to lease agreement, addenda, etc.)
    documents: [{
      type: {
        type: String,
        enum: ["lease", "addendum", "disclosure", "receipt", "other"],
        default: "other"
      },
      title: String,
      url: String,
      uploadedAt: {
        type: Date,
        default: Date.now
      },
      uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: 'documents.uploadedByModel'
      },
      uploadedByModel: {
        type: String,
        enum: ['Tenant', 'User'],
        default: 'User'
      }
    }],

    // Whether this is a commercial or residential lease
    leaseType: {
      type: String,
      enum: ["residential", "commercial"],
      default: "residential"
    }

  },
  { timestamps: true }
);

// Indexes for faster querying
leaseSchema.index({ tenant: 1, status: 1 });
leaseSchema.index({ house: 1, status: 1 });
leaseSchema.index({ startDate: 1 });
leaseSchema.index({ endDate: 1 });
leaseSchema.index({ status: 1, endDate: 1 }); // For finding expiring leases
leaseSchema.index({ signedDate: 1 });

// Virtual for days until expiry
leaseSchema.virtual('daysUntilExpiry').get(function() {
  if (!this.endDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endDate = new Date(this.endDate);
  endDate.setHours(0, 0, 0, 0);
  const diffTime = endDate - today;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual for isExpired
leaseSchema.virtual('isExpired').get(function() {
  return this.status !== 'expired' && 
         this.endDate && 
         new Date() > new Date(this.endDate);
});

// Virtual for isActive
leaseSchema.virtual('isActive').get(function() {
  return this.status === 'active' || this.status === 'pending-signature';
});

module.exports = mongoose.model("Lease", leaseSchema);