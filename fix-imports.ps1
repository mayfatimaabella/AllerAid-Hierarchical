# PowerShell script to fix all import paths after reorganization

# Fix service imports - update relative paths to point to core/services
Get-ChildItem -Recurse -Path "src\app\features" -Include "*.ts" | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    $content = $content -replace "from '\.\./service/", "from '../../core/services/"
    $content = $content -replace "from '\.\./\.\./service/", "from '../../../core/services/"
    $content = $content -replace "from '\.\./\.\./\.\./service/", "from '../../../../core/services/"
    Set-Content -Path $_.FullName -Value $content
}

# Fix modal imports - update to shared/modals
Get-ChildItem -Recurse -Path "src\app\features" -Include "*.ts" | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    $content = $content -replace "from '\.\./modals/", "from '../../shared/modals/"
    $content = $content -replace "from '\.\./\.\./modals/", "from '../../../shared/modals/"
    Set-Content -Path $_.FullName -Value $content
}

# Fix core service imports in core folder itself  
Get-ChildItem -Recurse -Path "src\app\core" -Include "*.ts" | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    $content = $content -replace "from '\.\./core/services/", "from './services/"
    $content = $content -replace "from '\.\./\.\./core/services/", "from '../services/"
    Set-Content -Path $_.FullName -Value $content
}

# Fix shared component imports
Get-ChildItem -Recurse -Path "src\app\features" -Include "*.ts" | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    $content = $content -replace "from '\.\./shared/emergency-response-notification/", "from '../../shared/components/emergency-response-notification/"
    $content = $content -replace "from '\.\./\.\./shared/emergency-response-notification/", "from '../../../shared/components/emergency-response-notification/"
    Set-Content -Path $_.FullName -Value $content
}

Write-Host "Import paths updated successfully!"
