// =====================================================
// NL App Compiler — Component Library
// =====================================================
// Each component is a function: (config, entities, db) → HTML string

/**
 * Generate HTML for a component based on its type and props.
 */
function generateComponentHTML(component, entities, db) {
    const type = component.type || 'Card';
    const props = component.props || {};

    const generators = {
        StatCard: renderStatCard,
        DataTable: renderDataTable,
        Form: renderForm,
        DetailCard: renderDetailCard,
        Chart: renderChart,
        LoginForm: renderLoginForm,
        RegisterForm: renderRegisterForm,
        ProfileCard: renderProfileCard,
        HeroSection: renderHeroSection,
        ActivityFeed: renderActivityFeed,
        Calendar: renderCalendar,
        KanbanBoard: renderKanbanBoard,
        NotificationList: renderNotificationList,
        Modal: renderModal,
        SearchBar: renderSearchBar,
        FilterBar: renderFilterBar,
    };

    const generator = generators[type] || renderGenericCard;
    return generator(props, entities, db);
}

function renderStatCard(props) {
    const icon = getIconSVG(props.icon || 'chart');
    return `
    <div class="card stat-card">
        <div class="stat-card-icon">${icon}</div>
        <div class="stat-card-content">
            <div class="stat-value" data-stat="${props.title || 'count'}">0</div>
            <div class="stat-label">${props.title || 'Metric'}</div>
        </div>
        ${props.description ? `<div class="stat-trend">${props.description}</div>` : ''}
    </div>`;
}

function renderDataTable(props, entities, db) {
    const entity = findEntity(props.entity, entities);
    const fields = props.fields || entity?.fields?.filter(f => !['id', 'createdAt', 'updatedAt', 'password'].includes(f.name)).map(f => f.name) || ['name', 'email', 'status'];
    const displayFields = fields.slice(0, 6); // Limit visible columns

    const headers = displayFields.map(f => `<th>${formatFieldName(f)}</th>`).join('');
    const sampleRows = generateSampleRows(entity, displayFields, 5);

    return `
    <div class="card data-table-card">
        <div class="table-header">
            <h3 class="table-title">${props.title || (entity ? entity.name + 's' : 'Records')}</h3>
            <div class="table-actions">
                <div class="search-input-wrapper">
                    <input type="text" class="search-input" placeholder="Search..." oninput="filterTable(this)">
                </div>
                <button class="btn btn-primary" onclick="openModal('add-${(entity?.name || 'item').toLowerCase()}')">
                    + Add ${entity?.name || 'Item'}
                </button>
            </div>
        </div>
        <div class="table-wrapper">
            <table class="data-table" data-entity="${entity?.name || 'item'}">
                <thead><tr>${headers}<th>Actions</th></tr></thead>
                <tbody>${sampleRows}</tbody>
            </table>
        </div>
        <div class="table-footer">
            <span class="table-count">Showing <span class="count-num">5</span> records</span>
            <div class="pagination">
                <button class="btn btn-sm" disabled>← Prev</button>
                <span class="page-info">Page 1</span>
                <button class="btn btn-sm">Next →</button>
            </div>
        </div>
    </div>`;
}

function renderForm(props, entities) {
    const entity = findEntity(props.entity, entities);
    const fields = entity?.fields?.filter(f => !['id', 'createdAt', 'updatedAt'].includes(f.name)) || [];

    const formFields = fields.map(f => {
        const inputType = mapFieldType(f.type);
        const required = f.required ? 'required' : '';

        if (f.type === 'enum' && f.options) {
            const options = f.options.map(o => `<option value="${o}">${formatFieldName(o)}</option>`).join('');
            return `
            <div class="form-group">
                <label class="form-label">${formatFieldName(f.name)}</label>
                <select class="form-control" name="${f.name}" ${required}>${options}</select>
            </div>`;
        }

        if (f.type === 'text') {
            return `
            <div class="form-group">
                <label class="form-label">${formatFieldName(f.name)}</label>
                <textarea class="form-control" name="${f.name}" rows="3" ${required}></textarea>
            </div>`;
        }

        if (f.type === 'boolean') {
            return `
            <div class="form-group form-check">
                <label class="form-check-label">
                    <input type="checkbox" class="form-check-input" name="${f.name}">
                    ${formatFieldName(f.name)}
                </label>
            </div>`;
        }

        return `
        <div class="form-group">
            <label class="form-label">${formatFieldName(f.name)}</label>
            <input type="${inputType}" class="form-control" name="${f.name}" placeholder="Enter ${formatFieldName(f.name).toLowerCase()}" ${required}>
        </div>`;
    }).join('');

    return `
    <div class="card form-card">
        <h3 class="card-title">${props.title || `${entity?.name || 'Item'} Form`}</h3>
        <form class="entity-form" data-entity="${entity?.name || 'item'}" onsubmit="handleFormSubmit(event)">
            ${formFields}
            <div class="form-actions">
                <button type="submit" class="btn btn-primary">Save</button>
                <button type="button" class="btn btn-secondary" onclick="this.closest('form').reset()">Reset</button>
            </div>
        </form>
    </div>`;
}

