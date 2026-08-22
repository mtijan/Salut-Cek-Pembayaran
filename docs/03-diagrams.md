# Diagram Sistem

> Status audit 2026-08-21: diagram menggabungkan implementasi aktif dan target desain. Node pengelolaan akun admin, pembacaan audit log, CRUD jenis tagihan, dan konfigurasi lanjutan adalah planned. Payment history berada di working tree tetapi endpoint read masih terblokir salah permission. Lihat `docs/14-codebase-audit-mitigation-plan.md` sebelum memakai diagram sebagai bukti operasional.

Diagram menggunakan Mermaid agar dapat dirender di GitHub, VS Code, atau dokumentasi statis.

> Diagram yang menyebut CRUD mahasiswa/tagihan kini mewakili fitur aktif. Diagram untuk `payment_methods`, `bill_imports`, dan konfigurasi lanjutan tetap target rilis berikutnya; status aktual ada pada `docs/12-traceability-matrix.md`.

## Daftar Diagram

| Jenis | Tujuan |
|---|---|
| System Context Diagram | Menjelaskan batas sistem dan aktor eksternal. |
| Use Case Diagram | Menjelaskan fungsi utama per aktor. |
| DFD Level 0 | Menjelaskan aliran data tingkat konteks. |
| DFD Level 1 | Menjelaskan aliran data internal proses utama. |
| Activity Diagram Lookup | Menjelaskan keputusan dan aktivitas saat mahasiswa mengecek tagihan. |
| Activity Diagram Import | Menjelaskan aktivitas validasi, preview, dan commit data tagihan. |
| BPMN-style Business Process | Menjelaskan kolaborasi proses antara mahasiswa, sistem, dan admin. |
| User Flow Mahasiswa | Menjelaskan perjalanan mahasiswa saat cek tagihan. |
| User Flow Admin Import | Menjelaskan proses admin saat import data. |
| Sequence Diagram Lookup | Menjelaskan urutan request lookup tagihan. |
| Sequence Diagram Admin Import | Menjelaskan urutan request import tagihan. |
| Sequence Diagram Admin Kelola Data | Menjelaskan alur query terpaginasi dan soft delete data dengan alasan. |
| Sequence Diagram Hapus File Import | Menjelaskan alur soft delete seluruh tagihan per file import dan pembersihan issue. |
| ERD | Menjelaskan relasi entity database. |
| UML-style Class Diagram | Menjelaskan struktur domain object utama. |
| Deployment Diagram | Menjelaskan penempatan komponen di platform. |
| UML-style Component Diagram | Menjelaskan modul aplikasi dan dependency. |
| C4 Container Diagram | Menjelaskan container aplikasi dan hubungan antarplatform. |
| State Diagram Tagihan | Menjelaskan transisi status tagihan. |
| Security Flow | Menjelaskan alur kontrol keamanan publik dan admin. |
| Data Lifecycle Diagram | Menjelaskan siklus data dari sumber hingga retensi atau penghapusan. |
| Data Privacy Flow | Menjelaskan minimisasi, hashing, dan akses data pribadi. |
| Authentication and Authorization Flow | Menjelaskan autentikasi session dan pemeriksaan role admin. |
| Import Validation Decision Tree | Menjelaskan keputusan validasi file sebelum data disimpan. |
| Backup and Recovery Flow | Menjelaskan jalur pemulihan berdasarkan jenis insiden. |
| CI/CD Pipeline Diagram | Menjelaskan alur perubahan dari branch hingga rilis produksi. |
| Sitemap / Information Architecture | Menjelaskan hierarki halaman publik dan admin. |

## System Context Diagram

```mermaid
flowchart LR
    Student[Mahasiswa UT SALUT Awwabin]
    Admin[Admin SALUT]
    SuperAdmin[Super Admin]
    Web[Salut Cek Pembayaran Web]
    VPS[VPS Hosting and API]
    SQLite[(SQLite)]
    Auth[Internal Auth]
    Storage[Filesystem VPS]

    Student -->|Cek tagihan| Web
    Admin -->|Kelola data| Web
    SuperAdmin -.->|Planned: kelola admin dan konfigurasi| Web
    Web --> VPS
    VPS -->|Query server-side| SQLite
    VPS -->|Admin session| Auth
    VPS -->|File import opsional| Storage
```

## DFD Level 0

