// =====================================================
// NL App Compiler — Express Server
// =====================================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const compression = require('compression');
const { runPipeline } = require('./pipeline/index');
const { runEvaluation } = require('../evaluation/runner');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// --- Health Check ---
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        hasApiKey: !!process.env.GEMINI_API_KEY,
        timestamp: new Date().toISOString(),
    });
});

// --- Main Generate Endpoint ---
app.post('/api/generate', async (req, res) => {
    const { prompt, additionalContext } = req.body;

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
        return res.status(400).json({ error: 'Prompt is required' });
    }

    if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({
            error: 'GEMINI_API_KEY not configured. Please add it to your .env file.',
        });
    }

    try {
        const result = await runPipeline(prompt.trim(), { additionalContext });
        res.json(result);
    } catch (err) {
        console.error('Pipeline error:', err);
        res.status(500).json({
            error: err.message || 'Pipeline failed',
            stage: err.stage || 'unknown',
        });
    }
});

// --- Modify Existing Config Endpoint ---
app.post('/api/modify', async (req, res) => {
    const { prompt, existingConfig, originalPrompt } = req.body;

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
        return res.status(400).json({ error: 'Modification prompt is required' });
    }

    if (!existingConfig) {
        return res.status(400).json({ error: 'Existing config is required for modification' });
    }

    if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({
            error: 'GEMINI_API_KEY not configured.',
        });
    }

    try {
        const result = await runPipeline(prompt.trim(), {
            modifyMode: true,
            existingConfig,
            originalPrompt,
        });
        res.json(result);
    } catch (err) {
        console.error('Modify error:', err);
        res.status(500).json({
            error: err.message || 'Modification failed',
            stage: err.stage || 'unknown',
        });
    }
});

// --- Evaluation Endpoint (streaming) ---
app.post('/api/evaluate', async (req, res) => {
    if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({
            error: 'GEMINI_API_KEY not configured.',
        });
    }

    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');

    try {
        await runEvaluation((event) => {
            res.write(JSON.stringify(event) + '\n');
        });
        res.end();
    } catch (err) {
        console.error('Evaluation error:', err);
        res.write(JSON.stringify({ type: 'error', message: err.message }) + '\n');
        res.end();
    }
});

// --- SPA Fallback ---
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// --- Start Server ---
app.listen(PORT, () => {
    console.log(`\n  ╔══════════════════════════════════════════╗`);
    console.log(`  ║   NL App Compiler — Server Running       ║`);
    console.log(`  ║   http://localhost:${PORT}                   ║`);
    console.log(`  ║   API Key: ${process.env.GEMINI_API_KEY ? '✅ Configured' : '❌ Missing'}              ║`);
    console.log(`  ╚══════════════════════════════════════════╝\n`);
});

module.exports = app;
