import { Buffer } from 'node:buffer';
import { expect, test } from '@playwright/test';

const permissions = [
  'view_reports',
  'view_students',
  'view_billing',
  'view_master_data',
  'view_imports',
  'manage_students',
  'manage_billing',
  'manage_master_data',
  'import',
  'manage_users',
  'view_audit_logs',
];

const admin = {
  email: 'browser-admin@synthetic.test',
  full_name: 'Synthetic Browser Admin',
  role: 'super_admin',
  permissions,
};

const students = Array.from({ length: 30 }, (_, index) => {
  const number = String(index + 1).padStart(2, '0');
  return {
    id: `student-${number}`,
    nim: `9900000${number}`,
    full_name: `Synthetic Student ${number}`,
    no_ktp: `36710000000000${number}`,
    study_program_id: 'prodi-synthetic',
    study_program_name: 'Program Sintetis',
    program_study: 'Program Sintetis',
    academic_status: index === 1 ? 'cuti' : 'aktif',
    entry_year: 2026,
    entry_semester: 'ganjil',
    entry_period: '2026.1',
    entry_period_formatted: '2026.1 (Ganjil)',
    initial_registration: 'UNIVERSITAS TERBUKA 2026.1',
    phone_number: `0812000000${number}`,
    email: `student-${number}@synthetic.test`,
    address: 'Alamat data sintetis',
    bill_count: 1,
    total_amount: 1000000,
    total_amount_formatted: 'Rp 1.000.000',
    total_paid: index % 2 === 0 ? 1000000 : 250000,
    total_paid_formatted: index % 2 === 0 ? 'Rp 1.000.000' : 'Rp 250.000',
    total_outstanding: index % 2 === 0 ? 0 : 750000,
    total_outstanding_formatted: index % 2 === 0 ? 'Rp 0' : 'Rp 750.000',
    payment_rate: index % 2 === 0 ? 100 : 25,
    overall_status: index % 2 === 0 ? 'paid' : 'partial',
  };
});

const bills = students.slice(0, 3).map((student, index) => ({
  id: `bill-${index + 1}`,
  student_id: student.id,
  nim: student.nim,
  student_name: student.full_name,
  full_name: student.full_name,
  study_program_name: student.study_program_name,
  period: '2026.1',
  entry_period: '2026.1',
  bill_type: 'Registrasi Sintetis',
  briva: `BRIVA-0${index + 1}`,
  amount: 1000000,
  amount_formatted: 'Rp 1.000.000',
  paid_amount: index === 0 ? 1000000 : 250000,
  paid_amount_formatted: index === 0 ? 'Rp 1.000.000' : 'Rp 250.000',
  remaining_amount: index === 0 ? 0 : 750000,
  remaining_amount_formatted: index === 0 ? 'Rp 0' : 'Rp 750.000',
  status: index === 0 ? 'paid' : 'partial',
  is_active: true,
  source: 'manual',
  due_date_formatted: '31 Desember 2026',
}));

function success(data) {
  return { success: true, data, request_id: 'synthetic-browser-request' };
}

async function fulfillJson(route, data, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(status < 400 ? success(data) : data),
  });
}

function reportFixture() {
  return {
    by_student: students,
    total_amount: 30000000,
    total_paid: 18750000,
    total_outstanding: 11250000,
  };
}

function dashboardFixture() {
  return {
    total_students: 30,
    active_students: 29,
    total_bills: 3,
    paid_bills: 1,
    unpaid_bills: 2,
    total_billed_amount_formatted: 'Rp 3.000.000',
    total_paid_amount_formatted: 'Rp 1.500.000',
    total_outstanding_amount_formatted: 'Rp 1.500.000',
    payment_rate_percentage: 50,
    recent_imports: [],
  };
}

