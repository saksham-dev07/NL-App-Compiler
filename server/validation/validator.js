// =====================================================
// NL App Compiler — Schema Validator
// =====================================================

/**
 * Validate intent structure from Stage 1.
 */
function validateIntent(intent) {
    const errors = [];

    if (!intent || typeof intent !== 'object') {
        return { valid: false, errors: ['Intent is not a valid object'] };
    }

    // Required top-level fields
    if (!intent.appName || typeof intent.appName !== 'string') {
        errors.push('Missing or invalid appName');
    }

    if (!intent.appType || typeof intent.appType !== 'string') {
        errors.push('Missing or invalid appType');
    }

    if (!Array.isArray(intent.entities) || intent.entities.length === 0) {
        errors.push('Missing or empty entities array');
    } else {
        intent.entities.forEach((entity, i) => {
            if (!entity.name) errors.push(`Entity ${i}: missing name`);
            if (!Array.isArray(entity.fields)) {
                errors.push(`Entity ${entity.name || i}: missing fields array`);
            } else {
                const hasId = entity.fields.some((f) => f.name === 'id');
                if (!hasId) errors.push(`Entity ${entity.name}: missing 'id' field`);
            }
        });
    }

    if (!Array.isArray(intent.features)) {
        errors.push('Missing features array');
    }

    if (!Array.isArray(intent.roles)) {
        errors.push('Missing roles array');
    }

    return { valid: errors.length === 0, errors };
}

/**
 * Repair intent by fixing common issues.
 */
function repairIntent(intent, errors) {
    if (!intent || typeof intent !== 'object') {
        intent = {};
    }

    // Ensure required fields
    intent.appName = intent.appName || 'MyApp';
    intent.appType = intent.appType || 'custom';
    intent.description = intent.description || '';
    intent.entities = Array.isArray(intent.entities) ? intent.entities : [];
    intent.features = Array.isArray(intent.features) ? intent.features : [];
    intent.roles = Array.isArray(intent.roles) ? intent.roles : [];
    intent.businessRules = Array.isArray(intent.businessRules) ? intent.businessRules : [];
    intent.integrations = Array.isArray(intent.integrations) ? intent.integrations : [];
    intent.assumptions = Array.isArray(intent.assumptions) ? intent.assumptions : [];

    // Ensure all entities have required fields
    intent.entities.forEach((entity) => {
        if (!Array.isArray(entity.fields)) entity.fields = [];

        const hasId = entity.fields.some((f) => f.name === 'id');
        if (!hasId) {
            entity.fields.unshift({
                name: 'id',
                type: 'string',
                required: true,
                description: 'Unique identifier',
            });
        }

        const hasCreatedAt = entity.fields.some((f) => f.name === 'createdAt');
        if (!hasCreatedAt) {
            entity.fields.push({
                name: 'createdAt',
                type: 'date',
                required: true,
                description: 'Record creation timestamp',
            });
        }

        const hasUpdatedAt = entity.fields.some((f) => f.name === 'updatedAt');
        if (!hasUpdatedAt) {
            entity.fields.push({
                name: 'updatedAt',
                type: 'date',
                required: true,
                description: 'Record last update timestamp',
            });
        }
    });

    // If no User entity and roles exist, add one
    if (
        intent.roles.length > 0 &&
        !intent.entities.some((e) => e.name === 'User')
    ) {
        intent.entities.unshift({
            name: 'User',
            description: 'Application user',
            fields: [
                { name: 'id', type: 'string', required: true, description: 'Unique identifier' },
                { name: 'email', type: 'email', required: true, description: 'User email' },
                { name: 'password', type: 'password', required: true, description: 'User password (hashed)' },
                { name: 'name', type: 'string', required: true, description: 'Full name' },
                { name: 'role', type: 'enum', required: true, description: 'User role', options: intent.roles.map((r) => r.name) },
                { name: 'createdAt', type: 'date', required: true, description: 'Created timestamp' },
                { name: 'updatedAt', type: 'date', required: true, description: 'Updated timestamp' },
            ],
        });
    }

    // Ensure roles have level
    intent.roles.forEach((role, i) => {
        if (typeof role.level !== 'number') {
            role.level = i + 1;
        }
    });

    return intent;
}

