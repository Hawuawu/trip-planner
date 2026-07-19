import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  List,
  ListItem,
  ListItemText,
  Alert,
  Box,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import type { YamlValidationError } from '../../data/tripYaml';
import { readUploadedFileText, useYamlFilePicker } from '../../utils/fileTransfer';

interface ParsedYaml {
  checkpoints: unknown[];
  alternatives: unknown[];
  errors: YamlValidationError[];
}

interface Props<T extends ParsedYaml> {
  open: boolean;
  title: string;
  description: string;
  onClose: () => void;
  parse: (yamlText: string) => T;
  onConfirm: (parsed: T) => Promise<void>;
}

export function YamlImportDialog<T extends ParsedYaml>({
  open,
  title,
  description,
  onClose,
  parse,
  onConfirm,
}: Props<T>) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<T | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setFileName(null);
      setParsed(null);
      setSubmitting(false);
      setSubmitError(null);
    }
  }, [open]);

  const pickFile = useYamlFilePicker(async (file) => {
    setFileName(file.name);
    setSubmitError(null);
    const text = await readUploadedFileText(file);
    setParsed(parse(text));
  });

  function reset() {
    setFileName(null);
    setParsed(null);
    setSubmitError(null);
  }

  async function handleImport() {
    if (!parsed) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onConfirm(parsed);
      onClose();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setSubmitting(false);
    }
  }

  const hasErrors = Boolean(parsed && parsed.errors.length > 0);
  const isValid = Boolean(parsed && parsed.errors.length === 0);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {description}
        </Typography>

        {!parsed && (
          <Button variant="outlined" startIcon={<UploadFileIcon />} onClick={pickFile} fullWidth>
            Choose YAML file
          </Button>
        )}

        {fileName && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            {fileName}
          </Typography>
        )}

        {hasErrors && (
          <Box sx={{ mt: 2 }}>
            <Alert severity="error" sx={{ mb: 1 }}>
              This file has {parsed!.errors.length} validation{' '}
              {parsed!.errors.length === 1 ? 'error' : 'errors'}. Nothing was imported.
            </Alert>
            <List
              dense
              sx={{
                maxHeight: 240,
                overflowY: 'auto',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
              }}
            >
              {parsed!.errors.map((err, i) => (
                <ListItem key={i} divider>
                  <ListItemText primary={err.path} secondary={err.message} />
                </ListItem>
              ))}
            </List>
            <Button size="small" onClick={reset} sx={{ mt: 1 }}>
              Choose a different file
            </Button>
          </Box>
        )}

        {isValid && (
          <Box sx={{ mt: 2 }}>
            <Alert severity="success">
              Import {parsed!.checkpoints.length} checkpoint
              {parsed!.checkpoints.length === 1 ? '' : 's'} and {parsed!.alternatives.length}{' '}
              alternative
              {parsed!.alternatives.length === 1 ? '' : 's'}.
            </Alert>
          </Box>
        )}

        {submitError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {submitError}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        {isValid && (
          <Button variant="contained" onClick={handleImport} disabled={submitting}>
            {submitError ? 'Retry' : 'Import'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