```mermaid
flowchart LR
    Student[Mahasiswa]
    Admin[Admin SALUT]
    System((Salut Cek Pembayaran))
    StudentData[(Data Mahasiswa)]
    BillData[(Data Tagihan)]
    ImportIssues[(Data Perlu Diperbaiki)]
    AuditData[(Audit dan Lookup Log)]

    Student -->|NIM| System
    System -->|Tagihan dan instruksi pembayaran aman| Student
    Admin -->|Data mahasiswa, tagihan, batas aktif, status, file import| System
    System -->|Preview import, laporan, audit| Admin
    System <--> StudentData
    System <--> BillData
    System <--> ImportIssues
    System --> AuditData
```

## DFD Level 1

```mermaid
flowchart TD
    Student[Mahasiswa]
    Admin[Admin SALUT]
    P1((1. Validasi Lookup Publik))
    P2((2. Ambil Tagihan))
    P3((3. Kelola Data Admin))
    P4((4. Import Tagihan))
    P5((5. Audit dan Logging))
    D1[(students)]
    D2[(bills)]
    D3[(import_issues)]
    D4[(admin_users dan admin_sessions)]
    D5[(lookup_logs dan audit_logs)]

    Student -->|NIM| P1
    P1 -->|Data valid| P2
    P1 -->|Lookup attempt| P5
    P2 <--> D1
    P2 <--> D2
    P2 <--> D3
    P2 -->|Response hasil lookup| Student

    Admin -->|CRUD request| P3
    P3 <--> D1
    P3 <--> D2
    P3 <--> D3
    P3 --> P5

    Admin -->|XLSX| P4
    P4 <--> D4
    P4 -->|Upsert valid rows| D1
    P4 -->|Upsert valid rows| D2
    P4 --> P5
    P5 --> D5
```

## Use Case Diagram

```mermaid
flowchart TB
    Student[Mahasiswa]
    Admin[Admin]
    SuperAdmin[Super Admin]

    UC1((Cek tagihan))
    UC2((Lihat cara pembayaran))
    UC3((Login admin))
    UC4((Kelola mahasiswa))
    UC5((Kelola tagihan))
    UC6((Import tagihan))
    UC7((Kelola metode pembayaran))
    UC8((Planned: lihat audit log))
    UC9((Planned: kelola admin))
    UC10((Planned: kelola konfigurasi))

    Student --> UC1
    Student --> UC2
    Admin --> UC3
    Admin --> UC4
    Admin --> UC5
    Admin --> UC6
    Admin --> UC7
    Admin --> UC8
    SuperAdmin --> UC9
    SuperAdmin --> UC10
    SuperAdmin --> UC8
```

## User Flow Mahasiswa

```mermaid
flowchart TD
    A[Buka halaman cek tagihan] --> B[Input NIM]
    B --> D{Format valid?}
    D -->|Tidak| E[Tampilkan validasi form]
    D -->|Ya| F[Kirim request lookup]
    F --> G{Rate limit aman?}
    G -->|Tidak| H[Tampilkan pesan coba lagi]
    G -->|Ya| I{Data cocok?}
    I -->|Tidak| J[Tampilkan pesan data tidak ditemukan]
    I -->|Ya| K[Tampilkan NIM dan tagihan]
    K --> L[Tampilkan instruksi pembayaran]
```

## User Flow Admin Import

```mermaid
flowchart TD
    A[Admin login] --> B[Buka menu Import Tagihan]
    B --> C[Upload XLSX]
    C --> D[Validasi struktur file]
    D --> E{Ada error?}
    E -->|Ya| F[Tampilkan error per baris]
    E -->|Tidak| G[Tampilkan preview ringkasan]
    G --> H{Admin konfirmasi?}
    H -->|Tidak| I[Batalkan import]
    H -->|Ya| J[Buat batch import]
    J --> K[Upsert mahasiswa dan tagihan]
    K --> L[Tulis audit log]
    L --> M[Tampilkan hasil import]
```

## Sequence Diagram Lookup Tagihan

```mermaid
sequenceDiagram
    actor Student as Mahasiswa
    participant UI as Frontend Public UI
    participant API as API /api/lookup
    participant DB as SQLite
    participant Log as Audit/Lookup Log

    Student->>UI: Input NIM
    UI->>API: POST lookup
    API->>API: Validasi format dan rate limit
    API->>DB: Cari mahasiswa dan tagihan aktif
    DB-->>API: Data mahasiswa dan tagihan
    API->>API: Susun response terbatas
    API->>Log: Simpan lookup log
    API-->>UI: Response aman
    UI-->>Student: Tampilkan tagihan dan cara bayar
```

