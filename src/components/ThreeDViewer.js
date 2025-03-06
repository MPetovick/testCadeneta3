import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';

const ThreeDViewer = ({ matrix, colors }) => (
  <Canvas camera={{ position: [10, 15, 10] }}>
    <ambientLight intensity={0.5} />
    <pointLight position={[10, 10, 10]} />
    
    {matrix.map((row, i) => 
      row.map((stitch, j) => (
        <mesh
          key={`${i}-${j}`}
          position={[
            j + (i % 2 * 0.5),
            i * 0.3,
            0
          ]}
        >
          <boxGeometry args={[0.8, 0.2, 0.8]} />
          <meshStandardMaterial color={colors[stitch] || '#cccccc'} />
        </mesh>
      ))
    )}
    
    <OrbitControls 
      enableZoom={true}
      minDistance={5}
      maxDistance={20}
    />
  </Canvas>
);

export default ThreeDViewer;
