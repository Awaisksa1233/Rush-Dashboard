import json
from datetime import datetime, timezone
from typing import Dict, Any

def login_html() -> str:
    return """<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RUSH &bull; WhatsApp Live Hub &mdash; Sign In</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
            --wa-bg-deep: #0c1317;
            --wa-panel-bg: #111b21;
            --wa-surface: #202c33;
            --wa-border: #222e35;
            --wa-green: #00a884;
            --wa-green-bright: #25d366;
            --wa-text-primary: #e9edef;
            --wa-text-secondary: #8696a0;
            --rush-red: #c91e2f;
        }
        body {
            font-family: 'Inter', 'Cairo', -apple-system, BlinkMacSystemFont, sans-serif;
            background-color: var(--wa-bg-deep);
            background-image: 
                radial-gradient(circle at 50% 0%, rgba(0, 168, 132, 0.15) 0%, transparent 60%),
                radial-gradient(circle at 90% 90%, rgba(201, 30, 47, 0.08) 0%, transparent 50%);
            color: var(--wa-text-primary);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
        }
        .login-card {
            background: rgba(17, 27, 33, 0.95);
            border: 1px solid var(--wa-border);
            border-radius: 20px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 40px rgba(0, 168, 132, 0.12);
            width: 100%;
            max-width: 420px;
            padding: 40px 36px;
            backdrop-filter: blur(16px);
            position: relative;
            overflow: hidden;
        }
        .login-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: linear-gradient(90deg, var(--rush-red), var(--wa-green-bright));
        }
        .brand-header {
            text-align: center;
            margin-bottom: 30px;
        }
        .logo-wrap {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            margin-bottom: 16px;
        }
        .brand-badge {
            background: var(--rush-red);
            color: white;
            font-weight: 800;
            padding: 6px 12px;
            border-radius: 8px;
            font-size: 14px;
            letter-spacing: 1.5px;
            box-shadow: 0 4px 12px rgba(201, 30, 47, 0.35);
        }
        .wa-badge-icon {
            width: 32px;
            height: 32px;
            background: #25d366;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            box-shadow: 0 4px 14px rgba(37, 211, 102, 0.35);
        }
        .brand-title {
            font-size: 22px;
            font-weight: 700;
            color: #ffffff;
            letter-spacing: -0.5px;
            margin-bottom: 6px;
        }
        .brand-subtitle {
            font-size: 13.5px;
            color: var(--wa-text-secondary);
        }
        .form-group {
            margin-bottom: 20px;
        }
        .form-label {
            display: block;
            font-size: 12px;
            font-weight: 600;
            color: var(--wa-text-secondary);
            margin-bottom: 8px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .form-input {
            width: 100%;
            background: var(--wa-surface);
            border: 1px solid var(--wa-border);
            padding: 13px 16px;
            border-radius: 10px;
            color: #ffffff;
            font-size: 14.5px;
            outline: none;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            font-family: inherit;
        }
        .form-input:focus {
            border-color: var(--wa-green);
            background: #2a3942;
            box-shadow: 0 0 0 3px rgba(0, 168, 132, 0.25);
        }
        .error-alert {
            display: none;
            background: rgba(241, 92, 109, 0.15);
            border: 1px solid rgba(241, 92, 109, 0.35);
            color: #ff8b99;
            padding: 12px 16px;
            border-radius: 10px;
            font-size: 13px;
            margin-bottom: 20px;
            text-align: center;
        }
        .btn-submit {
            width: 100%;
            background: linear-gradient(135deg, #00a884 0%, #008f6f 100%);
            color: white;
            border: none;
            padding: 14px;
            border-radius: 10px;
            font-size: 15px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
            box-shadow: 0 4px 14px rgba(0, 168, 132, 0.35);
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            margin-top: 10px;
        }
        .btn-submit:hover {
            background: linear-gradient(135deg, #25d366 0%, #00a884 100%);
            box-shadow: 0 6px 20px rgba(37, 211, 102, 0.45);
            transform: translateY(-1px);
        }
        .btn-submit:active {
            transform: translateY(0);
        }
        .btn-submit:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
        }
        .footer-hint {
            text-align: center;
            font-size: 12px;
            color: var(--wa-text-secondary);
            margin-top: 26px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
        }
    </style>
</head>
<body>
    <div class="login-card">
        <div class="brand-header">
            <div class="logo-wrap">
                <span class="brand-badge">RUSH</span>
                <div class="wa-badge-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2zm0 18.15c-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.19 8.19 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.83c.01 4.54-3.69 8.23-8.22 8.23zm4.52-6.17c-.25-.12-1.47-.72-1.69-.81-.23-.09-.39-.12-.56.12-.17.25-.64.81-.79.97-.14.17-.29.18-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.15.17-.25.25-.42.08-.17.04-.31-.02-.43s-.56-1.34-.76-1.84c-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.22.25-.86.84-.86 2.05s.88 2.38 1 2.55c.12.17 1.73 2.65 4.2 3.71.59.25 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.07-.1-.23-.17-.47-.29z"/>
                    </svg>
                </div>
            </div>
            <h1 class="brand-title">WhatsApp Live Hub</h1>
            <p class="brand-subtitle">Sign in to manage live chats, templates & delivery reports</p>
        </div>

        <div class="error-alert" id="error-box"></div>

        <form id="login-form" onsubmit="handleLogin(event)">
            <div class="form-group">
                <label class="form-label">Username</label>
                <input type="text" class="form-input" id="username" autocomplete="username" required autofocus placeholder="Enter administrator username">
            </div>

            <div class="form-group">
                <label class="form-label">Password</label>
                <input type="password" class="form-input" id="password" autocomplete="current-password" required placeholder="Enter password">
            </div>

            <button type="submit" class="btn-submit" id="submit-btn">
                <span>Sign In to Hub</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>
            </button>
        </form>

        <div class="footer-hint">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
            <span>RUSH Car Wash &bull; Secure WhatsApp Gateway</span>
        </div>
    </div>

    <script>
        async function handleLogin(e) {
            e.preventDefault();
            const btn = document.getElementById('submit-btn');
            const errBox = document.getElementById('error-box');
            const user = document.getElementById('username').value.trim();
            const pass = document.getElementById('password').value;

            errBox.style.display = 'none';
            btn.disabled = true;
            btn.innerHTML = '<span>Signing in...</span>';

            try {
                const res = await fetch('/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: user, password: pass })
                });
                const data = await res.json();
                if (res.ok && data.success) {
                    window.location.href = data.redirect || '/';
                } else {
                    errBox.innerText = data.error || 'Invalid username or password.';
                    errBox.style.display = 'block';
                    btn.disabled = false;
                    btn.innerHTML = '<span>Sign In to Hub</span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>';
                }
            } catch (err) {
                errBox.innerText = 'Network connection error. Please try again.';
                errBox.style.display = 'block';
                btn.disabled = false;
                btn.innerHTML = '<span>Sign In to Hub</span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>';
            }
        }
    </script>
</body>
</html>"""


