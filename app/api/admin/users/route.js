import { getUsers, updateUser, deleteUser } from "@/lib/users";
import { auth } from "@/auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {

    const session = await auth();
    if (!session || session.user.role !== 'admin') {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const users = await getUsers();
    // Don't leak passwords to the frontend
    const sanitizedUsers = users.map(({ password, ...rest }) => rest);
    return NextResponse.json(sanitizedUsers);
}

export async function PATCH(req) {
    const session = await auth();
    if (!session || session.user.role !== 'admin') {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { email, approved, role } = await req.json();
    const updates = {};
    if (approved !== undefined) updates.approved = approved;
    if (role !== undefined) updates.role = role;

    const updatedUser = await updateUser(email, updates);
    return NextResponse.json(updatedUser);
}

export async function DELETE(req) {
    const session = await auth();
    if (!session || session.user.role !== 'admin') {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { email } = await req.json();
    if (!email) {
        return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const success = await deleteUser(email);
    if (!success) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
}
