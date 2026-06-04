// =====================================================
// NL App Compiler — Failure Handler
// =====================================================

const { callGemini } = require('../llm/client');

const FAILURE_ANALYSIS_PROMPT = `You are an expert at analyzing software requirements.
Analyze the following user prompt for a software application and determine if it needs clarification.

You MUST return a JSON object with this structure:
{
  "isViable": true,
  "confidence": 0.85,
  "category": "string - one of: clear, vague, conflicting, incomplete, nonApp, tooLarge",
  "issues": ["string - list of specific issues found"],
  "assumptions": ["string - reasonable assumptions you can make"],
  "questions": ["string - clarifying questions, only if absolutely necessary"],
  "needsClarification": false
}

Decision rules:
- "clear": prompt has enough detail to build (confidence > 0.7). Set needsClarification=false
- "vague": very little detail (e.g., "make me an app"). Add assumptions to fill gaps. Set needsClarification=false if assumptions are reasonable, true only if truly impossible to proceed
- "conflicting": contradictory requirements. Try to resolve with assumptions. Only ask for clarification if truly unresolvable
- "incomplete": missing key details but enough to infer. Fill with assumptions. needsClarification=false
- "nonApp": not a software request. Set isViable=false, needsClarification=false
- "tooLarge": extremely large scope. Suggest phased approach in assumptions. needsClarification=false

IMPORTANT: Prefer making reasonable assumptions over asking for clarification.
Only set needsClarification=true when you truly cannot proceed at all.
Users hate being asked questions — they want to see results.`;

/**
 * Analyze the prompt for potential failures before starting the pipeline.
 * @param {string} prompt - User's raw prompt
 * @returns {Promise<object>} Analysis result
 */
async function handleFailures(prompt) {
    // Quick heuristic checks first (no LLM needed)
    const trimmed = prompt.trim();

    // Too short — but don't reject, make assumptions
    if (trimmed.length < 5) {
        return {
            needsClarification: true,
            questions: [
                'Your description is very brief. Could you provide more details about what kind of application you want to build?',
                'What are the main features you need?',
                'Who are the users of this application?',
            ],
            assumptions: [],
        };
    }

    // Non-app detection (very obvious cases)
    const nonAppPatterns = [
        /^(write|compose|create)\s+(me\s+)?(a\s+)?(poem|song|story|essay|joke|recipe)/i,
        /^(what|who|when|where|why|how)\s+(is|are|was|were|do|does|did)/i,
        /^(tell|explain|describe)\s+(me\s+)?/i,
    ];

    for (const pattern of nonAppPatterns) {
        if (pattern.test(trimmed)) {
            return {
                needsClarification: false,
                assumptions: [
                    'The input appears to be a non-application request. Interpreting it as a request for a simple informational web application.',
                ],
            };
        }
    }

    // For prompts with reasonable length, do LLM analysis
    if (trimmed.length < 30 || containsConflicts(trimmed)) {
        try {
            const analysis = await callGemini(FAILURE_ANALYSIS_PROMPT, trimmed, {
                temperature: 0.1,
            });

            return {
                needsClarification: analysis.needsClarification === true,
                questions: analysis.questions || [],
                assumptions: analysis.assumptions || [],
                confidence: analysis.confidence,
                category: analysis.category,
            };
        } catch (err) {
            console.warn('Failure analysis LLM call failed, proceeding anyway:', err.message);
            return {
                needsClarification: false,
                assumptions: ['Failure analysis skipped due to error. Proceeding with best effort.'],
            };
        }
    }

    // Prompt seems reasonable, proceed
    return {
        needsClarification: false,
        assumptions: [],
    };
}

/**
 * Quick heuristic to detect potentially conflicting requirements.
 */
function containsConflicts(text) {
    const lower = text.toLowerCase();
    const conflictPatterns = [
        [/public/i, /private/i, /no one can see/i],
        [/all users.*admin/i, /admin.*restricted/i],
        [/free/i, /premium.*required/i, /must pay/i],
    ];

    for (const patterns of conflictPatterns) {
        let matches = 0;
        for (const p of patterns) {
            if (p.test(lower)) matches++;
        }
        if (matches >= 2) return true;
    }

    return false;
}

module.exports = { handleFailures };
