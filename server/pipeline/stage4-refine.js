// =====================================================
// NL App Compiler — Stage 4: Refinement & Validation
// =====================================================

const { callGemini } = require('../llm/client');
const { REFINEMENT_PROMPT } = require('../llm/prompts');
const { checkConsistency } = require('../validation/consistency');
const { repairSchemas } = require('../validation/repair');

/**
 * Validate cross-layer consistency and refine the generated schemas.
 * @param {object} schemas - { ui, api, db, auth } from Stage 3
 * @param {object} intent - From Stage 1
 * @param {object} design - From Stage 2
 * @returns {Promise<object>} Refined result with repairs log
 */
async function refineAndValidate(schemas, intent, design) {
    const repairs = [];
    let result = { ...schemas };

    // --- Step 1: Local consistency check ---
    console.log('   🔍 Running consistency checks...');
    const consistencyIssues = checkConsistency(result);

    if (consistencyIssues.length > 0) {
        console.log(`   ⚠️  Found ${consistencyIssues.length} consistency issues`);
        consistencyIssues.forEach((issue) => {
            repairs.push({
                stage: 'consistency-check',
                message: `[${issue.severity}] ${issue.message}`,
            });
        });

        // --- Step 2: Auto-repair what we can locally ---
        console.log('   🔧 Attempting auto-repair...');
        result = repairSchemas(result, consistencyIssues);
    }

    // --- Step 3: LLM-based refinement only for CRITICAL issues ---
    const remainingIssues = checkConsistency(result);
    const criticalRemaining = remainingIssues.filter((i) => i.severity === 'error');

    if (criticalRemaining.length > 0) {
        console.log(`   🤖 ${criticalRemaining.length} critical issues remain, using LLM refinement...`);

        // Send only the issues and relevant parts, not the full massive config
        const refinementContext = `
Current Configuration (summary):
- UI: ${result.ui?.pages?.length || 0} pages
- API: ${result.api?.endpoints?.length || 0} endpoints
- DB: ${JSON.stringify(result.db, null, 2)}
- Auth: ${JSON.stringify(result.auth, null, 2)}

Original Intent:
${JSON.stringify(intent, null, 2)}

Critical Issues to Fix:
${JSON.stringify(criticalRemaining, null, 2)}
`;

        try {
            const refined = await callGemini(REFINEMENT_PROMPT, refinementContext, {
                temperature: 0.05,
                maxRetries: 2,
            });

            if (refined.refinedConfig) {
                if (refined.refinedConfig.db) result.db = refined.refinedConfig.db;
                if (refined.refinedConfig.auth) result.auth = refined.refinedConfig.auth;
                // Only override UI/API from refinement if explicitly provided
                if (refined.refinedConfig.ui?.pages) result.ui = refined.refinedConfig.ui;
                if (refined.refinedConfig.api?.endpoints) result.api = refined.refinedConfig.api;

                if (refined.issues) {
                    refined.issues.forEach((issue) => {
                        repairs.push({
                            stage: 'llm-refinement',
                            message: `[${issue.severity}] ${issue.message} → Fix: ${issue.fix}`,
                        });
                    });
                }
            }
        } catch (err) {
            console.warn('   ⚠️  LLM refinement failed, using auto-repaired version:', err.message);
            repairs.push({
                stage: 'llm-refinement',
                message: `LLM refinement failed: ${err.message}. Using auto-repaired version.`,
            });
        }
    } else if (remainingIssues.length > 0) {
        console.log(`   ℹ️  ${remainingIssues.length} non-critical issues remain (warnings/info) — acceptable`);
    }

    // --- Final validation ---
    const finalIssues = checkConsistency(result);
    const criticalIssues = finalIssues.filter((i) => i.severity === 'error');

    if (criticalIssues.length > 0) {
        console.log(`   ⚠️  ${criticalIssues.length} critical issues remain after refinement`);
    } else {
        console.log('   ✅ All consistency checks passed');
    }

    return {
        result,
        repairs,
        issues: finalIssues,
        isValid: criticalIssues.length === 0,
    };
}

module.exports = { refineAndValidate };