## Sequence Diagram Admin Import

```mermaid
sequenceDiagram
    actor Admin
    participant UI as Admin UI
    participant API as Import API
    participant Auth as Internal Auth
    participant DB as SQLite
    participant Storage as Filesystem VPS

    Admin->>UI: Upload file (.xlsx)
    UI->>API: POST /api/admin/import/preview
    API->>Auth: Validasi session dan role
    Auth-->>API: Authorized
    API->>API: Parse ZIP/XML & validasi layout
    API-->>UI: Preview ringkasan & error rows
    Admin->>UI: Konfirmasi commit import
    UI->>API: POST /api/admin/import/commit
    API->>DB: Validasi token preview
    API->>DB: Upsert data mahasiswa dan tagihan
    API->>DB: Simpan import issues (jika ada)
    API->>DB: Insert audit log
    API-->>UI: Hasil commit berhasil
```

## Sequence Diagram Admin Kelola Data & Soft Delete

```mermaid
sequenceDiagram
    actor Admin
    participant UI as Admin UI (Data Mahasiswa)
    participant API as Admin API (/api/admin/bills, /api/admin/students)
    participant Auth as Internal Auth
    participant DB as SQLite
    participant Audit as Audit Log

    Admin->>UI: Buka menu Data Mahasiswa
    UI->>API: GET /api/admin/bills?query=&status=&source=&limit=100&offset=0
    API->>Auth: Validasi session admin
    Auth-->>API: Authorized
    API->>DB: Query bills dengan filter & paginasi
    DB-->>API: Data bills & pagination meta
    API-->>UI: Render tabel paginasi

    Admin->>UI: Tekan Hapus Tagihan/Mahasiswa
    UI->>UI: Tampilkan modal alasan penghapusan
    Admin->>UI: Masukkan alasan & konfirmasi
    UI->>API: DELETE /api/admin/bills/{id} {"reason": "..."}
    API->>Auth: Validasi session & permission manage_data
    Auth-->>API: Authorized
    API->>DB: UPDATE bills SET deleted_at=NOW, deleted_by=admin_id, delete_reason=reason WHERE id=bill_id
    API->>Audit: INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
    API-->>UI: Response sukses soft delete
    UI->>UI: Refresh tabel data mahasiswa
```

## Sequence Diagram Hapus File Import

```mermaid
sequenceDiagram
    actor Admin
    participant UI as Admin UI (Data Mahasiswa per File)
    participant API as Admin API (/api/admin/imported-files)
    participant Auth as Internal Auth
    participant DB as SQLite
    participant Audit as Audit Log

    Admin->>UI: Buka menu Data Mahasiswa per File
    UI->>API: GET /api/admin/imported-bills
    API->>Auth: Validasi session admin
    API->>DB: Grouping tagihan per source_file
    DB-->>API: List kartu file import & statistik status
    API-->>UI: Render kartu file import

    Admin->>UI: Tekan Hapus File pada kartu
    UI->>UI: Modal input alasan penghapusan file
    Admin->>UI: Isi alasan & konfirmasi hapus
    UI->>API: DELETE /api/admin/imported-files {"file_name": "...", "reason": "..."}
    API->>Auth: Validasi session & permission manage_data
    API->>DB: Soft delete semua tagihan dengan source_file terkait
    API->>DB: DELETE FROM import_issues WHERE source_file=file_name
    API->>Audit: INSERT INTO audit_logs (action="delete_imported_file", metadata)
    API-->>UI: Response sukses {deleted_bills: N}
    UI->>UI: Hapus kartu file dari tampilan
```

## ERD

