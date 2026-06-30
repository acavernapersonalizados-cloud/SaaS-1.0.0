import React, { useRef, useState } from 'react';
import { Upload, X, ZoomIn, Loader2, ImagePlus, Trash2 } from 'lucide-react';

interface ProductImageUploadProps {
  imageUrl?: string | null;
  thumbnailUrl?: string | null;
  galleryImages?: string[];
  onMainImageChange: (file: File) => Promise<void>;
  onGalleryImageAdd: (file: File) => Promise<void>;
  onMainImageRemove: () => void;
  onGalleryImageRemove: (index: number) => void;
  uploading?: boolean;
}

export function ProductImageUpload({
  imageUrl,
  thumbnailUrl,
  galleryImages = [],
  onMainImageChange,
  onGalleryImageAdd,
  onMainImageRemove,
  onGalleryImageRemove,
  uploading = false,
}: ProductImageUploadProps) {
  const mainInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleMainFile = async (file: File) => {
    if (!file) return;
    await onMainImageChange(file);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) await handleMainFile(file);
  };

  return (
    <div className="space-y-4">
      {/* Main image */}
      <div>
        <label className="text-xs font-bold text-neutral-700 uppercase tracking-wider block mb-2">
          Imagem Principal
        </label>

        {imageUrl ? (
          <div className="relative w-full aspect-square max-w-xs rounded-2xl overflow-hidden border border-neutral-200 group">
            <img
              src={thumbnailUrl || imageUrl}
              alt="Imagem do produto"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setLightbox(imageUrl)}
                className="p-2 bg-white/90 rounded-full hover:bg-white transition-colors"
              >
                <ZoomIn className="w-4 h-4 text-neutral-900" />
              </button>
              <button
                type="button"
                onClick={onMainImageRemove}
                className="p-2 bg-red-500/90 rounded-full hover:bg-red-500 transition-colors"
              >
                <Trash2 className="w-4 h-4 text-white" />
              </button>
            </div>
            {uploading && (
              <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-neutral-600" />
              </div>
            )}
          </div>
        ) : (
          <div
            onClick={() => mainInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`w-full max-w-xs aspect-square rounded-2xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center gap-3 ${
              dragOver
                ? 'border-neutral-900 bg-neutral-50'
                : 'border-neutral-200 hover:border-neutral-400 hover:bg-neutral-50'
            }`}
          >
            {uploading ? (
              <Loader2 className="w-8 h-8 animate-spin text-neutral-400" />
            ) : (
              <>
                <Upload className="w-8 h-8 text-neutral-300" />
                <p className="text-xs font-bold text-neutral-400 text-center px-4">
                  Clique ou arraste<br />PNG, JPG, WEBP • max 10MB
                </p>
              </>
            )}
          </div>
        )}

        <input
          ref={mainInputRef}
          type="file"
          accept="image/png,image/jpg,image/jpeg,image/webp"
          className="hidden"
          onChange={e => e.target.files?.[0] && handleMainFile(e.target.files[0])}
        />
      </div>

      {/* Gallery */}
      <div>
        <label className="text-xs font-bold text-neutral-700 uppercase tracking-wider block mb-2">
          Galeria ({galleryImages.length}/6)
        </label>
        <div className="flex flex-wrap gap-2">
          {galleryImages.map((url, i) => (
            <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border border-neutral-200 group">
              <img src={url} alt={`Galeria ${i + 1}`} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                <button
                  type="button"
                  onClick={() => setLightbox(url)}
                  className="p-1 bg-white/90 rounded-full"
                >
                  <ZoomIn className="w-3 h-3 text-neutral-900" />
                </button>
                <button
                  type="button"
                  onClick={() => onGalleryImageRemove(i)}
                  className="p-1 bg-red-500/90 rounded-full"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
            </div>
          ))}

          {galleryImages.length < 6 && (
            <button
              type="button"
              onClick={() => galleryInputRef.current?.click()}
              disabled={uploading}
              className="w-20 h-20 rounded-xl border-2 border-dashed border-neutral-200 hover:border-neutral-400 hover:bg-neutral-50 flex items-center justify-center transition-all disabled:opacity-40"
            >
              {uploading ? (
                <Loader2 className="w-5 h-5 animate-spin text-neutral-400" />
              ) : (
                <ImagePlus className="w-5 h-5 text-neutral-300" />
              )}
            </button>
          )}
        </div>
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/png,image/jpg,image/jpeg,image/webp"
          className="hidden"
          onChange={e => e.target.files?.[0] && onGalleryImageAdd(e.target.files[0])}
        />
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 bg-black/90 z-[200] flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <img
            src={lightbox}
            alt="Zoom"
            className="max-w-full max-h-full rounded-2xl object-contain"
            onClick={e => e.stopPropagation()}
          />
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/40 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-white" />
          </button>
        </div>
      )}
    </div>
  );
}
