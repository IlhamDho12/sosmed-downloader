const API_INSTANCES = [
    'https://fox.kittycat.boo',
    'https://dog.kittycat.boo',
    'https://cobaltapi.kittycat.boo',
    'https://rue-cobalt.xenon.zone',
    'https://api.cobalt.liubquanti.click',
    'https://api.cobalt.blackcat.sweeux.org',
    'https://cobaltapi.cjs.nz',
];

const ytUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

async function testLive() {
    console.log(`Testing YouTube URL: ${ytUrl}\n`);
    for (const url of API_INSTANCES) {
        console.log(`Trying ${url}...`);
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000); // 10s

            const res = await fetch(`${url}/`, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    url: ytUrl,
                    downloadMode: 'auto',
                    filenameStyle: 'pretty',
                    videoQuality: '720'
                }),
                signal: controller.signal
            });
            clearTimeout(timeout);
            
            console.log(`  Status: ${res.status}`);
            const text = await res.text();
            try {
                const json = JSON.parse(text);
                console.log(`  JSON response:`, JSON.stringify(json, null, 2));
            } catch {
                console.log(`  Text response (first 200 chars):`, text.substring(0, 200));
            }
        } catch (err) {
            console.log(`  Error:`, err.message);
        }
        console.log('-------------------------------------------');
    }
}

testLive();
