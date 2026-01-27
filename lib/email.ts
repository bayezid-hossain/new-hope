import nodemailer from "nodemailer";

export const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
    },
});

export const sendEmail = async ({ to, subject, html }: { to: string, subject: string, html: string }) => {
    console.log(to, subject, html);
    try {
        const info = await transporter.sendMail({
            from: `"Feed Reminder" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            html,
        });
        console.log("Email sent: %s", info.messageId);
        return { data: info, error: null };
    } catch (error) {
        console.error("Error sending email:", error);
        return { data: null, error };
    }
};