def full_solution_ui(public_https_url: str, unifonic_public_id: str, unifonic_channel_id: str) -> str:
    """Renders the complete modern WhatsApp Web interface for Live Chats, Delivery Reports, and Webhook stream."""
    return f"""<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RUSH &bull; WhatsApp Live Hub & Delivery Reports</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        * {{ box-sizing: border-box; margin: 0; padding: 0; }}
        :root {{
            --wa-bg-deep: #0c1317;
            --wa-panel-bg: #111b21;
            --wa-sidebar-bg: #111b21;
            --wa-surface: #202c33;
            --wa-surface-hover: #182229;
            --wa-surface-active: #2a3942;
            --wa-border: #222e35;
            --wa-green-primary: #00a884;
            --wa-green-bright: #25d366;
            --wa-bubble-in: #202c33;
            --wa-bubble-out: #005c4b;
            --wa-text-primary: #e9edef;
            --wa-text-secondary: #8696a0;
            --wa-text-muted: #667781;
            --wa-blue-ticks: #53bdeb;
            --wa-red-alert: #f15c6d;
            --rush-red: #c91e2f;
        }}

        body {{
            font-family: 'Inter', 'Cairo', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background-color: var(--wa-bg-deep);
            color: var(--wa-text-primary);
            height: 100vh;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            user-select: none;
        }}

        /* Custom Modern Scrollbars */
        ::-webkit-scrollbar {{
            width: 6px;
            height: 6px;
        }}
        ::-webkit-scrollbar-track {{
            background: transparent;
        }}
        ::-webkit-scrollbar-thumb {{
            background: rgba(134, 150, 160, 0.25);
            border-radius: 3px;
        }}
        ::-webkit-scrollbar-thumb:hover {{
            background: rgba(134, 150, 160, 0.45);
        }}

        /* Top Navigation Bar */
        .topbar {{
            height: 58px;
            background: var(--wa-panel-bg);
            border-bottom: 1px solid var(--wa-border);
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 20px;
            flex-shrink: 0;
            z-index: 20;
        }}
        .brand-area {{
            display: flex;
            align-items: center;
            gap: 20px;
        }}
        .brand-logo-group {{
            display: flex;
            align-items: center;
            gap: 8px;
            text-decoration: none;
        }}
        .brand-pill-rush {{
            background: var(--rush-red);
            color: white;
            font-weight: 800;
            font-size: 13px;
            padding: 4px 9px;
            border-radius: 6px;
            letter-spacing: 1px;
            box-shadow: 0 2px 8px rgba(201, 30, 47, 0.4);
        }}
        .wa-logo-icon {{
            width: 26px;
            height: 26px;
            background: var(--wa-green-bright);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            box-shadow: 0 2px 10px rgba(37, 211, 102, 0.35);
        }}
        .brand-title-text {{
            font-size: 15px;
            font-weight: 700;
            color: #ffffff;
            letter-spacing: -0.3px;
            display: flex;
            align-items: center;
            gap: 6px;
        }}
        .brand-title-text span {{
            color: var(--wa-green-bright);
            font-size: 12px;
            font-weight: 600;
            background: rgba(37, 211, 102, 0.12);
            padding: 1px 6px;
            border-radius: 4px;
        }}

        .nav-tabs {{
            display: flex;
            gap: 4px;
            background: #0b141a;
            padding: 3px;
            border-radius: 10px;
            border: 1px solid var(--wa-border);
        }}
        .tab-btn {{
            background: transparent;
            color: var(--wa-text-secondary);
            border: none;
            padding: 7px 16px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 8px;
            transition: all 0.2s ease;
            font-family: inherit;
        }}
        .tab-btn:hover {{
            color: var(--wa-text-primary);
            background: rgba(255, 255, 255, 0.05);
        }}
        .tab-btn.active {{
            background: var(--wa-surface);
            color: var(--wa-green-bright);
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
        }}
        .tab-badge {{
            background: var(--wa-green-primary);
            color: #ffffff;
            font-size: 11px;
            font-weight: 700;
            padding: 1px 6px;
            border-radius: 10px;
        }}

        .top-meta {{
            display: flex;
            align-items: center;
            gap: 10px;
        }}
        .status-pill {{
            display: flex;
            align-items: center;
            gap: 7px;
            background: rgba(0, 168, 132, 0.12);
            border: 1px solid rgba(0, 168, 132, 0.3);
            color: #4ade80;
            padding: 5px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
        }}
        .status-dot {{
            width: 8px;
            height: 8px;
            background: #22c55e;
            border-radius: 50%;
            box-shadow: 0 0 8px #22c55e;
            animation: pulse-dot 2s infinite ease-in-out;
        }}
        @keyframes pulse-dot {{
            0% {{ opacity: 1; transform: scale(1); }}
            50% {{ opacity: 0.4; transform: scale(0.85); }}
            100% {{ opacity: 1; transform: scale(1); }}
        }}

        .btn-action {{
            background: var(--wa-surface);
            color: var(--wa-text-primary);
            border: 1px solid var(--wa-border);
            padding: 7px 12px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 12.5px;
            font-weight: 600;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            transition: all 0.15s ease;
            font-family: inherit;
        }}
        .btn-action:hover {{
            background: var(--wa-surface-active);
            border-color: #3b4a54;
            color: #ffffff;
        }}
        .btn-action-primary {{
            background: var(--wa-green-primary);
            color: white;
            border-color: #008f6f;
        }}
        .btn-action-primary:hover {{
            background: var(--wa-green-bright);
            color: #0b141a;
            border-color: var(--wa-green-bright);
        }}
        .btn-action-logout {{
            color: #f87171;
            border-color: rgba(248, 113, 113, 0.3);
            text-decoration: none;
        }}
        .btn-action-logout:hover {{
            background: rgba(248, 113, 113, 0.15);
            color: #ff9999;
        }}

        /* Tab Content Views */
        .tab-content {{
            display: none;
            flex: 1;
            overflow: hidden;
            height: calc(100vh - 58px);
        }}
        .tab-content.active {{
            display: flex;
        }}

        /* ========================================================================= */
        /* 1. CHATS TAB — AUTHENTIC WHATSAPP WEB EXPERIENCE                          */
        /* ========================================================================= */
        .chat-layout {{
            display: flex;
            width: 100%;
            height: 100%;
            overflow: hidden;
        }}

        /* Sidebar */
        .sidebar {{
            width: 380px;
            min-width: 330px;
            max-width: 420px;
            background: var(--wa-sidebar-bg);
            border-right: 1px solid var(--wa-border);
            display: flex;
            flex-direction: column;
            flex-shrink: 0;
            overflow: hidden;
        }}
        .sidebar-header {{
            padding: 12px 16px;
            background: var(--wa-panel-bg);
            display: flex;
            flex-direction: column;
            gap: 10px;
            border-bottom: 1px solid var(--wa-border);
            flex-shrink: 0;
        }}
        .sidebar-top-row {{
            display: flex;
            align-items: center;
            justify-content: space-between;
        }}
        .sidebar-title {{
            font-size: 15px;
            font-weight: 700;
            color: #ffffff;
            display: flex;
            align-items: center;
            gap: 8px;
        }}
        .sidebar-title-count {{
            background: var(--wa-surface);
            color: var(--wa-text-secondary);
            font-size: 11px;
            font-weight: 700;
            padding: 2px 7px;
            border-radius: 12px;
        }}
        .sidebar-filter-pills {{
            display: flex;
            gap: 4px;
        }}
        .filter-pill-btn {{
            background: var(--wa-surface);
            border: 1px solid transparent;
            color: var(--wa-text-secondary);
            padding: 4px 10px;
            border-radius: 14px;
            font-size: 11.5px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.15s ease;
        }}
        .filter-pill-btn:hover {{
            background: var(--wa-surface-active);
            color: var(--wa-text-primary);
        }}
        .filter-pill-btn.active {{
            background: rgba(0, 168, 132, 0.2);
            color: var(--wa-green-bright);
            border-color: rgba(0, 168, 132, 0.4);
        }}

        .sidebar-search-box {{
            display: flex;
            align-items: center;
            background: var(--wa-surface);
            border: 1px solid var(--wa-border);
            border-radius: 8px;
            padding: 6px 12px;
            color: var(--wa-text-secondary);
            transition: border-color 0.2s;
        }}
        .sidebar-search-box:focus-within {{
            border-color: var(--wa-green-primary);
            background: #2a3942;
        }}
        .sidebar-search-box input {{
            background: transparent;
            border: none;
            outline: none;
            color: var(--wa-text-primary);
            font-size: 13.5px;
            width: 100%;
            margin-left: 8px;
            font-family: inherit;
        }}
        .sidebar-search-box input::placeholder {{
            color: var(--wa-text-muted);
        }}
        .search-clear-btn {{
            background: transparent;
            border: none;
            color: var(--wa-text-muted);
            cursor: pointer;
            display: none;
            font-size: 14px;
        }}

        .conv-list {{
            flex: 1;
            overflow-y: auto;
            overflow-x: hidden;
            background: var(--wa-sidebar-bg);
        }}
        .conv-item {{
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px 16px;
            border-bottom: 1px solid rgba(34, 46, 53, 0.6);
            cursor: pointer;
            transition: background 0.12s ease;
            position: relative;
        }}
        .conv-item:hover {{
            background: var(--wa-surface-hover);
        }}
        .conv-item.active {{
            background: var(--wa-surface-active);
        }}
        .conv-item.active::before {{
            content: '';
            position: absolute;
            left: 0;
            top: 0;
            bottom: 0;
            width: 4px;
            background: var(--wa-green-bright);
        }}
        [dir="rtl"] .conv-item.active::before {{
            left: auto;
            right: 0;
        }}
        [dir="rtl"] .sidebar {{
            border-right: none;
            border-left: 1px solid var(--wa-border);
        }}

        .avatar-wrap {{
            position: relative;
            flex-shrink: 0;
        }}
        .avatar {{
            width: 48px;
            height: 48px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            font-size: 14px;
            color: #ffffff;
            background: linear-gradient(135deg, #00a884, #005c4b);
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
        }}
        .avatar-online-dot {{
            width: 11px;
            height: 11px;
            background: #25d366;
            border: 2px solid var(--wa-sidebar-bg);
            border-radius: 50%;
            position: absolute;
            bottom: 0;
            right: 0;
        }}

        .conv-details {{
            flex: 1;
            min-width: 0;
            overflow: hidden;
        }}
        .conv-top {{
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            margin-bottom: 3px;
        }}
        .conv-phone {{
            font-size: 14.5px;
            font-weight: 600;
            color: var(--wa-text-primary);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            direction: ltr;
            unicode-bidi: isolate;
        }}
        .conv-time {{
            font-size: 11.5px;
            color: var(--wa-text-muted);
            flex-shrink: 0;
            margin-left: 8px;
        }}
        [dir="rtl"] .conv-time {{
            margin-left: 0;
            margin-right: 8px;
        }}
        .conv-bottom {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 8px;
        }}
        .conv-preview {{
            font-size: 13px;
            color: var(--wa-text-secondary);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            flex: 1;
            display: flex;
            align-items: center;
            gap: 4px;
        }}
        .conv-preview-text {{
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            direction: auto;
            unicode-bidi: plaintext;
        }}
        .badge-unread {{
            background: var(--wa-green-bright);
            color: #111b21;
            font-size: 11px;
            font-weight: 800;
            min-width: 19px;
            height: 19px;
            line-height: 19px;
            text-align: center;
            padding: 0 6px;
            border-radius: 10px;
            flex-shrink: 0;
            box-shadow: 0 2px 6px rgba(37, 211, 102, 0.4);
        }}

        /* Chat Panel (Right / Main) */
        .chat-panel {{
            flex: 1;
            display: flex;
            flex-direction: column;
            background-color: var(--wa-bg-deep);
            background-image: 
                radial-gradient(circle at 10% 20%, rgba(32, 44, 51, 0.4) 0%, transparent 20%),
                radial-gradient(circle at 90% 80%, rgba(32, 44, 51, 0.3) 0%, transparent 25%);
            position: relative;
            overflow: hidden;
        }}

        /* WhatsApp Doodle Wallpaper Pattern Background */
        .chat-panel::before {{
            content: '';
            position: absolute;
            inset: 0;
            opacity: 0.04;
            pointer-events: none;
            background-image: url("data:image/svg+xml,%3Csvg width='120' height='120' viewBox='0 0 120 120' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 15h10v10H30zM75 15h10v10H75zM15 45h10v10H15zM45 45h10v10H45zM95 45h10v10H95zM30 75h10v10H30zM75 75h10v10H75zM15 105h10v10H15zM60 105h10v10H60zM105 105h10v10H105z' fill='%23ffffff' fill-opacity='1' fill-rule='evenodd'/%3E%3C/svg%3E");
        }}

        .chat-header {{
            height: 60px;
            background: var(--wa-panel-bg);
            border-bottom: 1px solid var(--wa-border);
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 20px;
            flex-shrink: 0;
            z-index: 10;
        }}
        .chat-header-user {{
            display: flex;
            align-items: center;
            gap: 12px;
        }}
        .chat-header-title {{
            font-size: 15px;
            font-weight: 700;
            color: #ffffff;
            display: flex;
            align-items: center;
            gap: 8px;
        }}
        .chat-header-subtitle {{
            font-size: 12px;
            color: var(--wa-green-bright);
            display: flex;
            align-items: center;
            gap: 4px;
        }}
        .chat-header-actions {{
            display: flex;
            align-items: center;
            gap: 8px;
        }}

        /* Messages Canvas */
        .messages-area {{
            flex: 1;
            overflow-y: auto;
            overflow-x: hidden;
            padding: 20px 24px;
            display: flex;
            flex-direction: column;
            gap: 8px;
            z-index: 5;
        }}
        .date-divider {{
            display: flex;
            justify-content: center;
            margin: 12px 0;
        }}
        .date-divider-pill {{
            background: #182229;
            color: var(--wa-text-secondary);
            font-size: 11.5px;
            font-weight: 600;
            padding: 4px 12px;
            border-radius: 8px;
            border: 1px solid rgba(255, 255, 255, 0.05);
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
        }}

        .bubble-row {{
            display: flex;
            width: 100%;
        }}
        .bubble-row.inbound {{
            justify-content: flex-start;
        }}
        .bubble-row.outbound {{
            justify-content: flex-end;
        }}

        .bubble {{
            max-width: 65%;
            min-width: 120px;
            padding: 8px 12px 6px 12px;
            border-radius: 12px;
            font-size: 14.5px;
            line-height: 1.55;
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
            position: relative;
            word-break: break-word;
            transition: transform 0.1s ease;
        }}
        .bubble.inbound {{
            background: var(--wa-bubble-in);
            color: var(--wa-text-primary);
            border-top-left-radius: 2px;
            border: 1px solid rgba(255, 255, 255, 0.03);
        }}
        .bubble.outbound {{
            background: var(--wa-bubble-out);
            color: #ffffff;
            border-top-right-radius: 2px;
        }}
        [dir="rtl"] .bubble.inbound {{
            border-top-left-radius: 12px;
            border-top-right-radius: 2px;
        }}
        [dir="rtl"] .bubble.outbound {{
            border-top-right-radius: 12px;
            border-top-left-radius: 2px;
        }}

        .bubble-text {{
            direction: auto;
            unicode-bidi: plaintext;
            text-align: start;
            white-space: pre-wrap;
            word-break: break-word;
            font-size: 14px;
            line-height: 1.5;
            color: #ffffff;
        }}
        .bubble-meta {{
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: 4px;
            margin-top: 4px;
            font-size: 11px;
            color: rgba(255, 255, 255, 0.6);
            direction: ltr;
            unicode-bidi: isolate;
        }}
        .status-ticks {{
            display: inline-flex;
            align-items: center;
        }}
        .ticks-read {{
            color: var(--wa-blue-ticks);
        }}
        .ticks-delivered {{
            color: rgba(255, 255, 255, 0.6);
        }}
        .ticks-sent {{
            color: rgba(255, 255, 255, 0.5);
        }}

        /* Composer Area */
        .composer-area {{
            background: var(--wa-panel-bg);
            border-top: 1px solid var(--wa-border);
            padding: 10px 16px;
            display: flex;
            flex-direction: column;
            gap: 8px;
            flex-shrink: 0;
            z-index: 10;
        }}
        .chips-row {{
            display: flex;
            gap: 6px;
            overflow-x: auto;
            padding-bottom: 2px;
        }}
        .chip-template {{
            background: var(--wa-surface);
            border: 1px solid var(--wa-border);
            color: var(--wa-text-secondary);
            padding: 5px 12px;
            border-radius: 16px;
            font-size: 12px;
            font-weight: 500;
            cursor: pointer;
            white-space: nowrap;
            transition: all 0.15s ease;
        }}
        .chip-template:hover {{
            background: var(--wa-surface-active);
            color: #ffffff;
            border-color: var(--wa-green-primary);
        }}

        .purpose-select {{
            font-size: 12px;
            padding: 4px 8px;
            border-radius: 8px;
            border: 1px solid rgba(255,255,255,0.15);
            background: rgba(255,255,255,0.06);
            color: inherit;
        }}
        .purpose-select option {{ color: #111; }}
        .composer-input-row {{
            display: flex;
            align-items: flex-end;
            gap: 10px;
        }}
        .composer-input-wrapper {{
            flex: 1;
            background: var(--wa-surface);
            border: 1px solid var(--wa-border);
            border-radius: 12px;
            padding: 10px 14px;
            display: flex;
            align-items: flex-end;
            transition: border-color 0.2s;
        }}
        .composer-input-wrapper:focus-within {{
            border-color: var(--wa-green-primary);
        }}
        .message-input {{
            flex: 1;
            background: transparent;
            border: none;
            outline: none;
            color: #ffffff;
            font-size: 14.5px;
            line-height: 1.45;
            resize: none;
            max-height: 120px;
            min-height: 24px;
            font-family: inherit;
            direction: auto;
            unicode-bidi: plaintext;
        }}
        .message-input::placeholder {{
            color: var(--wa-text-muted);
        }}
        .send-btn-circle {{
            width: 44px;
            height: 44px;
            border-radius: 50%;
            background: var(--wa-green-primary);
            color: white;
            border: none;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            flex-shrink: 0;
            box-shadow: 0 2px 8px rgba(0, 168, 132, 0.4);
        }}
        .send-btn-circle:hover {{
            background: var(--wa-green-bright);
            color: #0c1317;
            transform: scale(1.05);
        }}
        .send-btn-circle:active {{
            transform: scale(0.95);
        }}
        .send-btn-circle:disabled {{
            opacity: 0.5;
            cursor: not-allowed;
            transform: none;
        }}

        /* Empty State */
        .chat-empty-state {{
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            color: var(--wa-text-secondary);
            text-align: center;
            padding: 40px;
            gap: 16px;
        }}
        .empty-illustration {{
            width: 80px;
            height: 80px;
            border-radius: 50%;
            background: var(--wa-surface);
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--wa-green-primary);
            margin-bottom: 8px;
            border: 1px solid var(--wa-border);
        }}

        /* ========================================================================= */
        /* 2. DELIVERY REPORTS (DLR) TAB & ANALYTICS                                 */
        /* ========================================================================= */
        .reports-layout {{
            width: 100%;
            height: 100%;
            overflow-y: auto;
            overflow-x: hidden;
            padding: 24px;
            display: flex;
            flex-direction: column;
            gap: 20px;
        }}

        /* KPI Cards Grid */
        .kpi-cards-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 16px;
        }}
        .kpi-stat-card {{
            background: var(--wa-panel-bg);
            border: 1px solid var(--wa-border);
            border-radius: 14px;
            padding: 18px 20px;
            display: flex;
            flex-direction: column;
            gap: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
            transition: border-color 0.2s;
        }}
        .kpi-stat-card:hover {{
            border-color: #3b4a54;
        }}
        .kpi-stat-title {{
            font-size: 12px;
            font-weight: 600;
            color: var(--wa-text-secondary);
            text-transform: uppercase;
            letter-spacing: 0.5px;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }}
        .kpi-stat-value {{
            font-size: 26px;
            font-weight: 800;
            color: #ffffff;
            letter-spacing: -0.5px;
            line-height: 1.1;
        }}
        .kpi-stat-badge {{
            font-size: 11.5px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 4px;
        }}

        /* Donut & Breakdown Grid */
        .dlr-overview-grid {{
            display: grid;
            grid-template-columns: 360px 1fr;
            gap: 20px;
        }}
        @media (max-width: 992px) {{
            .dlr-overview-grid {{ grid-template-columns: 1fr; }}
        }}

        .stats-box {{
            background: var(--wa-panel-bg);
            border: 1px solid var(--wa-border);
            border-radius: 14px;
            padding: 20px;
            display: flex;
            flex-direction: column;
        }}
        .stats-box-header {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
        }}
        .stats-box-title {{
            font-size: 15px;
            font-weight: 700;
            color: #ffffff;
        }}

        .view-pill-group {{
            display: flex;
            background: var(--wa-surface);
            padding: 3px;
            border-radius: 8px;
            gap: 2px;
            border: 1px solid var(--wa-border);
        }}
        .view-pill {{
            background: transparent;
            border: none;
            color: var(--wa-text-secondary);
            font-size: 11.5px;
            font-weight: 600;
            padding: 5px 12px;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.15s ease;
        }}
        .view-pill.active {{
            background: var(--wa-green-primary);
            color: #ffffff;
        }}

        .donut-container {{
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 10px 0;
            position: relative;
        }}
        .donut-svg {{
            width: 200px;
            height: 200px;
            transform: rotate(-90deg);
        }}
        .donut-center-info {{
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            text-align: center;
            pointer-events: none;
        }}
        .donut-center-sub {{
            font-size: 12px;
            color: var(--wa-text-secondary);
            font-weight: 500;
        }}
        .donut-center-pct {{
            font-size: 32px;
            font-weight: 800;
            color: #ffffff;
            line-height: 1.1;
        }}
        .donut-legend {{
            display: flex;
            justify-content: center;
            gap: 16px;
            margin-top: 14px;
            font-size: 12px;
            color: var(--wa-text-secondary);
        }}
        .donut-legend-item {{
            display: flex;
            align-items: center;
            gap: 6px;
        }}
        .donut-dot {{
            width: 10px;
            height: 10px;
            border-radius: 50%;
        }}

        /* Status Breakdown List */
        .status-breakdown-list {{
            display: flex;
            flex-direction: column;
            background: #0c1317;
            border: 1px solid var(--wa-border);
            border-radius: 10px;
            overflow: hidden;
        }}
        .breakdown-row {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 16px;
            border-bottom: 1px solid var(--wa-border);
            font-size: 13.5px;
            cursor: pointer;
            transition: background 0.15s;
        }}
        .breakdown-row:last-child {{
            border-bottom: none;
        }}
        .breakdown-row:hover {{
            background: var(--wa-surface-hover);
        }}
        .breakdown-row.active {{
            background: var(--wa-surface-active);
            border-left: 3px solid var(--wa-green-bright);
        }}
        [dir="rtl"] .breakdown-row.active {{
            border-left: none;
            border-right: 3px solid var(--wa-green-bright);
        }}
        .breakdown-left {{
            display: flex;
            align-items: center;
            gap: 10px;
        }}
        .sq-icon {{
            width: 12px;
            height: 12px;
            border-radius: 3px;
            display: inline-block;
            flex-shrink: 0;
        }}
        .sq-total {{ background: #94a3b8; }}
        .sq-submitted {{ background: #475569; }}
        .sq-sent {{ background: #eab308; }}
        .sq-delivered {{ background: #22c55e; }}
        .sq-read {{ background: #38bdf8; }}
        .sq-unconfirmed {{ background: #64748b; }}
        .sq-failed {{ background: #f87171; }}

        .breakdown-num {{
            font-weight: 700;
            color: #ffffff;
            font-size: 14px;
            direction: ltr;
            unicode-bidi: isolate;
        }}

        /* Channel Usage Table Box */
        .channel-stats-card {{
            background: var(--wa-panel-bg);
            border: 1px solid var(--wa-border);
            border-radius: 14px;
            padding: 18px 20px;
            overflow-x: auto;
        }}
        .channel-table {{
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
            text-align: left;
        }}
        [dir="rtl"] .channel-table {{
            text-align: right;
        }}
        .channel-table th {{
            background: #182229;
            color: var(--wa-text-secondary);
            padding: 10px 14px;
            font-size: 11px;
            text-transform: uppercase;
            font-weight: 600;
            border-bottom: 1px solid var(--wa-border);
            white-space: nowrap;
        }}
        .channel-table td {{
            padding: 12px 14px;
            border-bottom: 1px solid var(--wa-border);
            color: var(--wa-text-primary);
            white-space: nowrap;
        }}

        /* Toolbar */
        .toolbar {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: var(--wa-panel-bg);
            padding: 12px 18px;
            border-radius: 12px;
            border: 1px solid var(--wa-border);
            flex-wrap: wrap;
            gap: 12px;
        }}
        .filter-group {{
            display: flex;
            align-items: center;
            gap: 10px;
            flex-wrap: wrap;
        }}
        .filter-select {{
            background: var(--wa-surface);
            border: 1px solid var(--wa-border);
            color: #ffffff;
            padding: 8px 12px;
            border-radius: 8px;
            font-size: 13px;
            outline: none;
            font-family: inherit;
        }}
        .filter-select:focus {{
            border-color: var(--wa-green-primary);
        }}

        /* DLR Data Table */
        .table-card {{
            background: var(--wa-panel-bg);
            border: 1px solid var(--wa-border);
            border-radius: 14px;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }}
        .dlr-table {{
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
            text-align: left;
        }}
        .dlr-table th {{
            background: #182229;
            color: var(--wa-text-secondary);
            padding: 12px 16px;
            font-weight: 600;
            border-bottom: 1px solid var(--wa-border);
            text-transform: uppercase;
            font-size: 11px;
            letter-spacing: 0.5px;
        }}
        .dlr-table td {{
            padding: 12px 16px;
            border-bottom: 1px solid rgba(34, 46, 53, 0.7);
            color: var(--wa-text-primary);
        }}
        .dlr-table tr:hover td {{
            background: var(--wa-surface-hover);
        }}

        .badge-status {{
            display: inline-block;
            padding: 3px 9px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.3px;
        }}
        .badge-DELIVERED {{ background: rgba(34, 197, 94, 0.15); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.3); }}
        .badge-READ {{ background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); }}
        .badge-SENT {{ background: rgba(234, 179, 8, 0.15); color: #facc15; border: 1px solid rgba(234, 179, 8, 0.3); }}
        .badge-FAILED {{ background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); }}

        /* ========================================================================= */
        /* 3. WEBHOOK STREAM TAB                                                     */
        /* ========================================================================= */
        .feed-layout {{
            width: 100%;
            height: 100%;
            padding: 24px;
            overflow-y: auto;
            overflow-x: hidden;
            display: flex;
            flex-direction: column;
            gap: 14px;
        }}
        .event-card {{
            background: var(--wa-panel-bg);
            border: 1px solid var(--wa-border);
            border-radius: 10px;
            padding: 16px;
        }}
        .event-header {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        }}
        .json-block {{
            background: #090d16;
            border: 1px solid var(--wa-border);
            padding: 12px;
            border-radius: 8px;
            font-family: monospace;
            font-size: 12px;
            color: #93c5fd;
            white-space: pre-wrap;
            word-break: break-all;
            max-height: 220px;
            overflow-y: auto;
        }}

        /* Modals */
        .modal-overlay {{
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0, 0, 0, 0.75);
            display: none;
            align-items: center;
            justify-content: center;
            z-index: 100;
            backdrop-filter: blur(4px);
        }}
        .modal {{
            background: var(--wa-panel-bg);
            border: 1px solid var(--wa-border);
            border-radius: 16px;
            width: 500px;
            max-width: 90vw;
            padding: 24px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.7);
        }}
        .modal-title {{
            font-size: 18px;
            font-weight: 700;
            margin-bottom: 16px;
            color: #ffffff;
        }}
        .form-group {{
            margin-bottom: 16px;
        }}
        .form-group label {{
            display: block;
            font-size: 12px;
            font-weight: 600;
            color: var(--wa-text-secondary);
            margin-bottom: 6px;
            text-transform: uppercase;
        }}
        .form-control {{
            width: 100%;
            background: var(--wa-surface);
            border: 1px solid var(--wa-border);
            padding: 11px 14px;
            border-radius: 8px;
            color: #ffffff;
            font-size: 14px;
            outline: none;
            font-family: inherit;
        }}
        .form-control:focus {{
            border-color: var(--wa-green-primary);
        }}
        .modal-actions {{
            display: flex;
            justify-content: flex-end;
            gap: 10px;
            margin-top: 22px;
        }}

        /* RTL Alignment Rules */
        [dir="rtl"] body {{
            direction: rtl;
            text-align: right;
        }}
        [dir="rtl"] .dlr-table th, [dir="rtl"] .dlr-table td {{
            text-align: right;
        }}
        [dir="rtl"] .sidebar-search-box input {{
            margin-left: 0;
            margin-right: 8px;
        }}
        [dir="rtl"] .modal-actions {{
            justify-content: flex-start;
        }}
        .phone-isolate {{
            direction: ltr;
            unicode-bidi: isolate;
            display: inline-block;
        }}
    </style>
</head>
<body dir="ltr">

    <!-- Top Navigation Bar -->
    <header class="topbar">
        <div class="brand-area">
            <div class="brand-logo-group">
                <span class="brand-pill-rush">RUSH</span>
                <div class="wa-logo-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2zm0 18.15c-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.19 8.19 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.83c.01 4.54-3.69 8.23-8.22 8.23z"/>
                    </svg>
                </div>
                <span class="brand-title-text">WhatsApp Live <span>PRO</span></span>
            </div>

            <div class="nav-tabs">
                <button class="tab-btn active" id="tab-chats" onclick="switchTab('chats')">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                    <span>Chats</span>
                    <span class="tab-badge" id="tab-unread-count">0</span>
                </button>
                <button class="tab-btn" id="tab-reports" onclick="switchTab('reports')">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
                    <span>Delivery Reports</span>
                </button>
                <button class="tab-btn" id="tab-feed" onclick="switchTab('feed')">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                    <span>Webhook Stream</span>
                </button>
            </div>
        </div>

        <div class="top-meta">
            <div class="status-pill" title="Live Server-Sent Events (SSE) stream is active">
                <span class="status-dot"></span>
                <span id="sse-status-text">Connected</span>
            </div>
            <button class="btn-action" id="dir-toggle-btn" onclick="toggleLayoutDir()" title="Switch layout direction (عربي RTL / English LTR)">
                <span id="dir-icon">🌐</span>
                <span id="dir-text">RTL Arabic</span>
            </button>
            <button class="btn-action" onclick="openSettingsModal()">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                <span>Settings</span>
            </button>
            <a href="/logout" class="btn-action btn-action-logout" title="Sign out">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                <span>Logout</span>
            </a>
        </div>
    </header>

    <!-- ========================================================================= -->
    <!-- 1. WHATSAPP CHATS TAB                                                     -->
    <!-- ========================================================================= -->
    <div class="tab-content active" id="content-chats">
        <div class="chat-layout">
            <!-- Sidebar -->
            <aside class="sidebar">
                <div class="sidebar-header">
                    <div class="sidebar-top-row">
                        <div class="sidebar-title">
                            <span>Chats</span>
                            <span class="sidebar-title-count" id="chat-count">0</span>
                        </div>
                        <div class="sidebar-filter-pills">
                            <button class="filter-pill-btn active" id="filter-all-chats" onclick="setChatFilter('all')">All</button>
                            <button class="filter-pill-btn" id="filter-unread-chats" onclick="setChatFilter('unread')">Unread</button>
                            <button class="btn-action btn-action-primary" style="padding: 4px 10px; font-size: 11.5px;" onclick="openNewChatModal()">+ New Chat</button>
                        </div>
                    </div>

                    <div class="sidebar-search-box">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                        <input type="text" id="search-input" dir="auto" placeholder="Search phone or text..." onkeyup="filterConversations()" autocomplete="off" name="search" role="searchbox">
                        <button class="search-clear-btn" id="search-clear" onclick="clearSearch()">&times;</button>
                    </div>
                </div>

                <div class="conv-list" id="conversations-container"></div>
            </aside>

            <!-- Chat Panel -->
            <section class="chat-panel">
                <div class="chat-header" id="chat-header" style="display: none;">
                    <div class="chat-header-user">
                        <div class="avatar-wrap">
                            <div class="avatar" id="active-avatar">WA</div>
                            <div class="avatar-online-dot"></div>
                        </div>
                        <div>
                            <div class="chat-header-title">
                                <span id="active-phone"><bdi class="phone-isolate">+966...</bdi></span>
                            </div>
                            <div class="chat-header-subtitle">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                                <span>WhatsApp Verified &bull; Active Customer Thread</span>
                            </div>
                        </div>
                    </div>

                    <div class="chat-header-actions">
                        <button class="btn-action" onclick="copyActivePhone()" title="Copy Phone Number">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                            <span id="copy-phone-text">Copy Phone</span>
                        </button>
                        <button class="btn-action" onclick="openDirectWhatsApp()" title="Open in official WhatsApp Web">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2z"/></svg>
                            <span>Open Web</span>
                        </button>
                    </div>
                </div>

                <div class="messages-area" id="messages-container">
                    <div class="chat-empty-state">
                        <div class="empty-illustration">
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                        </div>
                        <h3 style="font-size: 17px; color: #ffffff;">RUSH WhatsApp Live Assistant</h3>
                        <p style="font-size: 13.5px; max-width: 320px; line-height: 1.5;">Select a customer from the left sidebar to view messages or click <strong>+ New Chat</strong> to start a conversation.</p>
                    </div>
                </div>

                <div class="composer-area" id="composer-area" style="display: none;">
                    <div class="chips-row">
                        <span class="chip-template" onclick="insertTemplate('أهلاً بك عميلنا العزيز في RushWash 🚗 كيف نقدر نخدمك اليوم؟')">👋 أهلاً بك</span>
                        <span class="chip-template" onclick="insertTemplate('تم استلام طلبك وجاري معالجته في أقرب وقت ⏱️')">⏱️ استلام الطلب</span>
                        <span class="chip-template" onclick="insertTemplate('تقدر تتابع تفاصيل اشتراكك وغسيلك عبر تطبيق RushWash أو موقعنا rush.com.sa')">📲 رابط التطبيق</span>
                        <span class="chip-template" onclick="insertTemplate('شكراً لتواصلك مع RushWash. نسعد دائماً بخدمتك!')">🙏 شكراً لتواصلك</span>
                        <span class="chip-template" onclick="insertTemplate('نفتقدك في RushWash 🚗✨ اشتراكك فعّال، مرّ علينا هالأسبوع واستمتع بغسيلك!'); setPurpose('usage_nudge')">🚿 تذكير بالغسيل</span>
                        <span class="chip-template" onclick="insertTemplate('تذكير: يتجدد اشتراكك في RushWash قريباً 🔁 تأكد أن بطاقتك المحفوظة صالحة لتستمر غسيلاتك بدون انقطاع.'); setPurpose('renewal_reminder')">🔁 تذكير بالتجديد</span>
                        <select class="purpose-select" id="reply-purpose" title="Tag this message so the CRM can measure it">
                            <option value="">Chat (not logged)</option>
                            <option value="usage_nudge">Usage nudge</option>
                            <option value="renewal_reminder">Renewal reminder</option>
                        </select>
                    </div>

                    <div class="composer-input-row">
                        <div class="composer-input-wrapper">
                            <textarea class="message-input" id="reply-text" dir="auto" placeholder="Type a message... (Press Enter to send, Shift+Enter for newline)" rows="1" onkeydown="handleKey(event)"></textarea>
                        </div>
                        <button class="send-btn-circle" id="send-button" onclick="sendReply()" title="Send Message">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="22" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                        </button>
                    </div>
                </div>
            </section>
        </div>
    </div>

    <!-- ========================================================================= -->
    <!-- 2. DELIVERY REPORTS (DLR) TAB                                             -->
    <!-- ========================================================================= -->
    <div class="tab-content" id="content-reports">
        <div class="reports-layout">
            
            <!-- Top KPI Cards -->
            <div class="kpi-cards-grid">
                <div class="kpi-stat-card">
                    <div class="kpi-stat-title">
                        <span>Total Submitted</span>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2"><path d="M22 2L11 13"></path><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                    </div>
                    <div class="kpi-stat-value" id="kpi-total-dispatched">444</div>
                    <div class="kpi-stat-badge" style="color: #94a3b8;">100% Volume</div>
                </div>

                <div class="kpi-stat-card">
                    <div class="kpi-stat-title">
                        <span>Success Sent Rate</span>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    </div>
                    <div class="kpi-stat-value" style="color: #4ade80;" id="kpi-sent-rate">76.8%</div>
                    <div class="kpi-stat-badge" style="color: #4ade80;">341 Sent / 296 Delivered</div>
                </div>

                <div class="kpi-stat-card">
                    <div class="kpi-stat-title">
                        <span>Read Receipts Rate</span>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                    </div>
                    <div class="kpi-stat-value" style="color: #38bdf8;" id="kpi-read-rate">28.0%</div>
                    <div class="kpi-stat-badge" style="color: #38bdf8;">83 Confirmed Read</div>
                </div>

                <div class="kpi-stat-card">
                    <div class="kpi-stat-title">
                        <span>Failed / Declined</span>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
                    </div>
                    <div class="kpi-stat-value" style="color: #f87171;" id="kpi-failed-count">103</div>
                    <div class="kpi-stat-badge" style="color: #f87171;">23.2% Undelivered</div>
                </div>

                <div class="kpi-stat-card">
                    <div class="kpi-stat-title">
                        <span>Estimated Spend</span>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#facc15" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                    </div>
                    <div class="kpi-stat-value" style="color: #facc15;" id="kpi-spend-usd">$14.68</div>
                    <div class="kpi-stat-badge" style="color: #facc15;">SAR 55.05 (~Marketing Lite)</div>
                </div>
            </div>

            <!-- Middle Section: Donut + Status Breakdown -->
            <div class="dlr-overview-grid">
                
                <!-- Left: Donut Chart -->
                <div class="stats-box">
                    <div class="stats-box-header">
                        <span class="stats-box-title">Success Rate Analysis</span>
                        <div class="view-pill-group">
                            <button class="view-pill active" id="btn-view-campaign" onclick="setStatsSource('campaign')">Unifonic (444)</button>
                            <button class="view-pill" id="btn-view-live" onclick="setStatsSource('live')">Live Webhook</button>
                        </div>
                    </div>

                    <div class="donut-container">
                        <svg class="donut-svg" viewBox="0 0 200 200">
                            <!-- Outer track -->
                            <circle cx="100" cy="100" r="82" fill="none" stroke="#182229" stroke-width="14" />
                            <!-- Failed red background -->
                            <circle cx="100" cy="100" r="82" fill="none" stroke="#e11d48" stroke-width="14" />
                            <!-- Success Teal arc -->
                            <circle id="donut-arc-success" cx="100" cy="100" r="82" fill="none" stroke="#00a884" stroke-width="14"
                                    stroke-dasharray="515.2" stroke-dashoffset="120" stroke-linecap="round"
                                    style="transition: stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1);" />
                        </svg>
                        <div class="donut-center-info">
                            <div class="donut-center-sub">Success Rate</div>
                            <div class="donut-center-pct" id="donut-rate-text">76.8%</div>
                        </div>
                    </div>

                    <div class="donut-legend">
                        <div class="donut-legend-item">
                            <span class="donut-dot" style="background: #00a884;"></span>
                            <span>Delivered / Sent</span>
                        </div>
                        <div class="donut-legend-item">
                            <span class="donut-dot" style="background: #e11d48;"></span>
                            <span>Failed / Rejected</span>
                        </div>
                    </div>
                </div>

                <!-- Right: Status Breakdown Tree -->
                <div class="stats-box">
                    <div class="stats-box-header">
                        <span class="stats-box-title">Status Breakdown & Filtering</span>
                        <span style="font-size: 11.5px; color: var(--wa-text-secondary);">Click any row to filter table</span>
                    </div>

                    <div class="status-breakdown-list">
                        <div class="breakdown-row" onclick="applyStatusFilter('ALL', this)">
                            <div class="breakdown-left">
                                <span class="sq-icon sq-total"></span>
                                <span>Total Processed</span>
                            </div>
                            <span class="breakdown-num" id="bd-total">444</span>
                        </div>
                        <div class="breakdown-row" onclick="applyStatusFilter('ALL', this)">
                            <div class="breakdown-left">
                                <span class="sq-icon sq-submitted"></span>
                                <span>Submitted to Channel</span>
                            </div>
                            <span class="breakdown-num" id="bd-submitted">444</span>
                        </div>
                        <div class="breakdown-row" onclick="applyStatusFilter('SENT', this)">
                            <div class="breakdown-left" style="padding-left: 14px;">
                                <span class="sq-icon sq-sent"></span>
                                <span>Dispatched / Sent</span>
                            </div>
                            <span class="breakdown-num" id="bd-sent">341</span>
                        </div>
                        <div class="breakdown-row" onclick="applyStatusFilter('DELIVERED', this)">
                            <div class="breakdown-left" style="padding-left: 28px;">
                                <span class="sq-icon sq-delivered"></span>
                                <span>Delivered to Handset</span>
                            </div>
                            <span class="breakdown-num" id="bd-delivered">296</span>
                        </div>
                        <div class="breakdown-row" onclick="applyStatusFilter('READ', this)">
                            <div class="breakdown-left" style="padding-left: 42px;">
                                <span class="sq-icon sq-read"></span>
                                <span>Read by Customer (Blue Ticks)</span>
                            </div>
                            <span class="breakdown-num" id="bd-read">83</span>
                        </div>
                        <div class="breakdown-row" onclick="applyStatusFilter('FAILED', this)">
                            <div class="breakdown-left">
                                <span class="sq-icon sq-failed"></span>
                                <span>Failed / Undelivered</span>
                            </div>
                            <span class="breakdown-num" id="bd-failed">103</span>
                        </div>
                    </div>
                </div>

            </div>

            <!-- Channel Usage Table -->
            <div class="channel-stats-card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <div style="font-size: 14.5px; font-weight: 700; color: #ffffff;">Channel Volume & Spend Overview</div>
                    <span style="font-size: 12px; color: #4ade80; background: rgba(34, 197, 94, 0.12); border: 1px solid rgba(34, 197, 94, 0.25); padding: 2px 10px; border-radius: 12px; font-weight: 600;">Meta Official Rate</span>
                </div>
                <table class="channel-table">
                    <thead>
                        <tr>
                            <th>Channel</th>
                            <th>Utility</th>
                            <th>Marketing</th>
                            <th>Marketing Lite</th>
                            <th>Authentication</th>
                            <th>Service</th>
                            <th>Sent</th>
                            <th>Received</th>
                            <th>Delivered</th>
                            <th>Spend (USD)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong style="color: var(--wa-green-bright);">WhatsApp</strong></td>
                            <td id="ch-utility">0</td>
                            <td id="ch-marketing">0</td>
                            <td><strong style="color: #4ade80;" id="ch-marketing-lite">293</strong></td>
                            <td id="ch-auth">0</td>
                            <td id="ch-service">0</td>
                            <td id="ch-sent" style="font-weight: 700;">343</td>
                            <td id="ch-recv" style="color: #38bdf8; font-weight: 700;">11</td>
                            <td id="ch-deliv" style="color: #4ade80; font-weight: 700;">294</td>
                            <td><strong style="color: #facc15;" id="ch-spend-bi">$14.68</strong></td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- Toolbar & Search -->
            <div class="toolbar">
                <div class="filter-group">
                    <label style="font-size: 13px; color: var(--wa-text-secondary); font-weight: 600;">Filter Status:</label>
                    <select class="filter-select" id="report-status-filter" onchange="loadReports()">
                        <option value="ALL">All Statuses</option>
                        <option value="SENT">Sent</option>
                        <option value="DELIVERED">Delivered</option>
                        <option value="READ">Read</option>
                        <option value="FAILED">Failed / Rejected</option>
                    </select>

                    <input type="text" class="filter-select" id="report-phone-filter" placeholder="Search phone number..." onkeyup="loadReports()" autocomplete="off" name="filter-phone" style="width: 200px;">
                </div>

                <div style="display: flex; gap: 8px;">
                    <button class="btn-action btn-action-primary" onclick="syncUnifonicStatus()" id="sync-unifonic-btn" title="Run direct GET request to Unifonic to query live delivery receipts">
                        <span>🔄 Sync from Unifonic (GET)</span>
                    </button>
                    <a href="/api/reports/export" class="btn-action" download style="color: #4ade80; border-color: rgba(34, 197, 94, 0.35);">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        <span>Export CSV</span>
                    </a>
                </div>
            </div>

            <!-- Detailed Table -->
            <div class="table-card">
                <table class="dlr-table">
                    <thead>
                        <tr>
                            <th>Message ID</th>
                            <th>Recipient</th>
                            <th>Status</th>
                            <th>Sent At</th>
                            <th>Delivered At</th>
                            <th>Read At</th>
                            <th>Content / Reason</th>
                        </tr>
                    </thead>
                    <tbody id="reports-table-body"></tbody>
                </table>
            </div>

        </div>
    </div>

    <!-- ========================================================================= -->
    <!-- 3. WEBHOOK STREAM TAB                                                     -->
    <!-- ========================================================================= -->
    <div class="tab-content" id="content-feed">
        <div class="feed-layout">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <h3 style="font-size: 16px; font-weight: 700; color: #ffffff;">Live Ingestion Event Feed</h3>
                <button class="btn-action btn-action-primary" onclick="loadRawFeed()">Refresh Feed</button>
            </div>
            <div id="raw-feed-container"></div>
        </div>
    </div>

    <!-- Start New Chat Modal -->
    <div class="modal-overlay" id="new-chat-modal">
        <div class="modal">
            <div class="modal-title">Start New WhatsApp Conversation</div>
            <div class="form-group">
                <label>Recipient Phone Number (with Country Code)</label>
                <input type="text" class="form-control phone-isolate" id="new-phone" dir="ltr" placeholder="e.g. 966569809578" autocomplete="off" name="new-phone">
            </div>
            <div class="form-group">
                <label>Initial Message (Optional)</label>
                <textarea class="form-control" id="new-initial-msg" dir="auto" rows="3" placeholder="Type opening message..."></textarea>
            </div>
            <div class="form-group">
                <label>Message Purpose (logged to CRM for nudge / reminder tracking)</label>
                <select class="form-control" id="new-purpose">
                    <option value="">Chat (not logged)</option>
                    <option value="usage_nudge">Usage nudge</option>
                    <option value="renewal_reminder">Renewal reminder</option>
                </select>
            </div>
            <div class="form-group">
                <label>Customer / Subscription Code (optional, improves matching)</label>
                <input type="text" class="form-control" id="new-member-code" dir="ltr" placeholder="e.g. CUS-01234 or SUB-05678" autocomplete="off">
            </div>
            <div class="modal-actions">
                <button class="btn-action" onclick="closeNewChatModal()">Cancel</button>
                <button class="btn-action btn-action-primary" onclick="submitNewChat()">Open Conversation</button>
            </div>
        </div>
    </div>

    <!-- Settings Modal -->
    <div class="modal-overlay" id="settings-modal">
        <div class="modal">
            <div class="modal-title">Unifonic API & Webhook Settings</div>
            <div style="background: rgba(0, 168, 132, 0.1); border: 1px solid rgba(0, 168, 132, 0.3); color: #4ade80; padding: 12px; border-radius: 10px; font-size: 12.5px; margin-bottom: 16px; word-break: break-all;">
                <strong>Public Webhook URL (HTTPS):</strong><br>
                <code>{public_https_url}</code>
            </div>
            <div class="form-group">
                <label>Unifonic Public ID</label>
                <input type="text" class="form-control" id="settings-public-id" placeholder="e.g. 92d3a815-4224-4f47-bf10-8eb91256230c" value="{unifonic_public_id}" autocomplete="off" name="settings-public-id">
            </div>
            <div class="form-group">
                <label>Unifonic Channel ID</label>
                <input type="text" class="form-control" id="settings-channel-id" placeholder="e.g. d6bb3874-a6f2-485f-bf43-7c6df97c2109" value="{unifonic_channel_id}" autocomplete="off" name="settings-channel-id">
            </div>
            <div class="form-group">
                <label>Unifonic Secret Key / API Key</label>
                <input type="password" class="form-control" id="settings-secret-key" placeholder="Paste your Unifonic Secret Key here">
            </div>
            <div class="modal-actions">
                <button class="btn-action" onclick="closeSettingsModal()">Cancel</button>
                <button class="btn-action btn-action-primary" onclick="saveSettings()">Save & Activate</button>
            </div>
        </div>
    </div>

    <script>
        let currentTab = 'chats';
        let allConversations = [];
        let activePhone = null;
        let isSending = false;
        let chatFilter = 'all';

        const AVATAR_GRADIENTS = [
            'linear-gradient(135deg, #00a884, #005c4b)',
            'linear-gradient(135deg, #2563eb, #1e3a8a)',
            'linear-gradient(135deg, #7c3aed, #4c1d95)',
            'linear-gradient(135deg, #d97706, #78350f)',
            'linear-gradient(135deg, #c91e2f, #881337)',
            'linear-gradient(135deg, #0891b2, #164e63)'
        ];

        function getAvatarGradient(phone) {{
            if (!phone) return AVATAR_GRADIENTS[0];
            let hash = 0;
            for (let i = 0; i < phone.length; i++) hash = phone.charCodeAt(i) + ((hash << 5) - hash);
            return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
        }}

        function formatPhoneDisplay(phone) {{
            if (!phone) return 'Unknown';
            const digits = phone.replace(/\\D/g, '');
            if (digits.startsWith('966') && digits.length === 12) {{
                return `+966 ${{digits.slice(3, 5)}} ${{digits.slice(5, 8)}} ${{digits.slice(8)}}`;
            }}
            return '+' + digits;
        }}

        // Realtime SSE Connection
        let sseConnected = false;
        function initSSE() {{
            try {{
                const evtSource = new EventSource('/api/events/stream');
                evtSource.onopen = () => {{
                    sseConnected = true;
                    const st = document.getElementById('sse-status-text');
                    if (st) st.innerText = 'Connected';
                }};
                evtSource.onmessage = (e) => {{
                    try {{
                        const msg = JSON.parse(e.data);
                        if (msg.type === 'connected') return;
                        
                        if (currentTab === 'chats') {{
                            loadConversations(true);
                            if (activePhone && (!msg.phone || msg.phone === activePhone)) {{
                                loadMessages(activePhone, true);
                            }}
                        }} else if (currentTab === 'reports') {{
                            loadReports(true);
                        }} else if (currentTab === 'feed') {{
                            loadRawFeed(true);
                        }}
                    }} catch (err) {{}}
                }};
                evtSource.onerror = () => {{
                    sseConnected = false;
                    const st = document.getElementById('sse-status-text');
                    if (st) st.innerText = 'Reconnecting';
                }};
            }} catch (e) {{}}
        }}

        // Background poll backup every 3s
        setInterval(() => {{
            if (currentTab === 'chats') {{
                loadConversations(true);
                if (activePhone) loadMessages(activePhone, true);
            }} else if (currentTab === 'reports') {{
                loadReports(true);
            }} else if (currentTab === 'feed') {{
                loadRawFeed(true);
            }}
        }}, 3000);

        function initLayoutDir() {{
            const savedDir = localStorage.getItem('rush_dir') || 'rtl';
            setLayoutDir(savedDir);
        }}

        function toggleLayoutDir() {{
            const currentDir = document.documentElement.getAttribute('dir') || 'rtl';
            const newDir = (currentDir === 'rtl') ? 'ltr' : 'rtl';
            setLayoutDir(newDir);
        }}

        function setLayoutDir(dir) {{
            document.documentElement.setAttribute('dir', dir);
            document.body.setAttribute('dir', dir);
            localStorage.setItem('rush_dir', dir);
            const textEl = document.getElementById('dir-text');
            if (textEl) {{
                textEl.innerText = (dir === 'rtl') ? 'LTR English' : 'عربي RTL';
            }}
        }}

        window.onload = () => {{
            initLayoutDir();
            initSSE();
            loadConversations();
            loadReports();
        }};

        function switchTab(tab) {{
            currentTab = tab;
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            const btn = document.getElementById('tab-' + tab);
            const cnt = document.getElementById('content-' + tab);
            if (btn) btn.classList.add('active');
            if (cnt) cnt.classList.add('active');

            if (tab === 'reports') loadReports();
            if (tab === 'feed') loadRawFeed();
            if (tab === 'chats') loadConversations();
        }}

        // --- CONVERSATIONS & CHAT ---
        function setChatFilter(filter) {{
            chatFilter = filter;
            document.getElementById('filter-all-chats').classList.toggle('active', filter === 'all');
            document.getElementById('filter-unread-chats').classList.toggle('active', filter === 'unread');
            filterConversations();
        }}

        async function loadConversations(isBackground = false) {{
            try {{
                const res = await fetch('/api/conversations?t=' + Date.now(), {{
                    headers: {{ 'Cache-Control': 'no-cache' }}
                }});
                const data = await res.json();
                allConversations = data.conversations || [];
                
                const countEl = document.getElementById('chat-count');
                if (countEl) countEl.innerText = allConversations.length;

                const unreadTotal = allConversations.reduce((acc, c) => acc + (c.unread_count || 0), 0);
                const badgeEl = document.getElementById('tab-unread-count');
                if (badgeEl) {{
                    badgeEl.innerText = unreadTotal;
                    badgeEl.style.display = unreadTotal > 0 ? 'inline-block' : 'none';
                }}

                filterConversations();
            }} catch (e) {{}}
        }}

        function clearSearch() {{
            const el = document.getElementById('search-input');
            if (el) el.value = '';
            document.getElementById('search-clear').style.display = 'none';
            filterConversations();
        }}

        function filterConversations() {{
            const searchEl = document.getElementById('search-input');
            const q = searchEl ? searchEl.value.toLowerCase().trim() : '';
            const clearBtn = document.getElementById('search-clear');
            if (clearBtn) clearBtn.style.display = q ? 'block' : 'none';

            let filtered = allConversations;
            if (chatFilter === 'unread') {{
                filtered = filtered.filter(c => c.unread_count > 0);
            }}
            if (q) {{
                filtered = filtered.filter(c => 
                    c.phone.toLowerCase().includes(q) || (c.last_message && c.last_message.toLowerCase().includes(q))
                );
            }}
            renderConversations(filtered);
        }}

        function renderConversations(list) {{
            const container = document.getElementById('conversations-container');
            if (list.length === 0) {{
                container.innerHTML = `
                    <div style="padding: 36px 16px; text-align: center; color: var(--wa-text-secondary); font-size: 13px; line-height: 1.6;">
                        No customer conversations found.<br>Click <strong>+ New Chat</strong> to begin messaging.
                    </div>
                `;
                return;
            }}

            let html = '';
            list.forEach(c => {{
                const isActive = (c.phone === activePhone) ? 'active' : '';
                const timeStr = c.last_timestamp ? formatTime(c.last_timestamp) : '';
                const bgGradient = getAvatarGradient(c.phone);
                const avatarInitials = c.phone.slice(-2);
                const unreadBadge = c.unread_count > 0 ? `<span class="badge-unread">${{c.unread_count}}</span>` : '';
                
                // Status tick icon for last message
                let statusIcon = '';
                if (c.last_direction === 'outbound') {{
                    const st = (c.last_status || 'SENT').toUpperCase();
                    if (st === 'READ') {{
                        statusIcon = '<svg class="ticks-read" width="16" height="11" viewBox="0 0 16 11" fill="currentColor"><path d="M11.07 0L5.65 5.42L3.12 2.89L2 4.01L5.65 7.66L12.19 1.12L11.07 0ZM14.88 0L9.46 5.42L8.34 4.3L7.22 5.42L9.46 7.66L16 1.12L14.88 0Z"/></svg>';
                    }} else if (st === 'DELIVERED') {{
                        statusIcon = '<svg class="ticks-delivered" width="16" height="11" viewBox="0 0 16 11" fill="currentColor"><path d="M11.07 0L5.65 5.42L3.12 2.89L2 4.01L5.65 7.66L12.19 1.12L11.07 0ZM14.88 0L9.46 5.42L8.34 4.3L7.22 5.42L9.46 7.66L16 1.12L14.88 0Z"/></svg>';
                    }} else {{
                        statusIcon = '<svg class="ticks-sent" width="12" height="11" viewBox="0 0 12 11" fill="currentColor"><path d="M4.58 7.66L1 4.08L2.12 2.96L4.58 5.42L10.02 0L11.14 1.12L4.58 7.66Z"/></svg>';
                    }}
                }}

                const formattedPhone = formatPhoneDisplay(c.phone);

                html += `
                    <div class="conv-item ${{isActive}}" onclick="selectConversation('${{c.phone}}')">
                        <div class="avatar-wrap">
                            <div class="avatar" style="background: ${{bgGradient}};">${{avatarInitials}}</div>
                        </div>
                        <div class="conv-details">
                            <div class="conv-top">
                                <span class="conv-phone"><bdi class="phone-isolate">${{formattedPhone}}</bdi></span>
                                <span class="conv-time">${{timeStr}}</span>
                            </div>
                            <div class="conv-bottom">
                                <div class="conv-preview">
                                    ${{statusIcon}}
                                    <span class="conv-preview-text" dir="auto">${{escapeHtml(c.last_message || 'No messages')}}</span>
                                </div>
                                ${{unreadBadge}}
                            </div>
                        </div>
                    </div>
                `;
            }});
            container.innerHTML = html;
        }}

        async function selectConversation(phone) {{
            activePhone = phone;
            document.getElementById('chat-header').style.display = 'flex';
            document.getElementById('composer-area').style.display = 'flex';
            document.getElementById('active-phone').innerHTML = '<bdi class="phone-isolate">' + escapeHtml(formatPhoneDisplay(phone)) + '</bdi>';
            
            const av = document.getElementById('active-avatar');
            av.innerText = phone.slice(-2);
            av.style.background = getAvatarGradient(phone);
            
            filterConversations();
            await loadMessages(phone);
            document.getElementById('reply-text').focus();
        }}

        function copyActivePhone() {{
            if (!activePhone) return;
            navigator.clipboard.writeText(activePhone);
            const textEl = document.getElementById('copy-phone-text');
            if (textEl) {{
                textEl.innerText = 'Copied!';
                setTimeout(() => textEl.innerText = 'Copy Phone', 1800);
            }}
        }}

        function openDirectWhatsApp() {{
            if (!activePhone) return;
            window.open('https://wa.me/' + activePhone.replace(/\\D/g, ''), '_blank');
        }}

        async function loadMessages(phone, isBackground = false) {{
            if (activePhone !== phone) return;
            try {{
                const res = await fetch(`/api/conversations/${{phone}}/messages`);
                const data = await res.json();
                renderMessages(data.messages || [], isBackground);
            }} catch (e) {{}}
        }}

        function renderMessages(messages, isBackground) {{
            const container = document.getElementById('messages-container');
            const wasAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 120;
            
            if (messages.length === 0) {{
                container.innerHTML = `
                    <div class="chat-empty-state">
                        <div class="empty-illustration">
                            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                        </div>
                        <h4 style="color: #ffffff;">No messages yet</h4>
                        <p style="font-size: 13px; color: var(--wa-text-secondary);">Send a reply below or choose a quick template to start.</p>
                    </div>
                `;
                return;
            }}

            let html = '';
            let lastDateStr = '';

            messages.forEach(m => {{
                const isOut = (m.direction === 'outbound' || m.event_type === 'outbound_message');
                const rowClass = isOut ? 'outbound' : 'inbound';
                const timeStr = m.received_at ? m.received_at.slice(11, 16) : '';
                const dateHeader = m.received_at ? formatDatePill(m.received_at) : '';

                if (dateHeader && dateHeader !== lastDateStr) {{
                    html += `
                        <div class="date-divider">
                            <span class="date-divider-pill">${{dateHeader}}</span>
                        </div>
                    `;
                    lastDateStr = dateHeader;
                }}

                // WhatsApp Vector Double Blue Checkmarks
                let statusIcon = '';
                if (isOut) {{
                    const st = (m.status || 'SENT').toUpperCase();
                    if (st === 'READ') {{
                        statusIcon = '<span class="status-ticks ticks-read" title="Read by customer"><svg width="16" height="11" viewBox="0 0 16 11" fill="currentColor"><path d="M11.07 0L5.65 5.42L3.12 2.89L2 4.01L5.65 7.66L12.19 1.12L11.07 0ZM14.88 0L9.46 5.42L8.34 4.3L7.22 5.42L9.46 7.66L16 1.12L14.88 0Z"/></svg></span>';
                    }} else if (st === 'DELIVERED') {{
                        statusIcon = '<span class="status-ticks ticks-delivered" title="Delivered"><svg width="16" height="11" viewBox="0 0 16 11" fill="currentColor"><path d="M11.07 0L5.65 5.42L3.12 2.89L2 4.01L5.65 7.66L12.19 1.12L11.07 0ZM14.88 0L9.46 5.42L8.34 4.3L7.22 5.42L9.46 7.66L16 1.12L14.88 0Z"/></svg></span>';
                    }} else if (st === 'FAILED') {{
                        statusIcon = '<span style="color: #f87171; font-size: 12px;" title="' + escapeHtml(m.error || 'Failed') + '">⚠️</span>';
                    }} else {{
                        statusIcon = '<span class="status-ticks ticks-sent" title="Sent"><svg width="12" height="11" viewBox="0 0 12 11" fill="currentColor"><path d="M4.58 7.66L1 4.08L2.12 2.96L4.58 5.42L10.02 0L11.14 1.12L4.58 7.66Z"/></svg></span>';
                    }}
                }}

                html += `
                    <div class="bubble-row ${{rowClass}}">
                        <div class="bubble ${{rowClass}}">
                            <div class="bubble-text" dir="auto">${{escapeHtml(m.content || '')}}</div>
                            <div class="bubble-meta">
                                <span>${{timeStr}}</span>
                                ${{statusIcon}}
                            </div>
                        </div>
                    </div>
                `;
            }});

            container.innerHTML = html;
            if (!isBackground || wasAtBottom) container.scrollTop = container.scrollHeight;
        }}

        async function sendReply() {{
            if (!activePhone || isSending) return;
            const input = document.getElementById('reply-text');
            const text = input.value.trim();
            if (!text) return;

            isSending = true;
            const btn = document.getElementById('send-button');
            btn.disabled = true;

            try {{
                const res = await fetch(`/api/conversations/${{activePhone}}/reply`, {{
                    method: 'POST',
                    headers: {{ 'Content-Type': 'application/json' }},
                    body: JSON.stringify({{ text: text, purpose: document.getElementById('reply-purpose').value || null }})
                }});
                const data = await res.json();
                if (!res.ok || !data.success) {{
                    const err = data.error || 'Failed to dispatch WhatsApp message.';
                    alert('WhatsApp send failed: ' + err + ' - Please click Settings to configure API keys.');
                    openSettingsModal();
                }} else {{
                    input.value = '';
                    if (data.engagement && !data.engagement.logged) console.warn('Sent, but not logged to CRM:', data.engagement.reason);
                    setPurpose('');
                }}
                await loadMessages(activePhone);
                await loadConversations(true);
            }} catch (e) {{
                alert('Send failed: ' + e);
            }} finally {{
                isSending = false;
                btn.disabled = false;
                input.focus();
            }}
        }}

        function handleKey(e) {{
            if (e.key === 'Enter' && !e.shiftKey) {{
                e.preventDefault();
                sendReply();
            }}
        }}

        function insertTemplate(text) {{
            const input = document.getElementById('reply-text');
            input.value = text;
            input.focus();
        }}

        // --- DELIVERY REPORTS TAB ---
        let statsSource = 'campaign';
        let cachedLiveKPIs = null;

        const UNIFONIC_CAMPAIGN_DATA = {{
            total: 444,
            submitted: 444,
            sent: 341,
            delivered: 296,
            read: 83,
            unconfirmed: 0,
            failed: 103,
            success_rate: 76.8,
            read_rate: 28.0,
            channel: 'WhatsApp',
            utility: 0,
            marketing: 0,
            marketing_lite: 293,
            authentication: 0,
            service: 0,
            messages_sent: 343,
            messages_received: 11,
            messages_delivered: 294,
            estimated_spending_bi: '14.68',
            estimated_spending_ui: '0.00'
        }};

        function setStatsSource(src) {{
            statsSource = src;
            const btnCamp = document.getElementById('btn-view-campaign');
            const btnLive = document.getElementById('btn-view-live');
            if (btnCamp) btnCamp.classList.toggle('active', src === 'campaign');
            if (btnLive) btnLive.classList.toggle('active', src === 'live');
            updateStatsDisplay();
        }}

        function updateStatsDisplay() {{
            const data = (statsSource === 'campaign') ? UNIFONIC_CAMPAIGN_DATA : (cachedLiveKPIs || UNIFONIC_CAMPAIGN_DATA);
            
            // 1. KPI Cards
            const setTxt = (id, val) => {{ const el = document.getElementById(id); if (el) el.innerText = val; }};
            setTxt('kpi-total-dispatched', data.total || 0);
            setTxt('kpi-sent-rate', (data.success_rate || 0) + '%');
            setTxt('kpi-read-rate', (data.read_rate || 28.0) + '%');
            setTxt('kpi-failed-count', data.failed || 0);
            setTxt('kpi-spend-usd', '$' + (data.estimated_spending_bi || '14.68'));

            // 2. Donut Chart
            const rate = data.success_rate || 0;
            setTxt('donut-rate-text', rate + '%');
            const arc = document.getElementById('donut-arc-success');
            if (arc) {{
                const circumference = 515.2; // 2 * pi * 82
                const offset = circumference * (1 - (rate / 100));
                arc.style.strokeDasharray = circumference;
                arc.style.strokeDashoffset = offset;
            }}

            // 3. Status Breakdown
            setTxt('bd-total', data.total || 0);
            setTxt('bd-submitted', data.submitted || 0);
            setTxt('bd-sent', data.sent || 0);
            setTxt('bd-delivered', data.delivered || 0);
            setTxt('bd-read', data.read || 0);
            setTxt('bd-failed', data.failed || 0);

            // 4. Channel Usage
            setTxt('ch-utility', data.utility || 0);
            setTxt('ch-marketing', data.marketing || 0);
            setTxt('ch-marketing-lite', data.marketing_lite || 0);
            setTxt('ch-auth', data.authentication || 0);
            setTxt('ch-service', data.service || 0);
            setTxt('ch-sent', data.messages_sent || 0);
            setTxt('ch-recv', data.messages_received || 0);
            setTxt('ch-deliv', data.messages_delivered || 0);
            setTxt('ch-spend-bi', '$' + (data.estimated_spending_bi || '0.00'));
        }}

        function applyStatusFilter(status, el) {{
            document.querySelectorAll('.breakdown-row').forEach(r => r.classList.remove('active'));
            if (el) el.classList.add('active');
            const sel = document.getElementById('report-status-filter');
            if (sel) {{
                sel.value = status;
            }}
            loadReports();
        }}

        async function loadReports(isBackground = false) {{
            const statusFilter = document.getElementById('report-status-filter').value;
            const phoneFilter = document.getElementById('report-phone-filter').value.trim();
            try {{
                const res = await fetch(`/api/reports?status=${{statusFilter}}&phone=${{phoneFilter}}`);
                const data = await res.json();
                renderReports(data);
            }} catch (e) {{}}
        }}

        function renderReports(data) {{
            cachedLiveKPIs = data.kpis || {{}};
            updateStatsDisplay();

            const tbody = document.getElementById('reports-table-body');
            const reports = data.reports || [];
            if (reports.length === 0) {{
                tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 28px; color: var(--wa-text-secondary);">No delivery reports match your filter.</td></tr>';
                return;
            }}

            let html = '';
            reports.forEach(r => {{
                const st = r.status || 'SENT';
                const sentTime = r.sent_at ? formatDateTime(r.sent_at) : '-';
                const delivTime = r.delivered_at ? formatDateTime(r.delivered_at) : '-';
                const readTime = r.read_at ? formatDateTime(r.read_at) : '-';
                const cleanPhone = formatPhoneDisplay(r.recipient);

                html += `
                    <tr>
                        <td><code style="color: var(--wa-green-bright); font-size: 11.5px;">${{escapeHtml(r.message_id)}}</code></td>
                        <td><strong class="phone-isolate"><bdi>${{cleanPhone}}</bdi></strong></td>
                        <td><span class="badge-status badge-${{st}}">${{st}}</span></td>
                        <td><span class="phone-isolate">${{sentTime}}</span></td>
                        <td><span class="phone-isolate">${{delivTime}}</span></td>
                        <td><span class="phone-isolate">${{readTime}}</span></td>
                        <td dir="auto" style="direction: auto; unicode-bidi: plaintext; text-align: start; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                            ${{r.error ? '<span style="color:#f87171;" title="' + escapeHtml(r.error) + '">⚠️ ' + escapeHtml(r.error) + '</span>' : escapeHtml(r.content || '-')}}
                        </td>
                    </tr>
                `;
            }});
            tbody.innerHTML = html;
        }}

        async function syncUnifonicStatus() {{
            const btn = document.getElementById('sync-unifonic-btn');
            if (btn) {{
                btn.disabled = true;
                btn.innerHTML = '<span>⏳ Syncing via GET...</span>';
            }}
            try {{
                const res = await fetch('/api/unifonic/sync', {{ method: 'POST' }});
                const data = await res.json();
                if (data.success) {{
                    alert('Unifonic GET Sync complete: queried ' + (data.queried_count || 0) + ' messages, updated ' + (data.results_received || 0) + ' delivery receipts.');
                    await loadReports();
                }} else {{
                    alert('Sync error: ' + (data.error || 'Failed to sync.'));
                }}
            }} catch (e) {{
                alert('Sync failed: ' + e);
            }} finally {{
                if (btn) {{
                    btn.disabled = false;
                    btn.innerHTML = '<span>🔄 Sync from Unifonic (GET)</span>';
                }}
            }}
        }}

        // --- WEBHOOK STREAM TAB ---
        async function loadRawFeed() {{
            try {{
                const res = await fetch('/api/events?limit=30');
                const data = await res.json();
                const container = document.getElementById('raw-feed-container');
                const events = data.events || [];
                if (events.length === 0) {{
                    container.innerHTML = '<div style="color: var(--wa-text-secondary); text-align: center; padding: 28px;">No webhook events received yet.</div>';
                    return;
                }}
                let html = '';
                events.forEach(ev => {{
                    const evType = ev.event_type || 'unknown';
                    const time = ev.received_at || '';
                    html += `
                        <div class="event-card">
                            <div class="event-header">
                                <span class="badge-status badge-${{evType.toUpperCase()}}" style="background: var(--wa-surface); color: var(--wa-green-bright);">${{evType}}</span>
                                <span style="font-size: 12px; color: var(--wa-text-secondary);">${{time}}</span>
                            </div>
                            <div class="json-block">${{escapeHtml(JSON.stringify(ev, null, 2))}}</div>
                        </div>
                    `;
                }});
                container.innerHTML = html;
            }} catch (e) {{}}
        }}

        // --- ENGAGEMENT TAGGING (usage nudges / renewal reminders → CRM log) ---
        function setPurpose(value) {{
            const sel = document.getElementById('reply-purpose');
            if (sel) sel.value = value;
        }}
        function buildStartChatPayload(phone, msg) {{
            const purpose = document.getElementById('new-purpose').value || null;
            const code = document.getElementById('new-member-code').value.trim();
            const payload = {{ phone: phone, initial_message: msg, purpose: purpose }};
            if (code) {{
                if (/^SUB/i.test(code)) payload.subscription_code = code.toUpperCase();
                else payload.customer_code = code.toUpperCase();
            }}
            return payload;
        }}

        // --- MODALS & HELPERS ---
        function openNewChatModal() {{
            document.getElementById('new-chat-modal').style.display = 'flex';
            document.getElementById('new-phone').focus();
        }}
        function closeNewChatModal() {{
            document.getElementById('new-chat-modal').style.display = 'none';
        }}
        async function submitNewChat() {{
            const phone = document.getElementById('new-phone').value.trim();
            const msg = document.getElementById('new-initial-msg').value.trim();
            if (!phone) return alert('Please enter a phone number');
            
            const res = await fetch('/api/conversations/start', {{
                method: 'POST',
                headers: {{ 'Content-Type': 'application/json' }},
                body: JSON.stringify(buildStartChatPayload(phone, msg))
            }});
            const data = await res.json();
            closeNewChatModal();
            await loadConversations();
            selectConversation(data.phone);
        }}

        async function openSettingsModal() {{
            try {{
                const res = await fetch('/api/settings');
                const data = await res.json();
                if (data.public_id) {{
                    const pInput = document.getElementById('settings-public-id');
                    if (pInput) pInput.value = data.public_id;
                }}
                if (data.channel_id) {{
                    const cInput = document.getElementById('settings-channel-id');
                    if (cInput) cInput.value = data.channel_id;
                }}
                if (data.is_secret_set) {{
                    const sInput = document.getElementById('settings-secret-key');
                    if (sInput) sInput.placeholder = '•••••••• (Configured)';
                }}
            }} catch (e) {{}}
            document.getElementById('settings-modal').style.display = 'flex';
        }}
        function closeSettingsModal() {{
            document.getElementById('settings-modal').style.display = 'none';
        }}
        async function saveSettings() {{
            const pid = document.getElementById('settings-public-id').value.trim();
            const cid = document.getElementById('settings-channel-id').value.trim();
            const sec = document.getElementById('settings-secret-key').value.trim();
            try {{
                const payload = {{ public_id: pid, channel_id: cid }};
                if (sec) payload.secret_key = sec;
                const res = await fetch('/api/settings', {{
                    method: 'POST',
                    headers: {{ 'Content-Type': 'application/json' }},
                    body: JSON.stringify(payload)
                }});
                closeSettingsModal();
                alert('✅ Settings saved! WhatsApp dispatch is active.');
            }} catch (e) {{
                alert('Failed to save settings: ' + e);
            }}
        }}

        function formatDatePill(isoStr) {{
            if (!isoStr) return '';
            try {{
                const d = new Date(isoStr);
                if (isNaN(d.getTime())) return '';
                const now = new Date();
                const isToday = d.toDateString() === now.toDateString();
                if (isToday) return 'Today';
                const yesterday = new Date();
                yesterday.setDate(now.getDate() - 1);
                if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
                return d.toLocaleDateString([], {{ month: 'short', day: 'numeric', year: 'numeric' }});
            }} catch (e) {{ return ''; }}
        }}

        function formatTime(isoStr) {{
            if (!isoStr) return '';
            try {{
                const d = new Date(isoStr);
                if (isNaN(d.getTime())) return '';
                const now = new Date();
                const isToday = d.toDateString() === now.toDateString();
                const timePart = d.toLocaleTimeString([], {{ hour: '2-digit', minute: '2-digit', hour12: true }});
                if (isToday) return timePart;
                const yesterday = new Date();
                yesterday.setDate(now.getDate() - 1);
                if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
                return d.toLocaleDateString([], {{ month: 'short', day: 'numeric' }});
            }} catch (e) {{ return ''; }}
        }}

        function formatDateTime(isoStr) {{
            if (!isoStr) return '';
            try {{
                const d = new Date(isoStr);
                return d.toLocaleDateString([], {{ month: 'short', day: 'numeric' }}) + ' ' + d.toLocaleTimeString([], {{ hour: '2-digit', minute: '2-digit' }});
            }} catch (e) {{ return ''; }}
        }}

        function escapeHtml(text) {{
            if (!text) return '';
            return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
        }}
    </script>
</body>
</html>"""