```mermaid
erDiagram
    STUDY_PROGRAMS ||--o{ STUDENTS : has_students
    STUDENTS ||--o{ BILLS : has_bills
    ACADEMIC_PERIODS ||--o{ BILLS : categorized_under
    BILL_TYPES ||--o{ BILLS : typed_as
    BILLS ||--o{ PAYMENT_TRANSACTIONS : has_transactions
    STUDENTS ||--o{ PAYMENT_TRANSACTIONS : has_payment_history
    STUDENTS ||--o{ LOOKUP_LOGS : searched_as_hash
    ADMIN_USERS ||--o{ ADMIN_SESSIONS : owns
    ADMIN_USERS ||--o{ IMPORT_PREVIEWS : creates
    ADMIN_USERS ||--o{ AUDIT_LOGS : performs

    STUDY_PROGRAMS {
        text id PK
        text code UK
        text name
        text degree
        text faculty
        integer is_active
        text created_at
        text updated_at
    }

    ACADEMIC_PERIODS {
        text id PK
        text code UK
        text name
        text semester_type
        integer is_active
        text default_due_date
        text created_at
        text updated_at
    }

    BILL_TYPES {
        text id PK
        text code UK
        text name
        integer default_amount
        integer is_active
        text created_at
    }

    STUDENTS {
        text id PK
        text nim UK
        text full_name
        text name_norm
        text no_ktp
        text tempat_lahir
        text tanggal_lahir
        text nama_ibu_kandung
        text program_study
        text study_program_id FK
        text academic_status
        integer entry_year
        text entry_semester
        text entry_period
        text email
        text address
        text initial_registration
        text phone_number
        text deleted_at
        text deleted_by
        text delete_reason
        text created_at
        text updated_at
    }

    BILLS {
        text id PK
        text student_id FK
        text briva
        integer amount
        text period
        text bill_type
        text status
        text payment_method
        text instructions
        text due_date
        text source_file
        integer source_row_number
        text deleted_at
        text deleted_by
        text delete_reason
        text created_at
        text updated_at
    }

    LOOKUP_LOGS {
        text id PK
        text nim_hash
        text name_hash
        text result_type
        text created_at
    }

    IMPORT_ISSUES {
        text id PK
        text sheet_name
        integer row_number
        text nim
        text full_name
        text briva
        text amount
        text note
        text source_file
        text created_at
    }

    IMPORT_PREVIEWS {
        text token PK
        text admin_id FK
        text file_name
        text stored_path
        text expires_at
        text created_at
    }

    ADMIN_USERS {
        text id PK
        text email UK
        text password_hash
        text full_name
        text role
        integer is_active
        text created_at
        text updated_at
    }

    ADMIN_SESSIONS {
        text id PK
        text admin_id FK
        text token_hash UK
        text expires_at
        text created_at
    }

    AUDIT_LOGS {
        text id PK
        text actor_id FK
        text action
        text entity_type
        text entity_id
        text metadata
        text created_at
    }

    PAYMENT_TRANSACTIONS {
        text id PK
        text bill_id FK
        text student_id FK
        text transaction_type
        integer amount
        integer running_paid_total
        text previous_status
        text new_status
        text payment_date
        text payment_method
        text reference_number
        text notes
        text recorded_by FK
        text source
        text created_at
    }
```

## UML-style Class Diagram

```mermaid
classDiagram
    class StudyProgram {
        +string id
        +string code
        +string name
        +string degree
        +string faculty
        +int isActive
    }

    class AcademicPeriod {
        +string id
        +string code
        +string name
        +string semesterType
        +int isActive
        +string defaultDueDate
    }

    class BillType {
        +string id
        +string code
        +string name
        +int defaultAmount
        +int isActive
    }

    class Student {
        +string id
        +string nim
        +string fullName
        +string nameNorm
        +string programStudy
        +string studyProgramId
        +string academicStatus
        +int entryYear
        +string email
        +string address
        +string initialRegistration
        +string phoneNumber
        +string deletedAt
        +string deleteReason
    }

    class Bill {
        +string id
        +string studentId
        +string briva
        +int amount
        +int paidAmount
        +string period
        +string billType
        +string status
        +string paymentMethod
        +string instructions
        +string dueDate
        +string sourceFile
        +int sourceRowNumber
        +string deletedAt
        +string deleteReason
    }

    class ImportPreview {
        +string token
        +string adminId
        +string fileName
        +string storedPath
        +string expiresAt
    }

    class ImportIssue {
        +string id
        +string sheetName
        +int rowNumber
        +string nim
        +string fullName
        +string briva
        +string amount
        +string note
        +string sourceFile
    }

    class AdminUser {
        +string id
        +string email
        +string passwordHash
        +string fullName
        +string role
        +int isActive
    }

    class AdminSession {
        +string id
        +string adminId
        +string tokenHash
        +string expiresAt
    }

    class LookupLog {
        +string id
        +string nimHash
        +string nameHash
        +string resultType
        +string createdAt
    }

    class AuditLog {
        +string id
        +string actorId
        +string action
        +string entityType
        +string entityId
        +string metadata
        +string createdAt
    }

    StudyProgram "1" --> "0..*" Student
    Student "1" --> "0..*" Bill
    AdminUser "1" --> "0..*" AdminSession
    AdminUser "1" --> "0..*" ImportPreview
    AdminUser "1" --> "0..*" AuditLog
```

