// Fetch the event page and check for errors
const https = require('https');
https.get('https://aim-platform-aiimpactmediastudio-7781s-projects.vercel.app/en/events/welcome-on-board-2kkb', res => {
    let data = '';
    res.on('data', d => data += d);
    res.on('end', () => {
        console.log('Status:', res.statusCode);
        if (data.includes('Something went wrong')) {
            console.log('Got error page');
            // Extract digest
            const digestMatch = data.match(/digest.*?(\d+)/);
            if (digestMatch) console.log('Error digest:', digestMatch[1]);
        } else if (data.includes('Sign In to Join')) {
            console.log('Got sign-in prompt (expected for anonymous user)');
        } else if (data.includes('event-page')) {
            console.log('Page rendered successfully');
        }
        // Check for Next.js error payload
        if (data.includes('NEXT_NOT_FOUND')) {
            console.log('404 - page not found');
        }
        console.log('Response length:', data.length);
        // Show first/last 500 chars for debugging
        if (data.length < 2000) {
            console.log('Full response:', data);
        } else {
            console.log('First 500:', data.slice(0, 500));
            console.log('Last 500:', data.slice(-500));
        }
    });
}).on('error', e => console.error('Request error:', e.message));
