// =====================================================
// NL App Compiler — Stage 2: System Design
// =====================================================

const { callGemini } = require('../llm/client');
const { SYSTEM_DESIGN_PROMPT } = require('../llm/prompts');
const { validateDesign, repairDesign } = require('../validation/validator');

/**
 * Convert extracted intent into system architecture.
 * @param {object} intent - Structured intent from Stage 1
 * @returns {Promise<object>} System design
 */
async function designSystem(intent) {
    const intentSummary = JSON.stringify(intent, null, 2);

    let design = await callGemini(
        SYSTEM_DESIGN_PROMPT,
        `Here is the extracted intent:\n\n${intentSummary}`,
        { temperature: 0.1 }
    );

    // Validate
    const validation = validateDesign(design, intent);
    if (!validation.valid) {
        console.log('   ⚠️  Design validation failed, repairing...');
        design = repairDesign(design, validation.errors, intent);

        const revalidation = validateDesign(design, intent);
        if (!revalidation.valid) {
            console.log('   ⚠️  Repair insufficient, re-generating...');
            const errorContext = `Fix these issues: ${JSON.stringify(revalidation.errors)}`;
            design = await callGemini(
                SYSTEM_DESIGN_PROMPT,
                `${intentSummary}\n\n${errorContext}`,
                { temperature: 0.05 }
            );
            design = repairDesign(design, [], intent);
        }
    }

    // Ensure appName is propagated
    design.appName = design.appName || intent.appName;

    return design;
}

module.exports = { designSystem };
