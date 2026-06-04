// =====================================================
// NL App Compiler — Evaluation Metrics
// =====================================================

/**
 * Collect and compute evaluation metrics.
 */
function collectMetrics(results) {
    const total = results.length;
    const successes = results.filter((r) => r.success);
    const failures = results.filter((r) => !r.success);
    const realResults = results.filter((r) => r.category === 'real');
    const edgeResults = results.filter((r) => r.category === 'edge');

    // Latency stats
    const durations = results.map((r) => r.duration).filter(Boolean);
    const avgLatency = durations.length > 0
        ? durations.reduce((a, b) => a + b, 0) / durations.length
        : 0;
    const minLatency = durations.length > 0 ? Math.min(...durations) : 0;
    const maxLatency = durations.length > 0 ? Math.max(...durations) : 0;
    const p95Latency = percentile(durations, 95);

    // Token stats
    const tokenCounts = results.map((r) => r.metrics?.totalTokens || 0);
    const totalTokens = tokenCounts.reduce((a, b) => a + b, 0);
    const avgTokens = total > 0 ? totalTokens / total : 0;

    // Cost stats
    const costs = results.map((r) => r.metrics?.estimatedCost || 0);
    const totalCost = costs.reduce((a, b) => a + b, 0);
    const avgCost = total > 0 ? totalCost / total : 0;

    // Repair stats
    const repairCounts = results.map((r) => r.repairs || 0);
    const totalRepairs = repairCounts.reduce((a, b) => a + b, 0);
    const avgRepairs = total > 0 ? totalRepairs / total : 0;

    // Failure types
    const failureTypes = {};
    failures.forEach((f) => {
        const type = f.error ? categorizeError(f.error) : 'unknown';
        failureTypes[type] = (failureTypes[type] || 0) + 1;
    });

    return {
        total,
        successCount: successes.length,
        failureCount: failures.length,
        successRate: ((successes.length / total) * 100).toFixed(1),
        realSuccessRate: realResults.length > 0
            ? ((realResults.filter((r) => r.success).length / realResults.length) * 100).toFixed(1)
            : '0.0',
        edgeSuccessRate: edgeResults.length > 0
            ? ((edgeResults.filter((r) => r.success).length / edgeResults.length) * 100).toFixed(1)
            : '0.0',
        latency: {
            avg: Math.round(avgLatency),
            min: minLatency,
            max: maxLatency,
            p95: p95Latency,
        },
        tokens: {
            total: totalTokens,
            avg: Math.round(avgTokens),
        },
        cost: {
            total: totalCost.toFixed(4),
            avg: avgCost.toFixed(4),
        },
        repairs: {
            total: totalRepairs,
            avg: avgRepairs.toFixed(1),
        },
        failureTypes,
    };
}

/**
 * Generate a summary report.
 */
function generateReport(results) {
    const metrics = collectMetrics(results);

    console.log('\n' + '='.repeat(60));
    console.log('  EVALUATION REPORT');
    console.log('='.repeat(60));
    console.log(`  Total Tests:      ${metrics.total}`);
    console.log(`  Success Rate:     ${metrics.successRate}%`);
    console.log(`  Real Prompts:     ${metrics.realSuccessRate}%`);
    console.log(`  Edge Cases:       ${metrics.edgeSuccessRate}%`);
    console.log('');
    console.log(`  Avg Latency:      ${metrics.latency.avg}ms`);
    console.log(`  P95 Latency:      ${metrics.latency.p95}ms`);
    console.log(`  Total Tokens:     ${metrics.tokens.total.toLocaleString()}`);
    console.log(`  Total Cost:       $${metrics.cost.total}`);
    console.log(`  Avg Repairs:      ${metrics.repairs.avg}/request`);
    console.log('');

    if (Object.keys(metrics.failureTypes).length > 0) {
        console.log('  Failure Types:');
        for (const [type, count] of Object.entries(metrics.failureTypes)) {
            console.log(`    - ${type}: ${count}`);
        }
    }

    console.log('='.repeat(60));

    // Per-prompt breakdown
    console.log('\n  Per-Prompt Results:');
    results.forEach((r) => {
        const icon = r.success ? '✅' : '❌';
        const duration = r.duration ? `${r.duration}ms` : 'N/A';
        console.log(`  ${icon} [${r.category}] ${r.name.padEnd(25)} ${duration.padStart(8)}  ${r.error || ''}`);
    });

    console.log('\n' + '='.repeat(60));

    return metrics;
}

// --- Helpers ---

function percentile(arr, p) {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, idx)];
}

function categorizeError(error) {
    const lower = error.toLowerCase();
    if (lower.includes('timeout')) return 'timeout';
    if (lower.includes('rate limit') || lower.includes('429')) return 'rate_limit';
    if (lower.includes('json') || lower.includes('parse')) return 'json_parse';
    if (lower.includes('api')) return 'api_error';
    if (lower.includes('validation')) return 'validation';
    if (lower.includes('schema')) return 'schema_error';
    return 'unknown';
}

module.exports = { collectMetrics, generateReport };