let mockTransactions = [];
let mockUsers = [
  {
    id: 'super-1',
    email: 'browser-admin@synthetic.test',
    full_name: 'Synthetic Browser Admin',
    role: 'super_admin',
    is_active: true,
    permissions,
    created_at: '2026-08-31 08:00:00',
    updated_at: '2026-08-31 08:00:00',
  },
  {
    id: 'viewer-1',
    email: 'viewer@synthetic.test',
    full_name: 'Synthetic Viewer',
    role: 'viewer',
    is_active: true,
    permissions: ['view_reports'],
    created_at: '2026-08-31 08:05:00',
    updated_at: '2026-08-31 08:05:00',
  },
];
const mockAuditLogs = [
  {
    id: 'audit-synthetic-1',
    actor_id: 'super-1',
    actor_name: 'Synthetic Browser Admin',
    actor_role: 'super_admin',
    action: 'user.update',
    entity_type: 'admin_user',
    entity_id: 'viewer-1',
    metadata: { email: '[REDACTED]', role: 'viewer', password: '[REDACTED]' },
    created_at: '2026-08-31 09:00:00',
  },
];
let mockProdis = [
  {
    id: 'prodi-1',
    code: '311',
    name: 'Ilmu Hukum',
    degree: 'S1',
    faculty: 'FHISIP',
    student_count: 15,
    is_active: 1,
  },
  {
    id: 'prodi-2',
    code: '54',
    name: 'Manajemen',
    degree: 'S1',
    faculty: 'FE',
    student_count: 10,
    is_active: 1,
  },
];
let mockPeriods = [
  {
    id: 'period-1',
    code: '20261',
    name: 'Semester 2026/2027 Ganjil',
    semester_type: 'ganjil',
    default_due_date: '2026-10-30',
    is_active: 1,
  },
  {
    id: 'period-2',
    code: '20252',
    name: 'Semester 2025/2026 Genap',
    semester_type: 'genap',
    default_due_date: '2026-03-30',
    is_active: 0,
  },
];