/**
 * Validate design structure from Stage 2.
 */
function validateDesign(design, intent) {
    const errors = [];

    if (!design || typeof design !== 'object') {
        return { valid: false, errors: ['Design is not a valid object'] };
    }

    if (!Array.isArray(design.pages) || design.pages.length === 0) {
        errors.push('Missing or empty pages array');
    } else {
        const paths = new Set();
        design.pages.forEach((page, i) => {
            if (!page.name) errors.push(`Page ${i}: missing name`);
            if (!page.path) errors.push(`Page ${page.name || i}: missing path`);
            if (paths.has(page.path)) errors.push(`Page ${page.name}: duplicate path ${page.path}`);
            paths.add(page.path);
        });
    }

    if (!Array.isArray(design.navigation)) {
        errors.push('Missing navigation array');
    }

    return { valid: errors.length === 0, errors };
}

/**
 * Repair design by fixing common issues.
 */
function repairDesign(design, errors, intent) {
    if (!design || typeof design !== 'object') {
        design = {};
    }

    design.appName = design.appName || intent?.appName || 'MyApp';
    design.pages = Array.isArray(design.pages) ? design.pages : [];
    design.navigation = Array.isArray(design.navigation) ? design.navigation : [];
    design.entityRelationships = Array.isArray(design.entityRelationships) ? design.entityRelationships : [];
    design.userFlows = Array.isArray(design.userFlows) ? design.userFlows : [];
    design.roleHierarchy = design.roleHierarchy || { roles: [] };

    // Ensure login and dashboard pages exist if there are roles
    if (intent?.roles?.length > 0) {
        const hasLogin = design.pages.some((p) => p.path === '/login');
        if (!hasLogin) {
            design.pages.unshift({
                name: 'Login',
                path: '/login',
                title: 'Login',
                layout: 'auth',
                description: 'User login page',
                requiredRole: null,
                components: ['LoginForm'],
            });
        }

        const hasRegister = design.pages.some((p) => p.path === '/register');
        if (!hasRegister) {
            design.pages.splice(1, 0, {
                name: 'Register',
                path: '/register',
                title: 'Register',
                layout: 'auth',
                description: 'User registration page',
                requiredRole: null,
                components: ['RegisterForm'],
            });
        }
    }

    const hasDashboard = design.pages.some((p) => p.path === '/dashboard' || p.path === '/');
    if (!hasDashboard) {
        design.pages.push({
            name: 'Dashboard',
            path: '/dashboard',
            title: 'Dashboard',
            layout: 'dashboard',
            description: 'Main dashboard',
            requiredRole: null,
            components: ['Stats', 'Chart'],
        });
    }

    // De-duplicate paths
    const seen = new Set();
    design.pages = design.pages.filter((p) => {
        if (seen.has(p.path)) return false;
        seen.add(p.path);
        return true;
    });

    // Generate navigation from pages if empty
    if (design.navigation.length === 0) {
        design.navigation = design.pages
            .filter((p) => !['Login', 'Register'].includes(p.name))
            .map((p) => ({
                label: p.title || p.name,
                path: p.path,
                icon: guessIcon(p.name),
                requiredRole: p.requiredRole,
            }));
    }

    return design;
}

function guessIcon(pageName) {
    const lower = pageName.toLowerCase();
    if (lower.includes('dashboard')) return 'home';
    if (lower.includes('user') || lower.includes('profile')) return 'users';
    if (lower.includes('setting')) return 'settings';
    if (lower.includes('analytic') || lower.includes('report')) return 'chart';
    if (lower.includes('order') || lower.includes('payment')) return 'credit-card';
    if (lower.includes('product') || lower.includes('item')) return 'box';
    if (lower.includes('message') || lower.includes('mail')) return 'mail';
    if (lower.includes('calendar') || lower.includes('event')) return 'calendar';
    if (lower.includes('contact')) return 'users';
    return 'folder';
}

module.exports = {
    validateIntent,
    repairIntent,
    validateDesign,
    repairDesign,
};
