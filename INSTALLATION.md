# Installation Guide for Attendance Time Checker Plus

## Quick Setup for Chrome Extensions

### Method 1: Using User JavaScript and CSS (Recommended)
This method loads `AttendanceTimeCheckerPlus.js` directly from GitHub, so it always runs the latest version — no need to re-paste the script whenever it's updated.

1. Install [User JavaScript and CSS](https://chrome.google.com/webstore/detail/user-javascript-and-css/nbhcbdghjpllgmfilhnhkllmkecfmpld) extension
2. Click the extension icon → "Add new site"
3. Set the **URL pattern** to:
   ```
   https://globalportal.mtbc.com/*
   ```
4. Under the **JS** tab, paste the following loader code:
   ```javascript
   (async () => {
     const url = "https://raw.githubusercontent.com/Hassan-Nasir07/Custom-Scripts/refs/heads/main/AttendanceTimeCheckerPlus.js?v=" + Date.now()

     const res = await fetch(url);
     const code = await res.text();

     eval(code);
   })();
   ```
5. Save and enable the site entry
6. Refresh the attendance page — the script fetches and runs the latest version automatically each time

### Method 2: Using Tampermonkey
1. Install [Tampermonkey](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo) from Chrome Web Store
2. Click the Tampermonkey icon → "Create a new script"
3. Replace the default content with the code from `AttendanceTimeCheckerPlus.js`
4. Add these metadata lines at the top:
```javascript
// ==UserScript==
// @name         Attendance Time Checker Plus
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Modern attendance tracker with GenZ vibes
// @author       You
// @match        https://globalportal.mtbc.com/*
// @grant        none
// ==/UserScript==
```
5. Save (Ctrl+S) and enable the script

### Method 3: Browser Console (Temporary)
1. Open attendance page
2. Press F12 → Console tab
3. Paste the entire script
4. Press Enter
*Note: This method requires re-pasting after page refresh*

## Features You'll See

✨ **Glassmorphic design with blur effects**
😄 **Emoji that changes based on your work hours**
📊 **Modern progress bar and statistics cards**
🎨 **Smooth animations and hover effects**
📱 **Responsive design for all devices**

## Troubleshooting

- **Script not working?** Check if jQuery is loaded on the page
- **Styles not appearing?** Ensure the extension has permission to inject CSS
- **Wrong emoji?** The script calculates based on total worked time vs 8 hours
- **Method 1 not updating?** The `?v=Date.now()` cache-buster forces a fresh fetch on every page load — if it still looks stale, hard-refresh the page (Ctrl+Shift+R)

Enjoy your enhanced attendance tracking experience! 🚀
