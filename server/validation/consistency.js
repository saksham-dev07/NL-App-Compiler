// =====================================================
// NL App Compiler — Cross-Layer Consistency Checker
// =====================================================

/**
 * Check consistency across all four schema layers.
 * Returns an array of issues found.
 * @param {object} config - { ui, api, db, auth }
 * @returns {Array<object>} Issues found
 */
function checkConsistency(config) {
    const issues = [];
    const { ui, api, db, auth } = config;

    // --- DB Layer Checks ---
    const dbTables = new Set();
    const dbColumns = {}; // tableName -> Set of column names

    if (db?.tables) {
        db.tables.forEach((table) => {
            dbTables.add(table.name);
            dbColumns[table.name] = new Set((table.columns || []).map((c) => c.name));

            // Check required columns
            const colNames = dbColumns[table.name];
            if (!colNames.has('id')) {
                issues.push({
                    severity: 'error',
                    layer: 'db',
                    message: `Table "${table.name}" missing required "id" column`,
                });
            }
            if (!colNames.has('created_at')) {
                issues.push({
                    severity: 'warning',
                    layer: 'db',
                    message: `Table "${table.name}" missing "created_at" column`,
                });
            }

            // Check foreign key references
            (table.columns || []).forEach((col) => {
                if (col.references?.table && !dbTables.has(col.references.table)) {
                    // Defer this check — table might be defined later
                }
            });
        });

        // Second pass: check foreign key references
        db.tables.forEach((table) => {
            (table.columns || []).forEach((col) => {
                if (col.references?.table && !dbTables.has(col.references.table)) {
                    issues.push({
                        severity: 'error',
                        layer: 'db',
                        message: `Table "${table.name}", column "${col.name}" references non-existent table "${col.references.table}"`,
                    });
                }
            });
        });
    }

    // --- API Layer Checks ---
    if (api?.endpoints) {
        api.endpoints.forEach((endpoint) => {
            // Check entity references
            if (endpoint.entity) {
                const entityTableName = toSnakeCase(endpoint.entity) + 's';
                const altTableName = toSnakeCase(endpoint.entity);
                if (!dbTables.has(entityTableName) && !dbTables.has(altTableName) && !dbTables.has(endpoint.entity)) {
                    issues.push({
                        severity: 'warning',
                        layer: 'cross-layer',
                        message: `API endpoint "${endpoint.method} ${endpoint.path}" references entity "${endpoint.entity}" but no matching DB table found`,
                    });
                }
            }

            // Check auth roles
            if (endpoint.auth?.roles?.length > 0 && auth?.roles) {
                const validRoles = new Set(auth.roles.map((r) => r.name));
                endpoint.auth.roles.forEach((role) => {
                    if (!validRoles.has(role)) {
                        issues.push({
                            severity: 'warning',
                            layer: 'cross-layer',
                            message: `API endpoint "${endpoint.path}" references role "${role}" not defined in auth schema`,
                        });
                    }
                });
            }
        });
    }

    // --- UI Layer Checks ---
    if (ui?.pages) {
        const pagePaths = new Set(ui.pages.map((p) => p.path));

        ui.pages.forEach((page) => {
            // Check that requiredRole exists in auth
            if (page.requiredRole && auth?.roles) {
                const validRoles = new Set(auth.roles.map((r) => r.name));
                if (!validRoles.has(page.requiredRole)) {
                    issues.push({
                        severity: 'warning',
                        layer: 'cross-layer',
                        message: `UI page "${page.name}" requires role "${page.requiredRole}" not defined in auth schema`,
                    });
                }
            }

            // Check component entity references
            (page.sections || []).forEach((section) => {
                (section.components || []).forEach((comp) => {
                    if (comp.props?.entity) {
                        const entityTableName = toSnakeCase(comp.props.entity) + 's';
                        if (!dbTables.has(entityTableName) && !dbTables.has(comp.props.entity)) {
                            issues.push({
                                severity: 'warning',
                                layer: 'cross-layer',
                                message: `UI component in page "${page.name}" references entity "${comp.props.entity}" with no matching DB table`,
                            });
                        }
                    }
                });
            });
        });
    }

    // --- Auth Layer Checks ---
    if (auth?.permissions) {
        auth.permissions.forEach((perm) => {
            // Check resource references
            if (perm.resource) {
                const resourceTable = toSnakeCase(perm.resource) + 's';
                if (!dbTables.has(resourceTable) && !dbTables.has(perm.resource) && !dbTables.has(toSnakeCase(perm.resource))) {
                    issues.push({
                        severity: 'info',
                        layer: 'cross-layer',
                        message: `Auth permission for resource "${perm.resource}" has no matching DB table`,
                    });
                }
            }
        });
    }

    if (auth?.routeGuards) {
        auth.routeGuards.forEach((guard) => {
            if (guard.requiredRole && auth?.roles) {
                const validRoles = new Set(auth.roles.map((r) => r.name));
                if (!validRoles.has(guard.requiredRole)) {
                    issues.push({
                        severity: 'warning',
                        layer: 'auth',
                        message: `Route guard for "${guard.path}" requires role "${guard.requiredRole}" not defined in roles`,
                    });
                }
            }
        });
    }

    return issues;
}

/**
 * Convert PascalCase or camelCase to snake_case.
 */
function toSnakeCase(str) {
    return str
        .replace(/([A-Z])/g, '_$1')
        .toLowerCase()
        .replace(/^_/, '');
}

module.exports = { checkConsistency };
