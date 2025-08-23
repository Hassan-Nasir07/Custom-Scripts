/**
 * Enhanced Portal Interactions 2025
 * Modern JavaScript enhancements for portal interface
 * Includes micro-animations, smooth interactions, and accessibility features
 */

class EnhancedPortalInteractions {
    constructor() {
        this.init();
        this.setupEventListeners();
        this.initializeAnimations();
        this.setupAccessibilityFeatures();
        this.initializePerformanceOptimizations();
    }

    init() {
        console.log('🚀 Enhanced Portal Interactions 2025 - Initialized');
        
        // Set initial theme
        this.initializeTheme();
        
        // Add CSS custom properties for JavaScript control
        this.addDynamicStyles();
        
        // Initialize intersection observer for scroll animations
        this.setupIntersectionObserver();
        
        // Setup theme detection and switching
        this.setupThemeDetection();
        
        // Initialize micro-interactions
        this.initializeMicroInteractions();
        
        // Fix toggle button
        this.fixToggleButton();
    }
    
    initializeTheme() {
        // Get saved theme or default to light
        const savedTheme = localStorage.getItem('theme-preference') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        document.body.setAttribute('data-theme', savedTheme);
        this.updateThemeElements(savedTheme);
    }
    
    fixToggleButton() {
        // Ensure toggle button is properly visible and functional
        setTimeout(() => {
            const toggleBtn = document.querySelector('.gp-user-profile .navbar-toggler');
            if (toggleBtn) {
                // Remove any interfering Bootstrap styles
                toggleBtn.style.border = '2px solid rgba(255, 255, 255, 0.4)';
                toggleBtn.style.background = 'linear-gradient(135deg, rgba(102, 126, 234, 0.9), rgba(118, 75, 162, 0.9))';
                toggleBtn.style.borderRadius = '12px';
                toggleBtn.style.padding = '8px 12px';
                toggleBtn.style.display = 'flex';
                toggleBtn.style.alignItems = 'center';
                toggleBtn.style.justifyContent = 'center';
                toggleBtn.style.minWidth = '40px';
                toggleBtn.style.height = '40px';
                
                // Ensure the icon is visible
                const icon = toggleBtn.querySelector('.navbar-toggler-icon');
                if (icon) {
                    icon.style.backgroundImage = 'none';
                    icon.innerHTML = '<span style="color: white; font-size: 20px; font-weight: bold;">⋮</span>';
                }
            }
        }, 100);
    }

