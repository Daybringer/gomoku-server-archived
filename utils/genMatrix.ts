/**
 * Creates n^n fields/matrix
 * @param n - length of matrix
 * @returns Array<Array<number>>
 */
export default function gen(n: number): number[][] | undefined {
  if (n < 0) return undefined;

  let matrix = [];
  for (let x = 0; x < n; x++) {
    matrix.push([]);
    for (let y = 0; y < n; y++) {
      matrix[x].push(0 as never);
    }
  }
  return matrix;
}
