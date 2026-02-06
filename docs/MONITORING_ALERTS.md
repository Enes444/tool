# Monitoring & Alerts (P0 baseline)

## Goal
Detect at minimum:
1. service downtime (web/api)
2. container down
3. API 5xx spikes

## Script
Use `scripts/monitor_check.ps1`

Example:
`powershell -ExecutionPolicy Bypass -File .\scripts\monitor_check.ps1 -ProjectRoot . -AlertWebhook "https://hooks.slack.com/services/XXX/YYY/ZZZ"`

## Schedule (every 5 minutes, Windows Task Scheduler)
Program: `powershell.exe`  
Arguments:
`-ExecutionPolicy Bypass -File C:\path\project\scripts\monitor_check.ps1 -ProjectRoot C:\path\project -AlertWebhook https://hooks.slack.com/services/...`

## Alert Channels
- Slack incoming webhook (recommended)
- alternatively Microsoft Teams webhook/email gateway

## Thresholds
- Any container not running => alert
- `/healthz` not 200 => alert
- Web root not 200 => alert
- >=1 API 5xx in last 5 min => alert