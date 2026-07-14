// =====================================================
// NL App Compiler — Gemini LLM Client
// =====================================================

const https = require('https');
const http = require('http');
const crypto = require('crypto');

// In-memory cache to save tokens and latency on identical prompts
const responseCache = new Map();

// Token tracking
const tokenTracker = {
    totalPromptTokens: 0,
    totalCompletionTokens: 0,
    totalRequests: 0,
    reset() {
        this.totalPromptTokens = 0;
        this.totalCompletionTokens = 0;
        this.totalRequests = 0;
    },
    get totalTokens() {
        return this.totalPromptTokens + this.totalCompletionTokens;
    },
    // Approximate cost for Gemini 2.0 Flash (very cheap)
    get estimatedCost() {
        const inputCost = (this.totalPromptTokens / 1_000_000) * 0.075;
        const outputCost = (this.totalCompletionTokens / 1_000_000) * 0.30;
        return inputCost + outputCost;
    },
};

/**
 * Call Gemini API with structured output support.
 * @param {string} systemPrompt - System instructions
 * @param {string} userPrompt - User message
 * @param {object} options - Additional options
 * @returns {Promise<object>} Parsed JSON response
 */
async function callGemini(systemPrompt, userPrompt, options = {}) {
    const {
        temperature = 0.1,
        maxRetries = 3,
        jsonMode = true,
        model = 'gemini-3.1-flash-lite',
    } = options;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY not set');
    }

    // Check cache first
    const cacheKey = crypto.createHash('md5').update(systemPrompt + userPrompt).digest('hex');
    if (responseCache.has(cacheKey)) {
        console.log('   ⚡ Returning cached LLM response');
        // Return deep copy to prevent mutation
        return JSON.parse(JSON.stringify(responseCache.get(cacheKey)));
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const body = {
        contents: [
            {
                role: 'user',
                parts: [{ text: `${systemPrompt}\n\n---\n\nUser Request:\n${userPrompt}` }],
            },
        ],
        generationConfig: {
            temperature,
            maxOutputTokens: 65536,
            topP: 0.95,
        },
    };

    if (jsonMode) {
        body.generationConfig.responseMimeType = 'application/json';
    }

    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await httpPost(url, body);

            tokenTracker.totalRequests++;

            // Extract token counts from usage metadata
            if (response.usageMetadata) {
                tokenTracker.totalPromptTokens += response.usageMetadata.promptTokenCount || 0;
                tokenTracker.totalCompletionTokens += response.usageMetadata.candidatesTokenCount || 0;
            }

            // Extract text content
            const candidate = response.candidates?.[0];
            if (!candidate || !candidate.content?.parts?.length) {
                throw new Error('Empty response from Gemini');
            }

            const text = candidate.content.parts[0].text;

            if (jsonMode) {
                try {
                    const parsed = JSON.parse(text);
                    responseCache.set(cacheKey, JSON.parse(JSON.stringify(parsed)));
                    return parsed;
                } catch (parseErr) {
                    // Attempt to extract JSON from the response
                    const extracted = extractJSON(text);
                    if (extracted) {
                        responseCache.set(cacheKey, JSON.parse(JSON.stringify(extracted)));
                        return extracted;
                    }
                    throw new Error(`Invalid JSON from Gemini: ${parseErr.message}`);
                }
            }

            responseCache.set(cacheKey, text);
            return text;
        } catch (err) {
            lastError = err;
            console.warn(`Gemini API attempt ${attempt}/${maxRetries} failed:`, err.message);

            if (attempt < maxRetries) {
                // Longer backoff for rate limits, shorter for other errors
                const isRateLimit = err.message.includes('quota') || err.message.includes('429') || err.message.includes('rate');
                const baseDelay = isRateLimit ? 15000 : 2000;
                const delay = Math.min(baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000, 60000);
                console.log(`   Waiting ${Math.round(delay / 1000)}s before retry...`);
                await sleep(delay);
            }
        }
    }

    throw new Error(`Gemini API failed after ${maxRetries} attempts: ${lastError?.message}`);
}

/**
 * Attempt to extract JSON from a text response that might have markdown formatting.
 */
function extractJSON(text) {
    // Try direct parse first
    try {
        return JSON.parse(text);
    } catch (e) {
        // ignore
    }

    // Try extracting from code fences
    const jsonMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (jsonMatch) {
        try {
            return JSON.parse(jsonMatch[1].trim());
        } catch (e) {
            // ignore
        }
    }

    // Try finding the outermost JSON object/array
    const firstBrace = text.indexOf('{');
    const firstBracket = text.indexOf('[');
    let start = -1;
    let endChar = '';

    if (firstBrace >= 0 && (firstBracket < 0 || firstBrace < firstBracket)) {
        start = firstBrace;
        endChar = '}';
    } else if (firstBracket >= 0) {
        start = firstBracket;
        endChar = ']';
    }

    if (start >= 0) {
        // Find matching closing brace/bracket
        let depth = 0;
        let inString = false;
        let escape = false;

        for (let i = start; i < text.length; i++) {
            const ch = text[i];

            if (escape) {
                escape = false;
                continue;
            }

            if (ch === '\\') {
                escape = true;
                continue;
            }

            if (ch === '"') {
                inString = !inString;
                continue;
            }

            if (inString) continue;

            if (ch === '{' || ch === '[') depth++;
            if (ch === '}' || ch === ']') {
                depth--;
                if (depth === 0) {
                    try {
                        return JSON.parse(text.substring(start, i + 1));
                    } catch (e) {
                        break;
                    }
                }
            }
        }
    }

    return null;
}

/**
 * HTTP POST helper using native Node.js https module.
 */
function httpPost(url, body) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const data = JSON.stringify(body);

        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port || 443,
            path: urlObj.pathname + urlObj.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data),
            },
        };

        const transport = urlObj.protocol === 'https:' ? https : http;

        const req = transport.request(options, (res) => {
            let responseData = '';

            res.on('data', (chunk) => {
                responseData += chunk;
            });

            res.on('end', () => {
                try {
                    const parsed = JSON.parse(responseData);
                    if (res.statusCode >= 400) {
                        const errMsg = parsed.error?.message || `HTTP ${res.statusCode}`;
                        reject(new Error(errMsg));
                    } else {
                        resolve(parsed);
                    }
                } catch (e) {
                    reject(new Error(`Failed to parse response: ${responseData.substring(0, 200)}`));
                }
            });
        });

        req.on('error', reject);
        req.setTimeout(120000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });

        req.write(data);
        req.end();
    });
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
    callGemini,
    tokenTracker,
    extractJSON,
};