## Deployment Diagram

```mermaid
flowchart LR
    Browser[Browser Mahasiswa/Admin]
    CDN[Nginx/Caddy reverse proxy]
    Next[Python Backend and Static Frontend]
    Env[environment file/server secrets di VPS]
    DB[(SQLite)]
    Auth[Internal Auth]
    Storage[Filesystem VPS]
    Logs[VPS app logs and audit logs]

    Browser --> CDN
    CDN --> Next
    Next --> Env
    Next --> DB
    Next --> Auth
    Next --> Storage
    Next --> Logs
```

## UML-style Component Diagram

```mermaid
flowchart LR
    subgraph Client[Browser Client]
        PublicUI[Public Lookup UI (HTML/Vanilla JS)]
        AdminSPA[Admin Workspace SPA (React + Vite)]
    end

    subgraph VPS[Backend on VPS]
        PublicAPI[Public Lookup API]
        AdminAPI[Admin & SIAKAD API]
        ImportAPI[Import & Validation API]
        Masking[Data Minimization and Validation]
        RateLimit[Rate Limiter]
        SPAServer[Static SPA File Server]
    end

    subgraph ServerData[Server Data Layer]
        Auth[Internal Auth & RBAC]
        DB[(SQLite salut.sqlite)]
        Storage[File Uploads / Storage]
    end

    PublicUI --> PublicAPI
    AdminSPA --> AdminAPI
    AdminSPA --> ImportAPI
    SPAServer --> AdminSPA
    PublicAPI --> RateLimit
    PublicAPI --> Masking
    PublicAPI --> DB
    AdminAPI --> Auth
    AdminAPI --> DB
    ImportAPI --> Auth
    ImportAPI --> Storage
    ImportAPI --> DB
```

## State Diagram Tagihan

```mermaid
stateDiagram-v2
    [*] --> unpaid: Import / Tambah Data
    unpaid --> partial: Admin catat cicilan / bayar sebagian
    partial --> unpaid: Admin reset status
    unpaid --> paid: Admin konfirmasi lunas
    partial --> paid: Admin konfirmasi lunas
    paid --> unpaid: Koreksi status admin
    paid --> partial: Koreksi status admin
    
    unpaid --> soft_deleted: Hapus tagihan / Hapus file (dengan alasan)
    partial --> soft_deleted: Hapus tagihan / Hapus file (dengan alasan)
    paid --> soft_deleted: Hapus tagihan / Hapus file (dengan alasan)
```

## Security Flow

```mermaid
flowchart TD
    A[Request publik] --> B[Validasi input]
    B --> C[CAPTCHA atau rate limit]
    C --> D{Aman?}
    D -->|Tidak| E[Reject 429]
    D -->|Ya| F[Server-side lookup]
    F --> G[Susun response terbatas]
    G --> H[Tulis lookup log]
    H --> I[Kirim response]

    J[Request admin] --> K[Validasi internal session]
    K --> L[Validasi role]
    L --> M{Authorized?}
    M -->|Tidak| N[Reject 401/403]
    M -->|Ya| O[Execute action]
    O --> P[Tulis audit log]
```

## Activity Diagram Lookup Tagihan

```mermaid
flowchart TD
    Start([Mulai]) --> Input[Mahasiswa isi NIM]
    Input --> Validate{Format input valid?}
    Validate -->|Tidak| Invalid[Tampilkan validasi form]
    Validate -->|Ya| Rate{Rate limit aman?}
    Rate -->|Tidak| Limited[Tampilkan pesan coba lagi]
    Rate -->|Ya| Match{NIM ditemukan?}
    Match -->|Tidak| NotFound[Tampilkan pesan generik]
    Match -->|Ya| Fetch[Ambil tagihan dan instruksi pembayaran]
    Fetch --> Mask[Susun informasi mahasiswa dan tagihan]
    Mask --> Log[Tulis lookup log]
    Log --> Result[Tampilkan hasil]
    Invalid --> End([Selesai])
    Limited --> End
    NotFound --> End
    Result --> End
```

