// =====================================================
// NL App Compiler — Stage 1: Intent Extraction
// =====================================================

const { callGemini } = require('../llm/client');
const { INTENT_EXTRACTION_PROMPT } = require('../llm/prompts');
const { validateIntent, repairIntent } = require('../validation/validator');

/**
 * Extract structured intent from user's natural language prompt.
 * @param {string} prompt - User prompt
 * @returns {Promise<object>} Structured intent
 */
async function extractIntent(prompt) {
    let intent = await callGemini(INTENT_EXTRACTION_PROMPT, prompt, {
        temperature: 0.1,
    });

    // Validate
    const validation = validateIntent(intent);
    if (!validation.valid) {
        console.log('   ⚠️  Intent validation failed, repairing...');
        intent = repairIntent(intent, validation.errors);

        // Re-validate after repair
        const revalidation = validateIntent(intent);
        if (!revalidation.valid) {
            // One more attempt with LLM
            console.log('   ⚠️  Repair insufficient, re-generating...');
            const errorContext = `The previous output had these validation errors: ${JSON.stringify(revalidation.errors)}. Please fix them.`;
            intent = await callGemini(
                INTENT_EXTRACTION_PROMPT,
                `${prompt}\n\n${errorContext}`,
                { temperature: 0.05 }
            );
            intent = repairIntent(intent, []);
        }
    }

    return intent;
}

module.exports = { extractIntent };
