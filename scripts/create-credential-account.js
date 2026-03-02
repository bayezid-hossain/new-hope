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
var serverless_1 = require("@neondatabase/serverless");
var crypto_1 = require("crypto");
var dotenv_1 = require("dotenv");
var drizzle_orm_1 = require("drizzle-orm");
var neon_http_1 = require("drizzle-orm/neon-http");
var schema = require("../db/schema");
dotenv_1.default.config();
var sql = (0, serverless_1.neon)(process.env.DATABASE_URL);
var db = (0, neon_http_1.drizzle)(sql, { schema: schema });
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var refEmail, targetEmail, refUser, refAccount, passwordHash, targetUser, existingTargetAccount, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    refEmail = "me.bayezid@gmail.com";
                    targetEmail = "mashiurrahmantutul@gmail.com";
                    console.log("Starting credential creation for ".concat(targetEmail, " using ").concat(refEmail, " as reference..."));
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 10, , 11]);
                    return [4 /*yield*/, db.query.user.findFirst({
                            where: (0, drizzle_orm_1.eq)(schema.user.email, refEmail),
                        })];
                case 2:
                    refUser = _a.sent();
                    if (!refUser) {
                        console.error("Reference user ".concat(refEmail, " not found."));
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, db.query.account.findFirst({
                            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.account.userId, refUser.id), (0, drizzle_orm_1.eq)(schema.account.providerId, "credential")),
                        })];
                case 3:
                    refAccount = _a.sent();
                    if (!refAccount || !refAccount.password) {
                        console.error("Reference user ".concat(refEmail, " does not have a credential password."));
                        return [2 /*return*/];
                    }
                    passwordHash = refAccount.password;
                    return [4 /*yield*/, db.query.user.findFirst({
                            where: (0, drizzle_orm_1.eq)(schema.user.email, targetEmail),
                        })];
                case 4:
                    targetUser = _a.sent();
                    if (!targetUser) {
                        console.error("Target user ".concat(targetEmail, " not found."));
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, db.query.account.findFirst({
                            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.account.userId, targetUser.id), (0, drizzle_orm_1.eq)(schema.account.providerId, "credential")),
                        })];
                case 5:
                    existingTargetAccount = _a.sent();
                    if (!existingTargetAccount) return [3 /*break*/, 7];
                    console.log("Target user ".concat(targetEmail, " already has a credential account. Updating password..."));
                    return [4 /*yield*/, db.update(schema.account)
                            .set({ password: passwordHash, updatedAt: new Date() })
                            .where((0, drizzle_orm_1.eq)(schema.account.id, existingTargetAccount.id))];
                case 6:
                    _a.sent();
                    console.log("Password updated successfully.");
                    return [3 /*break*/, 9];
                case 7:
                    console.log("Creating credential account for ".concat(targetEmail, "..."));
                    return [4 /*yield*/, db.insert(schema.account).values({
                            id: crypto_1.default.randomUUID(),
                            accountId: targetUser.email,
                            providerId: "credential",
                            userId: targetUser.id,
                            password: passwordHash,
                            createdAt: new Date(),
                            updatedAt: new Date(),
                        })];
                case 8:
                    _a.sent();
                    console.log("Credential account created successfully.");
                    _a.label = 9;
                case 9: return [3 /*break*/, 11];
                case 10:
                    error_1 = _a.sent();
                    console.error("An error occurred:", error_1.message);
                    if (error_1.stack)
                        console.error(error_1.stack);
                    return [3 /*break*/, 11];
                case 11: return [2 /*return*/];
            }
        });
    });
}
main();
