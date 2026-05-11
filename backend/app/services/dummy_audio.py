import io
import math
import wave
import base64

def generate_dummy_audio_base64(duration_seconds=1.0, frequency=440.0):
    """
    Generates a simple sine wave audio chunk and returns it as a base64 encoded string.
    This serves as a dummy audio payload for Phase 3 testing.
    """
    num_channels = 1
    sample_width = 2
    framerate = 16000
    num_frames = int(framerate * duration_seconds)

    audio_data = bytearray()
    for i in range(num_frames):
        value = int(32767.0 * math.sin(2.0 * math.pi * frequency * i / framerate))
        audio_data.extend(value.to_bytes(2, byteorder='little', signed=True))

    wav_io = io.BytesIO()
    with wave.open(wav_io, 'wb') as wav_file:
        wav_file.setnchannels(num_channels)
        wav_file.setsampwidth(sample_width)
        wav_file.setframerate(framerate)
        wav_file.writeframes(audio_data)

    return base64.b64encode(wav_io.getvalue()).decode('utf-8')
