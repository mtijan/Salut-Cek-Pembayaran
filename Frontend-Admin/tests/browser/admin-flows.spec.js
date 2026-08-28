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
];

const admin = {
  email: 'browser-admin@synthetic.test',
  full_name: 'Synthetic Browser Admin',
  role: 'admin',
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

async function installApiMocks(page, currentAdmin = admin) {
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
    .getByPlaceholder('Contoh: Cicilan ke-1 biaya UKT semester genap')
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

test('negative and empty states: search empty results dan api error handling', async ({ page }) => {
  await installApiMocks(page);
  await page.goto('/admin');
  await page.getByRole('button', { name: 'Data Mahasiswa', exact: true }).click();

  const searchInput = page.getByPlaceholder('Cari NIM, nama, prodi, NIK, kontak...');
  await searchInput.fill('NIM_YANG_TIDAK_PERNAH_ADA_9999999');

  await expect(page.getByText('Tidak ada data mahasiswa')).toBeVisible();
});
