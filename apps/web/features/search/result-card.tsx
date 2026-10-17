'use client';
import { isTextResult } from './types';
import { Bookmark, Check, Copy, ArrowUpRight } from 'lucide-react';
import { Modal } from '../../components/modal';
import type { SearchResult } from './types';
export function ResultCard({
  result,
  saved,
  onSave,
  onDetail,
  onCopy,
}: {
  result: SearchResult;
  saved: boolean;
  onSave: () => void;
  onDetail: () => void;
  onCopy: () => void;
}) {
  return (
    <article className="result-card" aria-label={result.title}>
      <div className="result-kicker">
        <span>{result.collection}</span>
        <span className="mock-tag">
          {'isResearchOnly' in result
            ? 'Pilot riset lokal'
            : result.isVerified
              ? 'Referensi diperiksa'
              : 'Data simulasi'}
        </span>
      </div>
      <h3>{result.title}</h3>
      <p className="result-description">{result.excerpt}</p>
      <p className="result-missing">
        {isTextResult(result)
          ? `No. ${result.hadithNumber} · ${result.citation.numberingScheme}`
          : 'Nomor, teks sumber, dan derajat belum tersedia.'}
      </p>
      <div className="result-actions">
        <button className="detail-button" onClick={onDetail}>
          Lihat detail <ArrowUpRight size={16} />
        </button>
        <div className="result-secondary">
          <button
            className="text-button"
            onClick={onCopy}
            aria-label={`Salin ${isTextResult(result) ? 'kutipan' : 'contoh'} ${result.title}`}
          >
            <Copy size={15} />
            <span>Salin</span>
          </button>
          <button
            className={`text-button ${saved ? 'is-saved' : ''}`}
            onClick={onSave}
            aria-pressed={saved}
            aria-label={`${saved ? 'Hapus simpanan' : isTextResult(result) ? 'Simpan kutipan' : 'Simpan contoh'} ${result.title}`}
          >
            {saved ? <Check size={16} /> : <Bookmark size={16} />}
            <span>{saved ? 'Tersimpan' : 'Simpan'}</span>
          </button>
        </div>
      </div>
    </article>
  );
}
export function ResultDetail({
  result,
  showArabic,
  onClose,
  onCopy,
  onSave,
  saved,
}: {
  result: SearchResult;
  showArabic: boolean;
  onClose: () => void;
  onCopy: () => void;
  onSave: () => void;
  saved: boolean;
}) {
  return (
    <Modal
      title={isTextResult(result) ? 'Detail hadits' : 'Detail contoh'}
      onClose={onClose}
      panel
    >
      <div className="detail-content">
        <span className="mock-tag">
          {isTextResult(result)
            ? 'isResearchOnly' in result
              ? 'Riset lokal · izin publikasi belum tuntas'
              : 'Referensi teks diperiksa · izin sumber disetujui'
            : 'Data simulasi · belum terverifikasi'}
        </span>
        <h3>{result.title}</h3>
        <p className="detail-disclaimer">
          {isTextResult(result)
            ? 'isResearchOnly' in result
              ? 'Teks sumber nyata untuk pengujian lokal. Identitas pasangan diperiksa otomatis; tinjauan manusia dan izin publikasi belum selesai. Jangan distribusikan corpus.'
              : 'Verifikasi teks dan izin penggunaan tidak sama dengan penilaian derajat hadits.'
            : 'Konten contoh — bukan hadits terverifikasi. Tidak untuk dikutip sebagai rujukan agama.'}
        </p>
        <dl className="detail-metadata">
          <div>
            <dt>Koleksi</dt>
            <dd>{result.collection}</dd>
          </div>
          <div>
            <dt>Nomor hadits</dt>
            <dd>
              {isTextResult(result)
                ? `${result.hadithNumber} (${result.citation.numberingScheme})`
                : 'Belum tersedia'}
            </dd>
          </div>
          <div>
            <dt>Derajat</dt>
            <dd>
              {isTextResult(result) && result.grade ? (
                <>
                  {result.grade} — {result.grader} ·{' '}
                  <a
                    href={result.gradingSourceUrl!}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Rujukan penilai
                  </a>
                </>
              ) : (
                'Belum tersedia'
              )}
            </dd>
          </div>
        </dl>
        {showArabic && (
          <section>
            <h4>Teks Arab</h4>
            {isTextResult(result) ? (
              <p className="arabic-text" lang="ar" dir="rtl">
                {result.arabicText}
              </p>
            ) : (
              <p lang="id">Teks Arab tidak tersedia pada data simulasi.</p>
            )}
          </section>
        )}
        <section>
          <h4>Terjemahan Indonesia</h4>
          <p>
            {isTextResult(result)
              ? result.translation
              : 'Terjemahan tidak tersedia pada data simulasi.'}
          </p>
          {isTextResult(result) && (
            <p className="muted">Terjemahan: {result.translationAttribution}</p>
          )}
        </section>
        {!isTextResult(result) && (
          <section>
            <h4>Keterangan antarmuka</h4>
            <p>{result.excerpt}</p>
          </section>
        )}
        {isTextResult(result) ? (
          <section>
            <h4>Provenance</h4>
            <p>
              {result.bookName}
              {result.chapterName ? ` · ${result.chapterName}` : ''}
              {result.narrator ? ` · ${result.narrator}` : ''}
            </p>
            <p>
              {result.provenance.sourceName} · {result.provenance.attribution}
            </p>
            <p>
              <a
                href={result.referenceUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Buka rujukan
              </a>{' '}
              ·{' '}
              <a
                href={result.provenance.licenseUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {result.provenance.licenseName}
              </a>
            </p>
          </section>
        ) : (
          <p className="source-missing">
            Belum ada tautan rujukan terverifikasi untuk contoh ini.
          </p>
        )}
        <div className="detail-footer">
          <button className="secondary-button" onClick={onCopy}>
            <Copy size={16} />
            {isTextResult(result) ? 'Salin kutipan' : 'Salin contoh'}
          </button>
          <button className="primary-button" onClick={onSave}>
            <Bookmark size={16} />
            {saved
              ? 'Hapus simpanan'
              : isTextResult(result)
                ? 'Simpan kutipan'
                : 'Simpan contoh'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
