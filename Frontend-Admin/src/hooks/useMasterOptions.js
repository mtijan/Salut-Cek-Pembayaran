import { useCallback, useEffect, useState } from 'react';
import { useToast } from '../components/common/Toast';
import { masterApi } from '../services/masterApi';

export function useMasterOptions(errorMessage) {
  const { showToast } = useToast();
  const [prodis, setProdis] = useState([]);
  const [periods, setPeriods] = useState([]);

  const reloadMasterOptions = useCallback(async () => {
    try {
      const [periodResponse, programResponse] = await Promise.all([
        masterApi.listPeriods(),
        masterApi.listProdi(),
      ]);
      setPeriods(periodResponse.academic_periods || []);
      setProdis(programResponse.study_programs || []);
    } catch (error) {
      showToast(error.message || errorMessage, 'error');
    }
  }, [errorMessage, showToast]);

  useEffect(() => {
    reloadMasterOptions();
  }, [reloadMasterOptions]);

  return { prodis, periods, reloadMasterOptions };
}
