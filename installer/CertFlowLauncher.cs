using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

namespace CertFlowLauncher
{
    internal static class Program
    {
        private const int UpdateRestartExitCode = 75;

        [STAThread]
        private static void Main(string[] args)
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            bool suppressOpen = false;
            foreach (string arg in args)
            {
                if (string.Equals(arg, "--no-open", StringComparison.OrdinalIgnoreCase))
                {
                    suppressOpen = true;
                }
            }

            string rootDir = AppDomain.CurrentDomain.BaseDirectory.TrimEnd('\\', '/');
            string portEnv = Environment.GetEnvironmentVariable("CERTFLOW_PORT");
            string port = string.IsNullOrWhiteSpace(portEnv) ? "3000" : portEnv.Trim();
            string url = "http://localhost:" + port;

            // If CertFlow is already running on this port, open the browser and exit cleanly.
            if (IsServerHealthy(port))
            {
                if (!suppressOpen)
                {
                    OpenInBrowser(url);
                }
                return;
            }

            string nodeExe = Path.Combine(rootDir, "runtime", "node.exe");
            string startScript = Path.Combine(rootDir, "app", "scripts", "start.mjs");
            if (!File.Exists(nodeExe) || !File.Exists(startScript))
            {
                MessageBox.Show(
                    "CertFlow installation files are missing.\n\nExpected:\n" + nodeExe + "\n" + startScript,
                    "CertFlow",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
                return;
            }

            Application.Run(new CertFlowTrayContext(rootDir, port, url, nodeExe, startScript, suppressOpen));
        }

        internal static bool IsServerHealthy(string port)
        {
            try
            {
                HttpWebRequest req = (HttpWebRequest)WebRequest.Create("http://127.0.0.1:" + port + "/api/health");
                req.Method = "GET";
                req.Timeout = 1500;
                req.ReadWriteTimeout = 1500;
                req.Proxy = null;
                using (HttpWebResponse res = (HttpWebResponse)req.GetResponse())
                {
                    return res.StatusCode == HttpStatusCode.OK;
                }
            }
            catch
            {
                return false;
            }
        }

        internal static void OpenInBrowser(string url)
        {
            try
            {
                Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
            }
            catch
            {
                // Ignore shell launch errors.
            }
        }

        internal static void OpenInDedicatedWindow(string url)
        {
            string[] candidates = new[]
            {
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Microsoft", "Edge", "Application", "msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Microsoft", "Edge", "Application", "msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Google", "Chrome", "Application", "chrome.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Google", "Chrome", "Application", "chrome.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Google", "Chrome", "Application", "chrome.exe")
            };

            foreach (string exe in candidates)
            {
                if (File.Exists(exe))
                {
                    try
                    {
                        Process.Start(new ProcessStartInfo(exe, "--app=" + url) { UseShellExecute = false });
                        return;
                    }
                    catch
                    {
                        // Fall through to next browser.
                    }
                }
            }

            OpenInBrowser(url);
        }

        internal static string ReadVersionFromMeta(string rootDir)
        {
            try
            {
                string metaPath = Path.Combine(rootDir, "app", "portable-meta.json");
                if (!File.Exists(metaPath)) return "v1.0.0";
                string json = File.ReadAllText(metaPath, Encoding.UTF8);
                Match m = Regex.Match(json, "\"version\"\\s*:\\s*\"([^\"]+)\"");
                return m.Success ? m.Groups[1].Value.Trim() : "v1.0.0";
            }
            catch
            {
                return "v1.0.0";
            }
        }

        private sealed class CertFlowTrayContext : ApplicationContext
        {
            private readonly string _rootDir;
            private readonly string _port;
            private readonly string _url;
            private readonly string _dataDir;
            private readonly string _logPath;
            private readonly NotifyIcon _trayIcon;
            private readonly object _logLock = new object();
            private StreamWriter _logWriter;
            private Process _nodeProcess;
            private volatile bool _shuttingDown;

