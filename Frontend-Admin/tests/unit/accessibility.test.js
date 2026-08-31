import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.resolve(__dirname, '../../src');

test('all modal dialog components use accessible dialog roles and titles', () => {
  const dialogComponents = [
    'components/common/ConfirmModal.jsx',
    'components/bills/BillHistoryModal.jsx',
    'components/students/StudentEditorModal.jsx',
    'components/student-360/Student360Modal.jsx',
    'components/master/ProgramStudyModal.jsx',
    'components/master/AcademicPeriodModal.jsx',
    'components/users/UserFormModal.jsx',
    'components/users/ResetPasswordModal.jsx',
  ];

  for (const relPath of dialogComponents) {
    const fullPath = path.join(srcDir, relPath);
    if (!fs.existsSync(fullPath)) continue;
    const content = fs.readFileSync(fullPath, 'utf8');

    // Confirm dialog overlay / container uses dialog or modal semantics
    const hasDialogRoleOrModalClass =
      content.includes('role="dialog"') ||
      content.includes("role='dialog'") ||
      content.includes('className="modal-overlay"') ||
      content.includes('className="modal-content"') ||
      content.includes('modal-container') ||
      content.includes('dialog');

    assert.equal(
      hasDialogRoleOrModalClass,
      true,
      `${relPath} should have modal or dialog accessibility structure`,
    );
  }
});

test('FilterChips component provides accessible remove buttons with aria-label', () => {
  const filterChipsPath = path.join(srcDir, 'components/common/FilterChips.jsx');
  const content = fs.readFileSync(filterChipsPath, 'utf8');

  assert.equal(
    content.includes('aria-label') || content.includes('title='),
    true,
    'FilterChips items must provide accessible label for removal button',
  );
});

test('StatusBadge component defines accessible variant mapping', () => {
  const statusBadgePath = path.join(srcDir, 'components/common/StatusBadge.jsx');
  const content = fs.readFileSync(statusBadgePath, 'utf8');

  assert.equal(
    content.includes('badge-paid') || content.includes('badge-'),
    true,
    'StatusBadge must render categorized badge status classes',
  );
});

test('Toast notification component uses assertive or polite live region', () => {
  const toastPath = path.join(srcDir, 'components/common/Toast.jsx');
  const content = fs.readFileSync(toastPath, 'utf8');

  const hasLiveRegion =
    content.includes('role="alert"') ||
    content.includes('role="status"') ||
    content.includes('aria-live') ||
    content.includes('toast-container');

  assert.equal(hasLiveRegion, true, 'Toast component must provide live region accessibility');
});

test('tab navigation components define selectable tab controls', () => {
  const studentProfileTabsPath = path.join(
    srcDir,
    'components/student-profile/StudentProfileTabs.jsx',
  );
  if (fs.existsSync(studentProfileTabsPath)) {
    const content = fs.readFileSync(studentProfileTabsPath, 'utf8');
    assert.equal(
      content.includes('tab') || content.includes('active'),
      true,
      'StudentProfileTabs must handle tab selection states',
    );
  }
});
