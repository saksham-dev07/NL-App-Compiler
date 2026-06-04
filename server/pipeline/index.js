// =====================================================
// NL App Compiler — Pipeline Orchestrator
// =====================================================
//
// Architecture: 4-stage compiler pipeline with inter-stage
// validation gates. Each gate validates the output of the
// previous stage and repairs it before passing downstream.
//
// Pipeline Flow:
//   Prompt → [Failure Check] → [Stage 1: Intent]
//          → [Gate 1: Validate Intent] → [Stage 2: Design]
//          → [Gate 2: Validate Design] → [Stage 3: Schemas]
//          → [Gate 3: Validate Schemas] → [Stage 4: Refine]
//          → [Render] → Working HTML App
//
// Design Decisions:
//   - Sequential stages (not parallel) for data dependency
//   - Each stage receives ONLY the output of prior stages
//   - Gates repair locally first, then escalate to LLM
//   - Metrics collected at every stage for observability
//   - Errors tagged with stage name for debugging

const { extractIntent } = require('./stage1-intent');
const { designSystem } = require('./stage2-design');
const { generateSchemas } = require('./stage3-schema');
const { refineAndValidate } = require('./stage4-refine');
const { handleFailures } = require('./failure-handler');
const { renderApp } = require('../runtime/renderer');
const { tokenTracker } = require('../llm/client');
const {
    validateIntent,
    repairIntent,
    validateDesign,
    repairDesign,
} = require('../validation/validator');

/**
 * Run the full multi-stage generation pipeline.
 *
 * @param {string} prompt - User's natural language description
 * @param {object} options - { modifyMode, existingConfig, originalPrompt, additionalContext }
 * @returns {Promise<object>} Final result with configs, rendered HTML, and metrics
 */
