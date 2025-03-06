const MatrixGrid = ({ matrix, colors }) => (
  <div className="matrix-grid">
    {matrix.map((row, i) => (
      <div key={i} className="matrix-row">
        {row.map((stitch, j) => (
          <div
            key={`${i}-${j}`}
            className="matrix-stitch"
            style={{ backgroundColor: colors[stitch] || '#cccccc' }}
          />
        ))}
      </div>
    ))}
  </div>
);

export default MatrixGrid;
