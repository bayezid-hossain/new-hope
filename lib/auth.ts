import { db } from "@/db"
import * as schema from "@/db/schema"
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { emailOTP, organization, twoFactor } from "better-auth/plugins"
import { sendEmail } from "./email"

export const auth = betterAuth({
    database: drizzleAdapter(db, {
        provider: "pg",
        schema: {
            ...schema
        }
    }),
    emailAndPassword: {
        enabled: true,
        requireEmailVerification: false,
        async sendResetPassword({ user, url }) {
            // //conosle.log(`Sending reset password email to: ${user.email}`);
            const { error } = await sendEmail({
                to: user.email,
                subject: "Reset your password",
                html: `
                    <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                        <h2 style="color: #333; text-align: center;">Reset your password</h2>
                        <p style="color: #666; font-size: 16px;">We received a request to reset the password for your account. Click the button below to proceed:</p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${url}" style="display: inline-block; padding: 14px 30px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">Reset Password</a>
                        </div>
                        <p style="color: #666; font-size: 14px;">If you didn't request a password reset, you can safely ignore this email. This link will expire shortly.</p>
                        <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;" />
                        <p style="color: #999; font-size: 12px; text-align: center;">&copy; ${new Date().getFullYear()} Feed Reminder. All rights reserved.</p>
                    </div>
                `,
            });

            if (error) {
                console.error("Email Error (Password Reset):", error);
            }
        },
    },
    user: {
        additionalFields: {
            activeMode: {
                type: "string",
                required: false,
                defaultValue: "USER",
                input: false
            },
            globalRole: {
                type: "string",
                required: false,
                defaultValue: "USER",
                input: false
            },
            isPro: {
                type: "boolean",
                required: false,
                defaultValue: false,
                input: false
            }
        }
    },
    socialProviders: {
        google: {
            clientId: process.env.GOOGLE_CLIENT_ID as string,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
        }
    },
    rateLimit: {
        window: 600, // 10 minutes
        max: 100, // 100 requests per 10 minutes (global)
        customRules: {
            "/sign-in": {
                window: 600,
                max: 5, // 5 login attempts per 10 minutes
            },
            "/sign-up": {
                window: 600,
                max: 3, // 3 signup attempts per 10 minutes
            }
        }
    },
    plugins: [
        organization(),
        twoFactor({
            otpOptions: {
                async sendOTP({ user, otp }) {
                    // //conosle.log(`Sending 2FA OTP to: ${user.email}`);
                    const { error } = await sendEmail({
                        to: user.email,
                        subject: "Your 2FA Code",
                        html: `<p>Your verification code is: <strong>${otp}</strong></p>`,
                    });

                    if (error) {
                        console.error("Email Error (2FA OTP):", error);
                    }
                },
            }
        }),
        emailOTP({
            sendVerificationOnSignUp: true,
            overrideDefaultEmailVerification: true,
            async sendVerificationOTP({ email, otp, type }) {
                if (type === "email-verification") {
                    //     //conosle.log(`Sending Verification OTP to: ${email}`);
                    const verificationUrl = `${process.env.BETTER_AUTH_URL || "http://localhost:3000"}/verify-email?otp=${otp}&email=${encodeURIComponent(email)}`;

                    const { error } = await sendEmail({
                        to: email,
                        subject: "Verify your email address",
                        html: `
                            <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                                <div style="text-align: center; margin-bottom: 30px;">
                                    <h1 style="color: #007bff; margin-bottom: 10px;">Feed Reminder</h1>
                                    <div style="height: 2px; background: #eee; width: 50px; margin: auto;"></div>
                                </div>
                                <h2 style="color: #333; text-align: center; margin-bottom: 20px;">Confirm your email</h2>
                                <p style="color: #666; font-size: 16px; line-height: 1.5;">Welcome! Please use the following 6-digit code to verify your account:</p>
                                <div style="font-size: 36px; font-weight: bold; letter-spacing: 8px; padding: 24px; background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; text-align: center; color: #007bff; margin: 25px 0;">
                                    ${otp}
                                </div>
                                <p style="color: #666; font-size: 16px; text-align: center; margin-top: 30px;">
                                    <strong>Prefer a faster way?</strong> Just click the button below to verify automatically:
                                </p>
                                <div style="text-align: center; margin-top: 25px; margin-bottom: 35px;">
                                    <a href="${verificationUrl}" style="display: inline-block; padding: 16px 36px; background-color: #007bff; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; box-shadow: 0 2px 4px rgba(0,123,255,0.3);">Verify Account Automatically</a>
                                </div>
                                <p style="color: #999; font-size: 14px; text-align: center;">If the button doesn't work, copy and paste this link into your browser:</p>
                                <p style="color: #007bff; font-size: 12px; text-align: center; word-break: break-all;">${verificationUrl}</p>
                                <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; text-align: center;">
                                    <p style="font-size: 12px; color: #999;">This code expires in 5 minutes. If you didn't create an account, you can safely ignore this email.</p>
                                    <p style="font-size: 12px; color: #999; margin-top: 10px;">&copy; ${new Date().getFullYear()} Feed Reminder. All rights reserved.</p>
                                </div>
                            </div>
                        `,
                    });
                    if (error) {
                        console.error("Email Error (Verification OTP):", error);
                    }
                }
            },
        })
    ],
    trustedOrigins: [
        process.env.BETTER_AUTH_URL || "http://localhost:3000",
        "http://192.168.0.186:3000",
        "https://feed-newhope.vercel.app"
    ],
})
