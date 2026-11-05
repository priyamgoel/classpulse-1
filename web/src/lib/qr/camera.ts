export type CameraFacing = 'environment' | 'user';

export interface CameraSession {
  stream: MediaStream;
  track: MediaStreamTrack;
}

export async function startCamera(
  video: HTMLVideoElement,
  facing: CameraFacing = 'environment'
): Promise<CameraSession> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Camera access is not available in this browser.');
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: { ideal: facing },
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
    audio: false,
  });

  video.srcObject = stream;
  video.setAttribute('playsinline', 'true');
  video.muted = true;

  try {
    await video.play();
  } catch {
    // iOS can reject play() until metadata is ready. The scanner will still
    // render the stream once the element starts playing.
  }

  if (video.readyState < 2) {
    await new Promise<void>((resolve) => {
      const onReady = () => {
        video.removeEventListener('loadedmetadata', onReady);
        resolve();
      };
      video.addEventListener('loadedmetadata', onReady);
      window.setTimeout(onReady, 3000);
    });
  }

  const track = stream.getVideoTracks()[0];
  if (!track) {
    stopCamera(stream);
    throw new Error('No video track was provided by the camera.');
  }

  return { stream, track };
}

export function stopCamera(stream: MediaStream | null | undefined): void {
  stream?.getTracks().forEach((track) => {
    try {
      track.stop();
    } catch {
      // Ignore tracks that are already stopped.
    }
  });
}

export interface CameraCapabilities {
  torch: boolean;
  zoom: { min: number; max: number; step: number } | null;
}

export function getCameraCapabilities(
  track: MediaStreamTrack
): CameraCapabilities {
  const capabilities = (
    track as unknown as {
      getCapabilities?: () => Record<string, unknown>;
    }
  ).getCapabilities?.();

  const zoom = capabilities?.zoom as
    | { min?: number; max?: number; step?: number }
    | undefined;

  return {
    torch: Boolean(capabilities?.torch),
    zoom:
      zoom && typeof zoom.min === 'number' && typeof zoom.max === 'number'
        ? {
            min: zoom.min,
            max: zoom.max,
            step: typeof zoom.step === 'number' ? zoom.step : 0.1,
          }
        : null,
  };
}

export async function setTorch(
  track: MediaStreamTrack,
  enabled: boolean
): Promise<boolean> {
  try {
    await track.applyConstraints({
      advanced: [{ torch: enabled } as unknown as MediaTrackConstraintSet],
    });
    return true;
  } catch {
    return false;
  }
}

export async function setZoom(
  track: MediaStreamTrack,
  zoom: number
): Promise<boolean> {
  try {
    await track.applyConstraints({
      advanced: [{ zoom } as unknown as MediaTrackConstraintSet],
    });
    return true;
  } catch {
    return false;
  }
}

export function describeCameraError(error: unknown): string {
  const name =
    error && typeof error === 'object' && 'name' in error
      ? String((error as { name?: unknown }).name)
      : '';

  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return 'Camera permission was denied. Allow camera access in Safari settings, then try again.';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'No camera was found on this device.';
    case 'NotReadableError':
    case 'TrackStartError':
      return 'The camera is busy or could not be started. Close other camera apps and try again.';
    case 'OverconstrainedError':
    case 'ConstraintNotSatisfiedError':
      return 'The requested camera settings are not supported. Try again without zoom.';
    case 'SecurityError':
      return 'Camera access requires a secure HTTPS connection.';
    default:
      return error instanceof Error
        ? error.message
        : 'Could not start the camera.';
  }
}