async function installApiMocks(page, currentAdmin = admin, behavior = {}) {
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new globalThis.URL(request.url());
    const path = url.pathname;
    const method = request.method();

    if (path === '/api/admin/me') return fulfillJson(route, currentAdmin);
    if (path === '/api/admin/dashboard/stats') {
      return fulfillJson(route, dashboardFixture());
    }
    if (path === '/api/admin/study-programs') {
      if (method === 'POST') {
        const body = request.postDataJSON() || {};
        const newProdi = { id: `prodi-${Date.now()}`, ...body, student_count: 0 };
        mockProdis.push(newProdi);
        return fulfillJson(route, newProdi, 201);
      }
      return fulfillJson(route, { study_programs: mockProdis });
    }
    if (path.startsWith('/api/admin/study-programs/')) {
      if (method === 'PUT') {
        const id = path.split('/').pop();
        const body = request.postDataJSON() || {};
        const idx = mockProdis.findIndex((p) => p.id === id);
        if (idx >= 0) {
          mockProdis[idx] = { ...mockProdis[idx], ...body };
          return fulfillJson(route, mockProdis[idx]);
        }
      }
    }
    if (path === '/api/admin/academic-periods') {
      if (method === 'POST') {
        const body = request.postDataJSON() || {};
        const newPeriod = { id: `period-${Date.now()}`, ...body };
        mockPeriods.push(newPeriod);
        return fulfillJson(route, newPeriod, 201);
      }
      return fulfillJson(route, { academic_periods: mockPeriods });
    }
    if (path.startsWith('/api/admin/academic-periods/')) {
      if (method === 'PUT') {
        const id = path.split('/').pop();
        const body = request.postDataJSON() || {};
        const idx = mockPeriods.findIndex((p) => p.id === id);
        if (idx >= 0) {
          mockPeriods[idx] = { ...mockPeriods[idx], ...body };
          return fulfillJson(route, mockPeriods[idx]);
        }
      }
    }
    if (path === '/api/admin/students') {
      if (behavior.students) return behavior.students(route, url);
      const query = (url.searchParams.get('query') || '').toLowerCase();
      const filtered = query
        ? students.filter((student) =>
            `${student.nim} ${student.full_name}`.toLowerCase().includes(query),
          )
        : students;
      return fulfillJson(route, { students: filtered });
    }
    const detailMatch = path.match(/^\/api\/admin\/students\/([^/]+)\/detail$/);
    if (detailMatch) {
      const student = students.find((item) => item.id === detailMatch[1]) || students[0];
      return fulfillJson(route, {
        student,
        bills: bills.filter((bill) => bill.student_id === student.id),
        payment_history: [],
        payment_history_pagination: { total: 0, limit: 50, offset: 0 },
        summary: {
          total_bills: 1,
          total_amount: 1000000,
          total_paid: student.total_paid,
          total_outstanding: student.total_outstanding,
          total_amount_formatted: 'Rp 1.000.000',
          total_paid_formatted: student.total_paid_formatted,
          total_outstanding_formatted: student.total_outstanding_formatted,
          overall_status: student.overall_status,
        },
      });
    }
    if (/^\/api\/admin\/students\/[^/]+\/transactions$/.test(path)) {
      return fulfillJson(route, {
        transactions: [],
        pagination: { total: 0, limit: 50, offset: 0 },
      });
    }
    if (path === '/api/admin/bills') {
      const query = (url.searchParams.get('query') || '').toLowerCase();
      const filtered = query
        ? bills.filter((bill) =>
            `${bill.briva} ${bill.student_name} ${bill.nim}`.toLowerCase().includes(query),
          )
        : bills;
      return fulfillJson(route, {
        bills: filtered,
        pagination: { total: filtered.length, limit: 100, offset: 0, total_pages: 1 },
        summary: {
          total_count: filtered.length,
          student_count: filtered.length,
          total_amount: filtered.length * 1000000,
          total_paid: 1500000,
          total_remaining: 1500000,
          paid_count: 1,
          partial_count: 2,
          unpaid_count: 0,
        },
      });
    }
    if (path === '/api/admin/bills/activation/preview' && method === 'POST') {
      return fulfillJson(route, {
        scope: request.postDataJSON() || {},
        summary: {
          total_count: 2,
          student_count: 2,
          total_amount: 2000000,
          total_paid: 500000,
          total_remaining: 1500000,
          paid_count: 0,
          partial_count: 2,
          unpaid_count: 0,
        },
      });
    }
    if (path === '/api/admin/bills/activation/bulk' && method === 'POST') {
      return fulfillJson(route, { updated_count: 2, summary: { total_count: 2 } });
    }
    const billActivationMatch = path.match(/^\/api\/admin\/bills\/([^/]+)\/activation$/);
    if (billActivationMatch && method === 'PATCH') {
      const targetBill = bills.find((bill) => bill.id === billActivationMatch[1]);
      if (targetBill) targetBill.is_active = Boolean(request.postDataJSON()?.is_active);
      return fulfillJson(route, { bill: targetBill });
    }
    const billDetailMatch = path.match(/^\/api\/admin\/bills\/([^/]+)$/);
    if (billDetailMatch && method === 'GET') {
      const billId = billDetailMatch[1];
      const targetBill = bills.find((b) => b.id === billId) || bills[1];
      const student = students.find((s) => s.id === targetBill.student_id) || students[1];
      return fulfillJson(route, {
        bill: targetBill,
        student,
        transactions: mockTransactions,
      });
    }
    const billPaymentMatch = path.match(/^\/api\/admin\/bills\/([^/]+)\/payments$/);
    if (billPaymentMatch && method === 'POST') {
      const body = request.postDataJSON() || {};
      const amount = Number(body.payment_amount || 0);
      mockTransactions.push({
        id: `tx-${Date.now()}`,
        transaction_type: 'payment',
        amount,
        amount_formatted: `Rp ${amount.toLocaleString('id-ID')}`,
        running_paid_total_formatted: `Rp ${(250000 + amount).toLocaleString('id-ID')}`,
        payment_date: body.payment_date || '2026-08-27',
        payment_method: body.payment_method || 'BRIVA',
        reference_number: body.reference_number || 'REF-SYNTHETIC',
        notes: body.notes || 'Pembayaran via browser test',
        previous_status: 'partial',
        new_status: amount >= 750000 ? 'paid' : 'partial',
        recorded_by_name: 'Synthetic Browser Admin',
        created_at: '2026-08-27 10:00:00',
      });
      return fulfillJson(route, { success: true });
    }
    if (path === '/api/admin/import/preview' && method === 'POST') {
      return fulfillJson(route, {
        import_token: 'synthetic-import-token-12345',
        file_name: 'test_master_data.xlsx',
        valid_rows: 5,
        new_rows: 3,
        update_rows: 2,
        critical_rows: 0,
        amount_change_rows: 1,
        briva_change_rows: 1,
        requires_update_confirmation: true,
        sample: [
          {
            nim: '990000001',
            full_name: 'Mahasiswa Import 1',
            program_study: 'S1 Ilmu Hukum',
            amount: 1500000,
            briva: '178100099001',
            due_date: '2026-12-31',
          },
        ],
        errors: [
          {
            row_number: 2,
            message: 'Nominal berubah dari Rp 1.000.000 ke Rp 1.500.000',
            severity: 'warning',
          },
        ],
      });
    }
    if (path === '/api/admin/import/commit' && method === 'POST') {
      return fulfillJson(route, {
        created: 3,
        updated: 2,
        unchanged: 0,
        issues: 1,
      });
    }
    if (path === '/api/admin/reports/financial-summary') {
      return fulfillJson(route, reportFixture());
    }
    if (path === '/api/admin/audit-logs') {
      return fulfillJson(route, {
        audit_logs: mockAuditLogs,
        pagination: { total: mockAuditLogs.length, limit: 50, offset: 0 },
      });
    }
    if (path === '/api/admin/users' && method === 'POST') {
      const body = request.postDataJSON() || {};
      const created = {
        id: `user-${Date.now()}`,
        ...body,
        is_active: Boolean(body.is_active),
        permissions: [],
        created_at: '2026-08-31 10:00:00',
        updated_at: '2026-08-31 10:00:00',
      };
      delete created.password;
      mockUsers.push(created);
      return fulfillJson(route, { user: created });
    }
    if (path === '/api/admin/users' && method === 'GET') {
      return fulfillJson(route, { users: mockUsers });
    }
    const resetPasswordMatch = path.match(/^\/api\/admin\/users\/([^/]+)\/reset-password$/);
    if (resetPasswordMatch && method === 'POST') {
      return fulfillJson(route, { reset: true });
    }
    const userMatch = path.match(/^\/api\/admin\/users\/([^/]+)$/);
    if (userMatch && method === 'PATCH') {
      const body = request.postDataJSON() || {};
      if (userMatch[1] === 'super-1' && body.is_active === false) {
        return fulfillJson(
          route,
          {
            success: false,
            error: { message: 'Tidak dapat menonaktifkan super_admin aktif terakhir.' },
          },
          400,
        );
      }
      const index = mockUsers.findIndex((user) => user.id === userMatch[1]);
      mockUsers[index] = { ...mockUsers[index], ...body };
      return fulfillJson(route, { user: mockUsers[index] });
    }
    if (userMatch && method === 'DELETE') {
      if (userMatch[1] === 'super-1') {
        return fulfillJson(
          route,
          {
            success: false,
            error: { message: 'Tidak dapat menghapus super_admin aktif terakhir.' },
          },
          400,
        );
      }
      mockUsers = mockUsers.filter((user) => user.id !== userMatch[1]);
      return fulfillJson(route, { deleted: true });
    }
    return fulfillJson(route, { error: { message: `Mock belum tersedia untuk ${path}` } }, 404);
  });
}