function renderDetailCard(props, entities) {
    const entity = findEntity(props.entity, entities);
    const fields = props.fields || entity?.fields?.filter(f => f.name !== 'password').map(f => f.name) || [];

    const details = fields.map(f => `
        <div class="detail-row">
            <span class="detail-label">${formatFieldName(f)}</span>
            <span class="detail-value" data-field="${f}">—</span>
        </div>
    `).join('');

    return `
    <div class="card detail-card">
        <h3 class="card-title">${props.title || entity?.name || 'Details'}</h3>
        ${details}
    </div>`;
}

function renderChart(props) {
    const chartType = props.chartType || 'bar';
    return `
    <div class="card chart-card">
        <h3 class="card-title">${props.title || 'Analytics'}</h3>
        <div class="chart-container" data-chart-type="${chartType}">
            <canvas class="chart-canvas" data-type="${chartType}"></canvas>
        </div>
    </div>`;
}

function renderLoginForm() {
    return `
    <div class="auth-card">
        <div class="auth-logo">🔐</div>
        <h2 class="auth-title">Welcome Back</h2>
        <p class="auth-subtitle">Sign in to your account</p>
        <form class="auth-form" onsubmit="handleLogin(event)">
            <div class="form-group">
                <label class="form-label">Email</label>
                <input type="email" class="form-control" name="email" placeholder="you@example.com" required>
            </div>
            <div class="form-group">
                <label class="form-label">Password</label>
                <input type="password" class="form-control" name="password" placeholder="••••••••" required>
            </div>
            <button type="submit" class="btn btn-primary btn-full">Sign In</button>
            <p class="auth-link">Don't have an account? <a href="#" onclick="navigateTo('/register')">Register</a></p>
        </form>
    </div>`;
}

function renderRegisterForm() {
    return `
    <div class="auth-card">
        <div class="auth-logo">📝</div>
        <h2 class="auth-title">Create Account</h2>
        <p class="auth-subtitle">Get started with your account</p>
        <form class="auth-form" onsubmit="handleRegister(event)">
            <div class="form-group">
                <label class="form-label">Full Name</label>
                <input type="text" class="form-control" name="name" placeholder="John Doe" required>
            </div>
            <div class="form-group">
                <label class="form-label">Email</label>
                <input type="email" class="form-control" name="email" placeholder="you@example.com" required>
            </div>
            <div class="form-group">
                <label class="form-label">Password</label>
                <input type="password" class="form-control" name="password" placeholder="••••••••" required minlength="6">
            </div>
            <button type="submit" class="btn btn-primary btn-full">Create Account</button>
            <p class="auth-link">Already have an account? <a href="#" onclick="navigateTo('/login')">Sign In</a></p>
        </form>
    </div>`;
}

function renderProfileCard(props) {
    return `
    <div class="card profile-card">
        <div class="profile-avatar">👤</div>
        <h3 class="profile-name" data-field="name">User Name</h3>
        <p class="profile-role" data-field="role">Role</p>
        <div class="profile-stats">
            <div class="profile-stat"><span class="profile-stat-value">0</span><span class="profile-stat-label">Items</span></div>
            <div class="profile-stat"><span class="profile-stat-value">0</span><span class="profile-stat-label">Actions</span></div>
        </div>
    </div>`;
}

