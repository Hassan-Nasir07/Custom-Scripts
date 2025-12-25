# 🧪 WFH/WFO Feature - Testing & Validation Guide

## Test Scenarios

### Scenario 1: Full WFO Day (No set-purple)
**Input Data:**
```html
<tr>
  <td>1</td><td>12/25/2025</td><td>09:00:00</td><td>In</td>
</tr>
<tr>
  <td>2</td><td>12/25/2025</td><td>17:00:00</td><td>Out</td>
</tr>
```

**Expected Output:**
- Layout: **3-card simple view**
- Total Worked: `08:00:00`
- WFH Hours: **Not shown**
- WFO Hours: **Not shown**
- Remaining: `00:00:00`
- Complete At: `5:00:00 PM`

**Validation:**
- ✅ No WFH/WFO breakdown displayed
- ✅ Badges show "🏢 WFO" in table
- ✅ Simple layout with 3 stat cards only

---

### Scenario 2: Full WFH Day (All set-purple)
**Input Data:**
```html
<tr class="set-purple">
  <td>1</td><td>12/25/2025</td><td>09:00:00</td><td>In</td>
</tr>
<tr class="set-purple">
  <td>2</td><td>12/25/2025</td><td>17:00:00</td><td>Out</td>
</tr>
```

**Expected Output:**
- Layout: **5-card detailed view**
- Total Worked: `08:00:00`
- WFH Hours: `08:00:00` 🏠
- WFO Hours: `00:00:00` 🏢
- Remaining: `00:00:00`
- Complete At: `5:00:00 PM`

**Validation:**
- ✅ WFH/WFO breakdown displayed
- ✅ All badges show "🏠 WFH"
- ✅ WFH card shows full 8 hours
- ✅ WFO card shows 00:00:00

---

### Scenario 3: Mixed WFH/WFO Day
**Input Data:**
```html
<!-- Morning WFO -->
<tr>
  <td>1</td><td>12/25/2025</td><td>09:00:00</td><td>In</td>
</tr>
<tr>
  <td>2</td><td>12/25/2025</td><td>13:00:00</td><td>Out</td>
</tr>

<!-- Afternoon WFH -->
<tr class="set-purple">
  <td>3</td><td>12/25/2025</td><td>14:00:00</td><td>In</td>
</tr>
<tr class="set-purple">
  <td>4</td><td>12/25/2025</td><td>18:00:00</td><td>Out</td>
</tr>
```

**Expected Output:**
- Layout: **5-card detailed view**
- Total Worked: `08:00:00`
- WFH Hours: `04:00:00` 🏠
- WFO Hours: `04:00:00` 🏢
- Remaining: `00:00:00`
- Complete At: `6:00:00 PM`

**Validation:**
- ✅ WFH/WFO breakdown displayed
- ✅ First 2 rows show "🏢 WFO" badge
- ✅ Last 2 rows show "🏠 WFH" badge
- ✅ Hours split evenly (4+4=8)

---

### Scenario 4: Multiple WFH Sessions
**Input Data:**
```html
<!-- Morning WFO -->
<tr>
  <td>1</td><td>12/25/2025</td><td>09:00:00</td><td>In</td>
</tr>
<tr>
  <td>2</td><td>12/25/2025</td><td>11:00:00</td><td>Out</td>
</tr>

<!-- Midday WFH -->
<tr class="set-purple">
  <td>3</td><td>12/25/2025</td><td>12:00:00</td><td>In</td>
</tr>
<tr class="set-purple">
  <td>4</td><td>12/25/2025</td><td>14:00:00</td><td>Out</td>
</tr>

<!-- Afternoon WFO -->
<tr>
  <td>5</td><td>12/25/2025</td><td>15:00:00</td><td>In</td>
</tr>
<tr>
  <td>6</td><td>12/25/2025</td><td>17:00:00</td><td>Out</td>
</tr>

<!-- Evening WFH -->
<tr class="set-purple">
  <td>7</td><td>12/25/2025</td><td>18:00:00</td><td>In</td>
</tr>
<tr class="set-purple">
  <td>8</td><td>12/25/2025</td><td>20:00:00</td><td>Out</td>
</tr>
```

**Expected Output:**
- Layout: **5-card detailed view**
- Total Worked: `08:00:00`
- WFH Hours: `04:00:00` 🏠
- WFO Hours: `04:00:00` 🏢
- Remaining: `00:00:00`
- Complete At: `8:00:00 PM`

