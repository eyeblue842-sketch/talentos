import { CustomMeetingProvider } from './customMeetingProvider.js';
import { GoogleMeetProvider } from './googleMeetProvider.js';
import { ZoomProvider } from './zoomProvider.js';

export function getMeetingProvider(provider, connection = null) {
  switch (provider) {
    case 'GOOGLE_MEET':
      return new GoogleMeetProvider({ connection });
    case 'ZOOM':
      return new ZoomProvider({ connection });
    case 'CUSTOM':
      return new CustomMeetingProvider({ connection });
    default: {
      const error = new Error('Unsupported meeting provider.');
      error.statusCode = 422;
      throw error;
    }
  }
}
