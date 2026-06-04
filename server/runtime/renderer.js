// =====================================================
// NL App Compiler — Runtime Renderer
// =====================================================
// Takes validated config and generates a complete standalone HTML app.

const { generateComponentHTML } = require('./components');
const { getAppShell, getPageTemplate } = require('./templates');

/**
 * Render the full application as standalone HTML.
 * @param {object} config - { ui, api, db, auth }
 * @param {object} intent - Original intent
 * @param {object} design - System design
 * @returns {string} Complete HTML string
 */
function renderApp(config, intent, design) {
    const { ui, api, db, auth } = config;

    const appName = intent.appName || design.appName || 'MyApp';
    const theme = ui?.theme || getDefaultTheme();
    const pages = ui?.pages || [];
    const navigation = design?.navigation || [];
    const roles = auth?.roles || [];
    const entities = intent?.entities || [];

    // Generate page content
    const pageContents = pages.map((page) => {
        const sections = (page.sections || [])
            .map((section) => renderSection(section, entities, db))
            .join('\n');

        return {
            name: page.name,
            path: page.path,
            title: page.title || page.name,
            layout: page.layout,
            requiredRole: page.requiredRole,
            html: sections || getDefaultPageContent(page),
        };
    });

    // Build the app shell
    const html = getAppShell({
        appName,
        theme,
        navigation,
        pages: pageContents,
        roles,
        entities,
        apiEndpoints: api?.endpoints || [],
        dbSchema: db,
    });

    return html;
}

function renderSection(section, entities, db) {
    const components = (section.components || [])
        .map((comp) => generateComponentHTML(comp, entities, db))
        .join('\n');

    const title = section.title ? `<h2 class="section-title">${section.title}</h2>` : '';
    const cols = section.columns || 1;

    return `
    <div class="section section-cols-${cols}">
        ${title}
        <div class="section-grid cols-${cols}">
            ${components}
        </div>
    </div>`;
}

function getDefaultPageContent(page) {
    return `
    <div class="empty-page">
        <h2>${page.title || page.name}</h2>
        <p>This page is ready for content.</p>
    </div>`;
}

function getDefaultTheme() {
    return {
        primaryColor: '#6366f1',
        secondaryColor: '#8b5cf6',
        accentColor: '#ec4899',
        backgroundColor: '#0f172a',
        textColor: '#f1f5f9',
        fontFamily: 'Inter, sans-serif',
        borderRadius: '8px',
    };
}

module.exports = { renderApp };