test('login flow memakai bundle backend dan CSP tanpa console violation', async ({ page }) => {
  let authenticated = false;
  const browserErrors = [];
  page.on('console', (message) => {
    if (
      message.type() === 'error' ||
      message.text().toLowerCase().includes('content security policy')
    ) {
      browserErrors.push(message.text());
    }
  });
  page.on('pageerror', (error) => browserErrors.push(error.message));

  await page.route('**/api/**', async (route) => {
    const path = new globalThis.URL(route.request().url()).pathname;
    if (path === '/api/admin/me') {
      return authenticated ? fulfillJson(route, admin) : fulfillJson(route, null);
    }
    if (path === '/api/admin/login') {
      const payload = route.request().postDataJSON();
      expect(payload.email).toBe('browser-admin@synthetic.test');
      expect(payload.password).toBe('Synthetic-Test-Password');
      authenticated = true;
      return fulfillJson(route, admin);
    }
    if (path === '/api/admin/dashboard/stats') {
      return fulfillJson(route, dashboardFixture());
    }
    return fulfillJson(route, {});
  });

  const response = await page.goto('/admin');
  expect(response.headers()['content-security-policy']).toContain("script-src 'self'");
  await expect(page.getByRole('heading', { name: 'Admin SALUT Awwabin' })).toBeVisible();
  await page.getByLabel('Email Admin').fill('browser-admin@synthetic.test');
  await page.locator('#login-password').fill('Synthetic-Test-Password');
  await page.getByRole('button', { name: 'Masuk ke Panel Admin' }).click();
  await expect(page.getByRole('button', { name: 'Data Mahasiswa', exact: true })).toBeVisible();
  expect(browserErrors).toEqual([]);
});

test('students mempertahankan pagination, filter, validation, dan initial-tab navigation', async ({
  page,
}) => {
  await installApiMocks(page);
  await page.goto('/admin');
  await page.getByRole('button', { name: 'Data Mahasiswa', exact: true }).click();
  await expect(page.getByText('Halaman 1 / 2')).toBeVisible();
  await page.getByTitle('Halaman Berikutnya').click();
  await expect(page.getByText('Halaman 2 / 2')).toBeVisible();
  await expect(page.getByText('Synthetic Student 30')).toBeVisible();

  await page.getByPlaceholder('Cari NIM, nama, prodi, NIK, kontak...').fill('Synthetic Student 01');
  await expect(page.getByText('Halaman 1 / 1')).toBeVisible();
  await expect(page.getByText('Synthetic Student 01')).toBeVisible();

  await page.getByRole('button', { name: 'Tambah Mahasiswa' }).click();
  await page.getByRole('button', { name: 'Simpan Data Mahasiswa' }).click();
  await expect(page.locator('input[required]:invalid')).toHaveCount(2);
  await page.getByRole('button', { name: 'Batal' }).click();

  await page.getByRole('button', { name: 'Synthetic Student 01' }).click();
  await expect(page.getByRole('button', { name: 'Profil Biodata' })).toHaveClass(/is-active/);
  await page.getByRole('button', { name: /Edit Biodata/ }).click();
  await expect(page.getByText('Edit Biodata & Informasi Mahasiswa')).toBeVisible();
});

