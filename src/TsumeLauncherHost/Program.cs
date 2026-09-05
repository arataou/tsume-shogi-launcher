using System.Diagnostics;
using System.Globalization;
using System.Net;
using System.Net.Http;
using System.Net.Sockets;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace TsumeLauncherHost;

internal static class Program
{
    [STAThread]
    private static void Main()
    {
        ApplicationConfiguration.Initialize();
        Application.Run(new LauncherForm());
    }
}

internal sealed class LauncherForm : Form
{
    private readonly string root = Path.GetDirectoryName(Environment.ProcessPath) ?? AppContext.BaseDirectory;
    private Process? serverProcess;
    private WebView2? browser;
    private int port;

    public LauncherForm()
    {
        Text = "诘将棋练习";
        StartPosition = FormStartPosition.CenterScreen;
        MinimumSize = new Size(900, 680);
        ClientSize = new Size(1280, 900);
        BackColor = Color.FromArgb(247, 244, 238);
        Shown += OnShown;
        FormClosed += OnFormClosed;

        Controls.Add(new Label
        {
            Dock = DockStyle.Fill,
            Text = "诘将棋练习\n\n正在启动本地题库和玉方应手…",
            TextAlign = ContentAlignment.MiddleCenter,
            Font = new Font("Microsoft YaHei UI", 14F, FontStyle.Regular),
            ForeColor = Color.FromArgb(48, 59, 54)
        });
    }

    private async void OnShown(object? sender, EventArgs e)
    {
        try
        {
            port = FindAvailablePort();
            serverProcess = StartServer(port);
            if (!await WaitForServer(port))
            {
                throw new InvalidOperationException("本地服务启动超时。");
            }

            var userData = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "TsumeLauncher",
                "WebView2");
            Directory.CreateDirectory(userData);
            var environment = await CoreWebView2Environment.CreateAsync(null, userData);
            browser = new WebView2 { Dock = DockStyle.Fill };
            await browser.EnsureCoreWebView2Async(environment);
            browser.CoreWebView2.Navigate("http://127.0.0.1:" + port.ToString(CultureInfo.InvariantCulture) + "/");
            Controls.Clear();
            Controls.Add(browser);
        }
        catch (Exception error)
        {
            MessageBox.Show(
                "启动失败。\n\n" + error.Message + "\n\n可以改用同目录的 Start-Browser.bat。",
                "诘将棋练习",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
            Close();
        }
    }

    private Process StartServer(int selectedPort)
    {
        var server = Path.Combine(root, "server.ps1");
        if (!File.Exists(server))
        {
            throw new FileNotFoundException("找不到 server.ps1。", server);
        }

        var powershell = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.System),
            "WindowsPowerShell",
            "v1.0",
            "powershell.exe");
        var startInfo = new ProcessStartInfo
        {
            FileName = powershell,
            WorkingDirectory = root,
            UseShellExecute = false,
            CreateNoWindow = true,
            WindowStyle = ProcessWindowStyle.Hidden
        };
        startInfo.ArgumentList.Add("-NoProfile");
        startInfo.ArgumentList.Add("-ExecutionPolicy");
        startInfo.ArgumentList.Add("Bypass");
        startInfo.ArgumentList.Add("-File");
        startInfo.ArgumentList.Add(server);
        startInfo.ArgumentList.Add("-Port");
        startInfo.ArgumentList.Add(selectedPort.ToString(CultureInfo.InvariantCulture));

        return Process.Start(startInfo) ?? throw new InvalidOperationException("无法启动 PowerShell 本地服务。");
    }

    private static async Task<bool> WaitForServer(int selectedPort)
    {
        using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(1) };
        var url = "http://127.0.0.1:" + selectedPort.ToString(CultureInfo.InvariantCulture) + "/api/health";
        for (var attempt = 0; attempt < 120; attempt++)
        {
            try
            {
                using var response = await client.GetAsync(url);
                if (response.IsSuccessStatusCode)
                {
                    return true;
                }
            }
            catch (HttpRequestException)
            {
            }
            catch (TaskCanceledException)
            {
            }

            await Task.Delay(250);
        }

        return false;
    }

    private static int FindAvailablePort()
    {
        using var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        var selectedPort = ((IPEndPoint)listener.LocalEndpoint).Port;
        listener.Stop();
        return selectedPort;
    }

    private void OnFormClosed(object? sender, FormClosedEventArgs e)
    {
        browser?.Dispose();
        if (serverProcess is null)
        {
            return;
        }

        try
        {
            if (!serverProcess.HasExited)
            {
                serverProcess.Kill(entireProcessTree: true);
                serverProcess.WaitForExit(3000);
            }
        }
        catch
        {
        }
        finally
        {
            serverProcess.Dispose();
            serverProcess = null;
        }
    }
}
