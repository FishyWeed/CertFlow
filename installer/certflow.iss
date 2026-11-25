; CertFlow Windows Installer (Inno Setup 6)
; Compiles the staged Windows portable bundle into a standard Setup.exe that:
;   1. Lets the user pick any destination folder (installing as a CertFlow folder).
;   2. Creates Desktop and Start Menu shortcuts pointing to Start-CertFlow.bat.
;   3. Preserves the user's data\ folder across upgrades and in-app updates.

#ifndef MyAppVersion
  #define MyAppVersion "1.0.0"
#endif

#ifndef MySourceDir
  #define MySourceDir "..\release\CertFlow-v1.0.0-win-x64"
#endif

#ifndef MyOutputDir
  #define MyOutputDir "..\release"
#endif

#ifndef MyOutputBaseFilename
  #define MyOutputBaseFilename "CertFlow-v1.0.0-win-x64-Setup"
#endif

[Setup]
AppId={{B4A917D2-9C4E-4F2B-A1E3-7D8E5C4A2F19}
AppName=CertFlow
AppVersion={#MyAppVersion}
AppVerName=CertFlow {#MyAppVersion}
AppPublisher=CertFlow
AppPublisherURL=https://github.com/FishyWeed/CertFlow
AppSupportURL=https://github.com/FishyWeed/CertFlow/issues
AppUpdatesURL=https://github.com/FishyWeed/CertFlow/releases
DefaultDirName={localappdata}\CertFlow
AppendDefaultDirName=yes
UsePreviousAppDir=yes
DefaultGroupName=CertFlow
AllowNoIcons=yes
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
OutputDir={#MyOutputDir}
OutputBaseFilename={#MyOutputBaseFilename}
SetupIconFile=certflow.ico
UninstallDisplayIcon={app}\certflow.ico
UninstallDisplayName=CertFlow
Compression=lzma2/fast
SolidCompression=yes
WizardStyle=modern
DisableProgramGroupPage=yes
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a &Desktop shortcut"; GroupDescription: "Additional shortcuts:"

[Dirs]
Name: "{app}\data"
Name: "{app}\data\uploads"
Name: "{app}\data\pgdata"

[Files]
; Install application, bundled Node runtime, launcher scripts and icon.
; Never overwrite user data inside data\.
Source: "{#MySourceDir}\app\*"; DestDir: "{app}\app"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#MySourceDir}\runtime\*"; DestDir: "{app}\runtime"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#MySourceDir}\Start-CertFlow.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#MySourceDir}\Create-Desktop-Shortcut.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#MySourceDir}\README-FIRST.txt"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#MySourceDir}\certflow.ico"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\CertFlow\CertFlow"; Filename: "{app}\Start-CertFlow.bat"; WorkingDir: "{app}"; IconFilename: "{app}\certflow.ico"; Comment: "Launch CertFlow Bulk Certificate Generator"
Name: "{autoprograms}\CertFlow\Uninstall CertFlow"; Filename: "{uninstallexe}"
Name: "{autodesktop}\CertFlow"; Filename: "{app}\Start-CertFlow.bat"; WorkingDir: "{app}"; IconFilename: "{app}\certflow.ico"; Comment: "Launch CertFlow Bulk Certificate Generator"; Tasks: desktopicon

[Run]
Filename: "{app}\Start-CertFlow.bat"; Description: "Launch CertFlow"; WorkingDir: "{app}"; Flags: postinstall nowait skipifsilent shellexec

[UninstallDelete]
; Clean up temporary update staging files if present; always keep user data\ intact.
Type: filesandordirs; Name: "{app}\.update-staging"
Type: filesandordirs; Name: "{app}\app.bak"
Type: filesandordirs; Name: "{app}\runtime.bak"
