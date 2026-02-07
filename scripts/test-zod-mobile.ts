
import { z } from "zod";

const mobileSchema = z.string().regex(/^(?:\+?88)?01[3-9]\d{8}$/, "Invalid mobile number");

const testCases = [
    { input: "01712345678", expected: true },
    { input: "01300000000", expected: true },
    { input: "01999999999", expected: true },
    { input: "8801712345678", expected: true },
    { input: "+8801712345678", expected: true },

    // Invalid cases
    { input: "01112345678", expected: false }, // Invalid prefix 011
    { input: "01212345678", expected: false }, // Invalid prefix 012
    { input: "0171234567", expected: false },  // Too short
    { input: "017123456789", expected: false }, // Too long
    { input: "880171234567", expected: false }, // Short with prefix
    { input: "+88017123456789", expected: false }, // Long with prefix
];

console.log("Testing Mobile Number Validation Regex: /^(?:\\+?88)?01[3-9]\\d{8}$/\n");

let passed = 0;
let failed = 0;

testCases.forEach(({ input, expected }) => {
    const result = mobileSchema.safeParse(input);
    const isSuccess = result.success;

    if (isSuccess === expected) {
        console.log(`[PASS] Input: "${input}" | Expected: ${expected}`);
        passed++;
    } else {
        console.error(`[FAIL] Input: "${input}" | Expected: ${expected} | Got: ${isSuccess}`);
        failed++;
    }
});

console.log(`\nSummary: ${passed} Passed, ${failed} Failed`);

if (failed > 0) process.exit(1);
