// @vitest-environment jsdom
// Estacionamento item 8: "PDF gerado com sucesso" só depois de o PDF ficar pronto; se falhar, só a mensagem de erro.
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { fixtures } from '../test/fixtures';

const { pdf } = vi.hoisted(() => ({
  pdf: { generateClientPDF: vi.fn(), generateInternalPDF: vi.fn() },
}));
vi.mock('../lib/pdf', () => pdf);

import { GeneratedQuoteModal } from './QuoteModals';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const renderModal = (addToast: (m: string, t: string) => void) =>
  render(
    <GeneratedQuoteModal
      generatedQuote={fixtures.quotes[0]}
      setShowQuoteModal={() => {}}
      activeStore={fixtures.stores[0]}
      addToast={addToast}
      handleFinishQuote={() => {}}
    />,
  );

describe('Orçamento Gerado: mensagem do PDF', () => {
  it('só avisa sucesso depois de o PDF ficar pronto', async () => {
    let finish!: () => void;
    pdf.generateClientPDF.mockReturnValue(new Promise<void>(r => (finish = r)));
    const addToast = vi.fn();
    const view = renderModal(addToast);
    await act(async () => fireEvent.click(view.getByText('Baixar PDF Cliente')));
    expect(addToast).not.toHaveBeenCalled();
    await act(async () => finish());
    expect(addToast).toHaveBeenCalledWith('PDF do Cliente gerado com sucesso!', 'success');
  });

  it('PDF com erro mostra só a mensagem de erro', async () => {
    pdf.generateInternalPDF.mockRejectedValue(new Error('falhou'));
    const addToast = vi.fn();
    const view = renderModal(addToast);
    await act(async () => fireEvent.click(view.getByText('Relatório Interno')));
    expect(addToast).toHaveBeenCalledTimes(1);
    expect(addToast).toHaveBeenCalledWith('Erro ao gerar PDF Interno', 'error');
  });
});
