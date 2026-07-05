import * as numeric from 'numeric';

export function lqrJS(A, B, Q, R) {
  // Input validation
  if (!A || !B || !Q || !R) {
    throw new Error('All input matrices A, B, Q, R must be provided');
  }
  if (A.length !== 4 || A[0].length !== 4) {
    throw new Error('A must be a 4x4 matrix');
  }
  if (B.length !== 4 || B[0].length !== 1) {
    throw new Error('B must be a 4x1 matrix');
  }
  if (Q.length !== 4 || Q[0].length !== 4) {
    throw new Error('Q must be a 4x4 matrix');
  }
  if (R.length !== 1 || R[0].length !== 1) {
    throw new Error('R must be a 1x1 matrix');
  }

  // Convert R to scalar since it's 1x1
  const r = R[0][0];
  if (r <= 0) {
    throw new Error('R must be positive');
  }

  // Construct the Hamiltonian matrix
  // H = [ A  -B R⁻¹ Bᵀ ]
  //     [ -Q   -Aᵀ    ]
  const n = 4;
  const Rinv = [[1 / r]];
  const BRinvBt = numeric.dot(numeric.dot(B, Rinv), numeric.transpose(B));
  const negQ = numeric.mul(-1, Q);
  const negAt = numeric.mul(-1, numeric.transpose(A));

  const H = numeric.blockMatrix([
    [A, numeric.mul(-1, BRinvBt)],
    [negQ, negAt]
  ]);

  // Compute eigenvalues and eigenvectors
  const eig = numeric.eig(H);
  const eigenvalues = eig.lambda.x; // Real parts
  const eigenvectors = eig.E.x;

  // Select stable eigenvectors (eigenvalues with negative real parts)
  const stableIndices = [];
  for (let i = 0; i < eigenvalues.length; i++) {
    if (eigenvalues[i] < -1e-10) { // Threshold for numerical stability
      stableIndices.push(i);
    }
  }
  if (stableIndices.length !== n) {
    throw new Error('Expected exactly 4 stable eigenvalues');
  }

  // Extract stable eigenvectors
  const U = [];
  for (let i = 0; i < 2 * n; i++) {
    const row = [];
    for (let j = 0; j < stableIndices.length; j++) {
      row.push(eigenvectors[i][stableIndices[j]]);
    }
    U.push(row);
  }

  // Partition U into U1 (top n rows) and U2 (bottom n rows)
  const U1 = U.slice(0, n);
  const U2 = U.slice(n, 2 * n);

  // Solve for P: P = U2 * U1⁻¹
  const U1inv = numeric.inv(U1);
  const P = numeric.dot(U2, U1inv);

  // Compute K = R⁻¹ Bᵀ P
  const Bt = numeric.transpose(B);
  const K = numeric.dot(numeric.dot(Rinv, Bt), P);

  // Ensure K is 1x4
  if (K.length !== 1 || K[0].length !== 4) {
    throw new Error('Computed K is not 1x4');
  }

  return K;
}