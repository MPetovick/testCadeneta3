import { TextField } from '@mui/material';

const TextEditor = ({ value, onChange }) => (
  <TextField
    multiline
    fullWidth
    rows={10}
    variant="outlined"
    label="Ingresa tu patrón"
    placeholder="Ejemplo:\nsc sc dc\nhdc ch slst"
    value={value}
    onChange={onChange}
    sx={{ fontFamily: 'monospace', margin: '1rem 0' }}
  />
);

export default TextEditor;
