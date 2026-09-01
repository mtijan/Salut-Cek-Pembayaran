import React from 'react';
import { AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useUploadPage } from '../hooks/useUploadPage';
import UploadWizardSteps from '../components/upload/UploadWizardSteps';
import UploadStep1 from '../components/upload/UploadStep1';
import UploadStep2 from '../components/upload/UploadStep2';
import UploadStep3 from '../components/upload/UploadStep3';

export default function UploadPage({ navigateTo }) {
  const { can } = useAuth();
  const u = useUploadPage();

  if (!can('import')) {
    return (
      <div className="panel-card panel-loading-state">
        <AlertCircle size={32} className="empty-state-icon text-muted" />
        <h3 className="empty-state-title">Akses Terbatas</h3>
        <p className="empty-state-desc">
          Role Viewer hanya memiliki hak baca dan tidak diizinkan mengimpor file data.
        </p>
      </div>
    );
  }

  return (
    <div>
      <UploadWizardSteps step={u.step} />

      {u.step === 1 && (
        <UploadStep1
          file={u.file}
          analyzing={u.analyzing}
          onFileChange={u.handleFileChange}
          onAnalyze={u.handleAnalyze}
        />
      )}

      {u.step === 2 && u.previewData && (
        <UploadStep2
          previewData={u.previewData}
          critical={u.critical}
          hasSensitive={u.hasSensitive}
          confirmSensitive={u.confirmSensitive}
          onConfirmChange={(e) => u.setConfirmSensitive(e.target.checked)}
          committing={u.committing}
          canCommit={u.canCommit}
          onBack={u.handleReset}
          onCommit={u.handleCommit}
        />
      )}

      {u.step === 3 && (
        <UploadStep3
          commitResult={u.commitResult}
          onReset={u.handleReset}
          onNavigate={() => navigateTo('students')}
          onManageBills={() => navigateTo('bill-activation', { returnView: 'bills' })}
        />
      )}
    </div>
  );
}

UploadPage.displayName = 'UploadPage';
