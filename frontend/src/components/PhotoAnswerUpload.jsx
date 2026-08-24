import { useRef, useState } from 'react';
import { uploadPhoto } from '../services/api';
import { Camera, Trash2, Upload } from 'lucide-react';

export default function PhotoAnswerUpload({ onPhotoReady }) {
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  const compressImage = (file) =>
    new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (e) => {
        const img = new Image();
        img.src = e.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX = 1200;
          let { width, height } = img;
          if (width > height) {
            if (width > MAX) { height *= MAX / width; width = MAX; }
          } else {
            if (height > MAX) { width *= MAX / height; height = MAX; }
          }
          canvas.width = Math.round(width);
          canvas.height = Math.round(height);
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(resolve, 'image/jpeg', 0.7);
        };
      };
    });

  const handleFile = async (file) => {
    if (!file) return;
    setError('');
    setPreview(URL.createObjectURL(file));

    try {
      setUploading(true);
      const compressed = await compressImage(file);
      const formData = new FormData();
      formData.append('photo', compressed, `answer_${Date.now()}.jpg`);

      const res = await uploadPhoto(formData);
      setPhotoUrl(res.data.photoUrl);
      onPhotoReady(res.data.photoUrl);
    } catch (err) {
      setError('ફોટો upload ભૂલ. ફરી પ્રયાસ કરો.');
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = () => {
    setPreview(null);
    setPhotoUrl(null);
    onPhotoReady(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="card" style={{ padding: 24, textAlign: 'center' }}>
      <h3 className="gu-text" style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>
        📸 ઉત્તરપત્રનો ફોટો અપલોડ કરો
      </h3>
      <p className="gu-text" style={{ color: '#64748b', fontSize: '0.92rem', marginBottom: 20 }}>
        તમારા નોટબુકના જવાબ ની <strong>સ્પષ્ટ ફોટો</strong> લઈ અહીં અપલોડ કરો. (Optional)
      </p>

      {!preview ? (
        <div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={(e) => handleFile(e.target.files[0])}
          />
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              className="btn-primary"
              onClick={() => { if (inputRef.current) { inputRef.current.removeAttribute('capture'); inputRef.current.click(); } }}
            >
              <Camera size={18} /> Camera
            </button>
            <button
              className="btn-primary"
              style={{ background: 'linear-gradient(135deg,#059669,#10b981)' }}
              onClick={() => { if (inputRef.current) { inputRef.current.setAttribute('capture', 'environment'); inputRef.current.click(); } }}
            >
              <Upload size={18} /> File Upload
            </button>
          </div>
        </div>
      ) : (
        <div>
          <img
            src={preview}
            alt="Answer preview"
            style={{ maxWidth: '100%', maxHeight: 350, borderRadius: 12, border: '2px solid #e2e8f0', objectFit: 'contain', marginBottom: 14 }}
          />
          {uploading && (
            <div style={{ color: '#2563eb', fontWeight: 600, fontSize: '0.9rem', marginBottom: 12 }}>
              ⏳ Upload ચાલી રહ્યું છે...
            </div>
          )}
          {photoUrl && !uploading && (
            <div style={{ color: '#059669', fontWeight: 700, marginBottom: 12 }}>
              ✅ ફોટો Upload સફળ!
            </div>
          )}
          {error && (
            <div style={{ color: '#ef4444', fontWeight: 600, marginBottom: 12 }}>{error}</div>
          )}
          <button className="btn-danger" onClick={removePhoto} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Trash2 size={16} /> ફોટો દૂર કરો
          </button>
        </div>
      )}
    </div>
  );
}
