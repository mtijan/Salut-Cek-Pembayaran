export function buildActivationScope({
  period,
  studyProgramId,
  isActive,
  mode,
  replacementPeriod,
  confirmAllPrograms,
}) {
  return {
    period,
    study_program_id: studyProgramId || null,
    is_active: Boolean(isActive),
    mode: isActive ? 'all' : mode,
    replacement_period: !isActive && mode === 'with_replacement' ? replacementPeriod : null,
    confirm_all_programs: Boolean(!studyProgramId && confirmAllPrograms),
  };
}

export function validateActivationScope(scope, { requireProdi = false } = {}) {
  if (!scope.period) return 'Periode tagihan wajib dipilih.';
  if (requireProdi && !scope.study_program_id) {
    return 'Program studi wajib dipilih dari Bills Page.';
  }
  if (!scope.study_program_id && !scope.confirm_all_programs) {
    return 'Konfirmasi semua program studi wajib dicentang.';
  }
  if (!scope.is_active && scope.mode === 'with_replacement' && !scope.replacement_period) {
    return 'Periode pengganti wajib dipilih untuk mode aman.';
  }
  if (scope.replacement_period && scope.replacement_period === scope.period) {
    return 'Periode pengganti harus berbeda dari periode lama.';
  }
  return '';
}
