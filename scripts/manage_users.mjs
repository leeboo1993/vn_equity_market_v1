import { getUsers, saveUsers } from '../lib/users.js';

async function main() {
    const users = await getUsers();
    console.log("Current Users:", JSON.stringify(users, null, 2));

    const emailToApprove = process.argv[2];
    if (emailToApprove) {
        const user = users.find(u => u.email === emailToApprove);
        if (user) {
            user.approved = true;
            user.role = 'admin';
            await saveUsers(users);
            console.log(`User ${emailToApprove} has been approved and promoted to admin.`);
        } else {
            console.log(`User ${emailToApprove} not found.`);
        }
    }
}

main().catch(console.error);