**Validation:**
- ✅ Multiple WFH sessions accumulated correctly
- ✅ Badges alternate between WFO and WFH
- ✅ Total equals WFH + WFO

---

### Scenario 5: Ongoing WFH Session
**Input Data:**
```html
<tr>
  <td>1</td><td>12/25/2025</td><td>09:00:00</td><td>In</td>
</tr>
<tr>
  <td>2</td><td>12/25/2025</td><td>12:00:00</td><td>Out</td>
</tr>

<!-- Currently checked in (WFH) -->
<tr class="set-purple">
  <td>3</td><td>12/25/2025</td><td>14:00:00</td><td>In</td>
</tr>
<!-- Current time: 17:00:00 -->
```

**Expected Output (at 5:00 PM):**
- Layout: **5-card detailed view**
- Total Worked: `06:00:00` (increasing)
- WFH Hours: `03:00:00` 🏠 (increasing)
- WFO Hours: `03:00:00` 🏢 (static)
- Remaining: `02:00:00` (decreasing)
- Complete At: `7:00:00 PM` (updating)

**Validation:**
- ✅ Real-time updates working
- ✅ WFH hours incrementing
- ✅ Current session shown with "Current" checkout time
- ✅ Purple badge on ongoing session

---

### Scenario 6: Overnight Shift with WFH
**Input Data:**
```html
<!-- Late night WFH -->
<tr class="set-purple">
  <td>1</td><td>12/24/2025</td><td>23:00:00</td><td>In</td>
</tr>
<tr class="set-purple">
  <td>2</td><td>12/25/2025</td><td>02:00:00</td><td>Out</td>
</tr>

<!-- Morning WFO -->
<tr>
  <td>3</td><td>12/25/2025</td><td>09:00:00</td><td>In</td>
</tr>
<tr>
  <td>4</td><td>12/25/2025</td><td>14:00:00</td><td>Out</td>
</tr>
```

**Expected Output:**
- Layout: **5-card detailed view**
- Total Worked: `08:00:00`
- WFH Hours: `03:00:00` 🏠
- WFO Hours: `05:00:00` 🏢
- Remaining: `00:00:00`

**Validation:**
- ✅ Overnight calculation correct
- ✅ Both sessions counted for today
- ✅ WFH from previous date included

---

### Scenario 7: Gap Detection with WFH
**Input Data:**
```html
<!-- Morning WFH -->
<tr class="set-purple">
  <td>1</td><td>12/25/2025</td><td>09:00:00</td><td>In</td>
</tr>
<tr class="set-purple">
  <td>2</td><td>12/25/2025</td><td>12:00:00</td><td>Out</td>
</tr>

<!-- 7-hour gap (triggers warning) -->

<!-- Evening WFO -->
<tr>
  <td>3</td><td>12/25/2025</td><td>19:00:00</td><td>In</td>
</tr>
<tr>
  <td>4</td><td>12/25/2025</td><td>22:00:00</td><td>Out</td>
</tr>
```

**Expected Output:**
- Layout: **5-card detailed view**
- Warning: "⚠️ 6+ Hour Gap Detected"
- Total Worked: `06:00:00` (gap time not counted)
- WFH Hours: `03:00:00` 🏠
- WFO Hours: `03:00:00` 🏢

**Validation:**
- ✅ Gap warning displayed
- ✅ Gap time not included in totals
- ✅ WFH/WFO tracking still accurate

---

## Validation Checklist

### Visual Checks
- [ ] Stat cards display with correct gradients
  - [ ] Green for Total Worked
  - [ ] Purple for WFH Hours
  - [ ] Blue for WFO Hours
  - [ ] Orange for Remaining
  - [ ] Purple for Complete At
- [ ] Table badges show correctly
  - [ ] "🏠 WFH" for purple rows
  - [ ] "🏢 WFO" for normal rows
- [ ] Icons display properly (🏠 🏢)
- [ ] Layout adapts (3-card vs 5-card)

### Functional Checks
- [ ] WFH detection works (set-purple class)
- [ ] Hours accumulate correctly
- [ ] Real-time updates working
- [ ] Total = WFH + WFO
- [ ] Remaining time calculates correctly
- [ ] Complete At time is accurate
- [ ] Gap detection still works
- [ ] Emoji progression works

