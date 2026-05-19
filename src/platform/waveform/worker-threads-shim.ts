/**
 * Browser stub for Node.js `worker_threads` module.
 * Prevents Vite's externalization error when WaveSurfer's spectrogram plugin
 * checks for worker_threads at module load time.
 */
export class Worker {}
export default { Worker }
