require('dotenv').config();
const { callGemini } = require('./server/llm/client');

async function test() {
    try {
        const result = await callGemini(
            'Reply with a JSON object containing status: ok',
            'test connection',
            { maxRetries: 1 }
        );
        console.log('SUCCESS:', JSON.stringify(result));
    } catch (e) {
        console.log('ERROR:', e.message);
    }
    process.exit(0);
}

test();
