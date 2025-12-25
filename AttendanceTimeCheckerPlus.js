(function() {
    'use strict';
    
    // ====================================
    // ENHANCED ATTENDANCE TIME CHECKER 2025
    // Modern UI with Glassmorphism & Emoji Progression
    // ====================================
    
    const currentUrl = window.location.href;
    const targetUrl = "https://globalportal.mtbc.com/#/time-absence/attendence-record";

    if (currentUrl !== targetUrl) {
        return; 
    }

    // Emoji progression for GenZ vibes 😎
    const emojiSets = {
        fun: ['😭', '😖', '😟', '😓', '😌', '🙂', '☺️', '😄'],
        professional: ['🔴', '🟠', '🟡', '🟡', '🟢', '🟢', '🔵', '🔵']
    };
    
    const runningEmoji = '🏃💨'; // 8:00 to 8:30 hours
    const clownEmoji = '🫵🤡'; // After 8:30 hours
    
    // Global variables for performance optimization
    let lastTotalWorkedTime = -1; // Track if we need to re-render
    let isFirstRender = true; // Track first render
    let animationFrameId = null; // For requestAnimationFrame
    let pipWindow = null; // Picture-in-Picture window reference
    let isPipActive = false; // Track PiP status
    
    // User preferences for hyper-personalization
    let userPreferences = {
        theme: 'vibrant', // 'vibrant' or 'subdued'
        neumorphicDepth: true,
        fluidGradients: true,
        emojiSet: 'fun', // 'fun', 'professional'
        displayTheme: 'glassmorphic' // 'glassmorphic' or 'retro-futuristic'
    };
    
    // Load saved preferences
    function loadPreferences() {
        const saved = localStorage.getItem('attendancePrefs');
        if (saved) {
            userPreferences = { ...userPreferences, ...JSON.parse(saved) };
        }
    }
    
    // Save preferences
    function savePreferences() {
        localStorage.setItem('attendancePrefs', JSON.stringify(userPreferences));
    }
    
    // Cache for preventing unnecessary updates
    let cachedValues = {
        totalWorked: '',
        remaining: '',
        completion: '',
        emoji: '',
        progress: -1
    };
    
    // Mouse position for parallax effects
    let mouseX = 0;
    let mouseY = 0;
    
    // Modern CSS styles following 2025 trends
    const modernStyles = `
        <style id="attendance-modern-styles">
            @import url('https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap');
            @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&display=swap');
            @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap');
            
            :root {
                --mouse-x: 0;
                --mouse-y: 0;
                --aurora-1: #667eea;
                --aurora-2: #764ba2;
                --aurora-3: #f093fb;
                --aurora-4: #4facfe;
                --neon-cyan: #00f0ff;
                --neon-magenta: #ff00ff;
                --neon-green: #00ff41;
                --retro-dark: #0a0e27;
                --retro-dark-alt: #1a1d3a;
            }
            
            .attendance-summary {
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05));
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 24px;
                box-shadow: 
                    0 8px 32px rgba(0, 0, 0, 0.1),
                    0 1px 2px rgba(0, 0, 0, 0.05),
                    inset 0 1px 0 rgba(255, 255, 255, 0.1),
                    5px 5px 15px rgba(0, 0, 0, 0.08),
                    -5px -5px 15px rgba(255, 255, 255, 0.05);
                margin: 32px auto;
                padding: 32px;
                max-width: 800px;
                position: relative;
                overflow: hidden;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1), background 0.5s ease, color 0.5s ease, border-color 0.5s ease;
                transform-style: preserve-3d;
            }
            
            .attendance-summary::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 2px;
                background: linear-gradient(
                    90deg, 
                    transparent, 
                    var(--aurora-1), 
                    var(--aurora-2), 
                    var(--aurora-3), 
                    var(--aurora-4), 
                    transparent
                );
                animation: shimmer 3s ease-in-out infinite;
                background-size: 200% 100%;
            }
            
            .attendance-summary:hover {
                transform: translateY(-4px) perspective(1000px) rotateX(calc(var(--mouse-y) * 0.1deg)) rotateY(calc(var(--mouse-x) * 0.1deg));
                box-shadow: 
                    0 20px 60px rgba(0, 0, 0, 0.2),
                    0 6px 16px rgba(0, 0, 0, 0.1),
                    inset 0 1px 0 rgba(255, 255, 255, 0.2),
                    8px 8px 20px rgba(0, 0, 0, 0.12),
                    -8px -8px 20px rgba(255, 255, 255, 0.08);
            }
            
            .summary-header {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 16px;
                margin-bottom: 32px;
                text-align: center;
            }
            
            .emoji-display {
                font-size: 4rem;
                line-height: 1;
                animation: emojiPulse 3s ease-in-out infinite, emojiFloat 6s ease-in-out infinite;
                filter: drop-shadow(0 6px 12px rgba(0, 0, 0, 0.25));
                transition: all 0.4s cubic-bezier(0.68, -0.55, 0.27, 1.55);
                cursor: pointer;
                filter: drop-shadow(0 6px 12px rgba(0, 0, 0, 0.25));
            }
            
            .emoji-display:hover {
                transform: scale(1.15) rotate(5deg);
                filter: drop-shadow(0 8px 16px rgba(0, 0, 0, 0.3));
            }
            
            .summary-title {
                font-size: 1.2rem;
                font-weight: 700;
                font-variation-settings: 'wght' 700;
                background: linear-gradient(
                    135deg, 
                    var(--aurora-1) 0%, 
                    var(--aurora-2) 25%,
                    var(--aurora-3) 50%,
                    var(--aurora-4) 75%,
                    var(--aurora-1) 100%
                );
                background-size: 200% 200%;
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
                margin: 0;
                letter-spacing: -0.02em;
                animation: gradientFlow 8s ease infinite, titlePulse 4s ease-in-out infinite;
            }
            
            .modern-table {
                width: 100%;
                border-collapse: collapse;
                margin: 24px 0;
                background: rgba(255, 255, 255, 0.05);
                border-radius: 16px;
                overflow: hidden;
                box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
                transition: background 0.5s ease, box-shadow 0.5s ease;
            }
            
            .modern-table thead {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
            }
            
            .modern-table th {
                padding: 16px 20px;
                font-weight: 600;
                font-size: 0.875rem;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                border: none;
            }
            
            .modern-table td {
                padding: 16px 20px;
                border: none;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                font-weight: 500;
                color: rgba(255, 255, 255, 0.7);
                transition: background-color 0.2s ease, color 0.5s ease, border-color 0.5s ease;
            }
            
            .modern-table tbody tr {
                transition: all 0.1s ease;
            }
            
            .modern-table tbody tr:hover {
                background: rgba(255, 255, 255, 0.1);
                transform: scale(1.01);
            }
            
            .modern-table tbody tr:nth-child(even) {
                background: rgba(255, 255, 255, 0.03);
            }
            
            .gap-warning {
                background: linear-gradient(135deg, #ffeaa7, #fab1a0) !important;
                color: #2d3436 !important;
                font-weight: 600;
                text-align: center;
                padding: 12px !important;
                border-radius: 8px;
                margin: 8px 0;
                animation: warningPulse 1s ease-in-out infinite;
            }
            
            .time-stats {
                display: grid;
                grid-template-columns: 1fr 1fr 1fr;
                grid-template-rows: auto;
                gap: 20px;
                margin: 32px 0;
            }
            
            .stat-card {
                background: rgba(255, 255, 255, 0.08);
                border: 1px solid rgba(255, 255, 255, 0.15);
                border-radius: 20px;
                padding: 24px;
                text-align: center;
                transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
                position: relative;
                overflow: hidden;
                cursor: pointer;
                box-shadow: 
                    inset 5px 5px 10px rgba(0, 0, 0, 0.05),
                    inset -5px -5px 10px rgba(255, 255, 255, 0.05),
                    5px 5px 15px rgba(0, 0, 0, 0.1),
                    -2px -2px 10px rgba(255, 255, 255, 0.05);
            }
            
            .stat-card.worked-time-card {
                background: linear-gradient(135deg, rgba(0, 184, 148, 0.25), rgba(0, 184, 148, 0.1));
                border-color: rgba(0, 184, 148, 0.35);
            }
            
            .stat-card.remaining-time-card {
                background: linear-gradient(135deg, rgba(225, 112, 85, 0.25), rgba(225, 112, 85, 0.1));
                border-color: rgba(225, 112, 85, 0.35);
            }
            
            .stat-card.completion-time-card {
                background: linear-gradient(135deg, rgba(108, 92, 231, 0.25), rgba(108, 92, 231, 0.1));
                border-color: rgba(108, 92, 231, 0.35);
            }
            
            .stat-card::before {
                content: '';
                position: absolute;
                top: 0;
                left: -100%;
                width: 100%;
                height: 3px;
                background: linear-gradient(
                    90deg, 
                    transparent, 
                    var(--aurora-1), 
                    var(--aurora-2), 
                    var(--aurora-3), 
                    transparent
                );
                animation: cardShimmer 2s ease-in-out infinite;
                opacity: 0;
                transition: opacity 0.3s ease;
            }
            
            .stat-card:hover::before {
                opacity: 1;
            }
            
            .stat-card:hover {
                transform: translateY(-6px) scale(1.03) translateZ(20px);
                box-shadow: 
                    inset 8px 8px 15px rgba(0, 0, 0, 0.08),
                    inset -8px -8px 15px rgba(255, 255, 255, 0.08),
                    0 12px 32px rgba(0, 0, 0, 0.2),
                    0 4px 12px rgba(0, 0, 0, 0.15);
            }
            
            .stat-card:active {
                transform: translateY(-2px) scale(0.98);
            }
            
            .stat-label {
                font-size: 0.875rem;
                font-weight: 500;
                font-variation-settings: 'wght' 500;
                color: rgba(255, 255, 255, 0.7);
                margin-bottom: 8px;
                text-transform: uppercase;
                letter-spacing: 0.08em;
                transition: color 0.5s ease;
            }
            
            .stat-value {
                font-size: 1.75rem;
                font-weight: 700;
                font-variation-settings: 'wght' 700;
                margin-bottom: 4px;
                transition: font-variation-settings 0.3s ease;
                text-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
            }
            
            .stat-card:hover .stat-value {
                font-variation-settings: 'wght' 800;
            }
            
            .worked-time { 
                color: #00b894;
                text-shadow: 0 2px 12px rgba(0, 184, 148, 0.4);
            }
            .remaining-time { 
                color: #e17055;
                text-shadow: 0 2px 12px rgba(225, 112, 85, 0.4);
            }
            .completion-time { 
                color: #6c5ce7;
                text-shadow: 0 2px 12px rgba(108, 92, 231, 0.4);
            }
            
            .remaining-desc {
                font-size: 0.75rem;
                opacity: 0.8;
                margin-top: 4px;
                font-style: italic;
            }
            
            .completion-message {
                background: linear-gradient(135deg, #00b894, #00cec9);
                color: white;
                padding: 20px;
                border-radius: 16px;
                font-size: 1.25rem;
                font-weight: 600;
                text-align: center;
                margin-top: 24px;
                animation: celebrationPulse 1.5s ease-in-out infinite;
                box-shadow: 0 8px 24px rgba(0, 184, 148, 0.3);
            }
            
            .developer-info {
                position: absolute;
                top: 20px;
                right: 20px;
                background: rgba(255, 255, 255, 0.1);
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 12px;
                padding: 12px;
                cursor: pointer;
                transition: all 0.3s ease;
                z-index: 10;
                font-size: 1.2rem;
                color: #667eea;
                text-decoration: none;
            }
            
            .developer-info:hover {
                transform: scale(1.1);
                background: rgba(255, 255, 255, 0.15);
                border-color: rgba(255, 255, 255, 0.3);
            }
            
            /* Settings Button */
            .settings-button {
                position: absolute;
                top: 20px;
                right: 70px;
                background: rgba(255, 255, 255, 0.1);
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 12px;
                padding: 12px;
                cursor: pointer;
                transition: all 0.3s cubic-bezier(0.68, -0.55, 0.27, 1.55);
                z-index: 10;
                font-size: 1.2rem;
                color: #764ba2;
            }
            
            .settings-button:hover {
                transform: scale(1.1) rotate(90deg);
                background: rgba(255, 255, 255, 0.15);
                border-color: rgba(255, 255, 255, 0.3);
            }
            
            .developer-tooltip {
                position: absolute;
                top: 60px;
                right: 0;
                background: rgba(0, 0, 0, 0.9);
                color: white;
                padding: 12px 16px;
                border-radius: 8px;
                font-size: 0.75rem;
                font-weight: 500;
                white-space: nowrap;
                opacity: 0;
                visibility: hidden;
                transition: all 0.3s ease;
                transform: translateY(-10px);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                min-width: 200px;
            }
            
            .developer-info:hover .developer-tooltip {
                opacity: 1;
                visibility: visible;
                transform: translateY(0);
            }
            
            .developer-tooltip::before {
                content: '';
                position: absolute;
                bottom: 100%;
                right: 20px;
                border: 5px solid transparent;
                border-bottom-color: rgba(0, 0, 0, 0.9);
            }
            
            /* Picture-in-Picture Button Styles */
            .pip-button {
                position: absolute;
                top: 20px;
                left: 20px;
                background: linear-gradient(135deg, #667eea, #764ba2);
                color: white;
                border: none;
                border-radius: 12px;
                padding: 10px 14px;
                cursor: pointer;
                transition: all 0.3s ease;
                z-index: 10;
                font-size: 0.875rem;
                font-weight: 600;
                display: none; /* Hidden by default, shown when PiP is supported */
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.2);
            }
            
            .pip-button:hover {
                transform: scale(1.05) translateY(-2px);
                box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
                background: linear-gradient(135deg, #764ba2, #667eea);
            }
            
            .pip-button:active {
                transform: scale(0.98);
            }
            
            .pip-button.active {
                background: linear-gradient(135deg, #e17055, #fab1a0);
                box-shadow: 0 6px 20px rgba(225, 112, 85, 0.4);
            }
            
            .pip-button.active:hover {
                background: linear-gradient(135deg, #fab1a0, #e17055);
            }
            
            .pip-icon {
                display: inline-block;
                margin-right: 6px;
                font-size: 1rem;
            }
            
            /* PiP Active State Styles */
            .attendance-summary.pip-active {
                background: linear-gradient(135deg, rgba(225, 112, 85, 0.1), rgba(225, 112, 85, 0.05));
                border-color: rgba(225, 112, 85, 0.3);
            }
            
            .pip-placeholder {
                display: none;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                min-height: 200px;
                text-align: center;
                color: rgba(255, 255, 255, 0.7);
            }
            
            .pip-placeholder.active {
                display: flex;
            }
            
            .pip-placeholder-icon {
                font-size: 3rem;
                margin-bottom: 12px;
                opacity: 0.6;
            }
            
            .pip-placeholder-text {
                font-size: 1.1rem;
                font-weight: 600;
                margin-bottom: 6px;
            }
            
            .pip-placeholder-desc {
                font-size: 0.8rem;
                opacity: 0.7;
            }
            
            /* PiP Window Specific Styles */
            .pip-window-content {
                padding: 16px !important;
                margin: 0 !important;
                max-width: none !important;
                border-radius: 0 !important;
                box-shadow: none !important;
                border: none !important;
                background: linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05)) !important;
                backdrop-filter: blur(20px) !important;
                -webkit-backdrop-filter: blur(20px) !important;
                min-height: auto !important;
                height: auto !important;
                overflow: visible !important;
                transition: all 0.3s ease !important;
            }
            
            /* PiP Window Dark Mode - Theme Aware */
            @media (prefers-color-scheme: dark) {
                /* Glassmorphic Theme for PiP */
                .pip-window-content:not(.retro-theme) {
                    background: linear-gradient(135deg, rgba(30, 30, 30, 0.95), rgba(20, 20, 20, 0.9)) !important;
                    color: rgba(255, 255, 255, 0.95) !important;
                    position: relative !important;
                    overflow: hidden !important;
                }
                
                .pip-window-content:not(.retro-theme) .modern-table {
                    background: rgba(0, 0, 0, 0.3) !important;
                    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3) !important;
                    border: 1px solid rgba(255, 255, 255, 0.1) !important;
                    position: relative !important;
                    z-index: 1 !important;
                }
                
                .pip-window-content:not(.retro-theme) .modern-table td {
                    color: rgba(255, 255, 255, 0.85) !important;
                    font-family: 'Inter', sans-serif !important;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.15) !important;
                }
                
                .pip-window-content:not(.retro-theme) .stat-card {
                    background: rgba(0, 0, 0, 0.4) !important;
                    border: 1px solid rgba(255, 255, 255, 0.15) !important;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3) !important;
                    position: relative !important;
                    z-index: 1 !important;
                }
                
                .pip-window-content:not(.retro-theme) .stat-label {
                    color: rgba(255, 255, 255, 0.7) !important;
                    font-family: 'Inter', sans-serif !important;
                }
                
                .pip-window-content:not(.retro-theme) .stat-value {
                    font-family: 'Inter', sans-serif !important;
                }
                
                .pip-window-content:not(.retro-theme) .progress-bar {
                    background: rgba(255, 255, 255, 0.15) !important;
                    border: none !important;
                }
                
                .pip-window-content:not(.retro-theme) .pip-compact-button {
                    background: rgba(255, 255, 255, 0.2) !important;
                    color: rgba(255, 255, 255, 0.9) !important;
                    border: 1px solid rgba(255, 255, 255, 0.2) !important;
                    font-family: 'Inter', sans-serif !important;
                }
                
                .pip-window-content:not(.retro-theme) .pip-compact-button:hover {
                    background: rgba(108, 92, 231, 0.8) !important;
                    color: white !important;
                }
                
                .pip-window-content:not(.retro-theme) .summary-title {
                    font-family: 'Inter', sans-serif !important;
                    background: linear-gradient(135deg, #667eea, #764ba2) !important;
                    -webkit-background-clip: text !important;
                    -webkit-text-fill-color: transparent !important;
                }
                
                /* Retro-Futuristic Theme for PiP */
                .pip-window-content.retro-theme {
                    background: linear-gradient(135deg, var(--retro-dark) 0%, var(--retro-dark-alt) 100%) !important;
                    color: var(--neon-cyan) !important;
                    position: relative !important;
                    overflow: hidden !important;
                }
                
                .pip-window-content.retro-theme::before {
                    content: '' !important;
                    position: absolute !important;
                    top: 0 !important;
                    left: 0 !important;
                    right: 0 !important;
                    bottom: 0 !important;
                    background: repeating-linear-gradient(
                        0deg,
                        rgba(0, 240, 255, 0.02) 0px,
                        transparent 1px,
                        transparent 2px,
                        rgba(0, 240, 255, 0.02) 3px
                    ) !important;
                    animation: scanlines 8s linear infinite !important;
                    pointer-events: none !important;
                    z-index: 0 !important;
                }
                
                .pip-window-content.retro-theme .modern-table {
                    background: rgba(0, 0, 0, 0.5) !important;
                    box-shadow: 
                        0 0 10px rgba(0, 240, 255, 0.3),
                        inset 0 0 20px rgba(0, 240, 255, 0.05) !important;
                    border: 1px solid rgba(0, 240, 255, 0.2) !important;
                    position: relative !important;
                    z-index: 1 !important;
                }
                
                .pip-window-content.retro-theme .modern-table td {
                    color: rgba(0, 240, 255, 0.9) !important;
                    font-family: 'Share Tech Mono', monospace !important;
                    border-bottom: 1px solid rgba(0, 240, 255, 0.15) !important;
                }
                
                .pip-window-content.retro-theme .stat-card {
                    background: rgba(0, 0, 0, 0.6) !important;
                    border: 1px solid var(--neon-cyan) !important;
                    box-shadow: 
                        0 0 10px var(--neon-cyan),
                        inset 0 0 10px rgba(0, 240, 255, 0.1) !important;
                    position: relative !important;
                    z-index: 1 !important;
                    animation: neonPulse 4s ease-in-out infinite !important;
                }
                
                .pip-window-content.retro-theme .stat-card.worked-time-card {
                    border-color: var(--neon-cyan) !important;
                    box-shadow: 
                        0 0 15px var(--neon-cyan),
                        inset 0 0 15px rgba(0, 240, 255, 0.15) !important;
                }
                
                .pip-window-content.retro-theme .stat-card.remaining-time-card {
                    border-color: var(--neon-magenta) !important;
                    box-shadow: 
                        0 0 15px var(--neon-magenta),
                        inset 0 0 15px rgba(255, 0, 255, 0.15) !important;
                }
                
                .pip-window-content.retro-theme .stat-card.completion-time-card {
                    border-color: var(--neon-green) !important;
                    box-shadow: 
                        0 0 15px var(--neon-green),
                        inset 0 0 15px rgba(0, 255, 65, 0.15) !important;
                }
                
                .pip-window-content.retro-theme .stat-label {
                    color: rgba(0, 240, 255, 0.7) !important;
                    font-family: 'Orbitron', sans-serif !important;
                    text-shadow: 0 0 5px var(--neon-cyan) !important;
                }
                
                .pip-window-content.retro-theme .stat-value {
                    font-family: 'Share Tech Mono', monospace !important;
                    text-shadow: 0 0 10px currentColor !important;
                }
                
                .pip-window-content.retro-theme .worked-time {
                    color: var(--neon-cyan) !important;
                    text-shadow: 0 0 15px var(--neon-cyan) !important;
                }
                
                .pip-window-content.retro-theme .remaining-time {
                    color: var(--neon-magenta) !important;
                    text-shadow: 0 0 15px var(--neon-magenta) !important;
                }
                
                .pip-window-content.retro-theme .completion-time {
                    color: var(--neon-green) !important;
                    text-shadow: 0 0 15px var(--neon-green) !important;
                }
                
                .pip-window-content.retro-theme .progress-bar {
                    background: rgba(0, 0, 0, 0.5) !important;
                    border: 1px solid rgba(0, 240, 255, 0.3) !important;
                    box-shadow: inset 0 0 10px rgba(0, 240, 255, 0.2) !important;
                }
                
                .pip-window-content.retro-theme .progress-fill {
                    background: linear-gradient(
                        90deg,
                        var(--neon-cyan),
                        var(--neon-magenta),
                        var(--neon-green),
                        var(--neon-cyan)
                    ) !important;
                    box-shadow: 
                        0 0 10px var(--neon-cyan),
                        0 0 20px rgba(0, 240, 255, 0.5) !important;
                }
                
                .pip-window-content.retro-theme .pip-compact-button {
                    background: rgba(0, 0, 0, 0.8) !important;
                    color: var(--neon-cyan) !important;
                    border: 1px solid var(--neon-cyan) !important;
                    box-shadow: 0 0 5px var(--neon-cyan) !important;
                    font-family: 'Orbitron', sans-serif !important;
                }
                
                .pip-window-content.retro-theme .pip-compact-button:hover {
                    background: rgba(0, 240, 255, 0.2) !important;
                    color: white !important;
                    box-shadow: 0 0 15px var(--neon-cyan) !important;
                }
                
                .pip-window-content.retro-theme .summary-title {
                    font-family: 'Orbitron', sans-serif !important;
                    color: var(--neon-cyan) !important;
                    text-shadow: 
                        0 0 10px var(--neon-cyan),
                        0 0 20px var(--neon-cyan),
                        0 0 30px rgba(0, 240, 255, 0.5) !important;
                }
            }
            
            /* PiP Window Light Mode - Theme Aware */
            @media (prefers-color-scheme: light) {
                /* Glassmorphic Theme for PiP */
                .pip-window-content:not(.retro-theme) {
                    background: linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(248, 248, 248, 0.95)) !important;
                    color: rgba(0, 0, 0, 0.9) !important;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15) !important;
                    position: relative !important;
                    overflow: hidden !important;
                }
                
                .pip-window-content:not(.retro-theme) .modern-table {
                    background: rgba(255, 255, 255, 0.9) !important;
                    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1) !important;
                    border: 1px solid rgba(0, 0, 0, 0.1) !important;
                    position: relative !important;
                    z-index: 1 !important;
                }
                
                .pip-window-content:not(.retro-theme) .modern-table td {
                    color: rgba(0, 0, 0, 0.8) !important;
                    font-family: 'Inter', sans-serif !important;
                    border-bottom: 1px solid rgba(0, 0, 0, 0.1) !important;
                }
                
                .pip-window-content:not(.retro-theme) .stat-card {
                    background: rgba(255, 255, 255, 0.8) !important;
                    border: 1px solid rgba(0, 0, 0, 0.1) !important;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08) !important;
                    position: relative !important;
                    z-index: 1 !important;
                }\n                \n                .pip-window-content:not(.retro-theme) .stat-card.worked-time-card {\n                    background: linear-gradient(135deg, rgba(0, 184, 148, 0.15), rgba(0, 184, 148, 0.08)) !important;\n                    border-color: rgba(0, 184, 148, 0.3) !important;\n                }\n                \n                .pip-window-content:not(.retro-theme) .stat-card.remaining-time-card {\n                    background: linear-gradient(135deg, rgba(225, 112, 85, 0.15), rgba(225, 112, 85, 0.08)) !important;\n                    border-color: rgba(225, 112, 85, 0.3) !important;\n                }\n                \n                .pip-window-content:not(.retro-theme) .stat-card.completion-time-card {\n                    background: linear-gradient(135deg, rgba(108, 92, 231, 0.15), rgba(108, 92, 231, 0.08)) !important;\n                    border-color: rgba(108, 92, 231, 0.3) !important;\n                }\n                \n                .pip-window-content:not(.retro-theme) .stat-label {\n                    color: rgba(0, 0, 0, 0.6) !important;\n                    font-family: 'Inter', sans-serif !important;\n                }\n                \n                .pip-window-content:not(.retro-theme) .stat-value {\n                    font-family: 'Inter', sans-serif !important;\n                }\n                \n                .pip-window-content:not(.retro-theme) .progress-bar {\n                    background: rgba(0, 0, 0, 0.1) !important;\n                    border: none !important;\n                }\n                \n                .pip-window-content:not(.retro-theme) .pip-compact-button {\n                    background: rgba(0, 0, 0, 0.1) !important;\n                    color: rgba(0, 0, 0, 0.7) !important;\n                    border: 1px solid rgba(0, 0, 0, 0.1) !important;\n                    font-family: 'Inter', sans-serif !important;\n                }\n                \n                .pip-window-content:not(.retro-theme) .pip-compact-button:hover {\n                    background: rgba(108, 92, 231, 0.8) !important;\n                    color: white !important;\n                }\n                \n                .pip-window-content:not(.retro-theme) .summary-title {\n                    font-family: 'Inter', sans-serif !important;\n                    background: linear-gradient(135deg, #667eea, #764ba2) !important;\n                    -webkit-background-clip: text !important;\n                    -webkit-text-fill-color: transparent !important;\n                }\n                \n                /* Retro-Futuristic Theme for PiP */\n                .pip-window-content.retro-theme {\n                    background: linear-gradient(135deg, #1a1d3a 0%, #2a2d4a 100%) !important;\n                    color: var(--neon-cyan) !important;\n                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5) !important;\n                    position: relative !important;\n                    overflow: hidden !important;\n                }\n                \n                .pip-window-content.retro-theme::before {\n                    content: '' !important;\n                    position: absolute !important;\n                    top: 0 !important;\n                    left: 0 !important;\n                    right: 0 !important;\n                    bottom: 0 !important;\n                    background: repeating-linear-gradient(\n                        0deg,\n                        rgba(0, 240, 255, 0.02) 0px,\n                        transparent 1px,\n                        transparent 2px,\n                        rgba(0, 240, 255, 0.02) 3px\n                    ) !important;\n                    animation: scanlines 8s linear infinite !important;\n                    pointer-events: none !important;\n                    z-index: 0 !important;\n                }\n                \n                .pip-window-content.retro-theme .modern-table {\n                    background: rgba(0, 0, 0, 0.6) !important;\n                    box-shadow: \n                        0 0 10px rgba(0, 240, 255, 0.3),\n                        inset 0 0 20px rgba(0, 240, 255, 0.05) !important;\n                    border: 1px solid rgba(0, 240, 255, 0.3) !important;\n                    position: relative !important;\n                    z-index: 1 !important;\n                }\n                \n                .pip-window-content.retro-theme .modern-table td {\n                    color: rgba(0, 240, 255, 0.95) !important;\n                    font-family: 'Share Tech Mono', monospace !important;\n                    border-bottom: 1px solid rgba(0, 240, 255, 0.2) !important;\n                }\n                \n                .pip-window-content.retro-theme .stat-card {\n                    background: rgba(0, 0, 0, 0.7) !important;\n                    border: 1px solid var(--neon-cyan) !important;\n                    box-shadow: \n                        0 0 10px var(--neon-cyan),\n                        inset 0 0 10px rgba(0, 240, 255, 0.1) !important;\n                    position: relative !important;\n                    z-index: 1 !important;\n                    animation: neonPulse 4s ease-in-out infinite !important;\n                }\n                \n                .pip-window-content.retro-theme .stat-card.worked-time-card {\n                    border-color: var(--neon-cyan) !important;\n                    box-shadow: \n                        0 0 15px var(--neon-cyan),\n                        inset 0 0 15px rgba(0, 240, 255, 0.15) !important;\n                }\n                \n                .pip-window-content.retro-theme .stat-card.remaining-time-card {\n                    border-color: var(--neon-magenta) !important;\n                    box-shadow: \n                        0 0 15px var(--neon-magenta),\n                        inset 0 0 15px rgba(255, 0, 255, 0.15) !important;\n                }\n                \n                .pip-window-content.retro-theme .stat-card.completion-time-card {\n                    border-color: var(--neon-green) !important;\n                    box-shadow: \n                        0 0 15px var(--neon-green),\n                        inset 0 0 15px rgba(0, 255, 65, 0.15) !important;\n                }\n                \n                .pip-window-content.retro-theme .stat-label {\n                    color: rgba(0, 240, 255, 0.8) !important;\n                    font-family: 'Orbitron', sans-serif !important;\n                    text-shadow: 0 0 5px var(--neon-cyan) !important;\n                }\n                \n                .pip-window-content.retro-theme .stat-value {\n                    font-family: 'Share Tech Mono', monospace !important;\n                    text-shadow: 0 0 10px currentColor !important;\n                }\n                \n                .pip-window-content.retro-theme .worked-time {\n                    color: var(--neon-cyan) !important;\n                    text-shadow: 0 0 15px var(--neon-cyan) !important;\n                }\n                \n                .pip-window-content.retro-theme .remaining-time {\n                    color: var(--neon-magenta) !important;\n                    text-shadow: 0 0 15px var(--neon-magenta) !important;\n                }\n                \n                .pip-window-content.retro-theme .completion-time {\n                    color: var(--neon-green) !important;\n                    text-shadow: 0 0 15px var(--neon-green) !important;\n                }\n                \n                .pip-window-content.retro-theme .progress-bar {\n                    background: rgba(0, 0, 0, 0.5) !important;\n                    border: 1px solid rgba(0, 240, 255, 0.3) !important;\n                    box-shadow: inset 0 0 10px rgba(0, 240, 255, 0.2) !important;\n                }\n                \n                .pip-window-content.retro-theme .progress-fill {\n                    background: linear-gradient(\n                        90deg,\n                        var(--neon-cyan),\n                        var(--neon-magenta),\n                        var(--neon-green),\n                        var(--neon-cyan)\n                    ) !important;\n                    box-shadow: \n                        0 0 10px var(--neon-cyan),\n                        0 0 20px rgba(0, 240, 255, 0.5) !important;\n                }\n                \n                .pip-window-content.retro-theme .pip-compact-button {\n                    background: rgba(0, 0, 0, 0.9) !important;\n                    color: var(--neon-cyan) !important;\n                    border: 1px solid var(--neon-cyan) !important;\n                    box-shadow: 0 0 5px var(--neon-cyan) !important;\n                    font-family: 'Orbitron', sans-serif !important;\n                }\n                \n                .pip-window-content.retro-theme .pip-compact-button:hover {\n                    background: rgba(0, 240, 255, 0.3) !important;\n                    color: white !important;\n                    box-shadow: 0 0 15px var(--neon-cyan) !important;\n                }\n                \n                .pip-window-content.retro-theme .summary-title {\n                    font-family: 'Orbitron', sans-serif !important;\n                    color: var(--neon-cyan) !important;\n                    text-shadow: \n                        0 0 10px var(--neon-cyan),\n                        0 0 20px var(--neon-cyan),\n                        0 0 30px rgba(0, 240, 255, 0.5) !important;\n                }\n                \n                .pip-window-content .gap-warning {\n                    background: linear-gradient(135deg, #ffeaa7, #fab1a0) !important;\n                    color: #2d3436 !important;\n                }\n            }
            
            .pip-window-content .summary-header {
                margin-bottom: 20px;
                gap: 12px;
            }
            
            .pip-window-content .emoji-display {
                font-size: 2.5rem;
            }
            
            .pip-window-content .summary-title {
                font-size: 1.5rem;
            }
            
            .pip-window-content .modern-table {
                margin: 16px 0;
                font-size: 0.8rem;
            }
            
            .pip-window-content .modern-table th,
            .pip-window-content .modern-table td {
                padding: 10px 12px;
                font-size: 0.75rem;
            }
            
            .pip-window-content .time-stats {
                grid-template-columns: 1fr;
                gap: 12px;
                margin: 20px 0;
            }
            
            .pip-window-content .stat-card {
                padding: 16px;
                border-radius: 12px;
            }
            
            .pip-window-content .stat-label {
                font-size: 0.75rem;
                margin-bottom: 6px;
            }
            
            .pip-window-content .stat-value {
                font-size: 1.2rem;
                margin-bottom: 2px;
            }
            
            .pip-window-content .remaining-desc {
                font-size: 0.7rem;
                opacity: 0.8;
            }
            
            .pip-window-content .progress-bar {
                height: 6px;
                margin: 16px 0;
            }
            
            .pip-window-content .completion-message {
                padding: 16px;
                font-size: 1rem;
                margin-top: 16px;
            }
            
            .pip-compact-button {
                position: absolute !important;
                top: 8px !important;
                right: 8px !important;
                background: rgba(255, 255, 255, 0.2) !important;
                border: none !important;
                border-radius: 6px !important;
                width: 32px !important;
                height: 24px !important;
                cursor: pointer !important;
                font-size: 12px !important;
                z-index: 1000 !important;
                transition: all 0.3s ease !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                color: white !important;
            }
            
            .pip-compact-button:hover {
                background: rgba(108, 92, 231, 0.8) !important;
                transform: scale(1.05) !important;
            }
            
            /* Compact Mode Styles */
            .pip-window-content.compact-mode {
                padding: 4px 0px 4px 0px !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                min-height: auto !important;
            }
            
            /* Compact mode - Glassmorphic Aurora theme */
            .compact-mode:not(.retro-theme) .pip-compact-display {
                text-align: center !important;
                background: rgba(255, 255, 255, 0.15) !important;
                border: 2px solid rgba(255, 255, 255, 0.25) !important;
                border-radius: 0px 0px 5px 5px !important;
                padding: 20px 24px !important;
                backdrop-filter: blur(20px) saturate(180%) !important;
                -webkit-backdrop-filter: blur(20px) saturate(180%) !important;
                box-shadow: 
                    0 0 20px rgba(102, 126, 234, 0.5),
                    0 0 40px rgba(118, 75, 162, 0.4),
                    0 0 60px rgba(240, 147, 251, 0.3),
                    0 8px 32px rgba(102, 126, 234, 0.2),
                    inset 0 0 30px rgba(102, 126, 234, 0.15),
                    inset 0 1px 1px rgba(255, 255, 255, 0.3) !important;
                transition: all 0.3s ease !important;
                cursor: pointer !important;
                position: relative !important;
                overflow: hidden !important;
                animation: auroraGlow 4s ease-in-out infinite !important;
            }
            
            .compact-mode:not(.retro-theme) .pip-compact-display::before {
                content: '' !important;
                position: absolute !important;
                top: -50% !important;
                left: -50% !important;
                width: 200% !important;
                height: 200% !important;
                background: linear-gradient(
                    135deg,
                    rgba(102, 126, 234, 0.1),
                    rgba(118, 75, 162, 0.1),
                    rgba(240, 147, 251, 0.1)
                ) !important;
                animation: gradientFlow 8s ease infinite !important;
                pointer-events: none !important;
                z-index: 0 !important;
                opacity: 1 !important;
                mix-blend-mode: screen !important;
            }
            
            .compact-mode:not(.retro-theme) .pip-compact-display:hover {
                transform: translateY(-2px) !important;
                box-shadow: 
                    0 12px 40px rgba(102, 126, 234, 0.3),
                    0 4px 12px rgba(118, 75, 162, 0.25),
                    inset 0 1px 1px rgba(255, 255, 255, 0.4) !important;
            }
            
            .compact-mode:not(.retro-theme) .pip-compact-time {
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif !important;
                font-size: 1.6rem !important;
                font-weight: 700 !important;
                color: #667eea !important;
                margin: 0 !important;
                letter-spacing: -0.02em !important;
                position: relative !important;
                z-index: 1 !important;
                text-shadow: 0 2px 8px rgba(102, 126, 234, 0.3) !important;
            }
            
            .compact-mode:not(.retro-theme) .pip-compact-label {
                font-family: 'Inter', sans-serif !important;
                font-size: 0.75rem !important;
                font-weight: 500 !important;
                color: rgba(102, 126, 234, 0.8) !important;
                text-transform: uppercase !important;
                letter-spacing: 0.1em !important;
                position: relative !important;
                z-index: 1 !important;
            }
            
            .compact-mode:not(.retro-theme) .pip-compact-emoji {
                font-size: 1.5rem !important;
                margin-left: 12px !important;
                display: inline-block !important;
                filter: drop-shadow(0 2px 4px rgba(102, 126, 234, 0.3)) !important;
                animation: emojiPulse 2s ease-in-out infinite !important;
                position: relative !important;
                z-index: 1 !important;
            }
            
            /* Compact mode - Retro-Futuristic theme */
            .compact-mode.retro-theme .pip-compact-display {
                text-align: center !important;
                background: linear-gradient(135deg, var(--retro-dark) 0%, var(--retro-dark-alt) 100%) !important;
                border: 2px solid rgba(0, 240, 255, 0.4) !important;
                border-radius: 0 !important;
                padding: 16px 20px !important;
                backdrop-filter: none !important;
                -webkit-backdrop-filter: none !important;
                box-shadow: 
                    0 0 20px rgba(0, 240, 255, 0.6),
                    0 0 40px rgba(255, 0, 255, 0.5),
                    0 0 60px rgba(0, 255, 65, 0.4),
                    inset 0 0 30px rgba(0, 240, 255, 0.2),
                    inset 0 0 20px rgba(255, 0, 255, 0.15) !important;
                transition: all 0.3s ease !important;
                cursor: pointer !important;
                position: relative !important;
                overflow: hidden !important;
                animation: neonGlowPulse 3s ease-in-out infinite !important;
            }
            
            .compact-mode.retro-theme .pip-compact-display::before {
                content: '' !important;
                position: absolute !important;
                top: 0 !important;
                left: 0 !important;
                right: 0 !important;
                bottom: 0 !important;
                background: linear-gradient(
                    90deg,
                    rgba(0, 240, 255, 0.3),
                    rgba(255, 0, 255, 0.3),
                    rgba(0, 255, 65, 0.3),
                    rgba(0, 240, 255, 0.3)
                ) !important;
                background-size: 300% 100% !important;
                animation: rgbFlowBacklight 6s ease-in-out infinite !important;
                pointer-events: none !important;
                z-index: 0 !important;
                opacity: 1 !important;
                mix-blend-mode: screen !important;
            }
            
            .compact-mode.retro-theme .pip-compact-display:hover {
                transform: scale(1.02) !important;
                box-shadow: 
                    inset 0 0 30px rgba(0, 240, 255, 0.2),
                    0 0 40px rgba(0, 240, 255, 0.5),
                    0 0 15px rgba(255, 0, 255, 0.3) !important;
            }
            
            .compact-mode.retro-theme .pip-compact-time {
                font-family: 'Share Tech Mono', 'Orbitron', monospace !important;
                font-size: 1.5rem !important;
                font-weight: 700 !important;
                color: var(--neon-cyan) !important;
                margin: 10px 0px 0px 0px !important;
                line-height: 0.2 !important;
                text-shadow: 
                    0 0 10px var(--neon-cyan),
                    0 0 20px var(--neon-cyan),
                    0 0 30px rgba(0, 240, 255, 0.5) !important;
                letter-spacing: 0.1em !important;
                position: relative !important;
                z-index: 2 !important;
                animation: glitchText 3s ease-in-out infinite !important;
            }
            
            .compact-mode.retro-theme .pip-compact-label {
                font-family: 'Orbitron', sans-serif !important;
                font-size: 0.65rem !important;
                font-weight: 600 !important;
                color: var(--neon-magenta) !important;
                margin: 8px 0 0 0 !important;
                text-transform: uppercase !important;
                letter-spacing: 0.2em !important;
                text-shadow: 
                    0 0 5px var(--neon-magenta),
                    0 0 10px rgba(255, 0, 255, 0.5) !important;
                position: relative !important;
                z-index: 2 !important;
            }
            
            .compact-mode.retro-theme .pip-compact-emoji {
                font-size: 1rem !important;
                margin-left: 12px !important;
                display: inline-block !important;
                filter: drop-shadow(0 0 8px var(--neon-cyan)) !important;
                animation: emojiPulse 2s ease-in-out infinite !important;
                position: relative !important;
                z-index: 2 !important;
            }
            
            /* Performance optimization for dynamic elements */
            .stat-value, .emoji-display, .progress-fill {
                will-change: transform;
            }
            
            .progress-bar {
                width: 100%;
                height: 12px;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 12px;
                overflow: hidden;
                margin: 24px 0;
                position: relative;
                box-shadow: 
                    inset 3px 3px 6px rgba(0, 0, 0, 0.1),
                    inset -3px -3px 6px rgba(255, 255, 255, 0.05);
                transform-style: preserve-3d;
                transition: transform 0.3s ease;
            }
            
            .progress-bar:hover {
                transform: perspective(500px) rotateX(calc(var(--mouse-y) * -0.5deg)) rotateY(calc(var(--mouse-x) * 0.5deg));
            }
            
            .progress-fill {
                height: 100%;
                background: linear-gradient(
                    90deg, 
                    var(--aurora-1), 
                    var(--aurora-2), 
                    var(--aurora-3), 
                    var(--aurora-4)
                );
                background-size: 200% 100%;
                border-radius: 12px;
                transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
                position: relative;
                overflow: hidden;
                animation: gradientFlow 3s ease infinite;
                box-shadow: 0 2px 8px rgba(102, 126, 234, 0.4);
            }
            
            .progress-fill::after {
                content: '';
                position: absolute;
                top: 0;
                left: -100%;
                width: 100%;
                height: 100%;
                background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.5), transparent);
                animation: progressShimmer 2s ease-in-out infinite;
            }
            
            /* Animations */
            @keyframes emojiPulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.1); }
            }
            
            @keyframes emojiFloat {
                0%, 100% { transform: translateY(0px); }
                50% { transform: translateY(-10px); }
            }
            
            @keyframes shimmer {
                0% { 
                    background-position: -200% center;
                }
                100% { 
                    background-position: 200% center;
                }
            }
            
            @keyframes cardShimmer {
                0% { left: -100%; }
                50% { left: 50%; }
                100% { left: 100%; }
            }
            
            @keyframes progressShimmer {
                0% { left: -100%; }
                50% { left: 50%; }
                100% { left: 100%; }
            }
            
            @keyframes gradientFlow {
                0% { background-position: 0% 50%; }
                50% { background-position: 100% 50%; }
                100% { background-position: 0% 50%; }
            }
            
            @keyframes titlePulse {
                0%, 100% { 
                    font-variation-settings: 'wght' 700;
                }
                50% { 
                    font-variation-settings: 'wght' 800;
                }
            }
            
            @keyframes warningPulse {
                0%, 100% { 
                    opacity: 1; 
                    transform: scale(1);
                }
                50% { 
                    opacity: 0.85;
                    transform: scale(0.98);
                }
            }
            
            @keyframes celebrationPulse {
                0%, 100% { 
                    transform: scale(1); 
                }
                25% { 
                    transform: scale(1.03) rotate(1deg); 
                }
                75% { 
                    transform: scale(1.03) rotate(-1deg); 
                }
            }
            
            @keyframes scanlines {
                0% { 
                    transform: translateY(0); 
                }
                100% { 
                    transform: translateY(4px); 
                }
            }
            
            @keyframes glitchText {
                0%, 90%, 100% {
                    transform: translate(0);
                    text-shadow: 
                        0 0 10px var(--neon-cyan),
                        0 0 20px var(--neon-cyan),
                        0 0 30px rgba(0, 240, 255, 0.5);
                }
                92% {
                    transform: translate(-2px, 1px);
                    text-shadow: 
                        2px 0 var(--neon-magenta),
                        -2px 0 var(--neon-cyan),
                        0 0 20px var(--neon-cyan);
                }
                94% {
                    transform: translate(2px, -1px);
                    text-shadow: 
                        -2px 0 var(--neon-magenta),
                        2px 0 var(--neon-cyan),
                        0 0 20px var(--neon-cyan);
                }
            }
            
            @keyframes neonPulse {
                0%, 100% {
                    box-shadow: 
                        0 0 5px var(--neon-cyan),
                        0 0 10px var(--neon-cyan),
                        inset 0 0 5px rgba(0, 240, 255, 0.2);
                }
                50% {
                    box-shadow: 
                        0 0 10px var(--neon-cyan),
                        0 0 20px var(--neon-cyan),
                        0 0 30px var(--neon-magenta),
                        inset 0 0 10px rgba(0, 240, 255, 0.3);
                }
            }
            
            @keyframes rgbFlowBacklight {
                0% {
                    background-position: 0% 50%;
                }
                50% {
                    background-position: 100% 50%;
                }
                100% {
                    background-position: 0% 50%;
                }
            }
            
            @keyframes auroraGlow {
                0%, 100% {
                    box-shadow: 
                        0 0 20px rgba(102, 126, 234, 0.5),
                        0 0 40px rgba(118, 75, 162, 0.4),
                        0 0 60px rgba(240, 147, 251, 0.3),
                        inset 0 0 30px rgba(102, 126, 234, 0.15);
                }
                33% {
                    box-shadow: 
                        0 0 25px rgba(118, 75, 162, 0.6),
                        0 0 50px rgba(240, 147, 251, 0.5),
                        0 0 75px rgba(79, 172, 254, 0.4),
                        inset 0 0 35px rgba(118, 75, 162, 0.2);
                }
                66% {
                    box-shadow: 
                        0 0 30px rgba(240, 147, 251, 0.6),
                        0 0 60px rgba(79, 172, 254, 0.5),
                        0 0 90px rgba(102, 126, 234, 0.4),
                        inset 0 0 40px rgba(240, 147, 251, 0.2);
                }
            }
            
            @keyframes neonGlowPulse {
                0%, 100% {
                    box-shadow: 
                        0 0 20px rgba(0, 240, 255, 0.6),
                        0 0 40px rgba(255, 0, 255, 0.5),
                        0 0 60px rgba(0, 255, 65, 0.4),
                        inset 0 0 30px rgba(0, 240, 255, 0.2);
                    border-color: rgba(0, 240, 255, 0.4);
                }
                33% {
                    box-shadow: 
                        0 0 25px rgba(255, 0, 255, 0.7),
                        0 0 50px rgba(0, 255, 65, 0.6),
                        0 0 75px rgba(0, 240, 255, 0.5),
                        inset 0 0 35px rgba(255, 0, 255, 0.25);
                    border-color: rgba(255, 0, 255, 0.5);
                }
                66% {
                    box-shadow: 
                        0 0 30px rgba(0, 255, 65, 0.7),
                        0 0 60px rgba(0, 240, 255, 0.6),
                        0 0 90px rgba(255, 0, 255, 0.5),
                        inset 0 0 40px rgba(0, 255, 65, 0.25);
                    border-color: rgba(0, 255, 65, 0.5);
                }
            }
            
            /* Settings Modal */
            .settings-modal {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%) scale(0.9);
                background: linear-gradient(135deg, rgba(255, 255, 255, 0.15), rgba(255, 255, 255, 0.1));
                backdrop-filter: blur(30px);
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 24px;
                padding: 32px;
                min-width: 400px;
                box-shadow: 
                    0 20px 60px rgba(0, 0, 0, 0.3),
                    inset 0 1px 0 rgba(255, 255, 255, 0.2);
                z-index: 1000;
                opacity: 0;
                visibility: hidden;
                transition: all 0.3s cubic-bezier(0.68, -0.55, 0.27, 1.55);
            }
            
            .settings-modal.active {
                opacity: 1;
                visibility: visible;
                transform: translate(-50%, -50%) scale(1);
            }
            
            .settings-modal-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.6);
                backdrop-filter: blur(5px);
                z-index: 999;
                opacity: 0;
                visibility: hidden;
                transition: all 0.3s ease;
            }
            
            .settings-modal-overlay.active {
                opacity: 1;
                visibility: visible;
            }
            
            .settings-title {
                font-size: 1.5rem;
                font-weight: 700;
                margin-bottom: 24px;
                background: linear-gradient(135deg, var(--aurora-1), var(--aurora-2));
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
            }
            
            .settings-option {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 16px;
                margin-bottom: 12px;
                background: rgba(255, 255, 255, 0.05);
                border-radius: 12px;
                border: 1px solid rgba(255, 255, 255, 0.1);
                transition: all 0.3s ease;
            }
            
            .settings-option:hover {
                background: rgba(255, 255, 255, 0.1);
                transform: translateX(4px);
            }
            
            .settings-option-label {
                font-weight: 500;
                color: rgba(255, 255, 255, 0.9);
            }
            
            .toggle-switch {
                width: 50px;
                height: 26px;
                background: rgba(255, 255, 255, 0.2);
                border-radius: 13px;
                position: relative;
                cursor: pointer;
                transition: background 0.3s ease;
            }
            
            .toggle-switch.active {
                background: var(--aurora-1);
            }
            
            .toggle-switch::after {
                content: '';
                position: absolute;
                top: 3px;
                left: 3px;
                width: 20px;
                height: 20px;
                background: white;
                border-radius: 50%;
                transition: transform 0.3s cubic-bezier(0.68, -0.55, 0.27, 1.55);
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
            }
            
            .toggle-switch.active::after {
                transform: translateX(24px);
            }

            .settings-select {
                padding: 10px 16px;
                background: rgba(255, 255, 255, 0.1);
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 8px;
                color: white;
                font-size: 0.875rem;
                font-weight: 500;
                cursor: pointer;
                outline: none;
                transition: all 0.3s ease;
                min-width: 140px;
            }
            
            .settings-select:hover {
                background: rgba(255, 255, 255, 0.15);
                border-color: rgba(255, 255, 255, 0.3);
            }
            
            .settings-select:focus {
                border-color: var(--aurora-1);
                box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2);
            }
            
            .settings-select option {
                background: #2d3436;
                color: white;
                padding: 8px;
            }
            
            .close-modal-button {
                margin-top: 24px;
                width: 100%;
                padding: 12px;
                background: linear-gradient(135deg, var(--aurora-1), var(--aurora-2));
                border: none;
                border-radius: 12px;
                color: white;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
            }
            
            .close-modal-button:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
            }
            
            /* Responsive Design */
            @media (max-width: 768px) {
                .attendance-summary {
                    margin: 16px;
                    padding: 24px 20px;
                }
                
                .summary-title {
                    font-size: 1.5rem;
                }
                
                .emoji-display {
                    font-size: 3rem;
                }
                
                .modern-table th,
                .modern-table td {
                    padding: 12px 16px;
                    font-size: 0.875rem;
                }
                
                .time-stats {
                    grid-template-columns: 1fr;
                    grid-template-rows: auto;
                    gap: 16px;
                }
                
                .stat-card.worked-time-card {
                    grid-column: 1;
                    grid-row: auto;
                }
                
                .pip-button {
                    top: 12px;
                    left: 12px;
                    padding: 8px 12px;
                    font-size: 0.8rem;
                }
                
                .pip-icon {
                    margin-right: 4px;
                    font-size: 0.9rem;
                }
            }
            
            /* Extra small screens (mobile) */
            @media (max-width: 480px) {
                .pip-window-content {
                    padding: 12px !important;
                }
                
                .pip-window-content .summary-header {
                    margin-bottom: 16px;
                    gap: 8px;
                }
                
                .pip-window-content .emoji-display {
                    font-size: 2rem;   
                }
                
                .pip-window-content .summary-title {
                    font-size: 1rem;
                }
                
                .pip-window-content .modern-table {
                    font-size: 0.7rem;
                    margin: 12px 0;
                }
                
                .pip-window-content .modern-table th,
                .pip-window-content .modern-table td {
                    padding: 8px 6px;
                    font-size: 0.65rem;
                }
                
                .pip-window-content .time-stats {
                    gap: 8px;
                    margin: 16px 0;
                }
                
                .pip-window-content .stat-card {
                    padding: 12px;
                }
                
                .pip-window-content .stat-label {
                    font-size: 0.7rem;
                    margin-bottom: 4px;
                }
                
                .pip-window-content .stat-value {
                    font-size: 1rem;
                }
                
                .pip-window-content .remaining-desc {
                    font-size: 0.65rem;
                }
                
                .pip-window-content .progress-bar {
                    height: 5px;
                    margin: 12px 0;
                }
            }
            
            /* Dark mode enhancements */
            @media (prefers-color-scheme: dark) {
                .attendance-summary {
                    background: linear-gradient(135deg, rgba(30, 30, 30, 0.9), rgba(20, 20, 20, 0.8));
                    border-color: rgba(255, 255, 255, 0.15);
                    color: rgba(255, 255, 255, 0.9);
                }
                
                .modern-table {
                    background: rgba(0, 0, 0, 0.2);
                }
                
                .stat-card {
                    background: rgba(0, 0, 0, 0.3);
                    border-color: rgba(255, 255, 255, 0.1);
                }
                
                .modern-table td {
                    color: rgba(255, 255, 255, 0.7);
                }
                
                .stat-label {
                    color: rgba(255, 255, 255, 0.7);
                }
                
                .stat-card:hover {
                    background: rgba(255, 255, 255, 0.12);
                    border-color: rgba(255, 255, 255, 0.25);
                }
                
                .attendance-summary:hover {
                    box-shadow: 
                        0 16px 48px rgba(0, 0, 0, 0.2),
                        0 4px 12px rgba(0, 0, 0, 0.15),
                        inset 0 1px 0 rgba(255, 255, 255, 0.2);
                }
                
                .pip-placeholder {
                    color: rgba(255, 255, 255, 0.7);
                }
                
                .pip-button {
                    background: linear-gradient(135deg, #667eea, #764ba2);
                    border-color: rgba(255, 255, 255, 0.2);
                    color: white;
                }
                
                .pip-button:hover {
                    box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
                }
                
                .pip-button.active {
                    background: linear-gradient(135deg, #e17055, #fab1a0);
                    box-shadow: 0 6px 20px rgba(225, 112, 85, 0.4);
                    color: white;
                }
            }
            
                /* Light mode enhancements */
            @media (prefers-color-scheme: light) {
                .attendance-summary {
                    background: linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(240, 240, 240, 0.9));
                    border-color: rgba(0, 0, 0, 0.1);
                    color: rgba(0, 0, 0, 0.9);
                    box-shadow: 
                        0 8px 32px rgba(0, 0, 0, 0.15),
                        0 1px 2px rgba(0, 0, 0, 0.1),
                        inset 0 1px 0 rgba(255, 255, 255, 0.8);
                }
                
                .attendance-summary::before {
                    background: linear-gradient(90deg, transparent, rgba(0, 0, 0, 0.1), transparent);
                }
                
                .modern-table {
                    background: rgba(255, 255, 255, 0.8);
                    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
                }
                
                .modern-table td {
                    color: rgba(0, 0, 0, 0.8);
                    border-bottom: 1px solid rgba(0, 0, 0, 0.1);
                }
                
                .stat-card {
                    background: rgba(255, 255, 255, 0.7);
                    border-color: rgba(0, 0, 0, 0.1);
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                }
                
                .stat-card.worked-time-card {
                    background: linear-gradient(135deg, rgba(0, 184, 148, 0.15), rgba(0, 184, 148, 0.05));
                    border-color: rgba(0, 184, 148, 0.3);
                }
                
                .stat-card.remaining-time-card {
                    background: linear-gradient(135deg, rgba(225, 112, 85, 0.15), rgba(225, 112, 85, 0.05));
                    border-color: rgba(225, 112, 85, 0.3);
                }
                
                .stat-card.completion-time-card {
                    background: linear-gradient(135deg, rgba(108, 92, 231, 0.15), rgba(108, 92, 231, 0.05));
                    border-color: rgba(108, 92, 231, 0.3);
                }
                
                .stat-label {
                    color: rgba(0, 0, 0, 0.6);
                }
                
                .developer-info {
                    background: rgba(255, 255, 255, 0.8);
                    border-color: rgba(0, 0, 0, 0.1);
                    color: #667eea;
                }
                
                .developer-info:hover {
                    background: rgba(255, 255, 255, 0.9);
                    border-color: rgba(0, 0, 0, 0.2);
                }
                
                .progress-bar {
                    background: rgba(0, 0, 0, 0.1);
                }
                
                .gap-warning {
                    background: linear-gradient(135deg, #ffeaa7, #fab1a0) !important;
                    color: #2d3436 !important;
                }
                
                .stat-card:hover {
                    background: rgba(255, 255, 255, 0.9);
                    border-color: rgba(0, 0, 0, 0.2);
                    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
                }
                
                .attendance-summary:hover {
                    box-shadow: 
                        0 16px 48px rgba(0, 0, 0, 0.2),
                        0 4px 12px rgba(0, 0, 0, 0.15),
                        inset 0 1px 0 rgba(255, 255, 255, 0.9);
                }
                
                .pip-placeholder {
                    color: rgba(0, 0, 0, 0.7);
                }
                
                .pip-button {
                    background: linear-gradient(135deg, #667eea, #764ba2);
                    border-color: rgba(255, 255, 255, 0.2);
                    color: white;
                }
                
                .pip-button:hover {
                    box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
                }
                
                .pip-button.active {
                    background: linear-gradient(135deg, #e17055, #fab1a0);
                    box-shadow: 0 6px 20px rgba(225, 112, 85, 0.4);
                    color: white;
                }
            }
            
            /* Retro-Futuristic Theme for Main Display */
            .attendance-summary.retro-theme {
                background: linear-gradient(135deg, var(--retro-dark) 0%, var(--retro-dark-alt) 100%) !important;
                color: var(--neon-cyan) !important;
                border: 1px solid var(--neon-cyan) !important;
                border-radius: 0px 0px 8px 8px !important;            
                box-shadow: 
                    0 0 20px rgba(0, 240, 255, 0.3),
                    inset 0 0 30px rgba(0, 240, 255, 0.05) !important;
                position: relative;
                overflow: hidden;
            }
            
            .attendance-summary.retro-theme::before {
                background: linear-gradient(
                    90deg,
                    transparent,
                    var(--neon-cyan),
                    var(--neon-magenta),
                    var(--neon-green),
                    transparent
                ) !important;
                background-size: 200% 100% !important;
                animation: rgbFlowBacklight 4s ease-in-out infinite !important;
                z-index: 2;
            }
            
            .attendance-summary.retro-theme::after {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: repeating-linear-gradient(
                    0deg,
                    rgba(0, 240, 255, 0.03) 0px,
                    transparent 1px,
                    transparent 2px,
                    rgba(0, 240, 255, 0.03) 3px
                );
                animation: scanlines 8s linear infinite;
                pointer-events: none;
                z-index: 0;
            }
            
            .attendance-summary.retro-theme .summary-header,
            .attendance-summary.retro-theme .modern-table,
            .attendance-summary.retro-theme .time-stats,
            .attendance-summary.retro-theme .progress-bar,
            .attendance-summary.retro-theme .completion-message {
                position: relative;
                z-index: 1;
            }
            
            .attendance-summary.retro-theme .summary-title {
                font-family: 'Orbitron', sans-serif !important;
                color: var(--neon-cyan) !important;
                background: none !important;
                -webkit-background-clip: unset !important;
                -webkit-text-fill-color: var(--neon-cyan) !important;
                text-shadow: 
                    0 0 10px var(--neon-cyan),
                    0 0 20px var(--neon-cyan),
                    0 0 30px rgba(0, 240, 255, 0.5) !important;
            }
            
            .attendance-summary.retro-theme .emoji-display {
                filter: drop-shadow(0 0 10px var(--neon-cyan)) !important;
            }
            
            .attendance-summary.retro-theme .modern-table {
                background: rgba(0, 0, 0, 0.5) !important;
                border: 1px solid rgba(0, 240, 255, 0.3) !important;
                box-shadow: 
                    0 0 10px rgba(0, 240, 255, 0.3),
                    inset 0 0 20px rgba(0, 240, 255, 0.05) !important;
            }
            
            .attendance-summary.retro-theme .modern-table thead {
                background: linear-gradient(135deg, rgba(0, 240, 255, 0.3), rgba(255, 0, 255, 0.3)) !important;
            }
            
            .attendance-summary.retro-theme .modern-table th {
                font-family: 'Orbitron', sans-serif !important;
                color: var(--neon-cyan) !important;
                text-shadow: 0 0 5px var(--neon-cyan) !important;
            }
            
            .attendance-summary.retro-theme .modern-table td {
                color: rgba(0, 240, 255, 0.9) !important;
                font-family: 'Share Tech Mono', monospace !important;
                border-bottom: 1px solid rgba(0, 240, 255, 0.15) !important;
            }
            
            .attendance-summary.retro-theme .stat-card {
                background: rgba(0, 0, 0, 0.6) !important;
                border: 1px solid var(--neon-cyan) !important;
                box-shadow: 
                    0 0 10px var(--neon-cyan),
                    inset 0 0 10px rgba(0, 240, 255, 0.1) !important;
                animation: neonPulse 4s ease-in-out infinite !important;
            }
            
            .attendance-summary.retro-theme .stat-card.worked-time-card {
                border-color: var(--neon-cyan) !important;
                box-shadow: 
                    0 0 15px var(--neon-cyan),
                    inset 0 0 15px rgba(0, 240, 255, 0.15) !important;
            }
            
            .attendance-summary.retro-theme .stat-card.remaining-time-card {
                border-color: var(--neon-magenta) !important;
                box-shadow: 
                    0 0 15px var(--neon-magenta),
                    inset 0 0 15px rgba(255, 0, 255, 0.15) !important;
            }
            
            .attendance-summary.retro-theme .stat-card.completion-time-card {
                border-color: var(--neon-green) !important;
                box-shadow: 
                    0 0 15px var(--neon-green),
                    inset 0 0 15px rgba(0, 255, 65, 0.15) !important;
            }
            
            .attendance-summary.retro-theme .stat-label {
                color: rgba(0, 240, 255, 0.7) !important;
                font-family: 'Orbitron', sans-serif !important;
                text-shadow: 0 0 5px var(--neon-cyan) !important;
            }
            
            .attendance-summary.retro-theme .stat-value {
                font-family: 'Share Tech Mono', monospace !important;
                text-shadow: 0 0 10px currentColor !important;
            }
            
            .attendance-summary.retro-theme .worked-time {
                color: var(--neon-cyan) !important;
                text-shadow: 0 0 15px var(--neon-cyan) !important;
            }
            
            .attendance-summary.retro-theme .remaining-time {
                color: var(--neon-magenta) !important;
                text-shadow: 0 0 15px var(--neon-magenta) !important;
            }
            
            .attendance-summary.retro-theme .completion-time {
                color: var(--neon-green) !important;
                text-shadow: 0 0 15px var(--neon-green) !important;
            }
            
            .attendance-summary.retro-theme .progress-bar {
                background: rgba(0, 0, 0, 0.5) !important;
                border: 1px solid rgba(0, 240, 255, 0.3) !important;
                box-shadow: inset 0 0 10px rgba(0, 240, 255, 0.2) !important;
            }
            
            .attendance-summary.retro-theme .progress-fill {
                background: linear-gradient(
                    90deg,
                    var(--neon-cyan),
                    var(--neon-magenta),
                    var(--neon-green),
                    var(--neon-cyan)
                ) !important;
                box-shadow: 
                    0 0 10px var(--neon-cyan),
                    0 0 20px rgba(0, 240, 255, 0.5) !important;
            }
            
            .attendance-summary.retro-theme .developer-info,
            .attendance-summary.retro-theme .settings-button {
                background: rgba(0, 0, 0, 0.8) !important;
                border-color: var(--neon-cyan) !important;
                color: var(--neon-cyan) !important;
                box-shadow: 0 0 5px var(--neon-cyan) !important;
            }
            
            .attendance-summary.retro-theme .developer-info:hover,
            .attendance-summary.retro-theme .settings-button:hover {
                background: rgba(0, 240, 255, 0.2) !important;
                box-shadow: 0 0 15px var(--neon-cyan) !important;
            }
            
            .attendance-summary.retro-theme .pip-button {
                background: linear-gradient(135deg, rgba(0, 240, 255, 0.3), rgba(255, 0, 255, 0.3)) !important;
                border-color: var(--neon-cyan) !important;
                color: white !important;
                box-shadow: 0 0 10px var(--neon-cyan) !important;
            }
            
            .attendance-summary.retro-theme .pip-button:hover {
                background: linear-gradient(135deg, rgba(0, 240, 255, 0.5), rgba(255, 0, 255, 0.5)) !important;
                box-shadow: 0 0 20px var(--neon-cyan) !important;
            }
            
            .attendance-summary.retro-theme .completion-message {
                background: linear-gradient(135deg, rgba(0, 255, 65, 0.3), rgba(0, 240, 255, 0.3)) !important;
                border: 1px solid var(--neon-green) !important;
                color: var(--neon-green) !important;
                text-shadow: 0 0 10px var(--neon-green) !important;
                box-shadow: 0 0 20px rgba(0, 255, 65, 0.4) !important;
            }
            
            /* Borderless PiP Window - Hide Browser Chrome */
            @media (display-mode: picture-in-picture) {
                /* Target the PiP window itself */
                :root {
                    /* Maximize content area */
                    overflow: hidden !important;
                }
                
                body {
                    /* Remove all default margins and padding */
                    margin: 0 !important;
                    padding: 0 !important;
                    border: none !important;
                    border-radius: 0 !important;
                    overflow: hidden !important;
                    /* Extend content to cover potential title bar area */
                    min-height: 100vh !important;
                    height: 100vh !important;
                }
                
                html {
                    margin: 0 !important;
                    padding: 0 !important;
                    border: none !important;
                    overflow: hidden !important;
                }
                
                /* Ensure content fills entire window including title bar area */
                .pip-window-content,
                .attendance-summary {
                    margin: 0 !important;
                    border-radius: 0 !important;
                    min-height: 100vh !important;
                    height: 100vh !important;
                    max-width: 100vw !important;
                    width: 100vw !important;
                    overflow-y: auto !important;
                    overflow-x: hidden !important;
                    box-sizing: border-box !important;
                }
                
                /* Compact mode should also be borderless */
                .pip-compact-display {
                    border: none !important;
                    border-radius: 0 !important;
                    width: 100vw !important;
                    height: 100vh !important;
                    display: flex !important;
                    flex-direction: column !important;
                    align-items: center !important;
                    justify-content: center !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    box-sizing: border-box !important;
                    box-shadow: none !important;
                }
            }
        </style>
    `;

    // Inject modern styles
    function injectModernStyles() {
        if (!document.getElementById('attendance-modern-styles')) {
            document.head.insertAdjacentHTML('beforeend', modernStyles);
        }
    }

    // Calculate emoji based on work progress
    function getEmojiForProgress(workedSeconds, totalSeconds = 28800) {
        const progress = Math.min(workedSeconds / totalSeconds, 1);

        // If exceeded 8 hours 30 minutes (30600 seconds), show clown emoji
        if (workedSeconds > (totalSeconds + 1800)) { // 28800 + 1800 = 30600
            return clownEmoji;
        }

        // If between 8 hours and 8:30 hours (28800 to 30600 seconds), show running emoji
        if (workedSeconds >= totalSeconds && workedSeconds <= (totalSeconds + 1800)) {
            return runningEmoji;
        }

        // Calculate which emoji to show based on progress for under 8 hours
        const currentSet = emojiSets[userPreferences.emojiSet] || emojiSets.fun;
        const emojiIndex = Math.floor(progress * currentSet.length);
        return currentSet[Math.min(emojiIndex, currentSet.length - 1)];
    }

    // Add developer info to the card
    function addDeveloperInfo(container) {
        // Remove existing developer info if any
        const existingInfo = container.querySelector('.developer-info');
        if (existingInfo) {
            existingInfo.remove();
        }
        
        const developerDiv = document.createElement('div');
        developerDiv.className = 'developer-info';
        developerDiv.innerHTML = `
            ℹ️
            <div class="developer-tooltip">
                <strong>Core Developer:</strong> Websoft Team<br>
                <strong>Enhanced by:</strong> Hassan Nasir<br>
                <small>Build: v3.0.2025 (Ultra Edition)</small><br>
                <small>Last Modified: 24 Dec 2025</small><br>
                <small>New: Voice, Settings & Bento Grid! 🎨</small><br>
                <small>Azadi Mubarak ☪️</small>
            </div>
        `;
        
        container.appendChild(developerDiv);
    }
    
    // Add settings button
    function addSettingsButton(container) {
        const existingButton = container.querySelector('.settings-button');
        if (existingButton) {
            existingButton.remove();
        }
        
        const settingsButton = document.createElement('div');
        settingsButton.className = 'settings-button';
        settingsButton.innerHTML = '⚙️';
        settingsButton.title = 'Settings';
        settingsButton.addEventListener('click', toggleSettingsModal);
        
        container.appendChild(settingsButton);
    }
    
    // Toggle settings modal
    function toggleSettingsModal() {
        let modal = document.getElementById('attendance-settings-modal');
        let overlay = document.getElementById('settings-modal-overlay');
        
        if (!modal) {
            createSettingsModal();
            modal = document.getElementById('attendance-settings-modal');
            overlay = document.getElementById('settings-modal-overlay');
        }
        
        modal.classList.toggle('active');
        overlay.classList.toggle('active');
    }
    
    // Create settings modal
    function createSettingsModal() {
        // Create overlay
        const overlay = document.createElement('div');
        overlay.id = 'settings-modal-overlay';
        overlay.className = 'settings-modal-overlay';
        overlay.addEventListener('click', toggleSettingsModal);
        document.body.appendChild(overlay);
        
        // Create modal
        const modal = document.createElement('div');
        modal.id = 'attendance-settings-modal';
        modal.className = 'settings-modal';
        
        modal.innerHTML = `
            <div class="settings-title">⚙️ Customize Your Experience</div>
            
            <div class="settings-option">
                <span class="settings-option-label">🎨 Neumorphic Depth</span>
                <div class="toggle-switch ${userPreferences.neumorphicDepth ? 'active' : ''}" data-pref="neumorphicDepth"></div>
            </div>
            
            <div class="settings-option">
                <span class="settings-option-label">🌊 Fluid Gradients</span>
                <div class="toggle-switch ${userPreferences.fluidGradients ? 'active' : ''}" data-pref="fluidGradients"></div>
            </div>

            <div class="settings-option">
                <span class="settings-option-label">😎 Emoji Style</span>
                <select class="settings-select" data-pref="emojiSet">
                    <option value="fun" ${userPreferences.emojiSet === 'fun' ? 'selected' : ''}>Fun (GenZ)</option>
                    <option value="professional" ${userPreferences.emojiSet === 'professional' ? 'selected' : ''}>Professional (Dots)</option>
                </select>
            </div>

            <div class="settings-option">
                <span class="settings-option-label">🎨 Display Theme</span>
                <select class="settings-select" data-pref="displayTheme">
                    <option value="glassmorphic" ${userPreferences.displayTheme === 'glassmorphic' ? 'selected' : ''}>Glassmorphic Aurora</option>
                    <option value="retro-futuristic" ${userPreferences.displayTheme === 'retro-futuristic' ? 'selected' : ''}>Sci-Fi Retro Futuristic</option>
                </select>
            </div>
            
            <button class="close-modal-button">✨ Save & Close</button>
        `;
        
        document.body.appendChild(modal);
        
        // Add toggle listeners
        modal.querySelectorAll('.toggle-switch').forEach(toggle => {
            toggle.addEventListener('click', function() {
                const pref = this.getAttribute('data-pref');
                this.classList.toggle('active');
                userPreferences[pref] = this.classList.contains('active');
                savePreferences();
                applyPreferences();
            });
        });

        // Add select listeners
        modal.querySelectorAll('.settings-select').forEach(select => {
            select.addEventListener('change', function() {
                const pref = this.getAttribute('data-pref');
                userPreferences[pref] = this.value;
                savePreferences();
                applyPreferences();
            });
        });
        
        // Add close button listener
        modal.querySelector('.close-modal-button').addEventListener('click', toggleSettingsModal);
    }
    
    // Apply user preferences
    function applyPreferences() {
        const container = document.getElementById('total-time-summary');
        if (!container) return;
        
        // Apply display theme
        if (userPreferences.displayTheme === 'retro-futuristic') {
            container.classList.add('retro-theme');
        } else {
            container.classList.remove('retro-theme');
        }
        
        // Apply neumorphic depth (only for glassmorphic theme)
        if (userPreferences.displayTheme === 'glassmorphic') {
            if (userPreferences.neumorphicDepth) {
                container.style.boxShadow = `
                    0 8px 32px rgba(0, 0, 0, 0.1),
                    0 1px 2px rgba(0, 0, 0, 0.05),
                    inset 0 1px 0 rgba(255, 255, 255, 0.1),
                    5px 5px 15px rgba(0, 0, 0, 0.08),
                    -5px -5px 15px rgba(255, 255, 255, 0.05)
                `;
            } else {
                container.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.1)';
            }
        }

        // Apply fluid gradients (only for glassmorphic theme)
        if (userPreferences.displayTheme === 'glassmorphic') {
            if (userPreferences.fluidGradients) {
                container.classList.remove('no-fluid');
            } else {
                container.classList.add('no-fluid');
            }
        }

        // Force update emoji
        const emojiDisplay = container.querySelector('.emoji-display');
        if (emojiDisplay) {
            // We need to recalculate based on current time, but for now just trigger a refresh
            // The next update loop will catch the correct emoji, but let's try to update immediately if possible
            const totalWorkedElement = document.getElementById('total-worked-time');
            if (totalWorkedElement) {
                const timeStr = totalWorkedElement.textContent;
                const seconds = timeToSeconds(timeStr);
                emojiDisplay.textContent = getEmojiForProgress(seconds);
            }
        }
    }
    
    // Add parallax effect on mouse move
    function addParallaxEffect(container) {
        container.addEventListener('mousemove', (e) => {
            const rect = container.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width;
            const y = (e.clientY - rect.top) / rect.height;
            
            mouseX = (x - 0.5) * 20; // Range: -10 to 10
            mouseY = (y - 0.5) * 20;
            
            container.style.setProperty('--mouse-x', mouseX);
            container.style.setProperty('--mouse-y', mouseY);
        });
        
        container.addEventListener('mouseleave', () => {
            container.style.setProperty('--mouse-x', 0);
            container.style.setProperty('--mouse-y', 0);
        });
    }

    function insertAndCalculate() {
        injectModernStyles();
        
        const tableDiv = document.querySelector('.main-attendance-table');
        if (!tableDiv) {
            return;
        }
        
        let totalTimeDiv = document.getElementById('total-time-summary');
        let isNewElement = false;
        if (!totalTimeDiv) {
            totalTimeDiv = document.createElement('div');
            totalTimeDiv.id = 'total-time-summary';
            totalTimeDiv.className = 'attendance-summary';
            // Apply retro theme class if user preference is set
            if (userPreferences.displayTheme === 'retro-futuristic') {
                totalTimeDiv.classList.add('retro-theme');
            }
            isFirstRender = true;
            isNewElement = true;
        }

        calculateTotalTime(totalTimeDiv);
        
        // Apply preferences after element is in DOM
        if (isNewElement) {
            // Use setTimeout to ensure DOM is fully updated
            setTimeout(() => applyPreferences(), 0);
        }
    }

    function calculateTotalTime(totalTimeDiv) {
        let date = new Date();
        let today = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Karachi' }));
        let todayFormatted = formatDate(today);

        if (today.getHours() < 5) {
            const prevDay = new Date(today);
            prevDay.setDate(today.getDate() - 1); 
            todayFormatted = formatDate(prevDay);
        }

        let totalWorkedTime = 0;
        let checkInTime = null;
        let lastCheckOutTime = null;
        let checkInOutList = [];
        let totalBreakTime = 0;

        const rows = document.querySelectorAll('.main-attendance-table tbody tr');

        if (rows.length > 0) {
            rows.forEach((row, index) => {
                const cells = row.querySelectorAll('td');
                if (cells.length < 5) {
                    return;
                }

                const rowData = Array.from(cells).map(cell => cell.innerText.trim());

                const date = rowData[1]; 
                const time = rowData[3]; 
                const checkInOut = rowData[4]; 
                const checkInHour = parseInt(time.split(":")[0], 10);
                
                if (date === todayFormatted) {
                    if (checkInOut === 'In' && checkInHour > 5) {
                        if (lastCheckOutTime) {
                            const gap = calculateTimeDifference(lastCheckOutTime, time);
                            if (gap <= 21600) {
                                checkInTime = time;
                            } else {
                                checkInTime = time;
                                totalWorkedTime = 0;
                            }
                        } else {
                            checkInTime = time;
                        }
                    } else if (checkInOut === 'Out' && checkInTime) {
                        const workedTime = calculateTimeDifference(checkInTime, time);
                        totalWorkedTime += workedTime;
                        checkInOutList.push({
                            checkIn: checkInTime,
                            checkOut: time,
                            workedTime: secondsToHHMMSS(workedTime),
                        });
                        lastCheckOutTime = time;
                        checkInTime = null; 
                    }
                } else if (date === formatDate(today) && today.getHours() < 5 && checkInHour < 5) {
                    if (checkInOut === 'In') {
                        if (lastCheckOutTime) {
                            const gap = calculateTimeDifference(lastCheckOutTime, time);
                            if (gap <= 21600) { 
                                checkInTime = time;
                            } else {
                                checkInTime = time;
                                totalWorkedTime = 0;
                            }
                        } else {
                            checkInTime = time;
                        }
                    } else if (checkInOut === 'Out' && checkInTime) {
                        const workedTime = calculateTimeDifference(checkInTime, time);
                        totalWorkedTime += workedTime;
                        checkInOutList.push({
                            checkIn: checkInTime,
                            checkOut: time,
                            workedTime: secondsToHHMMSS(workedTime),
                        });
                        lastCheckOutTime = time;
                        checkInTime = null; 
                    }
                }
            });

            if (checkInTime) {
                const currentTimeFormatted = formatTime(today);
                const workedTime = calculateTimeDifference(checkInTime, currentTimeFormatted);
                totalWorkedTime += workedTime;
                checkInOutList.push({
                    checkIn: checkInTime,
                    checkOut: 'Current',
                    workedTime: secondsToHHMMSS(workedTime),
                });
                checkInTime = null;
            }

            // Only re-render if significant change occurred or first render
            const shouldRerender = totalTimeDiv.innerHTML === '' || 
                                 Math.abs(totalWorkedTime - lastTotalWorkedTime) > 30 || // 30 second threshold
                                 checkInOutList.length !== (totalTimeDiv.querySelectorAll('.modern-table tbody tr:not(.gap-warning)').length);
            
            if (shouldRerender) {
                renderFullContent(totalTimeDiv, totalWorkedTime, checkInOutList, today);
                lastTotalWorkedTime = totalWorkedTime;
            } else {
                // Just update dynamic content without re-rendering
                updateDynamicContent(totalWorkedTime, today);
            }
        }
        
        $('.main-attendance-table').before(totalTimeDiv);
    }

    function formatDate(date) {
        return `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}/${date.getFullYear()}`;
    }
    
    function formatTime12Hour(date) {
        let hours = date.getHours();
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const seconds = date.getSeconds().toString().padStart(2, '0');
        const period = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12;
        return `${hours}:${minutes}:${seconds} ${period}`;
    }

    function formatTime(date) {
        return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
    }

    function calculateTimeDifference(startTime, endTime) {
        const start = new Date(`1970-01-01T${startTime}Z`);
        const end = new Date(`1970-01-01T${endTime}Z`);
        let diffInSeconds = (end - start) / 1000;

        if (diffInSeconds < 0) {
            diffInSeconds += 24 * 3600;
        }

        return diffInSeconds;
    }

    function secondsToHHMMSS(seconds) {
        const hours = Math.floor(seconds / 3600);
        seconds %= 3600;
        const minutes = Math.floor(seconds / 60);
        seconds %= 60;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    
    // Additional utility function from original script
    function timeToSeconds(timeString) {
        const parts = timeString.split(':');
        return (+parts[0]) * 3600 + (+parts[1]) * 60 + (+parts[2]);
    }

    function interpolateColor(color1, color2, factor) {
        if (arguments.length < 3) { 
            return color1; 
        }
        let result = color1.slice();
        for (let i = 0; i < 3; i++) {
            result[i] = Math.round(result[i] + factor * (color2[i] - color1[i]));
        }
        return `rgba(${result[0]}, ${result[1]}, ${result[2]}, 0.2)`;
    }
    
    // ====================================
    // PICTURE-IN-PICTURE FUNCTIONALITY
    // ====================================
    
    // Check if Picture-in-Picture is supported
    function isPipSupported() {
        return 'documentPictureInPicture' in window;
    }
    
    // Create PiP button
    function createPipButton(container) {
        if (!isPipSupported()) {
            return null;
        }
        
        // Remove existing PiP button if any
        const existingButton = container.querySelector('.pip-button');
        if (existingButton) {
            existingButton.remove();
        }
        
        const pipButton = document.createElement('button');
        pipButton.className = 'pip-button';
        pipButton.innerHTML = `
            <span class="pip-icon">📱</span>
            <span class="pip-text">Float</span>
        `;
        
        pipButton.addEventListener('click', togglePictureInPicture);
        container.appendChild(pipButton);
        
        // Show the button since PiP is supported
        pipButton.style.display = 'flex';
        pipButton.style.alignItems = 'center';
        
        return pipButton;
    }
    
    // Toggle Picture-in-Picture mode
    async function togglePictureInPicture() {
        try {
            if (isPipActive && pipWindow && !pipWindow.closed) {
                // Close existing PiP window
                pipWindow.close();
                return;
            }
            
            // Calculate optimal window size based on screen size
            const screenWidth = window.screen.width;
            const screenHeight = window.screen.height;
            
            // Responsive window sizing
            let windowWidth, windowHeight;
            if (screenWidth <= 480) {
                // Extra small screens
                windowWidth = Math.min(screenWidth * 0.9, 280);
                windowHeight = Math.min(screenHeight * 0.7, 400);
            } else if (screenWidth <= 768) {
                // Mobile screens
                windowWidth = Math.min(screenWidth * 0.8, 320);
                windowHeight = Math.min(screenHeight * 0.75, 450);
            } else {
                // Desktop screens
                windowWidth = 320;
                windowHeight = 480;
            }
            
            // Create compact PiP window with dynamic sizing
            pipWindow = await documentPictureInPicture.requestWindow({
                width: windowWidth,
                height: windowHeight,
                disallowReturnToOpener: false
            });
            
            isPipActive = true;
            
            // Copy styles to PiP window
            copyStylesToPip(pipWindow);
            
            // Move content to PiP window
            const attendanceSummary = document.getElementById('total-time-summary');
            if (attendanceSummary) {
                // Clone the element to avoid moving it completely
                const summaryClone = attendanceSummary.cloneNode(true);
                
                // Add PiP-specific styling for compact design
                summaryClone.className = 'attendance-summary pip-window-content';
                
                // Apply user's selected theme to PiP window
                if (userPreferences.displayTheme === 'retro-futuristic') {
                    summaryClone.classList.add('retro-theme');
                }
                
                // Remove PiP button from cloned content
                const pipButtonClone = summaryClone.querySelector('.pip-button');
                if (pipButtonClone) {
                    pipButtonClone.remove();
                }
                
                // Remove developer info from cloned content for more space
                const developerInfoClone = summaryClone.querySelector('.developer-info');
                if (developerInfoClone) {
                    developerInfoClone.remove();
                }
                
                // Remove settings button from cloned content
                const settingsButtonClone = summaryClone.querySelector('.settings-button');
                if (settingsButtonClone) {
                    settingsButtonClone.remove();
                }
                
                // Add compact mode button to PiP window
                const compactButton = document.createElement('button');
                compactButton.className = 'pip-compact-button';
                compactButton.innerHTML = '[≡]';
                compactButton.title = 'Toggle Compact Mode';
                compactButton.onclick = () => toggleCompactMode(pipWindow, summaryClone);
                
                summaryClone.appendChild(compactButton);
                
                // Append to PiP window
                pipWindow.document.body.appendChild(summaryClone);
                
                // Adjust window size to content after a brief delay
                setTimeout(() => {
                    adjustPipWindowSize(pipWindow, summaryClone);
                }, 100);
                
                // Show placeholder in main window
                showPipPlaceholder(attendanceSummary);
                
                // Update PiP button state
                updatePipButtonState(true);
                
                // Set up PiP window event listeners
                setupPipEventListeners(pipWindow, attendanceSummary);
                
                // Start PiP update loop
                startPipUpdateLoop(summaryClone);
            }
            
        } catch (error) {
            console.error('Failed to open Picture-in-Picture window:', error);
            isPipActive = false;
            updatePipButtonState(false);
        }
    }
    
    // Copy styles to PiP window
    function copyStylesToPip(pipWindow) {
        // Add color-scheme meta tag for proper theme inheritance
        const metaColorScheme = pipWindow.document.createElement('meta');
        metaColorScheme.name = 'color-scheme';
        metaColorScheme.content = 'light dark';
        pipWindow.document.head.appendChild(metaColorScheme);
        
        // Copy the custom styles
        const styleElement = document.getElementById('attendance-modern-styles');
        if (styleElement) {
            const pipStyleElement = pipWindow.document.createElement('style');
            pipStyleElement.innerHTML = styleElement.innerHTML;
            pipWindow.document.head.appendChild(pipStyleElement);
        }
        
        // Detect current color scheme
        const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        // Determine background based on user's theme preference
        let backgroundStyle;
        if (userPreferences.displayTheme === 'retro-futuristic') {
            // Use retro-futuristic dark background for both light and dark modes
            backgroundStyle = `
                background: linear-gradient(135deg, var(--retro-dark) 0%, var(--retro-dark-alt) 100%);
                background: linear-gradient(135deg, #0a0e27 0%, #1a1d3a 100%);
            `;
        } else {
            // Use glassmorphic theme-aware background
            backgroundStyle = isDarkMode ? `
                background: linear-gradient(135deg, #2d3436 0%, #636e72 100%);
            ` : `
                background: linear-gradient(135deg, #ddd6fe 0%, #8b5cf6 100%);
            `;
        }
        
        // Set body styles for PiP window - borderless and theme-aware
        pipWindow.document.body.style.cssText = `
            margin: 0;
            padding: 0;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            ${backgroundStyle}
            min-height: 100vh;
            overflow: hidden;
            border: none;
            border-radius: 0;
            color-scheme: ${isDarkMode ? 'dark' : 'light'};
            transition: background 0.3s ease, color 0.3s ease;
        `;
        
        // Set html styles to remove any default margins/padding
        pipWindow.document.documentElement.style.cssText = `
            margin: 0;
            padding: 0;
            border: none;
            overflow: hidden;
            color-scheme: ${isDarkMode ? 'dark' : 'light'};
        `;
        
        // Listen for color scheme changes and update PiP window accordingly
        const colorSchemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
        colorSchemeQuery.addEventListener('change', (e) => {
            updatePipColorScheme(pipWindow, e.matches);
        });
    }
    
    // Update PiP window color scheme dynamically
    function updatePipColorScheme(pipWindow, isDark) {
        if (!pipWindow || pipWindow.closed) return;
        
        let bodyStyle;
        if (userPreferences.displayTheme === 'retro-futuristic') {
            // Always use retro dark theme
            bodyStyle = `
                background: linear-gradient(135deg, #0a0e27 0%, #1a1d3a 100%);
                color-scheme: dark;
            `;
        } else {
            // Use glassmorphic theme colors
            bodyStyle = isDark ? `
                background: linear-gradient(135deg, #2d3436 0%, #636e72 100%);
                color-scheme: dark;
            ` : `
                background: linear-gradient(135deg, #ddd6fe 0%, #8b5cf6 100%);
                color-scheme: light;
            `;
        }
        
        // Apply the new background with smooth transition
        Object.assign(pipWindow.document.body.style, {
            background: isDark ? 'linear-gradient(135deg, #2d3436 0%, #636e72 100%)' : 'linear-gradient(135deg, #ddd6fe 0%, #8b5cf6 100%)',
            colorScheme: isDark ? 'dark' : 'light'
        });
        
        pipWindow.document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
    }
    
    // Toggle compact mode in PiP window
    function toggleCompactMode(pipWindow, summaryElement) {
        if (!pipWindow || pipWindow.closed || !summaryElement) return;
        
        const isCompact = summaryElement.classList.contains('compact-mode');
        
        if (isCompact) {
            // Switch back to full mode - regenerate content instead of cloning from placeholder
            const hadRetroTheme = summaryElement.classList.contains('retro-theme');
            summaryElement.classList.remove('compact-mode');
            summaryElement.className = 'attendance-summary pip-window-content';
            // Restore retro theme if it was set
            if (hadRetroTheme || userPreferences.displayTheme === 'retro-futuristic') {
                summaryElement.classList.add('retro-theme');
            }
            
            // Trigger a fresh calculation and render
            const tableDiv = document.querySelector('.main-attendance-table');
            if (tableDiv) {
                // Create a temporary container to generate fresh content
                const tempContainer = document.createElement('div');
                tempContainer.id = 'temp-pip-content';
                tempContainer.className = 'attendance-summary';
                
                // Calculate and render fresh content to temp container
                calculateTotalTime(tempContainer);
                
                // Copy the fresh content to PiP window
                if (tempContainer.innerHTML) {
                    summaryElement.innerHTML = tempContainer.innerHTML;
                    
                    // Remove PiP button, developer info, and settings button from PiP content
                    const pipButtonClone = summaryElement.querySelector('.pip-button');
                    if (pipButtonClone) pipButtonClone.remove();
                    
                    const developerInfoClone = summaryElement.querySelector('.developer-info');
                    if (developerInfoClone) developerInfoClone.remove();
                    
                    const settingsButtonClone = summaryElement.querySelector('.settings-button');
                    if (settingsButtonClone) settingsButtonClone.remove();
                    
                    // Add compact button back
                    const compactButton = document.createElement('button');
                    compactButton.className = 'pip-compact-button';
                    compactButton.innerHTML = '[≡]';
                    compactButton.title = 'Toggle Compact Mode';
                    compactButton.onclick = () => toggleCompactMode(pipWindow, summaryElement);
                    
                    summaryElement.appendChild(compactButton);
                }
                
                // Clean up temp container
                tempContainer.remove();
            }
        } else {
            // Switch to compact mode
            summaryElement.classList.add('compact-mode');
            
            // Apply retro theme to compact mode if user preference is set
            if (userPreferences.displayTheme === 'retro-futuristic') {
                summaryElement.classList.add('retro-theme');
            }
            
            // Get current remaining time and emoji from the actual content
            const remainingTimeElement = summaryElement.querySelector('#remaining-time');
            const emojiElement = summaryElement.querySelector('.emoji-display');
            const remainingTime = remainingTimeElement ? remainingTimeElement.textContent : '00:00:00';
            const currentEmoji = emojiElement ? emojiElement.textContent : '⏰';
            
            // Create compact display
            const compactHTML = `
                <div class="pip-compact-display" title="Click to expand">
                    <div class="pip-compact-time">${remainingTime}<span class="pip-compact-emoji">${currentEmoji}</span></div>
                    <div class="pip-compact-label">Time until freedom</div>
                </div>
            `;
            
            summaryElement.innerHTML = compactHTML;
            
            // Add expand functionality to the compact display
            const compactDisplay = summaryElement.querySelector('.pip-compact-display');
            if (compactDisplay) {
                compactDisplay.onclick = () => toggleCompactMode(pipWindow, summaryElement);
            }
            
            // Resize window for compact mode
            try {
                // Note: PiP API doesn't support dynamic resizing, but we optimize the content
                console.log('Compact mode activated - content optimized for minimal space');
            } catch (error) {
                console.log('Could not resize PiP window:', error);
            }
        }
    }
    
    // Adjust PiP window size to fit content
    function adjustPipWindowSize(pipWindow, content) {
        try {
            // Get content dimensions
            const contentHeight = content.scrollHeight;
            const contentWidth = content.scrollWidth;
            
            // Calculate optimal window size with some padding
            const optimalWidth = Math.min(Math.max(contentWidth + 32, 280), 380);
            const optimalHeight = Math.min(contentHeight + 32, window.screen.height * 0.8);
            
            // Note: The Document Picture-in-Picture API doesn't support dynamic resizing
            // But we can optimize the initial size based on screen size
            console.log(`Optimal PiP size would be: ${optimalWidth}x${optimalHeight}`);
            
        } catch (error) {
            console.log('Could not adjust PiP window size:', error);
        }
    }
    
    // Show placeholder in main window when content is in PiP
    function showPipPlaceholder(container) {
        container.classList.add('pip-active');
        
        // Hide all content except PiP button
        const allChildren = container.children;
        for (let child of allChildren) {
            if (!child.classList.contains('pip-button')) {
                child.style.display = 'none';
            }
        }
        
        // Create placeholder content
        const placeholder = document.createElement('div');
        placeholder.className = 'pip-placeholder active';
        placeholder.innerHTML = `
            <div class="pip-placeholder-icon">📱</div>
            <div class="pip-placeholder-text">Floating Window Active</div>
            <div class="pip-placeholder-desc">Your attendance summary is now floating above other windows</div>
        `;
        
        container.appendChild(placeholder);
    }
    
    // Hide placeholder and restore content
    function hidePipPlaceholder(container) {
        container.classList.remove('pip-active');
        
        // Remove placeholder
        const placeholder = container.querySelector('.pip-placeholder');
        if (placeholder) {
            placeholder.remove();
        }
        
        // Show all content
        const allChildren = container.children;
        for (let child of allChildren) {
            if (!child.classList.contains('pip-button')) {
                child.style.display = '';
            }
        }
    }
    
    // Update PiP button state
    function updatePipButtonState(isActive) {
        const pipButton = document.querySelector('.pip-button');
        if (pipButton) {
            if (isActive) {
                pipButton.classList.add('active');
                pipButton.innerHTML = `
                    <span class="pip-icon">🔲</span>
                    <span class="pip-text">Close Float</span>
                `;
            } else {
                pipButton.classList.remove('active');
                pipButton.innerHTML = `
                    <span class="pip-icon">📱</span>
                    <span class="pip-text">Float</span>
                `;
            }
        }
    }
    
    // Set up PiP window event listeners
    function setupPipEventListeners(pipWindow, originalContainer) {
        // Handle window close
        pipWindow.addEventListener('pagehide', () => {
            isPipActive = false;
            pipWindow = null;
            hidePipPlaceholder(originalContainer);
            updatePipButtonState(false);
        });
        
        // Handle window unload
        pipWindow.addEventListener('unload', () => {
            isPipActive = false;
            pipWindow = null;
            hidePipPlaceholder(originalContainer);
            updatePipButtonState(false);
        });
        
        // Handle color scheme changes from the main window
        const colorSchemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleColorSchemeChange = (e) => {
            if (pipWindow && !pipWindow.closed) {
                updatePipColorScheme(pipWindow, e.matches);
            }
        };
        
        colorSchemeQuery.addEventListener('change', handleColorSchemeChange);
        
        // Clean up color scheme listener when PiP window closes
        pipWindow.addEventListener('pagehide', () => {
            colorSchemeQuery.removeEventListener('change', handleColorSchemeChange);
        });
    }
    
    // Start update loop for PiP content
    function startPipUpdateLoop(pipContent) {
        const updatePipContent = () => {
            if (!isPipActive || !pipWindow || pipWindow.closed) {
                return;
            }
            
            // Get current data from the original container
            const originalContainer = document.getElementById('total-time-summary');
            if (originalContainer) {
                
                // Check if we're in compact mode
                if (pipContent.classList.contains('compact-mode')) {
                    // Update compact mode display
                    const compactTimeElement = pipContent.querySelector('.pip-compact-time');
                    const compactDisplay = pipContent.querySelector('.pip-compact-display');
                    
                    const originalRemainingTime = originalContainer.querySelector('#remaining-time');
                    const originalEmojiDisplay = originalContainer.querySelector('.emoji-display');
                    const originalTotalWorked = originalContainer.querySelector('#total-worked-time');
                    
                    if (compactTimeElement && originalRemainingTime) {
                        const remainingTime = originalRemainingTime.textContent;
                        const emoji = originalEmojiDisplay ? originalEmojiDisplay.textContent : '⏰';
                        compactTimeElement.innerHTML = `${remainingTime}<span class="pip-compact-emoji">${emoji}</span>`;
                        
                        // Dynamic background gradient based on progress
                        if (originalTotalWorked && compactDisplay) {
                            const totalSeconds = timeToSeconds(originalTotalWorked.textContent);
                            const progress = Math.min(totalSeconds / 28800, 1);
                            
                            const startColor = [225, 112, 85]; // Red-ish
                            const endColor = [0, 184, 148];   // Green-ish
                            
                            const bgColor = interpolateColor(startColor, endColor, progress);
                            const borderColor = bgColor.replace('0.2)', '0.4)');
                            
                            compactDisplay.style.background = bgColor;
                            compactDisplay.style.borderColor = borderColor;
                        }
                    }
                } else {
                    // Update full mode display - simple sync approach
                    const pipTotalWorked = pipContent.querySelector('#total-worked-time');
                    const pipRemainingTime = pipContent.querySelector('#remaining-time');
                    const pipCompletionTime = pipContent.querySelector('#completion-time');
                    const pipEmojiDisplay = pipContent.querySelector('.emoji-display');
                    const pipProgressFill = pipContent.querySelector('.progress-fill');
                    
                    const originalTotalWorked = originalContainer.querySelector('#total-worked-time');
                    const originalRemainingTime = originalContainer.querySelector('#remaining-time');
                    const originalCompletionTime = originalContainer.querySelector('#completion-time');
                    const originalEmojiDisplay = originalContainer.querySelector('.emoji-display');
                    const originalProgressFill = originalContainer.querySelector('.progress-fill');
                    
                    // Sync content if original elements exist (not in placeholder mode)
                    if (originalTotalWorked && pipTotalWorked) {
                        pipTotalWorked.textContent = originalTotalWorked.textContent;
                    }
                    if (originalRemainingTime && pipRemainingTime) {
                        pipRemainingTime.textContent = originalRemainingTime.textContent;
                    }
                    if (originalCompletionTime && pipCompletionTime) {
                        pipCompletionTime.textContent = originalCompletionTime.textContent;
                    }
                    if (originalEmojiDisplay && pipEmojiDisplay) {
                        pipEmojiDisplay.textContent = originalEmojiDisplay.textContent;
                    }
                    if (originalProgressFill && pipProgressFill) {
                        pipProgressFill.style.width = originalProgressFill.style.width;
                    }
                }
            }
            
            // Continue updating every second
            setTimeout(updatePipContent, 1000);
        };
        
        // Start the update loop
        setTimeout(updatePipContent, 1000);
    }
    
    function renderFullContent(totalTimeDiv, totalWorkedTime, checkInOutList, today) {
        // Get emoji for current progress
        const currentEmoji = getEmojiForProgress(totalWorkedTime);
        const progress = Math.min((totalWorkedTime / 28800) * 100, 100);

        // Create header with emoji and title
        const headerHTML = `
            <div class="summary-header">
                <div class="emoji-display">${currentEmoji}</div>
                <h2 class="summary-title">Attendance Summary</h2>
            </div>
        `;

        // Create modern table
        let tableHTML = `
            <table class="modern-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Check-In</th>
                        <th>Check-Out</th>
                        <th>Worked Time</th>
                        <th>Break Duration</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        checkInOutList.forEach((item, index) => {
            let durationDifference = '';
            let isSixHourGap = false;
            
            if (index > 0) {
                const prevItem = checkInOutList[index - 1];
                // Debug logging like original script
                console.log(prevItem.checkOut + '    ' + item.checkIn);
                durationDifference = calculateTimeDifference(prevItem.checkOut, item.checkIn);
                if (durationDifference >= 21600) { 
                    isSixHourGap = true;
                }
                durationDifference = secondsToHHMMSS(durationDifference);
            }
            
            if (isSixHourGap) {
                tableHTML += `
                    <tr>
                        <td colspan="5" class="gap-warning">
                            ⚠️ 6+ Hour Gap Detected (not added in total time)
                        </td>
                    </tr>
                `;
            }
            
            tableHTML += `
                <tr>
                    <td>${index + 1}</td>
                    <td>${item.checkIn}</td>
                    <td>${item.checkOut}</td>
                    <td>${item.workedTime}</td>
                    <td>${durationDifference}</td>
                </tr>
            `;
        });

        tableHTML += '</tbody></table>';

        // Create progress bar
        const progressBarHTML = `
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${progress}%"></div>
            </div>
        `;

        // Create time statistics
        const totalTimeFormatted = secondsToHHMMSS(totalWorkedTime);
        const remainingTime = 28800 - totalWorkedTime;
        const remainingTimeFormatted = remainingTime > 0 ? secondsToHHMMSS(remainingTime) : "00:00:00";

        let timeStatsHTML = `
            <div class="time-stats">
            <div class="stat-card worked-time-card">
                <div class="stat-label">Total Worked</div>
                <div id="total-worked-time" class="stat-value worked-time">${totalTimeFormatted}</div>
            </div>
            <div class="stat-card remaining-time-card">
                <div class="stat-label">Remaining</div>
                <div id="remaining-time" class="stat-value remaining-time">${remainingTimeFormatted}</div>
                <div class="remaining-desc">⏰ Time until freedom</div>
            </div>
        `;

        let futureTimeFormatted = '';
        if (remainingTime > 0) {
            const futureTime = new Date(today.getTime() + remainingTime * 1000);
            futureTimeFormatted = formatTime12Hour(futureTime);
            timeStatsHTML += `
                <div class="stat-card completion-time-card">
                    <div class="stat-label">Complete at</div>
                    <div id="completion-time" class="stat-value completion-time">${futureTimeFormatted}</div>
                </div>
            `;
        }

        timeStatsHTML += '</div>';

        // Completion message
        let completionHTML = '';
        if (remainingTime <= 0) {
            completionHTML = `
                <div class="completion-message">
                    🎉 Congratulations! You've completed your 8-hour shift! 🎉
                </div>
            `;
        }

        // Combine all HTML
        totalTimeDiv.innerHTML = headerHTML + progressBarHTML + tableHTML + timeStatsHTML + completionHTML;
        
        // Add developer info inside the card
        addDeveloperInfo(totalTimeDiv);
        
        // Add settings button
        addSettingsButton(totalTimeDiv);
        
        // Add PiP button if supported
        createPipButton(totalTimeDiv);
        
        // Add parallax effect
        addParallaxEffect(totalTimeDiv);
        
        // Reset cached values for new render
        cachedValues = {
            totalWorked: totalTimeFormatted,
            remaining: remainingTimeFormatted,
            completion: futureTimeFormatted,
            emoji: currentEmoji,
            progress: progress
        };
    }
    
    function updateDynamicContent(totalWorkedTime, today) {
        // Batch all DOM reads first, then all writes to prevent layout thrashing
        const totalTimeFormatted = secondsToHHMMSS(totalWorkedTime);
        const remainingTime = 28800 - totalWorkedTime;
        const remainingTimeFormatted = remainingTime > 0 ? secondsToHHMMSS(remainingTime) : "00:00:00";
        const currentEmoji = getEmojiForProgress(totalWorkedTime);
        const progress = Math.min((totalWorkedTime / 28800) * 100, 100);
        
        let futureTimeFormatted = '';
        if (remainingTime > 0) {
            const futureTime = new Date(today.getTime() + remainingTime * 1000);
            futureTimeFormatted = formatTime12Hour(futureTime);
        }
        
        // Only update if values have actually changed
        const updates = [];
        
        if (cachedValues.totalWorked !== totalTimeFormatted) {
            updates.push({
                element: document.getElementById('total-worked-time'),
                property: 'textContent',
                value: totalTimeFormatted
            });
            cachedValues.totalWorked = totalTimeFormatted;
        }
        
        if (cachedValues.remaining !== remainingTimeFormatted) {
            updates.push({
                element: document.getElementById('remaining-time'),
                property: 'textContent',
                value: remainingTimeFormatted
            });
            cachedValues.remaining = remainingTimeFormatted;
        }
        
        if (cachedValues.completion !== futureTimeFormatted && futureTimeFormatted) {
            updates.push({
                element: document.getElementById('completion-time'),
                property: 'textContent',
                value: futureTimeFormatted
            });
            cachedValues.completion = futureTimeFormatted;
        }
        
        if (cachedValues.emoji !== currentEmoji) {
            updates.push({
                element: document.querySelector('.emoji-display'),
                property: 'textContent',
                value: currentEmoji
            });
            cachedValues.emoji = currentEmoji;
        }
        
        if (cachedValues.progress !== progress) {
            updates.push({
                element: document.querySelector('.progress-fill'),
                property: 'width',
                value: `${progress}%`
            });
            cachedValues.progress = progress;
        }
        
        // Batch all DOM writes together
        if (updates.length > 0) {
            requestAnimationFrame(() => {
                updates.forEach(update => {
                    if (update.element) {
                        if (update.property === 'width') {
                            update.element.style.width = update.value;
                        } else {
                            update.element[update.property] = update.value;
                        }
                    }
                });
            });
        }
    }

    // Optimized update loop using requestAnimationFrame
    function startUpdateLoop() {
        let lastUpdateTime = 0;
        
        function updateLoop(currentTime) {
            // Throttle updates to once per second
            if (currentTime - lastUpdateTime >= 1000) {
                const currentUrl = window.location.href;
                if (currentUrl === targetUrl) {
                    insertAndCalculate();
                }
                lastUpdateTime = currentTime;
            }
            
            animationFrameId = requestAnimationFrame(updateLoop);
        }
        
        animationFrameId = requestAnimationFrame(updateLoop);
    }
    
    function stopUpdateLoop() {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
    }

    // Initialize the enhanced attendance checker
    window.addEventListener('load', () => {
        // Load user preferences
        loadPreferences();
        
        const checkUrlAndRun = () => {
            const currentUrl = window.location.href;
            if (currentUrl !== targetUrl) {
                return; 
            }

            insertAndCalculate();
            const submitButton = document.querySelector('.gp-btn.gp-btn-primary');
            if (submitButton) {
                submitButton.addEventListener('click', (event) => {
                    setTimeout(insertAndCalculate, 500);
                });
            }
        };

        checkUrlAndRun();

        // Start optimized update loop
        startUpdateLoop();
    });
    
    // Cleanup animation frames when page unloads
    window.addEventListener('beforeunload', () => {
        stopUpdateLoop();
    });
})();
