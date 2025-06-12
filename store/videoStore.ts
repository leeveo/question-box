import { create } from 'zustand';

interface VideoStore {
  isRecording: boolean;
  setRecording: (value: boolean) => void;
}

export const useVideoStore = create<VideoStore>((set) => ({
  isRecording: false,
  setRecording: (value) => set({ isRecording: value }),
}));
