import { auth } from "@/auth";
import { getUsers, updateUser, deleteUser } from "@/lib/users";
import { NextResponse } from "next/server";

export async function GET() {
    const session = await auth();
    if (!session || session.user.role !== 'admin') {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const users = await getUsers();
    // Return users without passwords
    const safeUsers = users.map(({ password, ...u }) => u);
    return NextResponse.json(safeUsers);
}

export async function POST(req) {
    const session = await auth();
    if (!session || session.user.role !== 'admin') {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    try {
        const { email, role, approved } = await req.json();
        if (!email) return new NextResponse("Email required", { status: 400 });

        const updated = await updateUser(email, { role, approved });
        if (!updated) return new NextResponse("User not found", { status: 404 });

        const { password, ...safeUser } = updated;
        return NextResponse.json(safeUser);
    } catch (e) {
        return new NextResponse(e.message, { status: 500 });
    }
}

export async function DELETE(req) {
    const session = await auth();
    if (!session || session.user.role !== 'admin') {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    try {
        const { email } = await req.json();
        if (!email) return new NextResponse("Email required", { status: 400 });

        const success = await deleteUser(email);
        return NextResponse.json({ success });
    } catch (e) {
        return new NextResponse(e.message, { status: 500 });
    }
}