    addDynamicStyles() {
        const style = document.createElement('style');
        style.id = 'enhanced-portal-js-styles';
        style.textContent = `
            /* JavaScript-enhanced styles */
            .enhanced-hover {
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            }
            
            .enhanced-hover:hover {
                transform: translateY(-2px) scale(1.02);
                filter: brightness(1.1);
            }
            
            .floating-animation {
                animation: float 3s ease-in-out infinite;
            }
            
            @keyframes float {
                0%, 100% { transform: translateY(0px); }
                50% { transform: translateY(-10px); }
            }
            
            .pulse-animation {
                animation: pulse 2s ease-in-out infinite;
            }
            
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.7; }
            }
            
            .slide-in-left {
                animation: slideInLeft 0.6s ease-out;
            }
            
            @keyframes slideInLeft {
                from {
                    opacity: 0;
                    transform: translateX(-30px);
                }
                to {
                    opacity: 1;
                    transform: translateX(0);
                }
            }
            
            .slide-in-right {
                animation: slideInRight 0.6s ease-out;
            }
            
            @keyframes slideInRight {
                from {
                    opacity: 0;
                    transform: translateX(30px);
                }
                to {
                    opacity: 1;
                    transform: translateX(0);
                }
            }
            
            .fade-in-up {
                animation: fadeInUp 0.6s ease-out;
            }
            
            @keyframes fadeInUp {
                from {
                    opacity: 0;
                    transform: translateY(30px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            
            .typewriter {
                overflow: hidden;
                border-right: 2px solid;
                white-space: nowrap;
                animation: typing 2s steps(40, end), blink-caret 0.75s step-end infinite;
            }
            
            @keyframes typing {
                from { width: 0; }
                to { width: 100%; }
            }
            
            @keyframes blink-caret {
                from, to { border-color: transparent; }
                50% { border-color: var(--tertiary); }
            }
            
            .glassmorphism-enhanced {
                background: rgba(255, 255, 255, 0.1);
                backdrop-filter: blur(20px);
                border: 1px solid rgba(255, 255, 255, 0.2);
                box-shadow: 0 8px 32px rgba(31, 38, 135, 0.37);
                transition: all 0.3s ease;
            }
            
            .glassmorphism-enhanced:hover {
                background: rgba(255, 255, 255, 0.15);
                backdrop-filter: blur(25px);
                transform: translateY(-2px);
                box-shadow: 0 12px 40px rgba(31, 38, 135, 0.5);
            }
            
            .loading-shimmer {
                background: linear-gradient(90deg, 
                    rgba(255, 255, 255, 0.1) 25%, 
                    rgba(255, 255, 255, 0.3) 50%, 
                    rgba(255, 255, 255, 0.1) 75%);
                background-size: 200% 100%;
                animation: shimmer 1.5s infinite;
            }
            
            @keyframes shimmer {
                0% { background-position: 200% 0; }
                100% { background-position: -200% 0; }
            }
            
            .notification-toast {
                position: fixed;
                top: 20px;
                right: 20px;
                background: var(--glass-bg, rgba(255, 255, 255, 0.9));
                backdrop-filter: blur(20px);
                border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.2));
                border-radius: 12px;
                padding: 16px 20px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
                z-index: 1060;
                transform: translateX(400px);
                transition: transform 0.3s ease;
                max-width: 300px;
            }
            
            .notification-toast.show {
                transform: translateX(0);
            }
            
            .tooltip-enhanced {
                position: absolute;
                background: rgba(0, 0, 0, 0.9);
                color: white;
                padding: 8px 12px;
                border-radius: 8px;
                font-size: 12px;
                white-space: nowrap;
                z-index: 1070;
                opacity: 0;
                transform: translateY(-10px);
                transition: all 0.3s ease;
                pointer-events: none;
            }
            
            .tooltip-enhanced.show {
                opacity: 1;
                transform: translateY(0);
            }
        `;
        
        document.head.appendChild(style);
    }

    setupEventListeners() {
        // Enhanced button interactions
        this.enhanceButtons();
        
        // Enhanced navigation interactions
        this.enhanceNavigation();
        
        // Enhanced form interactions
        this.enhanceForms();
        
        // Keyboard navigation support
        this.setupKeyboardNavigation();
        
        // Touch gesture support
        this.setupTouchGestures();
    }

