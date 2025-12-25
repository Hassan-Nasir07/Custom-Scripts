# 🚀 WFH/WFO Tracking - Quick Start Guide

## What's New?

Your attendance checker now **automatically detects** and separates:
- 🏠 **Work From Home (WFH)** hours
- 🏢 **Work From Office (WFO)** hours

## Visual Preview

### Before (Old View)
```
╔════════════════════════════════════════╗
║  📊 Attendance Summary                 ║
╠════════════════════════════════════════╣
║  Total Worked: 08:00:00               ║
║  Remaining: 00:00:00                  ║
║  Complete At: 6:00:00 PM              ║
╚════════════════════════════════════════╝
```

### After (New WFH/WFO View)
```
╔══════════════════════════════════════════════════════════╗
║  📊 Attendance Summary                                   ║
╠══════════════════════════════════════════════════════════╣
║  Total Worked: 08:00:00                                 ║
║  🏠 Work From Home: 04:00:00                            ║
║  🏢 Work From Office: 04:00:00                          ║
║  Remaining: 00:00:00                                    ║
║  Complete At: 6:00:00 PM                                ║
╚══════════════════════════════════════════════════════════╝
```

## How It Works

### 1. Detection Logic
The script looks for rows with `class="set-purple"` in your attendance table.

**Example from your data:**
```html
<!-- WFH Session (purple row) -->
<tr class="set-purple">
  <td>14</td>
  <td>12/03/2025</td>
  <td>19:42:37</td>
  <td>In</td>
</tr>

<!-- WFO Session (normal row) -->
<tr>
  <td>8</td>
  <td>12/03/2025</td>
  <td>11:59:39</td>
  <td>In</td>
</tr>
```

### 2. Table Badges
Each work session now shows a badge:

```
┌───┬──────────┬──────────┬────────────────────────────┬──────────┐
│ # │ Check-In │Check-Out │    Worked Time             │  Break   │
├───┼──────────┼──────────┼────────────────────────────┼──────────┤
│ 1 │ 11:59:39 │ 13:05:48 │ 01:06:09 [🏢 WFO]          │          │
│ 2 │ 13:51:12 │ 16:27:44 │ 02:36:32 [🏢 WFO]          │          │
│ 3 │ 19:42:37 │ 21:43:50 │ 02:01:13 [🏠 WFH]          │ 00:22:19 │
└───┴──────────┴──────────┴────────────────────────────┴──────────┘
```

### 3. Smart Display
- **If you have WFH hours today**: Shows 5-card detailed breakdown
- **If you DON'T have WFH hours today**: Shows simple 3-card view

## Real Example from Your Data (12/03/2025)

Looking at your attendance on **December 3, 2025**:

### WFO Sessions (Normal Rows)
1. 11:59:39 → 13:05:48 = **01:06:09** 🏢
2. 13:51:12 → 16:27:44 = **02:36:32** 🏢
3. 16:29:17 → 19:20:18 = **02:51:01** 🏢

### WFH Session (Purple Row - set-purple)
4. 19:42:37 → 21:43:50 = **02:01:13** 🏠

### Dashboard Display
```
┌─────────────────────────────────────────────────────────────┐
│  😄 Attendance Summary                                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│  │Total Worked  │ │🏠 WFH Hours  │ │🏢 WFO Hours  │       │
│  │  08:34:55    │ │  02:01:13    │ │  06:33:42    │       │
│  └──────────────┘ └──────────────┘ └──────────────┘       │
│                                                             │
│  ┌──────────────┐ ┌──────────────┐                        │
│  │ Remaining    │ │ Complete At  │                        │
│  │  00:00:00    │ │  9:43:50 PM  │                        │
│  └──────────────┘ └──────────────┘                        │
│                                                             │
│  🎉 Congratulations! You've completed your shift! 🎉       │
└─────────────────────────────────────────────────────────────┘
```

## Color Guide

| Work Type | Color | Gradient |
|-----------|-------|----------|
| Total Worked | 🟢 Green | Success theme |
| WFH Hours | 🟣 Purple | Matches `set-purple` class |
| WFO Hours | 🔵 Blue | Professional office theme |
| Remaining | 🟠 Orange | Urgency/countdown |
| Complete At | 🟣 Purple | Achievement |

## Installation (30 Seconds)

1. **Open** your attendance portal
2. **Press** F12 (Developer Tools)
3. **Click** Console tab
4. **Paste** the script from `EnhancedAttendanceTimeChecker.js`
5. **Press** Enter
6. **Done!** ✨

## What You'll See Today (12/25/2025)

Based on your current data:
- ✅ One check-in at 09:23:16
- ✅ One check-out at 14:42:24
- ✅ Another check-in at 14:46:52
- ⏰ Still ongoing...

**Current Session:**
- Started: 14:46:52
- Type: Will show badge when you check out
- Updates: Every second in real-time

## Benefits at a Glance

✅ **Automatic tracking** - No manual input needed  
✅ **Visual clarity** - Color-coded cards and badges  
✅ **Real-time updates** - See hours increment live  
✅ **Smart display** - Only shows WFH/WFO when relevant  
✅ **Beautiful UI** - Modern glassmorphism design  
✅ **Mobile friendly** - Works on all devices  
✅ **PiP support** - Float it while working  

## Frequently Asked Questions

### Q: What if I don't have any WFH hours?
**A:** The script shows the simple 3-card layout (Total, Remaining, Complete At)

### Q: Can I customize the colors?
**A:** Yes! Edit the CSS gradient values in the script

### Q: Does it work on mobile?
**A:** Yes! Fully responsive design adapts to screen size

### Q: Will my data be saved?
**A:** No, this is a visual enhancement only. Data comes from HR system

### Q: Can I use it offline?
**A:** No, it requires access to the attendance portal

## Pro Tips 💡

1. **Use Dark Mode** for best glassmorphism effects
2. **Enable PiP** to monitor hours while working
3. **Check regularly** to ensure you're on track
4. **Verify badges** match your actual work location
5. **Report issues** if WFH hours don't show purple badges

## Support

Found a bug or have suggestions?
- Check `WFH_WFO_Feature_Guide.md` for detailed documentation
- Review your HTML to ensure `set-purple` class is applied correctly
- Clear cache and reload if issues persist

---

**Happy Tracking! 🎉**

*Built with ❤️ for better work-life visibility*
