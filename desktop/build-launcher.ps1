param([Parameter(Mandatory=$true)][string]$OutputFile)
$ErrorActionPreference = 'Stop'
$source = Get-Content (Join-Path $PSScriptRoot 'Launcher.cs') -Raw -Encoding UTF8
Add-Type -TypeDefinition $source -ReferencedAssemblies 'System.Windows.Forms','System.Drawing' -OutputAssembly $OutputFile -OutputType WindowsApplication