### Edge Cases
- [ ] No attendance records for today
- [ ] Only check-in (no check-out)
- [ ] Overnight shifts
- [ ] Multiple gaps in day
- [ ] All WFH (no WFO)
- [ ] All WFO (no WFH)
- [ ] Exactly 8 hours worked
- [ ] More than 8 hours worked
- [ ] Less than 8 hours worked

### Performance Checks
- [ ] No lag when updating
- [ ] Smooth animations
- [ ] No console errors
- [ ] Memory usage acceptable
- [ ] Works in PiP mode

### Browser Compatibility
- [ ] Chrome
- [ ] Edge
- [ ] Firefox
- [ ] Safari (if applicable)

### Responsive Design
- [ ] Desktop (1920x1080)
- [ ] Laptop (1366x768)
- [ ] Tablet (768x1024)
- [ ] Mobile (375x667)

---

## Testing Commands (Browser Console)

### Check if WFH detection is working
```javascript
// Run this in console after script loads
document.querySelectorAll('.main-attendance-table tbody tr.set-purple').length
// Should return number of WFH rows for today
```

### Verify hour calculations
```javascript
// Check total worked time
document.getElementById('total-worked-time').textContent

// Check WFH hours (if displayed)
document.getElementById('wfh-time')?.textContent

// Check WFO hours (if displayed)
document.getElementById('wfo-time')?.textContent
```

### Inspect cached values
```javascript
// Access the cached values (requires script variable access)
// Look for cachedValues object in script scope
```

### Force re-render
```javascript
// Refresh the page to trigger full recalculation
location.reload()
```

---

## Debugging Tips

### Issue: WFH hours not showing
**Check:**
1. Are there any `set-purple` rows for today?
2. Is the date matching correctly?
3. Check console for errors

**Solution:**
```javascript
// Verify purple rows exist
const purpleRows = document.querySelectorAll('.main-attendance-table tbody tr.set-purple');
console.log('Purple rows found:', purpleRows.length);
purpleRows.forEach(row => {
    const cells = row.querySelectorAll('td');
    console.log('Date:', cells[1]?.textContent, 'Time:', cells[3]?.textContent);
});
```

### Issue: Hours not accumulating
**Check:**
1. Are check-in/out pairs complete?
2. Is time format correct (HH:MM:SS)?
3. Any gaps triggering resets?

**Solution:**
Check the `checkInOutList` in console logs

### Issue: Wrong layout (3-card vs 5-card)
**Check:**
1. Is `hasWfhToday` flag set correctly?
2. Are purple rows for current date?

**Solution:**
Verify date matching logic in `calculateTotalTime` function

---

## Performance Benchmarks

**Target Metrics:**
- Initial render: < 100ms
- Update cycle: < 16ms (60fps)
- Memory usage: < 10MB
- CPU usage: < 5%

**Monitoring:**
```javascript
// Use Chrome DevTools Performance tab
// Record while script is running
// Look for long tasks or memory leaks
```

---

## Acceptance Criteria

✅ **Must Have:**
1. Detects WFH hours via `set-purple` class
2. Displays 5-card layout when WFH exists
3. Displays 3-card layout when no WFH
4. Shows correct WFH/WFO badges in table
5. Calculates hours accurately
6. Updates in real-time

✅ **Should Have:**
1. Smooth animations
2. Proper color scheme
3. Responsive design
4. No console errors
5. Works in PiP mode

✅ **Nice to Have:**
1. Theme adaptation (dark/light)
2. Custom color options
3. Export functionality

---

## Sign-off Checklist

Before marking complete:
- [ ] All test scenarios pass
- [ ] Visual checks complete
- [ ] Functional checks complete
- [ ] Edge cases handled
- [ ] Performance acceptable
- [ ] No critical bugs
- [ ] Documentation updated
- [ ] User guide created
- [ ] Installation tested

---

## Known Limitations

1. Requires `set-purple` class on WFH rows
2. Only shows data for current date
3. No historical WFH/WFO tracking
4. Depends on HR system markup
5. Browser console required for installation

---

**Testing Complete?** 🎯
Mark each scenario as tested and move to production!

---

**Test Date:** _______________  
**Tested By:** _______________  
**Status:** [ ] Pass [ ] Fail [ ] Needs Work  
**Notes:** _______________________________________________
