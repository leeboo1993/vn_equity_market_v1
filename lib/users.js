import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import bcrypt from 'bcryptjs';
import { sendAdminNotification } from './mail.js';

const R2_BUCKET = process.env.R2_BUCKET;
const R2_ENDPOINT = process.env.R2_ENDPOINT;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;

const r2Client = new S3Client({
    region: "auto",
    endpoint: R2_ENDPOINT,
    credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
});

const prefix = process.env.PROJECT_ID ? `${process.env.PROJECT_ID}_` : '';
const USERS_FILE = `${prefix}users.json`;

export async function getUsers() {
    try {
        const cmd = new GetObjectCommand({ Bucket: R2_BUCKET, Key: USERS_FILE });
        const res = await r2Client.send(cmd);
        const body = await res.Body.transformToString();
        return JSON.parse(body);
    } catch (e) {
        if (e.name === 'NoSuchKey') return [];
        console.error("Error fetching users:", e);
        return [];
    }
}

export async function saveUsers(users) {
    try {
        const cmd = new PutObjectCommand({
            Bucket: R2_BUCKET,
            Key: USERS_FILE,
            Body: JSON.stringify(users, null, 2),
            ContentType: 'application/json',
        });
        await r2Client.send(cmd);
    } catch (e) {
        console.error("Error saving users:", e);
    }
}

export async function findUserByEmail(email) {
    const users = await getUsers();
    return users.find(u => u.email === email);
}

export async function createUser({ email, name, image, password, provider = 'google', role = null, approved = null }) {
    const users = await getUsers();
    const existing = users.find(u => u.email === email);
    if (existing) return existing;

    let hashedPassword = null;
    if (password) {
        hashedPassword = await bcrypt.hash(password, 10);
    }

    const newUser = {
        email,
        name: name || email.split('@')[0],
        image,
        password: hashedPassword,
        provider,
        role: role || (users.length === 0 ? 'admin' : 'member'),
        approved: approved !== null ? approved : (users.length === 0),
        createdAt: new Date().toISOString(),
    };

    users.push(newUser);
    await saveUsers(users);

    // Notify admin for new non-admin users
    if (!newUser.approved) {
        try {
            await sendAdminNotification(newUser);
        } catch (e) {
            console.error("Failed to send admin notification for new user:", e);
        }
    }

    return newUser;

}

export async function verifyUserPassword(email, password) {
    const user = await findUserByEmail(email);
    if (!user || !user.password) return null;

    const isValid = await bcrypt.compare(password, user.password);
    return isValid ? user : null;
}

export async function updateUser(email, updates) {
    const users = await getUsers();
    const index = users.findIndex(u => u.email === email);
    if (index === -1) return null;

    users[index] = { ...users[index], ...updates };
    await saveUsers(users);
    return users[index];
}

export async function deleteUser(email) {
    const users = await getUsers();
    const newUsers = users.filter(u => u.email !== email);
    if (newUsers.length === users.length) return false; // User not found

    await saveUsers(newUsers);
    return true;
}
