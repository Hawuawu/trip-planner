import { useEffect, useRef, useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  MenuItem,
  IconButton,
  Button,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import { useTripStore } from '../../store/tripStore';
import { computeItemContribution } from '../../utils/budgetTotals';
import { formatMoney } from '../../utils/currency';
import { BudgetAlternativesEditor } from './BudgetAlternativesEditor';
import { MarkdownNotes } from '../shared/MarkdownNotes';
import { MarkdownNotesField } from '../shared/MarkdownNotesField';
import type { BudgetItem, BudgetRateType } from '../../types';

const RATE_TYPE_LABELS: Record<BudgetRateType, string> = {
  constant: 'Constant',
  per_person: 'Per person',
  per_night: 'Per night',
};

interface Props {
  budgetSectionId: string;
  items: BudgetItem[];
  currency: string;
  highlightItemId?: string | null;
}

type Editing = { id: string } | { id: 'new' };

export function BudgetItemList({ budgetSectionId, items, currency, highlightItemId }: Props) {
  const addBudgetItem = useTripStore((s) => s.addBudgetItem);
  const updateBudgetItem = useTripStore((s) => s.updateBudgetItem);
  const deleteBudgetItem = useTripStore((s) => s.deleteBudgetItem);

  const itemRefs = useRef(new Map<string, HTMLDivElement>());

  useEffect(() => {
    if (!highlightItemId) return;
    itemRefs.current.get(highlightItemId)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [highlightItemId]);

  const [editing, setEditing] = useState<Editing | null>(null);
  const [formName, setFormName] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formRateType, setFormRateType] = useState<BudgetRateType>('constant');
  const [formQuantity, setFormQuantity] = useState('1');
  const [formNotes, setFormNotes] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<BudgetItem | null>(null);

  const sortedItems = [...items].sort((a, b) => a.order - b.order);

  function startEdit(item: BudgetItem) {
    setEditing({ id: item.id });
    setFormName(item.name);
    setFormPrice(item.price !== undefined ? String(item.price) : '');
    setFormRateType(item.rateType);
    setFormQuantity(String(item.quantity));
    setFormNotes(item.notes ?? '');
  }

  function startAdd() {
    setEditing({ id: 'new' });
    setFormName('');
    setFormPrice('');
    setFormRateType('constant');
    setFormQuantity('1');
    setFormNotes('');
  }

  function cancelEdit() {
    setEditing(null);
  }

  async function handleSave() {
    if (!editing || !formName.trim()) return;
    const price = formPrice.trim() === '' ? undefined : Number(formPrice);
    const quantity = Number(formQuantity) || 1;
    const notes = formNotes.trim() || undefined;

    if (editing.id === 'new') {
      const nextOrder =
        sortedItems.length > 0 ? Math.max(...sortedItems.map((i) => i.order)) + 1 : 0;
      await addBudgetItem({
        budgetSectionId,
        name: formName.trim(),
        price,
        rateType: formRateType,
        quantity,
        notes,
        order: nextOrder,
      });
    } else {
      await updateBudgetItem(editing.id, {
        name: formName.trim(),
        price,
        rateType: formRateType,
        quantity,
        notes,
      });
    }
    setEditing(null);
  }

  async function moveItem(index: number, direction: -1 | 1) {
    const target = sortedItems[index + direction];
    const current = sortedItems[index];
    if (!target || !current) return;
    await Promise.all([
      updateBudgetItem(current.id, { order: target.order }),
      updateBudgetItem(target.id, { order: current.order }),
    ]);
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    await deleteBudgetItem(deleteTarget.id);
    setDeleteTarget(null);
  }

  return (
    <Box sx={{ pl: 2 }}>
      {sortedItems.map((item, index) => (
        <Box
          key={item.id}
          ref={(el: HTMLDivElement | null) => {
            if (el) itemRefs.current.set(item.id, el);
            else itemRefs.current.delete(item.id);
          }}
          sx={{
            mb: 1,
            border: '2px solid',
            borderColor: highlightItemId === item.id ? 'primary.main' : 'transparent',
            borderRadius: 1,
          }}
        >
          {editing?.id === item.id ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, my: 1 }}>
              <TextField
                label="Item name"
                size="small"
                autoFocus
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  label="Price"
                  size="small"
                  type="number"
                  helperText="Ignored when alternatives are set"
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
              <MarkdownNotesField label="Notes" value={formNotes} onChange={setFormNotes} />
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="contained"
                  size="small"
                  onClick={() => void handleSave()}
                  disabled={!formName.trim()}
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
              <Typography variant="body2" sx={{ flexGrow: 1 }}>
                {item.name} — {formatMoney(computeItemContribution(item), currency)}
              </Typography>
              <IconButton
                size="small"
                aria-label={`Move ${item.name} up`}
                disabled={index === 0}
                onClick={() => void moveItem(index, -1)}
              >
                <ArrowUpwardIcon fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                aria-label={`Move ${item.name} down`}
                disabled={index === sortedItems.length - 1}
                onClick={() => void moveItem(index, 1)}
              >
                <ArrowDownwardIcon fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                aria-label={`Edit ${item.name}`}
                onClick={() => startEdit(item)}
              >
                <EditIcon fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                aria-label={`Delete ${item.name}`}
                onClick={() => setDeleteTarget(item)}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          )}
          {editing?.id !== item.id && item.notes && (
            <Box sx={{ mt: 0.25 }}>
              <MarkdownNotes notes={item.notes} variant="body2" />
            </Box>
          )}
          {editing?.id !== item.id && <BudgetAlternativesEditor item={item} currency={currency} />}
          {index < sortedItems.length - 1 && <Divider sx={{ mt: 1 }} />}
        </Box>
      ))}

      {editing?.id === 'new' && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, my: 1 }}>
          <TextField
            label="Item name"
            size="small"
            autoFocus
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
          />
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              label="Price"
              size="small"
              type="number"
              helperText="Ignored when alternatives are set"
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
          <MarkdownNotesField label="Notes" value={formNotes} onChange={setFormNotes} />
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="contained"
              size="small"
              onClick={() => void handleSave()}
              disabled={!formName.trim()}
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
          + Add item
        </Button>
      )}

      <Dialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Delete item</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Delete "{deleteTarget?.name}"? This can't be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button color="error" onClick={() => void handleConfirmDelete()}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
