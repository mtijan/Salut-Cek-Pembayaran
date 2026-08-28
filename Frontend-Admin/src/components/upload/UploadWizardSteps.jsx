import React from 'react';

/**
 * Wizard step bar presentational component.
 * Props: step (1 | 2 | 3)
 */
export default function UploadWizardSteps({ step }) {
  const steps = [
    { num: 1, label: 'Pilih File' },
    { num: 2, label: 'Preview & Validasi' },
    { num: 3, label: 'Selesai' },
  ];

  return (
    <div className="upload-wizard-bar">
      {steps.map((s, idx) => (
        <React.Fragment key={s.num}>
          {idx > 0 && (
            <div className={`upload-step-line ${step >= s.num ? 'active' : 'inactive'}`} />
          )}
          <div className={`upload-step-item ${step >= s.num ? 'active' : 'inactive'}`}>
            <span className={`upload-step-num ${step >= s.num ? 'active' : 'inactive'}`}>
              {s.num}
            </span>
            <strong className="cell-sm">{s.label}</strong>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}

UploadWizardSteps.displayName = 'UploadWizardSteps';
