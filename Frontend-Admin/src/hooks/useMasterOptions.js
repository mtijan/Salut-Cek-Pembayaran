import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '../components/common/Toast';
import { masterApi } from '../services/masterApi.js';
import { isAbortError } from '../services/http.js';

export function useMasterOptions(errorMessage) {
  const { showToast } = useToast();
  const [prodis, setProdis] = useState([]);
  const [periods, setPeriods] = useState([]);
  const activeRequestRef = useRef(null);

  const reloadMasterOptions = useCallback(async () => {
    if (activeRequestRef.current) {
      activeRequestRef.current.abort();
    }
    const controller = new AbortController();
    activeRequestRef.current = controller;

    try {
      const [periodResponse, programResponse] = await Promise.all([
        masterApi.listPeriods({ signal: controller.signal }),
        masterApi.listProdi({ signal: controller.signal }),
      ]);
      if (activeRequestRef.current === controller) {
        setPeriods(periodResponse.academic_periods || []);
        setProdis(programResponse.study_programs || []);
      }
    } catch (error) {
      if (isAbortError(error)) return;
      if (activeRequestRef.current === controller) {
        showToast(error.message || errorMessage, 'error');
      }
    } finally {
      if (activeRequestRef.current === controller) {
        activeRequestRef.current = null;
      }
    }
  }, [errorMessage, showToast]);

  useEffect(() => {
    reloadMasterOptions();
    return () => {
      if (activeRequestRef.current) {
        activeRequestRef.current.abort();
        activeRequestRef.current = null;
      }
    };
  }, [reloadMasterOptions]);

  return { prodis, periods, reloadMasterOptions };
}