test('reports filter chip dan CSV memakai data sintetis', async ({ page }) => {
  await installApiMocks(page);
  await page.goto('/admin');
  await page.getByRole('button', { name: 'Rekap Keuangan', exact: true }).click();
  const search = page.getByPlaceholder('Cari NIM, nama mahasiswa, prodi, angkatan...');
  await search.fill('Synthetic Student 01');
  await expect(page.getByRole('button', { name: 'Hapus filter Cari' })).toBeVisible();
  await expect(page.getByText('Menampilkan 1 dari 1 mahasiswa')).toBeVisible();
  await page.getByRole('button', { name: 'Hapus filter Cari' }).click();
  await expect(search).toHaveValue('');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Ekspor CSV' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^Rekap_Keuangan_SALUT_\d{4}-\d{2}-\d{2}\.csv$/);
});

test('viewer tidak melihat aksi mutasi pada students dan bills', async ({ page }) => {
  await installApiMocks(page, {
    ...admin,
    role: 'viewer',
    permissions: [
      'view_reports',
      'view_students',
      'view_billing',
      'view_master_data',
      'view_imports',
    ],
  });
  await page.goto('/admin');
  await page.getByRole('button', { name: 'Data Mahasiswa', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Tambah Mahasiswa' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Edit' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Tagihan Mahasiswa', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Buat Tagihan Baru' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Kelola Admin', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Audit Log', exact: true })).toHaveCount(0);
});

test('bill payment flow: partial payment, live calculation, submit transaksi dan refresh ledger', async ({
  page,
}) => {
  mockTransactions = [];
  await installApiMocks(page);
  await page.goto('/admin');
  await page.getByRole('button', { name: 'Tagihan Mahasiswa', exact: true }).click();
  await page.getByRole('button', { name: 'Bayar' }).nth(1).click();

  await expect(page.getByText('Formulir Pembayaran Tagihan')).toBeVisible();
  await expect(page.getByText(/Sisa Saat Ini/)).toBeVisible();

  // Mode switcher to partial
  await page.getByRole('button', { name: /Bayar Sebagian/ }).click();
  const nominalInput = page.locator('.currency-input');
  await nominalInput.fill('500000');

  // Verify live calculation preview
  await expect(page.locator('.live-calc-box')).toContainText(/500\.000/);
  await expect(page.locator('.live-calc-box')).toContainText(/250\.000/);

  // Fill reference & notes
  await page.getByPlaceholder('Contoh: REF-20260825-9988').fill('REF-SYNTH-001');
  await page
    .getByPlaceholder('Contoh: Cicilan ke-1 biaya UKT semester ganjil')
    .fill('Cicilan pertama');

  // Submit payment
  await page.getByRole('button', { name: /Simpan & Catat Transaksi/ }).click();

  // Verify ledger row appears
  await expect(page.getByText('REF-SYNTH-001')).toBeVisible();
  await expect(page.getByText('PEMBAYARAN', { exact: true })).toBeVisible();
});

test('upload wizard flow: preview file sintetis, confirm sensitive changes, dan commit sukses', async ({
  page,
}) => {
  await installApiMocks(page);
  await page.goto('/admin');
  await page.getByRole('button', { name: 'Upload File', exact: true }).click();

  await expect(page.getByText('Impor Data Mahasiswa & Tagihan')).toBeVisible();
  await expect(page.getByText('Pilih File', { exact: true })).toBeVisible();

  // Set synthetic file via file input
  const fileInput = page.locator('#file-upload');
  await fileInput.setInputFiles({
    name: 'test_master_data.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from('synthetic-excel-content'),
  });

  await page.getByRole('button', { name: 'Periksa & Analisis File' }).click();

  // Step 2: verify stats and sensitive warning
  await expect(page.getByText('Preview & Validasi')).toBeVisible();
  await expect(page.getByText('Persetujuan Perubahan Data Sensitif Diperlukan')).toBeVisible();

  // Check the confirmation checkbox
  const confirmCheckbox = page.locator('input[type="checkbox"]');
  await confirmCheckbox.check();

  // Commit
  await page.getByRole('button', { name: 'Simpan & Terapkan Data Tagihan' }).click();

  // Step 3: verify success panel
  await expect(page.getByText('Import Data Berhasil!')).toBeVisible();
  await expect(page.getByText('Data Baru')).toBeVisible();
});

