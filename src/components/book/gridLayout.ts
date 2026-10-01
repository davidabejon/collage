export type GridPlacement = {
  row: number
  col: number
  /** Assigned area, possibly enlarged to absorb unreachable holes. */
  rows: number
  cols: number
  /** The item's own size, drawn centered inside the assigned area. */
  spanRows: number
  spanCols: number
}

/**
 * Replicates CSS grid sparse auto-placement, then lets items absorb neighbouring
 * empty cells that no later item could ever occupy.
 */
export function layoutGrid(sizes: { cols: number; rows: number }[], columns: number): GridPlacement[] {
  const grid: number[][] = []
  const owner = (r: number, c: number) => grid[r]?.[c] ?? -1
  const fill = (r: number, c: number, index: number) => {
    grid[r] ??= Array<number>(columns).fill(-1)
    grid[r][c] = index
  }
  const fits = (r: number, c: number, w: number, h: number) => {
    if (c + w > columns) return false
    for (let i = 0; i < h; i++) for (let j = 0; j < w; j++) if (owner(r + i, c + j) !== -1) return false
    return true
  }

  let cursorRow = 0
  let cursorCol = 0
  const placements = sizes.map((size, index) => {
    const w = Math.min(size.cols, columns)
    const h = size.rows
    while (!fits(cursorRow, cursorCol, w, h)) {
      cursorCol++
      if (cursorCol + w > columns) {
        cursorRow++
        cursorCol = 0
      }
    }
    for (let i = 0; i < h; i++) for (let j = 0; j < w; j++) fill(cursorRow + i, cursorCol + j, index)
    const placement = { row: cursorRow, col: cursorCol, rows: h, cols: w, spanRows: h, spanCols: w }
    cursorCol += w
    return placement
  })

  // Cells before the final cursor can never be reached by items placed later.
  const isDeadHole = (r: number, c: number) =>
    r >= 0 && c >= 0 && c < columns && owner(r, c) === -1 && (r < cursorRow || (r === cursorRow && c < cursorCol))
  const range = (start: number, length: number) => Array.from({ length }, (_, i) => start + i)

  const grow = (p: GridPlacement, index: number) => {
    const options: [cells: [number, number][], apply: () => void][] = [
      [range(p.col, p.cols).map((c) => [p.row + p.rows, c]), () => p.rows++],
      [range(p.col, p.cols).map((c) => [p.row - 1, c]), () => { p.row--; p.rows++ }],
      [range(p.row, p.rows).map((r) => [r, p.col + p.cols]), () => p.cols++],
      [range(p.row, p.rows).map((r) => [r, p.col - 1]), () => { p.col--; p.cols++ }],
    ]
    for (const [cells, apply] of options) {
      if (!cells.every(([r, c]) => isDeadHole(r, c))) continue
      cells.forEach(([r, c]) => fill(r, c, index))
      apply()
      return true
    }
    return false
  }

  // One step per item per pass so neighbours share holes evenly.
  let changed = true
  while (changed) {
    changed = false
    placements.forEach((p, index) => {
      if (grow(p, index)) changed = true
    })
  }

  return placements
}
