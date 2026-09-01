export function buildActivationScope({ period, studyProgramId, isActive, confirmAllPrograms }) {
  return {
    period,
    study_program_id: studyProgramId || null,
    is_active: Boolean(isActive),
    mode: 'all',
    replacement_period: null,
    confirm_all_programs: Boolean(!studyProgramId && confirmAllPrograms),
  };
}

export function validateActivationScope(scope) {
  if (!scope || !scope.period) return 'Periode tagihan wajib dipilih.';
  if (!scope.study_program_id && !scope.confirm_all_programs) {
    return 'Konfirmasi semua program studi wajib dicentang.';
  }
  return '';
}
