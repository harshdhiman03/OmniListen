import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function runTests() {
    const baseUrl = 'http://localhost:3000';
    const userId = "123e4567-e89b-12d3-a456-426614174000";
    console.log(`\n========================================`);
    console.log(`Starting Test Sequence for User ID: ${userId}`);
    console.log(`========================================\n`);

    const report: any = {};

    // 1. Test Onboarding Chat
    console.log(`[1/5] Testing POST /api/onboarding/chat ...`);
    try {
        const chatRes = await fetch(`${baseUrl}/api/onboarding/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                history: [
                    { role: "user", content: "I am really interested in quantum computing, electric vehicles, and global financial markets." }
                ]
            })
        });
        report.chat = { status: chatRes.status, body: await chatRes.text() };
        console.log(`  -> Status: ${chatRes.status}`);
    } catch (e: any) {
        console.error(`  -> Failed:`, e.message);
        report.chat = { error: e.message };
    }

    // 2. Test Onboarding Finalize
    console.log(`\n[2/5] Testing POST /api/onboarding/finalize ...`);
    try {
        const finalizeRes = await fetch(`${baseUrl}/api/onboarding/finalize`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: userId,
                history: [
                    { role: "user", content: "I am really interested in quantum computing, electric vehicles, and global financial markets." }
                ]
            })
        });
        report.finalize = { status: finalizeRes.status, body: await finalizeRes.text() };
        console.log(`  -> Status: ${finalizeRes.status}`);
    } catch (e: any) {
        console.error(`  -> Failed:`, e.message);
        report.finalize = { error: e.message };
    }

    // Wait a moment for Supabase to settle
    await new Promise(r => setTimeout(r, 2000));

    // 3. Test Cron Queueing
    console.log(`\n[3/5] Testing GET /api/cron/daily-briefing ...`);
    try {
        const cronRes = await fetch(`${baseUrl}/api/cron/daily-briefing`, {
            method: 'GET',
            headers: {
                'authorization': `Bearer ${process.env.CRON_SECRET}`
            }
        });
        report.cron = { status: cronRes.status, body: await cronRes.text() };
        console.log(`  -> Status: ${cronRes.status}`);
    } catch (e: any) {
        console.error(`  -> Failed:`, e.message);
        report.cron = { error: e.message };
    }

    // 4. Test Telemetry
    console.log(`\n[4/5] Testing POST /api/telemetry (Foreign Key bypass) ...`);
    try {
        const telRes = await fetch(`${baseUrl}/api/telemetry`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: userId,
                article_id: 0,
                action_type: "completed",
                duration_listened_seconds: 45
            })
        });
        report.telemetry = { status: telRes.status, body: await telRes.text() };
        console.log(`  -> Status: ${telRes.status}`);
    } catch (e: any) {
        console.error(`  -> Failed:`, e.message);
        report.telemetry = { error: e.message };
    }

    // 5. Test Check Playlist
    console.log(`\n[5/5] Testing GET /api/check-playlist ...`);
    try {
        const playRes = await fetch(`${baseUrl}/api/check-playlist?userId=${userId}`, {
            method: 'GET'
        });
        report.playlist = { status: playRes.status, body: await playRes.text() };
        console.log(`  -> Status: ${playRes.status}`);
    } catch (e: any) {
        console.error(`  -> Failed:`, e.message);
        report.playlist = { error: e.message };
    }

    console.log(`\n========================================`);
    console.log(`TEST SEQUENCE COMPLETE`);
    console.log(`========================================\n`);
    
    // Output full report to a local json file for analysis
    const fs = require('fs');
    fs.writeFileSync('./test_report.json', JSON.stringify(report, null, 2));
    console.log('Wrote detailed response logs to ./test_report.json');
}

runTests();
