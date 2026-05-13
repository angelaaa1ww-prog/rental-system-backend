const express = require("express");
const router = express.Router();

const {
    createMaintenanceRequest,
    getAllMaintenance,
    getMaintenanceById,
    updateMaintenanceRequest,
    deleteMaintenanceRequest,
    addMaintenanceNote,
    getMaintenanceStats
} = require("../controller/maintenanceController");

// =============================================
// MAINTENANCE ROUTES
// =============================================

// Create maintenance request
router.post("/", createMaintenanceRequest);

// Get all maintenance requests (with filtering and pagination)
router.get("/", getAllMaintenance);

// Get maintenance statistics
router.get("/stats", getMaintenanceStats);

// Get single maintenance request
router.get("/:id", getMaintenanceById);

// Update maintenance request
router.put("/:id", updateMaintenanceRequest);

// Delete maintenance request
router.delete("/:id", deleteMaintenanceRequest);

// Add note to maintenance request
router.post("/:id/notes", addMaintenanceNote);

module.exports = router;