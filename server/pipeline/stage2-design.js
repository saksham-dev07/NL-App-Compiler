// =====================================================
// NL App Compiler — Stage 2: System Design
// =====================================================

const { callGemini } = require('../llm/client');
const { SYSTEM_DESIGN_PROMPT } = require('../llm/prompts');
const { validateDesign, repairDesign, generateValidated } = require('../validation/validator');

/**
 * Convert extracted intent into system architecture.
 * @param {object} intent - Structured intent from Stage 1
 * @returns {Promise<object>} System design
 */
async function designSystem(intent) {
    const intentSummary = JSON.stringify(intent, null, 2);

    let design = await generateValidated(
        callGemini,
        SYSTEM_DESIGN_PROMPT,
        `Here is the extracted intent:\n\n${intentSummary}`,
        validateDesign,
        repairDesign,
        [intent]
    );

    // Ensure appName is propagated
    design.appName = design.appName || intent.appName;

    return design;
}

module.exports = { designSystem };
