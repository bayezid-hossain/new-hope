"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
var serverless_1 = require("@neondatabase/serverless");
var neon_serverless_1 = require("drizzle-orm/neon-serverless");
var schema = require("./schema");
var pool = new serverless_1.Pool({
    connectionString: process.env.DATABASE_URL,
});
exports.db = (0, neon_serverless_1.drizzle)(pool, { schema: schema });
