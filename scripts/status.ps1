Write-Host "=== BRANCH & COMMITS ==="
git log --oneline -5
git status --short
Write-Host "`n=== ROUTES ==="
Get-ChildItem -Recurse src\app -Filter page.tsx | ForEach-Object {
  $_.FullName.Replace("$PWD\src\app\","").Replace("\page.tsx","") }
Write-Host "`n=== TABLES ==="
Select-String -Path src\db\schema.ts -Pattern "^export const (\w+) = pgTable" |
  ForEach-Object { $_.Matches[0].Groups[1].Value }
Write-Host "`n=== SIZE ==="
(Get-ChildItem -Recurse src -Include *.ts,*.tsx | Get-Content |
  Measure-Object -Line).Lines
Write-Host "`n=== OPEN MARKERS ==="
# SPEC.md:10-11 are the legend, not rules. A rule's marker never opens a
# bullet, so excluding "- **[" is what makes these counts rule-level.
"CHANGE: " + @(Select-String -Path SPEC.md -Pattern '^(?!- \*\*\[).*\[CHANGE\]').Count
"BUILD:  " + @(Select-String -Path SPEC.md -Pattern '^(?!- \*\*\[).*\[BUILD\]').Count