function renderHeroSection(props) {
    return `
    <div class="hero-section">
        <h1 class="hero-title">${props.title || 'Welcome'}</h1>
        <p class="hero-subtitle">${props.description || 'Get started with your application'}</p>
    </div>`;
}

function renderActivityFeed(props) {
    return `
    <div class="card activity-card">
        <h3 class="card-title">${props.title || 'Recent Activity'}</h3>
        <div class="activity-list">
            <div class="activity-item"><span class="activity-dot"></span><span>New record created</span><span class="activity-time">Just now</span></div>
            <div class="activity-item"><span class="activity-dot"></span><span>Record updated</span><span class="activity-time">2 min ago</span></div>
            <div class="activity-item"><span class="activity-dot"></span><span>User logged in</span><span class="activity-time">5 min ago</span></div>
        </div>
    </div>`;
}

function renderCalendar(props) {
    return `
    <div class="card calendar-card">
        <h3 class="card-title">${props.title || 'Calendar'}</h3>
        <div class="calendar-placeholder">📅 Calendar view</div>
    </div>`;
}

function renderKanbanBoard(props) {
    return `
    <div class="card kanban-card">
        <h3 class="card-title">${props.title || 'Board'}</h3>
        <div class="kanban-columns">
            <div class="kanban-column"><h4>To Do</h4><div class="kanban-items"></div></div>
            <div class="kanban-column"><h4>In Progress</h4><div class="kanban-items"></div></div>
            <div class="kanban-column"><h4>Done</h4><div class="kanban-items"></div></div>
        </div>
    </div>`;
}

function renderNotificationList(props) {
    return `
    <div class="card notification-card">
        <h3 class="card-title">${props.title || 'Notifications'}</h3>
        <div class="notification-list">
            <div class="notification-item unread"><span class="notification-icon">🔔</span><span>Welcome to the app!</span></div>
        </div>
    </div>`;
}

function renderModal() {
    return ''; // Modals are handled by the app shell
}

function renderSearchBar(props) {
    return `
    <div class="search-bar">
        <input type="text" class="search-input search-lg" placeholder="${props.title || 'Search...'}" oninput="handleSearch(this.value)">
    </div>`;
}

function renderFilterBar(props) {
    return `
    <div class="filter-bar">
        <span class="filter-label">Filter by:</span>
        <select class="form-control filter-select" onchange="handleFilter(this.value)">
            <option value="">All</option>
        </select>
    </div>`;
}

function renderGenericCard(props) {
    return `
    <div class="card">
        <h3 class="card-title">${props.title || 'Card'}</h3>
        <p class="card-desc">${props.description || ''}</p>
    </div>`;
}

// --- Helpers ---

function findEntity(name, entities) {
    if (!name || !entities) return null;
    return entities.find(e =>
        e.name === name ||
        e.name.toLowerCase() === name.toLowerCase()
    );
}

function formatFieldName(name) {
    return name
        .replace(/([A-Z])/g, ' $1')
        .replace(/_/g, ' ')
        .replace(/^\w/, c => c.toUpperCase())
        .trim();
}

function mapFieldType(type) {
    const map = {
        string: 'text',
        number: 'number',
        integer: 'number',
        float: 'number',
        boolean: 'checkbox',
        date: 'date',
        email: 'email',
        password: 'password',
        url: 'url',
        text: 'text',
    };
    return map[type] || 'text';
}

function generateSampleRows(entity, fields, count) {
    const sampleData = getSampleData(entity);
    let rows = '';

    for (let i = 0; i < count; i++) {
        const cells = fields.map(f => {
            const val = sampleData[i]?.[f] || generateSampleValue(f, i);
            return `<td>${val}</td>`;
        }).join('');

        rows += `<tr data-id="${i + 1}">${cells}<td class="action-cell">
            <button class="btn btn-sm btn-icon" onclick="viewRecord(${i + 1})" title="View">👁️</button>
            <button class="btn btn-sm btn-icon" onclick="editRecord(${i + 1})" title="Edit">✏️</button>
            <button class="btn btn-sm btn-icon btn-danger" onclick="deleteRecord(${i + 1})" title="Delete">🗑️</button>
        </td></tr>`;
    }

    return rows;
}

