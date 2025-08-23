# Installation Guide for Enhanced Attendance Checker

## Quick Setup for Chrome Extensions

### Method 1: Using Tampermonkey (Recommended)
1. Install [Tampermonkey](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo) from Chrome Web Store
2. Click the Tampermonkey icon → "Create a new script"
3. Replace the default content with the code from `EnhancedAttendanceTimeChecker.js`
4. Add these metadata lines at the top:
```javascript
// ==UserScript==
// @name         Enhanced Attendance Time Checker 2025
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Modern attendance tracker with GenZ vibes
// @author       You
// @match        https://globalportal.mtbc.com/#/time-absence/attendence-record
// @grant        none
// ==/UserScript==
```
5. Save (Ctrl+S) and enable the script

### Method 2: Using User JavaScript and CSS
1. Install [User JavaScript and CSS](https://chrome.google.com/webstore/detail/user-javascript-and-css/nbhcbdghjpllgmfilhnhkllmkecfmpld) extension
2. Navigate to your attendance page
3. Click the extension icon → "Add JavaScript"
4. Paste the script content
5. Save and enable

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

Enjoy your enhanced attendance tracking experience! 🚀
