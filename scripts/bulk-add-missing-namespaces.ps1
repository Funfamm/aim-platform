$locales = Get-ChildItem "src/messages" -Filter "*.json" | Where-Object { $_.Name -ne "en.json" } | ForEach-Object { $_.BaseName }
$enPath = "src/messages/en.json"
$enJson = Get-Content $enPath -Raw | ConvertFrom-Json
foreach ($locale in $locales) {
  $path = "src/messages/$locale.json"
  $json = Get-Content $path -Raw | ConvertFrom-Json
  foreach ($ns in @('castingForm','applicationSuccess','voiceRecorder','donate')) {
    if (-not $json.PSObject.Properties.Name -contains $ns) {
      $json | Add-Member -NotePropertyName $ns -NotePropertyValue $enJson.$ns -Force
    }
  }
  $json | ConvertTo-Json -Depth 10 | Set-Content $path -Encoding UTF8
  Write-Host "Updated $locale.json"
}
