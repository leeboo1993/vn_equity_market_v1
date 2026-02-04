import nodemailer from 'nodemailer';

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT || 587;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const SITE_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000';

const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
    },
});

export async function sendAdminNotification(newUser) {
    if (!ADMIN_EMAIL || !SMTP_HOST) {
        console.warn("Skipping admin notification: SMTP or Admin Email NOT configured.");
        return;
    }

    const mailOptions = {
        from: `"Investment Tracker" <${SMTP_USER}>`,
        to: ADMIN_EMAIL,
        subject: "New User Registration Alert",
        html: `
            <div style="font-family: sans-serif; padding: 20px; color: #333;">
                <h2 style="color: #00ff7f;">New Registration</h2>
                <p>A new user has registered on the platform and is awaiting approval.</p>
                <div style="background: #f4f4f4; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <p><strong>Email:</strong> ${newUser.email}</p>
                    <p><strong>Provider:</strong> ${newUser.provider}</p>
                    <p><strong>Registered At:</strong> ${new Date(newUser.createdAt).toLocaleString()}</p>
                </div>
                <a href="${SITE_URL}/admin" style="background: #00ff7f; color: #000; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                    Review in Admin Dashboard
                </a>
            </div>
        `,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Admin notification sent for ${newUser.email}`);
    } catch (e) {
        console.error("Failed to send admin notification:", e);
    }
}
