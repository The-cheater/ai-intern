import whisper
import numpy as np
import soundfile as sf
from scipy.signal import resample

# Load wav directly with soundfile (no ffmpeg needed for wav)
audio_np, sr = sf.read("harvard.wav", dtype="float32")
if audio_np.ndim > 1:
    audio_np = audio_np.mean(axis=1)  # stereo -> mono
if sr != 16000:
    audio_np = resample(audio_np, int(len(audio_np) * 16000 / sr)).astype("float32")

print("Loading whisper base model...")
model = whisper.load_model("base")

print("Transcribing harvard.wav...")
result = model.transcribe(audio_np)

print()
print("=== TRANSCRIPT ===")
print(result["text"].strip())
print()
print("Language:", result["language"])
