/**
 * K-Means clustering — implementasi murni TypeScript.
 *
 * Modul ini digunakan oleh:
 * - API `/api/analytics/kmeans` (server-side untuk hasil akhir)
 * - Halaman `/analytics` (client-side juga untuk visualisasi)
 *
 * Fitur yang digunakan untuk clustering: goals, assists, shots (3 variabel).
 *
 * Fitur:
 * - K-Means++ initialization (lebih stabil dari random murni)
 * - Z-score normalization untuk fitur dengan skala berbeda
 * - Step recording opsional untuk visualisasi iterasi
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/** [goals, assists, shots] dalam unit asli atau z-score */
export type Feature = readonly [number, number, number];

export type FeatureStats = {
  means: Feature;
  stds: Feature;
};

export type StandardizeResult = FeatureStats & {
  standardized: Feature[];
};

/** Snapshot satu iterasi K-Means untuk keperluan visualisasi */
export type KMeansStep = {
  /** Iterasi ke berapa, dimulai dari 0 untuk inisialisasi */
  iteration: number;
  /** Centroid pada awal iterasi ini (z-score) */
  centroids: Feature[];
  /** Centroid setelah recompute (z-score). Sama dengan centroids untuk iter 0 */
  newCentroids: Feature[];
  /** Cluster assignment per titik data setelah iterasi ini */
  assignments: number[];
  /** Berapa titik yang pindah cluster dibanding iterasi sebelumnya */
  changedCount: number;
  /** True jika iterasi ini menyebabkan konvergensi (tidak ada perubahan) */
  converged: boolean;
};

export type KMeansResult = {
  /** Cluster final per titik data */
  assignments: number[];
  /** Centroid final dalam z-score */
  centroids: Feature[];
  /** Riwayat semua iterasi (kosong jika trackSteps=false) */
  steps: KMeansStep[];
  /** Jumlah iterasi yang dijalankan sampai konvergen / max_iter */
  iterations: number;
  /** Apakah algoritma konvergen sebelum max_iter */
  converged: boolean;
};

