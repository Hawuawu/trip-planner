import { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  MenuItem,
  IconButton,
  Button,
  Radio,
  RadioGroup,
  FormControlLabel,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { useTripStore } from '../../store/tripStore';
import { formatMoney } from '../../utils/currency';
import type { BudgetAlternative, BudgetItem, BudgetRateType } from '../../types';

const RATE_TYPE_LABELS: Record<BudgetRateType, string> = {
  constant: 'Constant',
  per_person: 'Per person',
  per_night: 'Per night',
};

interface Props {
  item: BudgetItem;
  currency: string;
}

type Editing = { id: string } | { id: 'new' };

export function BudgetAlternativesEditor({ item, currency }: Props) {
  const updateBudgetItem = useTripStore((s) => s.updateBudgetItem);
  const selectBudgetItemAlternative = useTripStore((s) => s.selectBudgetItemAlternative);

  const [editing, setEditing] = useState<Editing | null>(null);
  const [formLabel, setFormLabel] = useState('');
  const [formPrice, setFormPrice] = useState('0');
  const [formRateType, setFormRateType] = useState<BudgetRateType>('constant');
  const [formQuantity, setFormQuantity] = useState('1');

  const alternatives = item.alternatives ?? [];

  function startEdit(alt: BudgetAlternative) {
    setEditing({ id: alt.id });
    setFormLabel(alt.label);
    setFormPrice(String(alt.price));
    setFormRateType(alt.rateType);
    setFormQuantity(String(alt.quantity));
  }

  function startAdd() {
    setEditing({ id: 'new' });
    setFormLabel('');
    setFormPrice('0');
    setFormRateType('constant');
    setFormQuantity('1');
  }

  function cancelEdit() {
    setEditing(null);
  }

  async function handleSave() {
    if (!editing || !formLabel.trim()) return;
    const price = Number(formPrice) || 0;
    const quantity = Number(formQuantity) || 1;

    if (editing.id === 'new') {
      const created: BudgetAlternative = {
        id: crypto.randomUUID(),
        label: formLabel.trim(),
        price,
        rateType: formRateType,
        quantity,
        selected: alternatives.length === 0,
      };
      await updateBudgetItem(item.id, { alternatives: [...alternatives, created] });
    } else {
      await updateBudgetItem(item.id, {
        alternatives: alternatives.map((alt) =>
          alt.id === editing.id
            ? { ...alt, label: formLabel.trim(), price, rateType: formRateType, quantity }
            : alt
        ),
      });
    }
    setEditing(null);
  }

  async function handleDelete(alt: BudgetAlternative) {
    const remaining = alternatives.filter((a) => a.id !== alt.id);
    if (alt.selected && remaining.length > 0) {
      remaining[0] = { ...remaining[0], selected: true };
    }
    await updateBudgetItem(item.id, { alternatives: remaining });
  }

  return (
    <Box sx={{ pl: 3, mt: 0.5 }}>
      <RadioGroup
        value={alternatives.find((a) => a.selected)?.id ?? ''}
        onChange={(e) => void selectBudgetItemAlternative(item.id, e.target.value)}
      >
        {alternatives.map((alt) => (
          <Box key={alt.id}>
            {editing?.id === alt.id ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, my: 1 }}>
                <TextField
                  label="Label"
                  size="small"
                  autoFocus
                  value={formLabel}
                  onChange={(e) => setFormLabel(e.target.value)}
                />
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <TextField
                    label="Price"
                    size="small"
                    type="number"
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                  />
                  <TextField
                    select
                    label="Rate"
                    size="small"
                    value={formRateType}
                    onChange={(e) => setFormRateType(e.target.value as BudgetRateType)}
                  >
                    {Object.entries(RATE_TYPE_LABELS).map(([value, label]) => (
                      <MenuItem key={value} value={value}>
                        {label}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    label="Quantity"
                    size="small"
                    type="number"
                    disabled={formRateType === 'constant'}
                    value={formQuantity}
                    onChange={(e) => setFormQuantity(e.target.value)}
                  />
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={() => void handleSave()}
                    disabled={!formLabel.trim()}
                  >
                    Save
                  </Button>
                  <Button size="small" onClick={cancelEdit}>
                    Cancel
                  </Button>
                </Box>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <FormControlLabel
                  value={alt.id}
                  control={<Radio size="small" />}
                  sx={{ flexGrow: 1, mr: 0 }}
                  label={
                    <Typography variant="body2">
                      {alt.label} — {formatMoney(alt.price, currency)}
                      {alt.rateType !== 'constant' && ` (${RATE_TYPE_LABELS[alt.rateType]})`}
                    </Typography>
                  }
                />
                <IconButton
                  size="small"
                  aria-label={`Edit ${alt.label}`}
                  onClick={() => startEdit(alt)}
                >
                  <EditIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  aria-label={`Delete ${alt.label}`}
                  onClick={() => void handleDelete(alt)}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Box>
            )}
          </Box>
        ))}
      </RadioGroup>

      {editing?.id === 'new' && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, my: 1 }}>
          <TextField
            label="Label"
            size="small"
            autoFocus
            value={formLabel}
            onChange={(e) => setFormLabel(e.target.value)}
          />
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              label="Price"
              size="small"
              type="number"
              value={formPrice}
              onChange={(e) => setFormPrice(e.target.value)}
            />
            <TextField
              select
              label="Rate"
              size="small"
              value={formRateType}
              onChange={(e) => setFormRateType(e.target.value as BudgetRateType)}
            >
              {Object.entries(RATE_TYPE_LABELS).map(([value, label]) => (
                <MenuItem key={value} value={value}>
                  {label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Quantity"
              size="small"
              type="number"
              disabled={formRateType === 'constant'}
              value={formQuantity}
              onChange={(e) => setFormQuantity(e.target.value)}
            />
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="contained"
              size="small"
              onClick={() => void handleSave()}
              disabled={!formLabel.trim()}
            >
              Save
            </Button>
            <Button size="small" onClick={cancelEdit}>
              Cancel
            </Button>
          </Box>
        </Box>
      )}

      {editing === null && (
        <Button size="small" onClick={startAdd}>
          + Add alternative
        </Button>
      )}
    </Box>
  );
}
