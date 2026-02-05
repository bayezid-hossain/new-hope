"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
var drizzle_orm_1 = require("drizzle-orm");
var db_1 = require("../db");
var schema_1 = require("../db/schema");
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var identifier, officer, managedFarmers, farmerIds, activeCycles, historyRecords, activeCycleIds, historyIds, allSaleEvents, saleEventIds, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    identifier = process.argv[2];
                    if (!identifier) {
                        console.error("❌ Please provide an officer email or ID.");
                        console.log("Usage: npx tsx scripts/delete-officer-cycles.ts <email_or_id>");
                        process.exit(1);
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 18, , 19]);
                    return [4 /*yield*/, db_1.db.query.user.findFirst({
                            where: (0, drizzle_orm_1.or)((0, drizzle_orm_1.eq)(schema_1.user.id, identifier), (0, drizzle_orm_1.eq)(schema_1.user.email, identifier))
                        })];
                case 2:
                    officer = _a.sent();
                    if (!officer) {
                        console.error("\u274C Officer not found: ".concat(identifier));
                        process.exit(1);
                    }
                    console.log("\uD83D\uDD0D Found Officer: ".concat(officer.name, " (").concat(officer.email, ")"));
                    return [4 /*yield*/, db_1.db.select({ id: schema_1.farmer.id }).from(schema_1.farmer).where((0, drizzle_orm_1.eq)(schema_1.farmer.officerId, officer.id))];
                case 3:
                    managedFarmers = _a.sent();
                    if (managedFarmers.length === 0) {
                        console.log("ℹ️ No farmers found for this officer. Nothing to delete.");
                        process.exit(0);
                    }
                    farmerIds = managedFarmers.map(function (f) { return f.id; });
                    console.log("\uD83D\uDCC8 Found ".concat(farmerIds.length, " managed farmers."));
                    return [4 /*yield*/, db_1.db.select({ id: schema_1.cycles.id }).from(schema_1.cycles).where((0, drizzle_orm_1.inArray)(schema_1.cycles.farmerId, farmerIds))];
                case 4:
                    activeCycles = _a.sent();
                    return [4 /*yield*/, db_1.db.select({ id: schema_1.cycleHistory.id }).from(schema_1.cycleHistory).where((0, drizzle_orm_1.inArray)(schema_1.cycleHistory.farmerId, farmerIds))];
                case 5:
                    historyRecords = _a.sent();
                    activeCycleIds = activeCycles.map(function (c) { return c.id; });
                    historyIds = historyRecords.map(function (h) { return h.id; });
                    console.log("\uD83D\uDDD1 Deleting data for ".concat(activeCycleIds.length, " active cycles and ").concat(historyIds.length, " history records..."));
                    if (!(activeCycleIds.length > 0 || historyIds.length > 0)) return [3 /*break*/, 9];
                    return [4 /*yield*/, db_1.db.select({ id: schema_1.saleEvents.id }).from(schema_1.saleEvents).where((0, drizzle_orm_1.or)(activeCycleIds.length > 0 ? (0, drizzle_orm_1.inArray)(schema_1.saleEvents.cycleId, activeCycleIds) : undefined, historyIds.length > 0 ? (0, drizzle_orm_1.inArray)(schema_1.saleEvents.historyId, historyIds) : undefined))];
                case 6:
                    allSaleEvents = _a.sent();
                    saleEventIds = allSaleEvents.map(function (se) { return se.id; });
                    if (!(saleEventIds.length > 0)) return [3 /*break*/, 9];
                    console.log("  - Deleting ".concat(saleEventIds.length, " sale reports and events..."));
                    return [4 /*yield*/, db_1.db.delete(schema_1.saleReports).where((0, drizzle_orm_1.inArray)(schema_1.saleReports.saleEventId, saleEventIds))];
                case 7:
                    _a.sent();
                    return [4 /*yield*/, db_1.db.delete(schema_1.saleEvents).where((0, drizzle_orm_1.inArray)(schema_1.saleEvents.id, saleEventIds))];
                case 8:
                    _a.sent();
                    _a.label = 9;
                case 9:
                    if (!(activeCycleIds.length > 0 || historyIds.length > 0)) return [3 /*break*/, 11];
                    console.log("  - Deleting cycle logs...");
                    return [4 /*yield*/, db_1.db.delete(schema_1.cycleLogs).where((0, drizzle_orm_1.or)(activeCycleIds.length > 0 ? (0, drizzle_orm_1.inArray)(schema_1.cycleLogs.cycleId, activeCycleIds) : undefined, historyIds.length > 0 ? (0, drizzle_orm_1.inArray)(schema_1.cycleLogs.historyId, historyIds) : undefined))];
                case 10:
                    _a.sent();
                    _a.label = 11;
                case 11:
                    // Delete Stock Logs for these farmers (to reset their balance history)
                    console.log("  - Deleting farmer stock logs...");
                    return [4 /*yield*/, db_1.db.delete(schema_1.stockLogs).where((0, drizzle_orm_1.inArray)(schema_1.stockLogs.farmerId, farmerIds))];
                case 12:
                    _a.sent();
                    if (!(activeCycleIds.length > 0)) return [3 /*break*/, 14];
                    console.log("  - Deleting active cycles...");
                    return [4 /*yield*/, db_1.db.delete(schema_1.cycles).where((0, drizzle_orm_1.inArray)(schema_1.cycles.id, activeCycleIds))];
                case 13:
                    _a.sent();
                    _a.label = 14;
                case 14:
                    if (!(historyIds.length > 0)) return [3 /*break*/, 16];
                    console.log("  - Deleting cycle history...");
                    return [4 /*yield*/, db_1.db.delete(schema_1.cycleHistory).where((0, drizzle_orm_1.inArray)(schema_1.cycleHistory.id, historyIds))];
                case 15:
                    _a.sent();
                    _a.label = 16;
                case 16:
                    // Optional: Reset farmer stock/consumed fields?
                    console.log("  - Resetting farmer statistics...");
                    return [4 /*yield*/, db_1.db.update(schema_1.farmer)
                            .set({ mainStock: 0, totalConsumed: 0, updatedAt: new Date() })
                            .where((0, drizzle_orm_1.inArray)(schema_1.farmer.id, farmerIds))];
                case 17:
                    _a.sent();
                    console.log("✅ Successfully cleared all cycle data for the officer's farmers.");
                    process.exit(0);
                    return [3 /*break*/, 19];
                case 18:
                    error_1 = _a.sent();
                    console.error("❌ Deletion failed:", error_1);
                    process.exit(1);
                    return [3 /*break*/, 19];
                case 19: return [2 /*return*/];
            }
        });
    });
}
main();
