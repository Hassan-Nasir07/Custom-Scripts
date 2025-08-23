(function() {
    'use strict';
    const currentUrl = window.location.href;
    const targetUrl = "https://globalportal.mtbc.com/#/time-absence/attendence-record";

    if (currentUrl !== targetUrl) {
        return; 
    }
    

    function insertAndCalculate() {
        const tableDiv = document.querySelector('.main-attendance-table');
        if (!tableDiv) {
            return;
        }
        
        let totalTimeDiv = document.getElementById('total-time-summary');
        if (!totalTimeDiv) {
          totalTimeDiv = document.createElement('div');
            totalTimeDiv.id = 'total-time-summary';
            
            totalTimeDiv.style.marginTop = '20px';
            totalTimeDiv.style.padding = '10px';
            totalTimeDiv.style.border = '2px solid #add8e6'; 
            totalTimeDiv.style.borderRadius = '8px'; 
            totalTimeDiv.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.1)'; 
            totalTimeDiv.style.width = '55%'; 
    				totalTimeDiv.style.margin = '20px auto'; 
            totalTimeDiv.style.fontSize = '18px';
            totalTimeDiv.style.fontWeight = 'bold';
            totalTimeDiv.style.textAlign = 'center'; 
        } else {
            totalTimeDiv.innerHTML = '';
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
        let SixHrsDiff = false;

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
                	//console.log(row);
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
                    checkOut:  ``,
                    workedTime: secondsToHHMMSS(workedTime),
                });
                checkInTime = null;
            }

            let tableHTML = `
                <table style=" margin: 20px auto; border-collapse: collapse; table-layout: fixed; text-align: center; border: 1px solid #ddd;">
                <thead>
                    <tr style="background-color: #714994; color: white; font-weight: bold;">
                        <th style="padding: 5px 10px;">#</th>
                        <th style="padding: 5px 10px;">Check-In</th>
                        <th style="padding: 5px 10px;">Check-Out</th>
                        <th style="padding: 5px 10px;">Worked Time</th>
                        <th style="padding: 5px 10px;">Break</th>
                    </tr>
                </thead>
                <tbody>
            `;
            
           
            checkInOutList.forEach((item, index) => {
                let durationDifference = '';
                let isSixHourGap = false;
                if (index > 0) {
                    const prevItem = checkInOutList[index - 1];
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
                            <td colspan="5" style="text-align: center; background-color: #ffeeba; color:             #856404; font-weight: bold;">
                                6+ Hour Gap Detected (not added in total time)
                            </td>
                        </tr>
                    `;
                }
              	tableHTML += `
                  <tr style="background-color: ${index % 2 === 0 ? '#f9f9f9' : '#ffffff'};">
                      <td style="padding: 5px 10px; border: 1px solid #ddd;">${index + 1}</td>
                      <td style="padding: 5px 10px; border: 1px solid #ddd;">${item.checkIn}</td>
                      <td style="padding: 5px 10px; border: 1px solid #ddd;">${item.checkOut}</td>
                      <td style="padding: 5px 10px; border: 1px solid #ddd;">${item.workedTime}</td>
                      <td style="padding: 5px 10px; border: 1px solid #ddd;">${durationDifference}</td>
                  </tr>
              `;
            });

            tableHTML += '</tbody></table>';
            totalTimeDiv.innerHTML = `<h3 style="font-weight: bold;">Attendance Summary for Today</h3>${tableHTML}`;


            const totalTimeFormatted = secondsToHHMMSS(totalWorkedTime);
            totalTimeDiv.innerHTML += `<b>Total time worked today: <span style="color:green">${totalTimeFormatted}</span></b>`;

            const remainingTime = 28800 - totalWorkedTime;
            const remainingTimeFormatted = remainingTime > 0 ? secondsToHHMMSS(remainingTime) : "00:00:00";
            totalTimeDiv.innerHTML += `<br> <b>Remaining time: <span style="color:red">${remainingTimeFormatted}</span></b>`;

            if (remainingTime > 0) {
                const futureTime = new Date(today.getTime() + remainingTime * 1000);
                const futureTimeFormatted = formatTime12Hour(futureTime);
                totalTimeDiv.innerHTML += `<div style=" font-size: 20px; margin-top: 10px;">
                    You will complete <b style="color: green;">8</b> hours at <b style="color: green;">${futureTimeFormatted}</b> today.
                </div>`;
            } else {
                totalTimeDiv.innerHTML += `<div style="color: green; font-size: 20px; font-weight: bold; margin-top: 10px;">
                    Congratulations! You've completed 8 hours of work today.
                </div>`;
            }

        }
        
       //tableDiv.insertAfter(totalTimeDiv, tableDiv);
       //$('.attendance-details-wrapper').before(totalTimeDiv);
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
            diffInSeconds += 24 * 3600; // Add 24 hours in seconds
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
    
    function timeToSeconds(timeString) {
            const parts = timeString.split(':');
            return (+parts[0]) * 3600 + (+parts[1]) * 60 + (+parts[2]);
    }
    
    

  window.addEventListener('load', () => {
    const targetUrl = "https://globalportal.mtbc.com/#/time-absence/attendence-record";

    const checkUrlAndRun = () => {
        const currentUrl = window.location.href;
        if (currentUrl !== targetUrl) {
            return; 
        }

        insertAndCalculate();
        const submitButton = document.querySelector('.gp-btn.gp-btn-primary');
        if (submitButton) {
            submitButton.addEventListener('click', (event) => {
                insertAndCalculate(); 
            });
        }
    };

    checkUrlAndRun();

    setInterval(() => {
        const currentUrl = window.location.href;
        if (currentUrl === targetUrl) {
            insertAndCalculate();
        } 
    }, 1000);
	 });
})();