test('master data flow: switch prodi dan periode tab, open create modal, form validation dan submit', async ({
  page,
}) => {
  await installApiMocks(page);
  await page.goto('/admin');
  await page.getByRole('button', { name: 'Master Data', exact: true }).click();

  // Tab 1: Program Studi
  await expect(page.getByText('Daftar Program Studi Terdaftar')).toBeVisible();
  await expect(page.getByText('Ilmu Hukum')).toBeVisible();

  // Open Prodi Modal
  await page.getByRole('button', { name: 'Tambah Program Studi' }).click();
  await expect(page.getByRole('heading', { name: 'Tambah Program Studi' })).toBeVisible();
  await page.getByRole('button', { name: 'Batal' }).click();

  // Tab 2: Periode Akademik
  await page.getByRole('button', { name: /Master Periode Akademik/ }).click();
  await expect(page.getByText('Daftar Periode / Semester Akademik')).toBeVisible();
  await expect(page.getByText('Semester 2026/2027 Ganjil')).toBeVisible();

  // Open Period Modal
  await page.getByRole('button', { name: 'Tambah Periode Akademik' }).click();
  await expect(page.getByRole('heading', { name: 'Tambah Periode Akademik' })).toBeVisible();
  await page.getByRole('button', { name: 'Batal' }).click();
});

