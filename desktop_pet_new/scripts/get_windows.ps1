[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Get-Process | Where-Object { $_.MainWindowTitle -ne '' } |
Select-Object ProcessName, MainWindowTitle |
ForEach-Object { "$($_.ProcessName)|$($_.MainWindowTitle)" }