            public CertFlowTrayContext(
                string rootDir,
                string port,
                string url,
                string nodeExe,
                string startScript,
                bool suppressOpen
            )
            {
                _rootDir = rootDir;
                _port = port;
                _url = url;
                _dataDir = Path.Combine(rootDir, "data");
                _logPath = Path.Combine(_dataDir, "certflow.log");
                Directory.CreateDirectory(_dataDir);

                _trayIcon = new NotifyIcon
                {
                    Icon = LoadAppIcon(rootDir),
                    Text = "CertFlow (" + url + ")",
                    Visible = true,
                    ContextMenuStrip = BuildContextMenu()
                };
                _trayIcon.DoubleClick += delegate { OpenInBrowser(_url); };

                SystemEvents.SessionEnding += HandleSessionEnding;

                StartNodeServer(nodeExe, startScript);
                StartHealthWatcher(suppressOpen);
            }

            private static Icon LoadAppIcon(string rootDir)
            {
                try
                {
                    string icoPath = Path.Combine(rootDir, "certflow.ico");
                    if (File.Exists(icoPath))
                    {
                        return new Icon(icoPath);
                    }
                    Icon extracted = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
                    if (extracted != null) return extracted;
                }
                catch
                {
                    // Fall back to default application icon.
                }
                return SystemIcons.Application;
            }

            private ContextMenuStrip BuildContextMenu()
            {
                ContextMenuStrip menu = new ContextMenuStrip();

                ToolStripMenuItem openItem = new ToolStripMenuItem("Open CertFlow");
                openItem.Font = new Font(openItem.Font, FontStyle.Bold);
                openItem.Click += delegate { OpenInBrowser(_url); };
                menu.Items.Add(openItem);

                ToolStripMenuItem appWinItem = new ToolStripMenuItem("Open in App Window");
                appWinItem.Click += delegate { OpenInDedicatedWindow(_url); };
                menu.Items.Add(appWinItem);

                menu.Items.Add(new ToolStripSeparator());

                ToolStripMenuItem dataItem = new ToolStripMenuItem("Open Data Folder");
                dataItem.Click += delegate
                {
                    try
                    {
                        Process.Start(new ProcessStartInfo("explorer.exe", "\"" + _dataDir + "\"") { UseShellExecute = true });
                    }
                    catch { }
                };
                menu.Items.Add(dataItem);

                ToolStripMenuItem logItem = new ToolStripMenuItem("View Server Log");
                logItem.Click += delegate
                {
                    try
                    {
                        if (File.Exists(_logPath))
                        {
                            Process.Start(new ProcessStartInfo("notepad.exe", "\"" + _logPath + "\"") { UseShellExecute = true });
                        }
                    }
                    catch { }
                };
                menu.Items.Add(logItem);

                menu.Items.Add(new ToolStripSeparator());

                ToolStripMenuItem quitItem = new ToolStripMenuItem("Quit CertFlow");
                quitItem.Click += delegate { ShutdownAndExit(); };
                menu.Items.Add(quitItem);

                return menu;
            }