async function runPipeline(prompt, options = {}) {
    const startTime = Date.now();
    const stages = [];
    const repairs = [];
    const assumptions = [];

    // Reset token tracking for this run
    tokenTracker.reset();

    try {
        // ══════════════════════════════════════════════════
        // PRE-CHECK: Failure Handling (vague/conflicting)
        // ══════════════════════════════════════════════════
        const failureCheck = await handleFailures(prompt);

        if (failureCheck.needsClarification) {
            return {
                needsClarification: true,
                questions: failureCheck.questions,
                assumptions: failureCheck.assumptions || [],
            };
        }

        if (failureCheck.assumptions) {
            assumptions.push(...failureCheck.assumptions);
        }

        // Build augmented prompt
        let augmentedPrompt = options.additionalContext
            ? `${prompt}\n\nAdditional context: ${options.additionalContext}`
            : prompt;

        // Modify mode: inject existing config context
        if (options.modifyMode && options.existingConfig) {
            const existingSummary = summarizeExistingConfig(options.existingConfig);
            augmentedPrompt = `MODIFICATION REQUEST:
Original application: ${options.originalPrompt || 'See existing config below'}
Modification: ${prompt}

Existing Application Summary:
${existingSummary}

IMPORTANT: You must MODIFY the existing application based on the modification request. 
Keep all existing features/entities that are not affected by the change.
Add, remove, or modify only what the modification request asks for.`;
            console.log('\n🔄 Running in MODIFY mode');
        }

        // ══════════════════════════════════════════════════
        // STAGE 1: Intent Extraction
        // ══════════════════════════════════════════════════
        console.log('\n📋 Stage 1: Intent Extraction...');
        const stage1Start = Date.now();

        let intent;
        try {
            intent = await extractIntent(augmentedPrompt);
        } catch (err) {
            err.stage = 'intent';
            throw err;
        }

        const stage1Duration = Date.now() - stage1Start;
        stages.push({ name: 'intent', duration: stage1Duration, status: 'completed' });

        // ── Gate 1: Validate & Repair Intent ──
        const intentValidation = validateIntent(intent);
        if (!intentValidation.valid) {
            console.log(`   ⚠️  Intent has ${intentValidation.errors.length} issues, repairing...`);
            intentValidation.errors.forEach((e) => {
                repairs.push({ stage: 'gate-1-intent', message: `[auto-repair] ${e}` });
            });
            intent = repairIntent(intent, intentValidation.errors);
            console.log('   🔧 Intent repaired');
        }

        if (intent.assumptions) {
            assumptions.push(...intent.assumptions);
        }

        console.log(`   ✅ Completed in ${stage1Duration}ms (${intent.entities?.length || 0} entities, ${intent.features?.length || 0} features, ${intent.roles?.length || 0} roles)`);

        // ══════════════════════════════════════════════════
        // STAGE 2: System Design
        // ══════════════════════════════════════════════════
        console.log('\n🏗️  Stage 2: System Design...');
        const stage2Start = Date.now();

        let design;
        try {
            design = await designSystem(intent);
        } catch (err) {
            err.stage = 'design';
            throw err;
        }

        const stage2Duration = Date.now() - stage2Start;
        stages.push({ name: 'design', duration: stage2Duration, status: 'completed' });

        // ── Gate 2: Validate & Repair Design ──
        const designValidation = validateDesign(design, intent);
        if (!designValidation.valid) {
            console.log(`   ⚠️  Design has ${designValidation.errors.length} issues, repairing...`);
            designValidation.errors.forEach((e) => {
                repairs.push({ stage: 'gate-2-design', message: `[auto-repair] ${e}` });
            });
            design = repairDesign(design, designValidation.errors, intent);
            console.log('   🔧 Design repaired');
        }

        console.log(`   ✅ Completed in ${stage2Duration}ms (${design.pages?.length || 0} pages, ${design.entityRelationships?.length || 0} relationships)`);

        // ══════════════════════════════════════════════════
        // STAGE 3: Schema Generation (4 sequential LLM calls)
        // ══════════════════════════════════════════════════
        console.log('\n⚙️  Stage 3: Schema Generation...');
        const stage3Start = Date.now();

        let schemas;
        try {
            schemas = await generateSchemas(intent, design);
        } catch (err) {
            err.stage = 'schema';
            throw err;
        }

        const stage3Duration = Date.now() - stage3Start;
        stages.push({ name: 'schema', duration: stage3Duration, status: 'completed' });

        // ── Gate 3: Validate Schema Structure ──
        const schemaIssues = validateSchemas(schemas);
        if (schemaIssues.length > 0) {
            console.log(`   ⚠️  Schemas have ${schemaIssues.length} structural issues, repairing...`);
            schemaIssues.forEach((issue) => {
                repairs.push({ stage: 'gate-3-schema', message: `[auto-repair] ${issue}` });
            });
            schemas = repairSchemaStructure(schemas);
            console.log('   🔧 Schema structure repaired');
        }

        console.log(`   ✅ Completed in ${stage3Duration}ms`);

        // ══════════════════════════════════════════════════
        // STAGE 4: Cross-Layer Validation & Refinement
        // ══════════════════════════════════════════════════
        console.log('\n🔧 Stage 4: Validation & Refinement...');
        const stage4Start = Date.now();

        let refined;
        try {
            refined = await refineAndValidate(schemas, intent, design);
        } catch (err) {
            err.stage = 'refine';
            throw err;
        }

        const stage4Duration = Date.now() - stage4Start;
        stages.push({ name: 'refine', duration: stage4Duration, status: 'completed' });

        if (refined.repairs) {
            repairs.push(...refined.repairs);
        }

        console.log(`   ✅ Completed in ${stage4Duration}ms (${refined.repairs?.length || 0} repairs, ${refined.issues?.length || 0} issues found)`);

        // ══════════════════════════════════════════════════
        // RENDER: Config → Working HTML Application
        // ══════════════════════════════════════════════════
        console.log('\n🎨 Rendering application...');
        const html = renderApp(refined.result, intent, design);

        const totalDuration = Date.now() - startTime;
        console.log(`\n✨ Pipeline complete in ${totalDuration}ms`);
        console.log(`   Tokens: ${tokenTracker.totalTokens}, Cost: $${tokenTracker.estimatedCost.toFixed(4)}`);
        console.log(`   LLM calls: ${tokenTracker.totalRequests}, Repairs: ${repairs.length}`);

        return {
            success: true,
            result: refined.result,
            html,
            stages,
            repairs,
            assumptions,
            intent,  // Expose intermediate results for inspection
            design,
            metrics: {
                totalDuration,
                totalTokens: tokenTracker.totalTokens,
                promptTokens: tokenTracker.totalPromptTokens,
                completionTokens: tokenTracker.totalCompletionTokens,
                estimatedCost: tokenTracker.estimatedCost,
                repairCount: repairs.length,
                llmCalls: tokenTracker.totalRequests,
                stageTimings: stages.reduce((acc, s) => { acc[s.name] = s.duration; return acc; }, {}),
            },
        };
    } catch (err) {
        const totalDuration = Date.now() - startTime;
        const failedStage = err.stage || 'unknown';
        console.error(`\n❌ Pipeline failed at stage: ${failedStage}`);
        console.error(`   Error: ${err.message}`);

        // Mark the failed stage
        stages.push({ name: failedStage, status: 'error', error: err.message });

        return {
            success: false,
            error: err.message,
            stage: failedStage,
            stages,
            repairs,
            assumptions,
            metrics: {
                totalDuration,
                totalTokens: tokenTracker.totalTokens,
                estimatedCost: tokenTracker.estimatedCost,
                repairCount: repairs.length,
                llmCalls: tokenTracker.totalRequests,
            },
        };
    }
}