## Activity Diagram Import Tagihan

```mermaid
flowchart TD
    Start([Mulai]) --> Login[Admin login]
    Login --> Upload[Upload XLSX]
    Upload --> Parse[Parse file]
    Parse --> Validate[Validasi header dan setiap baris]
    Validate --> HasError{Ada error kritis?}
    HasError -->|Ya| ErrorList[Tampilkan error per baris]
    ErrorList --> Fix[Admin memperbaiki file]
    Fix --> Upload
    HasError -->|Tidak| Preview[Tampilkan preview]
    Preview --> Confirm{Admin konfirmasi commit?}
    Confirm -->|Tidak| Cancel[Batalkan import]
    Confirm -->|Ya| Batch[Buat batch import]
    Batch --> Upsert[Upsert mahasiswa dan tagihan]
    Upsert --> Audit[Tulis audit log]
    Audit --> Done[Tampilkan ringkasan hasil]
    Cancel --> End([Selesai])
    Done --> End
```

## BPMN-style Business Process Diagram

Diagram ini menggunakan swimlane Mermaid untuk merepresentasikan kolaborasi proses bisnis tingkat tinggi.

```mermaid
flowchart LR
    subgraph Mahasiswa
        M1[Butuh informasi tagihan] --> M2[Masukkan NIM]
        M3[Terima tagihan dan instruksi] --> M4[Lakukan pembayaran]
    end

    subgraph Sistem
        S1[Validasi lookup] --> S2[Ambil data terbatas]
        S2 --> S3[Tampilkan tagihan]
    end

    subgraph Admin
        A1[Terima data tagihan] --> A2[Import atau perbarui data]
        A2 --> A3[Monitor dan koreksi data]
    end

    A2 --> S1
    M2 --> S1
    S3 --> M3
    M4 --> A3
```

## C4 Container Diagram

```mermaid
flowchart TB
    Student[Mahasiswa]
    Admin[Admin SALUT]

    subgraph System[Salut Cek Pembayaran]
        Web[Static Frontend]
        API[Python API Routes]
        Import[Import Processor]
    end

    subgraph VPSData[Data and File Layer on VPS]
        Auth[Internal Auth]
        DB[(SQLite Database)]
        Storage[(File Uploads)]
    end

    Student -->|HTTPS| Web
    Admin -->|HTTPS| Web
    Web -->|JSON over HTTPS| API
    API -->|Validate internal admin session| Auth
    API -->|Prepared SQL query| DB
    API --> Import
    Import -->|Read optional source file| Storage
    Import -->|Upsert validated rows| DB
```

## Data Lifecycle Diagram

```mermaid
flowchart LR
    Source[File sumber tagihan] --> Preview[Parse dan preview]
    Preview --> Commit[Commit batch terverifikasi]
    Commit --> Active[(Database aktif)]
    Active --> Lookup[Lookup publik NIM-only]
    Active --> Admin[Pengelolaan admin]
    Lookup --> LookupLog[(Lookup log ter-hash)]
    Admin --> AuditLog[(Audit log)]
    Active --> Retention{Masa retensi berakhir?}
    Retention -->|Belum| Active
    Retention -->|Ya| Archive[Arsip sesuai kebijakan]
    Archive --> Purge[Hapus secara terkendali]
    LookupLog --> LogPurge[Hapus log sesuai retensi]
    AuditLog --> AuditArchive[Arsip audit sesuai kebijakan]
```

## Data Privacy Flow Diagram

```mermaid
flowchart TD
    Raw[NIM, nama, dan tagihan] --> Server[API server-side]
    Server --> Verify[Verifikasi NIM]
    Server --> Minimize[Batasi response publik]
    Server --> Hash[Hash NIM dan IP untuk log]
    Verify --> Authorized{Kanal akses?}
    Authorized -->|Publik ditemukan| Public[NIM, nama, dan data pembayaran]
    Authorized -->|Admin berizin| Admin[Data sesuai role]
    Minimize --> Public
    Hash --> Logs[(Lookup logs)]
    Admin --> Audit[(Audit logs)]
```

## Authentication and Authorization Flow

