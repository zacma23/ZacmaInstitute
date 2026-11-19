import React from 'react';
import { Printer, ShieldCheck, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { formatEtb, Receipt } from '../types/zacma';
import { formatDualDate } from '../lib/ethiopianCalendar';
import { ZacmaLogo } from './ZacmaLogo';

export function ReceiptModal({
  receipt,
  onClose,
}: {
  receipt: Receipt | null;
  onClose: () => void;
}) {
  if (!receipt) return null;

  const issuedDual = formatDualDate(receipt.issuedAt, false);
  const paymentDual = formatDualDate(receipt.paymentDate, false);

  const qrPayload = JSON.stringify({
    org: 'ZACMA Technology & Training Institute',
    rcp: receipt.receiptNumber,
    ref: receipt.transactionRef,
    sid: receipt.studentCode,
    amt: receipt.amountPaidEtb,
    cur: 'ETB',
    hash: receipt.verificationHash,
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-[1px] flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-xl max-w-2xl w-full shadow-2xl overflow-hidden my-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 no-print">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Official Payment Receipt</h3>
            <p className="text-xs text-slate-500 font-mono">
              {receipt.receiptNumber} · Verified Approved Transaction
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap"
            >
              <Printer className="w-4 h-4" />
              Print Official Receipt
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-500 hover:text-slate-900 rounded-lg transition-colors"
              aria-label="Close receipt"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div id="zacma-printable-receipt" className="p-8 bg-white text-slate-900">
          {/* Institutional Header */}
          <div className="flex items-start justify-between gap-6 pb-5">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <ZacmaLogo variant="mark" size="lg" framed />
                <div>
                  <h1 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight leading-tight">
                    ZACMA <span className="text-blue-700">TECHNOLOGY</span> &amp; TRAINING INSTITUTE
                  </h1>
                  <p className="text-xs text-slate-500">
                    Office of the Registrar &amp; Student Accounts · Addis Ababa, Ethiopia
                  </p>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Official Tuition &amp; Training Fee Receipt · Currency: Ethiopian Birr (ETB)
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs font-bold text-red-600 tracking-wide">
                OFFICIAL RECEIPT
              </p>
              <p className="text-base font-mono font-bold text-slate-900 tabular-nums mt-0.5">
                {receipt.receiptNumber}
              </p>
              <p className="text-xs text-slate-600 mt-1">
                Issued: {issuedDual.gregorian}
              </p>
              <p className="text-[11px] text-[#172DEB] font-medium">
                {issuedDual.ethiopian} E.C.
              </p>
            </div>
          </div>
          <div className="h-1 w-full zacma-brand-stripe rounded-full mb-1" />

          {/* Student & Payment Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 py-6 border-b border-slate-200 text-sm">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500">Student Information</p>
              <p className="font-bold text-slate-900 text-base">{receipt.studentName}</p>
              <p className="text-xs text-slate-600 font-mono">
                Student ID: <span className="font-semibold text-slate-900">{receipt.studentCode}</span>
              </p>
              {receipt.studentPhone && (
                <p className="text-xs text-slate-600">Phone: {receipt.studentPhone}</p>
              )}
              <p className="text-xs text-slate-600">
                Program: <span className="font-semibold text-slate-900">{receipt.courseName}</span>
              </p>
            </div>
            <div className="space-y-2 sm:text-right">
              <p className="text-xs font-semibold text-slate-500">Transaction Verification</p>
              <p className="text-xs text-slate-600">
                Transaction Ref:{' '}
                <span className="font-mono font-semibold text-slate-900">
                  {receipt.transactionRef}
                </span>
              </p>
              <p className="text-xs text-slate-600">
                Payment Date:{' '}
                <span className="font-semibold text-slate-900">
                  {paymentDual.gregorian}
                </span>{' '}
                <span className="text-[#172DEB] font-medium">
                  ({paymentDual.ethiopian} E.C.)
                </span>
              </p>
              <p className="text-xs text-slate-600">
                Payment Method:{' '}
                <span className="font-semibold text-slate-900">{receipt.paymentMethod}</span>
              </p>
              <p className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                <ShieldCheck className="w-3.5 h-3.5" />
                Admin Approved &amp; Posted
              </p>
            </div>
          </div>

          {/* Financial Ledger Breakdown */}
          <div className="py-6 border-b border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500">
                  <th className="text-left font-semibold pb-2.5">Description</th>
                  <th className="text-right font-semibold pb-2.5">Amount (ETB)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="py-3 text-slate-600">Previous Outstanding Balance</td>
                  <td className="py-3 text-right font-mono tabular-nums text-slate-700">
                    {formatEtb(receipt.previousBalanceEtb)}
                  </td>
                </tr>
                <tr>
                  <td className="py-3 font-semibold text-slate-900">
                    Tuition Fee Payment Received ({receipt.courseName})
                  </td>
                  <td className="py-3 text-right font-mono tabular-nums font-bold text-blue-700">
                    {formatEtb(receipt.amountPaidEtb)}
                  </td>
                </tr>
                <tr className="bg-slate-50">
                  <td className="py-3 px-3 font-bold text-slate-900">
                    Remaining Balance After Payment
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums font-bold text-slate-900">
                    {formatEtb(receipt.remainingBalanceEtb)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* QR Code + Authorized Signature */}
          <div className="pt-6 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-white border border-slate-200 rounded-lg">
                <QRCodeSVG value={qrPayload} size={76} level="M" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-900">Digital Verification Code</p>
                <p className="text-xs font-mono text-slate-600">{receipt.verificationHash}</p>
                <p className="text-[11px] text-slate-500 max-w-[220px] leading-snug">
                  Scan QR code to verify official receipt authenticity against ZACMA accounting ledger.
                </p>
              </div>
            </div>

            <div className="w-full sm:w-56 text-left sm:text-right">
              <div className="border-b border-slate-400 pb-2 mb-1.5">
                <p className="text-sm font-display font-bold text-slate-900 italic">
                  {receipt.authorizedBy}
                </p>
              </div>
              <p className="text-xs font-semibold text-slate-700">Authorized Signature</p>
              <p className="text-[11px] text-slate-500">
                Finance Controller · ZACMA Technology &amp; Training Institute
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
