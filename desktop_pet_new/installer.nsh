; ============================================================
; Pety Desktop Pet - NSIS Installer Custom Script
; ============================================================

!include "LogicLib.nsh"
!include "nsDialogs.nsh"

!ifndef BUILD_UNINSTALLER

Var /GLOBAL installPlugin
Var /GLOBAL installRelay
Var /GLOBAL dialogPage
Var /GLOBAL chkPlugin
Var /GLOBAL chkRelay

; ============================================================
; 组件选择页面
; ============================================================
Function componentPage
  nsDialogs::Create 1018
  Pop $dialogPage
  ${If} $dialogPage == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 0 0 100% 24u "Select optional components to install:"
  Pop $0

  ${NSD_CreateCheckbox} 10u 32u -20u 12u "Claude Code MCP Plugin"
  Pop $chkPlugin
  ${NSD_SetState} $chkPlugin ${BST_CHECKED}

  ${NSD_CreateLabel} 24u 46u -20u 10u "Lets Claude Code control the pet (chat, emotions, calls, etc.)"
  Pop $0
  SetCtlColors $0 0x999999 transparent

  ${NSD_CreateCheckbox} 10u 64u -20u 12u "Local Relay Server"
  Pop $chkRelay
  ${NSD_SetState} $chkRelay ${BST_CHECKED}

  ${NSD_CreateLabel} 24u 78u -20u 10u "WebSocket bridge between pet and AI. Requires Python."
  Pop $0
  SetCtlColors $0 0x999999 transparent

  ${NSD_CreateLabel} 10u 98u -20u 16u "Note: MCP Plugin requires Relay to function."
  Pop $0
  SetCtlColors $0 0x666666 transparent

  nsDialogs::Show
FunctionEnd

Function componentPageLeave
  ${NSD_GetState} $chkPlugin $installPlugin
  ${NSD_GetState} $chkRelay $installRelay

  ${If} $installPlugin == ${BST_CHECKED}
  ${AndIf} $installRelay != ${BST_CHECKED}
    MessageBox MB_YESNO|MB_ICONEXCLAMATION \
      "MCP Plugin requires Relay to function.$\r$\n$\r$\nInstall Relay as well?" \
      IDNO +2
      StrCpy $installRelay ${BST_CHECKED}
  ${EndIf}
FunctionEnd

!endif ; !BUILD_UNINSTALLER

; ============================================================
; customPageAfterChangeDir - insert component page before install
; ============================================================
!macro customPageAfterChangeDir
  Page custom componentPage componentPageLeave
!macroend

; ============================================================
; customInstall - runs after files are extracted
; ============================================================
!macro customInstall
  ${If} $installPlugin == ${BST_CHECKED}
    DetailPrint "Installing Claude Code MCP Plugin..."

    CreateDirectory "$PROFILE\.claude\plugins\marketplaces\chenyu-plugins\external_plugins\desktoppet"
    CreateDirectory "$PROFILE\.claude\plugins\marketplaces\chenyu-plugins\external_plugins\desktoppet\.claude-plugin"

    CopyFiles /SILENT "$INSTDIR\resources\plugin\server.js" \
      "$PROFILE\.claude\plugins\marketplaces\chenyu-plugins\external_plugins\desktoppet\server.js"
    CopyFiles /SILENT "$INSTDIR\resources\plugin\package.json" \
      "$PROFILE\.claude\plugins\marketplaces\chenyu-plugins\external_plugins\desktoppet\package.json"
    CopyFiles /SILENT "$INSTDIR\resources\plugin\.mcp.json" \
      "$PROFILE\.claude\plugins\marketplaces\chenyu-plugins\external_plugins\desktoppet\.mcp.json"
    CopyFiles /SILENT "$INSTDIR\resources\plugin\.claude-plugin\plugin.json" \
      "$PROFILE\.claude\plugins\marketplaces\chenyu-plugins\external_plugins\desktoppet\.claude-plugin\plugin.json"

    DetailPrint "Installing plugin dependencies..."
    nsExec::ExecToLog 'cmd /c "cd /d "$PROFILE\.claude\plugins\marketplaces\chenyu-plugins\external_plugins\desktoppet" && npm install --omit=dev 2>nul"'

    DetailPrint "MCP Plugin installed"
  ${EndIf}

  ${If} $installRelay == ${BST_CHECKED}
    DetailPrint "Installing Relay server..."

    CreateDirectory "$INSTDIR\relay"
    CopyFiles /SILENT "$INSTDIR\resources\relay\relay_server.py" "$INSTDIR\relay\relay_server.py"
    CopyFiles /SILENT "$INSTDIR\resources\relay\screen_supervisor.py" "$INSTDIR\relay\screen_supervisor.py"
    CopyFiles /SILENT "$INSTDIR\resources\relay\requirements.txt" "$INSTDIR\relay\requirements.txt"

    DetailPrint "Relay server installed"
  ${EndIf}
!macroend

; ============================================================
; customUnInstall - runs during uninstall
; ============================================================
!macro customUnInstall
  IfFileExists "$PROFILE\.claude\plugins\marketplaces\chenyu-plugins\external_plugins\desktoppet\server.js" 0 noPluginClean
    MessageBox MB_YESNO|MB_ICONQUESTION \
      "Remove Claude Code MCP Plugin?$\r$\n$\r$\nLocation: $PROFILE\.claude\plugins\...desktoppet/" \
      IDNO noPluginClean
      RMDir /r "$PROFILE\.claude\plugins\marketplaces\chenyu-plugins\external_plugins\desktoppet"
  noPluginClean:
!macroend