test('bill activation flow: individual toggle and master period bulk entry point', async ({
  page,
}) => {
  await installApiMocks(page);
  await page.goto('/admin');
  await page.getByRole('button', { name: 'Tagihan Mahasiswa', exact: true }).click();

  const bulkButton = page.getByRole('button', { name: 'Kelola Aktivasi Massal' });
  await expect(bulkButton).toBeEnabled();
  await bulkButton.click();
  let activationPage = page.locator('.activation-page-container');
  await expect(
    activationPage.getByRole('heading', { name: 'Kelola Aktivasi Tagihan Massal' }),
  ).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(
    await activationPage.evaluate((element) => element.scrollWidth > element.clientWidth + 1),
  ).toBe(false);
  await activationPage.getByLabel('Periode Tagihan').selectOption('20261');
  await activationPage.getByLabel('Program Studi', { exact: true }).selectOption('prodi-1');
  await activationPage.getByLabel('Mode Scope').selectOption('all');
  await activationPage.getByRole('button', { name: 'Tampilkan Preview Dampak' }).click();
  await expect(activationPage.getByText(/2 tagihan/)).toBeVisible();
  await activationPage
    .getByPlaceholder(/Periode lama ditutup/)
    .fill('Penutupan massal browser test');
  await activationPage.getByRole('button', { name: 'Nonaktifkan Tagihan', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tagihan Mahasiswa', level: 1 })).toBeVisible();

  await page.getByTitle('Status Aktivasi Tagihan').selectOption('inactive');
  await bulkButton.click();
  activationPage = page.locator('.activation-page-container');
  await expect(activationPage.getByLabel('Aksi Aktivasi')).toHaveValue('active');
  await activationPage.getByLabel('Periode Tagihan').selectOption('20261');
  await activationPage.getByLabel('Program Studi', { exact: true }).selectOption('prodi-1');
  await activationPage.getByRole('button', { name: 'Tampilkan Preview Dampak' }).click();
  await activationPage
    .getByPlaceholder(/Periode lama ditutup/)
    .fill('Aktivasi massal browser test');
  await activationPage.getByRole('button', { name: 'Aktifkan Tagihan', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tagihan Mahasiswa', level: 1 })).toBeVisible();

  await page.getByTitle('Status Aktivasi Tagihan').selectOption('active');

  await expect(page.getByText('Aktif', { exact: true }).first()).toBeVisible();
  await page.getByTitle('Nonaktifkan Tagihan', { exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'Nonaktifkan Tagihan' })).toBeVisible();
  await page.getByPlaceholder(/Periode lama ditutup/).fill('Browser test penutupan periode');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Nonaktifkan Tagihan', exact: true })
    .click();

  await page.getByRole('button', { name: 'Master Data', exact: true }).click();
  await page.getByRole('button', { name: /Master Periode Akademik/ }).click();
  await page.getByRole('button', { name: 'Kelola Tagihan' }).first().click();
  activationPage = page.locator('.activation-page-container');
  await expect(
    activationPage.getByRole('heading', { name: 'Kelola Aktivasi Tagihan Massal' }),
  ).toBeVisible();
  await expect(activationPage.getByLabel('Periode Tagihan')).toHaveValue('20261');
  await expect(activationPage.getByLabel('Periode Tagihan')).toBeDisabled();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await activationPage.getByRole('button', { name: 'Batal' }).click();
  await expect(page.getByText('Daftar Periode / Semester Akademik')).toBeVisible();
});

test('negative and empty states: search empty results dan api error handling', async ({ page }) => {
  await installApiMocks(page);
  await page.goto('/admin');
  await page.getByRole('button', { name: 'Data Mahasiswa', exact: true }).click();

  const searchInput = page.getByPlaceholder('Cari NIM, nama, prodi, NIK, kontak...');
  await searchInput.fill('NIM_YANG_TIDAK_PERNAH_ADA_9999999');

  await expect(page.getByText('Tidak ada data mahasiswa')).toBeVisible();
});

test('hook aktual menjaga latest response, menampilkan real error, dan aman saat unmount', async ({
  page,
}) => {
  const browserErrors = [];
  page.on('pageerror', (error) => browserErrors.push(error.message));
  await installApiMocks(page, admin, {
    students: async (route, url) => {
      const query = url.searchParams.get('query') || '';
      if (query === 'slow') await new Promise((resolve) => setTimeout(resolve, 250));
      if (query === 'fast') await new Promise((resolve) => setTimeout(resolve, 10));
      if (query === 'server-error') {
        return fulfillJson(
          route,
          { success: false, error: { message: 'Synthetic server failure' } },
          500,
        );
      }
      const result = query === 'slow' ? [students[0]] : query === 'fast' ? [students[1]] : students;
      try {
        return await fulfillJson(route, { students: result });
      } catch {
        return undefined;
      }
    },
  });
  await page.goto('/admin');
  await page.getByRole('button', { name: 'Data Mahasiswa', exact: true }).click();
  const search = page.getByPlaceholder('Cari NIM, nama, prodi, NIK, kontak...');

  const slowRequest = page.waitForRequest((request) => request.url().includes('query=slow'));
  await search.fill('slow');
  await slowRequest;
  await search.fill('fast');
  await expect(page.getByText('Synthetic Student 02')).toBeVisible();
  await page.waitForTimeout(300);
  await expect(page.getByText('Synthetic Student 01')).toHaveCount(0);

  await search.fill('server-error');
  await expect(page.getByText('Synthetic server failure')).toBeVisible();

  const unmountRequest = page.waitForRequest((request) => request.url().includes('query=slow'));
  await search.fill('slow');
  await unmountRequest;
  await page.getByRole('button', { name: 'Dashboard', exact: true }).click();
  await page.waitForTimeout(300);
  await expect(page.getByText('Ringkasan Sistem')).toBeVisible();
  expect(browserErrors).toEqual([]);
});

test('user management dan audit viewer menjalankan RBAC, dialog keyboard, reset, dan last-admin guard', async ({
  page,
}) => {
  mockUsers = mockUsers.slice(0, 2);
  await installApiMocks(page);
  await page.goto('/admin');
  await page.getByRole('button', { name: 'Kelola Admin', exact: true }).click();
  await expect(page.getByText('viewer@synthetic.test')).toBeVisible();

  const createButton = page.getByRole('button', { name: 'Tambah Administrator' });
  await createButton.click();
  const dialog = page.getByRole('dialog', { name: 'Tambah Administrator Baru' });
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  await expect(page.getByLabel('Tutup dialog pengguna')).toBeFocused();
  await page.getByLabel('Email *').fill('new-admin@synthetic.test');
  await page.getByLabel('Nama Lengkap').fill('Synthetic New Admin');
  await page.getByLabel('Role Akses *').selectOption('admin_akademik');
  await page.getByLabel(/Password Awal/).fill('SyntheticPassword123!');
  await page.getByRole('button', { name: 'Buat Akun Admin' }).click();
  await expect(page.getByText('new-admin@synthetic.test', { exact: true })).toBeVisible();

  const viewerRow = page.getByRole('row').filter({ hasText: 'viewer@synthetic.test' });
  const resetButton = viewerRow.getByTitle('Reset Password');
  await resetButton.click();
  await expect(page.getByRole('dialog', { name: 'Reset Password Admin' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Reset Password Admin' })).toHaveCount(0);
  await expect(resetButton).toBeFocused();
  await resetButton.click();
  await page.getByLabel(/Password Baru/).fill('ResetSynthetic123!');
  await page.getByRole('button', { name: 'Reset Password & Cabut Session' }).click();
  await expect(page.getByText(/berhasil direset/)).toBeVisible();

  const superRow = page.getByRole('row').filter({ hasText: 'browser-admin@synthetic.test' });
  page.once('dialog', (confirmation) => confirmation.accept());
  await superRow.getByRole('button', { name: 'Nonaktifkan' }).click();
  await expect(
    page.getByText('Tidak dapat menonaktifkan super_admin aktif terakhir.'),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Audit Log', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Audit Log Sistem' })).toBeVisible();
  await expect(page.getByText('user.update')).toBeVisible();
  await expect(page.getByText(/email: \[REDACTED\]/)).toBeVisible();
});

test('rendered responsive state mempertahankan dialog dan tabel dalam viewport kecil', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installApiMocks(page);
  await page.goto('/admin');
  await page.getByRole('button', { name: 'Kecilkan Menu Sidebar' }).click();
  await page.getByRole('button', { name: 'Kelola Admin', exact: true }).click();
  await page.getByRole('button', { name: 'Tambah Administrator' }).click();
  const dialog = page.getByRole('dialog', { name: 'Tambah Administrator Baru' });
  const box = await dialog.boundingBox();
  expect(box).not.toBeNull();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  await page.keyboard.press('Escape');
  await expect(page.locator('.table-responsive')).toBeVisible();
  const hasHorizontalOverflow = await page.evaluate(() => {
    const root = globalThis.document.documentElement;
    return root.scrollWidth > root.clientWidth + 1;
  });
  expect(hasHorizontalOverflow).toBe(false);
});

test('public lookup merender ringkasan dan histori sintetis tanpa XSS atau dependency eksternal', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const externalRequests = [];
  const browserErrors = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) externalRequests.push(request.url());
  });
  page.on('pageerror', (error) => browserErrors.push(error.message));
  await page.route('**/api/lookup', async (route) => {
    await fulfillJson(route, {
      student: {
        nim: '990000001',
        full_name: 'Synthetic <img src=x onerror=globalThis.__xss=true>',
        program_study: 'Program Sintetis',
        payment_period: '2026.1',
        due_date: '2026-12-31',
        due_date_formatted: '31 Desember 2026',
      },
      bills: [
        {
          bill_label: 'Tagihan <script>globalThis.__xss=true</script>',
          briva: '990000000000001',
          amount: 1000000,
          amount_formatted: 'Rp 1.000.000',
          paid_amount: 250000,
          paid_amount_formatted: 'Rp 250.000',
          remaining_amount: 750000,
          remaining_amount_formatted: 'Rp 750.000',
          status: 'partial',
          period: '2026.1',
        },
      ],
      payment_status: 'partial',
      summary: {
        total_amount: 1000000,
        total_amount_formatted: 'Rp 1.000.000',
        paid_amount: 250000,
        paid_amount_formatted: 'Rp 250.000',
        remaining_amount: 750000,
        remaining_amount_formatted: 'Rp 750.000',
      },
      payment_history: [
        {
          transaction_type: 'payment',
          amount: 250000,
          amount_formatted: 'Rp 250.000',
          payment_date: '2026-09-01',
          payment_date_formatted: '1 September 2026',
          payment_method: 'BRIVA <img src=x onerror=globalThis.__xss=true>',
          bill_type: 'Registrasi Sintetis',
          briva: '990000000000001',
        },
      ],
    });
  });

  await page.goto('/');
  await page.getByLabel('Nomor Induk Mahasiswa (NIM)').fill('990000001');
  await page.getByRole('button', { name: 'Periksa Tagihan' }).click();

  await expect(page.getByText('Rp 750.000', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('1 Transaksi', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Synthetic <img src=x onerror=globalThis.__xss=true>' }),
  ).toBeVisible();
  expect(await page.evaluate(() => globalThis.__xss)).toBeUndefined();
  await expect(page.locator('img[src="x"]')).toHaveCount(0);
  await expect(page.locator('script:not([src])')).toHaveCount(0);
  expect(externalRequests).toEqual([]);
  expect(browserErrors).toEqual([]);
  const overflowReport = await page.evaluate(() => {
    const root = globalThis.document.documentElement;
    const offenders = [...globalThis.document.querySelectorAll('body *')]
      .filter((element) => {
        const style = globalThis.getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        const rect = element.getBoundingClientRect();
        return rect.left < -1 || rect.right > root.clientWidth + 1;
      })
      .slice(0, 10)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName,
          id: element.id,
          className: String(element.className),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
        };
      });
    return { rootOverflow: root.scrollWidth > root.clientWidth + 1, offenders };
  });
  expect(overflowReport).toEqual({ rootOverflow: false, offenders: [] });
});
