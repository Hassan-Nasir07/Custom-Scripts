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
    
    // Feature initialization flags to prevent re-initialization
    let featuresInitialized = false;
    
    // ====================================
    // SNAKE GAME VARIABLES
    // ====================================
    let snakeCanvas, snakeCtx;
    let snake = [{x: 10, y: 10}];
    let food = {x: 15, y: 15};
    let direction = {x: 0, y: 0};
    let nextDirection = {x: 0, y: 0};
    let snakeScore = 0;
    let snakeHighScore = 0;
    let snakeGameLoop = null;
    let snakeGameRunning = false;
    let snakeGamePaused = false;
    const snakeGridSize = 20;
    const snakeCellSize = 2; // 2px per cell for smooth growth
    
    // ====================================
    // QUOTES SYSTEM VARIABLES
    // ====================================
    let quotesArray = [];
    let currentQuoteIndex = 0;
    let quoteInterval = null;
    let quotesInitialized = false; // Track if quotes system is already set up
    
    // ====================================
    // XP SYSTEM VARIABLES
    // ====================================
    let userXP = { 
        level: 1, 
        currentXP: 0, 
        totalXP: 0, 
        lastHourTracked: -1, 
        todayHours: 0,
        consecutiveDays: 0,
        lastAttendanceDate: null,
        longestStreak: 0,
        achievements: [],
        milestonesReached: []
    };
    
    // XP System Constants (Research-proven values)
    const XP_PER_HOUR = 15;           // Base hourly reward (increased from 10)
    const STREAK_BONUS = 20;          // Daily streak bonus
    const MILESTONE_BONUSES = {
        2: { xp: 10, label: '2-Hour Checkpoint' },
        4: { xp: 25, label: '4-Hour Halfway' },
        6: { xp: 40, label: '6-Hour Almost There' },
        8: { xp: 50, label: '8-Hour Full Day' }
    };
    
    // Achievement Definitions
    const ACHIEVEMENTS = {
        firstDay: { icon: '🎯', name: 'First Day', desc: 'Complete your first work day' },
        week1: { icon: '📅', name: 'Week Warrior', desc: 'Work 5 consecutive days' },
        streak7: { icon: '🔥', name: '7-Day Streak', desc: 'Maintain a 7-day streak' },
        streak30: { icon: '🏆', name: 'Monthly Master', desc: 'Achieve a 30-day streak' },
        level10: { icon: '⭐', name: 'Level 10', desc: 'Reach level 10' },
        level25: { icon: '💎', name: 'Level 25', desc: 'Reach level 25' },
        workaholic: { icon: '💪', name: 'Workaholic', desc: 'Complete 100 total hours' }
    };
    
    // ====================================
    // IMAGE BOX VARIABLES
    // ====================================
    let currentImageURL = '';
    
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
    
    // ====================================
    // LOCALSTORAGE MANAGEMENT
    // ====================================
    
    // Snake Game Storage
    function loadSnakeHighScore() {
        const saved = localStorage.getItem('snakeHighScore');
        return saved ? parseInt(saved) : 0;
    }
    
    function saveSnakeHighScore(score) {
        localStorage.setItem('snakeHighScore', score.toString());
    }
    
    // Quotes Storage  
    function loadQuotes() {
        const saved = localStorage.getItem('customQuotes');
        const defaultQuotes = [
            { text: "Do not pray for easy lives. Pray to be stronger men.", author: "John F. Kennedy" }
        ];
        return saved ? JSON.parse(saved) : defaultQuotes;
    }
    
    function saveQuotes(quotes) {
        localStorage.setItem('customQuotes', JSON.stringify(quotes));
    }
    
    // XP System Storage
    function loadUserXP() {
        const saved = localStorage.getItem('userXP');
        if (saved) {
            const data = JSON.parse(saved);
            // Migrate old data structure
            return {
                level: data.level || 1,
                currentXP: data.currentXP || 0,
                totalXP: data.totalXP || 0,
                lastHourTracked: data.lastHourTracked || -1,
                todayHours: data.todayHours || 0,
                consecutiveDays: data.consecutiveDays || 0,
                lastAttendanceDate: data.lastAttendanceDate || null,
                longestStreak: data.longestStreak || 0,
                achievements: data.achievements || [],
                milestonesReached: data.milestonesReached || []
            };
        }
        return { 
            level: 1, 
            currentXP: 0, 
            totalXP: 0, 
            lastHourTracked: -1, 
            todayHours: 0,
            consecutiveDays: 0,
            lastAttendanceDate: null,
            longestStreak: 0,
            achievements: [],
            milestonesReached: []
        };
    }
    
    function saveUserXP(xpData) {
        localStorage.setItem('userXP', JSON.stringify(xpData));
    }
    
    // Image URL Storage
    function loadImageURL() {
        return localStorage.getItem('customImageURL') || '';
    }
    
    function saveImageURL(url) {
        localStorage.setItem('customImageURL', url);
    }
    
    // ====================================
    // SNAKE GAME LOGIC
    // ====================================
    
    function initSnakeGame() {
        snakeCanvas = document.getElementById('snake-canvas');
        if (!snakeCanvas) return;
        
        snakeCtx = snakeCanvas.getContext('2d');
        snakeHighScore = loadSnakeHighScore();
        updateSnakeScoreDisplay();
        
        // Keyboard controls
        document.addEventListener('keydown', handleSnakeKeyPress);
        
        // Reset game
        resetSnakeGame();
    }
    
    function handleSnakeKeyPress(e) {
        if (!snakeGameRunning || snakeGamePaused) return;
        
        const key = e.key;
        
        // Prevent default arrow key scrolling
        if(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
            e.preventDefault();
        }
        
        if (key === 'ArrowUp' && direction.y === 0) {
            nextDirection = {x: 0, y: -1};
        } else if (key === 'ArrowDown' && direction.y === 0) {
            nextDirection = {x: 0, y: 1};
        } else if (key === 'ArrowLeft' && direction.x === 0) {
            nextDirection = {x: -1, y: 0};
        } else if (key === 'ArrowRight' && direction.x === 0) {
            nextDirection = {x: 1, y: 0};
        }
    }
    
    function startSnakeGame() {
        if (snakeGameRunning) return;
        
        snakeGameRunning = true;
        snakeGamePaused = false;
        hideSnakeGameOver();
        
        if (snakeGameLoop) clearInterval(snakeGameLoop);
        snakeGameLoop = setInterval(updateSnakeGame, 100);
        
        updateSnakePlayButton();
    }
    
    function pauseSnakeGame() {
        snakeGamePaused = !snakeGamePaused;
        updateSnakePlayButton();
    }
    
    function resetSnakeGame() {
        snake = [{x: 10, y: 10}];
        direction = {x: 0, y: 0};
        nextDirection = {x: 0, y: 0};
        snakeScore = 0;
        snakeGameRunning = false;
        snakeGamePaused = false;
        
        if (snakeGameLoop) {
            clearInterval(snakeGameLoop);
            snakeGameLoop = null;
        }
        
        // Clear canvas completely on reset
        if (snakeCtx) {
            snakeCtx.clearRect(0, 0, snakeCanvas.width, snakeCanvas.height);
        }
        
        spawnFood();
        updateSnakeScoreDisplay();
        drawSnakeGame();
        hideSnakeGameOver();
        updateSnakePlayButton();
    }
    
    function updateSnakeGame() {
        if (snakeGamePaused) return;
        
        direction = {...nextDirection};
        
        if (direction.x === 0 && direction.y === 0) return; // Not started moving
        
        // Calculate new head position
        const head = {
            x: snake[0].x + direction.x,
            y: snake[0].y + direction.y
        };
        
        // Check wall collision
        if (head.x < 0 || head.x >= snakeGridSize || head.y < 0 || head.y >= snakeGridSize) {
            gameOver();
            return;
        }
        
        // Check self collision
        if (snake.some(segment => segment.x === head.x && segment.y === head.y)) {
            gameOver();
            return;
        }
        
        // Add new head
        snake.unshift(head);
        
        // Check food collision
        if (head.x === food.x && head.y === food.y) {
            snakeScore++;
            updateSnakeScoreDisplay();
            spawnFood();
            // Snake grows by not removing tail
        } else {
            // Remove tail if no food eaten
            snake.pop();
        }
        
        drawSnakeGame();
    }
    
    function spawnFood() {
        do {
            food = {
                x: Math.floor(Math.random() * snakeGridSize),
                y: Math.floor(Math.random() * snakeGridSize)
            };
        } while (snake.some(segment => segment.x === food.x && segment.y === food.y));
    }
    
    function drawSnakeGame() {
        if (!snakeCtx) return;
        
        const cellSize = snakeCanvas.width / snakeGridSize;
        
        // Fully clear canvas first (prevents trail effect)
        snakeCtx.clearRect(0, 0, snakeCanvas.width, snakeCanvas.height);
        
        // Draw background
        snakeCtx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        snakeCtx.fillRect(0, 0, snakeCanvas.width, snakeCanvas.height);
        
        // Draw snake\n        snakeCtx.fillStyle = '#00b894';
        snake.forEach((segment, index) => {
            if (index === 0) {
                // Head with gradient
                const gradient = snakeCtx.createLinearGradient(
                    segment.x * cellSize, segment.y * cellSize,
                    (segment.x + 1) * cellSize, (segment.y + 1) * cellSize
                );
                gradient.addColorStop(0, '#00b894');
                gradient.addColorStop(1, '#55efc4');
                snakeCtx.fillStyle = gradient;
            } else {
                snakeCtx.fillStyle = '#00b894';
            }
            snakeCtx.fillRect(
                segment.x * cellSize + 1,
                segment.y * cellSize + 1,
                cellSize - 2,
                cellSize - 2
            );
        });
        
        // Draw food
        snakeCtx.fillStyle = '#e17055';
        snakeCtx.beginPath();
        snakeCtx.arc(
            food.x * cellSize + cellSize / 2,
            food.y * cellSize + cellSize / 2,
            cellSize / 2 - 2,
            0,
            Math.PI * 2
        );
        snakeCtx.fill();
    }
    
    function gameOver() {
        snakeGameRunning = false;
        snakeGamePaused = false;
        
        if (snakeGameLoop) {
            clearInterval(snakeGameLoop);
            snakeGameLoop = null;
        }
        
        // Clear canvas on game over
        if (snakeCtx) {
            snakeCtx.clearRect(0, 0, snakeCanvas.width, snakeCanvas.height);
        }
        
        // Update high score
        if (snakeScore > snakeHighScore) {
            snakeHighScore = snakeScore;
            saveSnakeHighScore(snakeHighScore);
            updateSnakeScoreDisplay();
        }
        
        showSnakeGameOver();
        updateSnakePlayButton();
        
        // Auto restart after 3 seconds
        setTimeout(() => {
            resetSnakeGame();
        }, 3000);
    }
    
    function showSnakeGameOver() {
        const gameOverDiv = document.getElementById('snake-game-over');
        if (gameOverDiv) {
            gameOverDiv.classList.add('active');
            const finalScore = gameOverDiv.querySelector('.final-score');
            if (finalScore) {
                finalScore.textContent = snakeScore;
            }
        }
    }
    
    function hideSnakeGameOver() {
        const gameOverDiv = document.getElementById('snake-game-over');
        if (gameOverDiv) {
            gameOverDiv.classList.remove('active');
        }
    }
    
    function updateSnakeScoreDisplay() {
        const scoreElement = document.getElementById('snake-current-score');
        const highScoreElement = document.getElementById('snake-high-score');
        
        if (scoreElement) scoreElement.textContent = snakeScore;
        if (highScoreElement) highScoreElement.textContent = `High: ${snakeHighScore}`;
    }
    
    function updateSnakePlayButton() {
        const playBtn = document.getElementById('snake-play-btn');
        if (!playBtn) return;
        
        if (!snakeGameRunning) {
            playBtn.textContent = '▶ Play';
        } else if (snakeGamePaused) {
            playBtn.textContent = '▶ Resume';
        } else {
            playBtn.textContent = '⏸ Pause';
        }
    }
    
    // ====================================
    // QUOTES SYSTEM LOGIC
    // ====================================
    
    function initQuotesSystem() {
        // Prevent re-initialization to avoid resetting animations
        if (quotesInitialized) return;
        
        quotesArray = loadQuotes();
        displayCurrentQuote(true); // Skip animation on first load
        startQuoteCycling();
        
        quotesInitialized = true;
    }
    
    function displayCurrentQuote(skipAnimation = false) {
        const quoteTextElement = document.getElementById('quote-text');
        const quoteAuthorElement = document.getElementById('quote-author');
        
        if (!quoteTextElement || quotesArray.length === 0) return;
        
        const quote = quotesArray[currentQuoteIndex];
        
        if (!skipAnimation) {
            // Use CSS class for smooth transition without resetting animations
            quoteTextElement.classList.add('fade-out');
            
            setTimeout(() => {
                // Update content
                quoteTextElement.textContent = `"${quote.text}"`;
                if (quoteAuthorElement) {
                    quoteAuthorElement.textContent = `— ${quote.author}`;
                }
                
                // Remove fade-out class to trigger fade-in via CSS
                quoteTextElement.classList.remove('fade-out');
            }, 300); // Reduced from 600ms for snappier transitions
        } else {
            // Direct update without animation (for initial load)
            quoteTextElement.textContent = `"${quote.text}"`;
            if (quoteAuthorElement) {
                quoteAuthorElement.textContent = `— ${quote.author}`;
            }
            // Ensure element is visible immediately 
            quoteTextElement.style.opacity = '1';
        }
    }
    
    function startQuoteCycling() {
        if (quoteInterval) clearInterval(quoteInterval);
        
        quoteInterval = setInterval(() => {
            currentQuoteIndex = (currentQuoteIndex + 1) % quotesArray.length;
            displayCurrentQuote();
        }, 6000);
    }
    
    function addCustomQuote() {
        const quoteText = prompt('Enter your motivational quote:');
        if (!quoteText || quoteText.trim() === '') return;
        
        const quoteAuthor = prompt('Enter the author name (or leave blank):');
        
        const newQuote = {
            text: quoteText.trim(),
            author: quoteAuthor && quoteAuthor.trim() !== '' ? quoteAuthor.trim() : 'Anonymous'
        };
        
        quotesArray.push(newQuote);
        saveQuotes(quotesArray);
        
        // Show the new quote
        currentQuoteIndex = quotesArray.length - 1;
        displayCurrentQuote();
        
        // Restart cycling
        startQuoteCycling();
    }
    
    // ====================================
    // XP SYSTEM LOGIC
    // ====================================
    
    function initXPSystem() {
        userXP = loadUserXP();
        updateXPDisplay();
    }
    
    function calculateXPForNextLevel(level) {
        // Exponential growth (Lee Sheldon method): XP needed = level^1.5 * 120
        return Math.floor(Math.pow(level, 1.5) * 120);
    }
    
    function awardXP(hoursWorked) {
        const currentHour = Math.floor(hoursWorked);
        
        // Calculate and update streak
        calculateStreak();
        
        // Reset daily tracking if it's a new day
        const today = new Date().toDateString();
        const lastDay = localStorage.getItem('xpLastDay');
        
        if (lastDay !== today) {
            userXP.lastHourTracked = -1;
            userXP.todayHours = 0;
            userXP.milestonesReached = [];
            localStorage.setItem('xpLastDay', today);
        }
        
        // Award XP for each completed hour (15 XP per hour)
        if (currentHour > userXP.lastHourTracked) {
            const hoursToAward = currentHour - userXP.lastHourTracked;
            const xpGained = hoursToAward * XP_PER_HOUR;
            
            userXP.currentXP += xpGained;
            userXP.totalXP += xpGained;
            userXP.lastHourTracked = currentHour;
            userXP.todayHours += hoursToAward;
            
            // Show hourly XP notification
            if (hoursToAward > 0) {
                showXPNotification(`+${xpGained} XP for ${hoursToAward} hour(s)!`, 'hourly');
            }
            
            // Check for milestone bonuses
            checkMilestones(currentHour);
            
            // Award streak bonus (daily)
            if (userXP.consecutiveDays > 1 && lastDay !== today) {
                const streakBonus = STREAK_BONUS * userXP.consecutiveDays;
                userXP.currentXP += streakBonus;
                userXP.totalXP += streakBonus;
                showXPNotification(`🔥 ${userXP.consecutiveDays}-Day Streak! +${streakBonus} Bonus XP!`, 'streak');
            }
            
            // Check for level up
            checkLevelUp();
            
            // Check for achievements
            checkAchievements();
            
            saveUserXP(userXP);
            updateXPDisplay();
        }
    }
    
    function calculateStreak() {
        const today = new Date().toDateString();
        
        if (!userXP.lastAttendanceDate) {
            // First time
            userXP.consecutiveDays = 1;
            userXP.lastAttendanceDate = today;
            return;
        }
        
        const lastDate = new Date(userXP.lastAttendanceDate);
        const currentDate = new Date(today);
        const diffTime = currentDate - lastDate;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) {
            // Consecutive day
            userXP.consecutiveDays++;
            if (userXP.consecutiveDays > userXP.longestStreak) {
                userXP.longestStreak = userXP.consecutiveDays;
            }
        } else if (diffDays > 1) {
            // Streak broken
            userXP.consecutiveDays = 1;
        }
        // diffDays === 0 means same day, no change needed
        
        userXP.lastAttendanceDate = today;
    }
    
    function checkMilestones(currentHour) {
        // Check if this milestone hasn't been reached today
        if (MILESTONE_BONUSES[currentHour] && !userXP.milestonesReached.includes(currentHour)) {
            const milestone = MILESTONE_BONUSES[currentHour];
            userXP.currentXP += milestone.xp;
            userXP.totalXP += milestone.xp;
            userXP.milestonesReached.push(currentHour);
            showXPNotification(`🎯 ${milestone.label}! +${milestone.xp} Bonus XP!`, 'milestone');
        }
    }
    
    function checkAchievements() {
        const totalHours = Math.floor(userXP.totalXP / XP_PER_HOUR);
        
        // First Day achievement
        if (!userXP.achievements.includes('firstDay') && userXP.todayHours >= 8) {
            unlockAchievement('firstDay');
        }
        
        // Week Warrior (5 consecutive days)
        if (!userXP.achievements.includes('week1') && userXP.consecutiveDays >= 5) {
            unlockAchievement('week1');
        }
        
        // 7-Day Streak
        if (!userXP.achievements.includes('streak7') && userXP.consecutiveDays >= 7) {
            unlockAchievement('streak7');
        }
        
        // 30-Day Streak
        if (!userXP.achievements.includes('streak30') && userXP.consecutiveDays >= 30) {
            unlockAchievement('streak30');
        }
        
        // Level 10
        if (!userXP.achievements.includes('level10') && userXP.level >= 10) {
            unlockAchievement('level10');
        }
        
        // Level 25
        if (!userXP.achievements.includes('level25') && userXP.level >= 25) {
            unlockAchievement('level25');
        }
        
        // Workaholic (100 hours)
        if (!userXP.achievements.includes('workaholic') && totalHours >= 100) {
            unlockAchievement('workaholic');
        }
    }
    
    function unlockAchievement(achievementKey) {
        userXP.achievements.push(achievementKey);
        const achievement = ACHIEVEMENTS[achievementKey];
        showXPNotification(`${achievement.icon} Achievement Unlocked: ${achievement.name}!`, 'achievement');
        saveUserXP(userXP);
    }
    
    function checkLevelUp() {
        const xpNeeded = calculateXPForNextLevel(userXP.level);
        
        while (userXP.currentXP >= xpNeeded) {
            userXP.currentXP -= xpNeeded;
            userXP.level++;
            
            showXPNotification(`🎊 Level Up! You're now Level ${userXP.level}!`, 'levelup');
            
            // Recalculate for next level
            const nextXPNeeded = calculateXPForNextLevel(userXP.level);
        }
    }
    
    function updateXPDisplay() {
        const levelElement = document.getElementById('xp-level');
        const currentXPElement = document.getElementById('xp-current');
        const neededXPElement = document.getElementById('xp-needed');
        const progressBar = document.getElementById('xp-progress-fill');
        const totalXPElement = document.getElementById('xp-total');
        const todayHoursElement = document.getElementById('xp-today-hours');
        const streakElement = document.getElementById('xp-streak');
        const longestStreakElement = document.getElementById('xp-longest-streak');
        const achievementsContainer = document.getElementById('xp-achievements');
        const nextMilestoneElement = document.getElementById('xp-next-milestone');
        
        const xpNeeded = calculateXPForNextLevel(userXP.level);
        const progress = (userXP.currentXP / xpNeeded) * 100;
        
        if (levelElement) levelElement.textContent = userXP.level;
        if (currentXPElement) currentXPElement.textContent = userXP.currentXP;
        if (neededXPElement) neededXPElement.textContent = xpNeeded;
        if (progressBar) progressBar.style.width = `${progress}%`;
        if (totalXPElement) totalXPElement.textContent = userXP.totalXP;
        if (todayHoursElement) todayHoursElement.textContent = userXP.todayHours;
        if (streakElement) streakElement.textContent = userXP.consecutiveDays;
        if (longestStreakElement) longestStreakElement.textContent = userXP.longestStreak;
        
        // Update achievements display
        if (achievementsContainer) {
            achievementsContainer.innerHTML = '';
            userXP.achievements.forEach(key => {
                const achievement = ACHIEVEMENTS[key];
                const badge = document.createElement('span');
                badge.className = 'achievement-badge';
                badge.innerHTML = achievement.icon;
                badge.title = `${achievement.name}: ${achievement.desc}`;
                achievementsContainer.appendChild(badge);
            });
        }
        
        // Show next milestone
        if (nextMilestoneElement) {
            const nextHour = Math.ceil((userXP.lastHourTracked + 1));
            const milestoneHours = [2, 4, 6, 8];
            const nextMilestone = milestoneHours.find(h => h > userXP.todayHours);
            
            if (nextMilestone) {
                const hoursRemaining = nextMilestone - userXP.todayHours;
                nextMilestoneElement.textContent = `${hoursRemaining}h to ${MILESTONE_BONUSES[nextMilestone].label}`;
                nextMilestoneElement.style.display = 'block';
            } else {
                nextMilestoneElement.style.display = 'none';
            }
        }
    }
    
    function showXPNotification(message, type = 'hourly') {
        const notification = document.createElement('div');
        notification.className = `xp-milestone-notification xp-notif-${type}`;
        notification.textContent = message;
        
        // Position stacked notifications
        const existingNotifications = document.querySelectorAll('.xp-milestone-notification');
        const offset = existingNotifications.length * 70;
        notification.style.top = `${20 + offset}px`;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
    
    // ====================================
    // IMAGE BOX LOGIC
    // ====================================
    
    function initImageBox() {
        currentImageURL = loadImageURL();
        updateImageDisplay();
    }
    
    function changeImage() {
        const newURL = prompt('Enter image URL from Google Images:', currentImageURL);
        
        if (newURL !== null && newURL.trim() !== '') {
            currentImageURL = newURL.trim();
            saveImageURL(currentImageURL);
            updateImageDisplay();
        }
    }
    
    function updateImageDisplay() {
        const imageDisplay = document.getElementById('image-display');
        if (!imageDisplay) return;
        
        if (currentImageURL && currentImageURL !== '') {
            imageDisplay.innerHTML = `<img src="${currentImageURL}" alt="Custom Image" onerror="this.parentElement.innerHTML='<div class=\\'image-placeholder\\'>❌ Failed to load image</div>'">`;
        } else {
            imageDisplay.innerHTML = '<div class="image-placeholder">📷 Click "Change Image" to add your favorite image</div>';
        }
    }
    
    // Cache for preventing unnecessary updates
    let cachedValues = {
        totalWorked: '',
        remaining: '',
        completion: '',
        emoji: '',
        progress: -1
    };
    
    // Cache DOM elements to avoid repeated queries (prevents animation resets)
    let cachedElements = {
        totalWorkedTime: null,
        remainingTime: null,
        completionTime: null,
        emojiDisplay: null,
        progressFill: null,
        currentWorkedTime: null
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
                max-width: 1600px;
                position: relative;
                overflow: hidden;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1), background 0.5s ease, color 0.5s ease, border-color 0.5s ease;
                transform-style: preserve-3d;
                display: flex;
                gap: 24px;
                align-items: flex-start;
                /* Performance optimizations to prevent animation resets */
                will-change: transform;
                isolation: isolate;
            }
            
            /* Left Panel - Snake Game & Quotes */
            .left-panel {
                width: 400px;
                display: flex;
                flex-direction: column;
                gap: 20px;
                flex-shrink: 0;
            }
            
            /* Center Panel - Main Attendance Content */
            .main-attendance-content {
                flex: 1;
                min-width: 0;
                display: flex;
                flex-direction: column;
            }
            
            /* Right Panel - XP System & Image Box */
            .right-panel {
                width: 400px;
                display: flex;
                flex-direction: column;
                gap: 20px;
                flex-shrink: 0;
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
                /* Force GPU layer for smooth animation */
                will-change: transform, filter;
                transform: translateZ(0);
                backface-visibility: hidden;
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
                /* Isolate content updates from affecting this element's animations */
                contain: layout style;
                will-change: transform;
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
                /* Isolate text updates to prevent animation resets */
                contain: layout style paint;
                display: block;
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
            
            /* Developer Info & Settings - Header Menu */
            .developer-info {
                position: absolute;
                top: 16px;
                left: 50%;
                transform: translateX(20px);
                background: rgba(255, 255, 255, 0.08);
                backdrop-filter: blur(12px);
                border: 1px solid rgba(255, 255, 255, 0.15);
                border-radius: 10px;
                padding: 10px 14px;
                cursor: pointer;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                z-index: 100;
                font-size: 1.1rem;
                color: #667eea;
                text-decoration: none;
            }
            
            .developer-info:hover {
                transform: translateX(20px) scale(1.08);
                background: rgba(255, 255, 255, 0.12);
                border-color: rgba(255, 255, 255, 0.25);
                box-shadow: 0 4px 12px rgba(102, 126, 234, 0.2);
            }
            
            /* Settings Button */
            .settings-button {
                position: absolute;
                top: 16px;
                left: 50%;
                transform: translateX(-56px);
                background: rgba(255, 255, 255, 0.08);
                backdrop-filter: blur(12px);
                border: 1px solid rgba(255, 255, 255, 0.15);
                border-radius: 10px;
                padding: 10px 14px;
                cursor: pointer;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                z-index: 100;
                font-size: 1.1rem;
                color: #764ba2;
            }
            
            .settings-button:hover {
                transform: translateX(-56px) scale(1.08) rotate(90deg);
                background: rgba(255, 255, 255, 0.12);
                border-color: rgba(255, 255, 255, 0.25);
                box-shadow: 0 4px 12px rgba(118, 75, 162, 0.2);
            }
            
            .developer-tooltip {
                position: absolute;
                top: calc(100% + 8px);
                left: 50%;
                transform: translateX(-50%) translateY(-10px);
                background: rgba(0, 0, 0, 0.92);
                color: white;
                padding: 10px 14px;
                border-radius: 8px;
                font-size: 0.75rem;
                font-weight: 500;
                white-space: nowrap;
                opacity: 0;
                visibility: hidden;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                min-width: 180px;
                text-align: center;
                z-index: 101;
                backdrop-filter: blur(8px);
            }
            
            .developer-info:hover .developer-tooltip {
                opacity: 1;
                visibility: visible;
                transform: translateX(-50%) translateY(0);
            }
            
            .developer-tooltip::before {
                content: '';
                position: absolute;
                bottom: 100%;
                left: 50%;
                transform: translateX(-50%);
                border: 5px solid transparent;
                border-bottom-color: rgba(0, 0, 0, 0.92);
            }
            
            /* Picture-in-Picture Button Styles - Material Design 3 FAB */
            .pip-button {
                position: fixed;
                bottom: 24px;
                left: 50%;
                transform: translateX(-50%);
                background: linear-gradient(135deg, #667eea, #764ba2);
                color: white;
                border: none;
                border-radius: 16px;
                padding: 14px 24px;
                cursor: pointer;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                z-index: 1000;
                font-size: 0.875rem;
                font-weight: 600;
                display: none; /* Hidden by default, shown when PiP is supported */
                box-shadow: 0 8px 16px rgba(0, 0, 0, 0.24), 0 4px 8px rgba(0, 0, 0, 0.12);
                backdrop-filter: blur(12px);
                border: 1px solid rgba(255, 255, 255, 0.2);
                letter-spacing: 0.5px;
            }
            
            .pip-button:hover {
                transform: translateX(-50%) scale(1.05) translateY(-4px);
                box-shadow: 0 12px 24px rgba(102, 126, 234, 0.4), 0 6px 12px rgba(0, 0, 0, 0.2);
                background: linear-gradient(135deg, #764ba2, #667eea);
            }
            
            .pip-button:active {
                transform: translateX(-50%) scale(0.98);
            }
            
            .pip-button.active {
                background: linear-gradient(135deg, #e17055, #fab1a0);
                box-shadow: 0 12px 24px rgba(225, 112, 85, 0.4), 0 6px 12px rgba(0, 0, 0, 0.2);
            }
            
            .pip-button.active:hover {
                transform: translateX(-50%) scale(1.05) translateY(-4px);
                background: linear-gradient(135deg, #fab1a0, #e17055);
            }
            
            .pip-icon {
                display: inline-block;
                margin-right: 6px;
                font-size: 1rem;
                transition: transform 0.3s ease;
            }
            
            .pip-button:hover .pip-icon {
                transform: scale(1.1);
            }
            
            /* Focus state for accessibility */
            .pip-button:focus {
                outline: 2px solid rgba(102, 126, 234, 0.6);
                outline-offset: 2px;
            }
            
            .settings-button:focus,
            .developer-info:focus {
                outline: 2px solid rgba(118, 75, 162, 0.6);
                outline-offset: 2px;
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
                /* Isolate progress updates from parent style recalculation */
                contain: layout style;
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
                /* Force GPU compositing for smooth width transitions */
                will-change: width;
                transform: translateZ(0);
                backface-visibility: hidden;
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
            
            .settings-option.disabled {
                opacity: 0.4;
                pointer-events: none;
                cursor: not-allowed;
            }
            
            .settings-option.disabled:hover {
                transform: none;
                background: rgba(255, 255, 255, 0.05);
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
            
            .toggle-switch.disabled {
                opacity: 0.5;
                cursor: not-allowed;
                background: rgba(255, 255, 255, 0.1) !important;
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
                    bottom: 16px;
                    padding: 12px 20px;
                    font-size: 0.8rem;
                    border-radius: 14px;
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
            
            /* ==================== SNAKE GAME STYLES ==================== */
            .snake-game-container {
                background: rgba(255, 255, 255, 0.08);
                border: 1px solid rgba(255, 255, 255, 0.15);
                border-radius: 16px;
                padding: 16px;
                position: relative;
                overflow: hidden;
            }
            
            .snake-game-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 12px;
            }
            
            .snake-game-title {
                font-size: 1rem;
                font-weight: 600;
                color: rgba(255, 255, 255, 0.9);
            }
            
            .snake-score {
                font-size: 0.875rem;
                color: rgba(255, 255, 255, 0.7);
            }
            
            .snake-canvas {
                width: 100%;
                background: rgba(0, 0, 0, 0.3);
                border-radius: 12px;
                display: block;
                image-rendering: pixelated;
                box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.3);
            }
            
            .snake-controls {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-top: 12px;
                gap: 8px;
            }
            
            .snake-btn {
                padding: 8px 16px;
                background: linear-gradient(135deg, var(--aurora-1), var(--aurora-2));
                border: none;
                border-radius: 8px;
                color: white;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
                font-size: 0.875rem;
            }
            
            .snake-btn:hover {
                transform: scale(1.05);
                box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
            }
            
            .snake-highscore {
                font-size: 0.75rem;
                color: rgba(255, 255, 255, 0.6);
            }
            
            .snake-game-over {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(0, 0, 0, 0.9);
                padding: 24px;
                border-radius: 12px;
                text-align: center;
                display: none;
                z-index: 10;
            }
            
            .snake-game-over.active {
                display: block;
            }
            
            .snake-game-over h3 {
                color: #e17055;
                margin: 0 0 12px 0;
                font-size: 1.5rem;
            }
            
            .snake-game-over p {
                color: rgba(255, 255, 255, 0.8);
                margin: 8px 0;
            }
            
            /* ==================== QUOTES BOX STYLES ==================== */
            .quotes-container {
                background: rgba(255, 255, 255, 0.08);
                border: 1px solid rgba(255, 255, 255, 0.15);
                border-radius: 16px;
                padding: 20px;
                min-height: 180px;
                position: relative;
                overflow: hidden;
                /* Isolate quote animations from parent updates */
                contain: layout style;
            }
            
            .quotes-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 16px;
            }
            
            .quotes-title {
                font-size: 1rem;
                font-weight: 600;
                color: rgba(255, 255, 255, 0.9);
            }
            
            .quote-add-btn {
                padding: 6px 12px;
                background: rgba(255, 255, 255, 0.1);
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 6px;
                color: white;
                font-size: 0.8rem;
                cursor: pointer;
                transition: all 0.3s ease;
            }
            
            .quote-add-btn:hover {
                background: rgba(255, 255, 255, 0.2);
            }
            
            .quote-display {
                text-align: center;
                padding: 20px 10px;
                min-height: 100px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .quote-text {
                font-size: 1rem;
                font-style: italic;
                color: rgba(255, 255, 255, 0.9);
                line-height: 1.6;
                opacity: 1;
                transition: opacity 0.3s ease, transform 0.3s ease;
                transform: translateY(0);
                /* Prevent animation resets from parent updates */
                contain: layout style paint;
            }
            
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
            }
            
            @keyframes fadeOut {
                from { opacity: 1; transform: translateY(0); }
                to { opacity: 0; transform: translateY(-10px); }
            }
            
            .quote-text.fade-out {
                opacity: 0;
                transform: translateY(-10px);
            }
            
            .quote-author {
                font-size: 0.875rem;
                color: rgba(255, 255, 255, 0.6);
                margin-top: 12px;
                text-align: right;
                transition: opacity 0.3s ease;
                /* Prevent animation resets from parent updates */
                contain: layout style paint;
            }
            
            /* ==================== XP SYSTEM STYLES ==================== */
            .xp-container {
                background: linear-gradient(135deg, rgba(108, 92, 231, 0.2), rgba(102, 126, 234, 0.15));
                border: 1px solid rgba(108, 92, 231, 0.3);
                border-radius: 16px;
                padding: 20px;
                position: relative;
                overflow: hidden;
            }
            
            .xp-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 16px;
            }
            
            .xp-title {
                font-size: 1rem;
                font-weight: 600;
                color: rgba(255, 255, 255, 0.9);
            }
            
            .xp-level {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            .level-badge {
                background: linear-gradient(135deg, #6c5ce7, #a29bfe);
                padding: 6px 12px;
                border-radius: 20px;
                font-weight: 700;
                font-size: 0.875rem;
                box-shadow: 0 2px 8px rgba(108, 92, 231, 0.4);
            }
            
            .xp-progress-container {
                margin-bottom: 12px;
            }
            
            .xp-progress-bar {
                width: 100%;
                height: 20px;
                background: rgba(0, 0, 0, 0.3);
                border-radius: 10px;
                overflow: hidden;
                position: relative;
            }
            
            .xp-progress-fill {
                height: 100%;
                background: linear-gradient(90deg, #6c5ce7, #a29bfe, #6c5ce7);
                background-size: 200% 100%;
                animation: gradientFlow 3s ease infinite;
                transition: width 0.5s ease;
                box-shadow: 0 0 10px rgba(108, 92, 231, 0.5);
            }
            
            .xp-info {
                display: flex;
                justify-content: space-between;
                font-size: 0.75rem;
                color: rgba(255, 255, 255, 0.7);
                margin-top: 8px;
            }
            
            .xp-stats {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 12px;
                margin-top: 12px;
            }
            
            .xp-stat-item {
                background: rgba(255, 255, 255, 0.05);
                padding: 12px;
                border-radius: 8px;
                text-align: center;
            }
            
            .xp-stat-label {
                font-size: 0.75rem;
                color: rgba(255, 255, 255, 0.6);
                margin-bottom: 4px;
            }
            
            .xp-stat-value {
                font-size: 1.25rem;
                font-weight: 700;
                color: #a29bfe;
            }
            
            .xp-streak {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 6px;
                margin-top: 12px;
                padding: 8px;
                background: rgba(255, 107, 53, 0.15);
                border: 1px solid rgba(255, 107, 53, 0.3);
                border-radius: 8px;
                font-weight: 600;
                font-size: 0.875rem;
            }
            
            .xp-streak-icon {
                font-size: 1.2rem;
                animation: fireFlicker 1.5s ease-in-out infinite;
            }
            
            @keyframes fireFlicker {
                0%, 100% { transform: scale(1); opacity: 1; }
                50% { transform: scale(1.1); opacity: 0.9; }
            }
            
            .xp-achievements {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                margin-top: 12px;
                padding: 12px;
                background: rgba(0, 0, 0, 0.2);
                border-radius: 8px;
                min-height: 50px;
                align-items: center;
                justify-content: center;
            }
            
            .xp-achievements:empty::before {
                content: 'Complete tasks to unlock achievements! 🏆';
                color: rgba(255, 255, 255, 0.4);
                font-size: 0.75rem;
                font-style: italic;
            }
            
            .achievement-badge {
                font-size: 1.8rem;
                cursor: pointer;
                transition: transform 0.3s ease;
                filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
            }
            
            .achievement-badge:hover {
                transform: scale(1.2);
            }
            
            .xp-next-milestone {
                margin-top: 8px;
                padding: 6px 12px;
                background: rgba(255, 193, 7, 0.15);
                border: 1px solid rgba(255, 193, 7, 0.3);
                border-radius: 6px;
                text-align: center;
                font-size: 0.75rem;
                color: rgba(255, 193, 7, 0.9);
                font-weight: 600;
            }
            
            .xp-milestone-notification {
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 16px 24px;
                border-radius: 12px;
                color: white;
                font-weight: 600;
                box-shadow: 0 8px 24px rgba(108, 92, 231, 0.5);
                z-index: 10000;
                animation: slideInRight 0.5s ease, fadeOut 0.5s ease 2.5s forwards;
                pointer-events: none;
            }
            
            .xp-notif-hourly {
                background: linear-gradient(135deg, #667eea, #764ba2);
            }
            
            .xp-notif-milestone {
                background: linear-gradient(135deg, #f093fb, #f5576c);
                box-shadow: 0 8px 24px rgba(245, 87, 108, 0.5);
            }
            
            .xp-notif-streak {
                background: linear-gradient(135deg, #ff6b35, #f7931e);
                box-shadow: 0 8px 24px rgba(255, 107, 53, 0.5);
            }
            
            .xp-notif-levelup {
                background: linear-gradient(135deg, #00b894, #00cec9);
                box-shadow: 0 8px 24px rgba(0, 184, 148, 0.5);
                font-size: 1.1rem;
            }
            
            .xp-notif-achievement {
                background: linear-gradient(135deg, #fdcb6e, #e17055);
                box-shadow: 0 8px 24px rgba(253, 203, 110, 0.5);
                font-size: 1.05rem;
            }
            
            @keyframes slideInRight {
                from { transform: translateX(400px); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            
            /* ==================== IMAGE BOX STYLES ==================== */
            .image-box-container {
                background: rgba(255, 255, 255, 0.08);
                border: 1px solid rgba(255, 255, 255, 0.15);
                border-radius: 16px;
                padding: 16px;
                position: relative;
                overflow: hidden;
            }
            
            .image-box-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 12px;
            }
            
            .image-box-title {
                font-size: 1rem;
                font-weight: 600;
                color: rgba(255, 255, 255, 0.9);
            }
            
            .image-change-btn {
                padding: 6px 12px;
                background: rgba(255, 255, 255, 0.1);
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 6px;
                color: white;
                font-size: 0.8rem;
                cursor: pointer;
                transition: all 0.3s ease;
            }
            
            .image-change-btn:hover {
                background: rgba(255, 255, 255, 0.2);
            }
            
            .image-display {
                width: 100%;
                height: 220px;
                border-radius: 12px;
                overflow: hidden;
                background: rgba(0, 0, 0, 0.2);
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .image-display img {
                width: 100%;
                height: 100%;
                object-fit: cover;
                transition: transform 0.3s ease;
            }
            
            .image-display img:hover {
                transform: scale(1.05);
            }
            
            .image-placeholder {
                color: rgba(255, 255, 255, 0.4);
                font-size: 0.875rem;
                text-align: center;
            }
            
            /* Responsive adjustments */
            @media (max-width: 1400px) {
                .attendance-summary {
                    flex-wrap: wrap;
                    justify-content: center;
                }
                
                .left-panel,
                .right-panel {
                    width: 350px;
                }
            }
            
            @media (max-width: 1200px) {
                .attendance-summary {
                    flex-direction: column;
                    max-width: 800px;
                    align-items: stretch;
                }
                
                .left-panel,
                .right-panel {
                    width: 100%;
                }
                
                .main-attendance-content {
                    order: -1; /* Show main content first on mobile */
                }
            }
            
            @media (max-width: 768px) {
                .attendance-summary {
                    padding: 20px;
                    margin: 16px auto;
                }
                
                .left-panel,
                .right-panel {
                    gap: 16px;
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
        
        const isGlassmorphic = userPreferences.displayTheme === 'glassmorphic';
        
        modal.innerHTML = `
            <div class="settings-title">⚙️ Customize Your Experience</div>
            
            <div class="settings-option ${!isGlassmorphic ? 'disabled' : ''}" data-theme-dependent="glassmorphic">
                <span class="settings-option-label">🎨 Neumorphic Depth <small style="opacity: 0.6; font-size: 0.75rem;">(Glassmorphic only)</small></span>
                <div class="toggle-switch ${userPreferences.neumorphicDepth ? 'active' : ''} ${!isGlassmorphic ? 'disabled' : ''}" data-pref="neumorphicDepth"></div>
            </div>
            
            <div class="settings-option ${!isGlassmorphic ? 'disabled' : ''}" data-theme-dependent="glassmorphic">
                <span class="settings-option-label">🌊 Fluid Gradients <small style="opacity: 0.6; font-size: 0.75rem;">(Glassmorphic only)</small></span>
                <div class="toggle-switch ${userPreferences.fluidGradients ? 'active' : ''} ${!isGlassmorphic ? 'disabled' : ''}" data-pref="fluidGradients"></div>
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
                <select class="settings-select" data-pref="displayTheme" id="theme-selector">
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
                // Don't toggle if disabled
                if (this.classList.contains('disabled')) {
                    return;
                }
                
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
                
                // If theme changed, update dependent options visibility
                if (pref === 'displayTheme') {
                    updateThemeDependentOptions(modal, this.value);
                }
            });
        });
        
        // Function to update theme-dependent options
        function updateThemeDependentOptions(modal, theme) {
            const isGlassmorphic = theme === 'glassmorphic';
            const dependentOptions = modal.querySelectorAll('[data-theme-dependent="glassmorphic"]');
            
            dependentOptions.forEach(option => {
                const toggle = option.querySelector('.toggle-switch');
                if (isGlassmorphic) {
                    option.classList.remove('disabled');
                    if (toggle) toggle.classList.remove('disabled');
                } else {
                    option.classList.add('disabled');
                    if (toggle) toggle.classList.add('disabled');
                }
            });
        }
        
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

            // Only re-render when structure actually changes (initial load or new check-in/out entries)
            // Don't re-render based on time - this prevents animation resets!
            const currentRowCount = totalTimeDiv.querySelectorAll('.modern-table tbody tr:not(.gap-warning)').length;
            const shouldRerender = totalTimeDiv.innerHTML === '' || 
                                 checkInOutList.length !== currentRowCount;
            
            if (shouldRerender) {
                renderFullContent(totalTimeDiv, totalWorkedTime, checkInOutList, today);
                
                // Clear cached DOM elements after re-render so they get re-queried
                cachedElements = {
                    totalWorkedTime: null,
                    remainingTime: null,
                    completionTime: null,
                    emojiDisplay: null,
                    progressFill: null,
                    currentWorkedTime: null
                };
            } else {
                // Just update dynamic content without re-rendering to preserve animations
                updateDynamicContent(totalWorkedTime, today, checkInOutList);
            }
            
            // Always update lastTotalWorkedTime to track state
            lastTotalWorkedTime = totalWorkedTime;
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
                // Clone only the main attendance content (center panel), not the side panels
                const mainContent = attendanceSummary.querySelector('.main-attendance-content');
                if (!mainContent) {
                    console.error('Main attendance content not found');
                    isPipActive = false;
                    return;
                }
                
                // Create a wrapper for PiP
                const summaryClone = document.createElement('div');
                summaryClone.className = 'attendance-summary pip-window-content';
                
                // Clone only the main attendance content
                const mainContentClone = mainContent.cloneNode(true);
                summaryClone.appendChild(mainContentClone);
                
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
            
            // Add ID to the last row's worked time cell if it's the current active session
            const isLastRow = index === checkInOutList.length - 1;
            const isCurrentSession = item.checkOut === 'Current';
            const workedTimeCellId = (isLastRow && isCurrentSession) ? ' id="current-worked-time"' : '';
            
            tableHTML += `
                <tr>
                    <td>${index + 1}</td>
                    <td>${item.checkIn}</td>
                    <td>${item.checkOut}</td>
                    <td${workedTimeCellId}>${item.workedTime}</td>
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

        // Left panel - Snake Game & Quotes
        const leftPanelHTML = `
            <div class="left-panel">
                <!-- Snake Game -->
                <div class="snake-game-container">
                    <div class="snake-game-header">
                        <span class="snake-game-title">🐍 Snake Game</span>
                        <span class="snake-score">Score: <span id="snake-current-score">0</span></span>
                    </div>
                    <canvas id="snake-canvas" class="snake-canvas" width="368" height="368"></canvas>
                    <div class="snake-controls">
                        <button id="snake-play-btn" class="snake-btn" onclick="window.snakePlayPause()">▶ Play</button>
                        <button class="snake-btn" onclick="window.resetSnake()">🔄 Reset</button>
                        <span id="snake-high-score" class="snake-highscore">High: 0</span>
                    </div>
                    <div id="snake-game-over" class="snake-game-over">
                        <h3>Game Over!</h3>
                        <p>Final Score: <span class="final-score">0</span></p>
                        <p>Auto restarting...</p>
                    </div>
                </div>
                
                <!-- Quotes Box -->
                <div class="quotes-container">
                    <div class="quotes-header">
                        <span class="quotes-title">💭 Daily Motivation</span>
                        <button class="quote-add-btn" onclick="window.addQuote()">+ Add Quote</button>
                    </div>
                    <div class="quote-display">
                        <div>
                            <div id="quote-text" class="quote-text"></div>
                            <div id="quote-author" class="quote-author"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Center panel - Main attendance content
        const mainContentHTML = `
            <div class="main-attendance-content">
                ${headerHTML}
                ${progressBarHTML}
                ${tableHTML}
                ${timeStatsHTML}
                ${completionHTML}
            </div>
        `;
        
        // Right panel - XP System & Image Box
        const rightPanelHTML = `
            <div class="right-panel">
                <!-- XP System -->
                <div class="xp-container">
                    <div class="xp-header">
                        <span class="xp-title">⭐ Work Rewards</span>
                        <div class="xp-level">
                            <span class="level-badge">Level <span id="xp-level">1</span></span>
                        </div>
                    </div>
                    <div class="xp-progress-container">
                        <div class="xp-progress-bar">
                            <div id="xp-progress-fill" class="xp-progress-fill" style="width: 0%"></div>
                        </div>
                        <div class="xp-info">
                            <span><span id="xp-current">0</span> XP</span>
                            <span><span id="xp-needed">120</span> XP to next level</span>
                        </div>
                        <div id="xp-next-milestone" class="xp-next-milestone" style="display: none;">
                            Next milestone in Xh
                        </div>
                    </div>
                    <div class="xp-streak">
                        <span class="xp-streak-icon">🔥</span>
                        <span><span id="xp-streak">0</span>-Day Streak</span>
                        <span style="opacity: 0.6; font-size: 0.75rem;">(Best: <span id="xp-longest-streak">0</span>)</span>
                    </div>
                    <div class="xp-stats">
                        <div class="xp-stat-item">
                            <div class="xp-stat-label">Total XP</div>
                            <div id="xp-total" class="xp-stat-value">0</div>
                        </div>
                        <div class="xp-stat-item">
                            <div class="xp-stat-label">Today's Hours</div>
                            <div id="xp-today-hours" class="xp-stat-value">0</div>
                        </div>
                    </div>
                    <div id="xp-achievements" class="xp-achievements">
                        <!-- Achievement badges will be dynamically inserted here -->
                    </div>
                </div>
                
                <!-- Image Box -->
                <div class="image-box-container">
                    <div class="image-box-header">
                        <span class="image-box-title">🖼️ Your Space</span>
                        <button class="image-change-btn" onclick="window.changeImageBox()">Change Image</button>
                    </div>
                    <div id="image-display" class="image-display">
                        <div class="image-placeholder">📷 Click "Change Image" to add your favorite image</div>
                    </div>
                </div>
            </div>
        `;

        // Combine all three panels in proper order: Left - Center - Right
        totalTimeDiv.innerHTML = leftPanelHTML + mainContentHTML + rightPanelHTML;
        
        // Add developer info inside the card
        addDeveloperInfo(totalTimeDiv);
        
        // Add settings button
        addSettingsButton(totalTimeDiv);
        
        // Add PiP button if supported
        createPipButton(totalTimeDiv);
        
        // Add parallax effect
        addParallaxEffect(totalTimeDiv);
        
        // Initialize all new features after DOM is ready (only once)
        if (!featuresInitialized) {
            setTimeout(() => {
                initSnakeGame();
                initQuotesSystem();
                initXPSystem();
                initImageBox();
                
                // Award XP based on hours worked
                const hoursWorked = totalWorkedTime / 3600;
                awardXP(hoursWorked);
                
                featuresInitialized = true;
            }, 100);
        } else {
            // Features already initialized, just update XP
            const hoursWorked = totalWorkedTime / 3600;
            awardXP(hoursWorked);
        }
        
        // Expose functions to window for onclick handlers
        window.snakePlayPause = () => {
            if (!snakeGameRunning) {
                startSnakeGame();
            } else {
                pauseSnakeGame();
            }
        };
        window.resetSnake = resetSnakeGame;
        window.addQuote = addCustomQuote;
        window.changeImageBox = changeImage;
        
        // Reset cached values for new render
        cachedValues = {
            totalWorked: totalTimeFormatted,
            remaining: remainingTimeFormatted,
            completion: futureTimeFormatted,
            emoji: currentEmoji,
            progress: progress
        };
    }
    
    function updateDynamicContent(totalWorkedTime, today, checkInOutList = []) {
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
        
        // Update XP based on hours worked
        const hoursWorked = totalWorkedTime / 3600;
        awardXP(hoursWorked);
        
        // Get or cache DOM elements (do this ONCE to avoid repeated queries)
        if (!cachedElements.totalWorkedTime) {
            cachedElements.totalWorkedTime = document.getElementById('total-worked-time');
            cachedElements.remainingTime = document.getElementById('remaining-time');
            cachedElements.completionTime = document.getElementById('completion-time');
            cachedElements.emojiDisplay = document.querySelector('.emoji-display');
            cachedElements.progressFill = document.querySelector('.progress-fill');
        }
        
        // Update "Current" row in the table if it exists (for active check-in)
        if (checkInOutList.length > 0) {
            const lastEntry = checkInOutList[checkInOutList.length - 1];
            if (lastEntry.checkOut === 'Current') {
                if (!cachedElements.currentWorkedTime) {
                    cachedElements.currentWorkedTime = document.getElementById('current-worked-time');
                }
                const workedTimeCell = cachedElements.currentWorkedTime;
                if (workedTimeCell && workedTimeCell.textContent !== lastEntry.workedTime) {
                    requestAnimationFrame(() => {
                        workedTimeCell.textContent = lastEntry.workedTime;
                    });
                }
            }
        }
        
        // Only update if values have actually changed
        const updates = [];
        
        if (cachedValues.totalWorked !== totalTimeFormatted) {
            const element = cachedElements.totalWorkedTime;
            if (element) {
                updates.push({
                    element: element,
                    property: 'textContent',
                    value: totalTimeFormatted
                });
            }
            cachedValues.totalWorked = totalTimeFormatted;
        }
        
        if (cachedValues.remaining !== remainingTimeFormatted) {
            const element = cachedElements.remainingTime;
            if (element) {
                updates.push({
                    element: element,
                    property: 'textContent',
                    value: remainingTimeFormatted
                });
            }
            cachedValues.remaining = remainingTimeFormatted;
        }
        
        if (cachedValues.completion !== futureTimeFormatted && futureTimeFormatted) {
            const element = cachedElements.completionTime;
            if (element) {
                updates.push({
                    element: element,
                    property: 'textContent',
                    value: futureTimeFormatted
                });
            }
            cachedValues.completion = futureTimeFormatted;
        }
        
        if (cachedValues.emoji !== currentEmoji) {
            const element = cachedElements.emojiDisplay;
            if (element) {
                updates.push({
                    element: element,
                    property: 'textContent',
                    value: currentEmoji
                });
            }
            cachedValues.emoji = currentEmoji;
        }
        
        // Only update progress if it changed by at least 0.1% to avoid constant updates
        const roundedProgress = Math.round(progress * 10) / 10;
        if (Math.abs(cachedValues.progress - roundedProgress) >= 0.1) {
            const element = cachedElements.progressFill;
            if (element) {
                updates.push({
                    element: element,
                    property: 'width',
                    value: `${roundedProgress}%`
                });
            }
            cachedValues.progress = roundedProgress;
        }
        
        // Batch all DOM writes together using RAF for smooth, non-blocking updates
        // RAF ensures updates happen during browser's repaint cycle, not during animations
        if (updates.length > 0) {
            requestAnimationFrame(() => {
                // Group all updates in single batch to minimize reflows
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