// ══════════════════════════════════════════════════
// Validation Gates — Inter-Stage Quality Control
// ══════════════════════════════════════════════════

/**
 * Gate 3: Validate schema structure before cross-layer refinement.
 * Returns list of issues found.
 */
function validateSchemas(schemas) {
    const issues = [];

    if (!schemas.ui || typeof schemas.ui !== 'object') {
        issues.push('UI schema missing or invalid');
    } else if (!Array.isArray(schemas.ui.pages)) {
        issues.push('UI schema missing pages array');
    }

    if (!schemas.api || typeof schemas.api !== 'object') {
        issues.push('API schema missing or invalid');
    } else if (!Array.isArray(schemas.api.endpoints)) {
        issues.push('API schema missing endpoints array');
    }

    if (!schemas.db || typeof schemas.db !== 'object') {
        issues.push('DB schema missing or invalid');
    } else if (!Array.isArray(schemas.db.tables)) {
        issues.push('DB schema missing tables array');
    }

    if (!schemas.auth || typeof schemas.auth !== 'object') {
        issues.push('Auth schema missing or invalid');
    } else if (!Array.isArray(schemas.auth.roles)) {
        issues.push('Auth schema missing roles array');
    }

    return issues;
}

/**
 * Repair schema structure by ensuring minimum viable objects.
 */
function repairSchemaStructure(schemas) {
    if (!schemas.ui || typeof schemas.ui !== 'object') schemas.ui = {};
    if (!Array.isArray(schemas.ui.pages)) schemas.ui.pages = [];

    if (!schemas.api || typeof schemas.api !== 'object') schemas.api = {};
    if (!Array.isArray(schemas.api.endpoints)) schemas.api.endpoints = [];

    if (!schemas.db || typeof schemas.db !== 'object') schemas.db = {};
    if (!Array.isArray(schemas.db.tables)) schemas.db.tables = [];

    if (!schemas.auth || typeof schemas.auth !== 'object') schemas.auth = {};
    if (!Array.isArray(schemas.auth.roles)) {
        schemas.auth.roles = [{ name: 'user', level: 1, description: 'Default user' }];
    }

    return schemas;
}

/**
 * Create a compact summary of existing config for modification context.
 */
function summarizeExistingConfig(config) {
    const parts = [];

    if (config.ui?.pages) {
        parts.push(`Pages: ${config.ui.pages.map(p => `${p.name} (${p.path})`).join(', ')}`);
    }
    if (config.api?.endpoints) {
        parts.push(`API Endpoints: ${config.api.endpoints.map(e => `${e.method} ${e.path}`).join(', ')}`);
    }
    if (config.db?.tables) {
        parts.push(`DB Tables: ${config.db.tables.map(t => {
            const cols = (t.columns || []).map(c => c.name).join(', ');
            return `${t.name} [${cols}]`;
        }).join('; ')}`);
    }
    if (config.auth?.roles) {
        parts.push(`Roles: ${config.auth.roles.map(r => r.name).join(', ')}`);
    }

    return parts.join('\n');
}

module.exports = { runPipeline };
