!define MUI_FINISHPAGE_SHOWREADME
!define MUI_FINISHPAGE_SHOWREADME_TEXT "Join our Discord Server"
!define MUI_FINISHPAGE_SHOWREADME_FUNCTION JoinDiscord

Function JoinDiscord
  ExecShell "open" "https://discord.gg/6YVmxA4Qsf"
FunctionEnd
