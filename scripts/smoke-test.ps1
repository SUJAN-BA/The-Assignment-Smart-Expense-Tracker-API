
param([string]$BaseUrl = 'http://localhost:3000')

$ErrorActionPreference = 'Stop'
$script:Failures = 0

function Check($name, $actual, $expected) {
    $a = ($actual | ConvertTo-Json -Compress -Depth 5)
    $e = ($expected | ConvertTo-Json -Compress -Depth 5)
    if ($a -eq $e) {
        Write-Host "  PASS  $name" -ForegroundColor Green
    } else {
        Write-Host "  FAIL  $name" -ForegroundColor Red
        Write-Host "        expected: $e"
        Write-Host "        actual:   $a"
        $script:Failures++
    }
}


function CheckMoney($name, $actual, $expected) {
    Check $name ([math]::Round([double]$actual, 2)) ([math]::Round([double]$expected, 2))
}


function GetList($url) {
    $result = Invoke-RestMethod -Uri $url
    if ($null -eq $result) { return ,@() }
    return ,@($result)
}


function CategoryTotal($summary, $name) {
    $property = $summary.byCategory.PSObject.Properties[$name]
    if ($property) { return [double]$property.Value }
    return 0.0
}

function PostExpense($body) {
    Invoke-RestMethod -Uri "$BaseUrl/expenses" -Method Post `
        -ContentType 'application/json' -Body ($body | ConvertTo-Json)
}

Write-Host "`nChecking $BaseUrl" -ForegroundColor Cyan

# The server must be up before anything else is worth trying.
try {
    $health = Invoke-RestMethod -Uri "$BaseUrl/health"
} catch {
    Write-Host "`nCould not reach $BaseUrl - is 'npm start' running?" -ForegroundColor Red
    exit 1
}
Check 'server is up' $health.status 'ok'

# --- Baseline -------------------------------------------------------------
$before        = GetList "$BaseUrl/expenses"
$beforeSummary = Invoke-RestMethod -Uri "$BaseUrl/expenses/summary"
$beforeFood    = @($before | Where-Object { $_.category -eq 'Food' }).Count
$beforeIds     = @($before.id)
Write-Host "  (starting from $($before.Count) expense(s) already saved)" -ForegroundColor DarkGray

Write-Host "`nRequirement 1 - add an expense" -ForegroundColor Cyan
$lunch = PostExpense @{ title = 'Lunch'; amount = 120.50; category = 'Food';   date = '2026-01-15' }
$bus   = PostExpense @{ title = 'Bus';   amount = 30;      category = 'Travel'; date = '2026-02-03' }
$snack = PostExpense @{ title = 'Snack'; amount = 29.50;   category = 'Food';   date = '2026-01-20' }
$addedIds = @($lunch.id, $bus.id, $snack.id)
Check 'expense gets a generated id' ($lunch.id.Length -gt 0) $true
Check 'all five fields are returned' (($lunch.PSObject.Properties.Name | Sort-Object) -join ',') 'amount,category,date,id,title'
Check 'amount is stored as sent' $lunch.amount 120.5

Write-Host "`nRequirement 2 - view all expenses" -ForegroundColor Cyan
$all = GetList "$BaseUrl/expenses"
Check 'three more expenses than before' ($all.Count - $before.Count) 3
Check 'the new expenses are all in the list' (@($addedIds | Where-Object { $all.id -contains $_ }).Count) 3
Check 'the expenses that were already saved are still there' (@($beforeIds | Where-Object { $all.id -contains $_ }).Count) $before.Count

Write-Host "`nRequirement 3 - filter by category" -ForegroundColor Cyan
$food = GetList "$BaseUrl/expenses?category=Food"
Check 'two more Food expenses than before' ($food.Count - $beforeFood) 2
Check 'the filter only returns Food' (@($food | Where-Object { $_.category -ne 'Food' }).Count) 0
$lower = GetList "$BaseUrl/expenses?category=food"
Check 'filter is case-insensitive' $lower.Count $food.Count
$none = GetList "$BaseUrl/expenses?category=no-such-category-xyz"
Check 'unknown category gives an empty list' $none.Count 0

Write-Host "`nRequirement 4 - totals" -ForegroundColor Cyan
$summary = Invoke-RestMethod -Uri "$BaseUrl/expenses/summary"
CheckMoney 'overall total went up by 180'    ($summary.total - $beforeSummary.total) 180
CheckMoney 'Food total went up by 150'       ((CategoryTotal $summary 'Food')   - (CategoryTotal $beforeSummary 'Food'))   150
CheckMoney 'Travel total went up by 30'      ((CategoryTotal $summary 'Travel') - (CategoryTotal $beforeSummary 'Travel')) 30
Check      'count went up by 3'              ($summary.count - $beforeSummary.count) 3
CheckMoney 'overall total matches the sum of the categories' `
    (($summary.byCategory.PSObject.Properties | ForEach-Object { [double]$_.Value } | Measure-Object -Sum).Sum) $summary.total

Write-Host "`nRequirement 5 - delete an expense" -ForegroundColor Cyan
$deleted = Invoke-RestMethod -Uri "$BaseUrl/expenses/$($bus.id)" -Method Delete
Check 'the deleted expense is returned' $deleted.id $bus.id
$after = GetList "$BaseUrl/expenses"
Check 'one fewer expense than before the delete' ($all.Count - $after.Count) 1
Check 'the deleted one is gone' ($after.id -contains $bus.id) $false
Check 'the other new expenses are untouched' (@(@($lunch.id, $snack.id) | Where-Object { $after.id -contains $_ }).Count) 2
Check 'the expenses that were already saved are untouched' (@($beforeIds | Where-Object { $after.id -contains $_ }).Count) $before.Count

Write-Host "`nError handling" -ForegroundColor Cyan
try {
    PostExpense @{ title = ''; amount = -5; category = ''; date = 'nope' } | Out-Null
    Check 'invalid expense is rejected' 'no error' '400'
} catch {
    Check 'invalid expense is rejected with 400' ([int]$_.Exception.Response.StatusCode) 400
}
try {
    Invoke-RestMethod -Uri "$BaseUrl/expenses/does-not-exist" -Method Delete | Out-Null
    Check 'deleting an unknown id is rejected' 'no error' '404'
} catch {
    Check 'deleting an unknown id gives 404' ([int]$_.Exception.Response.StatusCode) 404
}


Write-Host "`nRemoving the expenses this script added" -ForegroundColor Cyan
foreach ($id in @($lunch.id, $snack.id)) {
    Invoke-RestMethod -Uri "$BaseUrl/expenses/$id" -Method Delete | Out-Null
}
$final = GetList "$BaseUrl/expenses"
Check 'back to the expenses that were saved before the run' $final.Count $before.Count

if ($script:Failures -eq 0) {
    Write-Host "`nAll checks passed - every requirement works.`n" -ForegroundColor Green
    exit 0
} else {
    Write-Host "`n$($script:Failures) check(s) failed.`n" -ForegroundColor Red
    exit 1
}
