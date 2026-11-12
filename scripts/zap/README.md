# SpeakUp Payatas — Security Pentesting Guide (OWASP ZAP)

This directory contains automated and manual penetration testing resources for the **SpeakUp Payatas** system using [OWASP ZAP (Zed Attack Proxy)](https://www.zaproxy.org/).

---

## 1. Automated DAST Pentesting (Docker)

Ensure your Next.js server is running locally:
```powershell
npm run dev
# or
npm run start
```

Run the automated scan:
```powershell
.\scripts\zap\run-zap-scan.ps1
```

Or run Docker directly:
```powershell
docker run --rm -v ${PWD}/reports/zap:/zap/wrk/:rw -t zaproxy/zap-stable `
  zap-baseline.py -t http://host.docker.internal:3000 -r zap-report.html -I
```

The scan automatically tests for:
- **OWASP Top 10 Security Flaws**:
  - Reflected & Persistent Cross-Site Scripting (XSS)
  - SQL & Command Injections
  - Insecure Direct Object References (IDOR)
  - Cross-Site Request Forgery (CSRF)
- **Security Headers & Cookies**:
  - Missing `Content-Security-Policy` (CSP)
  - Missing `X-Content-Type-Options: nosniff`
  - Insecure / missing `SameSite`, `Secure`, and `HttpOnly` flags on session cookies
- **Information Leakage**:
  - Exposed source maps or debug routes
  - Verbose error disclosures

---

## 2. Interactive Authenticated Pentest (ZAP GUI)

To test role-based access control (RBAC) across **Resident**, **Staff**, and **Admin** portals:

1. Download and install **OWASP ZAP GUI** from [zaproxy.org/download](https://www.zaproxy.org/download/).
2. Open ZAP -> **Manual Explore**.
3. Set the target to `http://localhost:3000` and check **Enable HUD** (Heads Up Display).
4. Launch the browser and log in as:
   - A regular resident
   - A barangay staff member
   - A super admin
5. In the ZAP Sites tree, right-click `/api/reports/intake` or `/admin/users` and select **Attack -> Active Scan**.
6. Check the **Alerts** tab for any unauthorized escalation or data leaks.

