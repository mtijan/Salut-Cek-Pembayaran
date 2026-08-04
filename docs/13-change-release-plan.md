# Change dan Release Plan

## Tujuan

Dokumen ini mengatur perubahan, versioning, release, rollback, dan catatan operasional agar sistem tetap terkendali selama berkembang.

## Branching Strategy

| Branch | Fungsi |
|---|---|
| `main` | Source production-ready. |
| `feature/*` | Pengembangan fitur. |
| `fix/*` | Perbaikan bug. |
| `docs/*` | Perubahan dokumentasi. |

## Versioning

Gunakan Semantic Versioning:

| Jenis | Contoh | Kapan |
|---|---|---|
| Major | `1.0.0` | Perubahan besar atau breaking change. |
| Minor | `0.2.0` | Fitur baru backward-compatible. |
| Patch | `0.2.1` | Bug fix. |

MVP awal dapat memakai versi `0.x.x` sampai production stabil.

## Release Checklist

| Check | Required |
|---|---:|
| Requirement terkait sudah update. | Ya |
| API contract update bila endpoint berubah. | Ya |
| Database migration review. | Ya bila ada DB change |
| Security impact dinilai. | Ya |
| Test relevan lulus. | Ya |
| Build production lulus. | Ya |
| Staging deployment dicek. | Ya |
| UAT selesai untuk fitur user-facing. | Ya |
| Rollback plan tersedia. | Ya |
| Changelog ditulis. | Ya |

## Changelog Template

```markdown
## [0.1.0] - YYYY-MM-DD

### Added
- 

### Changed
- 

### Fixed
- 

### Security
- 

### Migration
- 

### Verification
- 
```

## Release Notes Template

```markdown
# Release 0.1.0

Tanggal:
Environment:
Deployment URL:
Commit:

## Ringkasan

## Perubahan User-Facing

## Perubahan Admin/Ops

## Database Migration

## Verification

## Known Issues

## Rollback Plan
```

## Change Request Template

```markdown
# Change Request

## Judul

## Latar Belakang

## Requirement Terkait

## Dampak User

## Dampak Database/API

## Dampak Security/Privacy

## Test yang Dibutuhkan

## Keputusan
Approved/Rejected/Deferred
```

## Rollback Standard

| Jenis Perubahan | Rollback |
|---|---|
| UI only | Rollback service VPS ke release sebelumnya. |
| API only | Rollback service VPS ke release sebelumnya dan pastikan backward compatibility. |
| Database additive | Rollback aplikasi bila migration aman tetap ada. |
| Database destructive | Stop service, restore backup SQLite, atau jalankan migration balik yang sudah diuji. |
| Import data | Nonaktifkan batch, koreksi data, atau restore dari snapshot. |

## Documentation Maintenance

| Perubahan | Dokumen yang Wajib Dicek |
|---|---|
| Fitur baru | Product requirements, traceability, test plan. |
| Endpoint baru/berubah | API contract, test plan. |
| Tabel/kolom berubah | Database design, deployment plan. |
| Kontrol security berubah | Security design, risk register. |
| Flow admin berubah | Admin operations, diagrams. |
| Release production | Change/release plan, README bila perlu. |
