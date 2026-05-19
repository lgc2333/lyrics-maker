export const TIMING_ERRORS = {
  noTimingPoints: 'No timing points available',
  bpmMustBePositive: 'BPM must be a positive number',
  timeSignatureNumeratorMustBePositive:
    'Time signature numerator must be a positive number',
  timeSignatureDenominatorMustBePositive:
    'Time signature denominator must be a positive number',
  invalidBpm: 'Invalid BPM: must be a positive finite number',
  maxIterationsExceeded: 'Maximum iterations exceeded in beat grid generation',
} as const
