# Register a daily Task Scheduler job for InTheFlow planning synchronization

$TaskName = "InTheFlow_DailySync"
$TaskDescription = "Daily synchronization of active planning markdown files for InTheFlow workspace"

# Define the action to execute (silent post request to the local API)
$Action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-NoProfile -WindowStyle Hidden -Command ""Invoke-RestMethod -Uri 'http://localhost:8000/api/settings/sync-planning?force=false' -Method Post"""

# Run daily at 9:00 AM
$Trigger = New-ScheduledTaskTrigger -Daily -At "9:00 AM"

# Extra resilience settings
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

# Register/Overwrite task
Register-ScheduledTask -TaskName $TaskName -Trigger $Trigger -Action $Action -Settings $Settings -Description $TaskDescription -Force

Write-Host "Successfully registered '$TaskName' daily cron job to run at 9:00 AM."
Write-Host "You can verify or run it manually inside the Windows Task Scheduler UI or using the CLI."
