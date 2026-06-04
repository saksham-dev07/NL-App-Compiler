// =====================================================
// NL App Compiler — Evaluation Runner
// =====================================================

const path = require('path');
const { runPipeline } = require('../server/pipeline/index');
const { collectMetrics, generateReport } = require('./metrics');

// Load prompts
const promptsPath = path.join(__dirname, 'prompts.json');

/**
 * Run the full evaluation suite.
 * @param {function} onProgress - Callback for progress events
 */
async function runEvaluation(onProgress) {
    // Load fresh prompts data each time
    delete require.cache[require.resolve(promptsPath)];
    const prompts = require(promptsPath);

    const allPrompts = [
        ...prompts.realPrompts.map((p) => ({ ...p, category: 'real' })),
        ...prompts.edgeCases.map((p) => ({ ...p, category: 'edge' })),
    ];

    const total = allPrompts.length;
    const results = [];
    let successCount = 0;

    // Ensure GEMINI_API_KEY is set
    if (!process.env.GEMINI_API_KEY) {
        require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
    }

    for (let i = 0; i < allPrompts.length; i++) {
        const testPrompt = allPrompts[i];

        // Emit progress
        if (onProgress) {
            onProgress({
                type: 'progress',
                current: i + 1,
                total,
                promptName: testPrompt.name,
                promptId: testPrompt.id,
            });
        }

        const startTime = Date.now();
        let result;

        try {
            const pipelineResult = await runPipeline(testPrompt.prompt);
            const duration = Date.now() - startTime;

            const isSuccess = evaluateResult(pipelineResult, testPrompt);

            result = {
                id: testPrompt.id,
                name: testPrompt.name,
                category: testPrompt.category,
                prompt: testPrompt.prompt,
                success: isSuccess,
                duration,
                metrics: pipelineResult.metrics || {},
                repairs: pipelineResult.repairs?.length || 0,
                assumptions: pipelineResult.assumptions?.length || 0,
                needsClarification: pipelineResult.needsClarification || false,
                error: pipelineResult.error || null,
            };

            if (isSuccess) successCount++;
        } catch (err) {
            const duration = Date.now() - startTime;
            result = {
                id: testPrompt.id,
                name: testPrompt.name,
                category: testPrompt.category,
                prompt: testPrompt.prompt,
                success: false,
                duration,
                error: err.message,
            };
        }

        results.push(result);

        // Emit result
        if (onProgress) {
            onProgress({
                type: 'result',
                ...result,
            });
        }

        // Rate limiting: wait between prompts to avoid API throttling
        if (i < allPrompts.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
        }
    }

    // Generate summary
    const summary = generateReport(results);

    if (onProgress) {
        onProgress({
            type: 'summary',
            ...summary,
            successCount,
            total,
            successRate: ((successCount / total) * 100).toFixed(1),
        });
    }

    return { results, summary };
}

/**
 * Evaluate whether a pipeline result is successful.
 */
function evaluateResult(result, testPrompt) {
    // Clarification is acceptable for edge cases
    if (result.needsClarification) {
        return testPrompt.category === 'edge';
    }

    // Must have a result
    if (!result.result && !result.success) return false;

    // Check for required schemas
    if (result.result) {
        const { ui, api, db, auth } = result.result;

        // Must have at least some data in each layer
        if (!ui || !api || !db || !auth) return false;

        // UI must have pages
        if (!ui.pages || ui.pages.length === 0) return false;

        // API must have endpoints
        if (!api.endpoints || api.endpoints.length === 0) return false;

        // DB must have tables
        if (!db.tables || db.tables.length === 0) return false;

        // Auth must have roles
        if (!auth.roles || auth.roles.length === 0) return false;
    }

    // Must have rendered HTML
    if (!result.html && result.success !== false) return false;

    // For real prompts, check expected entities
    if (testPrompt.expectedEntities && result.result?.db?.tables) {
        const tableNames = result.result.db.tables.map((t) => t.entity || t.name);
        const foundEntities = testPrompt.expectedEntities.filter((e) =>
            tableNames.some(
                (t) =>
                    t.toLowerCase().includes(e.toLowerCase()) ||
                    e.toLowerCase().includes(t.toLowerCase())
            )
        );
        // At least half the expected entities should be found
        if (foundEntities.length < testPrompt.expectedEntities.length / 2) return false;
    }

    return true;
}

module.exports = { runEvaluation };