```mermaid
sequenceDiagram
    actor Admin
    participant UI as Admin UI
    participant Auth as Internal Auth
    participant API as Admin API
    participant DB as SQLite

    Admin->>UI: Masukkan kredensial
    UI->>Auth: Login email dan password
    Auth-->>UI: Session token
    UI->>API: Request dengan session
    API->>Auth: Validasi session
    Auth-->>API: User terautentikasi
    API->>DB: Ambil role dan status admin
    DB-->>API: Role dan is_active
    API->>API: Periksa izin endpoint
    alt Role diizinkan dan akun aktif
        API-->>UI: Response berhasil
    else Tidak diizinkan
        API-->>UI: 401 atau 403
    end
```

## Import Validation Decision Tree

```mermaid
flowchart TD
    File[File import] --> Type{Tipe dan ukuran file valid?}
    Type -->|Tidak| Reject[Reject preview]
    Type -->|Ya| Header{Header wajib lengkap?}
    Header -->|Tidak| Reject
    Header -->|Ya| Rows{Semua baris valid?}
    Rows -->|Tidak| ShowErrors[Tampilkan error per baris]
    Rows -->|Ya| Duplicate{Ada duplikasi atau konflik?}
    Duplicate -->|Tidak| Preview[Siapkan preview]
    Duplicate -->|Ya| Mode{Konflik dapat di-upsert?}
    Mode -->|Tidak| ShowErrors
    Mode -->|Ya| Preview
    Preview --> Confirm{Admin konfirmasi?}
    Confirm -->|Tidak| Cancel[Batalkan]
    Confirm -->|Ya| Commit[Commit atomik]
    Commit --> Audit[Tulis audit log]
```

## Backup and Recovery Flow

```mermaid
flowchart TD
    Incident[Insiden terdeteksi] --> Classify{Jenis insiden?}
    Classify -->|Deploy bermasalah| Rollback[Rollback service VPS ke release sebelumnya]
    Classify -->|Import data salah| Correct[Nonaktifkan batch dan koreksi data]
    Classify -->|Database rusak| Restore[Restore file SQLite dari backup]
    Classify -->|Secret bocor| Rotate[Rotasi secret dan restart service]
    Rollback --> Verify[Verifikasi integritas dan smoke test]
    Correct --> Verify
    Restore --> Verify
    Rotate --> Verify
    Verify --> Healthy{Layanan sehat?}
    Healthy -->|Tidak| Escalate[Eskalasi dan lanjutkan recovery]
    Healthy -->|Ya| Report[Catat insiden dan tindak lanjut]
    Escalate --> Classify
```

## CI/CD Pipeline Diagram

```mermaid
flowchart LR
    Branch[Feature branch] --> PR[Pull request]
    PR --> Checks[Lint, test, dan build]
    Checks --> Passed{Checks lulus?}
    Passed -->|Tidak| Fix[Perbaiki perubahan]
    Fix --> Branch
    Passed -->|Ya| Staging[Deploy ke staging VPS]
    Staging --> Review[Code review dan UAT]
    Review --> Approved{Disetujui?}
    Approved -->|Tidak| Fix
    Approved -->|Ya| Merge[Merge ke main]
    Merge --> Production[Deploy production ke VPS]
    Production --> Smoke[Smoke test]
    Smoke --> Release[Release notes dan monitoring]
```

## Sitemap / Information Architecture

```mermaid
flowchart TD
    Public[Area Publik] --> Lookup[Cek Tagihan]
    Lookup --> Result[Hasil Tagihan]
    Result --> Payment[Instruksi Pembayaran BRIVA]
    Public --> Help[Bantuan & Panduan Pembayaran]

    AdminArea[Area Admin (React + Vite SPA)] --> Login[Login Admin]
    Login --> Dashboard[Dashboard & Metrik Realtime]
    Dashboard --> Students[Data Mahasiswa & Filter Prodi/Status]
    Students --> Student360[Student Profile 360]
    Dashboard --> Bills[Tagihan Mahasiswa & Status Switcher]
    Dashboard --> Reports[Rekap Keuangan per Prodi & Ekspor CSV]
    Dashboard --> ImportFiles[Data File Import & Batch Delete]
    Dashboard --> UploadWizard[Wizard Upload File Excel 3-Langkah]
    Dashboard --> MasterData[Master Data: Program Studi & Periode Akademik]
```

## Sequence Diagram Edit Tagihan & Bayar Sebagian

