"""
Komaneka Receipt Memories - HTTPS Local Server
Menyediakan server HTTPS lokal agar kamera HP / Android / iPhone dapat diakses via Wi-Fi.
WebRTC / getUserMedia membutuhkan Secure Context (HTTPS) pada perangkat seluler.
"""

import http.server
import ssl
import socket
import os
import sys

PORT = 8443
CERT_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cert.pem")
KEY_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "key.pem")

def get_local_ips():
    ips = ["127.0.0.1"]
    try:
        hostname = socket.gethostname()
        for ip in socket.gethostbyname_ex(hostname)[2]:
            if not ip.startswith("127."):
                ips.append(ip)
    except Exception:
        pass
    return ips

def ensure_ssl_certs():
    if os.path.exists(CERT_FILE) and os.path.exists(KEY_FILE):
        return
    try:
        from cryptography import x509
        from cryptography.x509.oid import NameOID
        from cryptography.hazmat.primitives import hashes
        from cryptography.hazmat.primitives.asymmetric import rsa
        from cryptography.hazmat.primitives import serialization
        import datetime
        import ipaddress

        print("Membuat sertifikat SSL mandiri...")
        key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        hostname = socket.gethostname()
        san_ips = [ipaddress.IPv4Address("127.0.0.1")]
        for ip_str in get_local_ips():
            if ip_str != "127.0.0.1":
                try:
                    san_ips.append(ipaddress.IPv4Address(ip_str))
                except Exception:
                    pass

        san_list = [x509.DNSName("localhost"), x509.DNSName(hostname)] + [x509.IPAddress(ip) for ip in san_ips]
        subject = issuer = x509.Name([
            x509.NameAttribute(NameOID.COUNTRY_NAME, "ID"),
            x509.NameAttribute(NameOID.ORGANIZATION_NAME, "Komaneka Receipt Memories"),
            x509.NameAttribute(NameOID.COMMON_NAME, "Komaneka Receipt Memories Photobooth"),
        ])

        cert = (
            x509.CertificateBuilder()
            .subject_name(subject)
            .issuer_name(issuer)
            .public_key(key.public_key())
            .serial_number(x509.random_serial_number())
            .not_valid_before(datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=1))
            .not_valid_after(datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=3650))
            .add_extension(x509.SubjectAlternativeName(san_list), critical=False)
            .sign(key, hashes.SHA256())
        )

        with open(KEY_FILE, "wb") as f:
            f.write(key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.TraditionalOpenSSL,
                encryption_algorithm=serialization.NoEncryption(),
            ))
        with open(CERT_FILE, "wb") as f:
            f.write(cert.public_bytes(serialization.Encoding.PEM))
    except Exception as e:
        print(f"Error membuat SSL cert: {e}")

CONFIG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "config.json")
TEMPLATES_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "templates.json")
DEFAULT_CONFIG = {
    "print": {
        "connection": "driver",
        "name": "EPSON TM-T82II Receipt",
        "ip": "192.168.71.10",
        "port": 9100,
        "paperWidthMm": 80,
        "feedLines": 3,
        "autoCut": True,
        "ditherMode": "floyd-steinberg",
        "threshold": 128
    }
}

DEFAULT_TEMPLATES_SERVER = [
    {
        "id": "tpl-1photo",
        "name": "1 Foto (Single Large)",
        "paperSize": "80mm",
        "width": 576,
        "height": 860,
        "slots": [{"x": 38, "y": 160, "width": 500, "height": 480, "radius": 0}],
        "textOverlays": [],
        "frameImage": None
    },
    {
        "id": "tpl-2photo",
        "name": "2 Foto (2-Strip Vertikal)",
        "paperSize": "80mm",
        "width": 576,
        "height": 1120,
        "slots": [
            {"x": 38, "y": 160, "width": 500, "height": 360, "radius": 0},
            {"x": 38, "y": 540, "width": 500, "height": 360, "radius": 0}
        ],
        "textOverlays": [],
        "frameImage": None
    },
    {
        "id": "tpl-4grid",
        "name": "4 Foto (Grid 2 Baris × 2 Kolom)",
        "paperSize": "80mm",
        "width": 576,
        "height": 1020,
        "slots": [
            {"x": 38, "y": 160, "width": 242, "height": 242, "radius": 0},
            {"x": 296, "y": 160, "width": 242, "height": 242, "radius": 0},
            {"x": 38, "y": 420, "width": 242, "height": 242, "radius": 0},
            {"x": 296, "y": 420, "width": 242, "height": 242, "radius": 0}
        ],
        "textOverlays": [],
        "frameImage": None
    }
]

def load_templates():
    if os.path.exists(TEMPLATES_FILE):
        try:
            with open(TEMPLATES_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list) and len(data) > 0:
                    return data
        except Exception:
            pass
    return DEFAULT_TEMPLATES_SERVER

def save_templates(templates_list):
    try:
        with open(TEMPLATES_FILE, "w", encoding="utf-8") as f:
            json.dump(templates_list, f, indent=2)
        return True, None
    except Exception as e:
        return False, str(e)
import json
import base64
import re
import subprocess