            private void StartNodeServer(string nodeExe, string startScript)
            {
                try
                {
                    _logWriter = new StreamWriter(_logPath, false, Encoding.UTF8) { AutoFlush = true };
                    _logWriter.WriteLine("[" + DateTime.Now.ToString("s") + "] Starting CertFlow on " + _url);
                }
                catch
                {
                    _logWriter = null;
                }

                string version = ReadVersionFromMeta(_rootDir);

                ProcessStartInfo psi = new ProcessStartInfo
                {
                    FileName = nodeExe,
                    Arguments = "\"" + startScript + "\"",
                    WorkingDirectory = _rootDir,
                    UseShellExecute = false,
                    CreateNoWindow = true,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true
                };

                psi.EnvironmentVariables["PORT"] = _port;
                psi.EnvironmentVariables["HOST"] = "127.0.0.1";
                psi.EnvironmentVariables["ORIGIN"] = _url;
                psi.EnvironmentVariables["NODE_ENV"] = "production";
                psi.EnvironmentVariables["CERTFLOW_SELF_HOSTED"] = "true";
                psi.EnvironmentVariables["CERTFLOW_PORTABLE"] = "true";
                psi.EnvironmentVariables["CERTFLOW_PORTABLE_ROOT"] = _rootDir;
                psi.EnvironmentVariables["CERTFLOW_PORTABLE_TARGET"] = "win-x64";
                psi.EnvironmentVariables["CERTFLOW_VERSION"] = version;
                psi.EnvironmentVariables["CERTFLOW_DATA_DIR"] = _dataDir;
                psi.EnvironmentVariables["LOCAL_UPLOAD_DIR"] = Path.Combine(_dataDir, "uploads");
                psi.EnvironmentVariables["STORAGE_DRIVER"] = "local";
                psi.EnvironmentVariables["CERTFLOW_APP_DIR"] = Path.Combine(_rootDir, "app");

                _nodeProcess = new Process
                {
                    StartInfo = psi,
                    EnableRaisingEvents = true
                };

                _nodeProcess.OutputDataReceived += delegate(object sender, DataReceivedEventArgs e)
                {
                    if (!string.IsNullOrEmpty(e.Data)) WriteLogLine(e.Data);
                };
                _nodeProcess.ErrorDataReceived += delegate(object sender, DataReceivedEventArgs e)
                {
                    if (!string.IsNullOrEmpty(e.Data)) WriteLogLine("[stderr] " + e.Data);
                };
                _nodeProcess.Exited += HandleNodeExited;

                _nodeProcess.Start();
                _nodeProcess.BeginOutputReadLine();
                _nodeProcess.BeginErrorReadLine();
            }

            private void WriteLogLine(string line)
            {
                lock (_logLock)
                {
                    try
                    {
                        if (_logWriter != null)
                        {
                            _logWriter.WriteLine(line);
                        }
                    }
                    catch { }
                }
            }

            private void StartHealthWatcher(bool suppressOpen)
            {
                Thread watcher = new Thread(delegate()
                {
                    DateTime deadline = DateTime.UtcNow.AddSeconds(45);
                    while (!_shuttingDown && DateTime.UtcNow < deadline)
                    {
                        if (IsServerHealthy(_port))
                        {
                            if (!suppressOpen)
                            {
                                OpenInBrowser(_url);
                            }
                            return;
                        }
                        Thread.Sleep(400);
                    }
                })
                {
                    IsBackground = true
                };
                watcher.Start();
            }

            private void HandleNodeExited(object sender, EventArgs e)
            {
                if (_shuttingDown) return;

                int code = -1;
                try
                {
                    code = _nodeProcess.ExitCode;
                }
                catch { }

                WriteLogLine("[" + DateTime.Now.ToString("s") + "] CertFlow server exited with code " + code);

                // Exit silently when an in-app update triggered restart.
                if (code == UpdateRestartExitCode)
                {
                    ExitSilently();
                    return;
                }

                _shuttingDown = true;
                try
                {
                    MessageBox.Show(
                        "CertFlow stopped unexpectedly (exit code " + code + ").\n\nCheck the server log for details:\n" + _logPath,
                        "CertFlow",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Warning
                    );
                }
                catch { }
                ExitSilently();
            }

            private void HandleSessionEnding(object sender, SessionEndingEventArgs e)
            {
                ShutdownAndExit();
            }

            private void ExitSilently()
            {
                _shuttingDown = true;
                CleanupResources();
                Application.Exit();
            }

            private void ShutdownAndExit()
            {
                if (_shuttingDown) return;
                _shuttingDown = true;
                try
                {
                    if (_nodeProcess != null && !_nodeProcess.HasExited)
                    {
                        _nodeProcess.Kill();
                        _nodeProcess.WaitForExit(3000);
                    }
                }
                catch { }
                CleanupResources();
                Application.Exit();
            }

            private void CleanupResources()
            {
                try { SystemEvents.SessionEnding -= HandleSessionEnding; } catch { }
                try
                {
                    if (_trayIcon != null)
                    {
                        _trayIcon.Visible = false;
                        _trayIcon.Dispose();
                    }
                }
                catch { }
                lock (_logLock)
                {
                    try
                    {
                        if (_logWriter != null)
                        {
                            _logWriter.Dispose();
                            _logWriter = null;
                        }
                    }
                    catch { }
                }
            }
        }
    }
}
