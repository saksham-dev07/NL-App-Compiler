// =====================================================
// NL App Compiler — Stage 3: Schema Generation
// =====================================================

const { callGemini } = require('../llm/client');
const {
    UI_SCHEMA_PROMPT,
    API_SCHEMA_PROMPT,
    DB_SCHEMA_PROMPT,
    AUTH_SCHEMA_PROMPT,
} = require('../llm/prompts');

/**
 * Generate all four schemas (UI, API, DB, Auth) from intent and design.
 * Each sub-schema is generated in a separate LLM call for precision.
 * @param {object} intent - From Stage 1
 * @param {object} design - From Stage 2
 * @returns {Promise<object>} Combined schemas { ui, api, db, auth }
 */
async function generateSchemas(intent, design) {
    const context = `
Intent:
${JSON.stringify(intent, null, 2)}

System Design:
${JSON.stringify(design, null, 2)}
`;

    // Generate all 4 schemas in parallel (15 RPM on gemini-3.1-flash-lite allows this)
    const [db, auth, api, ui] = await Promise.all([
        generateDBSchema(context),
        generateAuthSchema(context),
        generateAPISchema(context),
        generateUISchema(context),
    ]);

    return { ui, api, db, auth };
}

async function generateUISchema(context) {
    console.log('   📐 Generating UI schema...');
    const result = await callGemini(UI_SCHEMA_PROMPT, context, { temperature: 0.1 });
    console.log(`   ✅ UI schema: ${result.pages?.length || 0} pages`);
    return result;
}

async function generateAPISchema(context) {
    console.log('   🔌 Generating API schema...');
    const result = await callGemini(API_SCHEMA_PROMPT, context, { temperature: 0.1 });
    console.log(`   ✅ API schema: ${result.endpoints?.length || 0} endpoints`);
    return result;
}

async function generateDBSchema(context) {
    console.log('   🗄️  Generating DB schema...');
    const result = await callGemini(DB_SCHEMA_PROMPT, context, { temperature: 0.1 });
    console.log(`   ✅ DB schema: ${result.tables?.length || 0} tables`);
    return result;
}

async function generateAuthSchema(context) {
    console.log('   🔒 Generating Auth schema...');
    const result = await callGemini(AUTH_SCHEMA_PROMPT, context, { temperature: 0.1 });
    console.log(`   ✅ Auth schema: ${result.roles?.length || 0} roles`);
    return result;
}

module.exports = { generateSchemas };