```mermaid
sequenceDiagram
    actor Admin
    participant UI as Admin SPA (BillsPage)
    participant API as FastAPI Backend (/api/admin/bills)
    participant Svc as Services (update_bill)
    participant DB as SQLite (bills, academic_periods)
    participant Audit as AuditLog

    Admin->>UI: Buka modal Edit Tagihan
    UI->>UI: Tampilkan identitas mahasiswa (read-only)
    UI->>UI: Inisialisasi dropdown Jenis Tagihan & Periode
    Admin->>UI: Pilih Status "Bayar Sebagian"
    UI->>UI: Tampilkan input nominal dibayar (paid_amount) & sisa real-time
    Admin->>UI: Masukkan paid_amount & submit
    UI->>API: PATCH /api/admin/bills/{id} (payload: amount, paid_amount, period, bill_type, status, etc.)
    API->>Svc: update_bill(db_path, bill_id, payload)
    Svc->>DB: Validasi tagihan & 0 < paid_amount < amount
    alt Periode adalah Custom baru
        Svc->>DB: Auto-register custom period ke academic_periods
    end
    Svc->>DB: UPDATE bills SET amount=?, paid_amount=?, status=?, period=?, ...
    Svc->>Audit: Tulis audit log bill.update
    Svc-->>API: Row tagihan terupdate
    API-->>UI: 200 Success Response (bill data with remaining_amount)
    UI->>Admin: Tampilkan notifikasi sukses & perbarui tabel
```

## Activity Diagram Edit Tagihan Mahasiswa

```mermaid
flowchart TD
    Start([Mulai]) --> OpenModal[Admin klik Edit Tagihan]
    OpenModal --> RenderInfo[Sistem menampilkan info mahasiswa read-only]
    RenderInfo --> SelectType[Admin pilih Jenis Tagihan]
    SelectType --> IsCustomType{Jenis = Custom?}
    IsCustomType -->|Ya| InputCustomType[Input nama jenis tagihan kustom]
    IsCustomType -->|Tidak| SelectPeriod[Admin pilih Periode Akademik]
    InputCustomType --> SelectPeriod
    SelectPeriod --> IsCustomPeriod{Periode = Custom?}
    IsCustomPeriod -->|Ya| InputCustomPeriod[Input kode periode kustom]
    IsCustomPeriod -->|Tidak| SelectStatus[Admin pilih Status Pembayaran]
    InputCustomPeriod --> SelectStatus
    SelectStatus --> CheckStatus{Status = Bayar Sebagian?}
    CheckStatus -->|Ya| InputPaidAmount[Admin masukkan nominal yang dibayar]
    InputPaidAmount --> CalcRemain[Sistem hitung sisa tagihan real-time]
    CheckStatus -->|Tidak| Submit[Admin klik Simpan Tagihan]
    CalcRemain --> ValidatePaid{0 < paid_amount < amount?}
    ValidatePaid -->|Tidak| ShowValErr[Tampilkan error validasi nominal]
    ShowValErr --> InputPaidAmount
    ValidatePaid -->|Ya| Submit
    Submit --> SaveDB[(Simpan update ke database)]
    SaveDB --> RecordTx[Catat payment_transaction]
    RecordTx --> WriteAudit[Catat ke audit_logs]
    WriteAudit --> Notify[Tampilkan notifikasi sukses]
    Notify --> End([Selesai])
```

## Sequence Diagram Pencatatan Transaksi Pembayaran

```mermaid
sequenceDiagram
    actor Admin
    participant UI as Admin SPA
    participant API as FastAPI Backend
    participant Svc as Services
    participant DB as SQLite

    Admin->>UI: Ubah status tagihan (misal unpaid -> partial)
    UI->>API: POST /api/admin/bills/status
    API->>Svc: update_bill_status(bill_id, status, paid_amount)
    Svc->>DB: SELECT current bill (status, paid_amount)
    DB-->>Svc: old_status=unpaid, old_paid=0
    Svc->>DB: UPDATE bills SET status=partial, paid_amount=500000
    Svc->>Svc: Hitung transaction_type, amount delta
    Svc->>DB: INSERT INTO payment_transactions (type=payment, amount=500000, running_total=500000, prev=unpaid, new=partial)
    Svc->>DB: INSERT INTO audit_logs
    Svc-->>API: Updated bill row
    API-->>UI: 200 Success
    UI->>Admin: Tampilkan notifikasi sukses
```
