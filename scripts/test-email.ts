import dotenv from "dotenv";
import { sendEmail } from "../lib/email";
dotenv.config();

async function test() {
    console.log("Testing email with user:", process.env.EMAIL_USER);
    const { data, error } = await sendEmail({
        to: process.env.EMAIL_USER!,
        subject: "Test Email from Feed Reminder",
        html: "<h1>Test email</h1><p>If you see this, email sending works.</p>",
    });

    if (error) {
        console.error("Test failed:", error);
    } else {
        console.log("Test successful:", data);
    }
}

test();