    enhanceButtons() {
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('gp-btn-primary') || 
                e.target.closest('.gp-btn-primary')) {
                this.createRippleEffect(e);
            }
        });

        // Add enhanced hover effects to buttons
        document.querySelectorAll('.gp-btn-primary').forEach(btn => {
            btn.classList.add('enhanced-hover');
            
            // Add loading state functionality
            btn.addEventListener('click', () => {
                if (!btn.disabled) {
                    this.showButtonLoading(btn);
                }
            });
        });
    }

    createRippleEffect(event) {
        const button = event.target.closest('.gp-btn-primary');
        if (!button) return;

        const ripple = document.createElement('span');
        const rect = button.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = event.clientX - rect.left - size / 2;
        const y = event.clientY - rect.top - size / 2;
        
        ripple.style.cssText = `
            position: absolute;
            width: ${size}px;
            height: ${size}px;
            left: ${x}px;
            top: ${y}px;
            background: rgba(255, 255, 255, 0.6);
            border-radius: 50%;
            transform: scale(0);
            animation: ripple 0.6s ease-out;
            pointer-events: none;
        `;
        
        if (!document.querySelector('#ripple-keyframes')) {
            const rippleStyle = document.createElement('style');
            rippleStyle.id = 'ripple-keyframes';
            rippleStyle.textContent = `
                @keyframes ripple {
                    to {
                        transform: scale(2);
                        opacity: 0;
                    }
                }
            `;
            document.head.appendChild(rippleStyle);
        }
        
        button.style.position = 'relative';
        button.style.overflow = 'hidden';
        button.appendChild(ripple);
        
        setTimeout(() => {
            ripple.remove();
        }, 600);
    }

    showButtonLoading(button) {
        const originalText = button.textContent;
        const loadingSpinner = document.createElement('span');
        loadingSpinner.innerHTML = '⟳';
        loadingSpinner.style.cssText = `
            display: inline-block;
            animation: spin 1s linear infinite;
            margin-right: 8px;
        `;
        
        if (!document.querySelector('#spinner-keyframes')) {
            const spinnerStyle = document.createElement('style');
            spinnerStyle.id = 'spinner-keyframes';
            spinnerStyle.textContent = `
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(spinnerStyle);
        }
        
        button.disabled = true;
        button.innerHTML = '';
        button.appendChild(loadingSpinner);
        button.insertAdjacentText('beforeend', 'Loading...');
        
        // Simulate loading completion after 2 seconds
        setTimeout(() => {
            button.disabled = false;
            button.textContent = originalText;
        }, 2000);
    }

    enhanceNavigation() {
        // Add smooth scroll behavior for navigation links
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                const href = link.getAttribute('href');
                if (href && href.startsWith('#')) {
                    e.preventDefault();
                    this.smoothScrollTo(href);
                }
            });
            
            // Add enhanced hover effects
            link.classList.add('enhanced-hover');
        });
        
        // Add breadcrumb navigation enhancement
        this.enhanceBreadcrumbs();
    }

    smoothScrollTo(target) {
        const element = document.querySelector(target);
        if (element) {
            element.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    }

    enhanceBreadcrumbs() {
        const breadcrumbs = document.querySelectorAll('.breadcrumb-item');
        breadcrumbs.forEach((item, index) => {
            item.style.animationDelay = `${index * 0.1}s`;
            item.classList.add('slide-in-left');
        });
    }

    enhanceForms() {
        // Add floating label effects
        document.querySelectorAll('input, textarea, select').forEach(input => {
            this.addFloatingLabel(input);
            this.addValidationEnhancement(input);
        });
        
        // Add form submission enhancement
        document.querySelectorAll('form').forEach(form => {
            form.addEventListener('submit', (e) => {
                this.handleFormSubmission(e);
            });
        });
    }

    addFloatingLabel(input) {
        const wrapper = document.createElement('div');
        wrapper.className = 'floating-label-wrapper';
        wrapper.style.cssText = `
            position: relative;
            display: inline-block;
            width: 100%;
        `;
        
        input.parentNode.insertBefore(wrapper, input);
        wrapper.appendChild(input);
        
        if (input.placeholder) {
            const label = document.createElement('label');
            label.textContent = input.placeholder;
            label.style.cssText = `
                position: absolute;
                left: 12px;
                top: 50%;
                transform: translateY(-50%);
                color: #666;
                transition: all 0.3s ease;
                pointer-events: none;
                background: white;
                padding: 0 4px;
            `;
            
            wrapper.appendChild(label);
            
            const handleFocus = () => {
                label.style.top = '0';
                label.style.fontSize = '12px';
                label.style.color = 'var(--tertiary)';
            };
            
            const handleBlur = () => {
                if (!input.value) {
                    label.style.top = '50%';
                    label.style.fontSize = '14px';
                    label.style.color = '#666';
                }
            };
            
            input.addEventListener('focus', handleFocus);
            input.addEventListener('blur', handleBlur);
            
            if (input.value) {
                handleFocus();
            }
        }
    }

    addValidationEnhancement(input) {
        input.addEventListener('invalid', (e) => {
            e.preventDefault();
            this.showValidationError(input, input.validationMessage);
        });
        
        input.addEventListener('input', () => {
            this.clearValidationError(input);
        });
    }

    showValidationError(input, message) {
        this.clearValidationError(input);
        
        const errorElement = document.createElement('div');
        errorElement.className = 'validation-error';
        errorElement.textContent = message;
        errorElement.style.cssText = `
            color: #e74c3c;
            font-size: 12px;
            margin-top: 4px;
            animation: shake 0.5s ease-in-out;
        `;
        
        if (!document.querySelector('#shake-keyframes')) {
            const shakeStyle = document.createElement('style');
            shakeStyle.id = 'shake-keyframes';
            shakeStyle.textContent = `
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-5px); }
                    75% { transform: translateX(5px); }
                }
            `;
            document.head.appendChild(shakeStyle);
        }
        
        input.parentNode.appendChild(errorElement);
        input.style.borderColor = '#e74c3c';
    }

    clearValidationError(input) {
        const errorElement = input.parentNode.querySelector('.validation-error');
        if (errorElement) {
            errorElement.remove();
        }
        input.style.borderColor = '';
    }

    handleFormSubmission(event) {
        const form = event.target;
        const submitButton = form.querySelector('[type="submit"]');
        
        if (submitButton) {
            this.showButtonLoading(submitButton);
        }
        
        // Add form data validation and submission feedback
        this.showNotification('Form submitted successfully!', 'success');
    }

    setupKeyboardNavigation() {
        document.addEventListener('keydown', (e) => {
            // Enhanced keyboard navigation
            if (e.key === 'Tab') {
                this.handleTabNavigation(e);
            }
            
            // Escape key handling
            if (e.key === 'Escape') {
                this.handleEscapeKey();
            }
            
            // Enter key enhancement
            if (e.key === 'Enter' && e.target.classList.contains('nav-link')) {
                e.target.click();
            }
        });
    }

    handleTabNavigation(event) {
        const focusableElements = document.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        
        const currentIndex = Array.from(focusableElements).indexOf(document.activeElement);
        
        if (event.shiftKey) {
            // Shift+Tab (backward)
            if (currentIndex === 0) {
                event.preventDefault();
                focusableElements[focusableElements.length - 1].focus();
            }
        } else {
            // Tab (forward)
            if (currentIndex === focusableElements.length - 1) {
                event.preventDefault();
                focusableElements[0].focus();
            }
        }
    }

    handleEscapeKey() {
        // Close any open modals, dropdowns, etc.
        const openElements = document.querySelectorAll('.show, .open, .active');
        openElements.forEach(element => {
            if (element.classList.contains('modal') || 
                element.classList.contains('dropdown-menu')) {
                element.classList.remove('show', 'open', 'active');
            }
        });
    }

    setupTouchGestures() {
        let startX, startY;
        
        document.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        });
        
        document.addEventListener('touchend', (e) => {
            if (!startX || !startY) return;
            
            const endX = e.changedTouches[0].clientX;
            const endY = e.changedTouches[0].clientY;
            
            const diffX = startX - endX;
            const diffY = startY - endY;
            
            // Swipe detection
            if (Math.abs(diffX) > Math.abs(diffY)) {
                if (diffX > 50) {
                    // Swipe left
                    this.handleSwipeLeft();
                } else if (diffX < -50) {
                    // Swipe right
                    this.handleSwipeRight();
                }
            }
            
            startX = null;
            startY = null;
        });
    }

    handleSwipeLeft() {
        // Handle left swipe (e.g., navigate to next page)
        console.log('Swipe left detected');
    }

    handleSwipeRight() {
        // Handle right swipe (e.g., navigate to previous page)
        console.log('Swipe right detected');
    }

    initializeAnimations() {
        // Add staggered animations to elements
        this.addStaggeredAnimations();
        
        // Add parallax effects
        this.setupParallaxEffects();
        
        // Add loading animations
        this.addLoadingAnimations();
    }

    addStaggeredAnimations() {
        document.querySelectorAll('.box-widget').forEach((widget, index) => {
            widget.style.animationDelay = `${index * 0.1}s`;
            widget.classList.add('fade-in-up');
        });
        
        document.querySelectorAll('.nav-item').forEach((item, index) => {
            item.style.animationDelay = `${index * 0.05}s`;
            item.classList.add('slide-in-left');
        });
    }

    setupParallaxEffects() {
        window.addEventListener('scroll', this.throttle(() => {
            const scrolled = window.pageYOffset;
            const parallaxElements = document.querySelectorAll('.parallax-element');
            
            parallaxElements.forEach(element => {
                const speed = element.dataset.speed || 0.5;
                const yPos = -(scrolled * speed);
                element.style.transform = `translateY(${yPos}px)`;
            });
        }, 16)); // 60fps
    }

    addLoadingAnimations() {
        // Add skeleton loading states
        document.querySelectorAll('.box-widget').forEach(widget => {
            if (!widget.textContent.trim()) {
                widget.classList.add('loading-shimmer');
                
                // Remove loading state after content loads
                const observer = new MutationObserver(() => {
                    if (widget.textContent.trim()) {
                        widget.classList.remove('loading-shimmer');
                        observer.disconnect();
                    }
                });
                
                observer.observe(widget, { childList: true, subtree: true });
            }
        });
    }

    setupIntersectionObserver() {
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };
        
        this.intersectionObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('in-view');
                    
                    // Add floating animation to certain elements
                    if (entry.target.classList.contains('box-widget')) {
                        entry.target.classList.add('floating-animation');
                    }
                }
            });
        }, observerOptions);
        
        // Observe elements for scroll animations
        document.querySelectorAll('.animate-on-scroll').forEach(element => {
            this.intersectionObserver.observe(element);
        });
        
        // Auto-add scroll animation class to certain elements
        document.querySelectorAll('.box-widget, .attendence-box').forEach(element => {
            element.classList.add('animate-on-scroll');
            this.intersectionObserver.observe(element);
        });
    }

    setupThemeDetection() {
        // Detect system theme preference
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        
        this.handleThemeChange(mediaQuery);
        mediaQuery.addListener(this.handleThemeChange.bind(this));
        
        // Add theme toggle functionality
        this.addThemeToggle();
    }

    handleThemeChange(mediaQuery) {
        const isDark = mediaQuery.matches;
        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
        
        // Update glassmorphism effects based on theme
        this.updateGlassmorphismForTheme(isDark);
    }

    updateGlassmorphismForTheme(isDark) {
        const glassmorphismElements = document.querySelectorAll('.glassmorphism-enhanced');
        
        glassmorphismElements.forEach(element => {
            if (isDark) {
                element.style.background = 'rgba(255, 255, 255, 0.05)';
                element.style.borderColor = 'rgba(255, 255, 255, 0.1)';
            } else {
                element.style.background = 'rgba(255, 255, 255, 0.8)';
                element.style.borderColor = 'rgba(0, 0, 0, 0.1)';
            }
        });
    }

    addThemeToggle() {
        const themeToggle = document.createElement('button');
        themeToggle.className = 'theme-toggle';
        themeToggle.innerHTML = '🌓';
        themeToggle.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 50px;
            height: 50px;
            border-radius: 50%;
            border: none;
            background: var(--glass-bg, rgba(255, 255, 255, 0.9));
            backdrop-filter: blur(20px);
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
            cursor: pointer;
            z-index: 1060;
            transition: all 0.3s ease;
            font-size: 20px;
        `;
        
        themeToggle.addEventListener('click', () => {
            this.toggleTheme();
        });
        
        document.body.appendChild(themeToggle);
    }

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        // Apply theme to document
        document.documentElement.setAttribute('data-theme', newTheme);
        document.body.setAttribute('data-theme', newTheme);
        
        // Store preference
        localStorage.setItem('theme-preference', newTheme);
        
        // Update glassmorphism and colors
        this.updateGlassmorphismForTheme(newTheme === 'dark');
        
        // Update any theme-dependent elements
        this.updateThemeElements(newTheme);
        
        this.showNotification(`Switched to ${newTheme} theme`, 'info');
    }
    
    updateThemeElements(theme) {
        // Update header icons
        const headerIcons = document.querySelectorAll('.header-icons .icon-link');
        headerIcons.forEach(icon => {
            if (theme === 'dark') {
                icon.style.background = 'rgba(255, 255, 255, 0.1)';
                icon.style.color = 'white';
            } else {
                icon.style.background = 'rgba(102, 126, 234, 0.1)';
                icon.style.color = 'white';
            }
        });
        
        // Update user profile toggle
        const userToggle = document.querySelector('.gp-user-profile .navbar-toggler');
        if (userToggle) {
            userToggle.style.display = 'flex';
            userToggle.style.alignItems = 'center';
            userToggle.style.justifyContent = 'center';
        }
    }

    initializeMicroInteractions() {
        // Add hover effects to interactive elements
        document.querySelectorAll('button, .nav-link, .box-widget').forEach(element => {
            element.classList.add('micro-interaction');
        });
        
        // Add click feedback
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('micro-interaction')) {
                this.addClickFeedback(e.target);
            }
        });
    }

    addClickFeedback(element) {
        element.style.transform = 'scale(0.95)';
        setTimeout(() => {
            element.style.transform = '';
        }, 150);
    }

    setupAccessibilityFeatures() {
        // Add ARIA labels and roles
        this.addAriaLabels();
        
        // Add screen reader support
        this.addScreenReaderSupport();
        
        // Add high contrast mode detection
        this.setupHighContrastMode();
    }

    addAriaLabels() {
        // Add missing ARIA labels
        document.querySelectorAll('button:not([aria-label])').forEach(button => {
            const text = button.textContent.trim();
            if (text) {
                button.setAttribute('aria-label', text);
            }
        });
        
        // Add roles to navigation elements
        document.querySelectorAll('.navbar-nav').forEach(nav => {
            nav.setAttribute('role', 'navigation');
        });
    }

    addScreenReaderSupport() {
        // Add live region for notifications
        const liveRegion = document.createElement('div');
        liveRegion.setAttribute('aria-live', 'polite');
        liveRegion.setAttribute('aria-atomic', 'true');
        liveRegion.style.cssText = `
            position: absolute;
            left: -10000px;
            width: 1px;
            height: 1px;
            overflow: hidden;
        `;
        document.body.appendChild(liveRegion);
        this.liveRegion = liveRegion;
    }

    setupHighContrastMode() {
        const highContrastQuery = window.matchMedia('(prefers-contrast: high)');
        
        this.handleHighContrastChange(highContrastQuery);
        highContrastQuery.addListener(this.handleHighContrastChange.bind(this));
    }

    handleHighContrastChange(mediaQuery) {
        if (mediaQuery.matches) {
            document.documentElement.classList.add('high-contrast');
        } else {
            document.documentElement.classList.remove('high-contrast');
        }
    }

    initializePerformanceOptimizations() {
        // Lazy load images
        this.setupLazyLoading();
        
        // Optimize animations for performance
        this.optimizeAnimations();
        
        // Setup efficient event delegation
        this.setupEventDelegation();
    }

    setupLazyLoading() {
        const images = document.querySelectorAll('img[data-src]');
        
        const imageObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.removeAttribute('data-src');
                    imageObserver.unobserve(img);
                }
            });
        });
        
        images.forEach(img => imageObserver.observe(img));
    }

    optimizeAnimations() {
        // Use transform and opacity for better performance
        const animatedElements = document.querySelectorAll('[class*="animate"]');
        
        animatedElements.forEach(element => {
            element.style.willChange = 'transform, opacity';
        });
        
        // Clean up will-change after animations
        document.addEventListener('animationend', (e) => {
            e.target.style.willChange = 'auto';
        });
    }

    setupEventDelegation() {
        // Use event delegation for better performance
        document.body.addEventListener('click', this.handleBodyClick.bind(this));
        document.body.addEventListener('mouseover', this.handleBodyMouseover.bind(this));
    }

    handleBodyClick(e) {
        // Handle all click events through delegation
        if (e.target.matches('.enhanced-button')) {
            this.handleEnhancedButtonClick(e);
        }
    }

    handleBodyMouseover(e) {
        // Handle all hover events through delegation
        if (e.target.matches('.enhanced-hover')) {
            this.handleEnhancedHover(e);
        }
    }

    handleEnhancedButtonClick(e) {
        // Enhanced button click handling
        console.log('Enhanced button clicked:', e.target);
    }

    handleEnhancedHover(e) {
        // Enhanced hover handling
        console.log('Enhanced hover:', e.target);
    }

    // Utility functions
    throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification-toast ${type}`;
        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 18px;">
                    ${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}
                </span>
                <span>${message}</span>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Trigger show animation
        setTimeout(() => notification.classList.add('show'), 100);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
        
        // Update live region for screen readers
        if (this.liveRegion) {
            this.liveRegion.textContent = message;
        }
    }

    // Public API methods
    addGlassmorphism(element) {
        element.classList.add('glassmorphism-enhanced');
    }

    addAnimation(element, animationType) {
        element.classList.add(animationType);
    }

    showTooltip(element, text) {
        const tooltip = document.createElement('div');
        tooltip.className = 'tooltip-enhanced';
        tooltip.textContent = text;
        
        element.appendChild(tooltip);
        
        setTimeout(() => tooltip.classList.add('show'), 100);
        
        // Remove on mouse leave
        element.addEventListener('mouseleave', () => {
            tooltip.classList.remove('show');
            setTimeout(() => tooltip.remove(), 300);
        }, { once: true });
    }
}

// Initialize the enhanced portal interactions when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.EnhancedPortal = new EnhancedPortalInteractions();
    });
} else {
    window.EnhancedPortal = new EnhancedPortalInteractions();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EnhancedPortalInteractions;
}
