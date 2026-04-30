Unicode true
!if "{{compression}}" == ""
  SetCompressor /SOLID lzma
!else
  SetCompressor /SOLID "{{compression}}"
!endif

!include MUI2.nsh
!include FileFunc.nsh
!include x64.nsh
!include WordFunc.nsh
!include "StrFunc.nsh"
!include "Win\COM.nsh"
!include "Win\Propkey.nsh"
${StrCase}
${StrLoc}

!define MANUFACTURER "{{manufacturer}}"
!define PRODUCTNAME "{{product_name}}"
!define VERSION "{{version}}"
!define VERSIONWITHBUILD "{{version_with_build}}"
!define INSTALLMODE "{{install_mode}}"
!define LICENSE "{{license}}"
!define INSTALLERICON "{{installer_icon}}"
!define SIDEBARIMAGE "{{sidebar_image}}"
!define HEADERIMAGE "{{header_image}}"
!define MAINBINARYNAME "{{main_binary_name}}"
!define MAINBINARYSRCPATH "{{main_binary_path}}"
!define BUNDLEID "{{bundle_id}}"
!define COPYRIGHT "{{copyright}}"
!define OUTFILE "{{out_file}}"
!define ARCH "{{arch}}"
!define PLUGINSPATH "{{additional_plugins_path}}"
!define ALLOWDOWNGRADES "{{allow_downgrades}}"
!define DISPLAYLANGUAGESELECTOR "{{display_language_selector}}"
!define INSTALLWEBVIEW2MODE "{{install_webview2_mode}}"
!define WEBVIEW2INSTALLERARGS "{{webview2_installer_args}}"
!define WEBVIEW2BOOTSTRAPPERPATH "{{webview2_bootstrapper_path}}"
!define WEBVIEW2INSTALLERPATH "{{webview2_installer_path}}"
!define UNINSTKEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCTNAME}"
!define MANUPRODUCTKEY "Software\${MANUFACTURER}\${PRODUCTNAME}"
!define ESTIMATEDSIZE "{{estimated_size}}"

# --- BRANDING COLORS ---
!define MUI_BGCOLOR "F8FAFC"
!define MUI_TEXTCOLOR "1E293B"

Name "${PRODUCTNAME}"
BrandingText "ZarPresence - Modern Discord Presence"
OutFile "${OUTFILE}"

VIProductVersion "${VERSIONWITHBUILD}"
VIAddVersionKey "ProductName" "${PRODUCTNAME}"
VIAddVersionKey "FileDescription" "${PRODUCTNAME}"
VIAddVersionKey "LegalCopyright" "${COPYRIGHT}"
VIAddVersionKey "FileVersion" "${VERSION}"
VIAddVersionKey "ProductVersion" "${VERSION}"

!if "${INSTALLERICON}" != ""
  !define MUI_ICON "${INSTALLERICON}"
!endif
!if "${SIDEBARIMAGE}" != ""
  !define MUI_WELCOMEFINISHPAGE_BITMAP "${SIDEBARIMAGE}"
!endif
!if "${HEADERIMAGE}" != ""
  !define MUI_HEADERIMAGE
  !define MUI_HEADERIMAGE_BITMAP  "${HEADERIMAGE}"
!endif

# --- PAGES ---
!insertmacro MUI_PAGE_WELCOME
!if "${LICENSE}" != ""
  !insertmacro MUI_PAGE_LICENSE "${LICENSE}"
!endif
!if "${INSTALLMODE}" == "both"
  !insertmacro MULTIUSER_PAGE_INSTALLMODE
!endif
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES

# --- FINISH PAGE (With Discord Join) ---
!define MUI_FINISHPAGE_NOAUTOCLOSE
!define MUI_FINISHPAGE_SHOWREADME
!define MUI_FINISHPAGE_SHOWREADME_TEXT "Join the ZarPresence Discord Community"
!define MUI_FINISHPAGE_SHOWREADME_FUNCTION JoinDiscord
!define MUI_FINISHPAGE_RUN
!define MUI_FINISHPAGE_RUN_FUNCTION RunMainBinary
!insertmacro MUI_PAGE_FINISH

Function JoinDiscord
  ExecShell "open" "https://discord.gg/6YVmxA4Qsf"
FunctionEnd

Function RunMainBinary
  nsis_tauri_utils::RunAsUser "$INSTDIR\${MAINBINARYNAME}.exe" ""
FunctionEnd

Section "MainSection" SEC01
  SetOutPath "$INSTDIR"
  File /r "{{data_dir}}\*" 
  WriteUninstaller "$INSTDIR\uninstall.exe"
  CreateShortcut "$DESKTOP\${PRODUCTNAME}.lnk" "$INSTDIR\${MAINBINARYNAME}.exe"
SectionEnd

!insertmacro MUI_LANGUAGE "English"
