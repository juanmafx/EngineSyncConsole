export function summarize(values) {
  let count = 0;
  let mean = 0;
  let squaredDeviation = 0;
  let min = Infinity;
  let max = -Infinity;

  for (const value of values) {
    count += 1;
    const delta = value - mean;
    mean += delta / count;
    squaredDeviation += delta * (value - mean);
    min = Math.min(min, value);
    max = Math.max(max, value);
  }

  if (count === 0) {
    return { count: 0, mean: 0, standardDeviation: 0, min: 0, max: 0 };
  }

  const variance = count > 1 ? squaredDeviation / (count - 1) : 0;
  return { count, mean, standardDeviation: Math.sqrt(variance), min, max };
}

export function chiSquareUniform(samples, binCount) {
  const bins = new Array(binCount).fill(0);
  for (const sample of samples) {
    bins[Math.min(binCount - 1, Math.floor(sample * binCount))] += 1;
  }
  const expected = samples.length / binCount;
  return bins.reduce((total, observed) => total + (observed - expected) ** 2 / expected, 0);
}

export function lagOneAutocorrelation(values) {
  const { mean, count } = summarize(values);
  if (count < 2) {
    return 0;
  }
  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < count; i += 1) {
    denominator += (values[i] - mean) ** 2;
    if (i > 0) {
      numerator += (values[i] - mean) * (values[i - 1] - mean);
    }
  }
  return denominator === 0 ? 0 : numerator / denominator;
}
