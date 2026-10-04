import React, { createContext, useContext, useReducer, useCallback } from 'react';

const SessionContext = createContext(null);

const initialState = {
  // Frame selection
  frame: null, // { id, name, width, height, printWidth, printHeight, slots, imageSrc }

  // Photos mapped to slots
  photos: [], // [{ slotId, draftFile, imageUrl, transform, adjustments }]

  // Photos that don't fit in the current frame (preserved across swaps)
  overflowPhotos: [],

  // Camera
  cameraStatus: null, // { type, provider, model, message, warnings }

  // Config
  folder: 'default',
  captureDelay: 8,
  captureMode: 'timer', // 'timer' or 'manual'

  // Composed result
  resultUrl: null,
  resultFilename: null,
};

const defaultTransform = { x: 0, y: 0, scale: 1, rotation: 0, flipH: false, flipV: false };
const defaultAdjustments = { brightness: 100, contrast: 100, grayscale: false };

function reducer(state, action) {
  switch (action.type) {
    case 'SET_FRAME':
      return {
        ...state,
        frame: action.payload,
        photos: [], // Reset photos when frame changes
        overflowPhotos: [],
        resultUrl: null,
        resultFilename: null,
      };

    case 'SWAP_FRAME': {
      const newFrame = action.payload;
      const oldSlots = state.frame?.slots || [];
      const oldOrder = oldSlots.map((s) => s.id);
      const placed = [...state.photos].sort(
        (a, b) => oldOrder.indexOf(a.slotId) - oldOrder.indexOf(b.slotId)
      );
      const pool = [...placed, ...state.overflowPhotos];
      const newPhotos = pool.slice(0, newFrame.slots.length).map((p, i) => ({
        ...p,
        slotId: newFrame.slots[i].id,
        transform: { ...p.transform, x: 0, y: 0, scale: 1 },
      }));
      const overflowPhotos = pool.slice(newFrame.slots.length);
      return {
        ...state,
        frame: newFrame,
        photos: newPhotos,
        overflowPhotos,
        resultUrl: null,
        resultFilename: null,
      };
    }

    case 'SET_PHOTO': {
      const { slotId, draftFile, imageUrl } = action.payload;
      const existing = state.photos.findIndex((p) => p.slotId === slotId);
      const photo = {
        slotId,
        draftFile,
        imageUrl,
        transform: { ...defaultTransform },
        adjustments: { ...defaultAdjustments },
      };
      if (existing >= 0) {
        const photos = [...state.photos];
        photos[existing] = photo;
        return { ...state, photos };
      }
      return { ...state, photos: [...state.photos, photo] };
    }

    case 'UPDATE_TRANSFORM': {
      const { slotId, transform } = action.payload;
      return {
        ...state,
        photos: state.photos.map((p) =>
          p.slotId === slotId ? { ...p, transform: { ...p.transform, ...transform } } : p
        ),
      };
    }

    case 'UPDATE_ADJUSTMENTS': {
      const { slotId, adjustments } = action.payload;
      return {
        ...state,
        photos: state.photos.map((p) =>
          p.slotId === slotId ? { ...p, adjustments: { ...p.adjustments, ...adjustments } } : p
        ),
      };
    }

    case 'REMOVE_PHOTO': {
      return {
        ...state,
        photos: state.photos.filter((p) => p.slotId !== action.payload),
      };
    }

    case 'SET_CAMERA_STATUS':
      return { ...state, cameraStatus: action.payload };

    case 'SET_CONFIG':
      return { ...state, ...action.payload };

    case 'SET_RESULT':
      return { ...state, resultUrl: action.payload.url, resultFilename: action.payload.filename };

    case 'RESET':
      return { ...initialState, folder: state.folder, cameraStatus: state.cameraStatus };

    default:
      return state;
  }
}

export function SessionProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const setFrame = useCallback((frame) => dispatch({ type: 'SET_FRAME', payload: frame }), []);
  const swapFrame = useCallback((frame) => dispatch({ type: 'SWAP_FRAME', payload: frame }), []);
  const setPhoto = useCallback((payload) => dispatch({ type: 'SET_PHOTO', payload }), []);
  const updateTransform = useCallback((slotId, transform) =>
    dispatch({ type: 'UPDATE_TRANSFORM', payload: { slotId, transform } }), []);
  const updateAdjustments = useCallback((slotId, adjustments) =>
    dispatch({ type: 'UPDATE_ADJUSTMENTS', payload: { slotId, adjustments } }), []);
  const removePhoto = useCallback((slotId) => dispatch({ type: 'REMOVE_PHOTO', payload: slotId }), []);
  const setCameraStatus = useCallback((status) => dispatch({ type: 'SET_CAMERA_STATUS', payload: status }), []);
  const setConfig = useCallback((config) => dispatch({ type: 'SET_CONFIG', payload: config }), []);
  const setResult = useCallback((result) => dispatch({ type: 'SET_RESULT', payload: result }), []);
  const reset = useCallback(() => dispatch({ type: 'RESET' }), []);

  return (
    <SessionContext.Provider value={{
      ...state,
      dispatch,
      setFrame,
      swapFrame,
      setPhoto,
      updateTransform,
      updateAdjustments,
      removePhoto,
      setCameraStatus,
      setConfig,
      setResult,
      reset,
    }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}
