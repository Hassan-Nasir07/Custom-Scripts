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
    const emojiProgression = ['😭', '😖', '😟', '😓', '😌', '🙂', '☺️', '😄'];
    const runningEmoji = '🏃💨'; // 8:00 to 8:30 hours
    const clownEmoji = '🫵🤡'; // After 8:30 hours
    
    // Global variables for performance optimization
    let lastTotalWorkedTime = -1; // Track if we need to re-render
    let isFirstRender = true; // Track first render
    let animationFrameId = null; // For requestAnimationFrame
    let pipWindow = null; // Picture-in-Picture window reference
    let isPipActive = false; // Track PiP status
    
    // Cache for preventing unnecessary updates
    let cachedValues = {
        totalWorked: '',
        remaining: '',
        completion: '',
        emoji: '',
        progress: -1
    };
    
    // Modern CSS styles following 2025 trends
    const modernStyles = `
        <style id="attendance-modern-styles">
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
            
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
                    inset 0 1px 0 rgba(255, 255, 255, 0.1);
                margin: 32px auto;
                padding: 32px;
                max-width: 800px;
                position: relative;
                overflow: hidden;
                transition: all 0.3s ease, background 0.5s ease, color 0.5s ease, border-color 0.5s ease;
            }
            
            .attendance-summary::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 1px;
                background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
                animation: shimmer 1s infinite;
            }
            
            .attendance-summary:hover {
                transform: translateY(-2px);
                box-shadow: 
                    0 16px 48px rgba(0, 0, 0, 0.15),
                    0 4px 12px rgba(0, 0, 0, 0.1),
                    inset 0 1px 0 rgba(255, 255, 255, 0.15);
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
                animation: emojiPulse 3s ease-in-out infinite;
                filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.2));
                transition: all 0.3s ease;
            }
            
            .summary-title {
                font-size: 2rem;
                font-weight: 700;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
                margin: 0;
                letter-spacing: -0.02em;
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
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 20px;
                margin: 32px 0;
            }
            
            .stat-card {
                background: rgba(255, 255, 255, 0.08);
                border: 1px solid rgba(255, 255, 255, 0.15);
                border-radius: 16px;
                padding: 24px;
                text-align: center;
                transition: all 0.3s ease, background 0.5s ease, border-color 0.5s ease;
                position: relative;
                overflow: hidden;
            }
            
            .stat-card.worked-time-card {
                background: linear-gradient(135deg, rgba(0, 184, 148, 0.2), rgba(0, 184, 148, 0.1));
                border-color: rgba(0, 184, 148, 0.3);
            }
            
            .stat-card.remaining-time-card {
                background: linear-gradient(135deg, rgba(225, 112, 85, 0.2), rgba(225, 112, 85, 0.1));
                border-color: rgba(225, 112, 85, 0.3);
            }
            
            .stat-card.completion-time-card {
                background: linear-gradient(135deg, rgba(108, 92, 231, 0.2), rgba(108, 92, 231, 0.1));
                border-color: rgba(108, 92, 231, 0.3);
            }
            
            .stat-card::before {
                content: '';
                position: absolute;
                top: 0;
                left: -100%;
                width: 100%;
                height: 2px;
                background: linear-gradient(90deg, transparent, #667eea, transparent);
                animation: cardShimmer 1s infinite;
            }
            
            .stat-card:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
            }
            
            .stat-label {
                font-size: 0.875rem;
                font-weight: 500;
                color: rgba(255, 255, 255, 0.7);
                margin-bottom: 8px;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                transition: color 0.5s ease;
            }
            
            .stat-value {
                font-size: 1.5rem;
                font-weight: 700;
                margin-bottom: 4px;
            }
            
            .worked-time { color: #00b894; }
            .remaining-time { color: #e17055; }
            .completion-time { color: #6c5ce7; }
            
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
            
            /* PiP Window Dark Mode */
            @media (prefers-color-scheme: dark) {
                .pip-window-content {
                    background: linear-gradient(135deg, rgba(30, 30, 30, 0.95), rgba(20, 20, 20, 0.9)) !important;
                    color: rgba(255, 255, 255, 0.95) !important;
                }
                
                .pip-window-content .modern-table {
                    background: rgba(0, 0, 0, 0.3) !important;
                    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3) !important;
                }
                
                .pip-window-content .modern-table td {
                    color: rgba(255, 255, 255, 0.85) !important;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.15) !important;
                }
                
                .pip-window-content .stat-card {
                    background: rgba(0, 0, 0, 0.4) !important;
                    border-color: rgba(255, 255, 255, 0.15) !important;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3) !important;
                }
                
                .pip-window-content .stat-label {
                    color: rgba(255, 255, 255, 0.7) !important;
                }
                
                .pip-window-content .progress-bar {
                    background: rgba(255, 255, 255, 0.15) !important;
                }
                
                .pip-window-content .pip-compact-button {
                    background: rgba(255, 255, 255, 0.2) !important;
                    color: rgba(255, 255, 255, 0.9) !important;
                }
                
                .pip-window-content .pip-compact-button:hover {
                    background: rgba(108, 92, 231, 0.8) !important;
                    color: white !important;
                }
                
                .pip-window-content .pip-compact-display {
                    background: rgba(225, 112, 85, 0.3) !important;
                    border-color: rgba(225, 112, 85, 0.5) !important;
                }
                
                .pip-window-content .pip-compact-time {
                    color: #fab1a0 !important;
                }
                
                .pip-window-content .pip-compact-label {
                    color: rgba(225, 112, 85, 0.9) !important;
                }
            }
            
            /* PiP Window Light Mode */
            @media (prefers-color-scheme: light) {
                .pip-window-content {
                    background: linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(248, 248, 248, 0.95)) !important;
                    color: rgba(0, 0, 0, 0.9) !important;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15) !important;
                }
                
                .pip-window-content .modern-table {
                    background: rgba(255, 255, 255, 0.9) !important;
                    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1) !important;
                }
                
                .pip-window-content .modern-table td {
                    color: rgba(0, 0, 0, 0.8) !important;
                    border-bottom: 1px solid rgba(0, 0, 0, 0.1) !important;
                }
                
                .pip-window-content .stat-card {
                    background: rgba(255, 255, 255, 0.8) !important;
                    border-color: rgba(0, 0, 0, 0.1) !important;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08) !important;
                }
                
                .pip-window-content .stat-card.worked-time-card {
                    background: linear-gradient(135deg, rgba(0, 184, 148, 0.15), rgba(0, 184, 148, 0.08)) !important;
                    border-color: rgba(0, 184, 148, 0.3) !important;
                }
                
                .pip-window-content .stat-card.remaining-time-card {
                    background: linear-gradient(135deg, rgba(225, 112, 85, 0.15), rgba(225, 112, 85, 0.08)) !important;
                    border-color: rgba(225, 112, 85, 0.3) !important;
                }
                
                .pip-window-content .stat-card.completion-time-card {
                    background: linear-gradient(135deg, rgba(108, 92, 231, 0.15), rgba(108, 92, 231, 0.08)) !important;
                    border-color: rgba(108, 92, 231, 0.3) !important;
                }
                
                .pip-window-content .stat-label {
                    color: rgba(0, 0, 0, 0.6) !important;
                }
                
                .pip-window-content .progress-bar {
                    background: rgba(0, 0, 0, 0.1) !important;
                }
                
                .pip-window-content .pip-compact-button {
                    background: rgba(0, 0, 0, 0.1) !important;
                    color: rgba(0, 0, 0, 0.7) !important;
                }
                
                .pip-window-content .pip-compact-button:hover {
                    background: rgba(108, 92, 231, 0.8) !important;
                    color: white !important;
                }
                
                .pip-window-content .pip-compact-display {
                    background: rgba(225, 112, 85, 0.2) !important;
                    border-color: rgba(225, 112, 85, 0.4) !important;
                }
                
                .pip-window-content .pip-compact-time {
                    color: #e17055 !important;
                }
                
                .pip-window-content .pip-compact-label {
                    color: rgba(225, 112, 85, 0.8) !important;
                }
                
                .pip-window-content .gap-warning {
                    background: linear-gradient(135deg, #ffeaa7, #fab1a0) !important;
                    color: #2d3436 !important;
                }
            }
            
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
                padding: 8px !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                min-height: auto !important;
                height: auto !important;
            }
            
            .pip-compact-display {
                text-align: center !important;
                background: rgba(225, 112, 85, 0.2) !important;
                border: 1px solid rgba(225, 112, 85, 0.4) !important;
                border-radius: 12px !important;
                padding: 12px 16px !important;
                backdrop-filter: blur(10px) !important;
                -webkit-backdrop-filter: blur(10px) !important;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2) !important;
                transition: all 0.3s ease !important;
                cursor: pointer !important;
            }
            
            .pip-compact-display:hover {
                transform: scale(1.02) !important;
                background: rgba(225, 112, 85, 0.3) !important;
            }
            
            .pip-compact-time {
                font-size: 1.5rem !important;
                font-weight: 700 !important;
                color: #e17055 !important;
                margin: 0 !important;
                line-height: 1 !important;
            }
            
            .pip-compact-label {
                font-size: 0.7rem !important;
                font-weight: 500 !important;
                color: rgba(225, 112, 85, 0.8) !important;
                margin: 2px 0 0 0 !important;
                text-transform: uppercase !important;
                letter-spacing: 0.05em !important;
            }
            
            .pip-compact-emoji {
                font-size: 1.2rem !important;
                margin-left: 8px !important;
                display: inline-block !important;
                animation: emojiPulse 2s ease-in-out infinite !important;
            }
            
            /* Performance optimization for dynamic elements */
            .stat-value, .emoji-display, .progress-fill {
                will-change: transform;
            }
            
            .progress-bar {
                width: 100%;
                height: 8px;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 4px;
                overflow: hidden;
                margin: 20px 0;
                position: relative;
            }
            
            .progress-fill {
                height: 100%;
                background: linear-gradient(90deg, #667eea, #764ba2);
                border-radius: 4px;
                transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
                position: relative;
                overflow: hidden;
            }
            
            .progress-fill::after {
                content: '';
                position: absolute;
                top: 0;
                left: -100%;
                width: 100%;
                height: 100%;
                background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
                animation: progressShimmer 1s infinite;
            }
            
            /* Animations */
            @keyframes emojiPulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.1); }
            }
            
            @keyframes shimmer {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(100%); }
            }
            
            @keyframes cardShimmer {
                0% { left: -100%; }
                100% { left: 100%; }
            }
            
            @keyframes progressShimmer {
                0% { left: -100%; }
                100% { left: 100%; }
            }
            
            @keyframes warningPulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.8; }
            }
            
            @keyframes celebrationPulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.02); }
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
                    gap: 16px;
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
                    font-size: 1.2rem;
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
        const emojiIndex = Math.floor(progress * emojiProgression.length);
        return emojiProgression[Math.min(emojiIndex, emojiProgression.length - 1)];
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
                <small>Build: v2.1.2025 (PiP Edition)</small><br>
                <small>Last Modified: 23 Aug 2025</small><br>
                <small>New: Picture-in-Picture Support 📱</small><br>
                <small>Azadi Mubarak ☪️</small>
            </div>
        `;
        
        container.appendChild(developerDiv);
    }

    function insertAndCalculate() {
        injectModernStyles();
        
        const tableDiv = document.querySelector('.main-attendance-table');
        if (!tableDiv) {
            return;
        }
        
        let totalTimeDiv = document.getElementById('total-time-summary');
        if (!totalTimeDiv) {
            totalTimeDiv = document.createElement('div');
            totalTimeDiv.id = 'total-time-summary';
            totalTimeDiv.className = 'attendance-summary';
            isFirstRender = true;
        }

        calculateTotalTime(totalTimeDiv);
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
        const period = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12;
        return `${hours}:${minutes} ${period}`;
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
                
                // Add compact mode button to PiP window
                const compactButton = document.createElement('button');
                compactButton.className = 'pip-compact-button';
                compactButton.innerHTML = '🔲';
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
        
        // Set body styles for PiP window - borderless and theme-aware
        if (isDarkMode) {
            pipWindow.document.body.style.cssText = `
                margin: 0;
                padding: 0;
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: linear-gradient(135deg, #2d3436 0%, #636e72 100%);
                min-height: 100vh;
                overflow: hidden;
                border: none;
                border-radius: 0;
                color-scheme: dark;
                transition: background 0.3s ease, color 0.3s ease;
            `;
        } else {
            pipWindow.document.body.style.cssText = `
                margin: 0;
                padding: 0;
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: linear-gradient(135deg, #ddd6fe 0%, #8b5cf6 100%);
                min-height: 100vh;
                overflow: hidden;
                border: none;
                border-radius: 0;
                color-scheme: light;
                transition: background 0.3s ease, color 0.3s ease;
            `;
        }
        
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
        
        const bodyStyle = isDark ? `
            background: linear-gradient(135deg, #2d3436 0%, #636e72 100%);
            color-scheme: dark;
        ` : `
            background: linear-gradient(135deg, #ddd6fe 0%, #8b5cf6 100%);
            color-scheme: light;
        `;
        
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
            summaryElement.classList.remove('compact-mode');
            summaryElement.className = 'attendance-summary pip-window-content';
            
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
                    
                    // Remove PiP button and developer info from PiP content
                    const pipButtonClone = summaryElement.querySelector('.pip-button');
                    if (pipButtonClone) pipButtonClone.remove();
                    
                    const developerInfoClone = summaryElement.querySelector('.developer-info');
                    if (developerInfoClone) developerInfoClone.remove();
                    
                    // Add compact button back
                    const compactButton = document.createElement('button');
                    compactButton.className = 'pip-compact-button';
                    compactButton.innerHTML = '🔲';
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
                    
                    const originalRemainingTime = originalContainer.querySelector('#remaining-time');
                    const originalEmojiDisplay = originalContainer.querySelector('.emoji-display');
                    
                    if (compactTimeElement && originalRemainingTime) {
                        const remainingTime = originalRemainingTime.textContent;
                        const emoji = originalEmojiDisplay ? originalEmojiDisplay.textContent : '⏰';
                        compactTimeElement.innerHTML = `${remainingTime}<span class="pip-compact-emoji">${emoji}</span>`;
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
        
        // Add PiP button if supported
        createPipButton(totalTimeDiv);
        
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
