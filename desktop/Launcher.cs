using System;
using System.Diagnostics;
using System.IO;
using System.Threading;
using System.Windows.Forms;
using System.Drawing;

// Windows desktop launcher. No credentials, network hosting or bundled user data.
class Launcher : Form {
    Process server;
    Label message;
    Button openButton;
    string url;
    string logPath;
    bool closing;
    readonly object logLock = new object();
    public Launcher() {
        Text = "RP — Testes | Fasolo e Simon";
        ClientSize = new Size(500, 210);
        FormBorderStyle = FormBorderStyle.FixedDialog;
        MaximizeBox = false;
        StartPosition = FormStartPosition.CenterScreen;
        BackColor = Color.FromArgb(50, 70, 77);
        ForeColor = Color.White;
        Font = new Font("Arial", 11);
        message = new Label { Text = "Preparando seu ambiente de testes…", Location = new Point(22, 20), Size = new Size(455, 72) };
        var note = new Label { Text = "Dados somente neste computador.\nMantenha esta janela aberta enquanto usa o programa.", Location = new Point(22, 100), Size = new Size(455, 45) };
        openButton = new Button { Text = "Abrir programa", Enabled = false, Location = new Point(22, 160), Size = new Size(145, 30), ForeColor = Color.Black };
        openButton.Click += delegate { Process.Start(new ProcessStartInfo(url) { UseShellExecute = true }); };
        var logs = new Button { Text = "Ver diagnóstico", Location = new Point(180, 160), Size = new Size(145, 30), ForeColor = Color.Black };
        logs.Click += delegate { if (File.Exists(logPath)) Process.Start("notepad.exe", "\"" + logPath + "\""); };
        var stop = new Button { Text = "Encerrar", Location = new Point(338, 160), Size = new Size(140, 30), ForeColor = Color.Black };
        stop.Click += delegate { Close(); };
        Controls.AddRange(new Control[] { message, note, openButton, logs, stop });
        Shown += delegate { StartServer(); };
        FormClosing += delegate { StopServer(); };
    }
    void StartServer() {
        try {
            string root = AppDomain.CurrentDomain.BaseDirectory;
            string logsDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "FasoloSimon", "RP-Testes", "logs");
            Directory.CreateDirectory(logsDir);
            logPath = Path.Combine(logsDir, "inicio-" + DateTime.Now.ToString("yyyyMMdd-HHmmss") + ".txt");
            File.WriteAllText(logPath, "RP — Testes\r\n");
            server = new Process { StartInfo = new ProcessStartInfo {
                FileName = Path.Combine(root, "runtime", "node.exe"),
                Arguments = "\"" + Path.Combine(root, "scripts", "local-launcher.mjs") + "\"",
                WorkingDirectory = root, UseShellExecute = false, CreateNoWindow = true,
                RedirectStandardInput = true, RedirectStandardOutput = true, RedirectStandardError = true
            }, EnableRaisingEvents = true };
            server.OutputDataReceived += delegate(object sender, DataReceivedEventArgs e) { HandleOutput(e.Data); };
            server.ErrorDataReceived += delegate(object sender, DataReceivedEventArgs e) { HandleOutput(e.Data); };
            server.Exited += delegate {
                if (!closing && IsHandleCreated) BeginInvoke((Action)delegate {
                    openButton.Enabled = false;
                    message.Text = "O programa encerrou. Clique em Ver diagnóstico para conferir o motivo.";
                });
            };
            server.Start(); server.BeginOutputReadLine(); server.BeginErrorReadLine();
        } catch (Exception e) { message.Text = "Não foi possível abrir: " + e.Message; }
    }
    void HandleOutput(string line) {
        if (line == null) return;
        lock (logLock) File.AppendAllText(logPath, line + "\r\n");
        if (line.StartsWith("RP_READY ") && !closing && IsHandleCreated) {
            string address = line.Substring(9);
            Uri parsed;
            if (!Uri.TryCreate(address, UriKind.Absolute, out parsed) || parsed.Host != "127.0.0.1") return;
            BeginInvoke((Action)delegate { url = address; openButton.Enabled = true; message.Text = "Pronto! O ERP foi aberto no navegador.\nEscolha um cargo na faixa de teste para experimentar."; });
        }
    }
    void StopServer() {
        closing = true;
        if (server == null) return;
        try {
            if (!server.HasExited) { server.StandardInput.WriteLine("stop"); server.StandardInput.Flush();
                if (!server.WaitForExit(15000)) MessageBox.Show("O encerramento demorou. Aguarde antes de abrir outra versão e confira o diagnóstico.", "RP — Testes");
            }
        } catch (Exception e) { MessageBox.Show(e.Message, "Encerramento do teste"); }
    }
    [STAThread] static void Main(string[] args) {
        if (Array.IndexOf(args, "--check") >= 0) {
            string root = AppDomain.CurrentDomain.BaseDirectory;
            var check = Process.Start(new ProcessStartInfo {
                FileName = Path.Combine(root, "runtime", "node.exe"),
                Arguments = "\"" + Path.Combine(root, "desktop", "smoke-local.mjs") + "\"",
                WorkingDirectory = root, UseShellExecute = false, CreateNoWindow = true,
                RedirectStandardOutput = true, RedirectStandardError = true
            });
            string output = check.StandardOutput.ReadToEnd();
            string errors = check.StandardError.ReadToEnd();
            check.WaitForExit();
            File.WriteAllText(Path.Combine(root, "diagnostico-pacote.txt"), output + errors);
            Environment.Exit(check.ExitCode); return;
        }
        bool first;
        using (var mutex = new Mutex(true, "Local\\FasoloSimonRPTestes", out first)) {
            if (!first) { MessageBox.Show("O RP — Testes já está aberto. Use a janela existente.", "RP — Testes"); return; }
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new Launcher());
        }
    }
}
