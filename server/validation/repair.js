// =====================================================
// NL App Compiler — Auto-Repair Engine
// =====================================================

/**
 * Attempt to auto-repair schemas based on consistency issues.
 * @param {object} config - { ui, api, db, auth }
 * @param {Array} issues - Array of consistency issues
 * @returns {object} Repaired config
 */
function repairSchemas(config, issues) {
    const repaired = JSON.parse(JSON.stringify(config)); // deep clone

    for (const issue of issues) {
        try {
            switch (issue.layer) {
                case 'db':
                    repairDB(repaired.db, issue);
                    break;
                case 'auth':
                    repairAuth(repaired.auth, issue);
                    break;
                case 'cross-layer':
                    repairCrossLayer(repaired, issue);
                    break;
            }
        } catch (err) {
            console.warn(`  Auto-repair failed for issue: ${issue.message}`, err.message);
        }
    }

    return repaired;
}

/**
 * Repair DB schema issues.
 */
function repairDB(db, issue) {
    if (!db?.tables) return;

    // Missing id column
    if (issue.message.includes('missing required "id" column')) {
        const tableName = extractQuoted(issue.message, 'Table');
        const table = db.tables.find((t) => t.name === tableName);
        if (table) {
            table.columns = table.columns || [];
            if (!table.columns.some((c) => c.name === 'id')) {
                table.columns.unshift({
                    name: 'id',
                    type: 'uuid',
                    primary: true,
                    nullable: false,
                    unique: true,
                    default: 'uuid_generate_v4()',
                });
            }
        }
    }

    // Missing timestamp columns
    if (issue.message.includes('missing "created_at"')) {
        const tableName = extractQuoted(issue.message, 'Table');
        const table = db.tables.find((t) => t.name === tableName);
        if (table) {
            table.columns = table.columns || [];
            if (!table.columns.some((c) => c.name === 'created_at')) {
                table.columns.push({
                    name: 'created_at',
                    type: 'timestamp',
                    nullable: false,
                    default: 'CURRENT_TIMESTAMP',
                });
            }
            if (!table.columns.some((c) => c.name === 'updated_at')) {
                table.columns.push({
                    name: 'updated_at',
                    type: 'timestamp',
                    nullable: false,
                    default: 'CURRENT_TIMESTAMP',
                });
            }
        }
    }

    // Non-existent referenced table — remove the bad reference
    if (issue.message.includes('references non-existent table')) {
        const tableName = extractQuoted(issue.message, 'Table');
        const colName = extractQuoted(issue.message, 'column');
        const table = db.tables.find((t) => t.name === tableName);
        if (table) {
            const col = table.columns.find((c) => c.name === colName);
            if (col) {
                col.references = { table: null, column: null };
            }
        }
    }
}

/**
 * Repair Auth schema issues.
 */
function repairAuth(auth, issue) {
    if (!auth) return;

    // Role referenced but not defined
    if (issue.message.includes('not defined in roles')) {
        const roleName = extractQuoted(issue.message, 'role');
        if (roleName && auth.roles) {
            const exists = auth.roles.some((r) => r.name === roleName);
            if (!exists) {
                auth.roles.push({
                    name: roleName,
                    level: auth.roles.length + 1,
                    description: `Auto-generated role: ${roleName}`,
                    inheritsFrom: null,
                });
            }
        }
    }
}

/**
 * Repair cross-layer issues.
 */
function repairCrossLayer(config, issue) {
    // Missing DB table for entity referenced in API/UI
    if (issue.message.includes('no matching DB table found') || issue.message.includes('no matching DB table')) {
        const entityName = extractEntityName(issue.message);
        if (entityName && config.db?.tables) {
            const tableName = toSnakeCase(entityName) + 's';
            const exists = config.db.tables.some((t) => t.name === tableName || t.name === entityName);
            if (!exists) {
                config.db.tables.push({
                    name: tableName,
                    entity: entityName,
                    columns: [
                        { name: 'id', type: 'uuid', primary: true, nullable: false, unique: true, default: 'uuid_generate_v4()' },
                        { name: 'name', type: 'varchar', nullable: false },
                        { name: 'created_at', type: 'timestamp', nullable: false, default: 'CURRENT_TIMESTAMP' },
                        { name: 'updated_at', type: 'timestamp', nullable: false, default: 'CURRENT_TIMESTAMP' },
                    ],
                    indices: [],
                });
            }
        }
    }

    // Role not defined in auth
    if (issue.message.includes('not defined in auth schema')) {
        const roleName = extractQuoted(issue.message, 'role');
        if (roleName && config.auth?.roles) {
            const exists = config.auth.roles.some((r) => r.name === roleName);
            if (!exists) {
                config.auth.roles.push({
                    name: roleName,
                    level: config.auth.roles.length + 1,
                    description: `Auto-added role: ${roleName}`,
                    inheritsFrom: null,
                });
            }
        }
    }
}

// --- Helpers ---

function extractQuoted(str, prefix) {
    // Match text after prefix in quotes
    const regex = new RegExp(`"([^"]+)"`);
    const matches = [...str.matchAll(/"([^"]+)"/g)];
    if (prefix === 'Table' && matches.length > 0) return matches[0][1];
    if (prefix === 'column' && matches.length > 1) return matches[1][1];
    if (prefix === 'role') {
        // Find the role name — usually last quoted string
        return matches.length > 0 ? matches[matches.length - 1][1] : null;
    }
    return matches.length > 0 ? matches[0][1] : null;
}

function extractEntityName(message) {
    const match = message.match(/entity "([^"]+)"/);
    return match ? match[1] : null;
}

function toSnakeCase(str) {
    return str
        .replace(/([A-Z])/g, '_$1')
        .toLowerCase()
        .replace(/^_/, '');
}

module.exports = { repairSchemas };
