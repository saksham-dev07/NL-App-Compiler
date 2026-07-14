// =====================================================
// NL App Compiler — Stage 1: Intent Extraction
// =====================================================

const { callGemini } = require('../llm/client');
const { INTENT_EXTRACTION_PROMPT } = require('../llm/prompts');
const { validateIntent, repairIntent, generateValidated } = require('../validation/validator');

/**
 * Extract structured intent from user's natural language prompt.
 * @param {string} prompt - User prompt
 * @returns {Promise<object>} Structured intent
 */
async function extractIntent(prompt) {
    return await generateValidated(
        callGemini,
        INTENT_EXTRACTION_PROMPT,
        prompt,
        validateIntent,
        repairIntent
    );
}

module.exports = { extractIntent };