function getSampleData(entity) {
    // Generate contextual sample data based on entity name
    if (!entity) return [];
    const name = entity.name.toLowerCase();

    const samples = {
        user: [
            { name: 'Alice Johnson', email: 'alice@example.com', role: 'admin', status: 'Active' },
            { name: 'Bob Smith', email: 'bob@example.com', role: 'user', status: 'Active' },
            { name: 'Carol Davis', email: 'carol@example.com', role: 'user', status: 'Inactive' },
            { name: 'David Wilson', email: 'david@example.com', role: 'manager', status: 'Active' },
            { name: 'Eve Brown', email: 'eve@example.com', role: 'user', status: 'Active' },
        ],
        contact: [
            { name: 'Acme Corp', email: 'info@acme.com', phone: '+1-555-0100', company: 'Acme Corp', status: 'Lead' },
            { name: 'John Doe', email: 'john@techco.com', phone: '+1-555-0101', company: 'TechCo', status: 'Customer' },
            { name: 'Jane Smith', email: 'jane@startup.io', phone: '+1-555-0102', company: 'StartupIO', status: 'Lead' },
            { name: 'Mike Johnson', email: 'mike@bigcorp.com', phone: '+1-555-0103', company: 'BigCorp', status: 'Customer' },
            { name: 'Sarah Williams', email: 'sarah@innovate.co', phone: '+1-555-0104', company: 'Innovate Co', status: 'Prospect' },
        ],
        product: [
            { name: 'Pro Plan', price: '$29.99', category: 'Software', status: 'Active', stock: '∞' },
            { name: 'Basic Widget', price: '$9.99', category: 'Hardware', status: 'Active', stock: '150' },
            { name: 'Premium Suite', price: '$99.99', category: 'Software', status: 'Active', stock: '∞' },
            { name: 'Starter Kit', price: '$19.99', category: 'Bundle', status: 'Draft', stock: '50' },
            { name: 'Enterprise License', price: '$299.99', category: 'Software', status: 'Active', stock: '∞' },
        ],
        order: [
            { orderNumber: 'ORD-001', customer: 'Alice Johnson', total: '$129.99', status: 'Completed', date: '2024-01-15' },
            { orderNumber: 'ORD-002', customer: 'Bob Smith', total: '$49.99', status: 'Processing', date: '2024-01-16' },
            { orderNumber: 'ORD-003', customer: 'Carol Davis', total: '$299.99', status: 'Shipped', date: '2024-01-17' },
            { orderNumber: 'ORD-004', customer: 'David Wilson', total: '$19.99', status: 'Pending', date: '2024-01-18' },
            { orderNumber: 'ORD-005', customer: 'Eve Brown', total: '$79.99', status: 'Completed', date: '2024-01-19' },
        ],
    };

    return samples[name] || [];
}

function generateSampleValue(fieldName, index) {
    const lower = fieldName.toLowerCase();
    if (lower.includes('name')) return ['Alice', 'Bob', 'Carol', 'David', 'Eve'][index] || `Item ${index + 1}`;
    if (lower.includes('email')) return `user${index + 1}@example.com`;
    if (lower.includes('phone')) return `+1-555-010${index}`;
    if (lower.includes('status')) return ['Active', 'Inactive', 'Pending', 'Active', 'Active'][index] || 'Active';
    if (lower.includes('role')) return ['admin', 'user', 'manager', 'user', 'user'][index] || 'user';
    if (lower.includes('date') || lower.includes('created') || lower.includes('updated')) return '2024-01-15';
    if (lower.includes('price') || lower.includes('amount') || lower.includes('total')) return `$${(index + 1) * 29.99}`;
    if (lower.includes('description') || lower.includes('desc')) return 'Sample description...';
    if (lower.includes('count') || lower.includes('quantity')) return (index + 1) * 10;
    return `Value ${index + 1}`;
}

function getIconSVG(name) {
    const icons = {
        home: '🏠',
        users: '👥',
        settings: '⚙️',
        chart: '📊',
        'credit-card': '💳',
        box: '📦',
        mail: '✉️',
        calendar: '📅',
        shield: '🛡️',
        folder: '📁',
        star: '⭐',
        bell: '🔔',
        search: '🔍',
        plus: '➕',
    };
    return icons[name] || '📋';
}

module.exports = { generateComponentHTML };
