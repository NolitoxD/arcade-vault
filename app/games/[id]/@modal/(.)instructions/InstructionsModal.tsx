'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function InstructionsModal({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') router.back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router]);

  return (
    <div className="modal-bd" onClick={() => router.back()}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Instrucciones"
        style={{ textAlign: 'left', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
        <div className="actions">
          <button className="btn ghost" onClick={() => router.back()}>
            CERRAR
          </button>
        </div>
      </div>
    </div>
  );
}
