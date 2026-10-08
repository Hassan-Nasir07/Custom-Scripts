@echo off
rem Starts the pool server. Double-click, or add to Task Scheduler "At log on".
rem Runs under Program Files' node.exe: the firewall's inbound rule names that program.
cd /d "%~dp0"
if not exist certs\cert.pem (
  echo No certificate yet. In Git Bash run:  bash mp-server/make-cert.sh
  pause
  exit /b 1
)
"C:\Program Files\nodejs\node.exe" server.js
pause
