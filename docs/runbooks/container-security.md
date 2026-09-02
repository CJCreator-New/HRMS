# Operational Runbook: Container Security & Image Maintenance

**Target Audience**: DevOps, Release Engineers, Security Team  
**Classification**: Enterprise Standard Operating Procedure (SOP)  
**Last Updated**: 2026-09-01  

---

## 1. Container Scanning Policy

All container images built from `Dockerfile` are automatically scanned in CI via **Aqua Security Trivy**:
- **Severity Gate**: Any `CRITICAL` vulnerability without a known fix or with an available upstream patch fails the CI pipeline.
- **SBOM Generation**: A Software Bill of Materials in SPDX JSON standard format is automatically generated per release build (`sbom.spdx.json`).
- **Base Image**: Uses official `node:20-alpine` minimal distribution to minimize attack surface.

---

## 2. Rebuild Cadence & Patching

1. **Bi-Weekly Base Image Rebuild**:
   - Every two weeks on Tuesday 02:00 UTC, base images are rebuilt against upstream Alpine security repositories to incorporate kernel and library patches (OpenSSL, musl, zlib).
2. **Weekly Dependency Refresh**:
   - `npm audit --audit-level=high` runs on every pull request. Dependabot or Renovate creates weekly pull requests for minor/patch dependencies.
3. **Zero-Day Emergency Rebuild**:
   - Upon release of a CVE with CVSS >= 9.0 affecting Node.js or Alpine base packages, trigger `.github/workflows/ci.yml` immediately with a forced base image pull (`--no-cache`).

---

## 3. Local Verification

To run container scanning locally before opening a pull request:

```bash
# 1. Build image locally
docker build -t hrms-app:local .

# 2. Run Trivy vulnerability scan
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy:latest image --severity CRITICAL hrms-app:local

# 3. Generate SBOM
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy:latest image --format spdx-json --output sbom.json hrms-app:local
```
