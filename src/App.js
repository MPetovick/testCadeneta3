import { useState, useRef } from 'react';
import { Button, TextField, Select, MenuItem, Box } from '@mui/material';
import { saveAs } from 'file-saver';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import TextEditor from './components/TextEditor';
import MatrixGrid from './components/MatrixGrid';
import ThreeDViewer from './components/ThreeDViewer';
import './styles.css';

const defaultColors = {
  sc: '#ff0000',
  dc: '#00ff00',
  hdc: '#0000ff',
  ch: '#ffff00',
  slst: '#ff00ff'
};

const App = () => {
  const [text, setText] = useState('');
  const [matrix, setMatrix] = useState([]);
  const [colors, setColors] = useState(defaultColors);
  const [selectedStitch, setSelectedStitch] = useState('sc');
  const [selectedColor, setSelectedColor] = useState('#ff0000');
  const threeRef = useRef();

  const parseText = (text) => {
    const rows = text.split('\n').map(row => row.trim().split(' '));
    setMatrix(rows);
  };

  const handleExportPDF = async () => {
    const pdf = new jsPDF();
    
    // Texto
    pdf.text(10, 10, 'Patrón de Crochet:\n' + text);
    
    // Captura 2D
    const canvas2D = await html2canvas(document.querySelector('.matrix-grid'));
    pdf.addImage(canvas2D.toDataURL('image/png'), 'PNG', 10, 30, 180, 100);
    
    // Captura 3D
    const canvas3D = threeRef.current.querySelector('canvas');
    pdf.addImage(canvas3D.toDataURL('image/png'), 'PNG', 10, 140, 180, 100);
    
    pdf.save('patron-crochet.pdf');
  };

  return (
    <div className="app">
      <h1>Crochet Pattern Maker</h1>
      
      <div className="editor-section">
        <TextEditor 
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            parseText(e.target.value);
          }}
        />
        
        <div className="tools">
          <Select
            value={selectedStitch}
            onChange={(e) => setSelectedStitch(e.target.value)}
          >
            {Object.keys(colors).map(stitch => (
              <MenuItem key={stitch} value={stitch}>{stitch.toUpperCase()}</MenuItem>
            ))}
          </Select>
          
          <input 
            type="color" 
            value={selectedColor}
            onChange={(e) => setSelectedColor(e.target.value)}
          />
        </div>
      </div>
      
      <div className="preview-section">
        <MatrixGrid matrix={matrix} colors={colors} />
        <div ref={threeRef}>
          <ThreeDViewer matrix={matrix} colors={colors} />
        </div>
      </div>
      
      <Button 
        variant="contained" 
        color="primary" 
        onClick={handleExportPDF}
      >
        Exportar PDF
      </Button>
    </div>
  );
};

export default App;
