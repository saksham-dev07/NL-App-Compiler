// =====================================================
// NL App Compiler — Frontend Logic
// =====================================================

(function () {
    'use strict';

    // --- State ---
    const state = {
        isCompiling: false,
        currentConfig: null,
        originalPrompt: null,
        lastResult: null,
        history: JSON.parse(localStorage.getItem('nlc_history') || '[]'),
        schemas: { ui: null, api: null, db: null, auth: null, full: null },
    };

    // --- DOM Elements ---
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    const els = {
        promptInput: $('#prompt-input'),
        charCount: $('#char-count'),
        btnCompile: $('#btn-compile'),
        btnNewSession: $('#btn-new-session'),
        btnHistory: $('#btn-history'),
        btnEvaluate: $('#btn-evaluate'),
        pipelineSection: $('#pipeline-section'),
        repairLog: $('#repair-log'),
        repairLogEntries: $('#repair-log-entries'),
        assumptionsLog: $('#assumptions-log'),
        assumptionsEntries: $('#assumptions-entries'),
        clarificationSection: $('#clarification-section'),
        clarificationQuestions: $('#clarification-questions'),
        clarificationInput: $('#clarification-input'),
        btnClarify: $('#btn-clarify'),
        metricsSummary: $('#metrics-summary'),
        previewContainer: $('#preview-container'),
        previewFrame: $('#preview-frame'),
        toastContainer: $('#toast-container'),
        evalModal: $('#eval-modal'),
        historyModal: $('#history-modal'),
        historyList: $('#history-list'),
    };

    // --- Initialization ---
    function init() {
        setupEventListeners();
        renderHistory();
    }

    // --- Utility: Debounce ---
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // --- Event Listeners ---
    function setupEventListeners() {
        // Prompt input with debouncing
        const debouncedInput = debounce(onPromptInput, 150);
        els.promptInput.addEventListener('input', debouncedInput);
        els.promptInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                compile();
            }
        });

        // Compile button
        els.btnCompile.addEventListener('click', compile);

        // Event Delegation for dynamic/repeated elements (Chips, Tabs, Copies, Modals)
        document.body.addEventListener('click', (e) => {
            // Example chips
            const chip = e.target.closest('.example-chip');
            if (chip) {
                els.promptInput.value = chip.dataset.prompt;
                onPromptInput();
                els.promptInput.focus();
                return;
            }

            // Output tabs
            const tab = e.target.closest('.output-tab');
            if (tab) {
                switchTab(tab.dataset.tab);
                return;
            }

            // Copy buttons
            const copyBtn = e.target.closest('.btn-copy');
            if (copyBtn) {
                copySchema(copyBtn.dataset.target, copyBtn);
                return;
            }
            
            // Modal backdrop close
            const backdrop = e.target.closest('.modal-backdrop');
            if (backdrop) {
                $$('.modal').forEach((m) => m.classList.add('hidden'));
                return;
            }
        });

        // Header buttons
        els.btnNewSession.addEventListener('click', resetSession);
        els.btnHistory.addEventListener('click', () => toggleModal('history-modal'));
        els.btnEvaluate.addEventListener('click', () => toggleModal('eval-modal'));

        // Modal close buttons
        $('#btn-close-modal')?.addEventListener('click', () => toggleModal('eval-modal', false));
        $('#btn-close-history')?.addEventListener('click', () => toggleModal('history-modal', false));

        // Evaluation
        $('#btn-run-eval')?.addEventListener('click', runEvaluation);

        // Clarification
        els.btnClarify?.addEventListener('click', submitClarification);
    }

    // --- Prompt Input ---
    function onPromptInput() {
        const len = els.promptInput.value.trim().length;
        els.charCount.textContent = els.promptInput.value.length;
        els.btnCompile.disabled = len === 0;
    }

    // --- Compile ---
    async function compile() {
        const prompt = els.promptInput.value.trim();
        if (!prompt || state.isCompiling) return;

        state.isCompiling = true;
        els.btnCompile.classList.add('compiling');
        els.btnCompile.querySelector('.btn-compile-text').textContent = 'Compiling';

        // Show pipeline
        els.pipelineSection.classList.remove('hidden');
        els.clarificationSection.classList.add('hidden');
        els.repairLog.classList.add('hidden');
        els.assumptionsLog.classList.add('hidden');
        els.metricsSummary.classList.add('hidden');
        resetPipelineUI();

        const startTime = Date.now();

        try {
            // Use SSE for real-time pipeline updates
            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt }),
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || `HTTP ${response.status}`);
            }

            const data = await response.json();

            if (data.needsClarification) {
                showClarification(data.questions, prompt);
                return;
            }

            if (data.error) {
                throw new Error(data.error);
            }

            // Handle success
            handlePipelineSuccess(data, prompt, startTime);

            // Show modify button
            showModifyMode();

            showToast('Compilation successful!', 'success');
        } catch (err) {
            console.error('Compile error:', err);
            showToast(`Compilation failed: ${err.message}`, 'error');
            markCurrentStageError();
        } finally {
            state.isCompiling = false;
            els.btnCompile.classList.remove('compiling');
            els.btnCompile.querySelector('.btn-compile-text').textContent = 'Compile';
        }
    }

    // --- Modify Mode ---
    function showModifyMode() {
        // Change the prompt area to show modify UI
        let modifyBar = $('#modify-bar');
        if (!modifyBar) {
            modifyBar = document.createElement('div');
            modifyBar.id = 'modify-bar';
            modifyBar.className = 'modify-bar';
            modifyBar.innerHTML = `
                <div class="modify-badge">✅ App Generated</div>
                <p class="modify-hint">Modify your app by typing changes below and clicking <strong>Modify</strong></p>
                <button id="btn-modify" class="btn-compile" style="background: linear-gradient(135deg, #f59e0b, #d97706); min-width: 120px;">
                    <span class="btn-compile-text">🔄 Modify</span>
                </button>
            `;
            els.btnCompile.parentElement.after(modifyBar);

            document.getElementById('btn-modify').addEventListener('click', modifyApp);
        }
        modifyBar.classList.remove('hidden');

        // Update prompt placeholder
        els.promptInput.placeholder = 'Describe your modification... (e.g., "Add a notifications page" or "Change the admin role to have read-only access")';
    }

    function hideModifyMode() {
        const modifyBar = $('#modify-bar');
        if (modifyBar) modifyBar.classList.add('hidden');
        els.promptInput.placeholder = 'Describe the application you want to build...';
    }

    async function modifyApp() {
        const modification = els.promptInput.value.trim();
        if (!modification || state.isCompiling) return;
        if (!state.lastResult?.result) {
            showToast('No existing app to modify. Compile first.', 'error');
            return;
        }

        state.isCompiling = true;
        const modifyBtn = $('#btn-modify');
        modifyBtn.querySelector('.btn-compile-text').textContent = '🔄 Modifying...';
        modifyBtn.disabled = true;

        // Show pipeline
        els.pipelineSection.classList.remove('hidden');
        els.repairLog.classList.add('hidden');
        els.assumptionsLog.classList.add('hidden');
        resetPipelineUI();

        const startTime = Date.now();

        try {
            const response = await fetch('/api/modify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: modification,
                    existingConfig: state.lastResult.result,
                    originalPrompt: state.originalPrompt,
                }),
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || `HTTP ${response.status}`);
            }

            const data = await response.json();

            if (data.error) throw new Error(data.error);

            state.originalPrompt = `${state.originalPrompt}\n\nModification: ${modification}`;
            handlePipelineSuccess(data, `[MODIFY] ${modification}`, startTime);

            showToast('App modified successfully!', 'success');
        } catch (err) {
            console.error('Modify error:', err);
            showToast(`Modification failed: ${err.message}`, 'error');
            markCurrentStageError();
        } finally {
            state.isCompiling = false;
            modifyBtn.querySelector('.btn-compile-text').textContent = '🔄 Modify';
            modifyBtn.disabled = false;
        }
    }

    // --- Helper: Shared Pipeline Success Logic ---
    function handlePipelineSuccess(data, prompt, startTime) {
        // Success — populate schemas
        state.currentConfig = data;
        if (!state.originalPrompt) state.originalPrompt = prompt;
        state.lastResult = data;
        state.schemas = {
            ui: data.result?.ui || {},
            api: data.result?.api || {},
            db: data.result?.db || {},
            auth: data.result?.auth || {},
            full: data.result || {},
        };

        // Update pipeline stages to completed
        updateAllStagesCompleted(data.stages || []);

        // Show repairs if any
        if (data.repairs && data.repairs.length > 0) {
            showRepairLog(data.repairs);
        }

        // Show assumptions if any
        if (data.assumptions && data.assumptions.length > 0) {
            showAssumptions(data.assumptions);
        }

        // Render schemas in tabs
        renderSchemas();

        // Render preview
        if (data.html) {
            renderPreview(data.html);
        }

        // Show metrics
        const elapsed = Date.now() - startTime;
        showMetrics({
            latency: elapsed,
            tokens: data.metrics?.totalTokens || 0,
            repairs: data.metrics?.repairCount || 0,
            cost: data.metrics?.estimatedCost || 0,
        });

        // Save to history
        saveToHistory(prompt, data);
    }

    // --- Pipeline UI ---
    function resetPipelineUI() {
        $$('.pipeline-stage').forEach((stage) => {
            stage.classList.remove('active', 'completed', 'error');
            stage.querySelector('.status-badge').textContent = 'Waiting';
            stage.querySelector('.stage-time').textContent = '';
        });
    }

    function updateStage(stageName, status, time) {
        const stageEl = $(`.pipeline-stage[data-stage="${stageName}"]`);
        if (!stageEl) return;

        stageEl.classList.remove('active', 'completed', 'error');
        stageEl.classList.add(status);

        const badge = stageEl.querySelector('.status-badge');
        const timeEl = stageEl.querySelector('.stage-time');

        switch (status) {
            case 'active':
                badge.textContent = 'Processing';
                break;
            case 'completed':
                badge.textContent = 'Completed';
                if (time) timeEl.textContent = `${time}ms`;
                break;
            case 'error':
                badge.textContent = 'Error';
                break;
        }
    }

    function updateAllStagesCompleted(stages) {
        const stageNames = ['intent', 'design', 'schema', 'refine'];
        stageNames.forEach((name, i) => {
            const stageData = stages[i];
            const time = stageData?.duration || null;
            setTimeout(() => {
                updateStage(name, 'completed', time);
            }, i * 200);
        });
    }

    function markCurrentStageError() {
        const stageNames = ['intent', 'design', 'schema', 'refine'];
        // Find first non-completed stage and mark as error
        for (const name of stageNames) {
            const el = $(`.pipeline-stage[data-stage="${name}"]`);
            if (el && !el.classList.contains('completed')) {
                updateStage(name, 'error');
                break;
            }
        }
    }

    // --- SSE Pipeline Progress (alternative for real-time) ---
    async function compileWithSSE(prompt) {
        return new Promise((resolve, reject) => {
            const eventSource = new EventSource(`/api/generate/stream?prompt=${encodeURIComponent(prompt)}`);
            let result = null;

            eventSource.addEventListener('stage', (e) => {
                const data = JSON.parse(e.data);
                updateStage(data.stage, data.status, data.duration);
            });

            eventSource.addEventListener('repair', (e) => {
                const data = JSON.parse(e.data);
                showRepairLog([data]);
            });

            eventSource.addEventListener('complete', (e) => {
                result = JSON.parse(e.data);
                eventSource.close();
                resolve(result);
            });

            eventSource.addEventListener('error', (e) => {
                eventSource.close();
                reject(new Error('Pipeline stream error'));
            });
        });
    }

    // --- Schema Rendering ---
    function renderSchemas() {
        Object.keys(state.schemas).forEach((key) => {
            const el = $(`#schema-${key}`);
            if (el && state.schemas[key]) {
                el.innerHTML = syntaxHighlight(JSON.stringify(state.schemas[key], null, 2));
            }
        });
    }

    function syntaxHighlight(json) {
        if (!json) return '';
        json = json
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        return json.replace(
            /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
            function (match) {
                let cls = 'json-number';
                if (/^"/.test(match)) {
                    if (/:$/.test(match)) {
                        cls = 'json-key';
                    } else {
                        cls = 'json-string';
                    }
                } else if (/true|false/.test(match)) {
                    cls = 'json-boolean';
                } else if (/null/.test(match)) {
                    cls = 'json-null';
                }
                return `<span class="${cls}">${match}</span>`;
            }
        );
    }

    // --- Preview ---
    function renderPreview(html) {
        const frame = els.previewFrame;
        const emptyEl = els.previewContainer.querySelector('.preview-empty');
        if (emptyEl) emptyEl.classList.add('hidden');
        frame.classList.remove('hidden');

        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        frame.src = url;

        // Cleanup old blob URLs
        frame.addEventListener('load', () => URL.revokeObjectURL(url), { once: true });
    }

    // --- Tabs ---
    function switchTab(tabName) {
        $$('.output-tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === tabName));
        $$('.tab-panel').forEach((p) => p.classList.toggle('active', p.id === `tab-${tabName}`));
    }

    // --- Copy ---
    async function copySchema(target, btn) {
        const schema = state.schemas[target];
        if (!schema) return;

        try {
            await navigator.clipboard.writeText(JSON.stringify(schema, null, 2));
            btn.classList.add('copied');
            const originalHTML = btn.innerHTML;
            btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 7.5L5.5 10.5L11.5 3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg> Copied!`;
            setTimeout(() => {
                btn.classList.remove('copied');
                btn.innerHTML = originalHTML;
            }, 2000);
        } catch (err) {
            showToast('Failed to copy', 'error');
        }
    }

    // --- Repair Log ---
    function showRepairLog(repairs) {
        els.repairLog.classList.remove('hidden');
        repairs.forEach((r) => {
            const entry = document.createElement('div');
            entry.className = 'repair-entry';
            entry.textContent = `[${r.stage || 'unknown'}] ${r.message || r}`;
            els.repairLogEntries.appendChild(entry);
        });
    }

    // --- Assumptions ---
    function showAssumptions(assumptions) {
        els.assumptionsLog.classList.remove('hidden');
        assumptions.forEach((a) => {
            const entry = document.createElement('div');
            entry.className = 'assumption-entry';
            entry.textContent = typeof a === 'string' ? a : a.message;
            els.assumptionsEntries.appendChild(entry);
        });
    }

    // --- Clarification ---
    function showClarification(questions, originalPrompt) {
        els.clarificationSection.classList.remove('hidden');
        els.clarificationQuestions.innerHTML = '';

        questions.forEach((q, i) => {
            const div = document.createElement('div');
            div.className = 'clarification-question';
            div.innerHTML = `<strong>Q${i + 1}:</strong> ${q}`;
            els.clarificationQuestions.appendChild(div);
        });

        els.clarificationInput.dataset.originalPrompt = originalPrompt;
        state.isCompiling = false;
        els.btnCompile.classList.remove('compiling');
        els.btnCompile.querySelector('.btn-compile-text').textContent = 'Compile';
    }

    async function submitClarification() {
        const additional = els.clarificationInput.value.trim();
        const original = els.clarificationInput.dataset.originalPrompt;
        if (!additional) return;

        els.promptInput.value = `${original}\n\nAdditional details: ${additional}`;
        els.clarificationSection.classList.add('hidden');
        onPromptInput();
        compile();
    }

    // --- Metrics ---
    function showMetrics({ latency, tokens, repairs, cost }) {
        els.metricsSummary.classList.remove('hidden');
        $('#metric-latency').textContent = latency > 1000 ? `${(latency / 1000).toFixed(1)}s` : `${latency}ms`;
        $('#metric-tokens').textContent = tokens.toLocaleString();
        $('#metric-repairs').textContent = repairs;
        $('#metric-cost').textContent = `$${cost.toFixed(4)}`;
    }

    // --- Toast ---
    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        const icons = { success: '✅', error: '❌', info: 'ℹ️' };
        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || icons.info}</span>
            <span>${message}</span>
        `;

        els.toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('removing');
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    // --- Modal ---
    function toggleModal(id, show) {
        const modal = $(`#${id}`);
        if (!modal) return;

        if (typeof show === 'undefined') {
            modal.classList.toggle('hidden');
        } else {
            modal.classList.toggle('hidden', !show);
        }
    }

    // --- History ---
    function saveToHistory(prompt, data) {
        const entry = {
            id: Date.now(),
            prompt,
            timestamp: new Date().toISOString(),
            success: !data.error,
            metrics: data.metrics || {},
            schemas: state.schemas || null,
            html: data.html || null
        };
        state.history.unshift(entry);
        if (state.history.length > 10) state.history.pop(); // Limit to 10 to avoid 5MB localStorage limit
        
        try {
            localStorage.setItem('nlc_history', JSON.stringify(state.history));
        } catch (e) {
            console.warn('History storage full, trimming');
            state.history.pop();
            localStorage.setItem('nlc_history', JSON.stringify(state.history));
        }
        renderHistory();
    }

    function renderHistory() {
        if (!els.historyList) return;
        if (state.history.length === 0) {
            els.historyList.innerHTML = '<p class="history-empty">No generations yet</p>';
            return;
        }

        els.historyList.innerHTML = state.history
            .map(
                (h) => `
            <div class="history-item" data-id="${h.id}">
                <span class="history-item-prompt">${h.prompt}</span>
                <span class="history-item-time">${new Date(h.timestamp).toLocaleString()}</span>
            </div>
        `
            )
            .join('');

        els.historyList.querySelectorAll('.history-item').forEach((item) => {
            item.addEventListener('click', () => {
                const id = Number(item.dataset.id);
                const h = state.history.find(x => x.id === id);
                if (h) {
                    els.promptInput.value = h.prompt;
                    onPromptInput();
                    
                    if (h.schemas) {
                        state.schemas = h.schemas;
                        renderSchemas();
                        if (h.html) renderPreview(h.html);
                        els.pipelineSection.classList.remove('hidden');
                        updateAllStagesCompleted([{duration:0},{duration:0},{duration:0},{duration:0}]);
                        switchTab('preview');
                    }
                }
                toggleModal('history-modal', false);
                els.promptInput.focus();
            });
        });
    }

    // --- Session Reset ---
    function resetSession() {
        if (!confirm('Are you sure you want to start a new session? This will clear your current progress.')) return;
        
        els.promptInput.value = '';
        onPromptInput();
        els.pipelineSection.classList.add('hidden');
        els.clarificationSection.classList.add('hidden');
        els.repairLog.classList.add('hidden');
        els.assumptionsLog.classList.add('hidden');
        els.metricsSummary.classList.add('hidden');
        els.repairLogEntries.innerHTML = '';
        els.assumptionsEntries.innerHTML = '';
        resetPipelineUI();

        // Reset preview
        els.previewFrame.classList.add('hidden');
        els.previewFrame.src = 'about:blank';
        const emptyEl = els.previewContainer.querySelector('.preview-empty');
        if (emptyEl) emptyEl.classList.remove('hidden');

        // Reset schemas
        state.schemas = { ui: null, api: null, db: null, auth: null, full: null };
        state.currentConfig = null;
        state.originalPrompt = null;
        state.lastResult = null;
        ['ui', 'api', 'db', 'auth', 'full'].forEach((key) => {
            const el = $(`#schema-${key}`);
            if (el) el.innerHTML = `<code>// ${key.toUpperCase()} schema will appear here after compilation</code>`;
        });

        // Hide modify mode
        hideModifyMode();

        switchTab('preview');
        showToast('Session reset', 'info');
    }

    // --- Evaluation ---
    async function runEvaluation() {
        const btn = $('#btn-run-eval');
        btn.disabled = true;
        btn.querySelector('.btn-compile-text').textContent = 'Running...';

        const resultsEl = $('#eval-results');
        const progressFill = $('#eval-progress-fill');
        const progressText = $('#eval-progress-text');

        resultsEl.innerHTML = '';

        try {
            const response = await fetch('/api/evaluate', { method: 'POST' });
            if (!response.ok) throw new Error('Evaluation failed');

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const data = JSON.parse(line);
                        if (data.type === 'progress') {
                            const pct = ((data.current / data.total) * 100).toFixed(0);
                            progressFill.style.width = `${pct}%`;
                            progressText.textContent = `Running ${data.current}/${data.total}: ${data.promptName}`;
                        } else if (data.type === 'result') {
                            const item = document.createElement('div');
                            item.className = 'eval-result-item';
                            item.innerHTML = `
                                <div class="eval-result-status ${data.success ? 'success' : 'failure'}"></div>
                                <span class="eval-result-name">${data.name}</span>
                                <span class="eval-result-time">${data.duration}ms</span>
                            `;
                            resultsEl.appendChild(item);
                        } else if (data.type === 'summary') {
                            progressText.textContent = `Complete: ${data.successCount}/${data.total} passed (${data.successRate}%)`;
                        }
                    } catch (e) {
                        // skip unparseable lines
                    }
                }
            }
        } catch (err) {
            showToast(`Evaluation error: ${err.message}`, 'error');
        } finally {
            btn.disabled = false;
            btn.querySelector('.btn-compile-text').textContent = 'Run Evaluation';
        }
    }

    // --- Start ---
    document.addEventListener('DOMContentLoaded', init);
})();
