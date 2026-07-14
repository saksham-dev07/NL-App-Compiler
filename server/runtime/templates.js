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
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Inter:wght@400;500;600&display=swap');

        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        :root {
            /* Theme Colors */
            --primary: ${theme.primaryColor};
            --primary-glow: color-mix(in srgb, var(--primary) 40%, transparent);
            --secondary: ${theme.secondaryColor};
            --accent: ${theme.accentColor};
            
            /* Background & Surfaces (Glassmorphism Base) */
            --bg-base: #0a0a0f;
            --bg-surface: rgba(20, 20, 30, 0.4);
            --bg-surface-hover: rgba(30, 30, 45, 0.6);
            --bg-glass: rgba(255, 255, 255, 0.03);
            
            /* Typography */
            --text-main: #ffffff;
            --text-muted: #94a3b8;
            --font-display: 'Outfit', sans-serif;
            --font-body: 'Inter', sans-serif;
            
            /* Borders & Shadows */
            --border: rgba(255, 255, 255, 0.08);
            --border-light: rgba(255, 255, 255, 0.15);
            --radius-lg: 24px;
            --radius-md: 16px;
            --radius-sm: 8px;
            --shadow-glass: 0 8px 32px 0 rgba(0, 0, 0, 0.4);
            
            /* Status Colors */
            --success: #10b981;
            --warning: #f59e0b;
            --danger: #ef4444;
            
            --sidebar-width: 280px;
        }

        /* Base Body */
        body {
            font-family: var(--font-body);
            background: var(--bg-base);
            background-image: 
                radial-gradient(circle at 15% 50%, color-mix(in srgb, var(--primary) 15%, transparent), transparent 40%),
                radial-gradient(circle at 85% 30%, color-mix(in srgb, var(--secondary) 15%, transparent), transparent 40%);
            background-attachment: fixed;
            color: var(--text-main);
            display: flex;
            min-height: 100vh;
            -webkit-font-smoothing: antialiased;
        }

        h1, h2, h3, h4, h5, h6, .brand, .stat-value {
            font-family: var(--font-display);
        }

        /* Glassmorphism Utilities */
        .glass-panel {
            background: var(--bg-glass);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border: 1px solid var(--border);
            box-shadow: var(--shadow-glass);
        }

        /* Animations */
        @keyframes fadeSlideUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulseGlow {
            0% { box-shadow: 0 0 0 0 var(--primary-glow); }
            70% { box-shadow: 0 0 0 10px transparent; }
            100% { box-shadow: 0 0 0 0 transparent; }
        }
        
        .page-body > * {
            animation: fadeSlideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            opacity: 0;
        }
        .page-body > *:nth-child(1) { animation-delay: 0.1s; }
        .page-body > *:nth-child(2) { animation-delay: 0.2s; }
        .page-body > *:nth-child(3) { animation-delay: 0.3s; }

        /* Sidebar */
        .sidebar {
            width: var(--sidebar-width);
            background: rgba(10, 10, 15, 0.6);
            backdrop-filter: blur(20px);
            border-right: 1px solid var(--border);
            display: flex;
            flex-direction: column;
            position: fixed;
            top: 0; bottom: 0; left: 0;
            z-index: 50;
        }
        
        .sidebar-header {
            padding: 28px 24px;
            display: flex;
            align-items: center;
            gap: 16px;
        }
        
        .app-logo {
            width: 42px; height: 42px;
            border-radius: 12px;
            background: linear-gradient(135deg, var(--primary), var(--secondary));
            display: flex; align-items: center; justify-content: center;
            font-family: var(--font-display); font-weight: 800; font-size: 20px;
            color: white;
            box-shadow: 0 4px 20px var(--primary-glow);
        }
        
        .app-name {
            font-family: var(--font-display); font-size: 20px; font-weight: 700;
            letter-spacing: -0.03em;
            background: linear-gradient(to right, #fff, #94a3b8);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .sidebar-nav {
            flex: 1; padding: 0 16px; overflow-y: auto;
            display: flex; flex-direction: column; gap: 4px;
        }

        .nav-item {
            display: flex; align-items: center; gap: 14px;
            padding: 12px 16px; border-radius: var(--radius-md);
            color: var(--text-muted); text-decoration: none;
            font-size: 15px; font-weight: 500;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .nav-item:hover {
            color: var(--text-main);
            background: var(--bg-surface);
            transform: translateX(4px);
        }
        .nav-item.active {
            background: linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.02));
            color: var(--text-main);
            border: 1px solid var(--border-light);
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }
        
        .sidebar-footer {
            padding: 24px;
            border-top: 1px solid var(--border);
            display: flex; flex-direction: column; gap: 16px;
        }
        .user-info { display: flex; align-items: center; gap: 12px; }
        .user-avatar {
            width: 40px; height: 40px; border-radius: 50%;
            background: linear-gradient(135deg, var(--secondary), var(--accent));
            display: flex; align-items: center; justify-content: center;
            font-family: var(--font-display); font-weight: 700;
        }
        .user-details { display: flex; flex-direction: column; }
        .user-name { font-size: 14px; font-weight: 600; }
        .user-role { font-size: 12px; color: var(--primary); font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; }

        /* Main Content */
        .main-content {
            margin-left: var(--sidebar-width);
            flex: 1; padding: 40px 48px;
            max-width: 1600px;
        }

        .page-header {
            margin-bottom: 40px;
        }
        .page-title {
            font-size: 36px; font-weight: 800; letter-spacing: -0.04em;
            margin-bottom: 8px;
        }

        /* Grid Layout */
        .section-grid { display: grid; gap: 24px; }
        .cols-1 { grid-template-columns: 1fr; }
        .cols-2 { grid-template-columns: repeat(2, 1fr); }
        .cols-3 { grid-template-columns: repeat(3, 1fr); }
        .cols-4 { grid-template-columns: repeat(4, 1fr); }

        /* Premium Cards */
        .card {
            background: var(--bg-surface);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid var(--border);
            border-radius: var(--radius-lg);
            padding: 28px;
            transition: all 0.3s ease;
            position: relative;
            overflow: hidden;
        }
        .card::before {
            content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
            opacity: 0; transition: opacity 0.3s ease;
        }
        .card:hover {
            transform: translateY(-4px);
            border-color: var(--border-light);
            box-shadow: 0 12px 40px rgba(0,0,0,0.4);
            background: var(--bg-surface-hover);
        }
        .card:hover::before { opacity: 1; }

        .card-title { font-size: 18px; font-weight: 600; margin-bottom: 20px; font-family: var(--font-display); }

        /* Stat Cards */
        .stat-card { display: flex; align-items: center; gap: 20px; }
        .stat-icon-wrap {
            width: 56px; height: 56px; border-radius: 16px;
            background: linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.0));
            border: 1px solid var(--border-light);
            display: flex; align-items: center; justify-content: center;
            font-size: 24px; color: var(--primary);
            box-shadow: inset 0 0 20px rgba(255,255,255,0.05);
        }
        .stat-value { font-size: 36px; font-weight: 800; line-height: 1.1; margin-bottom: 4px; }
        .stat-label { font-size: 14px; color: var(--text-muted); font-weight: 500; }
        .stat-trend { font-size: 13px; color: var(--success); font-weight: 600; display: flex; align-items: center; gap: 4px; background: rgba(16,185,129,0.1); padding: 4px 8px; border-radius: 20px; margin-left: auto; }

        /* Data Tables */
        .data-table-card { padding: 0; }
        .table-header { padding: 24px 28px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); }
        .data-table { width: 100%; border-collapse: collapse; text-align: left; }
        .data-table th {
            padding: 16px 28px; font-size: 12px; font-weight: 600; text-transform: uppercase;
            letter-spacing: 0.1em; color: var(--text-muted); background: rgba(0,0,0,0.2);
        }
        .data-table td { padding: 18px 28px; border-bottom: 1px solid var(--border); font-size: 14px; }
        .data-table tr { transition: background 0.2s; }
        .data-table tr:hover { background: rgba(255,255,255,0.03); }
        
        .status-pill {
            display: inline-block; padding: 6px 12px; border-radius: 20px;
            font-size: 12px; font-weight: 600; text-transform: capitalize;
            background: rgba(255,255,255,0.1); border: 1px solid var(--border);
        }
        .status-active { color: var(--success); background: rgba(16,185,129,0.1); border-color: rgba(16,185,129,0.2); }

        /* Buttons */
        .btn {
            padding: 10px 20px; border-radius: var(--radius-sm); border: none;
            font-family: var(--font-body); font-size: 14px; font-weight: 600;
            cursor: pointer; transition: all 0.2s ease; display: inline-flex; align-items: center; gap: 8px;
            position: relative; overflow: hidden;
        }
        .btn-primary {
            background: linear-gradient(135deg, var(--primary), var(--secondary));
            color: white; box-shadow: 0 4px 14px var(--primary-glow);
        }
        .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px var(--primary-glow);
        }
        .btn-secondary {
            background: rgba(255,255,255,0.05); color: var(--text-main); border: 1px solid var(--border);
        }
        .btn-secondary:hover { background: rgba(255,255,255,0.1); }

        /* Inputs & Forms */
        .form-label { display: block; font-size: 13px; font-weight: 500; color: var(--text-muted); margin-bottom: 8px; }
        .form-control {
            width: 100%; padding: 12px 16px; border-radius: var(--radius-sm);
            background: rgba(0,0,0,0.2); border: 1px solid var(--border);
            color: white; font-family: inherit; font-size: 14px; transition: all 0.2s;
        }
        .form-control:focus {
            outline: none; border-color: var(--primary); background: rgba(0,0,0,0.4);
            box-shadow: 0 0 0 4px var(--primary-glow);
        }

        /* Search Bar */
        .search-input-wrapper { position: relative; }
        .search-input {
            width: 240px; padding: 10px 16px 10px 40px;
            background: rgba(0,0,0,0.3) url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="%2394a3b8" viewBox="0 0 16 16"><path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/></svg>') no-repeat 14px center;
            border-radius: 20px; transition: width 0.3s;
        }
        .search-input:focus { width: 300px; }

        /* Auth Layout */
        .auth-layout { min-height: 80vh; display: flex; align-items: center; justify-content: center; }
        .auth-card {
            background: var(--bg-surface); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
            border: 1px solid var(--border-light); border-radius: var(--radius-lg);
            padding: 48px; width: 100%; max-width: 440px; text-align: center;
            box-shadow: 0 24px 80px rgba(0,0,0,0.5);
        }
        .auth-title { font-size: 32px; font-weight: 800; letter-spacing: -0.04em; margin-bottom: 8px; }

        /* Restored Component Styles */
        .section { margin-bottom: 32px; }
        .section-title { font-size: 20px; font-weight: 700; margin-bottom: 20px; color: var(--text-main); font-family: var(--font-display); }
        
        .card-desc { font-size: 14px; color: var(--text-muted); line-height: 1.5; }
        
        .table-title { font-size: 18px; font-weight: 600; font-family: var(--font-display); }
        .table-actions { display: flex; gap: 12px; align-items: center; }
        .table-wrapper { overflow-x: auto; width: 100%; }
        .table-footer { display: flex; align-items: center; justify-content: space-between; padding: 16px 28px; border-top: 1px solid var(--border); }
        .pagination { display: flex; align-items: center; gap: 8px; }
        .page-info { font-size: 14px; color: var(--text-muted); }

        .chart-card .chart-container { height: 240px; display: flex; align-items: flex-end; gap: 12px; padding-top: 24px; }
        .chart-bar { flex: 1; border-radius: 6px 6px 0 0; background: linear-gradient(to top, var(--primary), var(--secondary)); position: relative; transition: all 0.3s; min-height: 20px; box-shadow: 0 0 20px var(--primary-glow); }
        .chart-bar:hover { opacity: 0.8; transform: scaleY(1.05); }
        .chart-bar-label { position: absolute; bottom: -24px; left: 50%; transform: translateX(-50%); font-size: 11px; color: var(--text-muted); white-space: nowrap; font-weight: 500; }

        .activity-list { display: flex; flex-direction: column; gap: 16px; }
        .activity-item { display: flex; align-items: center; gap: 14px; padding: 12px; border-radius: var(--radius-sm); background: rgba(0,0,0,0.2); border: 1px solid var(--border); transition: transform 0.2s; }
        .activity-item:hover { transform: translateX(4px); border-color: var(--border-light); }
        .activity-dot { width: 10px; height: 10px; border-radius: 50%; background: var(--primary); box-shadow: 0 0 10px var(--primary); flex-shrink: 0; }
        .activity-time { margin-left: auto; font-size: 12px; color: var(--text-muted); font-weight: 500; }

        .detail-row { display: flex; justify-content: space-between; padding: 14px 0; border-bottom: 1px dashed var(--border); font-size: 15px; }
        .detail-row:last-child { border-bottom: none; }
        .detail-label { color: var(--text-muted); font-weight: 500; }

        .profile-card { text-align: center; }
        .profile-avatar { font-size: 64px; margin-bottom: 16px; filter: drop-shadow(0 4px 12px rgba(0,0,0,0.4)); }
        .profile-name { font-size: 22px; font-weight: 700; font-family: var(--font-display); margin: 0; }
        .profile-role { font-size: 14px; color: var(--primary); margin-bottom: 24px; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 600; }
        .profile-stats { display: flex; justify-content: center; gap: 40px; }
        .profile-stat { text-align: center; }
        .profile-stat-value { display: block; font-size: 24px; font-weight: 800; font-family: var(--font-display); }
        .profile-stat-label { font-size: 13px; color: var(--text-muted); font-weight: 500; }

        .kanban-columns { display: flex; gap: 20px; overflow-x: auto; padding-bottom: 12px; }
        .kanban-column { flex: 1; min-width: 280px; background: rgba(0,0,0,0.3); border-radius: var(--radius-md); padding: 16px; border: 1px solid var(--border); }
        .kanban-column h4 { font-size: 14px; font-weight: 600; margin-bottom: 16px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-top: 0; }
        .kanban-items { min-height: 120px; display: flex; flex-direction: column; gap: 12px; }

        .filter-bar { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
        .filter-label { font-size: 14px; color: var(--text-muted); font-weight: 500; }
        .filter-select { width: auto; padding: 8px 16px; border-radius: 20px; }

        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 100; opacity: 1; animation: fadeSlideUp 0.3s; }
        .modal { background: var(--bg-surface); border: 1px solid var(--border-light); border-radius: var(--radius-lg); max-width: 540px; width: 90%; max-height: 85vh; overflow-y: auto; box-shadow: 0 24px 80px rgba(0,0,0,0.6); }
        .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 24px 32px; border-bottom: 1px solid var(--border); }
        .modal-header h3 { font-size: 20px; font-weight: 700; font-family: var(--font-display); margin: 0; }
        .modal-close { width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border: none; border-radius: 10px; background: rgba(255,255,255,0.05); color: var(--text-muted); font-size: 24px; cursor: pointer; transition: all 0.2s; }
        .modal-close:hover { background: rgba(255,255,255,0.1); color: white; transform: rotate(90deg); }
        .modal-body { padding: 32px; }

        .hero-section { text-align: center; padding: 80px 40px; background: linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.01)); border-radius: var(--radius-lg); border: 1px solid var(--border-light); position: relative; overflow: hidden; }
        .hero-section::before { content: ''; position: absolute; inset: 0; background: radial-gradient(circle at center, var(--primary-glow), transparent 70%); opacity: 0.5; pointer-events: none; }
        .hero-title { font-size: 42px; font-weight: 800; margin-bottom: 16px; font-family: var(--font-display); letter-spacing: -0.04em; margin-top: 0; }
        .hero-subtitle { font-size: 18px; color: var(--text-muted); line-height: 1.6; max-width: 600px; margin: 0 auto; }

        .toast-container { position: fixed; bottom: 32px; right: 32px; display: flex; flex-direction: column; gap: 12px; z-index: 200; }
        .toast { padding: 16px 24px; border-radius: var(--radius-md); font-size: 14px; font-weight: 500; box-shadow: 0 12px 40px rgba(0,0,0,0.4); border: 1px solid var(--border-light); background: var(--bg-surface); backdrop-filter: blur(16px); color: white; }
        .toast-success { border-color: rgba(16,185,129,0.4); box-shadow: 0 12px 40px rgba(16,185,129,0.2); }
        .toast-error { border-color: rgba(239,68,68,0.4); box-shadow: 0 12px 40px rgba(239,68,68,0.2); }
        
        .empty-page { text-align: center; padding: 60px; color: var(--text-muted); font-size: 16px; }

        /* Scrollbar */
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: rgba(0,0,0,0.1); }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.25); }
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
