// =====================================================
// NL App Compiler — App Shell Templates
// =====================================================

/**
 * Generate the complete standalone HTML app shell.
 */
function getAppShell({ appName, theme, navigation, pages, roles, entities, apiEndpoints, dbSchema }) {
    const navItems = navigation.map(nav => {
        const icon = getNavIcon(nav.icon);
        return `<a href="#" class="nav-item" data-path="${nav.path}" onclick="navigateTo('${nav.path}')" ${nav.requiredRole ? `data-role="${nav.requiredRole}"` : ''}>
            <span class="nav-icon">${icon}</span>
            <span class="nav-label">${nav.label}</span>
        </a>`;
    }).join('\n');

    const pageContainers = pages.map(page => `
        <div class="page" data-page="${page.path}" data-role="${page.requiredRole || ''}" style="display:none;">
            <div class="page-header">
                <h1 class="page-title">${page.title}</h1>
            </div>
            <div class="page-body ${page.layout === 'auth' ? 'auth-layout' : ''}">
                ${page.html}
            </div>
        </div>
    `).join('\n');

    // Generate modal for adding/editing entities
    const entityModals = entities.map(entity => {
        const fields = (entity.fields || [])
            .filter(f => !['id', 'createdAt', 'updatedAt'].includes(f.name))
            .map(f => {
                if (f.type === 'password') return '';
                const inputType = f.type === 'email' ? 'email' : f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text';
                if (f.type === 'enum' && f.options) {
                    const opts = f.options.map(o => `<option value="${o}">${o}</option>`).join('');
                    return `<div class="form-group"><label class="form-label">${formatLabel(f.name)}</label><select class="form-control" name="${f.name}">${opts}</select></div>`;
                }
                if (f.type === 'text') {
                    return `<div class="form-group"><label class="form-label">${formatLabel(f.name)}</label><textarea class="form-control" name="${f.name}" rows="3"></textarea></div>`;
                }
                if (f.type === 'boolean') {
                    return `<div class="form-group form-check"><label class="form-check-label"><input type="checkbox" class="form-check-input" name="${f.name}"> ${formatLabel(f.name)}</label></div>`;
                }
                return `<div class="form-group"><label class="form-label">${formatLabel(f.name)}</label><input type="${inputType}" class="form-control" name="${f.name}" ${f.required ? 'required' : ''}></div>`;
            }).filter(Boolean).join('');

        return `
        <div class="modal-overlay" id="modal-add-${entity.name.toLowerCase()}" style="display:none;">
            <div class="modal">
                <div class="modal-header">
                    <h3>Add ${entity.name}</h3>
                    <button class="modal-close" onclick="closeModal('add-${entity.name.toLowerCase()}')">&times;</button>
                </div>
                <form class="modal-body" onsubmit="handleModalSubmit(event, '${entity.name}')">
                    ${fields}
                    <div class="form-actions">
                        <button type="submit" class="btn btn-primary">Save</button>
                        <button type="button" class="btn btn-secondary" onclick="closeModal('add-${entity.name.toLowerCase()}')">Cancel</button>
                    </div>
                </form>
            </div>
        </div>`;
    }).join('\n');

    const roleOptions = roles.map(r => `<option value="${r.name}">${r.name}</option>`).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${appName}</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        ${getAppStyles(theme)}
    </style>
</head>
<body>
    <!-- Sidebar -->
    <aside class="sidebar" id="sidebar">
        <div class="sidebar-header">
            <div class="app-logo">${appName.charAt(0).toUpperCase()}</div>
            <span class="app-name">${appName}</span>
        </div>
        <nav class="sidebar-nav">
            ${navItems}
        </nav>
        <div class="sidebar-footer">
            <div class="user-info">
                <div class="user-avatar" id="user-avatar">?</div>
                <div class="user-details">
                    <span class="user-name" id="user-name">Guest</span>
                    <span class="user-role" id="user-role">—</span>
                </div>
            </div>
            <div class="role-switcher">
                <label class="role-label">Switch Role:</label>
                <select id="role-select" class="form-control role-select" onchange="switchRole(this.value)">
                    ${roleOptions}
                </select>
            </div>
            <button class="btn btn-sm btn-secondary btn-full" onclick="handleLogout()">Logout</button>
        </div>
    </aside>

    <!-- Main Content -->
    <main class="main-content" id="main">
        ${pageContainers}
    </main>

    <!-- Toast Container -->
    <div id="toast-container" class="toast-container"></div>

    <!-- Modals -->
    ${entityModals}

    <script>
        ${getAppScript(roles, entities, pages, apiEndpoints)}
    </script>
</body>
</html>`;
}

/**
 * Generate all CSS styles for the rendered app.
 */
function getAppStyles(theme) {
    return `
        * { margin: 0; padding: 0; box-sizing: border-box; }
        :root {
            --primary: ${theme.primaryColor};
            --secondary: ${theme.secondaryColor};
            --accent: ${theme.accentColor};
            --bg: ${theme.backgroundColor};
            --text: ${theme.textColor};
            --radius: ${theme.borderRadius};
            --bg-card: rgba(255,255,255,0.05);
            --bg-card-hover: rgba(255,255,255,0.08);
            --border: rgba(255,255,255,0.08);
            --text-muted: rgba(241,245,249,0.5);
            --success: #22c55e;
            --warning: #eab308;
            --danger: #ef4444;
            --sidebar-width: 260px;
        }
        body {
            font-family: ${theme.fontFamily};
            background: var(--bg);
            color: var(--text);
            display: flex;
            min-height: 100vh;
        }
        /* Sidebar */
        .sidebar {
            width: var(--sidebar-width);
            background: rgba(0,0,0,0.3);
            border-right: 1px solid var(--border);
            display: flex;
            flex-direction: column;
            position: fixed;
            top: 0;
            bottom: 0;
            left: 0;
            z-index: 50;
        }
        .sidebar-header {
            padding: 20px;
            display: flex;
            align-items: center;
            gap: 12px;
            border-bottom: 1px solid var(--border);
        }
        .app-logo {
            width: 36px;
            height: 36px;
            border-radius: 10px;
            background: linear-gradient(135deg, var(--primary), var(--secondary));
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            font-size: 16px;
            color: white;
        }
        .app-name {
            font-size: 16px;
            font-weight: 700;
            letter-spacing: -0.02em;
        }
        .sidebar-nav {
            flex: 1;
            padding: 12px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 2px;
        }
        .nav-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 10px 14px;
            border-radius: var(--radius);
            color: var(--text-muted);
            text-decoration: none;
            font-size: 14px;
            font-weight: 500;
            transition: all 0.15s ease;
        }
        .nav-item:hover { background: var(--bg-card); color: var(--text); }
        .nav-item.active {
            background: linear-gradient(135deg, rgba(99,102,241,0.15), rgba(168,85,247,0.15));
            color: white;
            font-weight: 600;
        }
        .nav-icon { font-size: 18px; width: 24px; text-align: center; }
        .sidebar-footer {
            padding: 16px;
            border-top: 1px solid var(--border);
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        .user-info { display: flex; align-items: center; gap: 10px; }
        .user-avatar {
            width: 32px; height: 32px; border-radius: 50%;
            background: var(--primary); display: flex; align-items: center;
            justify-content: center; font-weight: 600; font-size: 14px;
        }
        .user-details { display: flex; flex-direction: column; }
        .user-name { font-size: 13px; font-weight: 600; }
        .user-role { font-size: 11px; color: var(--text-muted); text-transform: capitalize; }
        .role-label { font-size: 11px; color: var(--text-muted); }
        .role-select { font-size: 12px; padding: 4px 8px; }

        /* Main */
        .main-content {
            margin-left: var(--sidebar-width);
            flex: 1;
            padding: 24px 32px;
            min-height: 100vh;
        }
        .page-header {
            margin-bottom: 24px;
            padding-bottom: 16px;
            border-bottom: 1px solid var(--border);
        }
        .page-title {
            font-size: 24px;
            font-weight: 700;
            letter-spacing: -0.02em;
        }
        .page-body.auth-layout {
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 70vh;
        }

        /* Sections */
        .section { margin-bottom: 24px; }
        .section-title { font-size: 16px; font-weight: 600; margin-bottom: 16px; color: var(--text-muted); }
        .section-grid { display: grid; gap: 16px; }
        .cols-1 { grid-template-columns: 1fr; }
        .cols-2 { grid-template-columns: repeat(2, 1fr); }
        .cols-3 { grid-template-columns: repeat(3, 1fr); }
        .cols-4 { grid-template-columns: repeat(4, 1fr); }

        /* Cards */
        .card {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            padding: 20px;
            transition: all 0.2s ease;
        }
        .card:hover { border-color: rgba(99,102,241,0.3); }
        .card-title { font-size: 15px; font-weight: 600; margin-bottom: 12px; }
        .card-desc { font-size: 13px; color: var(--text-muted); }

        /* Stat Cards */
        .stat-card {
            display: flex;
            align-items: center;
            gap: 16px;
            position: relative;
            overflow: hidden;
        }
        .stat-card-icon { font-size: 28px; }
        .stat-value { font-size: 28px; font-weight: 700; }
        .stat-label { font-size: 13px; color: var(--text-muted); }
        .stat-trend { font-size: 12px; color: var(--success); margin-left: auto; }

        /* DataTable */
        .data-table-card { padding: 0; overflow: hidden; }
        .table-header {
            display: flex; align-items: center; justify-content: space-between;
            padding: 16px 20px; border-bottom: 1px solid var(--border);
        }
        .table-title { font-size: 16px; font-weight: 600; }
        .table-actions { display: flex; gap: 10px; align-items: center; }
        .table-wrapper { overflow-x: auto; }
        .data-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .data-table th {
            text-align: left; padding: 10px 16px; font-weight: 600; font-size: 12px;
            text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted);
            border-bottom: 1px solid var(--border); background: rgba(0,0,0,0.2);
        }
        .data-table td {
            padding: 12px 16px; border-bottom: 1px solid var(--border);
        }
        .data-table tr:hover td { background: var(--bg-card-hover); }
        .table-footer {
            display: flex; align-items: center; justify-content: space-between;
            padding: 12px 20px; border-top: 1px solid var(--border); font-size: 13px;
            color: var(--text-muted);
        }
        .action-cell { display: flex; gap: 4px; }
        .pagination { display: flex; align-items: center; gap: 8px; }
        .page-info { font-size: 13px; }

        /* Forms */
        .form-group { margin-bottom: 16px; }
        .form-label { display: block; font-size: 13px; font-weight: 500; margin-bottom: 6px; color: var(--text-muted); }
        .form-control {
            width: 100%; padding: 10px 14px; border: 1px solid var(--border);
            border-radius: var(--radius); background: rgba(0,0,0,0.3); color: var(--text);
            font-family: inherit; font-size: 14px; outline: none; transition: border-color 0.15s;
        }
        .form-control:focus { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(99,102,241,0.15); }
        .form-actions { display: flex; gap: 10px; margin-top: 20px; }
        .form-check { display: flex; align-items: center; gap: 8px; }
        .form-check-input { width: 16px; height: 16px; accent-color: var(--primary); }

        /* Auth */
        .auth-card {
            background: var(--bg-card); border: 1px solid var(--border);
            border-radius: 16px; padding: 40px; max-width: 420px; width: 100%;
            text-align: center;
        }
        .auth-logo { font-size: 48px; margin-bottom: 16px; }
        .auth-title { font-size: 24px; font-weight: 700; margin-bottom: 8px; }
        .auth-subtitle { font-size: 14px; color: var(--text-muted); margin-bottom: 28px; }
        .auth-form { text-align: left; }
        .auth-link { text-align: center; font-size: 13px; color: var(--text-muted); margin-top: 16px; }
        .auth-link a { color: var(--primary); text-decoration: none; }

        /* Buttons */
        .btn {
            padding: 8px 16px; border: 1px solid var(--border); border-radius: var(--radius);
            background: var(--bg-card); color: var(--text); font-family: inherit;
            font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.15s;
            display: inline-flex; align-items: center; gap: 6px;
        }
        .btn:hover { background: var(--bg-card-hover); }
        .btn-primary {
            background: linear-gradient(135deg, var(--primary), var(--secondary));
            border-color: var(--primary); color: white;
        }
        .btn-primary:hover { opacity: 0.9; transform: translateY(-1px); }
        .btn-secondary { background: transparent; }
        .btn-danger { color: var(--danger); border-color: rgba(239,68,68,0.3); }
        .btn-danger:hover { background: rgba(239,68,68,0.1); }
        .btn-sm { padding: 4px 10px; font-size: 12px; }
        .btn-icon { padding: 4px 8px; }
        .btn-full { width: 100%; justify-content: center; }

        /* Charts */
        .chart-card .chart-container { height: 220px; display: flex; align-items: flex-end; gap: 8px; padding-top: 16px; }
        .chart-bar {
            flex: 1; border-radius: 4px 4px 0 0; background: linear-gradient(to top, var(--primary), var(--secondary));
            transition: height 0.5s ease; min-height: 20px; position: relative;
        }
        .chart-bar:hover { opacity: 0.8; }
        .chart-bar-label {
            position: absolute; bottom: -20px; left: 50%; transform: translateX(-50%);
            font-size: 10px; color: var(--text-muted); white-space: nowrap;
        }

        /* Activity */
        .activity-list { display: flex; flex-direction: column; gap: 12px; }
        .activity-item {
            display: flex; align-items: center; gap: 10px; font-size: 13px;
            padding: 8px 0; border-bottom: 1px solid var(--border);
        }
        .activity-dot {
            width: 8px; height: 8px; border-radius: 50%; background: var(--primary);
            flex-shrink: 0;
        }
        .activity-time { margin-left: auto; font-size: 12px; color: var(--text-muted); }

        /* Detail Card */
        .detail-row {
            display: flex; justify-content: space-between; padding: 10px 0;
            border-bottom: 1px solid var(--border); font-size: 14px;
        }
        .detail-label { color: var(--text-muted); }

        /* Profile Card */
        .profile-card { text-align: center; }
        .profile-avatar { font-size: 56px; margin-bottom: 12px; }
        .profile-name { font-size: 18px; font-weight: 600; }
        .profile-role { font-size: 13px; color: var(--text-muted); margin-bottom: 16px; text-transform: capitalize; }
        .profile-stats { display: flex; justify-content: center; gap: 32px; }
        .profile-stat { text-align: center; }
        .profile-stat-value { display: block; font-size: 20px; font-weight: 700; }
        .profile-stat-label { font-size: 12px; color: var(--text-muted); }

        /* Kanban */
        .kanban-columns { display: flex; gap: 16px; }
        .kanban-column {
            flex: 1; background: rgba(0,0,0,0.2); border-radius: var(--radius); padding: 12px;
        }
        .kanban-column h4 { font-size: 13px; font-weight: 600; margin-bottom: 12px; color: var(--text-muted); }
        .kanban-items { min-height: 100px; }

        /* Search */
        .search-input-wrapper { position: relative; }
        .search-input {
            padding: 8px 14px; border: 1px solid var(--border); border-radius: var(--radius);
            background: rgba(0,0,0,0.3); color: var(--text); font-size: 13px; outline: none;
            width: 200px; transition: all 0.15s;
        }
        .search-input:focus { border-color: var(--primary); width: 260px; }
        .search-lg { width: 100%; padding: 12px 16px; font-size: 14px; }

        /* Filter */
        .filter-bar { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
        .filter-label { font-size: 13px; color: var(--text-muted); }
        .filter-select { width: auto; padding: 6px 12px; font-size: 13px; }

        /* Modal */
        .modal-overlay {
            position: fixed; inset: 0; background: rgba(0,0,0,0.6);
            backdrop-filter: blur(4px); display: flex; align-items: center;
            justify-content: center; z-index: 100;
        }
        .modal {
            background: #1a1a2e; border: 1px solid var(--border); border-radius: 16px;
            max-width: 500px; width: 90%; max-height: 80vh; overflow-y: auto;
        }
        .modal-header {
            display: flex; align-items: center; justify-content: space-between;
            padding: 20px 24px; border-bottom: 1px solid var(--border);
        }
        .modal-header h3 { font-size: 18px; font-weight: 600; }
        .modal-close {
            width: 32px; height: 32px; display: flex; align-items: center;
            justify-content: center; border: none; border-radius: 8px;
            background: transparent; color: var(--text-muted); font-size: 20px;
            cursor: pointer;
        }
        .modal-close:hover { background: var(--bg-card); }
        .modal-body { padding: 24px; }

        /* Hero */
        .hero-section {
            text-align: center; padding: 60px 20px; background: linear-gradient(135deg, rgba(99,102,241,0.1), rgba(168,85,247,0.1));
            border-radius: var(--radius); border: 1px solid var(--border);
        }
        .hero-title { font-size: 32px; font-weight: 800; margin-bottom: 12px; }
        .hero-subtitle { font-size: 16px; color: var(--text-muted); }

        /* Toast */
        .toast-container {
            position: fixed; bottom: 20px; right: 20px; display: flex;
            flex-direction: column; gap: 8px; z-index: 200;
        }
        .toast {
            padding: 12px 20px; border-radius: var(--radius); font-size: 13px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3); animation: toastIn 0.3s ease;
            border: 1px solid var(--border); background: #1a1a2e;
        }
        .toast-success { border-color: rgba(34,197,94,0.3); }
        .toast-error { border-color: rgba(239,68,68,0.3); }
        @keyframes toastIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

        /* Empty */
        .empty-page { text-align: center; padding: 40px; color: var(--text-muted); }

        /* Scrollbar */
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }

        @media (max-width: 768px) {
            .sidebar { width: 60px; }
            .sidebar .nav-label, .sidebar .app-name, .sidebar .user-details,
            .sidebar .role-switcher, .sidebar .sidebar-footer .btn { display: none; }
            .main-content { margin-left: 60px; padding: 16px; }
            .cols-3, .cols-4 { grid-template-columns: repeat(2, 1fr); }
        }
    `;
}

/**
 * Generate all JavaScript for the rendered app.
 */
function getAppScript(roles, entities, pages, apiEndpoints) {
    return `
    // --- App State ---
    const appState = {
        currentPage: '${pages[0]?.path || '/dashboard'}',
        currentRole: '${roles[0]?.name || 'user'}',
        user: { name: 'Demo User', email: 'demo@example.com', role: '${roles[0]?.name || 'user'}' },
        data: {},
    };

    // --- Initialize ---
    function initApp() {
        // Initialize data store for each entity
        ${entities.map(e => `appState.data['${e.name}'] = [];`).join('\n        ')}

        // Set initial page
        const hash = window.location.hash.replace('#', '') || appState.currentPage;
        navigateTo(hash);

        // Init charts
        setTimeout(initCharts, 500);

        // Init stat counters
        animateStats();

        // Set user info
        updateUserInfo();
    }

    // --- Navigation ---
    function navigateTo(path) {
        appState.currentPage = path;
        window.location.hash = path;

        // Hide all pages
        document.querySelectorAll('.page').forEach(p => p.style.display = 'none');

        // Show target page
        const target = document.querySelector('.page[data-page="' + path + '"]');
        if (target) {
            // Check role access
            const requiredRole = target.dataset.role;
            if (requiredRole && !hasRole(requiredRole)) {
                showToast('Access denied. Required role: ' + requiredRole, 'error');
                navigateTo('/dashboard');
                return;
            }
            target.style.display = 'block';
        } else {
            // Fallback to first page
            const first = document.querySelector('.page');
            if (first) first.style.display = 'block';
        }

        // Update active nav
        document.querySelectorAll('.nav-item').forEach(n => {
            n.classList.toggle('active', n.dataset.path === path);
        });

        // Update visibility based on role
        updateRoleVisibility();
    }

    // --- Role Management ---
    function switchRole(role) {
        appState.currentRole = role;
        appState.user.role = role;
        updateUserInfo();
        updateRoleVisibility();
        showToast('Switched to role: ' + role, 'success');
    }

    function hasRole(requiredRole) {
        const roleHierarchy = ${JSON.stringify(roles.map(r => r.name))};
        const currentIdx = roleHierarchy.indexOf(appState.currentRole);
        const requiredIdx = roleHierarchy.indexOf(requiredRole);
        // Higher index = more permissions in our hierarchy
        return currentIdx >= requiredIdx;
    }

    function updateRoleVisibility() {
        document.querySelectorAll('[data-role]').forEach(el => {
            const role = el.dataset.role;
            if (role && !hasRole(role)) {
                el.style.opacity = '0.3';
                el.style.pointerEvents = 'none';
            } else {
                el.style.opacity = '1';
                el.style.pointerEvents = 'auto';
            }
        });
    }

    function updateUserInfo() {
        const nameEl = document.getElementById('user-name');
        const roleEl = document.getElementById('user-role');
        const avatarEl = document.getElementById('user-avatar');
        if (nameEl) nameEl.textContent = appState.user.name;
        if (roleEl) roleEl.textContent = appState.currentRole;
        if (avatarEl) avatarEl.textContent = appState.user.name.charAt(0).toUpperCase();
    }

    // --- Auth ---
    function handleLogin(e) {
        e.preventDefault();
        const form = e.target;
        appState.user.email = form.email.value;
        showToast('Logged in successfully!', 'success');
        navigateTo('/dashboard');
    }

    function handleRegister(e) {
        e.preventDefault();
        const form = e.target;
        appState.user.name = form.name.value;
        appState.user.email = form.email.value;
        showToast('Account created!', 'success');
        navigateTo('/dashboard');
    }

    function handleLogout() {
        showToast('Logged out', 'success');
        navigateTo('/login');
    }

    // --- CRUD Operations ---
    function handleFormSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const entity = form.dataset.entity;
        const data = Object.fromEntries(new FormData(form));
        data.id = Date.now().toString();
        data.createdAt = new Date().toISOString();
        data.updatedAt = new Date().toISOString();

        if (!appState.data[entity]) appState.data[entity] = [];
        appState.data[entity].push(data);

        form.reset();
        showToast(entity + ' saved successfully!', 'success');
        refreshTables();
    }

    function handleModalSubmit(e, entity) {
        e.preventDefault();
        const form = e.target;
        const data = Object.fromEntries(new FormData(form));
        data.id = Date.now().toString();
        data.createdAt = new Date().toISOString();

        if (!appState.data[entity]) appState.data[entity] = [];
        appState.data[entity].push(data);

        form.reset();
        closeModal('add-' + entity.toLowerCase());
        showToast(entity + ' added!', 'success');
        refreshTables();
    }

    function viewRecord(id) { showToast('Viewing record #' + id, 'success'); }
    function editRecord(id) { showToast('Editing record #' + id, 'success'); }
    function deleteRecord(id) {
        if (confirm('Delete this record?')) {
            showToast('Record deleted', 'success');
        }
    }

    function refreshTables() {
        // Tables are populated with sample data; in a real app, this would re-render
    }

    // --- Modal ---
    function openModal(id) {
        const modal = document.getElementById('modal-' + id);
        if (modal) modal.style.display = 'flex';
    }

    function closeModal(id) {
        const modal = document.getElementById('modal-' + id);
        if (modal) modal.style.display = 'none';
    }

    // --- Search & Filter ---
    function filterTable(input) {
        const query = input.value.toLowerCase();
        const table = input.closest('.data-table-card')?.querySelector('tbody');
        if (!table) return;
        table.querySelectorAll('tr').forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(query) ? '' : 'none';
        });
    }

    function handleSearch(value) { /* global search */ }
    function handleFilter(value) { /* filter handler */ }

    // --- Charts ---
    function initCharts() {
        document.querySelectorAll('.chart-container').forEach(container => {
            const type = container.dataset.chartType || 'bar';
            if (type === 'bar' || type === 'line') {
                renderBarChart(container);
            } else if (type === 'pie' || type === 'donut') {
                renderPieChart(container);
            }
        });
    }

    function renderBarChart(container) {
        const canvas = container.querySelector('canvas');
        if (canvas) canvas.remove();

        const data = [65, 45, 80, 55, 90, 70, 85, 60, 75, 50, 95, 40];
        const labels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const maxVal = Math.max(...data);

        container.innerHTML = '';
        container.style.display = 'flex';
        container.style.alignItems = 'flex-end';
        container.style.gap = '8px';
        container.style.paddingTop = '16px';
        container.style.paddingBottom = '24px';

        data.forEach((val, i) => {
            const bar = document.createElement('div');
            bar.className = 'chart-bar';
            bar.style.height = ((val / maxVal) * 180) + 'px';
            bar.title = labels[i] + ': ' + val;

            const label = document.createElement('span');
            label.className = 'chart-bar-label';
            label.textContent = labels[i];
            bar.appendChild(label);

            container.appendChild(bar);
        });
    }

    function renderPieChart(container) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">📊 Chart visualization</div>';
    }

    // --- Stats Animation ---
    function animateStats() {
        document.querySelectorAll('.stat-value').forEach(el => {
            const targets = { 'Total': 1247, 'Active': 856, 'Revenue': 48290, 'Growth': 23 };
            const label = el.dataset.stat || el.textContent;
            let target = 0;

            for (const [key, val] of Object.entries(targets)) {
                if (label.toLowerCase().includes(key.toLowerCase())) { target = val; break; }
            }
            if (target === 0) target = Math.floor(Math.random() * 500) + 50;

            let current = 0;
            const step = Math.ceil(target / 30);
            const interval = setInterval(() => {
                current += step;
                if (current >= target) { current = target; clearInterval(interval); }
                el.textContent = current.toLocaleString();
            }, 30);
        });
    }

    // --- Toast ---
    function showToast(message, type) {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = 'toast toast-' + (type || 'info');
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // --- Init ---
    document.addEventListener('DOMContentLoaded', initApp);
    window.addEventListener('hashchange', () => navigateTo(window.location.hash.replace('#', '')));
    `;
}

function getNavIcon(name) {
    const icons = {
        home: '🏠', users: '👥', settings: '⚙️', chart: '📊',
        'credit-card': '💳', box: '📦', mail: '✉️', calendar: '📅',
        shield: '🛡️', folder: '📁', star: '⭐', bell: '🔔',
    };
    return icons[name] || '📋';
}

function formatLabel(name) {
    return name.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase()).trim();
}

function getPageTemplate() {
    return ''; // unused - pages are rendered inline
}

module.exports = { getAppShell, getPageTemplate };
