import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

export async function triggerRebuild() {
    const hookUrl = process.env.VERCEL_DEPLOY_HOOK_URL;

    if (!hookUrl) {
        console.warn("⚠️  Skipping Rebuild Trigger: VERCEL_DEPLOY_HOOK_URL not found in .env.local");
        console.log("   To enable automatic updates: Create a Deploy Hook in Vercel (Settings > Git > Deploy Hooks) and add it to .env.local");
        return;
    }

    console.log("🚀 Triggering Vercel Rebuild...");

    try {
        const res = await fetch(hookUrl, { method: 'POST' });
        if (res.ok) {
            const data = await res.json();
            console.log("✅ Rebuild Triggered Successfully!");
            console.log("   Job ID:", data.job?.id);
            console.log("   State:", data.job?.state);
        } else {
            console.error("❌ Failed to trigger rebuild:", res.status, res.statusText);
            const text = await res.text();
            console.error("   Response:", text);
        }
    } catch (e) {
        console.error("❌ Error triggering rebuild:", e.message);
    }
}

// Allow running directly: node scripts/trigger_rebuild.mjs
if (process.argv[1] === import.meta.filename || process.argv[1].endsWith('trigger_rebuild.mjs')) {
    triggerRebuild();
}