def load_config():
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return DEFAULT_CONFIG.copy()

def save_config(patch):
    cfg = load_config()
    if isinstance(patch, dict):
        if "print" in patch and isinstance(patch["print"], dict):
            cfg.setdefault("print", {}).update(patch["print"])
        for k, v in patch.items():
            if k != "print":
                cfg[k] = v
    try:
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(cfg, f, indent=2)
        return True, cfg
    except Exception as e:
        return False, str(e)

def list_printers():
    if sys.platform != "win32":
        return []
    cmd = ['powershell', '-NoProfile', '-Command', 'Get-Printer | Select-Object Name, PortName, PrinterStatus, DriverName | ConvertTo-Json -Compress']
    try:
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=8)
        raw_text = res.stdout.strip()
        if not raw_text:
            return []
        raw = json.loads(raw_text)
        if isinstance(raw, dict):
            raw = [raw]
    except Exception as e:
        print(f"Error list_printers: {e}")
        return []

    printers = []
    ip_regex = re.compile(r'^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$')
    thermal_keywords = ['receipt', 'thermal', 'pos', 'tm-', 't82', 't88', 'xprinter', 'printer', 'esc/p', 'cutter', 'star', 'srp']

    for p in raw:
        name = p.get('Name') or ''
        port = p.get('PortName') or ''
        status = p.get('PrinterStatus', 0)
        driver = p.get('DriverName') or ''
        is_ip = bool(ip_regex.match(port.strip()))
        full_text = f'{name} {driver} {port}'.lower()
        is_thermal = any(k in full_text for k in thermal_keywords)
        is_online = (status == 0)
        printers.append({
            'name': name,
            'port': port,
            'status': status,
            'driver': driver,
            'isIp': is_ip,
            'isThermal': is_thermal,
            'isOnline': is_online
        })
    printers.sort(key=lambda x: (not x['isOnline'], not x['isThermal'], x['name'].lower()))
    return printers

def print_windows_raw(printer_name, data: bytes):
    if sys.platform != "win32":
        return False, "Windows raw printing hanya didukung di OS Windows."
    import ctypes
    from ctypes import wintypes
    class DOC_INFO_1(ctypes.Structure):
        _fields_ = [
            ("pDocName", wintypes.LPCWSTR),
            ("pOutputFile", wintypes.LPCWSTR),
            ("pDataType", wintypes.LPCWSTR),
        ]
    winspool = ctypes.WinDLL("winspool.drv", use_last_error=True)
    h_printer = wintypes.HANDLE()
    if not winspool.OpenPrinterW(printer_name, ctypes.byref(h_printer), None):
        err = ctypes.get_last_error()
        return False, f"Gagal membuka printer Windows '{printer_name}' (Error code: {err})"
    try:
        doc_info = DOC_INFO_1("Komaneka Photobooth Print", None, "RAW")
        job_id = winspool.StartDocPrinterW(h_printer, 1, ctypes.byref(doc_info))
        if job_id <= 0:
            err = ctypes.get_last_error()
            return False, f"Gagal memulai dokumen print (Error code: {err})"
        try:
            if not winspool.StartPagePrinter(h_printer):
                err = ctypes.get_last_error()
                return False, f"Gagal memulai halaman printer (Error code: {err})"
            written = wintypes.DWORD()
            ok = winspool.WritePrinter(h_printer, data, len(data), ctypes.byref(written))
            winspool.EndPagePrinter(h_printer)
            if not ok:
                err = ctypes.get_last_error()
                return False, f"Gagal menulis data ke printer (Error code: {err})"
        finally:
            winspool.EndDocPrinter(h_printer)
    finally:
        winspool.ClosePrinter(h_printer)
    return True, f"Tercetak {len(data)} byte ke printer '{printer_name}'"

def print_network_raw(host, port, data: bytes, timeout=5):
    try:
        with socket.create_connection((host, int(port)), timeout=timeout) as s:
            s.sendall(data)
        return True, f"Tercetak via TCP ke {host}:{port}"
    except Exception as e:
        return False, f"Printer TCP tidak terhubung ({host}:{port}): {e}"

def build_test_escpos():
    import datetime
    try:
        import zoneinfo
        wita = zoneinfo.ZoneInfo("Asia/Makassar")
        now_str = datetime.datetime.now(wita).strftime("%Y-%m-%d %H:%M:%S WITA")
    except Exception:
        now_str = (datetime.datetime.utcnow() + datetime.timedelta(hours=8)).strftime("%Y-%m-%d %H:%M:%S WITA")

    b = bytearray()
    b.extend([0x1B, 0x40])  # ESC @
    b.extend([0x1B, 0x61, 0x01])  # Center
    b.extend(b"\nKOMANEKA RECEIPT MEMORIES\n")
    b.extend(b"TEST CETAK THERMAL 80MM\n")
    b.extend(f"WAKTU: {now_str}\n".encode("utf-8"))
    b.extend(b"--------------------------------\n")
    b.extend(b"STATUS: PRINTER SIAP DIGUNAKAN\n")
    b.extend(b"--------------------------------\n\n")
    b.extend([0x1B, 0x64, 0x03])  # Feed 3
    b.extend([0x1D, 0x56, 0x41, 0x00])  # Cut
    return bytes(b)

class PhotoBoothHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def _send_json(self, data, status=200):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        url_path = self.path.split("?")[0]
        if url_path == "/api/config":
            self._send_json(load_config())
            return
        if url_path == "/api/templates":
            self._send_json({"ok": True, "templates": load_templates()})
            return
        if url_path == "/api/printer/list":
            printers = list_printers()
            self._send_json({"ok": True, "printers": printers})
            return
        super().do_GET()

    def do_POST(self):
        url_path = self.path.split("?")[0]
        content_len = int(self.headers.get("Content-Length", 0))
        body_bytes = self.rfile.read(content_len) if content_len > 0 else b""
        payload = {}
        if body_bytes:
            try:
                payload = json.loads(body_bytes.decode("utf-8"))
            except Exception:
                pass

        if url_path == "/api/config":
            ok, res = save_config(payload)
            self._send_json({"ok": ok, "config": res if ok else None, "error": None if ok else res})
            return
        if url_path == "/api/templates":
            tpls = payload.get("templates")
            if isinstance(tpls, list):
                ok, err = save_templates(tpls)
                self._send_json({"ok": ok, "error": err})
            else:
                self._send_json({"ok": False, "error": "Invalid templates data"}, status=400)
            return

        if url_path == "/api/printer/list":
            printers = list_printers()
            self._send_json({"ok": True, "printers": printers})
            return

        if url_path == "/api/print":
            cfg = load_config().get("print", {})
            conn = payload.get("connection") or cfg.get("connection", "driver")
            name = payload.get("name") or cfg.get("name", "EPSON TM-T82II Receipt")
            ip = payload.get("ip") or cfg.get("ip", "192.168.71.10")
            port = int(payload.get("port") or cfg.get("port", 9100))
            raw_b64 = payload.get("raw")
            if not raw_b64:
                self._send_json({"ok": False, "error": "Parameter 'raw' ESC/POS base64 wajib diisi"}, status=400)
                return
            try:
                data = base64.b64decode(raw_b64)
            except Exception as e:
                self._send_json({"ok": False, "error": f"Invalid base64: {e}"}, status=400)
                return

            if conn == "driver":
                ok, msg = print_windows_raw(name, data)
                self._send_json({"ok": ok, "info": msg if ok else None, "error": None if ok else msg})
            else:
                ok, msg = print_network_raw(ip, port, data)
                self._send_json({"ok": ok, "info": msg if ok else None, "error": None if ok else msg})
            return

        if url_path == "/api/printer/test":
            cfg = load_config().get("print", {})
            conn = payload.get("connection") or cfg.get("connection", "driver")
            name = payload.get("name") or cfg.get("name", "EPSON TM-T82II Receipt")
            ip = payload.get("ip") or cfg.get("ip", "192.168.71.10")
            port = int(payload.get("port") or cfg.get("port", 9100))

            test_data = build_test_escpos()
            if conn == "driver":
                ok, msg = print_windows_raw(name, test_data)
                self._send_json({"ok": ok, "info": msg if ok else None, "error": None if ok else msg})
            else:
                ok, msg = print_network_raw(ip, port, test_data)
                self._send_json({"ok": ok, "info": msg if ok else None, "error": None if ok else msg})
            return

        super().do_POST()

def run_https_server():
    ensure_ssl_certs()
    os.chdir(os.path.dirname(os.path.abspath(__file__)))

    server_address = ("0.0.0.0", PORT)
    handler = PhotoBoothHandler
    httpd = http.server.HTTPServer(server_address, handler)

    ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ssl_context.load_cert_chain(certfile=CERT_FILE, keyfile=KEY_FILE)
    httpd.socket = ssl_context.wrap_socket(httpd.socket, server_side=True)

    local_ips = get_local_ips()
    print("=" * 65)
    print("  KOMANEKA RECEIPT MEMORIES // HTTPS PHOTOBOOTH SERVER AKTIF")
    print("=" * 65)
    print("Buka di Browser Komputer ini:")
    print(f"  -> https://localhost:{PORT}")
    print(f"  -> https://127.0.0.1:{PORT}")
    print("\nBuka di Browser HP / Tablet (Harus satu Wi-Fi):")
    for ip in local_ips:
        if ip != "127.0.0.1":
            print(f"  -> https://{ip}:{PORT}")
    print("-" * 65)
    print("PETUNJUK AKSES DI HP:")
    print("1. Buka link https://<IP_DI_ATAS>:8443 di browser Chrome / Safari HP.")
    print("2. Saat muncul peringatan 'Your connection is not private / Lanjutan',")
    print("   klik 'Advanced / Lanjutan' lalu pilih 'Proceed / Lanjutkan ke situs'.")
    print("3. Izin kamera akan otomatis muncul dan kamera HP siap digunakan!")
    print("=" * 65)
    print("Tekan Ctrl+C untuk menghentikan server.\n")

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer dihentikan.")
        httpd.server_close()

if __name__ == "__main__":
    run_https_server()
