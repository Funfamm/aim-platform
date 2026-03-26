Get-ChildItem -Recurse -Path src -Include "*.ts","*.tsx" | ForEach-Object {
    $path = $_.FullName
    $lines = Get-Content $path
    $content = $lines -join "`n"
    if ($content -match "@/lib/prisma") {
        $new = $content -replace "import prisma from '@/lib/prisma'", "import { prisma } from '@/lib/db'"
        Set-Content -Path $path -Value $new
        Write-Output "Updated: $path"
    }
}
