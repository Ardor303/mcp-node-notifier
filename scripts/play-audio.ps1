param(
    [Parameter(Mandatory = $true)][string]$AudioFile,
    [ValidateRange(0, 100)][double]$Volume = 70,
    [ValidateRange(0.1, 60)][double]$MaxSeconds = 10
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName PresentationCore, WindowsBase
$resolved = (Resolve-Path -LiteralPath $AudioFile).ProviderPath
$player = New-Object System.Windows.Media.MediaPlayer
$frame = New-Object System.Windows.Threading.DispatcherFrame
$timer = New-Object System.Windows.Threading.DispatcherTimer
$watch = [System.Diagnostics.Stopwatch]::StartNew()
$state = @{ opened = $false; error = $null; startedAt = 0 }
$player.Volume = $Volume / 100.0
$player.add_MediaOpened({ $state.opened = $true; $state.startedAt = $watch.Elapsed.TotalSeconds })
$player.add_MediaEnded({ $frame.Continue = $false })
$player.add_MediaFailed({ param($sender, $eventArgs); $state.error = $eventArgs.ErrorException.Message; $frame.Continue = $false })
$timer.Interval = [TimeSpan]::FromMilliseconds(100)
$timer.add_Tick({
    if (-not $state.opened -and $watch.Elapsed.TotalSeconds -gt 8) {
        $state.error = 'Audio file did not open within 8 seconds.'
        $frame.Continue = $false
    } elseif ($state.opened -and ($watch.Elapsed.TotalSeconds - $state.startedAt) -ge $MaxSeconds) {
        $frame.Continue = $false
    }
})
try {
    $player.Open([Uri]::new($resolved))
    $player.Play()
    $timer.Start()
    [System.Windows.Threading.Dispatcher]::PushFrame($frame)
} finally {
    $timer.Stop()
    $player.Stop()
    $player.Close()
}
if ($state.error) { throw $state.error }