// ─── Statistik dasar ──────────────────────────────────────────────────────────

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function stddev(values: number[], avg: number): number {
  if (values.length === 0) return 0;
  const variance =
    values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Z-score per kolom. Std=0 dikonversi ke 1 untuk hindari NaN.
 */
export function standardize(features: Feature[]): StandardizeResult {
  if (features.length === 0) {
    const zero: Feature = [0, 0, 0];
    return { standardized: [], means: zero, stds: zero };
  }

  const cols: number[][] = [[], [], []];
  for (const f of features) {
    for (let i = 0; i < 3; i++) cols[i].push(f[i]);
  }

  const means = cols.map(mean) as unknown as Feature;
  const stds = cols.map((c, i) => {
    const s = stddev(c, means[i]);
    return s === 0 ? 1 : s;
  }) as unknown as Feature;

  const standardized: Feature[] = features.map(
    (f) =>
      [
        (f[0] - means[0]) / stds[0],
        (f[1] - means[1]) / stds[1],
        (f[2] - means[2]) / stds[2],
      ] as Feature,
  );

  return { standardized, means, stds };
}

/** Inverse standarisasi: kembalikan z-score ke unit asli */
export function denormalize(centroid: Feature, stats: FeatureStats): Feature {
  return [
    centroid[0] * stats.stds[0] + stats.means[0],
    centroid[1] * stats.stds[1] + stats.means[1],
    centroid[2] * stats.stds[2] + stats.means[2],
  ] as Feature;
}

// ─── Jarak ────────────────────────────────────────────────────────────────────

export function squaredDistance(a: Feature, b: Feature): number {
  let d = 0;
  for (let i = 0; i < 3; i++) {
    const diff = a[i] - b[i];
    d += diff * diff;
  }
  return d;
}

export function euclideanDistance(a: Feature, b: Feature): number {
  return Math.sqrt(squaredDistance(a, b));
}

// ─── K-Means++ initialization ─────────────────────────────────────────────────

/**
 * Pilih centroid awal yang tersebar untuk konvergensi yang lebih stabil.
 * Optional `random` injection untuk seed-able RNG.
 */
export function initCentroidsKMeansPP(
  points: Feature[],
  k: number,
  random: () => number = Math.random,
): Feature[] {
  if (points.length === 0) return [];

  const centroids: Feature[] = [];
  const firstIdx = Math.floor(random() * points.length);
  centroids.push(points[firstIdx]);

  while (centroids.length < k) {
    const distances = points.map((p) => {
      let minDist = Infinity;
      for (const c of centroids) {
        const d = squaredDistance(p, c);
        if (d < minDist) minDist = d;
      }
      return minDist;
    });

    const total = distances.reduce((s, d) => s + d, 0);
    if (total === 0) {
      centroids.push(points[Math.floor(random() * points.length)]);
      continue;
    }

    const target = random() * total;
    let cumulative = 0;
    let chosenIdx = 0;
    for (let i = 0; i < distances.length; i++) {
      cumulative += distances[i];
      if (cumulative >= target) {
        chosenIdx = i;
        break;
      }
    }
    centroids.push(points[chosenIdx]);
  }

  return centroids;
}

// ─── Assignment & recompute ───────────────────────────────────────────────────

export function assignToCluster(point: Feature, centroids: Feature[]): number {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < centroids.length; i++) {
    const d = squaredDistance(point, centroids[i]);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

export function recomputeCentroid(points: Feature[]): Feature {
  if (points.length === 0) return [0, 0, 0] as unknown as Feature;
  const sums = [0, 0, 0];
  for (const p of points) {
    for (let i = 0; i < 3; i++) sums[i] += p[i];
  }
  return sums.map((s) => s / points.length) as unknown as Feature;
}

// ─── Main K-Means runner ──────────────────────────────────────────────────────

export type RunKMeansOptions = {
  /** Jumlah cluster (akan di-cap ke jumlah titik data) */
  k: number;
  /** Iterasi maksimum */
  maxIter: number;
  /** Track semua iterasi untuk visualisasi (false default untuk performa) */
  trackSteps?: boolean;
  /** RNG opsional untuk seed deterministik */
  random?: () => number;
  /** Centroid awal opsional. Jika tidak diberikan, pakai K-Means++ */
  initialCentroids?: Feature[];
};

/**
 * Jalankan K-Means clustering. Return assignment per titik dan centroid akhir.
 * Jika `trackSteps=true`, juga return riwayat tiap iterasi.
 */
export function runKMeans(
  points: Feature[],
  opts: RunKMeansOptions,
): KMeansResult {
  const { k, maxIter, trackSteps = false, random = Math.random } = opts;

  if (points.length === 0) {
    return {
      assignments: [],
      centroids: [],
      steps: [],
      iterations: 0,
      converged: true,
    };
  }

  const effectiveK = Math.min(k, points.length);
  let centroids =
    opts.initialCentroids?.slice(0, effectiveK) ??
    initCentroidsKMeansPP(points, effectiveK, random);

  let assignments = points.map((p) => assignToCluster(p, centroids));

  const steps: KMeansStep[] = [];

  // Iter 0 = inisialisasi
  if (trackSteps) {
    steps.push({
      iteration: 0,
      centroids: centroids.map((c) => [...c] as Feature),
      newCentroids: centroids.map((c) => [...c] as Feature),
      assignments: [...assignments],
      changedCount: assignments.length, // semua titik "baru" di-assign
      converged: false,
    });
  }

  let iter = 0;
  let converged = false;

  for (iter = 1; iter <= maxIter; iter++) {
    const grouped: Feature[][] = Array.from({ length: effectiveK }, () => []);
    for (let i = 0; i < points.length; i++) {
      grouped[assignments[i]].push(points[i]);
    }

    const newCentroids = grouped.map((group, idx) =>
      group.length === 0 ? centroids[idx] : recomputeCentroid(group),
    );

    const newAssignments = points.map((p) => assignToCluster(p, newCentroids));

    let changedCount = 0;
    for (let i = 0; i < assignments.length; i++) {
      if (assignments[i] !== newAssignments[i]) changedCount += 1;
    }

    const stepConverged = changedCount === 0;

    if (trackSteps) {
      steps.push({
        iteration: iter,
        centroids: centroids.map((c) => [...c] as Feature),
        newCentroids: newCentroids.map((c) => [...c] as Feature),
        assignments: [...newAssignments],
        changedCount,
        converged: stepConverged,
      });
    }

    centroids = newCentroids;
    assignments = newAssignments;

    if (stepConverged) {
      converged = true;
      break;
    }
  }

  return {
    assignments,
    centroids,
    steps,
    iterations: Math.min(iter, maxIter),
    converged,
  };
}

// ─── Performance score helpers ────────────────────────────────────────────────

/**
 * Performance score = sum z-score per fitur. Skor positif = di atas rata-rata
 * di mayoritas fitur.
 */
export function computePerformanceScore(zScores: Feature): number {
  return zScores[0] + zScores[1] + zScores[2];
}

/** Index cluster dengan rata-rata performance score tertinggi */
export function findTopCluster(
  assignments: number[],
  scores: number[],
  k: number,
): number {
  const sums = new Array(k).fill(0);
  const counts = new Array(k).fill(0);
  for (let i = 0; i < assignments.length; i++) {
    sums[assignments[i]] += scores[i];
    counts[assignments[i]] += 1;
  }
  let bestIdx = 0;
  let bestAvg = -Infinity;
  for (let i = 0; i < k; i++) {
    const avg = counts[i] === 0 ? -Infinity : sums[i] / counts[i];
    if (avg > bestAvg) {
      bestAvg = avg;
      bestIdx = i;
    }
  }
  return bestIdx;
}
